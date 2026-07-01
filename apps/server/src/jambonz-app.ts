import http from 'node:http';
import { createEndpoint } from '@jambonz/sdk/websocket';
import type { Session, AudioStream } from '@jambonz/sdk/websocket';
import type { SupervisorMode } from '@room-monitor/shared';
import { sessionManager, FORK_SAMPLE_RATE } from './session.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { healthHandler } from './health.js';

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
  const server = http.createServer(healthHandler);
  const makeService = createEndpoint({ server, logger });

  makeService({ path: '/supervisor' }).on('session:new', handleCall);
  makeService.audio({ path: '/fork' }).on('connection', handleForkAudio);

  server.on('error', (err) => {
    logger.error({ err, port: config.jambonzWsAppPort }, 'jambonz ws app failed to start (port in use?)');
    process.exit(1);
  });
  server.listen(config.jambonzWsAppPort, () =>
    logger.info({ port: config.jambonzWsAppPort }, 'jambonz ws app listening (/supervisor, /fork, /health)')
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

/**
 * One application, two call flows, split by headers:
 *   - X-Session-Id present  → the supervisor console's monitoring leg
 *   - X-Role present        → a demo participant (phone page / traffic kit)
 */
function handleCall(session: Session): void {
  if (header(session, 'X-Session-Id')) return handleSupervisorCall(session);
  if (header(session, 'X-Role')) return handleDemoParticipant(session);
  logger.warn({ callSid: session.callSid, from: session.from }, 'call without X-Session-Id or X-Role — declining');
  session.hangup().send();
}

/**
 * Demo participant: joins the named room as an agent (memberTag "agent" — which
 * gates the console's Coach button and receives coached audio) or as a plain
 * caller. First participant creates the room (startConferenceOnEnter).
 */
function handleDemoParticipant(session: Session): void {
  const roomName = header(session, 'X-Room');
  const role = (header(session, 'X-Role') ?? '').toLowerCase();
  if (!roomName) {
    logger.warn({ callSid: session.callSid }, 'demo participant missing X-Room');
    session.hangup().send();
    return;
  }
  const isAgent = role === 'agent';
  session
    .answer()
    .say({ text: `Joining ${roomName} as ${isAgent ? 'an agent' : 'a caller'}.` })
    .conference({
      name: roomName,
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
      ...(isAgent ? { memberTag: 'agent' } : {}),
    })
    .send();
  logger.info({ callSid: session.callSid, roomName, role }, 'demo participant joined conference');
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
  // MediaJam sends OUR listen-request metadata verbatim as the fork's first
  // text frame, so don't assume the standard jambonz listen fields (callSid,
  // sampleRate, …) are present. Log the full frame so integration can confirm
  // the real shape, and configure from our own self-describing metadata.
  const meta = stream.metadata as { sessionId?: string; roomName?: string; sampleRate?: number };
  logger.info({ metadata: stream.metadata }, 'fork audio connected — initial metadata frame');

  const sup =
    (meta.sessionId ? sessionManager.get(meta.sessionId) : undefined) ??
    (meta.roomName ? sessionManager.findTranscribing(meta.roomName) : undefined);
  if (!sup || !meta.roomName) {
    logger.warn({ meta }, 'fork audio without a matching session/room — disconnecting');
    stream.disconnect();
    return;
  }

  const sampleRate = meta.sampleRate ?? stream.sampleRate ?? FORK_SAMPLE_RATE;
  const transcriber = sup.attachTranscriptionStream(meta.roomName, sampleRate);
  stream.on('audio', (pcm: Buffer) => transcriber.write(pcm));
  stream.on('close', () => transcriber.close());
}
