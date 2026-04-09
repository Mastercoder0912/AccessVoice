import sys
import json
import os
import re
import base64
import google.generativeai as genai

# Configure API key
api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    error = "GOOGLE_API_KEY environment variable not set"
    print(json.dumps({"error": error}), flush=True)
    sys.stderr.write(f"[AI.PY ERROR] {error}\n")
    sys.exit(1)

try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name="gemini-2.0-flash")
    sys.stderr.write("[AI.PY] Gemini configured successfully\n")
except Exception as e:
    error = f"Failed to configure Gemini: {str(e)}"
    print(json.dumps({"error": error}), flush=True)
    sys.stderr.write(f"[AI.PY ERROR] {error}\n")
    sys.exit(1)


def transcribe_audio_gemini(audio_base64):
    """Transcribe audio using Gemini's audio understanding"""
    try:
        # Decode base64 to bytes
        audio_bytes = base64.b64decode(audio_base64)
        sys.stderr.write(f"[TRANSCRIBE] Audio bytes: {len(audio_bytes)}\n")
        
        # Use the proper Gemini API format for audio
        # The google-generativeai SDK expects inline_data with mime_type and data (as bytes)
        response = model.generate_content([
            {"mime_type": "audio/webm", "data": audio_bytes},
            "Transcribe this audio into plain text. Return only the transcription, no other text or commentary."
        ])
        
        transcript = response.text if response else ""
        sys.stderr.write(f"[TRANSCRIBE] Success, length: {len(transcript)}\n")
        return transcript
    except Exception as e:
        error_msg = f"Gemini transcription error: {str(e)}"
        print(json.dumps({"error": error_msg}), flush=True)
        sys.stderr.write(f"[TRANSCRIBE ERROR] {error_msg}\n")
        return None


def get_gemini_response(transcript, audio_base64=None):
    """Get response from Gemini"""
    try:
        prompt = f"""You are a disability assistance AI. Respond naturally and include code commands if needed.
If the user wants to open something, include code like:
<CODE>require('child_process').exec('start https://youtube.com')</CODE>

User request: {transcript}

Keep responses concise and helpful."""
        
        response = model.generate_content(prompt)
        
        # Parse response
        response_text = response.text if response else ""
        code_match = re.search(r'<CODE>([\s\S]*?)</CODE>', response_text, re.IGNORECASE)
        code = code_match.group(1).strip() if code_match else None
        
        # Clean text
        clean_text = re.sub(r'<CODE>[\s\S]*?</CODE>', '', response_text, flags=re.IGNORECASE).strip()
        
        result = {
            "text": clean_text,
            "code": code,
            "transcript": transcript
        }
        
        # Debug logging
        print(json.dumps({
            "debug": "Response parsed",
            "transcript": transcript[:50],
            "has_code": code is not None,
            "response_length": len(response_text)
        }), flush=True)
        
        return result
    except Exception as e:
        return {
            "error": str(e),
            "text": "Sorry, I encountered an error processing your request.",
            "code": None
        }


def parse_input(data):
    """Parse input from main process"""
    if isinstance(data, dict):
        # Check if this is an audio request
        if 'audio_base64' in data:
            audio_base64 = data['audio_base64']
            print(json.dumps({"status": "Transcribing audio with Gemini..."}), flush=True)
            # Transcribe audio using Gemini
            transcript = transcribe_audio_gemini(audio_base64)
            if transcript:
                return get_gemini_response(transcript, audio_base64)
            else:
                return {"error": "Failed to transcribe audio", "text": "Could not understand the audio."}
        elif 'prompt' in data:
            # Regular text prompt
            prompt = data['prompt']
            
            # TEST MODE: Return fake response for "happy" prompt
            if 'happy' in prompt.lower() and 'will' in prompt.lower():
                fake_response = {
                    "text": "Playing Happy by Pharrel Williams on YouTube for you!",
                    "code": """require('child_process').exec('start "" "https://www.youtube.com/watch?v=ZbZSe6N_BXs&list=RDZbZSe6N_BXs&start_radio=1&pp=ygUYaGFwcHkgcGhhcnJlbGwgd2lsbGlhbXMgoAcB"');""",
                    "debug": "FAKE_RESPONSE_TEST_MODE"
                }
                return fake_response
            
            return get_gemini_response(prompt)
    elif isinstance(data, str):
        # Plain string prompt
        return get_gemini_response(data)
    
    return {"error": "Invalid input format"}


# Main loop
try:
    for line in sys.stdin:
        try:
            data = json.loads(line.strip())
            result = parse_input(data)
            print(json.dumps(result), flush=True)
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}), flush=True)
        except Exception as err:
            print(json.dumps({"error": f"Processing error: {str(err)}"}), flush=True)
except KeyboardInterrupt:
    pass
except Exception as err:
    print(json.dumps({"error": f"Fatal error: {str(err)}"}), flush=True)

