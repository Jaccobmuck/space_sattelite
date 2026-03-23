import { Router, Response } from 'express';
import { getTLEData } from '../services/tleService.js';
import { computePasses, Pass } from '../services/passService.js';
import { requireAuth, requirePro, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// Bright satellites visible to naked eye - ISS, Tiangong, Hubble, Aqua
const BRIGHT_SATELLITES = [
  25544,  // ISS (ZARYA) - brightest artificial satellite
  48274,  // Tiangong (Chinese Space Station)
  20580,  // Hubble Space Telescope
  27424,  // Aqua (Earth observation)
];

// Pass prediction configuration
const PASS_PREDICTION_DAYS = 7;           // How many days ahead to predict passes
const MIN_ELEVATION_DEGREES = 10;         // Minimum peak elevation to include a pass (filters low horizon passes)
const MAX_PASSES_RETURNED = 20;           // Maximum number of passes to return in response

router.get('/', requireAuth, requirePro, asyncHandler(async (req: AuthRequest, res: Response) => {
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
          PASS_PREDICTION_DAYS,
          MIN_ELEVATION_DEGREES
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
            PASS_PREDICTION_DAYS,
            MIN_ELEVATION_DEGREES
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
      passes: allPasses.slice(0, MAX_PASSES_RETURNED),
      timestamp: new Date().toISOString(),
    });
}));

export default router;
