import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCRC32Table();
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function generateLogo() {
  const size = 256;
  const rawData = Buffer.alloc(size * (1 + size * 4));
  let offset = 0;

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y++) {
    rawData[offset++] = 0; // Filter byte 0 (None)
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0, g = 0, b = 0, a = 0;

      if (dist <= radius) {
        // Deep navy blue background (#0B1528 -> 11, 21, 40)
        // subtle radial gradient towards center
        const grad = 1 - (dist / radius) * 0.3;
        r = Math.round(15 * grad);
        g = Math.round(30 * grad);
        b = Math.round(65 * grad);
        a = 255;

        // Outer cyan border ring (radius - 8 to radius - 2)
        if (dist >= radius - 8 && dist <= radius - 2) {
          r = 56; g = 189; b = 248; a = 255; // #38bdf8
        }

        // Inner car / wheel & AI soundwave motif
        // Steering wheel outer ring: dist between 42 and 52
        if (dist >= 42 && dist <= 52) {
          r = 224; g = 242; b = 254; a = 255; // #e0f2fe
        }
        // Steering wheel center hub: dist <= 16
        if (dist <= 16) {
          r = 56; g = 189; b = 248; a = 255;
        }
        // Steering wheel spokes: horizontal and vertical-down
        if (Math.abs(dy) <= 5 && dist <= 48) {
          r = 224; g = 242; b = 254; a = 255;
        }
        if (x >= center - 5 && x <= center + 5 && y >= center && dist <= 48) {
          r = 224; g = 242; b = 254; a = 255;
        }

        // AI soundwave bars on left and right
        const waveX = Math.abs(dx);
        const waveY = dy;
        // Wave bars at x offsets 68, 80, 92
        const barHeights = { 68: 24, 80: 38, 92: 18 };
        for (const [bx, bh] of Object.entries(barHeights)) {
          const bxNum = Number(bx);
          if (Math.abs(waveX - bxNum) <= 2 && Math.abs(waveY) <= bh) {
            r = 56; g = 189; b = 248; a = 230;
          }
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // no interlace

  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  
  const destDir = path.resolve('public', 'images');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const destPath = path.join(destDir, 'drivemate-logo.png');
  fs.writeFileSync(destPath, png);
  console.log('Logo generated at:', destPath);
}

generateLogo();
