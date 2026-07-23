/* ---------------------------------------------------------------------------
   Generates the PWA icons.

   Written against nothing but Node's built-in zlib — no npm install, no
   dependency to audit, and it will still run in five years. Every pixel is
   computed by hand and the result is encoded straight to PNG.

   Run once from the project root:

       node tools/make-icons.mjs

   Output: icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png
   --------------------------------------------------------------------------- */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');

/* --- tiny maths -------------------------------------------------------------- */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** 0 below `edge0`, 1 above `edge1`, smooth in between. Our only antialiasing. */
function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

/* --- PNG encoding ------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

/** @param {Uint8Array} rgba tightly packed RGBA, `size * size * 4` bytes */
function encodePng(rgba, size) {
  const stride = size * 4;
  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: truecolour with alpha
  ihdr[10] = 0;  // compression: deflate
  ihdr[11] = 0;  // filter: adaptive
  ihdr[12] = 0;  // interlace: none

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --- the artwork ------------------------------------------------------------- */

/** Signed distance to a rounded square centred in a `size` box. Negative inside. */
function roundedSquareSdf(x, y, size, radius) {
  const half = size / 2;
  const dx = Math.abs(x - half) - (half - radius);
  const dy = Math.abs(y - half) - (half - radius);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Four-point sparkle, centred on (cx, cy). Returns 0..1 coverage. */
function sparkle(x, y, cx, cy, r) {
  const u = Math.abs(x - cx) / r;
  const v = Math.abs(y - cy) / r;
  const d = Math.sqrt(u) + Math.sqrt(v); // < 1 inside the concave star
  return smoothstep(1.05, 0.9, d);
}

function renderIcon(size, { maskable }) {
  const px = new Uint8Array(size * size * 4);

  // Maskable icons get cropped to a circle on some launchers, so the artwork
  // is pulled into the middle 80% and the background bleeds to every edge.
  const pad = maskable ? size * 0.10 : 0;
  const artSize = size - pad * 2;
  const cornerRadius = maskable ? 0 : size * 0.225;

  // The hole: an ellipse sitting on the grass, eyes peeking over its rim.
  const hcx = size * 0.5;
  const hcy = size * 0.60;
  const hrx = artSize * 0.315;
  const hry = hrx * 0.62;
  const eyeR = hrx * 0.20;
  const eyeY = hcy - hry * 1.28;

  const put = (i, r, g, b, a) => {
    // Source-over compositing onto whatever is already in the buffer.
    const da = px[i + 3] / 255;
    const outA = a + da * (1 - a);
    if (outA <= 0) return;
    px[i] = (r * a + px[i] * da * (1 - a)) / outA;
    px[i + 1] = (g * a + px[i + 1] * da * (1 - a)) / outA;
    px[i + 2] = (b * a + px[i + 2] * da * (1 - a)) / outA;
    px[i + 3] = outA * 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const fx = x + 0.5;
      const fy = y + 0.5;

      // --- background plate: sky over a gently rolling meadow -----------------
      const cover = maskable
        ? 1
        : smoothstep(1, -1, roundedSquareSdf(fx, fy, size, cornerRadius));
      if (cover <= 0.001) continue;

      const groundLine = size * 0.46 + Math.sin((fx / size) * Math.PI * 1.6 + 0.4) * size * 0.025;
      let br;
      let bg;
      let bb;
      if (fy < groundLine) {
        const u = clamp01(fy / groundLine);
        br = lerp(0x58, 0xb9, u);
        bg = lerp(0xb4, 0xe9, u);
        bb = lerp(0xf2, 0xff, u);
      } else {
        const v = clamp01((fy - groundLine) / (size - groundLine));
        br = lerp(0x63, 0x2f, v);
        bg = lerp(0xc9, 0x8f, v);
        bb = lerp(0x58, 0x3c, v);
      }
      put(i, br, bg, bb, cover);

      // --- sparkles in the sky -------------------------------------------------
      const sparkles = [
        [size * 0.215, size * 0.205, size * 0.062],
        [size * 0.800, size * 0.255, size * 0.046],
      ];
      for (const [sx, sy, sr] of sparkles) {
        const a = sparkle(fx, fy, sx, sy, sr) * cover * 0.92;
        if (a > 0.002) put(i, 255, 249, 214, a);
      }

      // --- the hole ------------------------------------------------------------
      const ex = (fx - hcx) / hrx;
      const ey = (fy - hcy) / hry;
      const ed = Math.hypot(ex, ey); // 1 exactly on the ellipse edge

      if (ed < 1.6) {
        const ang = Math.atan2(ey, ex);
        const hue = (ang / Math.PI) * 180 + 230; // the rainbow rim

        // The outer glow, so the rim reads as light rather than paint.
        if (ed > 1) {
          const glow = Math.exp(-(((ed - 1) / 0.17) ** 2)) * 0.4;
          const [gr, gg, gb] = hslToRgb(hue, 0.95, 0.7);
          if (glow > 0.004) put(i, gr, gg, gb, glow * cover);
        }

        // The dark itself: near-black centre, deep violet toward the edge.
        const inside = smoothstep(1.015, 0.985, ed);
        if (inside > 0) {
          const t = clamp01(ed);
          const dr = lerp(0x06, 0x22, t ** 1.6);
          const dg = lerp(0x03, 0x14, t ** 1.6);
          const db = lerp(0x12, 0x48, t ** 1.6);
          put(i, dr, dg, db, inside * cover);

          // A faint interior swirl ring, hinting at depth.
          const swirl = Math.exp(-(((ed - 0.52) / 0.07) ** 2)) * 0.22;
          if (swirl > 0.004) put(i, 0x6e, 0x58, 0xbe, swirl * inside * cover);
        }

        // The bright rim.
        const rim = Math.exp(-(((ed - 1) / 0.045) ** 2));
        if (rim > 0.004) {
          const [rr, rg, rb] = hslToRgb(hue, 0.95, 0.72);
          put(i, rr, rg, rb, rim * cover * 0.96);
        }
      }

      // --- googly eyes peeking over the rim, drawn last ------------------------
      for (const side of [-1, 1]) {
        const dxE = fx - (hcx + side * hrx * 0.46);
        const dyE = fy - eyeY;
        const d = Math.hypot(dxE, dyE) / eyeR;
        if (d > 1.35) continue;

        put(i, 255, 255, 255, smoothstep(1.06, 0.96, d) * cover);

        const outline = Math.exp(-(((d - 1) / 0.09) ** 2)) * 0.85;
        if (outline > 0.004) put(i, 0x1e, 0x12, 0x46, outline * cover);

        const pd = Math.hypot(dxE, dyE - eyeR * 0.28) / (eyeR * 0.46);
        if (pd < 1.2) put(i, 0x22, 0x14, 0x48, smoothstep(1.08, 0.92, pd) * cover);

        const gd = Math.hypot(dxE + eyeR * 0.14, dyE - eyeR * 0.12) / (eyeR * 0.14);
        if (gd < 1.3) put(i, 255, 255, 255, smoothstep(1.1, 0.8, gd) * cover * 0.9);
      }
    }
  }

  return encodePng(px, size);
}

/* --- go ---------------------------------------------------------------------- */

mkdirSync(OUT, { recursive: true });

const jobs = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
];

for (const [name, size, opts] of jobs) {
  const png = renderIcon(size, opts);
  writeFileSync(join(OUT, name), png);
  console.log(`wrote icons/${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`);
}
