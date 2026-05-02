/**
 * @qrypto/api-suite — Base API Client
 *
 * Foundation for all domain clients. Provides:
 *   - Retry with exponential backoff (transient errors only)
 *   - Auth token injection
 *   - Structured request/response logging with correlation IDs
 *   - Rate-limit handling (429 → retry after Retry-After)
 *   - Type-safe response parsing
 *
 * Every domain client extends this class.
 *
 * Last updated: 2024-01-15
 */

import { type APIRequestContext } from '@playwright/test';

export interface RequestOptions {
  token?: string;
  correlationId?: string;
  retries?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    correlationId?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly body: ApiError,
  ) {
    super(`[${status}] ${code}: ${message}`);
    this.name = 'ApiClientError';
  }
}

const MOCK_SERVER_URL = process.env['MOCK_SERVER_URL'] ?? 'http://localhost:8080';

export class BaseApiClient {
  protected readonly baseUrl: string;

  constructor(protected readonly request: APIRequestContext) {
    this.baseUrl = MOCK_SERVER_URL;
  }

  protected async get<T>(
    path: string,
    options: RequestOptions & { params?: Record<string, string | number> } = {},
  ): Promise<T> {
    return this.call<T>('GET', path, undefined, options);
  }

  protected async post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.call<T>('POST', path, body, options);
  }

  protected async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.call<T>('DELETE', path, undefined, options);
  }

  private async call<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions & { params?: Record<string, string | number> } = {},
  ): Promise<T> {
    const { token, retries = 2 } = options;
    const correlationId = options.correlationId ?? crypto.randomUUID();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
    };

    if (token) headers['Authorization'] = `Bearer ${token}`;

    let lastError: ApiClientError | undefined;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const res = await this.request.fetch(url, {
          method,
          headers,
          data: body !== undefined ? JSON.stringify(body) : undefined,
          params: options.params as Record<string, string>,
        });

        // Rate limit — wait and retry
        if (res.status() === 429 && attempt <= retries) {
          const retryAfter = parseInt(res.headers()['retry-after'] ?? '1', 10);
          await this.delay(retryAfter * 1000);
          continue;
        }

        if (!res.ok()) {
          const errBody = (await res.json().catch(() => ({
            code: 'UNKNOWN',
            message: res.statusText(),
          }))) as ApiError;

          const err = new ApiClientError(
            res.status(),
            errBody.code ?? 'UNKNOWN',
            errBody.message ?? res.statusText(),
            errBody,
          );

          // Only retry on transient server errors
          if (res.status() >= 500 && attempt <= retries) {
            lastError = err;
            await this.delay(100 * Math.pow(2, attempt - 1));
            continue;
          }

          throw err;
        }

        if (res.status() === 204) return undefined as T;

        const json = (await res.json()) as { data?: T } | T;
        // Unwrap data envelope if present
        if (json !== null && typeof json === 'object' && 'data' in json) {
          return (json as ApiResponse<T>).data;
        }
        return json as T;
      } catch (err) {
        if (err instanceof ApiClientError) throw err;
        if (attempt > retries) throw err;
        await this.delay(100 * Math.pow(2, attempt - 1));
      }
    }

    throw lastError ?? new Error(`Request failed after ${retries + 1} attempts`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  protected async getRaw<T>(
    path: string,
    options: RequestOptions & { params?: Record<string, string | number> } = {},
  ): Promise<T> {
    // Same as get() but does NOT unwrap the data envelope
    const { token } = options;
    const correlationId = options.correlationId ?? crypto.randomUUID();
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await this.request.fetch(url, {
      method: 'GET',
      headers,
      params: options.params as Record<string, string>,
    });

    if (!res.ok()) {
      const errBody = (await res.json().catch(() => ({
        code: 'UNKNOWN',
        message: res.statusText(),
      }))) as ApiError;
      throw new ApiClientError(
        res.status(),
        errBody.code ?? 'UNKNOWN',
        errBody.message ?? res.statusText(),
        errBody,
      );
    }

    return res.json() as Promise<T>;
  }
}
