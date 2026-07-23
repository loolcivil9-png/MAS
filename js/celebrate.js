/* ---------------------------------------------------------------------------
   The rhythm of reward, tuned so the loud moments stay meaningful.

     every gulp          sparkles sized to the thing, the gulp sound, sometimes
                         the thing's own voice or its name. That is all.
     every 1/5 of city   a star flies up into the row. A chime, nothing more.
     golden thing        an extra growth spurt. A chime and glitter.
     first meeting       a ring of sparkles and a hello by name.
     DISTRICT clean      the frequent win: fireworks, cheering, "The park is
                         all clean!" — no trophy, deliberately.
     THE WHOLE CITY      the big one. Crown, brass fanfare, confetti storms,
                         a trophy — and then a brand-new city grows back.

   If the trophy showed up every few minutes it would stop meaning anything —
   which is exactly what went wrong in the first version of the old game.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { audio } from './audio.js';
import { rand, pick } from './util.js';
import { BIG_CHEERS, MEGA_CHEERS, DISTRICT_CHEERS } from './city.js';
import { met, markDirty, flushSave } from './save.js';

export class Celebrations {
  /**
   * `particles` lives in FIELD space (sparkles at the things themselves);
   * `fx` lives in SCREEN space (confetti, fireworks); `toScreen` converts a
   * field point to screen for the star that flies up into the HUD row.
   */
  constructor({ particles, fx, hud, timers, world, toScreen }) {
    this.particles = particles;
    this.fx = fx ?? particles;
    this.hud = hud;
    this.timers = timers;
    this.world = world;
    this.toScreen = toScreen ?? ((x, y) => ({ x, y }));

    // Stars already promised to the row, including any still in flight.
    this.starsScheduled = 0;

    // How many things this city started with, and how many are already gone
    // (a resumed city starts partway through the star row).
    this.cityTotal = 1;
    this.eatenThisCity = 0;
  }

  /** Called whenever a city is built — fresh or resumed from the save. */
  beginCity(totalThings, alreadyEaten = 0) {
    this.cityTotal = Math.max(1, totalThings);
    this.eatenThisCity = alreadyEaten;
    // A resumed city keeps its earned stars, without replaying their chimes.
    const C = CONFIG.celebrate;
    const owed = Math.min(C.starsPerLevel, Math.floor((alreadyEaten / this.cityTotal) * C.starsPerLevel));
    this.starsScheduled = owed;
    this.hud.clearStars();
    for (let i = 0; i < owed; i++) this.hud.fillStar();
  }

  reset() {
    this.starsScheduled = 0;
    this.eatenThisCity = 0;
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

    this.eatenThisCity++;
    // The flying star travels across the SCREEN, wherever the camera was
    // looking when the gulp landed.
    const s = this.toScreen(x, y);
    this.#advance(s.x, s.y);
  }

  /**
   * The first time he ever eats this kind of thing: a small hello, sized to
   * never compete with a district or city win.
   */
  #firstMeet(thing, x, y, hue) {
    met.add(thing.name);
    markDirty();
    flushSave();   // a new discovery is never worth losing to the write throttle

    const rare = thing.tier >= 4;
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

  /* --- the star row -------------------------------------------------------- */

  #advance(x, y) {
    const C = CONFIG.celebrate;
    const { hud, timers } = this;

    const fraction = this.eatenThisCity / this.cityTotal;
    const target = Math.min(C.starsPerLevel, Math.floor(fraction * C.starsPerLevel + 1e-9));
    if (target <= this.starsScheduled) return;

    const owed = target - this.starsScheduled;
    this.starsScheduled = target;

    for (let i = 0; i < owed; i++) {
      timers.after(i * 0.14, () => {
        audio.chime(3);
        hud.flyStar(x, y, () => {
          hud.fillStar();
          audio.sparkle(3);
        });
      });
    }
  }

  /* --- winning ------------------------------------------------------------- */

  /** A whole district eaten clean — the frequent win. Loud, but no trophy. */
  districtClean(district) {
    const { fx, hud, timers, world } = this;

    hud.showFlash(0.95, { rainbow: true });
    hud.showBanner('party', 3.0);
    fx.confettiShower(world, 140, 1.15);
    audio.cheer(2.1);
    audio.chime(7);
    audio.kick();

    for (let i = 0; i < 5; i++) {
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

    const line = DISTRICT_CHEERS[district] ?? 'All clean!';
    const suffix = CONFIG.playerName ? ` ${CONFIG.playerName}!` : '';
    timers.after(0.55, () => audio.speak(pick(BIG_CHEERS).replace('%s', ''), { interrupt: true }));
    timers.after(1.9, () => audio.speak(line + suffix, { interrupt: true }));
    flushSave();
  }

  /** The whole city, stadium and all. The biggest moment in the game. */
  cityComplete() {
    const { fx, hud, timers, world } = this;

    hud.trophies++;
    markDirty();
    flushSave();

    hud.showFlash(1.4, { rainbow: true });
    hud.showBanner('mega', 3.6);
    fx.confettiShower(world, 200, 1.6);
    audio.cheer(2.7);
    audio.fanfare();

    for (let i = 0; i < 7; i++) {
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
    timers.after(0.95, () => fx.confettiShower(world, 160, 1.4));

    const suffix = CONFIG.playerName ? `, ${CONFIG.playerName}` : '';
    timers.after(0.55, () => audio.speak(pick(MEGA_CHEERS).replace('%s', suffix), { interrupt: true }));
    timers.after(2.6, () => audio.speak('Here comes a brand new city!', { interrupt: true }));
  }
}
