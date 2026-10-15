# First real local Minecraft build: preparation

## Verified preparation (2026-10-15)

- Base revision: `bc18ed6`. Existing PR #3 branch was already up to date after fetching.
- Installed Mineflayer: 4.38.0; its tested versions include Java 1.21.1. Installed minecraft-data resolves 1.21.1 to protocol 767, matching the canonical block-state registry.
- Selected Paper: **1.21.1 build 133**, downloaded from the official Paper downloads service. SHA-256: `39bd8c00b9e18de91dcabd3cc3dcfa5328685a53b7187a2f63280c22e2d287b9`.
- Portable runtime: Temurin **21.0.12.1+1**, downloaded from the official Adoptium API and checked against its published SHA-256. The existing launcher runtime is Java 25 and existing client installations are 26.x; neither was assumed compatible.
- Official Mojang Java 1.21.1 version metadata and client JAR downloaded and SHA-1 checked. The launcher still needs to finish libraries/assets when the user plays this installation.
- Separate server and client directories under `%USERPROFILE%\VoiceCraft-Local-Test-1.21.1`. Existing launcher profiles were backed up before adding `VoiceCraft Local Test 1.21.1` with its own game directory. Existing survival worlds were not opened or modified.
- Server configured for `127.0.0.1:25566`, offline authentication, a new flat disposable world, creative mode, no RCON/query, and a level-2 operator entry for the dedicated `VoiceCraftTest` bot. Offline authentication is confined to loopback; no forwarding or public tunnel was configured.
- `eula.txt` remains **false**. The launch script refuses to run until the human explicitly accepts the [Minecraft EULA](https://aka.ms/MinecraftEULA). Downloading the server does not constitute acceptance.
- Desktop launched against the real Electron main process, not a mocked API. Connections configured for the isolated server and **Operator commands**. Mobile Companion opened on **8791**, with build/view/input permissions all false. Cloud API **8787** is a separate service.
- Desktop account status: signed out, with no account website configured. Production entitlement and runner-token checks remain intact; real account verification must wait for the user's supported account site and sign-in.

## Code change and validation

Connections now exposes a validated placement mode (`auto`, `command`, `creative`), passes it explicitly into the bridge, and persists the chosen connection settings. New installations default to the architecture registry's Java 1.21.1 target. Operator mode does not grant Minecraft permissions or bypass account/build approval.

82 Node regression tests pass, including pairing, entitlement rejection, runner-token replay checks, approval fingerprints, cancellation, undo conflicts, and all 50 architecture presets. Desktop TypeScript and production build pass. The Connections screen was checked in the running Electron application. Local HTTP tests require a runner that allows loopback connections.

## Remaining physical and live-server checks

1. User explicitly accepts EULA; start the disposable server and verify its actual protocol and loopback listener.
2. User selects the isolated 1.21.1 launcher installation, finishes any Minecraft sign-in/download interaction, and joins the saved local server.
3. Configure the existing account website and sign in through the desktop's normal flow. Verify entitlement without changing production account flags or issuing a build reservation prematurely.
4. Start the operator bridge, verify Minecraft readiness, and pair the physical iPhone using the desktop's one-time code on 8791. Keep remote builds disabled until the user explicitly authorizes them.
5. Inspect the enhanced Lakeside Cottage on phone and desktop, including material counts, orientation, and actual world-space placement. Prepare, then wait for explicit build approval.
6. Execute only after approval. Count confirmed world blocks and properties, failed operations and skipped operations; command acceptance alone is insufficient. Save real Minecraft screenshots beside app previews.
7. Exercise cancellation and undo in the disposable world, including protection of newer player edits.

**No real Minecraft build was executed during this preparation. Placed/failed/skipped totals, physical iPhone behavior, real cancellation, undo, and Minecraft screenshots remain unverified.** Do not describe automated test results or app previews as proof of a real build.

References: [Paper Java requirements](https://docs.papermc.io/paper/getting-started/), [Paper download service](https://docs.papermc.io/misc/downloads-service/).
