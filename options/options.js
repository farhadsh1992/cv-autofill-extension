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

init();

async function init() {
  const stored = await chrome.storage.local.get([
    "provider",
    "openaiApiKey",
    "anthropicApiKey",
    "openaiModel",
    "anthropicModel",
    "cvData",
    "cvStyle",
    "coverLetterText",
    "aboutMeNotes",
    "aboutMeText", // legacy single-blob field, migrated below
    "resources",
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

function looksLikeUrl(value) {
  return value.includes("://");
}

saveBtn.addEventListener("click", async () => {
  const openaiApiKey = openaiApiKeyInput.value.trim();
  const anthropicApiKey = anthropicApiKeyInput.value.trim();

  if (looksLikeUrl(openaiApiKey)) {
    flash(saveStatus, "The OpenAI API key field has a URL in it, not a key — paste the actual sk-... key instead.", true);
    return;
  }
  if (looksLikeUrl(anthropicApiKey)) {
    flash(saveStatus, "The Anthropic API key field has a URL in it, not a key — paste the actual sk-ant-... key instead.", true);
    return;
  }

  await chrome.storage.local.set({
    provider: providerSelect.value,
    openaiApiKey,
    openaiModel: openaiModelSelect.value,
    anthropicApiKey,
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

exportBackupBtn.addEventListener("click", async () => {
  try {
    flash(backupStatusEl, "Exporting...");
    const data = await chrome.storage.local.get([
      "cvData",
      "coverLetterText",
      "aboutMeNotes",
      "resources",
      "cvStyle",
    ]);
    const bundle = { exportedAt: new Date().toISOString(), ...data };
    const url = textToDataUrl(JSON.stringify(bundle, null, 2), "application/json");
    await chrome.downloads.download({ url, filename: "cv-autofill-backup.json", saveAs: true });
    flash(backupStatusEl, "Exported.");
  } catch (err) {
    flash(backupStatusEl, err.message, true);
  }
});
