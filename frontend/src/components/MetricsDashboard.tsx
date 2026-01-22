import React, { useState, useEffect } from 'react';
import { Truck, DollarSign, Clock, TrendingUp, Leaf, Battery, ShieldCheck, ChevronDown, ChevronUp, Navigation, X, Award, Activity, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/formatters';

const MetricsDashboard: React.FC = () => {
  const {
    routes,
    selectedRouteId,
    setShowMetrics,
    showSupplyChain: showTraceability,
    weight,
    setWeight,
    startSimulation: onSimulate,
    isSimulating,
    simulationProgress,
    role,
    globalMetrics
  } = useStore();

  const selectedRoute = routes.find(r => r.seller_id === selectedRouteId) || null;

  const [expanded, setExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [commissionPercentage, setCommissionPercentage] = useState(15);
  const [animatedMetrics, setAnimatedMetrics] = useState({
    time: 0,
    distance: 0
  });

  const getRouteDurationMin = (durationMin?: number) => durationMin || 0;

  const onClose = () => setShowMetrics(false);

  useEffect(() => {
    setIsVisible(true);
  }, [selectedRoute]);

  useEffect(() => {
    if (showTraceability) {
      setExpanded(true);
    }
  }, [showTraceability]);

  // Función para formatear segundos a HH:MM:SS
  // Deprecated: use utils/formatters


  useEffect(() => {
    if (!selectedRoute) {
      setAnimatedMetrics({ time: 0, distance: 0 });
      return;
    }
    const totalTime = getRouteDurationMin(selectedRoute.duration_min);
    const totalDist = selectedRoute?.distance_km || 0;
    // Si inicia la simulación, usamos el progreso real del mapa
    if (isSimulating) {
      // Calcular restantes basado en el progreso (0 a 1)
      const remainingTime = Math.max(0, totalTime * (1 - (simulationProgress || 0)));
      const remainingDist = Math.max(0, totalDist * (1 - (simulationProgress || 0)));
      
      setAnimatedMetrics({
        time: remainingTime,
        distance: remainingDist
      });
    } else {
      // Si no simula, mostrar valores estáticos finales
      setAnimatedMetrics({
        time: totalTime,
        distance: totalDist
      });
    }
  }, [isSimulating, selectedRoute, simulationProgress]);

  if (!selectedRoute || !isVisible) return null;

  // Usar métricas externas (del backend) o calcular locales si no hay
  // Aseguramos que se recalcule si cambia 'weight' (props) aunque no cambie 'selectedRoute'
  // Si externalMetrics viene del backend, ya trae valores calculados para un peso específico.
  // Pero si cambiamos el peso en el frontend sin re-simular, debemos actualizar localmente.
  
  const calculateLocalMetrics = () => {
    const price = selectedRoute.price_per_unit || 0;
    const logistic = selectedRoute.transport_cost || 0; // Este es fijo por ruta/distancia, no depende del peso (simplificación)
    const productCost = price * weight;
    const totalCost = productCost + logistic;
    
    return {
      revenue: productCost, // Para distribuidor
      profit: productCost - logistic, // Simplificado
      product_cost: productCost,
      logistic_cost: logistic,
      total_client_cost: totalCost,
      // Admin Metrics (Calculated locally to ensure consistency with current weight)
      // Base calculation on Distributor Profit (Beneficio) as per user request (15% of 1552.89 ~= 232.93)
      platform_profit: (productCost - logistic) * (commissionPercentage / 100),
      prediction_accuracy: globalMetrics?.prediction_accuracy || 95.0,
      revenue_growth: globalMetrics?.revenue_growth || 12.4,
      avg_time_reduction: globalMetrics?.avg_time_reduction || 18.5
    };
  };

  const localMetrics = calculateLocalMetrics();

  // Si hay métricas externas Y coinciden con el peso actual (esto es difícil de saber sin guardar el peso de la simulación),
  // podríamos usarlas. Pero para reactividad inmediata, mejor usamos el cálculo local basado en el peso actual del estado.
  // Asumiremos que el backend nos da los unitarios y nosotros multiplicamos.
  
  const metrics = localMetrics; 

  // KPIs del cliente (Fase 2)
  const clientKPIs = {
    cost: metrics.total_client_cost,
    time: selectedRoute.duration_min,
    distance: selectedRoute.distance_km,
    punctuality: selectedRoute.punctuality_score || 98.5,
    freshness: selectedRoute.freshness_score || 99,
    satisfaction: selectedRoute.satisfaction_score || 5.0
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
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/200x200/1e1e1e/FFF?text=IMG';
                    }}
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
          <div className="flex justify-center gap-4">
            {(role === 'client' || role === 'admin') && (
              <div className="bg-background/40 p-3 rounded-xl border border-white/5 flex flex-col items-center min-w-[100px]">
                <div className="flex items-center gap-1.5 text-success mb-1">
                  <DollarSign size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Costo Final</span>
                </div>
                <span className="text-sm font-black text-white">${clientKPIs.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}

            {(role === 'distributor') && (
              <div className="bg-primary/20 p-3 rounded-xl border border-primary/20 flex flex-col items-center shadow-inner min-w-[100px]">
                <div className="flex items-center gap-1.5 text-primary mb-1">
                  <TrendingUp size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Beneficio</span>
                </div>
                <span className="text-sm font-black text-white">${metrics.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}

            {role === 'admin' && (
              <div className="bg-primary/20 p-3 rounded-xl border border-primary/20 flex flex-col items-center shadow-inner min-w-[100px] relative group cursor-pointer">
                <div className="flex items-center gap-1.5 text-primary mb-1">
                  <TrendingUp size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Beneficio</span>
                </div>
                <span className="text-sm font-black text-white">${(metrics.platform_profit || 0).toFixed(2)}</span>
                
                {/* Mini controls for percentage */}
                <div className="absolute -bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface border border-white/10 rounded-full p-0.5 shadow-xl scale-75">
                   <button 
                      onClick={(e) => { e.stopPropagation(); setCommissionPercentage(p => Math.max(0, p - 1)); }}
                      className="w-4 h-4 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-[10px]"
                   >-</button>
                   <span className="text-[8px] px-1 flex items-center text-text-secondary">{commissionPercentage}%</span>
                   <button 
                      onClick={(e) => { e.stopPropagation(); setCommissionPercentage(p => Math.min(100, p + 1)); }}
                      className="w-4 h-4 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-[10px]"
                   >+</button>
                </div>
              </div>
            )}

            <div className="bg-background/40 p-3 rounded-xl border border-white/5 flex flex-col items-center min-w-[100px]">
              <div className="flex items-center gap-1.5 text-error mb-1">
                <Clock size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{isSimulating ? 'Tiempo Restante' : 'Tiempo'}</span>
              </div>
              <span className="text-sm font-black text-white">{formatDuration(animatedMetrics.time)}</span>
            </div>
          </div>
        </div>

        {/* Distance Badge & Toggle */}
        <div className="px-4 py-3 flex justify-between items-center bg-white/5 border-t border-white/5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Navigation size={12} className="text-text-secondary" />
              <span className="text-xs text-text-secondary font-medium">{isSimulating ? 'Restante:' : 'Distancia:'}</span>
              <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-full">{animatedMetrics.distance.toFixed(2)} km</span>
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
                    <span className="text-[10px] text-text-secondary block uppercase">Calidad/Frescura</span>
                    <span className="text-sm font-bold text-white">{clientKPIs.freshness}%</span>
                 </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                 <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                    <TrendingUp size={16} />
                 </div>
                 <div>
                    <span className="text-[10px] text-text-secondary block uppercase">Puntualidad</span>
                    <span className="text-sm font-bold text-white">{clientKPIs.punctuality}%</span>
                 </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                 <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg">
                    <Award size={16} />
                 </div>
                 <div>
                    <span className="text-[10px] text-text-secondary block uppercase">Satisfacción</span>
                    <span className="text-sm font-bold text-white">{clientKPIs.satisfaction}/5</span>
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

              {/* Métricas Exclusivas ADMIN */}
              {role === 'admin' && (
                <>
                  <div className="col-span-2 border-t border-white/10 my-2"></div>
                  <h4 className="col-span-2 text-[10px] font-bold text-primary uppercase tracking-widest mb-1 opacity-80">Vista de Administrador</h4>



                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                     <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                        <Activity size={16} />
                     </div>
                     <div>
                        <span className="text-[10px] text-text-secondary block uppercase">Ganancia Total Histórica</span>
                        <span className="text-sm font-bold text-white">$40,543.89</span>
                     </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                     <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                        <Activity size={16} />
                     </div>
                     <div>
                        <span className="text-[10px] text-text-secondary block uppercase">Precisión Predicción</span>
                        <span className="text-sm font-bold text-white">{(metrics.prediction_accuracy || 0).toFixed(1)}%</span>
                     </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                     <div className="p-2 bg-green-500/20 text-green-400 rounded-lg">
                        <TrendingUp size={16} />
                     </div>
                     <div>
                        <span className="text-[10px] text-text-secondary block uppercase">Crecimiento Ingresos</span>
                        <span className="text-sm font-bold text-white">+{(metrics.revenue_growth || 0).toFixed(1)}%</span>
                     </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                     <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                        <Navigation size={16} />
                     </div>
                     <div>
                        <span className="text-[10px] text-text-secondary block uppercase">Reducción Tiempo</span>
                        <span className="text-sm font-bold text-white">{(metrics.avg_time_reduction || 0).toFixed(1)}%</span>
                     </div>
                  </div>
                </>
              )}
           </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default MetricsDashboard;
