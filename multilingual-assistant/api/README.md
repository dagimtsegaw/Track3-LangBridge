# api/

Node.js server for model answers, speech, translation, tickets, and SMS. Keys stay in the environment. The browser never sees them.

## Run

From the repository root, copy `.env.example` to `.env`

```bash
npm install --prefix api
docker compose up
```

- API direct: <http://localhost:3000>
- Same routes through nginx: <http://localhost:8080/api/v1/health>
- Helper desk: <http://localhost:3000/helper>
- Swagger UI: <http://localhost:3000/docs>

`AI_PROVIDER=none` is enough to try retrieval, SMS, and tickets. Gemini and Addis stay off until their keys are set. Health reports that with booleans only.

## What is honest

- `GET /api/v1/health` reports booleans for `ai`, `ttsAddis`, `ttsGemini`, and `escalations`. `ai` is true when `AI_PROVIDER=gemini` and `GEMINI_API_KEY` is set, or when `AI_PROVIDER=ollama` and both `OLLAMA_BASE_URL` and `OLLAMA_MODEL` are set. `telegram` is the public bot username from `TELEGRAM_BOT_USERNAME`, or an empty string. It is not a secret.
- `POST /api/v1/content` stores `{ "sections": [...] }` in memory for this process. Later `/ask` calls that omit `sections`, and `/sms/inbound`, search that set. At most 40 sections. Each text is at most 8000 characters. An empty or unusable body is 400 and a sentence.
- Ollama is called only with the sections that cleared the search threshold. A failure returns the lesson excerpt with `"mode": "offline-fallback"`. Page translation still needs Gemini.
- A phone on a ticket (`contact`) or on SMS (`from`, when it is sent) must be an Ethiopian mobile: `09…`, `07…`, `+251…`, or `251…`. It is stored as `+251` and nine digits. A bad number is 400 and a sentence. An empty contact is still allowed.
- `POST /api/v1/ask` searches the sections first. Below the same threshold as `module/providers/none.js`, the model is not called. The body is `{ "answer": null, "sources": [], "mode": "not-found" }`.
- When the model is off, a hit uses the lesson excerpt and `"mode": "offline"`.
- When the model errors or times out, the same excerpt is returned with `"mode": "offline-fallback"`.
- Sources are the retrieved sections. A link invented by the model is not copied into `sources`.
- Speech that is not configured returns 501 and a sentence, so a client can use the browser voice.
- `TTS_PROVIDER=mock` returns a silent WAV and the header `X-DB-TTS: mock`. It is not an Addis voice. Health keeps `ttsAddis` false.
- Tickets are JSON in `api/data/escalations.json` (test data). The list route stays closed until `HELPER_TOKEN` is set.
- Webhook registrations live in memory and are dropped when the process stops. The posted body is the event, ticket id, and language. It does not include the conversation or the contact.

`TELEGRAM_BOT_USERNAME` is returned on `GET /api/v1/health` as `telegram` so the widget can build `https://t.me/<username>?start=<lang>_<topic>`. The `start` payload is the language, an underscore, and one of `tutor`, `careers`, `alerts`, `accommodation`. Example: `am_accommodation`. This server does not run the bot.

A ticket may include `topic` (default `tutor`), `page` (`url`, `heading`, `selection`), and `context` (up to eight short listings). The helper desk shows those. The webhook body stays `{ event, ticketId, language }` and does not include the page or the listings.

## Addis speech — confirm these before relying on it

The adapter follows the public Addis Voices 2 guide at <https://docs.addisassistant.com/docs/capabilities/text-to-speech> (catalog note on that page: 4 November 2026).

Verified from that page:

- `POST https://api.addisassistant.com/api/v1/voice/generations`
- Header `x-api-key`
- JSON fields `text`, `voice_id`, `language`, `output_format` (`mp3_44100`), optional `client_request_id`
- The documented curl reads `.data.audio_url` (a signed URL). A first response may also be a `data:` URL. This server downloads that URL and returns the bytes.
- Voice list: `GET /api/v1/voice/voices?language=`
- Example voice ids on that page: `am-hamen`, `om-bikila`, `ti-berhane`

Still confirm with a real `ADDIS_API_KEY`:

1. Somali (`so`) is not in the documented language list (`am`, `om`, `ti`, `sw`, `ha`, `sid`, `wal`). This server does not invent a Somali voice. If the catalog has none, the route returns 501.
2. The voices-list JSON shape (a bare array, or an object with `data` / `voices`) was not in the curl example. Confirm the live envelope.
3. Confirm the audio field is still `data.audio_url`, and that the signed URL can be fetched without sending the API key a second time.
4. If the catalog request fails, Amharic, Afaan Oromoo, and Tigrinya fall back to `am-hamen`, `om-bikila`, and `ti-berhane`. Confirm those ids still exist.

English, Arabic, and any other language use Gemini speech when `GEMINI_API_KEY` is set (`GEMINI_TTS_MODEL`, default `gemini-2.5-flash-preview-tts`). Otherwise they get 501. Audio from Gemini is wrapped as WAV when the response is raw PCM.

## curl

Health:

```bash
curl -s http://localhost:3000/api/v1/health
```

Index sections. Later questions that omit `sections` search this set.

```bash
curl -s -D - -X POST http://localhost:3000/api/v1/content \
  -H "content-type: application/json" \
  -d "{\"sections\":[{\"id\":\"lesson-1\",\"title\":\"Weekday inbox\",\"url\":\"/lesson#inbox\",\"text\":\"Weekday help sorting an email inbox.\",\"lang\":\"en\"}]}"
```

Ask. Omit `sections` to search the indexed sections, or the demo course on disk when nothing has been indexed. The widget sends the page sections instead.

```bash
curl -s -X POST http://localhost:3000/api/v1/ask \
  -H "content-type: application/json" \
  -d "{\"question\":\"What is shaping the future of VA work?\",\"language\":\"en\"}"
```

A miss does not call the model:

```bash
curl -s -X POST http://localhost:3000/api/v1/ask \
  -H "content-type: application/json" \
  -d "{\"question\":\"zzzz quantum pottery\",\"language\":\"en\"}"
```

Speech. Without a configured provider this is 501.

```bash
curl -D - -o speech.bin -X POST http://localhost:3000/api/v1/tts \
  -H "content-type: application/json" \
  -d "{\"text\":\"Hello from the lesson\",\"language\":\"en\"}"
```

Translate. 503 until Gemini is configured. At most 20 strings.

```bash
curl -s -X POST http://localhost:3000/api/v1/translate \
  -H "content-type: application/json" \
  -d "{\"texts\":[\"Saved\",\"Offline\"],\"target\":\"am\"}"
```

Open a ticket, then list and close it. Set `HELPER_TOKEN` first.

```bash
curl -s -D - -X POST http://localhost:3000/api/v1/escalations \
  -H "content-type: application/json" \
  -d "{\"language\":\"am\",\"conversation\":[{\"role\":\"learner\",\"text\":\"I need a person\"}]}"

curl -s http://localhost:3000/api/v1/escalations \
  -H "authorization: Bearer $HELPER_TOKEN"

curl -s -X PATCH http://localhost:3000/api/v1/escalations/TICKET_ID \
  -H "authorization: Bearer $HELPER_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"note\":\"Called them back.\"}"
```

Register a webhook. The server POSTs `{ "event", "ticketId", "language" }` when a ticket opens.

```bash
curl -s -D - -X POST http://localhost:3000/api/v1/webhooks \
  -H "content-type: application/json" \
  -d "{\"url\":\"https://example.com/hooks\",\"events\":[\"escalation.opened\"]}"
```

SMS. The body is plain text, at most 160 characters, with the section title in parentheses.

```bash
curl -s -X POST http://localhost:3000/sms/inbound \
  -H "content-type: application/json" \
  -d "{\"from\":\"+251900000000\",\"text\":\"weekday inbox sorting\"}"
```

Docs and the helper page:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/docs/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/helper
```

The same paths work on port 8080 when Compose is up, because nginx forwards `/api/`, `/sms/`, `/docs`, `/helper`, and `/openapi.yaml`.

## Tests

From the repository root, after `npm install --prefix api`:

```bash
node --test
```

`api/api.test.js` covers a mocked Gemini answer, a timeout fallback, the 160-character SMS cap, and the helper token.
