/* ---------------------------------------------------------------------------
   A bubble: rises from below the screen, sways gently, carries one creature,
   and pops the instant it is touched.

   Everything is drawn procedurally — gradient body, iridescent rim, two
   specular highlights — so there are no image files to load.
   --------------------------------------------------------------------------- */

import { CONFIG, emojiFont } from './config.js';
import { TAU, rand, chance, clamp, hsla } from './util.js';
import { pickCreature } from './creatures.js';

const GOLD_HUE = 44;

export class Bubble {
  constructor() {
    this.active = false;
  }

  /**
   * @param {{spread?: boolean}} [opts] `spread` places the bubble somewhere on
   *   screen rather than below it. Used only for the very first population —
   *   otherwise the game opens on an empty sky and he waits several seconds for
   *   the first bubble to climb into reach, which is the worst possible moment
   *   to ask a three-year-old for patience.
   */
  spawn(world, score, { spread = false } = {}) {
    const B = CONFIG.bubble;

    this.active = true;
    this.r = rand(B.minRadius, B.maxRadius);

    // Allowed to hang slightly off the edge. Portrait is only ~460 units wide,
    // and keeping every bubble fully inside means the big ones can only ever sit
    // in the middle third — which reads as a clump down the centre of the screen.
    this.homeX = rand(this.r * 0.62, world.w - this.r * 0.62);
    this.x = this.homeX;
    this.y = spread
      ? rand(world.h * 0.18, world.h - this.r * 0.6)
      // Staggered start depths so a top-up burst does not arrive as a straight line.
      : world.h + this.r + rand(20, 320);

    // Bigger bubbles are slower. Easier targets stay on screen longer.
    const sizeT = (this.r - B.minRadius) / Math.max(1, B.maxRadius - B.minRadius);
    this.vy = -(B.maxSpeed - (B.maxSpeed - B.minSpeed) * sizeT);

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
