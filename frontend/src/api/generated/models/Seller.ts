/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Coordinates } from './Coordinates';
export type Seller = {
    id: string;
    name: string;
    products: Array<string>;
    coordinates: Coordinates;
    rating?: (number | null);
    trips_count?: (number | null);
    type?: (string | null);
};

