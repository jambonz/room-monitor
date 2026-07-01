import http from 'node:http';
import { config, validateConfig } from './config.js';
import { logger } from './logger.js';
import { attachDataWs } from './data-ws.js';
import { startJambonzApp } from './jambonz-app.js';
import { startCallerApp } from './caller-app.js';
import { healthHandler } from './health.js';

/**
 * Room Monitor backend.
 *
 * Two HTTP servers (see docs/ARCHITECTURE.md §3):
 *   - browser server (PORT): the data-WS the frontend connects to.
 *   - jambonz server (JAMBONZ_WS_APP_PORT): the @jambonz/sdk ws app — the
 *     supervisor call-control pipe (/supervisor) and the conference listen-fork
 *     audio sink (/fork) that feeds Deepgram.
 */
async function main(): Promise<void> {
  const missing = validateConfig();
  if (missing.length > 0) {
    logger.error({ missing }, 'missing required environment variables — see apps/server/.env.example');
    process.exit(1);
  }

  const browserServer = http.createServer(healthHandler);
  attachDataWs(browserServer, '/ws');
  browserServer.on('error', (err) => {
    logger.error({ err, port: config.port }, 'data-WS server failed to start (port in use?)');
    process.exit(1);
  });
  browserServer.listen(config.port, () => logger.info({ port: config.port }, 'data-WS server listening (/ws, /health)'));

  startJambonzApp();
  startCallerApp();
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
