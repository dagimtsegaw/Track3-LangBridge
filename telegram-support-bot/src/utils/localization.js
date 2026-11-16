import { LANGUAGE_CODES, messages } from '../data/locales.js';

export function isLanguageCode(value) {
  return LANGUAGE_CODES.includes(value);
}

function readPath(source, key) {
  return key.split('.').reduce((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return current[part];
    }
    return undefined;
  }, source);
}

export function t(language, key, vars = {}) {
  const lang = isLanguageCode(language) ? language : 'en';
  const template = readPath(messages[lang], key) ?? readPath(messages.en, key) ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])));
}

export function present(language, text) {
  if (language === 'ar') {
    return `\u202B${text}\u202C`;
  }
  return text;
}

export function botCommands(language) {
  return [
    { command: 'start', description: t(language, 'commands.start') },
    { command: 'menu', description: t(language, 'commands.menu') },
    { command: 'language', description: t(language, 'commands.language') },
    { command: 'mode', description: t(language, 'commands.mode') },
    { command: 'help', description: t(language, 'commands.help') },
    { command: 'cancel', description: t(language, 'commands.cancel') },
    { command: 'alerts', description: t(language, 'commands.alerts') },
    { command: 'privacy', description: t(language, 'commands.privacy') },
  ];
}

export function flattenMessageKeys(source = messages.en, prefix = '') {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      return flattenMessageKeys(value, path);
    }
    return [path];
  });
}
