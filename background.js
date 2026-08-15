importScripts("shared/blocklist.js");

const OPENAI_URL = "https://api.openai.com/v1/responses";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
};

const CV_SCHEMA_PROMPT = `Extract the candidate's information from the attached CV/resume into a JSON object with exactly this shape:
{
  "full_name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "github": "",
  "portfolio": "",
  "summary": "",
  "work_experience": [{"title": "", "company": "", "start": "", "end": "", "description": ""}],
  "education": [{"degree": "", "institution": "", "start": "", "end": ""}],
  "skills": []
}
Only include information actually present in the CV. Use "" for missing string fields and [] for missing arrays.
Do not invent employers, dates, or credentials that aren't in the document.
Respond with JSON only — no markdown code fences, no commentary, no text before or after the JSON object.`;

const FIELD_MAP_INSTRUCTIONS = `You are helping a job applicant fill out a web form using their CV data.
You are given CV_DATA, ABOUT_ME (free-form notes from the applicant), ADDITIONAL_RESOURCES (extra context from the applicant's own websites/notes), and a list of FORM_FIELDS (each with an "index", a "label", a "type", and for selects a list of "options").

Return a JSON object of the shape: {"answers": [{"index": 0, "value": "..."}, ...]}

Rules:
- Only include a field in "answers" if you are genuinely confident about the value from CV_DATA/ABOUT_ME/ADDITIONAL_RESOURCES, or it's a short, honest answer that can be reasonably derived from them (e.g. a brief "why am I a good fit" using the summary/skills).
- For select/dropdown fields, "value" must exactly match one of that field's provided "options" strings.
- Never fabricate personal demographic information: gender, race, ethnicity, veteran status, disability status, or sexual orientation. Omit those fields entirely — leave them for the applicant.
- Never fill salary expectations, government ID numbers, payment details, or passwords. Omit those fields entirely.
- Skip any field you are not confident about rather than guessing. It is fine to leave many fields unanswered.
- Keep free-text answers concise (2-4 sentences max) and grounded only in the given information. Do not invent facts.
Respond with JSON only — no markdown code fences, no commentary, no text before or after the JSON object.`;

const COVER_LETTER_EXTRACT_PROMPT = `Extract the full text of this cover letter as faithfully as possible, preserving paragraph breaks. Do not summarize or comment on it.
Respond as JSON: {"text": "..."}. Respond with JSON only — no markdown code fences, no commentary.`;

const DOCUMENT_EXTRACT_PROMPT = `Extract the full text of this document as faithfully as possible, preserving structure (headings, line breaks). It may be a diploma, certificate, letter, or any other personal document — do not summarize or comment on it, just transcribe what's there.
Respond as JSON: {"text": "..."}. Respond with JSON only — no markdown code fences, no commentary.`;

const COVER_LETTER_WRITE_PROMPT = `You are helping a job applicant write a new cover letter tailored to a specific job posting.
You are given:
- CV_DATA: the applicant's CV, as structured JSON.
- REFERENCE_COVER_LETTER: a cover letter the applicant has written before. Use it only as a guide for their voice, tone, and typical structure — do not copy it verbatim, and do not reuse specifics (company names, roles) from it. Write a new letter tailored to JOB_CONTEXT.
- JOB_CONTEXT: text scraped from the job posting page (title, company, description). It may be incomplete, noisy, or missing.

Write a new cover letter grounded only in facts from CV_DATA — never invent employers, dates, skills, or achievements that aren't in CV_DATA. Keep it concise (250-400 words), professional, and specific to the role in JOB_CONTEXT where the context allows it. If JOB_CONTEXT is missing or unhelpful, write a solid general-purpose letter from CV_DATA instead of inventing job details.

Respond as JSON: {"cover_letter": "..."}. Respond with JSON only — no markdown code fences, no commentary.`;

const CV_TAILOR_PROMPT = `You are helping a job applicant tailor their CV/resume for a specific job posting.
You are given CV_DATA (structured JSON), JOB_CONTEXT (text scraped from a job posting page — may be incomplete or missing), ABOUT_ME (free-form notes from the applicant), and ADDITIONAL_RESOURCES (extra context from the applicant's own websites/notes).

Produce a tailored version of the CV as JSON with exactly this shape:
{
  "full_name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "github": "",
  "portfolio": "",
  "summary": "",
  "work_experience": [{"title": "", "company": "", "start": "", "end": "", "bullets": ["", "..."]}],
  "education": [{"degree": "", "institution": "", "start": "", "end": ""}],
  "skills": []
}

Rules:
- Never invent employers, dates, titles, or achievements that aren't in CV_DATA, ABOUT_ME, or ADDITIONAL_RESOURCES. This is a rewrite/re-emphasis of real facts, not fiction.
- You may reorder or trim skills, and rewrite the summary to speak directly to the role in JOB_CONTEXT.
- Convert each role's experience into 2-4 concise, achievement-oriented "bullets" (rewrite any prose-style description into bullet points).
- If JOB_CONTEXT is missing or unhelpful, produce a solid general-purpose tailored CV instead of inventing job specifics.

Respond with JSON only — no markdown code fences, no commentary.`;

const ASK_PROMPT = `You are helping a job applicant who is filling out a job application form and got stuck on a question the automatic form-filler couldn't confidently answer.
You are given CV_DATA, ABOUT_ME, ADDITIONAL_RESOURCES, and the applicant's QUESTION.

Answer the question directly and concisely, grounded only in the given information. If you don't have enough information to answer factually, say so plainly rather than guessing or inventing facts — the applicant will fill in the real answer themselves.

Respond as JSON: {"answer": "..."}. Respond with JSON only — no markdown code fences, no commentary.`;

// Caps keep prompts (and cost) bounded even if the applicant saves a lot of resources.
const MAX_RESOURCES_IN_CONTEXT = 8;
const MAX_RESOURCE_CHARS = 1500;

async function buildContextBlock() {
  const { resources = [], aboutMeNotes = [] } = await chrome.storage.local.get(["resources", "aboutMeNotes"]);

  let aboutMeBlock;
  if (aboutMeNotes.length) {
    const recentNotes = aboutMeNotes.slice(-MAX_RESOURCES_IN_CONTEXT);
    aboutMeBlock = recentNotes
      .map((n) => `- ${n.label || "Note"}:\n${(n.content || "").slice(0, MAX_RESOURCE_CHARS)}`)
      .join("\n\n");
  } else {
    aboutMeBlock = "(none provided)";
  }
  const parts = [`ABOUT_ME:\n${aboutMeBlock}`];

  if (resources.length) {
    const recent = resources.slice(-MAX_RESOURCES_IN_CONTEXT);
    const items = recent.map((r) => {
      const header = r.url ? `${r.label || r.url} (${r.url})` : r.label || "Note";
      const content = (r.content || "").slice(0, MAX_RESOURCE_CHARS);
      return `- ${header}:\n${content}`;
    });
    parts.push(`ADDITIONAL_RESOURCES:\n${items.join("\n\n")}`);
  } else {
    parts.push(`ADDITIONAL_RESOURCES:\n(none provided)`);
  }

  return parts.join("\n\n");
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "PARSE_CV") {
    handleParseCV(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === "MAP_FIELDS") {
    handleMapFields(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === "SAVE_COVER_LETTER") {
    handleSaveCoverLetter(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === "GENERATE_COVER_LETTER") {
    handleGenerateCoverLetter(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === "GENERATE_CV_DOCX") {
    handleGenerateCvDocx(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === "ASK_LLM") {
    handleAskLlm(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (msg.type === "EXTRACT_DOCUMENT_TEXT") {
    handleExtractDocumentText(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

async function getSettings() {
  const { provider = "openai", openaiApiKey, anthropicApiKey, openaiModel, anthropicModel } = await chrome.storage.local.get([
    "provider",
    "openaiApiKey",
    "anthropicApiKey",
    "openaiModel",
    "anthropicModel",
  ]);
  const apiKey = provider === "anthropic" ? anthropicApiKey : openaiApiKey;
  const providerName = provider === "anthropic" ? "Anthropic (Claude)" : "OpenAI";
  if (!apiKey) {
    throw new Error(`No ${providerName} API key set. Add one on the extension's Options page.`);
  }
  if (apiKey.includes("://")) {
    throw new Error(
      `The saved ${providerName} API key looks like a URL, not an API key (it contains "://"). Go to Options and re-paste the actual key from the provider's site.`
    );
  }
  const model = (provider === "anthropic" ? anthropicModel : openaiModel) || DEFAULT_MODELS[provider];
  return { provider, apiKey, model };
}

// `parts` is a provider-agnostic content list: {type:"text", text} | {type:"pdf", base64}
async function callAI(parts) {
  const { provider, apiKey, model } = await getSettings();
  return provider === "anthropic" ? callAnthropic(apiKey, model, parts) : callOpenAI(apiKey, model, parts);
}

async function callOpenAI(apiKey, model, parts) {
  const content = parts.map((p) =>
    p.type === "pdf"
      ? { type: "input_file", filename: "cv.pdf", file_data: `data:application/pdf;base64,${p.base64}` }
      : { type: "input_text", text: p.text }
  );
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.output_text ?? extractOpenAIText(data);
  return parseJsonLoose(text);
}

function extractOpenAIText(data) {
  const parts = [];
  for (const item of data.output || []) {
    for (const c of item.content || []) {
      if (c.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("");
}

async function callAnthropic(apiKey, model, parts) {
  const content = parts.map((p) =>
    p.type === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 } }
      : { type: "text", text: p.text }
  );
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  return parseJsonLoose(text);
}

// Models are instructed to return bare JSON, but strip markdown fences defensively if present.
function parseJsonLoose(text) {
  let t = (text || "").trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

async function handleParseCV({ isPdf, base64, text }) {
  const parts = isPdf
    ? [{ type: "text", text: CV_SCHEMA_PROMPT }, { type: "pdf", base64 }]
    : [{ type: "text", text: `${CV_SCHEMA_PROMPT}\n\nCV TEXT:\n${text}` }];

  const cvData = await callAI(parts);
  await chrome.storage.local.set({ cvData });
  return { cvData };
}

async function handleMapFields({ fields, cvData }) {
  const safeFields = fields.filter((f) => !isSensitiveField(f.label));
  const context = await buildContextBlock();
  const prompt = `${FIELD_MAP_INSTRUCTIONS}\n\n${context}\n\nCV_DATA:\n${JSON.stringify(cvData)}\n\nFORM_FIELDS:\n${JSON.stringify(safeFields)}`;

  const result = await callAI([{ type: "text", text: prompt }]);

  const fieldByIndex = new Map(fields.map((f) => [f.index, f]));
  const answers = (result.answers || []).filter((a) => {
    const field = fieldByIndex.get(a.index);
    if (!field || isSensitiveField(field.label)) return false;
    return a.value != null && String(a.value).trim() !== "";
  });

  return { answers };
}

// text/docx-extracted-text cover letters are stored as-is (no AI call needed);
// only a PDF needs the model to pull text out of it.
async function handleSaveCoverLetter({ isPdf, base64, text }) {
  let coverLetterText;
  if (isPdf) {
    const result = await callAI([{ type: "text", text: COVER_LETTER_EXTRACT_PROMPT }, { type: "pdf", base64 }]);
    coverLetterText = (result.text || "").trim();
  } else {
    coverLetterText = (text || "").trim();
  }
  await chrome.storage.local.set({ coverLetterText });
  return { coverLetterText };
}

// Used for About-Me file uploads (diploma, certificate, etc.) — PDFs need
// the model to pull text out; .docx/.txt are already extracted client-side
// before this is ever called.
async function handleExtractDocumentText({ base64 }) {
  const result = await callAI([{ type: "text", text: DOCUMENT_EXTRACT_PROMPT }, { type: "pdf", base64 }]);
  return { text: (result.text || "").trim() };
}

async function handleGenerateCoverLetter({ cvData, coverLetterText, jobContext }) {
  const context = await buildContextBlock();
  const prompt = `${COVER_LETTER_WRITE_PROMPT}

${context}

CV_DATA:
${JSON.stringify(cvData)}

REFERENCE_COVER_LETTER:
${coverLetterText || "(none provided — write in a clear, professional default voice)"}

JOB_CONTEXT:
${jobContext || "(not available)"}`;

  const result = await callAI([{ type: "text", text: prompt }]);
  return { coverLetter: (result.cover_letter || "").trim() };
}

async function handleGenerateCvDocx({ cvData, jobContext }) {
  const context = await buildContextBlock();
  const prompt = `${CV_TAILOR_PROMPT}

${context}

CV_DATA:
${JSON.stringify(cvData)}

JOB_CONTEXT:
${jobContext || "(not available)"}`;

  const tailoredCv = await callAI([{ type: "text", text: prompt }]);
  return { tailoredCv };
}

async function handleAskLlm({ cvData, question }) {
  if (!question || !question.trim()) throw new Error("Type a question first.");
  const context = await buildContextBlock();
  const prompt = `${ASK_PROMPT}

${context}

CV_DATA:
${JSON.stringify(cvData || {})}

QUESTION:
${question.trim()}`;

  const result = await callAI([{ type: "text", text: prompt }]);
  return { answer: (result.answer || "").trim() };
}
