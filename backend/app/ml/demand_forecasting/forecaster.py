import pandas as pd
import numpy as np
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
import joblib
import os
import json

class DemandForecaster:
    def __init__(self, product_name, models_dir=None):
        self.product_name = product_name
        self.model = None
        if models_dir is None:
             models_dir = os.path.join(os.path.dirname(__file__), "models")
        self.models_dir = models_dir
        os.makedirs(self.models_dir, exist_ok=True)
        self.model_path = os.path.join(self.models_dir, f"prophet_{product_name}.pkl")
        
    def train(self, df):
        print(f"Training Prophet model for {self.product_name}...")
        self.model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            seasonality_mode='multiplicative', 
            interval_width=0.95 
        )
        self.model.fit(df)
        print("Training complete.")
        
    def predict(self, days=7):
        if self.model is None:
            raise ValueError("Model not trained or loaded.")
            
        future = self.model.make_future_dataframe(periods=days)
        forecast = self.model.predict(future)
        
        last_date = self.model.history['ds'].max()
        future_forecast = forecast[forecast['ds'] > last_date].copy()
        
        results = []
        for _, row in future_forecast.iterrows():
            results.append({
                "date": row['ds'].strftime('%Y-%m-%d'),
                "forecast": round(row['yhat'], 2),
                "lower_bound": round(row['yhat_lower'], 2),
                "upper_bound": round(row['yhat_upper'], 2)
            })
            
        return results

    def evaluate(self, initial='365 days', period='30 days', horizon='7 days'):
        if self.model is None:
            raise ValueError("Model not trained.")
            
        print(f"Starting cross-validation for {self.product_name}...")
        df_cv = cross_validation(self.model, initial=initial, period=period, horizon=horizon)
        df_p = performance_metrics(df_cv)
        metrics = df_p.mean().to_dict()
        print(f"Validation Metrics: {metrics}")
        return metrics

    def save(self):
        if self.model is None:
            return
        joblib.dump(self.model, self.model_path)
        print(f"Model saved to {self.model_path}")

    def load(self):
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
            print(f"Model loaded from {self.model_path}")
            return True
        else:
            print(f"No model found at {self.model_path}")
            return False
