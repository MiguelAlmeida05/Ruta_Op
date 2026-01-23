import type { ApiError } from '../services/api';

type ErrorFactory = (message: string) => ApiError;

const ALLOWED_EVENT_TYPES = ['rain', 'traffic', 'protest'] as const;
const ALLOWED_PRODUCT_IDS = ['maiz', 'cacao', 'arroz', 'cafe', 'platano', 'mani', 'limon', 'yuca'] as const;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function validateLatLng(lat: number, lng: number): string[] {
  const errors: string[] = [];
  if (!isFiniteNumber(lat)) errors.push('La latitud debe ser un número válido.');
  if (!isFiniteNumber(lng)) errors.push('La longitud debe ser un número válido.');
  if (isFiniteNumber(lat) && (lat < -90 || lat > 90)) errors.push('La latitud debe estar entre -90 y 90.');
  if (isFiniteNumber(lng) && (lng < -180 || lng > 180)) errors.push('La longitud debe estar entre -180 y 180.');
  return errors;
}

export function validateProductId(productId: string): string[] {
  const errors: string[] = [];
  const v = (productId || '').trim().toLowerCase();
  if (!v) errors.push('Selecciona un producto.');
  if (v && !ALLOWED_PRODUCT_IDS.includes(v as (typeof ALLOWED_PRODUCT_IDS)[number]))
    errors.push(`Producto inválido. Usa uno de: ${ALLOWED_PRODUCT_IDS.join(', ')}.`);
  return errors;
}

export function validateEventType(eventType: string): string[] {
  const errors: string[] = [];
  const v = (eventType || '').trim().toLowerCase();
  if (!v) errors.push('El tipo de evento es requerido.');
  if (v && !ALLOWED_EVENT_TYPES.includes(v as (typeof ALLOWED_EVENT_TYPES)[number]))
    errors.push(`Evento inválido. Usa uno de: ${ALLOWED_EVENT_TYPES.join(', ')}.`);
  return errors;
}

export function validateWeightKg(weight: number): string[] {
  const errors: string[] = [];
  if (!isFiniteNumber(weight)) errors.push('El peso debe ser un número válido.');
  if (isFiniteNumber(weight) && weight <= 0) errors.push('El peso debe ser mayor que 0.');
  return errors;
}

export function validateProgress(progress?: number): string[] {
  if (progress === undefined || progress === null) return [];
  const errors: string[] = [];
  if (!isFiniteNumber(progress)) errors.push('El progreso debe ser un número válido.');
  if (isFiniteNumber(progress) && (progress < 0 || progress > 1)) errors.push('El progreso debe estar entre 0 y 1.');
  return errors;
}

export function assertClientValid(errors: string[], createError: ErrorFactory) {
  if (errors.length === 0) return;
  const msg = errors.slice(0, 5).join(' ');
  throw createError(`Validación en cliente: ${msg}`);
}
