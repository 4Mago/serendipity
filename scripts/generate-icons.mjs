/**
 * Placeholder PWA icons. The manifest must point at real files for the install
 * prompt to appear, and the visual design is still pending — so these draw a
 * simple plate motif in neutral colours and get replaced in Phase B.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BACKGROUND = [0x2f, 0x3a, 0x36];
const PLATE = [0xf2, 0xef, 0xe6];

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

function png(size, { maskable }) {
  // Maskable icons must keep their content inside a safe zone, since the OS
  // crops them to whatever shape it likes.
  const radius = size * (maskable ? 0.28 : 0.34);
  const centre = size / 2;
  const rows = [];

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - centre;
      const dy = y + 0.5 - centre;
      const colour = dx * dx + dy * dy <= radius * radius ? PLATE : BACKGROUND;
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
console.log('Wrote placeholder icons to public/icons/');
