# ZeroPulse bridge

The bridge is the local Minecraft Java companion. The desktop application starts it. It is not a public web dashboard.

```text
Desktop app -- IPC --> Electron main -- authenticated WebSocket --> bridge --> Mineflayer --> Minecraft Java
```

## Requirements

- Node.js 22 or newer
- Minecraft Java Edition
- Creative mode, or operator rights with cheats enabled

## Run from source

The desktop app generates `BRIDGE_AUTH_TOKEN` and passes it to the child process. A manual run has to do the same:

```sh
cd bridge
npm install
export BRIDGE_AUTH_TOKEN="$(openssl rand -hex 24)"
export BRIDGE_HOST=127.0.0.1
export MC_HOST=localhost
export MC_PORT=25565
export MC_USERNAME=ZeroPulse
npm start
```

The process exits if `BRIDGE_AUTH_TOKEN` is missing or shorter than 24 characters. The default bind address is `127.0.0.1`. The first WebSocket message must be `{"type":"auth","token":"..."}`.

Copy `bridge/.env.example` when you want a file instead of exported variables. Do not commit the filled-in file.

## What the bridge will do

- Parse a command with `packages/protocol` and return a preview without placing blocks.
- Place blocks only after an approved instruction and a valid runner token when `ZP_API_URL` is set.
- Refuse the build when the account website cannot confirm an entitlement.
- Stop a cancellation before later operations, and record a cancelled build as cancelled.
- Keep in-game chat control off unless `MC_CHAT_CONTROL=1`. Chat still cannot approve a destructive action.

## What it will not do

- Accept a short pairing code as permission to modify a world.
- Pretend survival-mode placement works.
- Import Sponge `.schem` or Litematica files. Those formats are rejected.
- Automate Bedrock Edition. That companion is not in this repository.

## Tests

From the repository root:

```sh
npm test
```
