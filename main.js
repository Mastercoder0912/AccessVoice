const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  textBar.loadFile('textbar.html');

  initPythonProcess();
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
  textBar.setSize(800, Math.min(height, 200)); 
});

let python = null;
let responsePending = false;
let pendingResponse = null;

function initPythonProcess() {
  if (python) return;

  python = spawn('python', ['ai.py'], { cwd: __dirname });

  python.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  python.on('error', (err) => {
    console.error('Failed to spawn Python process:', err);
    python = null;
  });

  python.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    python = null;
  });

  python.stdout.on('data', (data) => {
    try {
      const output = JSON.parse(data.toString());
      if (pendingResponse) {
        let responseText = output.response || output;

        if (pendingResponse.isAudio) {
          responseText = parseGeminiResponse(responseText);
        }
        
        pendingResponse.resolve(responseText);
        pendingResponse = null;
      }
    } catch (err) {
      console.error('Failed to parse Python response:', err);
      if (pendingResponse) {
        pendingResponse.reject(err);
        pendingResponse = null;
      }
    }
  });
}


app.on('will-quit', () => {
  if (python) {
    python.kill();
  }
});

function parseGeminiResponse(rawResponse) {
  const codeMatch = rawResponse.match(/<CODE>([\s\S]*?)<\/CODE>/i);
  const code = codeMatch ? codeMatch[1].trim() : null;
  
  const text = rawResponse.replace(/<CODE>[\s\S]*?<\/CODE>/i, '').trim();

  if (code) {
    try {
      console.log('Executing code:', code);
      eval(code);
    } catch (err) {
      console.error('Code execution error:', err);
    }
  }
  
  return text;
}

ipcMain.handle('ask-gemini', async (event, prompt) => {
  return new Promise((resolve, reject) => {
    if (!python) {
      initPythonProcess();
    }

    if (!python) {
      reject(new Error('Python process not available'));
      return;
    }

    pendingResponse = { resolve, reject, isAudio: false };
    try {
      python.stdin.write(JSON.stringify({ prompt }) + '\n');
    } catch (err) {
      reject(err);
    }
  });
});

ipcMain.handle('ask-gemini-audio', async (event, { audioBase64, transcript }) => {
  return new Promise((resolve, reject) => {
    if (!python) {
      initPythonProcess();
    }

    if (!python) {
      reject(new Error('Python process not available'));
      return;
    }

    const prompt = `Audio (base64): ${audioBase64.substring(0, 100)}...\n\nTranscript: ${transcript}`;
    
    pendingResponse = { resolve, reject, isAudio: true };
    try {
      python.stdin.write(JSON.stringify({ prompt }) + '\n');
    } catch (err) {
      reject(err);
    }
  });
});   
