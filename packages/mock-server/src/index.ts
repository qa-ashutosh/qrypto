/**
 * @qrypto/mock-server — Entry Point
 *
 * Starts the HTTP server (port 8080) and WebSocket server (port 4000).
 * Logs the startup catalog so engineers know what seed data is available.
 *
 * Usage:
 *   npx @qrypto/mock-server
 *   node dist/index.js
 *   JWT_SECRET=my-secret MOCK_SERVER_PORT=9090 node dist/index.js
 *
 * Last updated: 2024-01-15
 */

import { logger } from '@qrypto/shared-types';

import { createApp } from './app.js';
import { getConfig } from './config.js';
import { SEED_USER_IDS, SEED_EMAILS } from './seed/seed.data.js';
import { createWsServer } from './websocket/ws.server.js';

const serverLogger = logger.child({ service: 'mock-server' });

async function start(): Promise<void> {
  const config = getConfig();
  const app = createApp();

  // ── HTTP Server ─────────────────────────────────────────────────────────────
  await new Promise<void>((resolve) => {
    app.listen(config.httpPort, () => {
      resolve();
    });
  });

  // ── WebSocket Server ─────────────────────────────────────────────────────────
  createWsServer(config.wsPort);

  // ── Startup Log ──────────────────────────────────────────────────────────────
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║              @qrypto/mock-server  —  READY                   ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `  HTTP   →  http://localhost:${config.httpPort}`,
    `  WS     →  ws://localhost:${config.wsPort}`,
    `  Env    →  ${config.nodeEnv}`,
    '',
    '  Seed users (email / password: TestPassword123! / 2FA: 123456)',
    '  ─────────────────────────────────────────────────────────────',
  ];

  for (const [key, id] of Object.entries(SEED_USER_IDS)) {
    const email = SEED_EMAILS[key as keyof typeof SEED_USER_IDS];
    lines.push(`  ${key.padEnd(18)} ${email}`);
    void id; // referenced for type safety
  }

  lines.push('');
  lines.push('  Admin endpoints:');
  lines.push('    POST /admin/reset              — reset all state');
  lines.push('    POST /admin/kyc/:id/force      — force KYC status');
  lines.push('    POST /admin/deposit/confirm    — confirm pending deposit');
  lines.push('    POST /admin/chaos              — inject chaos');
  lines.push('    GET  /admin/health             — liveness check');
  lines.push('');

  for (const line of lines) {
    process.stdout.write(line + '\n');
  }

  serverLogger.info('mock server started', {
    httpPort: config.httpPort,
    wsPort: config.wsPort,
    nodeEnv: config.nodeEnv,
  });
}

start().catch((err: unknown) => {
  serverLogger.error('failed to start mock server', err);
  process.exit(1);
});
