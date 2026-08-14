# Chrome Web Store listing draft

Use this when filling out the Developer Dashboard form at
https://chrome.google.com/webstore/devconsole (requires your own $5
one-time registration fee, paid by you — I can't do this step).

## Package to upload

`dist/farhads-cv-autofill-chrome.zip` — rebuild it any time with:

```bash
cd cv_autofill_extension
rm -f dist/farhads-cv-autofill-chrome.zip
zip -r dist/farhads-cv-autofill-chrome.zip . -x "icon.png" -x "dist/*" -x "*.DS_Store" -x "INSTALL.txt" -x "README.md"
```

## Listing name

Farhad's CV AutoFill

## Short description (132 char max)

Upload your CV once, then auto-fill job applications and draft tailored cover letters with AI. Review everything before you submit.

## Detailed description

Farhad's CV AutoFill parses your CV once (PDF, Word, or pasted text) into
structured data, stored only in your browser. On any job application page it
can:

- Scan the form and fill in fields it can confidently match to your CV —
  never demographic/EEO questions, never passwords or payment fields, and
  it never clicks Submit for you.
- Generate a new cover letter tailored to that specific posting, grounded in
  your CV and written in the voice of a past cover letter you provide as a
  style reference (never copied verbatim).

You bring your own OpenAI or Anthropic (Claude) API key — billed to your own
account, nothing routes through any third-party server. Full source is
available on GitHub: https://github.com/farhadsh1992/cv-autofill-extension

## Category

Productivity

## Privacy practices tab (required disclosure)

Chrome Web Store requires you to declare what data the extension handles.
Answer honestly along these lines:

- **Personally identifiable information**: Yes — the CV/cover letter you
  upload (name, contact info, work history) is processed to power the
  extension's core function.
- **Where it goes**: Only to the AI provider you configure (OpenAI or
  Anthropic), directly from your browser, using your own API key. Nothing is
  sent to any server operated by the extension's developer — there isn't
  one; this is a static client-side extension.
- **Where it's stored**: `chrome.storage.local` on your own device only. Not
  synced, not transmitted anywhere else.
- **Certify**: check the box confirming the listing doesn't sell user data
  and limits use to the disclosed purposes — true here, since nothing is
  collected by any developer-operated backend.

## Screenshots

The store requires at least one 1280x800 or 640x400 screenshot. Take one of
the popup and one of the Options page — none exist yet; capture them from a
loaded copy of the extension (`chrome://extensions` → load unpacked →
click the icon / open Options → screenshot).

## Notes

- Chrome requires the developer account be verified (email + $5 fee) before
  you can publish. New listings also go through Google's review, which can
  take from hours to a few days.
- If you'd rather not publish it publicly, the dashboard also supports
  **Unlisted** (link-only, not searchable) or **Private** (specific Google
  accounts only) visibility — both skip the public review queue's stricter
  scrutiny somewhat and are good options for a personal tool.
