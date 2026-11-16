import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(packageRoot, '.env') });

function trimmed(name) {
  return (process.env[name] || '').trim();
}

function idList(name) {
  return trimmed(name)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export const config = {
  get botToken() {
    return trimmed('BOT_TOKEN');
  },
  get humanSupportChatId() {
    return trimmed('HUMAN_SUPPORT_CHAT_ID');
  },
  get adminTelegramIds() {
    return idList('ADMIN_TELEGRAM_IDS');
  },
  get alxWebsite() {
    return trimmed('ALX_WEBSITE') || 'https://www.alxafrica.com/';
  },
  get alxAboutUrl() {
    return trimmed('ALX_ABOUT_URL') || 'https://www.alxafrica.com/about/';
  },
  get alxProgramsUrl() {
    return trimmed('ALX_PROGRAMS_URL') || 'https://www.alxafrica.com/programmes/';
  },
  get alxSupportUrl() {
    return trimmed('ALX_SUPPORT_URL') || 'https://ehub.alxafrica.com/';
  },
  get answerProvider() {
    return trimmed('ANSWER_PROVIDER').toLowerCase() || 'local';
  },
  get geminiKey() {
    return trimmed('GEMINI_API_KEY');
  },
  get geminiModel() {
    return trimmed('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
  },
  get backendApiBaseUrl() {
    return trimmed('BACKEND_API_BASE_URL');
  },
  get backendApiKey() {
    return trimmed('BACKEND_API_KEY');
  },
  get addisKey() {
    return trimmed('ADDIS_API_KEY');
  },
  get addisBase() {
    return trimmed('ADDIS_BASE_URL') || 'https://api.addisassistant.com';
  },
};

export function validateStartupConfig() {
  if (!config.botToken) {
    console.error(
      'BOT_TOKEN is missing. Copy .env.example to .env in the telegram-bot folder and set BOT_TOKEN from BotFather. The bot will not start.',
    );
    process.exit(1);
  }

  if (config.answerProvider === 'gemini' && !config.geminiKey) {
    console.warn('ANSWER_PROVIDER is gemini but GEMINI_API_KEY is empty. The bot will use the local FAQ.');
  } else if (config.answerProvider !== 'local' && config.answerProvider !== 'gemini') {
    console.warn(
      `ANSWER_PROVIDER is "${config.answerProvider}". That provider is not connected, so local FAQ data will be used.`,
    );
  }

  if (!config.humanSupportChatId) {
    console.log(
      'HUMAN_SUPPORT_CHAT_ID is not set. Human escalation will direct learners to the official ALX support portal.',
    );
  }

  if (!config.addisKey) {
    console.log(
      'ADDIS_API_KEY is not set. English and Arabic voice still use Edge. Amharic and Somali fall back to Edge. Afaan Oromo and Tigrinya stay text until Addis is configured.',
    );
  }
}
