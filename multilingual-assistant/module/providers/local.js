/**
 * Ollama on the host machine, OpenAI-style chat completions.
 * The browser does not call this. api/ does, and only with sections that
 * already cleared the search threshold. A failure throws so the server can
 * fall back to the offline excerpt.
 */

const COULD_NOT_FIND = "I could not find this in the course.";

const RULES = [
  "Answer only from the provided sections. They may be lesson text or ALX information.",
  "The question may have typos, missing letters, or different wording. Treat that as the same question when the meaning matches a section.",
  "Write in the user's language.",
  "Mention the section title in a normal sentence. Do not prefix it with a label.",
  "If the person is only greeting you, thanking you, or making small talk, reply with a short hello and ask what you can help with. Do not say you could not find it.",
  "If the sections do not contain the answer, reply with exactly this sentence and nothing else: " + COULD_NOT_FIND,
  "Refuse medical, legal, and immigration advice and tell the person to talk to a human.",
  "Never invent facts, fees, dates, eligibility rules, names, numbers, or sources that are not in the sections.",
].join(" ");

export function createLocal(options) {
  const opts = options || {};
  const model = String(opts.model || "").trim();
  const fetchImpl = opts.fetchImpl;
  const timeoutMs = opts.timeoutMs || 12000;
  let base = String(opts.base || "").trim().replace(/\/$/, "");
  base = base.replace(/\/v1$/, "");

  return {
    async answer({ question, language, sections }) {
      if (!base || !model || typeof fetchImpl !== "function") {
        const error = new Error("Ollama is not configured.");
        error.status = 501;
        throw error;
      }
      const packed = (Array.isArray(sections) ? sections : [])
        .map(function (section) {
          return "Title: " + section.title + "\nURL: " + section.url + "\n" + section.text;
        })
        .join("\n\n---\n\n");
      const response = await fetchImpl(base + "/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: model,
          temperature: 0.2,
          messages: [
            { role: "system", content: RULES },
            {
              role: "user",
              content: "Language: " + language + "\n\nQuestion: " + question + "\n\nSections:\n" + packed,
            },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const error = new Error("ollama");
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      return messageText(data);
    },
  };
}

function messageText(data) {
  const message = data && data.choices && data.choices[0] && data.choices[0].message;
  const content = message && message.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map(function (part) {
      if (typeof part === "string") return part;
      return part && typeof part.text === "string" ? part.text : "";
    })
    .join("")
    .trim();
}
