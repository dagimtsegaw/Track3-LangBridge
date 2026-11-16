# Savanna Assistant

One script tag adds a multilingual help widget to a page. This repository is the ALX Digital Bridge Accessibility Hackathon 2026 module (Track 3). Phase 2 adds an API. When no model is configured, answers still come from the lesson text in the browser.

## Run

Docker serves the Savanna pages, the module, and the blank demo on port 8080, and the API on port 3000. Copy `.env.example` to `.env` before the first run. With the example values, no model is called.

```bash
docker compose up
```

`make serve` runs the same command.

- Savanna pages: <http://localhost:8080/pages/homepage-v1-paced.html>, <http://localhost:8080/pages/homepage-v1-self-paced.html>, <http://localhost:8080/pages/concept-with-navigation.html>
- Blank page (no Bootstrap): <http://localhost:8080/demo/blank.html>

`cd savanna && python3 -m http.server 8000` serves the frozen pages alone. The widget's script URL is `/module/db-assistant.js`, which that server does not host.

## Install

```html
<script src="https://HOST/module/db-assistant.js" data-lang="auto" data-api="https://HOST/api" data-content="/content.json" defer></script>
```

## Layout

```
README.md  CONFORMANCE.md  LICENSE  docker-compose.yml  nginx.conf  .env.example  openapi.yaml  Makefile
module/    db-assistant.js, i18n/ (en, am, om, ti, so, ar, languages.json), providers/none.js, providers/cloud.js, assets/
api/       Express server (ask, speech, translate, tickets, SMS, docs)
demo/      blank.html, content.json, data/
savanna/   starter pages, plus one script tag before </body>
```

## Check

```bash
npm install --prefix api
node --test
```

That runs the offline scorer, the language-file check, and the API tests. The API tests install `express`, `cors`, `dotenv`, `swagger-ui-express`, and `yaml` under `api/`. They mock Gemini and do not call it.

## Phase 3

Listen, the microphone, voice commands, and the host display tools are in the widget. Details and the honest limits are in `module/README.md`. On a machine with only English browser voices and no Addis or Gemini key, English can be spoken by the browser after a click. Amharic, Afaan Oromoo, Tigrinya, and Somali say that voice is not available unless Addis is configured or the device has a matching voice. Voice commands stay off until the person turns them on. They need Chrome and an internet connection.

## Phase 2 limits

`providers/cloud.js` calls `POST /api/v1/ask` only after `GET /api/v1/health` reports `ai: true`. Otherwise the widget says it is not connected and searches on the page. A model timeout returns the lesson excerpt and the widget says the model did not answer. Noto Sans Ethiopic is named and not downloaded. Addis speech needs the confirmations in `api/README.md`, including Somali, which is not in the published voice list.

The widget does not call speech until the person uses Listen, Read, hover-to-read, or a voice command they started. `db-assistant.js` on disk is about 160 KB. Language files, `speech-cloud.js`, `speech-browser.js`, `voice-match.js`, `regions.js`, `page-translate.js`, `help-link.js`, and `data/regions.json` load when needed.

## Phase 4 limits

The area language is a guess from the nearest town in `module/data/regions.json`. The coordinates are approximate and need review by a local reader. The check works on HTTPS or localhost. The position is not stored and is not sent. Outside Ethiopia, or when the browser will not share a position, the current language stays.

Page translation needs Gemini (`ai: true` on `/api/v1/health`). It sends the visible page text to that API only after the person presses Translate this page. It does not use the Google Translate widget or the Chrome Translator API. A page the site is already translating with Google Translate is left alone. The whole page body is included, not only `<main>`. At most about 60,000 characters of distinct text are sent, on-screen text first. Show original puts the previous text back. If translation is not connected, the panel says so and mentions the browser's own Translate option.

The lesson file marks its sections with `h4`, so a page with no `data-content` only indexes `h1`–`h3`. The Savanna pages ship with `data-content="/demo/content.json"`, which includes those `h4` sections.

## Phase 5

Talk to a person is one button in the panel. It opens a dialog. A tutor answers, and that can take until morning. The person can leave a message, open Telegram, or read how the text-message demo works.

Leave a message calls `POST /api/v1/escalations` with the conversation so far, the language, the topic, and the page address, heading, and any selected text. If the phone is offline, or the request does not go through, the message is kept in `localStorage` under `db-assistant:outbox` and the panel says: "Saved on this phone. It will send when you are online." It sends when the browser is online again. Clear my saved data removes that queue.

Telegram link, when a bot username is set:

```text
https://t.me/<username>?start=<lang>_<topic>
```

`start` payload is `lang_topic`. `lang` is the widget language: `en`, `am`, `om`, `ti`, `so`, or `ar`. `topic` is one of `tutor`, `careers`, `alerts`, `accommodation`. Example: `https://t.me/SavannaTutorBot?start=am_accommodation`. The username comes from `GET /api/v1/health` field `telegram` (`TELEGRAM_BOT_USERNAME`, the leading `@` is dropped) or from `data-telegram` on the script tag. The attribute wins when both are set. This repository does not include the bot. If neither name is set, the panel says Telegram is not set up.

Text messaging on this site is a documented demo. There is no phone number. `POST /sms/inbound` takes JSON `{ "from", "text" }` and returns plain text of at most 160 characters. See `api/README.md`.

"I need an accommodation for my interview" opens a ticket with `topic` `accommodation` and the sample listings from `demo/data/jobs.json`. The widget dispatches `db-assistant:escalated` with `{ ticketId }` after the server accepts the ticket.

Screen sharing is off until the person turns it on in Settings and then presses Share my screen. That press is the only call to `getDisplayMedia`. A bar says "You are sharing your screen" and explains that this is a preview on the device: a helper cannot see it, because this page has no helper connection. Stop ends it. Chrome for Android is treated as unsupported even when `getDisplayMedia` exists. The setting then offers "Send what page I'm on", which puts the page address, heading, and selected text on a helper ticket. The helper desk at `/helper` shows that page context and any listings on the ticket.
