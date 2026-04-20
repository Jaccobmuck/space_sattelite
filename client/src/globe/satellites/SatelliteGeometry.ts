import {
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  SphereGeometry,
  BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SatelliteType } from '../../types/satellite';

// All geometry dimensions are in scene units where Earth radius = 1.
// Target bounding size: ~0.02 units so satellites are visible but not huge.
const S = 0.012; // base scale factor

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  // Dispose source parts; merged geometry is a new allocation
  parts.forEach(p => p.dispose());
  if (!merged) {
    // Fallback: return first part or a sphere
    return new SphereGeometry(S, 8, 8);
  }
  return merged;
}

// ─── Individual geometry builders ─────────────────────────────────────────────

function imageryGeometry(): BufferGeometry {
  // Camera body: box + protruding cylinder lens
  const body = new BoxGeometry(S * 1.5, S, S);
  const lens = new CylinderGeometry(S * 0.4, S * 0.6, S * 0.8, 8);
  lens.translate(0, S * 0.9, 0);
  return merge([body, lens]);
}

function commsGeometry(): BufferGeometry {
  // Dish antenna: wide inverted cone + support cylinder
  const dish = new ConeGeometry(S * 2, S * 0.5, 12);
  dish.rotateX(Math.PI); // invert — opening faces up
  const support = new CylinderGeometry(S * 0.2, S * 0.2, S * 1.2, 6);
  support.translate(0, -S * 0.6, 0);
  return merge([dish, support]);
}

function weatherGeometry(): BufferGeometry {
  // 3 stacked flat torus rings
  const ring1 = new TorusGeometry(S * 1.6, S * 0.25, 6, 16);
  const ring2 = new TorusGeometry(S * 1.1, S * 0.2,  6, 16);
  ring2.translate(0, S * 0.4, 0);
  const ring3 = new TorusGeometry(S * 0.6, S * 0.15, 6, 16);
  ring3.translate(0, S * 0.7, 0);
  return merge([ring1, ring2, ring3]);
}

function navGeometry(): BufferGeometry {
  // Plus/cross: 2 perpendicular box bars
  const barH = new BoxGeometry(S * 4, S * 0.5, S * 0.5);
  const barV = new BoxGeometry(S * 0.5, S * 4, S * 0.5);
  return merge([barH, barV]);
}

function scientificGeometry(): BufferGeometry {
  // Thin telescope tube + spherical end cap
  const tube = new CylinderGeometry(S * 0.3, S * 0.3, S * 3, 8);
  const cap  = new SphereGeometry(S * 0.5, 8, 6);
  cap.translate(0, S * 1.7, 0);
  return merge([tube, cap]);
}

function crewedGeometry(): BufferGeometry {
  // ISS-like cross: central box + 4 rectangular solar panels
  const center  = new BoxGeometry(S * 1.5, S * 1.5, S * 1.5);
  const panelL  = new BoxGeometry(S * 2.5, S * 0.4, S * 1.0);
  panelL.translate(-S * 2.0, 0, 0);
  const panelR  = new BoxGeometry(S * 2.5, S * 0.4, S * 1.0);
  panelR.translate( S * 2.0, 0, 0);
  const panelF  = new BoxGeometry(S * 1.0, S * 0.4, S * 2.5);
  panelF.translate(0, 0, -S * 2.0);
  const panelB  = new BoxGeometry(S * 1.0, S * 0.4, S * 2.5);
  panelB.translate(0, 0,  S * 2.0);
  return merge([center, panelL, panelR, panelF, panelB]);
}

function debrisGeometry(): BufferGeometry {
  // Elongated dim cylinder — low detail intentional
  return new CylinderGeometry(S * 0.3, S * 0.3, S * 2.5, 6);
}

function unknownGeometry(): BufferGeometry {
  return new SphereGeometry(S, 8, 8);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return a merged BufferGeometry for the given satellite type.
 * Every call returns a NEW geometry instance — callers own disposal.
 */
export function getSatelliteGeometry(type: SatelliteType): BufferGeometry {
  switch (type) {
    case 'imagery':    return imageryGeometry();
    case 'comms':      return commsGeometry();
    case 'weather':    return weatherGeometry();
    case 'nav':        return navGeometry();
    case 'scientific': return scientificGeometry();
    case 'crewed':     return crewedGeometry();
    case 'debris':     return debrisGeometry();
    case 'unknown':
    default:           return unknownGeometry();
  }
}
