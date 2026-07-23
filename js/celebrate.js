/* ---------------------------------------------------------------------------
   Levels, and the one moment that counts as winning.

     every pop        the bubble bursts — shards, a little glitter, a pop sound,
                      and the animal's name about one time in five. That is all.
     every 5 pops     a star flies up into the row. A chime, nothing more.
     golden bubble    worth five bubbles toward the level. A chime and extra
                      glitter, but deliberately no trophy.
     5 stars = level  THE win. Fireworks, cheering, a trophy, and the whole sky
                      changes to a new place for the next level.
     every 5th level  the same but bigger — crown, brass fanfare, rainbow.

   The point of the quiet stretch is the loud moment at the end of it. If the
   trophy shows up every few pops it stops meaning anything, which is exactly
   what went wrong in the first version.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { audio } from './audio.js';
import { rand, pick } from './util.js';
import { BIG_CHEERS, MEGA_CHEERS } from './creatures.js';
import { met, markDirty, flushSave } from './save.js';

export class Celebrations {
  constructor({ particles, hud, timers, world, background }) {
    this.particles = particles;
    this.hud = hud;
    this.timers = timers;
    this.world = world;
    this.background = background;

    // Stars already promised to the row, including any still in flight. Without
    // this, two pops in the same moment both see the old star count and send
    // duplicates.
    this.starsScheduled = 0;
  }

  reset() {
    this.starsScheduled = 0;
    this.background?.resetTo(1);
  }

  /**
   * Called for every popped bubble.
   * @param {boolean} [muteCall] a rainbow chain pops half a dozen bubbles in
   *   under a second — only the first couple get to speak up.
   */
  onPop(bubble, muteCall = false) {
    const { particles, hud } = this;
    const { x, y, r, hue, creature, special } = bubble;

    // --- the pop itself: satisfying, but not a celebration -------------------
    particles.bubbleShards(x, y, r, hue);
    particles.sparkleBurst(x, y, hue);
    audio.pop(r);

    // The animal answers most pops with its own call; the voice names it on
    // some of the rest. Never both on one pop — a woof that then announces
    // "Dog" is a toy explaining its own joke.
    let called = false;
    if (!muteCall && CONFIG.animalSounds.enabled && Math.random() < CONFIG.animalSounds.chance) {
      called = audio.call(creature.call);
    }
    if (!called && !muteCall && Math.random() < CONFIG.audio.speakChance) {
      audio.creatureSound(creature.name);
    }

    hud.score++;
    markDirty();

    if (!met.has(creature.name)) this.#firstMeet(creature, x, y, hue);

    // --- special bubbles are a shortcut, not a prize --------------------------
    let worth = 1;
    if (special === 'golden') {
      worth = CONFIG.bubble.goldenWorth;
      particles.sparkleBurst(x, y, 44, 26);
      particles.ringWave(x, y, 44, r * 0.6, r * 3, 0.5);
      audio.chime(4);
    } else if (special === 'rainbow') {
      // Worth one itself — its real prize is the whole screen popping after
      // it, each of those counting normally. main.js runs that chain.
      particles.sparkleBurst(x, y, hue, 26);
      particles.ringWave(x, y, hue, r * 0.6, r * 4, 0.7);
    }

    this.#advance(worth, x, y);
  }

  /**
   * The first time he ever pops this creature: a small hello, sized to never
   * compete with a level-up. Over weeks, as the long-tail creatures unlock,
   * these become rare little events worth coming back for.
   */
  #firstMeet(creature, x, y, hue) {
    met.add(creature.name);
    markDirty();
    flushSave();   // a new friend is never worth losing to the write throttle

    const rare = creature.unlockAt >= 25;
    this.particles.ringWave(x, y, hue, 30, rare ? 320 : 240, 0.6);
    this.particles.sparkleBurst(x, y, hue, 16);
    audio.sparkle(4);
    if (rare) this.hud.showFlash(0.7, { rainbow: true });

    const name = creature.name.toLowerCase();
    this.timers.after(0.2, () => audio.speak(`A ${name}! Hello, ${name}!`, { interrupt: rare }));
  }

  /** He touched empty screen. Answer him anyway — no touch is ever ignored. */
  onMiss(x, y) {
    this.particles.sparkleBurst(x, y, rand(0, 360), 5);
  }

  /* --- level progress ----------------------------------------------------- */

  #advance(worth, x, y) {
    const C = CONFIG.celebrate;
    const { hud, timers } = this;

    // Capped, so the level cannot run past its total while the last star is
    // still flying. That does mean the one or two bubbles he pops during that
    // half-second do not count — invisible in practice, and much safer than
    // letting progress spill over, which lets a hard mash chain straight into
    // the next level and undoes the whole point of having levels.
    hud.levelProgress = Math.min(C.bubblesPerLevel, hud.levelProgress + worth);

    const perStar = C.bubblesPerLevel / C.starsPerLevel;
    const target = Math.min(C.starsPerLevel, Math.floor(hud.levelProgress / perStar));
    if (target <= this.starsScheduled) return;

    const owed = target - this.starsScheduled;
    this.starsScheduled = target;
    const completesLevel = target >= C.starsPerLevel;

    for (let i = 0; i < owed; i++) {
      const isLast = i === owed - 1;
      // Staggered, so a golden bubble worth several stars sends them up as a
      // little run rather than all on the same frame.
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
    const { particles, hud, timers, world, background } = this;
    const C = CONFIG.celebrate;

    const completed = hud.level;
    const mega = completed % C.megaEveryLevels === 0;

    hud.level++;
    hud.trophies++;
    hud.levelProgress = 0;
    hud.clearStars();
    this.starsScheduled = 0;
    markDirty();
    flushSave();   // a won level is never worth losing to the write throttle

    // The sky becomes somewhere new. He cannot read the level number, so this
    // is what actually tells him he moved on.
    background?.setLevel(hud.level);

    hud.showFlash(mega ? 1.4 : 0.95, { rainbow: true });
    hud.showBanner(mega ? 'mega' : 'party', mega ? 3.6 : 3.0);

    particles.confettiShower(world, mega ? 200 : 140, mega ? 1.6 : 1.15);
    audio.cheer(mega ? 2.7 : 2.1);
    if (mega) audio.fanfare();
    else { audio.chime(7); audio.kick(); }

    const bursts = mega ? 7 : 5;
    for (let i = 0; i < bursts; i++) {
      timers.after(i * 0.26, () => {
        particles.firework(
          rand(world.w * 0.15, world.w * 0.85),
          rand(world.h * 0.16, world.h * 0.58),
          rand(0, 360),
        );
        audio.kick();
        audio.snare();
      });
    }

    if (mega) timers.after(0.95, () => particles.confettiShower(world, 160, 1.4));

    // Praise first, then the new level number — spaced so they do not collide,
    // and both timed to land over the tail of the bang rather than under it.
    const suffix = CONFIG.playerName ? `, ${CONFIG.playerName}` : '';
    const phrase = pick(mega ? MEGA_CHEERS : BIG_CHEERS).replace('%s', suffix);
    timers.after(0.55, () => audio.speak(phrase, { interrupt: true }));
    timers.after(mega ? 2.4 : 1.9, () => audio.speak(`Level ${hud.level}!`, { interrupt: true }));
  }
}
