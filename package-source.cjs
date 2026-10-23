// ZIP standard, senza dipendenze. Solo file sorgente esplicitamente selezionati.
const fs = require("fs");
const path = require("path");
const files = [
  "README.md",
  "CLAUDE.md",
  "PRODUCT.md",
  "DESIGN.md",
  "package.json",
  "preview.cjs",
  "check.cjs",
  "audio-check.cjs",
  "features-check.cjs",
  "agenda-check.cjs",
  "package-source.cjs",
  "dist/index.html",
  "dist/style.css",
  "dist/premium.css",
  "dist/app.js",
  "dist/experience.js",
  "dist/features.js",
  "dist/agenda.js",
  "dist/agenda-core.js",
  "dist/agenda.css",
  "dist/features.css",
  "dist/study-core.js",
  "dist/studio-extension.zip",
  ...fs.readdirSync("extension").filter(f => !['worker.js','popup-v2.js'].includes(f)).map((f) => "extension/" + f),
];
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(out, files, prefix, base = ".") {
const local = [],
  central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(prefix + file),
    bytes = fs.readFileSync(path.resolve(base, file)),
    crc = crc32(bytes);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(bytes.length, 18);
  header.writeUInt32LE(bytes.length, 22);
  header.writeUInt16LE(name.length, 26);
  local.push(header, name, bytes);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x800, 8);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(bytes.length, 20);
  entry.writeUInt32LE(bytes.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);
  offset += header.length + name.length + bytes.length;
}
const directory = Buffer.concat(central),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
fs.writeFileSync(out, Buffer.concat([...local, directory, end]));
}
// Prima l’estensione, così lo ZIP dei sorgenti contiene quella aggiornata.
zip(
  "dist/studio-extension.zip",
  ["manifest.json", "background.js", "scheduler.js", "popup.html", "popup.js", "LEGGIMI.txt"],
  "",
  "extension",
);
zip("dist/studio-source.zip", files, "studio-focus/");
console.log(
  "Creato dist/studio-source.zip: " +
    files.length +
    " file sorgente, nessuna credenziale.",
);
