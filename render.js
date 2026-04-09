let voices = [];
let mode = 'text-to-speech';
let transcriber = null;
let assistantState = "idle"; 

(() => {
  const _log = console.log.bind(console);
  const _error = console.error.bind(console);
  const _warn = console.warn.bind(console);
  
  console.log = (...args) => {
    try {
      _log(...args);
      // Send to main process for terminal output
      if (window.electronAPI && typeof window.electronAPI.send === 'function') {
        window.electronAPI.send('log-to-terminal', { level: 'log', message: args.join(' ') });
      }
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
  
  console.error = (...args) => {
    try {
      _error(...args);
      if (window.electronAPI && typeof window.electronAPI.send === 'function') {
        window.electronAPI.send('log-to-terminal', { level: 'error', message: args.join(' ') });
      }
    } catch (e) {
      _error('console interceptor error', e);
    }
  };
  
  console.warn = (...args) => {
    try {
      _warn(...args);
      if (window.electronAPI && typeof window.electronAPI.send === 'function') {
        window.electronAPI.send('log-to-terminal', { level: 'warn', message: args.join(' ') });
      }
    } catch (e) {
      _warn('console interceptor error', e);
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
  if (!transcriber) transcriber = new AudioRecorder();
  transcriber.onTranscript = (text) => {
    console.log('[AUDIO] Transcribed:', text);
    if (window.electronAPI) {
      window.electronAPI.send('update-text', text);
    }
  };
  transcriber.start();   
}

class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.stream = null;
    this.audioBlob = null;
    this.onTranscript = (text) => {
      console.log('[AUDIO] Transcribed:', text);
      if (window.electronAPI) {
        window.electronAPI.send('update-text', text);
      }
    };
  }

  async start() {
    console.log('[AUDIO] Starting microphone recording...');
    try {
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

      const chunks = [];
      let recordingTimeout = null;

      this.mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        if (recordingTimeout) clearTimeout(recordingTimeout);

        this.audioBlob = new Blob(chunks, { type: 'audio/webm' });
        console.log('[AUDIO] Recording stopped, size:', this.audioBlob.size);

        try {
          // Convert audio to base64
          const reader = new FileReader();
          reader.onload = async () => {
            const audioBase64 = reader.result.split(',')[1];
            console.log('[AUDIO] Sending to Python for transcription...');
            
            try {
              const response = await window.electronAPI.askGeminiWithAudio(audioBase64);
              console.log('[AUDIO] Response:', response);
              
              if (response && response.text) {
                mode = 'text-to-speech';
                assistantState = 'thinking';
                this.onTranscript(response.text);
                setTimeout(() => {
                  speakText(response.text);
                }, 150);
              }
            } catch (err) {
              console.error('[AUDIO] Error from backend:', err);
              if (window.electronAPI) {
                window.electronAPI.send('update-text', 'Error processing audio. Please try again.');
              }
            }
          };
          reader.readAsDataURL(this.audioBlob);
        } catch (err) {
          console.error('[AUDIO] Error:', err);
          if (window.electronAPI) {
            window.electronAPI.send('update-text', 'Error processing audio. Please try again.');
          }
        }
      };

      recordingTimeout = setTimeout(() => {
        console.warn('[AUDIO] 30s timeout reached, stopping');
        this.stop();
      }, 30000);

      this.mediaRecorder.start();
      console.log('[AUDIO] Recording started');
      if (window.electronAPI) {
        window.electronAPI.send('update-text', 'Listening... (30s max)');
      }
    } catch (err) {
      console.error('[AUDIO] Microphone access denied:', err);
      if (window.electronAPI) {
        window.electronAPI.send('update-text', 'Microphone access denied. Please allow permissions.');
      }
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}

