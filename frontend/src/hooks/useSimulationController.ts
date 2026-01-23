import { useState, useEffect, useRef } from 'react';
import { RouteResult } from '../types';
import { recalculateRoute } from '../services/api';
import L from 'leaflet';

export interface UseSimulationControllerProps {
  isSimulating: boolean;
  selectedRoute: RouteResult | null;
  onProgressUpdate?: (progress: number) => void;
  onSimulationEnd?: () => void;
  vehicleMarkerRef: React.RefObject<L.Marker>;
  onRouteGeometryUpdate?: (geometry: [number, number][]) => void;
}

export interface SimulationEvent {
  type: string;
  message: string;
}

export const useSimulationController = ({
  isSimulating,
  selectedRoute,
  onProgressUpdate,
  onSimulationEnd,
  vehicleMarkerRef,
  onRouteGeometryUpdate
}: UseSimulationControllerProps) => {
  // Removed vehiclePos state to prevent re-renders
  const [activeEvent, setActiveEvent] = useState<SimulationEvent | null>(null);
  const [dynamicPath, setDynamicPath] = useState<[number, number][] | null>(null);
  
  const simulationIdRef = useRef<string>("");
  const pathRef = useRef<[number, number][]>([]);
  const stepRef = useRef(0);
  const eventConfigRef = useRef<{triggerStep: number, type: string} | null>(null);
  const isPausedRef = useRef(false);
  
  // Refs for callbacks to avoid effect dependencies
  const onProgressUpdateRef = useRef(onProgressUpdate);
  const onSimulationEndRef = useRef(onSimulationEnd);
  const onRouteGeometryUpdateRef = useRef(onRouteGeometryUpdate);

  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  }, [onProgressUpdate]);

  useEffect(() => {
    onSimulationEndRef.current = onSimulationEnd;
  }, [onSimulationEnd]);

  useEffect(() => {
    onRouteGeometryUpdateRef.current = onRouteGeometryUpdate;
  }, [onRouteGeometryUpdate]);

  useEffect(() => {
    if (isSimulating && selectedRoute && Array.isArray(selectedRoute.route_geometry) && selectedRoute.route_geometry.length > 0) {
      
      // Initialize Simulation (only if new simulation)
      if (simulationIdRef.current === "" || stepRef.current === 0) {
         const newSimId =
           typeof crypto !== 'undefined' && 'randomUUID' in crypto
             ? crypto.randomUUID()
             : Math.random().toString(36).substring(2);
         simulationIdRef.current = newSimId;
         stepRef.current = 0;
         // Delivery goes from Seller -> User. Route is usually User -> Seller. So we reverse.
         pathRef.current = [...selectedRoute.route_geometry as [number, number][]].reverse();
         setDynamicPath(null);
         setActiveEvent(null);
         isPausedRef.current = false;

         // Set initial position immediately
         if (vehicleMarkerRef.current && pathRef.current.length > 0) {
             vehicleMarkerRef.current.setLatLng(pathRef.current[0] as [number, number]);
         }
         
         // Stochastic Event Config
         const rand = Math.random();
         let eventType = null;
         // 20% Rain, 30% Traffic, 5% Protest => 55% chance of event
         if (rand < 0.20) eventType = 'rain';
         else if (rand < 0.50) eventType = 'traffic';
         else if (rand < 0.55) eventType = 'protest';
         
         if (eventType) {
             const totalSteps = pathRef.current.length;
             // Trigger between 20% and 80% of the route
             const rawTrigger = Math.floor(totalSteps * (0.2 + Math.random() * 0.6));
             const minStep = 1;
             const maxStep = Math.max(1, totalSteps - 2);
             const triggerStep = Math.max(minStep, Math.min(maxStep, rawTrigger));
             eventConfigRef.current = { triggerStep, type: eventType };
             console.log(`[Simulation] Event '${eventType}' scheduled at step ${triggerStep}/${totalSteps}`);
         } else {
             eventConfigRef.current = null;
         }
      }

      const animate = async () => {
        if (simulationIdRef.current === "") return;
        if (isPausedRef.current) return;

        // Check for event trigger
        if (eventConfigRef.current && stepRef.current === eventConfigRef.current.triggerStep) {
            isPausedRef.current = true;
            const evt = eventConfigRef.current;
            eventConfigRef.current = null;
            
            let msg = "Retraso detectado";
            if (evt.type === 'rain') msg = "Lluvia intensa detectada. Reduciendo velocidad.";
            if (evt.type === 'traffic') msg = "Congestión vehicular en la ruta.";
            if (evt.type === 'protest') msg = "Protestas reportadas. Recalculando ruta...";
            
            setActiveEvent({ type: evt.type, message: msg });
            
            // If protest or traffic, we recalculate route
            if (evt.type === 'protest' || evt.type === 'traffic') {
                // Remove the event to prevent re-triggering loop
                eventConfigRef.current = null;
                
                try {
                    // Simulate recalculation from current point
                    const currentPos = pathRef.current[stepRef.current];
                    // Find a new path to destination (last point)
                    const destPos = pathRef.current[pathRef.current.length - 1];
                    
                    // Call API (mocked or real)
                    // We need to pass current pos as start. 
                    // Note: This is a simplification. In real app we would call a proper routing service.
                    // Here we just mock it by adding some random points or calling the mock service.
                    
                    // For now, let's assume recalculateRoute exists and works
                    // const result = await recalculateRoute(currentPos, destPos);
                    
                    // Using the imported mock/service
                    const result = await recalculateRoute(
                        currentPos[0], currentPos[1],
                        destPos[0], destPos[1],
                        evt.type,
                        simulationIdRef.current,
                        pathRef.current.length > 0 ? stepRef.current / pathRef.current.length : 0
                    );

                    // Update path: Keep what we traveled, append new path
                    const traveledPath = pathRef.current.slice(0, stepRef.current + 1);
                    const newGeometry = result.route_geometry; // This is Current -> Dest
                    
                    if (newGeometry && newGeometry.length > 0) {
                        // Merge
                        const combinedPath = [...traveledPath, ...newGeometry];
                        
                        pathRef.current = combinedPath;
                        setDynamicPath(combinedPath); // Visual update
                        onRouteGeometryUpdateRef.current?.([...combinedPath].reverse());
                        
                        // Resume after delay
                        setTimeout(() => {
                            setActiveEvent(prev => prev ? { ...prev, message: `Ruta actualizada. (+${(result.duration_min).toFixed(1)} min)` } : null);
                            setTimeout(() => setActiveEvent(null), 3000); 
                            isPausedRef.current = false;
                        }, 2000);
                    } else {
                         console.warn("Recalculation returned empty geometry. Resuming original path.");
                         setTimeout(() => {
                            setActiveEvent(null);
                            isPausedRef.current = false;
                        }, 2000);
                    }
                    
                } catch (e) {
                    console.error("Failed to recalculate route:", e);
                    isPausedRef.current = false; // Resume if fail
                }
                return;
            } else {
                // Just a delay for other events
                setTimeout(() => {
                     setActiveEvent(null);
                     isPausedRef.current = false;
                }, 2000);
                return;
            }
        }

        if (stepRef.current < pathRef.current.length) {
          // Imperative update using Leaflet ref
          if (vehicleMarkerRef.current) {
             vehicleMarkerRef.current.setLatLng(pathRef.current[stepRef.current] as [number, number]);
          }
          
          onProgressUpdateRef.current?.(stepRef.current / pathRef.current.length);
          stepRef.current++;
        } else {
          // End of simulation
          isPausedRef.current = true; 
          // Final position update
          // setVehiclePos(null); // No longer needed
          onProgressUpdateRef.current?.(1);
          onSimulationEndRef.current?.();
          simulationIdRef.current = ""; 
        }
      };

      const interval = setInterval(animate, 50); // Speed of animation

      return () => clearInterval(interval);
    } else {
      // Reset logic if needed when simulation stops
      simulationIdRef.current = "";
    }
  }, [isSimulating, selectedRoute, vehicleMarkerRef]); // Added vehicleMarkerRef dependency

  return {
    // vehiclePos, // Removed
    activeEvent,
    dynamicPath
  };
};
