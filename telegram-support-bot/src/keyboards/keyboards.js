import { Markup } from 'telegraf';
import { CATEGORIES, getFaqsByCategory } from '../data/data.js';
import { t } from '../utils/localization.js';

const BUTTON_LIMIT = 64;

export function truncateLabel(text, max = BUTTON_LIMIT) {
  const chars = Array.from(text || '');
  if (chars.length <= max) {
    return text;
  }
  return `${chars.slice(0, max - 1).join('')}…`;
}

export function languageKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('English 🇬🇧', 'lang:en')],
    [Markup.button.callback('አማርኛ 🇪🇹', 'lang:am')],
    [Markup.button.callback('Afaan Oromo', 'lang:om')],
    [Markup.button.callback('ትግርኛ', 'lang:ti')],
    [Markup.button.callback('Soomaali', 'lang:so')],
    [Markup.button.callback('العربية', 'lang:ar')],
  ]);
}

export function modeKeyboard(language) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(truncateLabel(t(language, 'mode.std')), 'mode:std')],
    [Markup.button.callback(truncateLabel(t(language, 'mode.blind')), 'mode:blind')],
    [Markup.button.callback(truncateLabel(t(language, 'mode.deaf')), 'mode:deaf')],
  ]);
}

export function mainMenuKeyboard(language) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(truncateLabel(t(language, 'buttons.faq')), 'menu:faq')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.ask')), 'menu:ask')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.alerts')), 'menu:alerts')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.language')), 'menu:language')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.human')), 'menu:human')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.about')), 'menu:about')],
  ]);
}

export function categoryKeyboard(language) {
  const rows = CATEGORIES.map((category) => [
    Markup.button.callback(
      truncateLabel(t(language, `categories.${category.id}`)),
      `faq:cat:${category.id}`,
    ),
  ]);
  rows.push([Markup.button.callback(truncateLabel(t(language, 'buttons.mainMenu')), 'nav:menu')]);
  return Markup.inlineKeyboard(rows);
}

export function questionKeyboard(language, categoryId) {
  const rows = getFaqsByCategory(categoryId).map((item) => [
    Markup.button.callback(truncateLabel(item.question[language] || item.question.en), `faq:q:${item.id}`),
  ]);
  rows.push([Markup.button.callback(truncateLabel(t(language, 'buttons.categories')), 'menu:faq')]);
  rows.push([Markup.button.callback(truncateLabel(t(language, 'buttons.mainMenu')), 'nav:menu')]);
  return Markup.inlineKeyboard(rows);
}

function listenRow(language, mode) {
  if (mode === 'deaf') {
    return [];
  }
  return [[Markup.button.callback(truncateLabel(t(language, 'buttons.listen')), 'voice:speak')]];
}

export function answerKeyboard(language, mode = 'std') {
  return Markup.inlineKeyboard([
    ...listenRow(language, mode),
    [Markup.button.callback(truncateLabel(t(language, 'buttons.mainMenu')), 'nav:menu')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.askAnother')), 'nav:ask')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.human')), 'menu:human')],
  ]);
}

export function notFoundKeyboard(language, mode = 'std') {
  return Markup.inlineKeyboard([
    ...listenRow(language, mode),
    [Markup.button.callback(truncateLabel(t(language, 'buttons.transfer')), 'human:transfer')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.browseFaqs')), 'menu:faq')],
    [Markup.button.callback(truncateLabel(t(language, 'buttons.mainMenu')), 'nav:menu')],
  ]);
}

export function cancelKeyboard(language) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(truncateLabel(t(language, 'buttons.mainMenu')), 'nav:menu')],
  ]);
}
