/* ---------------------------------------------------------------------------
   Levels, and the one moment that counts as winning.

     every gulp        sparkles sized to the thing, the gulp sound, sometimes
                       the thing's own voice or its name. That is all.
     every 1/5 eaten   a star flies up into the row. A chime, nothing more.
     golden thing      an extra growth spurt. A chime and glitter, but
                       deliberately no trophy.
     first meeting     a ring of sparkles and a hello by name — small on
                       purpose, so it never competes with the win.
     clean plate       THE win. The whole world eaten: fireworks, cheering, a
                       trophy, and the sky changes to a new world.
     every 5th world   the same but bigger — crown, brass fanfare, rainbow.

   The point of the quiet stretch is the loud moment at the end of it. If the
   trophy shows up every few gulps it stops meaning anything, which is exactly
   what went wrong in the first version of the old bubble game.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { audio } from './audio.js';
import { rand, pick } from './util.js';
import { BIG_CHEERS, MEGA_CHEERS } from './catalog.js';
import { met, markDirty, flushSave } from './save.js';

export class Celebrations {
  /**
   * `particles` lives in FIELD space (sparkles at the things themselves);
   * `fx` lives in SCREEN space (confetti, fireworks); `toScreen` converts a
   * field point to screen for the star that flies up into the HUD row.
   */
  constructor({ particles, fx, hud, timers, world, background, toScreen }) {
    this.particles = particles;
    this.fx = fx ?? particles;
    this.hud = hud;
    this.timers = timers;
    this.world = world;
    this.background = background;
    this.toScreen = toScreen ?? ((x, y) => ({ x, y }));

    // Stars already promised to the row, including any still in flight. Without
    // this, two eats in the same moment both see the old star count and send
    // duplicates.
    this.starsScheduled = 0;

    // How many things this level started with — set by the level builder.
    // The star row fills as a fraction of it, so levels can be any size.
    this.levelTotal = 1;
    this.eatenThisLevel = 0;
  }

  /** Called by the level builder every time a fresh world is laid out. */
  beginLevel(totalThings) {
    this.levelTotal = Math.max(1, totalThings);
    this.eatenThisLevel = 0;
    this.starsScheduled = 0;
  }

  reset() {
    this.starsScheduled = 0;
    this.eatenThisLevel = 0;
    this.background?.resetTo(1);
  }

  /**
   * Called when a swallow finishes.
   * @param {boolean} [muteVoice] a magnet feast swallows half the screen in
   *   seconds — only the first couple of things get to speak up.
   */
  onEat(thing, muteVoice = false) {
    const { particles, hud } = this;
    const { x, y, size, tier } = thing;
    const hue = rand(0, 360);

    // --- the gulp's reward: satisfying, but not a celebration ----------------
    particles.sparkleBurst(x, y, hue, 6 + tier * 4);
    if (tier >= 2) particles.ringWave(x, y, hue, size * 0.4, size * 1.7, 0.45);

    // The thing gets its own voice on some eats; the speaking voice names it
    // on some of the rest. Never both on one gulp.
    let called = false;
    if (!muteVoice && thing.call && CONFIG.objectSounds.enabled
        && Math.random() < CONFIG.objectSounds.chance) {
      called = audio.call(thing.call);
    }
    if (!called && !muteVoice && Math.random() < CONFIG.audio.speakChance) {
      audio.creatureSound(thing.name);
    }

    hud.score++;
    markDirty();

    if (!met.has(thing.name)) this.#firstMeet(thing, x, y, hue);

    // --- the golden thing is a growth spurt, not a prize ---------------------
    if (thing.golden) {
      particles.sparkleBurst(x, y, 44, 22);
      particles.ringWave(x, y, 44, size * 0.5, size * 2.6, 0.5);
      audio.chime(4);
    }

    this.eatenThisLevel++;
    // The flying star travels across the SCREEN, wherever the camera was
    // looking when the gulp landed.
    const s = this.toScreen(x, y);
    this.#advance(s.x, s.y);
  }

  /**
   * The first time he ever eats this kind of thing: a small hello, sized to
   * never compete with a clean-plate win. Over weeks, across nine worlds of
   * contents, these keep happening long after the first session.
   */
  #firstMeet(thing, x, y, hue) {
    met.add(thing.name);
    markDirty();
    flushSave();   // a new discovery is never worth losing to the write throttle

    const rare = thing.tier >= 3;
    this.particles.ringWave(x, y, hue, 30, rare ? 320 : 240, 0.6);
    this.particles.sparkleBurst(x, y, hue, 16);
    audio.sparkle(4);
    if (rare) this.hud.showFlash(0.7, { rainbow: true });

    const name = thing.name.toLowerCase();
    this.timers.after(0.2, () => audio.speak(`Ooh! A ${name}!`, { interrupt: rare }));
  }

  /** He touched empty ground. Answer him anyway — no touch is ever ignored. */
  onMiss(x, y) {
    this.particles.sparkleBurst(x, y, rand(0, 360), 5);
  }

  /* --- level progress ----------------------------------------------------- */

  #advance(x, y) {
    const C = CONFIG.celebrate;
    const { hud, timers } = this;

    const fraction = this.eatenThisLevel / this.levelTotal;
    const target = Math.min(C.starsPerLevel, Math.floor(fraction * C.starsPerLevel + 1e-9));
    if (target <= this.starsScheduled) return;

    const owed = target - this.starsScheduled;
    this.starsScheduled = target;
    const completesLevel = target >= C.starsPerLevel;

    for (let i = 0; i < owed; i++) {
      const isLast = i === owed - 1;
      // Staggered, so a magnet feast sends them up as a little run rather
      // than all on the same frame.
      timers.after(i * 0.14, () => {
        audio.chime(3);
        hud.flyStar(x, y, () => {
          hud.fillStar();
          audio.sparkle(3);
          if (isLast && completesLevel) this.#levelUp();
        });
      });
    }
  }

  /* --- winning ------------------------------------------------------------ */

  #levelUp() {
    const { fx, hud, timers, world, background } = this;
    const C = CONFIG.celebrate;

    const completed = hud.level;
    const mega = completed % C.megaEveryLevels === 0;

    hud.level++;
    hud.trophies++;
    hud.clearStars();
    this.starsScheduled = 0;
    markDirty();
    flushSave();   // a won world is never worth losing to the write throttle

    // The sky becomes somewhere new — and the level builder will fill it with
    // that world's own things. He cannot read the level number; this is what
    // actually tells him he moved on.
    background?.setLevel(hud.level);

    hud.showFlash(mega ? 1.4 : 0.95, { rainbow: true });
    hud.showBanner(mega ? 'mega' : 'party', mega ? 3.6 : 3.0);

    fx.confettiShower(world, mega ? 200 : 140, mega ? 1.6 : 1.15);
    audio.cheer(mega ? 2.7 : 2.1);
    if (mega) audio.fanfare();
    else { audio.chime(7); audio.kick(); }

    const bursts = mega ? 7 : 5;
    for (let i = 0; i < bursts; i++) {
      timers.after(i * 0.26, () => {
        fx.firework(
          rand(world.w * 0.15, world.w * 0.85),
          rand(world.h * 0.16, world.h * 0.58),
          rand(0, 360),
        );
        audio.kick();
        audio.snare();
      });
    }

    if (mega) timers.after(0.95, () => fx.confettiShower(world, 160, 1.4));

    // Praise first, then the new level number — spaced so they do not collide,
    // and both timed to land over the tail of the bang rather than under it.
    const suffix = CONFIG.playerName ? `, ${CONFIG.playerName}` : '';
    const phrase = pick(mega ? MEGA_CHEERS : BIG_CHEERS).replace('%s', suffix);
    timers.after(0.55, () => audio.speak(phrase, { interrupt: true }));
    timers.after(mega ? 2.4 : 1.9, () => audio.speak(`Level ${hud.level}!`, { interrupt: true }));
  }
}
