import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById, type SafeUser } from '../db/index.js';

export interface AuthRequest extends Request {
  user?: SafeUser;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const token = match[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { userId: number };
    const user = getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
    next();
    return;
  }

  const token = match[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { userId: number };
    const user = getUserById(payload.userId);
    if (user) {
      req.user = user;
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
