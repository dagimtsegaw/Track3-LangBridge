const MODES = new Set(['std', 'blind', 'deaf']);
const byChat = new Map();

export function isAccessMode(value) {
  return MODES.has(value);
}

export function accessMode(session) {
  return isAccessMode(session?.mode) ? session.mode : 'std';
}

export function rememberMode(chatId, mode) {
  if (chatId == null || !isAccessMode(mode)) {
    return;
  }
  byChat.set(String(chatId), mode);
}

export function rememberedMode(chatId) {
  return byChat.get(String(chatId)) || 'std';
}
