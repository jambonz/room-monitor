import http from 'node:http';
import { createEndpoint } from '@jambonz/sdk/websocket';
import type { Session, AudioStream } from '@jambonz/sdk/websocket';
import type { SupervisorMode } from '@room-monitor/shared';
import { sessionManager } from './session.js';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * The jambonz-facing WebSocket app, on its own HTTP server:
 *   - control path (/supervisor): handles the supervisor's inbound WebRTC call,
 *     joins it to the selected conference with the initial engagement state, and
 *     links the call leg to the data-WS session.
 *   - audio path (/fork): receives the MediaJam conference listen-fork audio and
 *     pipes it into the session's transcriber.
 *
 * Kept on a separate server from the browser data-WS to avoid upgrade-routing
 * conflicts and to match deployment (jambonz/MediaJam reach this internally).
 */
export function startJambonzApp(): http.Server {
  const server = http.createServer();
  const makeService = createEndpoint({ server, logger });

  makeService({ path: '/supervisor' }).on('session:new', handleSupervisorCall);
  makeService.audio({ path: '/fork' }).on('connection', handleForkAudio);

  server.listen(config.jambonzWsAppPort, () =>
    logger.info({ port: config.jambonzWsAppPort }, 'jambonz ws app listening (/supervisor, /fork)')
  );
  return server;
}

/** Case-insensitive lookup of a custom SIP header from the inbound call payload. */
function header(session: Session, name: string): string | undefined {
  const data = session.data as unknown as { sip?: { headers?: Record<string, string> }; headers?: Record<string, string> };
  const headers = data?.sip?.headers ?? data?.headers ?? {};
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === want) return v;
  }
  return undefined;
}

function handleSupervisorCall(session: Session): void {
  const sessionId = header(session, 'X-Session-Id');
  const roomName = header(session, 'X-Room');
  const sup = sessionId ? sessionManager.get(sessionId) : undefined;

  if (!sup || !roomName) {
    logger.warn({ sessionId, roomName }, 'supervisor call missing X-Session-Id / X-Room');
    session.hangup().send();
    return;
  }

  const mode: SupervisorMode =
    (header(session, 'X-Mode') as SupervisorMode | undefined) ??
    (sup.mode !== 'idle' ? sup.mode : 'monitor');

  // Set the initial engagement state on the conference verb itself (avoids a
  // race against a follow-up participant action): listen = muted; coach =
  // unmuted + speakOnlyTo agents; enter = unmuted, heard by all.
  const joinMuted = !(mode === 'coach' || mode === 'enter');
  const speakOnlyTo = mode === 'coach' ? 'agent' : undefined;

  session.on('/conf-done', () => {
    sup.onSupervisorCallEnded();
    session.hangup().reply();
  });

  session
    .answer()
    .conference({
      name: roomName,
      startConferenceOnEnter: false, // never create or end the room being monitored
      endConferenceOnExit: false,
      joinMuted,
      memberTag: 'supervisor',
      ...(speakOnlyTo ? { speakOnlyTo } : {}),
      actionHook: '/conf-done',
    })
    .send();

  sup.onSupervisorCallConnected(session.callSid, mode);
  logger.info({ sessionId, roomName, mode, callSid: session.callSid }, 'supervisor joined conference');
}

function handleForkAudio(stream: AudioStream): void {
  const meta = stream.metadata as { sessionId?: string; roomName?: string };
  const sup = meta.sessionId ? sessionManager.get(meta.sessionId) : undefined;
  if (!sup || !meta.roomName) {
    logger.warn({ meta }, 'fork audio without a matching session/room');
    stream.disconnect();
    return;
  }
  logger.info({ sessionId: meta.sessionId, roomName: meta.roomName, sampleRate: stream.sampleRate }, 'fork audio connected');
  const transcriber = sup.attachTranscriptionStream(meta.roomName, stream.sampleRate);
  stream.on('audio', (pcm: Buffer) => transcriber.write(pcm));
  stream.on('close', () => transcriber.close());
}
