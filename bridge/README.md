# ZeroPulse Bridge

Local companion app. It hosts a WebSocket server for the ZeroPulse web dashboard and drives a
[Mineflayer](https://github.com/PrismarineJS/mineflayer) bot that builds inside your Minecraft
Java Edition world.

```
Browser dashboard ──ws://localhost:8765──▶ bridge ──▶ Mineflayer bot ──▶ Minecraft
```

## Requirements

- Node.js 18+
- Minecraft Java Edition 1.20+ (single-player world opened to LAN, or your own server)
- Creative mode / operator permissions (the builder uses `/setblock`)

## Setup

```bash
npm install
cp .env.example .env     # edit MC_HOST / MC_PORT / MC_USERNAME
npm start
```

In Minecraft: `Esc → Open to LAN → Allow cheats: ON → Start LAN World`, then copy the port from
chat into `MC_PORT`. Restart the bridge and press **Connect bridge** in the dashboard.

## Files

| File         | Purpose                                                              |
| ------------ | -------------------------------------------------------------------- |
| `index.js`   | WebSocket server, Mineflayer lifecycle, command dispatch, telemetry  |
| `parser.js`  | Speech text → structured build instruction (mirrors the web parser)  |
| `builder.js` | Procedural generators (mansion, castle, tower, pyramid, farm, …)     |

## Protocol

Dashboard → bridge:

```json
{ "type": "command", "instruction": { "action": "build", "structure": "mansion", "...": "..." } }
```

Bridge → dashboard:

```json
{ "type": "status",   "status": "building", "message": "Building large mansion" }
{ "type": "progress", "progress": 62 }
{ "type": "error",    "status": "error",   "message": "Bot not in world yet" }
```

## In-game commands

You can also type orders directly into Minecraft chat:

```
zp build me a large stone mansion
zp stop
```

## Adding your own structure

Add a generator to `builder.js` returning `{ x, y, z, block }` in local coordinates, register it
in `GENERATORS`, and add its keywords to `STRUCTURES` in `parser.js` (and in the web app's
`src/lib/command-parser.ts`).
