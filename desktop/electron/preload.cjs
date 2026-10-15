const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zeropulse", {
  invoke(channel, payload) {
    return ipcRenderer.invoke("zp:invoke", { channel, payload });
  },
  onEvent(callback) {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("zp:event", listener);
    return () => ipcRenderer.removeListener("zp:event", listener);
  },
});
