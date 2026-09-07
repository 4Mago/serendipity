/**
 * PWA icons, drawn to match the botanical direction: a cut fruit on paper, the
 * way the references show produce as the only graphic element on a plain
 * ground. Rendered by hand into a PNG rather than pulled from a library so the
 * build stays dependency-free.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const PAPER = [0xfa, 0xf6, 0xee];
const FLESH = [0xc6, 0x44, 0x3a];
const RIND = [0x4f, 0x8a, 0x2a];
const SEED = [0x2a, 0x26, 0x22];

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Seeds scattered the way they sit in a cut tomato: a ring, slightly uneven. */
const SEEDS = [
  [0.0, -0.52], [0.45, -0.26], [0.45, 0.26],
  [0.0, 0.52], [-0.45, 0.26], [-0.45, -0.26],
];

function png(size, { maskable }) {
  // Maskable icons are cropped to whatever shape the OS likes, so the fruit
  // shrinks to stay inside the safe zone.
  const radius = size * (maskable ? 0.28 : 0.36);
  const centre = size / 2;
  const rindWidth = radius * 0.09;
  const seedRadius = radius * 0.075;
  const rows = [];

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - centre;
      const dy = y + 0.5 - centre;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let colour = PAPER;
      if (distance <= radius) {
        colour = distance > radius - rindWidth ? RIND : FLESH;

        // Seeds sit in the flesh, never over the rind.
        if (distance <= radius - rindWidth) {
          for (const [sx, sy] of SEEDS) {
            const seedDx = dx - sx * radius;
            const seedDy = dy - sy * radius;
            if (seedDx * seedDx + seedDy * seedDy <= seedRadius * seedRadius) {
              colour = SEED;
              break;
            }
          }
        }
      }

      row.set(colour, 1 + x * 3);
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, { maskable: false }));
writeFileSync('public/icons/icon-512.png', png(512, { maskable: false }));
writeFileSync('public/icons/icon-512-maskable.png', png(512, { maskable: true }));
writeFileSync('public/apple-touch-icon.png', png(180, { maskable: false }));
console.log('Wrote icons to public/icons/');
