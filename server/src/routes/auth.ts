import { Router, Response, CookieOptions } from 'express';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../lib/supabase.js';
import { getProfileById } from '../db/index.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

const NODE_ENV = process.env.NODE_ENV || 'development';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

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

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('already been registered')) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    // Get the profile (created by trigger)
    const profile = await getProfileById(data.user.id);

    res.status(201).json({ 
      user: profile,
      message: 'Registration successful. Please sign in.',
    });
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

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const profile = await getProfileById(data.user.id);
    if (!profile) {
      res.status(401).json({ error: 'User profile not found' });
      return;
    }
    if (profile.pending_deletion) {
      await supabaseAdmin.auth.admin.signOut(data.user.id);
      res.status(403).json({ error: 'Account deletion in progress' });
      return;
    }

    res.cookie('accessToken', data.session.access_token, {
      ...cookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    res.cookie('refreshToken', data.session.refresh_token, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    res.json({ user: profile });
  })
);

router.post('/refresh', asyncHandler(async (req: AuthRequest, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  
  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  const profile = await getProfileById(data.user!.id);
  if (!profile) {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.status(401).json({ error: 'User profile not found' });
    return;
  }
  if (profile.pending_deletion) {
    await supabaseAdmin.auth.admin.signOut(data.user!.id);
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.status(403).json({ error: 'Account deletion in progress' });
    return;
  }

  res.cookie('accessToken', data.session.access_token, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie('refreshToken', data.session.refresh_token, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  res.json({ user: profile });
}));

router.post('/logout', asyncHandler(async (req: AuthRequest, res: Response) => {
  // Always clear cookies first - don't require valid auth to logout
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  
  // Try to invalidate server-side session if we can identify the user
  const token = req.cookies?.accessToken;
  if (token) {
    try {
      const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(token);
      if (authUser) {
        await supabaseAdmin.auth.admin.signOut(authUser.id);
      }
    } catch {
      // Token invalid/expired - that's fine, cookies are already cleared
    }
  }
  
  res.json({ message: 'Logged out' });
}));

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
