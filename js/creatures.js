/* ---------------------------------------------------------------------------
   The cast.

   `glyph` is currently an emoji drawn straight onto the canvas — no image files,
   nothing to download, full colour on both Android and iOS. If you later want
   real illustrations, swap `glyph` for an `img` field and change the one
   drawing call in creaturePop.js and bubble.js. Nothing else depends on it.

   `weight`   relative chance of appearing (higher = more often)
   `unlockAt` how many pops before this one can show up. Nothing gets harder as
              he plays — it just gets more varied, which is the good half of
              difficulty without any of the frustration. Total pops are saved
              between sessions, so the big numbers at the bottom are goals that
              take days of play to reach — and stay unlocked once they arrive.
   `call`     which synthesized sound in audio.js this creature makes when its
              bubble pops
   `themes`   optional per-sky weight multipliers, so the night sky fills with
              owls and the sea sky with dolphins. Skies are tagged in
              background.js.
   --------------------------------------------------------------------------- */

export const CREATURES = [
  // --- farm and friendly: available from the very first bubble ---------------
  { glyph: '🐶', name: 'Dog',       weight: 10, unlockAt: 0,  call: 'woof' },
  { glyph: '🐱', name: 'Cat',       weight: 10, unlockAt: 0,  call: 'meow' },
  { glyph: '🐮', name: 'Cow',       weight: 10, unlockAt: 0,  call: 'moo' },
  { glyph: '🐷', name: 'Pig',       weight: 10, unlockAt: 0,  call: 'oink' },
  { glyph: '🐸', name: 'Frog',      weight: 10, unlockAt: 0,  call: 'ribbit', themes: { sea: 2 } },
  { glyph: '🐰', name: 'Bunny',     weight: 10, unlockAt: 0,  call: 'squeak', themes: { snow: 2 } },
  { glyph: '🐥', name: 'Chick',     weight:  9, unlockAt: 0,  call: 'tweet' },
  { glyph: '🐵', name: 'Monkey',    weight:  9, unlockAt: 0,  call: 'monkey', themes: { jungle: 3 } },
  { glyph: '🦆', name: 'Duck',      weight:  8, unlockAt: 0,  call: 'quack',  themes: { sea: 2 } },
  { glyph: '🐑', name: 'Sheep',     weight:  8, unlockAt: 0,  call: 'baa' },
  { glyph: '🐴', name: 'Horse',     weight:  8, unlockAt: 0,  call: 'neigh' },
  { glyph: '🐝', name: 'Bee',       weight:  6, unlockAt: 0,  call: 'buzz',   themes: { day: 2 } },

  // --- dinosaurs: the headline act, so they arrive early --------------------
  { glyph: '🦕', name: 'Dino',      weight:  9, unlockAt: 2,  call: 'bigroar', themes: { jungle: 2 } },
  { glyph: '🦖', name: 'T Rex',     weight:  8, unlockAt: 4,  call: 'bigroar', themes: { jungle: 2 } },
  { glyph: '🐊', name: 'Crocodile', weight:  5, unlockAt: 10, call: 'roar',    themes: { jungle: 2 } },
  { glyph: '🦎', name: 'Lizard',    weight:  4, unlockAt: 14, call: 'hiss',    themes: { jungle: 2 } },

  // --- the zoo: unlocks over the first minute or so -------------------------
  { glyph: '🦁', name: 'Lion',      weight:  9, unlockAt: 3,  call: 'roar' },
  { glyph: '🐯', name: 'Tiger',     weight:  8, unlockAt: 3,  call: 'roar',    themes: { jungle: 3 } },
  { glyph: '🐘', name: 'Elephant',  weight:  8, unlockAt: 5,  call: 'trumpet' },
  { glyph: '🐧', name: 'Penguin',   weight:  7, unlockAt: 5,  call: 'quack',   themes: { snow: 4 } },
  { glyph: '🐢', name: 'Turtle',    weight:  7, unlockAt: 8,  call: 'splash',  themes: { sea: 3 } },
  { glyph: '🦒', name: 'Giraffe',   weight:  7, unlockAt: 8,  call: 'squeak' },
  { glyph: '🐻', name: 'Bear',      weight:  7, unlockAt: 10, call: 'roar',    themes: { snow: 2 } },
  { glyph: '🦓', name: 'Zebra',     weight:  6, unlockAt: 10, call: 'neigh' },
  { glyph: '🐼', name: 'Panda',     weight:  6, unlockAt: 12, call: 'squeak' },
  { glyph: '🦊', name: 'Fox',       weight:  6, unlockAt: 12, call: 'yip',     themes: { night: 3 } },
  { glyph: '🐬', name: 'Dolphin',   weight:  5, unlockAt: 15, call: 'dolphin', themes: { sea: 4 } },
  { glyph: '🦋', name: 'Butterfly', weight:  5, unlockAt: 15, call: 'magic',   themes: { day: 2, jungle: 2 } },
  { glyph: '🦉', name: 'Owl',       weight:  5, unlockAt: 18, call: 'hoot',    themes: { night: 4 } },
  { glyph: '🐙', name: 'Octopus',   weight:  4, unlockAt: 20, call: 'splash',  themes: { sea: 4 } },
  { glyph: '🦈', name: 'Shark',     weight:  4, unlockAt: 22, call: 'splash',  themes: { sea: 4 } },

  // --- rare and magical: worth staying for ----------------------------------
  { glyph: '🦄', name: 'Unicorn',   weight:  2, unlockAt: 25, call: 'magic',   themes: { candy: 3, space: 2 } },
  { glyph: '🐉', name: 'Dragon',    weight:  2, unlockAt: 30, call: 'bigroar', themes: { space: 2 } },

  // --- the long game: these take days of saved-up popping to meet -----------
  { glyph: '🐨', name: 'Koala',     weight:  5, unlockAt: 60,  call: 'squeak' },
  { glyph: '🦜', name: 'Parrot',    weight:  5, unlockAt: 80,  call: 'tweet',  themes: { jungle: 4 } },
  { glyph: '🐳', name: 'Whale',     weight:  4, unlockAt: 100, call: 'splash', themes: { sea: 4 } },
  { glyph: '🦩', name: 'Flamingo',  weight:  4, unlockAt: 130, call: 'tweet' },
  { glyph: '🐫', name: 'Camel',     weight:  3, unlockAt: 160, call: 'neigh' },
  { glyph: '🦔', name: 'Hedgehog',  weight:  3, unlockAt: 200, call: 'squeak', themes: { night: 2 } },
  { glyph: '🐿️', name: 'Squirrel',  weight:  3, unlockAt: 250, call: 'squeak' },
  { glyph: '🦚', name: 'Peacock',   weight:  2, unlockAt: 320, call: 'tweet',  themes: { candy: 2 } },
  { glyph: '🦭', name: 'Seal',      weight:  2, unlockAt: 400, call: 'splash', themes: { sea: 3, snow: 3 } },
  { glyph: '🐲', name: 'Baby Dragon', weight: 2, unlockAt: 500, call: 'magic', themes: { space: 3 } },
];

/** Praise for passing a level. `%s` becomes his name if one is configured. */
export const BIG_CHEERS = [
  'You did it%s! You win!',
  'Amazing%s! You win!',
  'Wow%s! You are the best!',
  'Fantastic%s! You win!',
  'Hooray%s! You win!',
];

/** Praise for passing a milestone level. */
export const MEGA_CHEERS = [
  'Champion%s!',
  'You are a super star%s!',
  'Incredible%s! You are the champion!',
];

/* --- weighted selection ----------------------------------------------------- */

// Recomputed only when the unlocked set or the sky actually changes, not
// every spawn.
let cacheKey = '';
let cachePool = [];
let cacheWeights = [];
let cacheTotal = 0;

/**
 * Picks a creature that has unlocked at the current score, weighted by rarity
 * — with the current sky's theme leaning on the scales, so a night level
 * fills with owls and a sea level with dolphins.
 * @param {number} score total bubbles ever popped
 * @param {string} [theme] the current sky's theme tag from background.js
 */
export function pickCreature(score, theme = 'day') {
  const key = `${score}|${theme}`;
  if (key !== cacheKey) {
    cachePool = CREATURES.filter((c) => c.unlockAt <= score);
    cacheWeights = cachePool.map((c) => c.weight * (c.themes?.[theme] ?? 1));
    cacheTotal = cacheWeights.reduce((sum, w) => sum + w, 0);
    cacheKey = key;
  }

  let roll = Math.random() * cacheTotal;
  for (let i = 0; i < cachePool.length; i++) {
    roll -= cacheWeights[i];
    if (roll <= 0) return cachePool[i];
  }
  return cachePool[cachePool.length - 1] ?? CREATURES[0];
}
