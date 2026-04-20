export type SatelliteType =
  | 'imagery'
  | 'comms'
  | 'weather'
  | 'nav'
  | 'scientific'
  | 'crewed'
  | 'debris'
  | 'unknown';

export const SATELLITE_TYPES: SatelliteType[] = [
  'imagery',
  'comms',
  'weather',
  'nav',
  'scientific',
  'crewed',
  'debris',
  'unknown',
];

/** Raw satellite record used for type classification */
export interface RawSatellite {
  name: string;
  objectType?: string;
  noradId?: number;
}
