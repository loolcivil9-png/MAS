/* ---------------------------------------------------------------------------
   The Hole — the character he plays.

   A dark ellipse with a glowing rim and googly eyes. It is deliberately a
   *someone*, not a mechanic: it bobs while it waits, blinks, squashes happily
   when it swallows, and boings when it grows.

   Steering is RELATIVE, like a thumb-stick. The finger's *movement* commands
   a velocity — its position on the glass means nothing — so a small hand can
   drive from the corner of the screen without ever covering the action.
   Hold still and the hole eases to a stop; let go and it glides out.

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
    this.vx = 0; this.vy = 0;
    this.inX = 0; this.inY = 0;   // finger movement gathered this frame
    this.touching = false;
    this.r = CONFIG.hole.baseRadius;
    this.rShown = this.r;
    this.rVel = 0;
    this.gulpT = 0;
    this.t = 0;
    this.lookX = 0; this.lookY = 0;   // smoothed travel direction, drives the eyes
  }

  /** A fresh start: small again, resting in the middle of the world. */
  reset(bounds) {
    this.x = bounds.w / 2;
    this.y = bounds.h / 2;
    this.vx = 0;
    this.vy = 0;
    this.inX = 0;
    this.inY = 0;
    this.r = CONFIG.hole.baseRadius;
    this.rShown = this.r;
    this.rVel = 0;
    this.gulpT = 0;
    this.touching = false;
  }

  /** How big a thing can be and still fit down the hole. */
  get mouth() { return this.r * CONFIG.hole.mouthRatio; }

  /** Finger moved this much (in world units). Accumulated until the next update. */
  steer(dx, dy) {
    this.inX += dx;
    this.inY += dy;
    this.touching = true;
  }

  release() { this.touching = false; }

  grow(amount) { this.r += amount; }

  /** The happy squash-and-stretch right after a swallow. */
  gulp() { this.gulpT = 1; }

  update(dt, bounds) {
    this.t += dt;
    const H = CONFIG.hole;

    if (this.touching) {
      // The finger's speed this frame becomes the commanded velocity, capped
      // at the hole's top speed (which creeps up a little as it grows, so a
      // big hole feels mighty rather than sluggish on a zoomed-out camera).
      const maxV = H.maxSpeed + this.rShown * 0.8;
      let tx = (this.inX / Math.max(dt, 1e-4)) * H.steerGain;
      let ty = (this.inY / Math.max(dt, 1e-4)) * H.steerGain;
      const m = Math.hypot(tx, ty);
      if (m > maxV) { tx *= maxV / m; ty *= maxV / m; }

      const k = 1 - Math.exp(-H.accelK * dt);
      this.vx += (tx - this.vx) * k;
      this.vy += (ty - this.vy) * k;
    } else {
      // Let go: coast out gently rather than stopping dead.
      const d = Math.exp(-H.glideDamp * dt);
      this.vx *= d;
      this.vy *= d;
    }
    this.inX = 0;
    this.inY = 0;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // The world has edges; the hole stops at them without fuss.
    const m = this.rShown * 0.3;
    const cx = clamp(this.x, m, bounds.w - m);
    const cy = clamp(this.y, m, bounds.h - m);
    if (cx !== this.x) this.vx = 0;
    if (cy !== this.y) this.vy = 0;
    this.x = cx;
    this.y = cy;

    // The eyes glance along the direction of travel.
    this.lookX = lerp(this.lookX, this.vx, 1 - Math.exp(-8 * dt));
    this.lookY = lerp(this.lookY, this.vy, 1 - Math.exp(-8 * dt));

    // The growth spring: rShown boings toward r and settles.
    this.rVel += (this.r - this.rShown) * H.springK * dt;
    this.rVel *= Math.pow(H.springDamp, dt * 60);
    this.rShown += this.rVel * dt;

    if (this.gulpT > 0) this.gulpT = Math.max(0, this.gulpT - dt * 2.4);
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  /** The mouth's current ellipse in world coordinates — main.js clips
      sinking things against this, so they visibly drop BELOW the rim. */
  get mouthEllipse() {
    const r = Math.max(6, this.rShown);
    return { x: this.x, y: this.y + this.#bob(), rx: r * 0.99, ry: r * 0.81 };
  }

  #bob() {
    const resting = !this.touching && this.speed < 12;
    return resting ? Math.sin(this.t * 1.8) * CONFIG.hole.idleBob : 0;
  }

  #enter(ctx) {
    const squash = this.gulpT > 0 ? Math.sin(this.gulpT * Math.PI) * CONFIG.hole.gulpSquash : 0;
    ctx.save();
    ctx.translate(this.x, this.y + this.#bob());
    ctx.scale(1 + squash, 1 - squash * 0.8);
    return Math.max(6, this.rShown);
  }

  /** Everything below ground level: shadow, the dark, the swirls. Things
      being swallowed draw on top of this — and drawRim then covers them. */
  drawPit(ctx) {
    const r = this.#enter(ctx);

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

    ctx.restore();
  }

  /** The rim glow and the eyes — drawn OVER anything falling in. */
  drawRim(ctx) {
    const r = this.#enter(ctx);
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

  draw(ctx) {
    this.drawPit(ctx);
    this.drawRim(ctx);
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
    const px = mag > 14 ? (this.lookX / mag) * eyeR * 0.38 : 0;
    const py = mag > 14 ? (this.lookY / mag) * eyeR * 0.38 : eyeR * 0.3;

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
