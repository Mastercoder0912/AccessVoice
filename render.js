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

window.addEventListener('DOMContentLoaded', async () => {
  await waitForVoicesReady(1500);
  populateVoices();
  const text = 'Hello! This is your voice controller assistant. If you need voice assistance, then say hello, otherwise, click the button below so that I can help describe things to you via text.';
  // call speakText regardless of whether voices populated; browser will use default voice
  speakText(text);
});

document.getElementById('speak-button').addEventListener('click', () => {
  mode = 'text-to-speech';
  if (transcriber && typeof transcriber.stop === 'function') transcriber.stop();
});

document.getElementById('audio-to-text').addEventListener('click', () => {
    mode = 'audio-to-text';
    startAudioToText();
});

function speakText(text) {
    console.log('speakText called with:', text);
    console.log('Available voices:', voices.length);
    
    if (voices.length === 0) {
      console.warn('No voices available yet; using default system voice');
    }

    let voiceIndex = 0;
    try {
      const voiceSelectValue = document.getElementById('voice-select')?.value;
      voiceIndex = voiceSelectValue ? parseInt(voiceSelectValue) : 0;
    } catch (e) {
      voiceIndex = 0;
    }
    if (voices.length > 0 && (isNaN(voiceIndex) || voiceIndex < 0 || voiceIndex >= voices.length)) {
      voiceIndex = 0;
    }
    console.log('Selected voice index:', voiceIndex);
    
    const rate = parseFloat(document.getElementById('rate-input').value) || 1;
    const pitch = parseFloat(document.getElementById('pitch-input').value) || 1;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices[voiceIndex];
    utterance.rate = rate;
    utterance.pitch = pitch;
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
    };
    
    utterance.onend = () => {
      console.log('Speech synthesis completed');
    };
    
    console.log('Starting speech synthesis with voice:', utterance.voice?.name);
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

  start() {
    this.initWhisper();
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
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
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

      mediaRecorder.ondata = (e) => {
        chunks.push(e.data);
        this.whisperWorker.recognize(new Blob(chunks)).then((result) => {
          this.whisperTranscript += result.text + ' ';
          this.mergeResults();
        });
      };

      mediaRecorder.start(1000);
    });
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
    
    this.onTranscript(combined.trim());
  }

  stop() {
    this.recognition?.stop();
  }
}

