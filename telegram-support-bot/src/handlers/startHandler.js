import { t } from '../utils/localization.js';
import { beginHumanSupport } from './humanSupportHandler.js';
import { showMainMenu } from './menuHandler.js';
import { showLanguagePicker } from './languagePicker.js';

export { showLanguagePicker };

export async function handleStart(ctx) {
  const raw = String(ctx.startPayload || '');
  const match = raw.match(/^(en|am|om|ti|so|ar)_(tutor|careers|alerts|accommodation)$/);
  if (!match || !ctx.session) {
    await showLanguagePicker(ctx);
    return;
  }
  ctx.session.language = match[1];
  ctx.session.topic = match[2];
  ctx.session.awaitingFreeText = false;
  ctx.session.awaitingHumanQuestion = false;
  if (match[2] === 'accommodation') {
    ctx.session.pendingQuestion = t(match[1], 'support.accommodationAsk');
    await showMainMenu(ctx);
    await beginHumanSupport(ctx);
    return;
  }
  ctx.session.pendingQuestion = null;
  await showMainMenu(ctx);
}

export function registerStart(bot) {
  bot.start(handleStart);
}
