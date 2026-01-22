import sys
import os
import time
import joblib
import pandas as pd
import numpy as np
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

# Add backend to path (Corrected path resolution)
# Goes from backend/scripts -> backend
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.ml.feature_pipeline import FeaturePipeline

def generate_synthetic_data_vectorized(n_samples=10000):
    """
    Genera datos sintéticos de manera eficiente usando operaciones vectorizadas.
    Reemplaza el bucle lento original para permitir datasets más grandes.
    """
    print(f"Generando {n_samples} muestras de datos sintéticos (Vectorizado)...")
    start_time = time.time()

    # 1. Inputs Aleatorios
    # Distancia: 1.0 a 50.0 km
    dist = np.random.uniform(1.0, 50.0, n_samples)
    # Base duration factor: 1.5 a 3.0 min/km
    base_dur_factor = np.random.uniform(1.5, 3.0, n_samples)
    base_dur = dist * base_dur_factor

    # 2. Factores de Contexto
    # Hora: 6 a 22
    hour = np.random.randint(6, 23, n_samples)
    # Día: 0 a 6
    day = np.random.randint(0, 7, n_samples)
    is_weekend = (day >= 5).astype(int)

    # 3. Clima y Tráfico
    # Lluvia: 0 (80%), 5 (15%), 20 (5%)
    rain = np.random.choice([0, 5, 20], size=n_samples, p=[0.8, 0.15, 0.05])
    # Tráfico: 0.0 a 1.0
    traffic = np.random.uniform(0, 1, n_samples)
    # Road type
    road_ratio = np.random.uniform(0.3, 0.8, n_samples)

    # 4. Cálculo del Target (Vectorizado)
    multiplier = np.ones(n_samples)

    # Efecto Hora Pico: (7-9) o (17-19) Y NO fin de semana
    is_peak_hour = ((hour >= 7) & (hour <= 9)) | ((hour >= 17) & (hour <= 19))
    # Convertir booleano a int para cálculo
    peak_effect = (is_peak_hour & (is_weekend == 0)).astype(float) * 0.4
    multiplier += peak_effect

    # Efecto Lluvia
    # Si rain > 0: 0.2 + (rain / 50.0)
    rain_effect = np.where(rain > 0, 0.2 + (rain / 50.0), 0.0)
    multiplier += rain_effect

    # Efecto Tráfico
    multiplier += traffic * 0.8

    # Ruido aleatorio (0.95 a 1.05)
    noise = np.random.uniform(0.95, 1.05, n_samples)
    
    real_duration = base_dur * multiplier * noise

    # Crear DataFrame final
    df = pd.DataFrame({
        'hour_of_day': hour,
        'day_of_week': day,
        'is_weekend': is_weekend,
        'distance_km': dist,
        'base_duration_min': base_dur,
        'rain_intensity': rain,
        'traffic_level': traffic,
        'is_peak_hour': is_peak_hour.astype(int),
        'road_type_primary_ratio': road_ratio,
        'target_duration': real_duration
    })

    elapsed = time.time() - start_time
    print(f"Generación de datos completada en {elapsed:.4f} segundos.")
    return df

def train_and_evaluate():
    # 1. Generar Datos (Aumentado de 2000 a 10000 para mejor generalización)
    df = generate_synthetic_data_vectorized(10000)
    
    # 2. Separar features y target
    pipeline = FeaturePipeline()
    X = df[pipeline.feature_columns]
    y = df['target_duration']
    
    # Validación Cruzada (Train/Test Split)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"\nEntrenando con {len(X_train)} muestras, Validando con {len(X_test)} muestras...")

    # 3. Entrenar Modelo Optimizado
    # - n_estimators: 80 (Suficiente para convergencia sin exceso de cómputo)
    # - max_depth: 4 (Controla complejidad y velocidad de inferencia)
    # - tree_method: 'hist' (Algoritmo más rápido para entrenamiento)
    model = XGBRegressor(
        n_estimators=80,
        learning_rate=0.1,
        max_depth=4,
        objective='reg:squarederror',
        n_jobs=-1,
        tree_method='hist' 
    )
    
    start_train = time.time()
    model.fit(X_train, y_train)
    train_time = time.time() - start_train
    print(f"Entrenamiento completado en {train_time:.4f} segundos.")
    
    # 4. Evaluación de Precisión
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    
    print(f"\n--- Métricas de Validación ---")
    print(f"  MAE (Error Medio Absoluto): {mae:.2f} minutos")
    print(f"  R2 Score: {r2:.4f}")
    
    # 5. Benchmarking de Inferencia (Simulación de Real-Time)
    print(f"\n--- Benchmarking de Inferencia ---")
    
    # Latencia Single-Request (Simula petición API individual)
    sample = X_test.iloc[0:1]
    start_inf = time.time()
    for _ in range(100):
        model.predict(sample)
    avg_inf = (time.time() - start_inf) / 100 * 1000 # a ms
    print(f"  Latencia Promedio (Single): {avg_inf:.3f} ms/petición")
    
    # Latencia Batch (Simula procesamiento por lotes)
    batch_size = 1000
    if len(X_test) >= batch_size:
        batch_sample = X_test.iloc[0:batch_size]
        start_batch = time.time()
        model.predict(batch_sample)
        batch_time = (time.time() - start_batch) * 1000
        print(f"  Latencia Batch ({batch_size} items): {batch_time:.3f} ms ({(batch_time/batch_size):.3f} ms/item)")
        print(f"  -> Speedup por Batching: {avg_inf / (batch_time/batch_size):.1f}x")

    # 6. Guardar Modelo
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'ml', 'models')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'eta_xgboost_v1.pkl')
    
    joblib.dump(model, output_path)
    print(f"\nModelo optimizado guardado en: {output_path}")

if __name__ == "__main__":
    train_and_evaluate()
