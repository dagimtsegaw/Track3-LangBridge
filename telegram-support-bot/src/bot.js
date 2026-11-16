import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Telegraf, session } from 'telegraf';
import { config, validateStartupConfig } from './config.js';
import { LANGUAGE_CODES } from './data/locales.js';
import { registerAccess } from './handlers/accessHandler.js';
import { registerCallbacks } from './handlers/callbackRouter.js';
import { registerHumanSupport } from './handlers/humanSupportHandler.js';
import { registerLanguage } from './handlers/languageHandler.js';
import { registerMenu } from './handlers/menuHandler.js';
import { registerMessages } from './handlers/messageHandler.js';
import { registerStart } from './handlers/startHandler.js';
import { allowMessage } from './utils/guards.js';
import { botCommands, present, t } from './utils/localization.js';
import { ackCallback, replyError } from './utils/messaging.js';
import { safeError } from './utils/safeLog.js';

function defaultSession() {
  return {
    language: null,
    topic: null,
    mode: null,
    chooseModeThen: null,
    lastSpoken: null,
    pendingQuestion: null,
    awaitingFreeText: false,
    awaitingHumanQuestion: false,
  };
}

function registerGuards(bot) {
  bot.use(async (ctx, next) => {
    const chatType = ctx.chat?.type;
    if (chatType && chatType !== 'private') {
      if (ctx.message?.text?.startsWith('/')) {
        await replyError(ctx, t('en', 'privateChatOnly'));
      }
      return;
    }
    return next();
  });

  bot.use(async (ctx, next) => {
    if (!ctx.from || ctx.from.is_bot) {
      return;
    }
    if (!allowMessage(ctx.from.id)) {
      const language = ctx.session?.language || 'en';
      const notice = present(language, t(language, 'rateLimited'));
      if (ctx.callbackQuery) {
        await ackCallback(ctx, notice);
        return;
      }
      await replyError(ctx, notice);
      return;
    }
    return next();
  });
}

export function createBot(token = config.botToken) {
  const bot = new Telegraf(token);
  bot.use(session({ defaultSession }));
  registerGuards(bot);
  registerStart(bot);
  registerLanguage(bot);
  registerAccess(bot);
  registerMenu(bot);
  registerHumanSupport(bot);
  registerMessages(bot);
  registerCallbacks(bot);

  bot.catch((error, ctx) => {
    console.error(`Handler error: ${safeError(error)}`);
    const language = ctx?.session?.language || 'en';
    const notice = present(language, t(language, 'genericError'));
    if (ctx?.callbackQuery) {
      ackCallback(ctx, notice);
      return;
    }
    if (ctx) {
      replyError(ctx, notice);
    }
  });

  return bot;
}

async function publishCommands(bot) {
  try {
    await bot.telegram.setMyCommands(botCommands('en'));
  } catch (error) {
    console.error(`Could not publish command menu: ${safeError(error)}`);
  }

  for (const language of LANGUAGE_CODES) {
    try {
      await bot.telegram.setMyCommands(botCommands(language), { language_code: language });
    } catch (error) {
      console.error(`Could not publish ${language} command menu: ${safeError(error)}`);
    }
  }
}

function isDirectRun() {
  if (!process.argv[1]) {
    return false;
  }
  const resolved = path.resolve(process.argv[1]);
  return fileURLToPath(import.meta.url) === resolved || import.meta.url === pathToFileURL(resolved).href;
}

if (isDirectRun()) {
  validateStartupConfig();
  const bot = createBot();

  const shutdown = (signal) => {
    try {
      bot.stop(signal);
    } catch (error) {
      console.error(`Shutdown: ${safeError(error)}`);
      process.exit(0);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const me = await bot.telegram.getMe();
    console.log(`ALX Telegram assistant connected as @${me.username}. Long polling is starting.`);
    await publishCommands(bot);
    await bot.launch({ dropPendingUpdates: true });
  } catch (error) {
    console.error(`Failed to start bot: ${safeError(error)}`);
    process.exit(1);
  }
}
