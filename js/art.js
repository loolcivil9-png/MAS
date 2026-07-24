/* ---------------------------------------------------------------------------
   The city's real artwork, drawn in code.

   Emoji are designed to be read at about sixteen pixels. Blown up to a
   two-hundred-unit building they turn into blurry, side-on clip art floating
   on the map — which is exactly why the city never looked like a city. So the
   architecture and the vehicles are drawn properly here instead, in a friendly
   "dollhouse" top-down: mostly roof, with a slice of front wall so a toddler
   still recognises a house as a house and a bus as a bus.

   Small props (fruit, flowers, people, animals, baskets) stay emoji — at their
   size emoji look great and carry far more charm than anything drawn here.

   Every function draws centred on (0, 0) inside a box of ±`s`, using only the
   passed context. They are called ONCE per size bucket into an offscreen
   sprite by thing.js, so nothing here runs per frame.
   --------------------------------------------------------------------------- */

import { TAU } from './util.js';

/* --- shared helpers ---------------------------------------------------------- */

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** A crisp dark outline, the thing that makes flat shapes read as "designed". */
function outline(g, width, color = 'rgba(38, 30, 60, 0.55)') {
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.stroke();
}

/* --- palettes ---------------------------------------------------------------- */

/**
 * Per-kind colours. The ROOF is always a muted, believable surface — a real
 * roof is grey felt or tan gravel, never candy — and the building's identity
 * colour lives in the frontage, its awning and its trim. That split is what
 * stops downtown looking like a tray of toy blocks.
 */
export const BUILDING_STYLES = {
  office:   { roof: '#8e96a6', deck: '#7c8493', wall: '#dbe3f0', trim: '#5c6b86', glass: '#8fd2f0' },
  bank:     { roof: '#a09680', deck: '#8d8471', wall: '#f2e8cf', trim: '#8a6d2f', glass: '#9adcf2' },
  hotel:    { roof: '#9a8d94', deck: '#877b82', wall: '#f6dfe4', trim: '#a8425f', glass: '#ffe6a6' },
  hospital: { roof: '#97a0a6', deck: '#848d93', wall: '#f4f7fa', trim: '#cf4747', glass: '#a8dcf0' },
  school:   { roof: '#a08a76', deck: '#8c7865', wall: '#fbe9cd', trim: '#c26232', glass: '#bfe4f2' },
  church:   { roof: '#8f8698', deck: '#7d7485', wall: '#efeae0', trim: '#6b5891', glass: '#f2c85c' },
  shop:     { roof: '#939a8e', deck: '#80877c', wall: '#e6f5e2', trim: '#3f8f55', glass: '#ffd98a' },
  factory:  { roof: '#8a8f96', deck: '#787d84', wall: '#e2e0da', trim: '#5c6066', glass: '#9fd3e0' },
};

export const HOUSE_STYLES = {
  house:    { wall: '#fdf1dc', trim: '#e6d2ae', roof: '#d1543f', door: '#8a5a33', glass: '#a9dcf2' },
  cottage:  { wall: '#eef7e6', trim: '#cfe3c2', roof: '#4f9e6a', door: '#7a5230', glass: '#bfe6f5' },
};

export const VEHICLE_STYLES = {
  car:       { body: '#e0483f', glass: '#2f4a5c', trim: '#ffffff' },
  taxi:      { body: '#f2c231', glass: '#2f4a5c', trim: '#2b2b2b' },
  suv:       { body: '#3f7fd0', glass: '#2f4a5c', trim: '#ffffff' },
  police:    { body: '#2f4f8f', glass: '#2f4a5c', trim: '#ffffff' },
  bus:       { body: '#4aa3d9', glass: '#2f4a5c', trim: '#ffffff', long: true },
  truck:     { body: '#e6e2d8', glass: '#2f4a5c', trim: '#c05a3a', long: true, cargo: '#d99a3c' },
  fireTruck: { body: '#d63b32', glass: '#2f4a5c', trim: '#ffffff', long: true, cargo: '#b02b24' },
  ambulance: { body: '#f6f6f4', glass: '#2f4a5c', trim: '#e04b4b', long: true, cargo: '#dfe6ef' },
};

/* --- buildings --------------------------------------------------------------- */

/**
 * A town building: roof up top with rooftop clutter, a strip of front wall at
 * the bottom with lit windows and a door. Instantly reads as a building from
 * above without pretending to be an architectural drawing.
 */
export function drawBuilding(g, s, kind = 'office') {
  const p = BUILDING_STYLES[kind] ?? BUILDING_STYLES.office;
  const w = s * 1.72;
  const h = s * 1.72;
  const x = -w / 2;
  const y = -h / 2;
  const faceH = h * 0.34;          // the strip of frontage you see from above
  const roofH = h - faceH;

  // --- frontage (drawn first; the roof overlaps its top edge) --------------
  roundRect(g, x, y + roofH - s * 0.06, w, faceH + s * 0.06, s * 0.09);
  g.fillStyle = p.wall;
  g.fill();
  outline(g, s * 0.05);

  // a row of lit windows and the entrance
  const cols = 5;
  const winW = w * 0.12;
  const winH = faceH * 0.3;
  for (let c = 0; c < cols; c++) {
    const wx = x + w * 0.08 + c * ((w * 0.84 - winW) / (cols - 1));
    roundRect(g, wx, y + roofH + faceH * 0.16, winW, winH, winH * 0.28);
    g.fillStyle = p.glass;
    g.fill();
    g.lineWidth = s * 0.018;
    g.strokeStyle = p.trim;
    g.stroke();
  }
  const dw = w * 0.24;
  const dh = faceH * 0.36;
  roundRect(g, -dw / 2, y + h - dh - faceH * 0.06, dw, dh, dw * 0.14);
  g.fillStyle = p.trim;
  g.fill();
  // the awning above the door — the building's one splash of identity colour
  roundRect(g, -dw * 0.8, y + h - dh - faceH * 0.06 - s * 0.1, dw * 1.6, s * 0.1, s * 0.04);
  g.fillStyle = p.trim;
  g.fill();

  // --- the roof: a believable deck, not a slab of colour ------------------
  roundRect(g, x, y, w, roofH, s * 0.09);
  g.fillStyle = p.roof;
  g.fill();
  outline(g, s * 0.05);

  // parapet: a raised lip all the way round, with the deck sunk inside it
  const inset = s * 0.1;
  roundRect(g, x + inset, y + inset, w - inset * 2, roofH - inset * 1.6, s * 0.06);
  g.fillStyle = p.deck;
  g.fill();
  // The parapet is picked out in the building's own colour, so each one is
  // still instantly its own place from above without a garish roof.
  g.lineWidth = s * 0.055;
  g.strokeStyle = p.trim;
  g.stroke();

  // seam lines across the deck, so the surface has texture
  g.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  g.lineWidth = s * 0.022;
  for (let i = 1; i < 4; i++) {
    const ly = y + inset + (roofH - inset * 1.6) * (i / 4);
    g.beginPath();
    g.moveTo(x + inset * 1.4, ly);
    g.lineTo(x + w - inset * 1.4, ly);
    g.stroke();
  }

  // rooftop plant: a stairwell box, a pair of air units and a water tank
  roundRect(g, x + w * 0.13, y + roofH * 0.16, w * 0.2, roofH * 0.22, s * 0.04);
  g.fillStyle = p.wall;
  g.fill();
  outline(g, s * 0.028);

  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 2; i++) {
    roundRect(g, x + w * (0.45 + i * 0.17), y + roofH * 0.18, w * 0.13, roofH * 0.16, s * 0.03);
    g.fill();
    g.lineWidth = s * 0.022;
    g.strokeStyle = 'rgba(30,24,50,0.3)';
    g.stroke();
  }

  g.beginPath();
  g.arc(x + w * 0.76, y + roofH * 0.62, s * 0.13, 0, TAU);
  g.fillStyle = p.wall;
  g.fill();
  outline(g, s * 0.028);

  // a skylight strip catching the light
  roundRect(g, x + w * 0.16, y + roofH * 0.56, w * 0.3, roofH * 0.16, s * 0.03);
  g.fillStyle = p.glass;
  g.fill();
  g.lineWidth = s * 0.022;
  g.strokeStyle = 'rgba(30,24,50,0.28)';
  g.stroke();
}

/* --- houses ------------------------------------------------------------------ */

/** A little home: pitched roof with a ridge, chimney, door and two windows. */
export function drawHouse(g, s, kind = 'house') {
  const p = HOUSE_STYLES[kind] ?? HOUSE_STYLES.house;
  const w = s * 1.64;
  const h = s * 1.6;
  const x = -w / 2;
  const y = -h / 2;
  const faceH = h * 0.38;
  const roofH = h - faceH;

  // chimney first, poking above the roofline
  roundRect(g, x + w * 0.66, y - s * 0.02, w * 0.13, roofH * 0.42, s * 0.04);
  g.fillStyle = p.trim;
  g.fill();
  outline(g, s * 0.045);

  // --- front wall ----------------------------------------------------------
  roundRect(g, x + w * 0.04, y + roofH - s * 0.05, w * 0.92, faceH + s * 0.05, s * 0.08);
  g.fillStyle = p.wall;
  g.fill();
  outline(g, s * 0.05);

  // door
  const dw = w * 0.2;
  const dh = faceH * 0.66;
  roundRect(g, -dw / 2, y + h - dh - faceH * 0.08, dw, dh, dw * 0.2);
  g.fillStyle = p.door;
  g.fill();
  outline(g, s * 0.035);
  // door knob
  g.beginPath();
  g.arc(dw * 0.28, y + h - dh * 0.55 - faceH * 0.08, s * 0.035, 0, TAU);
  g.fillStyle = '#f5d98a';
  g.fill();

  // two windows either side of the door
  for (const sx of [-1, 1]) {
    const ww = w * 0.19;
    const wh = faceH * 0.4;
    roundRect(g, sx * w * 0.28 - ww / 2, y + roofH + faceH * 0.16, ww, wh, s * 0.04);
    g.fillStyle = p.glass;
    g.fill();
    outline(g, s * 0.035);
  }

  // --- pitched roof: a wide trapezoid with a ridge line --------------------
  g.beginPath();
  g.moveTo(x - w * 0.06, y + roofH);          // eave left
  g.lineTo(x + w * 0.22, y + roofH * 0.12);   // ridge left
  g.lineTo(x + w * 0.78, y + roofH * 0.12);   // ridge right
  g.lineTo(x + w * 1.06, y + roofH);          // eave right
  g.closePath();
  g.fillStyle = p.roof;
  g.fill();
  outline(g, s * 0.055);

  // ridge highlight
  g.beginPath();
  g.moveTo(x + w * 0.22, y + roofH * 0.12);
  g.lineTo(x + w * 0.78, y + roofH * 0.12);
  g.lineWidth = s * 0.05;
  g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  g.stroke();
}

/* --- vehicles ---------------------------------------------------------------- */

/**
 * A vehicle seen from directly above, nose pointing up: wheels at the corners,
 * a bright roof, and glass at both ends. This is the single biggest fix for
 * the car park — a side-on 🚗 can never sit convincingly on a top-down road.
 */
export function drawVehicle(g, s, kind = 'car') {
  const p = VEHICLE_STYLES[kind] ?? VEHICLE_STYLES.car;
  const w = s * (p.long ? 1.0 : 1.05);
  const h = s * (p.long ? 2.2 : 1.75);
  const x = -w / 2;
  const y = -h / 2;

  // --- wheels, drawn first so they peek out at the sides -------------------
  const tyreW = w * 0.15;
  const tyreH = h * 0.17;
  g.fillStyle = '#2b2b33';
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      roundRect(g, sx * (w / 2) - (sx > 0 ? 0 : tyreW), y + h * (sy < 0 ? 0.16 : 0.68), tyreW, tyreH, tyreW * 0.35);
      g.fill();
    }
  }

  // --- body ----------------------------------------------------------------
  roundRect(g, x, y, w, h, w * 0.24);
  g.fillStyle = p.body;
  g.fill();
  outline(g, s * 0.05);

  // cargo box / rear section for the long ones
  if (p.cargo) {
    roundRect(g, x + w * 0.06, y + h * 0.42, w * 0.88, h * 0.5, w * 0.12);
    g.fillStyle = p.cargo;
    g.fill();
    outline(g, s * 0.035);
  }

  // windscreen (front) and rear window
  roundRect(g, x + w * 0.13, y + h * 0.1, w * 0.74, h * (p.long ? 0.13 : 0.2), w * 0.1);
  g.fillStyle = p.glass;
  g.fill();
  if (!p.cargo) {
    roundRect(g, x + w * 0.15, y + h * 0.68, w * 0.7, h * 0.16, w * 0.1);
    g.fillStyle = p.glass;
    g.fill();
  }

  // roof stripe / light bar
  roundRect(g, x + w * 0.2, y + h * (p.long ? 0.26 : 0.36), w * 0.6, h * 0.1, w * 0.08);
  g.fillStyle = p.trim;
  g.fill();

  // headlights
  g.fillStyle = '#fff6c8';
  for (const sx of [-1, 1]) {
    roundRect(g, sx * w * 0.28 - w * 0.09, y + h * 0.02, w * 0.18, h * 0.05, w * 0.04);
    g.fill();
  }
}

/* --- nature ------------------------------------------------------------------ */

/** A round leafy tree from above: overlapping canopy blobs over a trunk dot. */
export function drawTree(g, s, kind = 'tree') {
  const dark = kind === 'palm' ? '#2f7d4f' : '#2f6f36';
  const mid = kind === 'palm' ? '#41a566' : '#419a45';
  const light = kind === 'palm' ? '#6cc98a' : '#6fc45c';

  // trunk peeking out at the bottom
  roundRect(g, -s * 0.11, s * 0.15, s * 0.22, s * 0.75, s * 0.09);
  g.fillStyle = '#8a5a35';
  g.fill();
  outline(g, s * 0.045);

  // canopy: a ring of blobs plus a crown, so the edge is leafy not circular
  g.fillStyle = dark;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    g.beginPath();
    g.arc(Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.46 - s * 0.08, s * 0.44, 0, TAU);
    g.fill();
  }
  g.fillStyle = mid;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4;
    g.beginPath();
    g.arc(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3 - s * 0.12, s * 0.38, 0, TAU);
    g.fill();
  }
  // sunlit top-left highlight
  g.fillStyle = light;
  g.beginPath();
  g.arc(-s * 0.18, -s * 0.32, s * 0.3, 0, TAU);
  g.fill();
}

/* --- the landmark ------------------------------------------------------------ */

/** The stadium: an oval bowl of stands around a green pitch. */
export function drawStadium(g, s) {
  // outer bowl
  g.beginPath();
  g.ellipse(0, 0, s * 0.98, s * 0.82, 0, 0, TAU);
  g.fillStyle = '#c9ced8';
  g.fill();
  outline(g, s * 0.05);

  // stands, in alternating wedges so it reads as seating
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * TAU;
    const a1 = ((i + 1) / 16) * TAU;
    g.beginPath();
    g.ellipse(0, 0, s * 0.95, s * 0.79, 0, a0, a1);
    g.lineTo(0, 0);
    g.closePath();
    g.fillStyle = i % 2 ? 'rgba(224, 92, 92, 0.85)' : 'rgba(196, 70, 70, 0.85)';
    g.fill();
  }

  // inner wall then the pitch
  g.beginPath();
  g.ellipse(0, 0, s * 0.66, s * 0.54, 0, 0, TAU);
  g.fillStyle = '#e8eaef';
  g.fill();
  g.beginPath();
  g.ellipse(0, 0, s * 0.6, s * 0.48, 0, 0, TAU);
  g.fillStyle = '#4fa851';
  g.fill();

  // pitch markings
  g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  g.lineWidth = s * 0.028;
  g.beginPath();
  g.ellipse(0, 0, s * 0.52, s * 0.4, 0, 0, TAU);
  g.stroke();
  g.beginPath();
  g.moveTo(-s * 0.52, 0);
  g.lineTo(s * 0.52, 0);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, s * 0.14, 0, TAU);
  g.stroke();

  // floodlights at the corners
  g.fillStyle = '#f7f3d8';
  for (const a of [0.7, 2.44, 3.84, 5.58]) {
    g.beginPath();
    g.arc(Math.cos(a) * s * 0.86, Math.sin(a) * s * 0.7, s * 0.075, 0, TAU);
    g.fill();
  }
}

/* --- dispatch ---------------------------------------------------------------- */

/**
 * Draws art recipe `id` centred at (0,0) with half-extent `s`.
 * Ids are `"<family>:<kind>"`, e.g. `"building:bank"`, `"vehicle:bus"`.
 */
export function drawArt(g, id, s) {
  const [family, kind] = id.split(':');
  switch (family) {
    case 'building': drawBuilding(g, s, kind); return true;
    case 'house': drawHouse(g, s, kind); return true;
    case 'vehicle': drawVehicle(g, s, kind); return true;
    case 'tree': drawTree(g, s, kind); return true;
    case 'stadium': drawStadium(g, s); return true;
    default: return false;
  }
}
