import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '@room-monitor/shared';
import { sessionManager, type SupervisorSession } from './session.js';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * The browser-facing data channel. One WebSocket per supervisor; the backend
 * creates a SupervisorSession on connect, relays room/transcript/state, and
 * accepts select / setMode / transcript intents (room-scoped — the browser
 * never sees a call_sid).
 */
export function attachDataWs(server: Server, path = '/ws'): void {
  const wss = new WebSocketServer({ server, path });

  wss.on('connection', (ws: WebSocket) => {
    const send = (msg: ServerMessage) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    };
    const session: SupervisorSession = sessionManager.create({ send });
    logger.info({ sessionId: session.id }, 'data-ws: supervisor connected');

    ws.on('message', (raw) => void onMessage(session, send, raw.toString()));
    ws.on('close', () => {
      logger.info({ sessionId: session.id }, 'data-ws: supervisor disconnected');
      void sessionManager.remove(session.id);
    });
    ws.on('error', (err) => logger.warn({ err, sessionId: session.id }, 'data-ws error'));
  });

  logger.info({ path }, 'data-ws listening');
}

async function onMessage(
  session: SupervisorSession,
  send: (msg: ServerMessage) => void,
  raw: string
): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  try {
    switch (msg.type) {
      case 'connect':
        try {
          await session.connect({ baseUrl: msg.baseUrl, accountSid: msg.accountSid, apiKey: msg.apiKey });
          send({
            type: 'connected',
            sessionId: session.id,
            sbcUrl: config.webrtcSbcUrl,
            appSid: session.monitorAppSid,
          });
        } catch (err) {
          logger.info({ err }, 'data-ws: connect failed');
          const detail = err instanceof Error && err.message.includes('no application named')
            ? err.message
            : 'Could not connect to the jambonz system. Check your credentials.';
          send({ type: 'connectError', message: detail });
        }
        break;
      case 'select':
        await session.selectRoom(msg.roomId);
        break;
      case 'setMode':
        await session.setMode(msg.mode);
        break;
      case 'transcript':
        await session.setTranscript(msg.on);
        break;
    }
  } catch (err) {
    logger.warn({ err, type: msg.type }, 'data-ws: error handling message');
  }
}
