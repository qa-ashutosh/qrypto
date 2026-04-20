/**
 * @qrypto/shared-types — Structured Logger
 *
 * Structured JSON logging with correlation ID support.
 * Every log line is machine-parseable. Correlation IDs tie together
 * all log entries for a single test run, request chain, or user flow.
 *
 * In CI: JSON output → ingested by log aggregation.
 * In local dev: pretty-printed for readability.
 *
 * Last updated: 2024-01-01
 */

import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  testName?: string;
  suite?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack: string | undefined;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function formatError(
  error: unknown,
): { name: string; message: string; stack: string | undefined } | undefined {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return undefined;
}

function serialize(entry: LogEntry): string {
  const isPretty =
    process.env['LOG_PRETTY'] === 'true' || process.env['NODE_ENV'] === 'development';

  if (isPretty) {
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level];
    const correlationId = entry.context.correlationId
      ? ` [${entry.context.correlationId.slice(0, 8)}]`
      : '';
    return `${color}${entry.level.toUpperCase()}${reset}${correlationId} ${entry.message}`;
  }

  return JSON.stringify(entry);
}

export class Logger {
  private readonly baseContext: LogContext;
  private readonly minLevel: number;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
    const configuredLevel = (process.env['LOG_LEVEL'] as LogLevel | undefined) ?? 'info';
    this.minLevel = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.info;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const formattedError = formatError(error);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.baseContext, ...context },
      ...(formattedError !== undefined ? { error: formattedError } : {}),
    };

    const line = serialize(entry);

    if (level === 'error' || level === 'warn') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * Create a child logger that inherits base context and adds more.
   * Use this to attach a correlation ID for a test run or request chain.
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.baseContext, ...additionalContext });
  }

  /**
   * Create a child logger with a fresh correlation ID.
   * Call at the start of each test or request to trace all related logs.
   */
  withCorrelation(context?: Omit<LogContext, 'correlationId'>): Logger {
    return this.child({
      ...context,
      correlationId: randomUUID(),
    });
  }
}

/** Default logger instance — use directly or call .child() / .withCorrelation() */
export const logger = new Logger({
  service: 'qrypto',
});

/** Generate a new correlation ID. */
export function newCorrelationId(): string {
  return randomUUID();
}
