const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

export function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  let text = value.normalize('NFKC').toLowerCase();
  text = text.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '');
  text = text.replace(ARABIC_DIACRITICS, '');
  text = text.replace(/[أإآٱ]/g, 'ا');
  text = text.replace(/ى/g, 'ي');
  text = text.replace(/ة/g, 'ه');
  text = text.replace(/ؤ/g, 'و');
  text = text.replace(/ئ/g, 'ي');
  text = text.replace(/['’‘`ʻ]/g, '');
  text = text.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

export function tokenize(value) {
  const text = normalizeText(value);
  if (!text) {
    return [];
  }
  return text.split(' ').filter((token) => token.length > 1);
}
