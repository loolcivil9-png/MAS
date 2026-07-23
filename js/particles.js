/* ---------------------------------------------------------------------------
   Every bit of flying colour: pop sparkles, bubble shards, shockwave rings,
   confetti and firework sparks.

   All five share one pooled, flat object shape and one update loop. Nothing is
   allocated after start-up, so a forty-minute session costs exactly what a
   forty-second one does.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { TAU, Pool, rand, randInt, easeOutCubic, hsla } from './util.js';

const SPARKLE = 0;
const CONFETTI = 1;
const SPARK = 2;
const RING = 3;
const SHARD = 4;

const makeParticle = () => ({
  active: false,
  type: SPARKLE,
  x: 0, y: 0, vx: 0, vy: 0,
  life: 0, maxLife: 1,
  size: 1, size2: 1,
  hue: 0, sat: 90, lum: 70,
  rot: 0, vrot: 0,
  grav: 0, drag: 1,
  fade: 1,
});

export class Particles {
  constructor() {
    this.pool = new Pool(CONFIG.particles.max, makeParticle);
  }

  get count() { return this.pool.liveCount; }
  clear() { this.pool.releaseAll(); }

  /* --- emitters ----------------------------------------------------------- */

  /** The every-pop reward: a quick bloom of glitter in the bubble's colour. */
  sparkleBurst(x, y, hue, count = CONFIG.particles.popSparkles) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const speed = rand(90, 400);
      const p = this.pool.acquire();
      p.active = true;
      p.type = SPARKLE;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.maxLife = p.life = rand(0.35, 0.75);
      p.size = rand(5, 13);
      p.hue = hue + rand(-28, 28);
      p.sat = 100; p.lum = rand(72, 92);
      p.grav = 260;
      p.drag = 0.94;
      p.rot = rand(0, TAU);
      p.vrot = rand(-6, 6);
    }
  }

  /** The bubble's skin coming apart — sells the pop far better than glitter alone. */
  bubbleShards(x, y, radius, hue) {
    const n = randInt(7, 10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2);
      const speed = rand(160, 330);
      const p = this.pool.acquire();
      p.active = true;
      p.type = SHARD;
      p.x = x + Math.cos(a) * radius * 0.85;
      p.y = y + Math.sin(a) * radius * 0.85;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.maxLife = p.life = rand(0.28, 0.5);
      p.size = radius * rand(0.16, 0.3);
      p.hue = hue + rand(-20, 40);
      p.sat = 95; p.lum = 85;
      p.grav = 420;
      p.drag = 0.93;
      p.rot = a;
      p.vrot = rand(-8, 8);
    }
  }

  /** Expanding shockwave. One per pop, plus bigger ones during celebrations. */
  ringWave(x, y, hue, from = 8, to = 150, life = 0.45) {
    const p = this.pool.acquire();
    p.active = true;
    p.type = RING;
    p.x = x; p.y = y;
    p.vx = p.vy = 0;
    p.maxLife = p.life = life;
    p.size = from; p.size2 = to;
    p.hue = hue; p.sat = 100; p.lum = 88;
    p.grav = 0; p.drag = 1;
  }

  /** Paper falling from above the top edge. The every-5-pops reward. */
  confettiShower(world, count = CONFIG.particles.confettiPerShower, spread = 1) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      p.active = true;
      p.type = CONFETTI;
      p.x = rand(-world.w * 0.05, world.w * 1.05);
      p.y = rand(-world.h * 0.45 * spread, -20);
      p.vx = rand(-60, 60);
      p.vy = rand(120, 300);
      p.maxLife = p.life = rand(2.6, 4.4);
      p.size = rand(11, 22);
      p.hue = rand(0, 360);
      p.sat = 92; p.lum = 62;
      p.grav = 130;
      p.drag = 0.995;
      p.rot = rand(0, TAU);
      p.vrot = rand(-9, 9);
    }
  }

  /** One firework burst. Additive sparks that arc and fade. */
  firework(x, y, hue, count = CONFIG.particles.fireworkSparks) {
    this.ringWave(x, y, hue, 10, 260, 0.55);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rand(-0.08, 0.08);
      // Two shells at different speeds gives the burst some depth.
      const speed = rand(220, 560) * (i % 3 === 0 ? 0.62 : 1);
      const p = this.pool.acquire();
      p.active = true;
      p.type = SPARK;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.maxLife = p.life = rand(0.7, 1.35);
      p.size = rand(4, 9);
      p.hue = hue + rand(-35, 35);
      p.sat = 100; p.lum = rand(70, 92);
      p.grav = 300;
      p.drag = 0.955;
    }
  }

  /* --- simulation --------------------------------------------------------- */

  update(dt, world) {
    const items = this.pool.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }

      if (p.type !== RING) {
        p.vy += p.grav * dt;
        // Frame-rate independent drag, so a 120 Hz phone behaves like a 60 Hz one.
        const f = Math.pow(p.drag, dt * 60);
        p.vx *= f; p.vy *= f;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        // Confetti falls well past the bottom before it is worth recycling.
        if (p.y > world.h + 120) p.active = false;
      }
    }
  }

  /* --- rendering ---------------------------------------------------------- */

  draw(ctx) {
    const items = this.pool.items;

    // Pass 1: normal blending.
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      if (p.type === CONFETTI) this.#drawConfetti(ctx, p);
      else if (p.type === SHARD) this.#drawShard(ctx, p);
      else if (p.type === RING) this.#drawRing(ctx, p);
    }

    // Pass 2: additive, so overlapping glitter blooms white instead of muddying.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      if (p.type === SPARKLE) this.#drawSparkle(ctx, p);
      else if (p.type === SPARK) this.#drawSpark(ctx, p);
    }
    ctx.restore();
  }

  #drawSparkle(ctx, p) {
    const t = p.life / p.maxLife;
    const s = p.size * t;
    ctx.fillStyle = hsla(p.hue, p.sat, p.lum, t * 0.95);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // Four-point star: much more legible at small sizes than a circle.
    ctx.beginPath();
    ctx.moveTo(0, -s * 2.1);
    ctx.quadraticCurveTo(0, 0, s * 2.1, 0);
    ctx.quadraticCurveTo(0, 0, 0, s * 2.1);
    ctx.quadraticCurveTo(0, 0, -s * 2.1, 0);
    ctx.quadraticCurveTo(0, 0, 0, -s * 2.1);
    ctx.fill();
    ctx.restore();
  }

  #drawSpark(ctx, p) {
    const t = p.life / p.maxLife;
    // A short trail along the direction of travel reads as speed.
    const len = Math.min(34, Math.hypot(p.vx, p.vy) * 0.035);
    const nx = p.vx || 1;
    const ny = p.vy || 0;
    const mag = Math.hypot(nx, ny) || 1;

    ctx.strokeStyle = hsla(p.hue, p.sat, p.lum, t * 0.9);
    ctx.lineWidth = p.size * t;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - (nx / mag) * len, p.y - (ny / mag) * len);
    ctx.stroke();
  }

  #drawConfetti(ctx, p) {
    const t = p.life / p.maxLife;
    const alpha = t > 0.25 ? 1 : t / 0.25;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // Flattening on one axis makes each piece look like it is tumbling.
    ctx.scale(1, Math.max(0.12, Math.abs(Math.cos(p.rot * 1.6))));
    ctx.fillStyle = hsla(p.hue, p.sat, p.lum, alpha);
    ctx.fillRect(-p.size * 0.35, -p.size * 0.5, p.size * 0.7, p.size);
    ctx.restore();
  }

  #drawShard(ctx, p) {
    const t = p.life / p.maxLife;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.strokeStyle = hsla(p.hue, p.sat, p.lum, t * 0.85);
    ctx.lineWidth = Math.max(1, p.size * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, p.size, -0.7, 0.7);
    ctx.stroke();
    ctx.restore();
  }

  #drawRing(ctx, p) {
    const t = 1 - p.life / p.maxLife;
    const r = p.size + (p.size2 - p.size) * easeOutCubic(t);
    ctx.strokeStyle = hsla(p.hue, p.sat, p.lum, (1 - t) * 0.75);
    ctx.lineWidth = Math.max(1.5, 10 * (1 - t));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.stroke();
  }
}
