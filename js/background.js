/* ---------------------------------------------------------------------------
   The scene behind the game — the world the hole eats its way through.

   Each level has its own sky. He cannot read a level number, so the world
   visibly becoming a different place is what tells him he got somewhere — day
   gives way to sunset, then night with stars and a moon, and so on. The change
   crossfades over a second and a half during the level-up fireworks, so he sees
   it happen rather than finding it already done.
   --------------------------------------------------------------------------- */

import { TAU, rand, lerp, clamp, easeInOutSine, hsla } from './util.js';
import { ROAD_YS, ROAD_WIDTH, AVENUE, PANELS } from './city.js';

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

/** Cheap deterministic 0..1 hash for ground decoration — stable every frame. */
function groundHash(x, y, salt) {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

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

  /**
   * The city ground, drawn in WORLD space under the camera. This is a proper
   * top-down map: solid land, paved city blocks with kerbs, an asphalt
   * parking block with bay lines, a park lawn, roads with centre dashes and
   * zebra crossings. No sky behind the gameplay — the ground IS the scene.
   * Deterministic — no allocation, no stored state, stable across frames.
   * @param {{x: number, y: number, w: number, h: number}} view visible world rect
   * @param {{w: number, h: number}} field world bounds
   */
  drawGround(ctx, view, field) {
    // --- the land: countryside beyond the city, grass inside it --------------
    ctx.fillStyle = '#5a9c52';
    ctx.fillRect(view.x - 8, view.y - 8, view.w + 16, view.h + 16);
    ctx.fillStyle = '#6fb562';
    ctx.fillRect(0, 0, field.w, field.h);

    // --- soft grass mottling, so the land is not one flat green --------------
    const CELL = 240;
    const x0 = Math.floor(view.x / CELL) - 1;
    const y0 = Math.floor(view.y / CELL) - 1;
    const x1 = Math.ceil((view.x + view.w) / CELL) + 1;
    const y1 = Math.ceil((view.y + view.h) / CELL) + 1;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const r1 = groundHash(cx, cy, 1);
        const bx = (cx + groundHash(cx, cy, 2)) * CELL;
        const by = (cy + groundHash(cx, cy, 3)) * CELL;
        ctx.beginPath();
        ctx.ellipse(bx, by, 50 + r1 * 90, (50 + r1 * 90) * 0.6, r1 * TAU, 0, TAU);
        ctx.fillStyle = `rgba(64, 128, 58, ${0.1 + r1 * 0.1})`;
        ctx.fill();
      }
    }

    // --- the city blocks: paved panels with kerbs between the roads ----------
    for (const b of PANELS) {
      const bx = field.w * b.x0;
      const by = field.h * b.y0;
      const bw = field.w * (b.x1 - b.x0);
      const bh = field.h * (b.y1 - b.y0);
      if (by > view.y + view.h || by + bh < view.y) continue;

      if (b.kind === 'lawn') {
        ctx.fillStyle = '#7cc76c';
        ctx.fillRect(bx, by, bw, bh);
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.strokeRect(bx + 3, by + 3, bw - 6, bh - 6);
      } else {
        // The kerb shadow first, then the slab, then a pale kerb line.
        ctx.fillStyle = 'rgba(30, 40, 30, 0.18)';
        ctx.fillRect(bx - 5, by - 5, bw + 10, bh + 10);
        ctx.fillStyle = b.kind === 'asphalt' ? '#a7abbc' : '#ddd8ca';
        ctx.fillRect(bx, by, bw, bh);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.strokeRect(bx + 2.5, by + 2.5, bw - 5, bh - 5);
      }

      // Parking bay lines on the asphalt block, matching the car ranks.
      if (b.kind === 'asphalt') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (const rowY of [0.275, 0.325]) {
          const ry = field.h * rowY;
          for (let i = 0; i <= 11; i++) {
            const lx = field.w * (0.09 + i * 0.075);
            ctx.fillRect(lx - 2.5, ry, 5, field.h * 0.042);
          }
        }
      }
    }

    // --- the roads ------------------------------------------------------------
    const half = ROAD_WIDTH / 2;
    ctx.fillStyle = '#575b70';
    for (const yf of ROAD_YS) {
      ctx.fillRect(0, field.h * yf - half, field.w, ROAD_WIDTH);
    }
    const ax = field.w * AVENUE.x;
    ctx.fillRect(ax - half, field.h * AVENUE.y0, ROAD_WIDTH, field.h * (AVENUE.y1 - AVENUE.y0));

    // Centre dashes, clipped to the visible stretch.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    const DASH = 44;
    const GAP = 46;
    for (const yf of ROAD_YS) {
      const ry = field.h * yf;
      if (ry < view.y - 20 || ry > view.y + view.h + 20) continue;
      const from = Math.max(0, Math.floor(view.x / (DASH + GAP)) * (DASH + GAP));
      for (let x = from; x < Math.min(field.w, view.x + view.w); x += DASH + GAP) {
        ctx.fillRect(x, ry - 3.5, DASH, 7);
      }
    }
    if (ax > view.x - 60 && ax < view.x + view.w + 60) {
      const yStart = Math.max(field.h * AVENUE.y0, Math.floor(view.y / (DASH + GAP)) * (DASH + GAP));
      const yEnd = Math.min(field.h * AVENUE.y1, view.y + view.h);
      for (let y = yStart; y < yEnd; y += DASH + GAP) {
        ctx.fillRect(ax - 3.5, y, 7, DASH);
      }
    }

    // Zebra crossings where the avenue meets each cross-street.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (const yf of ROAD_YS) {
      const ry = field.h * yf;
      if (ry < view.y - 120 || ry > view.y + view.h + 120) continue;
      for (const side of [-1, 1]) {
        const cxx = ax + side * (half + 34);
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(cxx - 11, ry - half + 8 + (i + 2) * ((ROAD_WIDTH - 16) / 5), 22, 9);
        }
      }
    }

    // The edge of the world: a hedge line rather than a wall.
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(43, 84, 40, 0.75)';
    ctx.strokeRect(8, 8, field.w - 16, field.h - 16);
  }

  /**
   * Day and night over the whole scene, screen space, drawn above the world:
   * noon is clear, sunset warms it, night lays a deep blue over the city.
   * Uses the palette's own brightness, so it follows the drifting sky clock.
   */
  drawLightTint(ctx, world) {
    const p = this.palette();
    const darkness = clamp(1 - p.top[2] / 70, 0, 1);
    const alpha = darkness * 0.34;
    if (alpha < 0.01) return;
    ctx.fillStyle = hsla(p.top[0], 55, 26, alpha);
    ctx.fillRect(0, 0, world.w, world.h);
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
