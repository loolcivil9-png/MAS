/* ---------------------------------------------------------------------------
   The city remembers him.

   Not just the totals — the CITY ITSELF is saved: its seed (which rebuilds
   the identical layout), which things are already eaten, and how big the hole
   has grown. Closing the app halfway through the market and opening it
   tomorrow resumes exactly there. That matters, because with one big city and
   deliberately slow growth, a session often ends mid-journey.

   Every localStorage touch is wrapped in try/catch. Private browsing, a full
   quota or storage being switched off all degrade silently to session-only
   play. Older saves (Bubble Zoo v1, the levelled Hungry Hole v2) migrate so
   his lifetime totals survive every update.
   --------------------------------------------------------------------------- */

import { CONFIG } from './config.js';
import { CITY_KINDS } from './city.js';

/** Bumped when the shape below changes, so old saves can be spotted. */
const SCHEMA = 3;

/** Names of every kind of thing he has eaten at least once. */
export const met = new Set();

let getState = null;   // supplied by main.js — see flushSave for the shape
let dirty = false;
let lastWrite = 0;

/**
 * Reads the save. Returns `{ totalEaten, cities, city }` where `city` is
 * `{ seed, eaten: number[], holeR }` or null when a fresh city is needed.
 * Corrupt or future-schema saves are discarded rather than crashing the boot.
 */
export function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (raw) {
      const s = JSON.parse(raw);
      if (!s) return null;
      if (s.v === 3) return readV3(s);
      if (s.v === 2) return migrateV2(s);
      return null;
    }
    return migrateLegacy();
  } catch {
    return null;
  }
}

function readV3(s) {
  const totalEaten = Math.max(0, Math.floor(Number(s.totalEaten) || 0));
  const cities = Math.max(0, Math.floor(Number(s.cities) || 0));
  if (Array.isArray(s.met)) {
    for (const name of s.met) if (typeof name === 'string' && CITY_KINDS.has(name)) met.add(name);
  }

  let city = null;
  const c = s.city;
  if (c && Number.isFinite(c.seed) && Array.isArray(c.eaten) && Number.isFinite(c.holeR)) {
    city = {
      seed: c.seed >>> 0,
      eaten: c.eaten.filter((n) => Number.isInteger(n) && n >= 0),
      holeR: Math.max(CONFIG.hole.baseRadius, Number(c.holeR)),
    };
  }
  return { totalEaten, cities, city };
}

/** A v2 save from the levelled version: totals carry over, city starts fresh. */
function migrateV2(s) {
  dirty = true;
  return {
    totalEaten: Math.max(0, Math.floor(Number(s.totalEaten) || 0)),
    cities: Math.max(0, Math.floor(Number(s.trophies) || 0)),
    city: null,
  };
}

/** A v1 save from Bubble Zoo, two games ago. His trophies still count. */
function migrateLegacy() {
  try {
    const raw = localStorage.getItem(CONFIG.save.legacyKey);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;

    localStorage.removeItem(CONFIG.save.legacyKey);
    dirty = true;
    return {
      totalEaten: Math.max(0, Math.floor(Number(s.totalPops) || 0)),
      cities: Math.max(0, Math.floor(Number(s.trophies) || 0)),
      city: null,
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
    // getState → { totalEaten, cities, citySeed, cityEaten: number[], holeR }
    const s = getState();
    localStorage.setItem(CONFIG.save.key, JSON.stringify({
      v: SCHEMA,
      totalEaten: s.totalEaten,
      cities: s.cities,
      met: [...met],
      city: { seed: s.citySeed, eaten: s.cityEaten, holeR: s.holeR },
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
