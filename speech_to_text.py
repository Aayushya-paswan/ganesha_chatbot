import speech_recognition as sr
import edge_tts
import asyncio
import os
from playsound import playsound
from datetime import datetime
import glob

# 🎤 Convert speech → text
def speech_to_text():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("🎙 Speak now...")
        audio = recognizer.listen(source)
    try:
        text = recognizer.recognize_google(audio, language="en-US")  # choose language
        print("📝 You said:", text)
        return text
    except sr.UnknownValueError:
        print("⚠️ Could not understand audio")
        return ""
    except sr.RequestError as e:
        print("⚠️ API error:", e)
        return ""




if __name__ == "__main__":
    while True:
        said = speech_to_text()
        if said:
            text_to_speech("You said " + said)
