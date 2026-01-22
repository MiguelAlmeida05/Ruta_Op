/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RouteResult } from './RouteResult';
import type { SimulationMetrics } from './SimulationMetrics';
export type SimulationResponse = {
    session_id?: (string | null);
    recommended_route?: (RouteResult | null);
    all_routes: Array<RouteResult>;
    metrics: SimulationMetrics;
};

