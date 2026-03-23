import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TLEData {
  noradId: number;
  name: string;
  tle1: string;
  tle2: string;
  category: 'weather' | 'comm' | 'nav' | 'iss' | 'science' | 'debris';
  owner: string;
}

interface FallbackTLEEntry {
  name: string;
  noradId: number;
  tle1: string;
  tle2: string;
}

interface FallbackTLEFile {
  version: string;
  description: string;
  lastUpdated: string;
  satellites: FallbackTLEEntry[];
}

// Load and validate fallback TLE data from JSON fixture
function loadFallbackTLEData(): TLEData[] {
  const filePath = join(__dirname, '..', 'data', 'fallbackTLE.json');
  const fileContent = readFileSync(filePath, 'utf-8');
  const data: FallbackTLEFile = JSON.parse(fileContent);

  // Validate unique NORAD IDs
  const noradIds = new Set<number>();
  const satellites: TLEData[] = [];

  for (const sat of data.satellites) {
    if (noradIds.has(sat.noradId)) {
      throw new Error(`Duplicate NORAD ID in fallback TLE data: ${sat.noradId}`);
    }
    noradIds.add(sat.noradId);

    // Validate TLE format
    if (!sat.tle1.startsWith('1 ') || !sat.tle2.startsWith('2 ')) {
      throw new Error(`Invalid TLE format for ${sat.name} (NORAD ${sat.noradId})`);
    }

    const satInfo = NOTABLE_SATELLITES[sat.noradId];
    satellites.push({
      noradId: sat.noradId,
      name: sat.name,
      tle1: sat.tle1,
      tle2: sat.tle2,
      category: satInfo?.category || 'science',
      owner: satInfo?.owner || 'Unknown',
    });
  }

  return satellites;
}

// Cached fallback data (loaded once at startup)
let cachedFallbackData: TLEData[] | null = null;

function getFallbackTLEData(): TLEData[] {
  if (!cachedFallbackData) {
    cachedFallbackData = loadFallbackTLEData();
  }
  return cachedFallbackData;
}

interface TLECache {
  data: TLEData[];
  lastUpdated: Date;
}

let tleCache: TLECache | null = null;

const NOTABLE_SATELLITES: Record<number, { category: TLEData['category']; owner: string }> = {
  25544: { category: 'iss', owner: 'NASA/Roscosmos' },
  48274: { category: 'iss', owner: 'CNSA' },
  20580: { category: 'science', owner: 'NASA' },
  27424: { category: 'science', owner: 'NASA' },
  43013: { category: 'nav', owner: 'USA' },
  41019: { category: 'nav', owner: 'USA' },
  40294: { category: 'nav', owner: 'USA' },
  39166: { category: 'nav', owner: 'USA' },
  37753: { category: 'nav', owner: 'USA' },
  32260: { category: 'nav', owner: 'USA' },
  28654: { category: 'nav', owner: 'USA' },
  26360: { category: 'nav', owner: 'USA' },
  24876: { category: 'nav', owner: 'USA' },
  22877: { category: 'nav', owner: 'USA' },
  28190: { category: 'nav', owner: 'USA' },
  29601: { category: 'weather', owner: 'USA' },
  33591: { category: 'weather', owner: 'USA' },
  35491: { category: 'weather', owner: 'USA' },
  36411: { category: 'weather', owner: 'USA' },
  41866: { category: 'weather', owner: 'USA' },
  43226: { category: 'weather', owner: 'USA' },
  44897: { category: 'comm', owner: 'SpaceX' },
  45044: { category: 'comm', owner: 'SpaceX' },
  45045: { category: 'comm', owner: 'SpaceX' },
  45046: { category: 'comm', owner: 'SpaceX' },
  45047: { category: 'comm', owner: 'SpaceX' },
  45048: { category: 'comm', owner: 'SpaceX' },
  45049: { category: 'comm', owner: 'SpaceX' },
  45050: { category: 'comm', owner: 'SpaceX' },
};

function parseTLEData(tleText: string): TLEData[] {
  const lines = tleText.trim().split('\n');
  const satellites: TLEData[] = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 >= lines.length) break;

    const name = lines[i].trim();
    const tle1 = lines[i + 1].trim();
    const tle2 = lines[i + 2].trim();

    if (!tle1.startsWith('1 ') || !tle2.startsWith('2 ')) continue;

    const noradIdMatch = tle1.match(/^1\s+(\d+)/);
    if (!noradIdMatch) continue;

    const noradId = parseInt(noradIdMatch[1], 10);
    const satInfo = NOTABLE_SATELLITES[noradId];

    satellites.push({
      noradId,
      name,
      tle1,
      tle2,
      category: satInfo?.category || 'science',
      owner: satInfo?.owner || 'Unknown',
    });
  }

  return satellites;
}

// Fallback TLE data is now loaded from server/src/data/fallbackTLE.json
// See getFallbackTLEData() function above

const CELESTRAK_BASE_URL = process.env.CELESTRAK_BASE_URL || 'https://celestrak.org';

export async function fetchTLEData(): Promise<TLEData[]> {
  const axiosConfig = {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/plain,*/*',
    },
  };

  try {
    const [stationsRes, gpsRes, weatherRes, starlinkRes] = await Promise.allSettled([
      axios.get(`${CELESTRAK_BASE_URL}/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle`, axiosConfig),
      axios.get(`${CELESTRAK_BASE_URL}/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle`, axiosConfig),
      axios.get(`${CELESTRAK_BASE_URL}/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle`, axiosConfig),
      axios.get(`${CELESTRAK_BASE_URL}/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle`, axiosConfig),
    ]);

    const allSatellites: TLEData[] = [];

    if (stationsRes.status === 'fulfilled') {
      allSatellites.push(...parseTLEData(stationsRes.value.data));
    }
    if (gpsRes.status === 'fulfilled') {
      const gpsSats = parseTLEData(gpsRes.value.data);
      gpsSats.forEach((sat) => {
        sat.category = 'nav';
        sat.owner = 'USA';
      });
      allSatellites.push(...gpsSats);
    }
    if (weatherRes.status === 'fulfilled') {
      const weatherSats = parseTLEData(weatherRes.value.data);
      weatherSats.forEach((sat) => {
        sat.category = 'weather';
      });
      allSatellites.push(...weatherSats);
    }
    if (starlinkRes.status === 'fulfilled') {
      const starlinkSats = parseTLEData(starlinkRes.value.data).slice(0, 30);
      starlinkSats.forEach((sat) => {
        sat.category = 'comm';
        sat.owner = 'SpaceX';
      });
      allSatellites.push(...starlinkSats);
    }

    const uniqueSatellites = Array.from(
      new Map(allSatellites.map((sat) => [sat.noradId, sat])).values()
    );

    if (uniqueSatellites.length === 0) {
      console.log('No satellites from API, using fallback data');
      const fallbackSatellites = getFallbackTLEData();
      tleCache = {
        data: fallbackSatellites,
        lastUpdated: new Date(),
      };
      console.log(`TLE cache updated with fallback: ${fallbackSatellites.length} satellites`);
      return fallbackSatellites;
    }

    tleCache = {
      data: uniqueSatellites,
      lastUpdated: new Date(),
    };

    console.log(`TLE cache updated: ${uniqueSatellites.length} satellites`);
    return uniqueSatellites;
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError',
      timestamp: new Date().toISOString(),
      service: 'tleService',
      operation: 'fetchTLEData',
      hasCachedData: !!tleCache,
    };
    console.error('Error fetching TLE data:', JSON.stringify(errorDetails));
    
    if (tleCache) {
      console.log('Using cached TLE data');
      return tleCache.data;
    }
    console.log('Using fallback TLE data due to error');
    const fallbackSatellites = getFallbackTLEData();
    tleCache = {
      data: fallbackSatellites,
      lastUpdated: new Date(),
    };
    return fallbackSatellites;
  }
}

export function getCachedTLEData(): TLEData[] | null {
  return tleCache?.data || null;
}

export function getTLECacheAge(): number | null {
  if (!tleCache) return null;
  return Date.now() - tleCache.lastUpdated.getTime();
}

const TLE_CACHE_DURATION_MS = parseInt(process.env.TLE_CACHE_DURATION_MS || '7200000', 10); // Default 2 hours

export async function getTLEData(): Promise<TLEData[]> {
  if (tleCache && getTLECacheAge()! < TLE_CACHE_DURATION_MS) {
    return tleCache.data;
  }
  return fetchTLEData();
}
