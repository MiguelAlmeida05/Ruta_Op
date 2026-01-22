import React from 'react';
import { Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import clsx from 'clsx';
import { Package, Star } from 'lucide-react';
import { Seller, RouteResult } from '../types';

const SellerIcon = (color: 'green' | 'yellow' | 'red') => L.divIcon({
  className: 'custom-icon',
  html: `<div style="background-color: ${color === 'green' ? '#4CAF50' : color === 'yellow' ? '#FFC107' : '#F44336'}; width: 20px; height: 20px; transform: rotate(45deg); border: 2px solid white;"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

interface SellerMarkersProps {
  sellers: Seller[];
  routes: RouteResult[];
  weight: number;
}

export const SellerMarkers = React.memo(({ sellers, routes, weight }: SellerMarkersProps) => {
  return (
    <>
      {sellers.map((seller) => {
          const route = routes.find(r => r.seller_id === seller.id);
          const price = route ? (route.price_per_unit * weight).toFixed(2) : '0.00';
          
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
    </>
  );
});

interface RoutePolylinesProps {
  routes: RouteResult[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
}

export const RoutePolylines = React.memo(({ routes, selectedRouteId, onSelectRoute }: RoutePolylinesProps) => {
  return (
    <>
      {routes.map((route) => {
          const isSelected = route.seller_id === selectedRouteId;
          return (
            <React.Fragment key={route.seller_id}>
              {isSelected && (
                <Polyline
                  positions={route.route_geometry as [number, number][]}
                  pathOptions={{
                    color: '#1E88E5',
                    weight: 12,
                    opacity: 0.2,
                    lineJoin: 'round',
                  }}
                />
              )}
              <Polyline
                positions={route.route_geometry as [number, number][]}
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
    </>
  );
});
