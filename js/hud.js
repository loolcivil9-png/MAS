/* ---------------------------------------------------------------------------
   Everything on screen that reports progress, plus the two big celebration
   overlays (the screen flash and the trophy banner).

   He cannot read, so the primary readout is a row of stars that fills up.
   Three stars means the next pop-and-a-bit brings the big party. The digits and
   the trophy tally are there for the adults, and because three-year-olds do
   like numbers even when they cannot read them.
   --------------------------------------------------------------------------- */

import { CONFIG, uiFont, emojiFont } from './config.js';
import { TAU, clamp, lerp, easeOutBack, easeOutElastic, easeOutCubic, easeInOutSine, hsla } from './util.js';

const BANNER_IN = 0.5;
const BANNER_OUT = 0.45;

export class Hud {
  constructor() {
    this.score = 0;          // total bubbles popped, all levels
    this.level = 1;
    this.levelProgress = 0;  // 0 .. CONFIG.celebrate.bubblesPerLevel
    this.stars = 0;          // stars filled in the current level
    this.trophies = 0;       // levels passed

    this.starPop = new Array(CONFIG.celebrate.starsPerLevel).fill(0);
    this.flying = [];

    this.banner = null;  // { kind, t, duration }
    this.flash = null;   // { t, duration, rainbow, hue }
  }

  reset() {
    this.score = 0;
    this.level = 1;
    this.levelProgress = 0;
    this.stars = 0;
    this.trophies = 0;
    this.starPop.fill(0);
    this.flying.length = 0;
    this.banner = null;
    this.flash = null;
  }

  /* --- triggers ----------------------------------------------------------- */

  /** A star flies from where he popped the bubble up into the star row. */
  flyStar(fromX, fromY, onArrive) {
    this.flying.push({ x0: fromX, y0: fromY, t: 0, duration: 0.62, onArrive });
  }

  fillStar() {
    if (this.stars < CONFIG.celebrate.starsPerLevel) {
      this.starPop[this.stars] = 1;
      this.stars++;
    }
  }

  clearStars() {
    this.stars = 0;
    this.starPop.fill(0);
  }

  showBanner(kind, duration) { this.banner = { kind, t: 0, duration }; }
  showFlash(duration, { rainbow = false, hue = 50 } = {}) {
    this.flash = { t: 0, duration, rainbow, hue };
  }

  /* --- simulation --------------------------------------------------------- */

  update(dt, world) {
    for (let i = 0; i < this.starPop.length; i++) {
      if (this.starPop[i] > 0) this.starPop[i] = Math.max(0, this.starPop[i] - dt * 1.6);
    }

    const slot = this.#slotCount(world);
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      if (f.t >= f.duration) {
        this.flying.splice(i, 1);
        f.onArrive?.();
      } else {
        // Cache the current target so the draw pass does not recompute layout.
        f.target = slot;
      }
    }

    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.duration) this.banner = null;
    }

    if (this.flash) {
      this.flash.t += dt;
      if (this.flash.t >= this.flash.duration) this.flash = null;
    }
  }

  /* --- layout ------------------------------------------------------------- */

  #metrics(world) {
    const s = world.h / 1000;
    const count = CONFIG.celebrate.starsPerLevel;
    const x = world.safe.l + 34 * s;
    // The row has to shrink to fit however many stars a level is worth, while
    // staying clear of the score in the opposite corner.
    const avail = (world.w - world.safe.r - 96 * s) - x;
    const gap = Math.min(64 * s, avail / count);
    return {
      x,
      y: world.safe.t + 40 * s,
      star: Math.min(26 * s, gap * 0.44),
      gap,
      scale: s,
    };
  }

  /** Where the next star will land — the flying star aims here. */
  #slotCount(world) {
    const m = this.#metrics(world);
    const i = Math.min(this.stars, CONFIG.celebrate.starsPerLevel - 1);
    return { x: m.x + m.star + i * m.gap, y: m.y + m.star };
  }

  /* --- rendering ---------------------------------------------------------- */

  /** Drawn under the bubbles: the full-screen colour wash. */
  drawFlash(ctx, world) {
    if (!this.flash) return;
    const t = this.flash.t / this.flash.duration;
    const alpha = Math.sin(clamp(t, 0, 1) * Math.PI) * 0.42;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.flash.rainbow) {
      const g = ctx.createLinearGradient(0, 0, world.w, world.h);
      for (let i = 0; i <= 6; i++) {
        g.addColorStop(i / 6, hsla((i / 6) * 360 + this.flash.t * 120, 100, 62, alpha));
      }
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = hsla(this.flash.hue, 100, 65, alpha);
    }
    ctx.fillRect(0, 0, world.w, world.h);
    ctx.restore();
  }

  /** Drawn over everything: stars, tally, flying stars and the win banner. */
  draw(ctx, world) {
    this.#drawStarRow(ctx, world);
    this.#drawTally(ctx, world);
    this.#drawFlyingStars(ctx, world);
    if (this.banner) this.#drawBanner(ctx, world);
  }

  #drawStarRow(ctx, world) {
    const m = this.#metrics(world);

    for (let i = 0; i < CONFIG.celebrate.starsPerLevel; i++) {
      const cx = m.x + m.star + i * m.gap;
      const cy = m.y + m.star;
      const filled = i < this.stars;
      // Freshly filled stars punch out and settle back.
      const punch = 1 + this.starPop[i] * 0.55;
      const r = m.star * punch;

      ctx.save();
      // A dark drop shadow under every state. Bubbles drift right behind the
      // HUD, and a pale outline over a pale bubble is unreadable.
      ctx.shadowColor = 'rgba(28, 17, 69, 0.55)';
      ctx.shadowBlur = 10 * m.scale;
      ctx.shadowOffsetY = 2.5 * m.scale;

      if (filled) {
        ctx.fillStyle = '#ffcf3d';
        starPath(ctx, cx, cy, r, r * 0.46);
        ctx.fill();
        ctx.shadowColor = 'rgba(255, 200, 60, 0.9)';
        ctx.shadowBlur = 22 * m.scale * (0.6 + this.starPop[i]);
        ctx.shadowOffsetY = 0;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3.5 * m.scale;
        ctx.strokeStyle = 'rgba(150, 92, 0, 0.6)';
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(32, 20, 76, 0.30)';
        starPath(ctx, cx, cy, r, r * 0.46);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 4.5 * m.scale;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  #drawTally(ctx, world) {
    const m = this.#metrics(world);
    const y = m.y + m.star * 2 + 26 * m.scale;

    ctx.save();
    ctx.textBaseline = 'middle';
    // Same treatment as the star row: bubbles drift behind all of this, and an
    // unshadowed emoji disappears against a pale one.
    ctx.shadowColor = 'rgba(28, 17, 69, 0.6)';
    ctx.shadowBlur = 10 * m.scale;
    ctx.shadowOffsetY = 2.5 * m.scale;

    if (this.trophies > 0) {
      ctx.textAlign = 'left';
      ctx.font = emojiFont(34 * m.scale);
      ctx.fillText('🏆', m.x, y);
      ctx.font = uiFont(30 * m.scale);
      ctx.lineWidth = 6 * m.scale;
      ctx.strokeStyle = 'rgba(40, 26, 90, 0.55)';
      ctx.fillStyle = '#fff';
      const label = `×${this.trophies}`;
      const lx = m.x + 40 * m.scale; // clear of the trophy glyph
      ctx.strokeText(label, lx, y);
      ctx.fillText(label, lx, y);
    }

    ctx.textAlign = 'right';
    ctx.font = uiFont(38 * m.scale);
    ctx.lineWidth = 7 * m.scale;
    ctx.strokeStyle = 'rgba(40, 26, 90, 0.45)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    const sx = world.w - world.safe.r - 34 * m.scale;
    ctx.strokeText(String(this.score), sx, m.y + m.star);
    ctx.fillText(String(this.score), sx, m.y + m.star);

    ctx.restore();
  }

  #drawFlyingStars(ctx, world) {
    if (!this.flying.length) return;
    const m = this.#metrics(world);

    ctx.save();
    for (const f of this.flying) {
      const t = clamp(f.t / f.duration, 0, 1);
      const e = easeInOutSine(t);
      const target = f.target ?? this.#slotCount(world);
      const x = lerp(f.x0, target.x, e);
      // A lifted arc, so it sails rather than slides.
      const y = lerp(f.y0, target.y, e) - Math.sin(t * Math.PI) * world.h * 0.14;
      const r = lerp(m.star * 1.7, m.star, easeOutCubic(t));

      ctx.shadowColor = 'rgba(255, 205, 70, 0.95)';
      ctx.shadowBlur = 30 * m.scale;
      ctx.fillStyle = '#ffdf5e';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * TAU * 1.2);
      starPath(ctx, 0, 0, r, r * 0.46);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  #drawBanner(ctx, world) {
    const b = this.banner;
    const mega = b.kind === 'mega';

    // in → hold → out
    let scale;
    let alpha = 1;
    if (b.t < BANNER_IN) {
      scale = easeOutElastic(b.t / BANNER_IN);
    } else if (b.t > b.duration - BANNER_OUT) {
      const k = (b.t - (b.duration - BANNER_OUT)) / BANNER_OUT;
      scale = 1 + k * 0.35;
      alpha = 1 - k;
    } else {
      // A gentle breathe while it holds, so it never looks frozen.
      scale = 1 + Math.sin((b.t - BANNER_IN) * 4) * 0.03;
    }

    const cx = world.w / 2;
    const cy = world.h * 0.42;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (mega) {
      const crownDrop = clamp(b.t / 0.55, 0, 1);
      ctx.save();
      // Lands on the rim of the cup, not down inside it.
      ctx.translate(0, lerp(-world.h * 0.44, -world.h * 0.205, easeOutBack(crownDrop, 1.4)));
      ctx.font = emojiFont(world.h * 0.14);
      ctx.fillText('👑', 0, 0);
      ctx.restore();
    }

    ctx.font = emojiFont(world.h * 0.25);
    ctx.fillText('🏆', 0, 0);

    const label = mega ? 'CHAMPION!' : 'YOU WIN!';
    const ty = world.h * 0.195;

    // Shrink to fit. The world is only ~460 units wide in portrait, so a fixed
    // size runs off both edges — and `scale` is still overshooting past 1 while
    // the banner springs in, which is exactly when it would clip.
    let size = world.h * (mega ? 0.085 : 0.095);
    ctx.font = uiFont(size);
    const maxWidth = (world.w * 0.88) / Math.max(scale, 0.001);
    const measured = ctx.measureText(label).width;
    if (measured > maxWidth) {
      size *= maxWidth / measured;
      ctx.font = uiFont(size);
    }

    ctx.lineWidth = size * 0.22;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(52, 28, 100, 0.85)';
    ctx.strokeText(label, 0, ty);

    const g = ctx.createLinearGradient(0, ty - size * 0.6, 0, ty + size * 0.6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#ffe680');
    g.addColorStop(1, '#ff9d2e');
    ctx.fillStyle = g;
    ctx.fillText(label, 0, ty);

    ctx.restore();
  }
}

/** Standard five-point star, pointing up. */
function starPath(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
