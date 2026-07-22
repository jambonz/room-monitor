import { useCallback, useEffect, useRef, useState } from 'react';
import { createJambonzClient } from '@jambonz/client-sdk-web';
import type { JambonzClient, JambonzCall } from '@jambonz/client-sdk-web';
import type { ClientMessage, Room, ServerMessage, SupervisorMode, TranscriptLine } from '@room-monitor/shared';
import { micConstraints } from './rawAudio.js';

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
  /** True while the supervisor's media leg is being set up. Cleared only when
   *  the WebRTC call is actually accepted (media negotiated) — not by backend
   *  messages, which can arrive before media is up. A timeout reverts to idle. */
  modePending: boolean;
  /** Set when an engage attempt fails or times out; shown in the control bar. */
  engageError: string;
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
    engageError: '',
    transcriptOn: false,
    transcriptsByRoom: {},
    identity: { username: '', accountSid: '' },
  });

  // Mirror of the latest state for imperative handlers. State updater functions
  // must stay pure (StrictMode double-invokes them), so anything with side
  // effects reads from this ref and calls setState with pure updaters only.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearConnectTimer = useCallback(() => {
    if (connectTimer.current) {
      clearTimeout(connectTimer.current);
      connectTimer.current = null;
    }
  }, []);

  const hangupCall = useCallback(() => {
    clearConnectTimer();
    if (call.current) {
      try {
        call.current.hangup();
      } catch {
        /* ignore */
      }
      call.current = null;
    }
  }, [clearConnectTimer]);

  // ---- server -> client messages ------------------------------------------
  const onServerMessage = useCallback(
    async (msg: ServerMessage) => {
      switch (msg.type) {
        case 'connected': {
          sessionId.current = msg.sessionId;
          appSid.current = msg.appSid;
          // non-secret hints for the demo phone page on this browser
          try {
            localStorage.setItem('rm_appSid', msg.appSid);
            localStorage.setItem('rm_sbcUrl', msg.sbcUrl);
            localStorage.setItem('rm_sipRealm', msg.sipRealm);
          } catch {
            /* ignore */
          }
          try {
            const client = createJambonzClient({
              server: msg.sbcUrl,
              username: creds.current.username,
              password: creds.current.password,
              // register against the account's SIP realm, not the wss hostname
              ...(msg.sipRealm ? { realm: msg.sipRealm } : {}),
              // short registration = traffic on the SIP socket every ~20s, so
              // NAT/firewall idle timeouts can't silently kill it while the
              // supervisor sits signed-in between actions
              registerExpires: 30,
            });
            await client.connect();
            sip.current = client;
            setState((s) => ({ ...s, phase: 'console', loginError: '' }));
          } catch (err) {
            console.error('[room-monitor] WebRTC registration failed', err);
            setState((s) => ({ ...s, phase: 'login', loginError: 'Connected, but WebRTC registration failed.' }));
          }
          break;
        }
        case 'connectError':
          setState((s) => ({ ...s, phase: 'login', loginError: msg.message }));
          break;
        case 'rooms': {
          // auto-select the first room once, mirroring the prototype
          // (side effects OUTSIDE the state updater — StrictMode-safe)
          let autoSelect: string | null = null;
          if (!selectedRef.current && msg.rooms.length > 0) {
            autoSelect = msg.rooms[0].id;
            selectedRef.current = autoSelect;
            sendWs({ type: 'select', roomId: autoSelect });
          }
          setState((s) => ({
            ...s,
            rooms: msg.rooms,
            ...(autoSelect ? { selectedRoomId: autoSelect } : {}),
          }));
          break;
        }
        case 'supervisorState':
          // mode authority only — pending is cleared by the call's 'accepted'
          // event (real media), never by backend messages (issue #2)
          setState((s) => (s.selectedRoomId === msg.roomId ? { ...s, mode: msg.mode } : s));
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
    setState((s) => ({ ...s, phase: 'login', mode: 'idle', modePending: false, engageError: '', transcriptOn: false, selectedRoomId: null, rooms: [], transcriptsByRoom: {} }));
  }, [hangupCall]);

  const selectRoom = useCallback(
    (roomId: string) => {
      if (roomId === selectedRef.current) return;
      hangupCall();
      selectedRef.current = roomId;
      sendWs({ type: 'select', roomId });
      setState((s) => ({ ...s, selectedRoomId: roomId, mode: 'idle', modePending: false, engageError: '', transcriptOn: false }));
    },
    [sendWs, hangupCall]
  );

  const setMode = useCallback(
    (mode: Exclude<SupervisorMode, 'idle'>) => {
      const roomId = selectedRef.current;
      if (!roomId) return;
      const cur = stateRef.current;
      if (cur.mode === mode || cur.modePending) return;
      if (cur.mode === 'idle') {
        // idle -> connected: place the WebRTC media leg into the conference.
        // Routed straight to the monitor application (no dial plan needed):
        // app-<sid> target + X-Application-Sid header, per the jambonz SBC
        // routing convention. The UI shows "Connecting…" (modePending) until
        // the call is ACCEPTED — i.e. media actually negotiated — never on
        // backend messages, which can precede media. A timeout reverts to idle
        // so a stalled leg can't wedge the UI (issue #2).
        const client = sip.current;
        if (!client || !appSid.current) return;
        const placeLeg = (attempt: number) => {
          const mc = micConstraints();
          const c = client.call(`app-${appSid.current}`, {
            headers: {
              'X-Application-Sid': appSid.current,
              'X-Room': roomId,
              'X-Session-Id': sessionId.current,
              'X-Mode': mode,
            },
            // Host candidates only. The SBC is publicly reachable and learns the
            // browser's address from the ICE checks it receives (prflx), so
            // third-party STUN adds nothing — and JsSIP won't send the INVITE
            // until gathering completes, which stalls past the 15s connect gate
            // on networks that filter UDP to the STUN server.
            pcConfig: { iceServers: [] },
            ...(mc ? { mediaConstraints: mc } : {}),
          });
          call.current = c;
          console.info('[room-monitor] placing supervisor leg', { target: `app-${appSid.current}`, room: roomId, mode, attempt });
          c.on('accepted', () => {
            console.info('[room-monitor] supervisor leg accepted (media up)');
            clearConnectTimer();
            setState((s) => ({ ...s, modePending: false }));
          });
          c.on('ended', (cause: unknown) => {
            console.info('[room-monitor] supervisor leg ended', cause);
            clearConnectTimer();
            call.current = null;
            setState((s) => ({ ...s, mode: 'idle', modePending: false }));
          });
          c.on('failed', (cause: unknown) => {
            console.error('[room-monitor] supervisor leg FAILED', cause);
            const info = cause as { code?: number; reason?: string } | undefined;
            call.current = null;
            // code 0 = the INVITE never got a SIP answer — typically the socket
            // was silently reaped by a NAT/firewall while idle and the write
            // discovered it. JsSIP reconnects and re-registers on its own within
            // ~2s; retry once on the fresh socket instead of failing the click.
            if (attempt === 0 && info?.code === 0) {
              console.warn('[room-monitor] transport hiccup — retrying once after reconnect');
              setTimeout(() => {
                if (stateRef.current.modePending && selectedRef.current === roomId) placeLeg(1);
              }, 2500);
              return;
            }
            const detail = info?.reason ? ` (${info.reason}${info.code ? `, ${info.code}` : ''})` : '';
            clearConnectTimer();
            setState((s) => ({ ...s, mode: 'idle', modePending: false, engageError: `The monitoring call failed${detail} — try again.` }));
          });
        };
        placeLeg(0);
        clearConnectTimer();
        connectTimer.current = setTimeout(() => {
          connectTimer.current = null;
          if (!stateRef.current.modePending) return;
          console.error(
            '[room-monitor] supervisor leg timed out: no accepted/failed event within 15s.',
            'For full SIP tracing run  localStorage.debug = "JsSIP:*"  in this console, reload, and retry.'
          );
          hangupCall();
          setState((s) => ({
            ...s,
            mode: 'idle',
            modePending: false,
            engageError: 'Could not connect within 15 seconds — check your network and try again.',
          }));
        }, 15000);
        setState((s) => ({ ...s, mode, modePending: true, engageError: '' }));
        return;
      }
      // already connected: switch mode on the live leg
      sendWs({ type: 'setMode', roomId, mode });
      setState((s) => ({ ...s, mode }));
    },
    [sendWs, hangupCall, clearConnectTimer]
  );

  const stop = useCallback(() => {
    const roomId = selectedRef.current;
    hangupCall();
    if (roomId) sendWs({ type: 'setMode', roomId, mode: 'idle' });
    setState((s) => ({ ...s, mode: 'idle', modePending: false, engageError: '' }));
  }, [sendWs, hangupCall]);

  const toggleTranscript = useCallback(() => {
    const roomId = selectedRef.current;
    if (!roomId) return;
    const next = !stateRef.current.transcriptOn;
    sendWs({ type: 'transcript', roomId, on: next });
    setState((s) => ({ ...s, transcriptOn: next }));
  }, [sendWs]);

  useEffect(() => () => {
    hangupCall();
    sip.current?.disconnect();
    ws.current?.close();
  }, [hangupCall]);

  return { ...state, connect, signOut, selectRoom, setMode, stop, toggleTranscript };
}
