/* ---------------------------------------------------------------------------
   The world remembers him.

   Things eaten, worlds finished and everything he has ever met all survive
   between sessions, so coming back tomorrow means picking up where he left
   off — not starting over.

   Two deliberate choices:

   * Progress *within* a level is never saved — nor is the hole's size.
     Every session opens on a fresh, full world with a small hole, which
     guarantees a clean-plate win inside the first minutes of play.

   * Every localStorage touch is wrapped in try/catch. Private browsing, a
     full quota or storage being switched off all degrade silently to
     session-only play.

   Old Bubble Zoo saves (schema 1) are migrated on first load: his level and
   trophies carry over, so the update never erases what he earned.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';

/** Bumped when the shape below changes, so old saves can be spotted. */
const SCHEMA = 2;

/** Names of every thing he has eaten at least once. */
export const met = new Set();

let getState = null;   // supplied by main.js: () => ({ totalEaten, level, trophies })
let dirty = false;
let lastWrite = 0;

/**
 * Reads the save. Returns `{ totalEaten, level, trophies }` if a valid one
 * exists, or null for a fresh start. Corrupt or future-schema saves are
 * discarded rather than allowed to crash the boot.
 */
export function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (raw) {
      const s = JSON.parse(raw);
      if (!s || s.v !== SCHEMA) return null;

      const totalEaten = Math.max(0, Math.floor(Number(s.totalEaten) || 0));
      const level = Math.max(1, Math.floor(Number(s.level) || 1));
      const trophies = Math.max(0, Math.floor(Number(s.trophies) || 0));
      if (Array.isArray(s.met)) for (const name of s.met) if (typeof name === 'string') met.add(name);

      return { totalEaten, level, trophies };
    }
    return migrateLegacy();
  } catch {
    return null;
  }
}

/**
 * A schema-1 save from the game this one replaced (Bubble Zoo). Level and
 * trophies carry straight over; popped bubbles become eaten things; the old
 * met-list is dropped because the cast changed completely.
 */
function migrateLegacy() {
  try {
    const raw = localStorage.getItem(CONFIG.save.legacyKey);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;

    localStorage.removeItem(CONFIG.save.legacyKey);
    // The old key is gone; make sure the migrated state reaches the new key
    // at the next flush even if he never eats anything this session.
    dirty = true;
    return {
      totalEaten: Math.max(0, Math.floor(Number(s.totalPops) || 0)),
      level: Math.max(1, Math.floor(Number(s.level) || 1)),
      trophies: Math.max(0, Math.floor(Number(s.trophies) || 0)),
    };
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
 * Called on every eat. Writes at most once every `save.throttleSeconds`;
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
      totalEaten: s.totalEaten,
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
  try {
    localStorage.removeItem(CONFIG.save.key);
    localStorage.removeItem(CONFIG.save.legacyKey);
  } catch { /* already gone */ }
}
