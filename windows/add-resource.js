const labelInput = document.getElementById("label");
const contentArea = document.getElementById("content");
const saveBtn = document.getElementById("save");
const cancelBtn = document.getElementById("cancel");
const statusEl = document.getElementById("status");

contentArea.focus();

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
  makeCopyable(statusEl, text);
}

cancelBtn.addEventListener("click", () => window.close());

saveBtn.addEventListener("click", async () => {
  const content = contentArea.value.trim();
  if (!content) {
    setStatus("Write something first.", true);
    return;
  }

  saveBtn.disabled = true;
  try {
    const { resources = [] } = await chrome.storage.local.get("resources");
    resources.push({
      id: crypto.randomUUID(),
      label: labelInput.value.trim() || "Quick note",
      content,
      addedAt: Date.now(),
    });
    await chrome.storage.local.set({ resources });
    setStatus("Saved.");
    setTimeout(() => window.close(), 700);
  } catch (err) {
    setStatus(err.message, true);
    saveBtn.disabled = false;
  }
});
