const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("companion", {
  start: (config) => ipcRenderer.invoke("bridge:start", config),
  stop: () => ipcRenderer.invoke("bridge:stop"),
  openDashboard: (url) => ipcRenderer.invoke("open:dashboard", url),
  onLog: (cb) => ipcRenderer.on("bridge-log", (_e, text) => cb(text)),
  onState: (cb) => ipcRenderer.on("bridge-state", (_e, state) => cb(state)),
});
