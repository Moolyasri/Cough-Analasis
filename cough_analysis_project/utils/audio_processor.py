import librosa
import numpy as np

def process_audio(audio_path):
    """
    Process audio file and extract relevant features for disease classification
    """
    # Load audio file
    y, sr = librosa.load(audio_path, duration=5)
    
    # Extract features
    # Mel-frequency cepstral coefficients
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfccs_scaled = np.mean(mfccs.T, axis=0)
    
    # Spectral centroid
    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
    spectral_centroids_scaled = np.mean(spectral_centroids.T, axis=0)
    
    # Root Mean Square Energy
    rms = librosa.feature.rms(y=y)
    rms_scaled = np.mean(rms.T, axis=0)
    
    # Combine features
    features = np.concatenate([mfccs_scaled, spectral_centroids_scaled, rms_scaled])
    
    return features