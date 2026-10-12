// Marca de agua para Excel: toma el logo oficial (PNG RGBA/RGB de 8 bits) y genera una
// imagen en mosaico muy tenue. No usa librerías externas: solo zlib de Node.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('No es un PNG');
  let pos = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9];
      if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG no soportado (profundidad o entrelazado)');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error('PNG no soportado (tipo de color ' + ct + ')');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodeRgb(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

// Devuelve un PNG opaco (fondo blanco) con el logo repetido al `opacity` indicado.
function buildWatermarkTile(logoPath, opacity = 0.07, tileW = 520, tileH = 400) {
  const logo = decodePng(fs.readFileSync(logoPath));
  const out = Buffer.alloc(tileW * tileH * 3, 255);
  const ox = Math.floor((tileW - logo.w) / 2), oy = Math.floor((tileH - logo.h) / 2);
  for (let y = 0; y < logo.h; y++) {
    for (let x = 0; x < logo.w; x++) {
      const i = (y * logo.w + x) * logo.bpp;
      const alpha = (logo.bpp === 4 ? logo.px[i + 3] / 255 : 1) * opacity;
      if (alpha <= 0) continue;
      const o = ((oy + y) * tileW + (ox + x)) * 3;
      for (let k = 0; k < 3; k++) out[o + k] = Math.round(255 * (1 - alpha) + logo.px[i + k] * alpha);
    }
  }
  return encodeRgb(tileW, tileH, out);
}

let cache = null;
function getBrandAssets(publicDir) {
  if (cache) return cache;
  const logoPath = path.join(publicDir, 'icons', 'icon-192.png');
  try {
    cache = { logo: fs.readFileSync(logoPath), watermark: buildWatermarkTile(logoPath) };
  } catch (e) {
    console.error('No se pudo preparar el logo/marca de agua:', e.message);
    cache = { logo: null, watermark: null };
  }
  return cache;
}

module.exports = { decodePng, buildWatermarkTile, getBrandAssets };
