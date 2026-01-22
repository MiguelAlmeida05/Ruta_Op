/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RouteResult = {
    seller_id: string;
    seller_name: string;
    seller_rating?: number;
    seller_trips?: number;
    route_geometry: Array<Array<number>>;
    duration_seconds: number;
    distance_meters: number;
    distance_km: number;
    duration_min: number;
    transport_cost?: (number | null);
    estimated_revenue?: (number | null);
    net_profit?: (number | null);
    load_percentage?: (number | null);
    product_image?: (string | null);
    product_name?: (string | null);
    price_per_unit?: (number | null);
    freshness_score?: (number | null);
    punctuality_score?: (number | null);
    satisfaction_score?: (number | null);
    simulation_state?: (Record<string, any> | null);
};

