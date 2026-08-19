// Default (built-in) instruction text for each AI task. Loaded by both
// background.js (service worker, via importScripts) and options.js (Options
// page, via <script>) so each task's default text lives in exactly one
// place. User overrides are stored separately in chrome.storage.local under
// "promptOverrides" (see background.js's getPromptOverrides/resolvePrompt).
const DEFAULT_PROMPTS = {
  cvSchema: `Extract the candidate's information from the attached CV/resume into a JSON object with exactly this shape:
{
  "full_name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "github": "",
  "portfolio": "",
  "summary": "",
  "work_experience": [{"title": "", "company": "", "start": "", "end": "", "description": ""}],
  "education": [{"degree": "", "institution": "", "start": "", "end": ""}],
  "skills": []
}
Only include information actually present in the CV. Use "" for missing string fields and [] for missing arrays.
Do not invent employers, dates, or credentials that aren't in the document.
Respond with JSON only — no markdown code fences, no commentary, no text before or after the JSON object.`,

  fieldMap: `You are helping a job applicant fill out a web form using their CV data.
You are given CV_DATA, ABOUT_ME (free-form notes from the applicant), ADDRESSES (labeled physical addresses — use the most fitting one for address-shaped fields like street/city/postal code/country), ADDITIONAL_RESOURCES (extra context from the applicant's own websites/notes), and a list of FORM_FIELDS (each with an "index", a "label", a "type", and for selects a list of "options").

Return a JSON object of the shape: {"answers": [{"index": 0, "value": "..."}, ...]}

Rules:
- Only include a field in "answers" if you are genuinely confident about the value from CV_DATA/ABOUT_ME/ADDITIONAL_RESOURCES, or it's a short, honest answer that can be reasonably derived from them (e.g. a brief "why am I a good fit" using the summary/skills).
- For select/dropdown fields, "value" must exactly match one of that field's provided "options" strings.
- Never fabricate personal demographic information: gender, race, ethnicity, veteran status, disability status, or sexual orientation. Omit those fields entirely — leave them for the applicant.
- Never fill salary expectations, government ID numbers, payment details, or passwords. Omit those fields entirely.
- Skip any field you are not confident about rather than guessing. It is fine to leave many fields unanswered.
- Keep free-text answers concise (2-4 sentences max) and grounded only in the given information. Do not invent facts.
Respond with JSON only — no markdown code fences, no commentary, no text before or after the JSON object.`,

  coverLetterExtract: `Extract the full text of this cover letter as faithfully as possible, preserving paragraph breaks. Do not summarize or comment on it.
Respond as JSON: {"text": "..."}. Respond with JSON only — no markdown code fences, no commentary.`,

  documentExtract: `Extract the full text of this document as faithfully as possible, preserving structure (headings, line breaks). It may be a diploma, certificate, letter, or any other personal document — do not summarize or comment on it, just transcribe what's there.
Respond as JSON: {"text": "..."}. Respond with JSON only — no markdown code fences, no commentary.`,

  coverLetterWrite: `You are helping a job applicant write a new cover letter tailored to a specific job posting.
You are given:
- CV_DATA: the applicant's CV, as structured JSON.
- REFERENCE_COVER_LETTER: a cover letter the applicant has written before. Use it only as a guide for their voice, tone, and typical structure — do not copy it verbatim, and do not reuse specifics (company names, roles) from it. Write a new letter tailored to JOB_CONTEXT.
- JOB_CONTEXT: text scraped from the job posting page (title, company, description). It may be incomplete, noisy, or missing.

Write a new cover letter grounded only in facts from CV_DATA — never invent employers, dates, skills, or achievements that aren't in CV_DATA. Write enough to fill roughly one full page (about 380-450 words) — a complete, substantial letter, not a short note — professional, and specific to the role in JOB_CONTEXT where the context allows it. If JOB_CONTEXT is missing or unhelpful, write a solid general-purpose letter from CV_DATA instead of inventing job details. End with a simple signature line (e.g. "Sincerely," followed by the applicant's name) — do not repeat their email, phone number, or address anywhere in the letter; that contact information belongs on the CV, not restated here.

Respond as JSON: {"cover_letter": "..."}. Respond with JSON only — no markdown code fences, no commentary.`,

  cvTailor: `You are helping a job applicant tailor their CV/resume for a specific job posting.
You are given CV_DATA (structured JSON), JOB_CONTEXT (text scraped from a job posting page — may be incomplete or missing), ABOUT_ME (free-form notes from the applicant), and ADDITIONAL_RESOURCES (extra context from the applicant's own websites/notes).

Produce a tailored version of the CV as JSON with exactly this shape:
{
  "full_name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "github": "",
  "portfolio": "",
  "summary": "",
  "work_experience": [{"title": "", "company": "", "start": "", "end": "", "bullets": ["", "..."]}],
  "education": [{"degree": "", "institution": "", "start": "", "end": ""}],
  "skills": []
}

Rules:
- Never invent employers, dates, titles, or achievements that aren't in CV_DATA, ABOUT_ME, or ADDITIONAL_RESOURCES. This is a rewrite/re-emphasis of real facts, not fiction.
- You may reorder or trim skills, and rewrite the summary to speak directly to the role in JOB_CONTEXT.
- Convert each role's experience into 2-4 concise, achievement-oriented "bullets" (rewrite any prose-style description into bullet points).
- If JOB_CONTEXT is missing or unhelpful, produce a solid general-purpose tailored CV instead of inventing job specifics.

Respond with JSON only — no markdown code fences, no commentary.`,

  ask: `You are chatting with a job applicant who is filling out a job application and got stuck on something the automatic form-filler couldn't confidently answer.
You are given CV_DATA, ABOUT_ME, ADDRESSES, ADDITIONAL_RESOURCES, CONVERSATION_SO_FAR (the chat so far, if any), and the applicant's NEW_QUESTION.

Answer NEW_QUESTION directly and concisely, grounded only in the given information — treat CONVERSATION_SO_FAR as context for follow-ups ("what about the one before that?"), not something to re-answer. If you don't have enough information to answer factually, say so plainly rather than guessing or inventing facts — the applicant will fill in the real answer themselves.

Respond as JSON: {"answer": "..."}. Respond with JSON only — no markdown code fences, no commentary.`,

  fieldFill: `You are helping a job applicant fill out a single field on a web form. Instead of leaving the field blank, they typed a short instruction describing what should go there — for example "add my address" or "write my most recent job title" — then selected that instruction text and asked you to replace it with the real value.

You are given CV_DATA, ABOUT_ME, ADDRESSES (labeled physical addresses — use the most fitting one for address-shaped instructions), ADDITIONAL_RESOURCES, and the applicant's INSTRUCTION (the text they selected).

Interpret INSTRUCTION and produce only the value that belongs in the field — grounded only in the given information, no extra commentary, no restating the instruction, no surrounding quotes. Never fabricate personal demographic information, government ID numbers, payment details, or passwords — if INSTRUCTION asks for one of those, or you don't have enough information to answer factually, say so plainly as the value instead of guessing.

Respond as JSON: {"value": "..."}. Respond with JSON only — no markdown code fences, no commentary.`,

  jobExtract: `Extract details about the job posting described in this scraped page text.
Respond as JSON with exactly this shape: {"title": "", "company": "", "location": "", "requirements": ""}.
"requirements" should be a short 1-3 sentence summary of the key requirements/qualifications — not the full posting.
Use "" for anything not found in the text. Do not invent details that aren't there.
Respond with JSON only — no markdown code fences, no commentary.`,
};

const PROMPT_TASK_LABELS = {
  cvSchema: "Parse CV",
  fieldMap: "Autofill this page",
  coverLetterExtract: "Extract cover letter text (PDF)",
  documentExtract: "Extract document text (About Me PDF uploads)",
  coverLetterWrite: "Generate cover letter",
  cvTailor: "Tailor CV (Word)",
  ask: "Ask AI",
  fieldFill: "Fill this field (right-click)",
  jobExtract: "Save this job",
};
