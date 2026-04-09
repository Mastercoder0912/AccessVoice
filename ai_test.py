import sys
import json
import os
import re

# Mock Gemini responses for testing when quota is exhausted
def parse_response(text):
    """Extract text and code blocks from response"""
    code_match = re.search(r'<CODE>([\s\S]*?)</CODE>', text, re.IGNORECASE)
    code = code_match.group(1).strip() if code_match else None
    clean_text = re.sub(r'<CODE>[\s\S]*?</CODE>', '', text, flags=re.IGNORECASE).strip()
    return {
        "text": clean_text,
        "code": code
    }

def get_mock_response(prompt):
    """Generate mock responses for testing"""
    prompt_lower = prompt.lower()
    
    if 'youtube' in prompt_lower or 'open' in prompt_lower:
        return "YouTube is now open. What would you like to search for? <CODE>require('child_process').exec('start https://youtube.com')</CODE>"
    elif 'hello' in prompt_lower or 'hi' in prompt_lower:
        return "Hello! How can I assist you today?"
    elif 'time' in prompt_lower:
        return "I don't have access to real time, but you can check your system clock."
    else:
        return f"I understand you said: {prompt}. How can I help you further?"

try:
    for line in sys.stdin:
        try:
            prompt_obj = json.loads(line.strip())
            prompt_text = prompt_obj.get("prompt", "")
            
            # Generate mock response
            response_text = get_mock_response(prompt_text)
            parsed = parse_response(response_text)
            
            print(json.dumps({"response": parsed["text"], "code": parsed["code"]}), flush=True)
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}), flush=True)
        except Exception as err:
            print(json.dumps({"error": str(err)}), flush=True)
except KeyboardInterrupt:
    pass
except Exception as err:
    print(json.dumps({"error": f"Fatal error: {str(err)}"}), flush=True)
