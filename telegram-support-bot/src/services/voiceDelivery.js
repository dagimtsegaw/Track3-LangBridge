import { present, t } from '../utils/localization.js';
import { replyError } from '../utils/messaging.js';
import { safeError } from '../utils/safeLog.js';
import { accessMode, rememberedMode } from './accessMode.js';
import { speech } from './speechService.js';

export function rememberAnswer(session, text) {
  if (session) {
    session.lastSpoken = text;
  }
}

export async function speakIfBlind(ctx, text, language) {
  rememberAnswer(ctx.session, text);
  if (accessMode(ctx.session) !== 'blind') {
    return;
  }
  await play(ctx, text, language, true);
}

export async function speakOnRequest(ctx, language) {
  if (accessMode(ctx.session) === 'deaf') {
    return;
  }
  const text = ctx.session?.lastSpoken;
  if (!text) {
    await replyError(ctx, present(language, t(language, 'voice.none')));
    return;
  }
  await play(ctx, text, language, false);
}

async function play(ctx, text, language, quiet) {
  let audio = null;
  try {
    audio = await speech.speak(text, language);
  } catch (error) {
    console.error(`Speech failed: ${safeError(error)}`);
    audio = null;
  }
  if (!audio?.length) {
    if (!quiet) {
      await replyError(ctx, present(language, t(language, 'voice.failed')));
    }
    return;
  }
  const file = { source: audio, filename: 'answer.mp3' };
  const extra = { title: t(language, 'buttons.listen') };
  try {
    if (typeof ctx.replyWithAudio === 'function') {
      await ctx.replyWithAudio(file, extra);
      return;
    }
    if (ctx.telegram?.sendAudio && ctx.chat?.id != null) {
      await ctx.telegram.sendAudio(ctx.chat.id, file, extra);
    }
  } catch (error) {
    console.error(`Audio reply failed: ${safeError(error)}`);
    if (!quiet) {
      await replyError(ctx, present(language, t(language, 'voice.failed')));
    }
  }
}

export async function speakToChat(telegram, chatId, text, language) {
  if (rememberedMode(chatId) !== 'blind' || typeof telegram?.sendAudio !== 'function') {
    return;
  }
  try {
    const audio = await speech.speak(text, language);
    if (!audio?.length) {
      return;
    }
    await telegram.sendAudio(chatId, { source: audio, filename: 'answer.mp3' }, { title: t(language, 'buttons.listen') });
  } catch (error) {
    console.error(`Voice reply failed: ${safeError(error)}`);
  }
}
