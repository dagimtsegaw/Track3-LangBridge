# ALX Telegram learning assistant

Multilingual Telegram bot for ALX learners. It answers from the same ALX information as Savanna Assistant. When Gemini is configured, Gemini writes the answer from that information. If the question is outside it, the bot says it could not find an answer and can offer human help.

This bot is a separate module. It does not use a database. With `ANSWER_PROVIDER=gemini` and `GEMINI_API_KEY` set, typed questions are answered by Gemini from the FAQ and the extra ALX site pages. Button answers stay the prepared FAQ text. If Gemini is not configured, typed questions use the local FAQ match.

Native speakers should review the Amharic, Afaan Oromo, Tigrinya, Somali, and Arabic text before a production deployment.

## What it does

- Asks the learner to choose one of six languages on `/start`.
- Shows a translated main menu.
- Browses FAQ categories and prepared questions with inline buttons.
- Matches a typed question to the FAQ when the match is confident.
- Says when it does not have a reliable answer, and offers human help.
- Forwards that question to `HUMAN_SUPPORT_CHAT_ID` only after Telegram accepts the message.
- Lets configured admin accounts reply with `/reply`.
- After the language choice, asks whether answers should be text, text plus a voice message, or text with no audio.
- Reads answers aloud for blind and low-vision learners. Amharic, Afaan Oromo, Tigrinya, and Somali use Addis Voices. English and Arabic use Edge TTS.

Supported languages:

| Code | Language |
| --- | --- |
| `en` | English |
| `am` | Amharic (አማርኛ) |
| `om` | Afaan Oromo |
| `ti` | Tigrinya (ትግርኛ) |
| `so` | Somali (Soomaali) |
| `ar` | Arabic (العربية) |

Arabic messages are marked for right-to-left display.

## Technologies

- Node.js, ES modules
- [Telegraf](https://telegraf.js.org/) for the Telegram Bot API
- `dotenv` for environment variables
- `fuse.js`, together with phrase and token checks, for FAQ search
- Node.js built-in test runner

## Create a bot with BotFather

1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts.
3. Copy the token BotFather gives you. Treat it like a password.

## Configure `.env`

From this folder:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Put the token in `.env`:

```env
BOT_TOKEN=123456789:the-token-from-botfather
```

The bot reads `process.env.BOT_TOKEN`. The token is not written in source code. `.env` is listed in `.gitignore`. Do not commit it, and do not paste it into logs or chat.

`ANSWER_PROVIDER=gemini` sends a typed question to Gemini together with the matching FAQ entries and site pages. The model is told to answer only from that text. If nothing matches, or Gemini says it could not find the answer, the learner sees the not-found message. Leave `GEMINI_API_KEY` empty to stay on the local FAQ. `BACKEND_API_BASE_URL` is the course API origin. The bot POSTs `/api/v1/ask` and `/api/v1/escalations`. It does not send `BACKEND_API_KEY`. If the ask call fails on the network, the local FAQ is used.

### Voice

`/mode` chooses how answers arrive:

- Standard: text, with a Listen button
- Blind / low vision: the same text, plus an audio message
- Deaf / hard of hearing: text only, and no Listen button

`ADDIS_API_KEY` turns on Addis Voices for Amharic (`am`), Afaan Oromo (`om`), Tigrinya (`ti`), and Somali (`so`). English and Arabic keep Edge TTS and do not need that key. If the key is empty, Amharic and Somali fall back to Edge. Afaan Oromo and Tigrinya stay as text until Addis returns audio. Voice notes sent by the learner are not transcribed. The question still has to be typed.

### Optional human support chat

`HUMAN_SUPPORT_CHAT_ID` is the chat that should receive unanswered questions.

- For a person, use their numeric Telegram user id.
- For a group, add the bot to the group and use the group’s numeric chat id. Group ids are negative.

A person can read their id from [@userinfobot](https://t.me/userinfobot). For a group, send any message in that group, then open this URL in a browser while replacing the token:

`https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`

Find `chat.id` in the JSON. Do not share that URL. It contains the bot token.

If `HUMAN_SUPPORT_CHAT_ID` is empty, the bot does not pretend that a person received the question. It sends the learner to the official ALX support portal instead.

### Admin replies

`ADMIN_TELEGRAM_IDS` is a comma-separated list of numeric Telegram user ids:

```env
ADMIN_TELEGRAM_IDS=123456789,987654321
```

Only those accounts can use:

```text
/reply <telegram_chat_id> <message>
```

The bot delivers that message to the learner. Other users are rejected. The forwarded support message includes the learner’s first name, username when Telegram provides one, user id, selected language, question, and the time in UTC.

## Install and run

```bash
cd telegram-bot
npm install
```

Start development (restarts when files change):

```bash
npm run dev
```

Production start:

```bash
npm start
```

The process uses long polling. It checks that `BOT_TOKEN` is present before connecting. Stop it with Ctrl+C.

Test:

```bash
npm test
```

## Commands

| Command | Action |
| --- | --- |
| `/start` | Choose a language |
| `/menu` | Open the main menu |
| `/language` | Choose a different language |
| `/mode` | Text, voice, or no audio |
| `/help` | How to use the bot |
| `/cancel` | Stop the current step and return to the menu |
| `/privacy` | What temporary data is held |
| `/reply` | Staff only. Send a reply to a learner chat |

Unknown commands get a short explanation. The bot is meant for a private chat.

## How language selection works

`/start` shows six inline buttons. The choice is saved on the Telegraf session and used for menus, FAQ text, errors, help, and privacy. `/language` opens the same selector. There is no database, so the choice is kept in memory only.

## FAQ data

FAQ entries live in `src/data/data.js`. Interface text lives in `src/data/locales.js`.

Each FAQ entry has:

- `id` — stable id used by inline buttons
- `category` — `about`, `programmes`, `admission`, `learning`, `career`, or `support`
- `question`, `keywords`, and `answer` — one value for each language code
- `sourceUrl` — official ALX page the answer is based on

Facts are limited to what ALX publishes on:

- https://www.alxafrica.com/about/
- https://www.alxafrica.com/programmes/
- the linked programme pages
- https://ehub.alxafrica.com/

The bot does not state tuition, scholarship amounts, eligibility rules, opening dates, or a promise of admission, employment, or income. If a question is not in the FAQ, the result is `not_found`.

### Add a FAQ entry

1. Add an object to `faqEntries` in `src/data/data.js`.
2. Fill `question`, `keywords`, and `answer` for `en`, `am`, `om`, `ti`, `so`, and `ar`.
3. Keep the answer to the same facts in every language. Add a real `sourceUrl`.
4. Use specific keywords. Avoid single generic words such as `alx`, `career`, or `support`.
5. Run `npm test`.

Matching lives in `src/services/faqService.js`. It normalizes text, prefers an exact question or a distinctive phrase, and uses Fuse.js only as a strict extra signal. A weak or tied match returns `not_found`.

## Answer provider

Handlers ask `src/services/answerService.js` for an answer. They do not read `data.js` themselves.

With Gemini configured, a typed question returns:

```js
{ status: 'answered', answer: '...', sourceUrl: 'https://...' }
```

or, when the information does not contain the answer:

```js
{ status: 'not_found', answer: null, sourceUrl: null }
```

Without a Gemini key, the same function uses the local FAQ match and returns that same shape.

## Current limitations

- Language, the current step, and the last unanswered question are stored in memory. They are lost when the process restarts.
- There is no database and no learner history.
- Human forwarding works only when `HUMAN_SUPPORT_CHAT_ID` is set, and only after Telegram accepts the message. That is not the same as an ALX representative receiving it in eHub.
- Admin replies are also in memory: the learner’s language is remembered only until the process restarts.
- Translations are an initial draft for review.
- The bot is not the official ALX helpdesk and cannot submit an application.
