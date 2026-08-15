importScripts("shared/blocklist.js", "lib/docx-writer.js");

const OPENAI_URL = "https://api.openai.com/v1/responses";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const KIMI_URL = "https://api.moonshot.ai/v1/chat/completions";
const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
  kimi: "kimi-k2.5",
  gemini: "gemini-3.5-flash",
};

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  kimi: "Kimi (Moonshot)",
  gemini: "Gemini (Google)",
};

// Kimi's chat completions API doesn't document inline base64 PDF/image
// content parts (only a separate upload-a-file-first Files API) — so PDF
// extraction is restricted to the providers that do support it.
const DOCUMENT_CAPABLE_PROVIDERS = ["openai", "anthropic", "gemini"];

// Published list prices, USD per 1,000,000 tokens. These are estimates for
// a running spend counter, not a real invoice — actual billing may differ
// (promotional rates, cached-token discounts, price changes over time).
const PRICING = {
  openai: {
    "gpt-4o-mini": { in: 0.15, out: 0.6 },
    "gpt-4o": { in: 2.5, out: 10.0 },
    "gpt-4.1-mini": { in: 0.4, out: 1.6 },
    "gpt-4.1": { in: 2.0, out: 8.0 },
  },
  anthropic: {
    "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
    "claude-sonnet-5": { in: 3.0, out: 15.0 },
    "claude-opus-5": { in: 5.0, out: 25.0 },
  },
  kimi: {
    "kimi-k2.5": { in: 0.6, out: 3.0 },
    "kimi-k3": { in: 3.0, out: 15.0 },
  },
  gemini: {
    "gemini-3.5-flash": { in: 1.5, out: 9.0 },
    "gemini-3.1-pro": { in: 2.0, out: 12.0 },
  },
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
You are given CV_DATA, ABOUT_ME (free-form notes from the applicant), ADDRESSES (labeled physical addresses — use the most fitting one for address-shaped fields like street/city/postal code/country), ADDITIONAL_RESOURCES (extra context from the applicant's own websites/notes), and a list of FORM_FIELDS (each with an "index", a "label", a "type", and for selects a list of "options").

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
You are given CV_DATA, ABOUT_ME, ADDRESSES, ADDITIONAL_RESOURCES, and the applicant's QUESTION.

Answer the question directly and concisely, grounded only in the given information. If you don't have enough information to answer factually, say so plainly rather than guessing or inventing facts — the applicant will fill in the real answer themselves.

Respond as JSON: {"answer": "..."}. Respond with JSON only — no markdown code fences, no commentary.`;

const JOB_EXTRACT_PROMPT = `Extract details about the job posting described in this scraped page text.
Respond as JSON with exactly this shape: {"title": "", "company": "", "location": "", "requirements": ""}.
"requirements" should be a short 1-3 sentence summary of the key requirements/qualifications — not the full posting.
Use "" for anything not found in the text. Do not invent details that aren't there.
Respond with JSON only — no markdown code fences, no commentary.`;

// Caps keep prompts (and cost) bounded even if the applicant saves a lot of resources.
const MAX_RESOURCES_IN_CONTEXT = 8;
const MAX_RESOURCE_CHARS = 1500;

async function buildContextBlock() {
  const { resources = [], aboutMeNotes = [], addresses = [] } = await chrome.storage.local.get([
    "resources",
    "aboutMeNotes",
    "addresses",
  ]);

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

  if (addresses.length) {
    const items = addresses.map((a) => `- ${a.label || "Address"}: ${a.content || ""}`);
    parts.push(`ADDRESSES:\n${items.join("\n")}`);
  } else {
    parts.push(`ADDRESSES:\n(none provided)`);
  }

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
  if (msg.type === "SAVE_JOB") {
    handleSaveJob(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

async function getSettings(providerOverride) {
  const { providers = {}, activeProvider = "openai" } = await chrome.storage.local.get(["providers", "activeProvider"]);
  const provider = providerOverride || activeProvider;
  const cfg = providers[provider] || {};
  const apiKey = cfg.apiKey;
  const providerName = PROVIDER_LABELS[provider] || provider;
  if (!apiKey) {
    throw new Error(
      `No ${providerName} API key set. Add one on the extension's Options page, or switch the active/task provider to one you've already set up.`
    );
  }
  if (apiKey.includes("://")) {
    throw new Error(
      `The saved ${providerName} API key looks like a URL, not an API key (it contains "://"). Go to Options and re-paste the actual key from the provider's site.`
    );
  }
  const model = cfg.model || DEFAULT_MODELS[provider];
  return { provider, apiKey, model };
}

// `parts` is a provider-agnostic content list: {type:"text", text} | {type:"pdf", base64}
// `providerOverride` lets a specific action (autofill/tailor CV/cover letter) use a
// provider other than the general "active" one, per its own Options setting.
async function callAI(parts, providerOverride) {
  const { provider, apiKey, model } = await getSettings(providerOverride);
  const hasDocument = parts.some((p) => p.type === "pdf");
  if (hasDocument && !DOCUMENT_CAPABLE_PROVIDERS.includes(provider)) {
    throw new Error(
      `${PROVIDER_LABELS[provider]} doesn't support reading PDF/document files here. Switch the active provider to OpenAI, Anthropic, or Gemini on the Options page for this action, or paste the text in directly instead.`
    );
  }
  switch (provider) {
    case "anthropic":
      return callAnthropic(apiKey, model, parts);
    case "kimi":
      return callKimi(apiKey, model, parts);
    case "gemini":
      return callGemini(apiKey, model, parts);
    default:
      return callOpenAI(apiKey, model, parts);
  }
}

function estimateCostUSD(provider, model, inputTokens, outputTokens) {
  const rates = PRICING[provider] && PRICING[provider][model];
  if (!rates) return 0;
  return (inputTokens / 1e6) * rates.in + (outputTokens / 1e6) * rates.out;
}

// Best-effort running spend estimate, based on published list prices — not
// a real invoice. Unrecognized models (custom/future model IDs) contribute
// token counts but $0, rather than guessing a price.
async function recordUsage(provider, model, inputTokens, outputTokens) {
  const costUSD = estimateCostUSD(provider, model, inputTokens, outputTokens);
  const { usage = { totalSpentUSD: 0, byProvider: {} } } = await chrome.storage.local.get("usage");
  usage.totalSpentUSD = (usage.totalSpentUSD || 0) + costUSD;
  usage.byProvider = usage.byProvider || {};
  const bucket = usage.byProvider[provider] || { promptTokens: 0, completionTokens: 0, spentUSD: 0 };
  bucket.promptTokens = (bucket.promptTokens || 0) + inputTokens;
  bucket.completionTokens = (bucket.completionTokens || 0) + outputTokens;
  bucket.spentUSD = (bucket.spentUSD || 0) + costUSD;
  usage.byProvider[provider] = bucket;
  await chrome.storage.local.set({ usage });
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
  const usage = data.usage || {};
  await recordUsage("openai", model, usage.input_tokens || 0, usage.output_tokens || 0);
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
  const usage = data.usage || {};
  await recordUsage("anthropic", model, usage.input_tokens || 0, usage.output_tokens || 0);
  return parseJsonLoose(text);
}

// Kimi (Moonshot) exposes an OpenAI-compatible chat completions endpoint.
// Its docs don't cover inline base64 PDF/image content parts (only a
// separate Files API), so this only ever receives text parts — callAI()
// routes anything with a "pdf" part to a document-capable provider instead.
async function callKimi(apiKey, model, parts) {
  const content = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");
  const res = await fetch(KIMI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Kimi API error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};
  await recordUsage("kimi", model, usage.prompt_tokens || 0, usage.completion_tokens || 0);
  return parseJsonLoose(text);
}

async function callGemini(apiKey, model, parts) {
  const geminiParts = parts.map((p) =>
    p.type === "pdf" ? { inline_data: { mime_type: "application/pdf", data: p.base64 } } : { text: p.text }
  );
  const res = await fetch(`${GEMINI_URL_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: geminiParts }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const usage = data.usageMetadata || {};
  await recordUsage("gemini", model, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);
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

  const { taskProviders = {} } = await chrome.storage.local.get("taskProviders");
  const result = await callAI([{ type: "text", text: prompt }], taskProviders.autofill);

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

  const { taskProviders = {} } = await chrome.storage.local.get("taskProviders");
  const result = await callAI([{ type: "text", text: prompt }], taskProviders.coverLetter);
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

  const { taskProviders = {} } = await chrome.storage.local.get("taskProviders");
  const tailoredCv = await callAI([{ type: "text", text: prompt }], taskProviders.tailorCv);
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

function bgBytesToDataUrl(bytes, mimeType) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

// Runs entirely in the background (not the popup) on purpose: the service
// worker has no lifecycle tie to the popup, so both downloads below reliably
// fire even if the popup that triggered this has since closed.
async function handleSaveJob({ jobContext, url }) {
  const { taskProviders = {} } = await chrome.storage.local.get("taskProviders");
  const prompt = `${JOB_EXTRACT_PROMPT}\n\nPAGE_TEXT:\n${jobContext || "(not available)"}`;
  const extracted = await callAI([{ type: "text", text: prompt }], taskProviders.saveJob);

  const { savedJobs = [] } = await chrome.storage.local.get("savedJobs");
  const job = {
    id: crypto.randomUUID(),
    title: (extracted.title || "").trim(),
    company: (extracted.company || "").trim(),
    location: (extracted.location || "").trim(),
    requirements: (extracted.requirements || "").trim(),
    link: url || "",
    results: "",
    addedAt: Date.now(),
  };
  savedJobs.push(job);
  await chrome.storage.local.set({ savedJobs });

  const { jobsFileName = "applied jobs" } = await chrome.storage.local.get("jobsFileName");
  const baseName = (jobsFileName || "applied jobs").trim() || "applied jobs";

  // saveAs:false + conflictAction:"overwrite" — no dialog, and each save
  // replaces the same file in the browser's default downloads location
  // instead of piling up "(1)", "(2)", ... copies.
  const docxBytes = generateJobsDocx(savedJobs);
  const docxUrl = bgBytesToDataUrl(docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  await chrome.downloads.download({ url: docxUrl, filename: `${baseName}.docx`, saveAs: false, conflictAction: "overwrite" });

  const jsonBytes = new TextEncoder().encode(JSON.stringify(savedJobs, null, 2));
  const jsonUrl = bgBytesToDataUrl(jsonBytes, "application/json");
  await chrome.downloads.download({ url: jsonUrl, filename: `${baseName}.json`, saveAs: false, conflictAction: "overwrite" });

  return { job };
}
