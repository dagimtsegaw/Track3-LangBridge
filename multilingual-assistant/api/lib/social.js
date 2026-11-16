/**
 * Short social messages get a hello instead of "couldn't find".
 * A real question, even one that starts with hello, is not a greeting.
 */

const EXACT = new Set([
  "hi", "hii", "hiii", "hello", "helo", "hellow", "helloo", "hey", "heyy", "hiya", "yo", "sup",
  "hi there", "hey there", "hello there",
  "good morning", "good afternoon", "good evening", "good night",
  "how are you", "how are u", "how r you", "how are you doing", "whats up", "wassup",
  "thanks", "thank you", "thank u", "thx", "ty", "thankyou",
  "ok", "okay", "cool", "nice", "great",
  "bye", "goodbye", "good bye", "see you",
  "selam", "salaam", "salam", "salaam alaikum", "assalamu alaikum",
  "akkam", "akkam jirta", "nagaa", "naga", "galatoomi",
  "salaan", "iska warran", "mahadsanid",
  "ሰላም", "ሰላም ነህ", "ሰላም ነሽ", "እንደምን አለህ", "እንደምን ነህ", "እንደምን ነሽ", "አመሰግናለሁ",
  "ከመይ ኣለኻ", "ከመይ ኣለኺ", "የቐንየለይ",
  "مرحبا", "اهلا", "أهلا", "اهلا وسهلا", "السلام عليكم", "كيف حالك", "شكرا", "شكرا لك",
]);

const REPLIES = {
  en: "Hello. What can I help you with?",
  am: "ሰላም። በምን ልርዳዎ?",
  om: "Akkam. Maal si gargaaru?",
  ti: "ሰላም። እንታይ ክሕግዘካ?",
  so: "Salaan. Maxaan kaa caawin karaa?",
  ar: "مرحباً. بماذا يمكنني مساعدتك؟",
};

export function socialText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGreeting(value) {
  const text = socialText(value);
  if (!text || text.length > 48) return false;
  if (EXACT.has(text)) return true;
  return /^(hi+|hey+|he+l+o+w*|yo+)$/.test(text);
}

export function greetingReply(language) {
  const code = String(language || "en").toLowerCase().split("-")[0];
  return REPLIES[code] || REPLIES.en;
}
