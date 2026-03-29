import sys
import json
import os
import re
import google.generativeai as genai

# Configure API key from environment variable
api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    print(json.dumps({"error": "GOOGLE_API_KEY environment variable not set"}), flush=True)
    sys.exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash",
    system_instruction="""you are part of a disability helping app and you are the brain. you will be sent a copy of the audio and a transcript. your job is to send back a response that the tts model will read outloud and you must send
    code that will be executed. for example if the user wants to open youtube then you should output something like "youtube is now open. what would you like to watch" along with the code that will be run to open youtube in their browser using this format:
    <CODE>require('child_process').exec('start https://youtube.com')</CODE>
    """
)

def parse_response(text):
    """Extract text and code blocks from response"""
    # Try to extract code with CODE tags
    code_match = re.search(r'<CODE>([\s\S]*?)</CODE>', text, re.IGNORECASE)
    code = code_match.group(1).strip() if code_match else None
    
    # Remove code block from text
    clean_text = re.sub(r'<CODE>[\s\S]*?</CODE>', '', text, flags=re.IGNORECASE).strip()
    
    return {
        "text": clean_text,
        "code": code
    }

def get_response(prompt):
    try:
        response = model.generate_content(prompt)
        parsed = parse_response(response.text)
        print(json.dumps({"response": parsed["text"], "code": parsed["code"]}), flush=True)
    except Exception as err:
        print(json.dumps({"error": str(err), "response": "Sorry, I encountered an error processing your request."}), flush=True)

try:
    for line in sys.stdin:
        try:
            prompt = json.loads(line.strip())
            get_response(prompt.get("prompt", line.strip()))
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}), flush=True)
        except Exception as err:
            print(json.dumps({"error": str(err)}), flush=True)
except KeyboardInterrupt:
    pass
except Exception as err:
    print(json.dumps({"error": f"Fatal error: {str(err)}"}), flush=True)

