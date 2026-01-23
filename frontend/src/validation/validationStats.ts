import type { ValidationStatsResponse } from '../types/modelEvaluation';

type ParseOk<T> = { ok: true; value: T };
type ParseErr = { ok: false; errors: string[]; value?: never };
export type ParseResult<T> = ParseOk<T> | ParseErr;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fieldName: string, errors: string[]): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  errors.push(`Campo inválido: ${fieldName} debe ser numérico.`);
  return null;
}

function toNumberArray(value: unknown, fieldName: string, errors: string[]): number[] | null {
  if (!Array.isArray(value)) {
    errors.push(`Campo inválido: ${fieldName} debe ser un arreglo.`);
    return null;
  }
  const out: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const v = value[i];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (!Number.isFinite(n)) {
      errors.push(`Campo inválido: ${fieldName}[${i}] debe ser numérico.`);
      return null;
    }
    out.push(n);
  }
  return out;
}

export function parseValidationStatsResponse(raw: unknown): ParseResult<ValidationStatsResponse> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['Respuesta inválida: el body debe ser un objeto JSON.'] };

  const routingRaw = raw.routing;
  const simulationRaw = raw.simulation;
  const timestampRaw = raw.timestamp;

  if (!isRecord(routingRaw)) errors.push('Respuesta inválida: routing debe ser un objeto.');
  if (!isRecord(simulationRaw)) errors.push('Respuesta inválida: simulation debe ser un objeto.');
  const timestamp = toNumber(timestampRaw, 'timestamp', errors);

  if (errors.length > 0 || !isRecord(routingRaw) || !isRecord(simulationRaw) || timestamp === null) return { ok: false, errors };

  const routingErrors: string[] = [];
  const simulationErrors: string[] = [];

  const routing: ValidationStatsResponse['routing'] = {
    samples: toNumber(routingRaw.samples, 'routing.samples', routingErrors) ?? 0,
    matches: toNumber(routingRaw.matches, 'routing.matches', routingErrors) ?? 0,
    dijkstra_avg_time_ms: toNumber(routingRaw.dijkstra_avg_time_ms, 'routing.dijkstra_avg_time_ms', routingErrors) ?? 0,
    astar_avg_time_ms: toNumber(routingRaw.astar_avg_time_ms, 'routing.astar_avg_time_ms', routingErrors) ?? 0,
    speedup_factor: toNumber(routingRaw.speedup_factor, 'routing.speedup_factor', routingErrors) ?? 0,
    cost_discrepancy_avg: toNumber(routingRaw.cost_discrepancy_avg, 'routing.cost_discrepancy_avg', routingErrors) ?? 0,
    dijkstra_times_ms: toNumberArray(routingRaw.dijkstra_times_ms, 'routing.dijkstra_times_ms', routingErrors) ?? [],
    astar_times_ms: toNumberArray(routingRaw.astar_times_ms, 'routing.astar_times_ms', routingErrors) ?? [],
    cost_diffs: toNumberArray(routingRaw.cost_diffs, 'routing.cost_diffs', routingErrors) ?? [],
    per_event: isRecord(routingRaw.per_event) ? (routingRaw.per_event as Record<string, unknown>) : undefined
  };

  const simulation: ValidationStatsResponse['simulation'] = {
    n_simulations: toNumber(simulationRaw.n_simulations, 'simulation.n_simulations', simulationErrors) ?? 0,
    mean_duration: toNumber(simulationRaw.mean_duration, 'simulation.mean_duration', simulationErrors) ?? 0,
    std_dev: toNumber(simulationRaw.std_dev, 'simulation.std_dev', simulationErrors) ?? 0,
    cv_percent: toNumber(simulationRaw.cv_percent, 'simulation.cv_percent', simulationErrors) ?? 0,
    ci_95_lower: toNumber(simulationRaw.ci_95_lower, 'simulation.ci_95_lower', simulationErrors) ?? 0,
    ci_95_upper: toNumber(simulationRaw.ci_95_upper, 'simulation.ci_95_upper', simulationErrors) ?? 0,
    mean_punctuality: toNumber(simulationRaw.mean_punctuality, 'simulation.mean_punctuality', simulationErrors) ?? 0,
    durations_sample: toNumberArray(simulationRaw.durations_sample, 'simulation.durations_sample', simulationErrors) ?? [],
    punctuality_sample: toNumberArray(simulationRaw.punctuality_sample, 'simulation.punctuality_sample', simulationErrors) ?? []
  };

  const allErrors = [...routingErrors, ...simulationErrors];
  if (allErrors.length > 0) return { ok: false, errors: allErrors };

  return { ok: true, value: { routing, simulation, timestamp } };
}

