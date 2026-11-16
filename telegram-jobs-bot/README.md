# Job alerts bot (@alxjobsbot)

A Telegram bot that scrapes Ethiopian job boards and sends new listings to subscribers. It does not call the Savanna Assistant API and it does not read `multilingual-assistant/demo/data/jobs.json`. Those five listings are test data for the widget. This bot's listings come from the boards below.

The track overview is [../README.md](../README.md). The course bot is [../telegram-support-bot/README.md](../telegram-support-bot/README.md). Use a different BotFather token for each bot.

## Features

- Long polling. `bot.launch({ dropPendingUpdates: false })`. No listen port.
- Six languages: `en`, `am`, `om`, `ti`, `so`, `ar`.
- Access modes: standard (title, source, link), blind (plain text and a voice note), deaf (short card, no audio).
- Category filters. An empty choice means all jobs.
- `/jobs` sends the latest listings now.
- A timer pushes listings that this chat has not been sent. First run about 30 seconds after start, then every 2 hours.
- LinkedIn search links for Ethiopia, built from the chosen categories. Those are search URLs, not scraped LinkedIn pages.
- `/stop` deletes that chat from `users`.

## Commands

From `src/data/catalog.js`:

| Command | What it does |
| --- | --- |
| `/start` | Subscribe and show the language list |
| `/language` | Change language |
| `/categories` | Choose job types |
| `/mode` | Standard, blind, or deaf |
| `/jobs` | Show the latest jobs now |
| `/linkedin` | LinkedIn search links |
| `/help` | List commands |
| `/stop` | Unsubscribe |

`/help` is registered. It is not in the `HELP` array that `setMyCommands` publishes, because that array has no `/help` row. The handler still answers `/help`.

## Folder tree

```
telegram-jobs-bot/
  package.json          telegraf, dotenv, msedge-tts, playwright
  package-lock.json
  .env.example          names only; BOT_TOKEN empty
  .gitignore            ignores .env
  src/bot.js            polling and the 2 hour timer
  src/config.js         env and timings
  src/db.js             SQLite users, seen links, translation cache
  src/data/catalog.js   sources, languages, categories
  src/handlers/commands.js
  src/handlers/callbacks.js
  src/keyboards/
  src/services/scraper.js   Playwright Firefox
  src/services/jobs.js
  src/services/broadcast.js
  src/services/delivery.js
  src/services/speech.js
  src/services/render.js
  src/services/translate.js
  tests/
```

## Data sources

Playwright Firefox opens these listing pages (`src/data/catalog.js`):

| Name | URL |
| --- | --- |
| EthioJobs | `https://ethiojobs.net/jobs` |
| GeezJobs | `https://geezjobs.com/jobs-in-ethiopia` |
| HaHu Jobs | `https://www.hahu.jobs/` |
| Ezega | `https://www.ezega.com/Jobs` |
| EmployEthiopia | `https://employethiopia.com/` |
| Ethiopian Reporter Jobs | `https://www.ethiopianreporterjobs.com/` |

Scraped titles and links are cached for 600 seconds. Tests parse saved HTML shapes. They do not open a live board. A live scrape can fail when a site changes its markup.

This bot does not use the assistant API and does not use `jobs.json`.

**Legal note.** Scraping these boards may breach their terms of use. The scraper is for this demo only. Do not run it as a product, and do not republish the listings as your own vacancies.

## Alerts

Push: `firstBroadcastMs` is 30 seconds, then `intervalMs` is 2 hours. Each subscriber gets jobs whose links are not in `seen`. After a send, the link is stored. A 403 from Telegram removes that subscriber. Broadcast waits 50 ms between chats.

On demand: `/jobs` calls the same delivery path.

There is no per-user rate limit beyond that pause.

## bot.db

SQLite file. Path: `DB_PATH`, or `bot.db` in this folder. The root `.gitignore` ignores `*.db`. A `bot.db` file was on this machine (69632 bytes). Its rows are not listed here.

| Table | Columns | What |
| --- | --- | --- |
| `users` | `chat_id`, `lang`, `cats`, `mode` | One row per subscriber. `/stop` deletes the row. |
| `seen` | `link` | Job URLs already broadcast. Not deleted by `/stop`. |
| `tcache` | `lang`, `src`, `out` | Translation cache. |

`src/db.js` adds `lang`, `cats`, and `mode` if an older file lacks them. The test `older databases gain the language, category, and mode columns` passed.

## Environment

| Name | In `.env.example` | Required? | Local `.env` on 16 Nov 2026 |
| --- | --- | --- | --- |
| `BOT_TOKEN` | Yes, empty | Required. The process exits if empty. | Set |
| `ADDIS_API_KEY` | Yes, empty | Optional | Set |
| `ADDIS_BASE_URL` | Yes, public Addis URL | Optional. Default `https://api.addisassistant.com`. | Set |
| `TRANSLATOR` | Yes, `auto` | Optional. `google` skips the local model. | Set |
| `NLLB_MODEL` | Yes, a public model id | Optional. Default `Xenova/nllb-200-distilled-600M`. | Set |
| `DB_PATH` | **No. The code reads it.** | Optional. Default `bot.db` in this folder. | Absent |

Do not put the token in `.env.example`.

## Start payload

`handleStart` does not read `ctx.startPayload`. `/start` with `en_alerts` or any other payload still shows the six-language list and, if the chat is new, stores `lang` as `en`. The test `start subscribes the chat and shows six languages` passed.

The widget's link is `https://t.me/<user>?start=<lang>_<topic>` with `lang` in `en am om ti so ar` and `topic` in `tutor careers alerts accommodation`. This bot ignores that string. @alxtestsbot reads it. The API `.env` in this checkout sets `TELEGRAM_BOT_USERNAME=alxtestsbot`, so the widget opens the support bot, not this one, after health returns.

## Languages and voice

The language list is in `src/data/catalog.js`. Job titles are translated off English unless the subscriber's language is `en`.

`TRANSLATOR=auto` tries to import `@huggingface/transformers` and run NLLB. That package is not in `package.json` or the lockfile. Until it is installed, the import fails and the code calls `https://translate.googleapis.com/translate_a/single`. That sends the English string and the target language code to Google. `TRANSLATOR=google` skips NLLB and uses that URL immediately. Translations are cached in `tcache`.

Speech: Addis for `am`, `om`, `ti`, and `so` when `ADDIS_API_KEY` is set. English and Arabic stay on Edge. If Addis returns nothing, Amharic and Somali fall back to Edge. Oromo and Tigrinya have no Edge voice, so the titles are read in English. Tests mock this. Nobody listened in this pass.

## Playwright

The scraper launches Firefox:

```bash
cd telegram-jobs-bot
npm install
npx playwright install firefox
```

`npm test` does not download a browser. `npm start` will fail on the first scrape if Firefox is missing.

## Tests

```bash
npm test
```

On 16 Nov 2026, Node v22.5.1: 34 pass, 0 fail, 0 skipped. One `punycode` deprecation from a dependency. The script is `node --experimental-sqlite --test` on the files in `package.json`. Tests do not open Telegram or a live board.

## Run beside the API

The API is optional for this bot. Run it if you also want the widget.

```bash
cd telegram-jobs-bot
cp .env.example .env
```

Set `BOT_TOKEN` in `.env`. Leave `ADDIS_API_KEY` empty to skip Addis.

```bash
npm install
npx playwright install firefox
npm start
```

Node must be 22.5 or newer. Send `/start` to @alxjobsbot. Use a token that is not the support bot's token.

## Token safety

`BOT_TOKEN` belongs only in `.env`. The example value is empty. `src/utils/safeLog.js` redacts `BOT_TOKEN` and `ADDIS_API_KEY` in logs. If a token leaks, revoke it in BotFather with `/revoke` and put the new value only in `.env`. This README does not contain a token.

## Limits

- Does not read `lang_topic`.
- Does not call `/api/v1/ask` or `/api/v1/escalations`.
- Does not serve the five test jobs on `jobs.html`.
- Scraping may break when a board changes, and it may breach the board's terms. Demo only.
- NLLB is not installed by `npm install`. The Google fallback is unofficial and can stop or block you.
- Oromo and Tigrinya voice falls back to an English reading.
- No per-user rate limit.
- `/stop` does not delete `seen` or `tcache`.
- `DB_PATH` is missing from `.env.example`.
