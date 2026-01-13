from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import pandas as pd
import numpy as np
import pickle

class TravelTimePredictor:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        
    def train(self, trips_data):
        """
        Trains the model on list of dictionaries (trips).
        Features: distance
        Target: time_taken
        """
        df = pd.DataFrame(trips_data)
        if df.empty:
            return "No data to train"
            
        X = df[['distance']] # simplified features
        y = df['time_taken']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        self.model.fit(X_train, y_train)
        
        y_pred = self.model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        
        return {"mae": mae, "r2": r2_score(y_test, y_pred)}

    def predict(self, distance):
        return self.model.predict([[distance]])[0]

class BayesianEstimator:
    def __init__(self, prior_mean=30, prior_var=10):
        """
        Estimates travel speed (km/h) for a segment.
        """
        self.mean = prior_mean
        self.var = prior_var
        
    def update(self, observed_speed, obs_var=5):
        """
        Updates belief based on new observation.
        """
        # Bayesian update for Gaussian with known variance (simplified)
        # posterior_precision = prior_precision + data_precision
        # posterior_mean = (prior_precision * prior_mean + data_precision * data_mean) / posterior_precision
        
        prior_prec = 1 / self.var
        obs_prec = 1 / obs_var
        
        post_prec = prior_prec + obs_prec
        self.mean = (prior_prec * self.mean + obs_prec * observed_speed) / post_prec
        self.var = 1 / post_prec
        
        return self.mean, self.var
