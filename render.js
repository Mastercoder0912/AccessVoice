// Renderer process code
let voices = [];
let mode = 'text-to-speech';
let transcriber = null;
let assistantState = "idle"; 
// idle | listening | thinking | speaking

// Intercept console.log to forward any "Transcribed:" messages to the textBar
(() => {
  const _log = console.log.bind(console);
  console.log = (...args) => {
    try {
      _log(...args);
      if (typeof args[0] === 'string' && args[0].startsWith('Transcribed:')) {
        const payload = args.slice(1).join(' ');
        if (window.electronAPI && typeof window.electronAPI.send === 'function') {
          window.electronAPI.send('update-text', String(payload));
        }
      }
    } catch (e) {
      _log('console interceptor error', e);
    }
  };
})();

// Load available voices
function populateVoices() {
  const dummy = new SpeechSynthesisUtterance('');
  window.speechSynthesis.speak(dummy);
  window.speechSynthesis.cancel();
  
  voices = window.speechSynthesis.getVoices();
  console.log('Available voices:', voices.length);
  
  const voiceSelect = document.getElementById('voice-select');
  if (!voiceSelect) return;
  voiceSelect.innerHTML = '';
  
  if (voices.length === 0) {
    console.warn('No voices available yet');
    return;
  }
  
  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
}

window.speechSynthesis.onvoiceschanged = populateVoices;
populateVoices();

function waitForVoicesReady(timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) return resolve(voices);
      if (Date.now() - start > timeout) return resolve(voices);
      setTimeout(check, 100);
    };
    check();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded fired');
  
  document.getElementById('btn-tta').addEventListener('click', () => {
    console.log('btn-tta clicked');
    mode = 'text-to-speech';
    if (transcriber && typeof transcriber.stop === 'function') transcriber.stop();
  });

  document.getElementById('btn-att').addEventListener('click', () => {
    console.log('btn-att clicked');
    mode = 'audio-to-text';
    startAudioToText();
  });
  
  await waitForVoicesReady(2000);
  populateVoices();
  
  console.log('About to call speakText');
  const text = 'Hello! This is your voice controller assistant. If you need voice assistance, then say hello, otherwise, click the button below so that I can help describe things to you via text.';
  speakText(text);
});

function speakText(text) {
    console.log('speakText called with:', text);
    
    // Send text to textbar
    if (window.electronAPI) {
      window.electronAPI.send('update-text', text);
    }
    
    const speedEl = document.getElementById('speed');
    const pitchEl = document.getElementById('pitch-slider');
    
    const rate = speedEl ? parseFloat(speedEl.value) / 50 : 1;
    const pitch = pitchEl ? parseFloat(pitchEl.value) / 50 : 1;
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.rate = Math.max(0.1, Math.min(rate, 10));
    utterance.pitch = Math.max(0.1, Math.min(pitch, 2));
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
    };
    
    utterance.onend = () => {
      console.log('Speech synthesis completed');
    };
    
    console.log('Starting speech synthesis');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function startAudioToText() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia not supported on your browser!');
        return;
    }
  if (!transcriber) transcriber = new EnsembleTranscriber();
  transcriber.onTranscript = (text) => {
    console.log('Transcribed:', text);
  };
  transcriber.start();   
}

class EnsembleTranscriber {
  constructor() {
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.whisperTranscript = '';
    this.webSpeechTranscript = '';
    this.onTranscript = (text) => {
      console.log('Transcribed:', text);
      if (window.electronAPI) {
        window.electronAPI.send('update-text', text);
      }
    };
  }

  async initWhisper() {
    this.whisperWorker = await Whisper.init({
      model: 'tiny',
      lang: 'en',
    });
  }

  async start() {
    await this.initWhisper();  // Wait for Whisper to load
    this.startWebSpeech();
    this.startWhisperMicrophone();
  }

  startWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i].transcript;
        } else {
          interim += event.results[i].transcript;
        }
      }
      if (final) this.webSpeechTranscript += final;
      this.interimTranscript = interim;
      this.mergeResults();
    };

    this.recognition.start();
  }

  startWhisperMicrophone() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        this.whisperWorker.recognize(blob).then((result) => {
          this.whisperTranscript += result.text + ' ';
          this.mergeResults();
        }).catch(err => console.error('Whisper error:', err));
      };

      mediaRecorder.start();  // Remove the 1000ms interval
    }).catch(err => console.error('Microphone access denied:', err));
  }

  mergeResults() {
    const combined = this.finalTranscript +
      (this.whisperTranscript || this.webSpeechTranscript) +
      ' ' + this.interimTranscript;

    const trimmed = combined.trim().toLowerCase();
    
    if (trimmed.includes('hello')) {
      mode = 'text-to-speech';
      this.stop();
      speakText('Hello! How can I assist you?');
    }
    
    this.recognition?.stop();
  }
}

window.electronAPI.askGemini("Hello").then(response => {
  console.log(response);
});

