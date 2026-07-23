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
   * @param {{glyph: string, name: string, call?: string, runner?: boolean}} entry
   * @param {number} tier 0..4 (4 = the landmark)
   * @param {number} size logical radius — the number that decides if it fits
   */
  spawn(entry, tier, size, x, y) {
    this.active = true;
    this.glyph = entry.glyph;
    this.name = entry.name;
    this.call = entry.call ?? null;
    this.runner = !!entry.runner;
    this.tier = tier;
    this.size = size;
    this.x = x;
    this.y = y;

    this.state = 'idle';         // 'idle' | 'swallow'
    this.golden = false;         // set by the level builder
    this.magnet = false;         // set by the level builder
    this.growth = 0;             // set by the level builder (normalized share)

    this.t = rand(0, 100);       // phase offset so the world doesn't wobble in sync
    this.introT = 0;
    this.wobbleT = 0;
    this.boinkCooldown = 0;
    this.fleeVx = 0;
    this.fleeVy = 0;

    this.swallowT = 0;
    this.swallowDur = 1;
    this.swAngle = 0;
    this.swDist = 0;

    this.sprite = getSprite(this.glyph, size);
  }

  /** Down the hatch. Captures where it is relative to the (moving) hole. */
  startSwallow(hole) {
    this.state = 'swallow';
    const dx = this.x - hole.x;
    const dy = this.y - hole.y;
    this.swAngle = Math.atan2(dy, dx);
    this.swDist = Math.hypot(dx, dy);
    this.swallowT = 0;
    this.swallowDur = CONFIG.things.swallowBase + this.size * CONFIG.things.swallowPerSize;
  }

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
      this.swAngle += T.spin * dt;
      const p = clamp(this.swallowT / this.swallowDur, 0, 1);
      // Tracks the live hole centre — he may still be dragging it around.
      const d = this.swDist * (1 - easeInCubic(p));
      this.x = hole.x + Math.cos(this.swAngle) * d;
      this.y = hole.y + Math.sin(this.swAngle) * d;
      if (p >= 1) {
        this.active = false;
        return 'eaten';
      }
      return null;
    }

    if (this.runner) this.#flee(dt, bounds, hole);

    return null;
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

    if (this.state === 'swallow') {
      const p = clamp(this.swallowT / this.swallowDur, 0, 1);
      scale *= 1 - easeInCubic(p);
      rot += p * 2.4; // a visible twirl on the way down
    }

    if (scale <= 0.01) return;

    const dim = this.sprite.logicalDim;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Ground shadow, drawn unrotated so it stays under the thing.
    if (this.state !== 'swallow') {
      ctx.beginPath();
      ctx.ellipse(0, this.size * 0.82 * scale, this.size * 0.66 * scale, this.size * 0.16 * scale, 0, 0, TAU);
      ctx.fillStyle = 'rgba(28, 18, 66, 0.16)';
      ctx.fill();
    }

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
