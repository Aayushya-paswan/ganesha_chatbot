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

# 🔊 Convert text → speech
def text_to_speech(text: str) -> str:
    async def say(text, file_name):
        communicate = edge_tts.Communicate(text, "en-IN-PrabhatNeural")
        await communicate.save(file_name)

    # create unique filename each time
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    file_name = f"output_{ts}.mp3"

    # run TTS
    asyncio.run(say(text, file_name))

    # play audio
    playsound(file_name)

    # optional: cleanup old files (keep only latest 5)
    old_files = sorted(glob.glob("output_*.mp3"))
    if len(old_files) > 5:
        for f in old_files[:-5]:
            try:
                os.remove(f)
            except:
                pass

    return file_name


if __name__ == "__main__":
    while True:
        said = speech_to_text()
        if said:
            text_to_speech("You said " + said)
