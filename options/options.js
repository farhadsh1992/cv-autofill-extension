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

const aboutMeTextArea = document.getElementById("aboutMeText");
const saveAboutMeBtn = document.getElementById("saveAboutMe");
const clearAboutMeBtn = document.getElementById("clearAboutMe");
const aboutMeStatus = document.getElementById("aboutMeStatus");

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
    "aboutMeText",
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
  if (stored.aboutMeText) aboutMeTextArea.value = stored.aboutMeText;
  renderResourceList(stored.resources || []);

  updateVisibleSection();
  initBackupSection();
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
    mirrorToBackupFolder("cv.json", cvJsonArea.value);
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
    mirrorToBackupFolder("cv.json", cvJsonArea.value);
    flash(cvStatus, "CV parsed and saved.");
  } catch (err) {
    flash(cvStatus, err.message, true);
  }
});

saveCvBtn.addEventListener("click", async () => {
  try {
    const cvData = JSON.parse(cvJsonArea.value);
    await chrome.storage.local.set({ cvData });
    mirrorToBackupFolder("cv.json", JSON.stringify(cvData, null, 2));
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
    mirrorToBackupFolder("cover-letter.txt", response.coverLetterText);
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
  mirrorToBackupFolder("cover-letter.txt", coverLetterText);
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

// ---- About me ----

saveAboutMeBtn.addEventListener("click", async () => {
  const aboutMeText = aboutMeTextArea.value.trim();
  await chrome.storage.local.set({ aboutMeText });
  mirrorToBackupFolder("about-me.txt", aboutMeText);
  flash(aboutMeStatus, "Saved.");
});

clearAboutMeBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("aboutMeText");
  aboutMeTextArea.value = "";
  flash(aboutMeStatus, "Cleared.");
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
    mirrorToBackupFolder("resources.json", JSON.stringify(resources, null, 2));

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
      mirrorToBackupFolder("resources.json", JSON.stringify(next, null, 2));
      renderResourceList(next);
    });

    item.appendChild(meta);
    item.appendChild(removeBtn);
    resourceListEl.appendChild(item);
  }
}

// ---- Backup folder mirror (Chrome only — File System Access API) ----
// Purely a best-effort copy of saved data as plain files, for the user's own
// backup/inspection. The extension always reads from chrome.storage.local,
// in every browser — this never becomes the source of truth.

const BACKUP_DB_NAME = "cv-autofill-backup";
const BACKUP_STORE = "handles";
const BACKUP_KEY = "folder";

const chooseBackupFolderBtn = document.getElementById("chooseBackupFolder");
const forgetBackupFolderBtn = document.getElementById("forgetBackupFolder");
const backupStatusEl = document.getElementById("backupStatus");
const backupIntroEl = document.getElementById("backupIntro");

function backupSupported() {
  return typeof window.showDirectoryPicker === "function";
}

function openBackupDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BACKUP_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(BACKUP_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(BACKUP_STORE, "readonly").objectStore(BACKUP_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    tx.objectStore(BACKUP_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    tx.objectStore(BACKUP_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function initBackupSection() {
  if (!backupSupported()) {
    chooseBackupFolderBtn.disabled = true;
    chooseBackupFolderBtn.title = "Only available in Chrome";
    backupIntroEl.textContent += " Not supported in this browser — Chrome only.";
    return;
  }
  try {
    const handle = await idbGet(BACKUP_KEY);
    if (handle) {
      forgetBackupFolderBtn.classList.remove("hidden");
      flash(backupStatusEl, `Backing up to "${handle.name}".`);
    }
  } catch {
    // no folder chosen yet — fine
  }
}

chooseBackupFolderBtn.addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await idbSet(BACKUP_KEY, handle);
    forgetBackupFolderBtn.classList.remove("hidden");
    flash(backupStatusEl, `Backing up to "${handle.name}". It'll fill in as you save things.`);
  } catch (err) {
    if (err.name !== "AbortError") flash(backupStatusEl, err.message, true);
  }
});

forgetBackupFolderBtn.addEventListener("click", async () => {
  await idbDelete(BACKUP_KEY);
  forgetBackupFolderBtn.classList.add("hidden");
  flash(backupStatusEl, "Backup folder forgotten.");
});

async function mirrorToBackupFolder(filename, content) {
  if (!backupSupported()) return;
  try {
    const dirHandle = await idbGet(BACKUP_KEY);
    if (!dirHandle) return;
    const perm = await dirHandle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return;
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content || "");
    await writable.close();
  } catch (err) {
    console.warn("Backup mirror failed:", err);
  }
}
