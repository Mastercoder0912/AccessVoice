#test the gemini api transcriber with the test file test.wav
import sys
import json
import os
import base64
from ai import get_gemini_response, transcribe_audio_gemini
def test_transcription():
    # Read the test audio file and encode it in base64
    with open("test.wav", "rb") as f:
        audio_bytes = f.read()
    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
    
    # Test the transcription function
    transcript = transcribe_audio_gemini(audio_base64)
    print("Transcription:", transcript)

if __name__ == "__main__":
    test_transcription()

