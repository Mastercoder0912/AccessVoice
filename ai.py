import sys
import json
import os
import google.generativeai as genai

genai.configure(os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel(
    model_name="gemini-3-flash-preview",
    system_instruction="""you are part of a disability helping app and you are the brain. you will be sent a copy of the audio and a transcript. your job is to send back a response that the tts mdoel will read outloud and you must send
    code that will be executed. for example if the user wants to open youtube then you should out something like "youtube is now open. what would you like to watc" along with the code that will be run to open youtube in their browser.
    """
)

def get_response(prompt):
    response = model.generate_content(prompt)
    print(json.dumps({"response": response.text}))
    sys.stdout.flush()

for line in sys.stdin:
    prompt = line.strip()
    get_response(prompt)
