export type SatelliteCategory = 'weather' | 'comm' | 'nav' | 'iss' | 'science' | 'debris';

export interface Satellite {
  noradId: number;
  name: string;
  category: SatelliteCategory;
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
  period: number;
  inclination: number;
  owner: string;
  tle1: string;
  tle2: string;
}

export interface ISSData {
  position: {
    lat: number;
    lng: number;
    alt: number;
    velocity: number;
  };
  crew: CrewMember[];
  passes: Pass[];
}

export interface CrewMember {
  name: string;
  agency: string;
  role: string;
  daysInSpace: number;
}

export interface Pass {
  satellite: string;
  noradId: number;
  riseTime: string;
  maxElevation: number;
  maxElevationTime: string;
  setTime: string;
  duration: number;
  azimuth: number;
  quality: 'poor' | 'good' | 'excellent';
}

export interface MoonData {
  phase: number;
  phaseName: string;
  illumination: number;
  nextFullMoon: string;
  nextNewMoon: string;
  moonrise: string | null;
  moonset: string | null;
  age: number;
}

export interface SpaceWeather {
  solarActivity: {
    level: 'quiet' | 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme';
    xrayFlux: number;
    flareClass: string | null;
  };
  geomagneticActivity: {
    kpIndex: number;
    kpHistory: { time: string; value: number }[];
    stormLevel: string | null;
  };
  aurora: {
    visibility: 'none' | 'low' | 'moderate' | 'high';
    forecastUrl: string | null;
  };
  alerts: SpaceWeatherAlert[];
}

export interface SpaceWeatherAlert {
  id: string;
  type: 'flare' | 'storm' | 'radiation';
  severity: 'watch' | 'warning' | 'alert';
  message: string;
  issuedAt: string;
}

export interface UserLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export type PanelType = 'satellite' | 'iss' | 'moon' | 'weather' | 'passes' | null;

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

export interface GroundTrackPoint {
  lat: number;
  lng: number;
  alt: number;
  time: Date;
}

export interface GroundTrack {
  past: GroundTrackPoint[];
  future: GroundTrackPoint[];
}

export interface PinnedSatellite {
  satellite: Satellite;
  color: string;
  groundTrack: GroundTrack | null;
}
