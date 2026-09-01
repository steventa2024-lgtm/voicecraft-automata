/**
 * ZeroPulse Companion — Electron shell around the bridge.
 *
 * Ships its own Node runtime (Electron), so players do NOT need Node.js
 * installed. The bridge runs as a forked process with ELECTRON_RUN_AS_NODE so
 * it behaves exactly like `node index.js`.
 */
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let win = null;
let bridge = null;

const bridgeEntry = () => path.join(__dirname, "bridge", "index.js");

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function startBridge(config) {
  stopBridge();
  bridge = fork(bridgeEntry(), [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      MC_HOST: config.host || "localhost",
      MC_PORT: String(config.port || 25565),
      MC_USERNAME: config.username || "ZeroPulse",
      MC_VERSION: config.version || "",
      BRIDGE_PORT: String(config.bridgePort || 8765),
    },
    execPath: process.execPath,
    silent: true,
  });

  bridge.stdout?.on("data", (d) => send("bridge-log", d.toString()));
  bridge.stderr?.on("data", (d) => send("bridge-log", d.toString()));
  bridge.on("exit", (code) => {
    send("bridge-log", `\n[companion] bridge stopped (code ${code})\n`);
    send("bridge-state", "stopped");
    bridge = null;
  });
  send("bridge-state", "running");
  send("bridge-log", `[companion] bridge starting on ws://localhost:${config.bridgePort || 8765}\n`);
}

function stopBridge() {
  if (bridge) {
    bridge.kill();
    bridge = null;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 860,
    height: 660,
    backgroundColor: "#080b12",
    title: "ZeroPulse Companion",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer.html"));
}

ipcMain.handle("bridge:start", (_e, config) => startBridge(config || {}));
ipcMain.handle("bridge:stop", () => stopBridge());
ipcMain.handle("open:dashboard", (_e, url) => shell.openExternal(url));

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  stopBridge();
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("before-quit", stopBridge);
