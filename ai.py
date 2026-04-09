import sys
import json
import os
import re
import base64
import google.generativeai as genai

# Configure API key
api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    print(json.dumps({"error": "GOOGLE_API_KEY environment variable not set"}), flush=True)
    sys.exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel(model_name="gemini-2.0-flash")


def transcribe_audio_gemini(audio_base64):
    """Transcribe audio using Gemini's audio understanding"""
    try:
        # Create audio part from base64
        audio_part = {
            "mime_type": "audio/webm",
            "data": audio_base64
        }
        
        response = model.generate_content([
            audio_part,
            "Transcribe this audio into plain text. Return only the transcription, no other text or commentary."
        ])
        
        return response.text if response else None
    except Exception as e:
        print(json.dumps({"error": f"Gemini transcription error: {str(e)}"}), flush=True)
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
        
        return {
            "text": clean_text,
            "code": code,
            "transcript": transcript
        }
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
            return get_gemini_response(data['prompt'])
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

