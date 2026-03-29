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

// Convert AudioBuffer to WAV format
function audioBufferToWav(buffer) {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

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
    speakText('I am ready to listen for your command. Please say it now.');
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

      // After TTS ends, start listening for voice input
      if (mode === 'text-to-speech') {
        startAudioToText();
      }
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
    this.lastSentTranscript = '';
    this.onTranscript = (text) => {
      console.log('Transcribed:', text);
      if (window.electronAPI) {
        window.electronAPI.send('update-text', text);
      }
    };
  }

  async start() {
    this.startWhisperMicrophone();
  }

  startWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('SpeechRecognition not supported in this environment');
      return;
    }
    this.recognition = new SpeechRecognition();
    console.log('SpeechRecognition created:', this.recognition);
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    console.log('SpeechRecognition after setting:', this.recognition);

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

      // Auto-retry transient speech recognition errors where possible
      if (event.error === 'network' || event.error === 'no-speech' || event.error === 'aborted') {
        console.warn('Retrying speech recognition in 500ms due to transient error:', event.error);
        setTimeout(() => {
          try {
            this.recognition.start();
          } catch (err) {
            console.error('Retry start failed:', err);
          }
        }, 500);
      }

      // update textbar with guidance
      if (window.electronAPI) {
        window.electronAPI.send('update-text', `Speech recognition error (${event.error}). Check network/mic and speak clearly.`);
      }
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
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      const chunks = [];
      let recordingTimeout = null;

      this.mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        if (recordingTimeout) clearTimeout(recordingTimeout);

        this.audioBlob = new Blob(chunks, { type: 'audio/webm' });
        console.log('Recording stopped, audio blob size:', this.audioBlob.size);

        try {
          // Decode WebM to AudioBuffer, then send raw Float32Array
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const arrayBuffer = await this.audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Send raw Float32Array directly to backend
          const audioData = audioBuffer.getChannelData(0); // First channel
          console.log('Sending raw audio data, samples:', audioData.length, 'sample rate:', audioBuffer.sampleRate);

          try {
            const transcript = await window.electronAPI.transcribeAudio(audioData);
            console.log('Whisper transcript received:', transcript);
            this.whisperTranscript += transcript + ' ';
            this.mergeResults();
          } catch (err) {
            console.error('Transcription error:', err);
            this.mergeResults();
          }
      
      recordingTimeout = setTimeout(() => {
        console.warn('Recording timeout reached (30s), stopping capture');
        this.stop();
      }, 30000);
    }).catch(err => {
      console.error('Microphone access denied:', err);
      if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        window.electronAPI?.send('update-text', 'Microphone access denied. Please allow microphone permissions and click the button again.');
      }
    });
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

    // Do not stop recognition here; keep listening to live speech in continuous mode

    const triggerWords = ['hello', 'open', 'search', 'play', 'close', 'stop', 'go'];
    const hasTrigger = triggerWords.some((w) => trimmed.includes(w));

    if (hasTrigger && trimmed && trimmed !== this.lastSentTranscript) {
      this.lastSentTranscript = trimmed;
      mode = 'text-to-speech';
      assistantState = 'thinking';
      
      console.log('Trigger detected, stopping recording:', trimmed);
      this.stop();

      if (this.audioBlob) {
        try {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const audioBase64 = e.target.result.split(',')[1];
            const response = await window.electronAPI.askGeminiWithAudio(audioBase64, trimmed);
            console.log('Gemini response:', response);
            setTimeout(() => {
              speakText(response);
            }, 150);
          };
          reader.readAsDataURL(this.audioBlob);
        } catch (err) {
          console.error('Error sending to Gemini:', err);
          setTimeout(() => {
            speakText('Sorry, there was an error processing your request.');
          }, 150);
        }
      } else {
        setTimeout(() => {
          speakText('Hello! How can I assist you?');
        }, 150);
      }
    }
  }
}

