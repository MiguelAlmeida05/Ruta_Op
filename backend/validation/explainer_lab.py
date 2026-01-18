import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from explainerdashboard import RegressionExplainer, ExplainerDashboard
import joblib
import os
from data_harvester import harvest_data

def run_lab(port=8050):
    print("🧪 Iniciando Laboratorio de Explicabilidad...")
    
    # 1. Obtener Datos
    df = harvest_data(3000)
    
    # 2. Preparar Modelo Surrogate
    # Queremos explicar la 'Satisfacción Final' basándonos en las condiciones iniciales
    feature_cols = ['distance_km', 'base_duration_min', 'is_raining', 'is_traffic', 'is_strike']
    target_col = 'final_satisfaction'
    
    X = df[feature_cols]
    y = df[target_col]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("🧠 Entrenando Modelo Surrogate (Random Forest)...")
    model = RandomForestRegressor(n_estimators=50, max_depth=10).fit(X_train, y_train)
    
    # Guardar para referencia
    joblib.dump(model, 'surrogate_model.joblib')
    
    # 3. Generar Dashboard
    print("📊 Construyendo Dashboard de Explicabilidad...")
    explainer = RegressionExplainer(model, X_test, y_test, 
                                   shap='exact', # Exact calculation for RF
                                   descriptions={
                                       "distance_km": "Distancia real de ruta",
                                       "base_duration_min": "Tiempo estimado por Google/OSM",
                                       "is_raining": "Condición de Lluvia activa",
                                       "is_traffic": "Condición de Tráfico Pesado",
                                       "is_strike": "Condición de Huelga/Paro"
                                   },
                                   units={
                                       "distance_km": "km",
                                       "base_duration_min": "min",
                                       "final_satisfaction": "pts (1-5)"
                                   })
    
    db = ExplainerDashboard(explainer, 
                            title="TuDistri - Validación de IA", 
                            whatif=True, # Permite jugar con escenarios
                            shap_interaction=False)
    
    print(f"🚀 Dashboard listo en http://localhost:{port}")
    db.run(port=port)

if __name__ == "__main__":
    run_lab()
