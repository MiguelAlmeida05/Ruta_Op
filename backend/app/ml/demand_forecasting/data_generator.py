import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_synthetic_demand(product_name, start_date='2024-01-01', days=730):
    """
    Generates synthetic daily demand data for a product with seasonality and trend.
    """
    dates = pd.date_range(start=start_date, periods=days)
    df = pd.DataFrame({'ds': dates})
    
    # Base params based on product
    if product_name.lower() == 'cacao':
        base_demand = 500
        trend_slope = 0.1
        yearly_seasonality_amp = 100 
        weekly_seasonality_amp = 20  
        noise_level = 30
    elif product_name.lower() == 'arroz':
        base_demand = 1200
        trend_slope = 0.05
        yearly_seasonality_amp = 50
        weekly_seasonality_amp = 150 
        noise_level = 50
    else:
        base_demand = 100
        trend_slope = 0
        yearly_seasonality_amp = 10
        weekly_seasonality_amp = 5
        noise_level = 10

    # Trend
    t = np.arange(days)
    trend = base_demand + (trend_slope * t)
    
    # Yearly Seasonality
    yearly = yearly_seasonality_amp * np.sin(2 * np.pi * t / 365.25)
    
    # Weekly Seasonality
    day_of_week = df['ds'].dt.dayofweek
    weekly = np.where(day_of_week >= 4, weekly_seasonality_amp, -weekly_seasonality_amp/2)
    
    # Noise
    noise = np.random.normal(0, noise_level, days)
    
    # Combine
    y = trend + yearly + weekly + noise
    
    # Ensure no negative demand
    df['y'] = np.maximum(0, y).astype(int)
    
    # Add product identifier
    df['product'] = product_name
    
    return df
