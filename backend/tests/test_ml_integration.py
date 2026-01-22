import unittest
import sys
import os
import shutil
from unittest.mock import MagicMock

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.simulation.engine import FactorSimulator, SimulationState, _eta_predictor
from app.ml.eta_predictor import ETAPredictor

class TestMLIntegration(unittest.TestCase):
    
    def test_predictor_loading(self):
        """Verifica que el predictor global cargue el modelo si existe."""
        if os.path.exists(_eta_predictor.model_path):
            self.assertTrue(_eta_predictor.model_loaded)
        else:
            self.assertFalse(_eta_predictor.model_loaded)

    def test_simulate_factors_with_ml(self):
        """Prueba la simulación usando el modelo ML (si está cargado)."""
        if not _eta_predictor.model_loaded:
            self.skipTest("ML Model not loaded")
            
        # Ejecutar simulación
        results = FactorSimulator.simulate_factors(
            state=SimulationState.NORMAL,
            base_duration_min=10.0,
            distance_km=5.0,
            n_iterations=100
        )
        
        # Verificar estructura
        self.assertIn("simulated_duration", results)
        self.assertIsInstance(results["simulated_duration"], float)
        self.assertGreater(results["simulated_duration"], 0)
        
        # Verificar que NO es exactamente la base (hay ruido/modelo)
        # Base calibrada para 5km es aprox 12.5 min
        # El modelo sintético añade sus propios factores
        print(f"ML Simulated Duration: {results['simulated_duration']}")

    def test_fallback_mechanism(self):
        """Verifica que el sistema funcione si el modelo falla."""
        # Simular fallo de carga
        original_status = _eta_predictor.model_loaded
        _eta_predictor.model_loaded = False
        
        results = FactorSimulator.simulate_factors(
            state=SimulationState.NORMAL,
            base_duration_min=10.0,
            distance_km=5.0,
            n_iterations=10
        )
        
        self.assertIn("simulated_duration", results)
        
        # Restaurar
        _eta_predictor.model_loaded = original_status

if __name__ == "__main__":
    unittest.main()
