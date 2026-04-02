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

// ============================================
// Journal & Community Types
// ============================================

export type JournalOutcome = 'saw_it' | 'missed_it' | 'cloudy';

export interface JournalEntry {
  id: string;
  user_id: string;
  satellite_name: string;
  pass_timestamp: string;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  star_rating: number | null;
  notes: string | null;
  card_image: string | null;
  outcome: JournalOutcome;
  is_public: boolean;
  created_at: string;
}

export interface CommunityUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
}

export interface CommunitySighting extends JournalEntry {
  user: CommunityUser;
  like_count: number;
  comment_count: number;
  user_liked: boolean;
}

export interface CommunityComment {
  id: string;
  user_id: string;
  sighting_id: string;
  text: string;
  created_at: string;
  user: CommunityUser;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
  location_city: string | null;
  location_region: string | null;
  created_at: string;
}

export interface ProfileStats {
  totalSightings: number;
  uniqueSatellites: number;
  currentStreak: number;
}

export type FeedTab = 'global' | 'near_you' | 'by_satellite';

export interface FeedPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
