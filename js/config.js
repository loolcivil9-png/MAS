/* ---------------------------------------------------------------------------
   Every number worth tuning lives here.
   After you have watched him play, this is the only file you should need to
   touch to make the game slower, easier, louder or more generous.
   --------------------------------------------------------------------------- */

export const CONFIG = {
  /* Shown small at the bottom of the home screen, so you can tell at a glance
     which build is actually live after a deploy.
     BUMP THIS on every change, and bump CACHE in sw.js to match. */
  version: '2.1.0',

  /* Shown on the splash screen and used as the PWA name.
     Put his name here — e.g. "Sami's Hungry Hole". */
  title: 'Hungry Hole',

  /* If set, the voice says his name during the big celebrations.
     e.g. playerName: 'Sami'   →   "You did it, Sami! You win!" */
  playerName: '',

  /* --- rendering ---------------------------------------------------------- */
  render: {
    logicalHeight: 1000,   // the screen is always 1000 units tall, whatever the device
    maxDPR: 2,             // a 3x phone would cost 2.25x the pixels for no visible gain
    maxDelta: 0.05,        // seconds; stops everything teleporting after the screen locks
  },

  /* --- the world and the camera -------------------------------------------- */
  /* The world is bigger than the screen. The camera rides on the hole and
     zooms out as it grows, exactly like the game this one is modelled on. */
  world: {
    scale: 2.2,            // the world is this many screens wide and tall
  },
  camera: {
    holeScreenFrac: 0.085, // the hole tries to appear this fraction of screen height
    minZoom: 0.42,         // fully grown: see this much more world (smaller = wider)
    maxZoom: 0.85,         // starting view is already a little pulled back
    posK: 5.5,             // how snappily the camera catches up to the hole
    zoomK: 2.2,            // how smoothly the zoom glides between sizes
    lookAhead: 0.22,       // seconds of velocity the camera leads by
  },

  /* --- the hole ------------------------------------------------------------ */
  /* Steering is RELATIVE, like a joystick: the finger's movement sets the
     hole's direction and speed, wherever on the glass the finger happens to
     be. Hold still and the hole eases to a stop; let go and it glides out. */
  hole: {
    baseRadius: 40,        // how small it starts each level: only tier-1 fits at first
    mouthRatio: 1.0,       // a thing fits when its size <= hole radius * this
    maxSpeed: 560,         // world units per second, plus a little as it grows
    steerGain: 1.4,        // hole speed vs finger speed — slightly faster feels obedient
    accelK: 10,            // how quickly it reaches the commanded speed
    glideDamp: 3.2,        // how quickly it coasts to a stop after a flick
    springK: 130,          // the boing when it grows...
    springDamp: 0.86,      // ...and how quickly the boing settles
    gulpSquash: 0.2,       // how hard it squashes when it swallows
    idleBob: 6,            // gentle breathing while it sits still
  },

  /* --- the things it eats -------------------------------------------------- */
  things: {
    tierSizes: [30, 48, 72, 104, 150],  // logical radius per tier; tier 5 is the landmark
    counts: [18, 12, 8, 5, 1],          // how many of each tier fill the whole world
    placementTries: 18,    // candidate positions tested; the roomiest one wins
    overlapFactor: 1.0,    // eating starts when the hole's edge reaches a thing...
    thingHit: 0.8,         // ...this deep into its body. Generous on purpose:
                           // he aims AT things, he does not centre on them
    swallowBase: 0.3,      // seconds to disappear down the hole...
    swallowPerSize: 1 / 600, // ...plus this much per unit of size
    spin: 9,               // how fast a swallowed thing spirals, radians/second
    wobbleCooldown: 0.8,   // seconds between "too big!" wobbles per thing
    runnerSpeed: 130,      // how fast the runners scoot away (the hole is faster)
    runnerFleeRadius: 260, // how close the hole gets before a runner bolts
    introTime: 0.4,        // seconds for a fresh world to swell into view
    landmarkFitMargin: 1.06, // the mouth ends up this much bigger than it needs
  },

  /* --- special things ------------------------------------------------------- */
  special: {
    goldenGrowthMult: 2.5, // the golden thing grows the hole this much extra
    magnetFromLevel: 2,    // the magnet appears from this level on
    magnetSeconds: 5,      // how long everything nearby slides in on its own
    magnetRadius: 560,     // how far the magnet reaches
    magnetAccel: 900,      // how hard it pulls
  },

  /* --- the eat-streak ------------------------------------------------------- */
  /* Quick successive gulps climb a little melody. Any pause resets it. */
  streak: {
    window: 1.2,           // seconds between eats that still count as a streak
    maxStep: 9,            // top of the run; it holds there while he keeps going
  },

  /* --- levels and celebrations -------------------------------------------- */
  /* The trophy is the LEVEL — a whole world eaten — and nothing else earns
     one. Between levels the game stays deliberately quiet, so that when the
     fireworks do arrive they mean something. */
  celebrate: {
    starsPerLevel: 5,      // a star fills for every fifth of the world eaten
    megaEveryLevels: 5,    // every 5th world earns the crown and the brass fanfare
  },

  /* --- thing sounds --------------------------------------------------------- */
  /* Some things have their own voice — cars vroom, owls hoot, rockets whoosh.
     Played on this fraction of eats, on top of the gulp. */
  objectSounds: {
    enabled: true,
    chance: 0.5,
  },

  /* --- surprises ------------------------------------------------------------ */
  /* Every so often something lovely just crosses the sky — butterflies, a
     rocket, balloons. Purely a spectacle: nothing to learn, nothing to tap. */
  surprise: {
    minEatsBetween: 20,
    maxEatsBetween: 45,
  },

  /* --- saving --------------------------------------------------------------- */
  /* The world remembers him between sessions: things eaten, worlds finished,
     and everything he has ever met. "Start over" in the grown-ups menu wipes
     it. Old Bubble Zoo saves are migrated so his trophies survive the update. */
  save: {
    key: 'hungry-hole-save',
    legacyKey: 'bubble-zoo-save',
    throttleSeconds: 3,    // at most one write this often (plus key moments)
  },

  /* --- sound -------------------------------------------------------------- */
  audio: {
    masterVolume: 0.55,    // deliberately conservative: this is held near his ears
    speakChance: 0.35,     // fraction of eats where the voice names the thing
    speechRate: 0.85,      // slower than default
    speechPitch: 1.3,      // friendlier than default
    speechVolume: 1.0,
    voiceEnabled: true,
  },

  /* --- particles ---------------------------------------------------------- */
  particles: {
    max: 900,              // hard cap; oldest are recycled
    popSparkles: 9,        // kept small: a gulp should feel good, not look like a win
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
