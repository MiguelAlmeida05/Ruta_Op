
import { describe, it, expect } from 'vitest';

// Funciones a probar (replicadas o importadas si se extraen a utilidades)
const formatTime = (totalMinutes: number) => {
  const totalSeconds = Math.floor(totalMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const calculateMetrics = (price: number, weight: number, baseLogistic: number) => {
  const productCost = price * weight;
  const logisticCost = baseLogistic; // Simplificado en Fase 2, fijo por ruta
  return {
    productCost,
    logisticCost,
    total: productCost + logisticCost
  };
};

const calculateRemaining = (total: number, progress: number) => {
  return Math.max(0, total * (1 - progress));
};

const calculateAdminMetrics = (baseValue: number, rate: number = 15) => {
  return {
    platformProfit: baseValue * (rate / 100)
  };
};

describe('Simulation Logic', () => {
  
  describe('Time Formatting', () => {
    it('formats minutes to HH:MM:SS correctly', () => {
      expect(formatTime(65.5)).toBe('01:05:30'); // 1h 5m 30s
      expect(formatTime(10)).toBe('00:10:00');   // 10m 0s
      expect(formatTime(0)).toBe('00:00:00');    // 0s
      expect(formatTime(0.5)).toBe('00:00:30');  // 30s
    });
  });

  describe('Cost Calculation', () => {
    it('calculates total cost correctly', () => {
      const pricePerKg = 2.5;
      const weight = 100;
      const logistic = 15.0;
      
      const metrics = calculateMetrics(pricePerKg, weight, logistic);
      
      expect(metrics.productCost).toBe(250);
      expect(metrics.logisticCost).toBe(15);
      expect(metrics.total).toBe(265);
    });

    it('updates product cost linearly with weight', () => {
      const price = 10;
      const logistic = 5;
      
      expect(calculateMetrics(price, 50, logistic).total).toBe(505);
      expect(calculateMetrics(price, 100, logistic).total).toBe(1005);
    });
  });

  describe('Progress Calculation', () => {
    it('reduces values based on progress percentage', () => {
      const totalDist = 100; // km
      
      expect(calculateRemaining(totalDist, 0)).toBe(100);
      expect(calculateRemaining(totalDist, 0.5)).toBe(50);
      expect(calculateRemaining(totalDist, 1)).toBe(0);
    });

    it('handles floating point precision reasonably', () => {
      const val = calculateRemaining(10, 0.33);
      expect(val).toBeCloseTo(6.7, 1);
    });
  });

  describe('Admin Metrics', () => {
    it('calculates 15% platform profit correctly on provided base', () => {
      // User scenario: Base = 1552.89 (Distributor Profit)
      const baseProfit = 1552.89;
      const metrics = calculateAdminMetrics(baseProfit, 15);
      
      // 1552.89 * 0.15 = 232.9335
      expect(metrics.platformProfit).toBeCloseTo(232.9335, 4);
      expect(Number(metrics.platformProfit.toFixed(2))).toBe(232.93);
    });

    it('updates calculation when rate changes', () => {
      const baseProfit = 1000;
      expect(calculateAdminMetrics(baseProfit, 10).platformProfit).toBe(100);
      expect(calculateAdminMetrics(baseProfit, 20).platformProfit).toBe(200);
    });
  });

});
