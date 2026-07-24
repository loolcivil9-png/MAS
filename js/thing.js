/* ---------------------------------------------------------------------------
   A thing in the world: sits there looking eatable, wobbles if it is still
   too big, runs away if it is a runner, and spirals down the hole when its
   time comes.

   Emoji are drawn once into small offscreen canvases and blitted from there.
   This is the one place the game allocates after startup, and it matters:
   filling a 300 px colour emoji with `fillText` thirty times a frame drops
   frames on a cheap phone, while `drawImage` of a cached bitmap does not.
   The cache is bounded (a few dozen glyph/size pairs) and reused forever.
   --------------------------------------------------------------------------- */

import { CONFIG, emojiFont } from './config.js';
import { TAU, rand, clamp, easeInCubic, easeOutCubic, hsla } from './util.js';

/* --- emoji sprite cache ------------------------------------------------------ */

const sprites = new Map(); // "glyph@bucket" -> canvas (with .logicalDim)
const OVERSAMPLE = 2;      // crisp on 2x phone screens
const PADDING = 1.35;      // emoji glyphs overhang their em box; leave room

function getSprite(glyph, size) {
  const bucket = Math.min(420, Math.ceil(size / 14) * 14);
  const key = `${glyph}@${bucket}`;
  let c = sprites.get(key);
  if (!c) {
    const dim = Math.ceil(bucket * 2 * PADDING);   // square, in logical units
    c = document.createElement('canvas');
    c.width = c.height = dim * OVERSAMPLE;
    const g = c.getContext('2d');
    g.scale(OVERSAMPLE, OVERSAMPLE);
    g.font = emojiFont(bucket * 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(glyph, dim / 2, dim / 2 + bucket * 0.08);
    c.logicalDim = dim;
    sprites.set(key, c);
  }
  return c;
}

/* --- the entity -------------------------------------------------------------- */

export class Thing {
  constructor() {
    this.active = false;
  }

  /**
   * @param {{glyph: string, name: string, call?: string, runner?: boolean, wander?: boolean}} entry
   * @param {number} tier 0..6 (6 = the landmark)
   * @param {number} size logical radius — the number that decides if it fits
   */
  spawn(entry, tier, size, x, y) {
    this.active = true;
    this.glyph = entry.glyph;
    this.name = entry.name;
    this.call = entry.call ?? null;
    this.runner = !!entry.runner;
    this.wander = !!entry.wander;
    this.tier = tier;
    this.size = size;
    this.x = x;
    this.y = y;

    this.state = 'idle';         // 'idle' | 'swallow'
    this.golden = false;         // set by the city builder
    this.magnet = false;         // set by the city builder
    this.growth = 0;             // set by the city builder (normalized share)

    this.t = rand(0, 100);       // phase offset so the world doesn't wobble in sync
    this.introT = 0;
    this.wobbleT = 0;
    this.boinkCooldown = 0;
    this.fleeVx = 0;
    this.fleeVy = 0;
    this.headA = rand(0, TAU);   // wanderers stroll in this direction...
    this.headT = 0;              // ...and change their mind when this runs out
    this.leanX = 0;              // visual tug toward the hole as it nears
    this.leanY = 0;

    this.swallowT = 0;
    this.depth = 0;              // 0 above ground .. 1 fully down the hole
    this.tumble = 0;
    this.tumbleV = 0;

    this.sprite = getSprite(this.glyph, size);
  }

  /**
   * Down the hatch — as physics, not as an animation. The pit pulls the thing
   * in with ever-stronger gravity; it tips over as it slides, and once it is
   * over the mouth it SINKS, drawn clipped under the hole's rim by main.js.
   */
  startSwallow() {
    this.state = 'swallow';
    this.swallowT = 0;
    this.depth = 0;
    this.tumble = 0;
    this.tumbleV = (Math.random() < 0.5 ? -1 : 1) * rand(2.2, 4);
  }

  /** True once it is falling below the rim — main.js switches to clipped drawing. */
  get sinking() { return this.state === 'swallow' && this.depth > 0.02; }

  /** The friendly "not yet, still too big!" reaction. */
  wobble() {
    this.wobbleT = 1;
    this.boinkCooldown = CONFIG.things.wobbleCooldown;
  }

  /**
   * @param {{w: number, h: number}} bounds the world the thing lives in
   * @returns {'eaten' | null} 'eaten' on the frame the swallow completes.
   */
  update(dt, bounds, hole) {
    const T = CONFIG.things;
    this.t += dt;
    if (this.introT < T.introTime) this.introT += dt;
    if (this.boinkCooldown > 0) this.boinkCooldown -= dt;
    if (this.wobbleT > 0) this.wobbleT = Math.max(0, this.wobbleT - dt * 1.8);

    if (this.state === 'swallow') {
      this.swallowT += dt;

      // The pit's gravity, strengthening as it takes hold — and tracking the
      // live hole centre, since he may still be dragging it around.
      const dx = hole.x - this.x;
      const dy = hole.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = 1600 + 2600 * this.swallowT;
      this.fleeVx += (dx / dist) * pull * dt;
      this.fleeVy += (dy / dist) * pull * dt;
      const sp = Math.hypot(this.fleeVx, this.fleeVy);
      if (sp > 950) {
        this.fleeVx *= 950 / sp;
        this.fleeVy *= 950 / sp;
      }
      this.x += this.fleeVx * dt;
      this.y += this.fleeVy * dt;

      // Tipping over as it slides, then dropping once it is over the mouth.
      this.tumble += this.tumbleV * Math.min(1, this.swallowT * 2.5) * dt;
      if (dist < hole.rShown * 0.6) this.depth += dt * (2.2 + this.swallowT * 2);

      if (this.depth >= 1 || this.swallowT > 2.6) {
        this.active = false;
        return 'eaten';
      }
      return null;
    }

    if (this.wander) this.#stroll(dt, bounds);
    if (this.runner) this.#flee(dt, bounds, hole);

    // Anticipation: as the hole nears, the thing leans toward it — a nervous
    // little tug, purely visual (never touches x/y), so eating distances and
    // the saved city stay exact.
    const R = CONFIG.juice.leanRadius;
    const dx = hole.x - this.x;
    const dy = hole.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const pull = dist < R ? (1 - dist / R) ** 2 : 0;
    const want = this.size * 0.22 * pull;
    const tx = (dx / dist) * want;
    const ty = (dy / dist) * want;
    const k = 1 - Math.exp(-6 * dt);
    this.leanX += (tx - this.leanX) * k;
    this.leanY += (ty - this.leanY) * k;

    return null;
  }

  /** People amble about their day: a slow stroll, a new direction now and then. */
  #stroll(dt, bounds) {
    this.headT -= dt;
    if (this.headT <= 0) {
      this.headA += rand(-1.3, 1.3);
      this.headT = rand(1.2, 3.2);
    }
    this.x += Math.cos(this.headA) * 26 * dt;
    this.y += Math.sin(this.headA) * 26 * dt;
    this.clampInto(bounds);
  }

  /**
   * Runners scoot directly away when the hole closes in — but their top speed
   * is well under the hole's chase speed, so the pursuit is comedy, not
   * challenge. Everything is always catchable.
   */
  #flee(dt, bounds, hole) {
    const T = CONFIG.things;
    const dx = this.x - hole.x;
    const dy = this.y - hole.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < hole.rShown + this.size + T.runnerFleeRadius) {
      this.fleeVx += (dx / dist) * 620 * dt;
      this.fleeVy += (dy / dist) * 620 * dt;
    }

    const sp = Math.hypot(this.fleeVx, this.fleeVy);
    if (sp > T.runnerSpeed) {
      this.fleeVx *= T.runnerSpeed / sp;
      this.fleeVy *= T.runnerSpeed / sp;
    }
    const damp = Math.pow(0.92, dt * 60);
    this.fleeVx *= damp;
    this.fleeVy *= damp;

    this.x += this.fleeVx * dt;
    this.y += this.fleeVy * dt;
    this.clampInto(bounds);
  }

  /** Keeps a thing inside the world. */
  clampInto(bounds) {
    const m = this.size * 0.6;
    this.x = clamp(this.x, m, bounds.w - m);
    this.y = clamp(this.y, m, bounds.h - m);
  }

  draw(ctx) {
    const T = CONFIG.things;

    let scale = 1;
    if (this.introT < T.introTime) {
      const k = easeOutCubic(this.introT / T.introTime);
      scale = 0.3 + 0.7 * k;
    }

    // A gentle individual breath and lean keeps the world alive but calm.
    let rot = Math.sin(this.t * 1.3) * 0.05;
    scale *= 1 + Math.sin(this.t * 2.1) * 0.02;

    if (this.wobbleT > 0) {
      rot += Math.sin(this.wobbleT * 26) * 0.18 * this.wobbleT;
    }

    let sinkY = 0;
    let alpha = 1;
    if (this.state === 'swallow') {
      const d = easeInCubic(clamp(this.depth, 0, 1));
      // A slight squeeze on the way in, then real shrink as it drops from view.
      scale *= (1 - 0.12 * Math.min(1, this.swallowT * 3)) * (1 - 0.85 * d);
      rot += this.tumble;
      sinkY = d * this.size * 1.7;   // falling below the rim
      alpha = 1 - d * 0.65;          // and into the dark
    }

    if (scale <= 0.01) return;

    const J = CONFIG.juice;
    const dim = this.sprite.logicalDim;

    // --- the drop-shadow, on the ground, offset away from the sun. Longer for
    // taller things (buildings loom), so the whole city reads as 3-D. Drawn in
    // world space before the lean, so it stays anchored under the thing.
    if (this.state !== 'swallow') {
      const lift = this.size * (0.32 + this.tier * 0.16) * scale;
      const sx = this.x - J.shadowLightX * lift;
      const sy = this.y - J.shadowLightY * lift + this.size * 0.4 * scale;
      const rx = this.size * (0.62 + this.tier * 0.05) * scale;
      const ry = rx * 0.42;
      ctx.save();
      ctx.fillStyle = `rgba(20, 24, 40, ${J.shadowStrength * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rx * 1.25, ry * 1.25, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(20, 24, 40, ${J.shadowStrength})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x + this.leanX, this.y + this.leanY + sinkY);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    if (this.golden) this.#drawGlow(ctx, 46, 0.4);
    else if (this.magnet) this.#drawGlow(ctx, (this.t * 90) % 360, 0.35);
    ctx.drawImage(this.sprite, -dim / 2, -dim / 2, dim, dim);
    ctx.restore();
  }

  /** The specials announce themselves: a breathing halo behind the emoji. */
  #drawGlow(ctx, hue, strength) {
    const r = this.size * 1.35;
    const pulse = (Math.sin(this.t * 4.2) + 1) / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, this.size * 0.4, 0, 0, r);
    halo.addColorStop(0, hsla(hue, 100, 70, strength * (0.5 + pulse * 0.5)));
    halo.addColorStop(1, hsla(hue, 100, 70, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
