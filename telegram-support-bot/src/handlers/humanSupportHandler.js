import { config } from '../config.js';
import { mainMenuKeyboard, cancelKeyboard } from '../keyboards/keyboards.js';
import { forwardSupportRequest, isAdmin, recallLearner, sendStaffReply } from '../services/humanSupportService.js';
import { speakToChat } from '../services/voiceDelivery.js';
import { present, t } from '../utils/localization.js';
import { ackCallback, showScreen } from '../utils/messaging.js';
import { safeError } from '../utils/safeLog.js';
import { ensureLanguage } from './languageHandler.js';

export async function beginHumanSupport(ctx) {
  const language = await ensureLanguage(ctx);
  if (!language) {
    return;
  }

  const supportUrl = config.alxSupportUrl;
  const canTicket = Boolean(config.backendApiBaseUrl);
  const canChat = Boolean(config.humanSupportChatId);
  if (!canTicket && !canChat) {
    await showScreen(
      ctx,
      present(language, t(language, 'support.notConfigured', { supportUrl })),
      mainMenuKeyboard(language),
    );
    return;
  }

  const question = ctx.session.pendingQuestion;
  if (!question) {
    ctx.session.awaitingHumanQuestion = true;
    ctx.session.awaitingFreeText = false;
    await showScreen(ctx, present(language, t(language, 'support.askToDescribe')), cancelKeyboard(language));
    return;
  }

  const result = await forwardSupportRequest(ctx.telegram, {
    firstName: ctx.from?.first_name,
    username: ctx.from?.username,
    userId: ctx.from?.id,
    language,
    question: String(question).slice(0, 1500),
    requestedAt: new Date(),
  }, { topic: ctx.session.topic || 'tutor' });

  const lines = [];
  if (result.ticketPosted) {
    lines.push(t(language, 'support.wait'));
  } else if (result.ticketReason !== 'not_configured') {
    lines.push(t(language, 'support.ticketFailed'));
    lines.push(t(language, 'support.wait'));
  }
  if (result.delivered) {
    lines.push(t(language, 'support.forwarded', { supportUrl }));
  } else if (canChat && result.reason === 'send_failed') {
    lines.push(t(language, 'support.failed', { supportUrl }));
  } else if (!result.ticketPosted && result.ticketReason === 'not_configured') {
    const key = result.reason === 'not_configured' ? 'support.notConfigured' : 'support.failed';
    lines.push(t(language, key, { supportUrl }));
  }

  if (result.ticketPosted || result.delivered) {
    ctx.session.pendingQuestion = null;
    ctx.session.awaitingHumanQuestion = false;
    ctx.session.awaitingFreeText = false;
  }
  await showScreen(ctx, present(language, lines.join('\n\n')), mainMenuKeyboard(language));
}

export async function handleHumanCallback(ctx) {
  if ((ctx.callbackQuery?.data || '') === 'human:transfer') {
    await beginHumanSupport(ctx);
    return;
  }
  await ackCallback(ctx);
}

export async function handleReplyCommand(ctx) {
  const language = ctx.session?.language || 'en';
  if (!isAdmin(ctx.from?.id)) {
    await ctx.reply(present(language, t(language, 'support.notAllowed')));
    return;
  }

  const body = (ctx.message?.text || '').replace(/^\/reply(?:@\w+)?\s*/i, '').trim();
  const match = body.match(/^(-?\d+)\s+([\s\S]+)$/);
  if (!match) {
    await ctx.reply(present(language, t(language, 'support.replyUsage')));
    return;
  }

  const chatId = match[1];
  const staffText = match[2].trim().slice(0, 3500);
  const learner = recallLearner(chatId);
  const learnerLanguage = learner?.language || 'en';
  const outgoing = `${t(learnerLanguage, 'support.staffIntro')}\n\n${staffText}`;

  try {
    await sendStaffReply(ctx.telegram, chatId, present(learnerLanguage, outgoing));
    await speakToChat(ctx.telegram, chatId, outgoing, learnerLanguage);
    await ctx.reply(present(language, t(language, 'support.replySent')));
  } catch (error) {
    console.error(`Staff reply failed: ${safeError(error)}`);
    await ctx.reply(present(language, t(language, 'support.replyFailed')));
  }
}

export function registerHumanSupport(bot) {
  bot.command('reply', handleReplyCommand);
}
