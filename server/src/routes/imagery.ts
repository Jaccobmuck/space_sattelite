import { Router } from 'express';
import { getSatelliteImagery, hasImagerySupport, NASAAPIKeyMissingError } from '../services/imageryService.js';

const router = Router();

router.get('/:noradId', async (req, res): Promise<void> => {
  try {
    const noradId = parseInt(req.params.noradId, 10);
    const satelliteName = (req.query.name as string) || 'Unknown';

    if (isNaN(noradId)) {
      res.status(400).json({ error: 'Invalid NORAD ID' });
      return;
    }

    const imagery = await getSatelliteImagery(noradId, satelliteName);
    res.json(imagery);
  } catch (error) {
    if (error instanceof NASAAPIKeyMissingError) {
      res.status(503).json({ error: 'NASA imagery service unavailable: API key not configured' });
      return;
    }
    console.error('Error fetching satellite imagery:', error);
    res.status(500).json({ error: 'Failed to fetch satellite imagery' });
  }
});

router.get('/:noradId/check', (req, res): void => {
  try {
    const noradId = parseInt(req.params.noradId, 10);
    const satelliteName = (req.query.name as string) || 'Unknown';

    if (isNaN(noradId)) {
      res.status(400).json({ error: 'Invalid NORAD ID' });
      return;
    }

    const hasSupport = hasImagerySupport(noradId, satelliteName);
    res.json({ noradId, hasImagery: hasSupport });
  } catch (error) {
    console.error('Error checking imagery support:', error);
    res.status(500).json({ error: 'Failed to check imagery support' });
  }
});

export default router;
