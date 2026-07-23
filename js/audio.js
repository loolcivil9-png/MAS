/* ---------------------------------------------------------------------------
   Sound, generated entirely in code. No audio files, nothing to download,
   works offline from the first second.

   Two deliberate choices worth knowing about:

   * Everything melodic uses a major pentatonic scale. Pentatonic has no
     dissonant interval in it, so when a magnet feast lands ten gulps at once
     the result is a chord rather than a mess. It cannot sound wrong.

   * The whole mix runs through a compressor with a conservative master gain.
     This is a phone held roughly six inches from a three-year-old's ears; ten
     simultaneous pops must not clip or spike.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { clamp, lerp, pick } from './util.js';

// Major pentatonic, in semitones. Safe to stack in any combination.
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const C5 = 523.25;

const semi = (root, n) => root * Math.pow(2, n / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ready = false;

    this.noiseBuffer = null;
    this.voice = null;

    /* Reserved for real recorded animal sounds. Nothing loads them yet; the
       playback path below already prefers a sample when one exists, so adding
       them later is a data change rather than a rewrite. */
    this.samples = new Map();
  }

  /* --- lifecycle ---------------------------------------------------------- */

  /** Must be called from inside a real user gesture — iOS requires it. */
  unlock() {
    if (this.ready) return true;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;

    try {
      const ctx = new Ctor();

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 24;
      comp.ratio.value = 8;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;

      const master = ctx.createGain();
      master.gain.value = CONFIG.audio.masterVolume;

      master.connect(comp);
      comp.connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
      this.noiseBuffer = this.#makeNoise(ctx, 2);
      this.ready = true;

      ctx.resume?.();
      this.#primeSpeech();
      return true;
    } catch {
      return false;
    }
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {}); }
  suspend() {
    if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {});
    try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
  }

  setVolume(v01) {
    CONFIG.audio.masterVolume = clamp(v01, 0, 1);
    if (this.master) {
      this.master.gain.setTargetAtTime(CONFIG.audio.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  #makeNoise(ctx, seconds) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* --- building blocks ---------------------------------------------------- */

  #noise(when, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.3 } = {}) {
    const { ctx, master } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(when);
    src.stop(when + dur + 0.05);
    return { src, filt, g };
  }

  #tone(when, dur, { type = 'sine', freq = 440, gain = 0.3, sweepTo = null, attack = 0.008 } = {}) {
    const { ctx, master } = this;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), when + dur * 0.8);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(g); g.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    return { osc, g };
  }

  /* --- the sounds --------------------------------------------------------- */

  /**
   * The gulp — the signature sound. A downward swallow-sweep with a soft
   * thunk under it and a tiny satisfied blip on the end. Pitch scales
   * inversely with size, so a strawberry goes *glp* and a house goes *GLOMP*.
   * That alone makes clearing a whole world sound musical.
   * @param {number} sizeNorm 0 (tiny) .. 1 (the landmark)
   */
  gulp(sizeNorm = 0) {
    if (!this.ready) return;
    const norm = clamp(sizeNorm, 0, 1);
    const f0 = lerp(700, 260, norm);
    const t = this.t;

    this.#tone(t, 0.16, { type: 'sine', freq: f0, sweepTo: f0 * 0.45, gain: 0.45, attack: 0.006 });
    this.#noise(t, 0.06, { freq: f0 * 0.9, q: 1.2, gain: 0.16 });
    // The little "down the hatch!" blip after the swallow lands.
    this.#tone(t + 0.14, 0.08, { type: 'sine', freq: f0 * 1.3, sweepTo: f0 * 1.9, gain: 0.12, attack: 0.005 });
  }

  /** One step of the eat-streak melody. Climbs the pentatonic run and holds. */
  munch(step = 0) {
    if (!this.ready) return;
    const n = PENTATONIC[clamp(step, 0, PENTATONIC.length - 1)] + 12;
    this.#tone(this.t, 0.18, { type: 'triangle', freq: semi(C5, n), gain: 0.18, attack: 0.005 });
  }

  /** The friendly "too big!" wobble — a springy rubber-band boing. */
  boing() {
    if (!this.ready) return;
    const { ctx, master } = this;
    const t = this.t;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.3);

    // A fast pitch wobble that slows down is what reads as a spring settling.
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(16, t);
    lfo.frequency.exponentialRampToValueAtTime(5, t + 0.3);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(60, t);
    depth.gain.exponentialRampToValueAtTime(8, t + 0.3);
    lfo.connect(depth); depth.connect(osc.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 0.37);
    lfo.start(t); lfo.stop(t + 0.37);
  }

  /** The comedy beat after the landmark goes down. Deliberately a bit rude. */
  burp() {
    if (!this.ready) return;
    const { ctx, master } = this;
    const t = this.t;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.35);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.35);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    // The gurgle: a rough tremolo on the volume.
    const trem = ctx.createOscillator();
    trem.frequency.value = 11;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.11;
    trem.connect(tremDepth); tremDepth.connect(g.gain);

    osc.connect(lp); lp.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 0.45);
    trem.start(t); trem.stop(t + 0.45);
  }

  /** Cars and buses. An engine revving up and settling. */
  vroom() {
    if (!this.ready) return;
    const t = this.t;
    this.#voiced(t, 0.5, {
      type: 'sawtooth', from: 90, to: 280, filterFrom: 300, filterTo: 900, q: 2, gain: 0.2, attack: 0.04,
    });
    this.#voiced(t + 0.32, 0.22, {
      type: 'sawtooth', from: 240, to: 140, filterFrom: 800, filterTo: 350, q: 2, gain: 0.14, attack: 0.02,
    });
  }

  /** Trees and crunchy things disappearing. */
  crunch() {
    if (!this.ready) return;
    const t = this.t;
    this.#noise(t, 0.09, { type: 'highpass', freq: 1800, q: 0.7, gain: 0.2 });
    this.#noise(t + 0.11, 0.08, { type: 'highpass', freq: 1400, q: 0.7, gain: 0.16 });
  }

  /** Tiny high glitter — layered under the pop and under confetti. */
  sparkle(count = 3) {
    if (!this.ready) return;
    const t = this.t;
    for (let i = 0; i < count; i++) {
      const n = pick(PENTATONIC) + 24;
      this.#tone(t + i * 0.035, 0.16, {
        type: 'sine', freq: semi(C5, n), gain: 0.09, attack: 0.004,
      });
    }
  }

  /** Ascending run for the every-5-pops moment. */
  chime(count = 5) {
    if (!this.ready) return;
    const t = this.t;
    const start = Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const n = PENTATONIC[Math.min(PENTATONIC.length - 1, start + i)] + 12;
      this.#tone(t + i * 0.068, 0.34, {
        type: 'triangle', freq: semi(C5, n), gain: 0.24, attack: 0.006,
      });
    }
  }

  /** A crowd. Two noise bands with a slow wobble on top reads convincingly. */
  cheer(duration = 1.7) {
    if (!this.ready) return;
    const { ctx, master } = this;
    const t = this.t;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const low = ctx.createBiquadFilter();
    low.type = 'bandpass'; low.frequency.value = 850; low.Q.value = 0.55;

    const high = ctx.createBiquadFilter();
    high.type = 'bandpass'; high.frequency.value = 2500; high.Q.value = 0.8;
    const highGain = ctx.createGain();
    highGain.gain.value = 0.45;

    // The wobble: without it this is just noise; with it, it is a crowd.
    const wobble = ctx.createOscillator();
    wobble.type = 'sine';
    wobble.frequency.value = 5.5;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 0.3;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.42, t + 0.22);
    env.gain.setValueAtTime(0.42, t + duration * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    wobble.connect(wobbleDepth);
    wobbleDepth.connect(env.gain);

    src.connect(low); low.connect(env);
    src.connect(high); high.connect(highGain); highGain.connect(env);
    env.connect(master);

    src.start(t); src.stop(t + duration + 0.1);
    wobble.start(t); wobble.stop(t + duration + 0.1);
  }

  /** I – IV – V – I, with a kick under each chord. The "you won" sound. */
  fanfare() {
    if (!this.ready) return;
    const t = this.t;
    const chords = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]];

    chords.forEach((chord, i) => {
      const when = t + i * 0.24;
      const dur = i === chords.length - 1 ? 0.75 : 0.30;

      for (const n of chord) {
        const { ctx, master } = this;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = semi(C5 / 2, n);

        // Sweeping the filter open is what turns a buzzy saw into brass.
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 1.1;
        lp.frequency.setValueAtTime(650, when);
        lp.frequency.exponentialRampToValueAtTime(3400, when + 0.12);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(0.15, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

        osc.connect(lp); lp.connect(g); g.connect(master);
        osc.start(when); osc.stop(when + dur + 0.05);
      }

      this.kick(when);
      if (i > 0) this.snare(when + 0.12);
    });
  }

  kick(when = this.t) {
    if (!this.ready) return;
    this.#tone(when, 0.28, { type: 'sine', freq: 150, sweepTo: 45, gain: 0.55, attack: 0.004 });
  }

  snare(when = this.t) {
    if (!this.ready) return;
    this.#noise(when, 0.14, { type: 'highpass', freq: 1400, q: 0.7, gain: 0.22 });
  }

  /** Descending whoosh, used when the big trophy drops in. */
  whoosh(duration = 0.45) {
    if (!this.ready) return;
    const t = this.t;
    const { ctx, master } = this;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(320, t + duration);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + duration + 0.05);
  }

  /* --- animal calls -------------------------------------------------------- */

  /**
   * A tone pushed through its own lowpass filter with an envelope on both —
   * the vocal-tract trick behind every call below. Sweeping the filter is what
   * turns a raw buzz into something that sounds like it came from a throat.
   */
  #voiced(when, dur, {
    type = 'sawtooth', from = 200, to = 120, gain = 0.3,
    filterFrom = 600, filterTo = 300, q = 2, attack = 0.01,
  } = {}) {
    const { ctx, master } = this;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), when + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = q;
    lp.frequency.setValueAtTime(filterFrom, when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), when + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(lp); lp.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + dur + 0.05);
  }

  /**
   * Plays a thing's synthesized voice. Returns false when there is no recipe
   * for that name (or audio is not unlocked yet), so the caller can fall back
   * to the speaking voice instead.
   */
  call(name) {
    if (!this.ready || !name) return false;
    switch (name) {
      case 'woof': this.#woof(240); return true;
      case 'yip': this.#woof(520); return true;
      case 'meow': this.#meow(); return true;
      case 'moo': this.#moo(); return true;
      case 'oink': this.#oink(); return true;
      case 'ribbit': this.#ribbit(); return true;
      case 'tweet': this.#tweet(); return true;
      case 'quack': this.#quack(); return true;
      case 'baa': this.#baa(); return true;
      case 'neigh': this.#neigh(); return true;
      case 'buzz': this.#buzz(); return true;
      case 'roar': this.#roar(150, 0.5, 0.32); return true;
      case 'bigroar': this.#roar(95, 0.75, 0.38); return true;
      case 'trumpet': this.#trumpet(); return true;
      case 'hoot': this.#hoot(); return true;
      case 'monkey': this.#monkey(); return true;
      case 'squeak': this.#squeak(); return true;
      case 'hiss': this.#hiss(); return true;
      case 'splash': this.#splash(); return true;
      case 'dolphin': this.#dolphin(); return true;
      case 'magic': this.#magic(); return true;
      case 'vroom': this.vroom(); return true;
      case 'crunch': this.crunch(); return true;
      case 'boing': this.boing(); return true;
      case 'whoosh': this.whoosh(0.5); return true;
      default: return false;
    }
  }

  /** Two short barks. A higher base pitch turns the woof into a fox's yip. */
  #woof(base) {
    const t = this.t;
    this.#voiced(t, 0.09, {
      from: base, to: base * 0.55, filterFrom: 4 * base, filterTo: base, gain: 0.34, q: 1.5,
    });
    this.#voiced(t + 0.15, 0.11, {
      from: base * 0.92, to: base * 0.5, filterFrom: 3.6 * base, filterTo: base, gain: 0.3, q: 1.5,
    });
  }

  /** Rises, holds, falls — with a touch of vibrato so it pleads a little. */
  #meow() {
    const { ctx, master } = this;
    const t = this.t;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(430, t);
    osc.frequency.exponentialRampToValueAtTime(840, t + 0.16);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.42);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const depth = ctx.createGain();
    depth.gain.value = 16;
    lfo.connect(depth); depth.connect(osc.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 0.5);
    lfo.start(t); lfo.stop(t + 0.5);
  }

  #moo() {
    const t = this.t;
    this.#voiced(t, 0.6, {
      from: 170, to: 92, filterFrom: 430, filterTo: 230, q: 3, gain: 0.3, attack: 0.06,
    });
  }

  /** A snuffly grunt: mostly nose, barely any voice. Two of them. */
  #oink() {
    const t = this.t;
    for (const when of [t, t + 0.18]) {
      this.#noise(when, 0.1, { type: 'bandpass', freq: 400, q: 2.4, gain: 0.26 });
      this.#voiced(when, 0.09, { from: 150, to: 85, filterFrom: 450, filterTo: 200, gain: 0.2 });
    }
  }

  #ribbit() {
    const t = this.t;
    this.#tone(t, 0.08, { type: 'square', freq: 150, sweepTo: 110, gain: 0.16 });
    this.#tone(t + 0.13, 0.09, { type: 'square', freq: 135, sweepTo: 95, gain: 0.16 });
  }

  /** Three quick up-chirps. Doubles for every small bird in the zoo. */
  #tweet() {
    const t = this.t;
    for (let i = 0; i < 3; i++) {
      this.#tone(t + i * 0.11, 0.09, {
        type: 'sine', freq: 1500 + i * 150, sweepTo: 2300 + i * 150, gain: 0.13, attack: 0.005,
      });
    }
  }

  /** Nasal squares with the filter pinched tight — unmistakably a duck. */
  #quack() {
    const t = this.t;
    this.#voiced(t, 0.13, { type: 'square', from: 300, to: 190, filterFrom: 1300, filterTo: 500, q: 4, gain: 0.2 });
    this.#voiced(t + 0.19, 0.14, { type: 'square', from: 280, to: 170, filterFrom: 1200, filterTo: 450, q: 4, gain: 0.19 });
  }

  /** The tremolo IS the sheep — a steady tone with a 9 Hz shake on its volume. */
  #baa() {
    const { ctx, master } = this;
    const t = this.t;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.5);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 1.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

    const trem = ctx.createOscillator();
    trem.frequency.value = 9;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.08;
    trem.connect(tremDepth); tremDepth.connect(g.gain);

    osc.connect(lp); lp.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 0.6);
    trem.start(t); trem.stop(t + 0.6);
  }

  /** A descending trill with a snort of breath underneath. */
  #neigh() {
    const t = this.t;
    for (let i = 0; i < 5; i++) {
      this.#tone(t + i * 0.06, 0.07, {
        type: 'triangle', freq: 760 * Math.pow(0.86, i), gain: 0.16, attack: 0.006,
      });
    }
    this.#noise(t, 0.3, { type: 'bandpass', freq: 900, q: 0.7, gain: 0.07 });
  }

  #buzz() {
    const { ctx, master } = this;
    const t = this.t;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 140;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 23;
    const depth = ctx.createGain();
    depth.gain.value = 14;
    lfo.connect(depth); depth.connect(osc.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 0.5);
    lfo.start(t); lfo.stop(t + 0.5);
  }

  /**
   * Filtered noise swelling open over a low voice: lions, tigers, bears —
   * and pitched lower and longer, dinosaurs and dragons.
   */
  #roar(base, dur, gain) {
    const { ctx, master } = this;
    const t = this.t;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(260, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur * 0.35);
    lp.frequency.exponentialRampToValueAtTime(200, t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);

    this.#voiced(t, dur, {
      from: base, to: base * 0.55, filterFrom: 500, filterTo: 160, q: 1.5,
      gain: gain * 0.7, attack: 0.05,
    });
  }

  /** The fanfare's brass trick, bent upward — an elephant announcing itself. */
  #trumpet() {
    const t = this.t;
    this.#voiced(t, 0.5, {
      from: 310, to: 620, filterFrom: 700, filterTo: 3000, q: 1.2, gain: 0.24, attack: 0.03,
    });
  }

  #hoot() {
    const t = this.t;
    this.#tone(t, 0.18, { type: 'sine', freq: 400, sweepTo: 330, gain: 0.22, attack: 0.02 });
    this.#tone(t + 0.27, 0.22, { type: 'sine', freq: 380, sweepTo: 310, gain: 0.2, attack: 0.02 });
  }

  /** Oo-oo-ah: three rising whoops. */
  #monkey() {
    const t = this.t;
    for (let i = 0; i < 3; i++) {
      this.#tone(t + i * 0.12, 0.1, {
        type: 'triangle', freq: 460 + i * 90, sweepTo: 660 + i * 110, gain: 0.18, attack: 0.008,
      });
    }
  }

  /** Two tiny rising blips, for every creature too small to have a big voice. */
  #squeak() {
    const t = this.t;
    this.#tone(t, 0.08, { type: 'sine', freq: 950, sweepTo: 1400, gain: 0.13, attack: 0.005 });
    this.#tone(t + 0.12, 0.09, { type: 'sine', freq: 1100, sweepTo: 1650, gain: 0.12, attack: 0.005 });
  }

  #hiss() {
    if (!this.ready) return;
    this.#noise(this.t, 0.38, { type: 'highpass', freq: 3400, q: 0.6, gain: 0.1 });
  }

  /** Water for the sea creatures: a soft splosh with a droplet on top. */
  #splash() {
    const t = this.t;
    this.#noise(t, 0.28, { type: 'bandpass', freq: 950, q: 0.8, gain: 0.22 });
    this.#tone(t + 0.06, 0.12, { type: 'sine', freq: 480, sweepTo: 900, gain: 0.16 });
  }

  /** The splash plus a pair of high clicks-and-whistles. */
  #dolphin() {
    const t = this.t;
    this.#noise(t, 0.2, { type: 'bandpass', freq: 1100, q: 0.9, gain: 0.16 });
    this.#tone(t, 0.12, { type: 'sine', freq: 1800, sweepTo: 2700, gain: 0.12, attack: 0.005 });
    this.#tone(t + 0.16, 0.13, { type: 'sine', freq: 2100, sweepTo: 3000, gain: 0.11, attack: 0.005 });
  }

  /** A fast pentatonic glissando — the unicorns and everything else magical. */
  #magic() {
    const t = this.t;
    for (let i = 0; i < 6; i++) {
      this.#tone(t + i * 0.045, 0.22, {
        type: 'triangle', freq: semi(C5, PENTATONIC[i] + 12), gain: 0.11, attack: 0.005,
      });
    }
  }

  /* --- voice -------------------------------------------------------------- */

  #primeSpeech() {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const choose = () => {
      let voices = [];
      try { voices = synth.getVoices() || []; } catch { return; }
      const en = voices.filter((v) => /^en\b|^en-/i.test(v.lang || ''));
      if (!en.length) return;

      // A warmer, higher voice lands better with a small child than the default.
      const preferred = /samantha|karen|zira|female|google uk english female|moira|tessa/i;
      this.voice = en.find((v) => preferred.test(v.name)) || en[0];
    };

    choose();
    try { synth.addEventListener('voiceschanged', choose); } catch { synth.onvoiceschanged = choose; }
  }

  /**
   * @param {string} text
   * @param {{interrupt?: boolean}} [opts] `interrupt` cuts off whatever is
   *   speaking — used for celebrations, which should never wait in a queue
   *   behind thirty animal names.
   */
  speak(text, { interrupt = false } = {}) {
    if (!CONFIG.audio.voiceEnabled) return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    try {
      if (interrupt) {
        synth.cancel();
      } else if (synth.speaking || synth.pending) {
        return; // drop it rather than stacking up forty utterances
      }

      const say = () => {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = CONFIG.audio.speechRate;
        u.pitch = CONFIG.audio.speechPitch;
        u.volume = CONFIG.audio.speechVolume;
        u.lang = this.voice?.lang || 'en-US';
        if (this.voice) u.voice = this.voice;
        synth.speak(u);
      };

      // Chrome silently drops an utterance queued in the same tick as cancel().
      if (interrupt) setTimeout(say, 70);
      else say();
    } catch { /* speech is a bonus, never a requirement */ }
  }

  /**
   * Says (or one day plays) a creature's name.
   * Already prefers a real recording if one has been registered.
   */
  creatureSound(name) {
    const sample = this.samples.get(name);
    if (sample && this.ready) {
      const src = this.ctx.createBufferSource();
      src.buffer = sample;
      src.connect(this.master);
      src.start(this.t);
      return;
    }
    this.speak(name);
  }
}

export const audio = new AudioEngine();
