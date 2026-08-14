// Makes any status/result text element click-to-copy. Called after setting
// an element's text, so users can grab error messages, generated content,
// or summaries without fiddling with drag-selection in a small popup.
function makeCopyable(el, text) {
  el.onclick = null;
  el.style.cursor = "";
  el.title = "";
  if (!text) return;

  el.style.cursor = "pointer";
  el.title = "Click to copy";
  el.onclick = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const original = el.textContent;
        el.textContent = "Copied!";
        setTimeout(() => {
          el.textContent = original;
        }, 1200);
      })
      .catch(() => {});
  };
}

if (typeof self !== "undefined") self.makeCopyable = makeCopyable;
