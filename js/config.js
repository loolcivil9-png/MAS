/* ---------------------------------------------------------------------------
   Every number worth tuning lives here.
   After you have watched him play, this is the only file you should need to
   touch to make the game slower, easier, louder or more generous.
   --------------------------------------------------------------------------- */

export const CONFIG = {
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
    minRadius: 74,         // logical units. ~120 px across on a normal phone
    maxRadius: 128,        // ~210 px across
    minSpeed: 40,          // upward, logical units per second
    maxSpeed: 74,
    swayAmount: 26,        // how far it drifts side to side
    swaySpeedMin: 0.25,    // sway cycles per second
    swaySpeedMax: 0.55,
    minOnScreen: 5,        // population is topped up to sit between these
    maxOnScreen: 7,
    spawnInterval: 0.42,   // seconds between spawns while topping up
    hitScale: 1.35,        // touch radius vs. drawn radius. He does not need to be accurate
    goldenChance: 1 / 15,  // golden bubble = instant big party
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

  /* --- celebrations ------------------------------------------------------- */
  celebrate: {
    starEvery: 5,          // a star + confetti shower
    partyEvery: 15,        // fireworks, cheering, trophy
    megaEvery: 50,         // crown, fanfare, rainbow
    starsPerParty: 3,      // starEvery * starsPerParty should equal partyEvery
  },

  /* --- sound -------------------------------------------------------------- */
  audio: {
    masterVolume: 0.55,    // deliberately conservative: this is held near his ears
    speakChance: 0.34,     // fraction of pops where the voice names the animal
    speechRate: 0.85,      // slower than default
    speechPitch: 1.3,      // friendlier than default
    speechVolume: 1.0,
    voiceEnabled: true,
  },

  /* --- particles ---------------------------------------------------------- */
  particles: {
    max: 900,              // hard cap; oldest are recycled
    popSparkles: 16,
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
