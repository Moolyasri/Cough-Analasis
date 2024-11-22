let mediaRecorder;
let audioChunks = [];
let timerInterval;
let startTime;

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    setupEventListeners();
    checkMicrophonePermission();
}

function setupEventListeners() {
    document.getElementById('startRecord').addEventListener('click', startRecording);
    document.getElementById('stopRecord').addEventListener('click', stopRecording);
    document.getElementById('uploadBtn').addEventListener('click', handleFileUpload);
    document.getElementById('audioFile').addEventListener('change', handleFileSelection);
}

async function checkMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        showMessage('Microphone access granted', 'success');
    } catch (err) {
        showMessage('Microphone access denied. Please enable microphone access.', 'error');
        document.getElementById('startRecord').disabled = true;
    }
}

function startTimer() {
    startTime = Date.now();
    const timerDisplay = document.getElementById('timer');
    timerDisplay.classList.remove('hidden');
    
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const seconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(seconds / 60);
        timerDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    document.getElementById('timer').classList.add('hidden');
}

async function startRecording() {
    try {
        audioChunks = [];
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: false,
            noiseSuppression: true,
            echoCancellation: true
        });
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm',
            audioBitsPerSecond: 128000
        });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            uploadAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start(100); // Collect data every 100ms
        startTimer();
        updateUIForRecording(true);
        showMessage('Recording started...', 'success');
        
        setTimeout(() => {
            if (mediaRecorder?.state === 'recording') {
                stopRecording();
            }
        }, 10000);

    } catch (err) {
        console.error('Error accessing microphone:', err);
        showMessage('Error accessing microphone. Please check permissions.', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
        stopTimer();
        updateUIForRecording(false);
        showMessage('Processing recording...', 'success');
    }
}

function updateUIForRecording(isRecording) {
    document.getElementById('startRecord').disabled = isRecording;
    document.getElementById('stopRecord').disabled = !isRecording;
    document.getElementById('uploadBtn').disabled = isRecording;
    document.getElementById('audioFile').disabled = isRecording;
    
    if (isRecording) {
        document.getElementById('timer').classList.remove('hidden');
    } else {
        document.getElementById('timer').classList.add('hidden');
    }
}

function handleFileSelection(event) {
    const file = event.target.files[0];
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = !file;
    
    if (file) {
        showMessage(`File selected: ${file.name}`, 'success');
    }
}

function handleFileUpload() {
    const fileInput = document.getElementById('audioFile');
    if (fileInput.files[0]) {
        uploadAudio(fileInput.files[0]);
    } else {
        showMessage('Please select an audio file first.', 'error');
    }
}

function uploadAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    
    showMessage('Uploading and analyzing audio...', 'success');
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(handleResponse)
    .then(handleData)
    .catch(handleError);
}

function handleResponse(response) {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

function handleData(data) {
    if (data.error) {
        throw new Error(data.error);
    }
    displayResults(data.prediction);
    showMessage('Analysis complete!', 'success');
}

function handleError(error) {
    console.error('Error:', error);
    showMessage(`Error: ${error.message}`, 'error');
}

function displayResults(prediction) {
    const resultDiv = document.getElementById('result');
    resultDiv.classList.remove('hidden');
    
    resultDiv.innerHTML = `
        <h2>Analysis Result</h2>
        <div class="result-content">
            <div class="primary-result">
                <h3>Primary Diagnosis</h3>
                <p class="disease-name">${prediction.disease}</p>
                <p class="confidence">Confidence: ${(prediction.confidence * 100).toFixed(2)}%</p>
                <p class="timestamp">Analyzed: ${prediction.timestamp}</p>
            </div>
            
            <div class="disease-details">
                <h3>Disease Information</h3>
                <p class="severity">Severity: ${prediction.disease_info.severity}</p>
                <p class="contagious">Contagious: ${prediction.disease_info.contagious ? 'Yes' : 'No'}</p>
                <p class="recovery">Expected Recovery: ${prediction.disease_info.recovery_time}</p>
            </div>

            <div class="symptoms">
                <h3>Common Symptoms</h3>
                <ul>
                    ${prediction.disease_info.symptoms.map(symptom => 
                        `<li>${symptom}</li>`
                    ).join('')}
                </ul>
            </div>

            <div class="recommendations">
                <h3>Recommendations</h3>
                <ul>
                    ${prediction.disease_info.recommendations.map(rec => 
                        `<li>${rec}</li>`
                    ).join('')}
                </ul>
            </div>

            <div class="analysis-details">
                <h3>Cough Analysis</h3>
                <div class="analysis-grid">
                    <p>Intensity: ${prediction.analysis_details.cough_intensity}</p>
                    <p>Frequency: ${prediction.analysis_details.cough_frequency}</p>
                    <p>Type: ${prediction.analysis_details.cough_type}</p>
                </div>
            </div>

            <div class="other-probabilities">
                <h3>Other Possibilities</h3>
                <div class="probability-bars">
                    ${Object.entries(prediction.all_probabilities)
                        .sort((a, b) => b[1] - a[1])
                        .map(([disease, prob]) => `
                            <div class="prob-item">
                                <span class="disease-label">${disease}</span>
                                <div class="prob-bar-container">
                                    <div class="prob-bar" style="width: ${(prob * 100).toFixed(2)}%"></div>
                                    <span class="prob-value">${(prob * 100).toFixed(2)}%</span>
                                </div>
                            </div>
                        `).join('')}
                </div>
            </div>
        </div>
    `;

    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = message;
    
    const container = document.querySelector('.container');
    const existingMessage = container.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    container.insertBefore(messageDiv, container.firstChild);
    
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(() => messageDiv.remove(), 500);
    }, 5000);
}