import React, { useState, useEffect } from 'react';
import { RouteResult } from '../types';
import { Truck, DollarSign, Clock, TrendingUp, Leaf, Battery, ShieldCheck, ChevronDown, ChevronUp, Navigation, X, Award, Activity, Zap } from 'lucide-react';
import clsx from 'clsx';

interface MetricsDashboardProps {
  selectedRoute: RouteResult | null;
  onClose: () => void;
  showTraceability: boolean;
  weight: number;
  setWeight: (w: number) => void;
  onSimulate: () => void;
  isSimulating: boolean;
  role: 'client' | 'distributor' | 'admin';
  metrics?: any;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ 
  selectedRoute, 
  onClose, 
  showTraceability,
  weight,
  setWeight,
  onSimulate,
  isSimulating,
  role,
  metrics: externalMetrics
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
  }, [selectedRoute]);

  useEffect(() => {
    if (showTraceability) {
      setExpanded(true);
    }
  }, [showTraceability]);

  if (!selectedRoute || !isVisible) return null;

  // Usar métricas externas (del backend) o calcular locales si no hay
  const metrics = externalMetrics || {
    revenue: (selectedRoute.price_per_unit || 0) * weight,
    profit: ((selectedRoute.price_per_unit || 0) * weight) - (selectedRoute.transport_cost || 0)
  };

  return (
    <div className="absolute top-6 right-6 z-[1001] w-[90%] md:w-[420px] bg-surface/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 transition-all flex flex-col max-h-[85vh]">
      <div className="flex flex-col overflow-y-auto custom-scrollbar">
        
        {/* Header with Close Button */}
        <div className="flex justify-between items-center px-4 py-2 bg-white/5 border-b border-white/5">
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Dashboard Logístico</span>
          <button 
            onClick={() => {
              setIsVisible(false);
              onClose();
            }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Product Info & Weight */}
        <div className="p-4 border-b border-white/10">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              {selectedRoute.product_image && (
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/20 flex-shrink-0">
                  <img 
                    src={selectedRoute.product_image} 
                    alt={selectedRoute.product_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Truck className="text-primary" size={16} />
                  <span className="truncate max-w-[180px]">{selectedRoute.seller_name}</span>
                </h3>
                <p className="text-xs text-text-secondary">{selectedRoute.product_name}</p>
              </div>
            </div>

            {/* Weight Selector */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tighter">Carga (qq)</span>
              <div className="flex gap-1 bg-background/50 p-1 rounded-lg border border-white/5">
                {[50, 100, 200, 500].map(w => (
                  <button
                    key={w}
                    onClick={() => setWeight(w)}
                    className={clsx(
                      "px-2 py-1 text-[10px] font-bold rounded transition-all",
                      weight === w 
                        ? "bg-primary text-white shadow-lg" 
                        : "text-text-secondary hover:text-white"
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Metrics Row */}
        <div className="p-4 bg-white/5">
          <div className="grid grid-cols-3 gap-2">
            {(role === 'client' || role === 'admin') && (
              <div className="bg-background/40 p-3 rounded-xl border border-white/5 flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-success mb-1">
                  <DollarSign size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Costo</span>
                </div>
                <span className="text-sm font-black text-white">${metrics.revenue.toLocaleString()}</span>
              </div>
            )}

            {(role === 'distributor' || role === 'admin') && (
              <div className="bg-primary/20 p-3 rounded-xl border border-primary/20 flex flex-col items-center shadow-inner">
                <div className="flex items-center gap-1.5 text-primary mb-1">
                  <TrendingUp size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Beneficio</span>
                </div>
                <span className="text-sm font-black text-white">${metrics.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}

            <div className="bg-background/40 p-3 rounded-xl border border-white/5 flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-error mb-1">
                <Clock size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Tiempo</span>
              </div>
              <span className="text-sm font-black text-white">{selectedRoute.duration_min} min</span>
            </div>
          </div>
        </div>

        {/* Distance Badge & Toggle */}
        <div className="px-4 py-3 flex justify-between items-center bg-white/5 border-t border-white/5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Navigation size={12} className="text-text-secondary" />
              <span className="text-xs text-text-secondary font-medium">Distancia:</span>
              <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-full">{selectedRoute.distance_km} km</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSimulate}
              disabled={isSimulating}
              className={clsx(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                isSimulating 
                  ? "bg-success/50 text-white cursor-not-allowed" 
                  : "bg-success hover:bg-success-hover text-white transform active:scale-95"
              )}
            >
              {isSimulating ? 'Viaje en Progreso...' : 'Simular Entrega'}
            </button>

            <button 
              onClick={() => setExpanded(!expanded)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-primary"
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Supply Chain KPIs Section */}
      {expanded && (
        <div className="bg-background/60 border-t border-white/10 p-4 animate-in slide-in-from-top-2 duration-300">
           <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3 opacity-50">Impacto Logístico Estimado</h4>
           <div className="grid grid-cols-2 gap-3">
              {(role === 'admin' || role === 'distributor') && (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                   <div className="p-2 bg-green-500/20 text-green-400 rounded-lg">
                      <Leaf size={16} />
                   </div>
                   <div>
                      <span className="text-[10px] text-text-secondary block uppercase">Emisiones CO2</span>
                      <span className="text-sm font-bold text-white">-15.4%</span>
                   </div>
                </div>
              )}

              {(role === 'admin' || role === 'distributor') && (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                   <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                      <Battery size={16} />
                   </div>
                   <div>
                      <span className="text-[10px] text-text-secondary block uppercase">Eficiencia</span>
                      <span className="text-sm font-bold text-white">Clase A+</span>
                   </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                 <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                    <ShieldCheck size={16} />
                 </div>
                 <div>
                    <span className="text-[10px] text-text-secondary block uppercase">Blockchain</span>
                    <span className="text-sm font-bold text-white">Verificado</span>
                 </div>
              </div>

              {(role === 'admin' || role === 'distributor') && (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                   <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                      <TrendingUp size={16} />
                   </div>
                   <div>
                      <span className="text-[10px] text-text-secondary block uppercase">Fiabilidad</span>
                      <span className="text-sm font-bold text-white">99.2%</span>
                   </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                 <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg">
                    <Award size={16} />
                 </div>
                 <div>
                    <span className="text-[10px] text-text-secondary block uppercase">Satisfacción</span>
                    <span className="text-sm font-bold text-white">4.9/5</span>
                 </div>
              </div>

              {(role === 'admin' || role === 'distributor') && (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                   <div className="p-2 bg-error/20 text-error rounded-lg">
                      <Activity size={16} />
                   </div>
                   <div>
                      <span className="text-[10px] text-text-secondary block uppercase">Desperdicio</span>
                      <span className="text-sm font-bold text-white">1.2%</span>
                   </div>
                </div>
              )}

              {(role === 'admin' || role === 'distributor') && (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                   <div className="p-2 bg-success/20 text-success rounded-lg">
                      <Zap size={16} />
                   </div>
                   <div>
                      <span className="text-[10px] text-text-secondary block uppercase">Ahorro Energía</span>
                      <span className="text-sm font-bold text-white">22%</span>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default MetricsDashboard;
