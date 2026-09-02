# ZeroPulse

ZeroPulse is a voice-controlled Minecraft Java builder with three parts:

1. A TanStack Start landing/download site and mobile-friendly voice dashboard.
2. A local Node.js bridge that receives dashboard commands over WebSocket or a
   paired Supabase Realtime channel.
3. A Mineflayer automation engine that parses high-level requests, generates a
   bounded block plan, and places it in the connected world.

The platform also includes Supabase email/Google/GitHub authentication, private
Java and Bedrock downloads, Stripe subscriptions with atomic daily usage limits,
and SHA-256-hashed friends-and-family license keys.

## Run the website

```sh
npm install
npm run dev
```

The production web build is `npm run build`.

## Run the Minecraft bridge from source

Minecraft Java must be running in Creative mode or with cheats/operator rights.
For a single-player world, choose **Esc → Open to LAN → Allow Cheats: ON**, then
use the port printed in Minecraft chat.

```sh
cd bridge
npm install
```

Create `bridge/.env`:

```dotenv
MC_HOST=localhost
MC_PORT=25565
MC_USERNAME=ZeroPulse
MC_VERSION=1.20.4
BRIDGE_PORT=8765
ZP_PAIR_CODE=
ZP_API_URL=http://127.0.0.1:8080
```

Then run `npm start`, open `/dashboard`, and wait for **Connected**. Direct mode
uses `ws://localhost:8765` on the same computer. To speak from a phone, select
Relay mode in the dashboard and put its pairing code in `ZP_PAIR_CODE` before
starting the bridge.

Examples:

- `build me a large stone mansion`
- `build a 7 floor quartz tower 18 blocks ahead`
- `build a 21 by 15 sandstone castle behind me`
- `clear a 31 by 31 area to my left`
- `stop`

The bot can also receive commands in Minecraft chat with the zp prefix after a
signed-in dashboard build has paired a short-lived runner token.

## Builder behavior

The bridge validates every remote instruction, clamps dimensions and offsets,
deduplicates overlapping generator output, validates blocks against the current
Minecraft registry, rotates the plan relative to the bot, samples the terrain,
and enforces a 120,000-operation limit.

With operator rights it uses `/fill` and `/setblock`. Without op it can perform
slower hand placement only when the bot is in Creative mode; farms and water
features require command mode for exact placement. Survival without op is
reported as unavailable instead of pretending the build succeeded.

See [bridge/README.md](bridge/README.md) for the protocol and generator details.
Run the automation regression suite with:

```sh
cd bridge
npm test
```

## Desktop companion

`desktop/` contains the Electron shell that bundles the bridge and Node runtime.
`desktop/build.sh` stages bridge dependencies and packages Windows/macOS builds.

## Accounts, billing, and private downloads

Copy .env.example values into your deployment environment and apply the
Supabase migration. See IMPLEMENTATION_BLUEPRINT.md for provider setup, Stripe
webhook events, R2 private-object configuration, admin promotion, and the full
modified/new file map.

The Bedrock package source is in bedrock-companion/. It bootstraps the official
Geyser Standalone gateway and includes console discovery guidance.

This repository is connected to Lovable. Do not rewrite published git history;
normal commits on the connected branch sync back to the Lovable editor.
