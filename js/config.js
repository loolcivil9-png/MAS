/* ---------------------------------------------------------------------------
   Every number worth tuning lives here.
   After you have watched him play, this is the only file you should need to
   touch to make the game slower, easier, louder or more generous.
   --------------------------------------------------------------------------- */

export const CONFIG = {
  /* Shown small at the bottom of the home screen, so you can tell at a glance
     which build is actually live after a deploy.
     BUMP THIS on every change, and bump CACHE in sw.js to match. */
  version: '1.2.0',

  /* Shown on the splash screen and used as the PWA name.
     Put his name here — e.g. "Sami's Bubble Zoo". */
  title: 'Bubble Zoo',

  /* If set, the voice says his name during the big celebrations.
     e.g. playerName: 'Sami'   →   "You did it, Sami! You win!" */
  playerName: '',

  /* --- rendering ---------------------------------------------------------- */
  render: {
    logicalHeight: 1000,   // the screen is always 1000 units tall, whatever the device
    maxDPR: 2,             // a 3x phone would cost 2.25x the pixels for no visible gain
    maxDelta: 0.05,        // seconds; stops everything teleporting after the screen locks
  },

  /* --- bubbles ------------------------------------------------------------ */
  bubble: {
    // A wide spread on both size and speed, so no two bubbles feel alike.
    minRadius: 58,         // logical units. ~94 px across on a normal phone
    maxRadius: 130,        // ~211 px across. Portrait is only ~460 wide, so going
                           // bigger than this forces bubbles to overlap
    minSpeed: 26,          // upward, logical units per second
    maxSpeed: 92,
    speedJitter: 0.26,     // ± this much on top, so size does not perfectly predict speed
    swayAmount: 30,        // how far it drifts side to side
    swaySpeedMin: 0.18,    // sway cycles per second
    swaySpeedMax: 0.70,

    minVisible: 4,         // hard floor: never fewer than this actually in view
    minOnScreen: 5,        // population is topped up to sit between these
    maxOnScreen: 6,        // (counts bubbles still climbing up from below)
    spawnInterval: 0.34,   // seconds between spawns while topping up
    placementTries: 18,    // candidate positions tested; the roomiest one wins
    separationMargin: 1.12, // aim for a visible gap, not merely "not touching"
    separationSpeed: 155,   // how firmly overlapping bubbles push each other apart
    hitScale: 1.35,        // touch radius vs. drawn radius. He does not need to be accurate
    goldenChance: 1 / 15,  // how often a golden bubble appears
    goldenWorth: 5,        // a golden bubble counts as this many bubbles toward the level
  },

  /* --- freed creatures ---------------------------------------------------- */
  creature: {
    popUpSpeedMin: 190,    // how hard it leaps out of the popped bubble
    popUpSpeedMax: 330,
    sideSpeed: 130,
    gravity: 900,
    bounce: 0.55,          // energy kept per bounce
    maxBounces: 2,
    lifetime: 2.4,         // seconds before it drifts away
    fadeTime: 0.55,
  },

  /* --- levels and celebrations -------------------------------------------- */
  /* The trophy is now the LEVEL, and nothing else in the game earns one.
     Between levels the game stays deliberately quiet, so that when the
     fireworks do arrive they mean something. */
  celebrate: {
    bubblesPerLevel: 25,   // roughly a minute and a half of play
    starsPerLevel: 5,      // one star fills every bubblesPerLevel / starsPerLevel pops
    megaEveryLevels: 5,    // every 5th level earns the crown and the brass fanfare
  },

  /* --- sound -------------------------------------------------------------- */
  audio: {
    masterVolume: 0.55,    // deliberately conservative: this is held near his ears
    speakChance: 0.2,      // fraction of pops where the voice names the animal
    speechRate: 0.85,      // slower than default
    speechPitch: 1.3,      // friendlier than default
    speechVolume: 1.0,
    voiceEnabled: true,
  },

  /* --- particles ---------------------------------------------------------- */
  particles: {
    max: 900,              // hard cap; oldest are recycled
    popSparkles: 9,        // kept small: a pop should feel good, not look like a win
    confettiPerShower: 90,
    fireworkSparks: 46,
  },

  /* --- fonts (no web fonts — everything must work offline) ----------------- */
  fonts: {
    ui: `900 %spx 'Baloo 2', 'Comic Sans MS', 'Chalkboard SE', 'Trebuchet MS', system-ui, sans-serif`,
    emoji: `%spx 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', 'EmojiOne Color', sans-serif`,
  },

  /* --- parent gate -------------------------------------------------------- */
  gate: {
    holdSeconds: 2.0,      // a 3-year-old will not hold still this long
  },
};

/** Build a canvas font string at a given pixel size. */
export const uiFont = (px) => CONFIG.fonts.ui.replace('%s', px.toFixed(1));
export const emojiFont = (px) => CONFIG.fonts.emoji.replace('%s', px.toFixed(1));
