import streamlit as st
import osmnx as ox
import networkx as nx
import folium
from streamlit_folium import st_folium
import random
import pandas as pd
import matplotlib.pyplot as plt

from src.data_loader import DataLoader
from src.algorithms import PathFinder
from src.simulation import TrafficSimulator
from src.analysis import TravelTimePredictor, BayesianEstimator

st.set_page_config(page_title="Optimización Rutas Portoviejo", layout="wide")

@st.cache_resource
def load_data():
    loader = DataLoader()
    G = loader.load_graph()
    return G

G = load_data()
path_finder = PathFinder(G)
simulator = TrafficSimulator(G)
predictor = TravelTimePredictor()
bayesian = BayesianEstimator()

# Title and Sidebar
st.title("🚛 Optimización y Análisis de Rutas Urbanas - Portoviejo")
st.sidebar.header("Configuración de Escenario")

scenario = st.sidebar.selectbox("Escenario de Tráfico", ["Base", "Congestión Hora Pico", "Cierre de Vías"])
intensity = st.sidebar.slider("Intensidad del Evento", 0.0, 1.0, 0.5)

# Update Graph based on scenario
if f"{scenario}_{intensity}" not in st.session_state:
    if scenario == "Base":
        G_scenario = G
    elif scenario == "Congestión Hora Pico":
        G_scenario = simulator.get_scenario_graph("congestion", intensity)
    else:
        G_scenario = simulator.get_scenario_graph("closure", intensity)
    st.session_state["current_graph"] = G_scenario
else:
    G_scenario = st.session_state["current_graph"]

# Route Selection
st.header("1. Planificación de Ruta")
nodes = list(G.nodes())
col1, col2, col3 = st.columns(3)
with col1:
    if st.button("Aleatorio"):
        start_node = random.choice(nodes)
        end_node = random.choice(nodes)
        st.session_state["start"] = start_node
        st.session_state["end"] = end_node

start_node = st.session_state.get("start", nodes[0])
end_node = st.session_state.get("end", nodes[1])

with col2:
    st.write(f"Origen: {start_node}")
with col3:
    st.write(f"Destino: {end_node}")

# Algorithm Comparison
st.subheader("Comparación Algorítmica")
path_finder.G = G_scenario # Update graph in pathfinder

dijkstra_res = path_finder.run_dijkstra(start_node, end_node)
astar_res = path_finder.run_astar(start_node, end_node)

metrics_df = pd.DataFrame([dijkstra_res, astar_res])
st.table(metrics_df[["algorithm", "cost", "explored_nodes", "time_seconds"]])

# Visualization
st.subheader("Mapa Interactivo")
# Calculate center slightly better if possible, or stick to fixed
center_lat, center_lon = -1.054, -80.45
if dijkstra_res['path']:
   start_node = dijkstra_res['path'][0]
   center_lat = G_scenario.nodes[start_node]['y']
   center_lon = G_scenario.nodes[start_node]['x']

m = folium.Map(location=[center_lat, center_lon], zoom_start=14)

def plot_route(G, route, m, color, weight, opacity, name):
    if not route:
        return
    route_coords = []
    for node in route:
        point = G.nodes[node]
        route_coords.append((point['y'], point['x']))
    
    folium.PolyLine(
        route_coords, 
        color=color, 
        weight=weight, 
        opacity=opacity, 
        tooltip=name,
        popup=f"{name} (Cost: {len(route)} nodes)"
    ).add_to(m)

# Plot paths
if dijkstra_res['path']:
    plot_route(G_scenario, dijkstra_res['path'], m, 'blue', 5, 0.7, "Dijkstra")

if astar_res['path'] and astar_res['path'] != dijkstra_res['path']:
    plot_route(G_scenario, astar_res['path'], m, 'red', 3, 0.7, "A*")

st_folium(m, width=1000, height=500)

# Analytics Section
st.header("2. Analítica Avanzada")
tab1, tab2 = st.tabs(["Machine Learning (Predicción)", "Inferencia Bayesiana"])

with tab1:
    st.write("Entrenamiento y predicción de tiempos de viaje con Random Forest")
    if st.button("Entrenar Modelo con Datos Sintéticos"):
        trips = simulator.generate_synthetic_trips(200)
        res = predictor.train(trips)
        st.success(f"Modelo entrenado. MAE: {res['mae']:.2f}, R2: {res['r2']:.2f}")
        
    dist_input = st.number_input("Distancia de viaje (m)", value=1000.0)
    if st.button("Predecir Tiempo"):
        pred_time = predictor.predict(dist_input)
        st.info(f"Tiempo estimado: {pred_time:.2f} segundos")

with tab2:
    st.write("Actualización Bayesiana de Velocidad Promedio en Vía")
    obs_speed = st.slider("Velocidad observada (km/h)", 0, 100, 30)
    if st.button("Actualizar Creencia"):
        post_mean, post_var = bayesian.update(obs_speed)
        st.metric("Nueva Media Estimada", f"{post_mean:.2f} km/h")
        st.metric("Incertidumbre (Varianza)", f"{post_var:.2f}")

st.info("Sistema académico desarrollado para la ciudad de Portoviejo.")
