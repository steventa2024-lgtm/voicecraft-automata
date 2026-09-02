/**
 * ZeroPulse Companion — Electron shell around the bridge.
 *
 * Ships its own Node runtime (Electron), so players do NOT need Node.js
 * installed. The bridge runs as a forked process with ELECTRON_RUN_AS_NODE so
 * it behaves exactly like `node index.js`.
 */
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { randomUUID } = require("crypto");
const { existsSync, readFileSync, writeFileSync } = require("fs");
const path = require("path");
const { fork } = require("child_process");

let win = null;
let bridge = null;

const DEFAULT_APP_URL = "https://id-preview--39d2951c-8adb-440f-b598-47437cb660b0.lovable.app";

function normalizedAppUrl(value) {
  try {
    const url = new URL(value || DEFAULT_APP_URL);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) return DEFAULT_APP_URL;
    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

const bridgeEntry = () => path.join(__dirname, "bridge", "index.js");

function installationId() {
  const file = path.join(app.getPath("userData"), "installation-id");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const value = `zp-install-${randomUUID()}`;
  writeFileSync(file, value, "utf8");
  return value;
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function startBridge(config) {
  stopBridge();
  const appUrl = normalizedAppUrl(config.appUrl);
  bridge = fork(bridgeEntry(), [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      MC_HOST: config.host || "localhost",
      MC_PORT: String(config.port || 25565),
      MC_USERNAME: config.username || "ZeroPulse",
      MC_VERSION: config.version || "",
      BRIDGE_PORT: String(config.bridgePort || 8765),
      ZP_PAIR_CODE: (config.pairCode || "").toUpperCase(),
      ZP_DEVICE_ID: installationId(),
      ZP_API_URL:
        process.env.ZP_API_URL ||
        appUrl,
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
ipcMain.handle("open:dashboard", (_e, url) => shell.openExternal(`${normalizedAppUrl(url)}/dashboard`));

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  stopBridge();
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("before-quit", stopBridge);
