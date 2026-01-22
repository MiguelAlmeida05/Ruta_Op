import React, { useState, useEffect } from 'react';
import { Product, Seller, RouteResult } from '../types';
import { getProducts, getSellers, simulateRoutes, ApiError } from '../services/api';
import { MapPin, Navigation, Clock, Truck, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/formatters';

const ProductSimulator: React.FC = () => {
  const {
    userLocation,
    setSellers: onSellersUpdate,
    handleRoutesUpdate: onRoutesUpdate,
    selectedRouteId,
    setSelectedRouteId: onSelectRoute,
    showSupplyChain: showTraceability,
    setShowSupplyChain: onToggleTraceability,
    weight,
    addNotification
  } = useStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [results, setResults] = useState<RouteResult[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Removed unused helper getRouteDurationMin

  useEffect(() => {
    const loadData = async () => {
      try {
        const prods = await getProducts();
        setProducts(prods);
      } catch (error) {
        console.error("Error loading products:", error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        // Si hay producto seleccionado, filtra. Si no, trae todos.
        const sellers = await getSellers(selectedProduct || undefined);
        onSellersUpdate(sellers);
      } catch (error) {
        console.error("Error loading sellers:", error);
      }
    };

    fetchSellers();
  }, [selectedProduct, onSellersUpdate]);

  useEffect(() => {
    if (selectedRouteId) {
      setIsCollapsed(false);
    }
  }, [selectedRouteId]);

  const handleSimulate = async () => {
    if (!userLocation || !selectedProduct) return;
    
    setSimulationLoading(true);
    try {
      const response = await simulateRoutes(userLocation[0], userLocation[1], selectedProduct, weight);
      
      setResults(response.all_routes);
      onRoutesUpdate(response.all_routes, response.recommended_route, response.metrics);
      
      const sellersWithRating = response.all_routes
        .filter(r => r.route_geometry && r.route_geometry.length > 0)
        .map(r => ({
          id: r.seller_id,
          name: r.seller_name,
          type: 'Distribuidor',
          coordinates: { 
            lat: r.route_geometry[r.route_geometry.length-1][0], 
            lng: r.route_geometry[r.route_geometry.length-1][1] 
          },
          products: [selectedProduct],
          rating: r.seller_rating,
          trips_count: r.seller_trips
        }));
      onSellersUpdate(sellersWithRating as Seller[]);

      if (response.recommended_route) {
        onSelectRoute(response.recommended_route.seller_id);
      }
      
      addNotification("Rutas simuladas correctamente", "success");
    } catch (error) {
      let msg = "Error al simular rutas.";
      if (error instanceof ApiError && error.requestId) {
        msg += ` (ReqID: ${error.requestId})`;
      } else {
         msg += " Verifica que el servidor backend esté corriendo.";
      }
      addNotification(msg, "error");
    } finally {
      setSimulationLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button for Collapsed State */}
      {isCollapsed && (
        <button 
          onClick={() => setIsCollapsed(false)}
          className="absolute top-20 left-0 z-[1002] bg-primary text-white p-3 rounded-r-xl shadow-xl animate-in slide-in-from-left-4 duration-300 hover:bg-primary-hover"
        >
          <ChevronRight size={20} />
        </button>
      )}

      <div className={clsx(
        "absolute top-20 left-4 z-[1000] w-80 md:w-96 bg-surface/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)] transition-all duration-500 ease-in-out",
        isCollapsed ? "-translate-x-[110%] opacity-0" : "translate-x-0 opacity-100"
      )}>
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-white/5 flex-shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-primary flex items-center gap-3">
              <Truck size={24} className="text-primary" />
              Logística
            </h2>
            <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-widest font-medium opacity-70">
              Portoviejo Smart City
            </p>
          </div>
          <button 
            onClick={() => setIsCollapsed(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

      <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar flex-grow scroll-smooth">
        {/* Product Selection */}
        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
          <label className="block text-[10px] font-bold text-text-secondary mb-3 uppercase tracking-widest opacity-60">
            1. Selecciona un Producto
          </label>
          <div className="grid grid-cols-2 gap-2">
            {products.map((prod) => (
              <button
                key={prod.id}
                onClick={() => {
                  setSelectedProduct(prod.id);
                  setResults([]); // Reset results on change
                  onRoutesUpdate([], null, null);
                }}
                className={clsx(
                  "flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-xs font-bold",
                  selectedProduct === prod.id
                    ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(30,136,229,0.2)]"
                    : "bg-background/40 border-white/5 text-text-secondary hover:border-white/20 hover:text-white"
                )}
              >
                <span>{prod.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User Location Status */}
        <div className="animate-in fade-in slide-in-from-left-4 duration-500 delay-150">
          <label className="block text-[10px] font-bold text-text-secondary mb-3 uppercase tracking-widest opacity-60">
            2. Ubicación de Entrega
          </label>
          <div className={clsx(
            "p-4 rounded-xl border transition-all duration-300 flex items-center gap-4",
            userLocation 
              ? "bg-success/10 border-success/30 shadow-[0_0_15px_rgba(76,175,80,0.1)]" 
              : "bg-yellow-500/10 border-yellow-500/20"
          )}>
            <div className={clsx(
              "p-2 rounded-lg",
              userLocation ? "bg-success/20 text-success" : "bg-yellow-500/20 text-yellow-500"
            )}>
              <MapPin size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {userLocation ? "Punto Establecido" : "Esperando selección..."}
              </p>
              <p className="text-[10px] text-text-secondary font-mono truncate">
                {userLocation 
                  ? `${userLocation[0].toFixed(5)}, ${userLocation[1].toFixed(5)}`
                  : "Haz clic en el mapa"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSimulate}
          disabled={!selectedProduct || !userLocation || simulationLoading}
          className="w-full py-4 bg-primary hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 transform active:scale-95"
        >
          {simulationLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Calculando...</span>
            </div>
          ) : (
            <>
              <Navigation size={18} />
              Simular Rutas
            </>
          )}
        </button>

        {/* Results List */}
        {results.length > 0 && (
          <div className="mt-2 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between sticky top-0 bg-surface/95 backdrop-blur-sm py-2 z-10">
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest opacity-60">
                  3. Rutas Encontradas ({results.length})
                </label>
                
                <button
                  onClick={() => onToggleTraceability(!showTraceability)}
                  className={clsx(
                    "text-[10px] font-black uppercase tracking-tighter px-3 py-1.5 rounded-full flex items-center gap-2 border transition-all",
                    showTraceability 
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                      : "bg-white/5 text-text-secondary border-white/10 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <ShieldCheck size={14} />
                  {showTraceability ? "Trazabilidad On" : "Trazabilidad"}
                </button>
             </div>

            <div className="space-y-3 pb-2">
              {results.map((route, idx) => (
                <div 
                  key={route.seller_id}
                  onClick={() => onSelectRoute(route.seller_id)}
                  className={clsx(
                    "p-4 rounded-xl border cursor-pointer transition-all duration-300 group",
                    selectedRouteId === route.seller_id
                      ? "bg-primary/10 border-primary shadow-lg ring-1 ring-primary/20"
                      : "bg-background/40 border-white/5 hover:border-white/20 hover:bg-background/60"
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={clsx(
                      "text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider",
                      idx === 0 
                        ? "bg-success text-white shadow-lg shadow-success/20" 
                        : "bg-white/5 text-text-secondary"
                    )}>
                      {idx === 0 ? "Recomendada" : `Opción #${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/5 px-2 py-1 rounded-lg">
                      <Clock size={12} className="text-primary" />
                      {formatDuration(route.duration_min)}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-white text-sm mb-3 group-hover:text-primary transition-colors">
                    {route.seller_name}
                  </h3>
                  
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Navigation size={12} className="text-primary" />
                      {route.distance_km} km
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      <span className="text-success">Tráfico Fluido</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default ProductSimulator;
