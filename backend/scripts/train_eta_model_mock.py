import sys
import os
import pandas as pd
import numpy as np
import joblib
from xgboost import XGBRegressor
from datetime import datetime, timedelta
import random

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.ml.feature_pipeline import FeaturePipeline

def generate_synthetic_data(n_samples=1000):
    """Genera datos sintéticos realistas para entrenamiento."""
    print(f"Generando {n_samples} muestras de datos sintéticos...")
    
    data = []
    base_time = datetime.now()
    
    for _ in range(n_samples):
        # Inputs aleatorios
        dist = random.uniform(1.0, 50.0) # 1 a 50 km
        base_dur = dist * random.uniform(1.5, 3.0) # min por km (base)
        
        # Factores de contexto
        hour = random.randint(6, 22)
        day = random.randint(0, 6)
        is_weekend = 1 if day >= 5 else 0
        
        # Clima y Tráfico
        rain = random.choices([0, 5, 20], weights=[0.8, 0.15, 0.05])[0] # mm
        traffic = random.uniform(0, 1) # 0 libre, 1 congestionado
        
        # Efecto en la duración real (Target)
        # Modelo generativo simple para crear "ground truth"
        multiplier = 1.0
        
        # Efecto hora pico
        if (7 <= hour <= 9) or (17 <= hour <= 19):
            if not is_weekend:
                multiplier += 0.4
        
        # Efecto lluvia
        if rain > 0:
            multiplier += 0.2 + (rain / 50.0)
            
        # Efecto tráfico
        multiplier += traffic * 0.8
        
        real_duration = base_dur * multiplier * random.uniform(0.95, 1.05) # ruido
        
        data.append({
            'hour_of_day': hour,
            'day_of_week': day,
            'is_weekend': is_weekend,
            'distance_km': dist,
            'base_duration_min': base_dur,
            'rain_intensity': rain,
            'traffic_level': traffic,
            'is_peak_hour': 1 if ((7 <= hour <= 9) or (17 <= hour <= 19)) else 0,
            'road_type_primary_ratio': random.uniform(0.3, 0.8),
            'target_duration': real_duration
        })
        
    return pd.DataFrame(data)

def train_model():
    # 1. Generar datos
    df = generate_synthetic_data(2000)
    
    # 2. Separar features y target
    pipeline = FeaturePipeline()
    X = df[pipeline.feature_columns]
    y = df['target_duration']
    
    print("Entrenando modelo XGBoost...")
    # 3. Entrenar
    model = XGBRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=5,
        objective='reg:squarederror',
        n_jobs=-1
    )
    model.fit(X, y)
    
    # 4. Guardar
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'app', 'ml', 'models')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'eta_xgboost_v1.pkl')
    
    joblib.dump(model, output_path)
    print(f"Modelo guardado en: {output_path}")
    
    # Validación rápida
    sample = X.iloc[0:1]
    pred = model.predict(sample)[0]
    real = y.iloc[0]
    print(f"Prueba - Predicción: {pred:.2f}, Real: {real:.2f}")

if __name__ == "__main__":
    train_model()
