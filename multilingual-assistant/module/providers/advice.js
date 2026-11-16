/**
 * Medical, legal, and immigration questions are refused before retrieval.
 * Matching uses the same normalisation as providers/none.js so punctuation
 * and letter case do not hide a phrase. The visible sentence also lives in
 * i18n errors.advice. Non-English phrases are a basic set.
 */

var REPLIES = {
  en: "Please talk to a person.",
  am: "እባክዎ ከሰው ጋር ይነጋገሩ።",
  om: "Mee nama waliin haasa'i.",
  ti: "በጃኹም ምስ ሰብ ተዘራረቡ።",
  so: "Fadlan qof la hadal.",
  ar: "من فضلك تحدّث إلى شخص.",
};

/** Same character rules as normalize() in none.js. */
export function normalizeQuestion(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

var NON_LATIN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u1200-\u137F]/;

var PHRASES = [
  "visa", "visas", "passport", "passports", "asylum",
  "refugee", "refugees", "refugee status",
  "lawyer", "lawyers", "sue", "sued", "suing",
  "contract dispute", "contract disputes",
  "diagnosis", "medicine", "medicines", "dose", "doses", "symptom", "symptoms",
  "ቪዛ", "ፓስፖርት", "ጥገኝነት", "ስደተኛ", "የስደተኛ ሁኔታ", "ጠበቃ", "ክስ",
  "የውል ክርክር", "ምርመራ", "መድሃኒት", "መድኃኒት", "ዶዝ", "ምልክቶች", "የበሽታ ምልክት",
  "viizaa", "viiza", "paaspoortii", "baqattummaa", "baqataa", "abukaatoo", "qoricha", "doozii",
  "ዑቕባ", "ኣቃባዒ ሕጊ", "ምልክታት",
  "fiiso", "baasaboor", "magangelyo", "qaxooti", "qareen", "dacwo",
  "khilaaf heshiis", "daawo", "qiyaasta daawada", "calaamadaha",
  "تأشيرة", "تاشيرة", "فيزا", "جواز سفر", "لجوء", "لاجئ", "لاجىء", "صفة لاجئ",
  "محامي", "محام", "دعوى", "نزاع عقد", "نزاع على عقد", "تشخيص", "دواء", "جرعة", "أعراض", "اعراض",
].map(normalizeQuestion);

function unique(list) {
  var seen = new Set();
  var out = [];
  for (var i = 0; i < list.length; i += 1) {
    if (!list[i] || seen.has(list[i])) continue;
    seen.add(list[i]);
    out.push(list[i]);
  }
  return out;
}

var NEEDLES = unique(PHRASES);

export function isAdviceQuestion(question) {
  var text = normalizeQuestion(question);
  if (!text) return false;
  var padded = " " + text + " ";
  var tokens = text.split(" ");
  for (var i = 0; i < NEEDLES.length; i += 1) {
    var phrase = NEEDLES[i];
    if (padded.includes(" " + phrase + " ")) return true;
    if (phrase.indexOf(" ") !== -1 || phrase.length < 4 || !NON_LATIN.test(phrase)) continue;
    for (var t = 0; t < tokens.length; t += 1) {
      if (tokens[t].indexOf(phrase) !== -1) return true;
    }
  }
  return false;
}

export function adviceReply(language) {
  var code = String(language || "en").toLowerCase().split("-")[0];
  return REPLIES[code] || REPLIES.en;
}
