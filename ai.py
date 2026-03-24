import sys
import json
import os
import re
import google.generativeai as genai

genai.configure(os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel(
    model_name="gemini-3-flash-preview",
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
    response = model.generate_content(prompt)
    parsed = parse_response(response.text)
    print(json.dumps({"response": parsed["text"], "code": parsed["code"]}))
    sys.stdout.flush()

for line in sys.stdin:
    prompt = json.loads(line.strip())
    get_response(prompt.get("prompt", line.strip()))

