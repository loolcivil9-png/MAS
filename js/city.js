/* ---------------------------------------------------------------------------
   The city — one big, organized, hand-designed map.

   No levels. The world is a single portrait city, laid out the way a real
   little city is:

       ┌──────────────────┐
       │     STADIUM      │   the landmark — the very last bite
       │     DOWNTOWN     │   a block of big buildings
       ├──── road ────────┤
       │   BUSY STREETS   │   rows of parked cars, buses, traffic lights
       ├──── road ────────┤
       │   LITTLE HOUSES  │   a neat grid of homes and garden trees
       ├──── road ────────┤
       │     MARKET       │   crates, baskets, fruit by the boxful
       ├──── road ────────┤
       │      PARK        │   flower beds, benches, a fountain — where a
       └──────────────────┘   small hole begins

   Small things live at the bottom, big things at the top, so growing bigger
   *is* the journey through the city. Things come in ARMIES — a bed of seven
   flowers, a row of four parked cars, a block of six buildings — because a
   line of the same thing begs to be hoovered up in one glorious pass.

   Everything is generated from a SEED: the same seed always rebuilds exactly
   the same city, which is how a half-eaten city can be saved and resumed.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';

/* The layout generation version. Bumped whenever the city plan below changes
   in a way that renumbers things, so a saved half-eaten city from an older
   layout is discarded (start fresh) rather than resolving its eaten-id list
   against a different city. Lifetime totals always survive. */
export const GEN_VERSION = 3;

/* --- deterministic randomness ------------------------------------------------ */

/** mulberry32 — tiny, fast, and identical on every device. */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- the cast ---------------------------------------------------------------- */

const T = {
  // --- tier 0: the tiny things, by the bedful ------------------------------
  flower: { glyph: '🌸', name: 'Flower' },
  tulip: { glyph: '🌷', name: 'Tulip' },
  daisy: { glyph: '🌼', name: 'Daisy' },
  rose: { glyph: '🌹', name: 'Rose' },
  hibiscus: { glyph: '🌺', name: 'Hibiscus' },
  apple: { glyph: '🍎', name: 'Apple' },
  orange: { glyph: '🍊', name: 'Orange' },
  strawberry: { glyph: '🍓', name: 'Strawberry' },
  grapes: { glyph: '🍇', name: 'Grapes' },
  lemon: { glyph: '🍋', name: 'Lemon' },
  ball: { glyph: '⚽', name: 'Ball', call: 'boing' },
  balloon: { glyph: '🎈', name: 'Balloon', call: 'boing' },
  bird: { glyph: '🐦', name: 'Bird', call: 'tweet', runner: true },
  pigeon: { glyph: '🐦‍⬛', name: 'Pigeon', call: 'tweet', runner: true },

  // --- tier 1: small props and all the people ------------------------------
  box: { glyph: '📦', name: 'Box' },
  basket: { glyph: '🧺', name: 'Basket' },
  light: { glyph: '🚦', name: 'Traffic light' },
  barrier: { glyph: '🚧', name: 'Barrier' },
  hydrant: { glyph: '🧯', name: 'Hydrant' },
  lamp: { glyph: '🪔', name: 'Lamp' },
  dog: { glyph: '🐕', name: 'Dog', call: 'woof', runner: true },
  cat: { glyph: '🐈', name: 'Cat', call: 'meow', runner: true },

  // The people of the city. They stroll about their day, scatter with a
  // comic "wheee!" when the hole comes close, and are always catchable.
  boy: { glyph: '👦', name: 'Boy', call: 'whee', runner: true, wander: true },
  girl: { glyph: '👧', name: 'Girl', call: 'whee', runner: true, wander: true },
  man: { glyph: '👨', name: 'Man', call: 'whee', runner: true, wander: true },
  woman: { glyph: '👩', name: 'Woman', call: 'whee', runner: true, wander: true },
  walker: { glyph: '🚶', name: 'Person', call: 'whee', runner: true, wander: true },
  jogger: { glyph: '🏃', name: 'Jogger', call: 'whee', runner: true, wander: true },
  officer: { glyph: '👮', name: 'Police officer', call: 'whee', runner: true, wander: true },
  builder: { glyph: '👷', name: 'Builder', call: 'whee', runner: true, wander: true },
  farmer: { glyph: '🧑‍🌾', name: 'Farmer', call: 'whee', runner: true, wander: true },
  baby: { glyph: '👶', name: 'Baby', call: 'whee', runner: true, wander: true },

  // --- tier 2: bench-and-scooter sized ------------------------------------
  chair: { glyph: '🪑', name: 'Chair' },
  bench: { glyph: '🛋️', name: 'Bench' },
  trolley: { glyph: '🛒', name: 'Trolley' },
  scooter: { glyph: '🛵', name: 'Scooter', call: 'vroom' },
  bike: { glyph: '🚲', name: 'Bike' },
  melon: { glyph: '🍉', name: 'Watermelon', call: 'crunch' },
  littleTree: { art: 'tree:tree', name: 'Little tree', call: 'crunch' },
  postbox: { glyph: '📮', name: 'Postbox' },
  umbrella: { glyph: '⛱️', name: 'Sun umbrella' },

  /* From here up, everything is DRAWN by art.js rather than an emoji — at
     these sizes emoji are blurry side-on stickers, and a top-down city needs
     roofs and car roofs, not clip art. See js/art.js. */

  // --- tier 3: cars and trees ---------------------------------------------
  car: { art: 'vehicle:car', name: 'Car', call: 'vroom' },
  taxi: { art: 'vehicle:taxi', name: 'Taxi', call: 'vroom' },
  suv: { art: 'vehicle:suv', name: 'Jeep', call: 'vroom' },
  police: { art: 'vehicle:police', name: 'Police car', call: 'vroom' },
  fountain: { glyph: '⛲', name: 'Fountain', call: 'splash' },
  tree: { art: 'tree:tree', name: 'Tree', call: 'crunch' },
  palm: { art: 'tree:palm', name: 'Palm tree', call: 'crunch' },

  // --- tier 4: homes and big vehicles -------------------------------------
  house: { art: 'house:house', name: 'House' },
  cottage: { art: 'house:cottage', name: 'Cottage' },
  bus: { art: 'vehicle:bus', name: 'Bus', call: 'vroom' },
  truck: { art: 'vehicle:truck', name: 'Truck', call: 'vroom' },
  fireTruck: { art: 'vehicle:fireTruck', name: 'Fire truck', call: 'vroom' },
  ambulance: { art: 'vehicle:ambulance', name: 'Ambulance', call: 'vroom' },

  // --- tier 5: the downtown skyline ---------------------------------------
  office: { art: 'building:office', name: 'Office' },
  shop: { art: 'building:shop', name: 'Shop' },
  bank: { art: 'building:bank', name: 'Bank' },
  hotel: { art: 'building:hotel', name: 'Hotel' },
  church: { art: 'building:church', name: 'Church' },
  school: { art: 'building:school', name: 'School' },
  hospital: { art: 'building:hospital', name: 'Hospital' },
  factory: { art: 'building:factory', name: 'Factory' },

  // --- tier 6: the one landmark -------------------------------------------
  stadium: { art: 'stadium:stadium', name: 'Stadium', call: 'magic' },
};

/** Every distinct thing in the city — for the grown-ups stat line. */
export const CITY_KINDS = new Set(Object.values(T).map((e) => e.name));
export const TOTAL_KINDS = CITY_KINDS.size;

/* --- praise ------------------------------------------------------------------ */

/** Cleaning a district. `%s` becomes his name if one is configured. */
export const BIG_CHEERS = [
  'You did it%s! You win!',
  'Amazing%s! You win!',
  'Wow%s! You are the best!',
  'Fantastic%s! You win!',
  'Hooray%s! You win!',
];

/** Eating the whole city. */
export const MEGA_CHEERS = [
  'You ate the whole city%s! Champion!',
  'The whole city%s! You are a super star!',
  'Incredible%s! You are the champion!',
];

export const DISTRICT_CHEERS = {
  park: 'The park is all clean!',
  market: 'The market is all gone!',
  houses: 'All the little houses! Yum!',
  streets: 'The whole street! Amazing!',
  downtown: 'All the big buildings! Wow!',
};

/* --- the roads, shared with the ground renderer ------------------------------ */

/** Fractions of the city height where the cross-streets run. */
export const ROAD_YS = [0.24, 0.44, 0.62, 0.80];
export const ROAD_WIDTH = 80;
/** The main avenue runs down the middle from the first road to the park. */
export const AVENUE = { x: 0.5, y0: 0.24, y1: 0.80 };

/* --- plots: the buildable blocks, DERIVED from the roads ---------------------

   Every plot is computed from the road grid rather than typed by hand, so a
   plot can never sit on a road — and because everything is placed inside a
   plot, nothing the hole eats can end up in the middle of the street. This is
   what actually fixes "the city is not organized": tidiness is now a property
   of the geometry instead of a promise about some numbers.                    */

const EDGE_MARGIN = 46;   // gap between a plot and the edge of the world
const ROAD_CLEAR = 30;    // gap between a plot and the kerb of any road

/** Every road as a rectangle — shared by the plot maths and the audit below. */
export function roadRects() {
  const W = CONFIG.city.width;
  const H = CONFIG.city.height;
  const half = ROAD_WIDTH / 2;
  const rects = ROAD_YS.map((yf) => ({
    x0: 0, y0: H * yf - half, x1: W, y1: H * yf + half,
  }));
  rects.push({
    x0: W * AVENUE.x - half, y0: H * AVENUE.y0,
    x1: W * AVENUE.x + half, y1: H * AVENUE.y1,
  });
  return rects;
}

/** District order, top of the map downward — one band between each road. */
const BANDS = ['downtown', 'streets', 'houses', 'market', 'park'];

/** The paving each district gets, used by the ground renderer. */
const SURFACE = {
  downtown: 'plaza', streets: 'asphalt', houses: 'pavement',
  market: 'pavement', park: 'lawn',
};

let plotCache = null;

/**
 * The city's blocks. Bands crossed by the central avenue are split into a
 * left and a right plot; the top and bottom bands run the full width.
 * @returns {{d: string, kind: string, x0: number, y0: number, x1: number, y1: number}[]}
 */
export function plots() {
  if (plotCache) return plotCache;
  const W = CONFIG.city.width;
  const H = CONFIG.city.height;
  const clear = ROAD_WIDTH / 2 + ROAD_CLEAR;
  const avX = W * AVENUE.x;

  const out = [];
  let top = EDGE_MARGIN;
  ROAD_YS.forEach((yf, i) => {
    pushBand(out, BANDS[i], top, H * yf - clear, W, H, avX, clear);
    top = H * yf + clear;
  });
  pushBand(out, BANDS[BANDS.length - 1], top, H - EDGE_MARGIN, W, H, avX, clear);

  plotCache = out;
  return out;
}

function pushBand(out, d, y0, y1, W, H, avX, clear) {
  if (y1 - y0 < 40) return;
  const kind = SURFACE[d] ?? 'pavement';
  const mid = (y0 + y1) / 2;
  const avenueHere = mid > H * AVENUE.y0 && mid < H * AVENUE.y1;
  if (avenueHere) {
    out.push({ d, kind, x0: EDGE_MARGIN, y0, x1: avX - clear, y1 });
    out.push({ d, kind, x0: avX + clear, y0, x1: W - EDGE_MARGIN, y1 });
  } else {
    out.push({ d, kind, x0: EDGE_MARGIN, y0, x1: W - EDGE_MARGIN, y1 });
  }
}

/** True when a circle touches a rectangle — used to audit road clearance. */
export function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x0, Math.min(x, rect.x1));
  const cy = Math.max(rect.y0, Math.min(y, rect.y1));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}


/* --- generation --------------------------------------------------------------

   The layout is GENERATED from the plots above, never typed as raw
   coordinates. Each district fills its plot(s) with tidy grids sized to the
   plot itself, so rows are automatically even, nothing spills into a road,
   and nothing overlaps anything else. A final audit proves it.              */

/**
 * Builds the full city plan.
 * @param {number} seed
 * @returns {{
 *   things: {id, entry, tier, x, y, district, golden, magnet}[],
 *   start: {x, y},
 * }} Positions are in city units (CONFIG.city.width × height). `id` is the
 *   index in the array and is STABLE for a given seed — the save file records
 *   eaten ids against the seed.
 */
export function generateCity(seed) {
  const rng = makeRng(seed);
  const SIZES = CONFIG.things.tierSizes;
  const things = [];
  const P = plots();

  const jit = (amount) => (rng() * 2 - 1) * amount;
  const add = (entry, tier, district, x, y) => {
    things.push({ id: things.length, entry, tier, district, x, y, golden: false, magnet: false });
  };

  /** All the plots of one district, left-to-right. */
  const of = (d) => P.filter((p) => p.d === d);

  /** Carve a sub-rectangle out of a plot using 0..1 fractions. */
  const sub = (p, fx0, fy0, fx1, fy1) => ({
    d: p.d,
    x0: p.x0 + (p.x1 - p.x0) * fx0,
    y0: p.y0 + (p.y1 - p.y0) * fy0,
    x1: p.x0 + (p.x1 - p.x0) * fx1,
    y1: p.y0 + (p.y1 - p.y0) * fy1,
  });

  /**
   * Fills a rectangle with a tidy cols × rows grid. The counts are trimmed
   * until every cell is at least 2.1 × the thing's radius, which makes
   * overlap geometrically impossible; if even one will not fit, nothing is
   * placed. `wobble` is a few units of life, far too small to break the grid.
   */
  const fill = (rect, entry, tier, cols, rows, wobble = 5) => {
    const size = SIZES[tier];
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    // Cells are 2.12 radii apart and the wobble is capped at 0.05 of a radius,
    // so even two neighbours leaning toward each other stay 2.02 radii apart.
    // Overlap is therefore impossible, which keeps the plan's size identical
    // for every seed — and a stable count is what lets the save trust its ids.
    const cell = size * 2.12;
    if (w < cell || h < cell) return 0;
    const c = Math.max(1, Math.min(cols, Math.floor(w / cell)));
    const r = Math.max(1, Math.min(rows, Math.floor(h / cell)));
    const cw = w / c;
    const ch = h / r;
    const wob = Math.min(wobble, size * 0.05);
    let n = 0;
    for (let iy = 0; iy < r; iy++) {
      for (let ix = 0; ix < c; ix++) {
        add(entry, tier, rect.d,
          rect.x0 + cw * (ix + 0.5) + jit(wob),
          rect.y0 + ch * (iy + 0.5) + jit(wob));
        n++;
      }
    }
    return n;
  };

  /** One thing centred in a rectangle — for landmarks and centrepieces. */
  const centre = (rect, entry, tier) => {
    const size = SIZES[tier];
    if (rect.x1 - rect.x0 < size * 2 || rect.y1 - rect.y0 < size * 2) return;
    add(entry, tier, rect.d, (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2);
  };

  /**
   * A horizontal band of a plot, measured in real units from its top edge.
   * Working in units rather than fractions is what keeps every row honest:
   * a band is either tall enough for its grid or it is not, and you can see
   * which at a glance.
   */
  const strip = (p, fromTop, height) => ({
    d: p.d, x0: p.x0, x1: p.x1, y0: p.y0 + fromTop, y1: p.y0 + fromTop + height,
  });

  /** A left-to-right slice of a band, in 0..1 fractions of its width. */
  const slice = (r, fx0, fx1) => ({
    d: r.d, y0: r.y0, y1: r.y1,
    x0: r.x0 + (r.x1 - r.x0) * fx0,
    x1: r.x0 + (r.x1 - r.x0) * fx1,
  });

  /* --- DOWNTOWN: the stadium crowning the top, a block of towers below ---- */
  for (const p of of('downtown')) {
    centre(slice(strip(p, 0, 440), 0.34, 0.66), T.stadium, 6);
    // A varied skyline: every column is a different neighbour, and the two
    // rows differ too, so the block reads as a street rather than a stamp.
    const kinds = [T.office, T.bank, T.hotel, T.hospital, T.school, T.shop, T.church, T.factory];
    const rowA = strip(p, 460, 330);
    const rowB = strip(p, 800, 330);
    const cols = 6;
    for (let i = 0; i < cols; i++) {
      const a = i / cols;
      const b = (i + 1) / cols;
      fill(slice(rowA, a, b), kinds[i % kinds.length], 5, 1, 1, 4);
      fill(slice(rowB, a, b), kinds[(i + 3) % kinds.length], 5, 1, 1, 4);
    }
    fill(strip(p, 1140, 88), T.walker, 1, 8, 1, 5);   // people along the frontage
  }

  /* --- BUSY STREETS: a real car park — bays across, big rigs at the back --- */
  for (const [i, p] of of('streets').entries()) {
    fill(strip(p, 0, 90), T.light, 1, 5, 1, 4);                       // kerb furniture
    fill(strip(p, 100, 350), i === 0 ? T.car : T.taxi, 3, 5, 2, 5);   // two full rows
    fill(strip(p, 460, 180), i === 0 ? T.suv : T.police, 3, 5, 1, 5);
    const rigs = strip(p, 650, 245);                                  // the big vehicles
    fill(slice(rigs, 0, 0.66), i === 0 ? T.bus : T.truck, 4, 2, 1, 4);
    fill(slice(rigs, 0.68, 1), i === 0 ? T.fireTruck : T.ambulance, 4, 1, 1, 4);
    fill(strip(p, 905, 75), i === 0 ? T.hydrant : T.jogger, 1, 5, 1, 4);
  }

  /* --- LITTLE HOUSES: three tidy rows of homes with gardens between ------- */
  for (const [i, p] of of('houses').entries()) {
    fill(strip(p, 0, 245), i === 0 ? T.house : T.cottage, 4, 3, 1, 4);
    fill(strip(p, 252, 55), i === 0 ? T.tulip : T.flower, 0, 7, 1, 5);
    fill(strip(p, 312, 245), i === 0 ? T.cottage : T.house, 4, 3, 1, 4);
    const garden = strip(p, 564, 55);
    fill(slice(garden, 0, 0.6), i === 0 ? T.flower : T.tulip, 0, 5, 1, 5);
    fill(slice(garden, 0.64, 1), i === 0 ? T.dog : T.postbox, 1, 2, 1, 4);
    fill(strip(p, 624, 244), i === 0 ? T.house : T.cottage, 4, 3, 1, 4);
  }

  /* --- MARKET: stall tables of fruit in crates, shoppers out front -------- */
  for (const [i, p] of of('market').entries()) {
    const fruitA = i === 0 ? T.apple : T.orange;
    const fruitB = i === 0 ? T.strawberry : T.lemon;
    const fruitC = i === 0 ? T.grapes : T.melon;
    fill(strip(p, 0, 160), fruitA, 0, 5, 3, 4);        // crates, tightly gridded
    fill(strip(p, 170, 160), fruitB, 0, 5, 3, 4);
    const middle = strip(p, 340, 130);
    fill(slice(middle, 0, 0.48), fruitC, i === 0 ? 0 : 2, 3, 1, 4);
    fill(slice(middle, 0.52, 1), i === 0 ? T.box : T.basket, 1, 3, 1, 4);
    const row3 = strip(p, 480, 130);
    fill(slice(row3, 0, 0.55), T.trolley, 2, 3, 1, 4);
    fill(slice(row3, 0.6, 1), T.umbrella, 2, 2, 1, 4);
    fill(strip(p, 620, 130), i === 0 ? T.scooter : T.bike, 2, 4, 1, 4);
    const front = strip(p, 760, 100);
    fill(slice(front, 0, 0.7), i === 0 ? T.woman : T.farmer, 1, 4, 1, 5);
    fill(slice(front, 0.74, 1), T.cat, 1, 2, 1, 4);
  }

  /* --- PARK: a tree line, flower beds, the fountain, then the play lawn --- */
  for (const p of of('park')) {
    fill(strip(p, 0, 180), T.tree, 3, 7, 1, 6);        // the tree line up top
    const beds = strip(p, 195, 210);
    fill(slice(beds, 0, 0.3), T.flower, 0, 5, 4, 5);
    fill(slice(beds, 0.7, 1), T.tulip, 0, 5, 4, 5);
    centre(slice(beds, 0.36, 0.64), T.fountain, 3);    // the fountain, centre stage
    const seats = strip(p, 415, 130);
    fill(slice(seats, 0, 0.34), T.bench, 2, 3, 1, 4);
    fill(slice(seats, 0.66, 1), T.bench, 2, 3, 1, 4);
    fill(slice(seats, 0.4, 0.6), T.girl, 1, 2, 1, 5);
    const lawn = strip(p, 555, 165);                   // the play lawn
    fill(slice(lawn, 0, 0.42), T.daisy, 0, 8, 3, 5);
    fill(slice(lawn, 0.58, 1), T.rose, 0, 8, 3, 5);
    fill(slice(lawn, 0.44, 0.56), T.ball, 0, 2, 3, 5);
    const play = strip(p, 730, 130);
    fill(slice(play, 0, 0.28), T.palm, 3, 1, 1, 4);
    fill(slice(play, 0.32, 0.68), T.boy, 1, 4, 1, 5);
    fill(slice(play, 0.72, 1), T.palm, 3, 1, 1, 4);
    const edge = strip(p, 875, 120);
    fill(slice(edge, 0, 0.3), T.bird, 0, 5, 2, 5);
    fill(slice(edge, 0.36, 0.64), T.baby, 1, 3, 1, 5);
    fill(slice(edge, 0.7, 1), T.pigeon, 0, 5, 2, 5);
  }

  /* --- the audit: prove the layout is clean ------------------------------- */
  // Placement is tidy by construction; this is the safety net that keeps it
  // that way if the plan is ever edited. Anything on a road, out of bounds or
  // overlapping a neighbour is dropped rather than shipped.
  const roads = roadRects();
  const kept = [];
  for (const t of things) {
    const r = SIZES[t.tier];
    if (t.x - r < 0 || t.y - r < 0
      || t.x + r > CONFIG.city.width || t.y + r > CONFIG.city.height) continue;
    if (roads.some((rect) => circleHitsRect(t.x, t.y, r, rect))) continue;
    const clash = kept.some((o) => {
      const gap = r + SIZES[o.tier];
      return (t.x - o.x) ** 2 + (t.y - o.y) ** 2 < gap * gap;
    });
    if (clash) continue;
    kept.push(t);
  }
  kept.forEach((t, i) => { t.id = i; });   // ids must stay dense for the save

  /* --- specials ------------------------------------------------------------- */
  const pickFrom = (pool) => pool[(rng() * pool.length) | 0];
  const tinies = kept.filter((t) => t.tier <= 1);
  for (let i = 0; i < 3 && tinies.length; i++) pickFrom(tinies).golden = true;
  const mediums = kept.filter((t) => t.tier >= 1 && t.tier <= 2 && !t.golden);
  for (let i = 0; i < 2 && mediums.length; i++) pickFrom(mediums).magnet = true;

  // He starts on the park lawn, in the open.
  const park = of('park')[0];
  return {
    things: kept,
    start: {
      x: (park.x0 + park.x1) / 2,
      y: park.y0 + (park.y1 - park.y0) * 0.94,
    },
  };
}
