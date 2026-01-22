/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DemandForecastResponse } from '../models/DemandForecastResponse';
import type { POIListResponse } from '../models/POIListResponse';
import type { ProductListResponse } from '../models/ProductListResponse';
import type { RecalculateRequest } from '../models/RecalculateRequest';
import type { RecalculateResponse } from '../models/RecalculateResponse';
import type { SellerListResponse } from '../models/SellerListResponse';
import type { SimulationRequest } from '../models/SimulationRequest';
import type { SimulationResponse } from '../models/SimulationResponse';
import type { ValidationStatsResponse } from '../models/ValidationStatsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Health Check
     * @returns any Successful Response
     * @throws ApiError
     */
    public static healthCheckHealthGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/health',
        });
    }
    /**
     * Recalculate Route
     * @param requestBody
     * @returns RecalculateResponse Successful Response
     * @throws ApiError
     */
    public static recalculateRouteApiRoutesRecalculatePost(
        requestBody: RecalculateRequest,
    ): CancelablePromise<RecalculateResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/routes/recalculate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Root
     * @returns any Successful Response
     * @throws ApiError
     */
    public static rootGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/',
        });
    }
    /**
     * Get Products
     * @returns ProductListResponse Successful Response
     * @throws ApiError
     */
    public static getProductsApiProductsGet(): CancelablePromise<ProductListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/products',
        });
    }
    /**
     * Get Sellers
     * @param productId
     * @returns SellerListResponse Successful Response
     * @throws ApiError
     */
    public static getSellersApiSellersGet(
        productId?: (string | null),
    ): CancelablePromise<SellerListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/sellers',
            query: {
                'product_id': productId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Pois
     * @param category
     * @returns POIListResponse Successful Response
     * @throws ApiError
     */
    public static getPoisApiPoisGet(
        category?: (string | null),
    ): CancelablePromise<POIListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/pois',
            query: {
                'category': category,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Simulate Routes
     * @param requestBody
     * @returns SimulationResponse Successful Response
     * @throws ApiError
     */
    public static simulateRoutesApiRoutesSimulatePost(
        requestBody: SimulationRequest,
    ): CancelablePromise<SimulationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/routes/simulate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Validation Stats
     * @returns ValidationStatsResponse Successful Response
     * @throws ApiError
     */
    public static getValidationStatsApiValidationStatsGet(): CancelablePromise<ValidationStatsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/validation/stats',
        });
    }
    /**
     * Get Demand Forecast
     * @param product
     * @param days
     * @returns DemandForecastResponse Successful Response
     * @throws ApiError
     */
    public static getDemandForecastApiDemandForecastGet(
        product: string,
        days: number = 7,
    ): CancelablePromise<DemandForecastResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/demand/forecast',
            query: {
                'product': product,
                'days': days,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
