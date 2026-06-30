import http from 'node:http';
import { config } from './config.js';
import { logger } from './logger.js';
import { attachDataWs } from './data-ws.js';
import { startJambonzApp } from './jambonz-app.js';

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
  const browserServer = http.createServer();
  attachDataWs(browserServer, '/ws');
  browserServer.listen(config.port, () => logger.info({ port: config.port }, 'data-WS server listening (/ws)'));

  startJambonzApp();
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
