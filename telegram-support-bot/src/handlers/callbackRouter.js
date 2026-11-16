import { isDuplicateCallback } from '../utils/guards.js';
import { ackCallback } from '../utils/messaging.js';
import { handleModeCallback, handleVoiceCallback } from './accessHandler.js';
import { handleLanguageCallback } from './languageHandler.js';
import { handleMenuCallback, handleNavCallback } from './menuHandler.js';
import { handleFaqCallback } from './faqHandler.js';
import { handleHumanCallback } from './humanSupportHandler.js';

export function registerCallbacks(bot) {
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const userId = ctx.from?.id || 'unknown';
    if (!data || isDuplicateCallback(userId, data)) {
      await ackCallback(ctx);
      return;
    }

    if (data.startsWith('lang:')) {
      await handleLanguageCallback(ctx);
      return;
    }
    if (data.startsWith('mode:')) {
      await handleModeCallback(ctx);
      return;
    }
    if (data.startsWith('voice:')) {
      await handleVoiceCallback(ctx);
      return;
    }
    if (data.startsWith('menu:')) {
      await handleMenuCallback(ctx);
      return;
    }
    if (data.startsWith('nav:')) {
      await handleNavCallback(ctx);
      return;
    }
    if (data.startsWith('faq:')) {
      await handleFaqCallback(ctx);
      return;
    }
    if (data.startsWith('human:')) {
      await handleHumanCallback(ctx);
      return;
    }
    await ackCallback(ctx);
  });
}
