/* ---------------------------------------------------------------------------
   Hungry Hole — bootstrap and game loop.

   Two coordinate spaces, deliberately kept apart:

     SCREEN  the logical viewport (always 1000 units tall). The sky, the HUD,
             the win confetti and the surprises live here.

     CITY    the world itself — one big, organized city (see city.js). The
             hole, the things it eats, and their sparkles live here, and a
             camera (position + zoom) maps city to screen. The camera rides
             on the hole and pulls back as it grows.

   There are no levels. The city persists: its seed and every eaten thing are
   saved, so tomorrow continues exactly where today stopped. Cleaning a whole
   district is the frequent win; eating the whole city is the big one, and
   then a brand-new city grows back.

   Steering is relative: the finger's movement drives the hole's velocity;
   where the finger sits on the glass is irrelevant.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { Pool, Timers, clamp, rand } from './util.js';
import { Background } from './background.js';
import { Hole } from './hole.js';
import { Thing } from './thing.js';
import { Particles } from './particles.js';
import { Hud } from './hud.js';
import { Celebrations } from './celebrate.js';
import { audio } from './audio.js';
import { attachInput, suppressBrowserGestures } from './input.js';
import { Surprises } from './surprise.js';
import { generateCity, TOTAL_KINDS } from './city.js';
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

/* --- screen space ------------------------------------------------------------ */

/** Logical viewport: always 1000 units tall, width follows the aspect ratio. */
const world = {
  w: 462,
  h: CONFIG.render.logicalHeight,
  safe: { t: 0, r: 0, b: 0, l: 0 },
};

let scale = 1;                                    // device pixels per logical unit
let viewport = { left: 0, top: 0, width: 1, height: 1 };

/* --- city space -------------------------------------------------------------- */

/** The world the hole lives in — one fixed-size city. */
const field = { w: CONFIG.city.width, h: CONFIG.city.height };

/** The camera: where on the city the screen is looking, and how wide. */
const cam = { x: field.w / 2, y: field.h / 2, zoom: CONFIG.camera.maxZoom };

function updateCamera(dt) {
  const C = CONFIG.camera;

  // Zoom keeps the hole a steady fraction of the screen: growing pulls the
  // camera back, so the world visibly "gets smaller" — the hole.io feeling.
  const zt = clamp((world.h * C.holeScreenFrac) / hole.rShown, C.minZoom, C.maxZoom);
  cam.zoom += (zt - cam.zoom) * (1 - Math.exp(-C.zoomK * dt));

  // Follow with a touch of lookahead, so he sees where he is going.
  const k = 1 - Math.exp(-C.posK * dt);
  cam.x += (hole.x + hole.vx * C.lookAhead - cam.x) * k;
  cam.y += (hole.y + hole.vy * C.lookAhead - cam.y) * k;

  // Never show past the edge of the world.
  const halfW = (world.w / 2) / cam.zoom;
  const halfH = (world.h / 2) / cam.zoom;
  cam.x = field.w > halfW * 2 ? clamp(cam.x, halfW, field.w - halfW) : field.w / 2;
  cam.y = field.h > halfH * 2 ? clamp(cam.y, halfH, field.h - halfH) : field.h / 2;
}

const toScreen = (fx, fy) => ({
  x: (fx - cam.x) * cam.zoom + world.w / 2,
  y: (fy - cam.y) * cam.zoom + world.h / 2,
});

/** The city rectangle currently visible on screen. */
function visibleRect() {
  const halfW = (world.w / 2) / cam.zoom;
  const halfH = (world.h / 2) / cam.zoom;
  return { x: cam.x - halfW, y: cam.y - halfH, w: halfW * 2, h: halfH * 2 };
}

/* --- systems ---------------------------------------------------------------- */

const background = new Background();
const particles = new Particles();   // city space: gulp sparkles, rings
const fx = new Particles();          // screen space: confetti, fireworks, trails
const hud = new Hud();
const timers = new Timers();
const celebrations = new Celebrations({ particles, fx, hud, timers, world, toScreen });
const surprises = new Surprises(fx);
const hole = new Hole();

const things = new Pool(130, () => new Thing());

let running = false;
let started = false;
let rafId = 0;
let lastFrame = 0;
let wakeLock = null;

let elapsed = 0;          // game-time seconds, drives the eat-streak timing
let rebuildPending = false; // set between the last bite of a city and the next one
let magnetT = 0;          // seconds of magnet superpower remaining
let magnetEaten = 0;      // eats since the magnet switched on (voice cap)
let lastEatAt = -Infinity;
let streakStep = 0;

// The persistent city.
let citySeed = (Math.random() * 0xffffffff) >>> 0;
let cityStart = { x: field.w / 2, y: field.h * 0.885 };
const cityEaten = new Set();          // plan ids already eaten
const districtLeft = new Map();       // district -> things still standing

// The sky drifts through its palettes on its own clock — day, sunset, night…
let skyPhase = 1;
let skyT = 0;

/* --- the city remembers him --------------------------------------------------- */

const restored = loadSave();
let restoredHoleR = null;
if (restored) {
  hud.score = restored.totalEaten;
  hud.trophies = restored.cities;
  if (restored.city) {
    citySeed = restored.city.seed;
    for (const id of restored.city.eaten) cityEaten.add(id);
    restoredHoleR = restored.city.holeR;
  }
}
initSave(() => ({
  totalEaten: hud.score,
  cities: hud.trophies,
  citySeed,
  cityEaten: [...cityEaten],
  holeR: hole.r,
}));

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
}

/**
 * Cheap per-frame check that the backing store still matches the element.
 * Resize events are unreliable on phones; two integer comparisons a frame
 * make the whole thing self-correcting instead.
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

/* --- input: relative steering ------------------------------------------------ */

const toLogical = (clientX, clientY) => ({
  x: ((clientX - viewport.left) / viewport.width) * world.w,
  y: ((clientY - viewport.top) / viewport.height) * world.h,
});

// Fingers currently on the screen, in press order, plus each one's last seen
// position. The newest finger steers; when it lifts, an older finger that is
// still down takes over. A palm-slam is just a lot of downs.
const pointers = [];
const lastPt = new Map();

function onPoint(x, y, kind, pointerId) {
  if (!running) return;

  if (kind === 'down') {
    const i = pointers.indexOf(pointerId);
    if (i !== -1) pointers.splice(i, 1);
    pointers.push(pointerId);
    lastPt.set(pointerId, { x, y });
    // Every touch is answered: the hole perks up and sparkles.
    particles.sparkleBurst(hole.x, hole.y - hole.rShown, rand(0, 360), 4);
    hole.steer(0, 0); // wakes the "I am being driven" state without moving
  } else if (kind === 'move') {
    const p = lastPt.get(pointerId);
    lastPt.set(pointerId, { x, y });
    if (!p || pointers[pointers.length - 1] !== pointerId) return;
    // A screen-space finger stroke commands the same on-screen motion at any
    // zoom, so dividing by the camera zoom converts it to city units.
    hole.steer((x - p.x) / cam.zoom, (y - p.y) / cam.zoom);
  } else { // 'up'
    const i = pointers.indexOf(pointerId);
    if (i !== -1) pointers.splice(i, 1);
    lastPt.delete(pointerId);
    if (pointers.length === 0) hole.release();
  }
}

attachInput(canvas, toLogical, onPoint);
suppressBrowserGestures(document);

/* --- building the city -------------------------------------------------------- */

function activeThings() {
  let n = 0;
  for (const th of things.items) if (th.active) n++;
  return n;
}

/**
 * Realizes the city plan for `citySeed`, skipping anything in `cityEaten` —
 * which is how a saved half-eaten city comes back exactly as it was left.
 *
 * Growth shares are normalized over the FULL plan (eaten included): the sum
 * of every share equals exactly the growth needed for the stadium to fit.
 * A resumed hole carries its saved size, which already contains the shares
 * of everything it ate — the invariant survives saving and loading.
 */
function buildCity() {
  const T = CONFIG.things;
  things.releaseAll();
  districtLeft.clear();

  const plan = generateCity(citySeed);
  cityStart = plan.start;

  const landmarkTier = T.tierSizes.length - 1;
  const rNeeded = (T.tierSizes[landmarkTier] / CONFIG.hole.mouthRatio) * T.landmarkFitMargin;
  const totalGrowth = Math.max(0, rNeeded - CONFIG.hole.baseRadius);
  const weight = (p) => (p.tier === landmarkTier ? 0 : Math.pow(T.tierSizes[p.tier], CONFIG.city.growthExp)
    * (p.golden ? CONFIG.special.goldenGrowthMult : 1));
  const weightSum = plan.things.reduce((s, p) => s + weight(p), 0) || 1;

  for (const p of plan.things) {
    if (cityEaten.has(p.id)) continue;

    const th = things.acquire();
    th.spawn(p.entry, p.tier, T.tierSizes[p.tier], p.x, p.y);
    th.cityId = p.id;
    th.district = p.district;
    th.golden = p.golden;
    th.magnet = p.magnet;
    th.growth = totalGrowth * (weight(p) / weightSum);

    if (p.district) districtLeft.set(p.district, (districtLeft.get(p.district) ?? 0) + 1);
  }

  celebrations.beginCity(plan.things.length, cityEaten.size);
}

/** The whole city is gone: celebrate hugely, then a brand-new one grows back. */
function newCityAfterCelebration() {
  rebuildPending = true;
  celebrations.cityComplete();
  timers.after(4.2, () => {
    citySeed = (Math.random() * 0xffffffff) >>> 0;
    cityEaten.clear();
    hole.r = CONFIG.hole.baseRadius;   // the spring animates the shrink
    buildCity();
    hole.x = cityStart.x;
    hole.y = cityStart.y;
    hole.vx = 0;
    hole.vy = 0;
    rebuildPending = false;
    flushSave();
  });
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

/** A swallow just finished: score it, grow, and check what it completed. */
function onEaten(th) {
  hole.grow(th.growth);
  cityEaten.add(th.cityId);

  const muteVoice = magnetT > 0 && ++magnetEaten > 2;
  celebrations.onEat(th, muteVoice);
  surprises.onEat(!!hud.banner);

  if (th.magnet) startMagnet();
  if (th.tier === LANDMARK_TIER) timers.after(0.6, () => audio.burp());

  // District bookkeeping: the last thing of a district is the frequent win.
  if (th.district) {
    const left = (districtLeft.get(th.district) ?? 1) - 1;
    districtLeft.set(th.district, left);
    if (left === 0 && activeThings() > 0) celebrations.districtClean(th.district);
  }

  if (activeThings() === 0 && !rebuildPending) newCityAfterCelebration();
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

    const speed = Math.min(680, 160 + dist * 2.2);
    th.x += (dx / dist) * speed * dt;
    th.y += (dy / dist) * speed * dt;
    if (Math.random() < dt * 7) particles.sparkleBurst(th.x, th.y, 200, 1);
  }
}

/* --- loop ------------------------------------------------------------------- */

function update(dt) {
  elapsed += dt;
  timers.update(dt);

  // Day slides into sunset, night, dawn… on its own gentle clock.
  skyT += dt;
  if (skyT >= CONFIG.sky.secondsPerPhase) {
    skyT = 0;
    skyPhase++;
    background.setLevel(skyPhase);
  }
  background.update(dt);

  surprises.update(dt, world);
  hole.update(dt, field);
  updateCamera(dt);

  if (magnetT > 0) {
    magnetT -= dt;
    magnetPull(dt);
  }

  eatCheck();

  for (const th of things.items) {
    if (!th.active) continue;
    if (th.update(dt, field, hole) === 'eaten') onEaten(th);
  }

  particles.update(dt, field);
  fx.update(dt, world);
  hud.update(dt, world);
}

function render() {
  // --- screen space: the sky ------------------------------------------------
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  background.draw(ctx, world);
  surprises.draw(ctx);   // behind the world he plays in

  // --- city space, through the camera ---------------------------------------
  const z = cam.zoom;
  ctx.setTransform(
    scale * z, 0, 0, scale * z,
    scale * (world.w / 2 - cam.x * z),
    scale * (world.h / 2 - cam.y * z),
  );
  const view = visibleRect();
  background.drawGround(ctx, view, field);
  hole.draw(ctx);
  // Things draw over the hole, so a swallowed one visibly spirals down INTO it.
  for (const th of things.items) {
    if (!th.active) continue;
    // Skip anything comfortably outside the camera — the city is big.
    if (th.x + th.size * 2 < view.x || th.x - th.size * 2 > view.x + view.w
      || th.y + th.size * 2 < view.y || th.y - th.size * 2 > view.y + view.h) continue;
    th.draw(ctx);
  }
  particles.draw(ctx);

  // --- screen space again: overlays -----------------------------------------
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  hud.drawFlash(ctx, world);
  fx.draw(ctx);
  drawGuides(ctx);
  hud.draw(ctx, world);
}

/**
 * Gentle golden arrows at the screen edge whenever he could get lost:
 * pointing at the stragglers when only a few things remain, and pointing at
 * the nearest EDIBLE thing whenever nothing on screen fits his mouth. In a
 * city this big, "where do I go?" must never be a dead end.
 */
function drawGuides(ctx) {
  const remaining = activeThings();
  if (remaining === 0) return;

  const fewLeft = remaining <= 4;
  const targets = [];
  let edibleVisibleOnScreen = false;
  let nearestEdible = null;
  let nearestEdibleD = Infinity;

  for (const th of things.items) {
    if (!th.active || th.state !== 'idle') continue;
    const s = toScreen(th.x, th.y);
    const onScreen = s.x > -40 && s.x < world.w + 40 && s.y > -40 && s.y < world.h + 40;
    const edible = th.size <= hole.mouth;

    if (edible && onScreen) edibleVisibleOnScreen = true;
    if (edible) {
      const d = Math.hypot(th.x - hole.x, th.y - hole.y);
      if (d < nearestEdibleD) { nearestEdibleD = d; nearestEdible = s; }
    }
    if (fewLeft && !onScreen) targets.push(s);
  }

  if (!fewLeft && !edibleVisibleOnScreen && nearestEdible) targets.push(nearestEdible);

  const cx = world.w / 2;
  const cy = world.h / 2;
  const inset = 74;

  for (const s of targets.slice(0, 4)) {
    const dx = s.x - cx;
    const dy = s.y - cy;
    const tx = dx > 0 ? (world.w - inset - cx) / dx : dx < 0 ? (inset - cx) / dx : Infinity;
    const ty = dy > 0 ? (world.h - inset - cy) / dy : dy < 0 ? (inset - cy) / dy : Infinity;
    const t = Math.min(tx, ty);
    if (!Number.isFinite(t) || t <= 0) continue;

    const ax = cx + dx * t;
    const ay = cy + dy * t;
    const ang = Math.atan2(dy, dx);
    const pulse = 1 + Math.sin(elapsed * 5) * 0.12;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = 'rgba(255, 205, 70, 0.9)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffdf5e';
    ctx.strokeStyle = 'rgba(150, 92, 0, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-14, -18);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-14, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
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

  buildCity();
  if (activeThings() === 0) {
    // The save caught a fully-eaten city mid-celebration. Resuming an empty
    // world would be a dead end — roll the brand-new city it was owed.
    citySeed = (Math.random() * 0xffffffff) >>> 0;
    cityEaten.clear();
    restoredHoleR = null;
    buildCity();
  }
  hole.reset(field);
  hole.x = cityStart.x;
  hole.y = cityStart.y;
  if (restoredHoleR !== null) {
    // Resuming a half-eaten city: the hole comes back at its earned size.
    hole.r = restoredHoleR;
    hole.rShown = restoredHoleR;
  }
  cam.x = hole.x;
  cam.y = hole.y;
  cam.zoom = CONFIG.camera.maxZoom;

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
    `Ate ${hud.score} thing${hud.score === 1 ? '' : 's'}, gobbled ` +
    `${hud.trophies} whole cit${hud.trophies === 1 ? 'y' : 'ies'}, and met ` +
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
  celebrations.reset();
  particles.clear();
  fx.clear();
  timers.clear();
  things.releaseAll();
  citySeed = (Math.random() * 0xffffffff) >>> 0;
  cityEaten.clear();
  restoredHoleR = null;
  skyPhase = 1;
  skyT = 0;
  background.resetTo(1);
  buildCity();
  hole.reset(field);
  hole.x = cityStart.x;
  hole.y = cityStart.y;
  cam.x = hole.x;
  cam.y = hole.y;
  cam.zoom = CONFIG.camera.maxZoom;
  rebuildPending = false;
  magnetT = 0;
  streakStep = 0;
  lastEatAt = -Infinity;
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
  get cities() { return hud.trophies; },
  get seed() { return citySeed; },
  get hole() { return { x: hole.x, y: hole.y, vx: hole.vx, vy: hole.vy, touching: hole.touching }; },
  get cam() { return { x: cam.x, y: cam.y, zoom: cam.zoom }; },
  get field() { return { w: field.w, h: field.h, mouth: hole.mouth }; },
  get districts() { return Object.fromEntries(districtLeft); },
  get things() {
    const out = [];
    for (const th of things.items) {
      if (th.active) out.push({ id: th.cityId, x: Math.round(th.x), y: Math.round(th.y), size: th.size, tier: th.tier, state: th.state, district: th.district });
    }
    return out;
  },
};

/* --- go --------------------------------------------------------------------- */

resize();
render(); // paint one frame behind the splash so the transition reveals a live scene
