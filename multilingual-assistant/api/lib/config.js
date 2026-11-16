/**
 * Reads process env into a plain object. The Gemini and Addis keys stay on
 * this object so request handlers can set headers. Nothing here writes them
 * to the log.
 */

export function readConfig(env) {
  const source = env || {};
  const aiProvider = String(source.AI_PROVIDER || "none").trim().toLowerCase();
  const ttsRaw = String(source.TTS_PROVIDER || "none").trim().toLowerCase();
  const geminiKey = String(source.GEMINI_API_KEY || "").trim();
  const ollamaBase = String(source.OLLAMA_BASE_URL || "").trim().replace(/\/$/, "");
  const ollamaModel = String(source.OLLAMA_MODEL || "").trim();
  const addisKey = String(source.ADDIS_API_KEY || "").trim();
  const ttsProvider = ttsRaw === "addis" || ttsRaw === "mock" ? ttsRaw : "none";
  const origins = String(source.ALLOWED_ORIGINS || "")
    .split(",")
    .map(function (item) {
      return item.trim();
    })
    .filter(Boolean);
  const provider = aiProvider === "gemini" || aiProvider === "ollama" ? aiProvider : "none";
  const geminiOn = provider === "gemini" && geminiKey.length > 0;
  const ollamaOn = provider === "ollama" && ollamaBase.length > 0 && ollamaModel.length > 0;
  return {
    port: Number(source.PORT) || 3000,
    origins: origins,
    aiProvider: provider,
    geminiOn: geminiOn,
    geminiKey: geminiKey,
    geminiModel: String(source.GEMINI_MODEL || "gemini-3.5-flash").trim() || "gemini-3.5-flash",
    ollamaBase: ollamaBase,
    ollamaModel: ollamaModel,
    geminiTtsModel: String(source.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts").trim() || "gemini-2.5-flash-preview-tts",
    ttsProvider: ttsProvider,
    addisKey: addisKey,
    addisBase: String(source.ADDIS_BASE_URL || "https://api.addisassistant.com").trim().replace(/\/$/, "") || "https://api.addisassistant.com",
    telegram: String(source.TELEGRAM_BOT_USERNAME || "").trim().replace(/^@/, ""),
    helperToken: String(source.HELPER_TOKEN || "").trim(),
    ai: geminiOn || ollamaOn,
    ttsAddis: ttsProvider === "addis" && addisKey.length > 0,
    ttsGemini: geminiKey.length > 0,
  };
}

export function healthBody(config) {
  return {
    ai: config.ai === true,
    ttsAddis: config.ttsAddis === true,
    ttsGemini: config.ttsGemini === true,
    escalations: true,
    telegram: config.telegram || "",
  };
}
