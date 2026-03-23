import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getProfileByStripeCustomerId, updateUserBillingState, updateUserPlan } from '../db/index.js';
import { logger } from '../lib/logger.js';

const router = Router();

const PRO_ENTITLED_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
]);

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  });
}

router.post(
  '/create-checkout-session',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const stripe = getStripe();
    const user = req.user!;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // Check for existing active/trialing subscription to prevent double-billing
    if (user.stripe_customer_id) {
      const existingSubs = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'all',
      });
      
      const activeSub = existingSubs.data.find(sub => 
        PRO_ENTITLED_SUBSCRIPTION_STATUSES.has(sub.status)
      );
      
      if (activeSub) {
        res.status(409).json({ 
          error: 'You already have an active subscription. Manage it from the billing portal.',
          hasSubscription: true,
        });
        return;
      }
    }

    // Stable idempotency key prevents duplicate sessions from retries/double-clicks.
    const idempotencyKey = `checkout_${user.id}_${process.env.STRIPE_PRO_PRICE_ID!}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.stripe_customer_id ? undefined : user.email,
      customer: user.stripe_customer_id || undefined,
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      metadata: {
        userId: String(user.id),
      },
      success_url: `${clientUrl}/account?upgrade=success`,
      cancel_url: `${clientUrl}/account?upgrade=cancelled`,
    }, {
      idempotencyKey,
    });

    res.json({ url: session.url });
  })
);

router.post(
  '/portal',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const stripe = getStripe();
    const user = req.user!;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    if (!user.stripe_customer_id) {
      res.status(400).json({ error: 'No Stripe customer found' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${clientUrl}/account`,
    });

    res.json({ url: session.url });
  })
);

router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      logger.error('Webhook signature verification failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      res.status(400).json({ error: 'Webhook signature verification failed' });
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId || null;
        const customerId = session.customer as string;

        if (userId) {
          if (!customerId) {
            logger.error('Checkout session completed without Stripe customer ID', {
              userId,
              eventId: event.id,
              sessionId: session.id,
            });
            res.status(500).json({ error: 'Missing Stripe customer ID' });
            return;
          }

          const billingResult = await updateUserBillingState(userId, 'pro', customerId);
          if (!billingResult.success) {
            logger.error('Failed to persist billing state after checkout', {
              userId,
              customerId,
              eventId: event.id,
              error: billingResult.error,
            });
            res.status(500).json({ error: 'Failed to persist billing state' });
            return;
          }

          logger.info('User upgraded to Pro', {
            userId,
            customerId,
            eventId: event.id,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Handle subscription status changes (e.g., past_due, unpaid)
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const user = await getProfileByStripeCustomerId(customerId);
        
        if (user) {
          if (!PRO_ENTITLED_SUBSCRIPTION_STATUSES.has(subscription.status)) {
            const result = await updateUserPlan(user.id, 'free');
            if (!result.success) {
              logger.error('Failed to downgrade user after subscription update', {
                userId: user.id,
                customerId,
                status: subscription.status,
                eventId: event.id,
                error: result.error,
              });
              res.status(500).json({ error: 'Failed to update user plan' });
              return;
            }
            logger.info('User downgraded to free after subscription update', {
              userId: user.id,
              customerId,
              status: subscription.status,
              eventId: event.id,
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const user = await getProfileByStripeCustomerId(customerId);
        if (user) {
          const result = await updateUserPlan(user.id, 'free');
          if (!result.success) {
            logger.error('Failed to downgrade user after subscription deletion', {
              userId: user.id,
              customerId,
              eventId: event.id,
              error: result.error,
            });
            res.status(500).json({ error: 'Failed to update user plan' });
            return;
          }
          logger.info('User downgraded to free after subscription deletion', {
            userId: user.id,
            customerId,
            eventId: event.id,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const user = await getProfileByStripeCustomerId(customerId);
        if (user) {
          logger.warn('Stripe invoice payment failed', {
            userId: user.id,
            customerId,
            eventId: event.id,
          });
        }
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  })
);

export default router;
