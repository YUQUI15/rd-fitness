// Genera los íconos PNG de la app (192, 512 y maskable) sin dependencias externas.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Letras R y D en cuadrícula 5x7
const R = ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'];
const D = ['1111.', '1...1', '1...1', '1...1', '1...1', '1...1', '1111.'];

function icon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => { const i = (y * size + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; };
  const gold = [245, 180, 0], dark = [11, 11, 13], gold2 = [255, 210, 74];
  const inset = maskable ? 0 : Math.round(size * 0.04);
  const rad = maskable ? 0 : Math.round(size * 0.2);
  const border = Math.round(size * 0.035);
  const inside = (x, y, ins, r) => {
    const x0 = ins, y0 = ins, x1 = size - 1 - ins, y1 = size - 1 - ins;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x, cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (maskable) { set(x, y, dark); continue; }
    if (inside(x, y, inset, rad)) set(x, y, inside(x, y, inset + border, Math.max(0, rad - border)) ? dark : gold);
    else { const i = (y * size + x) * 4; buf[i + 3] = 0; }
  }
  const cell = Math.floor(size * (maskable ? 0.075 : 0.085));
  const gap = cell;
  const totalW = 5 * cell * 2 + gap, totalH = 7 * cell;
  const ox = Math.round((size - totalW) / 2), oy = Math.round((size - totalH) / 2);
  [R, D].forEach((g, gi) => g.forEach((row, ry) => [...row].forEach((v, rx) => {
    if (v !== '1') return;
    const px = ox + gi * (5 * cell + gap) + rx * cell, py = oy + ry * cell;
    for (let yy = 0; yy < cell; yy++) for (let xx = 0; xx < cell; xx++) set(px + xx, py + yy, yy < cell / 2 ? gold2 : gold);
  })));
  // barra inferior tipo mancuerna
  const by = oy + totalH + Math.round(size * 0.06), bh = Math.max(4, Math.round(size * 0.025));
  for (let y = by; y < by + bh; y++) for (let x = ox; x < ox + totalW; x++) set(x, y, gold);
  return png(size, size, buf);
}

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), icon(192, false));
fs.writeFileSync(path.join(out, 'icon-512.png'), icon(512, false));
fs.writeFileSync(path.join(out, 'maskable-512.png'), icon(512, true));
console.log('Íconos generados en', out);
