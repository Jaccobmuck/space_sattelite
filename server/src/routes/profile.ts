import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { optionalAuth, requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getPublicProfile,
  getProfileByUsername,
  isUsernameTaken,
  setUsername,
  updateProfile,
} from '../db/index.js';
import { getProfileStats, getUserPublicSightings } from '../db/community.js';

const router = Router();

// Username validation regex: alphanumeric, underscores, 3-20 chars
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

// ============================================
// Static routes MUST come before dynamic :username routes
// ============================================

// POST /api/profile/username - Set username (one-time only)
router.post(
  '/username',
  requireAuth,
  body('username')
    .trim()
    .matches(USERNAME_REGEX)
    .withMessage('Username must be 3-20 characters, alphanumeric and underscores only'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const { username } = req.body;

    const { success, error } = await setUsername(user.id, username.toLowerCase());

    if (!success) {
      const status = error === 'Username already set' ? 409 : 400;
      res.status(status).json({ error });
      return;
    }

    res.json({ username: username.toLowerCase() });
  })
);

// GET /api/profile/username/check/:username - Check username availability
router.get(
  '/username/check/:username',
  param('username')
    .trim()
    .matches(USERNAME_REGEX)
    .withMessage('Username must be 3-20 characters, alphanumeric and underscores only'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const taken = await isUsernameTaken(req.params.username.toLowerCase());
    res.json({ available: !taken });
  })
);

// PATCH /api/profile/me - Update own profile
router.patch(
  '/me',
  requireAuth,
  body('display_name').optional().trim().isLength({ max: 50 }).withMessage('Display name must be 50 characters or less'),
  body('bio').optional().trim().isLength({ max: 160 }).withMessage('Bio must be 160 characters or less'),
  body('avatar').optional().custom((value) => {
    // Allow null to clear avatar
    if (value === null) return true;
    // Max ~500KB for avatar
    if (value && value.length > 682668) {
      throw new Error('Avatar image exceeds 500KB limit');
    }
    return true;
  }),
  body('location_city').optional().trim().isLength({ max: 100 }),
  body('location_region').optional().trim().isLength({ max: 100 }),
  body('lat').optional().isFloat({ min: -90, max: 90 }),
  body('lng').optional().isFloat({ min: -180, max: 180 }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const { display_name, bio, avatar, location_city, location_region, lat, lng } = req.body;

    const result = await updateProfile(user.id, {
      display_name,
      bio,
      avatar,
      location_city,
      location_region,
      lat,
      lng,
    });

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Failed to update profile' });
      return;
    }

    res.json({ message: 'Profile updated' });
  })
);

// ============================================
// Dynamic :username routes MUST come after static routes
// ============================================

// GET /api/profile/:username - Public profile + stats
router.get(
  '/:username',
  optionalAuth,
  param('username').trim().notEmpty().withMessage('Username is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const profile = await getPublicProfile(req.params.username);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    // Get stats
    const stats = await getProfileStats(profile.id);

    // Get public sightings (first page)
    const { sightings, total, hasMore } = await getUserPublicSightings(
      profile.id,
      1,
      20,
      req.user?.id
    );

    res.json({
      profile,
      stats,
      sightings: {
        items: sightings,
        total,
        hasMore,
      },
    });
  })
);

// GET /api/profile/:username/sightings - Paginated public sightings for a user
router.get(
  '/:username/sightings',
  optionalAuth,
  param('username').trim().notEmpty().withMessage('Username is required'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const profile = await getProfileByUsername(req.params.username);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const { sightings, total, hasMore } = await getUserPublicSightings(
      profile.id,
      page,
      limit,
      req.user?.id
    );

    res.json({
      sightings,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    });
  })
);

export default router;
