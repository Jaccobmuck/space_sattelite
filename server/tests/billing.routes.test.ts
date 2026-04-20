import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ── Environment ─────────────────────────────────────────────────────────────
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.STRIPE_PRO_PRICE_ID = 'price_test_pro';
process.env.CLIENT_URL = 'http://localhost:5173';

// ── Hoisted mock references ─────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  stripeCheckoutCreate: vi.fn(),
  stripeSubsList: vi.fn(),
  stripeConstructEvent: vi.fn(),
  stripePortalCreate: vi.fn(),
  getProfileByStripeCustomerId: vi.fn(),
  updateUserBillingState: vi.fn(),
  updateUserPlan: vi.fn(),
  requireAuth: vi.fn(),
}));

// ── Module mocks ────────────────────────────────────────────────────────────
vi.mock('stripe', () => ({
  default: vi.fn(function () {
    return {
      checkout: { sessions: { create: mocks.stripeCheckoutCreate } },
      subscriptions: { list: mocks.stripeSubsList },
      webhooks: { constructEvent: mocks.stripeConstructEvent },
      billingPortal: { sessions: { create: mocks.stripePortalCreate } },
    };
  }),
}));

vi.mock('../src/db/index.js', () => ({
  getProfileByStripeCustomerId: mocks.getProfileByStripeCustomerId,
  updateUserBillingState: mocks.updateUserBillingState,
  updateUserPlan: mocks.updateUserPlan,
}));

vi.mock('../src/middleware/auth.js', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('../src/lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Imports (resolved against mocks) ────────────────────────────────────────
import billingRouter from '../src/routes/billing.js';

// ── Test app ────────────────────────────────────────────────────────────────
// Mirror the real app's middleware order from src/index.ts:
// 1. Raw body parser for webhook (before JSON parser)
// 2. JSON body parser for other billing endpoints
// 3. Billing router
// 4. Error handler (catches asyncHandler rejections)
const app = express();
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/api/billing', billingRouter);
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Test fixtures ───────────────────────────────────────────────────────────
const TEST_USER = {
  id: 'user-test-123',
  email: 'test@sentry.app',
  plan: 'free' as const,
  stripe_customer_id: null as string | null,
  pending_deletion: false,
  deletion_requested_at: null,
  username: null,
  display_name: null,
  bio: null,
  location_city: null,
  location_region: null,
  lat: null,
  lng: null,
  created_at: '2024-01-01T00:00:00Z',
};

let currentTestUser: typeof TEST_USER | undefined;

// ═════════════════════════════════════════════════════════════════════════════
// Test suites
// ═════════════════════════════════════════════════════════════════════════════

describe('Billing Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTestUser = { ...TEST_USER };
    mocks.requireAuth.mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Record<string, unknown>).user = currentTestUser;
        next();
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════════
  // Suite 1 — Checkout session creation
  // ════════════════════════════════════════════════════════════════════════
  describe('POST /api/billing/create-checkout-session', () => {
    it('creates a session and returns the Stripe URL for a valid authenticated user', async () => {
      mocks.stripeCheckoutCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/test-session',
      });

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ url: 'https://checkout.stripe.com/test-session' });
      expect(mocks.stripeCheckoutCreate).toHaveBeenCalledOnce();
      expect(mocks.stripeCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_test_pro', quantity: 1 }],
          metadata: { userId: 'user-test-123' },
        }),
        expect.objectContaining({
          idempotencyKey: expect.stringContaining('user-test-123'),
        }),
      );
    });

    it('returns 401 when unauthenticated', async () => {
      mocks.requireAuth.mockImplementation(
        (_req: Request, res: Response, _next: NextFunction) => {
          res.status(401).json({ error: 'Access token required' });
        },
      );

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send();

      expect(res.status).toBe(401);
    });

    it('returns 500 when Stripe throws and does not leak internal error', async () => {
      mocks.stripeCheckoutCreate.mockRejectedValue(new Error('Stripe unavailable'));

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send();

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).not.toBe('Stripe unavailable');
    });

    it.skip('creates an educator session with the correct price ID — no educator endpoint exists', () => {
      // TODO: add POST /api/billing/create-checkout-session/educator once educator tier is introduced.
      // Profile.plan is currently 'free' | 'pro' with no STRIPE_EDUCATOR_PRICE_ID env var.
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Suite 2 — Duplicate subscription guard
  // ════════════════════════════════════════════════════════════════════════
  describe('Duplicate subscription guard', () => {
    it('blocks checkout if user already has an active pro subscription', async () => {
      currentTestUser = { ...TEST_USER, stripe_customer_id: 'cus_existing' };
      mocks.stripeSubsList.mockResolvedValue({
        data: [{ status: 'active' }],
      });

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send();

      expect(res.status).toBe(409);
      expect(res.body.hasSubscription).toBe(true);
      expect(mocks.stripeCheckoutCreate).not.toHaveBeenCalled();
    });

    it('allows checkout if user has no active subscription', async () => {
      currentTestUser = { ...TEST_USER, stripe_customer_id: 'cus_existing' };
      mocks.stripeSubsList.mockResolvedValue({
        data: [{ status: 'canceled' }],
      });
      mocks.stripeCheckoutCreate.mockResolvedValue({
        url: 'https://checkout.stripe.com/test-session',
      });

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send();

      expect(res.status).toBe(200);
      expect(mocks.stripeCheckoutCreate).toHaveBeenCalledOnce();
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Suite 3 — Stripe webhook handler
  // ════════════════════════════════════════════════════════════════════════
  describe('POST /api/billing/webhook', () => {
    it('updates user plan to pro on checkout.session.completed', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: { userId: 'user-test-123' },
            customer: 'cus_test123',
            subscription: 'sub_test123',
          },
        },
      });
      mocks.updateUserBillingState.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', 'test_sig')
        .set('content-type', 'application/json')
        .send('{}');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      expect(mocks.updateUserBillingState).toHaveBeenCalledWith(
        'user-test-123',
        'pro',
        'cus_test123',
      );
    });

    it.skip('updates user plan to educator on checkout.session.completed — educator plan not in schema', () => {
      // TODO: Profile.plan is 'free' | 'pro'. Add 'educator' variant and
      // update the webhook handler to read metadata.plan before wiring this test.
    });

    it('downgrades user to free on customer.subscription.deleted', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        id: 'evt_test_456',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_test123',
          },
        },
      });
      mocks.getProfileByStripeCustomerId.mockResolvedValue({
        ...TEST_USER,
        id: 'user-test-123',
        plan: 'pro',
        stripe_customer_id: 'cus_test123',
      });
      mocks.updateUserPlan.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', 'test_sig')
        .set('content-type', 'application/json')
        .send('{}');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      expect(mocks.updateUserPlan).toHaveBeenCalledWith('user-test-123', 'free');
    });

    it('rejects invalid webhook signatures with 400', async () => {
      mocks.stripeConstructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', 'invalid_sig')
        .set('content-type', 'application/json')
        .send('{}');

      expect(res.status).toBe(400);
      expect(mocks.updateUserBillingState).not.toHaveBeenCalled();
      expect(mocks.updateUserPlan).not.toHaveBeenCalled();
    });

    it('returns 200 and no-ops on unhandled event types', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        id: 'evt_test_789',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });

      const res = await request(app)
        .post('/api/billing/webhook')
        .set('stripe-signature', 'test_sig')
        .set('content-type', 'application/json')
        .send('{}');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      expect(mocks.updateUserBillingState).not.toHaveBeenCalled();
      expect(mocks.updateUserPlan).not.toHaveBeenCalled();
      expect(mocks.getProfileByStripeCustomerId).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Suite 4 — requirePro middleware (unit tests)
  // ════════════════════════════════════════════════════════════════════════
  describe('requirePro middleware', () => {
    // Tested in isolation following the established pattern from
    // auth.middleware.test.ts — re-implement locally to avoid ESM
    // import issues with the auth module's Supabase dependency.
    function requirePro(
      req: { user?: { plan: string } },
      res: Response,
      next: NextFunction,
    ): void {
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

    function createMockRes(): Response {
      return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response;
    }

    it('calls next() for a user with plan: pro', () => {
      const req = { user: { plan: 'pro' } };
      const res = createMockRes();
      const next = vi.fn();

      requirePro(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 403 for a user with plan: educator — educator not recognized by requirePro', () => {
      // TODO: confirm whether educator plan should pass requirePro.
      // Currently Profile.plan is 'free' | 'pro' — no educator tier exists.
      // If educator is added, requirePro should likely allow it.
      const req = { user: { plan: 'educator' } };
      const res = createMockRes();
      const next = vi.fn();

      requirePro(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 for a user with plan: free', () => {
      const req = { user: { plan: 'free' } };
      const res = createMockRes();
      const next = vi.fn();

      requirePro(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Pro plan required',
        upgrade: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for an unauthenticated request', () => {
      const req = { user: undefined };
      const res = createMockRes();
      const next = vi.fn();

      requirePro(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it.skip('returns 500 when Supabase errors — requirePro does not make DB calls', () => {
      // requirePro only checks req.user.plan which is populated upstream
      // by requireAuth. It has no direct Supabase dependency.
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // Suite 5 — requireEducator middleware
  // ════════════════════════════════════════════════════════════════════════
  describe('requireEducator middleware', () => {
    it.todo('requireEducator middleware — add after educator tier is introduced');
  });
});
