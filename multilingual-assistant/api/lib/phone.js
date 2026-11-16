/**
 * Ethiopian mobile numbers, stored as +251 and nine digits.
 * Accepts 09…, 07…, +251…, and 251…. Anything else is rejected with a sentence.
 */

export const PHONE_ERROR = "That phone number is not a valid Ethiopian mobile number.";

export function normalizePhone(value) {
  const compact = String(value || "")
    .trim()
    .replace(/[\s().-]/g, "");
  if (!compact) return { ok: false, error: PHONE_ERROR };
  let national = "";
  if (compact.startsWith("+251")) national = compact.slice(4);
  else if (compact.startsWith("251")) national = compact.slice(3);
  else if (/^0[79]/.test(compact)) national = compact.slice(1);
  else return { ok: false, error: PHONE_ERROR };
  if (!/^[79]\d{8}$/.test(national)) return { ok: false, error: PHONE_ERROR };
  return { ok: true, phone: "+251" + national };
}
