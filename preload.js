const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => ipcRenderer.on(channel, (event, data) => callback(data)),
  askGemini: (prompt) => ipcRenderer.invoke('ask-gemini', prompt)
});
