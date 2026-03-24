let voices = [];
let mode = 'text-to-speech';
let transcriber = null;
let assistantState = "idle"; 

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
    assistantState = 'listening';
    startAudioToText();
  });

  // Add event listeners for slider changes to adjust speaking rate/pitch dynamically
  const speedSlider = document.getElementById('speed');
  const pitchSlider = document.getElementById('pitch-slider');

  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      console.log('Speed changed to:', e.target.value);
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    });
  }

  if (pitchSlider) {
    pitchSlider.addEventListener('input', (e) => {
      console.log('Pitch changed to:', e.target.value);
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    });
  }
  
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
      assistantState = 'listening';
    };
    
    utterance.onstart = () => {
      assistantState = 'speaking';
    };
    
    console.log('Starting speech synthesis');
    window.speechSynthesis.cancel();
    assistantState = 'thinking';
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
    if (window.electronAPI) {
      window.electronAPI.send('update-text', text);
    }
  };
  transcriber.start();   
}

class EnsembleTranscriber {
  constructor() {
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.whisperTranscript = '';
    this.webSpeechTranscript = '';
    this.audioBlob = null;
    this.mediaRecorder = null;
    this.stream = null;
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
          
    this.recognition.onstart = () => {
      assistantState = 'listening';
    };
      this.finalTranscript += final;
      this.webSpeechTranscript = this.finalTranscript + interim;
      this.interimTranscript = interim;
      this.mergeResults();
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    this.recognition.start();
  }

  startWhisperMicrophone() {
    navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true 
      } 
    }).then((stream) => {
      this.stream = stream;
      this.mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        this.audioBlob = new Blob(chunks, { type: 'audio/wav' });
        this.whisperWorker.recognize(this.audioBlob).then((result) => {
          this.whisperTranscript += result.text + ' ';
          this.mergeResults();
        }).catch(err => console.error('Whisper error:', err));
      };

      this.mediaRecorder.start();
    }).catch(err => console.error('Microphone access denied:', err));
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  async mergeResults() {
    const combined = this.finalTranscript +
      (this.whisperTranscript || this.webSpeechTranscript) +
      ' ' + this.interimTranscript;

    const trimmed = combined.trim().toLowerCase();
    // Send real-time transcription to textbar
    if (trimmed) {
      this.onTranscript(trimmed);
    }
    
    if (trimmed.includes('hello')) {
      mode = 'text-to-speech';
      assistantState = 'thinking';
      this.stop();
      
      // If we have audio and transcript, send to Gemini API
      if (this.audioBlob && trimmed) {
        try {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const audioBase64 = e.target.result.split(',')[1]; // Get base64 part
            const response = await window.electronAPI.askGeminiWithAudio(audioBase64, trimmed);
            console.log('Gemini response:', response);
            // Small delay to let transcription appear before audio plays
            setTimeout(() => {
              speakText(response);
            }, 150);
          };
          reader.readAsDataURL(this.audioBlob);
        } catch (err) {
          console.error('Error sending to Gemini:', err);
          // Fallback to generic response
          setTimeout(() => {
            speakText('Hello! How can I assist you?');
          }, 150);
        }
      } else {
        // Fallback if no audio
        setTimeout(() => {
          speakText('Hello! How can I assist you?');
        }, 150);
      }
    }
    
    this.recognition?.stop();
  }
}

