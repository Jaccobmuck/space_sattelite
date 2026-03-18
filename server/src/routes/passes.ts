import { Router, Request, Response } from 'express';
import { getTLEData } from '../services/tleService.js';
import { computePasses, Pass } from '../services/passService.js';

const router = Router();

const BRIGHT_SATELLITES = [
  25544,
  48274,
  20580,
  27424,
];

router.get('/', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const noradId = req.query.noradId ? parseInt(req.query.noradId as string, 10) : null;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng query parameters are required' });
      return;
    }

    const tleData = await getTLEData();
    const observer = { lat, lng, alt: 0 };

    let allPasses: Pass[] = [];

    if (noradId) {
      const sat = tleData.find((s) => s.noradId === noradId);
      if (sat) {
        allPasses = computePasses(
          sat.name,
          sat.noradId,
          sat.tle1,
          sat.tle2,
          observer,
          7,
          10
        );
      }
    } else {
      for (const satNoradId of BRIGHT_SATELLITES) {
        const sat = tleData.find((s) => s.noradId === satNoradId);
        if (sat) {
          const passes = computePasses(
            sat.name,
            sat.noradId,
            sat.tle1,
            sat.tle2,
            observer,
            7,
            10
          );
          allPasses.push(...passes);
        }
      }

      allPasses.sort((a, b) => 
        new Date(a.riseTime).getTime() - new Date(b.riseTime).getTime()
      );
    }

    res.json({
      observer: { lat, lng },
      count: allPasses.length,
      passes: allPasses.slice(0, 20),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error computing passes:', error);
    res.status(500).json({ error: 'Failed to compute pass predictions' });
  }
});

export default router;
