# Savanna Assistant

One script a course page can add. It searches that page's lesson, shows the section it used, speaks the reply when a voice exists, and can leave a ticket for a person. The API in `api/` is the server for model answers, speech, translation, tickets, and a short SMS demo. Keys stay on the server.

This folder also has the frozen Savanna starter under `savanna/`. The widget is the script tag at the bottom of those pages. It is not part of the starter's own JavaScript.

Submission files that the guide names at the repository root live here instead: `docker-compose.yml`, `openapi.yaml`, and `CONFORMANCE.md`. The track README is [../README.md](../README.md).

## Folder tree

`node_modules` is omitted. `savanna/assets/` is the starter: 161 files. They are not listed one by one.

```
multilingual-assistant/
  .env.example          example env; HELPER_TOKEN is nonempty today; do not copy secrets into git
  .gitignore            ignores .env and api/data/*.json
  CONFORMANCE.md        WCAG notes for the widget
  CONTRIBUTING.md       how to change the module
  LICENSE               MIT
  Makefile              make serve runs docker compose up
  README.md             this file
  docker-compose.yml    nginx on 8080, API on 3000
  nginx.conf            proxies /api /sms /docs /helper /openapi.yaml; no gzip directive
  openapi.yaml          OpenAPI 3.0.3 for the API
  package.json          npm run axe; no runtime dependencies
  api/
    Dockerfile          node:22-alpine
    README.md           API run notes and limits
    api.test.js         route tests
    app.js              Express routes
    package.json        express, cors, dotenv, swagger-ui-express, yaml
    package-lock.json
    server.js           loads ../.env and listens
    data/               escalations.json is local and gitignored
    lib/                config, course, gemini, addis, retrieve, tickets, phone, sms, limit, social
    public/helper.html  helper desk
  demo/
    blank.html          page with no Bootstrap, plus the script
    content.json        lesson sections; sources jobs.json
    data/jobs.json      five test listings
    data/alx-knowledge.json  ALX FAQ and site pages used as extra sections
    extract-content.js  rebuilds content.json from the concept page
    build-alx-knowledge.js
    *.test.js
  docs/
    ARCHITECTURE.md
    TESTING.md
    FINAL_CHECK.md      historical check; do not treat as current if it disagrees with the code
    PROJECT_OVERVIEW.md historical
    TRACK3_CHECKLIST.md historical
  module/
    db-assistant.js     the script a host loads
    api-url.js          joins data-api to /v1
    help-link.js        Telegram URL and Android screen-share check
    page-translate.js   collect, send, restore host text
    calendar.js         Ethiopian calendar for am, ti, om
    regions.js          nearest-town language; does not store the position
    voice-match.js      command phrases
    i18n/               languages.json and en, am, om, ti, so, ar
    providers/          none, cloud, local (Ollama), advice, speech-browser, speech-cloud
    data/regions.json   34 towns; coordinates are marked approximate
    assets/.gitkeep
  savanna/              frozen starter plus jobs.html
    pages/concept-with-navigation.html
    pages/jobs.html     five JobPosting blocks
    pages/homepage-v1-paced.html
    pages/homepage-v1-self-paced.html
    assets/             161 starter files
  scripts/axe.mjs       downloads axe-core 4.10.3 and scans the widget
```

## How it works

**Startup.** The script defines `<db-assistant>` and, if the script tag has a mount `data-*` attribute, appends one element. It loads `i18n/languages.json` and `i18n/<code>.json`. English does not also fetch another language file. The shell stays hidden if English strings cannot be loaded. It then fetches `data-content`, any `sources` in that file, and `/demo/data/alx-knowledge.json`. If `data-api` is set and the provider is empty or `auto`, it calls `GET {api}/v1/health`. `ai: true` selects the cloud client. Otherwise it stays on keyword search.

**A question.** Empty input shows "Type a question first." Advice phrases are refused before search, with "Please talk to a person." Otherwise sections are scored in `providers/none.js`. The threshold is 0.5. A miss shows "I could not find this in the course." A hit shows an excerpt, or the model text, plus a Sources list. The API does the same scoring and does not call the model when nothing clears the threshold. A model error returns the excerpt with `mode: "offline-fallback"`.

**Voice.** Nothing speaks on load. Each assistant message has Listen and Stop. Amharic, Oromo, Tigrinya, and Somali try Addis when health says so, then Gemini if Addis returns 501, then a matching browser voice. English and Arabic try Gemini speech, then the browser. The microphone writes into the box after an agree step. It does not send by itself. Voice commands stay off until Settings is switched on.

**Language.** A specific `lang` wins. `auto` uses the saved code, then the browser languages, then English. An Africa/Addis Ababa time zone can offer Amharic. It does not switch by itself. "Suggest a language for my area" uses geolocation once, matches `regions.json`, and drops the coordinates. Arabic sets `dir="rtl"`.

**Talk to a person.** The dialog topics are tutor, careers, alerts, and accommodation. Leave a message POSTs `/v1/escalations`. Accommodation POSTs a ticket with up to eight sample listings. It does not open Telegram. The Telegram control is a link. If the post cannot be sent, the status is "Saved on this phone. It will send when you are online." The three send paths do not set `language` on the body, so the API stores `en`.

**Accessibility panel.** Contrast, dyslexia font, text size, spacing, large cursor, link highlight, and hover-read. Host changes go through `<style id="db-a11y-effects">` and classes on `<html>`. Details are in [CONFORMANCE.md](CONFORMANCE.md).

**Privacy.** Capture stays off until a click, except display tools restored from `localStorage`. "Clear my saved data" deletes `db-assistant:` keys in `localStorage` and `sessionStorage`. Server tickets are a JSON file. There is no delete route. See [../README.md](../README.md) for the full privacy table.

## Environment

Names only. "Set" means the local `.env` on this machine had a nonempty value on 16 Nov 2026. Values are not printed. `.env` is gitignored.

| Name | Used by | Required? | In `.env.example`? | Local `.env` |
| --- | --- | --- | --- | --- |
| `PORT` | API | Optional, default 3000 | No | Set |
| `AI_PROVIDER` | API, Compose | Optional, Compose default `none` | No | Set |
| `GEMINI_API_KEY` | API | Optional | No | Set |
| `GEMINI_MODEL` | API | Optional | No | Set |
| `GEMINI_TTS_MODEL` | API | Optional | No | Absent |
| `TTS_PROVIDER` | API | Optional, default `none` | No | Set |
| `ADDIS_API_KEY` | API | Optional | No | Set |
| `ADDIS_BASE_URL` | API | Optional | No | Set |
| `OLLAMA_BASE_URL` | API | Optional, only for Ollama | Yes, empty | Absent |
| `OLLAMA_MODEL` | API | Optional, only for Ollama | Yes, empty | Absent |
| `HELPER_TOKEN` | API list and PATCH | Optional for creating tickets | Yes, nonempty | Set, same value as the example |
| `TELEGRAM_BOT_USERNAME` | Health and the widget link | Optional | Yes, `alxtestsbot` | Set, `alxtestsbot` |
| `ALLOWED_ORIGINS` | CORS | Optional, Compose default `http://localhost:8080` | No | Set |

Replace the example helper token with your own. Do not commit a live token.

## Run and test

```bash
cd multilingual-assistant
cp .env.example .env
docker compose up --build
```

Then open http://localhost:8080/demo/blank.html , http://localhost:8080/pages/concept-with-navigation.html , http://localhost:8080/pages/jobs.html , http://localhost:8080/docs , and http://localhost:8080/helper .

```bash
node --test
npm run axe
```

On 16 Nov 2026, Node v22.5.1: `node --test` was 68 pass, 0 fail, 0 skipped. `npm run axe` was 0 module critical and 0 module serious. See [CONFORMANCE.md](CONFORMANCE.md). `docker compose config` exited 0. `docker compose up` was not run as a clean clone.

API-only notes: [api/README.md](api/README.md).

## API

Routes under `/api/v1/` plus `POST /sms/inbound`. Spec: [openapi.yaml](openapi.yaml). UI: `/docs`.

| Method | Path | Success |
| --- | --- | --- |
| GET | `/api/v1/health` | 200 |
| POST | `/api/v1/ask` | 200 |
| POST | `/api/v1/content` | 201 |
| POST | `/api/v1/tts` | 200 or 501 |
| POST | `/api/v1/translate` | 200, or 503 if Gemini is off |
| POST | `/api/v1/escalations` | 201 |
| GET | `/api/v1/escalations` | 200 with the helper token, else 401 or 503 |
| PATCH | `/api/v1/escalations/{ticketId}` | 200, or 404 if the id is unknown |
| POST | `/api/v1/webhooks` | 201 |
| POST | `/sms/inbound` | 200 plain text, at most 160 characters |

Copy-paste curls are in [../README.md](../README.md).

## Use it on another website

Three ways to test.

**1. Same server.** The commands above. `data-api="/api"` and `data-content="/demo/content.json"` match the pages in this folder.

**2. Second local origin.** Keep Compose on port 8080. Serve a small HTML file on another port. Point the script, `data-api`, and `data-content` at `http://localhost:8080/...` with full URLs. Add `http://localhost:THAT_PORT` to `ALLOWED_ORIGINS` and recreate the API container. Until nginx sends CORS on `/module/`, the language fetch from the other port fails and the panel stays hidden. Same-origin test 1 does not have that problem.

**3. Tunnel.** Run Compose, then a tunnel to port 8080. Use the `https://` URL as the page, the script, and `data-api`. Set `ALLOWED_ORIGINS` to the page origin. The tunnel URL changes each run. Do not put API keys in the page.

More attribute and event detail is in [../README.md](../README.md).

## Add a language

1. Copy `module/i18n/en.json` to `module/i18n/<code>.json` and translate every user-visible string. Keep the keys.
2. Put `code`, `name`, `dir`, `speech`, and `addis` in that file's `language` object and in `module/i18n/languages.json`. Use `"dir": "rtl"` only when the script needs RTL.
3. Run `node --test`. The catalog test fails if a key is missing or a sentence is still the English sentence.
4. Restart the API. It reads `languages.json` at startup.

You do not edit `help-link.js` or `speech-browser.js` for the new code. Speech tags and Addis ids come from the list.

## Tests and axe

| Command | Result on 16 Nov 2026 |
| --- | --- |
| `node --test` | 68 pass, 0 fail, 0 skipped, Node v22.5.1 |
| `npm run axe` | axe-core 4.10.3, viewport 1280×900, Chrome. Module 0 critical / 0 serious on blank, concept, and jobs, five states each. Concept host: 1 critical and 4 serious per state. |

Manual scripts that were not run: [docs/TESTING.md](docs/TESTING.md).

## Known limits

- Widget tickets omit `language`, so they are stored as `en`.
- The configured bot username is `alxtestsbot`. The code fallback is `alxjobsbot`. @alxjobsbot does not read the `start` payload. @alxtestsbot does.
- `.env.example` is missing several variables the API reads, and its `HELPER_TOKEN` is nonempty.
- Page translation's "Experimental" label is commented out.
- Advice is a phrase list.
- Ollama was tested with a fake `fetch` only.
- Oromo, Tigrinya, and Somali speech were not listened to. Somali has no default Addis voice id.
- Translations still have `_needsReview` flags. Counts are in the root README.
- SMS is a JSON demo. Tigrinya SMS with no `language` field is searched as Amharic.
- Screen share is a local preview. Chrome on Android is offered "send this page" instead.
- nginx does not gzip, and it does not send CORS on `/module/`.
- There is no service worker.
- Open Badges and LTI 1.3 were not built.
- Co-designer, NVDA, TalkBack, Slow 3G, and a clean-clone Compose start are not recorded.
- `data-theme` is stored and unused.
- `api/data/alx-kb.json` is not read by the server. The loaded knowledge file is `demo/data/alx-knowledge.json`.
