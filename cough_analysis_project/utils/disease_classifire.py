from flask import Flask, render_template, request, jsonify
import os
import numpy as np
import hashlib
import json
from datetime import datetime
from pydub import AudioSegment

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'input/recordings'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'webm'}
PREDICTIONS_FILE = 'predictions_history.json'

DISEASE_DATABASE = {
    'COVID-19': {
        'symptoms': [
            'Dry cough', 'Fever', 'Loss of taste/smell',
            'Fatigue', 'Shortness of breath', 'Body aches'
        ],
        'recommendations': [
            'Isolate immediately', 'Monitor oxygen levels', 
            'Stay hydrated', 'Take rest', 
            'Consult doctor'
        ],
        'severity': 'High',
        'contagious': True,
        'recovery_time': '10-14 days'
    },
    'Pneumonia': {
        'symptoms': [
            'Wet cough with mucus', 'High fever',
            'Difficulty breathing', 'Chest pain',
            'Rapid breathing', 'Night sweats'
        ],
        'recommendations': [
            'Seek medical attention', 'Complete antibiotics',
            'Breathing exercises', 'Rest',
            'Stay hydrated'
        ],
        'severity': 'High',
        'contagious': False,
        'recovery_time': '1-3 weeks'
    },
    'Bronchitis': {
        'symptoms': [
            'Persistent wet cough', 'Wheezing',
            'Chest tightness', 'Low fever',
            'Sore throat', 'Fatigue'
        ],
        'recommendations': [
            'Use humidifier', 'Drink warm fluids',
            'Rest', 'Avoid irritants',
            'Over-the-counter meds'
        ],
        'severity': 'Moderate',
        'contagious': True,
        'recovery_time': '7-10 days'
    },
    'Common Cold': {
        'symptoms': [
            'Mild cough', 'Runny nose',
            'Sneezing', 'Sore throat',
            'Slight fatigue', 'Mild body aches'
        ],
        'recommendations': [
            'Rest', 'Stay hydrated',
            'Over-the-counter meds', 'Salt water gargle',
            'Nasal decongestants'
        ],
        'severity': 'Low',
        'contagious': True,
        'recovery_time': '7-10 days'
    },
    'Healthy': {
        'symptoms': [
            'Normal breathing', 'No cough',
            'Normal energy', 'No fever',
            'No distress'
        ],
        'recommendations': [
            'Good hygiene', 'Regular exercise',
            'Balanced diet', 'Adequate sleep',
            'Regular checkups'
        ],
        'severity': 'None',
        'contagious': False,
        'recovery_time': 'N/A'
    }
}

class MockDiseaseClassifier:
    def __init__(self):
        self.diseases = list(DISEASE_DATABASE.keys())

    def predict(self, audio_path):
        # Generate random probabilities
        probs = np.random.random(len(self.diseases))
        probs = probs / np.sum(probs)  # Normalize to sum to 1
        
        # Get the highest probability disease
        predicted_class = np.argmax(probs)
        
        return {
            'disease': self.diseases[predicted_class],
            'confidence': float(probs[predicted_class]),
            'all_probabilities': {
                disease: float(prob) 
                for disease, prob in zip(self.diseases, probs)
            }
        }

classifier = MockDiseaseClassifier()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_predictions_history():
    if os.path.exists(PREDICTIONS_FILE):
        with open(PREDICTIONS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_prediction(audio_hash, prediction):
    history = load_predictions_history()
    history[audio_hash] = prediction
    with open(PREDICTIONS_FILE, 'w') as f:
        json.dump(history, f)

def get_audio_hash(audio_data):
    return hashlib.md5(audio_data).hexdigest()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        # Create unique filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        original_filename = file.filename
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'webm'
        new_filename = f"recording_{timestamp}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)
        
        # Save the original file
        file.save(filepath)
        
        # Get hash for the saved file
        with open(filepath, 'rb') as f:
            audio_hash = get_audio_hash(f.read())
        
        # Check for existing prediction
        predictions_history = load_predictions_history()
        if audio_hash in predictions_history:
            return jsonify({
                'prediction': predictions_history[audio_hash],
                'note': 'Previously analyzed audio'
            })
        
        # Get random prediction
        prediction = classifier.predict(filepath)
        disease = prediction['disease']
        
        # Add additional information
        prediction.update({
            'disease_info': DISEASE_DATABASE[disease],
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'analysis_details': {
                'cough_intensity': f"{np.random.randint(60, 100)}%",
                'cough_frequency': f"{np.random.randint(1, 10)} per minute",
                'cough_type': np.random.choice(['Dry', 'Wet', 'Mixed'])
            },
            'file_info': {
                'filename': new_filename,
                'original_name': original_filename
            }
        })
        
        # Save prediction
        save_prediction(audio_hash, prediction)
        
        return jsonify({
            'prediction': prediction,
            'note': 'New audio analysis'
        })
        
    except Exception as e:
        print(f"Error processing upload: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True)