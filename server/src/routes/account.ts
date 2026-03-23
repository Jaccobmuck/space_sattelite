import { Router, Response } from 'express';
import Stripe from 'stripe';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../lib/supabase.js';
import { getProfileByEmail, updateProfile, deleteProfile } from '../db/index.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger } from '../lib/logger.js';

const router = Router();

// All account routes require auth
router.use(requireAuth);

// GET /api/account/me
router.get('/me', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    created_at: user.created_at,
  });
});

// PATCH /api/account/password
router.patch(
  '/password',
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 8, max: 128 }).withMessage('New password must be 8-128 characters'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const { current_password, new_password } = req.body as { current_password: string; new_password: string };

    // Verify current password by attempting to sign in
    const { error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: req.user!.email,
      password: current_password,
    });

    if (authError) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user!.id, {
      password: new_password,
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Password updated. Please log in again.' });
  })
);

// PATCH /api/account/email
router.patch(
  '/email',
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const { current_password, new_email } = req.body as { current_password: string; new_email: string };

    // Verify current password
    const { error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: req.user!.email,
      password: current_password,
    });

    if (authError) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Check if new email is already taken
    const existing = await getProfileByEmail(new_email);
    if (existing && existing.id !== req.user!.id) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const previousEmail = req.user!.email;

    // Update in Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user!.id, {
      email: new_email,
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Update in profiles table
    const profileResult = await updateProfile(req.user!.id, { email: new_email });
    if (!profileResult.success) {
      const rollbackResult = await supabaseAdmin.auth.admin.updateUserById(req.user!.id, {
        email: previousEmail,
      });
      if (rollbackResult.error) {
        logger.error('Failed to roll back auth email after profile update failure', {
          userId: req.user!.id,
          attemptedEmail: new_email,
          rollbackEmail: previousEmail,
          error: rollbackResult.error.message,
        });
      }
      res.status(500).json({ error: profileResult.error || 'Failed to update profile' });
      return;
    }

    res.json({ message: 'Email updated.', email: new_email });
  })
);

// DELETE /api/account
router.delete(
  '/',
  body('current_password').notEmpty().withMessage('Current password is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const { current_password } = req.body as { current_password: string };

    // Verify current password before deletion
    const { error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email,
      password: current_password,
    });

    if (authError) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Cancel ALL cancellable Stripe subscriptions - not just active ones
    if (user.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
        });
        
        // Get all subscriptions including trialing, past_due, unpaid, incomplete
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'all',
        });
        
        // Cancel any subscription that can still bill the customer
        const cancellableStatuses = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];
        const subscriptionsToCancel = subscriptions.data.filter((sub) =>
          cancellableStatuses.includes(sub.status)
        );
        const cancellationResults = await Promise.allSettled(
          subscriptionsToCancel.map(async (sub) => {
            const canceled = await stripe.subscriptions.cancel(sub.id);
            if (canceled.status !== 'canceled') {
              throw new Error(`Subscription ${sub.id} not canceled, status: ${canceled.status}`);
            }
          })
        );

        const failedCancellations = cancellationResults.filter(
          (result): result is PromiseRejectedResult => result.status === 'rejected'
        );

        if (failedCancellations.length > 0) {
          throw new Error(
            `Failed to cancel ${failedCancellations.length} of ${subscriptionsToCancel.length} subscriptions`
          );
        }
      } catch (err) {
        logger.error('Failed to cancel Stripe subscriptions during account deletion', {
          userId: user.id,
          stripeCustomerId: user.stripe_customer_id,
          error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ 
          error: 'Failed to cancel subscription. Please try again or contact support.',
        });
        return;
      }
    }

    // Delete user from Supabase Auth (cascades to profiles) and verify result
    const deleteResult = await deleteProfile(user.id);
    if (!deleteResult.success) {
      logger.error('Failed to delete user account', {
        userId: user.id,
        error: deleteResult.error,
      });
      res.status(500).json({ error: 'Failed to delete account. Please try again or contact support.' });
      return;
    }

    res.json({ message: 'Account deleted.' });
  })
);

export default router;
