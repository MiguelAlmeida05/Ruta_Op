// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useSimulationController } from '../useSimulationController';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RouteResult } from '../../types';
import { recalculateRoute } from '../../services/api';
import React from 'react';
import L from 'leaflet';

// Mock api
vi.mock('../../services/api', () => ({
  recalculateRoute: vi.fn(),
}));

describe('useSimulationController', () => {
  const mockVehicleMarkerRef = { current: { setLatLng: vi.fn() } } as unknown as React.RefObject<L.Marker>;

  const mockRoute: RouteResult = {
    seller_id: 'seller1',
    seller_name: 'Seller 1',
    route_geometry: [[0, 0], [0, 1], [0, 2]],
    distance_km: 10,
    duration_min: 20,
    distance_meters: 10000,
    duration_seconds: 1200,
    price_per_unit: 5,
    product_name: 'Test Product',
  } as RouteResult;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Mock default response for recalculateRoute
    (recalculateRoute as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      route_geometry: [[0, 0], [0, 1]],
      distance_km: 5,
      duration_min: 10,
      event_applied: 'none'
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with null states', () => {
    const { result } = renderHook(() => useSimulationController({
      isSimulating: false,
      selectedRoute: null,
      vehicleMarkerRef: mockVehicleMarkerRef
    }));

    expect(result.current.activeEvent).toBeNull();
    expect(result.current.dynamicPath).toBeNull();
  });

  it('should start simulation when isSimulating is true and route provided', () => {
    renderHook(() => useSimulationController({
      isSimulating: true,
      selectedRoute: mockRoute,
      vehicleMarkerRef: mockVehicleMarkerRef
    }));

    // Advance timers to trigger first interval tick
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockVehicleMarkerRef.current?.setLatLng).toHaveBeenCalled();
  });

  it('should call onProgressUpdate during simulation', () => {
    const onProgressUpdate = vi.fn();
    renderHook(() => useSimulationController({
      isSimulating: true,
      selectedRoute: mockRoute,
      onProgressUpdate,
      vehicleMarkerRef: mockVehicleMarkerRef
    }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onProgressUpdate).toHaveBeenCalled();
  });

  it('should call onSimulationEnd when finished', () => {
    // Mock random to avoid events
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const onSimulationEnd = vi.fn();
    // Short route to finish quickly
    const shortRoute = { ...mockRoute, route_geometry: [[0,0], [0,1]] as [number, number][] };
    
    renderHook(() => useSimulationController({
      isSimulating: true,
      selectedRoute: shortRoute,
      onSimulationEnd,
      vehicleMarkerRef: mockVehicleMarkerRef
    }));

    act(() => {
      // 2 points, 50ms interval. 
      // Step 0: pos 0.
      // Step 1: pos 1.
      // Step 2: end.
      vi.advanceTimersByTime(200);
    });

    expect(onSimulationEnd).toHaveBeenCalled();
  });
});
