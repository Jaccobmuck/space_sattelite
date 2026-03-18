import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getTLEData } from '../services/tleService.js';
import { propagateSatellite, propagateGroundTrack } from '../services/propagationService.js';
import { computePasses } from '../services/passService.js';

const router = Router();

const ISS_NORAD_ID = 25544;

interface OpenNotifyResponse {
  iss_position: {
    latitude: string;
    longitude: string;
  };
  timestamp: number;
}

interface AstrosResponse {
  people: Array<{
    name: string;
    craft: string;
  }>;
  number: number;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string) || 0;
    const lng = parseFloat(req.query.lng as string) || 0;

    const tleData = await getTLEData();
    const issTLE = tleData.find((s) => s.noradId === ISS_NORAD_ID);

    let position = null;
    let groundTrack: { lat: number; lng: number }[] = [];
    let passes: ReturnType<typeof computePasses> = [];

    if (issTLE) {
      const sgp4Position = propagateSatellite(issTLE.tle1, issTLE.tle2);
      if (sgp4Position) {
        position = {
          lat: sgp4Position.lat,
          lng: sgp4Position.lng,
          alt: sgp4Position.alt,
          velocity: sgp4Position.velocity,
        };
      }

      groundTrack = propagateGroundTrack(issTLE.tle1, issTLE.tle2, 90, 1);

      if (lat !== 0 || lng !== 0) {
        passes = computePasses(
          'ISS (ZARYA)',
          ISS_NORAD_ID,
          issTLE.tle1,
          issTLE.tle2,
          { lat, lng, alt: 0 },
          5,
          10
        ).slice(0, 5);
      }
    }

    if (!position) {
      try {
        const openNotifyUrl = process.env.OPEN_NOTIFY_URL || 'http://api.open-notify.org';
        const issResponse = await axios.get<OpenNotifyResponse>(
          `${openNotifyUrl}/iss-now.json`,
          { timeout: 5000 }
        );

        position = {
          lat: parseFloat(issResponse.data.iss_position.latitude),
          lng: parseFloat(issResponse.data.iss_position.longitude),
          alt: 408,
          velocity: 7.66,
        };
      } catch (error) {
        console.error('Error fetching ISS position from Open Notify:', error);
      }
    }

    let crew: Array<{ name: string; agency: string; role: string; daysInSpace: number }> = [];
    try {
      const openNotifyUrl = process.env.OPEN_NOTIFY_URL || 'http://api.open-notify.org';
      const astrosResponse = await axios.get<AstrosResponse>(
        `${openNotifyUrl}/astros.json`,
        { timeout: 5000 }
      );

      crew = astrosResponse.data.people
        .filter((p) => p.craft === 'ISS')
        .map((p) => ({
          name: p.name,
          agency: 'Unknown',
          role: 'Crew Member',
          daysInSpace: 0,
        }));
    } catch (error) {
      console.error('Error fetching crew data:', error);
    }

    res.json({
      noradId: ISS_NORAD_ID,
      name: 'International Space Station',
      position,
      crew,
      groundTrack,
      passes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching ISS data:', error);
    res.status(500).json({ error: 'Failed to fetch ISS data' });
  }
});

export default router;
