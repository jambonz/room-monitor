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
  ROLE: {
    type: 'string' as const,
    description:
      "Role for inbound callers: 'caller' (plain participant) or 'agent' (tagged so Coach/whisper reaches them). " +
      'Point one DID at an application with ROLE=caller and another at one with ROLE=agent.',
    default: 'caller',
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
  const env = session.data.env_vars as Record<string, string> | undefined;
  const roomName = (env?.ROOM_NAME ?? '').trim() || DEFAULT_ROOM;
  const isAgent = (env?.ROLE ?? '').trim().toLowerCase() === 'agent';
  const spoken = roomName.replace(/[-_]/g, ' ');
  session
    .answer()
    .say({ text: isAgent ? `Joining ${spoken} as an agent.` : `Welcome. Joining ${spoken}.` })
    .conference({
      name: roomName,
      ...(isAgent ? { memberTag: 'agent' } : {}),
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
    })
    .send();
  logger.info(
    { callSid: session.callSid, from: session.from, roomName, role: isAgent ? 'agent' : 'caller' },
    'caller joined conference'
  );
}
