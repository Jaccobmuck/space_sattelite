import axios from 'axios';

export interface SatelliteImagery {
  satelliteId: number;
  satelliteName: string;
  images: ImageryItem[];
  source: string;
  hasImagery: boolean;
}

export interface ImageryItem {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  date: string;
  description?: string;
  type: 'weather' | 'earth_observation';
}

const WEATHER_SATELLITE_IMAGERY: Record<number, { name: string; goesId: string; region: string }> = {
  41866: { name: 'GOES 16', goesId: 'GOES16', region: 'east' },
  43226: { name: 'GOES 17', goesId: 'GOES17', region: 'west' },
  51850: { name: 'GOES 18', goesId: 'GOES18', region: 'west' },
};

const EARTH_OBSERVATION_SATELLITES: Set<number> = new Set([
  25544, // ISS
  27424, // Aqua
  25994, // Terra
  39084, // Landsat 8
  49260, // Landsat 9
]);

function getGOESImagery(satelliteId: number, satInfo: { name: string; goesId: string; region: string }): ImageryItem[] {
  const goesNum = satInfo.goesId.replace('GOES', '');
  const baseUrl = `https://cdn.star.nesdis.noaa.gov/GOES${goesNum}/ABI`;
  const timestamp = new Date().toISOString();

  return [
    {
      id: `${satelliteId}-conus-geocolor`,
      title: `${satInfo.name} - CONUS GeoColor`,
      url: `${baseUrl}/CONUS/GEOCOLOR/latest.jpg`,
      thumbnailUrl: `${baseUrl}/CONUS/GEOCOLOR/thumbnail.jpg`,
      date: timestamp,
      description: 'Continental US true color imagery showing Earth as it appears to the human eye',
      type: 'weather',
    },
    {
      id: `${satelliteId}-fulldisk-geocolor`,
      title: `${satInfo.name} - Full Disk GeoColor`,
      url: `${baseUrl}/FD/GEOCOLOR/latest.jpg`,
      thumbnailUrl: `${baseUrl}/FD/GEOCOLOR/thumbnail.jpg`,
      date: timestamp,
      description: 'Full disk Earth view in true color',
      type: 'weather',
    },
    {
      id: `${satelliteId}-conus-band13`,
      title: `${satInfo.name} - Infrared (10.3 µm)`,
      url: `${baseUrl}/CONUS/13/latest.jpg`,
      thumbnailUrl: `${baseUrl}/CONUS/13/thumbnail.jpg`,
      date: timestamp,
      description: 'Clean longwave infrared for cloud top temperatures',
      type: 'weather',
    },
    {
      id: `${satelliteId}-conus-band08`,
      title: `${satInfo.name} - Water Vapor`,
      url: `${baseUrl}/CONUS/08/latest.jpg`,
      thumbnailUrl: `${baseUrl}/CONUS/08/thumbnail.jpg`,
      date: timestamp,
      description: 'Upper-level water vapor showing atmospheric moisture',
      type: 'weather',
    },
  ];
}

export class NASAAPIKeyMissingError extends Error {
  constructor() {
    super('NASA_API_KEY is required for this feature but not configured');
    this.name = 'NASAAPIKeyMissingError';
  }
}

async function getNASAEPICImagery(): Promise<ImageryItem[]> {
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    throw new NASAAPIKeyMissingError();
  }

  try {
    const response = await axios.get(
      'https://api.nasa.gov/EPIC/api/natural/images',
      {
        params: { api_key: apiKey },
        timeout: 10000,
      }
    );

    if (response.data && Array.isArray(response.data)) {
      return response.data.slice(0, 4).map((img: { identifier: string; caption: string; date: string; image: string }) => {
        const dateParts = img.date.split(' ')[0].split('-');
        const year = dateParts[0];
        const month = dateParts[1];
        const day = dateParts[2];
        return {
          id: `epic-${img.identifier}`,
          title: 'DSCOVR EPIC - Full Earth',
          url: `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${day}/png/${img.image}.png`,
          thumbnailUrl: `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${day}/thumbs/${img.image}.jpg`,
          date: img.date,
          description: img.caption || 'Full disk Earth image from DSCOVR satellite at L1 point',
          type: 'earth_observation' as const,
        };
      });
    }
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError',
      timestamp: new Date().toISOString(),
      service: 'imageryService',
      operation: 'getNASAEPICImagery',
    };
    console.error('Error fetching NASA EPIC imagery:', JSON.stringify(errorDetails));
  }
  return [];
}


async function getISSImagery(): Promise<ImageryItem[]> {
  const images: ImageryItem[] = [];
  
  const epicImages = await getNASAEPICImagery();
  images.push(...epicImages);

  // Note: ISS imagery requires dynamic feed from NASA Image API
  // Static URLs removed as they become stale quickly
  // TODO: Implement NASA Image API integration for fresh ISS photos

  return images;
}

export async function getSatelliteImagery(noradId: number, satelliteName: string): Promise<SatelliteImagery> {
  const images: ImageryItem[] = [];
  let source = 'Unknown';

  const weatherSat = WEATHER_SATELLITE_IMAGERY[noradId];
  if (weatherSat) {
    const weatherImages = getGOESImagery(noradId, weatherSat);
    images.push(...weatherImages);
    source = 'NOAA GOES';
  }

  if (noradId === 25544) {
    const issImages = await getISSImagery();
    images.push(...issImages);
    source = 'NASA ISS/EPIC';
  }

  if (EARTH_OBSERVATION_SATELLITES.has(noradId) && noradId !== 25544) {
    const epicImages = await getNASAEPICImagery();
    images.push(...epicImages);
    source = 'NASA Earth Observatory';
  }

  const nameLower = satelliteName.toLowerCase();
  if (images.length === 0) {
    if (nameLower.includes('goes')) {
      const defaultGoes = getGOESImagery(noradId, { name: 'GOES', goesId: 'GOES16', region: 'east' });
      images.push(...defaultGoes);
      source = 'NOAA GOES';
    } else if (nameLower.includes('noaa') || nameLower.includes('metop')) {
      const defaultGoes = getGOESImagery(noradId, { name: 'Weather Satellite', goesId: 'GOES16', region: 'east' });
      images.push(...defaultGoes);
      source = 'NOAA';
    }
  }

  return {
    satelliteId: noradId,
    satelliteName,
    images,
    source,
    hasImagery: images.length > 0,
  };
}

export function hasImagerySupport(noradId: number, satelliteName: string): boolean {
  if (WEATHER_SATELLITE_IMAGERY[noradId]) return true;
  if (EARTH_OBSERVATION_SATELLITES.has(noradId)) return true;
  
  const name = satelliteName.toLowerCase();
  return name.includes('goes') || 
         name.includes('noaa') || 
         name.includes('metop') ||
         name.includes('aqua') || 
         name.includes('terra') || 
         name.includes('landsat');
}
