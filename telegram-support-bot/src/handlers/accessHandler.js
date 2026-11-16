import { mainMenuKeyboard, modeKeyboard } from '../keyboards/keyboards.js';
import { rememberMode, isAccessMode } from '../services/accessMode.js';
import { speakIfBlind, speakOnRequest } from '../services/voiceDelivery.js';
import { present, t } from '../utils/localization.js';
import { ackCallback, showScreen } from '../utils/messaging.js';
import { showLanguagePicker } from './startHandler.js';

export async function showModePicker(ctx, next = 'menu') {
  const language = ctx.session?.language;
  if (!language) {
    await showLanguagePicker(ctx);
    return;
  }
  ctx.session.chooseModeThen = next;
  await showScreen(ctx, present(language, t(language, 'mode.prompt')), modeKeyboard(language));
}

export async function handleModeCallback(ctx) {
  const language = ctx.session?.language;
  if (!language) {
    await showLanguagePicker(ctx);
    return;
  }
  const mode = (ctx.callbackQuery?.data || '').slice('mode:'.length);
  if (!isAccessMode(mode)) {
    await ackCallback(ctx);
    return;
  }
  ctx.session.mode = mode;
  rememberMode(ctx.chat?.id, mode);
  const welcome = ctx.session.chooseModeThen === 'welcome';
  ctx.session.chooseModeThen = null;
  const text = t(language, welcome ? 'welcome' : 'mode.saved');
  await showScreen(ctx, present(language, text), mainMenuKeyboard(language));
  await speakIfBlind(ctx, text, language);
}

export async function handleVoiceCallback(ctx) {
  const language = ctx.session?.language;
  if (!language) {
    await showLanguagePicker(ctx);
    return;
  }
  await ackCallback(ctx);
  await speakOnRequest(ctx, language);
}

export function registerAccess(bot) {
  bot.command('mode', (ctx) => showModePicker(ctx, 'menu'));
}
