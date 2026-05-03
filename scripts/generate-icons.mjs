import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { crc32 } from 'node:zlib';
import { resolve } from 'node:path';

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size, [r, g, b], [or, og, ob], dotRadiusFrac = 0.32) {
  const rowSize = size * 3;
  const raw = Buffer.alloc((rowSize + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const inner = (size * dotRadiusFrac) ** 2;
  const corner = size * 0.18;
  for (let y = 0; y < size; y++) {
    raw[y * (rowSize + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const idx = y * (rowSize + 1) + 1 + x * 3;
      // outer rounded corner mask: keep background outside corner radius transparent? we keep solid.
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < inner) {
        raw[idx] = or;
        raw[idx + 1] = og;
        raw[idx + 2] = ob;
      } else {
        raw[idx] = r;
        raw[idx + 1] = g;
        raw[idx + 2] = b;
      }
      void corner;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const out = resolve('static', 'icons');
mkdirSync(out, { recursive: true });

const sage = [107, 142, 107]; // #6b8e6b
const cream = [250, 250, 247]; // #fafaf7

writeFileSync(resolve(out, 'icon-192.png'), makePng(192, sage, cream));
writeFileSync(resolve(out, 'icon-512.png'), makePng(512, sage, cream));

console.log('Generated icons in', out);
