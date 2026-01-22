export interface Config {
  API_URL: string;
  MAPBOX_TOKEN: string;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = import.meta.env[key] || defaultValue;
  if (value === undefined) {
    console.warn(`Missing environment variable: ${key}`);
    return '';
  }
  return value;
};

export const config: Config = {
  API_URL: getEnvVar('VITE_API_URL', 'http://127.0.0.1:8000'),
  MAPBOX_TOKEN: getEnvVar('VITE_MAPBOX_TOKEN', ''),
};

export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
