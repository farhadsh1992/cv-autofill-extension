const messagesWrapEl = document.querySelector(".messagesWrap");
const messagesEl = document.getElementById("messages");
const composerForm = document.getElementById("composerForm");
const questionArea = document.getElementById("question");
const askBtn = document.getElementById("ask");
const statusEl = document.getElementById("status");
const tasksBtn = document.getElementById("tasksBtn");
const tasksPanel = document.getElementById("tasksPanel");
const tasksPanelList = document.getElementById("tasksPanelList");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const attachmentChipEl = document.getElementById("attachmentChip");
const attachmentNameEl = document.getElementById("attachmentName");
const removeAttachmentBtn = document.getElementById("removeAttachmentBtn");

// In-memory only — a fresh chat each time this window opens, same lifetime
// as the old single-question version. {role: "user"|"ai", content} pairs,
// sent back on every turn so the AI can reference earlier messages; it has
// no server-side memory of its own between requests.
let messages = [];
let busy = false;
// The currently selected saved task (Options → Ask AI → Saved tasks), or
// null. Its prompt is attached to every message until cleared or swapped —
// that's the whole point (write it once, don't retype it).
let activePreset = null;
// A file staged for the *next* message. {name, text}. Also saved as a
// permanent About Me note the moment it's attached (see fileInput's change
// handler below) — so it's remembered for every future question (and every
// other AI task) without re-attaching it each time.
let pendingAttachment = null;

questionArea.focus();

// ---- Saved tasks (#) ----

tasksBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!tasksPanel.classList.contains("hidden")) {
    tasksPanel.classList.add("hidden");
    return;
  }
  const { askAIPresets = [] } = await chrome.storage.local.get("askAIPresets");
  renderTasksPanel(askAIPresets);
  tasksPanel.classList.remove("hidden");
});

document.addEventListener("click", (e) => {
  if (!tasksPanel.classList.contains("hidden") && !tasksPanel.contains(e.target) && e.target !== tasksBtn) {
    tasksPanel.classList.add("hidden");
  }
});

function renderTasksPanel(presets) {
  tasksPanelList.innerHTML = "";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "tasksPanelItem clearItem";
  clearBtn.textContent = "— No task (clear) —";
  clearBtn.addEventListener("click", () => selectPreset(null));
  tasksPanelList.appendChild(clearBtn);

  if (!presets.length) {
    const empty = document.createElement("div");
    empty.className = "tasksPanelEmpty";
    empty.textContent = "No saved tasks yet — add some in Options → Ask AI.";
    tasksPanelList.appendChild(empty);
    return;
  }

  for (const p of presets) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tasksPanelItem";
    btn.textContent = p.label || "Task";
    btn.addEventListener("click", () => selectPreset(p));
    tasksPanelList.appendChild(btn);
  }
}

function selectPreset(preset) {
  activePreset = preset;
  tasksPanel.classList.add("hidden");
  tasksBtn.classList.toggle("active", !!preset);
  renderActiveTaskChip();
  questionArea.focus();
}

function renderActiveTaskChip() {
  document.querySelector(".activeTaskChip")?.remove();
  if (!activePreset) return;
  const chip = document.createElement("div");
  chip.className = "activeTaskChip";
  const label = document.createElement("span");
  label.textContent = `#${activePreset.label || "Task"}`;
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "×";
  clearBtn.title = "Clear task";
  clearBtn.addEventListener("click", () => selectPreset(null));
  chip.appendChild(label);
  chip.appendChild(clearBtn);
  messagesWrapEl.appendChild(chip);
}

// ---- File attachment (paperclip) ----

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isDocxFile(file) {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  );
}

function isPdfFile(file) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

attachBtn.addEventListener("click", () => fileInput.click());

// Extracted text either way — PDFs need an AI call to read (no PDF parser
// in a browser extension sandbox), .docx is read locally via lib/docx.js,
// .txt is read as-is. This also means any provider can use the attachment
// afterward, not just document-capable ones.
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = ""; // so picking the same file again still fires "change"
  if (!file) return;

  try {
    let text;
    if (isPdfFile(file)) {
      setStatus("Extracting text with AI...");
      const base64 = await fileToBase64(file);
      const response = await chrome.runtime.sendMessage({ type: "EXTRACT_DOCUMENT_TEXT", base64 });
      if (response.error) throw new Error(response.error);
      text = response.text;
    } else if (isDocxFile(file)) {
      setStatus("Extracting text from .docx...");
      text = await extractDocxText(await fileToArrayBuffer(file));
    } else {
      text = await fileToText(file);
    }

    if (!text || !text.trim()) {
      setStatus("Couldn't find any text in that file.", true);
      return;
    }

    pendingAttachment = { name: file.name, text: text.trim() };
    await saveAttachmentAsNote(file.name, text.trim());
    setStatus("Attached — also saved to About Me, so future questions (and other tasks) can use it too.");
    renderAttachmentChip();
  } catch (err) {
    setStatus(`Couldn't read that file: ${err.message}`, true);
  }
});

// Persisted the moment a file is attached — not gated on actually sending
// the message — so "attach and forget" still remembers it. Same shape/
// storage key as Options → Info → About Me, so it shows up there too.
async function saveAttachmentAsNote(name, text) {
  const { aboutMeNotes = [] } = await chrome.storage.local.get("aboutMeNotes");
  aboutMeNotes.push({ id: crypto.randomUUID(), label: name, content: text, addedAt: Date.now() });
  await chrome.storage.local.set({ aboutMeNotes });
}

removeAttachmentBtn.addEventListener("click", () => {
  pendingAttachment = null;
  renderAttachmentChip();
});

function renderAttachmentChip() {
  attachBtn.classList.toggle("active", !!pendingAttachment);
  if (!pendingAttachment) {
    attachmentChipEl.classList.add("hidden");
    return;
  }
  attachmentNameEl.textContent = `📎 ${pendingAttachment.name}`;
  attachmentChipEl.classList.remove("hidden");
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
  makeCopyable(statusEl, text);
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Small explicit copy button next to AI answers — clicking anywhere on the
// bubble already copies it (makeCopyable), but that's not discoverable, so
// this gives it a visible affordance too.
function addCopyIcon(row, getText) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "copyIconBtn";
  btn.title = "Copy answer";
  btn.setAttribute("aria-label", "Copy answer");
  btn.textContent = "⧉";
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getText());
      btn.textContent = "✓";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "⧉";
        btn.classList.remove("copied");
      }, 1200);
    } catch {
      setStatus("Couldn't copy — select the text manually.", true);
    }
  });
  row.appendChild(btn);
}

function addBubble(role, text) {
  const row = document.createElement("div");
  row.className = `msgRow ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  if (role === "ai") addCopyIcon(row, () => bubble.textContent);
  messagesEl.appendChild(row);
  scrollToBottom();
  return bubble;
}

function addTypingBubble() {
  const row = document.createElement("div");
  row.className = "msgRow ai";
  row.id = "typingRow";
  const bubble = document.createElement("div");
  bubble.className = "bubble typingBubble";
  bubble.innerHTML = "<span></span><span></span><span></span>";
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function removeTypingBubble() {
  document.getElementById("typingRow")?.remove();
}

// Auto-grow up to the CSS max-height (100px), matching common chat inputs.
questionArea.addEventListener("input", () => {
  questionArea.style.height = "auto";
  questionArea.style.height = `${questionArea.scrollHeight}px`;
});

questionArea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composerForm.requestSubmit();
  }
});

composerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleAsk();
});

async function handleAsk() {
  const question = questionArea.value.trim();
  if ((!question && !pendingAttachment) || busy) return;

  busy = true;
  askBtn.disabled = true;
  setStatus("");

  const attachment = pendingAttachment;
  pendingAttachment = null;
  renderAttachmentChip();

  const displayText = attachment ? `📎 ${attachment.name}${question ? `\n${question}` : ""}` : question;
  addBubble("user", displayText);
  // Only a lightweight marker goes into history, not the extracted file
  // content — otherwise every later turn would resend it in full.
  messages.push({ role: "user", content: attachment ? `${question} [Attached: ${attachment.name}]` : question });
  questionArea.value = "";
  questionArea.style.height = "auto";
  addTypingBubble();

  try {
    const { cvData } = await chrome.storage.local.get("cvData");
    const response = await chrome.runtime.sendMessage({
      type: "ASK_LLM",
      cvData,
      question: question || `What can you tell me about the attached file, ${attachment?.name}?`,
      history: messages.slice(0, -1), // everything before this new question
      presetPrompt: activePreset?.prompt,
      attachedFileName: attachment?.name,
      attachedFileText: attachment?.text,
    });
    if (response.error) throw new Error(response.error);

    removeTypingBubble();
    const answer = response.answer || "(no answer)";
    const bubble = addBubble("ai", answer);
    makeCopyable(bubble, answer);
    messages.push({ role: "ai", content: answer });
  } catch (err) {
    removeTypingBubble();
    addBubble("error", err.message);
  } finally {
    busy = false;
    askBtn.disabled = false;
    questionArea.focus();
  }
}
