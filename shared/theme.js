// Applies a manual light/dark override and/or a custom accent color as
// inline CSS custom properties, so every page (popup, options, the small
// windows) stays consistent. With no override saved, this is a no-op and
// pages fall back to their normal `prefers-color-scheme` CSS.

const THEME_PALETTES = {
  light: {
    bg: "#ffffff",
    fg: "#1c1c1e",
    muted: "#666666",
    border: "#cccccc",
    panel: "#f5f5f7",
    "panel-hover": "#ececef",
    accent: "#0a84ff",
    "accent-hover": "#0071e3",
    danger: "#d70015",
    success: "#2a8f3f",
    "textarea-bg": "#ffffff",
    "code-bg": "#f5f5f7",
    "disabled-bg": "#c7c7cc",
  },
  dark: {
    bg: "#1c1c1e",
    fg: "#f2f2f7",
    muted: "#9a9a9e",
    border: "#48484a",
    panel: "#2c2c2e",
    "panel-hover": "#3a3a3c",
    accent: "#0a84ff",
    "accent-hover": "#409cff",
    danger: "#ff453a",
    success: "#32d74b",
    "textarea-bg": "#2c2c2e",
    "code-bg": "#2c2c2e",
    "disabled-bg": "#48484a",
  },
};

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

// Shifts a hex color toward black (amount < 0) or white (amount > 0), for a hover shade.
function shadeColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}

async function applyTheme() {
  const { theme = "system", accentColor = "", saveJobColor = "" } = await chrome.storage.local.get([
    "theme",
    "accentColor",
    "saveJobColor",
  ]);
  const root = document.documentElement.style;
  const varNames = Object.keys(THEME_PALETTES.light);

  if (theme === "light" || theme === "dark") {
    const palette = THEME_PALETTES[theme];
    for (const name of varNames) root.setProperty(`--${name}`, palette[name]);
  } else {
    for (const name of varNames) root.removeProperty(`--${name}`);
  }

  if (accentColor) {
    root.setProperty("--accent", accentColor);
    root.setProperty("--accent-hover", shadeColor(accentColor, -28));
  } else if (theme !== "light" && theme !== "dark") {
    root.removeProperty("--accent");
    root.removeProperty("--accent-hover");
  }

  // Independent of --accent — the "Save this job" button has its own color,
  // defaulting to green (set in popup.css) rather than following the theme.
  if (saveJobColor) {
    root.setProperty("--save-job-bg", saveJobColor);
    root.setProperty("--save-job-bg-hover", shadeColor(saveJobColor, -28));
  } else {
    root.removeProperty("--save-job-bg");
    root.removeProperty("--save-job-bg-hover");
  }
}

applyTheme();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.theme || changes.accentColor || changes.saveJobColor)) applyTheme();
});
