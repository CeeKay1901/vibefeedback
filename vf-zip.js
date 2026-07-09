/*!
 * vf-zip.js — ZIP schreiben und lesen, ohne externe Abhängigkeit.
 *
 * Gemeinsame Quelle für index.html und dashboard.html. Das Bookmarklet (layer.js)
 * trägt bewusst eine eigene Kopie: es wird in fremde Seiten injiziert und darf
 * nichts nachladen. Änderungen hier müssen dort nachgezogen werden.
 */
(function (global) {
"use strict";

// Minimaler ZIP-Writer, Methode "store" (unkomprimiert). Screenshots sind bereits
// JPEG — eine zweite Kompression brächte fast nichts und kostet nur Code.

const _crcTable = (()=>{
  const t = new Uint32Array(256);
  for(let n = 0; n < 256; n++){
    let c = n;
    for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes){
  let c = 0xFFFFFFFF;
  for(let i = 0; i < bytes.length; i++) c = _crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// MS-DOS-Zeitformat (2-Sekunden-Auflösung), wie es der ZIP-Header verlangt
function dosDateTime(d){
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
function buildZip(files, when){
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(when || new Date());
  const chunks = [], central = [];
  let offset = 0;

  for(const f of files){
    const nameBytes = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);   // local file header signature
    local.setUint16(4, 20, true);           // version needed
    local.setUint16(6, 0x0800, true);       // flags: UTF-8 Dateinamen
    local.setUint16(8, 0, true);            // method: store
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); // compressed size
    local.setUint32(22, data.length, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);           // extra field length
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);      // central directory header signature
    cd.setUint16(4, 20, true);              // version made by
    cd.setUint16(6, 20, true);              // version needed
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);         // relative offset of local header
    central.push(new Uint8Array(cd.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);       // end of central directory
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

function dataUrlToBytes(dataUrl){
  const comma = dataUrl.indexOf(",");
  if(comma < 0) return null;
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if(!/;base64/i.test(meta)) return null;
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { bytes: out, ext: (meta.match(/^data:image\/(\w+)/i)?.[1] || "jpg").replace("jpeg", "jpg") };
}

function slugify(str, max){
  return (str || "").toLowerCase()
    .replace(/[äöüß]/g, m => ({ "ä":"ae","ö":"oe","ü":"ue","ß":"ss" }[m]))
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max || 40) || "element";
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

// ---- ZIP-Reader: Central Directory lesen, "store" und "deflate" auspacken ----
async function readZip(buffer){
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // End of Central Directory rückwärts suchen (Kommentarfeld kann bis 64 KB lang sein)
  let eocd = -1;
  for(let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--){
    if(view.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error("Kein ZIP (End of Central Directory fehlt)");

  const total   = view.getUint16(eocd + 10, true);
  let   pointer = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files = new Map();

  for(let n = 0; n < total; n++){
    if(view.getUint32(pointer, true) !== 0x02014b50) throw new Error("Beschädigter ZIP-Index");
    const method     = view.getUint16(pointer + 10, true);
    const compSize   = view.getUint32(pointer + 20, true);
    const nameLen    = view.getUint16(pointer + 28, true);
    const extraLen   = view.getUint16(pointer + 30, true);
    const commentLen = view.getUint16(pointer + 32, true);
    const localOff   = view.getUint32(pointer + 42, true);
    const name = dec.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLen));
    pointer += 46 + nameLen + extraLen + commentLen;

    // Datenanfang steht erst im Local Header (Extra-Feld kann dort abweichen)
    if(view.getUint32(localOff, true) !== 0x04034b50) throw new Error("Beschädigter ZIP-Eintrag: " + name);
    const lNameLen  = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compSize);

    if(name.endsWith("/")) continue;             // Verzeichniseintrag
    if(method === 0){ files.set(name, raw); continue; }
    if(method === 8){
      if(typeof DecompressionStream !== "function") throw new Error("Browser kann deflate nicht auspacken");
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      files.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
      continue;
    }
    throw new Error(`Nicht unterstützte Kompression (${method}) in ${name}`);
  }
  return files;
}

function bytesToDataUrl(bytes, name){
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  const mime = { jpg:"jpeg", jpeg:"jpeg", png:"png", gif:"gif", webp:"webp" }[ext];
  if(!mime) return null;
  let bin = "";
  const CHUNK = 0x8000;   // btoa verträgt keine beliebig langen Argumentlisten
  for(let i = 0; i < bytes.length; i += CHUNK){
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:image/${mime};base64,${btoa(bin)}`;
}
global.VFZip = { crc32, dosDateTime, buildZip, dataUrlToBytes, slugify, downloadBlob, readZip, bytesToDataUrl };
})(window);
