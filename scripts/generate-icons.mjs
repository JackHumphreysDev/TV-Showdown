import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const palette = ['#F4C567', '#D390A7', '#9EB8C1', '#A997CE', '#D98B74', '#93B9A6'];
const hex = (value) => [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
const crcTable = Array.from({ length: 256 }, (_, i) => { let c = i; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (bytes) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (name, data) => {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const check = Buffer.alloc(4); check.writeUInt32BE(crc(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, check]);
};
function png(size, mode = 'colour', transparent = false) {
  const bytes = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    bytes[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const nx = (x + .5 - size / 2) / size, ny = (y + .5 - size / 2) / size;
      const r = Math.hypot(nx, ny), angle = (Math.atan2(ny, nx) + Math.PI * 2) % (Math.PI * 2);
      const sector = Math.floor(angle / (Math.PI * 2 / 6));
      const edge = angle % (Math.PI * 2 / 6);
      const pointer = ny < -.385 && ny > -.49 && Math.abs(nx) < (.49 + ny) * .75;
      let rgba = transparent ? [0, 0, 0, 0] : [...hex('#111114'), 255];
      if (r <= .385 && r >= .065) rgba = mode === 'mono' ? [255, 255, 255, 255] : [...hex(edge < .012 ? '#111114' : palette[sector]), 255];
      if (r < .065) rgba = mode === 'mono' ? [255, 255, 255, 255] : [...hex('#111114'), 255];
      if (r < .028) rgba = mode === 'mono' ? [17, 17, 20, 255] : [...hex('#F4C567'), 255];
      if (pointer) rgba = mode === 'mono' ? [255, 255, 255, 255] : [...hex('#F4C567'), 255];
      bytes.set(rgba, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(bytes, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const output = (name, size, mode, transparent) => writeFileSync(resolve('app/assets', name), png(size, mode, transparent));
output('icon.png', 1024, 'colour', false);
output('splash-icon.png', 1024, 'colour', false);
output('favicon.png', 48, 'colour', false);
output('android-icon-foreground.png', 512, 'colour', true);
output('android-icon-background.png', 512, 'colour', false);
output('android-icon-monochrome.png', 432, 'mono', true);
writeFileSync(resolve('app/public/pwa-icon-192.png'), png(192));
writeFileSync(resolve('app/public/pwa-icon-512.png'), png(512));
