/**
 * @qrypto/mock-server — Config
 *
 * Environment access for the mock server.
 * Provides typed defaults so the server starts without a full .env file —
 * critical for the npx quickstart path.
 *
 * Last updated: 2024-01-15
 */

export const DEFAULT_CONFIG = {
  HTTP_PORT: 8080,
  WS_PORT: 4000,
  JWT_SECRET: 'qrypto-dev-secret-minimum-32-chars-long',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 604800,
  LOG_LEVEL: 'info',
  NODE_ENV: 'development',
} as const;

export function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

export function getConfig() {
  return {
    httpPort: parseInt(process.env['MOCK_SERVER_PORT'] ?? String(DEFAULT_CONFIG.HTTP_PORT), 10),
    wsPort: parseInt(process.env['MOCK_WS_PORT'] ?? String(DEFAULT_CONFIG.WS_PORT), 10),
    jwtSecret: process.env['JWT_SECRET'] ?? DEFAULT_CONFIG.JWT_SECRET,
    jwtAccessTtl: parseInt(
      process.env['JWT_ACCESS_TTL_SECONDS'] ?? String(DEFAULT_CONFIG.JWT_ACCESS_TTL_SECONDS),
      10,
    ),
    jwtRefreshTtl: parseInt(
      process.env['JWT_REFRESH_TTL_SECONDS'] ?? String(DEFAULT_CONFIG.JWT_REFRESH_TTL_SECONDS),
      10,
    ),
    nodeEnv: process.env['NODE_ENV'] ?? DEFAULT_CONFIG.NODE_ENV,
  };
}
