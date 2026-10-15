# VoiceCraft mobile and cloud

This continues `feature/voicecraft-mobile-companion` (pull request #2) on top of the desktop branch. The phone is the controller. A hosted Minecraft world is the only place blocks change. Console players are not asked to install the desktop app.

## Architecture

```text
iOS / Android app
  -> Supabase Auth (existing project)
  -> services/cloud-api  (authenticated JSON API)
  -> SQLite job ledger, or the existing website entitlement endpoints
  -> services/build-worker
  -> Minecraft Java (Paper) + Geyser/Floodgate for Bedrock
PS5 / Xbox Minecraft Bedrock joins that hosted world
```

The phone never receives a runner token and never sends Minecraft console commands.

## API

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/mobile/health` | none |
| POST | `/api/mobile/pairing/issue` | `x-server-token` |
| POST | `/api/mobile/pairing/claim` | user JWT |
| POST | `/api/mobile/pairing/revoke` | user JWT |
| GET | `/api/mobile/session` | user JWT |
| POST | `/api/mobile/builds/preview` | user JWT |
| POST | `/api/mobile/builds/confirm` | user JWT |
| GET | `/api/mobile/builds/:id` | user JWT |
| POST | `/api/mobile/builds/:id/cancel` | user JWT |
| GET | `/api/mobile/history` | user JWT |
| GET/POST/DELETE | `/api/mobile/blueprints` | user JWT |
| POST | `/api/mobile/transcribe` | user JWT |

Preview does not insert a job. Confirm checks the exact preview, charges one reservation, and queues a job. The worker marks the job failed and refunds that reservation when no blocks were confirmed. A cancelled queued job is stored as `cancelled`.

When `VOICECRAFT_SITE_URL` is set, confirm reserves allowance through the existing `/api/builder/token` and `/api/builder/verify-run` routes. That path was not called against a live Supabase project here.

## Pairing

1. The player joins the hosted world.
2. `services/minecraft-host/chat-bridge.js` hears `vc pair`, reads the UUID from the server player list, and asks the API for a code.
3. The player types that code into the phone while signed in.
4. The code is stored only as a hash, expires in five minutes, and cannot be claimed twice.
5. A player UUID already linked to another account is rejected.

Offline-mode chat names without a UUID are ignored. `CLOUD_REQUIRE_FLOODGATE=1` accepts only Floodgate UUIDs. This bridge was not connected to a live server.

## Console connection

PS5 and Xbox do not get a normal custom-server field in every Minecraft UI. The practical path is BedrockConnect, or another console discovery workaround, on the same Wi-Fi as the phone, aimed at the published Bedrock host and UDP port 19132. VoiceCraft does not edit an existing single-player world or a Realm. Those limits are still true. No console hardware test was run.

## Speech and planning

Transcription runs on the server. If `WHISPER_CPP` and `WHISPER_MODEL` are unset, the API returns 503 and the phone keeps the typed command. Recordings are written to a temporary directory and deleted after the attempt. The phone does not record in the background.

If `OLLAMA_URL` is a localhost URL and `OLLAMA_MODEL` is set, an unrecognized sentence can be planned through Ollama and then validated with the shared schema. Ordinary commands such as `build a small stone house` do not need it. The model cannot emit raw Minecraft commands.

## Hosting

Smallest test host: 2 vCPU, 4 GB RAM, 20 GB disk for the API and worker without a model. Add 2 GB RAM for the Paper world. A local Whisper or Ollama model needs more RAM than a phone-class box; run those on the same VPS only if you choose a small model. Do not buy a server from this repository's scripts.

Expected monthly cost if you rent it yourself: a small VPS is often about $5–$20 before Minecraft uptime and backups. That is a market range, not a quote. No server was rented here.

`infra/docker/docker-compose.yml` publishes the API on `127.0.0.1:8787` and, only with `--profile minecraft`, UDP 19132. Set `EULA=TRUE` yourself. RCON is off. Put Caddy or nginx with HTTPS in front before any phone build that is not a development client.

`supabase/migrations/202610150002_mobile_cloud.sql` is an optional locked-down mirror. The API process uses SQLite and does not write those Supabase tables yet.

## Tests

`node --test tests/cloud-api.test.js` covers health honesty, one-time pairing, preview isolation, entitlement rejection, idempotent confirm, failed-host refunds, cancellation, and transcription refusal. It does not open a Minecraft port.

## iPhone

```sh
cd mobile && npm install && npx expo start
```

Install Expo Go matching this SDK, then scan the QR code. That scan is the one physical step. It had not been done when this document was written.

## Android

```sh
cd mobile && npx expo start --android
```

Or `eas build --platform android --profile preview` after `eas login`. No Android device or EAS build was run.

## Readiness

The API and the mobile client are implemented and the API tests pass. The stack is not release-ready. Device, console, Whisper, Ollama, Stripe, and hosted Minecraft checks are still open.
