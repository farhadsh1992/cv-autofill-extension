// Minimal, dependency-free PDF writer for plain text (US Letter, Helvetica).
// Builds valid PDF 1.4 bytes by hand: no external library, no build step —
// same philosophy as lib/docx.js. Good enough for a one-or-two-page cover
// letter; not a general-purpose PDF engine.

const PDF_PAGE_W = 612; // US Letter, points
const PDF_PAGE_H = 792;
const PDF_MARGIN = 72; // 1 inch
const PDF_FONT_SIZE = 11;
const PDF_LINE_HEIGHT = 15;
const PDF_MAX_WIDTH = PDF_PAGE_W - PDF_MARGIN * 2;
const PDF_TOP_Y = PDF_PAGE_H - PDF_MARGIN - PDF_FONT_SIZE;
const PDF_BOTTOM_Y = PDF_MARGIN;

// Approximate Helvetica glyph widths (1/1000 em), bucketed and biased
// slightly wide so word-wrap never lets a line overflow the right margin.
const PDF_WIDE_CHARS = new Set(["m", "w", "M", "W"]);
const PDF_NARROW_CHARS = new Set(["i", "j", "l", ".", ",", ":", ";", "'", "`", "!", "|", "I", " "]);
const PDF_MED_NARROW_CHARS = new Set(["f", "t", "r", "(", ")", "[", "]", "-", '"']);

function pdfCharWidth(ch) {
  if (PDF_WIDE_CHARS.has(ch)) return 830;
  if (PDF_NARROW_CHARS.has(ch)) return 260;
  if (PDF_MED_NARROW_CHARS.has(ch)) return 330;
  if (ch >= "0" && ch <= "9") return 560;
  if (ch >= "a" && ch <= "z") return 560;
  if (ch >= "A" && ch <= "Z") return 680;
  return 600;
}

function pdfTextWidth(str, fontSize) {
  let w = 0;
  for (const ch of str) w += pdfCharWidth(ch);
  return (w / 1000) * fontSize;
}

function pdfWrapParagraph(paragraph, fontSize, maxWidth) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || pdfTextWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pdfEscapeText(str) {
  let out = "";
  for (const ch of str) {
    let code = ch.codePointAt(0);
    if (code > 255 || code < 32) code = code === 32 ? 32 : 63; // '?' for anything outside Latin-1
    const c = String.fromCharCode(code);
    out += c === "\\" || c === "(" || c === ")" ? `\\${c}` : c;
  }
  return out;
}

function pdfLayoutPages(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  const pages = [];
  let currentPage = [];
  let y = PDF_TOP_Y;

  function startNewPage() {
    pages.push(currentPage);
    currentPage = [];
    y = PDF_TOP_Y;
  }

  paragraphs.forEach((para, pi) => {
    const lines = pdfWrapParagraph(para, PDF_FONT_SIZE, PDF_MAX_WIDTH);
    lines.forEach((line) => {
      if (y < PDF_BOTTOM_Y) startNewPage();
      currentPage.push({ text: line, y });
      y -= PDF_LINE_HEIGHT;
    });
    if (pi < paragraphs.length - 1) {
      y -= PDF_LINE_HEIGHT * 0.5;
      if (y < PDF_BOTTOM_Y) startNewPage();
    }
  });

  pages.push(currentPage);
  return pages;
}

function generateCoverLetterPdf(text) {
  const pages = pdfLayoutPages(text || "");
  const pageCount = pages.length;

  const fontObjNum = 3;
  const firstPageObjNum = 4;
  const firstContentObjNum = 4 + pageCount;
  const totalObjects = 3 + pageCount * 2;

  const objects = new Array(totalObjects + 1);

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;

  const kids = [];
  for (let i = 0; i < pageCount; i++) kids.push(`${firstPageObjNum + i} 0 R`);
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>\nendobj\n`;

  objects[fontObjNum] = `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`;

  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = firstPageObjNum + i;
    const contentObjNum = firstContentObjNum + i;

    objects[pageObjNum] =
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_W} ${PDF_PAGE_H}] ` +
      `/Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`;

    let stream = `BT /F1 ${PDF_FONT_SIZE} Tf\n`;
    for (const line of pages[i]) {
      stream += `1 0 0 1 ${PDF_MARGIN} ${line.y.toFixed(2)} Tm (${pdfEscapeText(line.text)}) Tj\n`;
    }
    stream += `ET`;

    objects[contentObjNum] = `${contentObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
  }

  const header = `%PDF-1.4\n%${String.fromCharCode(0xe2, 0xe3, 0xcf, 0xd3)}\n`;
  let out = header;
  const offsets = new Array(totalObjects + 1).fill(0);
  for (let n = 1; n <= totalObjects; n++) {
    offsets[n] = out.length;
    out += objects[n];
  }

  const xrefStart = out.length;
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= totalObjects; n++) {
    xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  out += xref;
  out += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

if (typeof self !== "undefined") self.generateCoverLetterPdf = generateCoverLetterPdf;
