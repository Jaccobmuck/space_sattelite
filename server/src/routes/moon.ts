import { Router, Request, Response } from 'express';
import { calculateMoonData } from '../services/moonService.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const moonData = calculateMoonData(new Date());

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
