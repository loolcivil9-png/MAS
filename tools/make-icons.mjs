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

  const bubbleR = artSize * 0.315;
  const bcx = size * 0.5;
  const bcy = size * 0.5;

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

      // --- background plate ---------------------------------------------------
      const cover = maskable
        ? 1
        : smoothstep(1, -1, roundedSquareSdf(fx, fy, size, cornerRadius));
      if (cover <= 0.001) continue;

      const t = fy / size;
      let br = lerp(0x74, 0x18, t);
      let bg = lerp(0x46, 0x0e, t);
      let bb = lerp(0xe8, 0x40, t);

      // Warm glow behind the bubble so it does not sit on flat colour.
      const glow = Math.exp(-(((fx - bcx) ** 2 + (fy - bcy * 0.86) ** 2) / (2 * (size * 0.34) ** 2)));
      br = lerp(br, 0xff, glow * 0.16);
      bg = lerp(bg, 0xd9, glow * 0.16);
      bb = lerp(bb, 0xa8, glow * 0.10);

      put(i, br, bg, bb, cover);

      // --- sparkles behind the bubble ----------------------------------------
      const sparkles = [
        [size * 0.235, size * 0.255, size * 0.070],
        [size * 0.795, size * 0.315, size * 0.048],
        [size * 0.760, size * 0.760, size * 0.058],
      ];
      for (const [sx, sy, sr] of sparkles) {
        const a = sparkle(fx, fy, sx, sy, sr) * cover * 0.92;
        if (a > 0.002) put(i, 255, 249, 214, a);
      }

      // --- the bubble ---------------------------------------------------------
      const dx = fx - bcx;
      const dy = fy - bcy;
      const d = Math.hypot(dx, dy);

      if (d < bubbleR * 1.02) {
        const inside = smoothstep(bubbleR + 1, bubbleR - 1, d) * cover;
        const nt = clamp01(d / bubbleR);
        const ang = Math.atan2(dy, dx);

        // Iridescence: hue sweeps around the rim and outward from the centre.
        const hue = 186 + Math.cos(ang - 0.85) * 78 + nt * 66;
        const [r, g, b] = hslToRgb(hue, 0.92, lerp(0.86, 0.60, nt));
        // Glass is see-through in the middle and dense at the edge.
        const alpha = inside * (0.20 + 0.62 * nt ** 3);
        put(i, r, g, b, alpha);

        // Bright rim.
        const rim = Math.exp(-(((d - bubbleR * 0.945) / (bubbleR * 0.055)) ** 2));
        if (rim > 0.004) {
          const [rr, rg, rb] = hslToRgb(hue + 172, 1, 0.90);
          put(i, rr, rg, rb, rim * inside * 0.95);
        }
      }

      // --- specular highlight, drawn last so it reads as glass ----------------
      const hx = fx - (bcx - bubbleR * 0.36);
      const hy = fy - (bcy - bubbleR * 0.40);
      const ca = Math.cos(-0.62);
      const sa = Math.sin(-0.62);
      const ux = (hx * ca - hy * sa) / (bubbleR * 0.27);
      const uy = (hx * sa + hy * ca) / (bubbleR * 0.165);
      const hd = Math.hypot(ux, uy);
      if (hd < 1.25) put(i, 255, 255, 255, smoothstep(1.05, 0.7, hd) * cover * 0.95);
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
