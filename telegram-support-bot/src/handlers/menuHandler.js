import { config } from '../config.js';
import { getFaqById } from '../data/data.js';
import {
  answerKeyboard,
  cancelKeyboard,
  categoryKeyboard,
  mainMenuKeyboard,
  notFoundKeyboard,
} from '../keyboards/keyboards.js';
import { accessMode } from '../services/accessMode.js';
import { getAnswer } from '../services/answerService.js';
import { speakIfBlind } from '../services/voiceDelivery.js';
import { present, t } from '../utils/localization.js';
import { ackCallback, sendParts, showScreen } from '../utils/messaging.js';
import { ensureLanguage } from './languageHandler.js';
import { showLanguagePicker } from './languagePicker.js';
import { beginHumanSupport } from './humanSupportHandler.js';

export { ensureLanguage };

export async function showMainMenu(ctx, textKey = 'menuTitle') {
  const language = await ensureLanguage(ctx);
  if (!language) {
    return;
  }
  ctx.session.awaitingFreeText = false;
  ctx.session.awaitingHumanQuestion = false;
  await showScreen(ctx, present(language, t(language, textKey)), mainMenuKeyboard(language));
}

export async function promptForQuestion(ctx, promptKey = 'faq.askPrompt') {
  const language = await ensureLanguage(ctx);
  if (!language) {
    return;
  }
  ctx.session.awaitingFreeText = true;
  ctx.session.awaitingHumanQuestion = false;
  await showScreen(ctx, present(language, t(language, promptKey)), cancelKeyboard(language));
}

export async function showAbout(ctx) {
  const language = await ensureLanguage(ctx);
  if (!language) {
    return;
  }
  const entry = getFaqById('what_is_alx');
  const text = `${entry.answer[language] || entry.answer.en}\n\n${t(language, 'faq.source')}: ${entry.sourceUrl || config.alxAboutUrl}`;
  await showScreen(ctx, present(language, text), answerKeyboard(language, accessMode(ctx.session)));
  await speakIfBlind(ctx, text, language);
}

function withNoPush(language, text) {
  return `${text}\n\n${t(language, 'alerts.noPush')}`;
}

export async function showJobAlerts(ctx) {
  const language = await ensureLanguage(ctx);
  if (!language) {
    return;
  }
  ctx.session.topic = 'alerts';
  ctx.session.awaitingFreeText = false;
  ctx.session.awaitingHumanQuestion = false;
  const mode = accessMode(ctx.session);
  if (!config.backendApiBaseUrl) {
    await showScreen(
      ctx,
      present(language, withNoPush(language, t(language, 'alerts.notConfigured'))),
      mainMenuKeyboard(language),
    );
    return;
  }
  const result = await getAnswer({
    question: t(language, 'alerts.question'),
    language,
    fallback: false,
  });
  if (result.status === 'answered' && result.answer) {
    const source = result.sourceUrl
      ? `${t(language, 'faq.source')}: ${result.sourceUrl}`
      : t(language, 'alerts.noSource');
    const text = withNoPush(language, `${result.answer}\n\n${source}`);
    await sendParts(ctx, present(language, text), answerKeyboard(language, mode));
    await speakIfBlind(ctx, text, language);
    return;
  }
  if (result.status === 'unavailable') {
    await showScreen(
      ctx,
      present(language, withNoPush(language, t(language, 'alerts.unavailable'))),
      mainMenuKeyboard(language),
    );
    return;
  }
  const notice = result.status === 'refused'
    ? (result.answer || t(language, 'advice'))
    : t(language, 'notFound');
  const text = withNoPush(language, notice);
  await sendParts(ctx, present(language, text), notFoundKeyboard(language, mode));
  await speakIfBlind(ctx, text, language);
}

export async function handleMenuCallback(ctx) {
  const action = (ctx.callbackQuery?.data || '').slice('menu:'.length);
  if (action === 'faq') {
    const language = await ensureLanguage(ctx);
    if (!language) {
      return;
    }
    await showScreen(ctx, present(language, t(language, 'faq.chooseCategory')), categoryKeyboard(language));
    return;
  }
  if (action === 'ask') {
    await promptForQuestion(ctx);
    return;
  }
  if (action === 'language') {
    await showLanguagePicker(ctx);
    return;
  }
  if (action === 'human') {
    await beginHumanSupport(ctx);
    return;
  }
  if (action === 'alerts') {
    await showJobAlerts(ctx);
    return;
  }
  if (action === 'about') {
    await showAbout(ctx);
    return;
  }
  await ackCallback(ctx);
}

export async function handleNavCallback(ctx) {
  const action = (ctx.callbackQuery?.data || '').slice('nav:'.length);
  if (action === 'ask') {
    await promptForQuestion(ctx);
    return;
  }
  await showMainMenu(ctx);
}

export function registerMenu(bot) {
  bot.command('menu', (ctx) => showMainMenu(ctx));
  bot.command('alerts', (ctx) => showJobAlerts(ctx));
  bot.command('cancel', async (ctx) => {
    if (!ctx.session?.language) {
      await showLanguagePicker(ctx);
      return;
    }
    ctx.session.awaitingFreeText = false;
    ctx.session.awaitingHumanQuestion = false;
    await showMainMenu(ctx, 'cancelled');
  });
}
