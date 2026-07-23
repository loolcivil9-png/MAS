/* ---------------------------------------------------------------------------
   Bubble Zoo — bootstrap and game loop.

   Owns the canvas, the logical coordinate space, the bubble population and the
   glue between input, celebrations and the grown-ups menu.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { Pool, Timers, clamp } from './util.js';
import { Background } from './background.js';
import { Bubble } from './bubble.js';
import { FreedCreature } from './creaturePop.js';
import { Particles } from './particles.js';
import { Hud } from './hud.js';
import { Celebrations } from './celebrate.js';
import { audio } from './audio.js';
import { attachInput, suppressBrowserGestures } from './input.js';

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

const bubbles = new Pool(20, () => new Bubble());
const freed = new Pool(28, () => new FreedCreature());

let running = false;
let started = false;
let rafId = 0;
let lastFrame = 0;
let spawnTimer = 0;
let wakeLock = null;

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

  // Nudge any bubble that the new width left hanging off the edge.
  for (const b of bubbles.items) {
    if (b.active) b.homeX = clamp(b.homeX, b.r * 0.62, Math.max(b.r * 0.62, world.w - b.r * 0.62));
  }
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

function onPoint(x, y, kind) {
  if (!running) return;

  let hitAny = false;
  for (const b of bubbles.items) {
    if (!b.active || !b.contains(x, y)) continue;
    b.active = false;          // before anything else, so one touch pops it once
    popBubble(b);
    hitAny = true;
  }

  // Touching empty screen still gets an answer. Nothing he does is ever ignored.
  if (!hitAny && kind === 'down') {
    celebrations.onMiss(x, y);
  } else if (hitAny && visibleBubbles() === 0) {
    // He cleared the whole screen in one smear. Refill right here rather than
    // waiting for the next update, so not even a single frame gets drawn empty.
    spawnBubble('low');
    spawnTimer = 0.1;
  }
}

function popBubble(b) {
  celebrations.onPop(b);
  const creature = freed.acquire();
  creature.spawn(b.x, b.y, b.creature, b.r * 1.12);
}

attachInput(canvas, toWorld, onPoint);
suppressBrowserGestures(document);

/* --- bubble population ------------------------------------------------------ */

function liveBubbles() {
  let n = 0;
  for (const b of bubbles.items) if (b.active) n++;
  return n;
}

/** Bubbles at least partly in view right now — not the ones still climbing up. */
function visibleBubbles() {
  let n = 0;
  for (const b of bubbles.items) {
    if (b.active && b.y - b.r < world.h && b.y + b.r > 0) n++;
  }
  return n;
}

function isDuplicate(bubble) {
  for (const o of bubbles.items) {
    if (o !== bubble && o.active && o.creature === bubble.creature) return true;
  }
  return false;
}

/**
 * Smallest edge-to-edge gap between this bubble and any other live one.
 * Negative means they overlap; Infinity means it has the sky to itself.
 */
function smallestGap(bubble) {
  let min = Infinity;
  for (const o of bubbles.items) {
    if (o === bubble || !o.active) continue;
    const gap = Math.hypot(o.x - bubble.x, o.y - bubble.y) - (o.r + bubble.r);
    if (gap < min) min = gap;
  }
  return min;
}

function spawnBubble(place = 'below') {
  const b = bubbles.acquire();

  // Re-roll a few times to avoid two of the same animal on screen at once.
  // Early on only a dozen creatures have unlocked, so collisions are common and
  // a screen with two identical dogs on it looks like a bug.
  for (let attempt = 0; attempt < 8; attempt++) {
    b.spawn(world, hud.score, { place });
    if (!isDuplicate(b)) break;
  }

  // Then throw darts and keep the roomiest spot. Purely random placement is
  // what made them pile on top of each other — in a space this narrow, clumping
  // is the *likely* outcome of uniform random, not the unlucky one.
  let bestX = b.x;
  let bestY = b.y;
  let bestGap = -Infinity;
  for (let i = 0; i < CONFIG.bubble.placementTries; i++) {
    b.place(world, place);
    const gap = smallestGap(b);
    if (gap > bestGap) { bestGap = gap; bestX = b.x; bestY = b.y; }
    if (gap === Infinity) break; // nothing to avoid
  }
  b.homeX = bestX;
  b.x = bestX;
  b.y = bestY;

  return b;
}

/** Opens with a full screen of well-spaced bubbles rather than an empty sky. */
function fillScreen() {
  for (let i = 0; i < CONFIG.bubble.maxOnScreen; i++) spawnBubble('anywhere');
}

function manageBubbles(dt) {
  const B = CONFIG.bubble;

  spawnTimer -= dt;

  const visible = visibleBubbles();
  const live = liveBubbles();

  // An empty screen ignores the spawn timer entirely — it is the one state the
  // game must never sit in, even for a fraction of a second.
  if (visible === 0 && live < B.maxOnScreen + 2) {
    spawnBubble('low');
    spawnTimer = 0.1;
    return;
  }

  if (spawnTimer > 0) return;

  // Hard floor: the screen must never be empty. A bubble spawned below the
  // edge takes several seconds to climb into reach, so after he clears the
  // screen with one big smear, waiting for the normal pipeline would leave him
  // staring at nothing. Put these straight into the lower part of the screen
  // instead, where they read as having just risen in.
  if (visible < B.minVisible && live < B.maxOnScreen + 2) {
    spawnBubble('low');
    spawnTimer = 0.12;
    return;
  }

  if (live < B.maxOnScreen) {
    spawnBubble('below');
    spawnTimer = live < B.minOnScreen ? B.spawnInterval * 0.35 : B.spawnInterval;
  }
}

/**
 * Nudges overlapping bubbles apart, sideways only.
 *
 * Spawning them in roomy spots is not enough on its own — they rise at very
 * different speeds and sway independently, so any well-spaced screenful slowly
 * converges into a pile. This keeps them readable as separate targets. Only
 * `homeX` is touched, so their rise speeds stay exactly as designed.
 *
 * Tuned by `separationMargin` and `separationSpeed` in config.js.
 */
function separateBubbles(dt) {
  const B = CONFIG.bubble;
  const items = bubbles.items;

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (!a.active) continue;

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (!b.active) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const want = (a.r + b.r) * B.separationMargin;
      const overlap = want - dist;
      if (overlap <= 0) continue;

      // Proportional to how badly they crowd each other, so it eases off
      // rather than snapping them apart.
      const push = (overlap / want) * B.separationSpeed * dt;
      const dir = dx !== 0 ? Math.sign(dx) : 1;
      a.homeX -= dir * push;
      b.homeX += dir * push;
    }
  }

  for (const b of items) {
    if (!b.active) continue;
    const edge = b.r * 0.62;
    b.homeX = clamp(b.homeX, edge, Math.max(edge, world.w - edge));
  }
}

/* --- loop ------------------------------------------------------------------- */

function update(dt) {
  timers.update(dt);
  background.update(dt);
  manageBubbles(dt);

  for (const b of bubbles.items) if (b.active) b.update(dt, world);
  separateBubbles(dt);
  for (const c of freed.items) if (c.active) c.update(dt, world);

  particles.update(dt, world);
  hud.update(dt, world);
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  background.draw(ctx, world);
  hud.drawFlash(ctx, world);

  for (const b of bubbles.items) if (b.active) b.draw(ctx);
  for (const c of freed.items) if (c.active) c.draw(ctx);

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

  fillScreen();
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
  const elapsed = (performance.now() - holdStart) / 1000;
  const p = clamp(elapsed / CONFIG.gate.holdSeconds, 0, 1);
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
    `Popped ${hud.score} bubble${hud.score === 1 ? '' : 's'} and won ` +
    `${hud.trophies} time${hud.trophies === 1 ? '' : 's'} this session.`;
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
  hud.reset();
  celebrations.reset();   // also snaps the sky back to level 1
  particles.clear();
  timers.clear();
  bubbles.releaseAll();
  freed.releaseAll();
  spawnTimer = 0;
  fillScreen();
  closeParentMenu();
});

/* --- offline ---------------------------------------------------------------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* --- go --------------------------------------------------------------------- */

resize();
render(); // paint one frame behind the splash so the transition reveals a live scene
