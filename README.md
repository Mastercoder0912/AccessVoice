# AccessVoice

### Description:

AccessVoice is a cutting-edge accessibility voice assistant designed to empower users with disabilities by providing seamless voice-controlled interaction with their computers. By combining voice input/output with AI-powered command processing, AccessVoice creates an intuitive hands-free interface that removes barriers to technology access.

The application leverages Google's Gemini API to understand natural language commands and execute them intelligently. Whether you need to open a website, launch an application, or get information, AccessVoice understands your intent and acts on it immediately through voice commands.

Key Innovation: AccessVoice uses a sophisticated multi-process architecture that separates the user interface (JavaScript/Electron) from the AI inference layer (Python). This enables efficient resource management, real-time responsiveness, and the ability to scale functionality without compromising performance.

### The Problem We're Solving:

For individuals with mobility impairments, visual impairments, or other disabilities, traditional computer interaction can be frustrating and time-consuming. Keyboard navigation is inaccessible, mouse control is difficult, and even touchscreens require precise hand-eye coordination. AccessVoice eliminates these barriers by allowing users to control their computer entirely through natural speech.

### How It Works:

AccessVoice operates on a simple but powerful principle:

1. User speaks a command in natural language
2. Audio is captured and transmitted to the AI backend
3. Gemini processes the request and determines the appropriate action
4. Code is executed to perform the requested task
5. Response is spoken back to the user via text-to-speech

The magic happens in the code extraction and execution layer. When you say "Open YouTube," the AI understands this intent and generates executable code that opens your browser to YouTube, all automatically.

### Technical Highlights:

- Dual-Mode Operation: Both text and voice input modes
- Real-Time Transcription: Speech-to-text powered by Gemini API
- Intelligent Code Generation: AI generates executable commands based on user intent
- Floating Text Overlay: Real-time display of transcriptions and responses
- Multi-Process Architecture: Efficient separation of concerns between UI and AI
- Cross-Platform: Built with Electron for Windows, macOS, and Linux

### Use Cases:

- Users with motor disabilities navigate the web without touching a keyboard or mouse
- Visually impaired users receive audio feedback while controlling their computer
- Users with hearing impairments see real-time transcriptions on screen
- Power users automate repetitive tasks through voice commands
- Accessibility features can be integrated into any Electron application

### Inspiration & Evolution:

This project was developed as a Technology Student Association (TSA) submission but has evolved into a full-featured accessibility platform. The inspiration came from recognizing that millions of people struggle with computer access, and that modern AI makes solving this problem more achievable than ever.

The development process involved solving complex technical challenges: how to efficiently transmit audio between processes, how to reliably extract and execute code from AI responses, and how to create a seamless user experience that works with a floating overlay window.

### Project Architecture:

The system is built on a three-layer architecture:

Top Layer: Electron Main Process handles window management, IPC routing, and Python process spawning. This is where user interactions get routed and where system commands execute.

Middle Layer: Renderer Process captures voice input through the Web Audio API, manages the UI, and handles text-to-speech playback. This is what the user sees and interacts with.

Bottom Layer: Python Backend handles all AI processing. It connects to the Gemini API, transcribes audio, generates responses, and extracts executable code from AI outputs.

Communication between layers happens through stdin/stdout JSON messages, ensuring clean separation of concerns and efficient data flow.

### Files Overview:

- main.js - Electron main process: window management, IPC routing, Python process spawning
- render.js - Renderer process: UI logic, audio recording, text-to-speech
- ai.py - Python backend: Gemini API integration, audio transcription, code generation
- index.html - Primary user interface
- textbar.html - Floating overlay window for real-time feedback
- DOCUMENTATION.md - Comprehensive technical documentation

### Getting Started:

Prerequisites:
- Node.js (v14+)
- Python (v3.7+)
- Google Gemini API Key (free tier available)

Installation:

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd AccessVoice
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Set up Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```

4. Install Python dependencies:
   ```bash
   pip install google-generativeai
   ```

5. Configure API Key:
   - Get a free API key from Google AI Studio (https://aistudio.google.com)
   - Create a .env file in the project root:
     ```
     GOOGLE_API_KEY=your_api_key_here
     ```

6. Launch the application:
   ```bash
   npm start
   ```

### Features:

- Voice Commands: Speak naturally, AI understands intent
- Real-Time Transcription: See what you're saying as you speak
- Auto Code Execution: AI generates and executes commands automatically
- Text-to-Speech Response: Hear confirmations and feedback
- Floating Overlay Window: Always-visible status display
- Multi-Process Design: Responsive UI with backend processing
- Customizable Voice: Adjust speaking rate and pitch
- Error Handling: Graceful failure with meaningful messages

### Demo & Testing:

The application includes a demo mode for testing without live API calls. Edit ai.py and set DEMO_MODE = True to see the full workflow with cached responses.

### Future Roadmap:

- Custom command profiles for different user needs
- Machine learning to improve command recognition over time
- Integration with more applications and services
- Mobile app version
- Browser extension for web accessibility
- Community plugin system for extensibility

### Contributing:

This project is actively developed and welcomes contributions. Areas of focus include improving voice recognition accuracy, expanding the command library, enhancing accessibility features, and performance optimization.

### License:

ISC License - Feel free to use, modify, and distribute.

### Support:

For issues, questions, or suggestions, please open an issue in the repository. For comprehensive technical details, see DOCUMENTATION.md.

Built to make computer access universal.
