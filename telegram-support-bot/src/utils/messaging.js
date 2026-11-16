import { safeError } from './safeLog.js';

const MESSAGE_LIMIT = 3900;

export async function ackCallback(ctx, text) {
  if (!ctx.callbackQuery || ctx.state?.callbackAnswered) {
    return;
  }
  ctx.state = ctx.state || {};
  ctx.state.callbackAnswered = true;
  try {
    if (text) {
      await ctx.answerCbQuery(text.slice(0, 180));
    } else {
      await ctx.answerCbQuery();
    }
  } catch {
    // The loading indicator may already have expired.
  }
}

function extras(keyboard) {
  return {
    ...(keyboard || {}),
    link_preview_options: { is_disabled: true },
  };
}

export function splitMessage(text, limit = MESSAGE_LIMIT) {
  if (text.length <= limit) {
    return [text];
  }
  const parts = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut < limit * 0.5) {
      cut = limit;
    }
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) {
    parts.push(rest);
  }
  return parts;
}

async function deliver(ctx, text, keyboard, { edit }) {
  const payload = extras(keyboard);
  if (edit && ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, payload);
      return;
    } catch (error) {
      const description = error?.response?.description || '';
      if (/message is not modified/i.test(description)) {
        return;
      }
    }
  }
  await ctx.reply(text, payload);
}

export async function showScreen(ctx, text, keyboard) {
  await ackCallback(ctx);
  const parts = splitMessage(text);
  await deliver(ctx, parts[0], keyboard, { edit: true });
  for (const part of parts.slice(1)) {
    await ctx.reply(part, extras());
  }
}

export async function sendParts(ctx, text, keyboard) {
  await ackCallback(ctx);
  const parts = splitMessage(text);
  const last = parts.length - 1;
  for (let index = 0; index < parts.length; index += 1) {
    await ctx.reply(parts[index], index === last ? extras(keyboard) : extras());
  }
}

export async function replyError(ctx, text) {
  try {
    await ctx.reply(text, extras());
  } catch (error) {
    console.error(`Reply failed: ${safeError(error)}`);
  }
}
