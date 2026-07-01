import { useCallback, useEffect, useRef, useState } from 'react';
import { createJambonzClient } from '@jambonz/client-sdk-web';
import type { JambonzClient, JambonzCall } from '@jambonz/client-sdk-web';
import type { ClientMessage, Room, ServerMessage, SupervisorMode, TranscriptLine } from '@room-monitor/shared';

const DATA_WS_URL = import.meta.env.VITE_DATA_WS_URL ?? `ws://${location.hostname}:3001/ws`;

export interface LoginForm {
  baseUrl: string;
  accountSid: string;
  apiKey: string;
  username: string;
  password: string;
}

export type Phase = 'login' | 'connecting' | 'console';

export interface RoomMonitorState {
  phase: Phase;
  loginError: string;
  rooms: Room[];
  selectedRoomId: string | null;
  mode: SupervisorMode;
  /** True while the supervisor's media leg is being set up — mode buttons are
   *  disabled until the backend confirms via supervisorState (or the call dies). */
  modePending: boolean;
  transcriptOn: boolean;
  transcriptsByRoom: Record<string, TranscriptLine[]>;
  identity: { username: string; accountSid: string };
}

export interface RoomMonitor extends RoomMonitorState {
  connect: (form: LoginForm) => void;
  signOut: () => void;
  selectRoom: (roomId: string) => void;
  setMode: (mode: Exclude<SupervisorMode, 'idle'>) => void;
  stop: () => void;
  toggleTranscript: () => void;
}

export function useRoomMonitor(): RoomMonitor {
  const [state, setState] = useState<RoomMonitorState>({
    phase: 'login',
    loginError: '',
    rooms: [],
    selectedRoomId: null,
    mode: 'idle',
    modePending: false,
    transcriptOn: false,
    transcriptsByRoom: {},
    identity: { username: '', accountSid: '' },
  });

  const ws = useRef<WebSocket | null>(null);
  const sip = useRef<JambonzClient | null>(null);
  const call = useRef<JambonzCall | null>(null);
  const sessionId = useRef<string>('');
  const appSid = useRef<string>('');
  const creds = useRef<{ username: string; password: string }>({ username: '', password: '' });
  const selectedRef = useRef<string | null>(null);

  const sendWs = useCallback((msg: ClientMessage) => {
    const sock = ws.current;
    if (sock && sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
  }, []);

  const hangupCall = useCallback(() => {
    if (call.current) {
      try {
        call.current.hangup();
      } catch {
        /* ignore */
      }
      call.current = null;
    }
  }, []);

  // ---- server -> client messages ------------------------------------------
  const onServerMessage = useCallback(
    async (msg: ServerMessage) => {
      switch (msg.type) {
        case 'connected': {
          sessionId.current = msg.sessionId;
          appSid.current = msg.appSid;
          try {
            const client = createJambonzClient({
              server: msg.sbcUrl,
              username: creds.current.username,
              password: creds.current.password,
            });
            await client.connect();
            sip.current = client;
            setState((s) => ({ ...s, phase: 'console', loginError: '' }));
          } catch {
            setState((s) => ({ ...s, phase: 'login', loginError: 'Connected, but WebRTC registration failed.' }));
          }
          break;
        }
        case 'connectError':
          setState((s) => ({ ...s, phase: 'login', loginError: msg.message }));
          break;
        case 'rooms':
          setState((s) => {
            // auto-select the first room once, mirroring the prototype
            if (!selectedRef.current && msg.rooms.length > 0) {
              selectedRef.current = msg.rooms[0].id;
              sendWs({ type: 'select', roomId: msg.rooms[0].id });
              return { ...s, rooms: msg.rooms, selectedRoomId: msg.rooms[0].id };
            }
            return { ...s, rooms: msg.rooms };
          });
          break;
        case 'supervisorState':
          setState((s) =>
            s.selectedRoomId === msg.roomId ? { ...s, mode: msg.mode, modePending: false } : s
          );
          break;
        case 'transcriptState':
          setState((s) =>
            s.selectedRoomId === msg.roomId
              ? { ...s, transcriptOn: msg.on, transcriptsByRoom: { ...s.transcriptsByRoom, [msg.roomId]: [] } }
              : s
          );
          break;
        case 'transcript':
          setState((s) => {
            const prev = s.transcriptsByRoom[msg.roomId] ?? [];
            return { ...s, transcriptsByRoom: { ...s.transcriptsByRoom, [msg.roomId]: [...prev, msg.line] } };
          });
          break;
      }
    },
    [sendWs]
  );

  // ---- actions -------------------------------------------------------------
  const connect = useCallback(
    (form: LoginForm) => {
      creds.current = { username: form.username, password: form.password };
      setState((s) => ({ ...s, phase: 'connecting', loginError: '', identity: { username: form.username, accountSid: form.accountSid } }));
      const sock = new WebSocket(DATA_WS_URL);
      ws.current = sock;
      sock.onopen = () =>
        sock.send(JSON.stringify({ type: 'connect', baseUrl: form.baseUrl, accountSid: form.accountSid, apiKey: form.apiKey } satisfies ClientMessage));
      sock.onmessage = (e) => void onServerMessage(JSON.parse(e.data) as ServerMessage);
      sock.onerror = () => setState((s) => (s.phase === 'connecting' ? { ...s, phase: 'login', loginError: 'Could not reach the monitor backend.' } : s));
      sock.onclose = () => {
        hangupCall();
        setState((s) => ({ ...s, phase: 'login' }));
      };
    },
    [onServerMessage, hangupCall]
  );

  const signOut = useCallback(() => {
    hangupCall();
    try {
      sip.current?.disconnect();
    } catch {
      /* ignore */
    }
    sip.current = null;
    ws.current?.close();
    ws.current = null;
    sessionId.current = '';
    appSid.current = '';
    creds.current = { username: '', password: '' };
    selectedRef.current = null;
    setState((s) => ({ ...s, phase: 'login', mode: 'idle', modePending: false, transcriptOn: false, selectedRoomId: null, rooms: [], transcriptsByRoom: {} }));
  }, [hangupCall]);

  const selectRoom = useCallback(
    (roomId: string) => {
      if (roomId === selectedRef.current) return;
      hangupCall();
      selectedRef.current = roomId;
      sendWs({ type: 'select', roomId });
      setState((s) => ({ ...s, selectedRoomId: roomId, mode: 'idle', modePending: false, transcriptOn: false }));
    },
    [sendWs, hangupCall]
  );

  const setMode = useCallback(
    (mode: Exclude<SupervisorMode, 'idle'>) => {
      const roomId = selectedRef.current;
      if (!roomId) return;
      setState((s) => {
        if (s.mode === mode || s.modePending) return s;
        if (s.mode === 'idle') {
          // idle -> connected: place the WebRTC media leg into the conference.
          // Routed straight to the monitor application (no dial plan needed):
          // app-<sid> target + X-Application-Sid header, per the jambonz SBC
          // routing convention. Buttons stay disabled (modePending) until the
          // backend confirms the leg via supervisorState.
          const client = sip.current;
          if (!client || !appSid.current) return s;
          const c = client.call(`app-${appSid.current}`, {
            headers: {
              'X-Application-Sid': appSid.current,
              'X-Room': roomId,
              'X-Session-Id': sessionId.current,
              'X-Mode': mode,
            },
          });
          call.current = c;
          const dead = () => {
            call.current = null;
            setState((cur) => ({ ...cur, mode: 'idle', modePending: false }));
          };
          c.on('ended', dead);
          c.on('failed', dead);
          return { ...s, mode, modePending: true };
        }
        // already connected: switch mode on the live leg
        sendWs({ type: 'setMode', roomId, mode });
        return { ...s, mode };
      });
    },
    [sendWs]
  );

  const stop = useCallback(() => {
    const roomId = selectedRef.current;
    hangupCall();
    if (roomId) sendWs({ type: 'setMode', roomId, mode: 'idle' });
    setState((s) => ({ ...s, mode: 'idle', modePending: false }));
  }, [sendWs, hangupCall]);

  const toggleTranscript = useCallback(() => {
    const roomId = selectedRef.current;
    if (!roomId) return;
    setState((s) => {
      sendWs({ type: 'transcript', roomId, on: !s.transcriptOn });
      return { ...s, transcriptOn: !s.transcriptOn };
    });
  }, [sendWs]);

  useEffect(() => () => {
    hangupCall();
    sip.current?.disconnect();
    ws.current?.close();
  }, [hangupCall]);

  return { ...state, connect, signOut, selectRoom, setMode, stop, toggleTranscript };
}
