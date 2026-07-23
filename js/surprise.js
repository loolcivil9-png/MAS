/* ---------------------------------------------------------------------------
   Surprises: every so often, something lovely just crosses the sky.

   A flock of butterflies, a rocket, drifting balloons, a V of birds. They are
   pure spectacle — drawn behind the bubbles, impossible to tap, nothing to
   learn and nothing to miss. Their only job is to make him point at the
   screen and tell somebody.

   One event at a time, from a fixed member array — nothing is allocated after
   startup, matching the pooling discipline everywhere else.
   --------------------------------------------------------------------------- */

import { CONFIG, emojiFont } from './config.js';
import { TAU, rand, randInt, pick, lerp, clamp } from './util.js';
import { audio } from './audio.js';

const MAX_MEMBERS = 7;
const KINDS = ['butterflies', 'rocket', 'balloons', 'birds'];

export class Surprises {
  constructor(particles) {
    this.particles = particles;
    this.active = false;
    this.kind = null;
    this.t = 0;
    this.duration = 0;
    this.count = 0;
    this.trailTimer = 0;

    this.members = [];
    for (let i = 0; i < MAX_MEMBERS; i++) {
      this.members.push({ glyph: '', size: 0, delay: 0, lane: 0, offset: 0, x: 0, y: 0, rot: 0, visible: false });
    }

    this.popsUntil = randInt(CONFIG.surprise.minPopsBetween, CONFIG.surprise.maxPopsBetween);
  }

  /**
   * Called once per popped bubble. Fires when the counter runs out — but never
   * on top of a win banner; the level-up owns that moment.
   */
  onPop(bannerShowing) {
    this.popsUntil--;
    if (this.popsUntil > 0 || this.active || bannerShowing) return;
    this.#start(pick(KINDS));
    this.popsUntil = randInt(CONFIG.surprise.minPopsBetween, CONFIG.surprise.maxPopsBetween);
  }

  #start(kind) {
    this.active = true;
    this.kind = kind;
    this.t = 0;
    this.trailTimer = 0;

    if (kind === 'butterflies') {
      this.duration = 7.5;
      this.count = randInt(5, MAX_MEMBERS);
      for (let i = 0; i < this.count; i++) {
        const m = this.members[i];
        m.glyph = '🦋';
        m.size = rand(44, 64);
        m.delay = i * rand(0.25, 0.45);
        m.lane = rand(0.15, 0.5);
        m.offset = rand(0, TAU);
      }
      audio.sparkle(4);
    } else if (kind === 'rocket') {
      this.duration = 2.6;
      this.count = 1;
      const m = this.members[0];
      m.glyph = '🚀';
      m.size = 88;
      m.delay = 0;
      audio.whoosh(0.7);
    } else if (kind === 'balloons') {
      this.duration = 9;
      this.count = randInt(2, 3);
      for (let i = 0; i < this.count; i++) {
        const m = this.members[i];
        m.glyph = '🎈';
        m.size = rand(62, 86);
        m.delay = i * 0.9;
        m.lane = rand(0.15, 0.85);
        m.offset = rand(0, TAU);
      }
      audio.chime(2);
    } else { // birds
      this.duration = 5.5;
      this.count = 5;
      for (let i = 0; i < this.count; i++) {
        const m = this.members[i];
        m.glyph = '🐦';
        m.size = rand(40, 50);
        m.delay = 0;
        m.offset = rand(0, TAU);
      }
      audio.call('tweet');
    }
  }

  update(dt, world) {
    if (!this.active) return;
    this.t += dt;
    if (this.t >= this.duration) { this.active = false; return; }

    const { t } = this;
    const w = world.w;
    const h = world.h;

    for (let i = 0; i < this.count; i++) {
      const m = this.members[i];
      const tm = t - m.delay;
      m.visible = tm > 0;
      if (!m.visible) continue;

      if (this.kind === 'butterflies') {
        m.x = lerp(-90, w + 90, clamp(tm / 5.5, 0, 1));
        m.y = m.lane * h + Math.sin(t * 3 + m.offset) * 46;
        m.rot = Math.sin(t * 6 + m.offset) * 0.22;
        m.visible = tm < 5.6;
      } else if (this.kind === 'rocket') {
        const p = clamp(tm / 2.3, 0, 1);
        m.x = lerp(-110, w + 130, p);
        m.y = lerp(h * 0.78, h * 0.16, p);
        m.rot = 0.35; // the glyph already points up-and-right
      } else if (this.kind === 'balloons') {
        m.x = m.lane * w + Math.sin(t * 0.9 + m.offset) * 34;
        m.y = h + 90 - tm * ((h + 220) / 7);
        m.rot = Math.sin(t * 1.3 + m.offset) * 0.12;
      } else { // birds gliding right to left in a V
        const rank = Math.ceil(i / 2);
        const side = i % 2 === 0 ? 1 : -1;
        m.x = (w + 90) - t * ((w + 260) / 4.8) + rank * 58;
        m.y = h * 0.24 + side * rank * 44 + Math.sin(t * 2.2 + m.offset) * 12;
        m.rot = 0;
      }
    }

    // The rocket leaves a glitter trail — the particles system already knows how.
    if (this.kind === 'rocket') {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0 && this.members[0].visible) {
        const m = this.members[0];
        this.particles.sparkleBurst(m.x - m.size * 0.4, m.y + m.size * 0.4, 32, 3);
        this.trailTimer = 0.09;
      }
    }
  }

  /** Drawn between the sky and the bubbles, so bubbles stay the thing to touch. */
  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this.count; i++) {
      const m = this.members[i];
      if (!m.visible) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);
      ctx.font = emojiFont(m.size);
      ctx.fillText(m.glyph, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
}
