import React, { forwardRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { RouteResult } from '../types';

// Vehicle Icon Definition
const VehicleIcon = L.divIcon({
  className: 'custom-icon',
  html: `
    <div style="width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; background: rgba(17, 24, 39, 0.85); border: 2px solid #fbbf24; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 17h4V5H2v12h3"/>
        <path d="M14 8h4l3 3v6h-3"/>
        <circle cx="7.5" cy="17.5" r="2.5"/>
        <circle cx="17.5" cy="17.5" r="2.5"/>
      </svg>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21]
});

interface VehicleMarkerProps {
  initialPosition: [number, number];
  selectedRoute: RouteResult | null;
}

const VehicleMarker = forwardRef<L.Marker, VehicleMarkerProps>(({ initialPosition, selectedRoute }, ref) => {
  return (
    <Marker 
      ref={ref}
      position={initialPosition} 
      icon={VehicleIcon} 
      zIndexOffset={1000}
    >
      <Popup>
        <div className="text-gray-800 font-bold text-xs">
          Transportando {selectedRoute?.product_name || 'Carga'}...
        </div>
      </Popup>
    </Marker>
  );
});

VehicleMarker.displayName = 'VehicleMarker';

export default VehicleMarker;
