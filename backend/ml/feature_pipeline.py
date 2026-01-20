import pandas as pd
import numpy as np
from datetime import datetime

class FeaturePipeline:
    """
    Pipeline de procesamiento de datos para el modelo de predicción de ETA.
    Transforma datos crudos (tiempo, clima, ruta) en features numéricos para XGBoost/LightGBM.
    """
    
    def __init__(self):
        # Definición de columnas esperadas por el modelo
        self.feature_columns = [
            'hour_of_day', 'day_of_week', 'is_weekend',
            'distance_km', 'base_duration_min',
            'rain_intensity', 'traffic_level',
            'is_peak_hour', 'road_type_primary_ratio'
        ]

    def transform(self, 
                 timestamp: datetime,
                 distance_km: float,
                 base_duration_min: float,
                 weather_data: dict,
                 traffic_data: dict,
                 route_metadata: dict = None) -> pd.DataFrame:
        """
        Transforma una única instancia de datos de entrada en un DataFrame de features.
        """
        
        # 1. Factores Temporales
        hour = timestamp.hour
        day = timestamp.weekday()
        is_weekend = 1 if day >= 5 else 0
        
        # Heurística de hora pico (ejemplo: 7-9 AM y 5-7 PM)
        is_peak = 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0
        
        # 2. Factores Ambientales (Clima)
        # Asumimos que weather_data trae 'rain_mm' o similar
        rain_intensity = weather_data.get('rain_mm', 0.0)
        
        # 3. Factores de Infraestructura / Tráfico
        # traffic_data trae un nivel 0-1 o similar
        traffic_level = traffic_data.get('level', 0.0)
        
        # 4. Metadatos de Ruta
        # Ratio de carreteras principales vs secundarias
        if route_metadata:
            primary_ratio = route_metadata.get('primary_ratio', 0.5)
        else:
            primary_ratio = 0.5 # Valor por defecto
            
        # Construcción del vector
        data = {
            'hour_of_day': [hour],
            'day_of_week': [day],
            'is_weekend': [is_weekend],
            'distance_km': [distance_km],
            'base_duration_min': [base_duration_min],
            'rain_intensity': [rain_intensity],
            'traffic_level': [traffic_level],
            'is_peak_hour': [is_peak],
            'road_type_primary_ratio': [primary_ratio]
        }
        
        return pd.DataFrame(data)[self.feature_columns]

    def batch_transform(self, df_raw: pd.DataFrame) -> pd.DataFrame:
        """
        Para procesamiento en lote (entrenamiento).
        Asume que df_raw tiene las columnas crudas necesarias.
        """
        # Implementación simplificada para el ejemplo
        df = df_raw.copy()
        
        df['is_weekend'] = df['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
        df['is_peak_hour'] = df['hour_of_day'].apply(
            lambda x: 1 if (7 <= x <= 9) or (17 <= x <= 19) else 0
        )
        
        return df[self.feature_columns]
