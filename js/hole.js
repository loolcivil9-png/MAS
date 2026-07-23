/* ---------------------------------------------------------------------------
   The Hole — the character he plays.

   A dark ellipse with a glowing rim and googly eyes that chases his finger.
   It is deliberately a *someone*, not a mechanic: it bobs while it waits,
   blinks, squashes happily when it swallows, and boings when it grows.

   The important numbers:
     `r`       the true radius — what actually decides if a thing fits
     `rShown`  the drawn radius, chasing `r` through a spring so growth boings
     `mouth`   how big a thing can be and still go down (r * mouthRatio)
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { TAU, clamp, lerp, hsla } from './util.js';

export class Hole {
  constructor() {
    this.x = 0; this.y = 0;
    this.tx = 0; this.ty = 0;
    this.following = false;
    this.r = CONFIG.hole.baseRadius;
    this.rShown = this.r;
    this.rVel = 0;
    this.gulpT = 0;
    this.t = 0;
    this.lookX = 0; this.lookY = 0;   // smoothed travel direction, drives the eyes
  }

  /** A fresh level: small again, resting in the lower middle of the world. */
  reset(world) {
    this.x = world.w / 2;
    this.y = world.h * 0.62;
    this.tx = this.x;
    this.ty = this.y;
    this.r = CONFIG.hole.baseRadius;
    this.rShown = this.r;
    this.rVel = 0;
    this.gulpT = 0;
    this.following = false;
  }

  /** How big a thing can be and still fit down the hole. */
  get mouth() { return this.r * CONFIG.hole.mouthRatio; }

  setTarget(x, y) { this.tx = x; this.ty = y; this.following = true; }
  release() { this.following = false; }

  grow(amount) { this.r += amount; }

  /** The happy squash-and-stretch right after a swallow. */
  gulp() { this.gulpT = 1; }

  update(dt, world) {
    this.t += dt;
    const H = CONFIG.hole;

    if (this.following) {
      // Frame-rate-independent chase: eager enough to feel obedient, soft
      // enough that the runners are a funny pursuit rather than instant.
      const k = 1 - Math.exp(-H.followK * dt);
      const nx = this.x + (this.tx - this.x) * k;
      const ny = this.y + (this.ty - this.y) * k;
      this.lookX = lerp(this.lookX, nx - this.x, 0.25);
      this.lookY = lerp(this.lookY, ny - this.y, 0.25);
      this.x = nx;
      this.y = ny;
    } else {
      this.lookX *= 0.9;
      this.lookY *= 0.9;
    }

    // Never hides under a notch or wanders out of reach.
    const m = this.rShown * 0.3;
    this.x = clamp(this.x, world.safe.l + m, world.w - world.safe.r - m);
    this.y = clamp(this.y, world.safe.t + m, world.h - world.safe.b - m);

    // The growth spring: rShown boings toward r and settles.
    this.rVel += (this.r - this.rShown) * H.springK * dt;
    this.rVel *= Math.pow(H.springDamp, dt * 60);
    this.rShown += this.rVel * dt;

    if (this.gulpT > 0) this.gulpT = Math.max(0, this.gulpT - dt * 2.4);
  }

  draw(ctx) {
    const H = CONFIG.hole;
    const r = Math.max(6, this.rShown);
    const bob = this.following ? 0 : Math.sin(this.t * 1.8) * H.idleBob;

    const squash = this.gulpT > 0 ? Math.sin(this.gulpT * Math.PI) * H.gulpSquash : 0;

    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.scale(1 + squash, 1 - squash * 0.8);

    // --- soft ground shadow so the hole sits IN the world, not on it ---------
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 1.08, r * 0.9, 0, 0, TAU);
    ctx.fillStyle = 'rgba(20, 12, 50, 0.18)';
    ctx.fill();

    // --- the dark itself -----------------------------------------------------
    const body = ctx.createRadialGradient(0, 0, r * 0.08, 0, 0, r);
    body.addColorStop(0, '#060312');
    body.addColorStop(0.72, '#100a2c');
    body.addColorStop(1, '#221448');
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.82, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();

    // --- slowly turning interior swirls: the hole is *deep* ------------------
    for (let i = 0; i < 3; i++) {
      const a = this.t * (0.9 + i * 0.35) + i * 2.1;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (0.3 + i * 0.2), r * (0.3 + i * 0.2) * 0.82, 0, a, a + 2.2);
      ctx.strokeStyle = `rgba(110, 88, 190, ${0.22 - i * 0.05})`;
      ctx.lineWidth = r * 0.055;
      ctx.stroke();
    }

    // --- glowing rim, cycling gently through the rainbow ---------------------
    const hue = (this.t * 40) % 360;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.04, r * 0.86, 0, 0, TAU);
    ctx.strokeStyle = hsla(hue, 90, 65, 0.28);
    ctx.lineWidth = r * 0.2;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.99, r * 0.81, 0, 0, TAU);
    ctx.strokeStyle = hsla(hue, 95, 72, 0.95);
    ctx.lineWidth = Math.max(2.5, r * 0.07);
    ctx.stroke();

    this.#drawEyes(ctx, r);

    ctx.restore();
  }

  /** Two googly eyes on the upper rim, glancing where the hole is headed. */
  #drawEyes(ctx, r) {
    const eyeR = r * 0.17;
    const sep = r * 0.44;
    const ey = -r * 0.62;

    // A quick blink every few seconds keeps it alive without being busy.
    const bt = this.t % 3.7;
    const blink = bt < 0.14 ? Math.sin((bt / 0.14) * Math.PI) : 0;

    // Pupils drift toward the direction of travel; at rest they peek down
    // into the hole, which reads as "I am hungry".
    const mag = Math.hypot(this.lookX, this.lookY);
    const px = mag > 0.5 ? (this.lookX / mag) * eyeR * 0.38 : 0;
    const py = mag > 0.5 ? (this.lookY / mag) * eyeR * 0.38 : eyeR * 0.3;

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * sep, ey);
      ctx.scale(1, 1 - blink * 0.92);

      ctx.beginPath();
      ctx.arc(0, 0, eyeR, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = eyeR * 0.16;
      ctx.strokeStyle = 'rgba(30, 18, 70, 0.85)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(px, py, eyeR * 0.45, 0, TAU);
      ctx.fillStyle = '#221448';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px - eyeR * 0.13, py - eyeR * 0.15, eyeR * 0.13, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();

      ctx.restore();
    }
  }
}
