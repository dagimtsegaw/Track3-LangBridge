# Track 3 checklist

Read-only pass on 16 Nov 2026. Sources: the hackathon guide PDF (all cited sections were readable), this repo, and the attached Telegram bot at `savahana-bot/bot/telegram-bot`. No code, README, or CONFORMANCE file was edited.

Commands run: `node --test` in this repo (Node v22.5.1), `node --test` in the bot, file sizes, `docker compose config`, and a git history scan that reports only whether a secret-shaped value is set. `docker compose up`, axe, a browser, Slow 3G, NVDA, and TalkBack were not run.

# 1. Tech stack and tools actually used

| Layer | Technology | Version | Where | Why |
| --- | --- | --- | --- | --- |
| Frontend | Custom element `<db-assistant>` | DOM API | `module/db-assistant.js` `customElements.define`, `autoMount` | One script the host loads |
| Frontend | Shadow DOM | `attachShadow({ mode: "open" })` | `db-assistant.js` around the panel mount | CSS stays off the host |
| Frontend | Plain CSS in the shadow tree | no framework | style text in `db-assistant.js` | No UI framework |
| Frontend | Inline SVG | `createElementNS` | `icon()` in `db-assistant.js` | Icons without an icon font |
| Frontend | JSON i18n | 6 files | `module/i18n/{en,am,om,ti,so,ar}.json`, `languages.json` | No sentences in code |
| Backend | Node | local v22.5.1; image `node:22-alpine` | `api/Dockerfile`, `api/server.js` | API process |
| Backend | Express | lock 4.22.3, MIT | `api/app.js` `createApp` | HTTP routes |
| Backend | cors | lock 2.8.6, MIT | `api/app.js` | Browser calls from the widget |
| Backend | dotenv | lock 16.6.1, BSD-2-Clause | `api/server.js` | Reads `.env` on the server |
| Backend | swagger-ui-express | lock 5.0.1, MIT | `mountDocs` in `api/app.js` | `/docs` |
| Backend | yaml | lock 2.9.1, ISC | `api/app.js` | Reads `openapi.yaml` |
| AI chat and translation | Gemini model name in code | default `gemini-3.5-flash` | `api/lib/config.js`, `docker-compose.yml`, `api/lib/gemini.js` `answer` and `translate` | One model for answers and page translation |
| AI speech | Gemini TTS | default `gemini-2.5-flash-preview-tts`, voice `Kore` | `config.js`, `gemini.js` `speak` | English and Arabic speech, and a fallback |
| AI speech | Addis Voices | base `https://api.addisassistant.com`, `mp3_44100` | `api/lib/addis.js` | `am-hamen`, `om-bikila`, `ti-berhane`. No default Somali id |
| Local model | Ollama | not in the repo | no `providers/local.js`, no `OLLAMA` setting | Guide names it. This repo does not |
| Browser | Web Speech recognition | `SpeechRecognition` or `webkitSpeechRecognition` | `db-assistant.js` `onresult` writes `_input.value` | Microphone. Text is shown in the box |
| Browser | speechSynthesis | `speech-browser.js` `LISTEN_LANG` | Listen, hover-read, read selection | On-device voice when a matching voice exists |
| Browser | Geolocation | `getCurrentPosition` | area-language button only | Suggest a language. Not stored |
| Browser | getDisplayMedia | video only | `_startShare` | Local preview |
| Browser | localStorage | keys `db-assistant:*` | language, a11y, outbox, share toggle, commands flag | Saved on the phone |
| Browser | sessionStorage | `db-assistant:tr:` | `page-translate.js` | Translation cache |
| Browser | dialog | `showModal` | chat, settings, person, about | Focus trap from the platform |
| Browser | service worker | none | no registration in `module/` or `api/` | Not used |
| Packaging | Docker Compose | config checked, v2.38.2 | `docker-compose.yml` | `web` on 8080, `api` on 3000 |
| Packaging | nginx | image `nginx:alpine`, no digest pin | `nginx.conf` | Proxies `/api`, `/sms`, `/docs`, `/helper`, `/openapi.yaml` |
| Testing | node --test | Node v22.5.1 | repo root | 54 pass, 0 fail, 0 skipped |
| Testing | axe-core | not run this pass | no axe script in `package.json` | See section 3 |
| Telegram | Telegraf | lock 4.16.3, MIT | `bot/telegram-bot/src/bot.js` `bot.launch` | Long polling. Not a webhook |
| Telegram | fuse.js | lock 7.5.0, Apache-2.0 | FAQ match | Bot's own search |
| Telegram | msedge-tts | lock 2.1.1, MIT | `speechService.js` | English, Arabic, and some fallbacks. No key |
| Telegram | dotenv | lock 16.6.1, BSD-2-Clause | `config.js` | Bot env |
| Dev | Makefile `serve` | — | `Makefile` | Runs `docker compose up` |
| Dev | Root `package.json` | no dependencies | repo root | The widget has no npm package |

Paid keys: Gemini (`GEMINI_API_KEY`) and Addis (`ADDIS_API_KEY`). Both are set in this repo's `.env`. The bot `.env` has `GEMINI_API_KEY` set and does not contain `ADDIS_API_KEY`. `GEMINI_TTS_MODEL` is not in this repo's `.env`, so the code default applies. `AI_PROVIDER` and `TTS_PROVIDER` are set; the values are not printed here.

Free with no paid key: keyword search (`providers/none.js`), browser `speechSynthesis` when the device has a voice, Edge TTS in the bot, and the Telegram Bot API itself (BotFather token is free; `BOT_TOKEN` is set in the bot `.env`).

Works with no AI: `AI_PROVIDER` other than `gemini`, or `data-provider="none"`. The widget then uses `none.answer`. The SMS test throws if a model fetch runs while AI is off.

# 2. Track 3 checklist: done

Status is "Done and verified" only when a test or a command in this pass checked it. "Done but untested" means the code is there and this pass did not click it in a browser.

| Requirement | Status | How | Files | Tech | Evidence |
| --- | --- | --- | --- | --- | --- |
| Chat list is `role="log"` with `aria-live="polite"`. Messages use `dir="auto"` | Done but untested | The log is a div with those attributes. Each bubble sets `dir="auto"` | `db-assistant.js` log setup and `_appendMessage` | none | Source only. No axe this pass |
| Enter sends. Escape closes and returns focus to the launcher | Done but untested | Enter on the textarea calls `_ask` unless Shift is held. Escape closes the open dialog and the person dialog returns focus to Talk or the launcher | `_bind` in `db-assistant.js` | `<dialog>` | Source only |
| Launcher must not cover the host's controls | Done but untested | Launchers are placed from the sidebar rect and lifted off overlapping `#sidebar li` | `_placeLaunchers`, `_obstacleLift` | CSS variables on `<html>` | Source only. 200% zoom not measured |
| Search with no AI: keyword score, best section, link | Done and verified | `THRESHOLD` is 0.5. A miss returns `{ text: null }`. A hit copies an excerpt and a source URL | `module/providers/none.js` `answer`, `scoreSection` | none | `english miss is below threshold`; `english question returns the shaping section excerpt and source`; `a test-listing question uses the jobs source` |
| `answer(question, sections, language)` on none and cloud | Done and verified | `none.answer` scores locally. `cloud.answer` POSTs `/v1/ask` and returns `{ text: null }` if health `ai` is not true | `providers/none.js`, `providers/cloud.js`. No `providers/local.js` | Gemini only after the server says `ai: true` | none tests; `cloud.js` has no key |
| Offline threshold | Done and verified | Sections under 0.5 are dropped. The API uses the same function for the excerpt and the source list | `none.js` `THRESHOLD`, `api/lib/retrieve.js` `topSections` | none | none tests; API miss returns `mode: "not-found"` |
| Source link on a hit | Done and verified for the scorer. Widget rendering untested | A hit pushes `{ title, url }`. The widget renders an `<a>` per source | `none.js` `answer`; `_appendMessage` | none | `a lesson question cites the shaping section and does not invent text` |
| Miss path offers a person | Done but untested in the browser | `text: null` shows `errors.notFound`. Talk stays in the panel | `_showResult`, `en.json` `errors.notFound` | none | The English sentence is "I couldn't find this in the information I have." It is not the guide's exact sentence. See section 3 |
| Mic writes text. Listen reads the visible reply | Done but untested | `onresult` sets `_input.value`. Each assistant message has Listen and Stop | `db-assistant.js` around the recognition handler and `_appendMessage` | Web Speech | Source only |
| Talk to a person, ticket, honest wait sentence | Done and verified for the API. Widget untested | Button opens a dialog. POST creates a ticket. The dialog text is "A tutor will answer. It may take until morning." | `_openHelp`, `POST /api/v1/escalations`, `en.json` `escalate.next` | none | `escalations require the helper token and notify a webhook`; `a ticket keeps topic, page context, and listings` |
| Helper page lists waiting tickets | Done but untested | `GET /helper` sends `api/public/helper.html`. List and answer need `x-helper-token` | `app.js` `/helper`, `allowHelper` | none | Route exists. Page not opened. 401 is tested |
| Screen-sharing bar and Stop | Done but untested live | `getDisplayMedia` runs only from the share button. A bar says "You are sharing your screen". Stop calls `track.stop()` | `_makeShareBar`, `_startShare`, `_stopShare` | getDisplayMedia | `screen sharing is unsupported on Chrome for Android` checks the user-agent rule only |
| Android alternative | Done and verified for detection | Chrome on Android is treated as unable to share. The panel then offers "Send what page I'm on", which posts page URL, heading, and selection on a ticket | `help-link.js` `screenShareSupported`; send-page button | none | help-link test. A real Android phone was not used |
| SMS route and 160-character cap | Done and verified | `POST /sms/inbound` returns `text/plain`, sliced to 160, with the section title | `app.js`, `api/lib/smsText.js` `fitSms` | offline search when AI is off | `sms text stays within 160 characters`; `sms reply from the same answer path is at most 160 characters` |
| Jobs as a second content source | Done and verified | `content.json` lists `/demo/data/jobs.json`. Five `test-job-*` sections | `demo/content.json`, `demo/data/jobs.json`, `loadCourse` | none | `jobs.json is a second source with five test listings` |
| Accommodation ticket | Done and verified for the API | Button posts `topic: "accommodation"` and up to eight job sections | widget `_askRoom`; `app.js` topics set | none | `a ticket keeps topic, page context, and listings` |
| Events `db-assistant:question` and `db-assistant:escalated` | Done but untested | Both use `bubbles: true` and `composed: true`. A third event, `db-assistant:language`, is also fired | `_ask`, `_emitEscalated`, `_load` | CustomEvent | Source only |
| `POST /api/v1/ask` | Done and verified | JSON in, `{ answer, sources, mode }` out. Empty question is 400 | `app.js` | Gemini only if configured | ask test, fallback test |
| `POST /api/v1/escalations` | Done and verified | 201 `{ ticketId }`. Bad topic is 400 | `app.js`, `api/lib/tickets.js` | none | escalation tests |
| `POST /sms/inbound` | Done and verified | See SMS row | `app.js` | none | SMS test |
| Level 2 version prefix and JSON | Done and verified | Routes are under `/api/v1/` except `/sms/inbound`, which the guide leaves unversioned | `app.js`, `openapi.yaml` | — | tests hit those paths |
| 201, 400, 401 | Done and verified | Created webhook and ticket return 201. Bad topic and bad translate body return 400. Missing helper token returns 401 | `app.js` | — | escalation and translate tests |
| 404 for a missing ticket | Done but untested | `PATCH` returns 404 when the id is unknown | `app.js` | — | No test asserts that 404. The 404 in `api.test.js` is a mocked Gemini response |
| `openapi.yaml` matches the handlers | Done and verified for the path list | Paths: health, ask, tts, translate, escalations, escalations/{id}, webhooks, `/sms/inbound` | `openapi.yaml`, `app.js` | — | Path list compared by reading. A field-by-field schema diff was not run |
| `/docs` | Done but untested in a browser | Swagger UI is mounted from the yaml file | `mountDocs` | swagger-ui-express | `api/README.md` has a curl for the status code. It was not run |
| Webhook | Done and verified | `POST /api/v1/webhooks` returns 201. A new ticket POSTs `{ event, ticketId, language }` to that URL | `app.js` `notify` | fetch on the server | escalation test |
| One curl example per call | Done in `api/README.md`. Not run | health, ask, tts, translate, escalations, PATCH, webhooks, sms, docs, helper | `api/README.md` | — | Root `README.md` does not contain them. See section 3 |
| One script tag | Done but untested in a browser | `demo/blank.html` and the three Savanna pages load only `/module/db-assistant.js` with `data-lang`, `data-api`, `data-content`. `autoMount` creates the element | those HTML files, `autoMount` | — | Files read. Page not opened |
| Blank page has no Bootstrap | Done and verified by reading the file | `blank.html` has a title, one heading, one host button, and the script | `demo/blank.html` | — | File read. Not rendered |
| No API key in the browser script | Done and verified | `cloud.js` and `speech-cloud.js` only `fetch` the API. Keys stay in `readConfig` and are sent as server headers | `module/providers/`, `api/lib/gemini.js`, `api/lib/addis.js` | — | Grep of `module/` found no API key. The ask test asserts the test key is not in the outbound body or the log |
| Ethiopic type | Done but untested on a device | Font stack names Noto Sans Ethiopic, then the host font, then `system-ui`. Line height 1.7. `text-transform: none`. The font file is not downloaded | shadow CSS in `db-assistant.js` | system font | Source only |
| Arabic RTL | Done but untested visually | `ar.json` and `languages.json` set `dir: "rtl"`. CSS uses logical properties (`padding-inline`, `margin-inline`) | `i18n`, `directionOf` | — | `language names, codes, and Arabic direction` |
| Offline queue sentence | Done but untested in a browser | Failed or offline ticket posts are stored and the status line is "Saved on this phone. It will send when you are online." | `enqueueTicket`, `en.json` `escalate.saved` | localStorage | Source only |
| Six language files with the same keys | Done and verified | am, om, ti, so, ar are not copies of the English sentences | `module/i18n/` | — | `every language file has the same strings as English`; `translations are not copies of the English sentence` |
| Voice-command phrases exist in each language | Done and verified as data | Each file has 39 command ids and 71 phrases | `i18n/*.json` `commands` | — | catalog test, plus a count this pass. Not spoken into a microphone |
| Privacy: capture stays off until a click | Done but untested | Mic starts after an agree button. Geolocation runs from the area button. `getDisplayMedia` runs from Share. Page translation runs after confirm | consent strings, `_askArea`, `_startShare`, `page-translate.js` | — | Source only |
| Clear my saved data | Done but untested | Removes every `localStorage` key that starts with `db-assistant:` and stops mic and share | `_clearSaved` | localStorage | Does not clear `sessionStorage`. See section 3 |
| Works when the model is down | Done and verified | A hung Gemini call returns the lesson excerpt and `mode: "offline-fallback"` | `askOfflineOrModel` | none | `a failed model falls back to the lesson excerpt` |
| First-load size | Measured on disk. Wire size not measured | `db-assistant.js` is 257,339 bytes raw and 51,408 bytes gzipped. English boot files together are 360,674 bytes raw and 80,433 bytes gzipped. That is under 500 KB raw | files listed below | — | Python `gzip` this pass. `nginx.conf` has no `gzip` directive, so the wire size may be the raw sum. Not timed |
| `node --test` | Done and verified | 54 pass, 0 fail, 0 skipped, 0 todo, 2.9 s | repo root | Node v22.5.1 | command output this pass |
| Bot unit tests | Done and verified | 31 pass, 0 fail, 0 skipped. One `punycode` deprecation warning | `bot/telegram-bot` | Node v22.5.1 | command output this pass |

English boot files in the 360,674 byte sum: `module/db-assistant.js`, `module/i18n/languages.json`, `module/i18n/en.json`, `module/api-url.js`, `demo/content.json`, `demo/data/jobs.json`, `demo/data/alx-knowledge.json`. `cloud.js` loads only when health says `ai: true`. `none.js` loads on the first question. A non-English language also fetches `en.json` plus that language file (`am.json` is 25,112 bytes raw).

The guide's "23:00" answer is the fixed sentence "A tutor will answer. It may take until morning." It is shown at every hour. There is no clock.

# 3. Not done, partial, or not verified

## A. Blocks the accessibility gate or core use

- [ ] **Co-designer completes the main task unaided.** The guide requires a co-designer on their own device, with a screen reader, keyboard only, 200% zoom, and sound off. Nothing in the repo names a co-designer or records that session. **Missing:** that session. **Finish:** run the task on their phone over HTTPS and write who, the device, and what failed, in `CONFORMANCE.md`. **Who:** you. **About 90 minutes.**

- [ ] **axe-core: zero critical and zero serious in the module.** Not run this pass. There is no axe script. `CONFORMANCE.md` claims an older run and also says later passes did not repeat it. Those numbers are not evidence for this report. **Finish:** serve the site, open `demo/blank.html` and `pages/concept-with-navigation.html` with the panel open, run axe, and separate shadow-root results from the host page. **Who:** Cursor can script it if Chrome is available; you confirm the panel states. **About 40 minutes.**

- [ ] **NVDA and TalkBack.** Not run. **Who:** you. **About 45 minutes each.**

- [ ] **Keyboard, 200% zoom, 320px width, sound off.** Code has focus outlines, `rem` sizes, and a text path for every spoken reply. None of that was exercised in a browser this pass. **Who:** you. **About 40 minutes.**

- [ ] **WCAG report ends with who tested.** `CONFORMANCE.md` exists and does not name a tester, a device, and a screen reader. **Who:** you, after the session above. **About 30 minutes.**

## B. Track 3 must-haves missing or partial

- [ ] **Telegram bot does not call `POST /api/v1/ask`.** `getAnswer` in `bot/telegram-bot/src/services/answerService.js` uses `findLocalAnswer` and, when Gemini is configured, `askGemini` on the bot's own FAQ. `BACKEND_API_BASE_URL` is empty and unused. The bot test "the answer provider stays local and does not call the network" locks that in. **Patch:** section 4. **Who:** Cursor. **About 40 minutes.**

- [ ] **Telegram job alerts.** No alert command, no subscription, no call that searches jobs. **Missing:** a command that calls the same ask API in the learner's language and returns job sections. A push when a new listing appears does not exist in either project. **Who:** Cursor for the command. **About 45 minutes.**

- [ ] **Telegram accommodation ticket via `POST /api/v1/escalations`.** `forwardSupportRequest` sends a Telegram message to `HUMAN_SUPPORT_CHAT_ID`. It does not POST a ticket. **Patch:** section 4. **Who:** Cursor. **About 30 minutes.**

- [ ] **`/start` payload `lang_topic`.** The widget builds it in `help-link.js` (`telegram start payload is lang_topic` passed). `registerStart` only calls `showLanguagePicker`. No read of `ctx.startPayload`. The patch was not applied. **Who:** Cursor. **About 20 minutes.**

- [ ] **SMS searches English only.** `app.js` calls `askOfflineOrModel(text, "en", course)`. `from` is ignored. Amharic SMS cannot match Ethiopic tokens. **Finish:** pass `cleanLang(req.body.language)` or detect Ethiopic and add a test that is not English. **Who:** Cursor. **About 25 minutes.**

- [ ] **Model is still called below the threshold, and it sees every section.** The guide says: do not call the model when nothing is above the threshold, and send only the retrieved sections. `askOfflineOrModel` still calls `gemini.answer` with `forModel(cleaned)`, which is every cleaned section (page cap 40, knowledge cap 80), not `topSections`. The test named "ask uses the model only for sections above the threshold" asserts `calls.length === 2` after the miss "zzzz quantum pottery", so the model was called. A greeting does skip the model (`calls` stay at 1). AI off also skips it. **Finish:** if `picked` is empty, return not-found and do not call Gemini; pass `forModel(picked)` when it is not empty; change the test so a miss does not increment the call count and the body does not contain the other section. **Who:** Cursor. **About 30 minutes.**

- [ ] **Exact sentence "I could not find this in the course".** The shipped sentence is "I couldn't find this in the information I have." (`en.json` `errors.notFound`, `gemini.js` `COULD_NOT_FIND`). **Who:** Cursor if the judge wants the guide's words. **About 15 minutes.**

- [ ] **Medical, legal, and immigration advice is a prompt sentence, not a phrase list.** `ASK_RULES` tells Gemini to refuse. `none.js` will still quote a matching section. Nothing checks the question before retrieval. **Finish:** a small phrase list in `none.js` and `askOfflineOrModel` that returns the talk-to-a-person sentence and skips the excerpt and the model. Test it. **Who:** Cursor. **About 25 minutes.**

- [ ] **Screen sharing is a local preview.** The bar says a helper cannot see it. The video uses `srcObject` on this page. There is no peer connection. The Android path sends the page address instead, which is the guide's alternative, and that part is implemented. **Finish a real helper view only if you want it:** stream or upload frames. **Who:** Cursor, and it is larger than the alternative you already have. **About 2 hours if you build a connection. 0 if you keep the documented alternative.**

- [ ] **`jobs.html` and JobPosting JSON-LD.** `demo/data/jobs.json` exists. `savanna/pages/jobs.html` does not. No `application/ld+json` in the repo. **Who:** Cursor. **About 40 minutes.**

- [ ] **`POST /api/v1/content`.** The guide's contract says the host POSTs lessons to be indexed. There is no such route. Indexing is `demo/content.json` on disk plus sections the widget sends on `/ask`. **Who:** Cursor if you want the route. **About 45 minutes.**

- [ ] **`providers/local.js` and Ollama.** Not in the repo. The host cannot point at a local model. **Who:** Cursor. **About 60 minutes.**

- [ ] **Ethiopian phone normalisation.** The guide says accept `09...`, `07...`, and `+251...` and store one format. No such function. The SMS sample uses `+251900000000` as a string and does not normalise it. **Who:** Cursor. **About 25 minutes.**

- [ ] **Ethiopian calendar.** The guide's `Intl.DateTimeFormat('am-ET-u-ca-ethiopic', ...)` is not in the code. The only date use is "is the time zone `Africa/Addis_Ababa`?" for a language suggestion. **Who:** Cursor. **About 20 minutes.**

- [ ] **Add a language by one JSON file.** A new language also needs a line in `languages.json`, `LANGS` in `help-link.js`, `LISTEN_LANG` in `speech-browser.js`, and `ADDIS_LANGS` if it uses Addis. The four extra languages already have files. **Who:** Cursor to collapse the extra lists, or you to accept the extra edits. **About 30 minutes.**

- [ ] **Page translation has no experimental label.** The path is real: `page-translate.js` and `POST /api/v1/translate`. Status strings exist (`page.notConnected`, `page.done`, `page.failed`). The word "experimental" is not in the i18n files. **Who:** Cursor to add the label if you want it. **About 10 minutes.**

- [ ] **Oromo, Tigrinya, and Somali TTS are not verified live.** Assistant code sends `am`, `om`, `ti`, and `so` to Addis. Somali has no fallback id and returns 501 unless the catalog lists a voice, then may fall through to Gemini voice `Kore`. The bot unit test "Oromo stays silent when Addis has no audio, and Somali falls back to Edge" uses a mock. This pass did not call Addis. The bot `.env` has no `ADDIS_API_KEY`. **Who:** you, with a real key, listening to one sentence in each language. **About 20 minutes.**

- [ ] **Voice commands per language, spoken.** Phrases are in all six files and are not English copies. Nobody spoke them into Chrome this pass. **Who:** you. **About 30 minutes.**

- [ ] **`_needsReview: true`** on `am.json`, `om.json`, `ti.json`, `so.json`, and `ar.json` (root and several nested objects). `en.json` has no flag. The catalog test ignores the flag. **Who:** a reader of each language. **Hours, not a code change.**

- [ ] **Clear my saved data leaves the translation cache.** `_clearSaved` does not remove `sessionStorage` keys `db-assistant:tr:`. **Who:** Cursor. **About 15 minutes.**

- [ ] **Host plug-in rule vs display tools.** `applyHostEffects` adds classes on `<html>` and a `<style id="db-a11y-effects">`. That is how contrast and text size work, and it does change the host page. **Who:** you decide if that stays. Document it either way.

- [ ] **`theme` attribute.** Copied in `_readConfig`. No later use was seen in the code read this pass. **Not verified** that it never affects layout. A search for reads of `this._theme` would close it.

## C. Submission items

- [ ] **Root README is not the guide's outline.** It has no team, no co-designer, no one-sentence main task, no cost for 3,000 learners, no Slow 3G number, and no curl block. It says `db-assistant.js` is about 160 KB. The file is 257,339 bytes. Curls live in `api/README.md` and were not executed. **Who:** you for the facts, then a doc edit. **About 45 minutes.** This pass did not edit it.

- [ ] **`CONFORMANCE.md` is behind the current widget.** It says later passes did not repeat axe. It does not record a screen reader. **Who:** you after the gate session. **About 40 minutes.**

- [ ] **`docker compose up` from a clean clone.** `docker compose config` exited 0 (Docker server 28.3.2, Compose v2.38.2). The stack was not started. Images are `nginx:alpine` and a build of `node:22-alpine`. **Who:** you, on a laptop that is not this one. **About 20 minutes** plus image download.

- [ ] **Slow 3G time.** Not measured. **Finish:** Chrome DevTools, Slow 3G, reload `demo/blank.html`, write the seconds. **Who:** you. **About 15 minutes.**

- [ ] **Secret in git.** `.env` is gitignored and not tracked. `.env.example` is tracked and contains a nonempty `HELPER_TOKEN`. History scan found that one nonempty token-shaped assignment and no nonempty `GEMINI_API_KEY` or `ADDIS_API_KEY`. **Finish:** if that helper value is used anywhere real, rotate it and replace the example with an empty placeholder. **Who:** you. **About 10 minutes.** The value is not printed here.

- [ ] **Licence vs the one ALX named.** `LICENSE` is MIT. The PDF says "the open licence ALX named at kick-off" and does not name MIT or any other licence. **Match: Not verified.** **Who:** you, ask the mentor. **About 5 minutes.**

- [ ] **Level 3.** JobPosting is not done (no `jobs.html`, no JSON-LD). Open Badges 3.0 was not attempted. LTI 1.3 was not attempted. The guide says an honest README note is better than a broken attempt. **Who:** Cursor for the JobPosting page (section B). Badges and LTI stay undone unless someone already knows LTI.

- [ ] **Bot is not in this repo and is not a git repo.** `git rev-parse` in `savahana-bot` failed. Its `.env` cannot be checked from history. `BOT_TOKEN` is set. `BACKEND_API_BASE_URL` and `BACKEND_API_KEY` are empty.

## D. Nice to have

- [ ] **Live Gemini and Addis calls.** Tests mock `fetch`. Keys are set on the assistant `.env`. A real answer and a real audio clip were not requested this pass. **Who:** you. **About 15 minutes.**

- [ ] **404 ticket test.** Handler returns 404. No test asks for a missing id. **Who:** Cursor. **About 10 minutes.**

- [ ] **OpenAPI field-by-field diff.** Path list matches. Schemas were not diffed against every response. **Who:** Cursor. **About 30 minutes.**

- [ ] **`data-theme` styling.** Unused as far as this read went.

- [ ] **Greeting answers have no source link.** Greetings skip retrieval on purpose. The guide's "every answer has a source" is about course answers.

## Savanna host defects (not this module)

Verified in the starter files:

- `savanna/pages/homepage-v1-paced.html` line 60: `<div class="hamburger" ...>`. `savanna/assets/js/static-page.js` adds a click listener and says it stays a div so the host defect remains.
- `concept-with-navigation.html`: `<img ... alt="VA-Content-Banner">` uses the file name.
- A search for "skip to content" found no match.

The guide also says the course switcher is a clickable div. That element was not re-checked tag by tag this pass.

## Tests

Assistant: 54 pass, 0 fail, 0 skipped, 0 todo.

Bot: 31 pass, 0 fail, 0 skipped. Deprecation: `punycode` from a dependency during the bot run. Not a failure.

# 4. Telegram bot review

The bot lives only in the attached folder. It was not copied into this repo.

Structure: `src/bot.js` builds a Telegraf bot, memory `session()`, private-chat and rate-limit guards, then handlers for start, language, access mode, menu, human support, text, and callbacks. `src/services/answerService.js` answers. `src/services/faqService.js` and `src/data/` hold the FAQ. `src/services/geminiGrounded.js` calls Gemini on those sections. `src/services/speechService.js` speaks. `src/services/humanSupportService.js` keeps a memory `Map` of recent learners (max 1000) and sends a staff chat message.

Library: Telegraf 4.16.3. `bot.launch({ dropPendingUpdates: true })` is long polling (`getUpdates`). There is no webhook.

Answers: greeting from locale strings; otherwise Fuse/local FAQ; if `ANSWER_PROVIDER` is `gemini` and `GEMINI_API_KEY` is set, Gemini on the bot's own sections (code default model `gemini-3.1-flash-lite`; the bot `.env` sets `GEMINI_MODEL`, value not printed). It does not call this project's API.

Languages: `en`, `am`, `om`, `ti`, `so`, `ar` in `src/data/locales.js`. `/start` always opens the language picker.

Token: `BOT_TOKEN` is set. It is not printed. `BACKEND_API_BASE_URL` is empty, so the patch below does nothing until you set that URL.

Patches. Do not copy the bot into this repo. Apply them in the bot folder.

**`src/services/answerService.js` — call this API first**

Before: `getAnswer` goes to `findLocalAnswer` or `askGemini`.

After: at the start of `getAnswer`, if `config.backendApiBaseUrl` is non-empty, `POST {base}/api/v1/ask` with JSON `{ question, language }` and header `content-type: application/json`. If the body has `answer`, return `{ status: 'answered', answer: body.answer, sourceUrl: body.sources?.[0]?.url || null }`. If `answer` is null, return `{ status: 'not_found', answer: null, sourceUrl: null }`. On network failure, keep today's local/Gemini path. Do not send `BACKEND_API_KEY`. This API does not check that header on `/ask`.

**`src/handlers/startHandler.js` — `lang_topic`**

Before:

```js
export function registerStart(bot) {
  bot.start(showLanguagePicker);
}
```

After:

```js
export function registerStart(bot) {
  bot.start(async (ctx) => {
    const raw = String(ctx.startPayload || '');
    const match = raw.match(/^(en|am|om|ti|so|ar)_(tutor|careers|alerts|accommodation)$/);
    if (match && ctx.session) {
      ctx.session.language = match[1];
      ctx.session.topic = match[2];
      if (match[2] === 'accommodation') {
        ctx.session.pendingQuestion = 'I need an accommodation for my interview';
      }
    }
    if (ctx.session?.language) {
      return; // open the existing main menu for that language instead of the picker
    }
    await showLanguagePicker(ctx);
  });
}
```

Wire the menu call to the function the menu handler already uses. If `topic` is `accommodation`, call the escalation patch below instead of only storing the sentence.

**`src/services/humanSupportService.js` — ticket**

Before: `forwardSupportRequest` only `telegram.sendMessage` to `HUMAN_SUPPORT_CHAT_ID`.

After: also `POST {BACKEND_API_BASE_URL}/api/v1/escalations` with `{ language, topic: ctx.session.topic || 'tutor', conversation: [{ role: 'learner', text: question }] }`. Creating a ticket does not need the helper token. Keep the Telegram staff message if `HUMAN_SUPPORT_CHAT_ID` is set. Tell the learner the same wait sentence the widget uses, not "delivered", when the POST fails.

**Job alerts — new, there is no before**

Add a menu button that `POST`s `/api/v1/ask` with a short jobs question in `ctx.session.language` and sends `answer` plus the first source URL. That is the smallest shared-logic alert. A scheduler that pushes new listings is still missing.

# 5. Score view

Gate: **at risk**. The gate is pass/fail before points. This pass did not run the co-designer, did not run axe, and the conformance file does not name a screen-reader tester. The widget's controls are real elements in source. That is not a pass.

| Points | What | Strongest evidence | Biggest gap |
| --- | --- | --- | --- |
| 30 | Co-designer | Text plus Listen, dialog, log, keyboard handlers in source | No recorded unaided session |
| 25 | Another platform can adopt it | One script tag, shadow CSS, `/api/v1`, OpenAPI path list, webhook test, compose file parses | Bot not on the API, no `jobs.html`, root README missing the judge's outline, `docker compose up` not run |
| 15 | Ethiopia | Six language files, Ethiopic CSS, Arabic `dir`, region guess, Addis voice ids in code | Phone format, Ethiopian calendar, Slow 3G, `_needsReview`, live TTS |
| 15 | Quality, security, privacy | 54 tests, keys stay on the server, capture is click-gated, 401 on the helper list | Advice is only a prompt, helper token committed in `.env.example`, axe not re-run, translation cache survives Clear |
| 15 | Keep it running | AI off still answers from the lesson. Gemini and Addis are switches | No monthly cost figure. No Ollama provider. README size is wrong |

# 6. Next 10 actions

1. Put the co-designer on their phone over HTTPS and do the task with TalkBack, then keyboard only, 200% zoom, and sound off. Write the result at the end of `CONFORMANCE.md`.
2. Serve the site and run axe on `http://localhost:8080/demo/blank.html` and the concept page with the panel open. Count critical and serious inside the widget separately from the host.
3. In `api/app.js` `askOfflineOrModel`, return not-found without calling Gemini when `topSections` is empty, and pass only those sections into `gemini.answer`. Update the ask test so a miss does not add a call.
4. Apply the four bot patches in section 4. Set `BACKEND_API_BASE_URL` to this API. Do not print the bot token.
5. Add a refusal list for medical, legal, and immigration questions before retrieval, with a test in `none.test.js` and `api.test.js`.
6. Add `savanna/pages/jobs.html` and embed the guide's JobPosting JSON-LD for each item in `demo/data/jobs.json`.
7. Stop forcing SMS to English. Add a test whose question is not English.
8. Rotate the helper token that is committed in `.env.example`. Ask the mentor whether MIT is the licence named at kick-off.
9. Time `demo/blank.html` on Slow 3G. On another laptop run `docker compose up` and open port 8080.
10. Have readers clear `_needsReview` on am, om, ti, so, and ar. Then add phone normalisation and the Ethiopic calendar if those points are still in scope.

File written: `docs/TRACK3_CHECKLIST.md`.
