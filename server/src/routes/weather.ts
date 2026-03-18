import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

interface KpIndexEntry {
  time_tag: string;
  kp: string;
}

interface XrayEntry {
  time_tag: string;
  flux: number;
}

router.get('/space', async (_req: Request, res: Response) => {
  try {
    const swpcBaseUrl = process.env.SWPC_BASE_URL || 'https://services.swpc.noaa.gov';

    const [kpResponse, xrayResponse] = await Promise.allSettled([
      axios.get<KpIndexEntry[]>(`${swpcBaseUrl}/json/planetary_k_index_1m.json`, {
        timeout: 10000,
      }),
      axios.get<XrayEntry[]>(`${swpcBaseUrl}/json/goes/primary/xrays-6-hour.json`, {
        timeout: 10000,
      }),
    ]);

    let kpIndex = 0;
    let kpHistory: { time: string; value: number }[] = [];

    if (kpResponse.status === 'fulfilled' && kpResponse.value.data.length > 0) {
      const kpData = kpResponse.value.data;
      const latestKp = kpData[kpData.length - 1];
      kpIndex = parseFloat(latestKp.kp) || 0;

      kpHistory = kpData.slice(-24).map((entry) => ({
        time: entry.time_tag,
        value: parseFloat(entry.kp) || 0,
      }));
    }

    let xrayFlux = 0;
    let flareClass: string | null = null;

    if (xrayResponse.status === 'fulfilled' && xrayResponse.value.data.length > 0) {
      const xrayData = xrayResponse.value.data;
      const latestXray = xrayData[xrayData.length - 1];
      xrayFlux = latestXray.flux;

      if (xrayFlux >= 1e-4) flareClass = 'X';
      else if (xrayFlux >= 1e-5) flareClass = 'M';
      else if (xrayFlux >= 1e-6) flareClass = 'C';
      else if (xrayFlux >= 1e-7) flareClass = 'B';
      else flareClass = 'A';
    }

    let solarLevel: 'quiet' | 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme' = 'quiet';
    if (kpIndex >= 9) solarLevel = 'extreme';
    else if (kpIndex >= 8) solarLevel = 'severe';
    else if (kpIndex >= 7) solarLevel = 'strong';
    else if (kpIndex >= 5) solarLevel = 'moderate';
    else if (kpIndex >= 4) solarLevel = 'minor';

    let auroraVisibility: 'none' | 'low' | 'moderate' | 'high' = 'none';
    if (kpIndex >= 7) auroraVisibility = 'high';
    else if (kpIndex >= 5) auroraVisibility = 'moderate';
    else if (kpIndex >= 4) auroraVisibility = 'low';

    let stormLevel: string | null = null;
    if (kpIndex >= 5) {
      const gLevel = Math.min(5, Math.floor(kpIndex - 4));
      stormLevel = `G${gLevel}`;
    }

    const alerts: Array<{
      id: string;
      type: 'flare' | 'storm' | 'radiation';
      severity: 'watch' | 'warning' | 'alert';
      message: string;
      issuedAt: string;
    }> = [];

    if (flareClass === 'X' || flareClass === 'M') {
      alerts.push({
        id: `flare-${Date.now()}`,
        type: 'flare',
        severity: flareClass === 'X' ? 'alert' : 'warning',
        message: `${flareClass}-class solar flare detected`,
        issuedAt: new Date().toISOString(),
      });
    }

    if (kpIndex >= 5) {
      alerts.push({
        id: `storm-${Date.now()}`,
        type: 'storm',
        severity: kpIndex >= 7 ? 'alert' : kpIndex >= 6 ? 'warning' : 'watch',
        message: `Geomagnetic storm in progress (Kp=${kpIndex})`,
        issuedAt: new Date().toISOString(),
      });
    }

    res.json({
      solarActivity: {
        level: solarLevel,
        xrayFlux,
        flareClass,
      },
      geomagneticActivity: {
        kpIndex,
        kpHistory,
        stormLevel,
      },
      aurora: {
        visibility: auroraVisibility,
        forecastUrl: `${swpcBaseUrl}/images/animations/ovation/north/latest.jpg`,
      },
      alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching space weather:', error);
    res.status(500).json({ error: 'Failed to fetch space weather data' });
  }
});

export default router;
