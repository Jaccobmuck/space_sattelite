import type { RawSatellite, SatelliteType } from '../../types/satellite';

// Keyword lists — lowercase, matched against lowercased satellite name
const DEBRIS_KEYWORDS   = ['r/b', ' deb', 'debris', 'rocket body', 'platform'];
const CREWED_KEYWORDS   = ['iss (zarya)', 'tiangong', 'css', 'crew dragon', 'soyuz', 'progress'];
const COMMS_KEYWORDS    = ['starlink', 'oneweb', 'iridium', 'inmarsat', 'ses-', 'eutelsat',
                           'telesat', 'viasat', 'o3b', 'directv', 'echostar', 'galaxy-',
                           'intelsat', 'anik', 'aws', 'spacecom', 'yahsat'];
const WEATHER_KEYWORDS  = ['goes-', 'meteosat', 'noaa ', 'meteor-m', 'fengyun',
                           'metop-', 'himawari', 'gms-', 'elektro-', 'insat-'];
const NAV_KEYWORDS      = ['gps biir', 'gps biif', 'gps biii', 'glonass', 'galileo',
                           'beidou', 'navstar', 'qzss', 'irnss'];
const IMAGERY_KEYWORDS  = ['landsat', 'worldview', 'geoeye', 'pleiades', 'sentinel-',
                           'spot-', 'rapideye', 'skysat', 'dove-', 'eros-'];
const SCIENTIFIC_KEYWORDS = ['hubble', 'chandra', 'spitzer', 'kepler', 'swift-bat',
                              'fermi', 'nustar', 'xmm-newton', 'integral', 'tess',
                              'james webb', 'jwst', 'wise-'];

function matchesAny(name: string, keywords: string[]): boolean {
  return keywords.some(k => name.includes(k));
}

/**
 * Classify a raw satellite record into a SatelliteType.
 *
 * Primary signal: OBJECT_TYPE field (e.g. "ROCKET BODY", "DEBRIS").
 * Secondary signal: keyword matching on satellite name.
 * Fallback: 'unknown'.
 */
export function classifySatellite(satellite: RawSatellite): SatelliteType {
  if (!satellite) return 'unknown';

  const objectType = (satellite.objectType ?? '').toLowerCase();
  const name       = (satellite.name       ?? '').toLowerCase();

  // ── Primary: OBJECT_TYPE field ────────────────────────────────────────────
  if (objectType.includes('rocket body') || objectType === 'r/b') return 'debris';
  if (objectType.includes('debris'))                               return 'debris';

  // ── Secondary: name keyword matching ──────────────────────────────────────
  // Debris first — catches "COSMOS 2251 DEB", "FENGYUN 1C R/B", etc.
  if (matchesAny(name, DEBRIS_KEYWORDS))    return 'debris';
  if (matchesAny(name, CREWED_KEYWORDS))    return 'crewed';
  if (matchesAny(name, COMMS_KEYWORDS))     return 'comms';
  if (matchesAny(name, WEATHER_KEYWORDS))   return 'weather';
  if (matchesAny(name, NAV_KEYWORDS))       return 'nav';
  if (matchesAny(name, IMAGERY_KEYWORDS))   return 'imagery';
  if (matchesAny(name, SCIENTIFIC_KEYWORDS)) return 'scientific';

  return 'unknown';
}
