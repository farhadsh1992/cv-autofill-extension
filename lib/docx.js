// Minimal .docx (OOXML/ZIP) reader — no external library.
// Reads text (word/document.xml) and, separately, a "style" hint pulled
// from the same file: an embedded photo (word/media/imageN.*) and an
// accent color (theme or run colors). Uses the standard Web Compression
// Streams API (DecompressionStream) to inflate whichever entries we need.

function docxParseZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);

  const EOCD_SIG = 0x06054b50;
  const maxBack = Math.min(bytes.length, 65557); // 22-byte record + max 65535-byte comment
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= bytes.length - maxBack && i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("Not a valid .docx file (zip end-of-directory not found).");

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);

  const CD_SIG = 0x02014b50;
  let pos = cdOffset;
  const entries = [];

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(pos, true) !== CD_SIG) break;
    const compMethod = view.getUint16(pos + 10, true);
    const compSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

    entries.push({ name, compMethod, compSize, localHeaderOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return { view, bytes, entries };
}

async function docxReadEntryBytes({ view, bytes }, entry) {
  const LFH_SIG = 0x04034b50;
  const lh = entry.localHeaderOffset;
  if (view.getUint32(lh, true) !== LFH_SIG) throw new Error("Corrupt .docx (bad local file header).");
  const lNameLen = view.getUint16(lh + 26, true);
  const lExtraLen = view.getUint16(lh + 28, true);
  const dataStart = lh + 30 + lNameLen + lExtraLen;
  const compressedData = bytes.slice(dataStart, dataStart + entry.compSize);

  if (entry.compMethod === 0) return compressedData;
  if (entry.compMethod === 8) {
    const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error(`Unsupported .docx compression method (${entry.compMethod}).`);
}

async function extractDocxText(arrayBuffer) {
  const zip = docxParseZipEntries(arrayBuffer);
  const target = zip.entries.find((e) => e.name === "word/document.xml");
  if (!target) throw new Error("Couldn't find document contents inside this .docx file.");
  const xmlBytes = await docxReadEntryBytes(zip, target);
  const xml = new TextDecoder("utf-8").decode(xmlBytes);
  return docxXmlToText(xml);
}

function docxXmlToText(xml) {
  let s = xml.replace(/<w:p[ >]/g, "\n$&").replace(/<w:tab\/>/g, "\t").replace(/<w:br\s*\/?>/g, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return s
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

const DOCX_IMAGE_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp" };

function docxBytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Best-effort "style" extraction: the first embedded photo, plus an accent
// color guessed from the theme (preferred) or from repeated run colors.
// Returns { photoBase64, photoMime, accentColorHex } — any of which may be
// null if nothing suitable was found. Never throws; a failed extraction
// just means no style hints, not a failed CV upload.
async function extractDocxStyle(arrayBuffer) {
  const result = { photoBase64: null, photoMime: null, accentColorHex: null };
  try {
    const zip = docxParseZipEntries(arrayBuffer);

    const imageEntry = zip.entries.find((e) => /^word\/media\/image1\.(png|jpe?g|gif|bmp)$/i.test(e.name)) ||
      zip.entries.find((e) => /^word\/media\/image\d+\.(png|jpe?g|gif|bmp)$/i.test(e.name));
    if (imageEntry) {
      const ext = imageEntry.name.split(".").pop().toLowerCase();
      const mime = DOCX_IMAGE_MIME[ext];
      if (mime) {
        const imgBytes = await docxReadEntryBytes(zip, imageEntry);
        result.photoBase64 = docxBytesToBase64(imgBytes);
        result.photoMime = mime;
      }
    }

    const themeEntry = zip.entries.find((e) => e.name === "word/theme/theme1.xml");
    if (themeEntry) {
      const xml = new TextDecoder("utf-8").decode(await docxReadEntryBytes(zip, themeEntry));
      const m = xml.match(/<a:accent1>\s*<a:srgbClr val="([0-9A-Fa-f]{6})"/);
      if (m) result.accentColorHex = `#${m[1].toUpperCase()}`;
    }

    if (!result.accentColorHex) {
      const docEntry = zip.entries.find((e) => e.name === "word/document.xml");
      if (docEntry) {
        const xml = new TextDecoder("utf-8").decode(await docxReadEntryBytes(zip, docEntry));
        const counts = {};
        const re = /w:color w:val="([0-9A-Fa-f]{6})"/g;
        let m;
        while ((m = re.exec(xml))) {
          const hex = m[1].toUpperCase();
          if (hex === "000000" || hex === "FFFFFF") continue;
          counts[hex] = (counts[hex] || 0) + 1;
        }
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (best) result.accentColorHex = `#${best[0]}`;
      }
    }
  } catch {
    // best-effort — leave whatever was found (possibly nothing)
  }
  return result;
}

if (typeof self !== "undefined") {
  self.extractDocxText = extractDocxText;
  self.extractDocxStyle = extractDocxStyle;
}
