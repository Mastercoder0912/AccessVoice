const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;
let textBar;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });


  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools();

  textBar = new BrowserWindow({
    width: 800,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  textBar.setIgnoreMouseEvents(true);
  textBar.loadFile('textbar.html');
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

const { ipcMain } = require('electron');

ipcMain.on('update-text', (event, text) => {
  if (textBar && !textBar.isDestroyed()) {
    textBar.webContents.send('update-text', text);
  }
});
ipcMain.on('resize-textbar', (event, height) => {
  textBar.setSize(800, Math.min(height, 200)); // Max height 200
});