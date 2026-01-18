import sys
import os
import pandas as pd
import numpy as np
import random

# Add backend root to path to import simulation modules
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(current_dir)
sys.path.append(backend_root)

from simulation_engine import FactorSimulator, KPICalculator, SimulationState

def harvest_data(n_samples=2000):
    """
    Genera datos sintéticos ejecutando la lógica REAL del sistema
    miles de veces. Esto crea un 'gemelo digital' de datos
    para entrenar el modelo explicativo sin tocar producción.
    """
    print(f"🌾 Cosechando {n_samples} simulaciones del sistema...")
    
    data = []
    states = list(SimulationState)
    
    for _ in range(n_samples):
        # 1. Generar Inputs Aleatorios (Escenarios posibles)
        # Forzamos distribución uniforme de estados para que el explicador
        # aprenda bien sobre casos raros (Huelga/Lluvia)
        state = random.choice(states)
        
        # Distancia entre 0.5 km y 25 km
        distance_km = random.uniform(0.5, 25.0)
        
        # Base duration (aprox 2 min por km en ciudad + varianza)
        base_duration_min = distance_km * random.uniform(1.8, 3.5)
        
        # 2. Ejecutar Lógica del Sistema (Black Box)
        # Usamos SU motor de simulación real
        factors = FactorSimulator.simulate_factors(
            state=state,
            base_duration_min=base_duration_min,
            distance_km=distance_km
        )
        
        base_metrics = {
            "duration_min": base_duration_min,
            "distance_km": distance_km
        }
        
        kpis = KPICalculator.calculate_kpis(factors, base_metrics)
        
        # 3. Estructurar Fila
        row = {
            # Features (X)
            "distance_km": distance_km,
            "base_duration_min": base_duration_min,
            "state": state.value, # Categorical
            "is_raining": 1 if state == SimulationState.RAIN else 0,
            "is_traffic": 1 if state == SimulationState.TRAFFIC else 0,
            "is_strike": 1 if state == SimulationState.STRIKE else 0,
            
            # Intermediate Factors (Para análisis profundo)
            "simulated_fuel_factor": factors["fuel_factor"],
            "simulated_degradation_rate": factors["degradation_rate"],
            
            # Targets (Y) - KPIs resultantes
            "final_satisfaction": kpis["satisfaction_score"],
            "final_punctuality": kpis["punctuality_score"],
            "final_freshness": kpis["freshness_score"],
            "final_duration": kpis["simulated_duration_min"],
            "efficiency_score": kpis["efficiency_score"]
        }
        
        data.append(row)
        
    df = pd.read_csv('simulation_dataset.csv') if os.path.exists('simulation_dataset.csv') else pd.DataFrame(data)
    if not os.path.exists('simulation_dataset.csv'):
        df.to_csv('simulation_dataset.csv', index=False)
        print(f"✅ Dataset generado: {len(df)} registros.")
    else:
        print("ℹ️ Dataset existente encontrado. Usando datos previos.")
        
    return pd.DataFrame(data)

if __name__ == "__main__":
    harvest_data()
