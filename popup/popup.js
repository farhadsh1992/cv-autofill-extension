const openOptionsBtn = document.getElementById("openOptions");
const loadedSummaryEl = document.getElementById("loadedSummary");
const autofillBtn = document.getElementById("autofillBtn");
const generateBtn = document.getElementById("generateBtn");
const coverLetterResult = document.getElementById("coverLetterResult");
const coverLetterOutput = document.getElementById("coverLetterOutput");
const copyBtn = document.getElementById("copyBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const downloadCoverLetterDocxBtn = document.getElementById("downloadCoverLetterDocxBtn");
const insertBtn = document.getElementById("insertBtn");
const generateCvDocxBtn = document.getElementById("generateCvDocxBtn");
const addInfoBtn = document.getElementById("addInfoBtn");
const askBtn = document.getElementById("askBtn");
const saveJobBtn = document.getElementById("saveJobBtn");
const statusEl = document.getElementById("status");

openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

// chrome.downloads.download() needs a URL that outlives this popup. A
// blob: URL is scoped to this document — when saveAs:true opens a native
// Save dialog, the popup loses focus and MV3 closes it immediately, which
// invalidates the blob before the download can read it (a well-known
// Chrome extension gotcha). A data: URL is a self-contained string with no
// such dependency, so it survives the popup closing.
function bytesToDataUrl(bytes, mimeType) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

init();

async function init() {
  const { cvData, coverLetterText } = await chrome.storage.local.get(["cvData", "coverLetterText"]);
  renderSummary(cvData, coverLetterText);
}

function renderSummary(cvData, coverLetterText) {
  const lines = [];
  if (cvData) {
    const parts = [cvData.full_name, cvData.email].filter(Boolean);
    lines.push(`CV: ${parts.length ? parts.join(" · ") : "loaded"}`);
  } else {
    lines.push("CV: not loaded — add one in Options");
  }
  lines.push(coverLetterText ? "Cover letter: saved" : "Cover letter: none saved (optional)");
  const summaryText = lines.join("  ·  ");
  loadedSummaryEl.textContent = summaryText;
  makeCopyable(loadedSummaryEl, summaryText);

  autofillBtn.disabled = !cvData;
  generateBtn.disabled = !cvData;
  generateCvDocxBtn.disabled = !cvData;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
  makeCopyable(statusEl, text);
}

autofillBtn.addEventListener("click", handleAutofill);
generateBtn.addEventListener("click", handleGenerateCoverLetter);
copyBtn.addEventListener("click", handleCopy);
downloadPdfBtn.addEventListener("click", handleDownloadPdf);
downloadCoverLetterDocxBtn.addEventListener("click", handleDownloadCoverLetterDocx);
insertBtn.addEventListener("click", handleInsert);
generateCvDocxBtn.addEventListener("click", handleGenerateCvDocx);
addInfoBtn.addEventListener("click", () => {
  chrome.windows.create({ url: chrome.runtime.getURL("windows/add-resource.html"), type: "popup", width: 420, height: 460, focused: true });
});
// Computed here (not in background.js) because a service worker has no
// `window`/`screen` object — this popup page does, since it's a real
// document. Reflects whichever display the popup itself opened on.
function askWindowBounds(position) {
  const width = 400;
  const height = 620;
  const margin = 20;
  const availW = window.screen.availWidth;
  const availH = window.screen.availHeight;
  switch (position) {
    case "top-left":
      return { left: margin, top: margin, width, height };
    case "top-right":
      return { left: Math.max(0, availW - width - margin), top: margin, width, height };
    case "bottom-left":
      return { left: margin, top: Math.max(0, availH - height - margin), width, height };
    case "bottom-right":
      return { left: Math.max(0, availW - width - margin), top: Math.max(0, availH - height - margin), width, height };
    case "center":
    default:
      return { left: Math.max(0, Math.round((availW - width) / 2)), top: Math.max(0, Math.round((availH - height) / 2)), width, height };
  }
}

askBtn.addEventListener("click", async () => {
  const { askWindowPosition = "center" } = await chrome.storage.local.get("askWindowPosition");
  const bounds = askWindowBounds(askWindowPosition);
  chrome.windows.create({ url: chrome.runtime.getURL("windows/ask.html"), type: "popup", focused: true, ...bounds });
});
saveJobBtn.addEventListener("click", handleSaveJob);

async function handleAutofill() {
  autofillBtn.disabled = true;
  try {
    setStatus("Scanning form fields on this page...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: fields }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanFormsInPage,
    });

    if (!fields || !fields.length) {
      setStatus("No fillable form fields found on this page.");
      return;
    }

    const { cvData } = await chrome.storage.local.get("cvData");
    if (!cvData) {
      setStatus("Upload your CV first.", true);
      return;
    }

    setStatus(`Found ${fields.length} field(s). Asking AI to match them to your CV...`);
    const response = await chrome.runtime.sendMessage({ type: "MAP_FIELDS", fields, cvData });
    if (response.error) throw new Error(response.error);

    const fieldByIndex = new Map(fields.map((f) => [f.index, f]));
    const answers = (response.answers || []).filter((a) => {
      const field = fieldByIndex.get(a.index);
      return field && !isSensitiveField(field.label);
    });

    if (!answers.length) {
      setStatus("AI couldn't confidently match any fields. Fill the rest manually.");
      return;
    }

    const [{ result: filledCount }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillFormsInPage,
      args: [answers],
    });

    const skipped = fields.length - filledCount;
    setStatus(
      `Filled ${filledCount} field(s).${skipped > 0 ? ` ${skipped} left for you to complete.` : ""} Review everything before you submit.`
    );
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    autofillBtn.disabled = false;
  }
}

async function handleGenerateCoverLetter() {
  generateBtn.disabled = true;
  coverLetterResult.classList.add("hidden");
  insertBtn.classList.add("hidden");
  try {
    const { cvData, coverLetterText } = await chrome.storage.local.get(["cvData", "coverLetterText"]);
    if (!cvData) {
      setStatus("Upload your CV first.", true);
      return;
    }

    setStatus("Reading this page for job context...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: scraped }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobContextInPage,
    });
    const jobContext = [scraped.title, scraped.metaDesc, scraped.bodyText].filter(Boolean).join("\n\n").slice(0, 6000);

    setStatus("Writing a tailored cover letter...");
    const response = await chrome.runtime.sendMessage({
      type: "GENERATE_COVER_LETTER",
      cvData,
      coverLetterText,
      jobContext,
    });
    if (response.error) throw new Error(response.error);

    coverLetterOutput.value = response.coverLetter;
    coverLetterResult.classList.remove("hidden");

    const [{ result: fieldMatch }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: findCoverLetterFieldInPage,
    });
    if (fieldMatch.found) {
      insertBtn.textContent = `Insert into "${fieldMatch.label}"`;
      insertBtn.classList.remove("hidden");
    }

    setStatus("Draft ready — review and edit before using it.");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    generateBtn.disabled = false;
  }
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(coverLetterOutput.value);
    setStatus("Copied to clipboard.");
  } catch {
    coverLetterOutput.select();
    document.execCommand("copy");
    setStatus("Copied to clipboard.");
  }
}

async function handleInsert() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: ok }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertCoverLetterInPage,
      args: [coverLetterOutput.value],
    });
    setStatus(ok ? "Inserted into the page. Review before submitting." : "Couldn't find that field anymore — copy/paste instead.", !ok);
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function handleDownloadPdf() {
  try {
    const { cvData } = await chrome.storage.local.get("cvData");
    const bytes = generateCoverLetterPdf(coverLetterOutput.value);
    const url = bytesToDataUrl(bytes, "application/pdf");

    const namePart = (cvData && cvData.full_name ? cvData.full_name : "cover-letter")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");
    const filename = `${namePart || "cover-letter"}_Cover_Letter.pdf`;

    await chrome.downloads.download({ url, filename, saveAs: true });
    setStatus("Cover letter downloaded as PDF.");
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function handleDownloadCoverLetterDocx() {
  try {
    const { cvData } = await chrome.storage.local.get("cvData");
    const bytes = generateCoverLetterDocx(coverLetterOutput.value);
    const url = bytesToDataUrl(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    const namePart = (cvData && cvData.full_name ? cvData.full_name : "cover-letter")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");
    const filename = `${namePart || "cover-letter"}_Cover_Letter.docx`;

    await chrome.downloads.download({ url, filename, saveAs: true });
    setStatus("Cover letter downloaded as a Word document.");
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function handleGenerateCvDocx() {
  generateCvDocxBtn.disabled = true;
  try {
    const { cvData, cvStyle } = await chrome.storage.local.get(["cvData", "cvStyle"]);
    if (!cvData) {
      setStatus("Upload your CV first.", true);
      return;
    }

    setStatus("Reading this page for job context...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: scraped }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobContextInPage,
    });
    const jobContext = [scraped.title, scraped.metaDesc, scraped.bodyText].filter(Boolean).join("\n\n").slice(0, 6000);

    setStatus("Tailoring your CV for this job...");
    const response = await chrome.runtime.sendMessage({ type: "GENERATE_CV_DOCX", cvData, jobContext });
    if (response.error) throw new Error(response.error);

    const bytes = generateCvDocx(response.tailoredCv, cvStyle);
    const url = bytesToDataUrl(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    const namePart = (response.tailoredCv && response.tailoredCv.full_name ? response.tailoredCv.full_name : "CV")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");
    const filename = `${namePart || "CV"}_Tailored_CV.docx`;

    await chrome.downloads.download({ url, filename, saveAs: true });
    setStatus("Tailored CV downloaded as a Word document. Review it before sending.");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    generateCvDocxBtn.disabled = false;
  }
}

// Extraction, storage, and the actual downloads all happen in the
// background service worker (not here), so the save still completes even
// if this popup closes mid-flight (e.g. the user clicks away) before the
// response comes back.
async function handleSaveJob() {
  saveJobBtn.disabled = true;
  try {
    setStatus("Reading this page for job details...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: scraped }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobContextInPage,
    });
    const jobContext = [scraped.title, scraped.metaDesc, scraped.bodyText].filter(Boolean).join("\n\n").slice(0, 6000);

    setStatus("Extracting job details and saving...");
    chrome.runtime.sendMessage({ type: "SAVE_JOB", jobContext, url: tab.url || "" }).then((response) => {
      if (response && !response.error) {
        setStatus(`Saved "${response.job.title || "this job"}".`);
      } else if (response && response.error) {
        setStatus(response.error, true);
      }
    });
    // Intentionally not awaited above — see the doc comment for why.
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    saveJobBtn.disabled = false;
  }
}

// ---- Functions below are injected into the target page via chrome.scripting.executeScript. ----
// They must be fully self-contained (no references to variables outside their own body).

function scanFormsInPage() {
  function getLabelText(el) {
    if (el.labels && el.labels.length) {
      return Array.from(el.labels)
        .map((l) => l.innerText)
        .join(" ")
        .trim();
    }
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim();
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy) {
      const d = document.getElementById(describedBy);
      if (d && d.innerText) return d.innerText.trim();
    }
    const closestLabel = el.closest("label");
    if (closestLabel) return closestLabel.innerText.trim();
    const container = el.closest("div, fieldset, li, tr, p");
    if (container) {
      const labelEl = container.querySelector("label, legend, .label");
      if (labelEl && labelEl !== el) return labelEl.innerText.trim();
    }
    if (el.placeholder) return el.placeholder.trim();
    return el.name || el.id || "";
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  const SKIP_TYPES = new Set(["hidden", "password", "file", "submit", "button", "image", "reset", "checkbox", "radio"]);

  const elements = Array.from(document.querySelectorAll("input, textarea, select")).filter((el) => {
    if (el.disabled || el.readOnly) return false;
    if (SKIP_TYPES.has((el.type || "").toLowerCase())) return false;
    return isVisible(el);
  });

  elements.forEach((el, i) => el.setAttribute("data-cv-autofill-idx", String(i)));

  return elements.map((el, i) => ({
    index: i,
    tag: el.tagName.toLowerCase(),
    type: el.type || "text",
    name: el.name || "",
    id: el.id || "",
    label: getLabelText(el),
    options: el.tagName.toLowerCase() === "select" ? Array.from(el.options).map((o) => o.text.trim()) : undefined,
  }));
}

function fillFormsInPage(answers) {
  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) {
      desc.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  let filled = 0;
  for (const { index, value } of answers) {
    const el = document.querySelector(`[data-cv-autofill-idx="${index}"]`);
    if (!el || value == null || String(value).trim() === "") continue;

    if (el.tagName.toLowerCase() === "select") {
      const opt = Array.from(el.options).find((o) => o.text.trim() === value || o.value === value);
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filled++;
      }
      continue;
    }

    setNativeValue(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    filled++;
  }
  return filled;
}

function scrapeJobContextInPage() {
  const title = document.title || "";
  const metaDesc =
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content ||
    "";
  const bodyText = document.body ? document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 4000) : "";
  return { title, metaDesc, bodyText };
}

function findCoverLetterFieldInPage() {
  const KEY_RE = /(cover letter|motivation letter|letter of interest|why (do you want|are you interested)|additional information)/i;

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function labelFor(el) {
    if (el.labels && el.labels.length) {
      return Array.from(el.labels)
        .map((l) => l.innerText)
        .join(" ")
        .trim();
    }
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim();
    const closestLabel = el.closest("label");
    if (closestLabel) return closestLabel.innerText.trim();
    const container = el.closest("div, fieldset, li, tr, p");
    if (container) {
      const labelEl = container.querySelector("label, legend, .label");
      if (labelEl && labelEl !== el) return labelEl.innerText.trim();
    }
    return el.placeholder || el.name || el.id || "";
  }

  const candidates = Array.from(document.querySelectorAll("textarea")).filter(
    (el) => !el.disabled && !el.readOnly && isVisible(el)
  );

  for (const el of candidates) {
    const label = labelFor(el);
    if (KEY_RE.test(label)) {
      el.setAttribute("data-cv-autofill-coverletter", "1");
      return { found: true, label: label.slice(0, 60) };
    }
  }
  return { found: false };
}

function insertCoverLetterInPage(text) {
  const el = document.querySelector('[data-cv-autofill-coverletter="1"]');
  if (!el) return false;
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc && desc.set) {
    desc.set.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
  return true;
}
