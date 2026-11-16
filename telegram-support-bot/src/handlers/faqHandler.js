import { CATEGORIES, getFaqById, getFaqsByCategory } from '../data/data.js';
import {
  answerKeyboard,
  categoryKeyboard,
  mainMenuKeyboard,
  questionKeyboard,
} from '../keyboards/keyboards.js';
import { accessMode } from '../services/accessMode.js';
import { speakIfBlind } from '../services/voiceDelivery.js';
import { present, t } from '../utils/localization.js';
import { ackCallback, sendParts, showScreen } from '../utils/messaging.js';
import { ensureLanguage } from './languageHandler.js';
import { promptForQuestion } from './menuHandler.js';

export function formatFaqText(language, entry) {
  const answer = entry.answer[language] || entry.answer.en;
  if (!entry.sourceUrl) {
    return answer;
  }
  return `${answer}\n\n${t(language, 'faq.source')}: ${entry.sourceUrl}`;
}

export async function handleFaqCallback(ctx) {
  const language = await ensureLanguage(ctx);
  if (!language) {
    return;
  }

  const data = ctx.callbackQuery?.data || '';
  if (data.startsWith('faq:cat:')) {
    const categoryId = data.slice('faq:cat:'.length);
    if (!CATEGORIES.some((category) => category.id === categoryId)) {
      await showScreen(ctx, present(language, t(language, 'genericError')), mainMenuKeyboard(language));
      return;
    }
    if (categoryId === 'other') {
      await promptForQuestion(ctx, 'faq.otherPrompt');
      return;
    }
    if (!getFaqsByCategory(categoryId).length) {
      await showScreen(ctx, present(language, t(language, 'faq.chooseCategory')), categoryKeyboard(language));
      return;
    }
    await showScreen(
      ctx,
      present(language, t(language, 'faq.chooseQuestion')),
      questionKeyboard(language, categoryId),
    );
    return;
  }

  if (!data.startsWith('faq:q:')) {
    await ackCallback(ctx);
    return;
  }

  const entry = getFaqById(data.slice('faq:q:'.length));
  if (!entry) {
    await showScreen(ctx, present(language, t(language, 'genericError')), mainMenuKeyboard(language));
    return;
  }

  ctx.session.pendingQuestion = null;
  ctx.session.awaitingFreeText = false;
  const answer = formatFaqText(language, entry);
  await sendParts(ctx, present(language, answer), answerKeyboard(language, accessMode(ctx.session)));
  await speakIfBlind(ctx, answer, language);
}
