import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { optionalAuth, requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getCommunityFeed,
  getSightingById,
  toggleLike,
  getComments,
  createComment,
  getDistinctSatellites,
  isSightingAccessible,
  type FeedTab,
} from '../db/community.js';
import { toggleJournalEntryVisibility } from '../db/journal.js';

const router = Router();

// GET /api/community/sightings - Paginated feed
router.get(
  '/sightings',
  optionalAuth,
  query('tab').optional().isIn(['global', 'near_you', 'by_satellite']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('satellite').optional().trim(),
  query('lat').optional().isFloat({ min: -90, max: 90 }).toFloat(),
  query('lng').optional().isFloat({ min: -180, max: 180 }).toFloat(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const tab = (req.query.tab as FeedTab) || 'global';
    const page = (req.query.page as unknown as number) || 1;
    const limit = (req.query.limit as unknown as number) || 20;
    const satellite = req.query.satellite as string | undefined;
    const userLat = req.query.lat as unknown as number | undefined;
    const userLng = req.query.lng as unknown as number | undefined;

    // For "near_you" tab, require location
    if (tab === 'near_you' && (userLat === undefined || userLng === undefined)) {
      res.status(400).json({ error: 'Location (lat, lng) required for Near You feed' });
      return;
    }

    const { sightings, total, hasMore } = await getCommunityFeed({
      tab,
      page,
      limit,
      satellite,
      userLat,
      userLng,
      currentUserId: req.user?.id,
    });

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

// GET /api/community/satellites - Distinct list of sighted satellites
router.get(
  '/satellites',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const satellites = await getDistinctSatellites();
    res.json({ satellites });
  })
);

// GET /api/community/sightings/:id - Single sighting detail
router.get(
  '/sightings/:id',
  optionalAuth,
  param('id').isUUID().withMessage('Invalid sighting ID'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const sighting = await getSightingById(req.params.id, req.user?.id);

    if (!sighting) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }

    res.json({ sighting });
  })
);

// PATCH /api/community/sightings/:id/visibility - Toggle public/private
router.patch(
  '/sightings/:id/visibility',
  requireAuth,
  param('id').isUUID().withMessage('Invalid sighting ID'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const { success, isPublic, error } = await toggleJournalEntryVisibility(
      req.params.id,
      user.id
    );

    if (!success) {
      const status = error === 'Not authorized' ? 403 : 400;
      res.status(status).json({ error: error || 'Failed to toggle visibility' });
      return;
    }

    res.json({ is_public: isPublic });
  })
);

// POST /api/community/sightings/:id/like - Like/unlike toggle
router.post(
  '/sightings/:id/like',
  requireAuth,
  param('id').isUUID().withMessage('Invalid sighting ID'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const sightingId = req.params.id;

    // Check if sighting is accessible (public or owned by user)
    const accessible = await isSightingAccessible(sightingId, user.id);
    if (!accessible) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }

    const { liked, likeCount } = await toggleLike(user.id, sightingId);

    res.json({ liked, like_count: likeCount });
  })
);

// GET /api/community/sightings/:id/comments - Get comments for a sighting
router.get(
  '/sightings/:id/comments',
  optionalAuth,
  param('id').isUUID().withMessage('Invalid sighting ID'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const sightingId = req.params.id;

    // Check if sighting is accessible (public or owned by user)
    const accessible = await isSightingAccessible(sightingId, req.user?.id);
    if (!accessible) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }

    const page = (req.query.page as unknown as number) || 1;
    const limit = (req.query.limit as unknown as number) || 50;

    const { comments, total } = await getComments(sightingId, page, limit);

    res.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    });
  })
);

// POST /api/community/sightings/:id/comments - Post a comment
router.post(
  '/sightings/:id/comments',
  requireAuth,
  param('id').isUUID().withMessage('Invalid sighting ID'),
  body('text').trim().notEmpty().isLength({ max: 200 }).withMessage('Comment must be 1-200 characters'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const sightingId = req.params.id;

    // Check if sighting is accessible (public or owned by user)
    const accessible = await isSightingAccessible(sightingId, user.id);
    if (!accessible) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }

    // Check if user has a username set (required for commenting)
    if (!user.username) {
      res.status(403).json({ 
        error: 'Username required to comment',
        code: 'USERNAME_REQUIRED',
      });
      return;
    }

    const { comment, error } = await createComment(
      user.id,
      sightingId,
      req.body.text
    );

    if (error) {
      res.status(400).json({ error });
      return;
    }

    res.status(201).json({ comment });
  })
);

export default router;
