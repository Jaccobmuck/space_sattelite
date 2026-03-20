import { Router, Request, Response } from 'express';
import { getTLEData } from '../services/tleService.js';
import { propagateSatellite, propagateOrbit } from '../services/propagationService.js';
import { optionalAuth, requireAuth, requirePro, type AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
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

    const isProUser = req.user?.plan === 'pro';
    const result = isProUser ? satellites : satellites.slice(0, 10);

    res.json({
      count: result.length,
      total: satellites.length,
      limited: !isProUser,
      timestamp: new Date().toISOString(),
      satellites: result,
    });
}));

router.get('/category/:group', async (req: Request, res: Response) => {
  try {
    const group = req.params.group.toLowerCase();
    const tleData = await getTLEData();

    // Map group names to categories
    const groupToCategoryMap: Record<string, string[]> = {
      'stations': ['iss'],
      'starlink': ['comm'], // Filter by name below
      'gps': ['nav'],
      'weather': ['weather'],
      'amateur': ['science'], // Amateur radio satellites
      'debris': ['debris'],
    };

    const categories = groupToCategoryMap[group] || [];

    let filteredData = tleData;

    if (group === 'starlink') {
      filteredData = tleData.filter((sat) => 
        sat.name.toLowerCase().includes('starlink')
      );
    } else if (group === 'stations') {
      filteredData = tleData.filter((sat) => 
        sat.category === 'iss' || 
        sat.name.toLowerCase().includes('tiangong') ||
        sat.name.toLowerCase().includes('css')
      );
    } else if (categories.length > 0) {
      filteredData = tleData.filter((sat) => categories.includes(sat.category));
    }

    const satellites = filteredData
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
      group,
      count: satellites.length,
      timestamp: new Date().toISOString(),
      satellites,
    });
  } catch (error) {
    console.error('Error fetching satellites by category:', error);
    res.status(500).json({ error: 'Failed to fetch satellite data' });
  }
});

router.get('/:noradId', requireAuth, requirePro, asyncHandler(async (req: AuthRequest, res: Response) => {
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
}));

export default router;
