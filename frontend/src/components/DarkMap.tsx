import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, Polyline, useMapEvents, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { POI, Seller, RouteResult } from '../types';
import { Package, ShieldCheck, Star, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { recalculateRoute } from '../services/api';

const { BaseLayer } = LayersControl;

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Custom icons setup
const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const UserIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div style="background-color: #1E88E5; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #1E88E5;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const SellerIcon = (color: 'green' | 'yellow' | 'red') => L.divIcon({
  className: 'custom-icon',
  html: `<div style="background-color: ${color === 'green' ? '#4CAF50' : color === 'yellow' ? '#FFC107' : '#F44336'}; width: 20px; height: 20px; transform: rotate(45deg); border: 2px solid white;"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Custom Icons for Traceability
const createCustomIcon = (color: string) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const marketIcon = createCustomIcon('green');
const clientIcon = createCustomIcon('blue'); // We keep this as is, assuming the image is generic blue
const poiIcon = createCustomIcon('orange');

const VehicleIcon = L.divIcon({
  className: 'custom-icon',
  html: `<div style="background-color: #FFD600; width: 24px; height: 24px; border-radius: 6px; border: 2px solid #000; display: flex; items-center; justify-center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transform: rotate(45deg);">
    <div style="transform: rotate(-45deg); display: flex; align-items: center; justify-center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
    </div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const PORTOVIEJO_COORDS: [number, number] = [-1.0544, -80.4544];

interface DarkMapProps {
  userLocation: [number, number] | null;
  setUserLocation: (coords: [number, number]) => void;
  sellers: Seller[];
  routes: RouteResult[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  showTraceability?: boolean; 
  pois?: POI[]; 
  selectedRoute?: RouteResult | null;
  isSimulating?: boolean;
  onSimulationEnd?: () => void;
  onProgressUpdate?: (progress: number) => void;
  weight?: number;
}

// Component to handle map clicks
const MapEvents: React.FC<{ onClick: (coords: [number, number]) => void }> = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

// Component to auto-fit bounds
const MapController: React.FC<{ routes: RouteResult[], sellers: Seller[], userLocation: [number, number] | null }> = ({ routes, sellers, userLocation }) => {
  const map = useMapEvents({});

  useEffect(() => {
    if (!map) return;
    
    // Si no hay nada seleccionado, volver a Portoviejo
    if (!userLocation && sellers.length === 0) {
        map.flyTo(PORTOVIEJO_COORDS, 13);
        return;
    }

    const bounds = L.latLngBounds([]);
    
    if (userLocation) {
      bounds.extend(userLocation);
    }
    
    sellers.forEach(s => bounds.extend([s.coordinates.lat, s.coordinates.lng]));
    
    // Si hay rutas, priorizar mostrar la geometría de la ruta
    if (routes.length > 0) {
         routes.forEach(r => {
            r.route_geometry.forEach(pt => bounds.extend(pt));
        });
    }
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [map, routes, sellers, userLocation]);

  return null;
};

const DarkMap: React.FC<DarkMapProps> = ({ 
  userLocation, 
  setUserLocation, 
  sellers, 
  routes,
  selectedRouteId,
  onSelectRoute,
  showTraceability = false,
  pois = [],
  selectedRoute = null,
  isSimulating = false,
  onSimulationEnd,
  onProgressUpdate,
  weight = 100
}) => {
  // Traceability synchronization
  const clientLocation: [number, number] | null = userLocation;
  const [vehiclePos, setVehiclePos] = useState<[number, number] | null>(null);
  
  // Event Simulation State
  const [activeEvent, setActiveEvent] = useState<{type: string, message: string} | null>(null);
  const simulationIdRef = React.useRef<string>("");
  const [dynamicPath, setDynamicPath] = useState<[number, number][] | null>(null);
  const onProgressUpdateRef = React.useRef<DarkMapProps['onProgressUpdate']>(onProgressUpdate);
  const onSimulationEndRef = React.useRef<DarkMapProps['onSimulationEnd']>(onSimulationEnd);
  
  const pathRef = React.useRef<[number, number][]>([]);
  const stepRef = React.useRef(0);
  const eventConfigRef = React.useRef<{triggerStep: number, type: string} | null>(null);
  const isPausedRef = React.useRef(false);

  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  }, [onProgressUpdate]);

  useEffect(() => {
    onSimulationEndRef.current = onSimulationEnd;
  }, [onSimulationEnd]);
  
  // Animation Logic
  useEffect(() => {
    if (isSimulating && selectedRoute && Array.isArray(selectedRoute.route_geometry) && selectedRoute.route_geometry.length > 0) {
      
      // Initialize Simulation (only if new simulation)
      if (simulationIdRef.current === "" || stepRef.current === 0) {
         const newSimId = Math.random().toString(36).substring(7);
         simulationIdRef.current = newSimId;
         stepRef.current = 0;
         // Delivery goes from Seller -> User. Route is usually User -> Seller. So we reverse.
         pathRef.current = [...selectedRoute.route_geometry].reverse();
         setDynamicPath(null);
         setActiveEvent(null);
         isPausedRef.current = false;
         
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
             const triggerStep = Math.floor(totalSteps * (0.2 + Math.random() * 0.6)); 
             eventConfigRef.current = { triggerStep, type: eventType };
             console.log(`[Simulation] Event '${eventType}' scheduled at step ${triggerStep}/${totalSteps}`);
         } else {
             eventConfigRef.current = null;
         }
      }

      const animate = async () => {
        if (isPausedRef.current) return;

        // Check Event Trigger
        if (eventConfigRef.current && stepRef.current === eventConfigRef.current.triggerStep) {
            isPausedRef.current = true;
            const evt = eventConfigRef.current;
            eventConfigRef.current = null; // Ensure it triggers only once
            
            const typeLabels: Record<string, string> = { 
                rain: 'Lluvia Intensa', 
                traffic: 'Tráfico Pesado', 
                protest: 'Protesta / Cierre' 
            };
            
            setActiveEvent({ 
                type: evt.type, 
                message: `Evento inesperado: ${typeLabels[evt.type]}. Recalculando ruta...` 
            });
            
            try {
                const currentPos = pathRef.current[stepRef.current];
                // Destination is the last point of the current path (User Location)
                const destPos = pathRef.current[pathRef.current.length - 1];
                
                const result = await recalculateRoute(
                    currentPos[0], currentPos[1],
                    destPos[0], destPos[1],
                    evt.type,
                    simulationIdRef.current,
                    stepRef.current / pathRef.current.length
                );
                
                // Update Path: Keep traveled part, append new calculated part
                const traveledPath = pathRef.current.slice(0, stepRef.current + 1);
                const newGeometry = result.route_geometry; // This is Current -> Dest
                
                // Merge
                const combinedPath = [...traveledPath, ...newGeometry];
                
                pathRef.current = combinedPath;
                setDynamicPath(combinedPath); // Visual update
                
                // Resume after delay
                setTimeout(() => {
                    setActiveEvent(prev => prev ? { ...prev, message: `Ruta actualizada. (+${(result.duration_min).toFixed(1)} min)` } : null);
                    setTimeout(() => setActiveEvent(null), 3000); 
                    isPausedRef.current = false;
                }, 2000);
                
            } catch (e) {
                console.error("Failed to recalculate route:", e);
                isPausedRef.current = false; // Resume if fail
            }
            return;
        }

        if (stepRef.current < pathRef.current.length) {
          setVehiclePos(pathRef.current[stepRef.current] as [number, number]);
          onProgressUpdateRef.current?.(stepRef.current / pathRef.current.length);
          stepRef.current++;
        } else {
          // End of simulation
          // Do not clear interval here, let useEffect cleanup handle it or set state
          // But we need to stop.
          isPausedRef.current = true; 
          setVehiclePos(null);
          onProgressUpdateRef.current?.(1);
          onSimulationEndRef.current?.();
          simulationIdRef.current = ""; 
        }
      };
      
      const interval = setInterval(animate, 50); // Speed of animation

      return () => clearInterval(interval);
    } else {
      setVehiclePos(null);
      simulationIdRef.current = "";
    }
  }, [isSimulating, selectedRoute]); // Dependencies

  const activeSellers = useMemo(() => {
    if (showTraceability) {
      // If traceability is active, we show the path from the selected seller to the user
      const selected = sellers.find(s => s.id === selectedRouteId);
      return selected ? [selected] : [];
    }
    return [];
  }, [showTraceability, sellers, selectedRouteId]);

  return (
    <div className="h-full w-full relative">
      <MapContainer 
        center={PORTOVIEJO_COORDS} 
        zoom={13} 
        scrollWheelZoom={true} 
        className="h-full w-full z-0 bg-[#121212]"
        zoomControl={false}
      >
        <LayersControl position="topright">
          <BaseLayer checked name="Modo Oscuro">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name="Google Maps Satélite">
            <TileLayer
              attribution="&copy; Google Maps"
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            />
          </BaseLayer>
          <BaseLayer name="Google Maps Híbrido">
            <TileLayer
              attribution="&copy; Google Maps"
              url="https://mt1.google.com/vt/lyrs=y,h&x={x}&y={y}&z={z}"
            />
          </BaseLayer>
        </LayersControl>

        <ZoomControl position="topright" />
        
        <MapEvents onClick={setUserLocation} />
        <MapController routes={routes} sellers={sellers} userLocation={userLocation} />

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={UserIcon}>
            <Popup>
              <div className="w-48 p-1 text-center">
                <div className="bg-primary text-white p-2 rounded-t-lg -mx-4 -mt-4 mb-3">
                  <h3 className="font-bold text-xs">Tu Ubicación</h3>
                </div>
                <p className="text-xs text-gray-600">Punto de Entrega Seleccionado</p>
                <p className="text-[10px] font-mono text-gray-400 mt-1">
                  {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* POI Markers - Hidden when a product is selected to reduce noise */}
        {!selectedRouteId && pois.map((poi) => (
          <Marker 
            key={poi.id} 
            position={[poi.coordinates.lat, poi.coordinates.lng]}
            icon={poiIcon}
          >
            <Popup>
              <div className="text-gray-800">
                <strong className="block text-lg">{poi.name}</strong>
                <span className="text-sm text-gray-600 font-medium uppercase tracking-wider">{poi.category}</span>
                {poi.description && <p className="mt-1 text-sm text-gray-500">{poi.description}</p>}
                {poi.address && <p className="mt-1 text-xs text-gray-400 italic">{poi.address}</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Vehicle Animation Marker */}
        {vehiclePos && (
          <Marker position={vehiclePos} icon={VehicleIcon} zIndexOffset={1000}>
            <Popup>
              <div className="text-gray-800 font-bold text-xs">
                Transportando {selectedRoute?.product_name}...
              </div>
            </Popup>
          </Marker>
        )}

        {/* Seller Markers (Standard Mode) */}
        {!showTraceability && sellers.map((seller) => {
          const route = routes.find(r => r.seller_id === seller.id);
          const price = route ? (route.price_per_unit * weight).toFixed(2) : '0.00';
          
          // Clasificación visual en el mapa
          let markerColor: 'green' | 'yellow' | 'red' = 'green';
          if (seller.rating && seller.trips_count) {
            if (seller.rating < 3.5 || seller.trips_count < 5) {
              markerColor = 'red';
            } else if (seller.rating < 4.5) {
              markerColor = 'yellow';
            }
          }

          return (
            <Marker 
              key={seller.id} 
              position={[seller.coordinates.lat, seller.coordinates.lng]}
              icon={SellerIcon(markerColor)}
            >
              <Popup className="custom-popup">
                <div className="w-64">
                  <div className={clsx(
                    "text-white p-3 pr-12 rounded-t-lg mb-3 flex flex-col justify-center relative min-h-[60px]",
                    markerColor === 'red' ? "bg-red-600" : markerColor === 'yellow' ? "bg-yellow-600" : "bg-primary"
                  )}>
                    <h3 className="font-bold flex items-center gap-2 text-base leading-tight mb-1">
                      <Package size={18} className="flex-shrink-0" />
                      <span className="truncate">{seller.name}</span>
                    </h3>
                    <div className="flex gap-0.5 ml-[26px]">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={14} className={clsx(s <= (seller.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-white/30")} />
                      ))}
                    </div>
                  </div>
                  
                  <div className="px-3 pb-3 space-y-3 text-sm text-gray-300">
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-gray-500">Tipo:</span>
                      <span className="font-medium text-white">{seller.type}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-white/5 p-2 rounded border border-white/10">
                        <div className="text-xs text-gray-500">Viajes</div>
                        <div className="font-bold text-primary">{seller.trips_count || 0}</div>
                      </div>
                      <div className="bg-white/5 p-2 rounded border border-white/10">
                        <div className="text-xs text-gray-500">Calificación</div>
                        <div className="font-bold text-yellow-500">{seller.rating || 0}</div>
                      </div>
                    </div>

                    {markerColor === 'red' && (
                      <div className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded border border-red-500/20 text-center font-bold">
                        En Crecimiento
                      </div>
                    )}

                    {route && (
                      <>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-gray-500">Precio Est. ({weight} qq):</span>
                          <span className="text-green-400 font-bold">${price}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-gray-500">Distancia:</span>
                          <span className="font-bold text-white">{route.distance_km} km</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-gray-500">Tiempo:</span>
                          <span className="font-bold text-primary">{route.duration_min} min</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Productos:</span>
                      <span className="text-xs text-right max-w-[120px] text-gray-400">{seller.products.join(', ')}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Routes (Standard Mode) */}
        {!showTraceability && routes.map((route) => {
          const isSelected = route.seller_id === selectedRouteId;
          return (
            <React.Fragment key={route.seller_id}>
              {/* Outer Glow Polyline for Selected Route */}
              {isSelected && (
                <Polyline
                  positions={route.route_geometry}
                  pathOptions={{
                    color: '#1E88E5',
                    weight: 12,
                    opacity: 0.2,
                    lineJoin: 'round',
                  }}
                />
              )}
              <Polyline
                positions={route.route_geometry}
                pathOptions={{
                  color: isSelected ? '#1E88E5' : '#424242',
                  weight: isSelected ? 6 : 4,
                  opacity: isSelected ? 1 : 0.5,
                  lineJoin: 'round',
                }}
                eventHandlers={{
                  click: () => onSelectRoute(route.seller_id)
                }}
              >
                <Popup>
                  <div className="text-gray-800">
                    <strong>Ruta hacia {route.seller_name}</strong><br/>
                    Tiempo: {route.duration_min} min<br/>
                    Distancia: {route.distance_km} km
                  </div>
                </Popup>
              </Polyline>
            </React.Fragment>
          );
        })}

        {/* Dynamic Route (Event Triggered) */}
        {dynamicPath && (
           <Polyline
             positions={dynamicPath}
             pathOptions={{
               color: '#FF5722', // Orange/Red for changed route
               weight: 6,
               opacity: 0.9,
               lineJoin: 'round',
               dashArray: '10, 5'
             }}
           />
        )}

        {/* --- TRACEABILITY MODE ELEMENTS --- */}
        {showTraceability && clientLocation && (
          <>
            {activeSellers.map(s => (
                <React.Fragment key={s.id}>
                  <Marker position={[s.coordinates.lat, s.coordinates.lng]} icon={marketIcon}>
                    <Popup>
                      <div className="w-64 max-w-[calc(100vw-40px)]">
                      <div className="bg-primary text-white p-3 pr-12 rounded-t-lg mb-3 flex flex-col justify-center relative min-h-[60px]">
                        <h3 className="font-bold flex items-center gap-2 text-base leading-tight mb-1">
                          <Package size={18} className="flex-shrink-0" />
                          <span className="truncate">{s.name}</span>
                        </h3>
                        <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded self-start ml-[26px]">Origen</span>
                      </div>
                      <div className="px-3 pb-3 space-y-3 text-sm text-gray-300">
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-gray-500">Estado:</span>
                            <span className="text-green-400 font-bold">Despachado</span>
                          </div>
                          <div className="flex justify-between border-b border-white/10 pb-2">
                            <span className="text-gray-500">Lote:</span>
                            <span className="font-mono text-xs">#2024-X89</span>
                          </div>
                          
                          {/* Metrics of the executed route */}
                          {selectedRoute && (
                            <>
                              <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-gray-500">Tiempo Real:</span>
                                <span className="font-bold text-primary">{selectedRoute.duration_min} min</span>
                              </div>
                              <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-gray-500">Distancia:</span>
                                <span className="font-bold text-white">{selectedRoute.distance_km} km</span>
                              </div>
                            </>
                          )}

                          <div className="flex justify-between">
                            <span className="text-gray-500">Blockchain:</span>
                            <span className="text-xs text-primary font-bold flex items-center gap-1">
                              <ShieldCheck size={12} /> Verificado
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {/* Use precise route geometry if available, otherwise straight dashed line */}
                  {selectedRoute && selectedRoute.seller_id === s.id ? (
                    <Polyline 
                      positions={selectedRoute.route_geometry} 
                      pathOptions={{ 
                        color: '#00B0FF', 
                        weight: 3, 
                        opacity: 0.8, 
                        dashArray: '10, 10',
                        lineJoin: 'round'
                      }} 
                    />
                  ) : (
                    <Polyline 
                      positions={[[s.coordinates.lat, s.coordinates.lng], clientLocation]} 
                      pathOptions={{ color: '#00B0FF', weight: 2, opacity: 0.6, dashArray: '5, 10' }} 
                    />
                  )}
                </React.Fragment>
            ))}

            <Marker position={clientLocation} icon={clientIcon}>
                <Popup className="custom-popup">
                   <div className="w-80 max-w-[calc(100vw-40px)]">
                      <div className="bg-primary text-white p-3 pr-12 rounded-t-lg mb-3 flex flex-col justify-center relative min-h-[60px]">
                        <h3 className="font-bold flex items-center gap-2 text-base leading-tight mb-1">
                           <Package size={18} className="flex-shrink-0" />
                           <span className="truncate">Trazabilidad del Lote</span>
                        </h3>
                        <span className="bg-white/20 text-xs px-2 py-0.5 rounded self-start ml-[26px]">Lote #2024-X89</span>
                      </div>
                      
                      <div className="px-3 pb-3 space-y-3 text-sm text-gray-300">
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-gray-500">Origen:</span>
                          <span className="font-medium text-right text-white">Valle del Río Portoviejo</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-gray-500">Frescura:</span>
                          <span className="text-green-400 font-bold">Grado AA (Premium)</span>
                        </div>
                         <div className="flex justify-between border-b border-white/10 pb-2">
                          <span className="text-gray-500">Proveedor:</span>
                          <span className="font-medium text-white">Asoc. Agricultores Manabitas</span>
                        </div>

                         {/* Delivery Metrics Summary */}
                         {selectedRoute && (
                            <div className="bg-blue-500/10 p-2 rounded border border-blue-500/20 mb-2">
                              <div className="text-xs text-blue-300 font-bold mb-1 uppercase tracking-wider">Resumen de Entrega</div>
                              <div className="flex justify-between text-xs">
                                <span>Tiempo Total:</span>
                                <span className="font-bold text-white">{selectedRoute.duration_min} min</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span>Recorrido:</span>
                                <span className="font-bold text-white">{selectedRoute.distance_km} km</span>
                              </div>
                            </div>
                         )}
                        
                        <div className="bg-white/5 p-3 rounded border border-white/10 mt-2">
                          <div className="text-xs font-mono text-gray-500 mb-1">BLOCKCHAIN HASH</div>
                          <div className="text-xs font-mono break-all text-gray-400">
                            0x71C7656EC7ab88b098defB751B7401B5f6d8976F
                          </div>
                          <div className="flex items-center gap-1 mt-2 text-green-400 text-xs font-bold">
                            <ShieldCheck size={12} />
                            Verificado en Blockchain
                          </div>
                        </div>
                      </div>
                   </div>
                </Popup>
            </Marker>
          </>
        )}

      </MapContainer>
      
      {/* Legend / Info */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-surface/90 p-3 rounded-lg border border-border text-text shadow-lg text-xs backdrop-blur-sm">
        {!showTraceability ? (
            <>
                <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-[#00B0FF] border border-white"></div>
                <span>Tu Ubicación</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rotate-45 bg-[#4CAF50] border border-white"></div>
                <span>Punto de Venta</span>
                </div>
                <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-[#00B0FF]"></div>
                <span>Ruta Óptima</span>
                </div>
                {dynamicPath && (
                  <div className="flex items-center gap-2 mt-1 font-bold text-orange-500">
                    <div className="w-4 h-1 bg-[#FF5722] border-white"></div>
                    <span>Ruta Recalculada</span>
                  </div>
                )}
            </>
        ) : (
            <>
                 <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
                <span>Cliente (Trazabilidad)</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-green-500 border border-white"></div>
                <span>Mercados</span>
                </div>
            </>
        )}
      </div>
      
      {/* Event Alert Overlay */}
      {activeEvent && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[2000] bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-pulse border-2 border-white/20 transition-all duration-300">
            <AlertTriangle className="animate-bounce" size={24} />
            <div>
                <strong className="block text-xs uppercase tracking-wider font-bold opacity-80">
                    {activeEvent.type === 'rain' ? 'Alerta Meteorológica' : activeEvent.type === 'protest' ? 'Alerta Civil' : 'Tráfico'}
                </strong>
                <span className="text-sm font-medium">{activeEvent.message}</span>
            </div>
        </div>
      )}

    </div>
  );
};

export default DarkMap;
