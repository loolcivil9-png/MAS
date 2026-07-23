/* ---------------------------------------------------------------------------
   Hungry Hole — bootstrap and game loop.

   Two coordinate spaces, deliberately kept apart:

     SCREEN  the logical viewport (always 1000 units tall). The sky, the HUD,
             the win confetti and the surprises live here.

     FIELD   the world itself — CONFIG.world.scale screens wide and tall.
             The hole, the things it eats, and their sparkles live here, and
             a camera (position + zoom) maps field to screen. The camera
             rides on the hole and pulls back as it grows.

   Steering is relative: the finger's movement drives the hole's velocity;
   where the finger sits on the glass is irrelevant.
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

/* --- screen space ------------------------------------------------------------ */

/** Logical viewport: always 1000 units tall, width follows the aspect ratio. */
const world = {
  w: 462,
  h: CONFIG.render.logicalHeight,
  safe: { t: 0, r: 0, b: 0, l: 0 },
};

let scale = 1;                                    // device pixels per logical unit
let viewport = { left: 0, top: 0, width: 1, height: 1 };

/* --- field space ------------------------------------------------------------- */

/** The world the hole lives in — several screens big. Sized per level. */
const field = { w: 1000, h: 2200 };

/** The camera: where on the field the screen is looking, and how wide. */
const cam = { x: 500, y: 1100, zoom: CONFIG.camera.maxZoom };

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

/** The field rectangle currently visible on screen. */
function visibleRect() {
  const halfW = (world.w / 2) / cam.zoom;
  const halfH = (world.h / 2) / cam.zoom;
  return { x: cam.x - halfW, y: cam.y - halfH, w: halfW * 2, h: halfH * 2 };
}

/* --- systems ---------------------------------------------------------------- */

const background = new Background();
const particles = new Particles();   // field space: gulp sparkles, rings
const fx = new Particles();          // screen space: confetti, fireworks, trails
const hud = new Hud();
const timers = new Timers();
const celebrations = new Celebrations({ particles, fx, hud, timers, world, background, toScreen });
const surprises = new Surprises(fx);
const hole = new Hole();

const things = new Pool(60, () => new Thing());

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
    // zoom, so dividing by the camera zoom converts it to field units.
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

/* --- building a world -------------------------------------------------------- */

function activeThings() {
  let n = 0;
  for (const th of things.items) if (th.active) n++;
  return n;
}

/**
 * Lays out a fresh world across the whole field: `counts` things per tier,
 * biggest placed first into the roomiest spots (dart-throwing, keep the
 * candidate furthest from the already-placed), one golden growth-spurt
 * thing, and from level 2 a magnet.
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

  // The field spans several screens of the current aspect ratio, and stays
  // fixed for the whole level even if the device rotates mid-way.
  field.w = Math.round(world.w * CONFIG.world.scale);
  field.h = Math.round(world.h * CONFIG.world.scale);

  const list = buildLevelList(background.theme, T.counts);
  list.sort((a, b) => b.tier - a.tier);

  // Wherever the hole currently sits counts as occupied — generously, since
  // its drawn radius may still be spring-shrinking — so a fresh world never
  // opens with something already half-way down the hatch.
  const placed = [{
    x: hole.x,
    y: hole.y,
    size: Math.max(hole.rShown, CONFIG.hole.baseRadius) + T.tierSizes[0],
  }];

  for (const { entry, tier } of list) {
    const size = T.tierSizes[tier];
    const m = size * 0.7;

    let bestX = field.w / 2;
    let bestY = field.h / 2;
    let bestGap = -Infinity;
    for (let i = 0; i < T.placementTries; i++) {
      const x = rand(m, field.w - m);
      const y = rand(m, field.h - m);
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

    const speed = Math.min(680, 160 + dist * 2.2);
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

  checkCleanPlate();
  particles.update(dt, field);
  fx.update(dt, world);
  hud.update(dt, world);
}

function render() {
  // --- screen space: the sky ------------------------------------------------
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  background.draw(ctx, world);
  surprises.draw(ctx);   // behind the world he plays in

  // --- field space, through the camera --------------------------------------
  const z = cam.zoom;
  ctx.setTransform(
    scale * z, 0, 0, scale * z,
    scale * (world.w / 2 - cam.x * z),
    scale * (world.h / 2 - cam.y * z),
  );
  background.drawGround(ctx, visibleRect(), field);
  hole.draw(ctx);
  // Things draw over the hole, so a swallowed one visibly spirals down INTO it.
  const view = visibleRect();
  for (const th of things.items) {
    if (!th.active) continue;
    // Skip anything comfortably outside the camera — the field is big.
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
 * When only a few things remain, gently point at the ones that are off
 * screen. In a world several screens big, "where did the last strawberry
 * go?" must never be a dead end.
 */
function drawGuides(ctx) {
  const remaining = activeThings();
  if (remaining === 0 || remaining > 4) return;

  const cx = world.w / 2;
  const cy = world.h / 2;
  const inset = 74;

  for (const th of things.items) {
    if (!th.active || th.state !== 'idle') continue;
    const s = toScreen(th.x, th.y);
    const onScreen = s.x > -40 && s.x < world.w + 40 && s.y > -40 && s.y < world.h + 40;
    if (onScreen) continue;

    // Walk from the centre toward the target and stop at the screen border.
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

  field.w = Math.round(world.w * CONFIG.world.scale);
  field.h = Math.round(world.h * CONFIG.world.scale);
  hole.reset(field);
  cam.x = hole.x;
  cam.y = hole.y;
  cam.zoom = CONFIG.camera.maxZoom;
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
  fx.clear();
  timers.clear();
  things.releaseAll();
  hole.reset(field);
  cam.x = hole.x;
  cam.y = hole.y;
  cam.zoom = CONFIG.camera.maxZoom;
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
  get hole() { return { x: hole.x, y: hole.y, vx: hole.vx, vy: hole.vy, touching: hole.touching }; },
  get cam() { return { x: cam.x, y: cam.y, zoom: cam.zoom }; },
  get field() { return { w: field.w, h: field.h, mouth: hole.mouth }; },
  get things() {
    const out = [];
    for (const th of things.items) {
      if (th.active) out.push({ x: Math.round(th.x), y: Math.round(th.y), size: th.size, tier: th.tier, state: th.state });
    }
    return out;
  },
};

/* --- go --------------------------------------------------------------------- */

resize();
render(); // paint one frame behind the splash so the transition reveals a live scene
