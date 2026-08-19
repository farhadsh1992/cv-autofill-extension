// Shared model catalog — one source of truth for both background.js
// (importScripts) and options.js (<script> tag), so the "Model per action"
// pickers can populate a model dropdown for whichever provider they point
// at without duplicating the same option lists per call site.
const MODEL_CATALOG = {
  openai: [
    { value: "gpt-4o-mini", label: "gpt-4o-mini (fastest/cheapest)" },
    { value: "gpt-4o", label: "gpt-4o" },
    { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
    { value: "gpt-4.1", label: "gpt-4.1" },
    { value: "gpt-5.6-sol", label: "gpt-5.6-sol (flagship)" },
    { value: "gpt-5.6-terra", label: "gpt-5.6-terra (balanced)" },
    { value: "gpt-5.6-luna", label: "gpt-5.6-luna (fast/cheap)" },
  ],
  anthropic: [
    { value: "claude-sonnet-5", label: "claude-sonnet-5 (balanced)" },
    { value: "claude-opus-5", label: "claude-opus-5 (most capable)" },
    { value: "claude-haiku-4-5-20251001", label: "claude-haiku-4-5 (fastest/cheapest)" },
  ],
  kimi: [
    { value: "kimi-k2.5", label: "kimi-k2.5 (cheapest)" },
    { value: "kimi-k3", label: "kimi-k3 (most capable)" },
  ],
  gemini: [
    { value: "gemini-3.5-flash", label: "gemini-3.5-flash (fastest/cheapest)" },
    { value: "gemini-3.1-pro", label: "gemini-3.1-pro (most capable)" },
  ],
  deepseek: [
    { value: "deepseek-v4-flash", label: "deepseek-v4-flash (fastest/cheapest)" },
    { value: "deepseek-v4-pro", label: "deepseek-v4-pro-0813 (most capable)" },
  ],
  // Aliases the claude CLI's --model flag accepts; "default" omits the flag
  // entirely and lets the CLI pick its own default model.
  claudeCode: [
    { value: "default", label: "Default (whatever the CLI picks)" },
    { value: "sonnet", label: "Sonnet" },
    { value: "opus", label: "Opus" },
    { value: "haiku", label: "Haiku" },
    { value: "fable", label: "Fable" },
  ],
  // codex's model aliases weren't independently verified against a live
  // install — "default" (omit -m, let codex's own config decide) is the
  // only option offered to avoid guessing wrong model names into the picker.
  openaiCode: [{ value: "default", label: "Default (whatever the CLI picks)" }],
};
