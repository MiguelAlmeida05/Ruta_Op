import React, { useState } from 'react';
import DarkMap from '../components/DarkMap';
import ProductSimulator from '../components/ProductSimulator';
import MetricsDashboard from '../components/MetricsDashboard';
import Toast from '../components/Toast';
import { Star, X, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useStore } from '../store/useStore';

export default function Home() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);

  const {
    role,
    setRole,
    showSupplyChain,
    setShowSupplyChain,
    showMetrics,
    selectedRouteId,
    routes,
    simulationFinished,
    setSimulationFinished,
    setPois
  } = useStore();

  const selectedRoute = routes.find(r => r.seller_id === selectedRouteId) || null;

  React.useEffect(() => {
    // POIs desactivados por limpieza de mapa
    setPois([]);
  }, [setPois]);
  
  return (
    <div className="h-screen w-screen bg-background text-text overflow-hidden flex flex-col">
      <header className="h-16 bg-surface border-b border-border flex items-center px-6 justify-between shrink-0 z-10 relative shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-white">
            T
          </div>
          <h1 className="text-xl font-bold tracking-tight">TuDistri</h1>
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
           {role === 'admin' && (
             <button 
               onClick={() => navigate('/validation')}
               className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-md text-sm font-medium transition-colors"
             >
               <Activity size={16} />
               Validación de Sistema
             </button>
           )}
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
                      // Cerrar automáticamente después de calificar (simulación o experiencia general)
                      setTimeout(() => {
                        setSimulationFinished(false);
                        setShowSupplyChain(false);
                        setRating(0); // Reset rating for next time
                      }, 1500);
                    }}
                  />
                ))}
              </div>
              <button 
                onClick={() => {
                  setSimulationFinished(false);
                  setShowSupplyChain(false);
                  setRating(0);
                }}
                className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
          </div>
        )}

        {showMetrics && selectedRoute && (
          <MetricsDashboard />
        )}

        <DarkMap />
        
        <ProductSimulator />
        
        <Toast />
      </main>
    </div>
  );
}
