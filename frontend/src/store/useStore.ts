import { create } from 'zustand';
import { Metrics, POI, Seller, RouteResult } from '../types';

interface AppState {
  // User/Session
  role: 'client' | 'distributor' | 'admin';
  userLocation: [number, number] | null;
  
  // Data
  sellers: Seller[];
  routes: RouteResult[];
  pois: POI[];
  globalMetrics: Metrics | null;
  
  // Selection
  selectedRouteId: string | null;
  weight: number;
  
  // UI State
  showSupplyChain: boolean;
  showMetrics: boolean;
  
  // Simulation
  isSimulating: boolean;
  simulationProgress: number;
  simulationFinished: boolean;
  
  // Notifications
  notifications: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  removeNotification: (id: string) => void;

  // Actions
  setRole: (role: 'client' | 'distributor' | 'admin') => void;
  setUserLocation: (location: [number, number] | null) => void;
  setSellers: (sellers: Seller[]) => void;
  setRoutes: (routes: RouteResult[]) => void;
  setPois: (pois: POI[]) => void;
  setGlobalMetrics: (metrics: Metrics | null) => void;
  setSelectedRouteId: (id: string | null) => void;
  setWeight: (weight: number) => void;
  setShowSupplyChain: (show: boolean) => void;
  setShowMetrics: (show: boolean) => void;
  setIsSimulating: (isSimulating: boolean) => void;
  setSimulationProgress: (progress: number) => void;
  setSimulationFinished: (finished: boolean) => void;
  
  // Complex Actions
  handleRoutesUpdate: (newRoutes: RouteResult[], recommendedRoute: RouteResult | null, metrics: Metrics | null) => void;
  startSimulation: () => void;
  endSimulation: () => void;
}

export const useStore = create<AppState>((set) => ({
  role: 'client',
  userLocation: null,
  sellers: [],
  routes: [],
  pois: [],
  globalMetrics: null,
  selectedRouteId: null,
  weight: 100,
  showSupplyChain: false,
  showMetrics: true,
  isSimulating: false,
  simulationProgress: 0,
  simulationFinished: false,
  
  notifications: [],
  addNotification: (message, type) => set((state) => ({
    notifications: [
      ...state.notifications,
      { id: Math.random().toString(36).substring(7), message, type }
    ]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id)
  })),

  setRole: (role) => set({ role }),
  setUserLocation: (userLocation) => set({ userLocation }),
  setSellers: (sellers) => set({ sellers }),
  setRoutes: (routes) => set({ routes }),
  setPois: (pois) => set({ pois }),
  setGlobalMetrics: (globalMetrics) => set({ globalMetrics }),
  setSelectedRouteId: (selectedRouteId) => set({ selectedRouteId }),
  setWeight: (weight) => set({ weight }),
  setShowSupplyChain: (showSupplyChain) => set({ showSupplyChain }),
  setShowMetrics: (showMetrics) => set({ showMetrics }),
  setIsSimulating: (isSimulating) => set({ isSimulating }),
  setSimulationProgress: (simulationProgress) => set({ simulationProgress }),
  setSimulationFinished: (simulationFinished) => set({ simulationFinished }),
  
  handleRoutesUpdate: (newRoutes, recommendedRoute, metrics) => set((state) => ({
    routes: newRoutes,
    globalMetrics: metrics,
    selectedRouteId: recommendedRoute ? recommendedRoute.seller_id : state.selectedRouteId,
    showMetrics: recommendedRoute ? true : state.showMetrics
  })),
  
  startSimulation: () => set({
    isSimulating: true,
    simulationFinished: false,
    simulationProgress: 0
  }),
  
  endSimulation: () => set({
    isSimulating: false,
    simulationFinished: true,
    simulationProgress: 1
  })
}));
