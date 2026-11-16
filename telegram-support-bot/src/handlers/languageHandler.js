import { modeKeyboard } from '../keyboards/keyboards.js';
import { isLanguageCode, present, t } from '../utils/localization.js';
import { ackCallback, showScreen } from '../utils/messaging.js';
import { showLanguagePicker } from './languagePicker.js';

export async function ensureLanguage(ctx) {
  if (ctx.session?.language) {
    return ctx.session.language;
  }
  await showLanguagePicker(ctx);
  return null;
}

export async function handleLanguageCallback(ctx) {
  const code = (ctx.callbackQuery?.data || '').slice('lang:'.length);
  if (!isLanguageCode(code)) {
    await ackCallback(ctx);
    return;
  }

  ctx.session.language = code;
  ctx.session.awaitingFreeText = false;
  ctx.session.awaitingHumanQuestion = false;
  ctx.session.chooseModeThen = 'welcome';
  await showScreen(ctx, present(code, t(code, 'mode.prompt')), modeKeyboard(code));
}

export function registerLanguage(bot) {
  bot.command('language', showLanguagePicker);
}
