import { Router, Request, Response } from 'express';
import { calculateMoonData } from '../services/moonService.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

    const moonData = calculateMoonData(new Date(), lat, lng);

    res.json({
      ...moonData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error calculating moon data:', error);
    res.status(500).json({ error: 'Failed to calculate moon data' });
  }
});

export default router;
