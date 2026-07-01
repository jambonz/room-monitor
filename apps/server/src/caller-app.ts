import http from 'node:http';
import { createEndpoint } from '@jambonz/sdk/websocket';
import type { Session } from '@jambonz/sdk/websocket';
import { config } from './config.js';
import { logger } from './logger.js';
import { addHealthRoute } from './health.js';

/**
 * The "normal caller" jambonz application: route a DID (or any inbound call)
 * to this app and the caller joins a conference as a plain participant.
 *
 * The conference name is an APPLICATION ENV VAR (ROOM_NAME), declared below and
 * discovered by the jambonz portal via HTTP OPTIONS — so operators change which
 * room callers land in from the portal's application screen, no redeploy.
 *
 * Runs on its own HTTP server so this app's OPTIONS schema is distinct from the
 * monitor app's (the SDK serves one schema per server).
 */
const envVars = {
  ROOM_NAME: {
    type: 'string' as const,
    description: 'Conference room inbound callers join (appears as the room name in the Call Monitor)',
    default: 'lobby',
  },
};

const DEFAULT_ROOM = 'lobby';

export function startCallerApp(): http.Server {
  const server = http.createServer();
  const makeService = createEndpoint({ server, logger, envVars });
  makeService({ path: '/caller' }).on('session:new', handleCaller);
  addHealthRoute(server);

  server.on('error', (err) => {
    logger.error({ err, port: config.callerAppPort }, 'caller app failed to start (port in use?)');
    process.exit(1);
  });
  server.listen(config.callerAppPort, () =>
    logger.info({ port: config.callerAppPort }, 'caller app listening (/caller, /health)')
  );
  return server;
}

function handleCaller(session: Session): void {
  const envRoom = (session.data.env_vars as Record<string, string> | undefined)?.ROOM_NAME;
  const roomName = (envRoom ?? '').trim() || DEFAULT_ROOM;
  session
    .answer()
    .say({ text: `Welcome. Joining ${roomName.replace(/[-_]/g, ' ')}.` })
    .conference({
      name: roomName,
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
    })
    .send();
  logger.info({ callSid: session.callSid, from: session.from, roomName }, 'caller joined conference');
}
