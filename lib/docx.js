// Minimal .docx (OOXML/ZIP) text extractor — no external library.
// A .docx is a ZIP archive; we only need the "word/document.xml" entry.
// Uses the standard Web Compression Streams API (DecompressionStream) to
// inflate that one entry, then strips XML markup down to plain text.

async function extractDocxText(arrayBuffer) {
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
  let target = null;

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(pos, true) !== CD_SIG) break;
    const compMethod = view.getUint16(pos + 10, true);
    const compSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

    if (name === "word/document.xml") {
      target = { compMethod, compSize, localHeaderOffset };
      break;
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }

  if (!target) throw new Error("Couldn't find document contents inside this .docx file.");

  const LFH_SIG = 0x04034b50;
  const lh = target.localHeaderOffset;
  if (view.getUint32(lh, true) !== LFH_SIG) throw new Error("Corrupt .docx (bad local file header).");
  const lNameLen = view.getUint16(lh + 26, true);
  const lExtraLen = view.getUint16(lh + 28, true);
  const dataStart = lh + 30 + lNameLen + lExtraLen;
  const compressedData = bytes.slice(dataStart, dataStart + target.compSize);

  let xmlBytes;
  if (target.compMethod === 0) {
    xmlBytes = compressedData;
  } else if (target.compMethod === 8) {
    const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error(`Unsupported .docx compression method (${target.compMethod}).`);
  }

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

if (typeof self !== "undefined") self.extractDocxText = extractDocxText;
