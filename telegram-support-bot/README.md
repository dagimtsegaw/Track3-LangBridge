# ALX support bot (@alxtestsbot)

live demo: https://t.me/alxtestsbot

A Telegram bot for course questions and a person. It is meant to run beside the Savanna Assistant API in [../multilingual-assistant](../multilingual-assistant). The track overview is [../README.md](../README.md).

When `BACKEND_API_BASE_URL` is set, typed questions go to `POST /api/v1/ask` first. A failed call falls back to the local FAQ in `src/data/`. A person request posts `POST /api/v1/escalations` and, if `HUMAN_SUPPORT_CHAT_ID` is set, also sends a Telegram message to that chat.

This folder has no `.env.example`. Create `.env` yourself and do not commit it. `.gitignore` ignores `.env`.

## Features

- Six languages: `en`, `am`, `om`, `ti`, `so`, `ar`. Arabic messages are marked for right-to-left.
- Private chats only. A group gets a short refusal.
- Local FAQ, plus the course API when the base URL is set.
- `/alerts` asks the course API for current listings and says automatic push is not built.
- Talk to a person: a ticket on the API, and an optional staff chat message.
- Listen button. English and Arabic use Edge TTS. Amharic and Somali use Addis when `ADDIS_API_KEY` is set, otherwise Edge. Oromo and Tigrinya stay text if Addis returns no audio.
- Access modes: standard, blind (text plus voice), deaf (no audio).
- Long polling. `bot.launch({ dropPendingUpdates: true })`. No webhook server.
- Rate limit: 20 messages in 10 seconds per user, then a short wait.

## Commands

Published from `src/data/locales.js`:

| Command     | English description                                   |
| ----------- | ----------------------------------------------------- |
| `/start`    | Choose your language, or apply a `lang_topic` payload |
| `/menu`     | Open the main menu                                    |
| `/language` | Change language                                       |
| `/mode`     | Accessibility: voice or text                          |
| `/help`     | How to use this bot                                   |
| `/cancel`   | Cancel and show the menu                              |
| `/alerts`   | Current job listings from the course API              |
| `/privacy`  | What the bot keeps in memory                          |

`/reply` is for ids in `ADMIN_TELEGRAM_IDS` only. The test `only configured admins can use /reply` passed.

## Folder tree

```
telegram-support-bot/
  package.json          telegraf, dotenv, fuse.js, msedge-tts
  package-lock.json
  .gitignore            ignores .env
  src/bot.js            Telegraf, session, polling
  src/config.js         env names
  src/data/locales.js   six languages
  src/data/data.js      FAQ entries
  src/data/siteKnowledge.json
  src/handlers/         start, menu, FAQ, language, human, messages
  src/keyboards/
  src/services/         answer, FAQ, speech, escalation
  src/utils/            rate limit, redacted logs
  tests/                node:test files
```

There is no database file. Session state is memory and is dropped on restart.

## Environment

The code reads these names. "Local `.env`" is set or empty on this machine on 16 Nov 2026. Values are not printed. There is no `.env.example` in this folder.

| Name                    | Required? | Local `.env` | Notes                                                                   |
| ----------------------- | --------- | ------------ | ----------------------------------------------------------------------- |
| `BOT_TOKEN`             | Required  | Set          | Bot exits if empty.                                                     |
| `HUMAN_SUPPORT_CHAT_ID` | Optional  | Set          | Empty: no staff Telegram message. A ticket can still be posted.         |
| `ADMIN_TELEGRAM_IDS`    | Optional  | Set          | Comma-separated. Empty: nobody can `/reply`.                            |
| `ALX_WEBSITE`           | Optional  | Set          | Default `https://www.alxafrica.com/`.                                   |
| `ALX_ABOUT_URL`         | Optional  | Set          | Default `https://www.alxafrica.com/about/`.                             |
| `ALX_PROGRAMS_URL`      | Optional  | Set          | Default `https://www.alxafrica.com/programmes/`.                        |
| `ALX_SUPPORT_URL`       | Optional  | Set          | Default `https://ehub.alxafrica.com/`.                                  |
| `ANSWER_PROVIDER`       | Optional  | Set          | `local` or `gemini`. Anything else uses the local FAQ. Default `local`. |
| `GEMINI_API_KEY`        | Optional  | Set          | Used only if the course API is not used and the provider is `gemini`.   |
| `GEMINI_MODEL`          | Optional  | Set          | Default `gemini-3.1-flash-lite`.                                        |
| `BACKEND_API_BASE_URL`  | Optional  | Set          | Empty: local FAQ only. Set: `POST /api/v1/ask` first.                   |
| `BACKEND_API_KEY`       | Optional  | Empty        | Read and not sent.                                                      |
| `ADDIS_API_KEY`         | Optional  | Set          | Empty: Oromo and Tigrinya stay text.                                    |
| `ADDIS_BASE_URL`        | Optional  | Set          | Default `https://api.addisassistant.com`.                               |

## How it calls the assistant API

Base: `BACKEND_API_BASE_URL` with trailing slashes removed. Timeout: 10 seconds. Header: `content-type: application/json` only.

Ask:

```http
POST {BACKEND_API_BASE_URL}/api/v1/ask
{ "question": "...", "language": "am" }
```

`language` is the session language. `sections` is not sent, so the API searches the course loaded on the server. `BACKEND_API_KEY` is not sent. The test `getAnswer posts to the course API and does not send the API key` passed.

- `mode: "advice"` becomes a refusal. The learner is pointed at a person.
- A non-empty `answer` is shown, with the first source URL if present.
- `answer: null` stays not found. The local FAQ is not used for that result.
- A throw, a timeout, or a non-200 status uses the local FAQ if fallback is on.

Ticket:

```http
POST {BACKEND_API_BASE_URL}/api/v1/escalations
{ "language": "am", "topic": "tutor", "conversation": [{ "role": "learner", "text": "..." }] }
```

`topic` must be `tutor`, `careers`, `alerts`, or `accommodation`. Anything else is sent as `tutor`. No `page` and no `context`. Creating a ticket does not send the helper token.

If the API base is empty, no ticket is posted. If the staff chat is also empty, the learner is told live support is not connected and is given `ALX_SUPPORT_URL`. If the API base is set and the post succeeds, the learner sees "A tutor will answer. It may take until morning." even when the staff chat is empty. That is why `npm test` fails one test on a machine whose `.env` sets `BACKEND_API_BASE_URL`. The test `human escalation explains the gap when no support chat is configured` does not clear that variable. It expects `/not connected/i`. The reply is the wait sentence. 40 other tests passed.

The local FAQ fallback does not use the widget's advice phrase list. The API path does.

## Start payload

`/start` with no payload opens the language picker.

A payload that matches `^(en|am|om|ti|so|ar)_(tutor|careers|alerts|accommodation)$` sets `session.language` and `session.topic` and opens the main menu. `accommodation` also starts a person request, with the accommodation sentence for that language. The test `a start payload opens the main menu and accommodation opens a ticket` passed.

The widget builds the same shape. With the API `.env` in this checkout, health names `alxtestsbot`, so the widget link opens this bot. See [../README.md](../README.md).

## Languages and voice

UI strings are in `src/data/locales.js`. FAQ answers are in `src/data/data.js`, with a field per language. The test `every FAQ has the same verified facts in all six languages` passed.

Voice is Edge (`msedge-tts`) or Addis. Tests mock the HTTP calls. This pass did not play a voice note in Telegram. Oromo and Tigrinya have no Edge voice, so they stay silent when Addis has no audio. The text is still sent. The test `Oromo stays silent when Addis has no audio, and Somali falls back to Edge` passed.

The bot does not accept a voice message from the learner. The locale string says to type.

## Tests

```bash
cd telegram-support-bot
npm install
npm test
```

On 16 Nov 2026, Node v22.5.1: 40 pass, 1 fail, 0 skipped. One `punycode` deprecation from a dependency. The failure is the staff-chat test described above. It can also post a real ticket if the API is up and `BACKEND_API_BASE_URL` points at it.

## Run beside the API

Terminal A, from `multilingual-assistant`:

```bash
docker compose up --build
```

Terminal B:

```bash
cd telegram-support-bot
npm install
npm start
```

Put `BOT_TOKEN` in `.env`. For course answers from the shared index:

```bash
BACKEND_API_BASE_URL=http://localhost:3000
```

Leave `GEMINI_API_KEY` and `ADDIS_API_KEY` empty if you want the local FAQ and Edge only. Oromo and Tigrinya will stay text.

Do not use the jobs bot's token here.

## Token safety

`BOT_TOKEN` belongs only in `.env`. `.env` is gitignored. `src/utils/safeLog.js` redacts `BOT_TOKEN`, `GEMINI_API_KEY`, `ADDIS_API_KEY`, and `BACKEND_API_KEY` in error text. If a token was pasted into a chat, a commit, or a screenshot, revoke it in BotFather with `/revoke` and put the new token only in `.env`. This README does not contain a token.

## Limits

- `npm test` is not fully green while `BACKEND_API_BASE_URL` is set.
- Push job alerts are not built. `/alerts` is on demand.
- The local FAQ path does not apply the advice phrase list.
- Session data is lost on restart.
- Group chats are refused.
- Voice input from the learner is refused.
- Oromo and Tigrinya audio need a working Addis key. Tests do not prove a live voice.
- `BACKEND_API_KEY` is unused.
