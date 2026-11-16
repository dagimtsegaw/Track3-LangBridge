# Contributing

Small changes only. Do not put keys in `module/` or in a commit.

## Setup

```bash
cd multilingual-assistant
cp .env.example .env
```

The example `HELPER_TOKEN` is nonempty and matches a local token that has been used. Replace it in your `.env` before you rely on the helper desk. Do not add a new real token to `.env.example`.

```bash
npm install --prefix api
node --test
```

68 tests passed on 16 Nov 2026 with Node v22.5.1. If you change a route, update `openapi.yaml` and `api/api.test.js` in the same change. If you change a user-visible sentence, change `module/i18n/en.json` and the other five language files. Leave `_needsReview` set until a reader of that language clears it.

## Checks

```bash
node --test
npm run axe
```

Axe needs Chrome or Edge and a network download of axe-core 4.10.3 the first time. A green axe run is not a screen-reader pass. Use [docs/TESTING.md](docs/TESTING.md) when you change the dialog, focus, or speech.

## Do not

- Do not log `GEMINI_API_KEY`, `ADDIS_API_KEY`, or `HELPER_TOKEN`.
- Do not commit `.env`, `api/data/escalations.json`, or `node_modules`.
- Do not edit the frozen files under `savanna/assets/` to hide a starter defect. Record host defects in `CONFORMANCE.md` instead.
- Do not add a language only in one JSON file. `languages.json` and the language file must both gain the code.

## Bots

The bots are the sibling folders `../telegram-support-bot` and `../telegram-jobs-bot`. They need two different `BOT_TOKEN` values. Run `npm test` in the bot you change.
