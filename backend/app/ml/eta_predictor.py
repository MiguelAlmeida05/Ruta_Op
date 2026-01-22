import os
import joblib
import pandas as pd
import logging
from typing import Dict, Optional, Any
from datetime import datetime
from .feature_pipeline import FeaturePipeline

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ETAPredictor:
    """
    Clase principal para realizar predicciones de ETA usando modelos de Machine Learning.
    Soporta XGBoost/LightGBM serializados con joblib.
    """
    
    def __init__(self, model_path: str = None):
        self.pipeline = FeaturePipeline()
        self.model = None
        self.model_loaded = False
        
        # Ruta por defecto
        if model_path is None:
            # En la nueva estructura, models está en app/ml/models
            base_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_dir, 'models', 'eta_xgboost_v1.pkl')
            
        self.model_path = model_path
        self._load_model()

    def _load_model(self):
        """Carga el modelo serializado si existe."""
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                self.model_loaded = True
                logger.info(f"Modelo ML cargado exitosamente desde {self.model_path}")
            except Exception as e:
                logger.error(f"Error cargando modelo ML: {e}")
                self.model_loaded = False
        else:
            logger.warning(f"No se encontró archivo de modelo en {self.model_path}. Usando modo fallback.")
            self.model_loaded = False

    def predict(self, 
                base_duration_min: float,
                distance_km: float,
                timestamp: datetime = None,
                weather_data: Dict[str, Any] = None,
                traffic_data: Dict[str, Any] = None) -> float:
        """
        Predice la duración real estimada (en minutos).
        Si el modelo no está cargado, retorna None (para usar fallback heurístico).
        """
        if not self.model_loaded:
            return None

        # Defaults
        if timestamp is None:
            timestamp = datetime.now()
        if weather_data is None:
            weather_data = {}
        if traffic_data is None:
            traffic_data = {}

        try:
            # 1. Preparar features
            features_df = self.pipeline.transform(
                timestamp=timestamp,
                distance_km=distance_km,
                base_duration_min=base_duration_min,
                weather_data=weather_data,
                traffic_data=traffic_data
            )
            
            # 2. Inferencia
            prediction = self.model.predict(features_df)
            
            # Retornar valor escalar, asegurando que sea positivo
            predicted_duration = max(float(prediction[0]), base_duration_min * 0.5)
            
            return predicted_duration
            
        except Exception as e:
            logger.error(f"Error en inferencia ML: {e}")
            return None

    def force_reload(self):
        """Fuerza la recarga del modelo (útil tras reentrenamiento)."""
        self._load_model()
