import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { createUser, getUserByEmail, getUserById, getUserByIdFull, updateUser } from '../db/index.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

function generateAccessToken(userId: number): string {
  return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });
}

function generateRefreshToken(userId: number): string {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
}

async function issueTokensAndSetCookie(
  userId: number,
  res: Response
): Promise<{ accessToken: string }> {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);

  // Store hashed refresh token in DB for invalidation support
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  updateUser(userId, { refresh_token_hash: refreshTokenHash });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });

  return { accessToken };
}

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
};

const emailValidation = body('email').isEmail().normalizeEmail().withMessage('Valid email is required');
const passwordValidation = body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters');

router.post(
  '/register',
  emailValidation,
  passwordValidation,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };

    const existing = getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = createUser(email, passwordHash);

    const { accessToken } = await issueTokensAndSetCookie(user.id, res);

    res.status(201).json({ user, accessToken });
  })
);

router.post(
  '/login',
  emailValidation,
  passwordValidation,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };

    const user = getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check account lockout
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const newAttempts = user.failed_login_attempts + 1;
      const lockUntil = newAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;
      updateUser(user.id, {
        failed_login_attempts: newAttempts,
        locked_until: lockUntil,
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Reset failed attempts on successful login
    updateUser(user.id, {
      failed_login_attempts: 0,
      locked_until: null,
    });

    const { accessToken } = await issueTokensAndSetCookie(user.id, res);

    const { password_hash: _pw, refresh_token_hash: _rt, ...safeUser } = user;
    res.json({ user: safeUser, accessToken });
  })
);

router.post('/refresh', asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { userId: number };
    const fullUser = getUserByIdFull(payload.userId);
    if (!fullUser) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Verify refresh token matches stored hash (invalidation support)
    if (!fullUser.refresh_token_hash) {
      res.status(401).json({ error: 'Session invalidated. Please log in again.' });
      return;
    }

    const tokenValid = await bcrypt.compare(token, fullUser.refresh_token_hash);
    if (!tokenValid) {
      res.status(401).json({ error: 'Session invalidated. Please log in again.' });
      return;
    }

    const user = getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const accessToken = generateAccessToken(user.id);
    res.json({ user, accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}));

router.post('/logout', requireAuth, (req: AuthRequest, res: Response) => {
  // Invalidate refresh token in DB
  if (req.user) {
    updateUser(req.user.id, { refresh_token_hash: null });
  }
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
  res.json({ message: 'Logged out' });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
