# Savanna Assistant — what the code does now

Read from the source on 16 Nov 2026. This file describes the code, not the plan. Sizes and the module/demo test run are from this read. API tests were not executed: `api/node_modules` is not installed. `docker compose up` was not run.

A local `.env` file exists. Keys that are set: `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `TTS_PROVIDER`, `ADDIS_API_KEY`, `ADDIS_BASE_URL`, `HELPER_TOKEN`, `TELEGRAM_BOT_USERNAME`, `ALLOWED_ORIGINS`, `PORT`. `GEMINI_TTS_MODEL` is unset (the server then uses its default). Values are not copied here. `.env.example` has a nonempty `HELPER_TOKEN` and a nonempty `TELEGRAM_BOT_USERNAME`. Those values are not copied here either.

---

## 1. Project in one paragraph

Savanna Assistant is a single script a website adds to its pages. It mounts a chat panel and an accessibility panel for a learner on a course page. The learner asks a question; the script searches that site's lesson text in the browser and, when a model is configured, sends the question and the matching sections to this repo's API. The API may call Gemini. If the search score is too low, the panel says the answer is not in the course and offers a person. The same script speaks answers, takes voice commands, changes the host page's contrast and type, suggests a language, can translate the host page through the API, and can leave a ticket for a helper. It is aimed at learners on the frozen Savanna course pages (and any other site that loads the script), doing the task of asking about the lesson and reaching a person when the lesson does not answer.

There is no Ollama client and no local model. The only model name in code is Gemini. "Offline" means keyword search in `module/providers/none.js`.

---

## 2. File tree

`node_modules` and `.git` are omitted. `savanna/assets/` is the frozen starter (161 files: CSS, JS, images, fonts). It is not listed file by file. The three pages and `savanna/index.html` each end with one script tag that loads the module. That is the widget's hook into the starter.

```
savanna-assistant/
├── .env                          local secrets; not committed; keys listed above
├── .env.example                  example HELPER_TOKEN and TELEGRAM_BOT_USERNAME only
├── .gitignore                    ignores node_modules, .env, api/data/*.json and *.tmp
├── .cursor/rules/project.mdc     hackathon brief for the editor; not loaded at runtime
├── CONFORMANCE.md                phase notes from earlier work; not runtime
├── LICENSE                       MIT
├── Makefile                      `make serve` runs docker compose up
├── README.md                     project readme (not rewritten by this pass)
├── docker-compose.yml            nginx on :8080 plus the API on :3000
├── nginx.conf                    routes /api /sms /docs /helper /openapi.yaml /module /demo
├── openapi.yaml                  hand-written spec for the API routes
├── package.json                  {"type":"module"} so Node can load the widget tests
├── test.mp3                      5,886 bytes; no reference in JS, HTML, or YAML
├── docs/
│   └── PROJECT_OVERVIEW.md       this file
├── api/
│   ├── .dockerignore             skips node_modules, data, tests, README
│   ├── .gitkeep
│   ├── Dockerfile                node:22-alpine, npm ci, node server.js
│   ├── README.md                 how to run the API
│   ├── api.test.js               route tests (not run here; express is not installed)
│   ├── app.js                    Express routes
│   ├── package.json              express, cors, dotenv, swagger-ui-express, yaml
│   ├── package-lock.json
│   ├── server.js                 loads ../.env and listens
│   ├── data/
│   │   ├── .gitkeep
│   │   ├── escalations.json      ticket store on this machine (gitignored pattern)
│   │   └── alx-kb.json           static-facts JSON; no JS file reads it
│   ├── lib/
│   │   ├── addis.js              Addis Voices 2 TTS
│   │   ├── config.js             env to a config object and the health body
│   │   ├── course.js             reads demo/content.json and its sources
│   │   ├── gemini.js             Gemini answer, translate, and speech
│   │   ├── limit.js              60 requests per IP per minute
│   │   ├── retrieve.js           threshold, top two sections, source list
│   │   ├── smsText.js            160-character SMS reply
│   │   └── tickets.js            JSON file store and ticket ids
│   └── public/
│       └── helper.html           helper desk page
├── demo/
│   ├── blank.html                empty page plus the script tag
│   ├── content.json              lesson sections extracted from the concept page
│   ├── content.test.js           checks that extract and the offline answer
│   ├── extract-content.js        rebuilds content.json from the concept HTML
│   └── data/
│       ├── .gitkeep
│       └── jobs.json             five fake job listings
├── module/
│   ├── README.md                 host install notes
│   ├── db-assistant.js           the script a host loads (243 KB)
│   ├── api-url.js                joins data-api with /v1/...
│   ├── api-url.test.js
│   ├── help-link.js              Telegram URL and screen-share support check
│   ├── help-link.test.js
│   ├── page-translate.js         collect, send, apply, restore host text
│   ├── page-translate.test.js
│   ├── regions.js                nearest-town language from coordinates
│   ├── regions.test.js
│   ├── voice-match.js            command, heading, and language phrase match
│   ├── voice-match.test.js
│   ├── assets/.gitkeep           empty; no images are shipped
│   ├── data/regions.json         34 towns; file says the coordinates are approximate
│   ├── i18n/
│   │   ├── languages.json        en, am, om, ti, so, ar
│   │   ├── en.json               English UI strings (the fallback)
│   │   ├── am.json               Amharic; "_needsReview": true
│   │   ├── om.json               Afaan Oromoo; "_needsReview": true
│   │   ├── ti.json               Tigrinya; "_needsReview": true
│   │   ├── so.json               Somali; "_needsReview": true
│   │   ├── ar.json               Arabic, dir rtl; "_needsReview": true
│   │   └── catalog.test.js       same keys as English; translations differ from English
│   └── providers/
│       ├── .gitkeep
│       ├── none.js               offline score and excerpt
│       ├── none.test.js
│       ├── cloud.js              GET /v1/health and POST /v1/ask
│       ├── speech-browser.js     speechSynthesis, matching language only
│       ├── speech-browser.test.js
│       ├── speech-cloud.js       POST /v1/tts and play the bytes
│       └── speech-cloud.test.js
└── savanna/
    ├── index.html                starter index, plus the script tag
    ├── README.md                 starter readme
    ├── pages/
    │   ├── homepage-v1-paced.html
    │   ├── homepage-v1-self-paced.html
    │   └── concept-with-navigation.html
    └── assets/                   unchanged starter (161 files)
```

---

## 3. File-by-file summary

### `module/db-assistant.js`

One classic script. It defines `<db-assistant>`, paints the UI in shadow DOM, and auto-mounts from the script tag when any `data-*` mount attribute is present.

**Size:** 248,836 bytes raw (6,501 lines). Gzip level 9: 49,203 bytes. This nginx config does not turn gzip on.

**Reads:** script attributes `data-lang`, `data-api`, `data-content`, `data-theme`, `data-provider`, `data-telegram` (copied onto the element as `lang`, `api`, `content`, `theme`, `provider`, `telegram`). `localStorage` keys `db-assistant:lang`, `db-assistant:tz-dismiss`, `db-assistant:commands`, `db-assistant:a11y`, `db-assistant:outbox`, `db-assistant:share`. Page translation cache is `sessionStorage` keys `db-assistant:tr:<lang>:<hash>:<length>` (written by `page-translate.js`). Fetches, relative to the script URL: `i18n/languages.json`, `i18n/<code>.json`, and dynamic imports of `api-url.js`, `help-link.js`, `page-translate.js`, `regions.js`, `voice-match.js`, `providers/none.js`, `providers/cloud.js`, `providers/speech-browser.js`, `providers/speech-cloud.js`, `data/regions.json` (via `regions.js`). Fetches the content URL and any `sources` it lists. Calls the API at `{data-api}/v1/health`, `/v1/ask`, `/v1/tts`, `/v1/translate`, `/v1/escalations`.

**Writes:** those localStorage keys; `sessionStorage` translation cache; one `<style id="db-a11y-effects">`; classes on `<html>` (`db-assistant-on`, `db-contrast`, `db-dyslexia`, `db-spacing`, `db-hover`, `db-cursor`, `db-links`); CSS variables `--db-launcher-lift`, `--db-a11y-start`, and related lift variables; an `id` on a heading that had none when the page is scraped. Events: `db-assistant:language`, `db-assistant:question`, `db-assistant:escalated` (`bubbles` and `composed` true).

**Depends on:** the files it imports, the browser (`customElements`, `fetch`, `speechSynthesis`, `SpeechRecognition` or `webkitSpeechRecognition`, `geolocation`, `getDisplayMedia`), and the API when `data-api` is set. No npm package. `data-theme` is stored on the element and never read again.

**Logical parts (line ranges are approximate):**

| Part | Lines | What it does |
| --- | --- | --- |
| Boot, keys, script URL | 1–65 | Finds the script tag. Language, command, a11y, outbox, and share keys. Recognition locale tags. |
| Language files | 67–252 | Loads `languages.json` and `i18n/<code>.json` relative to the script. Merges onto English. `dir` comes from `language.dir`. |
| Outbox, share flag, lazy imports | 254–330 | Ticket queue, screen-share preference, `import()` of providers and `help-link.js`. |
| Content index | 332–464 | Normalizes section JSON. Follows `sources`. If the file is missing, scrapes `h1`–`h3` in `<main>` (or `body`). |
| Accessibility state and host CSS | 500–689 | Defaults, load/save, and `applyHostEffects`. One style tag. Classes toggled off when the value is false or 100. |
| Widget CSS | 691–1745 | Shadow styles for launchers, chat, a11y panel, person dialog, share bar. |
| Small DOM helpers | 1747–1891 | Buttons, icons, overlap check used while placing launchers. |
| Element lifecycle and provider choice | 1893–2222 | `connectedCallback` applies saved a11y and calls `_load`. `_decideProvider`: `none` stays offline; `cloud` is cloud; omitted or `auto` with `data-api` reads health and picks cloud only when `ai` is true. |
| Launchers and both panels | 2224–2442 | Chat launcher and accessibility launcher. Chat `<dialog id="db-panel">`. A11y `<dialog id="db-a11y-panel">`. |
| Language control on the page | 2444–2710, 3186–3252, 5311–5425 | `<db-assistant-lang>` in the corner (its own shadow root). Select, consent offer, time-zone offer. Choosing a language saves `db-assistant:lang` and can start page translation. |
| Launcher placement | 2575–2662 | Fixed to the bottom start. If a side nav reaches the bottom of the window, the accessibility launcher sits just past it. |
| Chat wiring | 2726–3334, 3336–3636 | Send, chips, typing row, messages, sources, Listen and Stop on each assistant message. |
| Settings and info cards | 3638–4094 | Tabs, toggles, "Clear my saved data" (every `db-assistant:` key). |
| Accessibility actions | 4096–4218 | Contrast, dyslexia font, text size 100–200 step 10, spacing 100–200 step 20, hover read, large cursor, link highlight. |
| Voice | 4220–5103 | Health check on each speak, cloud then browser, mic dictation, command loop, command dispatch. |
| Page motion commands | 5031–5238 | Read page, read selection, scroll, headings, back, reload, change language, open talk-to-a-person. |
| Location and page translation | 5241–5820 | Geolocation only after the button. `POST /v1/translate`. Restore writes the saved text back. |
| Tickets | 271–302, 5822–6296 | Person dialog, topics, Telegram link, SMS explanation, post or queue, `online` flush. |
| Screen sharing | 6298–6451 | Toggle, `getDisplayMedia` only from the share button, local `<video>`, stop. |
| Registration | 6454–6501 | Defines `db-assistant` and an empty `db-assistant-lang`. `autoMount` appends one element. |

### Other module files

| File | Purpose | Main exports | Reads / writes | Depends on |
| --- | --- | --- | --- | --- |
| `api-url.js` | Join `data-api` to a `/v1` path. Absolute URLs stay as written. Anything else is rooted at the page origin, not the page folder. A trailing slash is stripped. | `apiUrl` | none | none |
| `help-link.js` | Build the Telegram link. Decide if screen share is offered. | `cleanBot`, `startPayload`, `telegramUrl`, `screenShareSupported`, `TOPICS` | none | none. The bot is not in this repo. |
| `regions.js` | Distance to towns. Does not store or send the position. | `loadRegions`, `haversineKm`, `matchArea` | fetches `data/regions.json` next to itself | none |
| `voice-match.js` | Match a transcript to command phrases (including a loose match), a heading, or a language name. Split long text for speech. | `normalizePhrase`, `matchCommand`, `matchHeading`, `matchLanguage`, `chunkText` | none | none |
| `page-translate.js` | Walk `body`, skip scripts/styles/the widget/editable nodes, send unique strings, write `nodeValue` or attributes back, restore originals. | `collectPageStrings`, `runPageTranslation`, `applyTranslations`, `restoreTranslations`, `watchPageAdditions`, cache helpers. Caps: 20 strings, ~3,000 characters per request, 60,000 characters total, 2,000 per string. | `sessionStorage` `db-assistant:tr:...` | caller supplies `send` |
| `providers/none.js` | Score sections. Copy an excerpt of at most ~320 characters. Never writes a sentence that is not in the section. | `THRESHOLD` 0.5, `scoreSection`, `excerpt`, `answer` | none | none |
| `providers/cloud.js` | Ask the API. | `prepare`, `answer`, `connected` | `GET /v1/health`, `POST /v1/ask` with up to 40 sections | `api-url.js` |
| `providers/speech-browser.js` | Speak only with a voice whose `lang` tag matches. No substitute language. | `matchingVoices`, `loadVoices`, `speak`, `stop` | `speechSynthesis` | none |
| `providers/speech-cloud.js` | Fetch audio and play it. | `prepare`, `speak`, `stop`, `audioType` | `POST /v1/tts` | `api-url.js` |
| `i18n/languages.json` | The picker list. Arabic is the only `dir: rtl`. | data | — | — |
| `i18n/*.json` | Every UI sentence and the `commands` / `names` maps. | data | — | — |
| `data/regions.json` | Ethiopia box, 150 km max, 20 km ambiguity, fallback `am`, 34 towns. `_note` says approximate. | data | — | — |
| `*.test.js` | Node tests. This pass: 43 passed under `node --test "module/**/*.test.js" "demo/**/*.test.js"`. | — | — | Node 22 |

### `api/`

| File | Purpose | Main functions / routes | Reads / writes | Depends on |
| --- | --- | --- | --- | --- |
| `server.js` | Process entry. | loads dotenv from the repo-root `.env`, `createApp`, `listen` | `.env` | `app.js`, `config.js` |
| `app.js` | All HTTP routes. See section 5. | `createApp` | tickets file, course files, in-memory webhooks and translation cache (200 entries) | express, cors, swagger, the lib files, `none.js` |
| `lib/config.js` | Env parsing. Keys are not logged. | `readConfig`, `healthBody` | env vars in section 5 | none |
| `lib/retrieve.js` | Same threshold as the widget. | `cleanSections` (max 40, text sliced to 8,000), `topSections` (score ≥ 0.5, within 0.15 of the best, max 2), `sourcesOf`, `offlineFrom`, `safeUrl` (http, https, site path, or hash) | none | `providers/none.js` |
| `lib/gemini.js` | Gemini REST. Key goes in `x-goog-api-key`, not the URL. | `createGemini().answer`, `.translate`, `.speak` | `generativelanguage.googleapis.com` | the key |
| `lib/addis.js` | Addis Voices 2. Header `x-api-key`. | `createAddis().speak`, `mockWav` | `ADDIS_BASE_URL` `/api/v1/voice/generations` and `/voices` | the key. File header lists four things still unconfirmed against a live key. Somali has no default voice id. |
| `lib/course.js` | Demo course for SMS and for `/ask` when the body omits `sections`. | `loadCourse` | `demo/content.json` and `sources` that start with `/demo/` or `.` | fs |
| `lib/smsText.js` | Cap the SMS body. | `fitSms` → at most 160 characters, source title in parentheses, or "Not in the course. Talk to a person." | none | none |
| `lib/tickets.js` | Append-only JSON file, one write at a time. | `createStore`, `newTicketId` (`db-` + 12 hex chars) | `api/data/escalations.json` via temp file and rename | fs |
| `lib/limit.js` | Per-IP counter. OPTIONS is not counted. | `rateLimit` default 60 / 60s | memory | none |
| `public/helper.html` | Desk UI. Token stays in the page script variable, not in storage. | `GET` and `PATCH /api/v1/escalations` with `Authorization: Bearer` | the API | none |
| `api.test.js` | Ask threshold, model fallback, SMS length, tickets, webhook body, translate. | — | temp ticket file | express. Not run here. |
| `Dockerfile` | Production image. Does not copy tests. | — | — | node:22-alpine |

`api/data/alx-kb.json` is on disk (a notes file about facts that should not be invented). No route or loader references it. `escalations.json` is the live ticket file for this checkout. Its contents are not copied here.

### `demo/`

| File | Purpose |
| --- | --- |
| `blank.html` | A page with no Bootstrap. Same script tag as the Savanna pages. Proves the widget does not need the starter CSS. |
| `content.json` | `{ title, sources: ["/demo/data/jobs.json"], sections: [{ id, title, url, lang, text }] }`. Eight sections from "The Future of the VA Industry". `lang` is `en`. URLs point at `/pages/concept-with-navigation.html#...`. |
| `data/jobs.json` | Five sections, ids `test-job-*`. Text says they are not real vacancies. |
| `extract-content.js` | `node demo/extract-content.js` rebuilds `content.json` from `savanna/pages/concept-with-navigation.html` (`#curriculum_navigation_content`). |
| `content.test.js` | The extract matches the file, jobs has five listings, and `none.answer` cites the shaping section or a job. Passed in this run. |

### Config, spec, tests already named

| File | Role |
| --- | --- |
| `docker-compose.yml` | `web` is `nginx:alpine`, port 8080, mounts `savanna`, `module`, `demo`, `nginx.conf`. `api` builds `./api`, port 3000, mounts `api/data`, `demo`, `module`, `openapi.yaml`. Env is interpolated from the project `.env` (Compose does that by default) with the defaults in the file. |
| `nginx.conf` | Proxies `/api/`, `/sms/`, `/docs`, `/helper`, `/openapi.yaml` to `api:3000`. Serves `/module/` and `/demo/` with `alias`. Everything else is the Savanna tree. Body limit 256k. No `gzip` directive. No `add_header` for CORS on `/module/` or `/demo/`. |
| `openapi.yaml` | OpenAPI 3.0.3, version 0.2.0. Servers `http://localhost:8080` and `http://localhost:3000`. Compared with the routes in section 5. |
| `.env.example` | Only `HELPER_TOKEN` and `TELEGRAM_BOT_USERNAME`. It does not list `AI_PROVIDER`, `GEMINI_API_KEY`, `TTS_PROVIDER`, `ADDIS_API_KEY`, or `ALLOWED_ORIGINS`. Those exist in `docker-compose.yml` and `config.js`. |
| `Makefile` | `make serve` → `docker compose up`. |

---

## 4. How it works, end to end

### a. Startup

1. The host page has `<script src=".../db-assistant.js" data-lang="auto" data-api="/api" data-content="/demo/content.json" defer></script>`.
2. If that script has any of `data-lang`, `data-api`, `data-content`, `data-theme`, `data-provider`, `data-telegram`, `autoMount` creates one `<db-assistant>`, copies the attributes, and appends it to `body`. It will not add a second one. A hand-written `<db-assistant lang="am" api="..." content="..." provider="none" theme="..." telegram="...">` is also valid; then the script should not carry those `data-*` attributes, or the existing element wins.
3. `connectedCallback` loads saved accessibility settings and applies them immediately (including hover-read if it was saved). The element stays `hidden` until English strings load.
4. Lazy loads, all by URL relative to the script file: `i18n/languages.json`, then `i18n/<code>.json` (and `en.json` underneath it). Providers, voice match, regions, page translate, and help-link load on first use via `import()`.
5. Language resolution is in (d). Then the shadow UI is built, content is fetched, and health is read if a provider decision needs it.
6. If `en.json` cannot be fetched, the shell stays hidden. No English sentences are hard-coded as a backup UI.

### b. A question

1. Send, or a topic chip, calls `_ask`. Empty input shows "Type a question first."
2. The question is appended as a user message. `db-assistant:question` fires with `{ text, language }`.
3. Content: `data-content` is fetched (URL resolved against the page). A `sources` array of strings is fetched the same way, with a seen-set so a file is not loaded twice. Each section needs a title or text. If there is no `data-content`, or the fetch fails, headings `h1`–`h3` inside `<main>` become sections and the panel says the lesson file could not be loaded.
4. `_decideProvider` picks `none` or `cloud` (see section 3). There is no third, local-model provider.
5. Cloud path (`providers/cloud.js`): `GET {api}/v1/health`. `connected` is true only when `ai` is true. Then `POST {api}/v1/ask` with `{ question, language, sections }` (max 40). The server does not trust the client score:
   - `cleanSections`, then `scoreSection` from `none.js`. Threshold **0.5**. Up to **two** sections within **0.15** of the best score.
   - No section at the threshold: `{ answer: null, sources: [], mode: "not-found" }`. Gemini is not called.
   - Sections match and `ai` is false (`AI_PROVIDER` is not `gemini`, or `GEMINI_API_KEY` is empty): the excerpt from `none.answer`, `mode: "offline"`.
   - Sections match and `ai` is true: `gemini.answer` with temperature 0.2 and max 512 tokens. The system text says: answer only from the sections, write in the user's language, name the section title, say it is not in the course if it is not, refuse medical, legal, and immigration advice and tell the person to talk to a human, and do not invent facts. Success: `mode: "gemini"`. Throw, timeout (12s), or empty text: the excerpt, `mode: "offline-fallback"`.
6. The widget, if cloud returns text, shows it. `offline-fallback` sets the status line to the English key `status.modelFailed`: **"The model did not answer. This reply is copied from the lesson."** A plain offline hit uses **"Offline mode: answers come from this page's lessons"**. A connected Gemini hit uses **"The configured model writes the answer from this page's lessons."**
7. If cloud is down, health failed, or the call returns no text and the mode is not `not-found`, the widget calls `none.answer` itself. A server `not-found` is kept; the widget does not search again.
8. A hit shows the text plus a **Sources** list (`sources.label`). Each source is a link with the section title and the section URL. The offline text is an excerpt of the section (sentence boundaries, ellipsis if it is not the whole section), not a paraphrase. A miss shows **"I could not find this in the course"** and the Talk to a person control stays in the panel.
9. The refusal rule is only in the Gemini prompt. `none.js` will still quote a section that happens to contain medical, legal, or immigration text. Nothing in the server inspects the answer for that.

### c. Voice

**Listen** is a button on each assistant message. Nothing speaks on load.

Order in `_speakPart`:

1. Read `GET /v1/health` again (the page-load result is not reused).
2. For `am`, `om`, `ti`, `so`: if `ttsAddis` is true, `POST /v1/tts`. The server then uses Addis when `TTS_PROVIDER=addis` and `ADDIS_API_KEY` is set. `TTS_PROVIDER=mock` returns a silent WAV and `X-DB-TTS: mock` for those four languages only. If Addis returns 501 and a Gemini key exists, the server falls through to Gemini speech. Somali has no built-in voice id; a catalog miss is 501.
3. For any other language (English and Arabic included): if `ttsGemini` is true, `POST /v1/tts` uses Gemini TTS (`GEMINI_TTS_MODEL`, default `gemini-2.5-flash-preview-tts`, voice name Kore). Addis is not called.
4. If cloud speech is off, or the request or `play()` fails, the widget uses `speechSynthesis` with a voice whose language tag matches. It does not substitute another language. No matching voice: "Voice is not available for this language on this device."
5. Browser speech is the fallback. It is not tried before Addis or Gemini when those flags are true.

Long text is split around 2,400 characters. A silent WAV is played during the click so mobile browsers allow later audio.

**Microphone:** `SpeechRecognition` or `webkitSpeechRecognition`. The first start shows a consent sentence. Agreement is kept in memory for the visit only (`_speechOk`), not in localStorage. Dictation writes into the question box and does not send. The person corrects and presses Send. Locales: `en-US`, `am-ET`, `ar-SA`, `so-SO`, `om-ET`, `ti-ET`. Missing API, denied mic, no device, and network errors each have their own sentence.

**Voice commands:** off until the Settings switch is turned on. The preference is stored (`db-assistant:commands=1`) but the microphone is not started on the next visit until the switch is pressed again. Matching uses the current language's `commands` plus the English phrases. A partial phrase can match; a tie uses the first command in the file. Commands cover open/close, both panels, contrast, cursor, links, hover, dyslexia font, text size, spacing, reset, scroll, headings, go to section, read page, read selection, stop, back, reload, change language, suggest language, share screen (moves focus to the button; it does not call `getDisplayMedia`), stop sharing, talk to a person, help, stop listening. "Share my screen" cannot start capture by itself because the browser requires a click.

Hover-read is separate: if the hover setting is on, pointerover on a paragraph or heading (not inside the widget) speaks up to 2,500 characters after 450 ms. That setting is restored from localStorage on the next visit, so it can speak without a new click.

### d. Language

**Detection order**

1. `lang` / `data-lang` other than `auto`: that code if it is in `languages.json`, otherwise English. The saved choice is ignored.
2. `auto`: `localStorage["db-assistant:lang"]` if it is in the list.
3. Then the first match in `navigator.languages`.
4. Then `en`.
5. Time zone does not switch the language. If nothing is saved, the language is not already Amharic, `Intl` time zone is `Africa/Addis_Ababa`, and `db-assistant:tz-dismiss` is not `1`, the panel offers Amharic. "Not now" stores the dismiss key.
6. "Suggest a language for my area" runs only after that button. Secure context required (HTTPS or localhost). `getCurrentPosition` with `enableHighAccuracy: false` and a 10 second timeout. Coordinates are passed to `matchArea` and then dropped. Outside the Ethiopia box: no suggestion. Inside: nearest town within 150 km. Farther than that, or two nearby towns with different languages within 20 km of each other: suggest Amharic. Switch is what saves the language.

**Saving:** `db-assistant:lang`. `db-assistant:language` fires with `{ language }`.

**RTL:** Arabic's bundle has `dir: rtl`. The widget, dialogs, and the language offer get `dir`. Other languages get `ltr`. Page translation sets `dir="rtl"` on translated parents only when the target is `ar`, and `restoreTranslations` puts the old `dir` back.

**Page translation status:** the code path is real (`page-translate.js` plus `_startPageTranslation`). It runs after the person picks a non-English language in the corner control and confirms. English is not a target. If health `ai` is false, the status says page translation is not connected and mentions the browser's own Translate. If the host already has Google Translate (`translated-ltr` / `translated-rtl`, `#google_translate_element`, or `.goog-te-combo`), this module hides its control and does not run. Text from the whole `body` is posted to `POST /v1/translate` in batches. Hidden text is counted and not sent. Results are cached in `sessionStorage`.

Limits in the current code, which a host will hit:

- The corner "Show original" button is created and wired, then `_syncPageButtons` always sets it `hidden`. Putting the original text back is done by choosing English (or another language) in the select, which calls `_showOriginalPage`.
- `_progressText` ignores the done/total arguments and always shows "Translating…". The string "Translating… {done} of {total}" is in `en.json` and unused.
- After any success, `_renderPageReport` clears the status. The summary string with counts is unused. A failure with zero successes shows a reason (`rate_limit`, `bad_key`, `bad_model`, `bad_response`) or "Page translation stopped."
- This pass did not click through a live page with Gemini. Unit tests cover batching, the character cap, and a failed batch. They do not open a browser.

### e. Talk to a person

The panel button opens a modal dialog. Topics: `tutor` (default), `careers`, `alerts`, `accommodation`. The message is the chat so far (max 39 turns) plus the textarea. Page fields are the URL, the heading nearest the top of the viewport, and the current selection.

**Post:** `POST {api}/v1/escalations` with `topic`, `conversation`, `page`, `context`. The widget does not set `language` or `contact`. The server then stores `language: "en"`. That is a bug relative to the selected UI language.

**Offline queue:** if `navigator.onLine` is false, or the post fails for a reason other than 400 or 413, the body is pushed to `db-assistant:outbox` (last 20). Status text is the translation of saved-on-this-phone. An `online` event flushes the queue and then fires `db-assistant:escalated` with `{ ticketId }`. No `data-api`: the panel says it cannot send. It does not pretend the queue will leave the phone.

**Telegram:** `https://t.me/<username>?start=<lang>_<topic>`. Username comes from the `telegram` attribute, otherwise from health `telegram` (`TELEGRAM_BOT_USERNAME` with a leading `@` stripped). `help-link.js` accepts 5–32 characters of letters, digits, and underscore. Example shape: `am_accommodation`. Unknown language becomes `en`. Unknown topic becomes `tutor`. The page does not see the Telegram chat. There is no bot process in this repository, so the bot does not call `/ask` and does not send job alerts. The Alerts topic only changes the ticket topic and the `start` payload.

**SMS:** the person dialog explains that there is no phone number. `POST /sms/inbound` is a JSON demo. Body `{ from?, text }`. The server always searches as language `en` against the demo course on disk (it ignores any `sections` and ignores the widget). Reply is `text/plain`, at most 160 characters, with the section title.

**Accommodation button:** topic `accommodation`, and `context` is up to eight sections whose URL contains `jobs.json` or whose id starts with `test-job-`. If those are not already loaded, it fetches `data/jobs.json` next to the content file.

**Helper desk:** `GET /helper` serves `helper.html`. The person pastes the helper token. The page lists waiting tickets (`GET /api/v1/escalations` with `Authorization: Bearer` or `X-Helper-Token`) and can `PATCH` a ticket to answered with a note. The token is not written to localStorage.

**Webhook:** `POST /api/v1/webhooks` with `{ url, events?: ["escalation.opened"] }`. Kept in memory, max 20, dropped on restart. On create, the server POSTs `{ event, ticketId, language }` only. Page, conversation, contact, and job context are not in that body. The host `169.254.169.254` is rejected. Other internal hosts are not. The route has no shared secret.

### f. Accessibility panel

Tools that change the host page go through `<style id="db-a11y-effects">` and classes on `<html>`. Turning a tool off removes its class and rebuilds the style without that rule. Disconnecting the element removes `db-assistant-on` and the launcher CSS variables. It does not by itself clear contrast or text size; those stay until reset or until the element is gone and something else removes the classes. `disconnectedCallback` does not remove `db-contrast` and the other tool classes. Reset all, or clearing saved data, sets them back to defaults and calls `applyHostEffects` again.

| Tool | Host change | Reversed by |
| --- | --- | --- |
| High contrast | `html.db-contrast` forces black background, white text, yellow links | toggle off, reset, or clear saved data |
| Text size | `html { font-size: <measured> * percent }` from 100 to 200, step 10. 100 removes the rule. The measured base is taken once. | back to 100 |
| Dyslexia font | `html.db-dyslexia` sets Comic Sans MS, Comic Sans, Verdana, Trebuchet MS. No font file is downloaded. | toggle off |
| Line spacing | `html.db-spacing` sets line-height on `p, li, dd, dt, blockquote, figcaption, h1–h6, td, th` from 1.5 upward, step 20 percent, max 200 | back to 100 |
| Large cursor | `html.db-cursor` uses an SVG cursor, and a hand on links and buttons | toggle off |
| Highlight links | `html.db-links` paints a yellow background and an outline on `a[href]` | toggle off |
| Read on hover | no CSS; a `pointerover` listener speaks the block | toggle off removes the listener |
| Launcher clearance | `html.db-assistant-on` adds bottom padding so the launchers do not cover the last line | element disconnect |

The widget's own UI stays in shadow DOM. Link highlight and contrast rules exclude nothing inside the shadow tree of the widget except where the selector cannot reach it; the contrast selector skips `db-assistant` itself (`:not(db-assistant, img, svg, video, canvas, picture)`).

### g. Privacy

**Stored on the device**

| Key | Contents |
| --- | --- |
| `db-assistant:lang` | language code |
| `db-assistant:tz-dismiss` | `"1"` if the time-zone offer was declined |
| `db-assistant:commands` | `"1"` if voice commands were enabled (mic still off until the next press) |
| `db-assistant:a11y` | contrast, text size, dyslexia, spacing, hover, cursor, links |
| `db-assistant:outbox` | unsent tickets, including the conversation and page URL |
| `db-assistant:share` | `"1"` if the share toggle was on (capture does not start from this flag) |
| `sessionStorage` `db-assistant:tr:...` | original string and translation |

Clear saved data deletes every localStorage key that starts with `db-assistant:`. It does not wipe `sessionStorage`.

**Sent where**

| Action | Sent | Not sent |
| --- | --- | --- |
| Question while cloud is on | question, language, and up to 40 sections to this API; the API may send the matched sections to Gemini | API keys |
| Listen while cloud speech is on | the reply text and language to this API, then to Addis or Gemini | the microphone audio |
| Page translate | visible strings to this API, then to Gemini | hidden text, typed input values |
| Ticket | conversation, topic, page URL, heading, selection, and up to eight job blurbs to this API; webhook gets event, ticket id, and language | the helper token |
| Browser dictation or commands | the browser may send audio to its own speech service; this script does not store it and does not post it | — |
| Location | nothing. Coordinates stay in the click handler. | position |
| Screen share | nothing. The stream is a local muted video. The bar says a helper cannot see it. | the video |

**Off until the person acts:** microphone, voice-command loop, geolocation, page translation, and `getDisplayMedia`. Hover-read, contrast, cursor, and the other display tools come back from localStorage without a new click. No analytics call exists in the module or the API.

---

## 5. API reference

Rate limit on every route except OPTIONS: 60 requests per IP per minute, then `429` `{ "error": "Too many requests. Please wait a minute." }` and `Retry-After`. JSON body limit 256 KB, else `413`. Bad JSON: `400`. Other throws: `500` `{ "error": "Something went wrong. Please try again." }`. Unknown paths: `404`.

CORS: the `cors` package reflects the request origin when it is missing or when it is in `ALLOWED_ORIGINS` (comma-separated). Default in Compose is `http://localhost:8080`. A browser on another origin is refused CORS (the callback is `false`, not an error).

| Method | Path | Purpose | Request | Response | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/health` | Which providers are configured | — | `{ ai, ttsAddis, ttsGemini, escalations, telegram }` | 200, 429 |
| POST | `/api/v1/ask` | Answer from sections | `{ question, language, sections? }` question required, max 1,000. Omitted `sections` uses the demo course. | `{ answer, sources, mode }` mode is `gemini`, `offline`, `offline-fallback`, or `not-found` | 200, 400, 413, 429, 500 |
| POST | `/api/v1/tts` | Speech audio | `{ text, language }` text required, max 3,000 | audio bytes. `X-DB-TTS: mock` when mock. | 200, 400, 501, 502, 429 |
| POST | `/api/v1/translate` | Translate a batch | `{ texts, target }` 1–20 strings, each max 2,000 | `{ texts }` same length; a missing item is the original | 200, 400, 429, 502, 503 |
| POST | `/api/v1/escalations` | Open a ticket | `{ conversation, language?, contact?, topic?, page?, context? }` | `{ ticketId }` | 201, 400, 429 |
| GET | `/api/v1/escalations` | Waiting tickets | header `X-Helper-Token` or `Authorization: Bearer` | `{ tickets }` | 200, 401, 503, 429 |
| PATCH | `/api/v1/escalations/:ticketId` | Mark answered | token header, body `{ note?, status? }`. Id must match `db-` + hex. Status in the body is ignored; the store always sets `answered`. | `{ ticketId, status: "answered" }` | 200, 400, 401, 404, 503, 429 |
| POST | `/api/v1/webhooks` | Register a URL | `{ url, events? }` http or https | `{ id }` | 201, 400, 429 |
| POST | `/sms/inbound` | SMS-shaped reply | `{ text, from? }` | `text/plain` ≤ 160 characters. Language is forced to `en`. Course is the demo files. | 200, 400 (plain text), 429 (JSON from the limiter) |
| GET | `/helper` | Helper desk HTML | — | `helper.html` | 200, 429 |
| GET | `/docs` | Swagger UI | — | HTML | 200, 429 |
| GET | `/openapi.yaml` | The spec file | — | YAML | 200 or 404 if the file cannot be read |

There is no `POST /api/v1/content`. Content is a static JSON file the widget fetches, or the demo files the server reads when `/ask` omits `sections`.

**Env vars and behaviour**

| Variable | Effect |
| --- | --- |
| `PORT` | Listen port. Default 3000. |
| `AI_PROVIDER` | `gemini` or anything else (treated as `none`). |
| `GEMINI_API_KEY` | Required for `ai`, for translate, for Gemini TTS, and for the Addis 501 fallback. Empty keeps `ai` false. |
| `GEMINI_MODEL` | Answer and translate model. Default `gemini-3.5-flash`. |
| `GEMINI_TTS_MODEL` | Speech model. Default `gemini-2.5-flash-preview-tts`. |
| `TTS_PROVIDER` | `addis`, `mock`, or `none`. `mock` is a silent WAV for am/om/ti/so only, and health `ttsAddis` stays false. |
| `ADDIS_API_KEY` | With `TTS_PROVIDER=addis`, sets `ttsAddis`. |
| `ADDIS_BASE_URL` | Default `https://api.addisassistant.com`. A trailing `/api/v1` is stripped. |
| `TELEGRAM_BOT_USERNAME` | Public name returned as `telegram`. Not a secret. Empty string hides the link unless the widget attribute is set. |
| `HELPER_TOKEN` | Required for GET and PATCH escalations. Empty returns 503. Compared in constant time. |
| `ALLOWED_ORIGINS` | CORS allow-list. |

`health.escalations` is always `true`, even when `HELPER_TOKEN` is empty. The list route still returns 503 in that case.

**openapi.yaml vs the routes**

| In the server | In the spec |
| --- | --- |
| `GET /helper`, `GET /docs`, `GET /openapi.yaml` | not listed |
| PATCH escalations returns 503 when the helper token is unset | GET documents 503; PATCH does not |
| 500 from the error handler | not listed |
| PATCH ignores `status` in the body and always writes `answered` | schema shows `status` as an example, not as ignored |
| Webhook POST body is only `{ event, ticketId, language }` | the 201 text says webhooks are posted; the payload schema is not defined |
| SMS always uses language `en` and the on-disk course | the spec does not say the language is fixed |
| `health.escalations` is unconditionally true | described as a boolean with no note |
| No `POST /api/v1/content` | not listed (correct) |

Ask modes, TTS 501, translate 503/502/429 reasons, ticket create, and the helper token headers match the spec.

---

## 6. How to use it on another website

### Script tag, attributes, element, events

```html
<script
  src="https://HOST/module/db-assistant.js"
  data-lang="auto"
  data-api="https://HOST/api"
  data-content="https://HOST/content.json"
  data-provider="auto"
  data-theme=""
  data-telegram=""
  defer
></script>
```

| Attribute | Default when omitted | Meaning |
| --- | --- | --- |
| `data-lang` | the auto-mount writes `auto` if the attribute is missing but some other data attribute is present. Inside the element, a missing `lang` is also treated as `auto`. | `auto` or a code in `languages.json` (`en`, `am`, `om`, `ti`, `so`, `ar`). |
| `data-api` | empty. No health, no model, no tickets, no cloud speech, no page translation. | Base ending where `/v1/...` is appended. `/api` means the **page** origin, not the script's host. Use a full `https://` URL when the API is on another host. |
| `data-content` | empty. The widget scrapes `h1`–`h3` in `<main>`. | JSON file described below. |
| `data-provider` | empty, which with `data-api` set means health decides. | `none` forces offline search. `cloud` forces the API client (still falls back if health or the call fails). `auto` or empty uses health. |
| `data-theme` | empty | Stored and unused. |
| `data-telegram` | empty | Public bot username. Overrides the health field when it is valid. |

Manual element (do not also put the data attributes on the script, or the script will skip mounting only when an element already exists — put the element in the page first):

```html
<db-assistant
  lang="am"
  api="https://HOST/api"
  content="https://HOST/content.json"
  provider="none"
  theme=""
  telegram=""
></db-assistant>
<script src="https://HOST/module/db-assistant.js" defer></script>
```

Events (`bubbles: true`, `composed: true`):

```html
<script>
  document.addEventListener("db-assistant:question", function (event) {
    console.log(event.detail.text, event.detail.language);
  });
  document.addEventListener("db-assistant:language", function (event) {
    console.log(event.detail.language);
  });
  document.addEventListener("db-assistant:escalated", function (event) {
    console.log(event.detail.ticketId);
  });
</script>
```

`db-assistant:escalated` fires after a ticket is accepted, including when a queued ticket is sent later. It does not fire when the ticket is only saved on the phone.

### Content format

Widget file (`data-content`):

```json
{
  "title": "Optional title",
  "sources": ["/more.json"],
  "sections": [
    {
      "id": "section-id",
      "title": "Section title",
      "url": "/lesson.html#section-id",
      "lang": "en",
      "text": "The sentences the search is allowed to quote."
    }
  ]
}
```

`sources` entries are extra files of the same shape, fetched by URL. The server's `loadCourse` only follows `/demo/...` and relative paths when it reads the demo file for SMS and for `/ask` without `sections`. The widget follows whatever URL it can fetch.

There is no `POST /api/v1/content`. To change what `/ask` searches when the client omits `sections`, replace `demo/content.json` (and `demo/data/jobs.json`) on the API host.

### What the host must set up

- The module directory must be reachable at the script URL, on HTTPS if the host page is HTTPS. Language files load from that script's folder (`new URL("i18n/languages.json", scriptUrl)`), not from the page's folder. `providers/`, `page-translate.js`, `regions.js`, `voice-match.js`, `help-link.js`, `api-url.js`, and `data/regions.json` must sit beside `db-assistant.js`.
- The API must be reachable at the `data-api` base. A page on `https://` will block an `http://` API (mixed content). Use `https://` for both, or test on `http://localhost`.
- `data-api="/api"` is joined to the **page** origin. A module hosted on another domain still calls the page's `/api` unless `data-api` is an absolute URL.
- `ALLOWED_ORIGINS` must include the page origin (`https://school.example`), or the browser will hide the API responses. Same-origin requests send no `Origin` and are allowed.
- **nginx today does not send CORS headers for `/module/` or `/demo/`.** There is no `add_header Access-Control-Allow-Origin` on those locations. A `<script src="https://other-host/module/db-assistant.js">` can still run, because script tags are not subject to CORS. The following `fetch` of `i18n/en.json` from that other host is a cross-origin XHR, and without those headers it fails. The widget then stays hidden. Serving the module from the same origin as the page avoids that. Serving it from a CDN requires CORS on the module host. `/api/` is proxied to Express, and Express does send CORS for origins in `ALLOWED_ORIGINS`.

### Three ways to test

**1. Same server (Compose)**

```bash
cp .env.example .env
npm install --prefix api
docker compose up
```

Open `http://localhost:8080/` (starter index), `http://localhost:8080/pages/concept-with-navigation.html`, `http://localhost:8080/demo/blank.html`. Health: `http://localhost:8080/api/v1/health`. Helper: `http://localhost:8080/helper`. Docs: `http://localhost:8080/docs`.

This checkout does not have `api/node_modules`. `docker compose up` was not run in this pass, so this path is the command the files describe, not a result observed here.

**2. Second local origin**

Terminal A: `docker compose up` (page and module on port 8080).

Terminal B, from the repo root, any static server on another port, for example:

```bash
npx --yes serve -l 5500 .
```

Put a small HTML file on that server whose script is:

```html
<script src="http://localhost:8080/module/db-assistant.js" data-lang="auto" data-api="http://localhost:8080/api" data-content="http://localhost:8080/demo/content.json" defer></script>
```

Add `http://localhost:5500` to `ALLOWED_ORIGINS` and recreate the API container. Until nginx sends CORS on `/module/`, the language fetch from port 5500 to port 8080 fails and the panel stays hidden. Same-origin test (1) does not have that problem.

**3. Tunnel**

```bash
docker compose up
cloudflared tunnel --url http://localhost:8080
```

Use the `https://....trycloudflare.com` URL as both the page and, in a remote page, the script and `data-api` host. Set `ALLOWED_ORIGINS` to that remote page's origin. The tunnel URL changes each run. Do not put API keys in the page.

### Deploy

**One host, Docker Compose.** Copy the repo, set `.env` (real keys, a new helper token, `ALLOWED_ORIGINS` of the public site), put TLS in front of port 8080 (the Compose file publishes plain HTTP). `docker compose up -d`. The API container writes tickets to `./api/data` on the host.

**Split.** Put `module/` on any static host. Put `api/` on a Node 22 host: `npm ci --omit=dev` in `api/`, `node server.js`, with `.env` in the repo root next to `api/` (that is where `server.js` loads it) or with the variables in the process environment. Point `data-api` at `https://api-host/api`. The static host must send CORS for the module folder if pages are on another origin. The API image also mounts `demo/` and `module/` in Compose because `loadCourse` reads `demo/content.json` and `retrieve.js` imports `module/providers/none.js`. A Node host needs those two directories on disk at the same relative paths, or SMS and `/ask` without `sections` return an empty course.

**API missing.** Offline search, the accessibility tools, browser speech (when a matching voice exists), and the language picker still work. Cloud answers, Addis/Gemini speech, page translation, and tickets do not. The status line says not connected when `data-api` was set and health failed. With `data-api` empty and `data-provider` empty, it stays on offline mode without calling the network for answers.

### Add a language

1. Copy `module/i18n/en.json` to `module/i18n/<code>.json`. Translate every user-visible string. Keep the same keys. `catalog.test.js` fails if a key is missing or if a translated sentence is identical to English.
2. Add `{ "code": "<code>", "name": "<native name>", "dir": "ltr" }` to `module/i18n/languages.json`. Use `"dir": "rtl"` only when the script needs RTL. The widget reads `language.dir` from the bundle (each JSON file has a `language` object; keep it in sync).
3. Recognition will use `en-US` unless `LISTEN_LANG` in `db-assistant.js` and `speech-browser.js` gains a tag. That is a code change, not just a JSON file.
4. Amharic, Afaan Oromoo, Tigrinya, Somali, and Arabic files in this repo are marked `"_needsReview": true`. A native reader has not signed them in the code.

### Point it at the site's own content

Set `data-content` to that site's JSON (same shape as `demo/content.json`). Rebuild a Savanna-like file with `node demo/extract-content.js` only if the source is the concept page in this repo. For any other site, write the JSON, or omit `data-content` and let the widget scrape `h1`–`h3`.

---

## 7. Status

Evidence is the file named, or the test run in this pass. "Untested" means no browser or live-provider check was done here.

| Feature | Status | Evidence |
| --- | --- | --- |
| Auto-mount and shadow UI | Working | `autoMount` and `customElements.define` in `db-assistant.js`. Script tag is on the three pages, `index.html`, and `demo/blank.html`. |
| Offline lesson search | Working | `none.test.js` and `content.test.js` passed (English hit, miss under 0.5, Amharic suffix and trigram, excerpt not cut mid-word). |
| Cloud answer and Gemini | Partial | `cloud.js` and `app.js` `askOfflineOrModel` are wired. `api.test.js` covers the threshold with a fake fetch, but it was not run (express is not installed). No live Gemini call in this pass. |
| Ollama / local model | Stub | No file mentions Ollama. `AI_PROVIDER` is only `gemini` or `none`. |
| Advice refusal | Partial | Four sentences in `ASK_RULES` in `gemini.js`. No check on the offline excerpt. |
| Sources and "copied from the lesson" | Working | Source links in `_appendMessage`. The sentence is `status.modelFailed`, shown only when `mode` is `offline-fallback`. |
| Browser TTS | Working as code | `speech-browser.js` refuses a voice in the wrong language. Test passed. Not spoken in a browser here. |
| Addis TTS | Partial | Adapter matches the public docs in comments, and the same comments say a live `ADDIS_API_KEY` has not confirmed Somali (no voice id), the voices JSON shape, the audio URL, or the fallback ids. |
| Gemini TTS | Partial | `gemini.speak` wraps PCM as WAV. Not called live here. |
| Mic dictation and commands | Partial | Match logic tests passed. Recognition needs Chrome-style `webkitSpeechRecognition` and a network for many browsers. Not clicked here. |
| Language detect, save, RTL | Working | `resolveLanguage`, `directionOf`, Arabic `dir` in `languages.json`. Catalog test passed. |
| Time-zone suggestion | Working as code | Offers Amharic for `Africa/Addis_Ababa` only. Does not switch by itself. Not clicked here. |
| Location suggestion | Partial | `regions.test.js` passed and the test name says the table needs a local review. `regions.json` says approximate. Geolocation itself was not run. |
| Page translation | Partial | Unit tests for batching passed. Show original is forced hidden. Progress counts in the JSON are unused. CONFORMANCE records an earlier run where, with no translation service, the page did not change (that matches the code). A full Savanna page through Gemini was not run here. |
| UI translations | Partial | Key parity test passed. `am`, `om`, `ti`, `so`, `ar` are `"_needsReview": true`. They need a native reader. |
| Tickets and helper desk | Partial | Routes and `helper.html` are implemented. `api.test.js` not run. The widget omits `language`, so stored tickets become `en`. |
| Offline ticket queue | Working as code | `enqueueTicket` / `_flushOutbox`. Not tested offline in a browser here. |
| Telegram link | Working as a link | `help-link.test.js` passed. |
| Telegram bot using the shared answer logic | Stub | `help-link.js` says the bot is not in this repository. No process reads `start` and calls `/ask`. |
| Job alerts on Telegram | Stub | Topic id `alerts` only. No subscription, no push, no job feed to Telegram. |
| SMS endpoint | Working as a demo | `fitSms` and the route. Always English, demo course, no phone number. The copy in `en.json` says that. Route test not run. |
| Webhook | Partial | In-memory, no auth, payload is id and language only. |
| Screen share local preview | Partial | `getDisplayMedia` and a local video. Chrome for Android is treated as unsupported (unit test passed). Not run in a browser here. |
| Accessibility host tools | Working as code | `applyHostEffects`. Not rechecked with axe in this pass. |
| `data-theme` | Stub | Assigned in `_readConfig` and never used. |
| `api/data/alx-kb.json` | Stub | On disk, unread. |
| `test.mp3` | Stub | Unreferenced. |
| Slow 3G timing | Untested | No throttle script, no timing note in the repo. The widget is 243 KB and this nginx file does not gzip it. |
| `docker compose up` from a clean clone | Untested | Compose file and Dockerfile exist. This pass did not start Docker. `api/node_modules` is absent, so a host `npm test` in `api/` fails until `npm ci`. |
| Native-reader sign-off | Untested | `"_needsReview": true` and the regions note. |

---

## 8. Top 10 risks before submission

1. **Another website cannot load the language files.** nginx does not send CORS on `/module/`. The panel stays hidden. Fix: on `location /module/` and `location /demo/`, add `add_header Access-Control-Allow-Origin * always;` (or the real origin) and handle `OPTIONS`. Then load `http://localhost:5500` as in section 6 and confirm `i18n/en.json` is 200 in the network panel.

2. **`.env.example` contains a nonempty helper token.** If that value is the one in the real `.env`, it is already in the repo. Fix: replace the example with `HELPER_TOKEN=change-me`, rotate the real token, and confirm `.env` is not tracked (`git check-ignore -v .env`).

3. **Tickets are stored as English.** `_sendTicket` never sets `language`, and the server defaults to `en`. Fix: set `language: this._lang` on the object passed to `_sendTicket` and to `enqueueTicket`. Re-test by leaving a message in Amharic and reading `language` on `GET /api/v1/escalations`.

4. **Page translation is not ready to demo.** Show original is always hidden, the progress count is unused, and a live Gemini pass on the concept page was not done here. Fix: stop forcing `_pageOriginal.hidden = true` when `_pageState` is set; use `page.progress` in `_progressText`; with `AI_PROVIDER=gemini` and a key, translate the concept page and then restore it.

5. **Translations and the town table are unsigned.** `am/om/ti/so/ar` have `_needsReview`, and `regions.json` says approximate. Fix: a native reader for each language file, then remove the flag; a local check of the 34 coordinates. Until then, say so in the submission.

6. **Addis speech can 501 in front of a judge.** Somali is not in the documented voice list, and `addis.js` still has a TODO to confirm the live API. Fix: one real `POST /api/v1/tts` for `am`, `om`, `ti`, and `so` with the key, and keep the 501 sentence if Somali is absent. Do not claim the voice played unless the bytes play.

7. **Telegram does not answer and does not send job alerts.** The widget only opens `t.me`. Fix: either ship a bot that reads `/start` and calls `POST /api/v1/ask`, or write in the submission that Telegram is a deep link and Alerts is a ticket topic. Do not describe a bot that is not in the repo.

8. **Clean run is unverified.** `api/node_modules` is missing and Docker was not started here. Fix:

   ```bash
   npm ci --prefix api
   node --test "api/**/*.test.js" "module/**/*.test.js" "demo/**/*.test.js"
   docker compose up
   curl -s http://localhost:8080/api/v1/health
   ```

9. **Medical, legal, and immigration refusal is a prompt.** Offline mode will quote any matching sentence. Fix: before returning an excerpt or a model answer, if the question matches a small refusal list, return the "talk to a person" sentence and skip the excerpt. Cover it with a test in `none.test.js` and `api.test.js`.

10. **Slow 3G was not timed, and nginx will not gzip the 243 KB script.** Fix: in `nginx.conf` set `gzip on;` and `gzip_types application/javascript application/json text/css;` and reload. In Chrome, throttle Slow 3G, load the concept page, and record the time until the launcher is visible. The initial script should be the gzip size (about 48 KB) plus the language JSON for one language, not 243 KB.
