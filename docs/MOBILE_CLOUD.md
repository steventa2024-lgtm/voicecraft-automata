# VoiceCraft mobile and cloud

**Zero-cost requirement:** Development, mobile testing, local API, and optional self-hosted Minecraft testing must not require any new paid service. The owner is willing to pay only for the Apple Developer Program when needed for iOS distribution. Read [ZERO_COST_POLICY.md](./ZERO_COST_POLICY.md) before suggesting hosting, paid AI APIs, subscriptions, or deployment.

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

When `VOICECRAFT_SITE_URL` is set, confirm reserves allowance through the existing `/api/builder/token` and `/api/builder/verify-run` routes. The runner token is stored only on the server job row. If the job fails or is cancelled before any confirmed placement, the worker calls `/api/builder/release`. Partial builds keep the charge. That remote path was not called against a live Supabase project here.

`CLOUD_LOCAL_ACCOUNTS=1` uses the SQLite ledger in this process. It is refused when `NODE_ENV` or `CLOUD_ENV` is `production`. For local testing, export the flag only on a development machine and create a tester profile with `unlimited_tester` or an active plan row in that SQLite file. Do not turn the flag on for a public host.

## Pairing

1. The player joins the hosted world.
2. `services/minecraft-host/chat-bridge.js` hears `vc pair`, reads the UUID from the server player list, and asks the API for a code.
3. The issue request sends the verified UUID and a `bedrock` flag only. It must not send `ps5` or `xbox`.
4. The player types that code into the phone while signed in and chooses PlayStation 5 or Xbox in the app.
5. The code is stored only as a hash, expires in five minutes, and cannot be claimed twice.
6. A player UUID already linked to another account is rejected.

Offline-mode chat names without a UUID are ignored. `CLOUD_REQUIRE_FLOODGATE=1` accepts only Floodgate UUIDs. This bridge was not connected to a live server.

## Console connection

The phone asks the player to choose PlayStation 5 or Xbox. That choice is stored with the pairing claim. The server sends the player UUID and a Bedrock flag only. A UUID is not treated as proof of which console the player is holding.

PS5 and Xbox do not get a normal custom-server field in every Minecraft UI. The practical path is BedrockConnect, or another console discovery workaround, on the same Wi-Fi as the phone, aimed at the published Bedrock host and UDP port 19132. The player does not install the Windows desktop app. VoiceCraft does not edit an existing single-player world, an unrelated Realm, or a server whose operator has not installed this adapter. Console multiplayer may require the platform's own subscription. Those limits are still true. No PS5 or Xbox hardware test was run.

## Speech and planning

Typed requests such as `build a small stone house` are parsed on the server without an AI model. Preview still requires an explicit approve step before any job is queued. A completed job is recorded only after the worker reports confirmed block placements. A queued job or an open TCP port is not a completed build.

Transcription runs on the server. If `WHISPER_CPP` and `WHISPER_MODEL` are unset, the API returns 503 and the phone keeps the typed command. Recordings are written to a temporary directory and deleted after the attempt. The phone does not record in the background. Whisper is optional local software. This project does not call a paid transcription API.

If `OLLAMA_URL` is a localhost URL and `OLLAMA_MODEL` is a local model name, an unrecognized sentence can be planned through Ollama and then validated with the shared schema. Ordinary commands do not need it. The model cannot emit raw Minecraft commands. Model names that point at a hosted Ollama cloud tag are ignored, so the API does not call a paid inference endpoint. If Ollama is not installed, or only a hosted model is configured, the typed workflow remains available and the health check reports the planner as not configured.

## Connection modes

The phone has one Settings control with three modes. The client only calls `/api/mobile/*`. It never opens a Minecraft console, RCON, or an arbitrary command channel.

| Mode | Who runs the API and world | What the phone may do |
| --- | --- | --- |
| Local developer | You, on a computer you already own, on a private network | Development and testing. Not a 24/7 service. |
| Community server | An operator who installed this adapter | Pair, revoke your device, preview, and approve builds they allow. |
| Your server | You, on Linux, Windows, or macOS hardware you control | Same API as local mode, including a later HTTPS address. |

A cleartext `http://` address is accepted only for local developer mode and your-server mode while the app is a development build, and only for localhost or a private LAN address. Community mode requires HTTPS. Production builds require HTTPS in every mode. Credentials embedded in the URL are rejected.

**Project-owner budget is $0 for new hosting. Do not recommend or provision a rented VPS for this development milestone.** Use the existing PC for local testing, and support authorized third-party, community, or self-hosted Minecraft servers for console users who have no computer. Always-on operation requires somebody's hardware, electricity, and connectivity. The mobile app cannot guarantee free 24/7 compute. No server was rented here. Open-source software does not make Minecraft free to operate.

### Operator setup (Linux, Windows, macOS)

Install Docker and Node.js 22 on a computer you control. From the repository root, set `CLOUD_SERVER_TOKEN` and `CLOUD_PAIR_PEPPER` to random values of at least 24 characters. On Windows PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Do not commit those values.

```sh
docker compose -f infra/docker/docker-compose.yml up cloud-api build-worker
```

Add the Minecraft world only after you accept Mojang's EULA:

```sh
EULA=TRUE docker compose -f infra/docker/docker-compose.yml --profile minecraft up
```

That profile runs Paper, Geyser, Floodgate, and the chat bridge. Gameplay ports are Java `25565` and Bedrock UDP `19132`. RCON is off. The compose file publishes the API on `127.0.0.1:8787`. For a phone on the same private network during development, set `CLOUD_BIND` to that computer's LAN address and allow the port only on the firewall's private profile. Put Caddy or nginx with HTTPS in front before any phone that is not a development client. Do not publish the development API on the public internet.

The operator's chat bridge issues pairing codes with `x-server-token`. Players claim those codes in the app and can revoke the link. A player who does not control the host cannot install this stack or issue codes.

## Hosting limits

A computer you already own can run the API and worker. Add memory for a Paper world. Whisper and Ollama are optional and need model files on that computer. If they are absent, typed build requests still work and the API reports transcription and planning as not configured. Do not buy a server from this repository's scripts.

`supabase/migrations/202610150002_mobile_cloud.sql` is an optional locked-down mirror. The API process uses SQLite and does not write those Supabase tables yet.

## Tests

`node --test tests/cloud-api.test.js` covers health honesty, one-time pairing, preview isolation, entitlement rejection, idempotent confirm, failed-host refunds, cancellation, and transcription refusal. It does not open a Minecraft port.

## PC companion

The desktop app can pair a phone on the same private network from Mobile Companion. Pairing uses a one-time code that expires after five minutes. The phone then receives a session token stored only on the device. Remote build, pause, resume, cancel, and undo requests go through the desktop bridge and still require the desktop account's build authorization. Remote builds stay off until the PC owner enables them.

The phone cannot send shell commands, files, or a generic Minecraft command. Live Windows screen sharing and remote mouse input are not implemented. Expo Go has no supported way to pin a self-signed certificate or capture the Windows desktop, so those controls stay disabled and report that they are unavailable. The companion request itself is private-network HTTP and is not encrypted. Pair it only on a Wi-Fi network you trust. A public address is rejected.

The catalog of 50 structures is the same generator on desktop and mobile. A phone preview is an isometric drawing of that voxel plan. It is not a live 3D orbit and not an in-world hologram. Approving a template asks the PC to rebuild the plan and reject the approval when the fingerprint differs.

## iPhone

```sh
cd mobile && npm install && npx expo start
```

Install Expo Go matching this SDK, then scan the QR code. Sign-in, the command center, console navigation, and the development API health check have been confirmed on a physical iPhone. A completed Minecraft build has not.

## Android

```sh
cd mobile && npx expo start --android
```

Or `eas build --platform android --profile preview` after a free `eas login`, when the free EAS quota is available. `mobile/eas.json` does not request a paid resource class and does not turn on automatic plan upgrades. If the free quota is exhausted, wait or build Android locally. Do not subscribe to a paid Expo plan. No Android device or EAS build was run.

## Later App Store release

Do not publish to the App Store from this branch. The bundle identifier `com.zeropulse.voicecraftmobile` is already set and should stay stable. A later iOS release needs:

- An Apple Developer Program membership, which is the only optional spend the owner has approved. Do not enroll it from this repository.
- A Mac with Xcode, or a free-tier EAS iOS build once that membership exists. This Windows computer cannot produce an App Store binary by itself.
- The existing Expo account on the free plan. Expo Go remains the development path.
- A privacy policy URL on a site the project already has. Do not register a new domain for it.
- App privacy answers for the microphone, which is used only while the player records a request.
- Screenshots from a real device session. A Metro start is not a store screenshot.

TestFlight comes after that membership. It is not configured here.

## Readiness

The API and the mobile client are implemented and the API tests pass. The stack is not release-ready. Device, console, Whisper, Ollama, Stripe, and hosted Minecraft checks are still open.
