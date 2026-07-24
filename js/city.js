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
export const GEN_VERSION = 2;

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
  littleTree: { glyph: '🌲', name: 'Little tree', call: 'crunch' },
  postbox: { glyph: '📮', name: 'Postbox' },
  umbrella: { glyph: '⛱️', name: 'Sun umbrella' },

  // --- tier 3: cars and trees ---------------------------------------------
  car: { glyph: '🚗', name: 'Car', call: 'vroom' },
  taxi: { glyph: '🚕', name: 'Taxi', call: 'vroom' },
  suv: { glyph: '🚙', name: 'Jeep', call: 'vroom' },
  police: { glyph: '🚓', name: 'Police car', call: 'vroom' },
  fountain: { glyph: '⛲', name: 'Fountain', call: 'splash' },
  tree: { glyph: '🌳', name: 'Tree', call: 'crunch' },
  palm: { glyph: '🌴', name: 'Palm tree', call: 'crunch' },

  // --- tier 4: homes and big vehicles -------------------------------------
  house: { glyph: '🏠', name: 'House' },
  cottage: { glyph: '🏡', name: 'Cottage' },
  bus: { glyph: '🚌', name: 'Bus', call: 'vroom' },
  truck: { glyph: '🚚', name: 'Truck', call: 'vroom' },
  fireTruck: { glyph: '🚒', name: 'Fire truck', call: 'vroom' },
  ambulance: { glyph: '🚑', name: 'Ambulance', call: 'vroom' },

  // --- tier 5: the downtown skyline ---------------------------------------
  office: { glyph: '🏢', name: 'Office' },
  shop: { glyph: '🏬', name: 'Shop' },
  bank: { glyph: '🏦', name: 'Bank' },
  hotel: { glyph: '🏨', name: 'Hotel' },
  church: { glyph: '⛪', name: 'Church' },
  school: { glyph: '🏫', name: 'School' },
  hospital: { glyph: '🏥', name: 'Hospital' },
  factory: { glyph: '🏭', name: 'Factory' },
  castle: { glyph: '🏰', name: 'Castle', call: 'magic' },

  // --- tier 6: the one landmark -------------------------------------------
  stadium: { glyph: '🏟️', name: 'Stadium', call: 'magic' },
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

/**
 * The city blocks, as fractions of the city — the ground renderer draws each
 * as a pale paved (or lawn) panel, which is what makes the map read as real
 * blocks between real roads rather than things floating in space.
 */
export const PANELS = [
  { x0: 0.05, y0: 0.075, x1: 0.95, y1: 0.225, kind: 'pavement' }, // downtown
  { x0: 0.05, y0: 0.265, x1: 0.95, y1: 0.425, kind: 'asphalt' },  // the parking streets
  { x0: 0.05, y0: 0.455, x1: 0.95, y1: 0.605, kind: 'pavement' }, // the little houses
  { x0: 0.05, y0: 0.635, x1: 0.95, y1: 0.785, kind: 'pavement' }, // the market
  { x0: 0.03, y0: 0.815, x1: 0.97, y1: 0.985, kind: 'lawn' },     // the park
];

/* --- generation -------------------------------------------------------------- */

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
  const W = CONFIG.city.width;
  const H = CONFIG.city.height;
  const things = [];

  const jit = (amount = 14) => (rng() * 2 - 1) * amount;
  const add = (entry, tier, district, x, y) => {
    things.push({ id: things.length, entry, tier, district, x, y, golden: false, magnet: false });
  };
  /** A straight rank of the same thing — the "army". `sag` bows it gently. */
  const row = (entry, tier, district, cx, cy, n, spacing, sag = 0) => {
    const x0 = cx - ((n - 1) / 2) * spacing;
    for (let i = 0; i < n; i++) {
      const bow = Math.sin((i / Math.max(1, n - 1)) * Math.PI) * sag;
      add(entry, tier, district, x0 + i * spacing + jit(8), cy - bow + jit(8));
    }
  };
  /** A loose bunch. */
  const cluster = (entry, tier, district, cx, cy, n, radius) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.8;
      const d = radius * (0.35 + rng() * 0.65);
      add(entry, tier, district, cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    }
  };
  /**
   * A tidy aligned block — cols × rows of the same thing on a clean grid,
   * centred on (cx, cy). This is what makes a district read as ORGANIZED: a
   * proper flower field, a car park in neat bays, a downtown grid of towers.
   */
  const grid = (entry, tier, district, cx, cy, cols, rows, dx, dy) => {
    const x0 = cx - ((cols - 1) / 2) * dx;
    const y0 = cy - ((rows - 1) / 2) * dy;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        add(entry, tier, district, x0 + c * dx + jit(6), y0 + r * dy + jit(6));
      }
    }
  };

  /* --- PARK (bottom): where a small hole begins ---------------------------- */
  // A proper flower field in tidy beds, plus playthings and park life.
  grid(T.flower, 0, 'park', W * 0.28, H * 0.9, 4, 3, W * 0.07, H * 0.028);
  grid(T.tulip, 0, 'park', W * 0.72, H * 0.9, 4, 3, W * 0.07, H * 0.028);
  grid(T.daisy, 0, 'park', W * 0.5, H * 0.965, 5, 2, W * 0.075, H * 0.022);
  cluster(T.rose, 0, 'park', W * 0.14, H * 0.955, 4, 90);
  cluster(T.hibiscus, 0, 'park', W * 0.86, H * 0.955, 4, 90);
  row(T.ball, 0, 'park', W * 0.5, H * 0.84, 3, W * 0.08);
  cluster(T.bird, 0, 'park', W * 0.2, H * 0.86, 3, 100);
  cluster(T.pigeon, 0, 'park', W * 0.8, H * 0.86, 3, 100);
  add(T.boy, 1, 'park', W * 0.34, H * 0.87);
  add(T.girl, 1, 'park', W * 0.66, H * 0.87);
  add(T.baby, 1, 'park', W * 0.5, H * 0.885);
  add(T.dog, 1, 'park', W * 0.42, H * 0.945);
  row(T.bench, 2, 'park', W * 0.22, H * 0.9, 2, H * 0.05);
  row(T.bench, 2, 'park', W * 0.78, H * 0.9, 2, H * 0.05);
  add(T.tree, 3, 'park', W * 0.08, H * 0.86);
  add(T.tree, 3, 'park', W * 0.92, H * 0.86);
  add(T.palm, 3, 'park', W * 0.1, H * 0.96);
  add(T.palm, 3, 'park', W * 0.9, H * 0.96);
  add(T.fountain, 3, 'park', W * 0.5, H * 0.915);

  /* --- MARKET: fruit by the stallful --------------------------------------- */
  // Three stalls, each a tidy crate of fruit with a keeper — see drawGround,
  // which paints an awning + table under each of these three centres.
  grid(T.apple, 0, 'market', W * 0.2, H * 0.66, 3, 3, W * 0.045, H * 0.02);
  grid(T.orange, 0, 'market', W * 0.5, H * 0.66, 3, 3, W * 0.045, H * 0.02);
  grid(T.strawberry, 0, 'market', W * 0.8, H * 0.66, 3, 3, W * 0.045, H * 0.02);
  cluster(T.grapes, 0, 'market', W * 0.35, H * 0.72, 3, 70);
  cluster(T.lemon, 0, 'market', W * 0.65, H * 0.72, 3, 70);
  row(T.box, 1, 'market', W * 0.24, H * 0.75, 4, W * 0.06);
  row(T.basket, 1, 'market', W * 0.76, H * 0.75, 4, W * 0.06);
  row(T.trolley, 2, 'market', W * 0.5, H * 0.775, 4, W * 0.08);
  row(T.melon, 2, 'market', W * 0.16, H * 0.7, 2, W * 0.06);
  row(T.umbrella, 2, 'market', W * 0.84, H * 0.7, 2, W * 0.06);
  add(T.scooter, 2, 'market', W * 0.09, H * 0.78);
  add(T.scooter, 2, 'market', W * 0.91, H * 0.78);
  add(T.cat, 1, 'market', W * 0.4, H * 0.7);
  add(T.cat, 1, 'market', W * 0.6, H * 0.7);
  add(T.woman, 1, 'market', W * 0.28, H * 0.63);
  add(T.woman, 1, 'market', W * 0.72, H * 0.63);
  add(T.farmer, 1, 'market', W * 0.5, H * 0.63);

  /* --- LITTLE HOUSES: a tidy suburban grid --------------------------------- */
  grid(T.house, 4, 'houses', W * 0.5, H * 0.5, 3, 2, W * 0.26, H * 0.08);
  grid(T.cottage, 4, 'houses', W * 0.5, H * 0.54, 2, 1, W * 0.52, 0);
  // Front-garden flowers and a lined path of little trees.
  row(T.littleTree, 2, 'houses', W * 0.5, H * 0.47, 5, W * 0.12);
  row(T.littleTree, 2, 'houses', W * 0.5, H * 0.58, 5, W * 0.12);
  cluster(T.tulip, 0, 'houses', W * 0.16, H * 0.5, 4, 70);
  cluster(T.flower, 0, 'houses', W * 0.84, H * 0.5, 4, 70);
  add(T.postbox, 2, 'houses', W * 0.26, H * 0.55);
  add(T.postbox, 2, 'houses', W * 0.74, H * 0.55);
  add(T.dog, 1, 'houses', W * 0.4, H * 0.56);
  add(T.dog, 1, 'houses', W * 0.6, H * 0.48);
  add(T.man, 1, 'houses', W * 0.34, H * 0.52);
  add(T.woman, 1, 'houses', W * 0.66, H * 0.52);
  add(T.bike, 2, 'houses', W * 0.12, H * 0.55);
  add(T.bike, 2, 'houses', W * 0.88, H * 0.55);
  add(T.suv, 3, 'houses', W * 0.1, H * 0.48);
  add(T.police, 3, 'houses', W * 0.9, H * 0.48);

  /* --- BUSY STREETS: a full car park and busy pavements -------------------- */
  // Two neat ranks of cars and taxis in painted bays (drawGround lines them).
  grid(T.car, 3, 'streets', W * 0.28, H * 0.31, 3, 2, W * 0.1, H * 0.045);
  grid(T.taxi, 3, 'streets', W * 0.72, H * 0.31, 3, 2, W * 0.1, H * 0.045);
  row(T.suv, 3, 'streets', W * 0.5, H * 0.29, 2, W * 0.12);
  row(T.bus, 4, 'streets', W * 0.3, H * 0.4, 2, W * 0.24);
  row(T.truck, 4, 'streets', W * 0.72, H * 0.4, 2, W * 0.2);
  add(T.fireTruck, 4, 'streets', W * 0.4, H * 0.37);
  add(T.ambulance, 4, 'streets', W * 0.6, H * 0.37);
  row(T.light, 1, 'streets', W * 0.5, H * 0.258, 5, W * 0.17);
  row(T.barrier, 1, 'streets', W * 0.4, H * 0.42, 3, W * 0.06);
  row(T.hydrant, 1, 'streets', W * 0.72, H * 0.42, 2, W * 0.08);
  add(T.builder, 1, 'streets', W * 0.34, H * 0.42);
  add(T.builder, 1, 'streets', W * 0.5, H * 0.43);
  add(T.walker, 1, 'streets', W * 0.12, H * 0.34);
  add(T.walker, 1, 'streets', W * 0.88, H * 0.34);
  add(T.jogger, 1, 'streets', W * 0.16, H * 0.4);
  add(T.jogger, 1, 'streets', W * 0.84, H * 0.4);
  add(T.officer, 1, 'streets', W * 0.5, H * 0.34);

  /* --- DOWNTOWN: a grid of towers ------------------------------------------ */
  grid(T.office, 5, 'downtown', W * 0.5, H * 0.13, 3, 2, W * 0.28, H * 0.06);
  add(T.bank, 5, 'downtown', W * 0.22, H * 0.2);
  add(T.hotel, 5, 'downtown', W * 0.5, H * 0.2);
  add(T.hospital, 5, 'downtown', W * 0.78, H * 0.2);
  add(T.shop, 5, 'downtown', W * 0.28, H * 0.09);
  add(T.church, 5, 'downtown', W * 0.72, H * 0.09);
  add(T.school, 5, 'downtown', W * 0.5, H * 0.16);
  add(T.factory, 5, 'downtown', W * 0.12, H * 0.14);
  add(T.castle, 5, 'downtown', W * 0.88, H * 0.14);

  /* --- THE STADIUM: the last bite of all ----------------------------------- */
  add(T.stadium, 6, null, W * 0.5, H * 0.045);

  /* --- specials ------------------------------------------------------------- */
  const pickFrom = (pool) => pool[(rng() * pool.length) | 0];
  const tinies = things.filter((t) => t.tier <= 1);
  for (let i = 0; i < 3; i++) {
    const t = pickFrom(tinies);
    if (!t.golden) t.golden = true;
  }
  const mediums = things.filter((t) => t.tier >= 1 && t.tier <= 2 && !t.golden);
  for (let i = 0; i < 2; i++) {
    const t = pickFrom(mediums);
    if (!t.magnet) t.magnet = true;
  }

  return {
    things,
    start: { x: W * 0.5, y: H * 0.9 },
  };
}
