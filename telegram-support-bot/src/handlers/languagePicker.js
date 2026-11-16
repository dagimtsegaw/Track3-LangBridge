import { LANGUAGE_PROMPT } from '../data/locales.js';
import { languageKeyboard } from '../keyboards/keyboards.js';
import { showScreen } from '../utils/messaging.js';

export async function showLanguagePicker(ctx) {
  if (ctx.session) {
    ctx.session.awaitingFreeText = false;
    ctx.session.awaitingHumanQuestion = false;
  }
  await showScreen(ctx, LANGUAGE_PROMPT, languageKeyboard());
}
