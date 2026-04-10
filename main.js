require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
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
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║     Accessibility Voice Assistant - POC Demo      ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  Mode: DEMO (Using cached responses)              ║');
  console.log('║  Architecture: Electron ↔ Python (IPC)            ║');
  console.log('║  Status: Ready for demonstration                  ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

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
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  textBar.loadFile('textbar.html');

  initPythonProcess();
}

app.on('ready', () => {
  createWindow();
});

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

ipcMain.on('update-text', (event, text) => {
  if (textBar && !textBar.isDestroyed()) {
    textBar.webContents.send('update-text', text);
  }
});
ipcMain.on('resize-textbar', (event, height) => {
  textBar.setSize(800, Math.min(height, 200)); 
});

ipcMain.on('log-to-terminal', (event, { level, message }) => {
  if (level === 'error') {
    console.error('[RENDERER]', message);
  } else if (level === 'warn') {
    console.warn('[RENDERER]', message);
  } else {
    console.log('[RENDERER]', message);
  }
});

// Transcription is now handled in Python backend (ai.py)

let python = null;
let responsePending = false;
let pendingResponse = null;

function initPythonProcess() {
  if (python) return;

  python = spawn('C:/Users/aamal/.vscode/.vscode/venv/Scripts/python.exe', ['ai.py'], { 
    cwd: __dirname,
    env: process.env
  });

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
      
      // ============ DEMO MODE LOGGING ============
      if (output.demo) {
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║        POC DEMONSTRATION MODE          ║');
        console.log('╚════════════════════════════════════════╝');
        console.log('\n[POC INFO] ' + output.message);
        console.log('[POC INFO] API quota limits prevent live testing');
        console.log('[POC INFO] Showing cached response from working session\n');
      }
      // ============================================
      
      // Display full response in console
      console.log('[PYTHON RESPONSE RECEIVED]');
      console.log('  Text:', output.text);
      console.log('  Code:', output.code ? output.code.substring(0, 50) + '...' : 'null');
      console.log('  Full Response:', JSON.stringify(output, null, 2));
      
      // Save response to testing_results folder
      const fs = require('fs');
      const resultsDir = path.join(__dirname, 'testing_results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(
        path.join(resultsDir, `response_${timestamp}.json`),
        JSON.stringify(output, null, 2)
      );
      console.log('[RESPONSE SAVED]', path.join(resultsDir, `response_${timestamp}.json`));
      
      if (pendingResponse) {
        let responseText = output.response || output;

        // Parse response and extract code + text for BOTH audio and text requests
        responseText = parseGeminiResponse(output);
        
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

// App lifecycle events
app.on('will-quit', () => {
  if (python) {
    python.kill();
  }
});

// Safe system execution with whitelist
const SAFE_COMMANDS_WHITELIST = {
  'open-url': (url) => {
    const { exec } = require('child_process');
    const sanitized = url.replace(/[;&|`$()]/g, '');
    exec(`start "${sanitized}"`);
  },
  'open-app': (app) => {
    const { exec } = require('child_process');
    const sanitized = app.replace(/[;&|`$()]/g, '');
    exec(`start "" "${sanitized}"`);
  },
  'minimize': () => {
    if (mainWindow) mainWindow.minimize();
  },
  'maximize': () => {
    if (mainWindow) mainWindow.maximize();
  },
  'close': () => {
    if (mainWindow) mainWindow.close();
  }
};

function parseGeminiResponse(responseObj) {
  // responseObj now has both 'text' and 'code' fields from ai.py
  const text = responseObj.text || responseObj.response || '';
  const code = responseObj.code || null;

  console.log('[PARSE RESPONSE]');
  console.log('  Text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
  console.log('  Has Code:', code ? 'YES' : 'NO');

  if (code) {
    try {
      console.log('[EXECUTING CODE]');
      console.log('  Code:', code);
      eval(code);
      console.log('[CODE EXECUTED] ✓ Success\n');
    } catch (err) {
      console.error('[CODE EXECUTION ERROR]:', err);
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

    console.log('\n[REQUEST SENT TO PYTHON]');
    console.log('  Type: Text Prompt');
    console.log('  Prompt:', prompt);
    console.log('  Waiting for response...\n');

    pendingResponse = { resolve, reject, isAudio: false };
    try {
      python.stdin.write(JSON.stringify({ prompt }) + '\n');
    } catch (err) {
      reject(err);
    }
  });
});

ipcMain.handle('ask-gemini-audio', async (event, audioBase64) => {
  return new Promise((resolve, reject) => {
    if (!python) {
      initPythonProcess();
    }

    if (!python) {
      reject(new Error('Python process not available'));
      return;
    }

    pendingResponse = { resolve, reject, isAudio: true };
    try {
      python.stdin.write(JSON.stringify({ audio_base64: audioBase64 }) + '\n');
    } catch (err) {
      reject(err);
    }
  });
});

// Safe system execution handler with whitelist
ipcMain.handle('execute-system-command', async (event, command, ...args) => {
  if (!SAFE_COMMANDS_WHITELIST[command]) {
    throw new Error(`Command '${command}' not in whitelist`);
  }
  
  try {
    SAFE_COMMANDS_WHITELIST[command](...args);
    return { success: true };
  } catch (err) {
    console.error('System execution error:', err);
    return { success: false, error: err.message };
  }
});   
