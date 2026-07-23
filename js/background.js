/* ---------------------------------------------------------------------------
   The scene behind the game — the world the hole eats its way through.

   Each level has its own sky. He cannot read a level number, so the world
   visibly becoming a different place is what tells him he got somewhere — day
   gives way to sunset, then night with stars and a moon, and so on. The change
   crossfades over a second and a half during the level-up fireworks, so he sees
   it happen rather than finding it already done.
   --------------------------------------------------------------------------- */

import { TAU, rand, lerp, clamp, easeInOutSine, hsla } from './util.js';

const CLOUD_COUNT = 7;
const STAR_COUNT = 70;
const TRANSITION_SECONDS = 1.5;

/**
 * One sky. Colours are [hue, saturation, lightness] so they can be interpolated
 * component by component. `sun.alpha` doubles as the moon at night — same glow,
 * smaller and colder.
 */
const PALETTES = [
  { // 1 — bright day
    theme: 'day',
    top: [198, 78, 70], mid: [193, 72, 81], bot: [45, 82, 87],
    hillFar: [128, 44, 62], hillNear: [122, 52, 50],
    cloud: [0, 0, 100], cloudAlpha: 0.62,
    sun: { hue: 48, lum: 92, alpha: 0.85, size: 0.34, y: 0.17 },
    starAlpha: 0,
  },
  { // 2 — sunset
    theme: 'sunset',
    top: [258, 52, 54], mid: [14, 86, 71], bot: [38, 96, 76],
    hillFar: [275, 30, 48], hillNear: [268, 34, 34],
    cloud: [20, 80, 82], cloudAlpha: 0.5,
    sun: { hue: 24, lum: 74, alpha: 0.95, size: 0.42, y: 0.62 },
    starAlpha: 0.25,
  },
  { // 3 — night
    theme: 'night',
    top: [237, 62, 16], mid: [242, 54, 28], bot: [250, 44, 40],
    hillFar: [244, 38, 24], hillNear: [246, 42, 15],
    cloud: [240, 40, 45], cloudAlpha: 0.34,
    sun: { hue: 210, lum: 96, alpha: 0.7, size: 0.16, y: 0.15 },
    starAlpha: 1,
  },
  { // 4 — dawn
    theme: 'day',
    top: [222, 68, 60], mid: [288, 58, 76], bot: [30, 92, 83],
    hillFar: [168, 40, 56], hillNear: [162, 46, 42],
    cloud: [320, 60, 88], cloudAlpha: 0.55,
    sun: { hue: 340, lum: 86, alpha: 0.8, size: 0.36, y: 0.48 },
    starAlpha: 0.35,
  },
  { // 5 — deep sea
    theme: 'sea',
    top: [196, 72, 46], mid: [182, 66, 62], bot: [166, 60, 78],
    hillFar: [176, 48, 46], hillNear: [186, 54, 32],
    cloud: [190, 55, 88], cloudAlpha: 0.4,
    sun: { hue: 180, lum: 92, alpha: 0.6, size: 0.40, y: 0.12 },
    starAlpha: 0.15,
  },
  { // 6 — candy
    theme: 'candy',
    top: [302, 72, 74], mid: [332, 84, 83], bot: [50, 92, 88],
    hillFar: [318, 62, 76], hillNear: [340, 70, 66],
    cloud: [0, 0, 100], cloudAlpha: 0.7,
    sun: { hue: 56, lum: 94, alpha: 0.8, size: 0.32, y: 0.2 },
    starAlpha: 0,
  },
  { // 7 — outer space
    theme: 'space',
    top: [252, 62, 8], mid: [258, 56, 15], bot: [266, 50, 24],
    hillFar: [256, 40, 20], hillNear: [260, 44, 12],
    cloud: [255, 35, 42], cloudAlpha: 0.22,
    sun: { hue: 200, lum: 86, alpha: 0.55, size: 0.24, y: 0.2 },
    starAlpha: 1,
  },
  { // 8 — snow
    theme: 'snow',
    top: [205, 48, 76], mid: [200, 42, 85], bot: [195, 32, 92],
    hillFar: [205, 26, 86], hillNear: [210, 30, 78],
    cloud: [0, 0, 100], cloudAlpha: 0.8,
    sun: { hue: 55, lum: 96, alpha: 0.5, size: 0.3, y: 0.17 },
    starAlpha: 0,
  },
  { // 9 — jungle
    theme: 'jungle',
    top: [150, 48, 38], mid: [122, 52, 52], bot: [78, 62, 68],
    hillFar: [132, 55, 27], hillNear: [136, 60, 17],
    cloud: [100, 30, 85], cloudAlpha: 0.45,
    sun: { hue: 48, lum: 90, alpha: 0.75, size: 0.3, y: 0.14 },
    starAlpha: 0,
  },
];

/** Shortest way round the colour wheel, so a crossfade never sweeps the rainbow. */
function lerpHue(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

const lerpHsl = (a, b, t) => [lerpHue(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function lerpPalette(a, b, t) {
  return {
    top: lerpHsl(a.top, b.top, t),
    mid: lerpHsl(a.mid, b.mid, t),
    bot: lerpHsl(a.bot, b.bot, t),
    hillFar: lerpHsl(a.hillFar, b.hillFar, t),
    hillNear: lerpHsl(a.hillNear, b.hillNear, t),
    cloud: lerpHsl(a.cloud, b.cloud, t),
    cloudAlpha: lerp(a.cloudAlpha, b.cloudAlpha, t),
    sun: {
      hue: lerpHue(a.sun.hue, b.sun.hue, t),
      lum: lerp(a.sun.lum, b.sun.lum, t),
      alpha: lerp(a.sun.alpha, b.sun.alpha, t),
      size: lerp(a.sun.size, b.sun.size, t),
      y: lerp(a.sun.y, b.sun.y, t),
    },
    starAlpha: lerp(a.starAlpha, b.starAlpha, t),
  };
}

export class Background {
  constructor() {
    this.t = 0;

    this.from = PALETTES[0];
    this.to = PALETTES[0];
    this.blend = 1;

    this.clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      this.clouds.push({
        x: rand(0, 1),
        y: rand(0.06, 0.44),
        scale: rand(0.55, 1.35),
        speed: rand(0.006, 0.022),
        puffs: Math.round(rand(3, 5)),
        alpha: rand(0.55, 1),
        seed: rand(0, TAU),
      });
    }

    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this.stars.push({
        x: rand(0, 1),
        y: rand(0, 0.72),      // never behind the hills
        r: rand(0.6, 2.4),
        phase: rand(0, TAU),
        speed: rand(0.7, 2.4),
      });
    }
  }

  /** Crossfade to this level's sky. Level 1 is the first palette; then it cycles. */
  setLevel(level) {
    const next = PALETTES[(Math.max(1, level) - 1) % PALETTES.length];
    if (next === this.to) return;
    // Snapshot wherever we currently are, so a level passed mid-fade still
    // starts its new fade from what is actually on screen.
    this.from = this.palette();
    this.to = next;
    this.blend = 0;
  }

  /** Jump straight to a level with no transition — used when restarting. */
  resetTo(level) {
    this.to = this.from = PALETTES[(Math.max(1, level) - 1) % PALETTES.length];
    this.blend = 1;
  }

  /** The theme tag of the sky being shown (or faded toward) — picks which
      world's things fill the level, so the sky change means something. */
  get theme() { return this.to.theme; }

  palette() {
    if (this.blend >= 1) return this.to;
    return lerpPalette(this.from, this.to, easeInOutSine(this.blend));
  }

  update(dt) {
    this.t += dt;
    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt / TRANSITION_SECONDS);

    for (const c of this.clouds) {
      // Nearer (bigger) clouds move faster — cheap parallax.
      c.x += c.speed * c.scale * dt * 0.35;
      if (c.x > 1.35) c.x = -0.35;
    }
  }

  draw(ctx, world) {
    const { w, h } = world;
    const p = this.palette();

    this.#drawSky(ctx, w, h, p);
    if (p.starAlpha > 0.01) this.#drawStars(ctx, w, h, p);
    this.#drawSun(ctx, w, h, p);
    this.#drawClouds(ctx, w, h, p);
    this.#drawHills(ctx, w, h, p);
  }

  #drawSky(ctx, w, h, p) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, hsla(...p.top));
    g.addColorStop(0.45, hsla(...p.mid));
    g.addColorStop(1.0, hsla(...p.bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  #drawStars(ctx, w, h, p) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      const twinkle = 0.45 + 0.55 * (Math.sin(this.t * s.speed + s.phase) * 0.5 + 0.5);
      ctx.fillStyle = `rgba(255, 252, 232, ${clamp(p.starAlpha * twinkle, 0, 1) * 0.9})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r * (h / 1000) * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  #drawSun(ctx, w, h, p) {
    // Drifts across as the levels advance, so consecutive skies do not look
    // like the same picture recoloured.
    const x = w * (0.28 + 0.44 * ((this.t * 0.004) % 1));
    const y = h * p.sun.y;
    const r = h * p.sun.size;

    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hsla(p.sun.hue, 100, p.sun.lum, p.sun.alpha));
    g.addColorStop(0.34, hsla(p.sun.hue, 100, p.sun.lum - 8, p.sun.alpha * 0.38));
    g.addColorStop(1, hsla(p.sun.hue, 100, p.sun.lum - 12, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  #drawClouds(ctx, w, h, p) {
    ctx.save();
    for (const c of this.clouds) {
      const cx = c.x * w * 1.7 - w * 0.35;
      const cy = c.y * h;
      const base = h * 0.055 * c.scale;

      ctx.fillStyle = hsla(p.cloud[0], p.cloud[1], p.cloud[2], c.alpha * p.cloudAlpha);
      ctx.beginPath();
      for (let i = 0; i < c.puffs; i++) {
        const spread = (i - (c.puffs - 1) / 2) * base * 1.05;
        // Slightly irregular puffs so no two clouds look stamped from the same die.
        const rr = base * (0.72 + 0.42 * Math.abs(Math.cos(c.seed + i * 1.7)));
        const lift = Math.sin(c.seed + i * 2.3) * base * 0.22;
        ctx.moveTo(cx + spread + rr, cy + lift);
        ctx.arc(cx + spread, cy + lift, rr, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  #drawHills(ctx, w, h, p) {
    // Short enough that bubbles rising from the bottom edge are visible at once.
    this.#hill(ctx, w, h, h * 0.90, h * 0.030, 1.7, 0.0, hsla(...p.hillFar, 0.9));
    this.#hill(ctx, w, h, h * 0.955, h * 0.024, 2.6, 1.3, hsla(...p.hillNear, 0.97));
  }

  #hill(ctx, w, h, baseY, amp, freq, offset, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      const y = baseY - Math.sin((i / steps) * freq * TAU + offset) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
}
