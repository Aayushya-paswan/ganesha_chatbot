from flask import Flask, render_template, request, jsonify, send_file
import os
import threading
import tempfile
from datetime import datetime
import asyncio
import edge_tts
from playsound import playsound
import speech_recognition as sr
import glob
import base64
import wave
import io

# Import your existing modules
from gem import generate_gemini_response

app = Flask(__name__)

# Configure upload folder for audio files
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Speech recognition functions from your speech_to_text.py
def speech_to_text(audio_file_path=None):
    recognizer = sr.Recognizer()
    
    try:
        if audio_file_path:
            # Process uploaded audio file
            with sr.AudioFile(audio_file_path) as source:
                # Adjust for ambient noise and record
                recognizer.adjust_for_ambient_noise(source)
                audio = recognizer.record(source)
        else:
            # Process from microphone
            with sr.Microphone() as source:
                print("🎙 Speak now...")
                recognizer.adjust_for_ambient_noise(source)
                audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
        
        text = recognizer.recognize_google(audio, language="en-US")
        print("📝 You said:", text)
        return text
        
    except sr.UnknownValueError:
        print("⚠️ Could not understand audio")
        return ""
    except sr.RequestError as e:
        print("⚠️ API error:", e)
        return ""
    except Exception as e:
        print(f"Error in speech_to_text: {e}")
        return ""

# Text-to-speech function
def text_to_speech(text: str) -> str:
    try:
        async def say(text, file_name):
            communicate = edge_tts.Communicate(text, "en-IN-PrabhatNeural")
            await communicate.save(file_name)

        # Create unique filename
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        file_name = os.path.join(app.config['UPLOAD_FOLDER'], f"output_{ts}.mp3")

        # Run TTS
        asyncio.run(say(text, file_name))

        # Optional: cleanup old files (keep only latest 5)
        old_files = sorted(glob.glob(os.path.join(app.config['UPLOAD_FOLDER'], "output_*.mp3")))
        if len(old_files) > 5:
            for f in old_files[:-5]:
                try:
                    os.remove(f)
                except:
                    pass

        return file_name
    except Exception as e:
        print(f"Error in text_to_speech: {e}")
        return ""

# Convert webm to wav format
def convert_webm_to_wav(webm_data):
    try:
        # Create a temporary file
        webm_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm")
        wav_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav")
        
        # Save webm data to file
        with open(webm_path, 'wb') as f:
            f.write(webm_data)
        
        # Convert using ffmpeg if available, otherwise just rename
        try:
            import subprocess
            subprocess.run(['ffmpeg', '-i', webm_path, '-ar', '16000', '-ac', '1', wav_path], 
                          check=True, capture_output=True)
            os.remove(webm_path)
            return wav_path
        except:
            # If ffmpeg is not available, just use the webm file directly
            os.rename(webm_path, wav_path)
            return wav_path
            
    except Exception as e:
        print(f"Error converting audio: {e}")
        return None

# Routes
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/handle', methods=['POST'])
def handle_message():
    user_input = request.form.get('name', '')
    
    if not user_input:
        return jsonify({'error': 'No message provided'}), 400
    
    # Get response from Ganesha
    try:
        response = generate_gemini_response(user_input)
    except Exception as e:
        print(f"Error generating response: {e}")
        response = "My child, I am having difficulty responding at this moment. Please try again later."
    
    return jsonify({
        'user_input': user_input,
        'response': response
    })

@app.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        if 'audio' not in request.files and 'audio_data' not in request.form:
            return jsonify({'error': 'No audio data provided'}), 400
        
        audio_file = None
        audio_data = None
        
        # Check if audio was sent as a file
        if 'audio' in request.files:
            audio_file = request.files['audio']
            print(f"Received audio file: {audio_file.filename}")
        
        # Check if audio was sent as base64 data (from recorder.js)
        if 'audio_data' in request.form:
            audio_data = request.form['audio_data']
            print("Received base64 audio data")
        
        filename = None
        
        if audio_file and audio_file.filename != '':
            # Save the uploaded audio file
            filename = os.path.join(app.config['UPLOAD_FOLDER'], f"audio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav")
            audio_file.save(filename)
        elif audio_data:
            # Handle base64 audio data
            audio_bytes = base64.b64decode(audio_data.split(',')[1])
            filename = convert_webm_to_wav(audio_bytes)
        
        if not filename or not os.path.exists(filename):
            return jsonify({'error': 'Failed to save audio file'}), 500
        
        # Convert speech to text
        text = speech_to_text(filename)
        
        if not text:
            # Clean up temporary audio file
            if os.path.exists(filename):
                os.remove(filename)
            return jsonify({'error': 'Could not understand audio. Please try again.'}), 400
        
        # Get AI response
        response = generate_gemini_response(text)
        
        # Convert response to speech
        speech_filename = text_to_speech(response)
        if speech_filename and os.path.exists(speech_filename):
            speech_url = f'/get_audio/{os.path.basename(speech_filename)}'
        else:
            speech_url = None
        
        # Clean up temporary audio file
        if os.path.exists(filename):
            os.remove(filename)
        
        return jsonify({
            'text': text,
            'response': response,
            'audio_url': speech_url
        })
        
    except Exception as e:
        print(f"Error processing audio: {e}")
        # Clean up temporary audio file in case of error
        if 'filename' in locals() and filename and os.path.exists(filename):
            os.remove(filename)
        return jsonify({'error': 'Failed to process audio. Please try again.'}), 500

# Add this new route for text-to-speech conversion
@app.route('/text_to_speech', methods=['POST'])
def handle_text_to_speech():
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Convert response to speech
        speech_filename = text_to_speech(text)
        if speech_filename and os.path.exists(speech_filename):
            speech_url = f'/get_audio/{os.path.basename(speech_filename)}'
        else:
            return jsonify({'error': 'Failed to generate speech'}), 500
        
        return jsonify({
            'audio_url': speech_url
        })
    except Exception as e:
        print(f"Error in text_to_speech route: {e}")
        return jsonify({'error': 'Failed to convert text to speech'}), 500

@app.route('/get_audio/<filename>')
def get_audio(filename):
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(file_path):
            return send_file(file_path)
        else:
            return jsonify({'error': 'Audio file not found'}), 404
    except Exception as e:
        print(f"Error serving audio file: {e}")
        return jsonify({'error': 'Failed to retrieve audio'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)