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
  flower: { glyph: '🌸', name: 'Flower' },
  tulip: { glyph: '🌷', name: 'Tulip' },
  daisy: { glyph: '🌼', name: 'Daisy' },
  apple: { glyph: '🍎', name: 'Apple' },
  orange: { glyph: '🍊', name: 'Orange' },
  strawberry: { glyph: '🍓', name: 'Strawberry' },
  ball: { glyph: '⚽', name: 'Ball', call: 'boing' },
  bird: { glyph: '🐦', name: 'Bird', call: 'tweet', runner: true },

  box: { glyph: '📦', name: 'Box' },
  basket: { glyph: '🧺', name: 'Basket' },
  light: { glyph: '🚦', name: 'Traffic light' },
  barrier: { glyph: '🚧', name: 'Barrier' },
  dog: { glyph: '🐕', name: 'Dog', call: 'woof', runner: true },
  cat: { glyph: '🐈', name: 'Cat', call: 'meow', runner: true },

  chair: { glyph: '🪑', name: 'Chair' },
  trolley: { glyph: '🛒', name: 'Trolley' },
  scooter: { glyph: '🛵', name: 'Scooter', call: 'vroom' },
  melon: { glyph: '🍉', name: 'Watermelon', call: 'crunch' },
  littleTree: { glyph: '🌲', name: 'Little tree', call: 'crunch' },
  postbox: { glyph: '📮', name: 'Postbox' },

  car: { glyph: '🚗', name: 'Car', call: 'vroom' },
  taxi: { glyph: '🚕', name: 'Taxi', call: 'vroom' },
  fountain: { glyph: '⛲', name: 'Fountain', call: 'splash' },
  tree: { glyph: '🌳', name: 'Tree', call: 'crunch' },

  house: { glyph: '🏠', name: 'House' },
  cottage: { glyph: '🏡', name: 'Cottage' },
  bus: { glyph: '🚌', name: 'Bus', call: 'vroom' },
  truck: { glyph: '🚚', name: 'Truck', call: 'vroom' },
  fireTruck: { glyph: '🚒', name: 'Fire truck', call: 'vroom' },

  office: { glyph: '🏢', name: 'Office' },
  shop: { glyph: '🏬', name: 'Shop' },
  bank: { glyph: '🏦', name: 'Bank' },
  hotel: { glyph: '🏨', name: 'Hotel' },
  church: { glyph: '⛪', name: 'Church' },
  school: { glyph: '🏫', name: 'School' },

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

  /* --- PARK (bottom): where a small hole begins ---------------------------- */
  row(T.flower, 0, 'park', W * 0.5, H * 0.845, 7, W * 0.11, 40);
  row(T.tulip, 0, 'park', W * 0.5, H * 0.965, 7, W * 0.11, -40);
  cluster(T.daisy, 0, 'park', W * 0.2, H * 0.9, 6, 110);
  cluster(T.ball, 0, 'park', W * 0.82, H * 0.885, 3, 90);
  cluster(T.bird, 0, 'park', W * 0.62, H * 0.925, 3, 130);
  row(T.chair, 2, 'park', W * 0.24, H * 0.955, 2, 130);
  row(T.chair, 2, 'park', W * 0.78, H * 0.955, 2, 130);
  add(T.tree, 3, 'park', W * 0.09 + jit(), H * 0.86 + jit());
  add(T.tree, 3, 'park', W * 0.91 + jit(), H * 0.845 + jit());
  add(T.tree, 3, 'park', W * 0.13 + jit(), H * 0.975 + jit());
  add(T.fountain, 3, 'park', W * 0.5, H * 0.93);

  /* --- MARKET: fruit by the boxful ----------------------------------------- */
  cluster(T.apple, 0, 'market', W * 0.17, H * 0.665, 4, 80);
  cluster(T.orange, 0, 'market', W * 0.5, H * 0.655, 4, 80);
  cluster(T.strawberry, 0, 'market', W * 0.83, H * 0.665, 4, 80);
  row(T.box, 1, 'market', W * 0.32, H * 0.72, 5, W * 0.09);
  row(T.basket, 1, 'market', W * 0.72, H * 0.755, 4, W * 0.1);
  cluster(T.melon, 2, 'market', W * 0.15, H * 0.75, 3, 90);
  row(T.trolley, 2, 'market', W * 0.5, H * 0.775, 3, W * 0.1);
  add(T.scooter, 2, 'market', W * 0.88, H * 0.7 + jit());
  add(T.scooter, 2, 'market', W * 0.09, H * 0.69 + jit());
  add(T.cat, 1, 'market', W * 0.35, H * 0.675, 0);
  add(T.cat, 1, 'market', W * 0.62, H * 0.74, 0);

  /* --- LITTLE HOUSES: a tidy grid of homes --------------------------------- */
  for (const [i, hx] of [0.16, 0.5, 0.84].entries()) {
    add(i % 2 ? T.house : T.cottage, 4, 'houses', W * hx, H * 0.485 + jit());
    add(i % 2 ? T.cottage : T.house, 4, 'houses', W * hx, H * 0.575 + jit());
  }
  row(T.littleTree, 2, 'houses', W * 0.33, H * 0.53, 3, W * 0.09);
  row(T.littleTree, 2, 'houses', W * 0.67, H * 0.53, 2, W * 0.09);
  add(T.postbox, 2, 'houses', W * 0.28, H * 0.475 + jit());
  add(T.postbox, 2, 'houses', W * 0.72, H * 0.585 + jit());
  add(T.dog, 1, 'houses', W * 0.42, H * 0.56);
  add(T.dog, 1, 'houses', W * 0.58, H * 0.5);
  add(T.car, 3, 'houses', W * 0.08, H * 0.53 + jit());

  /* --- BUSY STREETS: ranks of parked traffic ------------------------------- */
  row(T.car, 3, 'streets', W * 0.26, H * 0.3, 4, W * 0.135);
  row(T.taxi, 3, 'streets', W * 0.74, H * 0.3, 4, W * 0.135);
  row(T.bus, 4, 'streets', W * 0.3, H * 0.385, 2, W * 0.26);
  row(T.truck, 4, 'streets', W * 0.74, H * 0.385, 2, W * 0.22);
  add(T.fireTruck, 4, 'streets', W * 0.5, H * 0.34 + jit());
  row(T.light, 1, 'streets', W * 0.5, H * 0.258, 5, W * 0.19);
  cluster(T.barrier, 1, 'streets', W * 0.5, H * 0.41, 4, 100);

  /* --- DOWNTOWN: the block of big buildings -------------------------------- */
  row(T.office, 5, 'downtown', W * 0.24, H * 0.125, 2, W * 0.24);
  add(T.shop, 5, 'downtown', W * 0.76 + jit(), H * 0.125 + jit());
  add(T.bank, 5, 'downtown', W * 0.18 + jit(), H * 0.205 + jit());
  add(T.hotel, 5, 'downtown', W * 0.5 + jit(), H * 0.21 + jit());
  add(T.church, 5, 'downtown', W * 0.82 + jit(), H * 0.205 + jit());
  row(T.school, 5, 'downtown', W * 0.5, H * 0.155, 1, 0);

  /* --- THE STADIUM: the last bite of all ----------------------------------- */
  add(T.stadium, 6, null, W * 0.5, H * 0.055);

  /* --- specials ------------------------------------------------------------- */
  const pickFrom = (pool) => pool[(rng() * pool.length) | 0];
  const tinies = things.filter((t) => t.tier <= 1);
  for (let i = 0; i < 2; i++) {
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
    start: { x: W * 0.5, y: H * 0.885 },
  };
}
