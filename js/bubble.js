/* ---------------------------------------------------------------------------
   A bubble: rises from below the screen, sways gently, carries one creature,
   and pops the instant it is touched.

   Everything is drawn procedurally — gradient body, iridescent rim, two
   specular highlights — so there are no image files to load.
   --------------------------------------------------------------------------- */

import { CONFIG, emojiFont } from './config.js';
import { TAU, rand, chance, clamp, easeOutCubic, hsla } from './util.js';
import { pickCreature } from './creatures.js';

const GOLD_HUE = 44;
const INTRO_TIME = 0.4; // seconds for an on-screen bubble to swell into view

export class Bubble {
  constructor() {
    this.active = false;
  }

  /**
   * @param {{place?: 'below' | 'anywhere' | 'low'}} [opts]
   *   `below`    climbs into view from off the bottom edge (the normal case)
   *   `anywhere` already on screen — used for the opening screenful, so the
   *              game never starts on an empty sky
   *   `low`      already on screen but near the bottom, as though it had just
   *              risen in. Used to refill in a hurry when he clears the screen.
   */
  spawn(world, score, { place = 'below' } = {}) {
    const B = CONFIG.bubble;

    this.active = true;
    this.r = rand(B.minRadius, B.maxRadius);

    // Bigger bubbles drift up more slowly, so the easiest targets are also the
    // ones that linger longest. The jitter stops size from being a perfect
    // predictor of speed, which is what made them all feel the same.
    const sizeT = (this.r - B.minRadius) / Math.max(1, B.maxRadius - B.minRadius);
    const base = B.maxSpeed - (B.maxSpeed - B.minSpeed) * sizeT;
    this.vy = -base * rand(1 - B.speedJitter, 1 + B.speedJitter);

    this.place(world, place);

    this.swayAmp = rand(B.swayAmount * 0.4, B.swayAmount);
    this.swaySpeed = rand(B.swaySpeedMin, B.swaySpeedMax);
    this.phase = rand(0, TAU);
    this.t = 0;

    this.golden = chance(B.goldenChance);
    this.hue = this.golden ? GOLD_HUE : rand(0, 360);
    this.creature = pickCreature(score);

    // A slow tilt so the creature inside looks like it is floating, not pasted on.
    this.tilt = rand(-0.18, 0.18);
    this.tiltSpeed = rand(0.35, 0.75);
  }

  /**
   * Rolls a fresh position. Called repeatedly by the spawner, which keeps
   * whichever candidate ends up furthest from the other bubbles.
   *
   * Bubbles are allowed to hang slightly off the side edges: portrait is only
   * ~460 units wide, so keeping every one fully inside would confine the big
   * ones to the middle third and read as a clump down the centre.
   */
  place(world, where = 'below') {
    // A bubble placed straight onto the screen would otherwise blink into
    // existence. Ones climbing in from below need no such help.
    this.fadeIn = where !== 'below';

    this.homeX = rand(this.r * 0.62, world.w - this.r * 0.62);
    this.x = this.homeX;

    if (where === 'anywhere') {
      this.y = rand(world.h * 0.24, world.h - this.r * 0.6);
    } else if (where === 'low') {
      this.y = rand(world.h * 0.62, world.h - this.r * 0.35);
    } else {
      // Staggered depths so a top-up burst does not arrive as a straight line.
      this.y = world.h + this.r + rand(20, 300);
    }
  }

  update(dt, world) {
    this.t += dt;
    this.y += this.vy * dt;

    const sway = Math.sin(this.t * this.swaySpeed * TAU + this.phase) * this.swayAmp;
    this.x = clamp(this.homeX + sway, this.r * 0.55, world.w - this.r * 0.55);

    // Off the top: it simply leaves. No sound, no penalty, nothing to notice.
    if (this.y < -this.r * 1.2) this.active = false;
  }

  /** Generous hit test — the touch radius is larger than the drawn circle. */
  contains(px, py) {
    const hit = this.r * CONFIG.bubble.hitScale;
    const dx = px - this.x;
    const dy = py - this.y;
    return dx * dx + dy * dy <= hit * hit;
  }

  draw(ctx) {
    const { x, y, r, hue } = this;
    const wobble = Math.sin(this.t * this.tiltSpeed * TAU + this.phase);

    ctx.save();

    // Swell into view, so a refilled bubble looks like it formed rather than
    // like the game glitched one onto the screen.
    if (this.fadeIn && this.t < INTRO_TIME) {
      const k = easeOutCubic(this.t / INTRO_TIME);
      ctx.globalAlpha = k;
      ctx.translate(x, y);
      ctx.scale(0.55 + 0.45 * k, 0.55 + 0.45 * k);
      ctx.translate(-x, -y);
    }

    // --- soft shadow so the bubble sits above the sky ------------------------
    ctx.beginPath();
    ctx.arc(x, y + r * 0.10, r * 1.02, 0, TAU);
    ctx.fillStyle = 'rgba(40, 30, 90, 0.10)';
    ctx.fill();

    // --- translucent body ---------------------------------------------------
    const body = ctx.createRadialGradient(
      x - r * 0.34, y - r * 0.40, r * 0.06,
      x, y, r,
    );
    const lum = this.golden ? 8 : 0;
    body.addColorStop(0.00, hsla(hue, 95, 94 + lum * 0.2, 0.55));
    body.addColorStop(0.52, hsla(hue, 88, 76 + lum, 0.26));
    body.addColorStop(0.86, hsla(hue + 35, 92, 66 + lum, 0.42));
    body.addColorStop(1.00, hsla(hue + 60, 96, 80 + lum, this.golden ? 0.78 : 0.62));

    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();

    // --- the creature, floating inside --------------------------------------
    ctx.save();
    ctx.translate(x, y + r * 0.02);
    ctx.rotate(this.tilt * wobble);
    ctx.font = emojiFont(r * 1.16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.creature.glyph, 0, 0);
    ctx.restore();

    // --- glass over the top: rim, iridescence, highlights --------------------
    ctx.lineWidth = r * 0.045;
    ctx.strokeStyle = hsla(hue + 180, 100, 88, this.golden ? 0.9 : 0.7);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.985, 0, TAU);
    ctx.stroke();

    // A single bright arc reads as a curved glass surface.
    ctx.lineWidth = r * 0.085;
    ctx.strokeStyle = hsla(hue + 210, 100, 92, 0.34);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, Math.PI * 1.06, Math.PI * 1.52);
    ctx.stroke();

    ctx.save();
    ctx.translate(x - r * 0.36, y - r * 0.40);
    ctx.rotate(-0.62);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.25, r * 0.15, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x + r * 0.36, y + r * 0.30, r * 0.085, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fill();

    if (this.golden) this.#drawGoldShimmer(ctx);

    ctx.restore();
  }

  /** Golden bubbles announce themselves: a breathing halo plus orbiting twinkles. */
  #drawGoldShimmer(ctx) {
    const { x, y, r } = this;
    const pulse = (Math.sin(this.t * 4.2) + 1) / 2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 1.28);
    halo.addColorStop(0, `rgba(255, 216, 96, ${0.10 + pulse * 0.16})`);
    halo.addColorStop(1, 'rgba(255, 200, 60, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.28, 0, TAU);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 250, 205, ${0.55 + pulse * 0.4})`;
    for (let i = 0; i < 4; i++) {
      const a = this.t * 1.15 + (i / 4) * TAU;
      const tx = x + Math.cos(a) * r * 0.94;
      const ty = y + Math.sin(a) * r * 0.94;
      const s = r * (0.05 + 0.035 * Math.abs(Math.sin(this.t * 5 + i)));
      // Four-point sparkle rather than a dot — it reads as a glint.
      ctx.beginPath();
      ctx.moveTo(tx, ty - s * 2.2);
      ctx.quadraticCurveTo(tx, ty, tx + s * 2.2, ty);
      ctx.quadraticCurveTo(tx, ty, tx, ty + s * 2.2);
      ctx.quadraticCurveTo(tx, ty, tx - s * 2.2, ty);
      ctx.quadraticCurveTo(tx, ty, tx, ty - s * 2.2);
      ctx.fill();
    }

    ctx.restore();
  }
}
