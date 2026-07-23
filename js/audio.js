/* ---------------------------------------------------------------------------
   Sound, generated entirely in code. No audio files, nothing to download,
   works offline from the first second.

   Two deliberate choices worth knowing about:

   * Everything melodic uses a major pentatonic scale. Pentatonic has no
     dissonant interval in it, so when he mashes ten bubbles at once the result
     is a chord rather than a mess. It is impossible for this to sound wrong.

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
   * The bubble pop. A fast upward pitch sweep with a click on the front — the
   * shape of a water droplet, which is what reads as "pop" to an ear.
   * Pitch scales inversely with size, so big bubbles go *bloop* and small ones
   * go *blip*. That alone makes popping a wall of bubbles sound musical.
   */
  pop(radius) {
    if (!this.ready) return;
    const B = CONFIG.bubble;
    const norm = clamp((radius - B.minRadius) / Math.max(1, B.maxRadius - B.minRadius), 0, 1);
    const f0 = lerp(780, 370, norm);
    const t = this.t;

    this.#tone(t, 0.12, { type: 'sine', freq: f0 * 0.45, sweepTo: f0 * 1.8, gain: 0.5, attack: 0.005 });
    this.#noise(t, 0.035, { freq: f0 * 2.4, q: 1.1, gain: 0.14 });
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
