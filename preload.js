const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => ipcRenderer.on(channel, (event, data) => callback(data)),
  askGemini: (prompt) => ipcRenderer.invoke('ask-gemini', prompt),
  askGeminiWithAudio: (audioBase64, transcript) => ipcRenderer.invoke('ask-gemini-audio', { audioBase64, transcript }),
  executeSystemCommand: (command, ...args) => ipcRenderer.invoke('execute-system-command', command, ...args),
  updateText: (text) => ipcRenderer.send('update-text', text),
  transcribeAudio: (audioData) => ipcRenderer.invoke('transcribe-audio', audioData)
});
