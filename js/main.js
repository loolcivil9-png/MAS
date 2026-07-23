/* ---------------------------------------------------------------------------
   Hungry Hole — bootstrap and game loop.

   Owns the canvas, the logical coordinate space, the hole, the world of
   things it eats, and the glue between input, celebrations and the
   grown-ups menu.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { Pool, Timers, clamp, rand, pick } from './util.js';
import { Background } from './background.js';
import { Hole } from './hole.js';
import { Thing } from './thing.js';
import { Particles } from './particles.js';
import { Hud } from './hud.js';
import { Celebrations } from './celebrate.js';
import { audio } from './audio.js';
import { attachInput, suppressBrowserGestures } from './input.js';
import { Surprises } from './surprise.js';
import { buildLevelList, TOTAL_KINDS } from './catalog.js';
import { met, loadSave, initSave, flushSave, clearSave } from './save.js';

/* --- elements --------------------------------------------------------------- */

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });

const splash = document.getElementById('splash');
const playBtn = document.getElementById('play-btn');
const gate = document.getElementById('gate');
const parentMenu = document.getElementById('parent-menu');
const pmVolume = document.getElementById('pm-volume');
const pmVoice = document.getElementById('pm-voice');
const pmStat = document.getElementById('pm-stat');
const pmRestart = document.getElementById('pm-restart');
const pmClose = document.getElementById('pm-close');

document.getElementById('splash-title').textContent = CONFIG.title;
document.getElementById('splash-version').textContent = `v${CONFIG.version}`;
document.title = CONFIG.title;

/* --- world ------------------------------------------------------------------ */

/** Logical space: always 1000 units tall, width follows the aspect ratio. */
const world = {
  w: 462,
  h: CONFIG.render.logicalHeight,
  safe: { t: 0, r: 0, b: 0, l: 0 },
};

let scale = 1;                                    // device pixels per logical unit
let viewport = { left: 0, top: 0, width: 1, height: 1 };

/* --- systems ---------------------------------------------------------------- */

const background = new Background();
const particles = new Particles();
const hud = new Hud();
const timers = new Timers();
const celebrations = new Celebrations({ particles, hud, timers, world, background });
const surprises = new Surprises(particles);
const hole = new Hole();

const things = new Pool(40, () => new Thing());

let running = false;
let started = false;
let rafId = 0;
let lastFrame = 0;
let wakeLock = null;

let elapsed = 0;          // game-time seconds, drives the eat-streak timing
let levelPending = false; // set between the last gulp and the next world
let magnetT = 0;          // seconds of magnet superpower remaining
let magnetEaten = 0;      // eats since the magnet switched on (voice cap)
let lastEatAt = -Infinity;
let streakStep = 0;

/* --- the world remembers him ------------------------------------------------- */

// Restore before anything spawns, so the sky (and its world) opens on the
// level he reached. Old Bubble Zoo saves migrate: his trophies survive.
const restored = loadSave();
if (restored) {
  hud.score = restored.totalEaten;
  hud.level = restored.level;
  hud.trophies = restored.trophies;
  background.resetTo(hud.level);
}
initSave(() => ({ totalEaten: hud.score, level: hud.level, trophies: hud.trophies }));

/* --- sizing ----------------------------------------------------------------- */

// Kept around rather than rebuilt, since it is read on every resize.
const safeProbe = document.createElement('div');
safeProbe.style.cssText =
  'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
  'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);' +
  'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
document.body.appendChild(safeProbe);

function resize() {
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;
  if (cssW < 1 || cssH < 1) return;

  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDPR);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  world.h = CONFIG.render.logicalHeight;
  world.w = world.h * (cssW / cssH);
  scale = canvas.height / world.h;

  const rect = canvas.getBoundingClientRect();
  viewport = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

  const cs = getComputedStyle(safeProbe);
  const k = world.h / cssH; // CSS pixels → logical units
  world.safe = {
    t: (parseFloat(cs.paddingTop) || 0) * k,
    r: (parseFloat(cs.paddingRight) || 0) * k,
    b: (parseFloat(cs.paddingBottom) || 0) * k,
    l: (parseFloat(cs.paddingLeft) || 0) * k,
  };

  // Nudge anything that the new width left hanging off the edge.
  for (const th of things.items) if (th.active && th.state === 'idle') th.clampInto(world);
}

/**
 * Cheap per-frame check that the backing store still matches the element.
 *
 * Resize events are unreliable on phones — the URL bar collapsing mid-play, a
 * rotation while the screen is off, or a first paint that lands before layout
 * has settled can all leave the canvas at the wrong size with no event to
 * react to. Two integer comparisons a frame makes the whole thing
 * self-correcting instead of dependent on catching every event.
 */
function ensureSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxDPR);
  const wantW = Math.round((canvas.clientWidth || window.innerWidth) * dpr);
  const wantH = Math.round((canvas.clientHeight || window.innerHeight) * dpr);
  if (canvas.width !== wantW || canvas.height !== wantH) resize();
}

let resizePending = false;
function scheduleResize() {
  if (resizePending) return;
  resizePending = true;
  requestAnimationFrame(() => { resizePending = false; resize(); });
}

window.addEventListener('resize', scheduleResize);
window.addEventListener('orientationchange', scheduleResize);
window.visualViewport?.addEventListener('resize', scheduleResize);

/* --- input ------------------------------------------------------------------ */

const toWorld = (clientX, clientY) => ({
  x: ((clientX - viewport.left) / viewport.width) * world.w,
  y: ((clientY - viewport.top) / viewport.height) * world.h,
});

// Fingers currently on the screen, in press order. The hole obeys the newest;
// when it lifts, an older finger that is still down takes over. A palm-slam is
// just a lot of downs — nothing bad can happen.
const pointers = [];

function onPoint(x, y, kind, pointerId) {
  if (!running) return;

  if (kind === 'down') {
    const i = pointers.indexOf(pointerId);
    if (i !== -1) pointers.splice(i, 1);
    pointers.push(pointerId);
    hole.setTarget(x, y);
    // Every touch is answered: the hole turns to come, and the spot sparkles.
    celebrations.onMiss(x, y);
  } else if (kind === 'move') {
    if (pointers[pointers.length - 1] === pointerId) hole.setTarget(x, y);
  } else { // 'up'
    const i = pointers.indexOf(pointerId);
    if (i !== -1) pointers.splice(i, 1);
    if (pointers.length === 0) hole.release();
    // Otherwise the hole keeps heading for its last target until the finger
    // that now owns it moves — which reads as exactly what it is.
  }
}

attachInput(canvas, toWorld, onPoint);
suppressBrowserGestures(document);

/* --- building a world -------------------------------------------------------- */

function activeThings() {
  let n = 0;
  for (const th of things.items) if (th.active) n++;
  return n;
}

/**
 * Lays out a fresh world: `counts` things per tier, biggest placed first into
 * the roomiest spots (dart-throwing, keep the candidate furthest from the
 * already-placed), one golden growth-spurt thing, and from level 2 a magnet.
 *
 * Growth is then NORMALIZED: the shares of all non-landmark things sum to
 * exactly the growth needed for the landmark to fit (times a small margin).
 * However the level is tuned and whatever order he eats in, eating everything
 * else always opens the mouth wide enough for the centrepiece. Progression is
 * an invariant, not a hope.
 */
function buildLevel(level) {
  const T = CONFIG.things;
  things.releaseAll();

  const list = buildLevelList(background.theme, T.counts);
  list.sort((a, b) => b.tier - a.tier);

  // Wherever the hole currently sits counts as occupied — generously, since
  // its drawn radius may still be spring-shrinking — so a fresh world never
  // opens with something already half-way down the hatch.
  const placed = [{
    x: hole.x,
    y: hole.y,
    size: Math.max(hole.rShown, CONFIG.hole.baseRadius) + CONFIG.things.tierSizes[0],
  }];
  for (const { entry, tier } of list) {
    const size = T.tierSizes[tier];
    const m = size * 0.6;
    const loX = world.safe.l + m;
    const hiX = Math.max(loX, world.w - world.safe.r - m);
    const loY = world.safe.t + T.hudBand + m;
    const hiY = Math.max(loY, world.h - world.safe.b - m);

    let bestX = world.w / 2;
    let bestY = world.h / 2;
    let bestGap = -Infinity;
    for (let i = 0; i < T.placementTries; i++) {
      const x = rand(loX, hiX);
      const y = rand(loY, hiY);
      let gap = Infinity;
      for (const p of placed) {
        gap = Math.min(gap, Math.hypot(p.x - x, p.y - y) - (p.size + size));
      }
      if (gap > bestGap) { bestGap = gap; bestX = x; bestY = y; }
      if (gap === Infinity) break; // nothing to avoid yet
    }

    const th = things.acquire();
    th.spawn(entry, tier, size, bestX, bestY);
    placed.push(th);
  }

  const spawned = placed.slice(1); // drop the hole's placeholder

  const smalls = spawned.filter((t) => t.tier <= 1);
  if (smalls.length) pick(smalls).golden = true;
  if (level >= CONFIG.special.magnetFromLevel) {
    const candidates = spawned.filter((t) => t.tier <= 2 && !t.golden);
    if (candidates.length) pick(candidates).magnet = true;
  }

  const landmarkSize = T.tierSizes[T.tierSizes.length - 1];
  const rNeeded = (landmarkSize / CONFIG.hole.mouthRatio) * T.landmarkFitMargin;
  const totalGrowth = Math.max(0, rNeeded - CONFIG.hole.baseRadius);
  const eaters = spawned.filter((t) => t.tier < T.tierSizes.length - 1);
  const weight = (t) => t.size * (t.golden ? CONFIG.special.goldenGrowthMult : 1);
  const weightSum = eaters.reduce((s, t) => s + weight(t), 0) || 1;
  for (const t of eaters) t.growth = totalGrowth * (weight(t) / weightSum);

  celebrations.beginLevel(spawned.length);
}

/* --- eating ------------------------------------------------------------------ */

const LANDMARK_TIER = CONFIG.things.tierSizes.length - 1;

function eatCheck() {
  const T = CONFIG.things;

  for (const th of things.items) {
    if (!th.active || th.state !== 'idle') continue;

    const dx = th.x - hole.x;
    const dy = th.y - hole.y;
    const reach = hole.rShown * T.overlapFactor + th.size * T.thingHit;
    if (dx * dx + dy * dy > reach * reach) continue;

    if (th.size <= hole.mouth) {
      th.startSwallow(hole);
      hole.gulp();
      audio.gulp(th.size / T.tierSizes[LANDMARK_TIER]);

      // Quick successive gulps climb a little pentatonic run.
      if (elapsed - lastEatAt <= CONFIG.streak.window) {
        streakStep = Math.min(streakStep + 1, CONFIG.streak.maxStep);
        audio.munch(streakStep);
      } else {
        streakStep = 0;
      }
      lastEatAt = elapsed;
    } else if (th.boinkCooldown <= 0) {
      // Too big — for now. A friendly boing and a hint of sparkle; never
      // a penalty. He will be back for this one.
      th.wobble();
      audio.boing();
      particles.sparkleBurst(th.x, th.y - th.size * 0.6, rand(0, 360), 4);
    }
  }
}

/** A swallow just finished: score it, grow, and check for special powers. */
function onEaten(th) {
  hole.grow(th.growth);

  const muteVoice = magnetT > 0 && ++magnetEaten > 2;
  celebrations.onEat(th, muteVoice);
  surprises.onEat(!!hud.banner);

  if (th.magnet) startMagnet();
  if (th.tier === LANDMARK_TIER) timers.after(0.6, () => audio.burp());
}

/**
 * The magnet superpower: for a few seconds, everything nearby that already
 * fits slides toward the hole on its own. Each arrival still goes through the
 * normal swallow path, so everything still plops, scores and grows.
 */
function startMagnet() {
  magnetT = CONFIG.special.magnetSeconds;
  magnetEaten = 0;
  hud.showFlash(0.8, { rainbow: true });
  audio.chime(7);
}

function magnetPull(dt) {
  const S = CONFIG.special;
  for (const th of things.items) {
    if (!th.active || th.state !== 'idle' || th.size > hole.mouth) continue;
    const dx = hole.x - th.x;
    const dy = hole.y - th.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > S.magnetRadius) continue;

    const speed = Math.min(620, 140 + dist * 2.2);
    th.x += (dx / dist) * speed * dt;
    th.y += (dy / dist) * speed * dt;
    if (Math.random() < dt * 7) particles.sparkleBurst(th.x, th.y, 200, 1);
  }
}

/** Clean plate: the last thing has gone down. Shortly after, a fresh world. */
function checkCleanPlate() {
  if (levelPending || !started || activeThings() > 0) return;
  levelPending = true;
  // The level-up spectacle itself fires from celebrate.js when the fifth star
  // lands; this just brings the next world in after the fireworks have peaked.
  timers.after(2.8, () => {
    hole.r = CONFIG.hole.baseRadius;   // the spring animates the shrink
    buildLevel(hud.level);
    levelPending = false;
  });
}

/* --- loop ------------------------------------------------------------------- */

function update(dt) {
  elapsed += dt;
  timers.update(dt);
  background.update(dt);
  surprises.update(dt, world);
  hole.update(dt, world);

  if (magnetT > 0) {
    magnetT -= dt;
    magnetPull(dt);
  }

  eatCheck();

  for (const th of things.items) {
    if (!th.active) continue;
    if (th.update(dt, world, hole) === 'eaten') onEaten(th);
  }

  checkCleanPlate();
  particles.update(dt, world);
  hud.update(dt, world);
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  background.draw(ctx, world);
  surprises.draw(ctx);   // behind everything he interacts with
  hud.drawFlash(ctx, world);

  hole.draw(ctx);
  // Things draw over the hole, so a swallowed one visibly spirals down INTO it.
  for (const th of things.items) if (th.active) th.draw(ctx);

  particles.draw(ctx);
  hud.draw(ctx, world);
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  ensureSize();
  const dt = Math.min((now - lastFrame) / 1000, CONFIG.render.maxDelta);
  lastFrame = now;
  update(dt);
  render();
}

function startLoop() {
  if (rafId) return;
  lastFrame = performance.now();
  rafId = requestAnimationFrame(frame);
}

function stopLoop() {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
}

/* --- start ------------------------------------------------------------------ */

function start() {
  if (started) return;
  started = true;
  running = true;

  audio.unlock();          // must happen inside the gesture, or iOS stays silent
  goFullscreen();
  requestWakeLock();

  splash.classList.add('is-hidden');
  resize();

  hole.reset(world);
  buildLevel(hud.level);
  audio.chime(4);
  startLoop();
}

playBtn.addEventListener('click', start);

function goFullscreen() {
  const el = document.documentElement;
  try {
    // Not available on iPhone Safari; the PWA install path covers that instead.
    el.requestFullscreen?.({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('portrait').catch(() => {}))
      .catch(() => {});
  } catch { /* fullscreen is a nicety, not a requirement */ }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* denied or unsupported; the screen may dim, which is survivable */ }
}

/* --- pause / resume --------------------------------------------------------- */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopLoop();
    audio.suspend();
    flushSave();          // the realistic exit is the phone being taken away
  } else if (started) {
    audio.resume();
    requestWakeLock();
    startLoop();
  }
});

/* --- parent gate ------------------------------------------------------------ */

let holdRaf = 0;
let holdStart = 0;

function beginHold(e) {
  e.preventDefault();
  try { gate.setPointerCapture(e.pointerId); } catch { /* fine */ }
  gate.classList.add('is-holding');
  holdStart = performance.now();
  tickHold();
}

function tickHold() {
  const elapsedHold = (performance.now() - holdStart) / 1000;
  const p = clamp(elapsedHold / CONFIG.gate.holdSeconds, 0, 1);
  gate.style.setProperty('--p', (p * 100).toFixed(1));

  if (p >= 1) {
    endHold();
    openParentMenu();
    return;
  }
  holdRaf = requestAnimationFrame(tickHold);
}

function endHold() {
  cancelAnimationFrame(holdRaf);
  holdRaf = 0;
  gate.classList.remove('is-holding');
  gate.style.setProperty('--p', '0');
}

gate.addEventListener('pointerdown', beginHold);
gate.addEventListener('pointerup', endHold);
gate.addEventListener('pointercancel', endHold);
gate.addEventListener('lostpointercapture', endHold);
// A tap that never becomes a hold must do nothing at all.
gate.addEventListener('click', (e) => e.preventDefault());

/* --- grown-ups menu --------------------------------------------------------- */

function openParentMenu() {
  running = false;
  pmVolume.value = String(Math.round(CONFIG.audio.masterVolume * 100));
  pmVoice.checked = CONFIG.audio.voiceEnabled;
  pmStat.textContent =
    `Ate ${hud.score} thing${hud.score === 1 ? '' : 's'}, finished ` +
    `${hud.trophies} world${hud.trophies === 1 ? '' : 's'}, and met ` +
    `${met.size} of ${TOTAL_KINDS} different things.`;
  parentMenu.hidden = false;
}

function closeParentMenu() {
  parentMenu.hidden = true;
  running = true;
}

pmVolume.addEventListener('input', () => audio.setVolume(Number(pmVolume.value) / 100));

pmVoice.addEventListener('change', () => {
  CONFIG.audio.voiceEnabled = pmVoice.checked;
  if (!pmVoice.checked) { try { window.speechSynthesis?.cancel(); } catch { /* n/a */ } }
});

pmClose.addEventListener('click', closeParentMenu);

pmRestart.addEventListener('click', () => {
  clearSave();            // forget everything, not just this session
  hud.reset();
  celebrations.reset();   // also snaps the sky back to level 1
  particles.clear();
  timers.clear();
  things.releaseAll();
  hole.reset(world);
  levelPending = false;
  magnetT = 0;
  streakStep = 0;
  lastEatAt = -Infinity;
  buildLevel(1);
  closeParentMenu();
});

/* --- offline ---------------------------------------------------------------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* --- test hook --------------------------------------------------------------- */

// Read-only getters for the automated smoke test. No gameplay effect.
window.__hh = {
  get eaten() { return hud.score; },
  get remaining() { return activeThings(); },
  get holeR() { return hole.r; },
  get level() { return hud.level; },
  get hole() { return { x: hole.x, y: hole.y, tx: hole.tx, ty: hole.ty, following: hole.following }; },
  get things() {
    const out = [];
    for (const th of things.items) {
      if (th.active) out.push({ x: Math.round(th.x), y: Math.round(th.y), size: th.size, tier: th.tier, state: th.state });
    }
    return out;
  },
  get world() { return { w: world.w, h: world.h, mouth: hole.mouth }; },
};

/* --- go --------------------------------------------------------------------- */

resize();
render(); // paint one frame behind the splash so the transition reveals a live scene
