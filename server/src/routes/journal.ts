import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  createJournalEntry,
  getJournalEntryById,
  getUserJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  toggleJournalEntryVisibility,
  validateBase64Image,
} from '../db/journal.js';

const router = Router();

// All journal routes require authentication
router.use(requireAuth);

// POST /api/journal - Create a new journal entry
router.post(
  '/',
  body('satellite_name').trim().notEmpty().withMessage('Satellite name is required'),
  body('pass_timestamp').isISO8601().withMessage('Valid pass timestamp is required'),
  body('outcome').isIn(['saw_it', 'missed_it', 'cloudy']).withMessage('Valid outcome is required'),
  body('star_rating').optional().isInt({ min: 1, max: 5 }).withMessage('Star rating must be 1-5'),
  body('notes').optional().isLength({ max: 280 }).withMessage('Notes must be 280 characters or less'),
  body('is_public').optional().isBoolean(),
  body('city').optional().trim(),
  body('region').optional().trim(),
  body('lat').optional().isFloat({ min: -90, max: 90 }),
  body('lng').optional().isFloat({ min: -180, max: 180 }),
  body('card_image').optional().custom((value) => {
    if (value) {
      const validation = validateBase64Image(value);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid image');
      }
    }
    return true;
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const {
      satellite_name,
      pass_timestamp,
      outcome,
      star_rating,
      notes,
      is_public,
      city,
      region,
      lat,
      lng,
      card_image,
    } = req.body;

    const { data, error } = await createJournalEntry({
      user_id: user.id,
      satellite_name,
      pass_timestamp,
      outcome,
      star_rating,
      notes,
      is_public,
      city,
      region,
      lat,
      lng,
      card_image,
    });

    if (error) {
      if (error.includes('500KB')) {
        res.status(413).json({ error });
        return;
      }
      res.status(400).json({ error });
      return;
    }

    res.status(201).json({ entry: data });
  })
);

// GET /api/journal - List user's journal entries
router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const page = (req.query.page as unknown as number) || 1;
    const limit = (req.query.limit as unknown as number) || 20;

    const { entries, total } = await getUserJournalEntries(user.id, page, limit);

    res.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  })
);

// GET /api/journal/:id - Get a single journal entry
router.get(
  '/:id',
  param('id').isUUID().withMessage('Invalid entry ID'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const entry = await getJournalEntryById(req.params.id);

    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // Only allow access to own entries
    if (entry.user_id !== user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    res.json({ entry });
  })
);

// PATCH /api/journal/:id - Update a journal entry
router.patch(
  '/:id',
  param('id').isUUID().withMessage('Invalid entry ID'),
  body('notes').optional().isLength({ max: 280 }).withMessage('Notes must be 280 characters or less'),
  body('is_public').optional().isBoolean(),
  body('star_rating').optional().isInt({ min: 1, max: 5 }).withMessage('Star rating must be 1-5'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const { notes, is_public, star_rating } = req.body;

    const { success, entry, error } = await updateJournalEntry(req.params.id, user.id, {
      notes,
      is_public,
      star_rating,
    });

    if (!success || !entry) {
      // Return 404 for not found/not authorized to prevent enumeration
      const status = error === 'Entry not found or not authorized' ? 404 : 400;
      res.status(status).json({ error: error || 'Failed to update entry' });
      return;
    }

    // Use the returned entry from the update - never re-fetch by raw id
    res.json({ entry });
  })
);

// DELETE /api/journal/:id - Delete a journal entry
router.delete(
  '/:id',
  param('id').isUUID().withMessage('Invalid entry ID'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }

    const user = req.user!;
    const { success, error } = await deleteJournalEntry(req.params.id, user.id);

    if (!success) {
      const status = error === 'Entry not found or not authorized' ? 404 : 400;
      res.status(status).json({ error: error || 'Failed to delete entry' });
      return;
    }

    res.json({ message: 'Entry deleted' });
  })
);

// PATCH /api/journal/:id/visibility - Toggle visibility
router.patch(
  '/:id/visibility',
  param('id').isUUID().withMessage('Invalid entry ID'),
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
      res.status(400).json({ error: error || 'Failed to toggle visibility' });
      return;
    }

    res.json({ is_public: isPublic });
  })
);

export default router;
