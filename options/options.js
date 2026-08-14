const providerSelect = document.getElementById("provider");
const openaiSection = document.getElementById("openaiSection");
const anthropicSection = document.getElementById("anthropicSection");

const openaiApiKeyInput = document.getElementById("openaiApiKey");
const showOpenaiKeyBox = document.getElementById("showOpenaiKey");
const openaiModelSelect = document.getElementById("openaiModel");

const anthropicApiKeyInput = document.getElementById("anthropicApiKey");
const showAnthropicKeyBox = document.getElementById("showAnthropicKey");
const anthropicModelSelect = document.getElementById("anthropicModel");

const saveBtn = document.getElementById("save");
const saveStatus = document.getElementById("saveStatus");

const cvFileInput = document.getElementById("cvFile");
const cvFileStatus = document.getElementById("cvFileStatus");
const cvPasteText = document.getElementById("cvPasteText");
const parseCvTextBtn = document.getElementById("parseCvText");
const cvJsonArea = document.getElementById("cvJson");
const saveCvBtn = document.getElementById("saveCv");
const clearCvBtn = document.getElementById("clearCv");
const cvStatus = document.getElementById("cvStatus");

const coverLetterFileInput = document.getElementById("coverLetterFile");
const coverLetterFileStatus = document.getElementById("coverLetterFileStatus");
const coverLetterTextArea = document.getElementById("coverLetterText");
const saveCoverLetterBtn = document.getElementById("saveCoverLetter");
const clearCoverLetterBtn = document.getElementById("clearCoverLetter");
const coverLetterStatus = document.getElementById("coverLetterStatus");

init();

async function init() {
  const stored = await chrome.storage.local.get([
    "provider",
    "openaiApiKey",
    "anthropicApiKey",
    "openaiModel",
    "anthropicModel",
    "cvData",
    "coverLetterText",
    // legacy single-provider keys from before multi-provider support
    "apiKey",
    "model",
  ]);

  const provider = stored.provider || "openai";
  const openaiApiKey = stored.openaiApiKey || stored.apiKey || "";
  const openaiModel = stored.openaiModel || stored.model || "";

  providerSelect.value = provider;
  openaiApiKeyInput.value = openaiApiKey;
  if (openaiModel) openaiModelSelect.value = openaiModel;
  anthropicApiKeyInput.value = stored.anthropicApiKey || "";
  if (stored.anthropicModel) anthropicModelSelect.value = stored.anthropicModel;
  if (stored.cvData) cvJsonArea.value = JSON.stringify(stored.cvData, null, 2);
  if (stored.coverLetterText) coverLetterTextArea.value = stored.coverLetterText;

  updateVisibleSection();
}

function updateVisibleSection() {
  const isAnthropic = providerSelect.value === "anthropic";
  openaiSection.style.display = isAnthropic ? "none" : "block";
  anthropicSection.style.display = isAnthropic ? "block" : "none";
}

providerSelect.addEventListener("change", updateVisibleSection);

showOpenaiKeyBox.addEventListener("change", () => {
  openaiApiKeyInput.type = showOpenaiKeyBox.checked ? "text" : "password";
});
showAnthropicKeyBox.addEventListener("change", () => {
  anthropicApiKeyInput.type = showAnthropicKeyBox.checked ? "text" : "password";
});

saveBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({
    provider: providerSelect.value,
    openaiApiKey: openaiApiKeyInput.value.trim(),
    openaiModel: openaiModelSelect.value,
    anthropicApiKey: anthropicApiKeyInput.value.trim(),
    anthropicModel: anthropicModelSelect.value,
  });
  await chrome.storage.local.remove(["apiKey", "model"]);
  flash(saveStatus, "Saved.");
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
      const text = await extractDocxText(await fileToArrayBuffer(file));
      msg = { type: "PARSE_CV", isPdf: false, text };
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
  await chrome.storage.local.set({ coverLetterText: coverLetterTextArea.value.trim() });
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
  if (!isError) {
    setTimeout(() => {
      if (el.textContent === text) el.textContent = "";
    }, 3000);
  }
}
