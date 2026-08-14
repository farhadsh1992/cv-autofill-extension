const questionArea = document.getElementById("question");
const askBtn = document.getElementById("ask");
const answerBox = document.getElementById("answerBox");
const copyBtn = document.getElementById("copyBtn");
const statusEl = document.getElementById("status");

questionArea.focus();

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

askBtn.addEventListener("click", handleAsk);
questionArea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk();
});

async function handleAsk() {
  const question = questionArea.value.trim();
  if (!question) {
    setStatus("Type a question first.", true);
    return;
  }

  askBtn.disabled = true;
  answerBox.classList.add("hidden");
  copyBtn.classList.add("hidden");
  setStatus("Asking...");

  try {
    const { cvData } = await chrome.storage.local.get("cvData");
    const response = await chrome.runtime.sendMessage({ type: "ASK_LLM", cvData, question });
    if (response.error) throw new Error(response.error);

    answerBox.textContent = response.answer || "(no answer)";
    answerBox.classList.remove("hidden");
    copyBtn.classList.remove("hidden");
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    askBtn.disabled = false;
  }
}

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(answerBox.textContent);
    setStatus("Copied.");
  } catch {
    setStatus("Couldn't copy — select the text manually.", true);
  }
});
