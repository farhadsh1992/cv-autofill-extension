const tabBtns = document.querySelectorAll(".tabBtn");
const tabPanels = document.querySelectorAll(".tabPanel");

const themeRadios = document.querySelectorAll('input[name="theme"]');
const accentColorInput = document.getElementById("accentColor");
const resetAccentBtn = document.getElementById("resetAccentBtn");
const DEFAULT_ACCENT_COLOR = "#0a84ff";

const saveJobColorInput = document.getElementById("saveJobColorInput");
const resetSaveJobColorBtn = document.getElementById("resetSaveJobColorBtn");
const DEFAULT_SAVE_JOB_COLOR = "#2a8f3f";

const activeProviderSelect = document.getElementById("activeProvider");

const taskProviderSelects = {
  autofill: document.getElementById("taskProviderAutofill"),
  tailorCv: document.getElementById("taskProviderTailorCv"),
  coverLetter: document.getElementById("taskProviderCoverLetter"),
  // "ask" lives on its own Ask AI tab rather than alongside the other three
  // here — it still shares this same object (for populateTaskModelSelect
  // and initial load below) but auto-saves on change instead of waiting for
  // the AI tab's batched Save button, since that tab isn't visible from here.
  ask: document.getElementById("taskProviderAsk"),
};
const taskModelSelects = {
  autofill: document.getElementById("taskModelAutofill"),
  tailorCv: document.getElementById("taskModelTailorCv"),
  coverLetter: document.getElementById("taskModelCoverLetter"),
  ask: document.getElementById("taskModelAsk"),
};
// Free-text override sitting next to each task model <select> above, so a
// provider's newer/future model IDs can be used without waiting for
// MODEL_CATALOG (shared/models.js) to be updated first.
const taskModelCustoms = {
  autofill: document.getElementById("taskModelAutofillCustom"),
  tailorCv: document.getElementById("taskModelTailorCvCustom"),
  coverLetter: document.getElementById("taskModelCoverLetterCustom"),
  ask: document.getElementById("taskModelAskCustom"),
};

// Returns the custom input's trimmed value if the user typed a model ID,
// otherwise falls back to whatever's selected in the paired <select>. Shared
// by every model picker (the 4 task-model selects and the 5 provider-default
// selects below) so a provider shipping a model newer than this file's
// hardcoded option lists doesn't require an update here to use it.
function resolveModelValue(selectEl, customInputEl) {
  const custom = customInputEl.value.trim();
  return custom || selectEl.value;
}

// Sets a model <select> + its paired custom <input> from a stored model
// string: if the value is one of the select's own <option>s, select it and
// leave the custom input empty; otherwise (a custom/future model typed in
// before, or a value that arrived via Backup import) leave the select at its
// default and put the stored value in the custom input instead, so it's
// visible/editable rather than looking silently reset.
function setModelFieldFromStorage(selectEl, customInputEl, storedModel) {
  customInputEl.value = "";
  if (!storedModel) return;
  const found = Array.from(selectEl.options).some((opt) => opt.value === storedModel);
  if (found) {
    selectEl.value = storedModel;
  } else {
    customInputEl.value = storedModel;
  }
}

// Fills a task's model <select> with MODEL_CATALOG's options for whichever
// provider that task is currently pointed at ("" = Active provider, which
// has no specific model of its own to override — the select and its custom
// input stay empty and disabled in that case, so Save doesn't write a stale
// model value).
function populateTaskModelSelect(task, selectedModel) {
  const provider = taskProviderSelects[task].value;
  const modelSelect = taskModelSelects[task];
  const customInput = taskModelCustoms[task];
  modelSelect.innerHTML = "";
  customInput.value = "";
  if (!provider) {
    modelSelect.disabled = true;
    customInput.disabled = true;
    return;
  }
  modelSelect.disabled = false;
  customInput.disabled = false;
  const models = MODEL_CATALOG[provider] || [];
  for (const { value, label } of models) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    modelSelect.appendChild(opt);
  }
  setModelFieldFromStorage(modelSelect, customInput, selectedModel);
}

const PROVIDER_FIELD_IDS = {
  openai: { apiKey: "openaiApiKey", showKey: "showOpenaiKey", model: "openaiModel", modelCustom: "openaiModelCustom" },
  anthropic: { apiKey: "anthropicApiKey", showKey: "showAnthropicKey", model: "anthropicModel", modelCustom: "anthropicModelCustom" },
  kimi: { apiKey: "kimiApiKey", showKey: "showKimiKey", model: "kimiModel", modelCustom: "kimiModelCustom" },
  gemini: { apiKey: "geminiApiKey", showKey: "showGeminiKey", model: "geminiModel", modelCustom: "geminiModelCustom" },
  deepseek: { apiKey: "deepseekApiKey", showKey: "showDeepseekKey", model: "deepseekModel", modelCustom: "deepseekModelCustom" },
};
const providerFields = {};
for (const [id, fieldIds] of Object.entries(PROVIDER_FIELD_IDS)) {
  providerFields[id] = {
    apiKeyInput: document.getElementById(fieldIds.apiKey),
    showKeyBox: document.getElementById(fieldIds.showKey),
    modelSelect: document.getElementById(fieldIds.model),
    modelCustomInput: document.getElementById(fieldIds.modelCustom),
  };
}

const saveBtn = document.getElementById("save");
const saveStatus = document.getElementById("saveStatus");

// Terminal providers — no API key, so kept out of PROVIDER_FIELD_IDS/providerFields above.
const NATIVE_HOST_NAME = "com.farhadshad.cvautofill.clibridge";
const claudeCodeModelSelect = document.getElementById("claudeCodeModel");
const openaiCodeModelSelect = document.getElementById("openaiCodeModel");
const checkClaudeCodeBridgeBtn = document.getElementById("checkClaudeCodeBridgeBtn");
const claudeCodeBridgeStatusEl = document.getElementById("claudeCodeBridgeStatus");
const checkCodexBridgeBtn = document.getElementById("checkCodexBridgeBtn");
const codexBridgeStatusEl = document.getElementById("codexBridgeStatus");

const totalSpentEl = document.getElementById("totalSpent");
const spendByProviderEl = document.getElementById("spendByProvider");
const resetSpendBtn = document.getElementById("resetSpendBtn");

const addressLabelInput = document.getElementById("addressLabel");
const addressContentArea = document.getElementById("addressContent");
const addAddressBtn = document.getElementById("addAddressBtn");
const addressStatus = document.getElementById("addressStatus");
const addressListEl = document.getElementById("addressList");

const importBackupInput = document.getElementById("importBackupInput");

const cvFileInput = document.getElementById("cvFile");
const cvFileStatus = document.getElementById("cvFileStatus");
const cvPasteText = document.getElementById("cvPasteText");
const parseCvTextBtn = document.getElementById("parseCvText");
const cvJsonArea = document.getElementById("cvJson");
const saveCvBtn = document.getElementById("saveCv");
const clearCvBtn = document.getElementById("clearCv");
const cvStatus = document.getElementById("cvStatus");

const cvStyleSection = document.getElementById("cvStyleSection");
const cvStylePhoto = document.getElementById("cvStylePhoto");
const cvStyleColorSwatch = document.getElementById("cvStyleColorSwatch");
const cvStyleColorHex = document.getElementById("cvStyleColorHex");
const clearCvStyleBtn = document.getElementById("clearCvStyle");

const coverLetterFileInput = document.getElementById("coverLetterFile");
const coverLetterFileStatus = document.getElementById("coverLetterFileStatus");
const coverLetterTextArea = document.getElementById("coverLetterText");
const saveCoverLetterBtn = document.getElementById("saveCoverLetter");
const clearCoverLetterBtn = document.getElementById("clearCoverLetter");
const coverLetterStatus = document.getElementById("coverLetterStatus");

const aboutMeNoteLabelInput = document.getElementById("aboutMeNoteLabel");
const aboutMeNoteContentArea = document.getElementById("aboutMeNoteContent");
const addAboutMeNoteBtn = document.getElementById("addAboutMeNoteBtn");
const aboutMeFileLabelInput = document.getElementById("aboutMeFileLabel");
const aboutMeFileInput = document.getElementById("aboutMeFileInput");
const aboutMeFileStatus = document.getElementById("aboutMeFileStatus");
const aboutMeStatus = document.getElementById("aboutMeStatus");
const aboutMeNotesListEl = document.getElementById("aboutMeNotesList");

const resourceUrlInput = document.getElementById("resourceUrl");
const addResourceUrlBtn = document.getElementById("addResourceUrl");
const resourceUrlStatus = document.getElementById("resourceUrlStatus");
const resourceListEl = document.getElementById("resourceList");

const taskProviderSaveJobSelect = document.getElementById("taskProviderSaveJob");
const jobsFileNameInput = document.getElementById("jobsFileName");
const saveJobSettingsBtn = document.getElementById("saveJobSettingsBtn");
const jobSettingsStatus = document.getElementById("jobSettingsStatus");
const exportJobsBtn = document.getElementById("exportJobsBtn");
const jobsExportStatus = document.getElementById("jobsExportStatus");
const jobsTableWrapEl = document.getElementById("jobsTableWrap");

const conferenceNameInput = document.getElementById("conferenceNameInput");
const conferenceDeadlineInput = document.getElementById("conferenceDeadlineInput");
const conferenceLocationInput = document.getElementById("conferenceLocationInput");
const conferenceLinkInput = document.getElementById("conferenceLinkInput");
const conferenceStatusInput = document.getElementById("conferenceStatusInput");
const conferenceNotesInput = document.getElementById("conferenceNotesInput");
const addConferenceBtn = document.getElementById("addConferenceBtn");
const conferenceAddStatus = document.getElementById("conferenceAddStatus");
const conferencesFileNameInput = document.getElementById("conferencesFileName");
const exportConferencesBtn = document.getElementById("exportConferencesBtn");
const conferencesExportStatus = document.getElementById("conferencesExportStatus");
const conferencesTableWrapEl = document.getElementById("conferencesTableWrap");

const journalNameInput = document.getElementById("journalNameInput");
const journalFullNameInput = document.getElementById("journalFullNameInput");
const journalLinkInput = document.getElementById("journalLinkInput");
const journalStatusInput = document.getElementById("journalStatusInput");
const journalNotesInput = document.getElementById("journalNotesInput");
const addJournalBtn = document.getElementById("addJournalBtn");
const journalAddStatus = document.getElementById("journalAddStatus");
const journalsFileNameInput = document.getElementById("journalsFileName");
const exportJournalsBtn = document.getElementById("exportJournalsBtn");
const journalsExportStatus = document.getElementById("journalsExportStatus");
const journalsTableWrapEl = document.getElementById("journalsTableWrap");

const promptSections = document.querySelectorAll(".promptSection");

const askWindowPositionSelect = document.getElementById("askWindowPosition");
const askPresetFormLabel = document.getElementById("askPresetFormLabel");
const askPresetLabelInput = document.getElementById("askPresetLabel");
const askPresetPromptArea = document.getElementById("askPresetPrompt");
const addAskPresetBtn = document.getElementById("addAskPresetBtn");
const cancelAskPresetEditBtn = document.getElementById("cancelAskPresetEditBtn");
const askPresetStatus = document.getElementById("askPresetStatus");
const askPresetListEl = document.getElementById("askPresetList");

// ---- Tabs ----

function switchTab(tabName) {
  const btn = Array.from(tabBtns).find((b) => b.dataset.tab === tabName);
  if (!btn) return;
  for (const b of tabBtns) b.classList.toggle("active", b === btn);
  for (const panel of tabPanels) panel.classList.toggle("active", panel.id === `tab-${tabName}`);
}

for (const btn of tabBtns) {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
}

// A fresh install opens straight here (see background.js's onInstalled
// listener) so "Import backup" is easy to find instead of buried in a tab
// nobody clicks on first launch.
if (location.hash === "#backup") {
  switchTab("info");
  document.getElementById("backupSection")?.scrollIntoView();
}

init();

async function init() {
  const stored = await chrome.storage.local.get([
    "providers",
    "activeProvider",
    "taskProviders",
    "taskModels",
    "theme",
    "accentColor",
    "saveJobColor",
    "cvData",
    "cvStyle",
    "coverLetterText",
    "aboutMeNotes",
    "aboutMeText", // legacy single-blob field, migrated below
    "resources",
    "addresses",
    "usage",
    "savedJobs",
    "jobsFileName",
    "savedConferences",
    "conferencesFileName",
    "savedJournals",
    "journalsFileName",
    "promptOverrides",
    "askWindowPosition",
    "askAIPresets",
    // legacy single/dual-provider keys from before multi-provider support
    "provider",
    "openaiApiKey",
    "anthropicApiKey",
    "openaiModel",
    "anthropicModel",
    "apiKey",
    "model",
  ]);

  const theme = stored.theme || "system";
  for (const radio of themeRadios) radio.checked = radio.value === theme;
  accentColorInput.value = stored.accentColor || DEFAULT_ACCENT_COLOR;
  saveJobColorInput.value = stored.saveJobColor || DEFAULT_SAVE_JOB_COLOR;

  const taskProviders = stored.taskProviders || {};
  const taskModels = stored.taskModels || {};
  for (const [task, select] of Object.entries(taskProviderSelects)) {
    select.value = taskProviders[task] || "";
    populateTaskModelSelect(task, taskModels[task]);
  }
  taskProviderSaveJobSelect.value = taskProviders.saveJob || "";
  jobsFileNameInput.value = stored.jobsFileName || "applied jobs";
  renderJobsTable(stored.savedJobs || []);

  conferencesFileNameInput.value = stored.conferencesFileName || "conferences";
  renderConferencesTable(stored.savedConferences || []);
  journalsFileNameInput.value = stored.journalsFileName || "journals";
  renderJournalsTable(stored.savedJournals || []);

  let providers = stored.providers;
  let activeProvider = stored.activeProvider;
  if (!providers) {
    // one-time migration from the old single/dual-provider design
    providers = {
      openai: { apiKey: stored.openaiApiKey || stored.apiKey || "", model: stored.openaiModel || stored.model || "" },
      anthropic: { apiKey: stored.anthropicApiKey || "", model: stored.anthropicModel || "" },
      kimi: { apiKey: "", model: "" },
      gemini: { apiKey: "", model: "" },
    };
    activeProvider = stored.provider || "openai";
    await chrome.storage.local.set({ providers, activeProvider });
    await chrome.storage.local.remove(["provider", "openaiApiKey", "anthropicApiKey", "openaiModel", "anthropicModel", "apiKey", "model"]);
  }
  activeProvider = activeProvider || "openai";

  activeProviderSelect.value = activeProvider;
  for (const [id, fields] of Object.entries(providerFields)) {
    const cfg = providers[id] || {};
    fields.apiKeyInput.value = cfg.apiKey || "";
    setModelFieldFromStorage(fields.modelSelect, fields.modelCustomInput, cfg.model);
  }
  claudeCodeModelSelect.value = (providers.claudeCode || {}).model || "default";
  openaiCodeModelSelect.value = (providers.openaiCode || {}).model || "default";

  askWindowPositionSelect.value = stored.askWindowPosition || "center";
  renderAskPresets(stored.askAIPresets || []);

  if (stored.cvData) cvJsonArea.value = JSON.stringify(stored.cvData, null, 2);
  if (stored.cvStyle) renderCvStyle(stored.cvStyle);
  if (stored.coverLetterText) coverLetterTextArea.value = stored.coverLetterText;

  let aboutMeNotes = stored.aboutMeNotes || [];
  if (!aboutMeNotes.length && stored.aboutMeText && stored.aboutMeText.trim()) {
    // one-time migration from the old single-textarea design
    aboutMeNotes = [{ id: crypto.randomUUID(), label: "About me", content: stored.aboutMeText.trim(), addedAt: Date.now() }];
    await chrome.storage.local.set({ aboutMeNotes });
    await chrome.storage.local.remove("aboutMeText");
  }
  renderAboutMeNotes(aboutMeNotes);

  renderResourceList(stored.resources || []);
  renderAddressList(stored.addresses || []);
  renderSpend(stored.usage || { totalSpentUSD: 0, byProvider: {} });
  renderPrompts(stored.promptOverrides || {});
}

for (const fields of Object.values(providerFields)) {
  fields.showKeyBox.addEventListener("change", () => {
    fields.apiKeyInput.type = fields.showKeyBox.checked ? "text" : "password";
  });
}

for (const [task, select] of Object.entries(taskProviderSelects)) {
  select.addEventListener("change", () => populateTaskModelSelect(task));
}

// The Ask AI tab has no Save button of its own (everything on it auto-saves,
// like Appearance) — autofill/tailorCv/coverLetter still batch through the
// AI tab's Save button above, only "ask" needs this immediate-write path.
async function saveAskTaskSetting() {
  const { taskProviders: existing = {}, taskModels: existingModels = {} } =
    await chrome.storage.local.get(["taskProviders", "taskModels"]);
  const taskProviders = { ...existing, ask: taskProviderSelects.ask.value };
  const taskModels = {
    ...existingModels,
    ask: taskProviderSelects.ask.value ? resolveModelValue(taskModelSelects.ask, taskModelCustoms.ask) : "",
  };
  await chrome.storage.local.set({ taskProviders, taskModels });
}
taskProviderSelects.ask.addEventListener("change", saveAskTaskSetting);
taskModelSelects.ask.addEventListener("change", saveAskTaskSetting);
taskModelCustoms.ask.addEventListener("input", saveAskTaskSetting);

askWindowPositionSelect.addEventListener("change", () => {
  chrome.storage.local.set({ askWindowPosition: askWindowPositionSelect.value });
});

function renderAskPresets(presets) {
  askPresetListEl.innerHTML = "";
  if (!presets.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No saved tasks yet.";
    askPresetListEl.appendChild(empty);
    return;
  }

  for (const p of presets.slice().reverse()) {
    const item = document.createElement("div");
    item.className = "resourceItem";

    const meta = document.createElement("div");
    meta.className = "resourceMeta";
    const label = document.createElement("div");
    label.className = "resourceLabel";
    label.textContent = p.label || "Task";
    makeCopyable(label, p.label || "");
    const preview = document.createElement("div");
    preview.className = "resourcePreview";
    preview.textContent = p.prompt || "";
    makeCopyable(preview, p.prompt || "");
    meta.appendChild(label);
    meta.appendChild(preview);

    const btnRow = document.createElement("div");
    btnRow.className = "row";
    btnRow.style.marginTop = "0";

    const editBtn = document.createElement("button");
    editBtn.className = "secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEditingAskPreset(p));

    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const { askAIPresets: current = [] } = await chrome.storage.local.get("askAIPresets");
      const next = current.filter((x) => x.id !== p.id);
      await chrome.storage.local.set({ askAIPresets: next });
      if (editingAskPresetId === p.id) cancelEditingAskPreset();
      renderAskPresets(next);
    });

    btnRow.appendChild(editBtn);
    btnRow.appendChild(removeBtn);
    item.appendChild(meta);
    item.appendChild(btnRow);
    askPresetListEl.appendChild(item);
  }
}

// null while adding a new task; the preset's id while editing an existing
// one — addAskPresetBtn's handler branches on this instead of always
// pushing a new entry.
let editingAskPresetId = null;

function startEditingAskPreset(preset) {
  editingAskPresetId = preset.id;
  askPresetLabelInput.value = preset.label || "";
  askPresetPromptArea.value = preset.prompt || "";
  askPresetFormLabel.textContent = `Editing "${preset.label || "Task"}"`;
  addAskPresetBtn.textContent = "Save changes";
  cancelAskPresetEditBtn.classList.remove("hidden");
  askPresetLabelInput.focus();
}

function cancelEditingAskPreset() {
  editingAskPresetId = null;
  askPresetLabelInput.value = "";
  askPresetPromptArea.value = "";
  askPresetFormLabel.textContent = "Add a task";
  addAskPresetBtn.textContent = "Add task";
  cancelAskPresetEditBtn.classList.add("hidden");
}

cancelAskPresetEditBtn.addEventListener("click", () => {
  cancelEditingAskPreset();
  flash(askPresetStatus, "");
});

addAskPresetBtn.addEventListener("click", async () => {
  const label = askPresetLabelInput.value.trim();
  const prompt = askPresetPromptArea.value.trim();
  if (!label) {
    flash(askPresetStatus, "Give it a label first.", true);
    return;
  }
  if (!prompt) {
    flash(askPresetStatus, "Write the instructions first.", true);
    return;
  }
  const { askAIPresets = [] } = await chrome.storage.local.get("askAIPresets");
  if (editingAskPresetId) {
    const target = askAIPresets.find((x) => x.id === editingAskPresetId);
    if (target) {
      target.label = label;
      target.prompt = prompt;
    }
  } else {
    askAIPresets.push({ id: crypto.randomUUID(), label, prompt });
  }
  await chrome.storage.local.set({ askAIPresets });
  const wasEditing = !!editingAskPresetId;
  renderAskPresets(askAIPresets);
  cancelEditingAskPreset();
  flash(askPresetStatus, wasEditing ? "Task updated." : "Task added.");
});

// ---- Appearance ----

for (const radio of themeRadios) {
  radio.addEventListener("change", () => {
    if (radio.checked) chrome.storage.local.set({ theme: radio.value });
  });
}

accentColorInput.addEventListener("input", () => {
  chrome.storage.local.set({ accentColor: accentColorInput.value });
});

resetAccentBtn.addEventListener("click", () => {
  accentColorInput.value = DEFAULT_ACCENT_COLOR;
  chrome.storage.local.remove("accentColor");
});

saveJobColorInput.addEventListener("input", () => {
  chrome.storage.local.set({ saveJobColor: saveJobColorInput.value });
});

resetSaveJobColorBtn.addEventListener("click", () => {
  saveJobColorInput.value = DEFAULT_SAVE_JOB_COLOR;
  chrome.storage.local.remove("saveJobColor");
});

function looksLikeUrl(value) {
  return value.includes("://");
}

saveBtn.addEventListener("click", async () => {
  const providers = {};
  for (const [id, fields] of Object.entries(providerFields)) {
    const apiKey = fields.apiKeyInput.value.trim();
    if (looksLikeUrl(apiKey)) {
      flash(saveStatus, `The ${id} API key field has a URL in it, not a key — paste the actual key instead.`, true);
      return;
    }
    providers[id] = { apiKey, model: resolveModelValue(fields.modelSelect, fields.modelCustomInput) };
  }
  providers.claudeCode = { model: claudeCodeModelSelect.value };
  providers.openaiCode = { model: openaiCodeModelSelect.value };

  // Merge onto whatever's already stored (rather than replacing wholesale) so
  // this doesn't clobber the Jobs tab's own taskProviders.saveJob setting.
  const { taskProviders: existingTaskProviders = {}, taskModels: existingTaskModels = {} } =
    await chrome.storage.local.get(["taskProviders", "taskModels"]);
  const taskProviders = { ...existingTaskProviders };
  const taskModels = { ...existingTaskModels };
  for (const [task, select] of Object.entries(taskProviderSelects)) {
    taskProviders[task] = select.value;
    taskModels[task] = select.value ? resolveModelValue(taskModelSelects[task], taskModelCustoms[task]) : "";
  }

  await chrome.storage.local.set({ providers, activeProvider: activeProviderSelect.value, taskProviders, taskModels });
  flash(saveStatus, "Saved.");
});

// ---- Spend estimate ----

function renderSpend(usage) {
  totalSpentEl.textContent = `$${(usage.totalSpentUSD || 0).toFixed(4)}`;
  const byProvider = usage.byProvider || {};
  const lines = Object.entries(byProvider)
    .filter(([, b]) => (b.promptTokens || 0) + (b.completionTokens || 0) > 0)
    .map(([id, b]) => `${PROVIDER_LABEL_NAMES[id] || id}: $${(b.spentUSD || 0).toFixed(4)} (${(b.promptTokens || 0) + (b.completionTokens || 0)} tokens)`);
  spendByProviderEl.textContent = lines.length ? lines.join(" · ") : "No usage recorded yet.";
}

const PROVIDER_LABEL_NAMES = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  kimi: "Kimi",
  gemini: "Gemini",
};

resetSpendBtn.addEventListener("click", async () => {
  const usage = { totalSpentUSD: 0, byProvider: {} };
  await chrome.storage.local.set({ usage });
  renderSpend(usage);
});

// ---- CV ----

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function isDocx(file) {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  );
}

function isPdfFile(file) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

cvFileInput.addEventListener("change", async () => {
  const file = cvFileInput.files[0];
  if (!file) return;
  try {
    flash(cvFileStatus, "Reading file...");
    let msg;
    if (isPdfFile(file)) {
      msg = { type: "PARSE_CV", isPdf: true, base64: await fileToBase64(file) };
    } else if (isDocx(file)) {
      flash(cvFileStatus, "Extracting text from .docx...");
      const arrayBuffer = await fileToArrayBuffer(file);
      const text = await extractDocxText(arrayBuffer);
      msg = { type: "PARSE_CV", isPdf: false, text };
      extractDocxStyle(arrayBuffer)
        .then((style) => {
          if (style.photoBase64 || style.accentColorHex) {
            chrome.storage.local.set({ cvStyle: style });
            renderCvStyle(style);
          }
        })
        .catch(() => {});
    } else {
      msg = { type: "PARSE_CV", isPdf: false, text: await fileToText(file) };
    }
    flash(cvFileStatus, "Parsing CV with AI...");
    const response = await chrome.runtime.sendMessage(msg);
    if (response.error) throw new Error(response.error);
    cvJsonArea.value = JSON.stringify(response.cvData, null, 2);
    flash(cvFileStatus, "CV parsed and saved.");
  } catch (err) {
    flash(cvFileStatus, err.message, true);
  } finally {
    cvFileInput.value = "";
  }
});

parseCvTextBtn.addEventListener("click", async () => {
  const text = cvPasteText.value.trim();
  if (!text) {
    flash(cvStatus, "Paste some CV text first.", true);
    return;
  }
  try {
    flash(cvStatus, "Parsing CV with AI...");
    const response = await chrome.runtime.sendMessage({ type: "PARSE_CV", isPdf: false, text });
    if (response.error) throw new Error(response.error);
    cvJsonArea.value = JSON.stringify(response.cvData, null, 2);
    flash(cvStatus, "CV parsed and saved.");
  } catch (err) {
    flash(cvStatus, err.message, true);
  }
});

saveCvBtn.addEventListener("click", async () => {
  try {
    const cvData = JSON.parse(cvJsonArea.value);
    await chrome.storage.local.set({ cvData });
    flash(cvStatus, "CV data saved.");
  } catch (err) {
    flash(cvStatus, `Invalid JSON: ${err.message}`, true);
  }
});

clearCvBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("cvData");
  cvJsonArea.value = "";
  flash(cvStatus, "CV data cleared.");
});

// ---- CV style (photo + accent color extracted from an uploaded .docx) ----

function renderCvStyle(style) {
  const hasPhoto = !!(style && style.photoBase64 && style.photoMime);
  const hasColor = !!(style && style.accentColorHex);
  cvStyleSection.classList.toggle("hidden", !hasPhoto && !hasColor);

  cvStylePhoto.classList.toggle("hidden", !hasPhoto);
  if (hasPhoto) cvStylePhoto.src = `data:${style.photoMime};base64,${style.photoBase64}`;

  cvStyleColorSwatch.classList.toggle("hidden", !hasColor);
  cvStyleColorHex.textContent = hasColor ? style.accentColorHex : "";
  if (hasColor) cvStyleColorSwatch.style.background = style.accentColorHex;
}

clearCvStyleBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("cvStyle");
  renderCvStyle(null);
  flash(cvStatus, "Style cleared — the tailored CV will use plain colors again.");
});

// ---- Cover letter ----

coverLetterFileInput.addEventListener("change", async () => {
  const file = coverLetterFileInput.files[0];
  if (!file) return;
  try {
    flash(coverLetterFileStatus, "Reading file...");
    let msg;
    if (isPdfFile(file)) {
      flash(coverLetterFileStatus, "Extracting text with AI...");
      msg = { type: "SAVE_COVER_LETTER", isPdf: true, base64: await fileToBase64(file) };
    } else if (isDocx(file)) {
      flash(coverLetterFileStatus, "Extracting text from .docx...");
      const text = await extractDocxText(await fileToArrayBuffer(file));
      msg = { type: "SAVE_COVER_LETTER", isPdf: false, text };
    } else {
      msg = { type: "SAVE_COVER_LETTER", isPdf: false, text: await fileToText(file) };
    }
    const response = await chrome.runtime.sendMessage(msg);
    if (response.error) throw new Error(response.error);
    coverLetterTextArea.value = response.coverLetterText;
    flash(coverLetterFileStatus, "Cover letter saved.");
  } catch (err) {
    flash(coverLetterFileStatus, err.message, true);
  } finally {
    coverLetterFileInput.value = "";
  }
});

saveCoverLetterBtn.addEventListener("click", async () => {
  const coverLetterText = coverLetterTextArea.value.trim();
  await chrome.storage.local.set({ coverLetterText });
  flash(coverLetterStatus, "Cover letter saved.");
});

clearCoverLetterBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("coverLetterText");
  coverLetterTextArea.value = "";
  flash(coverLetterStatus, "Cover letter cleared.");
});

function flash(el, text, isError = false) {
  el.textContent = text;
  el.style.color = isError ? "var(--danger)" : "var(--success)";
  makeCopyable(el, text);
  if (!isError) {
    setTimeout(() => {
      if (el.textContent === text) {
        el.textContent = "";
        makeCopyable(el, "");
      }
    }, 3000);
  }
}

// ---- About me / notes ----

function renderAboutMeNotes(notes) {
  aboutMeNotesListEl.innerHTML = "";
  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No notes saved yet.";
    aboutMeNotesListEl.appendChild(empty);
    return;
  }

  for (const n of notes.slice().reverse()) {
    const item = document.createElement("div");
    item.className = "resourceItem";

    const meta = document.createElement("div");
    meta.className = "resourceMeta";
    const label = document.createElement("div");
    label.className = "resourceLabel";
    label.textContent = n.label || "Note";
    makeCopyable(label, n.label || "");
    const preview = document.createElement("div");
    preview.className = "resourcePreview";
    preview.textContent = n.content || "";
    makeCopyable(preview, n.content || "");
    meta.appendChild(label);
    meta.appendChild(preview);

    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const { aboutMeNotes: current = [] } = await chrome.storage.local.get("aboutMeNotes");
      const next = current.filter((x) => x.id !== n.id);
      await chrome.storage.local.set({ aboutMeNotes: next });
      renderAboutMeNotes(next);
    });

    item.appendChild(meta);
    item.appendChild(removeBtn);
    aboutMeNotesListEl.appendChild(item);
  }
}

async function addAboutMeNote(label, content) {
  const { aboutMeNotes = [] } = await chrome.storage.local.get("aboutMeNotes");
  aboutMeNotes.push({ id: crypto.randomUUID(), label: label || "Note", content, addedAt: Date.now() });
  await chrome.storage.local.set({ aboutMeNotes });
  renderAboutMeNotes(aboutMeNotes);
}

addAboutMeNoteBtn.addEventListener("click", async () => {
  const content = aboutMeNoteContentArea.value.trim();
  if (!content) {
    flash(aboutMeStatus, "Write something first.", true);
    return;
  }
  const label = aboutMeNoteLabelInput.value.trim();
  await addAboutMeNote(label, content);
  aboutMeNoteLabelInput.value = "";
  aboutMeNoteContentArea.value = "";
  flash(aboutMeStatus, "Note added.");
});

aboutMeFileInput.addEventListener("change", async () => {
  const file = aboutMeFileInput.files[0];
  if (!file) return;
  const defaultLabel = file.name.replace(/\.[^.]+$/, "");
  const label = aboutMeFileLabelInput.value.trim() || defaultLabel;

  try {
    flash(aboutMeFileStatus, "Reading file...");
    let text;
    if (isPdfFile(file)) {
      flash(aboutMeFileStatus, "Extracting text with AI...");
      const base64 = await fileToBase64(file);
      const response = await chrome.runtime.sendMessage({ type: "EXTRACT_DOCUMENT_TEXT", base64 });
      if (response.error) throw new Error(response.error);
      text = response.text;
    } else if (isDocx(file)) {
      flash(aboutMeFileStatus, "Extracting text from .docx...");
      text = await extractDocxText(await fileToArrayBuffer(file));
    } else {
      text = await fileToText(file);
    }

    if (!text || !text.trim()) {
      flash(aboutMeFileStatus, "Couldn't find any text in that file.", true);
      return;
    }

    await addAboutMeNote(label, text.trim());
    aboutMeFileLabelInput.value = "";
    flash(aboutMeFileStatus, `Added "${label}".`);
  } catch (err) {
    flash(aboutMeFileStatus, err.message, true);
  } finally {
    aboutMeFileInput.value = "";
  }
});

// ---- Addresses ----

function renderAddressList(addresses) {
  addressListEl.innerHTML = "";
  if (!addresses.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No addresses saved yet.";
    addressListEl.appendChild(empty);
    return;
  }

  for (const a of addresses.slice().reverse()) {
    const item = document.createElement("div");
    item.className = "resourceItem";

    const meta = document.createElement("div");
    meta.className = "resourceMeta";
    const label = document.createElement("div");
    label.className = "resourceLabel";
    label.textContent = a.label || "Address";
    makeCopyable(label, a.label || "");
    const preview = document.createElement("div");
    preview.className = "resourcePreview";
    preview.textContent = a.content || "";
    makeCopyable(preview, a.content || "");
    meta.appendChild(label);
    meta.appendChild(preview);

    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const { addresses: current = [] } = await chrome.storage.local.get("addresses");
      const next = current.filter((x) => x.id !== a.id);
      await chrome.storage.local.set({ addresses: next });
      renderAddressList(next);
    });

    item.appendChild(meta);
    item.appendChild(removeBtn);
    addressListEl.appendChild(item);
  }
}

addAddressBtn.addEventListener("click", async () => {
  const content = addressContentArea.value.trim();
  if (!content) {
    flash(addressStatus, "Write an address first.", true);
    return;
  }
  const label = addressLabelInput.value.trim();
  const { addresses = [] } = await chrome.storage.local.get("addresses");
  addresses.push({ id: crypto.randomUUID(), label: label || "Address", content, addedAt: Date.now() });
  await chrome.storage.local.set({ addresses });
  renderAddressList(addresses);
  addressLabelInput.value = "";
  addressContentArea.value = "";
  flash(addressStatus, "Address added.");
});

// ---- Resources ----

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  const raw = doc.body ? doc.body.innerText : doc.documentElement.innerText || "";
  return raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

addResourceUrlBtn.addEventListener("click", async () => {
  const rawUrl = resourceUrlInput.value.trim();
  if (!rawUrl) return;

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    flash(resourceUrlStatus, "That doesn't look like a valid URL.", true);
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    flash(resourceUrlStatus, "Only http/https URLs are supported.", true);
    return;
  }

  try {
    flash(resourceUrlStatus, "Requesting permission to read this site...");
    const originPattern = `${parsed.protocol}//${parsed.host}/*`;
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) {
      flash(resourceUrlStatus, "Permission denied — can't fetch this site.", true);
      return;
    }

    flash(resourceUrlStatus, "Fetching...");
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
    const html = await res.text();
    const parsedDoc = new DOMParser().parseFromString(html, "text/html");
    const title = (parsedDoc.title || parsed.hostname).trim();
    const text = htmlToText(html).slice(0, 6000);

    const { resources = [] } = await chrome.storage.local.get("resources");
    resources.push({ id: crypto.randomUUID(), label: title, url: rawUrl, content: text, addedAt: Date.now() });
    await chrome.storage.local.set({ resources });

    resourceUrlInput.value = "";
    flash(resourceUrlStatus, "Added.");
    renderResourceList(resources);
  } catch (err) {
    flash(resourceUrlStatus, err.message, true);
  }
});

function renderResourceList(resources) {
  resourceListEl.innerHTML = "";
  if (!resources.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No resources saved yet.";
    resourceListEl.appendChild(empty);
    return;
  }

  for (const r of resources.slice().reverse()) {
    const item = document.createElement("div");
    item.className = "resourceItem";

    const meta = document.createElement("div");
    meta.className = "resourceMeta";
    const label = document.createElement("div");
    label.className = "resourceLabel";
    label.textContent = r.label || r.url || "Note";
    makeCopyable(label, r.label || r.url || "");
    const preview = document.createElement("div");
    preview.className = "resourcePreview";
    preview.textContent = r.content || "";
    makeCopyable(preview, r.content || "");
    meta.appendChild(label);
    meta.appendChild(preview);

    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const { resources: current = [] } = await chrome.storage.local.get("resources");
      const next = current.filter((x) => x.id !== r.id);
      await chrome.storage.local.set({ resources: next });
      renderResourceList(next);
    });

    item.appendChild(meta);
    item.appendChild(removeBtn);
    resourceListEl.appendChild(item);
  }
}

// ---- Export backup ----
// A "choose a folder and silently mirror every save into it" version of
// this used to live here, built on window.showDirectoryPicker(). That API
// is confirmed broken specifically inside extension pages (AbortError,
// regardless of any permission grant — see
// https://issues.chromium.org/issues/40240444 and
// https://github.com/WICG/file-system-access/issues/314), so it's gone.
// This is the realistic replacement: one on-demand export, using the same
// chrome.downloads.download() + data: URL approach as the CV/cover letter
// downloads (which has its own well-known blob: URL gotcha in popups —
// see bytesToDataUrl-equivalent below).

const exportBackupBtn = document.getElementById("exportBackupBtn");
const backupStatusEl = document.getElementById("backupStatus");

function textToDataUrl(text, mimeType) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

const BACKUP_KEYS = [
  "providers",
  "activeProvider",
  "taskProviders",
  "taskModels",
  "theme",
  "accentColor",
  "saveJobColor",
  "cvData",
  "cvStyle",
  "coverLetterText",
  "aboutMeNotes",
  "resources",
  "addresses",
  "usage",
  "savedJobs",
  "jobsFileName",
  "savedConferences",
  "conferencesFileName",
  "savedJournals",
  "journalsFileName",
  "promptOverrides",
  "askWindowPosition",
  "askAIPresets",
];

exportBackupBtn.addEventListener("click", async () => {
  try {
    flash(backupStatusEl, "Exporting...");
    const data = await chrome.storage.local.get(BACKUP_KEYS);
    const bundle = { exportedAt: new Date().toISOString(), ...data };
    const url = textToDataUrl(JSON.stringify(bundle, null, 2), "application/json");
    await chrome.downloads.download({ url, filename: "cv-autofill-backup.json", saveAs: true });
    flash(backupStatusEl, "Exported.");
  } catch (err) {
    flash(backupStatusEl, err.message, true);
  }
});

importBackupInput.addEventListener("change", async () => {
  const file = importBackupInput.files[0];
  if (!file) return;
  try {
    flash(backupStatusEl, "Reading backup file...");
    const text = await fileToText(file);
    const bundle = JSON.parse(text);
    const { exportedAt, ...data } = bundle;
    const toRestore = {};
    for (const key of BACKUP_KEYS) {
      if (key in data) toRestore[key] = data[key];
    }
    if (!Object.keys(toRestore).length) {
      throw new Error("That file doesn't look like a backup from this extension.");
    }
    await chrome.storage.local.set(toRestore);
    flash(backupStatusEl, "Restored — reloading...");
    setTimeout(() => location.reload(), 600);
  } catch (err) {
    flash(backupStatusEl, `Import failed: ${err.message}`, true);
  } finally {
    importBackupInput.value = "";
  }
});

// ---- Jobs ----

function bytesToDataUrl(bytes, mimeType) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function renderJobsTable(jobs) {
  jobsTableWrapEl.innerHTML = "";
  if (!jobs.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No jobs saved yet — use \"Save this job\" in the popup on a job posting page.";
    jobsTableWrapEl.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "jobsTable";

  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>Job title</th><th>Company</th><th>Date</th><th>Location</th><th>Requirements</th><th>Link</th><th>Results</th><th></th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const job of jobs.slice().reverse()) {
    const tr = document.createElement("tr");

    const titleTd = document.createElement("td");
    titleTd.textContent = job.title || "";
    tr.appendChild(titleTd);

    const companyTd = document.createElement("td");
    companyTd.textContent = job.company || "";
    tr.appendChild(companyTd);

    const dateTd = document.createElement("td");
    dateTd.textContent = docxFormatJobDate(job.addedAt);
    tr.appendChild(dateTd);

    const locationTd = document.createElement("td");
    locationTd.textContent = job.location || "";
    tr.appendChild(locationTd);

    const reqTd = document.createElement("td");
    reqTd.textContent = job.requirements || "";
    tr.appendChild(reqTd);

    const linkTd = document.createElement("td");
    linkTd.className = "jobsLink";
    if (job.link) {
      const a = document.createElement("a");
      a.href = job.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = job.link;
      a.title = job.link;
      linkTd.appendChild(a);
    }
    tr.appendChild(linkTd);

    const resultsTd = document.createElement("td");
    const resultsArea = document.createElement("textarea");
    resultsArea.rows = 2;
    resultsArea.value = job.results || "";
    resultsArea.placeholder = "e.g. Interviewed, Rejected, Offer...";
    resultsArea.addEventListener("change", async () => {
      const { savedJobs: current = [] } = await chrome.storage.local.get("savedJobs");
      const target = current.find((j) => j.id === job.id);
      if (target) {
        target.results = resultsArea.value;
        await chrome.storage.local.set({ savedJobs: current });
      }
    });
    resultsTd.appendChild(resultsArea);
    tr.appendChild(resultsTd);

    const removeTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const { savedJobs: current = [] } = await chrome.storage.local.get("savedJobs");
      const next = current.filter((j) => j.id !== job.id);
      await chrome.storage.local.set({ savedJobs: next });
      renderJobsTable(next);
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  jobsTableWrapEl.appendChild(table);
}

saveJobSettingsBtn.addEventListener("click", async () => {
  // Merge onto whatever's already stored so this doesn't clobber the AI
  // tab's autofill/tailorCv/coverLetter provider choices.
  const { taskProviders: existingTaskProviders = {} } = await chrome.storage.local.get("taskProviders");
  const taskProviders = { ...existingTaskProviders, saveJob: taskProviderSaveJobSelect.value };
  const jobsFileName = jobsFileNameInput.value.trim() || "applied jobs";

  await chrome.storage.local.set({ taskProviders, jobsFileName });
  flash(jobSettingsStatus, "Saved.");
});

exportJobsBtn.addEventListener("click", async () => {
  try {
    flash(jobsExportStatus, "Exporting...");
    const { savedJobs = [], jobsFileName = "applied jobs" } = await chrome.storage.local.get(["savedJobs", "jobsFileName"]);
    const baseName = (jobsFileName || "applied jobs").trim() || "applied jobs";

    // saveAs:false + conflictAction:"overwrite" — no dialog, replaces the
    // same file in the browser's default downloads location each time.
    const docxBytes = generateJobsDocx(savedJobs);
    const docxUrl = bytesToDataUrl(docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await chrome.downloads.download({ url: docxUrl, filename: `${baseName}.docx`, saveAs: false, conflictAction: "overwrite" });

    const jsonBytes = new TextEncoder().encode(JSON.stringify(savedJobs, null, 2));
    const jsonUrl = bytesToDataUrl(jsonBytes, "application/json");
    await chrome.downloads.download({ url: jsonUrl, filename: `${baseName}.json`, saveAs: false, conflictAction: "overwrite" });

    flash(jobsExportStatus, "Exported.");
  } catch (err) {
    flash(jobsExportStatus, err.message, true);
  }
});

// ---- Academic: Conferences ----

function renderConferencesTable(conferences) {
  conferencesTableWrapEl.innerHTML = "";
  if (!conferences.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No conferences saved yet — add one above.";
    conferencesTableWrapEl.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "jobsTable";

  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>Name</th><th>Deadline</th><th>Location</th><th>Status</th><th>Link</th><th>Notes</th><th></th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const conf of conferences.slice().reverse()) {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = conf.name || "";
    tr.appendChild(nameTd);

    const deadlineTd = document.createElement("td");
    deadlineTd.textContent = conf.deadline || "";
    tr.appendChild(deadlineTd);

    const locationTd = document.createElement("td");
    locationTd.textContent = conf.location || "";
    tr.appendChild(locationTd);

    const statusTd = document.createElement("td");
    statusTd.textContent = conf.status || "";
    tr.appendChild(statusTd);

    const linkTd = document.createElement("td");
    linkTd.className = "jobsLink";
    if (conf.link) {
      const a = document.createElement("a");
      a.href = conf.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = conf.link;
      a.title = conf.link;
      linkTd.appendChild(a);
    }
    tr.appendChild(linkTd);

    const notesTd = document.createElement("td");
    const notesArea = document.createElement("textarea");
    notesArea.rows = 2;
    notesArea.value = conf.notes || "";
    notesArea.addEventListener("change", async () => {
      const { savedConferences: current = [] } = await chrome.storage.local.get("savedConferences");
      const target = current.find((c) => c.id === conf.id);
      if (target) {
        target.notes = notesArea.value;
        await chrome.storage.local.set({ savedConferences: current });
      }
    });
    notesTd.appendChild(notesArea);
    tr.appendChild(notesTd);

    const removeTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const { savedConferences: current = [] } = await chrome.storage.local.get("savedConferences");
      const next = current.filter((c) => c.id !== conf.id);
      await chrome.storage.local.set({ savedConferences: next });
      renderConferencesTable(next);
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  conferencesTableWrapEl.appendChild(table);
}

addConferenceBtn.addEventListener("click", async () => {
  const name = conferenceNameInput.value.trim();
  if (!name) {
    flash(conferenceAddStatus, "Add at least a name.", true);
    return;
  }
  const { savedConferences = [] } = await chrome.storage.local.get("savedConferences");
  savedConferences.push({
    id: crypto.randomUUID(),
    name,
    deadline: conferenceDeadlineInput.value.trim(),
    location: conferenceLocationInput.value.trim(),
    link: conferenceLinkInput.value.trim(),
    status: conferenceStatusInput.value.trim(),
    notes: conferenceNotesInput.value.trim(),
    addedAt: Date.now(),
  });
  await chrome.storage.local.set({ savedConferences });
  conferenceNameInput.value = "";
  conferenceDeadlineInput.value = "";
  conferenceLocationInput.value = "";
  conferenceLinkInput.value = "";
  conferenceStatusInput.value = "";
  conferenceNotesInput.value = "";
  renderConferencesTable(savedConferences);
  flash(conferenceAddStatus, "Added.");
});

exportConferencesBtn.addEventListener("click", async () => {
  try {
    flash(conferencesExportStatus, "Exporting...");
    const { savedConferences = [] } = await chrome.storage.local.get("savedConferences");
    const baseName = conferencesFileNameInput.value.trim() || "conferences";
    await chrome.storage.local.set({ conferencesFileName: baseName });

    const docxBytes = generateConferencesDocx(savedConferences);
    const docxUrl = bytesToDataUrl(docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await chrome.downloads.download({ url: docxUrl, filename: `${baseName}.docx`, saveAs: false, conflictAction: "overwrite" });

    const jsonBytes = new TextEncoder().encode(JSON.stringify(savedConferences, null, 2));
    const jsonUrl = bytesToDataUrl(jsonBytes, "application/json");
    await chrome.downloads.download({ url: jsonUrl, filename: `${baseName}.json`, saveAs: false, conflictAction: "overwrite" });

    flash(conferencesExportStatus, "Exported.");
  } catch (err) {
    flash(conferencesExportStatus, err.message, true);
  }
});

// ---- Academic: Journals ----

function renderJournalsTable(journals) {
  journalsTableWrapEl.innerHTML = "";
  if (!journals.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No journals saved yet — add one above.";
    journalsTableWrapEl.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "jobsTable";

  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Name</th><th>Status</th><th>Link</th><th>Notes</th><th>Date</th><th></th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const journal of journals.slice().reverse()) {
    const tr = document.createElement("tr");

    // Short name, with the full name underneath as a smaller/muted line —
    // not a separate column, so the table stays compact.
    const nameTd = document.createElement("td");
    const nameLine = document.createElement("div");
    nameLine.textContent = journal.name || "";
    nameTd.appendChild(nameLine);
    if (journal.fullName) {
      const fullNameLine = document.createElement("div");
      fullNameLine.className = "muted";
      fullNameLine.textContent = journal.fullName;
      nameTd.appendChild(fullNameLine);
    }
    tr.appendChild(nameTd);

    const statusTd = document.createElement("td");
    statusTd.textContent = journal.status || "";
    tr.appendChild(statusTd);

    const linkTd = document.createElement("td");
    linkTd.className = "jobsLink";
    if (journal.link) {
      const a = document.createElement("a");
      a.href = journal.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = journal.link;
      a.title = journal.link;
      linkTd.appendChild(a);
    }
    tr.appendChild(linkTd);

    const notesTd = document.createElement("td");
    const notesArea = document.createElement("textarea");
    notesArea.rows = 2;
    notesArea.value = journal.notes || "";
    notesArea.addEventListener("change", async () => {
      const { savedJournals: current = [] } = await chrome.storage.local.get("savedJournals");
      const target = current.find((j) => j.id === journal.id);
      if (target) {
        target.notes = notesArea.value;
        await chrome.storage.local.set({ savedJournals: current });
      }
    });
    notesTd.appendChild(notesArea);
    tr.appendChild(notesTd);

    const dateTd = document.createElement("td");
    dateTd.textContent = docxFormatJobDate(journal.addedAt);
    tr.appendChild(dateTd);

    const removeTd = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const { savedJournals: current = [] } = await chrome.storage.local.get("savedJournals");
      const next = current.filter((j) => j.id !== journal.id);
      await chrome.storage.local.set({ savedJournals: next });
      renderJournalsTable(next);
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  journalsTableWrapEl.appendChild(table);
}

addJournalBtn.addEventListener("click", async () => {
  const name = journalNameInput.value.trim();
  if (!name) {
    flash(journalAddStatus, "Add at least a name.", true);
    return;
  }
  const { savedJournals = [] } = await chrome.storage.local.get("savedJournals");
  savedJournals.push({
    id: crypto.randomUUID(),
    name,
    fullName: journalFullNameInput.value.trim(),
    link: journalLinkInput.value.trim(),
    status: journalStatusInput.value.trim(),
    notes: journalNotesInput.value.trim(),
    addedAt: Date.now(),
  });
  await chrome.storage.local.set({ savedJournals });
  journalNameInput.value = "";
  journalFullNameInput.value = "";
  journalLinkInput.value = "";
  journalStatusInput.value = "";
  journalNotesInput.value = "";
  renderJournalsTable(savedJournals);
  flash(journalAddStatus, "Added.");
});

exportJournalsBtn.addEventListener("click", async () => {
  try {
    flash(journalsExportStatus, "Exporting...");
    const { savedJournals = [] } = await chrome.storage.local.get("savedJournals");
    const baseName = journalsFileNameInput.value.trim() || "journals";
    await chrome.storage.local.set({ journalsFileName: baseName });

    const docxBytes = generateJournalsDocx(savedJournals);
    const docxUrl = bytesToDataUrl(docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await chrome.downloads.download({ url: docxUrl, filename: `${baseName}.docx`, saveAs: false, conflictAction: "overwrite" });

    const jsonBytes = new TextEncoder().encode(JSON.stringify(savedJournals, null, 2));
    const jsonUrl = bytesToDataUrl(jsonBytes, "application/json");
    await chrome.downloads.download({ url: jsonUrl, filename: `${baseName}.json`, saveAs: false, conflictAction: "overwrite" });

    flash(journalsExportStatus, "Exported.");
  } catch (err) {
    flash(journalsExportStatus, err.message, true);
  }
});

// ---- Prompts ----

function renderPrompts(overrides) {
  for (const section of promptSections) {
    const key = section.dataset.promptKey;
    const textarea = section.querySelector(".promptTextarea");
    textarea.value = overrides[key] || DEFAULT_PROMPTS[key];
  }
}

for (const section of promptSections) {
  const key = section.dataset.promptKey;
  const textarea = section.querySelector(".promptTextarea");
  const promptSaveBtn = section.querySelector(".promptSaveBtn");
  const promptResetBtn = section.querySelector(".promptResetBtn");
  const promptStatus = section.querySelector(".promptStatus");

  promptSaveBtn.addEventListener("click", async () => {
    const { promptOverrides = {} } = await chrome.storage.local.get("promptOverrides");
    const text = textarea.value.trim();
    if (!text || text === DEFAULT_PROMPTS[key]) {
      delete promptOverrides[key];
    } else {
      promptOverrides[key] = text;
    }
    await chrome.storage.local.set({ promptOverrides });
    textarea.value = promptOverrides[key] || DEFAULT_PROMPTS[key];
    flash(promptStatus, "Saved.");
  });

  promptResetBtn.addEventListener("click", async () => {
    const { promptOverrides = {} } = await chrome.storage.local.get("promptOverrides");
    delete promptOverrides[key];
    await chrome.storage.local.set({ promptOverrides });
    textarea.value = DEFAULT_PROMPTS[key];
    flash(promptStatus, "Reset to default.");
  });
}

// ---- Terminal providers (native messaging bridge) ----

function checkBridge(statusEl) {
  statusEl.textContent = "Checking...";
  statusEl.style.color = "";
  // The exact request content doesn't matter here — any response at all
  // (even an "unknown cli" error) proves the native host process launched,
  // read our message, and replied. Only chrome.runtime.lastError means the
  // bridge isn't registered/reachable.
  chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { cli: "ping", model: "default", prompt: "ping" }, () => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = 'Not found — see "Set up" below.';
      statusEl.style.color = "var(--danger)";
      return;
    }
    statusEl.textContent = "Bridge found.";
    statusEl.style.color = "var(--success)";
  });
}

checkClaudeCodeBridgeBtn.addEventListener("click", () => checkBridge(claudeCodeBridgeStatusEl));
checkCodexBridgeBtn.addEventListener("click", () => checkBridge(codexBridgeStatusEl));

for (const btn of document.querySelectorAll(".copyCmdBtn")) {
  btn.addEventListener("click", async () => {
    const text = btn.dataset.copy || "";
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Copy failed";
    }
    setTimeout(() => {
      btn.textContent = original;
    }, 1500);
  });
}
