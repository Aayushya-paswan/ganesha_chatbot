
// ==================================================
// OPTIMIZED VOICE ACTIVITY DETECTION AUDIO RECORDER
// No dynamic button creation, 2-second silence detection
// ==================================================

let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let silenceTimer;
let isRecording = false;
let stream;
let voiceDetectionRAF;

// ==========================================
// OPTIMIZED CONFIGURATION SETTINGS
// ==========================================
const SILENCE_THRESHOLD = 0.01;       // RMS threshold for detecting silence (more efficient)
const SILENCE_DURATION = 2000;        // Duration of silence in milliseconds (2 seconds)
const CHECK_INTERVAL = 150;           // Optimized check interval (less CPU intensive)
const ENERGY_THRESHOLD = 5;           // Minimum energy level to consider as voice
const SMOOTHING_FACTOR = 0.8;         // Smoothing for analyser

// ==========================================
// CACHED DOM ELEMENTS
// ==========================================
let talkButton = null;
let statusElement = null;

// ==========================================
// DOM READY EVENT LISTENER
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing optimized voice recorder');

    // Cache the talk button reference
    talkButton = document.getaElementById('talk');

    if (talkButton) {
        console.log('Talk button found - attaching event listener');
        talkButton.addEventListener('click', toggleRecording);

        // Set initial button state
        updateButtonState(false);
    } else {
        console.error('Button with id "talk" not found!');
        return;
    }

    // Cache status element if it exists
    statusElement = document.getElementById('status');

    // Check browser compatibility
    if (!checkBrowserCompatibility()) {
        return;
    }

    console.log('Voice recorder initialized - 2 second silence detection enabled');
});

// ==========================================
// OPTIMIZED BROWSER COMPATIBILITY CHECK
// ==========================================
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

// ==========================================
// MAIN RECORDING TOGGLE FUNCTION
// ==========================================
async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

// ==========================================
// OPTIMIZED START RECORDING FUNCTION
// ==========================================
async function startRecording() {
    try {
        console.log('Starting recording...');

        // Reset state
        audioChunks = [];
        clearVoiceActivityDetection();

        // Get optimized audio stream
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100,
                channelCount: 1  // Mono for efficiency
            } 
        });

        // Create MediaRecorder with efficient settings
        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
            ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 64000 }
            : { audioBitsPerSecond: 64000 };

        mediaRecorder = new MediaRecorder(stream, options);

        // Set up optimized voice activity detection
        setupOptimizedVAD();

        // Set up MediaRecorder events
        setupMediaRecorderEvents();

        // Start recording
        mediaRecorder.start();
        isRecording = true;

        console.log('Recording started - will auto-stop after 2 seconds of silence');

        // Update UI efficiently
        updateButtonState(true);
        updateStatus('🔴 Recording... (auto-stop after 2sec silence)', 'recording');

        // Start optimized voice detection
        startOptimizedVoiceDetection();

    } catch (error) {
        console.error('Recording start error:', error);
        handleRecordingError(error);
    }
}

// OPTIMIZED VOICE ACTIVITY DETECTION SETUP
function setupOptimizedVAD() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();

    // Optimized analyser settings
    analyser.fftSize = 1024;  // Smaller FFT for better performance
    analyser.smoothingTimeConstant = SMOOTHING_FACTOR;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    source.connect(analyser);

    console.log('Optimized VAD setup complete');
}

// OPTIMIZED MEDIARECORDER EVENTS
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

// HIGHLY OPTIMIZED VOICE DETECTION
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

        // Skip frames for efficiency (check every 150ms instead of every frame)
        if (frameCount % Math.floor(CHECK_INTERVAL / 16.67) !== 0) {
            voiceDetectionRAF = requestAnimationFrame(detectVoiceActivity);
            return;
        }

        try {
            // Get frequency data efficiently
            analyser.getByteFrequencyData(dataArray);

            // Calculate energy efficiently using only relevant frequency bins
            let energy = 0;
            const relevantBins = Math.floor(bufferLength * 0.6); // Focus on speech frequencies

            for (let i = 0; i < relevantBins; i++) {
                energy += dataArray[i];
            }

            const avgEnergy = energy / relevantBins;
            const currentTime = Date.now();

            if (avgEnergy > ENERGY_THRESHOLD) {
                // Voice detected
                lastSoundTime = currentTime;

                // Clear any pending silence timer
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                }
            } else {
                // Check for silence duration
                const silenceDuration = currentTime - lastSoundTime;

                if (silenceDuration >= SILENCE_DURATION && !silenceTimer) {
                    console.log('2 seconds of silence detected - stopping recording');
                    updateStatus('⏹️ Silence detected - stopping...', 'stopping');

                    // Stop recording after brief delay
                    silenceTimer = setTimeout(() => {
                        stopRecording();
                    }, 50);
                    return;
                }
            }

            // Continue detection
            voiceDetectionRAF = requestAnimationFrame(detectVoiceActivity);

        } catch (error) {
            console.error('VAD error:', error);
            voiceDetectionRAF = requestAnimationFrame(detectVoiceActivity);
        }
    }

    // Start detection loop
    voiceDetectionRAF = requestAnimationFrame(detectVoiceActivity);
}

// STOP RECORDING FUNCTION
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

// HANDLE RECORDING STOP
async function handleRecordingStop() {
    isRecording = false;

    // Clear voice detection
    clearVoiceActivityDetection();

    // Clean up resources
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
    }

    // Process audio
    if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { 
            type: mediaRecorder.mimeType || 'audio/webm' 
        });
        audioChunks = [];

        console.log('Audio blob created:', audioBlob.size, 'bytes');

        // Handle recorded audio
        await handleRecordedAudio(audioBlob);
    }

    // Update UI
    updateButtonState(false);
    updateStatus('✅ Recording completed', 'success');
}

// CLEAR VOICE ACTIVITY DETECTION
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

// HANDLE RECORDED AUDIO
async function handleRecordedAudio(audioBlob) {
    try {
        // Try server upload first
        const uploadSuccess = await uploadAudioToServer(audioBlob);

        if (!uploadSuccess) {
            // Create local playback if upload fails
            createAudioPlayback(audioBlob);
        }

    } catch (error) {
        console.error('Audio handling error:', error);
        createAudioPlayback(audioBlob);
    }
}

// OPTIMIZED SERVER UPLOAD
async function uploadAudioToServer(audioBlob) {
    try {
        const formData = new FormData();
        const timestamp = Date.now();
        const filename = `recording_${timestamp}.webm`;

        formData.append('audio_file', audioBlob, filename);

        const response = await fetch('/upload_audio', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Upload successful:', result);
            updateStatus('✅ Uploaded: ' + result.filename, 'success');
            return true;
        }

        return false;

    } catch (error) {
        console.log('Server not available, creating local playback');
        return false;
    }
}

// CREATE AUDIO PLAYBACK (NO NEW BUTTONS)
function createAudioPlayback(audioBlob) {
    const audioURL = URL.createObjectURL(audioBlob);

    // Remove existing audio elements
    const existingAudio = document.querySelectorAll('.voice-recording');
    existingAudio.forEach(element => {
        URL.revokeObjectURL(element.src);
        element.remove();
    });

    // Create minimal audio player (no buttons)
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

    // Add after the existing talk button (don't create new buttons)
    if (talkButton && talkButton.parentNode) {
        talkButton.parentNode.insertBefore(audioPlayer, talkButton.nextSibling);
    }

    console.log('Audio playback created');
}

// EFFICIENT UI UPDATES (NO DYNAMIC BUTTON CREATION)
function updateButtonState(recording) {
    if (!talkButton) return;

    // Only update existing button, never create new ones
    if (recording) {
        talkButton.textContent = '⏹️ Stop Recording';
        talkButton.style.backgroundColor = '#ff4444';
        talkButton.style.color = 'white';
    } else {
        talkButton.textContent = '🎙️ Start Recording';
        talkButton.style.backgroundColor = '#44ff44';
        talkButton.style.color = 'white';
    }

    // Apply consistent styling
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
    // Only update if status element exists, don't create new ones
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status status-${type}`;
    } else {
        // Just log to console if no status element
        console.log(`Status: ${message}`);
    }
}

// ERROR HANDLING
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

    // Clean up
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
}
// CLEANUP ON PAGE UNLOAD
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

console.log('Optimized Voice Recorder loaded - 2 second silence detection, no dynamic buttons');
