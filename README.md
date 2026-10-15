# ZeroPulse VoiceCraft

ZeroPulse VoiceCraft is a Minecraft Java automation product. The public website is the storefront. The Windows application is the product.

Speak a build, preview the plan, and approve it on the computer that is connected to Minecraft.

## What runs where

| Surface | Responsibility |
| --- | --- |
| Website | Landing page, getting started, Windows download, accounts, Stripe billing, license redemption, documentation |
| Desktop app | Sign-in, Minecraft connection, voice or typed commands, voxel preview, approval, progress, history, blueprints, settings |
| Local bridge | Loopback Mineflayer process started by the desktop app. It is the only component that places blocks |
| Shared protocol | `packages/protocol` — one command parser, plan generator, entitlement check, and safety rules |

`/dashboard` redirects to `/get-started`. The website does not contain a playable Minecraft dashboard.

Bedrock and console gateway support is not included in this build. `bedrock-companion/` is not in the repository. Do not treat older Bedrock claims as shipped functionality.

## Requirements

- Node.js 22 or newer (the local history database uses `node:sqlite`)
- Minecraft Java Edition for live building
- A Supabase project and the SQL migrations in `supabase/migrations` for accounts, billing, and build authorization
- Optional: [Ollama](https://ollama.com) on localhost for natural-language planning

Survival-mode building is not implemented. The bridge places blocks with operator commands, or with creative-mode hand placement when the bot is in Creative. If neither is available, the build fails instead of reporting success.

## Website

```sh
npm install
npm run dev
```

Production build:

```sh
npm run build
```

Copy `.env.example` into the deployment environment. Do not commit `.env`. The example file lists the public site URL, the publishable Supabase key, and server-only secrets. Server-only values stay on the website host.

## Desktop application

Development, with the renderer on `http://127.0.0.1:5173`:

```sh
cd desktop
npm install
npm run dev
```

In a second terminal, after the renderer is up:

```sh
cd desktop
ZP_DESKTOP_DEV=1 npx electron .
```

The desktop window loads the local Vite bundle. It does not load a hosted dashboard.

Packaging, from the repository root:

```sh
bash desktop/build.sh
```

On Linux this cross-compiles the Windows NSIS installer and needs Wine. The installer is unsigned unless you supply your own code-signing certificate. Electron Builder signing discovery is disabled by the absence of a certificate; do not set `CSC_IDENTITY_AUTO_DISCOVERY` in order to invent one.

The generated installer path is:

```text
dist-desktop/ZeroPulse-VoiceCraft-Setup-2.0.0.exe
```

`dist-desktop/` is gitignored. Install that EXE on Windows, launch **ZeroPulse VoiceCraft**, then sign in if the account website is configured.

## Connect Minecraft

1. Open a Java world. For a single-player world, choose **Esc → Open to LAN → Allow Cheats: ON** and note the port from chat.
2. In the desktop app, open **Connections**.
3. Set the host (`localhost` for the same computer), the LAN port, the bot username, and offline authentication.
4. Start the bridge. It listens on `127.0.0.1` only and exits unless it receives a token created by the desktop process.
5. In **Build Studio**, type or dictate a command such as `build a stone house 10 blocks ahead`.
6. Review the preview. Approve only if the plan, location, and account allowance are what you expect.

Operator rights are required for `/fill` and `/setblock`. Creative mode is required for hand placement. A Microsoft account can be selected in Connections, but that login path was not exercised in this development environment.

## Optional local planning

Install Ollama, pull a model you choose, and set the model name in **Settings**. The URL must stay on localhost. The model returns a constrained JSON plan. That plan is validated and then built by the same generators as a typed command. The model cannot emit Minecraft console commands.

Ordinary commands keep working when Ollama is disconnected.

## Tests

```sh
npm test
```

The suite covers the shared parser, dispatcher safety, bridge authorization, desktop IPC rules, local history, and the website surface. It does not connect to Minecraft, Supabase, or Stripe.

## More detail

See [docs/HANDOFF.md](docs/HANDOFF.md) for the implementation report, security boundaries, and what has not been live-tested.

This repository is connected to Lovable. Do not rewrite published git history.
