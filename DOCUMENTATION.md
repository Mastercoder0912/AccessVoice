# Accessibility Voice Assistant - Comprehensive Technical Documentation

## Executive Summary

This is an **Electron-based accessibility assistant application** that combines voice input/output with AI-powered command processing. The application leverages Google's Gemini API for intelligent audio transcription and response generation, integrating modern web technologies with Python backend services to create a seamless voice-controlled experience for users with accessibility needs.

**Key Innovation**: A multi-process architecture using Inter-Process Communication (IPC) to separate the UI layer (JavaScript/Electron) from the AI inference layer (Python), enabling efficient resource usage and flexible deployment.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Component Breakdown](#component-breakdown)
4. [Data Flow and Communication](#data-flow-and-communication)
5. [Audio Processing Pipeline](#audio-processing-pipeline)
6. [AI Integration with Gemini API](#ai-integration-with-gemini-api)
7. [Code Execution and Command Handling](#code-execution-and-command-handling)
8. [Setup and Installation](#setup-and-installation)
9. [Key Features and Implementation](#key-features-and-implementation)
10. [File Directory Structure](#file-directory-structure)

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Window Management & IPC Router             │   │
│  │  - Main Window (UI)                                  │   │
│  │  - Text Bar Window (Floating display)                │   │
│  │  - Event handlers for Gemini requests                │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      IPC Communication Layer (JSON-based)            │   │
│  │  - ask-gemini (text prompt)                          │   │
│  │  - ask-gemini-audio (audio base64)                   │   │
│  │  - Response parsing & code extraction                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                    stdin/stdout JSON
                           │
┌─────────────────────────────────────────────────────────────┐
│                    Python Backend Process                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         AI Processing Pipeline (ai.py)               │   │
│  │  ┌────────────────┐  ┌────────────────┐             │   │
│  │  │ Audio Input    │  │ Text Input     │             │   │
│  │  │ (base64)       │  │ (prompt)       │             │   │
│  │  └────────┬───────┘  └────────┬───────┘             │   │
│  │           │                   │                     │   │
│  │           ▼                   ▼                     │   │
│  │  ┌─────────────────────────────────────┐            │   │
│  │  │   Gemini API Integration            │            │   │
│  │  │  - transcribe_audio_gemini()        │            │   │
│  │  │  - get_gemini_response()            │            │   │
│  │  │  - Model: gemini-2.0-flash          │            │   │
│  │  └────────────┬────────────────────────┘            │   │
│  │              ▼                                      │   │
│  │  ┌─────────────────────────────────────┐            │   │
│  │  │  Response Processing                 │            │   │
│  │  │  - Extract text output               │            │   │
│  │  │  - Parse <CODE> blocks from response │            │   │
│  │  └────────────┬────────────────────────┘            │   │
│  │              ▼                                      │   │
│  │  ┌─────────────────────────────────────┐            │   │
│  │  │  JSON Output                         │            │   │
│  │  │  {                                   │            │   │
│  │  │    "text": "...",                    │            │   │
│  │  │    "code": "...",                    │            │   │
│  │  │    "transcript": "..."               │            │   │
│  │  │  }                                   │            │   │
│  │  └────────────────────────────────────┘            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Separation of Concerns**: UI logic (Electron/JavaScript) is isolated from AI processing (Python)
2. **Asynchronous Communication**: JSON-based IPC allows non-blocking requests and responses
3. **Modular Processing**: Each function handles a single responsibility (transcription, response generation, code execution)
4. **Graceful Degradation**: Functions return meaningful error objects when processing fails

---

## Technology Stack

### Frontend (Client-side)

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Electron** | 40.1.0 | Cross-platform desktop application framework |
| **React** | 17.0.2 | (Dependency, limited usage in current version) |
| **Web Audio API** | Native | Audio capture and processing |
| **MediaRecorder API** | Native | Audio stream recording |
| **Speech Synthesis API** | Native | Text-to-speech functionality |
| **JavaScript** | ES6+ | Application logic and event handling |

### Backend (Server-side)

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.x | Core backend runtime |
| **google-generativeai** | Latest | Gemini API SDK for AI processing |
| **base64** | Native | Audio encoding/decoding |
| **JSON** | Native | IPC serialization |
| **subprocess** | Native | Multi-process management |

### Infrastructure

| Component | Type | Purpose |
|-----------|------|---------|
| **Google Gemini API** | Cloud AI Service | Audio transcription and response generation |
| **.env Configuration** | Environment Variables | API key and configuration management |
| **Floating Window** | UI Component | Real-time text display overlay |

---

## Component Breakdown

### 1. Main Process (main.js)

**Purpose**: Orchestrates the entire application lifecycle, manages windows, spawns the Python backend, and routes IPC communication.

#### Window Management

```javascript
const mainWindow = new BrowserWindow({
  width: 1000,
  height: 700,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  }
});

const textBar = new BrowserWindow({
  width: 800,
  height: 100,
  frame: false,
  alwaysOnTop: true,
  transparent: true,
  skipTaskbar: true,
});
```

**Details**:
- **Main Window**: 1000x700px, resizable, displays primary UI with buttons and controls
- **Text Bar**: 800x100px, floating overlay window used to display real-time text transcriptions and AI responses
- **Context Isolation**: Enabled for security; prevents renderer process from accessing Node APIs directly
- **Preload Script**: Bridge between secure renderer and main process

#### Python Process Spawning

```javascript
function initPythonProcess() {
  python = spawn('C:/Users/aamal/.vscode/.vscode/venv/Scripts/python.exe', 
    ['ai.py'], 
    { 
      cwd: __dirname,
      env: process.env  // Critical: passes GOOGLE_API_KEY
    }
  );
}
```

**Key Implementation Details**:
- Uses `child_process.spawn()` to launch Python as a subprocess
- **Environmental Variable Passing**: `env: process.env` ensures the `.env` file's `GOOGLE_API_KEY` is available to Python
- **Working Directory**: Set to application directory where `ai.py` is located
- **Error Handling**: Captures stderr for debugging and monitors process lifecycle

#### Python Process Event Handlers

```javascript
python.stdout.on('data', (data) => {
  const output = JSON.parse(data.toString());
  // Save to testing_results folder
  // Parse response and extract code
  // Execute Gemini response
});
```

**Responsibilities**:
- Listens for JSON responses from Python backend
- Logs all responses to `testing_results/` folder with timestamps
- Deserializes JSON objects
- Routes responses to `parseGeminiResponse()` for code execution

#### IPC Handlers

```javascript
ipcMain.handle('ask-gemini', async (event, prompt) => {
  // Send text prompt to Python backend
  python.stdin.write(JSON.stringify({ prompt }) + '\n');
});

ipcMain.handle('ask-gemini-audio', async (event, audioBase64) => {
  // Send audio base64 to Python backend
  python.stdin.write(JSON.stringify({ audio_base64: audioBase64 }) + '\n');
});
```

**Communication Pattern**:
- Two IPC handlers communicate with Python via stdin/stdout
- Requests are serialized as JSON with a single field: `prompt` or `audio_base64`
- Responses trigger `pendingResponse.resolve()` to complete the async await

### 2. Renderer Process (render.js)

**Purpose**: Implements the user interface, handles audio recording, text-to-speech, and initiates requests to the backend.

#### Audio Recording System (AudioRecorder Class)

```javascript
class AudioRecorder {
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true 
      } 
    });
    
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
  }
}
```

**Audio Processing Steps**:
1. **Microphone Access**: Requests user permission via `getUserMedia()`
2. **Audio Enhancement**: Enables echo cancellation, noise suppression, and automatic gain control
3. **Codec**: Captures audio in WebM format with Opus codec (efficient compression)
4. **Recording**: Uses `MediaRecorder` API to capture audio chunks
5. **Conversion**: Converts blob to base64 string for transmission
6. **Time Limit**: Auto-stops after 30 seconds to prevent accidental long recordings

#### Text-to-Speech System

```javascript
function speakText(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speedValue;
  utterance.pitch = pitchValue;
  
  utterance.onend = () => {
    // After speech ends, start listening for next command
    startAudioToText();
  };
  
  window.speechSynthesis.speak(utterance);
}
```

**Features**:
- Uses native Web Speech Synthesis API
- **Voice Selection**: Dynamically retrieves available system voices
- **Speed Control**: Adjustable speaking rate (0.1x to 10x)
- **Pitch Control**: Adjustable pitch (0.1 to 2.0)
- **Auto-listen**: After TTS completes, automatically starts listening mode

#### Console Interception

```javascript
console.log = (...args) => {
  _log(...args);
  window.electronAPI.send('log-to-terminal', { level: 'log', message: args.join(' ') });
};
```

**Purpose**: Captures all console output from renderer and sends to main process for terminal logging, enabling debugging even in a multi-process environment.

### 3. Backend Process (ai.py)

**Purpose**: Handles all AI inference, audio transcription, and response generation using Google's Gemini API.

#### Environment Configuration

```python
# Load .env file manually
env_file = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

api_key = os.getenv('GOOGLE_API_KEY')
genai.configure(api_key=api_key)
model = genai.GenerativeModel(model_name="gemini-2.0-flash")
```

**Key Details**:
- Manually parses `.env` file (doesn't require external dependencies like python-dotenv)
- **Model**: Uses `gemini-2.0-flash` for fast inference
- **Configuration**: Initializes Gemini SDK with API credentials at startup
- **Error Handling**: Exits with error message if API key is missing

#### Audio Transcription Function

```python
def transcribe_audio_gemini(audio_base64):
    audio_bytes = base64.b64decode(audio_base64)
    
    response = model.generate_content([
        {
            "inline_data": {
                "mime_type": "audio/webm",
                "data": audio_bytes
            }
        },
        "Transcribe this audio into plain text. Return only the transcription, no other text or commentary."
    ])
    
    return response.text
```

**Critical Implementation Detail - inline_data Structure**:
```
Correct Format:
{
  "inline_data": {           # REQUIRED wrapper
    "mime_type": "audio/webm",
    "data": bytes            # Raw bytes, not base64
  }
}

Common Mistake:
{ "mime_type": "audio/webm", "data": audio_bytes }  # Missing inline_data wrapper
```

**Process**:
1. Decodes base64 string back to audio bytes
2. Constructs Gemini API request with audio data and transcription prompt
3. **Prompt Engineering**: Instructs model to return only transcription without extra text
4. Returns transcribed text or None if error occurs

#### Response Generation Function

```python
def get_gemini_response(transcript, audio_base64=None):
    prompt = f"""You are a disability assistance AI. Respond naturally and include code commands if needed.
If the user wants to open something, include code like:
<CODE>require('child_process').exec('start https://youtube.com')</CODE>

User request: {transcript}

Keep responses concise and helpful."""
    
    response = model.generate_content(prompt)
    response_text = response.text
    
    # Extract <CODE> blocks
    code_match = re.search(r'<CODE>([\s\S]*?)</CODE>', response_text, re.IGNORECASE)
    code = code_match.group(1).strip() if code_match else None
    
    # Clean text by removing code blocks
    clean_text = re.sub(r'<CODE>[\s\S]*?</CODE>', '', response_text, flags=re.IGNORECASE).strip()
    
    return {
        "text": clean_text,
        "code": code,
        "transcript": transcript
    }
```

**Key Features**:
- **Prompt Engineering**: Instructs Gemini to be helpful for accessibility and include code when appropriate
- **Code Extraction**: Uses regex to find and extract `<CODE>...</CODE>` blocks from Gemini responses
- **Text Cleaning**: Removes code blocks from text to provide clean user-facing response
- **Structured Output**: Returns object with three fields for easy parsing

#### Main Input Loop

```python
if __name__ == "__main__":
    for line in sys.stdin:
        try:
            data = json.loads(line.strip())
            result = parse_input(data)
            print(json.dumps(result), flush=True)
        except Exception as err:
            print(json.dumps({"error": f"Processing error: {str(err)}"}), flush=True)
```

**Important Detail**: `if __name__ == "__main__":` guard prevents the main loop from running when ai.py is imported by test files.

---

## Data Flow and Communication

### Text Request Flow

```
User Types Prompt
    ↓
Electron UI (render.js) receives input
    ↓
electronAPI.askGemini(prompt) called
    ↓
IPC Request: ask-gemini handler in main.js
    ↓
JSON sent to Python: { "prompt": "user input" }
    ↓
ai.py parse_input() routes to get_gemini_response()
    ↓
Gemini API called with prompt
    ↓
Response: { "text": "...", "code": "..." }
    ↓
JSON sent back via stdout
    ↓
main.js stdout listener receives JSON
    ↓
parseGeminiResponse() executes code if present
    ↓
Text returned to renderer
    ↓
speakText() plays audio response
    ↓
Update text bar window
```

### Audio Request Flow

```
User clicks "Listen" button
    ↓
navigator.mediaDevices.getUserMedia() requests microphone
    ↓
User speaks into microphone
    ↓
MediaRecorder captures audio chunks as WebM blob
    ↓
30-second timeout OR user clicks stop
    ↓
Blob converted to base64 string
    ↓
electronAPI.askGeminiWithAudio(audioBase64) called
    ↓
IPC Request: ask-gemini-audio handler in main.js
    ↓
JSON sent to Python: { "audio_base64": "..." }
    ↓
ai.py parse_input() routes to transcribe_audio_gemini()
    ↓
Base64 decoded to bytes
    ↓
Gemini audio transcription API called
    ↓
Transcription text received
    ↓
get_gemini_response() called with transcribed text
    ↓
Code extraction and response generation
    ↓
JSON response sent back: { "text": "...", "code": "...", "transcript": "..." }
    ↓
main.js stdout listener processes response
    ↓
parseGeminiResponse() executes extracted code
    ↓
Text and code execution results returned
    ↓
Response spoken via speakText()
    ↓
Update text bar with transcription and response
```

---

## Audio Processing Pipeline

### Step-by-Step Audio Capture and Encoding

#### 1. Microphone Stream Acquisition

```javascript
this.stream = await navigator.mediaDevices.getUserMedia({ 
  audio: { 
    echoCancellation: true,      // Remove microphone echo
    noiseSuppression: true,      // Reduce background noise
    autoGainControl: true        // Level microphone volume
  } 
});
```

**Consumer APIs Used**:
- `mediaDevices.getUserMedia()`: Prompts user for permission, returns audio stream
- **Constraints**: Specify audio enhancement options supported by the device

#### 2. MediaRecorder Setup

```javascript
this.mediaRecorder = new MediaRecorder(this.stream, {
  mimeType: 'audio/webm;codecs=opus'
});

const chunks = [];
this.mediaRecorder.ondataavailable = (e) => {
  chunks.push(e.data);  // Accumulate audio data
};
```

**Why WebM + Opus?**
- **WebM**: Modern container format, efficient compression
- **Opus Codec**: Designed for speech, excellent quality at low bitrates
- **Result**: Smaller file size = faster transmission to backend

#### 3. Blob Creation and Base64 Encoding

```javascript
this.audioBlob = new Blob(chunks, { type: 'audio/webm' });

const reader = new FileReader();
reader.onload = () => {
  const audioBase64 = reader.result.split(',')[1];  // Remove data URL prefix
  // Send to backend
};
reader.readAsDataURL(this.audioBlob);
```

**Process**:
1. `Blob`: Combines array of audio chunks into single binary object
2. `FileReader`: Asynchronously reads blob as data URL
3. **Base64 Conversion**: Data URL format includes `data:audio/webm;base64,` prefix which is stripped
4. **Transfer**: Base64 string is JSON-safe and can be transmitted via IPC

#### 4. Python Backend Decoding

```python
audio_bytes = base64.b64decode(audio_base64)  # Convert base64 → bytes
sys.stderr.write(f"[TRANSCRIBE] Audio bytes: {len(audio_bytes)}\n")  # Log size

response = model.generate_content([
    {
        "inline_data": {
            "mime_type": "audio/webm",
            "data": audio_bytes  # Gemini expects binary data, not base64
        }
    },
    "Transcribe this audio into plain text. Return only the transcription, no other text or commentary."
])
```

**Key Points**:
- Base64 is **only** for JSON transmission over IPC
- Python immediately decodes back to binary bytes
- Gemini API requires **binary data**, not base64 strings
- MIME type tells Gemini which decoder to use

### Audio Timeline Visualization

```
User Speaks:        |----30 seconds max------|
MediaRecorder:      Recording....(ondataavailable chunks)...Stop
Base64 Encoding:    ░░░░░░░░░░░ (creates ~1-2 MB string)
IPC Transmission:   ════════════
Python Backend:     Receive → Decode → Gemini API → Transcription
Gemini Response:    ═══════════════════════════════
IPC Response:       ════════════
Frontend Display:   Show transcription + Generate response via TTS
```

---

## AI Integration with Gemini API

### Gemini API Overview

**Model Used**: `gemini-2.0-flash`
- **Speed**: Optimized for fast inference (suitable for real-time applications)
- **Capabilities**: Text and audio understanding, code generation
- **API Cost**: Free tier available, rate-limited

### Request Structure

#### Text Request
```python
response = model.generate_content("""
You are a disability assistance AI. Respond naturally and include code commands if needed.
If the user wants to open something, include code like:
<CODE>require('child_process').exec('start https://youtube.com')</CODE>

User request: {user input}

Keep responses concise and helpful.
""")
```

#### Audio Request
```python
response = model.generate_content([
    {
        "inline_data": {
            "mime_type": "audio/webm",
            "data": audio_bytes
        }
    },
    "Transcribe this audio into plain text. Return only the transcription, no other text or commentary."
])
```

### Prompt Engineering Strategy

```python
"""
You are a disability assistance AI.
```**Role Definition**: Sets context that this is for accessibility

```
Respond naturally and include code commands if needed.
```**Instruction**: Model should use natural language but can include code

```
If the user wants to open something, include code like:
<CODE>require('child_process').exec('start https://youtube.com')</CODE>
```**Code Format Specification**: Teaches model the exact format to use for executable code

```
User request: {transcript}
```**Input Placeholder**: Inserts the actual user command

```
Keep responses concise and helpful.
```**Output Constraint**: Optimizes for brevity suitable for audio responses
```

**Why This Matters**:
- Gemini models are trained on huge internet datasets but don't inherently know your specific needs
- By specifying the `<CODE>...</CODE>` format, we enable structured response parsing
- "Disability assistance AI" sets appropriate tone and safety constraints
- "Concise" prevents long-winded responses that are awkward when spoken

### Response Parsing with Regex

```python
response_text = response.text  # Raw Gemini output
code_match = re.search(r'<CODE>([\s\S]*?)</CODE>', response_text, re.IGNORECASE)
code = code_match.group(1).strip() if code_match else None
clean_text = re.sub(r'<CODE>[\s\S]*?</CODE>', '', response_text, flags=re.IGNORECASE).strip()
```

**Regex Breakdown**:
```
r'<CODE>([\s\S]*?)</CODE>'
   ↑     ↑            ↑
   Tag   Capture all characters (incl. newlines)  End tag
```

- `[\s\S]`: Matches any character including whitespace
- `*?`: Non-greedy match (stops at first `</CODE>`)
- `group(1)`: Extracts the captured content between tags

**Example**:
```
Gemini Response:
"I'll help you play music. Here's the command:
<CODE>require('child_process').exec('start "" "https://youtube.com/watch?v=dQw4w9WgXcQ"');</CODE>
Let me start that for you!"

After Parsing:
text: "I'll help you play music. Let me start that for you!"
code: "require('child_process').exec('start "" "https://youtube.com/watch?v=dQw4w9WgXcQ"');"
```

### Error Handling in API Calls

```python
try:
    response = model.generate_content(prompt)
except Exception as e:
    error_msg = f"Gemini transcription error: {str(e)}"
    sys.stderr.write(f"[TRANSCRIBE ERROR] {error_msg}\n")
    return None
```

**Common Error Scenarios**:
1. **API Key Invalid**: "API key not valid. Please pass a valid API key."
2. **Rate Limit Exceeded (429)**: "You exceeded your current quota"
3. **Network Error**: Connection timeout or refused
4. **Invalid Request**: Malformed audio data or unsupported format

**Application Response**:
- Returns `None` or error object with meaningful message
- Logs to stderr for debugging
- Frontend displays user-friendly error message

---

## Code Execution and Command Handling

### Code Extraction and Execution Pipeline

```javascript
function parseGeminiResponse(responseObj) {
  const text = responseObj.text || responseObj.response || '';
  const code = responseObj.code || null;

  if (code) {
    try {
      eval(code);  // Execute JavaScript code
      console.log('[CODE EXECUTED] Success');
    } catch (err) {
      console.error('[CODE EXECUTION ERROR]:', err);
    }
  }
  
  return text;  // Return text for TTS
}
```

### Executable Code Examples

#### Opening a Website
```javascript
// Generated by Gemini in response to: "Open YouTube"
require('child_process').exec('start "" "https://www.youtube.com"');
```

**How It Works**:
- `require('child_process')`: Node.js module for spawning external processes
- `exec()`: Executes system command
- `start ""`: Windows command to open URL in default browser

#### Opening an Application
```javascript
// Response to: "Open Notepad"
require('child_process').exec('start "" "C:\\Windows\\System32\\notepad.exe"');
```

#### Complex Multi-Step Commands
```javascript
// Response to: "Play my favorite song"
require('child_process').exec('start "" "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp"');
```

### Safe Commands Whitelist

```javascript
const SAFE_COMMANDS_WHITELIST = {
  'open-url': (url) => {
    const sanitized = url.replace(/[;&|`$()]/g, '');
    exec(`start "${sanitized}"`);
  },
  'open-app': (app) => {
    const sanitized = app.replace(/[;&|`$()]/g, '');
    exec(`start "" "${sanitized}"`);
  },
  'minimize': () => mainWindow.minimize(),
  'maximize': () => mainWindow.maximize(),
  'close': () => mainWindow.close()
};
```

**Security Consideration**:
- **Character Sanitization**: Removes dangerous shell characters `;&|`$()`
- **Whitelist Pattern**: Only allows predefined commands
- **Prevents**: Command injection attacks via malicious prompts

### Execution Context and Limitations

**Important**: Code runs in Electron's main process context:
- ✅ Can access Node.js APIs
- ✅ Can modify windows, spawn processes
- ✅ Can access file system

**Constraints**:
- ❌ Cannot access isolated renderer process DOM
- ❌ Cannot modify application settings directly
- ❌ Must use IPC messages to send data to renderer

---

## Setup and Installation

### Prerequisites

1. **Node.js** (v14+): For Electron and npm
2. **Python** (v3.7+): For backend AI processing
3. **Google Gemini API Key**: Free tier available at [Google AI Studio](https://aistudio.google.com)
4. **Git**: For version control (optional but recommended)

### Installation Steps

#### 1. Clone or Download Project

```bash
cd /your/project/path
git clone <repository-url>  # If using git
```

#### 2. Install Node Dependencies

```bash
cd helper-app
npm install
```

**Downloads**:
- Electron (40.1.0): Desktop application framework
- dotenv: Environment variable management
- Other dependencies listed in package.json

**Installation Time**: 3-5 minutes depending on internet speed

#### 3. Set Up Python Virtual Environment

```bash
# From root directory (c:\Users\aamal\.vscode\.vscode\)
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\Activate.ps1

# On macOS/Linux:
source venv/bin/activate
```

#### 4. Install Python Dependencies

```bash
pip install google-generativeai
```

**Why `google-generativeai`?**
- Official SDK for Google's Gemini API
- Handles authentication and API communication
- Provides convenient interface for audio/text processing

#### 5. Create .env File

```bash
# In helper-app/ directory, create .env file:
GOOGLE_API_KEY=your_api_key_here
```

**Getting API Key**:
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click "Get API Key" button
3. Create new API key (free tier available)
4. Copy and paste into .env file

**Security Note**: Never commit .env to version control; add to .gitignore

#### 6. Launch Application

```bash
# From helper-app directory
npm start
```

**What Happens**:
1. Electron launches with main.js
2. Windows created: main window + floating text bar
3. Python subprocess spawned with ai.py
4. Application ready for voice input

**Expected Startup Sequence**:
- Console opens showing debug output
- Main window displays UI
- Text bar appears as floating overlay
- TTS says: "Hello! This is your voice controller assistant..."

### Troubleshooting Installation

| Issue | Solution |
|-------|----------|
| "Module not found: google-generativeai" | Ensure Python venv is activated and pip install was successful |
| "GOOGLE_API_KEY not set" | Check .env file exists in helper-app/ with correct key |
| Python subprocess fails to spawn | Verify Python path in main.js matches your venv location |
| Microphone access denied | Check browser/OS permissions for microphone |
| Gemini API 403 error | API key invalid; regenerate from Google AI Studio |

---

## Key Features and Implementation

### 1. Real-Time Voice Input & Processing

**Feature**: User speaks → transcription → AI response → spoken output

**Implementation**:
```javascript
// AudioRecorder continuously captures speech
transcriber.start();  // Begins microphone capture

// After recording stops:
const response = await electronAPI.askGeminiWithAudio(audioBase64);

// Response processed:
speakText(response.text);  // TTS plays response
```

**User Experience**:
- Minimal latency: transcription happens immediately after recording stops
- Non-blocking: UI remains responsive during AI processing
- Feedback: Text bar shows "Listening..." and transcription in real-time

### 2. Dual-Mode Operation

#### Mode 1: Text-to-Speech (TTS)
- Application speaks predetermined messages
- Used for: Startup greetings, system feedback, accessibility announcements

#### Mode 2: Audio-to-Text (ATT)
- Captures user voice and transcribes
- Used for: Voice commands, user input processing

**Toggle Mechanism**:
```javascript
document.getElementById('btn-tta').addEventListener('click', () => {
  mode = 'text-to-speech';
  speakText('I am ready to listen for your command. Please say it now.');
});

document.getElementById('btn-att').addEventListener('click', () => {
  mode = 'audio-to-text';
  assistantState = 'listening';
  startAudioToText();
});
```

### 3. Intelligent Command Execution

**Feature**: AI can generate executable code that opens websites, applications, etc.

**Example Conversation**:

```
User: "Hey, open YouTube"
     ↓
Transcription: "hey open youtube"
     ↓
Gemini Prompt: "You are a disability assistance AI...
                 User request: hey open youtube
                 ...include code like <CODE>require('child_process').exec('...')</CODE>"
     ↓
Gemini Response: "I'll open YouTube for you.
                  <CODE>require('child_process').exec('start "" 
                  "https://www.youtube.com"')</CODE>"
     ↓
Code Extraction: require('child_process').exec('start "" "https://www.youtube.com"')
     ↓
Code Execution: Runs in Electron main process
     ↓
Browser Opens: Default browser navigates to YouTube
     ↓
TTS Response: "I've opened YouTube for you in your default browser"
```

### 4. Floating Text Overlay

**Feature**: Real-time display of transcriptions and responses overlaid on all windows

**Implementation**:
```javascript
// Separate window always on top
const textBar = new BrowserWindow({
  width: 800,
  height: 100,
  frame: false,           // No title bar
  transparent: true,      // See-through background
  alwaysOnTop: true,      // Always visible
  skipTaskbar: true       // Doesn't appear in taskbar
});

// Update from main process:
ipcMain.on('update-text', (event, text) => {
  if (textBar && !textBar.isDestroyed()) {
    textBar.webContents.send('update-text', text);
  }
});
```

**User Experience**:
- Works with any application in foreground
- Displays transcription as user speaks
- Shows AI response before TTS plays
- Auto-resizes based on text length

### 5. Accessibility Features

**Target Users**: People with:
- Hearing impairments (visual feedback via text display)
- Visual impairments (audio output via TTS)
- Motor control issues (voice control for all functions)
- Cognitive disabilities (assistant guides through tasks)

**Implementation**:
- **Audio Enhancement**: Noise suppression, echo cancellation during recording
- **Large Text**: Floating display with scalable font
- **Keyboard Shortcuts**: Buttons for mode switching
- **Voice Commands**: Complete control via voice
- **Responsive Feedback**: Real-time transcription and response preview

---

## File Directory Structure

```
helper-app/
├── main.js                          # Electron main process (window management, IPC)
│
├── render.js                        # Renderer process (UI logic, audio recording, TTS)
│
├── preload.js                       # IPC bridge (security layer between processes)
│
├── ai.py                            # Python backend (Gemini API integration, transcription)
│
├── index.html                       # Main window HTML
├── index.css                        # Main window styles
│
├── textbar.html                     # Floating text display HTML
├── style.css                        # Text bar and shared styles
│
├── package.json                     # Node.js dependencies and scripts
│
├── .env                             # Environment configuration (API key)
│ │---GOOGLE_API_KEY=your_key_here
│
├── testing_results/                 # Output folder for response logging
│ └── response_*.json               # Timestamped API responses (for debugging)
│
├── test.py                          # Test script for audio transcription
│
├── test_response_parsing.js         # Test script for code execution
│
└── DOCUMENTATION.md                 # This file
```

### Key Configuration Files

#### package.json
```json
{
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^40.1.0"
  },
  "dependencies": {
    "google-generativeai": "latest",
    // ... other dependencies
  }
}
```

**Key Entry Point**: `main.js` - Electron starts here

#### .env Template
```
GOOGLE_API_KEY=AIzaSy...your_actual_key...
```

**Security**: 
- Never commit this file to git
- Never share the key publicly
- Regenerate if accidentally exposed

---

## Advanced Concepts

### Inter-Process Communication (IPC) Deep Dive

**Why IPC?**
```
Single Process Risk:
  UI Thread Blocked → Every Gemini API call freezes UI → Poor UX

Separate Processes:
  Main Process: Handles UI & user input (always responsive)
  Worker Process: Handles AI inference (can take 2-10 seconds)
  → UI remains responsive while AI works
```

**IPC Communication Pattern**:

```
Renderer Screen           Main Process           Python Process
(render.js)             (main.js)              (ai.py)
   |                      |                       |
   | electronAPI.ask...   |                       |
   |-------------------->| JSON stdin write      |
   |                      |--------------------->| JSON parse
   |                      |                       | Gemini API call
   |                      |                       | Process request
   | (waiting)            |                       | Return JSON
   |                      | stdout event         |
   |<---------------------------------------------| 
   | Response received    |                       |
   | Update UI            |                       |
   | speakText()          |                       |
```

**Critical Implementation Detail - Synchronization**:

```javascript
let pendingResponse = null;  // Global state tracker

ipcMain.handle('ask-gemini', async (event, prompt) => {
  return new Promise((resolve, reject) => {
    pendingResponse = { resolve, reject };  // Store reference
    python.stdin.write(...);                // Send to Python
    // Function returns IMMEDIATELY
    // Promise resolves when stdout data arrives
  });
});

python.stdout.on('data', (data) => {
  if (pendingResponse) {
    pendingResponse.resolve(output);  // Resolves the Promise
    pendingResponse = null;
  }
});
```

**Why This Works**:
- Main process doesn't block waiting for response
- Promise resolves asynchronously when data arrives
- Multiple requests can queue and process in sequence
- Clean error handling via promise rejection

### Extending the System

#### Adding a New Command Type

```python
# In ai.py parse_input():
elif 'prompt' in data:
    prompt = data['prompt']
    
    # Add new command type:
    if 'weather' in prompt.lower():
        return get_weather_response(prompt)
    
    # ... existing handlers ...
    return get_gemini_response(prompt)

def get_weather_response(prompt):
    # Fetch weather from weather API
    # Format response
    result = {
        "text": "The weather in Seattle is rainy and 55°F",
        "code": None,
        "command_type": "weather"
    }
    return result
```

#### Adding Voice Command Shortcuts

```javascript
// In render.js:
const VOICE_SHORTCUTS = {
  'open youtube': () => exec('start "https://youtube.com"'),
  'open gmail': () => exec('start "https://gmail.com"'),
  'open calculator': () => exec('start calc'),
};

// In get_gemini_response():
if (VOICE_SHORTCUTS[transcript.toLowerCase()]) {
    VOICE_SHORTCUTS[transcript.toLowerCase()]();
    return "Command executed";
}
```

---

## Testing and Validation

### Test Files Provided

#### test.py
Tests audio transcription with test.wav file

```bash
cd helper-app
python test.py
```

**What It Does**:
1. Reads test.wav from disk
2. Encodes to base64
3. Calls transcribe_audio_gemini()
4. Prints transcription result

**Usage**: Verify transcription works before full app test

#### test_response_parsing.js
Tests code extraction and execution

```bash
node test_response_parsing.js
```

**What It Does**:
1. Creates fake Gemini response object
2. Calls parseGeminiResponse()
3. Executes extracted code
4. Logs results

**Usage**: Verify code execution pipeline works

### Manual Testing Procedure

1. **Startup Test**
   - Launch app: `npm start`
   - Verify: Main window appears
   - Verify: Text bar appears floating
   - Verify: TTS plays greeting

2. **Text Input Test**
   - Type prompt in text input
   - Verify: Response displayed in text bar
   - Verify: TTS plays response
   - Verify: Response saved to `testing_results/`

3. **Audio Input Test**
   - Click "Listen" button
   - Speak clearly into microphone
   - Verify: Recording indicator shows
   - Verify: Transcription appears in text bar
   - Verify: AI response follows

4. **Code Execution Test**
   - Say: "Open YouTube"
   - Verify: Browser opens to YouTube
   - Verify: TTS confirms action

5. **Error Handling Test**
   - Disconnect internet while app running
   - Verify: Graceful error message displayed
   - Verify: App doesn't crash
   - Verify: Error logged to console

---

## Summary: System Advantages

1. **Modular Architecture**: UI and AI logic separated for scalability
2. **Real-Time Responsiveness**: Non-blocking IPC prevents UI freezing
3. **Flexible Deployment**: Python backend can run on local machine or cloud server
4. **Accessibility-First Design**: Voice I/O with visual feedback for all ability levels
5. **Extensible AI**: Prompt engineering allows new functionality without code changes
6. **Debug-Ready**: Response logging to files enables analysis and troubleshooting
7. **Cross-Platform Capable**: Electron works on Windows, macOS, Linux

---

## Conclusion

This accessibility voice assistant represents a sophisticated integration of modern web technologies (Electron, Web Audio API) with cloud AI services (Google Gemini). The dual-process architecture with JSON-based IPC provides a scalable, responsive foundation for voice-controlled applications that can be extended with additional features or deployed to cloud infrastructure. The system prioritizes accessibility and user experience, making it suitable for users with diverse ability levels.

