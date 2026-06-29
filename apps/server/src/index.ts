import pino from 'pino';
import { config } from './config.js';

/**
 * Room Monitor backend entry point.
 *
 * Wires the four responsibilities (see docs/ARCHITECTURE.md §3):
 *   1. @jambonz/sdk websocket app — owns the supervisor's inbound WebRTC call
 *      leg, joins it to the conference, drives Listen/Coach/Enter.
 *   2. @jambonz/sdk REST client — room discovery + conference listen-fork control.
 *   3. WS sink + Deepgram — receives the room-mix fork, runs diarized STT.
 *   4. Data WS server — fans rooms/transcript/state to the frontend.
 *
 * Implementation of each module follows once the platform PRs land the
 * enriched /Conferences listing and the conference-level /listen control.
 */
const logger = pino({ name: 'room-monitor' });

async function main(): Promise<void> {
  logger.info({ port: config.port }, 'room-monitor backend starting');
  // TODO: start data-WS server (data-ws.ts)
  // TODO: start @jambonz/sdk websocket app (jambonz-app.ts)
  // TODO: start fork WS sink + Deepgram pipeline (transcription.ts)
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
