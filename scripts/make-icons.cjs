// Genera le icone dell'app (PNG, senza dipendenze): pagina a quadretti con margine rosso
// su fondo blu. Uso: node scripts/make-icons.cjs  →  dist/icons/
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const out = path.join(__dirname, "..", "dist", "icons");
fs.mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BLUE = hex("#2346c8"),
  PAGE = hex("#ffffff"),
  GRID = hex("#d9e1f5"),
  MARGIN = hex("#e5534b"),
  INK = hex("#18213a");

// Disegno su una griglia 512×512, poi campionato alla dimensione richiesta
function colorAt(x, y) {
  const left = 128, right = 384, top = 104, bottom = 408;
  if (x < left || x >= right || y < top || y >= bottom) return BLUE;
  if (x >= 172 && x < 178) return MARGIN;
  // due righe scritte a penna
  if ((y >= 196 && y < 208 && x >= 196 && x < 352) || (y >= 244 && y < 256 && x >= 196 && x < 316)) return INK;
  if ((x - left) % 26 < 2 || (y - top) % 26 < 2) return GRID;
  return PAGE;
}
function png(size) {
  const scale = 512 / size,
    rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      // media 2×2 per bordi meno seghettati
      const acc = [0, 0, 0];
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const c = colorAt(Math.floor((x + dx) * scale), Math.floor((y + dy) * scale));
        for (let i = 0; i < 3; i++) acc[i] += c[i] / 4;
      }
      row.set([...acc.map(Math.round), 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]])
  fs.writeFileSync(path.join(out, name), png(size));
// Icone dell’estensione
for (const size of [48, 128]) fs.writeFileSync(path.join(__dirname, "..", "extension", `icon-${size}.png`), png(size));

fs.writeFileSync(
  path.join(out, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#2346c8"/><rect x="128" y="104" width="256" height="304" fill="#fff"/><rect x="172" y="104" width="6" height="304" fill="#e5534b"/><rect x="196" y="196" width="156" height="12" fill="#18213a"/><rect x="196" y="244" width="120" height="12" fill="#18213a"/></svg>\n`,
);
console.log("Icone create in dist/icons");
