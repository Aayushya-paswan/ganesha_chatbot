
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let silenceTimer;
let isRecording = false;
let stream;
let voiceDetectionRAF;

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION = 2000;
const CHECK_INTERVAL = 150;
const ENERGY_THRESHOLD = 5;
const SMOOTHING_FACTOR = 0.8;

let talkButton = null;
let statusElement = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing voice recorder');

    talkButton = document.getElementById('talk');

    if (talkButton) {
        console.log('Talk button found');
        talkButton.addEventListener('click', toggleRecording);
        updateButtonState(false);
    } else {
        console.error('Button with id "talk" not found!');
        return;
    }

    statusElement = document.getElementById('status');

    if (!checkBrowserCompatibility()) {
        return;
    }

    console.log('Voice recorder initialized - 2 second silence detection enabled');
});

function checkBrowserCompatibility() {
    const required = [
        { check: () => navigator.mediaDevices, name: 'MediaDevices API' },
        { check: () => navigator.mediaDevices.getUserMedia, name: 'getUserMedia' },
        { check: () => window.MediaRecorder, name: 'MediaRecorder API' },
        { check: () => window.AudioContext || window.webkitAudioContext, name: 'Web Audio API' }
    ];

    const missing = required.filter(item => !item.check());

    if (missing.length > 0) {
        const errorMsg = 'Missing browser features: ' + missing.map(item => item.name).join(', ');
        console.error(errorMsg);
        updateStatus('❌ Browser not supported', 'error');
        return false;
    }

    return true;
}

async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    try {
        console.log('Starting recording...');

        audioChunks = [];
        clearVoiceActivityDetection();

        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100,
                channelCount: 1
            }
        });

        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 64000 }
            : { audioBitsPerSecond: 64000 };

        mediaRecorder = new MediaRecorder(stream, options);

        setupOptimizedVAD();
        setupMediaRecorderEvents();

        mediaRecorder.start();
        isRecording = true;

        console.log('Recording started');

        updateButtonState(true);
        updateStatus('🔴 Recording... (auto-stop after 2sec silence)', 'recording');

        startOptimizedVoiceDetection();

    } catch (error) {
        console.error('Recording start error:', error);
        handleRecordingError(error);
    }
}

function setupOptimizedVAD() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = SMOOTHING_FACTOR;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    source.connect(analyser);
    console.log('VAD setup complete');
}

function setupMediaRecorderEvents() {
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        console.log('Recording stopped');
        await handleRecordingStop();
    };

    mediaRecorder.onerror = event => {
        console.error('MediaRecorder error:', event.error);
        updateStatus('❌ Recording error', 'error');
    };
}

function startOptimizedVoiceDetection() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastSoundTime = Date.now();
    let frameCount = 0;

    function detectVoiceActivity() {
        if (!isRecording || !analyser) {
            return;
        }

        frameCount++;

        if (frameCount % Math.floor(CHECK_INTERVAL / 16.67) !== 0) {
            voiceDetectionRAF = requestAnimationFrame(detectVoiceActivity);
            return;
        }

        try {
            analyser.getByteFrequencyData(dataArray);

            let energy = 0;
            const relevantBins = Math.floor(bufferLength * 0.6);

            for (let i = 0; i < relevantBins; i++) {
                energy += dataArray[i];
            }

            const avgEnergy = energy / relevantBins;
            const currentTime = Date.now();

            if (avgEnergy > ENERGY_THRESHOLD) {
                lastSoundTime = currentTime;

                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                }
            } else {
                const silenceDuration = currentTime - lastSoundTime;

                if (silenceDuration >= SILENCE_DURATION && !silenceTimer) {
                    console.log('2 seconds of silence detected - stopping recording');
                    updateStatus('⏹️ Silence detected - stopping...', 'stopping');

                    silenceTimer = setTimeout(() => {
                        stopRecording();
                    }, 50);
                    return;
                }
            }

            voiceDetectionRAF = requestAnimationFrame(detectVoiceActivity);

        } catch (error) {
            console.error('VAD error:', error);
            voiceDetectionRAF = requestAnimationFrame(detectVoiceActivity);
        }
    }

    voiceDetectionRAF = requestAnimationFrame(detectVoiceActivity);
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

async function handleRecordingStop() {
    isRecording = false;

    clearVoiceActivityDetection();

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
    }

    if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, {
            type: mediaRecorder.mimeType || 'audio/webm'
        });
        audioChunks = [];

        console.log('Audio blob created:', audioBlob.size, 'bytes');

        // Send to Flask backend for processing
        await sendToFlask(audioBlob);
    }

    updateButtonState(false);
    updateStatus('✅ Recording completed', 'success');
}

function clearVoiceActivityDetection() {
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }

    if (voiceDetectionRAF) {
        cancelAnimationFrame(voiceDetectionRAF);
        voiceDetectionRAF = null;
    }
}

// Enhanced Flask integration function
async function sendToFlask(audioBlob) {
    try {
        updateStatus('📤 Sending to Flask server...', 'processing');

        const formData = new FormData();
        const timestamp = Date.now();
        const filename = `recording_${timestamp}.webm`;

        // Add audio file
        formData.append('audio_file', audioBlob, filename);

        // Add metadata
        formData.append('timestamp', timestamp.toString());
        formData.append('size', audioBlob.size.toString());
        formData.append('duration', '2'); // approximate

        console.log('Sending audio to Flask:', {
            filename: filename,
            size: audioBlob.size,
            type: audioBlob.type
        });

        const response = await fetch('/upload_audio', {
            method: 'POST',
            body: formData,
            headers: {
                // Don't set Content-Type header, let browser set it with boundary for FormData
            }
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Flask response:', result);

            updateStatus(`✅ Sent to Flask: ${result.message || 'Processing started'}`, 'success');

            // Handle Flask response data
            if (result.transcription) {
                displayTranscription(result.transcription);
            }

            if (result.analysis) {
                displayAnalysis(result.analysis);
            }

            // If Flask returns processed audio or other data
            if (result.processed_audio_url) {
                createProcessedAudioPlayer(result.processed_audio_url);
            }

            return true;

        } else {
            const errorText = await response.text();
            console.error('Flask server error:', response.status, errorText);
            updateStatus(`❌ Flask error: ${response.status}`, 'error');

            // Fallback to local playback
            createAudioPlayback(audioBlob);
            return false;
        }

    } catch (error) {
        console.error('Error sending to Flask:', error);
        updateStatus('❌ Flask server unavailable', 'error');

        // Fallback to local playback
        createAudioPlayback(audioBlob);
        return false;
    }
}

// Display transcription from Flask
function displayTranscription(transcription) {
    let transcriptDiv = document.getElementById('transcription');

    if (!transcriptDiv) {
        transcriptDiv = document.createElement('div');
        transcriptDiv.id = 'transcription';
        transcriptDiv.style.cssText = `
            margin: 20px auto;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            border-radius: 5px;
            max-width: 500px;
        `;

        if (talkButton && talkButton.parentNode) {
            talkButton.parentNode.appendChild(transcriptDiv);
        }
    }

    transcriptDiv.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #333;">Transcription:</h4>
        <p style="margin: 0; line-height: 1.4;">${transcription}</p>
    `;
}

// Display analysis from Flask
function displayAnalysis(analysis) {
    let analysisDiv = document.getElementById('analysis');

    if (!analysisDiv) {
        analysisDiv = document.createElement('div');
        analysisDiv.id = 'analysis';
        analysisDiv.style.cssText = `
            margin: 20px auto;
            padding: 15px;
            background: #f1f8e9;
            border-left: 4px solid #4caf50;
            border-radius: 5px;
            max-width: 500px;
        `;

        if (talkButton && talkButton.parentNode) {
            talkButton.parentNode.appendChild(analysisDiv);
        }
    }

    analysisDiv.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #333;">Analysis:</h4>
        <pre style="margin: 0; white-space: pre-wrap; font-family: monospace; font-size: 12px;">${JSON.stringify(analysis, null, 2)}</pre>
    `;
}

// Create player for processed audio from Flask
function createProcessedAudioPlayer(audioUrl) {
    const existingProcessed = document.querySelectorAll('.processed-audio');
    existingProcessed.forEach(element => element.remove());

    const audioPlayer = document.createElement('audio');
    audioPlayer.controls = true;
    audioPlayer.src = audioUrl;
    audioPlayer.className = 'processed-audio';
    audioPlayer.style.cssText = `
        display: block;
        margin: 15px auto;
        max-width: 300px;
        border-radius: 5px;
        border: 2px solid #4caf50;
    `;

    const label = document.createElement('p');
    label.textContent = 'Processed Audio from Flask:';
    label.style.cssText = `
        text-align: center;
        margin: 10px 0 5px 0;
        font-weight: bold;
        color: #4caf50;
    `;

    if (talkButton && talkButton.parentNode) {
        talkButton.parentNode.appendChild(label);
        talkButton.parentNode.appendChild(audioPlayer);
    }
}

// Fallback local playback
function createAudioPlayback(audioBlob) {
    const audioURL = URL.createObjectURL(audioBlob);

    const existingAudio = document.querySelectorAll('.voice-recording');
    existingAudio.forEach(element => {
        URL.revokeObjectURL(element.src);
        element.remove();
    });

    const audioPlayer = document.createElement('audio');
    audioPlayer.controls = true;
    audioPlayer.src = audioURL;
    audioPlayer.className = 'voice-recording';
    audioPlayer.style.cssText = `
        display: block;
        margin: 15px auto;
        max-width: 300px;
        border-radius: 5px;
    `;

    if (talkButton && talkButton.parentNode) {
        talkButton.parentNode.insertBefore(audioPlayer, talkButton.nextSibling);
    }

    console.log('Local audio playback created');
}

function updateButtonState(recording) {
    if (!talkButton) return;

    if (recording) {
        talkButton.textContent = '⏹️ Stop Recording';
        talkButton.style.backgroundColor = '#ff4444';
        talkButton.style.color = 'white';
    } else {
        talkButton.textContent = '🎙️ Start Recording';
        talkButton.style.backgroundColor = '#44ff44';
        talkButton.style.color = 'white';
    }

    talkButton.style.cssText += `
        padding: 12px 24px;
        font-size: 16px;
        font-weight: bold;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    `;
}

function updateStatus(message, type = 'info') {
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status status-${type}`;

        // Add status-specific styling
        const colors = {
            recording: { bg: '#ffebee', color: '#c62828', border: '#ffcdd2' },
            success: { bg: '#e8f5e8', color: '#2e7d32', border: '#c8e6c9' },
            error: { bg: '#ffebee', color: '#d32f2f', border: '#ffcdd2' },
            processing: { bg: '#fff3e0', color: '#ef6c00', border: '#ffe0b2' },
            stopping: { bg: '#f3e5f5', color: '#7b1fa2', border: '#e1bee7' }
        };

        const style = colors[type] || { bg: '#f5f5f5', color: '#333', border: '#ddd' };

        statusElement.style.cssText = `
            margin: 15px auto;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            font-weight: bold;
            max-width: 400px;
            background-color: ${style.bg};
            color: ${style.color};
            border: 2px solid ${style.border};
            transition: all 0.3s ease;
        `;
    } else {
        console.log(`Status: ${message}`);
    }
}

function handleRecordingError(error) {
    let errorMessage = 'Microphone error: ';

    switch(error.name) {
        case 'NotAllowedError':
            errorMessage += 'Permission denied';
            break;
        case 'NotFoundError':
            errorMessage += 'No microphone found';
            break;
        case 'NotSupportedError':
            errorMessage += 'Browser not supported';
            break;
        default:
            errorMessage += error.message;
    }

    updateStatus('❌ ' + errorMessage, 'error');
    updateButtonState(false);

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
}

window.addEventListener('beforeunload', () => {
    if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }

    clearVoiceActivityDetection();
});

console.log('Optimized Voice Recorder with Flask integration loaded');
