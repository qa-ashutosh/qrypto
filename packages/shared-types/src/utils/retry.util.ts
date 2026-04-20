/**
 * @qrypto/shared-types — Retry Utility
 *
 * Configurable retry with exponential backoff and jitter.
 * Used by API clients and test helpers to handle transient failures
 * without masking real bugs.
 *
 * Design constraint: compliance tests set maxAttempts to 1 — retries
 * in compliance tests are silent failures, not resilience.
 *
 * Last updated: 2024-01-01
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts: number;
  /** Base delay in ms between attempts. Default: 100ms */
  baseDelayMs: number;
  /** Maximum delay cap in ms. Default: 5000ms */
  maxDelayMs: number;
  /** Multiply base delay by this factor each attempt. Default: 2 */
  backoffFactor: number;
  /** Add random jitter (±25% of calculated delay). Default: true */
  jitter: boolean;
  /** Only retry when this function returns true. Default: retry all errors */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Called before each retry attempt — useful for logging. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffFactor: 2,
  jitter: true,
};

/** Options for compliance tests — zero retries. */
export const COMPLIANCE_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
  backoffFactor: 1,
  jitter: false,
};

/** Options for API tests — fast retries, limited attempts. */
export const API_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 50,
  maxDelayMs: 1000,
  backoffFactor: 2,
  jitter: true,
};

function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponential = Math.min(
    options.baseDelayMs * Math.pow(options.backoffFactor, attempt - 1),
    options.maxDelayMs,
  );

  if (!options.jitter) return exponential;

  // ±25% jitter — prevents thundering herd in parallel test runs
  const jitterFactor = 0.75 + Math.random() * 0.5;
  return Math.floor(exponential * jitterFactor);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with configurable retry and backoff.
 *
 * @example
 * const result = await withRetry(
 *   () => apiClient.getOrder(orderId),
 *   { ...API_RETRY_OPTIONS, shouldRetry: (e) => isTransientError(e) }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === opts.maxAttempts;
      if (isLastAttempt) break;

      const shouldRetryThis = opts.shouldRetry?.(error, attempt) ?? true;
      if (!shouldRetryThis) break;

      const delayMs = calculateDelay(attempt, opts);
      opts.onRetry?.(error, attempt, delayMs);

      await delay(delayMs);
    }
  }

  throw lastError;
}

/**
 * Check if an error is likely transient (network hiccup, server overload).
 * Use as the `shouldRetry` predicate for infrastructure-level retries.
 * Do NOT use in compliance tests.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const transientMessages = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'socket hang up',
      'network timeout',
    ];
    return transientMessages.some((msg) => error.message.toLowerCase().includes(msg.toLowerCase()));
  }
  return false;
}

/**
 * Check if an HTTP status code warrants a retry.
 * 429 (rate limit), 502/503/504 (server errors) are retryable.
 * 4xx client errors are not — they indicate a bug in the test.
 */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}
