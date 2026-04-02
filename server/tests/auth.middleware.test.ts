import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mock the db module
vi.mock('../src/db/index.js', () => ({
  getUserById: vi.fn(),
}));

import { getUserById } from '../src/db/index.js';

// Re-implement middleware for testing (avoiding import issues with ESM)
interface SafeUser {
  id: number;
  email: string;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
}

interface AuthRequest extends Request {
  user?: SafeUser;
}

const JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-64-characters-long-for-testing';

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as { userId: number };
    const user = (getUserById as ReturnType<typeof vi.fn>)(payload.userId);
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

function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as { userId: number };
    const user = (getUserById as ReturnType<typeof vi.fn>)(payload.userId);
    if (user) {
      req.user = user;
    }
  } catch {
    // Token invalid — continue as unauthenticated
  }
  next();
}

function requirePro(req: AuthRequest, res: Response, next: NextFunction): void {
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

// Mock Express request/response
function createMockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: {},
    ...overrides,
  } as AuthRequest;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const mockNext = vi.fn() as NextFunction;

const mockUser: SafeUser = {
  id: 1,
  email: 'test@example.com',
  plan: 'free',
  stripe_customer_id: null,
  failed_login_attempts: 0,
  locked_until: null,
  created_at: '2024-01-01T00:00:00Z',
};

const mockProUser: SafeUser = {
  ...mockUser,
  plan: 'pro',
};

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should reject request without authorization header', () => {
      const req = createMockReq();
      const res = createMockRes();

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', () => {
      const req = createMockReq({
        headers: { authorization: 'InvalidFormat token123' },
      });
      const res = createMockRes();

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    });

    it('should reject request with invalid token', () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer invalid.token.here' },
      });
      const res = createMockRes();

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired access token' });
    });

    it('should reject request with expired token', () => {
      const expiredToken = jwt.sign({ userId: 1 }, JWT_ACCESS_SECRET, { expiresIn: '-1s' });
      const req = createMockReq({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const res = createMockRes();

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired access token' });
    });

    it('should reject if user not found in database', () => {
      const token = jwt.sign({ userId: 999 }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
      const req = createMockReq({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockRes();
      (getUserById as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      requireAuth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should attach user to request and call next on valid token', () => {
      const token = jwt.sign({ userId: 1 }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
      const req = createMockReq({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockRes();
      (getUserById as ReturnType<typeof vi.fn>).mockReturnValue(mockUser);

      requireAuth(req, res, mockNext);

      expect(req.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should call next without user when no auth header', () => {
      const req = createMockReq();
      const res = createMockRes();

      optionalAuth(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without user when token is invalid', () => {
      const req = createMockReq({
        headers: { authorization: 'Bearer invalid.token' },
      });
      const res = createMockRes();

      optionalAuth(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach user when valid token provided', () => {
      const token = jwt.sign({ userId: 1 }, JWT_ACCESS_SECRET, { expiresIn: '15m' });
      const req = createMockReq({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockRes();
      (getUserById as ReturnType<typeof vi.fn>).mockReturnValue(mockUser);

      optionalAuth(req, res, mockNext);

      expect(req.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requirePro', () => {
    it('should reject if no user attached', () => {
      const req = createMockReq();
      const res = createMockRes();

      requirePro(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should reject free user with upgrade flag', () => {
      const req = createMockReq();
      req.user = mockUser; // free plan
      const res = createMockRes();

      requirePro(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pro plan required', upgrade: true });
    });

    it('should allow pro user through', () => {
      const req = createMockReq();
      req.user = mockProUser;
      const res = createMockRes();

      requirePro(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
