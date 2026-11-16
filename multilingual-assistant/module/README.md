# module/

The file a host site loads is `db-assistant.js`. Language files, providers, and assets stay beside it and are loaded later by URL, relative to that script.

## Install

```html
<script src="https://HOST/module/db-assistant.js" data-lang="auto" data-api="https://HOST/api" data-content="/content.json" defer></script>
```

`data-lang` defaults to `auto` (saved choice, then `navigator.languages`, then English). An Addis Ababa time zone can suggest Amharic; it does not switch by itself. `data-provider` is `none`, `cloud`, or `auto`. `data-theme` is accepted and stored. `data-telegram` is the public bot username used for the Telegram link when it is set; otherwise the widget reads `telegram` from `GET /api/v1/health`. The same values can be set on a hand-written element: `<db-assistant lang="am" api="..." content="..." provider="none" theme="..." telegram="...">`.

If the script tag has any of those `data-*` attributes, it appends one `<db-assistant>` to `document.body`. It does not append a second one when an element is already on the page, or when the script runs again.

## Phase 1

The panel asks a question, searches the host's lesson text in the browser, and shows a short excerpt with a source link. It does not call a model.

`data-lang="auto"` picks a language in this order: `localStorage` key `db-assistant:lang`, then the first match in `navigator.languages`, then English. A specific `data-lang` value (not `auto`) wins over the saved choice. If nothing is saved, the chosen language is not already Amharic, and the time zone is `Africa/Addis_Ababa`, the panel shows one suggestion to switch to Amharic. Not now is stored under `db-assistant:tz-dismiss` and the suggestion does not return. The language does not change until the person presses Switch. The language control is a `<select>`. Choosing a language updates the widget, sets `dir` (`rtl` for Arabic), saves `db-assistant:lang`, and dispatches `db-assistant:language`.

Adding a language means a new `i18n/<code>.json` plus one object in `i18n/languages.json`. The file's `language` object holds the code, native name, `dir`, speech tag, and Addis voice id (`none` when Addis is not used, `catalog` when Addis is tried and there is no fallback voice). Those five fields are copied into `languages.json`. Speech tags and Addis voices are read from that list. Strings fall back from the selected file to English. Afaan Oromoo, Tigrinya, Somali, Arabic, and the new Amharic strings are marked `"_needsReview": true` until a native reader checks them.

`data-content` is a JSON file `{ "sections": [{ "id", "title", "url", "text", "lang" }], "sources": ["/more.json"] }`. Each file in `sources` uses the same shape and is searched with the first file. `demo/content.json` is the Savanna lesson. `demo/data/jobs.json` is five fake listings. If `data-content` is missing, or the file cannot be loaded, the widget reads `h1`–`h3` inside `<main>` and writes an id onto a heading that does not have one.

`data-provider` chooses the answer module:

- `none`: `providers/none.js` (keyword search, no network)
- omitted or `auto`, when `data-api` is set: `GET {data-api}/v1/health`. `ai: true` uses `providers/cloud.js`. `ai: false`, or a failed request, stays on `none.js` and the status line says it is not connected
- `cloud`: `providers/cloud.js` calls `POST {data-api}/v1/ask`. If health says the model is off, or the call fails, the widget uses `none.js` and says so

Below the score threshold, the answer text is null. The panel says it could not find this in the course. Talk to a person stays in the panel and opens the human-help dialog described under Phase 5.

Settings includes Clear my saved data, which removes every `localStorage` key that starts with `db-assistant:`.

## Phase 3

Speech, voice commands, and host-page display tools. UI text is still only in `i18n/*.json`. Command phrases are a `commands` object of arrays. English phrases are also matched when the selected language is not English.

`providers/speech-cloud.js` calls `POST {data-api}/v1/tts` and plays the returned audio. `providers/speech-browser.js` uses `speechSynthesis` and only a voice whose language tag matches. Neither file holds an API key. Nothing speaks or listens until a click, a hover the person turned on, or a voice command they started.

`data-api` is joined in `api-url.js`. `/api` and `api` both mean the site root (`/api/v1/...`), not the page folder. An absolute value such as `http://localhost:3000/api` is left as written. A trailing slash is dropped. Listen reads `GET {data-api}/v1/health` again on every press. It does not keep the result from page load. With the widget set to Amharic, Afaan Oromoo, Tigrinya, or Somali, that press calls Addis when `ttsAddis` is true, including when the lesson excerpt itself is tagged English. The audio is a blob (`audio/mpeg` for Addis mp3, `audio/wav` for Gemini). If the server or `play()` fails, the status line shows the status and the message. The “voice is not available” sentence is only for the case where cloud speech is off and this device also has no voice for that language. English and Arabic try Gemini when `ttsGemini` is true, then a browser voice. Somali can still come back as “not configured” from Addis; the widget then tries the browser and, failing that, shows that server message.

The microphone is one toggle (`aria-pressed`) with a visible "Listening…" line. Recognized words go into the question box and are not sent. The person can correct them. If the browser has no speech recognition, the box stays and a sentence says so. The first start asks for agreement. The browser may send audio to its own speech service; this module does not store it.

Voice commands are off until the person turns them on in Settings. The choice is remembered, but the microphone stays off on the next visit until they press the button again. Commands need Chrome and an internet connection. The live region shows the last heard phrase and the action, or says it was not recognized and to say help. Saying help lists the phrases. A phrase does not have to be said in full: when most of the words heard belong to one command ("open", "open a", "cursor off"), that command runs, and a tie goes to the command listed first in the language file. Small mishearings within one or two letters still match. Sentences that only share a word with a command ("what is a virtual assistant") do nothing. "Share my screen" turns screen sharing on and moves focus to the start button, because the browser only starts sharing from a click.

The accessibility launcher sits at the bottom start corner. When the page has a fixed `#sidebar` (or `.sidebar`) that runs to the bottom of the window, the launcher sits just past it and moves when the sidebar is collapsed or expanded.

Host display changes use one `<style id="db-a11y-effects">` and `db-` classes on `<html>`: high contrast, text size from 100% to 200% in steps of 10, a dyslexia-friendly font stack already on the device (Comic Sans, Verdana — no font file is downloaded), line spacing from 100% to 200% in steps of 20 (of a 1.5 line height), read on hover (off until turned on), a large cursor, and highlighted links. Reset all turns those off. Read selected text speaks the selection. Clear my saved data removes these too.

`module/voice-match.js` matches phrases and headings. `module/voice-match.test.js` and `module/providers/speech-browser.test.js` cover that without a browser.

## Phase 4

Language suggestion and opt-in page translation. UI text is still only in `i18n/*.json`. The new sentences in Afaan Oromoo, Tigrinya, Somali, Arabic, and Amharic are in the files already marked `"_needsReview": true`.

Settings, Language, shows "Suggest a language for my area". The consent sentence is on screen before that button. `navigator.geolocation` runs only from the click, with `enableHighAccuracy: false` and a 10 second timeout. The coordinates are not stored and are not sent. They are dropped after `module/regions.js` reads `module/data/regions.json`. That file is marked approximate and needs review by a local reader. It lists 34 towns. A point outside the Ethiopia box (latitude 3.3 to 15.0, longitude 32.9 to 48.0) gets "We could not tell a language for this area" and the current language stays. Inside the box, the nearest town within 150 km supplies the language. If no town is that close, or the two nearest towns use different languages and are within 20 km of each other, the suggestion is Amharic. The person confirms with Switch or Keep current. The line in the panel says the guess is based on the nearest town and may be wrong. Switch saves `db-assistant:lang` and dispatches `db-assistant:language`.

Location needs a secure page (HTTPS or localhost). A denied permission, a missing position, a timeout, or an insecure page is a sentence in the panel. There is no third-party place-name lookup.

"Translate this page" is separate from the widget's own language files. The consent sentence says the visible text of this page will be sent to the translation service configured by the site. Nothing is posted until the person presses the button. The target is the widget's selected language, and English is not a target. The call is `POST {data-api}/v1/translate` only. If `GET {data-api}/v1/health` says `ai` is false, or the check fails, the panel says page translation is not connected and mentions the browser's own Translate option. If the host page already has `.goog-te-combo`, `#google_translate_element`, or `translated-ltr` / `translated-rtl` on `<html>`, the panel says the site is already translating and this module does not run.

Text is collected with a TreeWalker from the whole `<body>`. `script`, `style`, `noscript`, `code`, `pre`, `select`, `svg`, `template`, the `<db-assistant>` element, and editable content are skipped. Hidden text is counted and not sent. Empty text and text that is only numbers or punctuation are skipped. Strings on screen come first, in document order, then the rest of the page in document order. Leading and trailing whitespace stays on the node. `alt`, `title`, `aria-label`, and `placeholder` are translated. The `value` of an `input` whose type is `button` or `submit` is translated. Typed values are not sent. The same string is sent once and written onto every matching node. Each request sends at most 20 strings or about 3000 characters, which is the API limit (20 strings, 2000 characters each). A failed batch is tried once more, then once as two smaller batches. The page stops at about 60,000 characters of distinct text. The status line says how many strings were translated and how many were not, and why: over the limit, a failed batch, or hidden. Cancel aborts the request and restores the page. While a translation is showing, new text from the host is translated after a short pause. Show original stops that and writes the saved values back, including `lang` and `dir`. `dir="rtl"` is set only for Arabic. The host's ids, classes, and event handlers are not changed.

`module/regions.test.js` covers Mekelle, Jijiga, Adama, Bahir Dar, Addis Ababa, a remote point inside Ethiopia, Nairobi, and Cairo.

## Phase 5

Human help. UI text is still only in `i18n/*.json`. The new sentences in Afaan Oromoo, Tigrinya, Somali, Arabic, and Amharic are in the files already marked `"_needsReview": true`.

Talk to a person is one button in the panel, including when a lesson search misses. It opens a second `<dialog>` with `showModal`. Focus moves to Close. Escape closes that dialog and returns focus to Talk to a person. Escape again closes the panel and returns focus to the launcher. The dialog says a tutor will answer and that it may take until morning.

The topic is one of `tutor`, `careers`, `alerts`, `accommodation`. Leave a message posts `POST {data-api}/v1/escalations` with the conversation so far, the language, the topic, and the page address, heading, and selected text. Offline, or when that post fails for a network reason, the body is queued in `localStorage` key `db-assistant:outbox`. The status line is the translation of "Saved on this phone. It will send when you are online." A later `online` event sends it and then dispatches `db-assistant:escalated` with `{ ticketId }`. A page with no `data-api` says the message cannot be sent. It does not pretend the queue will leave the phone.

Open Telegram is a link `https://t.me/<username>?start=<lang>_<topic>` when `module/help-link.js` accepts the username. `data-telegram` wins over the health field. The `start` value is the language, an underscore, and the topic, for example `am_accommodation`. The text-message section says `/sms/inbound` is a documented demo and that there is no phone number.

"I need an accommodation for my interview" creates a ticket with `topic` `accommodation`. The context is the sections whose URL or id comes from `demo/data/jobs.json` (loaded with `demo/content.json`, or fetched from `data/jobs.json` beside the content file). The visible note says the sample listings and the page location are included.

Screen sharing is a Settings toggle on the Display tab. It stays off until that toggle is on, and `getDisplayMedia({ video: true, audio: false })` runs only from Share my screen. The bar "You are sharing your screen" stays up, with Stop, and says this is a local preview because this page has no helper connection. It does not say a helper can see the screen. Chrome on Android is unsupported: the toggle then shows "Send what page I'm on" instead of Share my screen. That button creates a ticket whose page fields are the URL, the current heading, and the selected text. `module/help-link.test.js` covers the `start` payload and that Chrome-for-Android case.

## Tests

From the repository root:

```bash
npm install --prefix api
node --test
```

`module/providers/none.test.js` covers English and Amharic scoring. `module/regions.test.js` covers the town table. The root `package.json` sets `"type": "module"` so Node can load those files. API tests need the packages installed under `api/`.
