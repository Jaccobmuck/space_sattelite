import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { getProfileById, type SafeUser } from '../db/index.js';
import { logger } from '../lib/logger.js';

export interface AuthRequest extends Request {
  user?: SafeUser;
}

<<<<<<< HEAD
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
=======
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.accessToken;
  if (!token) {
>>>>>>> 7e55b138c5a488bbafa244a033741e2c897ce40b
    res.status(401).json({ error: 'Access token required' });
    return;
  }

<<<<<<< HEAD
  const token = match[1];
=======
>>>>>>> 7e55b138c5a488bbafa244a033741e2c897ce40b
  try {
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !authUser) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }

    const profile = await getProfileById(authUser.id);
    if (!profile) {
      res.status(401).json({ error: 'User profile not found' });
      return;
    }
    if (profile.pending_deletion) {
      res.status(403).json({ error: 'Account deletion in progress' });
      return;
    }

    req.user = profile;
    next();
  } catch (error) {
    logger.warn('Auth middleware rejected request', {
      path: req.path,
      message: error instanceof Error ? error.message : 'Unknown auth error',
    });
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

<<<<<<< HEAD
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
=======
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.accessToken;
  if (!token) {
>>>>>>> 7e55b138c5a488bbafa244a033741e2c897ce40b
    next();
    return;
  }

<<<<<<< HEAD
  const token = match[1];
=======
>>>>>>> 7e55b138c5a488bbafa244a033741e2c897ce40b
  try {
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && authUser) {
      const profile = await getProfileById(authUser.id);
      if (profile && !profile.pending_deletion) {
        req.user = profile;
      }
    }
  } catch (error) {
    logger.warn('Optional auth ignored invalid token', {
      path: req.path,
      message: error instanceof Error ? error.message : 'Unknown auth error',
    });
  }

  next();
}

export function requirePro(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.plan !== 'pro') {
    res.status(403).json({ error: 'Pro plan required', upgrade: true });
    return;
  }
  next();
}
