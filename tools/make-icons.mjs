// Generates the app icons with no dependencies: `node tools/make-icons.mjs`
// Full-bleed square so Android can mask it to whatever shape the launcher uses.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const FROM = [0xb3, 0x8c, 0xff]; // --accent
const TO = [0xff, 0x7e, 0xb6]; // --accent-2
const FG = [0x1a, 0x13, 0x25]; // --on-accent
const SAMPLES = 4; // supersampling per axis, for smooth edges

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Play triangle, kept inside the maskable safe zone (central 80% circle).
function inPlay(u, v) {
  const left = 0.38, right = 0.68, top = 0.32, bottom = 0.68;
  if (u < left || u > right) return false;
  const half = ((right - u) / (right - left)) * ((bottom - top) / 2);
  return Math.abs(v - 0.5) <= half;
}

const mix = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));

function draw(size) {
  return png(size, (x, y) => {
    let hits = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        if (inPlay((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size)) hits++;
      }
    }
    const bg = mix(FROM, TO, (x + y) / (2 * size));
    return mix(bg, FG, hits / (SAMPLES * SAMPLES));
  });
}

const out = new URL('../icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const size of [192, 512]) writeFileSync(new URL(`icon-${size}.png`, out), draw(size));
console.log('Wrote icons/icon-192.png and icons/icon-512.png');
