/* ---------------------------------------------------------------------------
   Touch handling, built for a three-year-old rather than for a gamer.

   Two things matter here and nothing else does:

   1. Every finger counts. Pointer events give us multi-touch for free, so a
      whole palm slapped onto the screen still reads as somewhere to go.
      Mashing is the point, not something to defend against.

   2. Smearing counts. Toddlers drag far more than they tap, so the path of a
      moving finger is sampled rather than tested only at the endpoints —
      the hole tracks the real shape of a fast swipe instead of a straight
      line per frame.
   --------------------------------------------------------------------------- */

const SAMPLE_STEP = 26;   // logical units between hit tests along a drag
const MAX_SAMPLES = 24;   // guards against a huge jump after a stall

/**
 * @param {HTMLCanvasElement} canvas
 * @param {(clientX: number, clientY: number) => {x: number, y: number}} toWorld
 * @param {(x: number, y: number, kind: 'down' | 'move' | 'up', pointerId: number) => void} onPoint
 *   `up` reports the finger lifting — the hole needs to know when to stop
 *   chasing, and which of several fingers it just lost.
 */
export function attachInput(canvas, toWorld, onPoint) {
  const last = new Map(); // pointerId -> last world position

  const down = (e) => {
    const p = toWorld(e.clientX, e.clientY);
    last.set(e.pointerId, p);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    onPoint(p.x, p.y, 'down', e.pointerId);
    e.preventDefault();
  };

  const move = (e) => {
    const prev = last.get(e.pointerId);
    if (!prev) return; // a hover with no button down — ignore it
    e.preventDefault();

    // Coalesced events give us the real path of a fast swipe on browsers that
    // batch pointer moves, instead of one straight line per frame.
    const points = typeof e.getCoalescedEvents === 'function'
      ? e.getCoalescedEvents()
      : [e];

    let from = prev;
    for (const ev of points) {
      const to = toWorld(ev.clientX, ev.clientY);
      sampleSegment(from, to, onPoint, e.pointerId);
      from = to;
    }
    last.set(e.pointerId, from);
  };

  const up = (e) => {
    const p = last.get(e.pointerId);
    last.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (p) onPoint(p.x, p.y, 'up', e.pointerId);
  };

  canvas.addEventListener('pointerdown', down, { passive: false });
  canvas.addEventListener('pointermove', move, { passive: false });
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  // Note: no `pointerleave`. With capture held it would only ever fire
  // spuriously, and dropping a stroke mid-smear is exactly what we must avoid.
  canvas.addEventListener('lostpointercapture', up);

  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('lostpointercapture', up);
    last.clear();
  };
}

function sampleSegment(from, to, onPoint, pointerId) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const steps = Math.min(MAX_SAMPLES, Math.max(1, Math.ceil(dist / SAMPLE_STEP)));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    onPoint(from.x + dx * t, from.y + dy * t, 'move', pointerId);
  }
}

/**
 * Kills every browser gesture that would otherwise interrupt play: double-tap
 * zoom, pinch zoom, pull-to-refresh, text selection and the long-press callout.
 * CSS covers most of this, but Safari in particular still needs the listeners.
 *
 * Real form controls are exempt — swallowing `touchstart` on a button also
 * swallows the click that follows it, which would leave the grown-ups menu dead.
 */
const INTERACTIVE = 'input, button, select, textarea, a, [data-allow-touch]';

export function suppressBrowserGestures(target = document) {
  const blockUnlessInteractive = (e) => {
    const el = e.target;
    if (el instanceof Element && el.closest(INTERACTIVE)) return;
    e.preventDefault();
  };
  const block = (e) => e.preventDefault();

  target.addEventListener('touchstart', blockUnlessInteractive, { passive: false });
  target.addEventListener('touchmove', blockUnlessInteractive, { passive: false });
  target.addEventListener('selectstart', blockUnlessInteractive);

  target.addEventListener('contextmenu', block);
  target.addEventListener('dragstart', block);
  // Safari-only pinch gestures; harmless no-ops elsewhere.
  target.addEventListener('gesturestart', block);
  target.addEventListener('gesturechange', block);
  target.addEventListener('gestureend', block);
}
