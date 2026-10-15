# ZeroPulse VoiceCraft handoff

This report describes the desktop migration on branch `cursor/voicecraft-desktop-v2-0daa`. The commit SHA is recorded at the bottom after the change set is committed. Treat a missing SHA as "not yet committed," not as a released build.

## 1. Executive summary

The public website no longer hosts a Minecraft command dashboard. `/dashboard` redirects to `/get-started`. The interactive product is an Electron application that loads a local React bundle and starts a loopback Mineflayer bridge.

Command parsing, planning, entitlement math, and dispatch rules live in one shared package, `packages/protocol`. Preview, undo, and unknown commands do not fall through into structure generation. Builds require an approved plan and, when the account website is configured, a server-issued runner token.

The work is implemented and covered by the local Node test suite, a production website build, and a desktop renderer typecheck. It has not been connected to a live Minecraft world, a hosted Supabase project, or Stripe. The Windows installer is an unsigned NSIS package produced by cross-compilation. It has not been installed on Windows.

## 2. Repository and branch

- Repository: `steventa2024-lgtm/voicecraft-automata`
- Base: `main` at `0cff164` (`Applied overlay & config`)
- Branch: `cursor/voicecraft-desktop-v2-0daa`

## 3. Commit

See the SHA at the end of this file.

## 4. Original problems

- The website route `/dashboard` was a live Minecraft controller.
- The Electron shell loaded a Lovable preview URL instead of a local dashboard.
- `src/lib/command-parser.ts` and `bridge/parser.js` were separate parsers.
- The local WebSocket accepted commands without a required bridge token, and the relay treated a short code as enough to reach the builder.
- In-game chat with a `zp` prefix could reach the dispatcher, including on offline-mode servers where a username is not a trustworthy identity.
- Runner-token verification was not wired through the bridge, and token identifiers were not consumed, so replay was possible at the protocol layer.
- Preview and undo could be confused with a normal build because dispatch was not an explicit action switch.
- Direction and dimension handling disagreed between the two parsers.
- Progress could be reported from requested work rather than confirmed placements.
- Bedrock was documented as a `bedrock-companion/` package that is not in the repository.
- `bridge` advertised `npm test` without a test script that ran a suite.
- `.env` was tracked. It contained the public Supabase URL and publishable key, which are client-visible by design. No service-role key, Stripe secret, or webhook secret was found in the tree.

## 5. Security repairs

- The bridge binds to `127.0.0.1` by default and refuses to start without a bridge token of at least 24 characters. The first WebSocket frame must authenticate. Messages are size-limited, origins are limited to loopback and `file:`, and the desktop renderer never sees the bridge token.
- Electron IPC is an allowlist. The sender must be a `file:` page or the dev renderer on `127.0.0.1`. `shell.openExternal` only opens same-origin paths on the configured account website.
- Context isolation is on, Node integration is off, the renderer is sandboxed, navigation and extra windows are blocked, and a restrictive Content Security Policy is applied.
- Settings returned to the renderer replace the publishable key with `configured`. Saving that mask does not overwrite the stored key. A value that starts with `sb_secret` is rejected.
- The bridge child environment is scrubbed of service-role, Stripe, password, relay-key, and inherited bridge-token variables. The desktop process sets a fresh bridge token itself.
- Relay pairing uses a one-time short-lived code and an X25519 session id. A pairing code does not authorize a build. Remote messages are proposals; the desktop user still approves execution.
- Chat control is off by default. Turning it on still requires an allowlist, and destructive chat actions stay blocked. Offline-mode chat is not trusted unless `MC_CHAT_TRUST_OFFLINE=1`.
- Runner tokens are HMAC-signed, carry `jti` and a device id, and expire in 300 seconds. `consume_runner_token` records the identifier before the quota RPC. A later replay fails. `release_builder_reservation` refunds a reservation only when confirmed placements are zero.
- The tracked `.env` is removed from the index. `.gitignore` already ignores `.env`. The publishable key remains appropriate for client apps. Rotate it only if you want to treat that public client key as compromised. Rotate any service-role or Stripe secret that was ever placed in a hosting dashboard, not because this pass found one in git.

## 6. Website to desktop

Removed from the public experience: voice controls, start/stop build buttons, live connection controls, and the interactive dashboard. Bookmarks to `/dashboard` redirect to `/get-started`, which explains the move and links to the Windows download.

Preserved: landing, account creation and login, billing and license redemption, download and world-setup guidance, and the server routes the desktop client calls (`/api/account/me`, `/api/builder/token`, `/api/builder/verify-run`, `/api/builder/release`, `/api/auth/desktop/issue`, `/api/auth/desktop/exchange`).

The old files `desktop/main.cjs`, `desktop/preload.cjs`, `desktop/renderer.html`, and `src/hooks/use-bridge.ts` are deleted. `src/lib/relay.ts` no longer opens a broadcast channel.

## 7. Architecture

```text
Website (TanStack Start)     accounts, Stripe, licenses, runner tokens
Desktop renderer (React)     local assets only, via zeropulse.invoke
Electron main                token storage, IPC allowlist, bridge supervisor
Bridge (Mineflayer)          127.0.0.1 WebSocket, placement, history writes
packages/protocol            parser, plans, dispatch, entitlements, tokens
SQLite (user data dir)       blueprints, build history, device records
```

Packaged layout keeps `asar` disabled so the bridge and protocol resolve as real files under `process.resourcesPath`. Electron Builder warns about that. Enabling asar would break the relative imports the packaged main process uses unless those imports are rewritten.

## 8. Desktop sections

The local UI has a navigation rail, a status bar, and a build-progress strip that stays visible across sections.

- Home — connection, account, last status, and diagnostics from real bridge events. Empty states explain missing setup.
- Build Studio — typed commands, push-to-talk through the browser speech API inside Electron, transcription, material and structure fields, a Three.js preview of the validated plan, and approve / pause / resume / cancel.
- Blueprint Library — save, duplicate, favorite, search, import, and export of `zeropulse-blueprint-v1` JSON.
- Build History — local rows with status, counts, and undo/redo when the stored blocks still match.
- Connections — host, port, version, username, auth mode, bridge start/stop, and an explicit note that Bedrock is not in this build.
- Settings — account website, Supabase URL, publishable key, Ollama, chat-control toggle, browser sign-in, and password sign-in.

The preview mesh draws at most 15,000 blocks and says so when the plan is larger. Execution still uses the full plan, capped at 120,000 operations.

## 9. Builder

The pipeline is parse, validate, survey, plan, bounds-check, preview, approve, entitlement, execute, verify a sample of command placements, and store history.

Command mode uses `/setblock` and `/fill`, splits fills at the vanilla 32,768-block cap, rate-limits, and listens for permission failures. Creative hand placement runs only when the game mode is creative. Survival without operator rights throws `survival_unavailable`.

Progress is confirmed operations over requested operations. A build with failures is `completed_with_errors`, not 100% success. Cancelled builds stay cancelled. States are idle, planning, awaiting approval, building, paused, cancelling, cancelled, completed, and failed.

Terrain survey records elevation, water, lava, and occupied cells it can read. Existing structures require the protected-block policy. The default policy aborts.

## 10. Features added

- Voxel preview with rotate, zoom, and pan, generated from `buildPlan`, not from a stock image.
- SQLite history and undo/redo. Undo restores a block only when the current block still equals the recorded "after" state. Containers and protected blocks are excluded.
- Local blueprint library. Gzip NBT, `.schem`, and `.litematic` are rejected with an explicit error.
- Optional Ollama planner. Localhost only, JSON schema validation, known structure parts, then the deterministic generators. No paid model and no raw console commands.
- Push-to-talk and typed fallback. The microphone is not left on. Wake word and Whisper.cpp are not bundled.

## 11. Authentication and billing

Desktop browser sign-in opens the system browser to `/auth/desktop` with PKCE state and a loopback redirect. The website issues a one-time code. The app exchanges it at `/api/auth/desktop/exchange`. The exchange implementation mints a session with the Supabase admin API. That path is not live-tested and returns 503 when the service role or the new tables are unavailable.

Password grant uses the publishable key against Supabase Auth. Tokens are stored with Electron `safeStorage` when the OS provides it, otherwise only in process memory.

Plan tiers are unchanged: starter 5 tasks / 5,000 blocks, builder_pro 30 / 50,000, architect unlimited tasks / 500,000 blocks, plus `unlimited_tester`. A reservation is refunded only when confirmed placements are zero. Partial and cancelled builds that already placed blocks keep the charge. Offline mode does not grant a paid build; local preview still works.

## 12. Database migration

`supabase/migrations/202610150001_desktop_auth_and_runner_replay.sql` adds `runner_token_uses` and `desktop_auth_codes`, plus `consume_runner_token` and `release_builder_reservation`. Privileges are revoked from `anon` and `authenticated` and granted to `service_role`. Existing subscription rows are not modified.

This migration has not been applied to the hosted project from this environment.

## 13. Dependencies

- Root: existing website dependencies, including Zod.
- `packages/protocol`: Zod.
- `bridge`: existing Mineflayer stack, plus Zod. Node engine is `>=22`.
- `desktop`: Electron 33.4.11, Electron Builder 25, Vite 6, React 19, Three 0.170, Tailwind 4.

No multi-gigabyte model is bundled.

## 14. Important files

- `packages/protocol/src/*` — shared contract
- `bridge/index.js`, `runtime.js`, `placer.js`, `builder.js`, `relay.js`, `store.js`
- `desktop/electron/main.js`, `policy.js`, `preload.cjs`
- `desktop/src/App.tsx`, `preview.tsx`
- `src/routes/dashboard.tsx`, `get-started.tsx`, `auth/desktop.tsx`
- `src/routes/api/auth/desktop/*`, `src/routes/api/builder/release.ts`
- `src/lib/server/desktop-auth.server.ts`, `runner-token.server.ts`
- `supabase/migrations/202610150001_desktop_auth_and_runner_replay.sql`
- `tests/*.test.js`

## 15. Tests

Command used:

```sh
npm test
```

That runs `node --test tests/*.test.js`. The suite includes parser directions and dimensions, preview/undo/unknown dispatch, unauthenticated bridge commands, runner-token rejection, chat authorization, IPC allowlisting, SQLite undo, and a source check that `/dashboard` redirects and the desktop tree has no Lovable preview URL.

On Node v22.14.0 this suite finished with 38 passing tests, 0 failures, and 0 skipped tests. `node:sqlite` prints an experimental warning on this Node version. That warning is expected.

Not executed here:

- Playwright against a signed-in website
- Electron GUI automation
- A Mineflayer connection to Minecraft
- Supabase or Stripe
- GitHub Actions (the workflow file is added; this environment did not run it)
- Installing the EXE on Windows

## 16. Windows packaging

Electron Builder 25.1.8, NSIS, x64, Electron 33.4.11, `signAndEditExecutable: false`. No certificate was available. The build log says signing was skipped. SmartScreen will warn until the binary is signed.

Cross-compilation used Wine 9.0 on Linux. The successful log line is `EXIT:0`. An earlier attempt without Wine exited 1 and left a 185 KB stub; that stub was replaced by the successful package.

## 17. Installer artifact

Produced in this environment and not committed:

```text
dist-desktop/ZeroPulse-VoiceCraft-Setup-2.0.0.exe
```

`file` reports `PE32 executable (GUI) Intel 80386, for MS Windows, Nullsoft Installer self-extracting archive`. Size is 109 MB. The unpacked tree contains `resources/app/dist/index.html`, `resources/bridge/index.js`, and `resources/packages/protocol/src/parser.js`. A search of the packaged app directory found no `lovable.app` string. The installer was not launched on Windows.

## 18. Launch the desktop app

Development:

```sh
cd desktop && npm install && npm run dev
```

```sh
cd desktop && ZP_DESKTOP_DEV=1 npx electron .
```

Installed build: run `ZeroPulse VoiceCraft` from the Start menu or desktop shortcut after the NSIS installer finishes. The first window is the local dashboard even if the website cannot be reached.

## 19. Connect Minecraft

Open the world to LAN with cheats, or use a server where the bot is an operator. In Connections, set host, port, username, and authentication, then start the bridge. Preview a command in Build Studio and approve it. Approval asks the account website for a runner token. Without `appOrigin` in Settings, approval fails closed.

## 20. Enable Ollama

Install Ollama separately. In Settings, keep the URL on `http://127.0.0.1:11434`, enter an installed model name, and use Check Ollama. Ask for a plan from Build Studio. If Ollama is down, typed commands still parse locally.

## 21. Unfinished work

- Apply the new SQL migration on the hosted Supabase project and live-test desktop code exchange.
- Sign the installer and decide where the private download is hosted. The download page should not serve an unsigned file as a production release without that decision.
- Confirm Microsoft account login for the Minecraft bot.
- Add a Windows job that installs the EXE, or run the installer on a Windows machine.
- Wake word, Whisper.cpp, survival placement, and schematic import are intentionally absent.

## 22. Known limitations

- Not production-ready. Compiling and unit tests are not a live Minecraft trial.
- Unsigned installer. No auto-update feed.
- `asar` is off.
- Relay still needs `ZP_RELAY_URL` and `ZP_RELAY_KEY` if you turn it on, and the desktop app currently starts the bridge with those variables cleared. Pairing management in the UI is local bookkeeping until that transport is configured.
- Chat cannot approve destructive work.
- History snapshots are capped (30 builds, 50,000 changes, 20,000 blocks captured per build).
- Large previews are visually capped at 15,000 blocks.
- Bedrock is not shipped.
- `.schem` and `.litematic` are not supported.

## 23. Recommended next steps

1. Apply `202610150001_desktop_auth_and_runner_replay.sql` on the hosted database.
2. Configure the desktop Settings account website and publishable key, then complete one browser sign-in against that project.
3. Open a LAN world and run one small approved build. Compare the preview block count with the finished structure.
4. Install the EXE on Windows 10 or 11 and repeat that build from the installed app.
5. Add code signing before any public download link.

## Status labels

| Area | Status |
| --- | --- |
| Public dashboard removed; `/dashboard` redirects | Implemented, covered by source tests and the website build |
| Local desktop dashboard | Implemented. Renderer build and typecheck passed. GUI not browser-tested |
| Lovable preview URL removed from the desktop app | Implemented, source test |
| Bridge auth, chat lockout, dispatch safety | Implemented, unit-tested. Not tested against a live server |
| Runner tokens and quota SQL | Implemented in code and migration. Not applied to hosted Supabase |
| Desktop PKCE exchange | Implemented, not live-tested |
| Preview, history, undo, blueprints, Ollama client | Implemented. Ollama and Minecraft not live-tested |
| Voice | Push-to-talk via the platform speech API. No local Whisper runtime |
| Windows installer | Cross-compiled here to a 109 MB unsigned NSIS EXE. Not installed on Windows |
| Bedrock | Not implemented |

## Commands

```sh
npm install
npm test
npm run build
cd desktop && npm install && npm run build && npx tsc -p tsconfig.json --noEmit
bash desktop/build.sh
```

## Commit SHA

`3e002d0cf14813f84ef91509dd133aae5ccf7cb5`

The line above is the product commit. A follow-up commit only records this SHA in the handoff.
