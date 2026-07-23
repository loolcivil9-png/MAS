/* ---------------------------------------------------------------------------
   Every number worth tuning lives here.
   After you have watched him play, this is the only file you should need to
   touch to make the game slower, easier, louder or more generous.
   --------------------------------------------------------------------------- */

export const CONFIG = {
  /* Shown small at the bottom of the home screen, so you can tell at a glance
     which build is actually live after a deploy.
     BUMP THIS on every change, and bump CACHE in sw.js to match. */
  version: '3.1.0',

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

  /* --- the city and the camera ---------------------------------------------- */
  /* There are no levels. There is ONE city — a big, organized map with a park
     at the bottom, a market above it, houses, busy streets, a downtown block
     of buildings and a stadium at the top. It is laid out by a seeded
     generator, so the same seed always rebuilds the same city — which is how
     a half-eaten city can be saved and resumed. */
  city: {
    width: 1600,           // fixed world size in logical units, independent of
    height: 3200,          // the screen — a portrait city about 2 by 4 screens
    growthExp: 1.3,        // growth shares scale with size^this. Above 1 means
                           // small things give little growth, so each new size
                           // takes a satisfying while to reach
  },
  camera: {
    holeScreenFrac: 0.07,  // the hole tries to appear this fraction of screen height
    minZoom: 0.42,         // fully grown: see this much more world (smaller = wider)
    maxZoom: 0.8,          // starting view is already pulled back — the city
                           // should feel like a place, not a close-up
    posK: 5.5,             // how snappily the camera catches up to the hole
    zoomK: 2.2,            // how smoothly the zoom glides between sizes
    lookAhead: 0.22,       // seconds of velocity the camera leads by
  },

  /* --- the sky -------------------------------------------------------------- */
  /* With no levels, the sky drifts on its own clock instead: day slides into
     sunset, night, dawn and round again while he plays. */
  sky: {
    secondsPerPhase: 150,
  },

  /* --- the hole ------------------------------------------------------------ */
  /* Steering is RELATIVE, like a joystick: the finger's movement sets the
     hole's direction and speed, wherever on the glass the finger happens to
     be. Hold still and the hole eases to a stop; let go and it glides out. */
  hole: {
    baseRadius: 20,        // how small it starts in a fresh city: only the very
                           // tiniest things fit at first
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
    // Seven sizes, flowers to stadium. The last one is the landmark.
    // Deliberately small against the screen: the city should read as a busy
    // place seen from above, not a wall of stickers.
    tierSizes: [16, 26, 38, 54, 76, 105, 140],
    overlapFactor: 1.0,    // eating starts when the hole's edge reaches a thing...
    thingHit: 0.8,         // ...this deep into its body. Generous on purpose:
                           // he aims AT things, he does not centre on them
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

  /* --- celebrations --------------------------------------------------------- */
  /* Cleaning a whole DISTRICT (the park, the market, downtown…) is the
     frequent win — fireworks and cheering, no trophy. Eating the WHOLE CITY is
     the big one: crown, fanfare, a trophy, and a brand-new city grows back. */
  celebrate: {
    starsPerLevel: 5,      // a star fills for every fifth of the city eaten
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
  /* The city itself is saved: which things are already eaten, how big the
     hole has grown, plus the lifetime totals. Closing the app mid-city and
     opening it tomorrow resumes exactly where he left off. "Start over" in
     the grown-ups menu wipes it. Older saves are migrated. */
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
