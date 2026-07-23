/* ---------------------------------------------------------------------------
   Winning.

   Four escalating tiers, and he is never more than a few seconds from the next
   one. There is no losing tier because there is no losing.

     every pop      shards, glitter, a shockwave, the animal's name
     every 5 pops   a star flies up into the row, confetti, a chime, praise
     every 15 pops  the star lands, then fireworks, cheering and a trophy
     every 50 pops  the same but bigger, with a crown and a brass fanfare
     golden bubble  the 15-pop party, at random, roughly one bubble in fifteen

   The big tiers deliberately wait for the flying star to land before they go
   off. Half a second of anticipation makes the explosion land far harder than
   firing it on the same frame as the tap.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { audio } from './audio.js';
import { rand, pick } from './util.js';
import { CHEERS, BIG_CHEERS, MEGA_CHEERS } from './creatures.js';

export class Celebrations {
  constructor({ particles, hud, timers, world }) {
    this.particles = particles;
    this.hud = hud;
    this.timers = timers;
    this.world = world;
  }

  /** Called for every popped bubble. Returns nothing; it just makes things happen. */
  onPop(bubble) {
    const { particles, hud } = this;
    const { x, y, r, hue, creature, golden } = bubble;

    // --- tier 0: instant, every single time ---------------------------------
    particles.bubbleShards(x, y, r, hue);
    particles.sparkleBurst(x, y, hue);
    particles.ringWave(x, y, hue, r * 0.55, r * 2.3, 0.42);
    audio.pop(r);

    if (Math.random() < CONFIG.audio.speakChance) audio.creatureSound(creature.name);

    hud.score++;
    const s = hud.score;
    const C = CONFIG.celebrate;

    // --- the escalations ----------------------------------------------------
    if (golden) this.#bigMoment(x, y, false);
    else if (s % C.megaEvery === 0) this.#bigMoment(x, y, true);
    else if (s % C.partyEvery === 0) this.#bigMoment(x, y, false);
    else if (s % C.starEvery === 0) this.#starMoment(x, y);
  }

  /** He touched empty screen. Answer him anyway — no touch is ever ignored. */
  onMiss(x, y) {
    this.particles.sparkleBurst(x, y, rand(0, 360), 5);
  }

  /* --- tier 1 ------------------------------------------------------------- */

  #starMoment(x, y) {
    const { particles, hud, world } = this;

    audio.chime(5);
    particles.confettiShower(world, 55, 0.55);
    hud.flyStar(x, y, () => {
      hud.fillStar();
      audio.sparkle(4);
    });
    audio.speak(pick(CHEERS), { interrupt: true });
  }

  /* --- tiers 2 and 3 ------------------------------------------------------ */

  #bigMoment(x, y, mega) {
    audio.whoosh(0.42);
    this.hud.flyStar(x, y, () => {
      this.hud.fillStar();
      this.#explode(mega);
    });
  }

  #explode(mega) {
    const { particles, hud, timers, world } = this;

    hud.trophies++;
    hud.clearStars();
    hud.showFlash(mega ? 1.4 : 0.9, { rainbow: true });
    hud.showBanner(mega ? 'mega' : 'party', mega ? 3.6 : 2.7);

    particles.confettiShower(world, mega ? 200 : 130, mega ? 1.6 : 1.1);
    audio.cheer(mega ? 2.7 : 2.0);
    if (mega) audio.fanfare();
    else { audio.chime(7); audio.kick(); }

    const bursts = mega ? 7 : 4;
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

    // Let the bang land first, then talk over the tail of it.
    const suffix = CONFIG.playerName ? `, ${CONFIG.playerName}` : '';
    const phrase = pick(mega ? MEGA_CHEERS : BIG_CHEERS).replace('%s', suffix);
    timers.after(0.55, () => audio.speak(phrase, { interrupt: true }));
  }
}
