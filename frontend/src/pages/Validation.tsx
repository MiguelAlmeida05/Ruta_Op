import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Download, 
  Filter, 
  Search,
  FileText,
  Activity,
  Play,
  Info
} from 'lucide-react';
import clsx from 'clsx';

// API URL (same as other components)
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

type ValidationStatus = 'Validado' | 'En Proceso' | 'Pendiente' | 'Rechazado';
type ValidationPriority = 'Alta' | 'Media' | 'Baja' | 'Critica';

interface ValidationItem {
  id: string;
  title: string;
  category: string;
  priority: ValidationPriority;
  status: ValidationStatus;
  date: string;
  metrics: {
    improvement: string;
    metric: string;
  };
  description: string;
}

interface RealTimeStats {
  routing?: {
    speedup_factor?: number;
    cost_discrepancy_avg?: number;
    samples?: number;
    matches?: number;
    error?: string;
  };
  simulation?: {
    cv_percent?: number;
    n_simulations?: number;
    ci_95_lower?: number;
    ci_95_upper?: number;
    error?: string;
  };
}

// Initial Mock Data (used as fallback or history)
const INITIAL_VALIDATIONS: ValidationItem[] = [
  {
    id: 'VAL-001',
    title: 'Optimización Algoritmo Dijkstra',
    category: 'Ruteo',
    priority: 'Alta',
    status: 'Validado',
    date: '2024-03-15',
    metrics: { improvement: '+15%', metric: 'Tiempo de Respuesta' },
    description: 'Mejora en la estructura de datos para reducción de complejidad temporal.'
  },
  {
    id: 'VAL-002',
    title: 'Modelo Predictivo de Lluvia',
    category: 'Simulación',
    priority: 'Media',
    status: 'En Proceso',
    date: '2024-03-18',
    metrics: { improvement: 'Pendiente', metric: 'Precisión' },
    description: 'Implementación de cadenas de Markov para estados climáticos.'
  },
  {
    id: 'VAL-003',
    title: 'Visualización de Rutas 3D',
    category: 'Frontend',
    priority: 'Baja',
    status: 'Pendiente',
    date: '2024-03-20',
    metrics: { improvement: 'N/A', metric: 'UX' },
    description: 'Prototipo de visualización tridimensional para entregas complejas.'
  },
  {
    id: 'VAL-004',
    title: 'Integración API Tráfico Real',
    category: 'Backend',
    priority: 'Alta',
    status: 'Rechazado',
    date: '2024-03-10',
    metrics: { improvement: '-5%', metric: 'Latencia' },
    description: 'La API externa introduce demasiada latencia en el cálculo.'
  },
  {
    id: 'VAL-005',
    title: 'Cache de Rutas Frecuentes',
    category: 'Performance',
    priority: 'Media',
    status: 'Validado',
    date: '2024-03-12',
    metrics: { improvement: '+40%', metric: 'Carga CPU' },
    description: 'Sistema de cache LRU para rutas solicitadas frecuentemente.'
  }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const STATUS_COLORS: Record<ValidationStatus, string> = {
  'Validado': 'text-green-500 bg-green-500/10 border-green-500/20',
  'En Proceso': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  'Pendiente': 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  'Rechazado': 'text-red-500 bg-red-500/10 border-red-500/20'
};

export default function Validation() {
  const navigate = useNavigate();
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [selectedItem, setSelectedItem] = useState<ValidationItem | null>(null);
  const [validations, setValidations] = useState<ValidationItem[]>(INITIAL_VALIDATIONS);
  const [isValidating, setIsValidating] = useState(false);
  const [realTimeStats, setRealTimeStats] = useState<RealTimeStats | null>(null);

  const runLiveValidation = async () => {
    setIsValidating(true);
    try {
      const response = await axios.get(`${API_URL}/validation/stats`);
      setRealTimeStats(response.data);
      
      // Update the "Validations" list with real data results if needed
      // For now, we'll create new items based on the results
      const routingStats = response.data.routing;
      const simStats = response.data.simulation;

      const hasRoutingError = routingStats.error || !routingStats.speedup_factor;
      const hasSimError = simStats.error || simStats.cv_percent === undefined;

      const newItems: ValidationItem[] = [
        {
          id: `VAL-${Date.now()}-1`,
          title: 'Estabilidad de Simulación (Monte Carlo)',
          category: 'Simulación',
          priority: 'Alta',
          status: (!hasSimError && simStats.cv_percent < 15 ? 'Validado' : 'Rechazado') as ValidationStatus,
          date: new Date().toISOString().split('T')[0],
          metrics: { 
            improvement: !hasSimError ? `${simStats.cv_percent}% CV` : 'Error', 
            metric: 'Estabilidad' 
          },
          description: !hasSimError 
            ? `Análisis de estabilidad con ${simStats.n_simulations} iteraciones. Intervalo de Confianza 95%: [${simStats.ci_95_lower}, ${simStats.ci_95_upper}] min.`
            : `Error en simulación: ${simStats.error || 'Datos no disponibles'}`
        },
        {
          id: `VAL-${Date.now()}-2`,
          title: 'Coherencia Dijkstra vs A*',
          category: 'Ruteo',
          priority: 'Critica',
          status: (!hasRoutingError && routingStats.matches === routingStats.samples ? 'Validado' : 'Rechazado') as ValidationStatus,
          date: new Date().toISOString().split('T')[0],
          metrics: { 
            improvement: !hasRoutingError ? `${routingStats.speedup_factor.toFixed(2)}x` : 'Error', 
            metric: 'Speedup A*' 
          },
          description: !hasRoutingError
            ? `Prueba de coherencia en ${routingStats.samples} rutas aleatorias. Discrepancia media de costo: ${routingStats.cost_discrepancy_avg.toFixed(6)}.`
            : `Error en ruteo: ${routingStats.error || 'Grafo no cargado'}`
        }
      ];
      
      setValidations(prev => [...newItems, ...prev]);
      setSelectedItem(newItems[0]); // Select the first new item

    } catch (error) {
      console.error("Error executing live validation:", error);
      alert("Error ejecutando validación en vivo. Ver consola.");
    } finally {
      setIsValidating(false);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = validations.length;
    const validated = validations.filter(v => v.status === 'Validado').length;
    const pending = validations.filter(v => v.status === 'Pendiente' || v.status === 'En Proceso').length;
    const rejected = validations.filter(v => v.status === 'Rechazado').length;
    return { total, validated, pending, rejected };
  }, [validations]);

  // Filtered Data
  const filteredData = useMemo(() => {
    return validations.filter(item => {
      const matchesText = item.title.toLowerCase().includes(filterText.toLowerCase()) || 
                          item.id.toLowerCase().includes(filterText.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' || item.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [filterText, statusFilter, validations]);

  // Chart Data
  const chartData = useMemo(() => {
    const data = [
      { name: 'Validado', value: stats.validated },
      { name: 'En Proceso', value: stats.pending },
      { name: 'Rechazado', value: stats.rejected }
    ];
    return data.filter(d => d.value > 0);
  }, [stats]);

  const handleExport = () => {
    const headers = ['ID', 'Título', 'Categoría', 'Prioridad', 'Estado', 'Fecha', 'Mejora'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        item.id,
        item.title,
        item.category,
        item.priority,
        item.status,
        item.date,
        item.metrics.improvement
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'validacion_sistema.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col">
      {/* Header */}
      <header className="h-16 bg-surface border-b border-border flex items-center px-6 gap-4 sticky top-0 z-20 shadow-md">
        <button 
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-secondary hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Activity className="text-primary" size={20} />
            Validación y Explicabilidad del Sistema
          </h1>
          <span className="text-xs text-text-secondary">Panel de Control de Mejoras y Pruebas</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
           <button 
            onClick={runLiveValidation}
            disabled={isValidating}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors shadow-sm",
              isValidating && "opacity-50 cursor-not-allowed"
            )}
          >
            {isValidating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <Play size={16} />
                Ejecutar Validación en Vivo
              </>
            )}
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-md text-sm transition-colors"
          >
            <Download size={16} />
            Exportar Reporte
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
        
        {/* Real-time Stats Banner (if available) */}
        {realTimeStats && (
          <div className="lg:col-span-12 bg-surface p-4 rounded-xl border border-green-500/30 bg-green-500/5 animate-in slide-in-from-top-4">
             <div className="flex flex-col md:flex-row gap-8 justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-full text-green-400">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Validación en Tiempo Real Completada</h3>
                    <p className="text-sm text-text-secondary">
                      Algoritmos de ruteo y motor de simulación verificados.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-8 text-center">
                  <div>
                    <span className="text-xs text-text-secondary uppercase font-bold">Speedup A*</span>
                    <p className="text-2xl font-bold text-primary">
                      {realTimeStats.routing?.speedup_factor 
                        ? `${realTimeStats.routing.speedup_factor.toFixed(2)}x` 
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-text-secondary uppercase font-bold">Confianza Sim.</span>
                    <p className="text-2xl font-bold text-primary">
                      {realTimeStats.simulation?.cv_percent !== undefined
                        ? `${(100 - realTimeStats.simulation.cv_percent).toFixed(1)}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-text-secondary uppercase font-bold">Discrepancia Costo</span>
                    <p className="text-2xl font-bold text-primary">
                      {realTimeStats.routing?.cost_discrepancy_avg !== undefined
                        ? realTimeStats.routing.cost_discrepancy_avg.toFixed(6)
                        : "N/A"}
                    </p>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-text-secondary text-xs uppercase font-bold tracking-wider">Total Mejoras</p>
                <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                <FileText size={20} />
              </div>
            </div>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-text-secondary text-xs uppercase font-bold tracking-wider">Validado</p>
                <h3 className="text-2xl font-bold mt-1 text-green-400">{stats.validated}</h3>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                <CheckCircle size={20} />
              </div>
            </div>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-text-secondary text-xs uppercase font-bold tracking-wider">En Proceso</p>
                <h3 className="text-2xl font-bold mt-1 text-yellow-400">{stats.pending}</h3>
              </div>
              <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400">
                <Clock size={20} />
              </div>
            </div>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-text-secondary text-xs uppercase font-bold tracking-wider">Rechazado</p>
                <h3 className="text-2xl font-bold mt-1 text-red-400">{stats.rejected}</h3>
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                <XCircle size={20} />
              </div>
            </div>
          </div>
        </div>


        {/* Filters and List */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-surface p-4 rounded-xl border border-white/5 shadow-sm flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por ID o título..." 
                className="w-full bg-background border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <select 
                  className="bg-background border border-white/10 rounded-lg py-2 pl-10 pr-8 text-sm focus:outline-none focus:border-primary/50 appearance-none cursor-pointer min-w-[150px]"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="Todos">Todos los Estados</option>
                  <option value="Validado">Validado</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-white/5 shadow-sm overflow-hidden flex-1 min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-background/50 text-text-secondary uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-semibold">ID / Título</th>
                    <th className="px-6 py-4 font-semibold">Categoría</th>
                    <th className="px-6 py-4 font-semibold">Estado</th>
                    <th className="px-6 py-4 font-semibold">Resultados</th>
                    <th className="px-6 py-4 font-semibold text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredData.map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{item.title}</span>
                          <span className="text-xs text-text-secondary">{item.id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "px-2 py-1 rounded-full text-xs font-medium border flex w-fit items-center gap-1",
                          STATUS_COLORS[item.status]
                        )}>
                          {item.status === 'Validado' && <CheckCircle size={10} />}
                          {item.status === 'Rechazado' && <XCircle size={10} />}
                          {(item.status === 'En Proceso' || item.status === 'Pendiente') && <Clock size={10} />}
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold">{item.metrics.improvement}</span>
                          <span className="text-xs text-text-secondary">{item.metrics.metric}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                            // Scroll to details panel on mobile/tablet if needed, or just highlight
                            const detailsPanel = document.getElementById('details-panel');
                            if (detailsPanel) {
                              detailsPanel.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="text-primary hover:text-primary-hover text-xs font-medium"
                        >
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredData.length === 0 && (
              <div className="p-8 text-center text-text-secondary">
                No se encontraron resultados para los filtros aplicados.
              </div>
            )}
          </div>
        </div>

        {/* Details & Charts Panel */}
        <div id="details-panel" className="lg:col-span-4 flex flex-col gap-6">
          {/* Chart */}
          <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
            <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-text-secondary">Distribución de Estados</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#212121', borderColor: '#424242', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Details */}
          {selectedItem ? (
            <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm flex-1 animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg">{selectedItem.title}</h3>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="lg:hidden p-1 hover:bg-white/10 rounded-full"
                >
                  <XCircle size={20} className="text-text-secondary" />
                </button>
                <span className="hidden lg:inline-block text-xs text-text-secondary border border-white/10 px-2 py-1 rounded">
                  {selectedItem.id}
                </span>
              </div>
              <span className="lg:hidden text-xs text-text-secondary border border-white/10 px-2 py-1 rounded mb-4 inline-block">
                  {selectedItem.id}
              </span>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-secondary uppercase font-bold block mb-1">Descripción</label>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {selectedItem.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-background rounded-lg border border-white/5">
                    <label className="text-xs text-text-secondary block mb-1">Prioridad</label>
                    <span className={clsx(
                      "font-bold text-sm",
                      selectedItem.priority === 'Alta' ? "text-red-400" : 
                      selectedItem.priority === 'Media' ? "text-yellow-400" : "text-green-400"
                    )}>
                      {selectedItem.priority}
                    </span>
                  </div>
                  <div className="p-3 bg-background rounded-lg border border-white/5">
                    <label className="text-xs text-text-secondary block mb-1">Fecha</label>
                    <span className="font-bold text-sm">{selectedItem.date}</span>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                    <Activity size={14} />
                    Resultado de Validación
                  </h4>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-end border-b border-primary/10 pb-3">
                      <div>
                        <span className="text-xs text-text-secondary block mb-1">Métrica Evaluada:</span>
                        <span className="text-sm font-medium bg-primary/10 px-2 py-1 rounded text-primary-hover">
                          {selectedItem.metrics.metric}
                        </span>
                      </div>
                      <div className="text-right">
                         <span className="text-xs text-text-secondary block mb-1">Impacto / Resultado:</span>
                         <span className="text-2xl font-bold">{selectedItem.metrics.improvement}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 text-xs text-text-secondary bg-background/50 p-2 rounded">
                       <Info size={14} className="shrink-0 mt-0.5 text-primary" />
                       <p>
                         {selectedItem.status === 'Validado' 
                           ? "Esta mejora ha superado los umbrales de aceptación y es segura para producción."
                           : selectedItem.status === 'Rechazado'
                           ? "La mejora no cumple con los criterios mínimos de rendimiento o estabilidad."
                           : "Validación en curso. Se requieren más datos para una conclusión definitiva."}
                       </p>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Estado Final:</span>
                        <span className={clsx(
                          "px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1",
                          STATUS_COLORS[selectedItem.status]
                        )}>
                          {selectedItem.status === 'Validado' && <CheckCircle size={12} />}
                          {selectedItem.status === 'Rechazado' && <XCircle size={12} />}
                          {(selectedItem.status === 'En Proceso' || selectedItem.status === 'Pendiente') && <Clock size={12} />}
                          {selectedItem.status}
                        </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-text-secondary uppercase font-bold block mb-2">Feedback / Observaciones</label>
                  <textarea 
                    className="w-full bg-background border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-primary/50 min-h-[100px] resize-none"
                    placeholder="Ingrese observaciones sobre esta validación..."
                  />
                  <button className="mt-2 w-full py-2 bg-white/5 hover:bg-white/10 text-text rounded-md text-sm transition-colors border border-white/5">
                    Guardar Observación
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface p-8 rounded-xl border border-white/5 shadow-sm flex-1 flex flex-col items-center justify-center text-text-secondary text-center">
              <FileText size={48} className="mb-4 opacity-20" />
              <p>Seleccione un elemento de la lista para ver sus detalles y registrar feedback.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
