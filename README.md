# Farhad's CV AutoFill

A Firefox/Safari/Orion WebExtension that parses your CV once, then auto-fills
job application forms — and writes tailored cover letters — using an LLM to
match your CV data (and your own past cover letter, as a style reference) to
whatever a given job site needs.

## How it works

1. **Upload your CV and (optionally) a past cover letter** from the
   extension's **Options** page — PDF, Word (.docx), or pasted text, for
   each. The CV is sent to your chosen AI provider (OpenAI or
   Anthropic/Claude) and parsed into structured JSON (name, contact info,
   work history, education, skills); the cover letter is saved as reference
   text (only PDFs need an AI call to extract their text — .docx and pasted
   text are handled locally, no API call). Both are saved in the browser's
   local extension storage — nothing is uploaded anywhere else.
2. On any job application page, click **Autofill this page**. The extension
   scans visible text/textarea/select fields, sends their labels (plus your
   CV data) to the same provider, and asks it to propose values.
3. Matched fields are filled in on the page. **The extension never clicks
   Submit** — always review what got filled before you send the application.
4. Or click **Generate cover letter for this page**. The extension scrapes
   the job posting's title/description off the current page, and asks the
   model to write a new letter grounded in your CV data, in the voice of your
   saved reference letter (never copied verbatim). The draft appears in the
   popup, editable, with **Copy**, **Download PDF** (generated locally in the
   browser — no server involved), and — if a matching "cover letter" field is
   found on the page — **Insert into page field**.

### What it deliberately won't touch

- Password fields, file-upload inputs, checkboxes/radios (ambiguous to
  auto-map safely), and hidden/disabled fields.
- Demographic/EEO self-identification questions (gender, race, ethnicity,
  veteran status, disability status, sexual orientation) — these are always
  skipped in code, even if the model suggests something, so you answer them
  yourself.
- Government ID numbers, payment details, and anything that looks like a
  password field, enforced the same way.
- The generated cover letter is never auto-inserted without you clicking
  "Insert" yourself, and it's never submitted for you either way.

## Setup

Choose OpenAI or Anthropic (Claude) as your provider in **Options**, then
paste in an API key for that provider:

- OpenAI: https://platform.openai.com/api-keys (`gpt-4o-mini` is the default model)
- Anthropic: https://console.anthropic.com/settings/keys (`claude-sonnet-5` is the default model)

Note this needs a real API key from the provider's developer console, billed
per call — neither OpenAI nor Anthropic offer a public "log in with your
ChatGPT/Claude.ai account" flow for third-party extensions like this one, so
there's no way to reuse a ChatGPT Plus or Claude Pro subscription here.

## Load it in Firefox (development / personal use)

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` inside this folder.
4. The extension icon appears in the toolbar. It stays loaded until you
   restart Firefox (temporary add-ons don't persist across restarts). For a
   permanent install you'd need to sign it via
   [addons.mozilla.org](https://addons.mozilla.org) (self-distribution
   signing is free, even unlisted).

## Load it in Safari (macOS)

Safari can't load a raw WebExtension folder directly — Apple requires
WebExtensions to be wrapped in a native app/Xcode project. Apple provides a
converter for exactly this:

```bash
xcrun safari-web-extension-converter /Users/farhad/Documents/VisTeamPro/Programming11/Learning_AI_Agents/agents2/cv_autofill_extension
```

This generates an Xcode project wrapping the extension. Then:

1. Open the generated `.xcodeproj` in Xcode.
2. Build and run it (▶) — this installs a small host app plus the Safari
   extension.
3. In Safari, go to **Settings → Extensions**, enable "Farhad's CV AutoFill".
4. You may also need **Settings → Advanced → Show features for web
   developers**, then **Developer → Allow Unsigned Extensions**, since this
   isn't notarized/App-Store-signed.

You'll need Xcode installed and a free Apple ID for local signing (no paid
Developer Program needed just to run it locally on your own Mac). To
actually distribute it to other people via the App Store, you'd need a paid
Apple Developer account and to go through App Review.

## Load it in Orion (macOS)

Orion (Kagi's browser) can load an unpacked WebExtension folder directly —
no Xcode conversion needed. Open **Settings → Extensions**, use its
install-from-folder option (may be behind a developer-mode toggle), and
point it at this folder. See [INSTALL.txt](INSTALL.txt) for more detail.

## Files

```
manifest.json           Manifest V3 config (permissions: storage, activeTab, scripting, downloads)
background.js           Service worker — calls OpenAI Responses API or Anthropic Messages API
shared/blocklist.js     Sensitive-field keyword filter, shared by background + popup
lib/docx.js             Standalone .docx → plain text extractor (no external library)
lib/pdf-writer.js       Standalone plain text → PDF writer (no external library)
popup/                  Toolbar popup UI — "Autofill this page" + "Generate cover letter"
options/                Provider/API key/model settings, CV upload, cover letter upload
```

Both `popup/` and `options/` follow the OS/browser color scheme automatically
(`prefers-color-scheme`, with an explicit `color-scheme: light dark` so
Chromium doesn't apply its own forced-dark heuristics on top).

## Limitations

- Free-text "Why do you want to work here?"-style answers (in Autofill) and
  the generated cover letter are both grounded in your CV data, but read
  them before submitting — they can still be generic if your CV or the job
  page doesn't give the model much to work with.
- Field-upload buttons (attach your resume as a file) can't be filled
  programmatically for security reasons in all browsers — you'll still
  attach your CV file yourself.
- Very unusual form markup (heavy custom JS widgets, shadow DOM, iframes)
  may not be detected by the field scanner.
- The `.docx` text extractor is a minimal, dependency-free implementation —
  it handles standard Word/Google Docs/LibreOffice output well, but complex
  layouts (tables, text boxes, multi-column) may lose some structure. If
  extraction looks wrong, paste the text instead.
