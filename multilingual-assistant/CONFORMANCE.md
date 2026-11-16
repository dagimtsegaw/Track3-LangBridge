# Conformance

Phase 1 is the offline assistant: six languages, lesson search, and the chat panel. This file does not claim full WCAG 2.2 AA conformance for later phases (live help, speech that always works, cloud answers). A module that fails the accessibility gate is not scored.

## What this phase implements

- The widget is a custom element. Its CSS is inside a shadow tree and does not restyle the host page.
- The launcher is a `button`, `max(4rem, 64px)` square (`max(3.5rem, 56px)` under 30rem wide), with its accessible name loaded from `module/i18n`. Savanna sets the root font to 14px, so the px floor keeps the target size. The chat and accessibility launchers sit side by side in the inline-end corner on one line and share one lift, so they stay clear of the Savanna sidebar.
- Each accessibility tile has a separate "About …" button (not nested inside the tile's own button). It opens a `dialog` with `showModal` that explains the setting; the voice commands one also lists every command. Escape closes it and returns focus to that button.
- The launcher fill is `#002b56` with white text. Savanna sets `--bs-primary` to `#db3e3e`. White or near-black text on that red is under 4.5:1, so the host color is used on the border, not as the text background.
- The panel is a `dialog`. Escape closes it and returns focus to the launcher. Opening moves focus to the Close button. A source link on the same page closes the dialog, scrolls to the section, and moves focus there.
- Visible keyboard focus is a 3px outline. The stylesheet does not set `outline: none`.
- The question field has a visible label. Enter sends. Shift+Enter inserts a newline. The message list is `role="log"` with `aria-live="polite"`, and each message is `dir="auto"`.
- Language files exist for English, Amharic, Afaan Oromoo, Tigrinya, Somali, and Arabic. The picker is a `select` whose options use the native name and a `lang` attribute. Arabic sets `dir="rtl"` on the widget only.
- Sizes use `rem` and CSS logical properties. The panel width is capped with `100vw` so a 320px viewport does not grow a horizontal page scrollbar. The question form stays in view; the topic list scrolls inside the panel.
- Targets use a 48px floor. The font stack names Noto Sans Ethiopic, then the host font, then `system-ui`. Line height is 1.7. The widget does not set uppercase or letter-spacing.

## Check

axe-core was run in headless Chrome on `demo/blank.html` and `pages/concept-with-navigation.html` with the panel open, using the WCAG 2.0/2.1/2.2 A and AA tags. On the blank page there were zero violations. On the Savanna lesson page the widget had zero critical or serious results. That page still has host-page results that this module does not change: `aria-allowed-attr` (critical), `color-contrast` (serious), and `link-name` (serious).

`npx @axe-core/cli` did not finish on this machine. Node 22 cannot install the CLI's `chromedriver` package (`ERR_REQUIRE_ESM` in its install script). The run above uses the `axe-core` library directly.

At a 320px wide viewport, and again with the root font at 200%, `demo/blank.html` does not grow a horizontal scrollbar with the panel open or closed. The same check on the Savanna lesson page shows horizontal overflow that is still there when the widget is removed. Control targets in the widget stay at least 48px.

## Phase 2

The API returns errors as sentences. The helper desk at `/helper` uses a labeled token field, real buttons, and a 3px focus outline. The widget says "Connected" only after health reports a configured model, and "Not connected" when that model is off or the request fails. Swagger UI at `/docs` is the third-party page and is not part of the accessibility claim for the widget.

## Phase 3

Checked in a desktop browser on `demo/blank.html`, with no Addis key and no Gemini key, so cloud speech was not configured.

- Assistant replies stay visible. Each one has Listen and Stop. Listen is `aria-pressed` while that reply is speaking. A status line says "Preparing the voice…" and then "Speaking." Speech did not start on load.
- English was spoken by the browser voice after a click, and Stop ended it. With the language set to Amharic, the speech report said this browser has no voice for that language. Listening to Amharic text showed: "ድምጽ ለዚህ ቋንቋ በዚህ መሣሪያ አይገኝም። ጽሑፉን ማንበብ ይችላሉ።" Nothing was spoken.
- The microphone is one toggle. The first press shows the agreement text and does not start listening if the person chooses Not now.
- Settings is a tablist. Arrow keys move the selected tab and the hidden panels stay `display: none`. Clicking a tab selects it. Voice commands start off, with the Chrome and internet explanation visible.
- High contrast adds `db-contrast` and writes `#db-a11y-effects` once. Text size steps and announces the percent. Reset all removes the class and returns the size to 100%.
- At a 320px wide viewport with the panel open, the page scroll width stayed equal to the client width.

This pass did not repeat the axe run from Phase 1. It did not exercise a real microphone, Addis speech, or Gemini speech.

## Phase 4

Checked in a desktop browser on `demo/blank.html` and `pages/concept-with-navigation.html`. The machine time zone was `Africa/Addis_Ababa`. No Gemini key was configured, so the live page-translation calls used a stand-in response in the browser. The API test covers order and length without calling Gemini.

- With no saved language, the open panel showed one `role="status"` suggestion, `lang="am"`: "ወደ አማርኛ ይቀይሩ?" with Switch and Not now. It was not a dialog. Not now stored `db-assistant:tz-dismiss`. After reload the suggestion stayed hidden and the language stayed English.
- Suggest a language for my area showed the consent sentence first. A DevTools location for Mekelle offered Tigrinya, Adama offered Afaan Oromoo, and Jijiga offered Somali. Each offer said it was a guess from the nearest town. Keep current left the language alone. Switch to Afaan Oromoo saved `db-assistant:lang` and dispatched `db-assistant:language`. Nairobi showed that no language could be told for the area, and the current language stayed. No coordinates were stored.
- A denied position and a timeout were reported in words. Those two results were produced by returning the browser error codes after this session had already allowed location. An insecure page was not opened; the check ran on localhost.
- With no translation service, the panel said page translation is not connected and named the browser's own Translate option. Nothing on the page changed.
- With a stand-in `POST /v1/translate`, translating the blank page to Amharic replaced the heading, the paragraph, the button label, `title`, and `aria-label`. Show original put those values back exactly, including whitespace, and removed the `lang` it had set. Cancel during "Translating… 0 of 5" left the original text and said the translation was cancelled. An `html` class `translated-ltr` showed that the site is already translating, and the page was not changed.
- On the Savanna lesson the same stand-in translated the visible lesson text, including "The Future of the VA Industry" and Mark as complete. Show original restored the heading exactly, including its surrounding spaces. The widget's own labels were not translated. With the panel open the page scroll width stayed equal to the client width. No console errors were recorded on either page. Escape closed the panel and returned focus to the launcher.

A follow-up widened page translation from `<main>` to the whole `<body>`. On `pages/concept-with-navigation.html` the earlier collector would send 116 strings from `<main>` (8,633 characters, none cut by the 20,000 character cap) and would miss the 11 sidebar labels. The new collector includes those 11, 127 strings in all (121 distinct, 8,496 characters), and leaves 113 hidden strings unsent, including the Markdown guide modal and the congratulations modal.

Afaan Oromoo, Tigrinya, Somali, Arabic, and the Amharic strings for this phase still need a native reader. The town coordinates are approximate.

## Phase 5

Checked in a desktop browser on `demo/blank.html` and `/helper`. The API under test had `TELEGRAM_BOT_USERNAME=SavannaTutorBot` and a helper token. Screen sharing used a stand-in stream from `canvas.captureStream` passed back by `getDisplayMedia`. The browser's own share prompt was not completed. A live screen reader was not running. The check used the accessibility tree and focus.

- Talk to a person is in the panel before any question is asked. Opening the panel moves focus to Close. Talk to a person opens a second dialog. Focus moves to that dialog's Close. The dialog name is "Talk to a person" and the description is "A tutor will answer. It may take until morning." Escape closes only that dialog and returns focus to Talk to a person. Escape again closes the panel and returns focus to Open assistant.
- The topic radios are named A tutor, Careers, Alerts, and Accommodation. Choosing Careers set the link to `https://t.me/SavannaTutorBot?start=en_careers`. Setting the `telegram` attribute to `OtherTutorBot` changed the link to that bot. The text-message section says there is no phone number and names `/sms/inbound`.
- Leave a message with an empty box and no conversation said "Type a message first." A message was posted and the page dispatched `db-assistant:escalated` with the ticket id. With `fetch` forced to fail, the status was "Saved on this phone. It will send when you are online." and the body was in `localStorage`. An `online` event sent it and cleared the queue.
- "I need an accommodation for my interview" posted `topic` `accommodation` with the five sample listings from `demo/data/jobs.json`, the page address, and the heading "Blank page".
- Screen sharing stays off. Turning the setting on showed Share my screen and did not call `getDisplayMedia` until that button. The call was `{ video: true, audio: false }`. The bar read "You are sharing your screen" and "This is a preview on your device. A helper cannot see it. There is no helper connection from this page." Stop hid the bar, said sharing had stopped, and returned focus to Screen sharing: On.
- With the browser identified as Chrome on Android, Share my screen was hidden, the panel said screen sharing is not available, and "Send what page I'm on" created a ticket. `getDisplayMedia` was not called. The helper desk showed that ticket's page address and heading.
- The helper desk listed topic, a page link, the heading, and, for the accommodation ticket, the five listings. The token field is labeled. Mark answered remains a button.
- At a 320px wide viewport, and again with the root font at 200%, the page scroll width stayed equal to the client width. Talk to a person was at least 48px in both directions.

This pass did not repeat the axe run. The new Amharic, Afaan Oromoo, Tigrinya, Somali, and Arabic sentences still need a native reader.

## Not claimed

Noto Sans Ethiopic is not downloaded, so Ethiopic text uses a fallback font until the device has one. Browser speech recognition and voice commands depend on Chrome (or another browser that implements `SpeechRecognition`) and an internet connection. They stay off until the person starts them. Afaan Oromoo, Tigrinya, Somali, Arabic, and the Amharic strings added for this phase are marked for review. The dyslexia option uses fonts already on the device. It does not download a font file. The area language is a nearest-town guess and needs a secure page. Page translation sends page text to Gemini only after confirmation, and only when `/api/v1/health` reports `ai: true`. Screen sharing is a local preview. This page does not send the screen to a helper. Chrome on Android is treated as unable to share. The real browser share prompt was not completed in this check.
