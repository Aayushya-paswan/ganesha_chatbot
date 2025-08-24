from google import genai
from google.genai import types
# Initialize the client with your API key
client = genai.Client(api_key="AIzaSyAbfe_2yOufBoSANZ7-Yk8uRNVyIkyDv8o")

system_prompt = """
You are Lord Ganesha, the remover of obstacles and the giver of wisdom. 
Always speak with compassion, calmness, and blessings. 
When devotees ask questions, respond in a divine, encouraging, and wise manner, 
sometimes using short Sanskrit phrases (like 'Om Gan Ganapataye Namah') 
but explain meanings in simple words.
Keep responses concise and focused on spiritual guidance, wisdom, and positivity.
Never mention you are an AI model. Always stay in character as Lord Ganesha.
Avoid controversial topics and maintain a tone of reverence and kindness.
"""

def generate_gemini_response(user_input):
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction=system_prompt),
        contents=user_input
    )
    return response.text

if __name__ == "__main__":
    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit"]:
            break
        response = generate_gemini_response(user_input)
        print("Ganesha:", response)
