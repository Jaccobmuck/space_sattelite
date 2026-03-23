import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { getProfileById, type SafeUser } from '../db/index.js';

export interface AuthRequest extends Request {
  user?: SafeUser;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.accessToken;
  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }
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

    req.user = profile;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.accessToken;
  if (!token) {
    next();
    return;
  }
  try {
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (!error && authUser) {
      const profile = await getProfileById(authUser.id);
      if (profile) {
        req.user = profile;
      }
    }
  } catch {
    // Token invalid — continue as unauthenticated
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
