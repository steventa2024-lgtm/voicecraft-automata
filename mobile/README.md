# VoiceCraft Mobile

Expo app for iPhone and Android. It is the console companion. It does not place blocks on the phone, and it does not replace the website or the desktop app.

## What works in this tree

- Email and password sign-in, account creation, password reset, and sign-out against the existing Supabase project once `mobile/.env` is filled in.
- Five tabs: Home, Build, Console, Library, Settings.
- Push-to-talk recording. Audio is uploaded only after you stop. A transcript never approves a build.
- Preview, explicit approval, cancel, and job polling against `services/cloud-api`.
- Blueprint save, rename, duplicate, favorite, delete, and reuse. The library is empty until you save a real preview.
- Console steps for PS5 and Xbox. Connection status comes from `GET /api/mobile/health`. The screen does not invent a connected server.

## What is not verified

- No physical iPhone or Android install was performed here.
- No PS5 or Xbox joined a server.
- Whisper and Ollama are optional and were not run.
- The Minecraft Docker profile was not started. Queued jobs fail closed, with no blocks reported, when the host is down.
- Remote push notifications are not configured.

## Run the API

From the repository root, with Node.js 22:

```sh
export CLOUD_SERVER_TOKEN="$(openssl rand -hex 24)"
export CLOUD_PAIR_PEPPER="$(openssl rand -hex 24)"
export CLOUD_LOCAL_ACCOUNTS=1
node services/cloud-api/src/server.js
```

The API listens on `127.0.0.1:8787`. A phone cannot use that address. Use your computer's LAN IP in `EXPO_PUBLIC_VOICECRAFT_API_URL`, or put HTTPS in front of it before a production build.

`CLOUD_LOCAL_ACCOUNTS=1` uses the SQLite ledger in the cloud process. Leave it unset and set `VOICECRAFT_SITE_URL` when the existing website should enforce Stripe limits through `/api/builder/token` and `/api/builder/verify-run`.

## Run Expo

```sh
cd mobile
npm install
npx expo install --check
npm run typecheck
npx expo start
```

On an iPhone, install Expo Go for this SDK from the App Store and scan the QR code if `npx expo start` prints one. If the phone and computer are not on the same network, run `npx expo start --tunnel`. Tunnel mode needs an Expo account.

This environment did not complete a device install. Do not treat a Metro start as a passed iPhone test.

## Cloud Minecraft

```sh
cd infra/docker
export CLOUD_SERVER_TOKEN="$(openssl rand -hex 24)"
export CLOUD_PAIR_PEPPER="$(openssl rand -hex 24)"
docker compose up cloud-api build-worker
```

Add a Minecraft world only after you accept Mojang's EULA yourself:

```sh
EULA=TRUE docker compose --profile minecraft up
```

Bedrock port `19132/udp` is the gameplay port. RCON is disabled. See `docs/MOBILE_CLOUD.md`.
