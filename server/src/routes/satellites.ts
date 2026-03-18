import { Router, Request, Response } from 'express';
import { getTLEData } from '../services/tleService.js';
import { propagateSatellite, propagateOrbit } from '../services/propagationService.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const tleData = await getTLEData();

    const satellites = tleData
      .map((sat) => {
        const position = propagateSatellite(sat.tle1, sat.tle2);
        if (!position) return null;

        return {
          noradId: sat.noradId,
          name: sat.name,
          category: sat.category,
          lat: position.lat,
          lng: position.lng,
          alt: position.alt,
          velocity: position.velocity,
          period: position.period,
          inclination: position.inclination,
          owner: sat.owner,
          tle1: sat.tle1,
          tle2: sat.tle2,
        };
      })
      .filter(Boolean);

    res.json({
      count: satellites.length,
      timestamp: new Date().toISOString(),
      satellites,
    });
  } catch (error) {
    console.error('Error fetching satellites:', error);
    res.status(500).json({ error: 'Failed to fetch satellite data' });
  }
});

router.get('/:noradId', async (req: Request, res: Response) => {
  try {
    const noradId = parseInt(req.params.noradId, 10);
    const tleData = await getTLEData();

    const sat = tleData.find((s) => s.noradId === noradId);
    if (!sat) {
      res.status(404).json({ error: 'Satellite not found' });
      return;
    }

    const position = propagateSatellite(sat.tle1, sat.tle2);
    if (!position) {
      res.status(500).json({ error: 'Failed to propagate satellite position' });
      return;
    }

    const orbit = propagateOrbit(sat.tle1, sat.tle2, 90, 1);

    res.json({
      noradId: sat.noradId,
      name: sat.name,
      category: sat.category,
      lat: position.lat,
      lng: position.lng,
      alt: position.alt,
      velocity: position.velocity,
      period: position.period,
      inclination: position.inclination,
      owner: sat.owner,
      tle1: sat.tle1,
      tle2: sat.tle2,
      orbit,
    });
  } catch (error) {
    console.error('Error fetching satellite:', error);
    res.status(500).json({ error: 'Failed to fetch satellite data' });
  }
});

export default router;
