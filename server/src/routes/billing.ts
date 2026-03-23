import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { updateUserPlan, updateUserStripeCustomerId, getProfileByStripeCustomerId } from '../db/index.js';

const router = Router();

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
      console.error('Webhook signature verification failed:', err);
      res.status(400).json({ error: 'Webhook signature verification failed' });
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId || null;
        const customerId = session.customer as string;

        if (userId) {
          const planResult = await updateUserPlan(userId, 'pro');
          if (!planResult.success) {
            console.error(`Failed to upgrade user ${userId} to Pro:`, planResult.error);
            res.status(500).json({ error: 'Failed to update user plan' });
            return;
          }
          if (customerId) {
            const customerResult = await updateUserStripeCustomerId(userId, customerId);
            if (!customerResult.success) {
              console.error(`Failed to set Stripe customer ID for user ${userId}:`, customerResult.error);
            }
          }
          console.log(`User ${userId} upgraded to Pro`);
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
            console.error(`Failed to downgrade user ${user.id}:`, result.error);
            res.status(500).json({ error: 'Failed to update user plan' });
            return;
          }
          console.log(`User ${user.id} downgraded to free (subscription deleted)`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const user = await getProfileByStripeCustomerId(customerId);
        if (user) {
          console.warn(`Payment failed for user ${user.id} (customer: ${customerId})`);
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
