/**
 * @qrypto/shared-types — Environment Configuration
 *
 * Validates all required environment variables at startup.
 * On failure: logs every missing/invalid variable with a clear message,
 * then throws — the process will not start with a broken config.
 * This is intentional. Silent misconfiguration in fintech loses money.
 *
 * Last updated: 2024-01-01
 */

import { z } from 'zod';

const EnvSchema = z.object({
  // ── Server ───────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ── Mock Server ──────────────────────────────────────────────────────────
  MOCK_SERVER_HOST: z.string().default('localhost'),
  MOCK_SERVER_PORT: z.coerce.number().int().min(1024).max(65535).default(8080),
  MOCK_WS_PORT: z.coerce.number().int().min(1024).max(65535).default(4000),

  // ── Frontend Mock ────────────────────────────────────────────────────────
  FRONTEND_HOST: z.string().default('localhost'),
  FRONTEND_PORT: z.coerce.number().int().min(1024).max(65535).default(3000),

  // ── Auth / JWT ───────────────────────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters — use a cryptographically random value'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604800),

  // ── Test Configuration ───────────────────────────────────────────────────
  TEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  TEST_RETRY_COUNT: z.coerce.number().int().min(0).max(5).default(2),
  TEST_CONCURRENCY: z.coerce.number().int().positive().default(4),

  // ── Reporting ────────────────────────────────────────────────────────────
  ALLURE_RESULTS_DIR: z.string().default('./allure-results'),
  CI: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parses and validates the environment.
 *
 * Call this once at the entry point of each package — e.g. in the global
 * test setup file. Any missing or invalid variable produces a clear error
 * message listing exactly what is wrong, then throws.
 */
export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `  • ${e.path.join('.')}: ${e.message}`);

    const message = [
      '',
      '╔══════════════════════════════════════════════════════════╗',
      '║         QRYPTO — ENVIRONMENT CONFIGURATION ERROR         ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
      'The following environment variables are missing or invalid:',
      ...errors,
      '',
      'Fix these before starting. Misconfiguration in fintech is not',
      'a warning — it is a bug.',
      '',
    ].join('\n');

    throw new Error(message);
  }

  return result.data;
}

/**
 * Singleton env — parsed once and cached.
 * Use this in all packages that need config values.
 */
let _env: Env | undefined;

export function getEnv(): Env {
  if (_env === undefined) {
    _env = parseEnv();
  }
  return _env;
}

/**
 * For test environments only — reset the singleton between test suites
 * when environment overrides are needed.
 */
export function resetEnvForTesting(): void {
  _env = undefined;
}
