# Final check before documentation

Read-only pass on 16 Nov 2026, plus this file. No code, `README.md`, or `CONFORMANCE.md` was edited.

Sources: the hackathon guide PDF (Track 3 and sections 3, 4, 6, 7, 8, 9, 10, 11, 12 were readable), this repo, `savahana-bot/bot/telegram-bot` (@alxtestsbot), and `savanna-job-bot` (@alxjobsbot). Track 1 and Track 2 are out of scope.

The PDF quote under each requirement is shortened from the guide. Status means:

- **Done and verified** — a test or command in this pass checked it.
- **Done but untested** — the code is there; this pass did not click it.
- **Partial** — some of the requirement is in the code, and a named piece is not.
- **Missing** — not in the code.
- **Not verified** — this pass could not check it, and the note says what would.

## 1. Summary

**Gate: at risk.**

The module's axe scan is clean, and `node --test` in this repo passes. Documentation should wait. The support bot's `npm test` fails one test. The running API tells the widget to open @alxtestsbot, while the widget's fallback and the uncommitted `.env.example` name @alxjobsbot, and the jobs bot ignores the `start` payload. Widget tickets do not send the learner's language. `.env.example` contains the same helper token as the live `.env`, and that nonempty value is in git history.

| Part | Status |
| --- | --- |
| Assistant module and API | Tests pass. Axe on the widget is clean. Live Telegram name and ticket language are wrong. |
| Support bot (@alxtestsbot) | Calls this API when `BACKEND_API_BASE_URL` is set. `npm test`: 40 pass, 1 fail. |
| Jobs bot (@alxjobsbot) | New Node bot. Tests pass. Scrapes job boards. Does not call this API and does not read `lang_topic`. |

## 2. Command results

| Command | Result | Numbers |
| --- | --- | --- |
| `node --test` in this repo | Pass | Node v22.5.1. 68 pass, 0 fail, 0 skipped, 0 todo. About 3.4 s. Re-run after the person dialog was in its current form. |
| `npm test` in `savahana-bot/bot/telegram-bot` | Fail | Node v22.5.1. 40 pass, 1 fail, 0 skipped. One `punycode` deprecation warning. |
| `npm test` in `savanna-job-bot` | Pass | Node v22.5.1. 34 pass, 0 fail, 0 skipped. One `punycode` deprecation warning. |
| `npm run axe` | Module clean. Host issues on one starter page. | Chrome or Edge was found. Viewport in the script is 1280×900. See section E. |
| Gzip and raw size | Measured on disk | `module/db-assistant.js`: 288,769 bytes raw, 57,174 bytes gzip. English first-load set: 393,235 bytes raw, 86,611 bytes gzip (sum of per-file gzip). |
| `nginx.conf` gzip | Off | No `gzip` directive. A browser that loads through this nginx receives the raw bytes unless something else compresses them. |
| `docker compose config` | Pass | Compose v2.38.2. Exit 0. |
| `docker compose up` | Not run in this check | `docker compose ps` shows `api` and `web` already up for 2 hours. That is an earlier start, not a clean clone. |

The failing support-bot test is `human escalation explains the gap when no support chat is configured`. It expected text matching `/not connected/i`. The reply was only `A tutor will answer. It may take until morning.` `BACKEND_API_BASE_URL` is set in that bot's `.env`, and the API container is up. The test does not clear that variable. The handler shows the wait sentence when a ticket post succeeds.

English first-load files, fetched before the learner types a question: `module/db-assistant.js`, `module/i18n/languages.json` (586 / 253), `module/i18n/en.json` (18,448 / 5,435), `module/api-url.js` (711 / 392), `demo/content.json` (8,862 / 3,383), `demo/data/jobs.json` (1,814 / 521), `demo/data/alx-knowledge.json` (74,045 / 19,453). Raw total 393,235 is under the guide's 500 KB aim. `cloud.js` and `none.js` load later.

## 3. Requirement table (A)

Guide, Track 3, unless another section is named.

| Requirement | Guide wording | Status | Evidence |
| --- | --- | --- | --- |
| One script, shadow root, events | "one script tag"; CSS in a shadow root; `dispatchEvent` with `bubbles` and `composed` | Partial | Pages and `demo/blank.html` load only `/module/db-assistant.js`. Shadow root is used. `db-assistant:question` and `db-assistant:escalated` use `bubbles: true, composed: true`. The widget also sets classes and CSS variables on `<html>` so the launcher can move and display tools can resize the host. That is outside "do not change the host's elements." |
| Chat log | `role="log"` and `aria-live="polite"`; Enter sends; Escape closes and returns focus; `dir="auto"` | Done but untested as a keyboard path | Log attributes are set in `db-assistant.js`. Enter on the textarea calls `_ask` unless Shift is held. Escape closes the open dialog. The person dialog returns focus to Talk or the launcher. Axe opened the dialogs. A full keyboard task was not done. |
| Launcher must not cover host controls at 200% | "must not cover the page's own controls at 200 per cent zoom" | Done but untested | `_placeLaunchers` lifts the launcher off overlapping sidebar items. 200% zoom was not measured. |
| Search with no AI | "score them against the question by keywords" and show the section and its link | Done and verified | `providers/none.js`. Tests: `english question returns the shaping section excerpt and source`; `english miss is below threshold`. |
| Model sees only retrieved sections, and is not called on a miss | "Send the model only the retrieved sections"; "If the retrieval finds nothing above your threshold, do not call the model." | Done and verified | `askOfflineOrModel` in `api/app.js` returns `mode: "not-found"` when `topSections` is empty, before `gemini.answer` or `local.answer`. A hit calls `forModel(picked)` only. Test `ask uses the model only for sections above the threshold`: after `zzzz quantum pottery`, `calls.length` stays 1 and the body does not contain the other section. |
| Exact not-found sentence | `I could not find this in the course` | Done and verified | `en.json` `errors.notFound` and `api/lib/gemini.js` `COULD_NOT_FIND` are `I could not find this in the course.` The API returns `answer: null` on a miss. The widget shows the i18n sentence. |
| Offer a person on a miss | "offer a person" | Done but untested | Talk stays in the panel. Not clicked after a miss in this pass. |
| Voice | Microphone uses speech recognition. Every reply is text. Every text reply has Listen. | Done but untested | `onresult` writes the textarea. Each assistant message has Listen and Stop. Not spoken into a microphone. |
| Talk to a person, honest wait | "A tutor will answer here. It may take until morning." | Done but untested in the browser | English string is `A tutor will answer. It may take until morning.` The guide includes the word "here". The same sentence is in the support bot. There is no clock. |
| Redesigned person dialog | Decision for this check, not a separate PDF sentence | Done in code. Click path not exercised. Axe opened the dialog. | Accommodation (`_roomBtn` in the panel and `_roomCardBtn` in the dialog) calls `_askRoom`, which only POSTs a ticket with `topic: "accommodation"`. It does not open Telegram. Telegram is an `<a>` with `target="_blank"` and `rel="noopener noreferrer"`. Leave a message calls `_sendTicket`. Offline or a failed post calls `enqueueTicket` and shows `Saved on this phone. It will send when you are online.` |
| Which bot the link opens | Decision: the link is @alxjobsbot | Partial | Fallback in `_applyTelegram` is `alxjobsbot`. Uncommitted `.env.example` is `alxjobsbot`. Live `.env` and `GET http://127.0.0.1:3000/api/v1/health` return `telegram=alxtestsbot`. Health wins over the fallback. The running widget therefore builds a link to @alxtestsbot. |
| Helper page | "a simple page that lists waiting learners" | Done but untested | `GET /helper` sends `api/public/helper.html`. List and answer need the helper token. 401 is tested. The page was not opened. |
| Screen sharing | `getDisplayMedia`, a "You are sharing your screen" bar, and Stop | Partial | The bar and Stop are in the widget. The video stays on this page. There is no peer connection. Chrome on Android is treated as unsupported (`screen sharing is unsupported on Chrome for Android`). The alternative posts the page address. A real share prompt was not completed. |
| Telegram bot calls the same answer | "The bot calls the same answer() function as the web panel." | Partial | The support bot POSTs `/api/v1/ask` when `BACKEND_API_BASE_URL` is set. That variable is set. The jobs bot never calls it. See section B. |
| SMS | `POST /sms/inbound { from, text }` returns plain text of at most 160 characters | Done and verified | Tests: 160-character cap; Amharic question answered in Amharic; bad `from` is 400. |
| SMS language | Decision for this check | Partial | `smsLanguage`: a `language` field wins. Ethiopic script (`U+1200–U+137F`) becomes `am`. Arabic script becomes `ar`. Anything else becomes `en`. Tigrinya uses the same Ethiopic block, so a Tigrinya SMS with no `language` field is searched as Amharic. Oromo in the test is explicit `language: "om"`. |
| Jobs as a second source | "add the test jobs file as a second content source" | Done and verified | `demo/content.json` lists `/demo/data/jobs.json`. Test: `jobs.json is a second source with five test listings`. |
| Job alerts | "add job alerts through the Telegram bot and the text endpoint" | Partial | Support bot `/alerts` asks `/api/v1/ask` and says automatic push is not built. Jobs bot pushes scraped listings about every 2 hours and has `/jobs` on demand. SMS can answer a job question from the indexed sections. It does not subscribe anyone. |
| Accommodation request | "I need an accommodation for my interview" goes to a person | Done in code. Click not verified. | Both accommodation buttons post `topic: "accommodation"` with up to eight sample listings. API test: `a ticket keeps topic, page context, and listings`. |
| Advice refusal | "must not give medical, legal or immigration advice. It points to a person." | Done and verified as a phrase list | `module/providers/advice.js`. Widget, `none.js`, `POST /api/v1/ask`, and `POST /sms/inbound` refuse before retrieval. Sentence: `Please talk to a person.` Tests: `advice questions skip the model`; `a visa question is refused before any excerpt`. It is a phrase list, not a classifier. |
| Ollama | "Ollama serves open models behind an OpenAI-style endpoint" | Done and verified with a mock | `module/providers/local.js` POSTs `{base}/v1/chat/completions`. `AI_PROVIDER=ollama` selects it. Test `ollama answers from retrieved sections` uses a fake `fetch`. A live Ollama process was not called. |
| `POST /api/v1/ask` | `{ question, language }` to `{ answer, sources }` | Done and verified | `api/app.js`. The widget also sends `sections`. The support bot sends only `question` and `language`. |
| `POST /api/v1/content` | "the host sends its lessons to be indexed" | Done and verified | Returns 201 `{ indexed }`. Test: `posted content is what later questions and texts search`. The index is in memory for the life of the process. |
| `POST /api/v1/escalations` | `{ conversation }` to `{ ticketId }` | Done and verified for the route | 201 `{ ticketId }`. Bad topic is 400. The widget body also has `topic`, `page`, and `context`. `language` is omitted. See blockers. |
| Phone numbers | "accept 09..., 07... and +251..., and store one format" | Done and verified | `normalizePhone` stores `+251` plus nine digits. Test: `Ethiopian mobiles become +251 and nine digits`. Used on SMS `from` and escalation `contact`. |
| Ethiopian calendar | `Intl.DateTimeFormat('am-ET-u-ca-ethiopic', ...)` | Done and verified | `module/calendar.js` uses that locale for `am`, `ti`, and `om`. Test: `Amharic, Tigrinya, and Afaan Oromoo use the Ethiopian calendar`. |
| One JSON file per language | "Adding Afaan Oromo, Tigrinya, Somali or Arabic must be one new JSON file." | Partial | The widget loads `i18n/languages.json`, then `i18n/<code>.json`. A new language needs both. Speech and Addis ids live in the language object. `help-link.js` and `speech-browser.js` do not need a new line. Test: `a dummy language file registers speech and an Addis voice` only after the meta is put in the index. |
| `jobs.html` and JobPosting | Embed each job as JSON-LD | Done and verified | `savanna/pages/jobs.html` has five `application/ld+json` blocks, one per test listing. Test: `jobs.html has one JobPosting block for each test listing`. Listings are marked as test data. `addressLocality` is not set. The place is Remote and `addressCountry` is `ET`. |
| Clear my saved data | Section 10: the learner can delete their data | Done but untested | `_clearSaved` removes `localStorage` and `sessionStorage` keys that start with `db-assistant:`, and stops the mic and screen share. The button was not clicked. |
| Events | `db-assistant:question` and `db-assistant:escalated` | Done but untested | Both events are dispatched with `bubbles` and `composed`. A third event, `db-assistant:language`, is also fired. No host page listener was exercised. |
| `lang` and RTL | `lang` on the text; Arabic `dir="rtl"`; logical CSS | Done and verified for the data. Visual RTL not checked. | `ar.json` and `languages.json` set `dir: "rtl"`. The person dialog sets `lang` and `dir`. Test: `language names, codes, and Arabic direction`. |
| Ethiopic type | Noto Sans Ethiopic or the system font; line height about 1.7; no all-capitals | Done but untested on a device | Shadow CSS names `"Noto Sans Ethiopic"`, then the host font, then `system-ui`. `line-height: 1.7`. `text-transform: none`. The font file is not in the repo. |
| Privacy defaults | Capture stays off until the learner starts it | Done but untested | Mic starts after an agree button. Geolocation runs from the area button. `getDisplayMedia` runs from Share. Page translation runs after confirm. |
| No keys in browser code | "Never put an API key in the browser script." | Done and verified | Grep of `module/` found no API key. `cloud.js` only `fetch`es the API. The ask test asserts the test key is not in the outbound body or the log. |
| Level 2 | `/api/v1/`, JSON, 201/400/404, `openapi.yaml`, `/docs`, one webhook, one curl per call | Done and verified for routes and status codes. Curls not executed. `/docs` not opened. | Paths exist in `api/app.js` and `openapi.yaml`. 201, 400, 401, and 404 are tested, including `an unknown escalation returns 404`. Curls are in `api/README.md`. They were not run. Swagger UI is mounted at `/docs`. |
| Level 3 | JobPosting first. Badges and LTI only if known. | Partial | JobPosting is done. Open Badges 3.0 and LTI 1.3 were not attempted. The guide says an honest note is better than a broken attempt. |
| Works with no paid AI | "still be useful with no AI at all" | Done and verified | `AI_PROVIDER=none` uses the excerpt. A failed model returns `mode: "offline-fallback"`. Test: `a failed model falls back to the lesson excerpt`. |
| Offline queue sentence | "Saved on this phone. It will send when you are online." | Done but untested | `en.json` `escalate.saved`. `enqueueTicket` writes `db-assistant:outbox`. Not forced offline in a browser. |
| First load under 500 KB | "Aim for under 500 KB on first load" | Done for the raw file sum. Wire size is the raw sum while nginx gzip is off. | 393,235 bytes raw. Not timed. |
| Plug-in outside Savanna | Blank page with no Bootstrap | Done but untested visually | `demo/blank.html` has a title, one heading, one host button, and the script. Axe scanned it. A person did not use it. |

`_needsReview: true` counts: `en.json` 1, `am.json` 8, `om.json` 9, `ti.json` 9, `so.json` 9, `ar.json` 9. The catalog test ignores the flag.

Page translation strings include `Experimental`. The two lines that would show `page.experimental` and `page.experimentalNote` are commented out in `db-assistant.js`. The label is not on screen.

## 4. Consistency table (B)

| Check | Widget | Support bot (@alxtestsbot) | Jobs bot (@alxjobsbot) |
| --- | --- | --- | --- |
| `POST /api/v1/ask` | Yes, when the provider is cloud. Body: `question`, `language`, `sections` (up to 40). | Yes, when `BACKEND_API_BASE_URL` is set. It is set. Body: `question`, `language` only. A failed call falls back to the local FAQ. | No. No such env variable. |
| `POST /api/v1/escalations` | Yes. Body: `topic`, `conversation`, `page`, `context`. `language` is left undefined, so JSON omits it and the API stores `en`. | Yes, when the base URL is set. Body: `language`, `topic`, `conversation: [{ role: "learner", text }]`. No `page` or `context`. | No. |
| Not-found sentence | `I could not find this in the course.` | Same English sentence in `locales.js`. | No not-found sentence. |
| Advice | `Please talk to a person.` Phrase list, before search. | Same sentence when the API `mode` is `advice`. The local FAQ fallback does not use that phrase list. | No advice check. |
| Wait sentence | `A tutor will answer. It may take until morning.` | Same English sentence. | No wait sentence. |
| `start` payload | `lang_topic`. Languages `en am om ti so ar`. Topics `tutor careers alerts accommodation`. Default selected topic in the dialog is `careers`. | `handleStart` accepts that exact pattern. `accommodation` starts a person request. The other topics set `session.topic` and open the menu. | `handleStart` ignores `ctx.startPayload` and shows the language list. |
| Live link target | After health: `https://t.me/alxtestsbot?start=<lang>_<topic>`. Fallback if health and `data-telegram` are empty: `alxjobsbot`. | This is the bot the running API names. | This is the bot the fallback and the uncommitted example name. It does not read the payload. |

### Which bot does what

- **Support bot (@alxtestsbot)** answers course questions through this API, offers a person, and posts tutor, careers, alerts, and accommodation tickets. `/alerts` is an on-demand listing from the API. Its own text says push alerts are not built.
- **Jobs bot (@alxjobsbot)** scrapes six boards and sends subscribers new jobs about every 2 hours, or now with `/jobs`. It should be the bot the widget link opens, if the decision stands. It does not yet accept the payload the widget builds.
- One link cannot send tutor to the support bot and alerts to the jobs bot. The topic only changes the `start` string.

### Mismatches

1. Running health `telegram` is `alxtestsbot`. Widget fallback and uncommitted `.env.example` are `alxjobsbot`. Committed `HEAD:.env.example` is still `alxtestsbot`.
2. The jobs bot drops `lang_topic`. The support bot accepts it.
3. Widget ask includes `sections`. Support ask does not. The API allows both. The bot then searches the server's loaded course, not the sections the page sent.
4. Widget tickets omit `language`, so they are stored as English. Support tickets send `language`.
5. Widget tickets include `page` and `context`. Support tickets do not. The API accepts both.
6. Support bot local fallback does not use the advice phrase list. The API path does.
7. Oromo and Tigrinya with no Addis audio: the support bot stays silent (text remains). The jobs bot reads those titles in English on Edge.
8. Support bot says push alerts are not built. The jobs bot pushes scraped jobs.
9. Wait sentence matches across the widget and the support bot, and it is missing the guide's word "here". The jobs bot has no equivalent.
10. Support bot README opening still describes Gemini as the typed-answer path. Later it says the API is used when `BACKEND_API_BASE_URL` is set. The live value is set, so the API path is the one that runs first.
11. Arabic "accommodation" in the widget i18n uses a housing sense (`سكن`) in the older string. The files are marked `_needsReview`.

## 5. Jobs bot review (C)

| Item | Finding |
| --- | --- |
| Structure | `src/bot.js` creates Telegraf, registers commands and callbacks, and schedules broadcast. `src/handlers/commands.js`, `src/handlers/callbacks.js`, `src/services/scraper.js`, `jobs.js`, `broadcast.js`, `delivery.js`, `speech.js`, `translate.js`, `src/db.js`, `src/config.js`. |
| Library and version | Node `>=22.5`. Telegraf 4.16.3. Playwright 1.65.1. dotenv 16.6.1. msedge-tts 2.1.1. `axios` is pulled in by msedge-tts, not imported by `src/`. |
| Polling or webhook | Long polling. `bot.launch({ dropPendingUpdates: false })`. No webhook server and no listen port. |
| Job data | Playwright Firefox opens EthioJobs, GeezJobs, HaHu Jobs, Ezega, EmployEthiopia, and Ethiopian Reporter Jobs. It does not call this API and it does not read `demo/data/jobs.json`. The assistant's five test listings are a separate file. |
| Alerts | Push: first broadcast about 30 seconds after start, then every 2 hours (`intervalMs`). On demand: `/jobs`. Cache of scraped jobs is 600 seconds. |
| Env names | `BOT_TOKEN`, `ADDIS_API_KEY`, `ADDIS_BASE_URL`, `TRANSLATOR`, `NLLB_MODEL`. `DB_PATH` is read in code and is missing from `.env` and `.env.example` (default `bot.db`). |
| Token handling | Read from `.env`. Startup exits if `BOT_TOKEN` is empty. `safeLog.js` redacts `BOT_TOKEN` and `ADDIS_API_KEY`. The token is set. The value is not printed here. |
| Rate limiting | No per-user limit. Broadcast waits 50 ms between chats. A 403 removes that subscriber. |
| Errors | `bot.catch` logs a redacted error. Each scrape source is try/catch. Broadcast failures are logged. Blocked chats are deleted. |
| Tests | 34 pass. They cover sqlite migration, command flow, render modes, scraper extraction, speech fallback, and translation cache. They do not open a live board or Telegram. |
| Python leftovers | No `.py`, `requirements.txt`, or Dockerfile outside `node_modules`. `.gitignore` still lists `__pycache__/` and `*.pyc`. README says an older Python `bot.db` is readable. `migrate` adds `lang`, `cats`, and `mode` if they are missing. Test: `older databases gain the language, category, and mode columns`. `npm start` is Node. |
| README | Matches the Node scraper, the six sources, the 2 hour schedule, the commands, polling, and the Oromo/Tigrinya English voice fallback. It does not claim to call this project's API. |
| Safe beside the support bot | Yes, with the current env. Both tokens are set and they are not equal. Support bot state is an in-memory session. Jobs bot state is `bot.db` in its own folder. Neither binds 3000 or 8080. Do not point both at one BotFather token. |

## 6. Env table (D)

"Set" means the file has a nonempty value. The value is not printed. Public bot names are the exception, because the check has to say which bot the link opens.

| Name | Used by | `.env` | `.env.example` |
| --- | --- | --- | --- |
| `PORT` | API | set | missing |
| `AI_PROVIDER` | API, compose | set | missing |
| `OLLAMA_BASE_URL` | API, compose | absent | empty |
| `OLLAMA_MODEL` | API, compose | absent | empty |
| `GEMINI_API_KEY` | API, support bot | set in both | missing from assistant example; empty in support example |
| `GEMINI_MODEL` | API, support bot | set in both | missing from assistant example; set in support example (model name, not a key) |
| `GEMINI_TTS_MODEL` | API, compose default | absent | missing |
| `TTS_PROVIDER` | API | set | missing |
| `ADDIS_API_KEY` | API, both bots | set on API and jobs bot; absent on support bot | missing from assistant example; empty in both bot examples |
| `ADDIS_BASE_URL` | API, both bots | set on API and jobs bot; absent on support bot | missing from assistant example; set to the public Addis URL in both bot examples |
| `HELPER_TOKEN` | API | set | set, and it is the same value as `.env` |
| `TELEGRAM_BOT_USERNAME` | API health, widget link | set: `alxtestsbot` | working tree: `alxjobsbot`. `HEAD`: `alxtestsbot` |
| `ALLOWED_ORIGINS` | API CORS | set | missing. Compose default if unset: `http://localhost:8080` |
| `BOT_TOKEN` | Each bot, separate | set on both, not equal | empty in both examples |
| `HUMAN_SUPPORT_CHAT_ID` | Support bot | set | empty |
| `ADMIN_TELEGRAM_IDS` | Support bot | set | empty |
| `ALX_WEBSITE`, `ALX_ABOUT_URL`, `ALX_PROGRAMS_URL`, `ALX_SUPPORT_URL` | Support bot | set | set (public URLs) |
| `ANSWER_PROVIDER` | Support bot | set | set |
| `BACKEND_API_BASE_URL` | Support bot | set | empty |
| `BACKEND_API_KEY` | Support bot reads it and does not send it | empty | empty |
| `TRANSLATOR` | Jobs bot | set | set (`auto`) |
| `NLLB_MODEL` | Jobs bot | set | set (public model id) |
| `DB_PATH` | Jobs bot | absent | missing |

`nginx.conf` proxies `/api/`, `/sms/`, `/docs`, `/helper`, and `/openapi.yaml` to the `api` service. Compose publishes web `8080` and api `3000`.

Secret scan, values omitted:

- Assistant `.env` is gitignored and not tracked. `.env.example` is tracked.
- Working tree and `HEAD` `.env.example` both have a nonempty `HELPER_TOKEN`. It matches the live `.env`. History has 13 nonempty `HELPER_TOKEN=` lines in `.env.example`. No `AIza`, `sk-`, or `bot<id>:<secret>` pattern was found in tracked files or history.
- Support bot is a git repo. `.env` is gitignored and not tracked. `.env.example` has no secret-shaped value. History scan found no `AIza`, `sk-`, or BotFather-token pattern.
- Jobs bot folder is not a git repo. History: **Not verified.** `.gitignore` lists `.env`. `.env.example` has an empty `BOT_TOKEN` and an empty `ADDIS_API_KEY`. A `git init` and `git check-ignore` would confirm the ignore rule is active.

## 7. Gate table (E)

Axe ran `axe-core` 4.10.3 inside the shadow root, and again on `document.body` with `db-assistant` excluded. States: chat, accessibility tabs All / Display / Speech, and Talk to a person. Pages: `demo/blank.html`, `savanna/pages/concept-with-navigation.html`, `savanna/pages/jobs.html`.

| Check | Module | Host | This pass |
| --- | --- | --- | --- |
| axe critical / serious, blank, all five states | 0 / 0 | 0 / 0 | Verified |
| axe, concept page, each of five states | 0 / 0 | 1 critical, 4 serious | Verified. Host rules: `aria-allowed-attr` on a starter dropdown `div`, `aria-progressbar-name`, `color-contrast`, `link-name` on the logo, `list` on `#sidebar > .px-2`. These are the starter page. The script sums states, so the printed host total is 5 critical and 20 serious. |
| axe, jobs.html, all five states | 0 / 0 | 0 / 0 | Verified. Includes the person dialog. |
| Keyboard path for the main task | Code has Tab targets, Enter, Escape, and focus return | Not this module | **Not verified.** Unplug the mouse and complete ask, Listen, Talk, Leave a message, and Close. |
| 200% zoom | Rem sizes and launcher lift exist | Not measured | **Not verified.** |
| 320px width | No fixed panel width was measured | Not measured | **Not verified.** Axe used 1280×900. |
| Reduced motion | CSS has `prefers-reduced-motion: reduce` branches. A pulse animation is under `no-preference` for one button, and another pulse is not inside that query. | — | **Not verified** with the OS setting on. |
| Targets | Several controls use at least 44px or `2.75rem` | Not measured | **Not verified** with a ruler. |
| Contrast | Axe reported no module contrast violation in the scanned states | Host contrast failures on the concept page | Module verified at the axe viewport only. |
| Label and aria inside the shadow root | Axe reported no module label or name violation in the scanned states. Person fields use `<label for>`. The Telegram control is an `<a>` with an accessible name. | — | Verified for those states. Axe does not prove every `aria-describedby` target exists, but it did not flag a broken one. |
| Co-designer, unaided, own device | — | — | **Not verified.** No session is recorded in the repo. |
| NVDA | — | — | **Not verified.** |
| TalkBack | — | — | **Not verified.** |
| Slow 3G seconds | — | — | **Not verified.** |
| Clean-clone `docker compose up` | Config is valid. This machine already has the stack up. | — | **Not verified** as a clean clone on another laptop. |

Textarea and one select use `outline: none` where a parent already draws a focus ring (`box-shadow` on `.input-wrap:focus-within`). Axe did not flag that.

## 8. Limits (F)

- [ ] Translations marked `_needsReview` (counts in section A).
- [ ] Oromo, Tigrinya, and Somali TTS were not listened to. Support bot has no `ADDIS_API_KEY`. Jobs bot and the API have the key set. Tests use mocks. Somali Addis has no default voice id (`addis: "catalog"`).
- [ ] Voice commands exist in all six language files. Nobody spoke them in this pass.
- [ ] Telegram push of course job listings is not built. The support bot says so. The jobs bot pushes scraped boards, which is a different feed.
- [ ] Screen sharing is a local preview. A helper does not see the learner's screen. Android uses "send this page" instead.
- [ ] Page translation runs, and the on-screen "Experimental" label is commented out.
- [ ] Advice detection is a phrase list.
- [ ] Ollama was tested with a mock `fetch`, not a running model.
- [ ] Both bots live outside this repo. The jobs bot is not a git repo.
- [ ] Widget tickets are stored as English because `language` is omitted.
- [ ] The running widget link opens @alxtestsbot, not @alxjobsbot.
- [ ] The jobs bot ignores `lang_topic`.
- [ ] Co-designer test, NVDA, TalkBack, Slow 3G, 200% zoom, 320px, and a clean-clone compose up were not done.
- [ ] Open Badges 3.0 and LTI 1.3 were not attempted.
- [ ] `LICENSE` is MIT. The PDF says "the open licence ALX named at kick-off" and does not name MIT. Match: **Not verified.**

## 9. Blockers

These should be fixed before the README treats them as done.

1. **Support bot test fails.** In `savahana-bot/bot/telegram-bot/tests/botFlows.test.js`, the test `human escalation explains the gap when no support chat is configured` must also save, delete, and restore `BACKEND_API_BASE_URL`, the same way it already handles `HUMAN_SUPPORT_CHAT_ID`. Then the neither-configured branch shows `support.notConfigured`, which matches `/not connected/i`. **Cursor. About 5 minutes.** This run may have posted a real ticket, because the API is up and the URL is set.

2. **Live link opens the support bot.** Set `TELEGRAM_BOT_USERNAME` in this repo's `.env` to `alxjobsbot` and recreate the `api` container so health stops returning `alxtestsbot`. **You. About 5 minutes.** Then teach `savanna-job-bot/src/handlers/commands.js` `handleStart` to read `^(en|am|om|ti|so|ar)_(tutor|careers|alerts|accommodation)$`, store the language, and for `alerts` or `careers` continue into the existing setup. `tutor` and `accommodation` need a sentence that this bot does not answer course questions. **Cursor. About 30 minutes.** Until that lands, a link to @alxjobsbot drops the topic.

3. **Widget tickets lose the language.** In `_sendTicket` in `module/db-assistant.js`, set `body.language = this._lang` before `enqueueTicket` and `_postTicket`. **Cursor. About 10 minutes.**

4. **Helper token is committed and matches the live token.** Replace `HELPER_TOKEN` in `.env.example` with an empty value. **Cursor. About 2 minutes.** Rotate the live helper token, because the old value is in git history (13 nonempty lines). **You. About 10 minutes.** Do not paste the value into the README.

5. **Assistant `.env.example` is missing settings the server reads.** Add empty keys for `PORT`, `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TTS_MODEL`, `TTS_PROVIDER`, `ADDIS_API_KEY`, `ADDIS_BASE_URL`, and `ALLOWED_ORIGINS`. Keep `OLLAMA_*` empty. **Cursor. About 10 minutes.**

## 10. Manual tasks for you

Do these in order. They are not done.

1. **Co-designer, unaided.** One sentence task on their own phone over HTTPS. Keyboard only, screen reader, 200% zoom, sound off. Write who, the device, the reader, and what they could not do in `CONFORMANCE.md`.
2. **NVDA on Windows.** Tab through ask, a miss, Listen, Talk to a person, Leave a message, accommodation request, Close. Confirm focus returns to Talk.
3. **TalkBack on Android.** Same task with eyes closed. Confirm Chrome screen share is replaced by sending the page.
4. **Slow 3G.** Chrome DevTools, Network, Slow 3G, reload `demo/blank.html`. Write the seconds. The raw first load is 393,235 bytes and nginx gzip is off.
5. **200% zoom and 320px.** Ctrl plus, then a 320px window. Confirm the launcher does not cover the host's controls and the person dialog does not clip.
6. **Clean-clone compose.** On a laptop that is not this one: clone, copy `.env.example` to `.env`, fill keys, `docker compose up`. Open `http://localhost:8080/demo/blank.html` and `http://localhost:8080/docs`. This machine already has `api` and `web` up for 2 hours. That does not count.
7. **Listen, one sentence each, en, am, om, ti, so, ar.** Note which languages stay silent. Support bot has no Addis key. API and jobs bot have the key set.
8. **Voice commands.** Speak one command in each language into Chrome. The phrases are in the i18n files. This pass did not speak them.
9. **Rotate the helper token** after the example is emptied. Update the running `.env` and recreate `api`.
10. **Licence.** Ask the mentor whether MIT is the licence named at kick-off.
11. **Native-reader review** of Amharic, Afaan Oromo, Tigrinya, Somali, and Arabic. The `_needsReview` flags are still set.
12. **Run both bots together.** Two terminals, two tokens (they already differ). `npm start` in each bot folder while `docker compose` is up. Send `/start` to each bot. Confirm they do not steal each other's updates.

## 11. Facts the README must state

Copy these. Do not round the sizes or the test counts.

- Module script: `module/db-assistant.js`, 288,769 bytes raw, 57,174 bytes gzip.
- English first load: 393,235 bytes raw, 86,611 bytes if each file is gzipped. `nginx.conf` does not enable gzip, so the wire size through this compose file is the raw total. Slow 3G seconds are not measured.
- Tests: this repo 68 pass / 0 fail. Support bot 40 pass / 1 fail until blocker 1 is fixed. Jobs bot 34 pass / 0 fail.
- Routes: `GET /api/v1/health`, `POST /api/v1/ask`, `POST /api/v1/content`, `POST /api/v1/tts`, `POST /api/v1/translate`, `POST /api/v1/escalations`, `GET /api/v1/escalations`, `PATCH /api/v1/escalations/{ticketId}`, `POST /api/v1/webhooks`, `POST /sms/inbound`, `GET /docs`, `GET /helper`, `GET /openapi.yaml`.
- Compose: web on port 8080, api on port 3000. Nginx proxies `/api`, `/sms`, `/docs`, `/helper`.
- Not-found sentence: `I could not find this in the course.`
- Wait sentence: `A tutor will answer. It may take until morning.`
- Advice sentence: `Please talk to a person.` It is a phrase list.
- A miss does not call the model. A hit sends only the sections that cleared the threshold.
- `@alxtestsbot` is the support bot. It calls `/api/v1/ask` and `/api/v1/escalations` when `BACKEND_API_BASE_URL` is set. It does not push job alerts.
- `@alxjobsbot` is the jobs bot. It scrapes six Ethiopian boards and pushes new listings about every 2 hours. It does not call this API. It does not read `lang_topic` yet.
- The running API health field `telegram` is `alxtestsbot`. The widget fallback is `alxjobsbot`. Say which one the deployed `.env` uses after blocker 2.
- Accommodation in the widget creates a helper ticket only. The Telegram control is a link that opens in a new tab.
- Five test jobs are in `savanna/pages/jobs.html` as `JobPosting` JSON-LD. They are not real vacancies. The jobs bot does not use that file.
- Ollama is supported and was tested with a mock. No paid key is required for keyword answers.
- Adding a language takes `i18n/<code>.json` and one entry in `i18n/languages.json`.
- Honest limits: `_needsReview` translations, unverified Oromo/Tigrinya/Somali speech, unspoken voice commands, no course-listing push, screen share is a local preview, page translation's experimental label is not shown, advice is a phrase list, bots are separate projects, Badges and LTI were not built, co-designer and Slow 3G are not yet recorded.
- Libraries to list: Express 4.22.3, cors 2.8.6, dotenv 16.6.1, swagger-ui-express 5.0.1, yaml 2.9.1 (API, MIT/ISC/BSD as in the lockfile). Support and jobs bots: Telegraf 4.16.3, dotenv 16.6.1, msedge-tts 2.1.1. Support also fuse.js 7.5.0. Jobs also Playwright 1.65.1. Widget: no npm dependency.
- `LICENSE` in this repo is MIT. Confirm that is the licence ALX named.
