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
import json
import subprocess
from pydub import AudioSegment

from gem import generate_gemini_response

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

def speech_to_text(audio_file_path=None, audio_data=None):
    recognizer = sr.Recognizer()
    
    try:
        if audio_file_path and os.path.exists(audio_file_path):
            with sr.AudioFile(audio_file_path) as source:
                recognizer.adjust_for_ambient_noise(source)
                audio = recognizer.record(source)
        elif audio_data:
            audio = sr.AudioData(audio_data, 16000, 2)  
        else:
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

def text_to_speech(text: str) -> str:
    try:
        async def say(text, file_name):
            communicate = edge_tts.Communicate(text, "en-IN-PrabhatNeural")
            await communicate.save(file_name)

        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        file_name = os.path.join(app.config['UPLOAD_FOLDER'], f"output_{ts}.mp3")

        asyncio.run(say(text, file_name))

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

def convert_to_wav(input_path, output_path=None):
    try:
        if not output_path:
            output_path = input_path.rsplit('.', 1)[0] + '.wav'
        
        audio = AudioSegment.from_file(input_path)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        audio.export(output_path, format="wav")
        
        return output_path
    except Exception as e:
        print(f"Error converting {input_path} to WAV: {e}")
        return None

def convert_webm_to_wav(webm_data):
    try:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        webm_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{ts}.webm")
        wav_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{ts}.wav")
        
        with open(webm_path, 'wb') as f:
            f.write(webm_data)
        
        try:
            audio = AudioSegment.from_file(webm_path, format="webm")
            audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
            audio.export(wav_path, format="wav")
            os.remove(webm_path)
            return wav_path
        except Exception as e:
            print(f"Pydub conversion failed: {e}")
            try:
                subprocess.run([
                    'ffmpeg', '-i', webm_path, 
                    '-ar', '16000', '-ac', '1', '-sample_fmt', 's16',
                    wav_path
                ], check=True, capture_output=True, timeout=30)
                os.remove(webm_path)
                return wav_path
            except subprocess.TimeoutExpired:
                print("FFmpeg conversion timed out")
                os.remove(webm_path)
                return None
            except Exception as ffmpeg_error:
                print(f"FFmpeg conversion also failed: {ffmpeg_error}")
                os.remove(webm_path)
                return None
                
    except Exception as e:
        print(f"Error converting audio: {e}")
        for path in [webm_path, wav_path]:
            if 'path' in locals() and path and os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
        return None

def extract_audio_from_base64(audio_data):
    try:
        if ',' in audio_data:
            audio_data = audio_data.split(',')[1]
        
        audio_bytes = base64.b64decode(audio_data)
        return audio_bytes
    except Exception as e:
        print(f"Error decoding base64 audio: {e}")
        return None

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/handle', methods=['POST'])
def handle_message():
    user_input = request.form.get('name', '')
    
    if not user_input:
        return jsonify({'error': 'No message provided'}), 400
    
    try:
        response = generate_gemini_response(user_input)
    except Exception as e:
        print(f"Error generating response: {e}")
        response = "My child, I am having difficulty responding at this moment. Please try again later."
    
    return jsonify({
        'user_input': user_input,
        'response': response
    })

@app.route('/about.html')
def about():
    return render_template('about.html')

@app.route('/process_audio', methods=['POST'])
def process_audio():
    temp_files = []  
    
    try:
        text = None
        filename = None
        
        if 'audio' in request.files:
            audio_file = request.files['audio']
            if audio_file.filename != '':
                print(f"Received audio file: {audio_file.filename}")
                
                original_ext = os.path.splitext(audio_file.filename)[1] or '.webm'
                original_filename = os.path.join(
                    app.config['UPLOAD_FOLDER'], 
                    f"audio_{datetime.now().strftime('%Y%m%d_%H%M%S')}{original_ext}"
                )
                audio_file.save(original_filename)
                temp_files.append(original_filename)
                
                if not original_filename.lower().endswith('.wav'):
                    converted_filename = convert_to_wav(original_filename)
                    if converted_filename and os.path.exists(converted_filename):
                        temp_files.append(converted_filename)
                        filename = converted_filename
                    else:
                        filename = original_filename
                else:
                    filename = original_filename
                
                text = speech_to_text(audio_file_path=filename)
                    
        elif 'audio_data' in request.form:
            audio_data = request.form['audio_data']
            print("Received base64 audio data")
            
            audio_bytes = extract_audio_from_base64(audio_data)
            if not audio_bytes:
                return jsonify({'error': 'Failed to decode audio data'}), 400
                
            text = speech_to_text(audio_data=audio_bytes)
            
            if not text:
                filename = convert_webm_to_wav(audio_bytes)
                if filename and os.path.exists(filename):
                    temp_files.append(filename)
                    text = speech_to_text(audio_file_path=filename)
        else:
            return jsonify({'error': 'No audio data provided'}), 400
        
        if not text:
            return jsonify({'error': 'Could not understand audio. Please try again.'}), 400
        
        response = generate_gemini_response(text)
        
        speech_filename = text_to_speech(response)
        if speech_filename and os.path.exists(speech_filename):
            speech_url = f'/get_audio/{os.path.basename(speech_filename)}'
        else:
            speech_url = None
        
        return jsonify({
            'text': text,
            'response': response,
            'audio_url': speech_url
        })
        
    except Exception as e:
        print(f"Error processing audio: {e}")
        return jsonify({'error': 'Failed to process audio. Please try again.'}), 500
        
    finally:
        for file_path in temp_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                print(f"Error cleaning up file {file_path}: {e}")

@app.route('/text_to_speech', methods=['POST'])
def handle_text_to_speech():
    try:
        data = request.get_json()
        if not data:
            data = request.form
            
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
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
