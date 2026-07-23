/* ---------------------------------------------------------------------------
   The scene behind the bubbles: a sky that very slowly changes colour, a warm
   sun glow, drifting clouds and two layers of rolling hills.

   Deliberately calm and low-contrast. The bubbles and the celebrations are the
   things that should grab his eye; this only has to be pleasant.
   --------------------------------------------------------------------------- */

import { TAU, rand, lerp, hsla } from './util.js';

const CLOUD_COUNT = 7;
const SKY_CYCLE_SECONDS = 150; // one full lap of the palette

export class Background {
  constructor() {
    this.t = 0;
    this.clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      this.clouds.push({
        x: rand(0, 1),          // 0..1 across the world, wraps
        y: rand(0.06, 0.44),    // 0..1 down the world
        scale: rand(0.55, 1.35),
        speed: rand(0.006, 0.022),
        puffs: Math.round(rand(3, 5)),
        alpha: rand(0.3, 0.62),
        seed: rand(0, TAU),
      });
    }
  }

  update(dt) {
    this.t += dt;
    for (const c of this.clouds) {
      // Nearer (bigger) clouds move faster — cheap parallax.
      c.x += c.speed * c.scale * dt * 0.35;
      if (c.x > 1.35) c.x = -0.35;
    }
  }

  draw(ctx, world) {
    const { w, h } = world;
    // Ease back and forth across the palette instead of snapping at the wrap.
    const phase = (Math.sin((this.t / SKY_CYCLE_SECONDS) * TAU) + 1) / 2;

    this.#drawSky(ctx, w, h, phase);
    this.#drawSun(ctx, w, h, phase);
    this.#drawClouds(ctx, w, h);
    this.#drawHills(ctx, w, h, phase);
  }

  #drawSky(ctx, w, h, phase) {
    const topHue = lerp(198, 232, phase);      // sky blue → soft violet
    const midHue = lerp(190, 300, phase);
    const botHue = lerp(45, 330, phase);       // warm sand → soft pink

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, hsla(topHue, 78, 70));
    g.addColorStop(0.45, hsla(midHue, 72, 80));
    g.addColorStop(1.0, hsla(botHue, 82, 86));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  #drawSun(ctx, w, h, phase) {
    const x = w * lerp(0.22, 0.78, phase);
    const y = h * 0.17;
    const r = h * 0.34;

    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 250, 214, 0.85)');
    g.addColorStop(0.35, 'rgba(255, 238, 170, 0.34)');
    g.addColorStop(1, 'rgba(255, 232, 160, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  #drawClouds(ctx, w, h) {
    ctx.save();
    for (const c of this.clouds) {
      const cx = c.x * w * 1.7 - w * 0.35;
      const cy = c.y * h;
      const base = h * 0.055 * c.scale;

      ctx.fillStyle = `rgba(255,255,255,${c.alpha})`;
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

  #drawHills(ctx, w, h, phase) {
    // Far hills, then near hills — both short enough that bubbles rising from
    // the bottom edge are visible immediately.
    this.#hill(ctx, w, h, h * 0.90, h * 0.030, 1.7, 0.0, hsla(lerp(128, 158, phase), 44, 62, 0.85));
    this.#hill(ctx, w, h, h * 0.955, h * 0.024, 2.6, 1.3, hsla(lerp(122, 150, phase), 52, 50, 0.95));
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
