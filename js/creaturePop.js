/* ---------------------------------------------------------------------------
   The creature that leaps out of a popped bubble.

   It scales in with an overshoot, arcs upward, squashes when it lands, bounces
   a couple of times and then drifts off the bottom of the screen. The squash
   and the overshoot are doing almost all of the work here — without them the
   emoji just slides around; with them it feels alive and pleased with itself.
   --------------------------------------------------------------------------- */

import { CONFIG, emojiFont } from './config.js';
import { rand, randSign, clamp, easeOutBack } from './util.js';

const POP_IN_TIME = 0.26;

export class FreedCreature {
  constructor() {
    this.active = false;
  }

  spawn(x, y, creature, size) {
    const C = CONFIG.creature;

    this.active = true;
    this.creature = creature;
    this.size = size;

    this.x = x;
    this.y = y;
    this.vx = rand(C.sideSpeed * 0.25, C.sideSpeed) * randSign();
    this.vy = -rand(C.popUpSpeedMin, C.popUpSpeedMax);

    this.rot = rand(-0.15, 0.15);
    this.vrot = rand(-2.6, 2.6);

    this.t = 0;
    this.life = C.lifetime;
    this.bounces = 0;
    this.squash = 1;
  }

  update(dt, world) {
    const C = CONFIG.creature;

    this.t += dt;
    this.life -= dt;

    this.vy += C.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vrot * dt;

    // Bounce off the sides so it never sails away immediately.
    const half = this.size * 0.42;
    if (this.x < half) { this.x = half; this.vx = Math.abs(this.vx) * 0.75; }
    else if (this.x > world.w - half) { this.x = world.w - half; this.vx = -Math.abs(this.vx) * 0.75; }

    const floor = world.h * 0.90;
    if (this.y > floor && this.vy > 0 && this.bounces < C.maxBounces) {
      this.y = floor;
      this.vy = -this.vy * C.bounce;
      this.vx *= 0.82;
      this.vrot *= 0.6;
      this.bounces++;
      this.squash = 0.55;
    }
    // After the last bounce it simply falls through and leaves — self-cleaning.

    // Spring the squash back out.
    this.squash += (1 - this.squash) * Math.min(1, dt * 14);

    if (this.life <= 0 || this.y > world.h + this.size) this.active = false;
  }

  draw(ctx) {
    const popIn = this.t < POP_IN_TIME ? easeOutBack(this.t / POP_IN_TIME) : 1;
    const fade = CONFIG.creature.fadeTime;
    const alpha = clamp(this.life / fade, 0, 1);

    const sy = this.squash * popIn;
    const sx = (1 + (1 - this.squash) * 0.75) * popIn; // squash wide, stretch tall

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.scale(sx, sy);
    ctx.font = emojiFont(this.size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.creature.glyph, 0, 0);
    ctx.restore();
  }
}
