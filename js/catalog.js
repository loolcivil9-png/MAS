/* ---------------------------------------------------------------------------
   Everything the hole can eat, one little world per sky.

   The 9 sky palettes in background.js each carry a theme tag; the tag picks
   the set here, so when the sky changes on a level-up the *contents* of the
   world change with it — the snow world is full of snowmen, the space world
   of rockets. Everything is an emoji: no image files, nothing to download,
   full colour on both Android and iOS.

   One entry: { glyph, name, call?, runner? }
     `call`    a recipe name in audio.js — what the thing sounds like when it
               goes down the hole (on top of the gulp). Omit for silence.
     `runner`  true → it scoots away from the hole. Always slower than the
               hole, so the chase is funny rather than frustrating.

   Tiers t1..t4 go from tiny to huge; `landmark` is the one giant centrepiece
   that only fits once everything else has been eaten.
   --------------------------------------------------------------------------- */

import { pick } from './util.js';

export const SETS = {
  day: {
    t1: [
      { glyph: '🌸', name: 'Flower' },
      { glyph: '🍓', name: 'Strawberry' },
      { glyph: '🍎', name: 'Apple' },
      { glyph: '⚽', name: 'Ball', call: 'boing' },
      { glyph: '🐞', name: 'Ladybug', runner: true },
    ],
    t2: [
      { glyph: '🎁', name: 'Present' },
      { glyph: '🧸', name: 'Teddy', call: 'squeak' },
      { glyph: '🛴', name: 'Scooter' },
      { glyph: '🐤', name: 'Chick', call: 'tweet', runner: true },
    ],
    t3: [
      { glyph: '🚗', name: 'Car', call: 'vroom' },
      { glyph: '🌳', name: 'Tree', call: 'crunch' },
      { glyph: '⛲', name: 'Fountain', call: 'splash' },
    ],
    t4: [
      { glyph: '🏠', name: 'House' },
      { glyph: '🚌', name: 'Bus', call: 'vroom' },
    ],
    landmark: [
      { glyph: '🏰', name: 'Castle', call: 'magic' },
      { glyph: '🎡', name: 'Ferris wheel', call: 'magic' },
    ],
  },

  sunset: {
    t1: [
      { glyph: '🍊', name: 'Orange' },
      { glyph: '🌻', name: 'Sunflower' },
      { glyph: '🦋', name: 'Butterfly', call: 'magic', runner: true },
      { glyph: '🍇', name: 'Grapes' },
    ],
    t2: [
      { glyph: '🪁', name: 'Kite' },
      { glyph: '🛵', name: 'Scooter', call: 'vroom' },
      { glyph: '🍉', name: 'Watermelon', call: 'crunch' },
    ],
    t3: [
      { glyph: '🚕', name: 'Taxi', call: 'vroom' },
      { glyph: '🌴', name: 'Palm tree', call: 'crunch' },
      { glyph: '🛺', name: 'Tuk tuk', call: 'vroom' },
    ],
    t4: [
      { glyph: '🏡', name: 'Cottage' },
      { glyph: '🚚', name: 'Truck', call: 'vroom' },
    ],
    landmark: [
      { glyph: '🗼', name: 'Tower', call: 'magic' },
    ],
  },

  night: {
    t1: [
      { glyph: '⭐', name: 'Star', call: 'magic' },
      { glyph: '🍪', name: 'Cookie', call: 'crunch' },
      { glyph: '🐭', name: 'Mouse', call: 'squeak', runner: true },
    ],
    t2: [
      { glyph: '🏮', name: 'Lantern' },
      { glyph: '🦉', name: 'Owl', call: 'hoot', runner: true },
      { glyph: '🍩', name: 'Doughnut' },
    ],
    t3: [
      { glyph: '🚙', name: 'Car', call: 'vroom' },
      { glyph: '🛏️', name: 'Bed' },
      { glyph: '🍄', name: 'Mushroom' },
    ],
    t4: [
      { glyph: '🏘️', name: 'Houses' },
      { glyph: '🚒', name: 'Fire truck', call: 'vroom' },
    ],
    landmark: [
      { glyph: '🎡', name: 'Ferris wheel', call: 'magic' },
    ],
  },

  sea: {
    t1: [
      { glyph: '🐚', name: 'Shell' },
      { glyph: '🐠', name: 'Fish', call: 'splash', runner: true },
      { glyph: '🦀', name: 'Crab', call: 'splash', runner: true },
      { glyph: '🍧', name: 'Ice treat' },
    ],
    t2: [
      { glyph: '⛱️', name: 'Umbrella' },
      { glyph: '🐢', name: 'Turtle', call: 'splash', runner: true },
      { glyph: '🍦', name: 'Ice cream' },
    ],
    t3: [
      { glyph: '⛵', name: 'Sailboat', call: 'splash' },
      { glyph: '🪸', name: 'Coral' },
      { glyph: '🛶', name: 'Canoe', call: 'splash' },
    ],
    t4: [
      { glyph: '🚤', name: 'Speedboat', call: 'vroom' },
      { glyph: '🗿', name: 'Statue' },
    ],
    landmark: [
      { glyph: '🚢', name: 'Big ship', call: 'splash' },
    ],
  },

  candy: {
    t1: [
      { glyph: '🍬', name: 'Candy' },
      { glyph: '🍭', name: 'Lollipop' },
      { glyph: '🧁', name: 'Cupcake' },
      { glyph: '🍒', name: 'Cherry' },
    ],
    t2: [
      { glyph: '🍩', name: 'Doughnut' },
      { glyph: '🍪', name: 'Cookie', call: 'crunch' },
      { glyph: '🍫', name: 'Chocolate' },
    ],
    t3: [
      { glyph: '🎂', name: 'Cake' },
      { glyph: '🍦', name: 'Ice cream' },
      { glyph: '🥧', name: 'Pie' },
    ],
    t4: [
      { glyph: '🏪', name: 'Sweet shop' },
      { glyph: '🎠', name: 'Carousel', call: 'magic' },
    ],
    landmark: [
      { glyph: '🎪', name: 'Circus tent', call: 'magic' },
    ],
  },

  space: {
    t1: [
      { glyph: '⭐', name: 'Star', call: 'magic' },
      { glyph: '☄️', name: 'Comet', call: 'whoosh' },
      { glyph: '👾', name: 'Alien', call: 'squeak', runner: true },
      { glyph: '🌟', name: 'Sparkly star', call: 'magic' },
    ],
    t2: [
      { glyph: '🛰️', name: 'Satellite' },
      { glyph: '📡', name: 'Space dish' },
      { glyph: '🤖', name: 'Robot', call: 'boing', runner: true },
    ],
    t3: [
      { glyph: '🛸', name: 'Flying saucer', call: 'whoosh' },
      { glyph: '🌙', name: 'Moon', call: 'magic' },
    ],
    t4: [
      { glyph: '🚀', name: 'Rocket', call: 'whoosh' },
    ],
    landmark: [
      { glyph: '🪐', name: 'Planet', call: 'magic' },
    ],
  },

  snow: {
    t1: [
      { glyph: '❄️', name: 'Snowflake' },
      { glyph: '🧊', name: 'Ice cube' },
      { glyph: '🐧', name: 'Penguin', call: 'quack', runner: true },
    ],
    t2: [
      { glyph: '🎿', name: 'Skis' },
      { glyph: '🛷', name: 'Sled' },
      { glyph: '🧣', name: 'Scarf' },
    ],
    t3: [
      { glyph: '⛄', name: 'Snowman', call: 'magic' },
      { glyph: '🌲', name: 'Pine tree', call: 'crunch' },
    ],
    t4: [
      { glyph: '🛖', name: 'Cabin' },
      { glyph: '🚜', name: 'Snowplow', call: 'vroom' },
    ],
    landmark: [
      { glyph: '🏰', name: 'Ice castle', call: 'magic' },
    ],
  },

  jungle: {
    t1: [
      { glyph: '🌺', name: 'Flower' },
      { glyph: '🍌', name: 'Banana' },
      { glyph: '🐸', name: 'Frog', call: 'ribbit', runner: true },
      { glyph: '🦋', name: 'Butterfly', call: 'magic', runner: true },
    ],
    t2: [
      { glyph: '🥥', name: 'Coconut', call: 'crunch' },
      { glyph: '🦜', name: 'Parrot', call: 'tweet', runner: true },
      { glyph: '🍍', name: 'Pineapple' },
    ],
    t3: [
      { glyph: '🌴', name: 'Palm tree', call: 'crunch' },
      { glyph: '🐒', name: 'Monkey', call: 'monkey', runner: true },
      { glyph: '🛶', name: 'Canoe', call: 'splash' },
    ],
    t4: [
      { glyph: '🗿', name: 'Stone head' },
      { glyph: '🌳', name: 'Big tree', call: 'crunch' },
    ],
    landmark: [
      { glyph: '🛕', name: 'Temple', call: 'magic' },
    ],
  },
};

/** Praise for finishing a world. `%s` becomes his name if one is configured. */
export const BIG_CHEERS = [
  'You did it%s! You win!',
  'Amazing%s! You win!',
  'Wow%s! You are the best!',
  'Fantastic%s! You win!',
  'Hooray%s! You win!',
];

/** Praise for finishing a milestone world. */
export const MEGA_CHEERS = [
  'Champion%s!',
  'You are a super star%s!',
  'Incredible%s! You are the champion!',
];

const TIER_KEYS = ['t1', 't2', 't3', 't4', 'landmark'];

/**
 * Builds the contents of one level: `counts[i]` things of each tier, drawn
 * from the theme's set (repeats are expected — a meadow has many flowers).
 * @param {string} theme a tag from background.js ('day', 'sea', 'space', …)
 * @param {number[]} counts things per tier, e.g. [12, 8, 6, 3, 1]
 * @returns {{entry: object, tier: number}[]}
 */
export function buildLevelList(theme, counts) {
  const set = SETS[theme] ?? SETS.day;
  const list = [];
  for (let tier = 0; tier < TIER_KEYS.length; tier++) {
    const options = set[TIER_KEYS[tier]];
    for (let i = 0; i < (counts[tier] ?? 0); i++) {
      list.push({ entry: pick(options), tier });
    }
  }
  return list;
}

/** How many different things exist across all the worlds — for the menu stats. */
export const TOTAL_KINDS = (() => {
  const names = new Set();
  for (const set of Object.values(SETS)) {
    for (const key of TIER_KEYS) for (const e of set[key]) names.add(e.name);
  }
  return names.size;
})();
