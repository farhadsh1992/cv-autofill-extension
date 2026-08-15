# Farhad's CV AutoFill

A Firefox/Safari/Orion WebExtension that parses your CV once, then auto-fills
job application forms — and writes tailored cover letters — using an LLM to
match your CV data (and your own past cover letter, as a style reference) to
whatever a given job site needs.

## Icon

A flat-vector mark in `#9E230B` — a CV document, a sync badge, a generic "TXT"
file badge, and a folder with an "F" monogram. `icons/icon-128.png` uses the
full composition; `icons/icon-16.png` / `icon-32.png` / `icon-48.png` use a
simplified variant (drops the TXT badge) since the full mark gets muddy at
toolbar sizes. Source SVGs and design iterations are in `icon-design/` —
`icon_final_hero.svg` / `icon_final_simple.svg` are the ones actually in use.

## How it works

1. **Upload your CV and (optionally) a past cover letter** from the
   extension's **Options** page — PDF, Word (.docx), or pasted text, for
   each. The CV is sent to your active AI provider (OpenAI, Anthropic/Claude,
   Kimi/Moonshot, or Gemini/Google — see below) and parsed into structured
   JSON (name, contact info, work history, education, skills); the cover
   letter is saved as reference text (only PDFs need an AI call to extract
   their text — .docx and pasted text are handled locally, no API call).
   Both are saved in the browser's local extension storage — nothing is
   uploaded anywhere else.
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
5. Or click **Generate tailored CV (Word)**. Same job-context scraping, but
   the model re-emphasizes/reorders your *real* CV content (summary, bullet
   points, skills) for that specific role — never invents new facts — and it
   downloads as an actual `.docx` file, built locally (no external library).
   If your uploaded CV was a `.docx` with a photo and an accent color, both
   get pulled out automatically (Options → Your CV shows a preview) and
   reused in the generated file, instead of a plain black-and-white template.
6. **Add info** (popup button) pops open a small window to jot down anything
   else worth the AI knowing — saved as a resource, same as CV/cover letter.
7. **Ask AI directly** (popup button) opens a small Q&A window for when
   autofill couldn't confidently answer something — it uses your saved CV
   and resources as context and gives you a direct answer to copy in
   yourself.
8. **Options → About me / notes**: add as many labeled notes as you want —
   availability, preferences, anything not in your CV — or upload a PDF,
   Word (.docx), or .txt file (a diploma, certificate, reference letter) and
   its text is extracted and saved as a labeled note the same way. **Options
   → Addresses**: add labeled physical addresses (home, mailing, whatever
   applies) used to fill address-shaped form fields. **Options → Resources**:
   add links to your own websites (portfolio, GitHub, personal site) — their
   text is fetched once (you approve access per-site) and saved as extra
   context. All of this feeds into autofill, cover letters, tailored CVs, and
   Ask AI answers.

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
- Fetching a resource website requires your explicit one-time permission
  grant for that specific site (via the browser's own permission prompt) —
  it's never fetched silently, and only the sites you add are ever touched.

## Setup

**Options → AI provider** lets you add a key for as many of the four
supported providers as you want — they're all kept ready to use — then pick
which one is **active** with the "Currently using" dropdown. Switch anytime
without re-entering anything.

- OpenAI: https://platform.openai.com/api-keys (`gpt-4o-mini` is the default model)
- Anthropic: https://console.anthropic.com/settings/keys (`claude-sonnet-5` is the default model)
- Kimi (Moonshot): https://platform.moonshot.ai/console/api-keys (`kimi-k2.5` is the default model)
- Gemini (Google): https://aistudio.google.com/apikey (`gemini-3.5-flash` is the default model)

Each needs a real API key from that provider's own developer console, billed
per call — none of them offer a public "log in with your consumer chat
account" flow for third-party extensions like this one, so there's no way to
reuse a ChatGPT Plus / Claude Pro / Gemini Advanced subscription here.

**Kimi doesn't support reading uploaded PDF files** (its API only documents
a separate file-upload endpoint, not inline PDFs in a chat message) — CV,
cover letter, and About-Me PDF uploads need OpenAI, Anthropic, or Gemini
active instead. Everything else (autofill, cover letter writing, CV
tailoring, Ask AI) works with any of the four.

### Estimated spend

The top of Options shows a running total, estimated from each model's
published price per token and updated after every AI call. This is a
best-effort estimate for your own awareness, not a real invoice — check
each provider's own billing dashboard for what you're actually charged.
"Reset counter" zeroes it out (e.g. after checking your real bill).

### Backup

Options → Backup has **Export backup** and **Import backup**. Export
downloads a single JSON file with everything: CV, cover letter, About Me
notes, addresses, resources, CV style, and your saved API keys for all four
providers — enough to fully restore the extension after a reinstall or on a
new browser via Import. **This file contains your API keys in plain text —
keep it somewhere private and never commit it to a Git repo or share it.**
To "update" a backup, just export again over the same file/location.

(An earlier version of this tried to let you pick a folder to auto-mirror
into on every save, using the File System Access API — that's confirmed
broken specifically inside browser extension pages regardless of any
permission grant, [not just on this Mac](https://issues.chromium.org/issues/40240444).
It's also Chromium-only, so it wouldn't have worked in Firefox/Safari either.
Plain Export/Import via the browser's normal file dialogs works reliably
everywhere this extension runs, so that's what's here instead.) The
extension always reads from its own internal storage either way — a backup
file is just a snapshot, never the source of truth.

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
xcrun safari-web-extension-converter [path of app]
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
manifest.json           Manifest V3 config
background.js           Service worker — calls OpenAI/Anthropic/Kimi/Gemini APIs, tracks estimated spend
shared/blocklist.js     Sensitive-field keyword filter, shared by background + popup
lib/docx.js             Standalone .docx → plain text/style extractor (no external library)
lib/pdf-writer.js       Standalone plain text → PDF writer (no external library)
lib/docx-writer.js      Standalone plain data → .docx writer, with optional photo/color (no external library)
popup/                  Toolbar popup UI — autofill, cover letter, tailored CV, add info, ask AI
options/                Provider/API key/model settings, spend estimate, CV/cover letter upload,
                        about me, addresses, resources, export/import backup
windows/                Small popup windows opened from the toolbar popup ("Add info", "Ask AI directly")
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
- The generated tailored CV `.docx` is a clean, simple, single-style layout —
  it does not try to reproduce the exact visual formatting of whatever CV
  file you originally uploaded (fonts, tables, multi-column layouts). It's a
  content rewrite, not a template clone. The one exception: if the source
  was a `.docx` with an embedded photo and/or a theme accent color, those
  two specific things get carried over — nothing else about the layout.
- Photo/color extraction only works for `.docx` uploads, not PDF — PDFs
  don't expose an embedded image or theme color the same structured way,
  and there's no local PDF-rendering capability in the extension to work
  around that. Uploading as `.docx` is the way to get this.
- Resource website fetching is a plain `fetch()` + HTML-to-text pass — pages
  that require login (most of LinkedIn, for instance) or render their content
  via client-side JavaScript will often come back mostly empty. Static pages
  (a personal site, a GitHub profile README) work well.

## License

[MIT](LICENSE)
