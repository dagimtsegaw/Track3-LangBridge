import { config } from '../config.js';
import { languageKeyboard, mainMenuKeyboard, notFoundKeyboard, answerKeyboard } from '../keyboards/keyboards.js';
import { accessMode } from '../services/accessMode.js';
import { getAnswer } from '../services/answerService.js';
import { speakIfBlind } from '../services/voiceDelivery.js';
import { present, t } from '../utils/localization.js';
import { replyError, sendParts, showScreen } from '../utils/messaging.js';
import { showLanguagePicker } from './startHandler.js';
import { beginHumanSupport } from './humanSupportHandler.js';

function formatAnswer(language, result) {
  if (!result.sourceUrl) {
    return result.answer;
  }
  return `${result.answer}\n\n${t(language, 'faq.source')}: ${result.sourceUrl}`;
}

export async function handleIncomingText(ctx) {
  const text = (ctx.message?.text || '').trim();
  const language = ctx.session?.language || null;

  if (text.startsWith('/')) {
    const lang = language || 'en';
    await showScreen(
      ctx,
      present(lang, t(lang, 'unknownCommand')),
      language ? mainMenuKeyboard(language) : languageKeyboard(),
    );
    return;
  }

  if (!language) {
    await showLanguagePicker(ctx);
    return;
  }

  if (ctx.session.awaitingHumanQuestion) {
    ctx.session.pendingQuestion = text.slice(0, 1500);
    await beginHumanSupport(ctx);
    return;
  }

  ctx.session.awaitingFreeText = false;
  const mode = accessMode(ctx.session);
  const result = await getAnswer({ question: text, language });
  if (result.status === 'answered') {
    ctx.session.pendingQuestion = null;
    const answer = formatAnswer(language, result);
    await sendParts(ctx, present(language, answer), answerKeyboard(language, mode));
    await speakIfBlind(ctx, answer, language);
    return;
  }

  ctx.session.pendingQuestion = text.slice(0, 1500);
  const missing = result.status === 'refused'
    ? (result.answer || t(language, 'advice'))
    : t(language, 'notFound');
  await sendParts(ctx, present(language, missing), notFoundKeyboard(language, mode));
  await speakIfBlind(ctx, missing, language);
}

export function registerMessages(bot) {
  bot.command('help', async (ctx) => {
    const language = ctx.session?.language || 'en';
    const keyboard = ctx.session?.language ? mainMenuKeyboard(language) : languageKeyboard();
    await showScreen(ctx, present(language, t(language, 'help')), keyboard);
  });

  bot.command('privacy', async (ctx) => {
    const language = ctx.session?.language || 'en';
    const keyboard = ctx.session?.language ? mainMenuKeyboard(language) : languageKeyboard();
    await showScreen(
      ctx,
      present(language, t(language, 'privacy', { supportUrl: config.alxSupportUrl })),
      keyboard,
    );
  });

  bot.on(
    ['photo', 'voice', 'audio', 'video', 'video_note', 'document', 'sticker', 'animation', 'location', 'contact'],
    async (ctx) => {
      const language = ctx.session?.language || 'en';
      await replyError(ctx, present(language, t(language, 'textOnly')));
    },
  );

  bot.on('text', handleIncomingText);
}
