/* ---------------------------------------------------------------------------
   The zoo remembers him.

   Total pops, level, trophies and which animals he has met all survive between
   sessions, so the rarest creatures stay unlocked and coming back tomorrow
   means picking up where he left off — not starting over.

   Two deliberate choices:

   * Progress *within* a level is never saved. Every session opens on a fresh
     level at zero stars, which guarantees a win inside the first two minutes
     of play and keeps the star row honest.

   * Every localStorage touch is wrapped in try/catch. Private browsing, a
     full quota or storage being switched off all degrade silently to
     session-only play — exactly how the game behaved before saving existed.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';

/** Bumped only if the shape below ever changes, so old saves can be spotted. */
const SCHEMA = 1;

/** Names of every creature he has popped at least once. */
export const met = new Set();

let getState = null;   // supplied by main.js: () => ({ totalPops, level, trophies })
let dirty = false;
let lastWrite = 0;

/**
 * Reads the save. Returns `{ totalPops, level, trophies }` if a valid one
 * exists, or null for a fresh start (including any corrupt or future-schema
 * save — those are discarded rather than allowed to crash the boot).
 */
export function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== SCHEMA) return null;

    const totalPops = Math.max(0, Math.floor(Number(s.totalPops) || 0));
    const level = Math.max(1, Math.floor(Number(s.level) || 1));
    const trophies = Math.max(0, Math.floor(Number(s.trophies) || 0));
    if (Array.isArray(s.met)) for (const name of s.met) if (typeof name === 'string') met.add(name);

    return { totalPops, level, trophies };
  } catch {
    return null;
  }
}

/** Hooks the writer up to live game state and flushes when the app is put away. */
export function initSave(stateFn) {
  getState = stateFn;

  // The realistic exit is the parent taking the phone, not a tidy shutdown.
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  window.addEventListener('pagehide', flushSave);
}

/**
 * Called on every pop. Writes at most once every `save.throttleSeconds`;
 * anything still pending is picked up by the next flush.
 */
export function markDirty() {
  dirty = true;
  if (performance.now() - lastWrite >= CONFIG.save.throttleSeconds * 1000) flushSave();
}

/** Writes now. Also called directly at moments worth never losing. */
export function flushSave() {
  if (!dirty || !getState) return;
  try {
    const s = getState();
    localStorage.setItem(CONFIG.save.key, JSON.stringify({
      v: SCHEMA,
      totalPops: s.totalPops,
      level: s.level,
      trophies: s.trophies,
      met: [...met],
    }));
    dirty = false;
    lastWrite = performance.now();
  } catch { /* storage unavailable — session-only play is fine */ }
}

/** "Start over" in the grown-ups menu: forget everything. */
export function clearSave() {
  met.clear();
  dirty = false;
  try { localStorage.removeItem(CONFIG.save.key); } catch { /* already gone */ }
}
