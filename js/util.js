/* ---------------------------------------------------------------------------
   Small shared helpers: maths, randomness, easing and a fixed-size pool.
   --------------------------------------------------------------------------- */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1));
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* --- easing ---------------------------------------------------------------- */

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Overshoots past 1 then settles — the "boing" of something landing. */
export function easeOutBack(t, overshoot = 1.9) {
  const c3 = overshoot + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + overshoot * p * p;
}

/** Springy wobble that settles at 1. Good for trophies and banners. */
export function easeOutElastic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = TAU / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/* --- colour ---------------------------------------------------------------- */

export const hsla = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${s}%,${l}%,${a})`;

/* --- pooling --------------------------------------------------------------- */

/**
 * A fixed-capacity pool of reusable objects.
 *
 * Nothing is ever allocated after construction, so a two-year-long session and a
 * two-minute one cost the same. When the pool is full, `acquire` recycles the
 * oldest live item rather than growing or failing — for confetti that reads as
 * "the screen is as full as it can get", which is exactly what we want.
 */
export class Pool {
  constructor(capacity, factory) {
    this.capacity = capacity;
    this.items = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.items[i] = factory();
    this.cursor = 0;
  }

  /** Returns a free item, or recycles the oldest one if all are in use. */
  acquire() {
    const { items, capacity } = this;
    for (let i = 0; i < capacity; i++) {
      const idx = (this.cursor + i) % capacity;
      if (!items[idx].active) {
        this.cursor = (idx + 1) % capacity;
        return items[idx];
      }
    }
    const idx = this.cursor;
    this.cursor = (idx + 1) % capacity;
    return items[idx];
  }

  get liveCount() {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.items[i].active) n++;
    return n;
  }

  releaseAll() {
    for (let i = 0; i < this.capacity; i++) this.items[i].active = false;
  }
}

/* --- timers ---------------------------------------------------------------- */

/**
 * Delayed callbacks driven by the game loop rather than setTimeout, so they
 * pause with the game and never fire against a stale world.
 */
export class Timers {
  constructor() { this.list = []; }

  after(seconds, fn) { this.list.push({ t: seconds, fn }); }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].t -= dt;
      if (list[i].t <= 0) {
        const { fn } = list[i];
        list.splice(i, 1);
        fn();
      }
    }
  }

  clear() { this.list.length = 0; }
}
