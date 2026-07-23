/* ---------------------------------------------------------------------------
   The cast.

   `glyph` is currently an emoji drawn straight onto the canvas — no image files,
   nothing to download, full colour on both Android and iOS. If you later want
   real illustrations, swap `glyph` for an `img` field and change the one
   drawing call in creaturePop.js and bubble.js. Nothing else depends on it.

   `weight`   relative chance of appearing (higher = more often)
   `unlockAt` how many pops before this one can show up. Nothing gets harder as
              he plays — it just gets more varied, which is the good half of
              difficulty without any of the frustration.
   --------------------------------------------------------------------------- */

export const CREATURES = [
  // --- farm and friendly: available from the very first bubble ---------------
  { glyph: '🐶', name: 'Dog',       weight: 10, unlockAt: 0 },
  { glyph: '🐱', name: 'Cat',       weight: 10, unlockAt: 0 },
  { glyph: '🐮', name: 'Cow',       weight: 10, unlockAt: 0 },
  { glyph: '🐷', name: 'Pig',       weight: 10, unlockAt: 0 },
  { glyph: '🐸', name: 'Frog',      weight: 10, unlockAt: 0 },
  { glyph: '🐰', name: 'Bunny',     weight: 10, unlockAt: 0 },
  { glyph: '🐥', name: 'Chick',     weight:  9, unlockAt: 0 },
  { glyph: '🐵', name: 'Monkey',    weight:  9, unlockAt: 0 },
  { glyph: '🦆', name: 'Duck',      weight:  8, unlockAt: 0 },
  { glyph: '🐑', name: 'Sheep',     weight:  8, unlockAt: 0 },
  { glyph: '🐴', name: 'Horse',     weight:  8, unlockAt: 0 },
  { glyph: '🐝', name: 'Bee',       weight:  6, unlockAt: 0 },

  // --- dinosaurs: the headline act, so they arrive early --------------------
  { glyph: '🦕', name: 'Dino',      weight:  9, unlockAt: 2 },
  { glyph: '🦖', name: 'T Rex',     weight:  8, unlockAt: 4 },
  { glyph: '🐊', name: 'Crocodile', weight:  5, unlockAt: 10 },
  { glyph: '🦎', name: 'Lizard',    weight:  4, unlockAt: 14 },

  // --- the zoo: unlocks over the first minute or so -------------------------
  { glyph: '🦁', name: 'Lion',      weight:  9, unlockAt: 3 },
  { glyph: '🐯', name: 'Tiger',     weight:  8, unlockAt: 3 },
  { glyph: '🐘', name: 'Elephant',  weight:  8, unlockAt: 5 },
  { glyph: '🐧', name: 'Penguin',   weight:  7, unlockAt: 5 },
  { glyph: '🐢', name: 'Turtle',    weight:  7, unlockAt: 8 },
  { glyph: '🦒', name: 'Giraffe',   weight:  7, unlockAt: 8 },
  { glyph: '🐻', name: 'Bear',      weight:  7, unlockAt: 10 },
  { glyph: '🦓', name: 'Zebra',     weight:  6, unlockAt: 10 },
  { glyph: '🐼', name: 'Panda',     weight:  6, unlockAt: 12 },
  { glyph: '🦊', name: 'Fox',       weight:  6, unlockAt: 12 },
  { glyph: '🐬', name: 'Dolphin',   weight:  5, unlockAt: 15 },
  { glyph: '🦋', name: 'Butterfly', weight:  5, unlockAt: 15 },
  { glyph: '🦉', name: 'Owl',       weight:  5, unlockAt: 18 },
  { glyph: '🐙', name: 'Octopus',   weight:  4, unlockAt: 20 },
  { glyph: '🦈', name: 'Shark',     weight:  4, unlockAt: 22 },

  // --- rare and magical: worth staying for ----------------------------------
  { glyph: '🦄', name: 'Unicorn',   weight:  2, unlockAt: 25 },
  { glyph: '🐉', name: 'Dragon',    weight:  2, unlockAt: 30 },
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

// Recomputed only when the unlocked set actually changes, not every spawn.
let cacheScore = -1;
let cachePool = [];
let cacheTotal = 0;

/**
 * Picks a creature that has unlocked at the current score, weighted by rarity.
 * @param {number} score how many bubbles have been popped this session
 */
export function pickCreature(score) {
  if (score !== cacheScore) {
    cachePool = CREATURES.filter((c) => c.unlockAt <= score);
    cacheTotal = cachePool.reduce((sum, c) => sum + c.weight, 0);
    cacheScore = score;
  }

  let roll = Math.random() * cacheTotal;
  for (let i = 0; i < cachePool.length; i++) {
    roll -= cachePool[i].weight;
    if (roll <= 0) return cachePool[i];
  }
  return cachePool[cachePool.length - 1] ?? CREATURES[0];
}
