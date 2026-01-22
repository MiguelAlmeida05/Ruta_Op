import os
import sys
import pandas as pd

# Add backend root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
# current_dir = backend/app/ml/demand_forecasting
app_ml_dir = os.path.dirname(current_dir)
app_dir = os.path.dirname(app_ml_dir)
backend_root = os.path.dirname(app_dir)
sys.path.append(backend_root)

from app.ml.demand_forecasting.data_generator import generate_synthetic_demand
from app.ml.demand_forecasting.forecaster import DemandForecaster

def main():
    products = ['Cacao', 'Arroz']
    
    results = {}
    
    for product in products:
        print(f"\n--- Processing {product} ---")
        
        # 1. Generate Data
        df = generate_synthetic_demand(product, days=730)
        
        # 2. Train Model
        forecaster = DemandForecaster(product)
        forecaster.train(df)
        
        # 3. Evaluate (Quick check)
        try:
            metrics = forecaster.evaluate(initial='500 days', period='30 days', horizon='7 days')
            results[product] = metrics
        except Exception as e:
            print(f"Skipping evaluation due to data constraints: {e}")
        
        # 4. Save
        forecaster.save()
        
        # 5. Predict next week
        forecast = forecaster.predict(days=7)
        print(f"Forecast for next 7 days:\n{forecast}")

    print("\n--- Summary ---")
    print(results)

if __name__ == "__main__":
    main()
