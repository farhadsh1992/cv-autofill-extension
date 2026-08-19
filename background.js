importScripts("shared/blocklist.js", "shared/prompts.js", "shared/models.js", "lib/docx-writer.js");

const OPENAI_URL = "https://api.openai.com/v1/responses";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const KIMI_URL = "https://api.moonshot.ai/v1/chat/completions";
const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
  kimi: "kimi-k2.5",
  gemini: "gemini-3.5-flash",
  deepseek: "deepseek-v4-flash",
  claudeCode: "default",
  openaiCode: "default",
};

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  kimi: "Kimi (Moonshot)",
  gemini: "Gemini (Google)",
  deepseek: "DeepSeek",
  claudeCode: "Claude Code (Terminal)",
  openaiCode: "OpenAI Codex (Terminal)",
};

// Kimi's and DeepSeek's chat completions APIs don't document inline base64
// PDF/image content parts (only a separate upload-a-file-first Files API for
// Kimi; DeepSeek's is text-only) — so PDF extraction is restricted to the
// providers that do support it. The two terminal providers don't support it
// either — the CLIs' headless mode here is plain text-in/text-out, no
// document upload.
const DOCUMENT_CAPABLE_PROVIDERS = ["openai", "anthropic", "gemini"];

// Native messaging host name — registered by native-host/install.sh,
// pointing at the sibling Mac app's own executable (it detects this launch
// mode itself; see NativeMessagingHost.swift in that repo). Chrome/Firefox
// only — Safari and Orion don't support native messaging this way.
const NATIVE_HOST_NAME = "com.farhadshad.cvautofill.clibridge";
const NATIVE_BRIDGE_PROVIDERS = { claudeCode: "claude", openaiCode: "codex" };

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
  // DeepSeek bills peak/off-peak (roughly double during 01:00-04:00 and
  // 06:00-10:00 UTC) — these are the cheaper off-peak rates, so the running
  // spend estimate runs low during peak hours. Open-weight model, but this
  // hosted API is still paid per token — only DeepSeek's own consumer chat
  // app (chat.deepseek.com) is free.
  deepseek: {
    "deepseek-v4-flash": { in: 0.22, out: 0.66 },
    "deepseek-v4-pro": { in: 0.66, out: 1.98 },
  },
};

// Default instruction text for each task lives in shared/prompts.js
// (DEFAULT_PROMPTS), loaded above via importScripts — shared with options.js
// so the Prompts tab can show/edit the same text this file falls back to.

// Caps keep prompts (and cost) bounded even if the applicant saves a lot of resources.
const MAX_RESOURCES_IN_CONTEXT = 8;
const MAX_RESOURCE_CHARS = 1500;

// Per-task prompt overrides, edited in Options → Prompts. Falls back to
// DEFAULT_PROMPTS (shared/prompts.js) when no override is stored for that key.
async function getPromptOverrides() {
  const { promptOverrides = {} } = await chrome.storage.local.get("promptOverrides");
  return promptOverrides;
}

function resolvePrompt(overrides, key) {
  const v = overrides[key];
  return v && v.trim() ? v : DEFAULT_PROMPTS[key];
}

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
  if (msg.type === "FILL_FROM_INSTRUCTION") {
    handleFillFromInstruction(msg)
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

async function getSettings(providerOverride, modelOverride) {
  const { providers = {}, activeProvider = "openai" } = await chrome.storage.local.get(["providers", "activeProvider"]);
  const provider = providerOverride || activeProvider;
  const cfg = providers[provider] || {};
  const model = modelOverride || cfg.model || DEFAULT_MODELS[provider];

  // Terminal providers authenticate via the Mac app's native bridge (your
  // logged-in claude/codex CLI account), not a stored API key.
  if (NATIVE_BRIDGE_PROVIDERS[provider]) {
    return { provider, apiKey: null, model };
  }

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
  return { provider, apiKey, model };
}

// `parts` is a provider-agnostic content list: {type:"text", text} | {type:"pdf", base64}
// `providerOverride` lets a specific action (autofill/tailor CV/cover letter) use a
// provider other than the general "active" one, per its own Options setting.
// `modelOverride` similarly lets that same action pick a specific model for
// whichever provider it's using, instead of following that provider's own
// single global model setting.
async function callAI(parts, providerOverride, modelOverride) {
  const { provider, apiKey, model } = await getSettings(providerOverride, modelOverride);
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
    case "deepseek":
      return callDeepSeek(apiKey, model, parts);
    case "openai":
      return callOpenAI(apiKey, model, parts);
    case "claudeCode":
    case "openaiCode":
      return callNativeBridge(provider, model, parts);
    default:
      return callOpenAI(apiKey, model, parts);
  }
}

function sendNativeMessage(hostName, message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(hostName, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || "Native messaging error."));
        return;
      }
      resolve(response);
    });
  });
}

// Routes the request to the Mac app's own executable, launched by the
// browser in a headless native-messaging mode (see native-host/install.sh
// and NativeMessagingHost.swift in the sibling cv_autofill_mac_app repo).
// No API key involved — it runs on whichever account is logged into the
// claude/codex CLI on this Mac.
async function callNativeBridge(provider, model, parts) {
  const cli = NATIVE_BRIDGE_PROVIDERS[provider];
  const prompt = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");

  let response;
  try {
    response = await sendNativeMessage(NATIVE_HOST_NAME, { cli, model, prompt });
  } catch (err) {
    throw new Error(
      `Couldn't reach the native bridge (${err.message}). Run native-host/install.sh once from Terminal to set it up — see the extension's README.`
    );
  }
  if (!response) {
    throw new Error(
      "The native bridge didn't respond. Run native-host/install.sh once from Terminal to set it up — see the extension's README."
    );
  }
  if (!response.ok) {
    throw new Error(response.error || `${PROVIDER_LABELS[provider]} error.`);
  }
  return parseJsonLoose(response.text || "");
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

// DeepSeek's API is OpenAI-compatible chat completions, same shape as Kimi's
// above (open-source weights, but this hosted API is still billed per token
// like every provider here — only DeepSeek's own consumer chat app,
// chat.deepseek.com, is free; that's a separate product from this API).
async function callDeepSeek(apiKey, model, parts) {
  const content = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");
  const res = await fetch(DEEPSEEK_URL, {
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
    throw new Error(`DeepSeek API error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};
  await recordUsage("deepseek", model, usage.prompt_tokens || 0, usage.completion_tokens || 0);
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
  const overrides = await getPromptOverrides();
  const cvSchemaPrompt = resolvePrompt(overrides, "cvSchema");
  const parts = isPdf
    ? [{ type: "text", text: cvSchemaPrompt }, { type: "pdf", base64 }]
    : [{ type: "text", text: `${cvSchemaPrompt}\n\nCV TEXT:\n${text}` }];

  const cvData = await callAI(parts);
  await chrome.storage.local.set({ cvData });
  return { cvData };
}

async function handleMapFields({ fields, cvData }) {
  const safeFields = fields.filter((f) => !isSensitiveField(f.label));
  const context = await buildContextBlock();
  const overrides = await getPromptOverrides();
  const fieldMapPrompt = resolvePrompt(overrides, "fieldMap");
  const prompt = `${fieldMapPrompt}\n\n${context}\n\nCV_DATA:\n${JSON.stringify(cvData)}\n\nFORM_FIELDS:\n${JSON.stringify(safeFields)}`;

  const { taskProviders = {}, taskModels = {} } = await chrome.storage.local.get(["taskProviders", "taskModels"]);
  const result = await callAI([{ type: "text", text: prompt }], taskProviders.autofill, taskModels.autofill);

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
    const overrides = await getPromptOverrides();
    const extractPrompt = resolvePrompt(overrides, "coverLetterExtract");
    const result = await callAI([{ type: "text", text: extractPrompt }, { type: "pdf", base64 }]);
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
  const overrides = await getPromptOverrides();
  const extractPrompt = resolvePrompt(overrides, "documentExtract");
  const result = await callAI([{ type: "text", text: extractPrompt }, { type: "pdf", base64 }]);
  return { text: (result.text || "").trim() };
}

async function handleGenerateCoverLetter({ cvData, coverLetterText, jobContext }) {
  const context = await buildContextBlock();
  const overrides = await getPromptOverrides();
  const writePrompt = resolvePrompt(overrides, "coverLetterWrite");
  const prompt = `${writePrompt}

${context}

CV_DATA:
${JSON.stringify(cvData)}

REFERENCE_COVER_LETTER:
${coverLetterText || "(none provided — write in a clear, professional default voice)"}

JOB_CONTEXT:
${jobContext || "(not available)"}`;

  const { taskProviders = {}, taskModels = {} } = await chrome.storage.local.get(["taskProviders", "taskModels"]);
  const result = await callAI([{ type: "text", text: prompt }], taskProviders.coverLetter, taskModels.coverLetter);
  return { coverLetter: (result.cover_letter || "").trim() };
}

async function handleGenerateCvDocx({ cvData, jobContext }) {
  const context = await buildContextBlock();
  const overrides = await getPromptOverrides();
  const tailorPrompt = resolvePrompt(overrides, "cvTailor");
  const prompt = `${tailorPrompt}

${context}

CV_DATA:
${JSON.stringify(cvData)}

JOB_CONTEXT:
${jobContext || "(not available)"}`;

  const { taskProviders = {}, taskModels = {} } = await chrome.storage.local.get(["taskProviders", "taskModels"]);
  const tailoredCv = await callAI([{ type: "text", text: prompt }], taskProviders.tailorCv, taskModels.tailorCv);
  return { tailoredCv };
}

// `history` is the chat window's prior turns — [{role: "user"|"ai", content}]
// — sent fresh on every call since these are stateless HTTP APIs with no
// server-side memory between requests. Folded into the prompt so the model
// can reference earlier answers ("what about the one before that?").
// `presetPrompt` is a saved task's instructions (Options → Ask AI → Saved
// tasks), attached by the chat window's # button — extra, user-authored
// instructions layered on top of the base ask prompt, not a replacement.
// `attachedFileText` is already-extracted plain text (PDFs go through
// EXTRACT_DOCUMENT_TEXT client-side first, .docx/.txt are read directly) —
// folded straight into the prompt text, so it works with any provider, not
// just document-capable ones. The chat window also saves it as a permanent
// About Me note the moment it's attached, so ABOUT_ME below will keep
// including it on later turns even without re-attaching.
async function handleAskLlm({ cvData, question, history, presetPrompt, attachedFileName, attachedFileText }) {
  if (!question || !question.trim()) throw new Error("Type a question first.");
  const context = await buildContextBlock();
  const overrides = await getPromptOverrides();
  const askPrompt = resolvePrompt(overrides, "ask");
  const historyBlock = (history || [])
    .map((m) => `${m.role === "user" ? "APPLICANT" : "YOU"}: ${m.content}`)
    .join("\n\n");
  const taskBlock = presetPrompt && presetPrompt.trim() ? `\nTASK_INSTRUCTIONS (apply these for this conversation):\n${presetPrompt.trim()}\n` : "";
  const attachedTextBlock =
    attachedFileText && attachedFileText.trim() ? `\nATTACHED_FILE (${attachedFileName || "file"}):\n${attachedFileText.trim()}\n` : "";
  const prompt = `${askPrompt}
${taskBlock}${attachedTextBlock}
${context}

CV_DATA:
${JSON.stringify(cvData || {})}

CONVERSATION_SO_FAR:
${historyBlock || "(none — this is the first message)"}

NEW_QUESTION:
${question.trim()}`;

  const { taskProviders = {}, taskModels = {} } = await chrome.storage.local.get(["taskProviders", "taskModels"]);
  const result = await callAI([{ type: "text", text: prompt }], taskProviders.ask, taskModels.ask);
  return { answer: (result.answer || "").trim() };
}

// Right-click "Fill this field": the user typed an instruction directly
// into a form field, selected it, and asked to have it replaced with the
// real value. `instruction` is that selected text — no page context is
// scraped here, this is deliberately a single-field, single-shot action.
async function handleFillFromInstruction({ instruction }) {
  if (!instruction || !instruction.trim()) throw new Error("Nothing selected to interpret.");
  const { cvData } = await chrome.storage.local.get("cvData");
  const context = await buildContextBlock();
  const overrides = await getPromptOverrides();
  const fillPrompt = resolvePrompt(overrides, "fieldFill");
  const prompt = `${fillPrompt}

${context}

CV_DATA:
${JSON.stringify(cvData || {})}

INSTRUCTION:
${instruction.trim()}`;

  const { taskProviders = {}, taskModels = {} } = await chrome.storage.local.get(["taskProviders", "taskModels"]);
  const result = await callAI([{ type: "text", text: prompt }], taskProviders.ask, taskModels.ask);
  return { value: (result.value || "").trim() };
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
  const overrides = await getPromptOverrides();
  const jobExtractPrompt = resolvePrompt(overrides, "jobExtract");
  const prompt = `${jobExtractPrompt}\n\nPAGE_TEXT:\n${jobContext || "(not available)"}`;
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

// ---- Right-click "Fill this field" ----
// Type an instruction straight into a form field ("add my address"),
// select it, right-click, and this replaces the selection with the real
// value — grounded in CV_DATA/ABOUT_ME/ADDRESSES/ADDITIONAL_RESOURCES, via
// handleFillFromInstruction above. Deliberately a single-field, single-shot
// action — no page scraping, no other fields touched.

chrome.runtime.onInstalled.addListener((details) => {
  // removeAll first — recreating with the same id on every install/update
  // (including a dev "reload extension") would otherwise throw "duplicate
  // id" on the second run.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "cvAutofillFillSelection",
      title: "CV AutoFill: Fill this field",
      contexts: ["editable"],
    });
  });

  // First-ever install (not an update/dev-reload) — open straight to the
  // Backup section so a returning user can find "Import backup" immediately
  // instead of hunting for it.
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html") + "#backup" });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "cvAutofillFillSelection" || !tab || !tab.id) return;
  // Swallowed on purpose: this only fails for pages content scripts can't
  // run on at all (chrome://, the Web Store, ...) — the injected function
  // below handles every in-page error itself via its own toast.
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fillSelectionWithAI }).catch(() => {});
});

// Self-contained on purpose — chrome.scripting.executeScript serializes this
// function and runs it in the page's isolated content-script world, so it
// can't reference anything from this file's own scope. It captures the
// current selection (input/textarea selectionStart/End, or a contenteditable
// Range) as plain local variables before doing anything async, so later
// DOM changes (the toast itself) can't invalidate it. It asks the service
// worker to interpret the selection via chrome.runtime.sendMessage
// (available in this world) and splices the answer back into exactly the
// range that was selected.
function fillSelectionWithAI() {
  function showToast(anchor, text, isError) {
    let toast = document.getElementById("__cvAutofillFillToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "__cvAutofillFillToast";
      document.body.appendChild(toast);
    }
    let top = 16;
    let left = 16;
    if (anchor && anchor.getBoundingClientRect) {
      const rect = anchor.getBoundingClientRect();
      top = rect.bottom + 6;
      left = rect.left;
    }
    toast.textContent = text;
    toast.style.cssText =
      `position:fixed; top:${top}px; left:${left}px; z-index:2147483647; ` +
      `background:${isError ? "#d70015" : "#2a8f3f"}; color:#fff; padding:6px 10px; ` +
      `border-radius:6px; font-size:12px; font-family:-apple-system,"Segoe UI",sans-serif; ` +
      `box-shadow:0 2px 6px rgba(0,0,0,.25); pointer-events:none; max-width:320px;`;
    clearTimeout(toast.dataset.timer);
    const timer = setTimeout(() => toast.remove(), 2600);
    toast.dataset.timer = timer;
  }

  const el = document.activeElement;
  const isInputLike = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  const isContentEditable = el && el.isContentEditable;
  if (!isInputLike && !isContentEditable) {
    showToast(null, "Select the instruction text inside a form field first.", true);
    return;
  }

  let instruction;
  let replace;
  if (isInputLike) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    instruction = el.value.slice(start, end);
    replace = (value) => {
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      // React (and similar frameworks) track <input>/<textarea> value via
      // their own patched setter, so a plain `el.value = ...` assignment
      // is invisible to their onChange — set it through the native
      // prototype setter instead, same trick this extension's autofill
      // fill already uses (see fillFormsInPage in popup/popup.js).
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      const nextValue = before + value + after;
      if (desc && desc.set) {
        desc.set.call(el, nextValue);
      } else {
        el.value = nextValue;
      }
      el.selectionStart = el.selectionEnd = before.length + value.length;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
  } else {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      showToast(el, "Select the instruction text inside this field first.", true);
      return;
    }
    instruction = sel.toString();
    const range = sel.getRangeAt(0).cloneRange();
    replace = (value) => {
      range.deleteContents();
      range.insertNode(document.createTextNode(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
  }

  if (!instruction || !instruction.trim()) {
    showToast(el, "Select the instruction text inside this field first.", true);
    return;
  }

  showToast(el, "Asking CV AutoFill...", false);

  chrome.runtime
    .sendMessage({ type: "FILL_FROM_INSTRUCTION", instruction })
    .then((response) => {
      if (!response || response.error) {
        showToast(el, (response && response.error) || "No response from the AI.", true);
        return;
      }
      replace(response.value || "");
      showToast(el, "Filled by CV AutoFill.", false);
    })
    .catch((err) => {
      showToast(el, err.message || "Couldn't reach the extension.", true);
    });
}
