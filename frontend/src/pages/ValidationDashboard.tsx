import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  ScatterChart,
  Scatter
} from 'recharts';
import { FormulaInline } from '../components/FormulaInline';
import { ArrowLeft, BarChart3, Boxes, Download, Info, Radar as RadarIcon, Route, Sigma, Timer } from 'lucide-react';
import {
  evaluateDemandModelFast,
  evaluateEtaModel,
  evaluateImpactModel,
  getDemandModelsStatus,
  getEtaModelStatus,
  getImpactModelStatus,
  getProducts,
  getValidationStats
} from '../services/api';
import type { Product } from '../types';
import type { DemandModelEvaluationFastResponse, DemandModelsStatusResponse, EtaModelEvaluationResponse, EtaModelStatusResponse, ImpactEvaluateResponse, ImpactModelStatusResponse, ValidationStatsResponse } from '../types/modelEvaluation';

type SectionId = 'overview' | 'routing' | 'montecarlo' | 'eta' | 'impact' | 'demand' | 'products';

type CheckStatus = 'ok' | 'warn' | 'fail';

interface ValidationCheck {
  id: string;
  area: string;
  name: string;
  status: CheckStatus;
  value: string;
  details: string;
}

const PRODUCT_IDS = ['maiz', 'cacao', 'arroz', 'cafe', 'platano', 'mani', 'limon', 'yuca'] as const;

function statusBadge(status: CheckStatus) {
  const base = 'px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider';
  if (status === 'ok') return `${base} text-green-400 bg-green-500/10 border-green-500/20`;
  if (status === 'warn') return `${base} text-yellow-400 bg-yellow-500/10 border-yellow-500/20`;
  return `${base} text-red-400 bg-red-500/10 border-red-500/20`;
}

function fmtPct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function basename(path: string | null | undefined) {
  if (!path) return null;
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || null;
}

function histogram(values: number[], bins: number) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return [];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (min === max) return [{ bin: `${min.toFixed(3)}`, count: clean.length }];
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0) as number[];
  for (const v of clean) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step)));
    counts[idx] += 1;
  }
  return counts.map((count, i) => {
    const a = min + i * step;
    const b = a + step;
    return { bin: `${a.toFixed(3)}–${b.toFixed(3)}`, count };
  });
}

function buildRocOverlay(curves: Record<string, Array<{ fpr: number; tpr: number }>>, steps: number) {
  const grid = Array.from({ length: steps }, (_, i) => i / (steps - 1));
  const interpolate = (curve: Array<{ fpr: number; tpr: number }>, x: number) => {
    const pts = (curve || []).slice().sort((a, b) => a.fpr - b.fpr);
    if (!pts.length) return 0;
    if (x <= pts[0].fpr) return pts[0].tpr;
    if (x >= pts[pts.length - 1].fpr) return pts[pts.length - 1].tpr;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (x <= b.fpr) {
        const t = (x - a.fpr) / Math.max(1e-9, b.fpr - a.fpr);
        return a.tpr + t * (b.tpr - a.tpr);
      }
    }
    return pts[pts.length - 1].tpr;
  };

  return grid.map((fpr) => {
    const row: Record<string, number> = { fpr };
    for (const [key, curve] of Object.entries(curves)) row[key] = interpolate(curve, fpr);
    return row;
  });
}

const tooltipBaseProps = {
  cursor: false as const,
  wrapperStyle: { outline: 'none' },
  contentStyle: {
    backgroundColor: 'rgba(17,24,39,0.92)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
    color: '#FFFFFF'
  },
  labelStyle: { color: '#E5E7EB', fontWeight: 800, marginBottom: 4 },
  itemStyle: { color: '#E5E7EB' }
};

export default function ValidationDashboard() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionId>('overview');

  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [demandStatus, setDemandStatus] = useState<DemandModelsStatusResponse | null>(null);

  const [routingStats, setRoutingStats] = useState<ValidationStatsResponse['routing'] | null>(null);
  const [simStats, setSimStats] = useState<ValidationStatsResponse['simulation'] | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [etaStatus, setEtaStatus] = useState<EtaModelStatusResponse | null>(null);
  const [etaEval, setEtaEval] = useState<EtaModelEvaluationResponse | null>(null);

  const [impactStatus, setImpactStatus] = useState<ImpactModelStatusResponse | null>(null);
  const [impactEval, setImpactEval] = useState<ImpactEvaluateResponse | null>(null);

  const [demandEvals, setDemandEvals] = useState<Record<string, DemandModelEvaluationFastResponse | null>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [
          productsRes,
          validationRes,
          etaStatusRes,
          etaEvalRes,
          impactStatusRes,
          impactEvalRes
        ] = await Promise.allSettled([
          getProducts(),
          getValidationStats(),
          getEtaModelStatus(),
          evaluateEtaModel({ n_samples: 1200, sample_points: 200 }),
          getImpactModelStatus(),
          evaluateImpactModel({ n_samples: 7000, sample_points: 250 })
        ]);

        if (cancelled) return;

        if (productsRes.status === 'fulfilled') setProducts(productsRes.value);
        if (validationRes.status === 'fulfilled') {
          setRoutingStats(validationRes.value.routing ?? null);
          setSimStats(validationRes.value.simulation ?? null);
          setValidationError(null);
        } else {
          const reason = validationRes.reason as unknown;
          const messageFromReason =
            reason && typeof reason === 'object' && 'message' in reason ? (reason as Record<string, unknown>).message : undefined;
          const message =
            typeof messageFromReason === 'string'
              ? messageFromReason
              : reason instanceof Error
                ? reason.message
                : 'No se pudo cargar /api/validation/stats';
          setValidationError(message);
        }
        if (etaStatusRes.status === 'fulfilled') setEtaStatus(etaStatusRes.value);
        if (etaEvalRes.status === 'fulfilled') setEtaEval(etaEvalRes.value);
        if (impactStatusRes.status === 'fulfilled') setImpactStatus(impactStatusRes.value);
        if (impactEvalRes.status === 'fulfilled') setImpactEval(impactEvalRes.value);

        const evals = await Promise.allSettled(
          PRODUCT_IDS.map((product) => evaluateDemandModelFast({ product, lookback_days: 365, test_days: 30 }))
        );
        if (cancelled) return;
        const map: Record<string, DemandModelEvaluationFastResponse | null> = {};
        PRODUCT_IDS.forEach((pid, idx) => {
          map[pid] = evals[idx].status === 'fulfilled' ? evals[idx].value : null;
        });
        setDemandEvals(map);
        const demandStatusRes = await Promise.allSettled([getDemandModelsStatus()]);
        if (!cancelled && demandStatusRes[0].status === 'fulfilled') setDemandStatus(demandStatusRes[0].value);
        setLoadedAt(Date.now());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const checks: ValidationCheck[] = useMemo(() => {
    const out: ValidationCheck[] = [];

    if (routingStats) {
      const speedup = Number(routingStats.speedup_factor ?? 0);
      const discrepancy = Number(routingStats.cost_discrepancy_avg ?? 0);
      const matches = Number(routingStats.matches ?? 0);
      const samples = Number(routingStats.samples ?? 0);
      const okMatch = samples > 0 && matches === samples;
      out.push({
        id: 'routing-consistency',
        area: 'Ruteo',
        name: 'Coherencia Dijkstra vs A*',
        status: okMatch ? 'ok' : 'fail',
        value: okMatch ? '100% match' : `${matches}/${samples}`,
        details: `Valida que ambos algoritmos encuentren el mismo costo/solución en rutas aleatorias. Métricas: samples, matches, discrepancia promedio de costo y speedup.`
      });
      out.push({
        id: 'routing-speedup',
        area: 'Ruteo',
        name: 'Speedup A*',
        status: speedup >= 1.0 ? 'ok' : speedup >= 0.6 ? 'warn' : 'fail',
        value: `${speedup.toFixed(2)}x`,
        details: `Speedup = tiempo_promedio(Dijkstra) / tiempo_promedio(A*). Valores > 1 indican mejora real.`
      });
      out.push({
        id: 'routing-discrepancy',
        area: 'Ruteo',
        name: 'Discrepancia de costo',
        status: discrepancy <= 1e-4 ? 'ok' : discrepancy <= 1e-2 ? 'warn' : 'fail',
        value: discrepancy.toFixed(6),
        details: `Promedio |costo(Dijkstra) - costo(A*)|. Debe tender a 0 si ambos usan el mismo weight y heurística admisible.`
      });
    }

    if (simStats) {
      const cv = Number(simStats.cv_percent ?? NaN);
      out.push({
        id: 'mc-stability',
        area: 'Monte Carlo',
        name: 'Estabilidad de simulación',
        status: !Number.isFinite(cv) ? 'fail' : cv <= 15 ? 'ok' : cv <= 25 ? 'warn' : 'fail',
        value: Number.isFinite(cv) ? `${cv.toFixed(2)}% CV` : 'N/A',
        details: `CV = (std / media) * 100. Mide estabilidad del motor estocástico. Incluye IC 95% para duración.`
      });
    }

    if (etaEval?.metrics) {
      out.push({
        id: 'eta-regression',
        area: 'Modelo ETA',
        name: 'Calidad (MAE/RMSE/R²)',
        status: etaEval.metrics.r2 >= 0.75 ? 'ok' : etaEval.metrics.r2 >= 0.5 ? 'warn' : 'fail',
        value: `R² ${etaEval.metrics.r2.toFixed(3)}`,
        details: `Valida desempeño de regresión del modelo ETA (XGBoost). Features: distancia, clima, tráfico, hora/día.`
      });
      if (etaEval.classification) {
        out.push({
          id: 'eta-classification',
          area: 'Modelo ETA',
          name: 'Clasificación (Late vs OnTime)',
          status: etaEval.classification.roc_auc >= 0.7 ? 'ok' : etaEval.classification.roc_auc >= 0.6 ? 'warn' : 'fail',
          value: `AUC ${etaEval.classification.roc_auc.toFixed(3)}`,
          details: `Binarización técnica: late si y_true/base_duration > threshold_ratio. Se reporta matriz y curva ROC.`
        });
      }
    }

    if (impactEval?.metrics_by_target_test) {
      const r2Mean = Object.values(impactEval.cv_r2 || {}).reduce((acc, v) => acc + (v?.r2_mean ?? 0), 0) / Math.max(1, Object.keys(impactEval.cv_r2 || {}).length);
      out.push({
        id: 'impact-generalization',
        area: 'Modelo Impacto',
        name: 'Generalización (CV R²)',
        status: r2Mean >= 0.7 ? 'ok' : r2Mean >= 0.5 ? 'warn' : 'fail',
        value: `R² mean ${r2Mean.toFixed(3)}`,
        details: `Evita overfitting: se reporta train vs test por target y CV estratificado por escenario.`
      });
    }

    const haveAllDemand = PRODUCT_IDS.every((p) => !!demandEvals[p]);
    out.push({
      id: 'demand-coverage',
      area: 'Demanda',
      name: 'Cobertura (8 productos)',
      status: haveAllDemand ? 'ok' : 'warn',
      value: haveAllDemand ? '8/8' : `${PRODUCT_IDS.filter((p) => !!demandEvals[p]).length}/8`,
      details: `Evalúa Prophet por producto con holdout rápido (sin cross_validation).`
    });

    return out;
  }, [routingStats, simStats, etaEval, impactEval, demandEvals]);

  const checksByArea = useMemo(() => {
    const map: Record<string, ValidationCheck[]> = {};
    for (const c of checks) {
      map[c.area] = map[c.area] || [];
      map[c.area].push(c);
    }
    return map;
  }, [checks]);

  const coverage = useMemo(() => {
    const counts = { ok: 0, warn: 0, fail: 0 };
    for (const c of checks) counts[c.status] += 1;
    const total = Math.max(1, counts.ok + counts.warn + counts.fail);
    const pct = counts.ok / total;
    return { ...counts, total, pct };
  }, [checks]);

  const coverageDonut = useMemo(() => {
    return [
      { name: 'OK', value: coverage.ok, color: '#34D399' },
      { name: 'WARN', value: coverage.warn, color: '#FBBF24' },
      { name: 'FAIL', value: coverage.fail, color: '#F87171' }
    ].filter((d) => d.value > 0);
  }, [coverage]);

  const areaRadar = useMemo(() => {
    const areas = Object.keys(checksByArea);
    return areas.map((a) => {
      const items = checksByArea[a] || [];
      const scoreRaw =
        items.reduce((acc, it) => acc + (it.status === 'ok' ? 1 : it.status === 'warn' ? 0.6 : 0), 0) / Math.max(1, items.length);
      return { area: a, score: Math.round(scoreRaw * 100) };
    });
  }, [checksByArea]);

  const routingEventCoverage = useMemo(() => {
    const raw = (routingStats as unknown as Record<string, unknown> | null)?.per_event;
    if (!raw || typeof raw !== 'object') return [];
    const obj = raw as Record<string, unknown>;
    return Object.entries(obj).map(([event, v]) => {
      const item = (v && typeof v === 'object' ? (v as Record<string, unknown>) : {}) as Record<string, unknown>;
      const matches = Number(item.matches ?? 0);
      const valid = Number(item.valid ?? 0);
      const pct = valid > 0 ? (matches / valid) * 100.0 : 0;
      return {
        event,
        pct,
        speedup: Number(item.speedup_factor ?? 0),
        dijkstra_ms: Number(item.dijkstra_avg_time_ms ?? 0),
        astar_ms: Number(item.astar_avg_time_ms ?? 0)
      };
    });
  }, [routingStats]);

  const hasRoutingStats = Boolean(routingStats && Number(routingStats.samples ?? 0) > 0);
  const hasSimStats = Boolean(simStats && Array.isArray(simStats.durations_sample) && simStats.durations_sample.length > 1);

  const handleExport = () => {
    const headers = ['ID', 'Área', 'Nombre', 'Estado', 'Valor', 'Detalles'];
    const csv = [headers.join(','), ...checks.map((c) => [c.id, c.area, c.name, c.status, c.value, JSON.stringify(c.details)].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'validacion_sistema.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sections: Array<{ id: SectionId; label: string; subtitle: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Resumen', subtitle: 'Cobertura y señales', icon: <BarChart3 size={16} /> },
    { id: 'routing', label: 'Ruteo', subtitle: 'Dijkstra vs A*', icon: <Route size={16} /> },
    { id: 'montecarlo', label: 'Monte Carlo', subtitle: 'Robustez', icon: <Sigma size={16} /> },
    { id: 'eta', label: 'ETA', subtitle: 'XGBoost', icon: <Timer size={16} /> },
    { id: 'impact', label: 'Impacto', subtitle: 'XGBoost', icon: <RadarIcon size={16} /> },
    { id: 'demand', label: 'Demanda', subtitle: 'Prophet', icon: <BarChart3 size={16} /> },
    { id: 'products', label: 'Productos', subtitle: 'Catálogo', icon: <Boxes size={16} /> }
  ];

  return (
    <div className="min-h-screen bg-background text-text flex flex-col">
      <header className="h-16 bg-surface border-b border-border flex items-center px-6 gap-4 sticky top-0 z-20 shadow-md">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-text-secondary hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold flex items-center gap-2">Validación del Sistema</h1>
          <span className="text-xs text-text-secondary">
            {loadedAt ? `Snapshot: ${new Date(loadedAt).toLocaleString()}` : 'Snapshot: cargando…'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as SectionId)}
            className="bg-background border border-white/10 rounded-md px-3 py-2 text-sm text-white"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-md text-sm transition-colors"
          >
            <Download size={16} />
            Exportar
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
        <aside className="lg:col-span-3 bg-surface rounded-xl border border-white/5 shadow-sm p-4">
          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-3">Navegación</div>
          <div className="space-y-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={clsx(
                  'w-full text-left px-3 py-2.5 rounded-xl border transition-colors relative overflow-hidden',
                  section === s.id
                    ? 'bg-primary/15 border-primary/30 text-white'
                    : 'bg-background/30 border-white/5 hover:bg-white/5 text-text-secondary hover:text-white'
                )}
              >
                <div
                  className={clsx(
                    'absolute left-0 top-0 bottom-0 w-1',
                    section === s.id ? 'bg-primary' : 'bg-transparent'
                  )}
                />
                <div className="flex items-center gap-3">
                  <div className={clsx('p-2 rounded-lg border', section === s.id ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white/5 border-white/10 text-text-secondary')}>
                    {s.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black">{s.label}</div>
                    <div className="text-[11px] text-text-secondary">{s.subtitle}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 bg-background/30 rounded-lg border border-white/5 p-3">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-primary shrink-0 mt-0.5" />
              <div className="text-[11px] text-text-secondary leading-relaxed space-y-1">
                <div>Este panel valida ruteo, simulación y modelos.</div>
                <div>Cada métrica incluye definición técnica, parámetros evaluados y umbrales.</div>
                <div>Datos: SQLite local · Modelos: artefactos en disco.</div>
              </div>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
              <div className="text-sm text-text-secondary">Cargando validaciones…</div>
            </div>
          ) : (
            <>
              {section === 'overview' && (
                <div className="space-y-6">
                  {validationError && (
                    <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-200">
                      <div className="font-black text-white">No se pudieron cargar algunas validaciones</div>
                      <div className="text-[12px] text-red-200/90 mt-1 leading-6">
                        {validationError}. Esto afecta métricas y gráficos de <span className="font-bold text-white">Ruteo</span> y{' '}
                        <span className="font-bold text-white">Monte Carlo</span>.
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="text-xs text-text-secondary uppercase font-bold tracking-wider">Cobertura</div>
                          <div className="text-xl font-black text-white">Validaciones ejecutadas</div>
                          <div className="text-sm text-text-secondary mt-1 leading-6 max-w-prose">
                            Cobertura = porcentaje de checks en estado OK. WARN y FAIL señalan brechas o degradaciones que requieren atención.
                          </div>
                        </div>
                        <div className={statusBadge(coverage.fail > 0 ? 'fail' : coverage.warn > 0 ? 'warn' : 'ok')}>
                          {coverage.fail > 0 ? 'Crítico' : coverage.warn > 0 ? 'Atención' : 'Listo'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div className="relative h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <defs>
                                <linearGradient id="gradOk" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#34D399" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.95} />
                                </linearGradient>
                                <linearGradient id="gradWarn" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.95} />
                                </linearGradient>
                                <linearGradient id="gradFail" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#F87171" stopOpacity={0.95} />
                                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0.95} />
                                </linearGradient>
                              </defs>
                              <Pie
                                data={coverageDonut}
                                dataKey="value"
                                nameKey="name"
                                innerRadius="68%"
                                outerRadius="92%"
                                paddingAngle={3}
                                isAnimationActive={false}
                              >
                                {coverageDonut.map((entry) => (
                                  <Cell
                                    key={entry.name}
                                    fill={entry.name === 'OK' ? 'url(#gradOk)' : entry.name === 'WARN' ? 'url(#gradWarn)' : 'url(#gradFail)'}
                                    stroke="rgba(0,0,0,0.2)"
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const p0 = payload[0];
                                  const name = typeof p0?.name === 'string' ? p0.name : String(p0?.name ?? '');
                                  const value = typeof p0?.value === 'number' ? p0.value : Number(p0?.value ?? 0);
                                  return (
                                    <div className="bg-surface border border-white/10 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                                      <div className="font-bold">{name}</div>
                                      <div className="text-text-secondary">{value} checks</div>
                                    </div>
                                  );
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="text-3xl font-black text-white">{Math.round(coverage.pct * 100)}%</div>
                            <div className="text-[11px] text-text-secondary">Cobertura OK</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="bg-background/40 rounded-lg border border-white/5 p-3 flex items-center justify-between">
                            <div className="text-sm font-bold text-white">OK</div>
                            <div className="text-sm font-black text-green-400">{coverage.ok}</div>
                          </div>
                          <div className="bg-background/40 rounded-lg border border-white/5 p-3 flex items-center justify-between">
                            <div className="text-sm font-bold text-white">WARN</div>
                            <div className="text-sm font-black text-yellow-400">{coverage.warn}</div>
                          </div>
                          <div className="bg-background/40 rounded-lg border border-white/5 p-3 flex items-center justify-between">
                            <div className="text-sm font-bold text-white">FAIL</div>
                            <div className="text-sm font-black text-red-400">{coverage.fail}</div>
                          </div>
                          <div className="text-[11px] text-text-secondary">
                            Total: <span className="text-white font-bold">{coverage.total}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="text-xs text-text-secondary uppercase font-bold tracking-wider">Mapa</div>
                          <div className="text-xl font-black text-white">Cobertura por dominio</div>
                          <div className="text-sm text-text-secondary mt-1 leading-6 max-w-prose">
                            Radar de cobertura por área. OK suma más puntaje que WARN y FAIL, útil para detectar zonas débiles.
                          </div>
                        </div>
                      </div>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={areaRadar}>
                            <PolarGrid stroke="rgba(255,255,255,0.08)" />
                            <PolarAngleAxis dataKey="area" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <Radar dataKey="score" stroke="#60A5FA" fill="#60A5FA" fillOpacity={0.25} isAnimationActive={false} />
                            <Tooltip
                              cursor={false}
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const p0 = payload[0];
                                const raw = p0?.payload;
                                const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
                                const area = typeof obj.area === 'string' ? obj.area : '';
                                const score = Number(obj.score ?? 0);
                                return (
                                  <div className="bg-surface border border-white/10 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                                    <div className="font-bold">{area}</div>
                                    <div className="text-text-secondary">Score {score}/100</div>
                                  </div>
                                );
                              }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-1">Ruteo</div>
                      <div className="text-lg font-black text-white mb-3">Dijkstra vs A*</div>
                      <div className="h-36">
                        {hasRoutingStats ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={[
                                {
                                  name: 'ms',
                                  dijkstra: Number(routingStats?.dijkstra_avg_time_ms ?? 0),
                                  astar: Number(routingStats?.astar_avg_time_ms ?? 0)
                                }
                              ]}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Bar dataKey="dijkstra" fill="#A78BFA" radius={[8, 8, 0, 0]} isAnimationActive={false} activeBar={false} />
                              <Bar dataKey="astar" fill="#60A5FA" radius={[8, 8, 0, 0]} isAnimationActive={false} activeBar={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center rounded-lg border border-white/5 bg-background/30 text-sm text-text-secondary">
                            Sin datos de ruteo
                          </div>
                        )}
                      </div>
                      <div className="mt-3 text-sm text-text-secondary leading-6">
                        {hasRoutingStats ? (
                          <>
                            Speedup <span className="text-white font-bold">{Number(routingStats?.speedup_factor ?? 0).toFixed(2)}x</span> · Matches{' '}
                            <span className="text-white font-bold">
                              {routingStats?.matches ?? 0}/{routingStats?.samples ?? 0}
                            </span>
                          </>
                        ) : (
                          <span className="text-text-secondary">Verifica `/api/validation/stats` y carga del grafo</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-1">Monte Carlo</div>
                      <div className="text-lg font-black text-white mb-3">Estabilidad</div>
                      <div className="h-36">
                        {hasSimStats ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={(simStats?.durations_sample || []).map((v, i) => ({ i, v }))}>
                              <defs>
                                <linearGradient id="mcGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#34D399" stopOpacity={0.35} />
                                  <stop offset="100%" stopColor="#34D399" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis dataKey="i" hide />
                              <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Area type="monotone" dataKey="v" stroke="#34D399" fill="url(#mcGrad)" strokeWidth={2} isAnimationActive={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center rounded-lg border border-white/5 bg-background/30 text-sm text-text-secondary">
                            Sin datos de simulación
                          </div>
                        )}
                      </div>
                      <div className="mt-3 text-sm text-text-secondary leading-6">
                        {hasSimStats ? (
                          <>
                            CV <span className="text-white font-bold">{Number(simStats?.cv_percent ?? 0).toFixed(2)}%</span> · IC 95%{' '}
                            <span className="text-white font-bold">
                              [{Number(simStats?.ci_95_lower ?? 0).toFixed(2)}, {Number(simStats?.ci_95_upper ?? 0).toFixed(2)}]
                            </span>
                          </>
                        ) : (
                          <span className="text-text-secondary">Verifica `/api/validation/stats`</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-1">Modelos</div>
                      <div className="text-lg font-black text-white mb-3">Generalización</div>
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'ETA', r2: Number(etaEval?.metrics?.r2 ?? 0) },
                              { name: 'Impacto', r2: Number(impactEval?.cv_r2?.duration_min?.r2_mean ?? 0) }
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} domain={[0, 1]} />
                            <Tooltip {...tooltipBaseProps} />
                            <Bar dataKey="r2" fill="#60A5FA" radius={[8, 8, 0, 0]} isAnimationActive={false} activeBar={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 text-sm text-text-secondary leading-6">
                        Objetivo: R² realista (0.85–0.93) sin gap excesivo train/test.
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Checklist</div>
                    <div className="space-y-4" role="list">
                      {Object.entries(checksByArea).map(([area, items]) => {
                        const okCount = items.filter((i) => i.status === 'ok').length;
                        const warnCount = items.filter((i) => i.status === 'warn').length;
                        const score = items.reduce((acc, i) => acc + (i.status === 'ok' ? 1 : i.status === 'warn' ? 0.5 : 0), 0);
                        const pct = items.length > 0 ? Math.round((score / items.length) * 100) : 0;
                        const id = `area-${area.toLowerCase().replace(/\s+/g, '-')}`;
                        return (
                          <section key={area} aria-labelledby={id} className="bg-background/30 rounded-xl border border-white/5 p-5">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                              <div className="min-w-0">
                                <h3 id={id} className="text-base font-black text-white">
                                  {area}
                                </h3>
                                <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden" aria-hidden="true">
                                  <div className="h-2 bg-green-500/60" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="text-[11px] text-text-secondary mt-1">
                                  Cobertura: <span className="text-white font-bold">{pct}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={statusBadge(score === items.length ? 'ok' : score > 0 ? 'warn' : 'fail')}>
                                  {score === items.length ? 'OK' : score > 0 ? 'Atención' : 'Crítico'}
                                </span>
                                <div className="text-[11px] text-text-secondary">
                                  <span className="text-white font-bold">{okCount}</span>/{items.length} OK
                                  {warnCount > 0 ? (
                                    <>
                                      {' '}
                                      · <span className="text-white font-bold">{warnCount}</span> Warn
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {items.map((c) => (
                                <article
                                  key={c.id}
                                  className="bg-background/40 rounded-xl border border-white/5 p-4 focus-within:border-primary/30"
                                  aria-label={`${area}: ${c.name}`}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={statusBadge(c.status)}>{c.status}</span>
                                        <div className="text-sm font-bold text-white">{c.name}</div>
                                      </div>
                                      <div className="text-[12px] text-text-secondary leading-6 mt-2">{c.details}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="text-sm font-black text-white">{c.value}</div>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {section === 'routing' && (
                <div className="space-y-6">
                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xl font-black text-white">Validación de Ruteo</div>
                        <div className="text-sm text-text-secondary leading-6 mt-1 space-y-1">
                          <div>
                            Compara Dijkstra vs A* usando el mismo peso (travel_time) para asegurar coherencia de costos y medir la ganancia real de
                            performance.
                          </div>
                          <div>
                            Parámetros validados: <span className="text-white font-bold">samples</span>,{' '}
                            <span className="text-white font-bold">matches</span>, <span className="text-white font-bold">speedup_factor</span>,{' '}
                            <span className="text-white font-bold">cost_discrepancy_avg</span>.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!hasRoutingStats && (
                    <div role="alert" className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-100">
                      <div className="font-black text-white">Sin métricas de ruteo</div>
                      <div className="text-[12px] mt-1 leading-6 text-yellow-100/90">
                        No hay muestras válidas o no se pudo cargar la validación. Revisa el endpoint <span className="font-mono text-white">/api/validation/stats</span>{' '}
                        y la carga del grafo.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">Speedup (A*)</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {hasRoutingStats ? `${Number(routingStats?.speedup_factor ?? 0).toFixed(2)}x` : '—'}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-1">Mayor es mejor</div>
                    </div>
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">Equivalencia</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {hasRoutingStats ? `${routingStats?.matches ?? 0}/${routingStats?.samples ?? 0}` : '—'}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-1">Matches / Samples</div>
                    </div>
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">Δ Costo</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {hasRoutingStats ? Number(routingStats?.cost_discrepancy_avg ?? 0).toFixed(6) : '—'}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-1">Ideal cercano a 0</div>
                    </div>
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">Tiempos</div>
                      <div className="text-[11px] text-text-secondary mt-1 leading-6">
                        Dijkstra{' '}
                        <span className="text-white font-bold">
                          {hasRoutingStats ? `${Number(routingStats?.dijkstra_avg_time_ms ?? 0).toFixed(2)}ms` : '—'}
                        </span>
                        <br />
                        A* <span className="text-white font-bold">{hasRoutingStats ? `${Number(routingStats?.astar_avg_time_ms ?? 0).toFixed(2)}ms` : '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Comparativa</div>
                      <div className="h-56">
                        {hasRoutingStats ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={[
                                {
                                  name: 'Promedio (ms)',
                                  dijkstra: Number(routingStats?.dijkstra_avg_time_ms ?? 0),
                                  astar: Number(routingStats?.astar_avg_time_ms ?? 0)
                                }
                              ]}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Bar dataKey="dijkstra" fill="#A78BFA" radius={[10, 10, 0, 0]} isAnimationActive={false} activeBar={false} />
                              <Bar dataKey="astar" fill="#60A5FA" radius={[10, 10, 0, 0]} isAnimationActive={false} activeBar={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center rounded-lg border border-white/5 bg-background/30 text-sm text-text-secondary">
                            Sin datos
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-text-secondary leading-6 mt-2">
                        Fórmula:{' '}
                        <FormulaInline latex={'$S = \\frac{t_D}{t_{A*}}$'} ariaLabel="Fórmula de speedup" className="inline-flex align-middle" /> (speedup). Valores mayores implican menor
                        tiempo promedio de A*.
                      </div>
                    </div>

                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Muestras</div>
                      <div className="h-56">
                        {hasRoutingStats ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={(routingStats?.dijkstra_times_ms || []).map((v, i) => ({
                                i,
                                dijkstra: v,
                                astar: routingStats?.astar_times_ms?.[i] ?? null
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis dataKey="i" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Line type="monotone" dataKey="dijkstra" stroke="#A78BFA" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                              <Line type="monotone" dataKey="astar" stroke="#60A5FA" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center rounded-lg border border-white/5 bg-background/30 text-sm text-text-secondary">
                            Sin datos
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-text-secondary leading-6 mt-2">
                        Línea por consulta. Sirve para ver varianza y outliers en tiempos de ejecución (no solo el promedio).
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Cobertura bajo eventos</div>
                    <div className="h-56">
                      {routingEventCoverage.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={routingEventCoverage}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="event" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip
                              {...tooltipBaseProps}
                              formatter={(value: unknown, name: unknown) => {
                                if (name === 'pct') return [`${Number(value).toFixed(1)}%`, 'Match %'];
                                return [String(value), String(name)];
                              }}
                              labelFormatter={(label: unknown) => `Evento: ${String(label)}`}
                            />
                            <Bar dataKey="pct" fill="#34D399" radius={[10, 10, 0, 0]} isAnimationActive={false} activeBar={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center rounded-lg border border-white/5 bg-background/30 text-sm text-text-secondary">
                          Sin datos
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-text-secondary leading-6 mt-2">
                      Match % mide coherencia de optimalidad:{' '}
                      <FormulaInline latex={'$\\Delta C = |C_D - C_{A*}|$'} ariaLabel="Fórmula de diferencia de costo" className="inline-flex align-middle" /> y se cuenta
                      match si <FormulaInline latex={'$\\Delta C < 10^{-6}$'} ariaLabel="Criterio de match" className="inline-flex align-middle" />.
                    </div>
                  </div>

                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Distribución de Δ Costo</div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histogram(routingStats?.cost_diffs || [], 10)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="bin" tick={{ fill: '#9CA3AF', fontSize: 10 }} hide />
                          <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} allowDecimals={false} />
                          <Tooltip {...tooltipBaseProps} />
                          <Bar dataKey="count" fill="#34D399" radius={[10, 10, 0, 0]} isAnimationActive={false} activeBar={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-sm text-text-secondary leading-6 mt-2">
                      Si la discrepancia se concentra cerca de 0, el ruteo es coherente y A* mantiene optimalidad con heurística admisible.
                    </div>
                  </div>
                </div>
              )}

              {section === 'montecarlo' && (
                <div className="space-y-6">
                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xl font-black text-white">Monte Carlo / Estabilidad</div>
                        <div className="text-sm text-text-secondary leading-6 mt-1 space-y-1">
                          <div>
                            Evalúa robustez del motor estocástico ejecutando múltiples simulaciones en el mismo escenario y midiendo variabilidad.
                          </div>
                          <div>
                            Métricas clave: <span className="text-white font-bold">CV%</span> (variabilidad relativa) e{' '}
                            <span className="text-white font-bold">IC 95%</span> (precisión del promedio estimado).
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!hasSimStats && (
                    <div role="alert" className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-100">
                      <div className="font-black text-white">Sin datos de Monte Carlo</div>
                      <div className="text-[12px] mt-1 leading-6 text-yellow-100/90">
                        No se pudo obtener la serie de simulaciones. Revisa <span className="font-mono text-white">/api/validation/stats</span>.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">Iteraciones</div>
                      <div className="text-2xl font-black text-white mt-1">{hasSimStats ? Number(simStats?.n_simulations ?? 0) : '—'}</div>
                    </div>
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">Media (min)</div>
                      <div className="text-2xl font-black text-white mt-1">{hasSimStats ? Number(simStats?.mean_duration ?? 0).toFixed(2) : '—'}</div>
                    </div>
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">Std (min)</div>
                      <div className="text-2xl font-black text-white mt-1">{hasSimStats ? Number(simStats?.std_dev ?? 0).toFixed(2) : '—'}</div>
                    </div>
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">CV %</div>
                      <div className="text-2xl font-black text-white mt-1">{hasSimStats ? `${Number(simStats?.cv_percent ?? 0).toFixed(2)}%` : '—'}</div>
                    </div>
                    <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-[10px] text-text-secondary font-bold uppercase">IC 95%</div>
                      <div className="text-sm font-black text-white mt-2 leading-6">
                        {hasSimStats ? (
                          <>
                            [{Number(simStats?.ci_95_lower ?? 0).toFixed(2)}, {Number(simStats?.ci_95_upper ?? 0).toFixed(2)}]
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Serie (duración)</div>
                      <div className="h-56">
                        {hasSimStats ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={(simStats?.durations_sample || []).map((v, i) => ({ i, v }))}>
                              <defs>
                                <linearGradient id="mcDurGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.35} />
                                  <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis dataKey="i" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Area type="monotone" dataKey="v" stroke="#60A5FA" fill="url(#mcDurGrad)" strokeWidth={2} isAnimationActive={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center rounded-lg border border-white/5 bg-background/30 text-sm text-text-secondary">
                            Sin datos
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-text-secondary leading-6 mt-2">
                        Esta serie permite detectar deriva, colas largas o inestabilidad en el motor.
                      </div>
                    </div>

                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Distribución (duración)</div>
                      <div className="h-56">
                        {hasSimStats ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histogram(simStats?.durations_sample || [], 14)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis dataKey="bin" tick={{ fill: '#9CA3AF', fontSize: 10 }} hide />
                              <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} allowDecimals={false} />
                              <Tooltip {...tooltipBaseProps} />
                              <Bar dataKey="count" fill="#34D399" radius={[10, 10, 0, 0]} isAnimationActive={false} activeBar={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center rounded-lg border border-white/5 bg-background/30 text-sm text-text-secondary">
                            Sin datos
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-text-secondary leading-6 mt-2">
                        Histograma para ver dispersión y forma (asimetrías) sin depender solo del promedio.
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Serie (puntualidad)</div>
                    <div className="h-44">
                      {hasSimStats ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={(simStats?.punctuality_sample || []).map((v, i) => ({ i, v }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="i" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} domain={[0, 100]} />
                            <Tooltip {...tooltipBaseProps} />
                            <Line type="monotone" dataKey="v" stroke="#FBBF24" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center rounded-lg border border-white/5 bg-background/30 text-sm text-text-secondary">
                          Sin datos
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-text-secondary leading-6 mt-2">
                      Puntualidad promedio:{' '}
                      <span className="text-white font-bold">{hasSimStats ? Number(simStats?.mean_punctuality ?? 0).toFixed(1) : '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {section === 'eta' && (
                <div className="space-y-6">
                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xl font-black text-white">ETA (XGBoost)</div>
                        <div className="text-sm text-text-secondary leading-6 mt-1 space-y-1">
                          <div>Regresión del tiempo estimado (min). Evalúa MAE/RMSE/R² y un diagnóstico ROC derivado para casos “Late”.</div>
                          <div>
                            Entradas principales: <span className="text-white font-bold">base_duration_min</span>,{' '}
                            <span className="text-white font-bold">distance_km</span>, <span className="text-white font-bold">rain_intensity</span>,{' '}
                            <span className="text-white font-bold">traffic_level</span>.
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={statusBadge(etaStatus?.model_loaded ? 'ok' : 'fail')}>{etaStatus?.model_loaded ? 'Modelo cargado' : 'No cargado'}</span>
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider text-text-secondary bg-background/30 border-white/10">
                            {basename(etaStatus?.model_path) || 'eta_xgboost_v1.pkl'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {etaEval?.metrics && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                        <div className="text-[10px] text-text-secondary font-bold uppercase">MAE (min)</div>
                        <div className="text-2xl font-black text-white mt-1">{etaEval.metrics.mae.toFixed(2)}</div>
                      </div>
                      <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                        <div className="text-[10px] text-text-secondary font-bold uppercase">RMSE (min)</div>
                        <div className="text-2xl font-black text-white mt-1">{etaEval.metrics.rmse.toFixed(2)}</div>
                      </div>
                      <div className="bg-surface p-5 rounded-xl border border-white/5 shadow-sm">
                        <div className="text-[10px] text-text-secondary font-bold uppercase">R²</div>
                        <div className="text-2xl font-black text-white mt-1">{etaEval.metrics.r2.toFixed(3)}</div>
                        <div className="text-[11px] text-text-secondary mt-1">Objetivo: 0.85–0.93</div>
                      </div>
                    </div>
                  )}

                  {etaEval?.classification && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                        <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-2">Matriz de confusión</div>
                        <div className="text-sm text-text-secondary mb-3">
                          Late si <span className="text-white font-bold">y_true/base_duration</span> &gt;{' '}
                          <span className="text-white font-bold">{etaEval.classification.threshold_ratio.toFixed(2)}</span>.
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[12px] text-text-secondary">
                          <div />
                          <div className="text-center">Pred 0</div>
                          <div className="text-center">Pred 1</div>
                          <div className="text-right pr-1">Real 0</div>
                          <div className="text-center text-white font-black">{etaEval.classification.confusion_matrix.tn}</div>
                          <div className="text-center text-white font-black">{etaEval.classification.confusion_matrix.fp}</div>
                          <div className="text-right pr-1">Real 1</div>
                          <div className="text-center text-white font-black">{etaEval.classification.confusion_matrix.fn}</div>
                          <div className="text-center text-white font-black">{etaEval.classification.confusion_matrix.tp}</div>
                        </div>
                        <div className="mt-3 text-sm text-text-secondary">
                          Precision <span className="text-white font-bold">{fmtPct(etaEval.classification.precision)}</span> · Recall{' '}
                          <span className="text-white font-bold">{fmtPct(etaEval.classification.recall)}</span> · F1{' '}
                          <span className="text-white font-bold">{fmtPct(etaEval.classification.f1)}</span>
                        </div>
                      </div>

                      <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-text-secondary uppercase font-bold tracking-wider">ROC</div>
                          <div className="text-xs text-text-secondary font-bold uppercase tracking-wider">AUC {etaEval.classification.roc_auc.toFixed(3)}</div>
                        </div>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={etaEval.classification.roc_curve}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis type="number" dataKey="fpr" domain={[0, 1]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis type="number" dataKey="tpr" domain={[0, 1]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Line type="monotone" dataKey="tpr" stroke="#60A5FA" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-sm text-text-secondary leading-6 mt-2">
                          Útil cuando necesitas clasificar rutas con alta probabilidad de retraso, incluso si el modelo es de regresión.
                        </div>
                      </div>
                    </div>
                  )}

                  {etaEval?.sample_points && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                        <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Predicción vs realidad</div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis type="number" dataKey="y_true" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis type="number" dataKey="y_pred" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Scatter data={etaEval.sample_points} fill="#60A5FA" isAnimationActive={false} />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                        <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Diagnóstico de residuales</div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={histogram(
                                (etaEval.sample_points || []).map((p) => Number(p.y_pred) - Number(p.y_true)),
                                14
                              )}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis dataKey="bin" hide />
                              <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} allowDecimals={false} />
                              <Tooltip {...tooltipBaseProps} />
                              <Bar dataKey="count" fill="#A78BFA" radius={[10, 10, 0, 0]} isAnimationActive={false} activeBar={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-sm text-text-secondary leading-6 mt-2">
                          Residual = pred − real. Si la distribución es muy estrecha y R² muy alto, puede indicar datos demasiado “perfectos”.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {section === 'impact' && (
                <div className="space-y-6">
                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xl font-black text-white">Impacto (XGBoost multi-output)</div>
                        <div className="text-sm text-text-secondary leading-6 mt-1 space-y-1">
                          <div>
                            Predice KPIs logísticos: duración, CO2, eficiencia, frescura, puntualidad, satisfacción, desperdicio y ahorro energético.
                          </div>
                          <div>
                            Diagnóstico anti-overfitting: <span className="text-white font-bold">train vs test</span>,{' '}
                            <span className="text-white font-bold">CV estratificado</span> y <span className="text-white font-bold">por escenario</span>.
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={statusBadge(impactStatus?.model_loaded ? 'ok' : 'fail')}>{impactStatus?.model_loaded ? 'Modelo cargado' : 'No cargado'}</span>
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider text-text-secondary bg-background/30 border-white/10">
                            {basename(impactStatus?.model_path) || 'impact_xgboost_v1.pkl'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {impactEval?.metrics_by_target_test && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                        <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">R² train vs test</div>
                        <div className="h-[420px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={Object.keys(impactEval.metrics_by_target_test).map((k) => ({
                                target: k.replace(/_/g, ' '),
                                train: Number(impactEval.metrics_by_target_train?.[k]?.r2 ?? 0),
                                test: Number(impactEval.metrics_by_target_test?.[k]?.r2 ?? 0),
                                gap: Number(impactEval.metrics_by_target_train?.[k]?.r2 ?? 0) - Number(impactEval.metrics_by_target_test?.[k]?.r2 ?? 0),
                                cv: Number(impactEval.cv_r2?.[k]?.r2_mean ?? 0)
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis type="number" domain={[0, 1]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis type="category" dataKey="target" width={110} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Bar dataKey="train" fill="#A78BFA" radius={[0, 10, 10, 0]} isAnimationActive={false} activeBar={false} />
                              <Bar dataKey="test" fill="#60A5FA" radius={[0, 10, 10, 0]} isAnimationActive={false} activeBar={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-sm text-text-secondary leading-6 mt-2">
                          Gap alto (train ≫ test) sugiere overfitting. Objetivo: R² realista (0.85–0.93) con gaps moderados.
                        </div>
                      </div>

                      <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                        <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Generalización (CV estratificado)</div>
                        <div className="h-[420px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={Object.keys(impactEval.metrics_by_target_test).map((k) => ({
                                target: k.replace(/_/g, ' '),
                                cv: Number(impactEval.cv_r2?.[k]?.r2_mean ?? 0),
                                gap: Number(impactEval.metrics_by_target_train?.[k]?.r2 ?? 0) - Number(impactEval.metrics_by_target_test?.[k]?.r2 ?? 0)
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                              <XAxis type="number" domain={[0, 1]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <YAxis type="category" dataKey="target" width={110} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                              <Tooltip {...tooltipBaseProps} />
                              <Bar dataKey="cv" fill="#34D399" radius={[0, 10, 10, 0]} isAnimationActive={false} activeBar={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-sm text-text-secondary leading-6 mt-2">
                          CV usa folds estratificados por escenario. Si CV cae mucho vs test, revisa dataset y regularización.
                        </div>
                      </div>
                    </div>
                  )}

                  {impactEval?.classifications && (
                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div>
                          <div className="text-xs text-text-secondary uppercase font-bold tracking-wider">ROC comparativo</div>
                          <div className="text-lg font-black text-white">Criterios operativos (binarios)</div>
                        </div>
                      </div>

                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={buildRocOverlay(
                              Object.fromEntries(Object.entries(impactEval.classifications).map(([k, v]) => [k, v.roc_curve])),
                              60
                            )}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis type="number" dataKey="fpr" domain={[0, 1]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <YAxis type="number" domain={[0, 1]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                            <Tooltip {...tooltipBaseProps} />
                            <Line type="monotone" dataKey="on_time" stroke="#60A5FA" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                            <Line type="monotone" dataKey="fresh_high" stroke="#34D399" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                            <Line type="monotone" dataKey="efficiency_high" stroke="#A78BFA" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                            <Line type="monotone" dataKey="waste_low" stroke="#FBBF24" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="text-sm text-text-secondary leading-6 mt-2">
                        Propósito: medir la capacidad de separación del modelo para decisiones (por ejemplo, “puntualidad alta” o “desperdicio bajo”), no solo
                        su error promedio.
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                        {Object.entries(impactEval.classifications).map(([key, c]) => {
                          const meta =
                            key === 'on_time'
                              ? { title: 'ROC: Puntualidad (≥ 90)', def: 'punctuality_score ≥ 90' }
                              : key === 'fresh_high'
                                ? { title: 'ROC: Frescura alta (≥ 90)', def: 'freshness_score ≥ 90' }
                                : key === 'efficiency_high'
                                  ? { title: 'ROC: Eficiencia alta (≥ 80)', def: 'efficiency_score ≥ 80' }
                                  : { title: 'ROC: Desperdicio bajo (≤ 10)', def: 'waste_percent ≤ 10' };
                          return (
                            <div key={key} className="bg-background/40 rounded-xl border border-white/5 p-5">
                              <div className="flex items-start justify-between gap-4 mb-2">
                                <div>
                                  <div className="text-sm font-black text-white">{meta.title}</div>
                                  <div className="text-[11px] text-text-secondary">{meta.def}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] text-text-secondary">AUC</div>
                                  <div className="text-lg font-black text-white">{c.roc_auc.toFixed(3)}</div>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-1 text-[12px] text-text-secondary mb-3">
                                <div />
                                <div className="text-center">Pred 0</div>
                                <div className="text-center">Pred 1</div>
                                <div className="text-right pr-1">Real 0</div>
                                <div className="text-center text-white font-black">{c.confusion_matrix.tn}</div>
                                <div className="text-center text-white font-black">{c.confusion_matrix.fp}</div>
                                <div className="text-right pr-1">Real 1</div>
                                <div className="text-center text-white font-black">{c.confusion_matrix.fn}</div>
                                <div className="text-center text-white font-black">{c.confusion_matrix.tp}</div>
                              </div>

                              <div className="text-sm text-text-secondary">
                                Precision <span className="text-white font-bold">{fmtPct(c.precision)}</span> · Recall{' '}
                                <span className="text-white font-bold">{fmtPct(c.recall)}</span> · F1{' '}
                                <span className="text-white font-bold">{fmtPct(c.f1)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {impactEval?.scenario_metrics_test && (
                    <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                      <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">R² por escenario (test)</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(impactEval.scenario_metrics_test).map(([scenario, byTarget]) => (
                          <div key={scenario} className="bg-background/40 rounded-xl border border-white/5 p-5">
                            <div className="text-base font-black text-white mb-3">{scenario}</div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
                              {Object.entries(byTarget).map(([k, m]) => (
                                <div key={k}>
                                  {k.replace(/_/g, ' ')}: <span className="text-white font-bold">{m.r2.toFixed(3)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {section === 'demand' && (
                <div className="space-y-6">
                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xl font-black text-white">Demanda (Prophet)</div>
                        <div className="text-sm text-text-secondary leading-6 mt-1 space-y-1">
                          <div>Evaluación holdout por producto, usando histórico diario desde SQLite (orders). Si falta el modelo, se entrena automáticamente.</div>
                          <div>Se reportan RMSE/MAE/MAPE y una serie comparativa Real vs Pred.</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={statusBadge((demandStatus?.models || []).filter((m) => m.model_file_present).length === 8 ? 'ok' : 'warn')}>
                            Modelos {(demandStatus?.models || []).filter((m) => m.model_file_present).length}/8
                          </span>
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider text-text-secondary bg-background/30 border-white/10">
                            Fuente: sqlite.orders
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Comparativa (sMAPE por producto)</div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={PRODUCT_IDS.map((pid) => ({
                            product: pid,
                            smape: demandEvals[pid]?.metrics?.smape_pct ?? demandEvals[pid]?.metrics?.mape_pct ?? null
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="product" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                          <Tooltip {...tooltipBaseProps} />
                          <Bar dataKey="smape" fill="#60A5FA" radius={[10, 10, 0, 0]} isAnimationActive={false} activeBar={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-sm text-text-secondary leading-6 mt-2">
                      sMAPE reduce explosiones cuando la demanda real es pequeña. Fórmula:{' '}
                      <FormulaInline
                        latex={'$\\mathrm{sMAPE}=\\frac{2|y-\\hat{y}|}{|y|+|\\hat{y}|}$'}
                        ariaLabel="Fórmula de sMAPE"
                        className="inline-flex align-middle"
                      />
                      .
                    </div>
                  </div>

                  <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-xs text-text-secondary uppercase font-bold tracking-wider mb-3">Detalle por producto</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {PRODUCT_IDS.map((pid) => {
                        const ev = demandEvals[pid];
                        const modelOk = (demandStatus?.models || []).find((m) => m.product === pid)?.model_file_present ?? false;
                        return (
                          <div key={pid} className="bg-background/40 rounded-xl border border-white/5 p-5">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <div className="text-base font-black text-white">{pid}</div>
                                <div className="text-[11px] text-text-secondary">{ev?.data_source ?? 'N/A'}</div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className={statusBadge(modelOk ? 'ok' : 'warn')}>{modelOk ? 'Modelo OK' : 'Entrenando'}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                              <div className="bg-background/50 rounded-lg border border-white/5 p-3">
                                <div className="text-[10px] text-text-secondary font-bold uppercase">RMSE</div>
                                <div className="text-lg font-black text-white">{ev ? Number(ev.metrics.rmse).toFixed(2) : 'N/A'}</div>
                              </div>
                              <div className="bg-background/50 rounded-lg border border-white/5 p-3">
                                <div className="text-[10px] text-text-secondary font-bold uppercase">MAE</div>
                                <div className="text-lg font-black text-white">{ev ? Number(ev.metrics.mae).toFixed(2) : 'N/A'}</div>
                              </div>
                              <div className="bg-background/50 rounded-lg border border-white/5 p-3">
                                <div className="text-[10px] text-text-secondary font-bold uppercase">sMAPE</div>
                                <div className="text-lg font-black text-white">
                                  {ev ? `${Number(ev.metrics.smape_pct ?? ev.metrics.mape_pct).toFixed(2)}%` : 'N/A'}
                                </div>
                              </div>
                              <div className="bg-background/50 rounded-lg border border-white/5 p-3">
                                <div className="text-[10px] text-text-secondary font-bold uppercase">R²</div>
                                <div className="text-lg font-black text-white">{ev ? Number(ev.metrics.r2 ?? 0).toFixed(3) : 'N/A'}</div>
                              </div>
                            </div>

                            <div className="h-44">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={ev?.sample_points || []}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                  <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 10 }} hide />
                                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                                  <Tooltip {...tooltipBaseProps} />
                                  <Line type="monotone" dataKey="y" stroke="#34D399" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                                  <Line type="monotone" dataKey="yhat" stroke="#60A5FA" dot={false} activeDot={false} strokeWidth={2} isAnimationActive={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {section === 'products' && (
                <div className="bg-surface p-6 rounded-xl border border-white/5 shadow-sm space-y-4">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="text-lg font-bold text-white">Productos (8) y precios</div>
                      <div className="text-sm text-text-secondary">Fuente: base de datos SQLite local (seed inicial) y API `/api/products`.</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-text-secondary">
                          <th className="py-2 pr-4">Imagen</th>
                          <th className="py-2 pr-4">ID</th>
                          <th className="py-2 pr-4">Nombre</th>
                          <th className="py-2 pr-4">Precio</th>
                          <th className="py-2 pr-4">Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={p.id} className="border-t border-white/5">
                            <td className="py-2 pr-4">
                              <img
                                src={p.image_url || `/assets/products/${p.id}.jpg`}
                                alt={p.name}
                                className="w-10 h-10 rounded-lg object-cover border border-white/10 bg-background/40"
                                loading="lazy"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  img.onerror = null;
                                  img.src = `/assets/products/${p.id}.jpg`;
                                }}
                              />
                            </td>
                            <td className="py-2 pr-4 text-white font-medium">{p.id}</td>
                            <td className="py-2 pr-4 text-white">{p.name}</td>
                            <td className="py-2 pr-4 text-white">{Number(p.price_per_unit).toFixed(2)}</td>
                            <td className="py-2 pr-4 text-text-secondary">{p.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-sm text-text-secondary leading-6">
                    Muestra: catálogo de productos con imagen (para identificación rápida) + precio/ unidad usados en simulaciones y estimaciones.
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

