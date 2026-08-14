// Fields matching this pattern are never auto-filled, even if the AI suggests a value.
// This is enforced in two places (background.js prompt + popup.js post-filter) as
// defense in depth: demographic/EEO self-identification questions should be answered
// by the applicant, not guessed from a CV, and no CV field ever contains an SSN,
// card number, or password anyway.
const CV_AUTOFILL_BLOCKLIST_RE =
  /(gender|\bsex\b|race|ethnicit|veteran|disabilit|sexual orientation|social security|\bssn\b|credit card|card number|\bcvv\b|passport|bank account|routing number|national id|driver'?s? licen[cs]e|\bpassword\b)/i;

function isSensitiveField(label) {
  return CV_AUTOFILL_BLOCKLIST_RE.test(label || "");
}

if (typeof self !== "undefined") {
  self.CV_AUTOFILL_BLOCKLIST_RE = CV_AUTOFILL_BLOCKLIST_RE;
  self.isSensitiveField = isSensitiveField;
}
