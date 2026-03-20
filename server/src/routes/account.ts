import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { body, validationResult } from 'express-validator';
import { getUserByEmail, getUserByIdFull, updateUser, deleteUser } from '../db/index.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

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
  body('current_password').isString().notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 8, max: 128 }).withMessage('New password must be 8-128 characters'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const { current_password, new_password } = req.body as {
      current_password: string;
      new_password: string;
    };

    if (current_password === new_password) {
      res.status(400).json({ error: 'New password must be different from current password' });
      return;
    }

    const fullUser = getUserByIdFull(req.user!.id);
    if (!fullUser) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(current_password, fullUser.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(new_password, 12);
    updateUser(fullUser.id, {
      password_hash: newHash,
      refresh_token_hash: null, // Invalidate all sessions
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/api/auth',
    });

    res.json({ message: 'Password updated. Please log in again.' });
  })
);

// PATCH /api/account/email
router.patch(
  '/email',
  body('new_email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().notEmpty().withMessage('Password is required to confirm identity'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const { new_email, password } = req.body as {
      new_email: string;
      password: string;
    };

    const fullUser = getUserByIdFull(req.user!.id);
    if (!fullUser) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(password, fullUser.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Password is incorrect' });
      return;
    }

    // Check if new email is already taken
    const existing = getUserByEmail(new_email);
    if (existing && existing.id !== fullUser.id) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    updateUser(fullUser.id, { email: new_email });

    res.json({ message: 'Email updated.', email: new_email });
  })
);

// DELETE /api/account
router.delete(
  '/',
  body('password').isString().notEmpty().withMessage('Password is required to delete account'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const { password } = req.body as { password: string };

    const fullUser = getUserByIdFull(req.user!.id);
    if (!fullUser) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(password, fullUser.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Password is incorrect' });
      return;
    }

    // Cancel Stripe subscriptions if customer exists
    if (fullUser.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
        });
        const subscriptions = await stripe.subscriptions.list({
          customer: fullUser.stripe_customer_id,
          status: 'active',
        });
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id);
        }
      } catch (err) {
        console.error('Failed to cancel Stripe subscriptions during account deletion:', err);
      }
    }

    deleteUser(fullUser.id);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/api/auth',
    });

    res.json({ message: 'Account deleted.' });
  })
);

export default router;
