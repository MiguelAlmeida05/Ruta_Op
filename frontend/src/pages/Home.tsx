import React, { useState, useMemo } from 'react';
import DarkMap from '../components/DarkMap';
import ProductSimulator from '../components/ProductSimulator';
import MetricsDashboard from '../components/MetricsDashboard';
import { Seller, RouteResult } from '../types';
import { getPOIs } from '../services/api';
import { Star, X } from 'lucide-react';
import clsx from 'clsx';

export default function Home() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showSupplyChain, setShowSupplyChain] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const [rating, setRating] = useState(0);
  const [pois, setPois] = useState<any[]>([]);
  const [role, setRole] = useState<'client' | 'distributor' | 'admin'>('client');
  const [weight, setWeight] = useState(100);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationFinished, setSimulationFinished] = useState(false);
  const [globalMetrics, setGlobalMetrics] = useState<any>(null);

  React.useEffect(() => {
    const fetchPOIs = async () => {
      try {
        const data = await getPOIs();
        setPois(data);
      } catch (error) {
        console.error('Error fetching POIs:', error);
      }
    };
    fetchPOIs();
  }, []);

  const handleRoutesUpdate = (newRoutes: RouteResult[], recommendedRoute: RouteResult | null, metrics: any) => {
    setRoutes(newRoutes);
    setGlobalMetrics(metrics);
    if (recommendedRoute) {
      setSelectedRouteId(recommendedRoute.seller_id);
      setShowMetrics(true);
    }
  };
  
  const selectedRoute = useMemo(() => {
    return routes.find(r => r.seller_id === selectedRouteId) || null;
  }, [routes, selectedRouteId]);

  const handleSimulateTrip = () => {
    setIsSimulating(true);
    setSimulationFinished(false);
  };

  const handleSimulationEnd = () => {
    setIsSimulating(false);
    setSimulationFinished(true);
  };

  return (
    <div className="h-screen w-screen bg-background text-text overflow-hidden flex flex-col">
      <header className="h-16 bg-surface border-b border-border flex items-center px-6 justify-between shrink-0 z-10 relative shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-white">
            R
          </div>
          <h1 className="text-xl font-bold tracking-tight">RutaOp</h1>
        </div>
        
        <div className="flex items-center gap-4 bg-background/50 p-1 rounded-lg border border-white/5">
          {(['client', 'distributor', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={clsx(
                "px-3 py-1 text-[10px] font-bold rounded uppercase transition-all",
                role === r ? "bg-primary text-white" : "text-text-secondary hover:text-white"
              )}
            >
              {r === 'client' ? 'Cliente' : r === 'distributor' ? 'Distribuidor' : 'Admin'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 ml-auto">
           <button className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md text-sm font-medium transition-colors shadow-sm">
            Iniciar Sesión
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        {(showSupplyChain || simulationFinished) && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-3 rounded-full shadow-xl z-[1000] flex items-center gap-4 animate-in slide-in-from-bottom-4">
              <span className="text-sm font-medium">
                {simulationFinished ? "Califica tu Entrega:" : "Calificar Experiencia:"}
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star}
                    size={20}
                    className={clsx(
                      "cursor-pointer hover:scale-125 transition-transform",
                      rating >= star ? "fill-yellow-400 text-yellow-400" : "text-gray-500"
                    )}
                    onClick={() => {
                      setRating(star);
                      if (simulationFinished) {
                        setTimeout(() => setSimulationFinished(false), 2000);
                      }
                    }}
                  />
                ))}
              </div>
              {simulationFinished && (
                <button 
                  onClick={() => setSimulationFinished(false)}
                  className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              )}
          </div>
        )}

        {showMetrics && selectedRoute && (
          <MetricsDashboard 
            selectedRoute={selectedRoute} 
            onClose={() => setShowMetrics(false)} 
            showTraceability={showSupplyChain}
            weight={weight}
            setWeight={setWeight}
            onSimulate={handleSimulateTrip}
            isSimulating={isSimulating}
            role={role}
            metrics={globalMetrics}
          />
        )}

        <DarkMap 
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          sellers={sellers}
          routes={routes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          showTraceability={showSupplyChain}
          pois={pois}
          selectedRoute={selectedRoute}
          isSimulating={isSimulating}
          onSimulationEnd={handleSimulationEnd}
          weight={weight}
        />
        
        <ProductSimulator 
          userLocation={userLocation}
          onSellersUpdate={setSellers}
          onRoutesUpdate={handleRoutesUpdate}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          showTraceability={showSupplyChain}
          onToggleTraceability={setShowSupplyChain}
          weight={weight}
        />
      </main>
    </div>
  );
}
