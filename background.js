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
You are given CV_DATA and a list of FORM_FIELDS (each with an "index", a "label", a "type", and for selects a list of "options").

Return a JSON object of the shape: {"answers": [{"index": 0, "value": "..."}, ...]}

Rules:
- Only include a field in "answers" if you are genuinely confident about the value from CV_DATA, or it's a short, honest answer that can be reasonably derived from CV_DATA (e.g. a brief "why am I a good fit" using the summary/skills).
- For select/dropdown fields, "value" must exactly match one of that field's provided "options" strings.
- Never fabricate personal demographic information: gender, race, ethnicity, veteran status, disability status, or sexual orientation. Omit those fields entirely — leave them for the applicant.
- Never fill salary expectations, government ID numbers, payment details, or passwords. Omit those fields entirely.
- Skip any field you are not confident about rather than guessing. It is fine to leave many fields unanswered.
- Keep free-text answers concise (2-4 sentences max) and grounded only in CV_DATA. Do not invent facts not present in CV_DATA.
Respond with JSON only — no markdown code fences, no commentary, no text before or after the JSON object.`;

const COVER_LETTER_EXTRACT_PROMPT = `Extract the full text of this cover letter as faithfully as possible, preserving paragraph breaks. Do not summarize or comment on it.
Respond as JSON: {"text": "..."}. Respond with JSON only — no markdown code fences, no commentary.`;

const COVER_LETTER_WRITE_PROMPT = `You are helping a job applicant write a new cover letter tailored to a specific job posting.
You are given:
- CV_DATA: the applicant's CV, as structured JSON.
- REFERENCE_COVER_LETTER: a cover letter the applicant has written before. Use it only as a guide for their voice, tone, and typical structure — do not copy it verbatim, and do not reuse specifics (company names, roles) from it. Write a new letter tailored to JOB_CONTEXT.
- JOB_CONTEXT: text scraped from the job posting page (title, company, description). It may be incomplete, noisy, or missing.

Write a new cover letter grounded only in facts from CV_DATA — never invent employers, dates, skills, or achievements that aren't in CV_DATA. Keep it concise (250-400 words), professional, and specific to the role in JOB_CONTEXT where the context allows it. If JOB_CONTEXT is missing or unhelpful, write a solid general-purpose letter from CV_DATA instead of inventing job details.

Respond as JSON: {"cover_letter": "..."}. Respond with JSON only — no markdown code fences, no commentary.`;

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
  if (!apiKey) {
    const providerName = provider === "anthropic" ? "Anthropic (Claude)" : "OpenAI";
    throw new Error(`No ${providerName} API key set. Add one on the extension's Options page.`);
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
  const prompt = `${FIELD_MAP_INSTRUCTIONS}\n\nCV_DATA:\n${JSON.stringify(cvData)}\n\nFORM_FIELDS:\n${JSON.stringify(safeFields)}`;

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

async function handleGenerateCoverLetter({ cvData, coverLetterText, jobContext }) {
  const prompt = `${COVER_LETTER_WRITE_PROMPT}

CV_DATA:
${JSON.stringify(cvData)}

REFERENCE_COVER_LETTER:
${coverLetterText || "(none provided — write in a clear, professional default voice)"}

JOB_CONTEXT:
${jobContext || "(not available)"}`;

  const result = await callAI([{ type: "text", text: prompt }]);
  return { coverLetter: (result.cover_letter || "").trim() };
}
