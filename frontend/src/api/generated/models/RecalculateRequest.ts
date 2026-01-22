/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RecalculateRequest = {
    current_lat: number;
    current_lng: number;
    dest_lat: number;
    dest_lng: number;
    event_type: string;
    simulation_id?: (string | null);
    session_id?: (string | null);
    progress?: (number | null);
};

