# Manual tests

These scripts were not run in the documentation pass on 16 Nov 2026. `node --test` (68 pass) and `npm run axe` do not replace them. Write the result in [../CONFORMANCE.md](../CONFORMANCE.md). Do not mark a row Supports from this file alone.

Start the stack first:

```bash
cd multilingual-assistant
docker compose up --build
```

Open http://localhost:8080/demo/blank.html unless a script names another page.

## Keyboard

Unplug the mouse.

1. Tab to the chat launcher. Enter opens the panel.
2. Tab to the question box. Type `What is shaping the future of VA work?` Enter sends.
3. Tab to Listen on the reply. Enter starts speech. Tab to Stop. Enter stops it.
4. Tab to Talk to a person. Enter opens the dialog. Focus should be on Close.
5. Tab through topic, message, Leave a message, and the Telegram link.
6. Escape closes the dialog. Focus should return to Talk, or to the launcher if the panel also closes.
7. Shift+Tab should not skip a control or leave you stuck.

Record any control you cannot reach.

## NVDA (Windows)

Same steps as keyboard, with NVDA on. Confirm the log announces the reply, the not-found sentence after a nonsense question, and the ticket status. Confirm Arabic, if you switch to it, is announced as Arabic.

## TalkBack (Android)

Use HTTPS or `localhost` only if the phone can open it. Eyes closed is the point of the script.

1. Open the chat launcher.
2. Ask a question and hear the reply.
3. Open Talk to a person and leave a message.
4. Open screen share. Chrome on Android should offer sending the page, not a share sheet that works.

Record the phone model and Android version.

## 200% zoom and 320px

1. Chrome zoom 200% on http://localhost:8080/pages/concept-with-navigation.html . The launcher must not cover the host's own controls. The person dialog must stay on screen.
2. DevTools device width 320px. Same checks. No horizontal scroll that hides Close or Leave a message.

## Sound off

Mute the device. Ask a question. The reply must be text. Listen may fail silently. Stop must still be there. A ticket must still send as text.

## Voice commands

Chrome only. Turn voice commands on in Settings. Say one phrase from `module/i18n/<code>.json` `commands` in each of `en`, `am`, `om`, `ti`, `so`, and `ar`. Record which ones the box heard and which command ran. "Share my screen" should only focus the button.

## Listen, per language

With the API up, switch language and press Listen on one reply in `en`, `am`, `om`, `ti`, `so`, and `ar`. Record silence, the wrong language, or a played voice. Somali has no default Addis voice id (`addis: "catalog"`).

## Offline queue

1. DevTools, Network, Offline.
2. Talk to a person, Leave a message.
3. The status must be exactly: `Saved on this phone. It will send when you are online.`
4. Set the network back online. The status should change when the queue sends, and the helper desk should show a ticket.

The widget does not set `language` on that post. The stored ticket language will be `en` until that is fixed.

## Slow 3G

Chrome DevTools, Network, Slow 3G, hard reload http://localhost:8080/demo/blank.html . Read the Finish time on the document request. Write it in CONFORMANCE.md. The raw first load measured on disk is 393425 bytes, and this nginx file does not gzip.

## Clean-clone Compose

On a laptop that is not the one that already has containers: clone, `cd multilingual-assistant`, `cp .env.example .env`, put your own helper token in `.env` (the example's token is nonempty), `docker compose up --build`, open blank.html and `/docs`. Replace the example token before you push.

## Both bots together

Two terminals, two BotFather tokens.

```bash
cd telegram-support-bot
npm start
```

```bash
cd telegram-jobs-bot
npm start
```

Send `/start` to @alxtestsbot and to @alxjobsbot. Each bot should answer. If one stays silent, they are sharing a token.

From the widget, open the Telegram link. With the current `.env`, health names `alxtestsbot`, so the link should open that bot with `start=<lang>_<topic>`. @alxjobsbot ignores that payload and shows the language list.

## Co-designer

Do this on their own phone, over HTTPS, without you driving.

**Task sentence (draft, confirm it with them):** On the concept page, ask what is shaping the future of VA work, listen to the answer, and leave a message for a tutor.

Also ask them to try keyboard only, their screen reader, 200% zoom, and sound off, if the device allows it.

Record:

- Name and phone (they choose what goes in the README)
- Device, browser, screen reader
- Whether they finished the sentence without help
- The exact step they could not do
- Date

Put that in the testing record at the end of [../CONFORMANCE.md](../CONFORMANCE.md).
