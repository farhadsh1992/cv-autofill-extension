// Minimal, dependency-free .docx (OOXML/ZIP) writer — companion to lib/docx.js
// (which reads .docx). Builds a valid, minimal Word package by hand: no
// external library, no build step, no compression needed (ZIP entries are
// written STORED, uncompressed — CVs are tiny text documents).

const DOCX_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function docxCrc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = DOCX_CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// UTF-8, not Latin-1 truncation — the XML we write declares encoding="UTF-8",
// and content can contain non-Latin-1 characters (en dashes, bullets, accents).
function docxStringToBytes(str) {
  return new TextEncoder().encode(str);
}

function docxBase64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// entries: [{ name: string, data: Uint8Array }] — all written uncompressed (method 0).
function docxBuildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = docxStringToBytes(entry.name);
    const data = entry.data;
    const crc = docxCrc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // stored, no compression
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true); // trivial valid DOS date (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralStart = offset;
  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

function docxXmlEscape(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// runs: a string, or an array of {text, bold?, size?, color?} (size in
// half-points, default 22 = 11pt; color is a 6-digit hex string, no "#")
function docxParagraph(runs, opts = {}) {
  const pPrParts = [];
  if (opts.spacingAfter != null) pPrParts.push(`<w:spacing w:after="${opts.spacingAfter}"/>`);
  const pPr = pPrParts.length ? `<w:pPr>${pPrParts.join("")}</w:pPr>` : "";

  const runList = Array.isArray(runs) ? runs : [{ text: runs }];
  const runsXml = runList
    .filter((r) => r.text !== "")
    .map((r) => {
      const color = r.color ? `<w:color w:val="${r.color}"/>` : "";
      const rPr = `<w:rPr>${r.bold ? "<w:b/>" : ""}${color}<w:sz w:val="${r.size || 22}"/></w:rPr>`;
      return `<w:r>${rPr}<w:t xml:space="preserve">${docxXmlEscape(r.text)}</w:t></w:r>`;
    })
    .join("");

  return `<w:p>${pPr}${runsXml}</w:p>`;
}

// A single inline photo paragraph, referencing a relationship id already
// declared in word/_rels/document.xml.rels. sizeEmu ~ 914400 EMU = 1 inch.
function docxPhotoParagraph(relId, sizeEmu, spacingAfter) {
  const pPr = spacingAfter != null ? `<w:pPr><w:spacing w:after="${spacingAfter}"/></w:pPr>` : "";
  const drawing = `<w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
      <wp:extent cx="${sizeEmu}" cy="${sizeEmu}"/>
      <wp:docPr id="1" name="Photo"/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr><pic:cNvPr id="1" name="Photo"/><pic:cNvPicPr/></pic:nvPicPr>
            <pic:blipFill>
              <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
              <a:stretch><a:fillRect/></a:stretch>
            </pic:blipFill>
            <pic:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="${sizeEmu}" cy="${sizeEmu}"/></a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
            </pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing>`;
  return `<w:p>${pPr}<w:r>${drawing}</w:r></w:p>`;
}

const DOCX_IMAGE_EXT_BY_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/bmp": "bmp" };
const DOCX_IMAGE_CONTENT_TYPE = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", bmp: "image/bmp" };

// style: optional { photoBase64, photoMime, accentColorHex } — extracted
// from an uploaded .docx via extractDocxStyle(). Any part may be absent;
// the template falls back to plain black headings and no photo.
function generateCvDocx(cv, style) {
  cv = cv || {};
  style = style || {};
  const accent = style.accentColorHex ? style.accentColorHex.replace("#", "").toUpperCase() : undefined;
  const heading = (text, size = 26) => [{ text, bold: true, size, color: accent }];

  const paragraphs = [];
  const mediaEntries = [];
  let relsXml = null;

  if (style.photoBase64 && style.photoMime && DOCX_IMAGE_EXT_BY_MIME[style.photoMime]) {
    const ext = DOCX_IMAGE_EXT_BY_MIME[style.photoMime];
    mediaEntries.push({ name: `word/media/image1.${ext}`, data: docxBase64ToBytes(style.photoBase64), contentType: DOCX_IMAGE_CONTENT_TYPE[ext] });
    paragraphs.push(docxPhotoParagraph("rId100", 1080000, 120));
    relsXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.${ext}"/>` +
      `</Relationships>`;
  }

  paragraphs.push(docxParagraph([{ text: cv.full_name || "Your Name", bold: true, size: 36, color: accent }], { spacingAfter: 60 }));

  const contactLine = [cv.email, cv.phone, cv.location, cv.linkedin, cv.github, cv.portfolio].filter(Boolean).join("   |   ");
  if (contactLine) paragraphs.push(docxParagraph(contactLine, { spacingAfter: 240 }));

  if (cv.summary) {
    paragraphs.push(docxParagraph(heading("Summary"), { spacingAfter: 80 }));
    paragraphs.push(docxParagraph(cv.summary, { spacingAfter: 240 }));
  }

  if (Array.isArray(cv.work_experience) && cv.work_experience.length) {
    paragraphs.push(docxParagraph(heading("Experience"), { spacingAfter: 80 }));
    for (const job of cv.work_experience) {
      const jobHeading = [job.title, job.company].filter(Boolean).join(", ");
      const dates = [job.start, job.end].filter(Boolean).join(" – ");
      const headingRuns = [{ text: jobHeading, bold: true }];
      if (dates) headingRuns.push({ text: `   (${dates})` });
      paragraphs.push(docxParagraph(headingRuns, { spacingAfter: 40 }));

      const bullets = Array.isArray(job.bullets) && job.bullets.length ? job.bullets : job.description ? [job.description] : [];
      bullets.forEach((bullet, i) => {
        paragraphs.push(docxParagraph(`•  ${bullet}`, { spacingAfter: i === bullets.length - 1 ? 160 : 40 }));
      });
    }
  }

  if (Array.isArray(cv.education) && cv.education.length) {
    paragraphs.push(docxParagraph(heading("Education"), { spacingAfter: 80 }));
    for (const edu of cv.education) {
      const line = [edu.degree, edu.institution].filter(Boolean).join(", ");
      const dates = [edu.start, edu.end].filter(Boolean).join(" – ");
      const runs = [{ text: line, bold: true }];
      if (dates) runs.push({ text: `   (${dates})` });
      paragraphs.push(docxParagraph(runs, { spacingAfter: 120 }));
    }
  }

  if (Array.isArray(cv.skills) && cv.skills.length) {
    paragraphs.push(docxParagraph(heading("Skills"), { spacingAfter: 80 }));
    paragraphs.push(docxParagraph(cv.skills.join(", ")));
  }

  const sectPr = `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr>`;

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${paragraphs.join("")}${sectPr}</w:body></w:document>`;

  const imageDefaults = mediaEntries.map((m) => `<Default Extension="${m.name.split(".").pop()}" ContentType="${m.contentType}"/>`).join("");
  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    imageDefaults +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const packageRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const entries = [
    { name: "[Content_Types].xml", data: docxStringToBytes(contentTypesXml) },
    { name: "_rels/.rels", data: docxStringToBytes(packageRelsXml) },
    { name: "word/document.xml", data: docxStringToBytes(documentXml) },
  ];
  if (relsXml) entries.push({ name: "word/_rels/document.xml.rels", data: docxStringToBytes(relsXml) });
  for (const m of mediaEntries) entries.push({ name: m.name, data: m.data });

  return docxBuildZip(entries);
}

// ---- Simple bordered table doc (used for the "applied jobs" export) ----

function docxTableCell(text, widthDxa, opts = {}) {
  const tcPr = `<w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/></w:tcPr>`;
  const runs = opts.bold ? [{ text, bold: true }] : text;
  return `<w:tc>${tcPr}${docxParagraph(runs)}</w:tc>`;
}

function docxTableRow(cells) {
  return `<w:tr>${cells.join("")}</w:tr>`;
}

function docxTable(headers, rows, widths) {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const borderEdge = (tag) => `<w:${tag} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`;
  const borders =
    `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(borderEdge).join("")}</w:tblBorders>`;
  const tblPr = `<w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr>`;
  const headerRow = docxTableRow(headers.map((h, i) => docxTableCell(h, widths[i], { bold: true })));
  const dataRows = rows.map((row) => docxTableRow(row.map((cell, i) => docxTableCell(cell, widths[i])))).join("");
  return `<w:tbl>${tblPr}<w:tblGrid>${grid}</w:tblGrid>${headerRow}${dataRows}</w:tbl>`;
}

// jobs: [{ title, company, location, requirements, link, results }]
// "2026-08-15" from a Date.now()-style epoch-ms timestamp — same format
// used by the Mac app's export, so files from either side stay consistent.
function docxFormatJobDate(addedAt) {
  if (!addedAt) return "";
  const d = new Date(addedAt);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function generateJobsDocx(jobs) {
  const headers = ["Job title", "Company", "Date", "Location", "Requirements", "Link", "Results"];
  // dxa (twentieths of a point); landscape letter minus 1" margins each side = 13680 dxa available.
  const widths = [1700, 1500, 1300, 1300, 4000, 2180, 1700];
  const rows = (jobs || []).map((j) => [
    j.title || "",
    j.company || "",
    docxFormatJobDate(j.addedAt),
    j.location || "",
    j.requirements || "",
    j.link || "",
    j.results || "",
  ]);

  const paragraphs = [
    docxParagraph([{ text: "Applied Jobs", bold: true, size: 32 }], { spacingAfter: 200 }),
    docxTable(headers, rows, widths),
    // OOXML requires a paragraph after a table that's the last block in the body.
    docxParagraph(""),
  ];

  const sectPr =
    `<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>` +
    `<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr>`;

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${paragraphs.join("")}${sectPr}</w:body></w:document>`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const packageRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const entries = [
    { name: "[Content_Types].xml", data: docxStringToBytes(contentTypesXml) },
    { name: "_rels/.rels", data: docxStringToBytes(packageRelsXml) },
    { name: "word/document.xml", data: docxStringToBytes(documentXml) },
  ];

  return docxBuildZip(entries);
}

if (typeof self !== "undefined") {
  self.generateCvDocx = generateCvDocx;
  self.generateJobsDocx = generateJobsDocx;
  self.docxFormatJobDate = docxFormatJobDate;
}
