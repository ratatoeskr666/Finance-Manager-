// One-off script to generate PWA PNG icons from a solid background + glyph.
// Uses only Node built-ins (zlib + Buffer) — no external deps.
// Run with: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [15, 23, 42];        // slate-950
const FG = [34, 211, 238];      // cyan-400
const ACCENT = [165, 243, 252]; // cyan-200

function makePng(size, draw) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const i = (y * size + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return encodePng(size, size, pixels);
}

// Simple PNG encoder (RGBA, no filtering).
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // Add filter byte (0) at the start of each scanline.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.subarray(y * width * 4, (y + 1) * width * 4).forEach((v, x) => {
      raw[y * (1 + width * 4) + 1 + x] = v;
    });
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Glyph: a stylized rising line chart "/" inside a rounded rectangle.
// path points (in 64x64 space): (10,46) → (22,30) → (34,38) → (54,14).
function drawIcon(maskable) {
  const path = [
    [10, 46],
    [22, 30],
    [34, 38],
    [54, 14],
  ];
  return (x, y, size) => {
    const u = (x / size) * 64;
    const v = (y / size) * 64;
    // Maskable variant: full bleed; non-maskable: rounded square with safe padding.
    if (!maskable) {
      const r = 14;
      const out =
        (u < r && v < r && (u - r) ** 2 + (v - r) ** 2 > r * r) ||
        (u > 64 - r && v < r && (u - (64 - r)) ** 2 + (v - r) ** 2 > r * r) ||
        (u < r && v > 64 - r && (u - r) ** 2 + (v - (64 - r)) ** 2 > r * r) ||
        (u > 64 - r && v > 64 - r && (u - (64 - r)) ** 2 + (v - (64 - r)) ** 2 > r * r);
      if (out) return [0, 0, 0, 0];
    }
    // Distance to polyline.
    let dist = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      dist = Math.min(dist, segDist(u, v, path[i], path[i + 1]));
    }
    if (dist < 2.5) return [...FG, 255];
    // Endpoint dot.
    const [ex, ey] = path[path.length - 1];
    if ((u - ex) ** 2 + (v - ey) ** 2 < 16) return [...ACCENT, 255];
    return [...BG, 255];
  };
}

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

writeFileSync(resolve(outDir, 'icon-192.png'), makePng(192, drawIcon(false)));
writeFileSync(resolve(outDir, 'icon-512.png'), makePng(512, drawIcon(false)));
writeFileSync(resolve(outDir, 'icon-maskable.png'), makePng(512, drawIcon(true)));
console.log('Wrote PWA icons to', outDir);
