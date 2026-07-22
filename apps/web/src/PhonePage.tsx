import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Headphones, User } from 'react-feather';
import { createJambonzClient } from '@jambonz/client-sdk-web';
import type { JambonzClient, JambonzCall } from '@jambonz/client-sdk-web';
import { micConstraints } from './rawAudio.js';

/**
 * Demo phone — a minimal WebRTC endpoint for generating real room traffic.
 * Open one tab per participant: pick a room and a role (Agent / Caller) and
 * join with your live microphone. Agents are tagged (memberTag "agent"), which
 * gates the console's Coach button and receives coached audio.
 *
 * Reached at /#phone. See DEMO.md.
 */

const LS = {
  sbcUrl: 'rm_sbcUrl',
  appSid: 'rm_appSid',
  sipRealm: 'rm_sipRealm',
  username: 'rmphone_username',
  password: 'rmphone_password',
  room: 'rmphone_room',
};
const ls = (k: string) => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};

/** Room preset from the URL (e.g. /#phone?room=support-line) so test
 *  instructions can carry a one-click link that puts everyone in the same room. */
const hashRoom = (): string =>
  new URLSearchParams(location.hash.split('?')[1] ?? '').get('room') ?? '';

type PhoneState = 'idle' | 'joining' | 'in-room';

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 13px',
  borderRadius: 9,
  border: '1.5px solid var(--grey)',
  fontFamily: 'var(--font-regular)',
  fontSize: '0.95rem',
  outline: 'none',
  background: 'var(--white)',
  color: 'var(--dark)',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  color: '#5a5758',
  fontFamily: 'var(--font-medium)',
  marginBottom: 6,
};

export function PhonePage() {
  const [sbcUrl, setSbcUrl] = useState(ls(LS.sbcUrl));
  const [sipRealm, setSipRealm] = useState(ls(LS.sipRealm));
  const [appSid, setAppSid] = useState(ls(LS.appSid));
  const [username, setUsername] = useState(ls(LS.username));
  const [password, setPassword] = useState(ls(LS.password));
  const [room, setRoom] = useState(hashRoom() || ls(LS.room) || 'demo-room');
  const [role, setRole] = useState<'agent' | 'caller'>('agent');
  const [state, setPhoneState] = useState<PhoneState>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  const client = useRef<JambonzClient | null>(null);
  const call = useRef<JambonzCall | null>(null);

  const leave = useCallback(() => {
    try {
      call.current?.hangup();
    } catch {
      /* ignore */
    }
    call.current = null;
    try {
      client.current?.disconnect();
    } catch {
      /* ignore */
    }
    client.current = null;
    setPhoneState('idle');
    setMuted(false);
  }, []);

  const join = useCallback(async () => {
    if (!sbcUrl.trim() || !appSid.trim() || !username.trim() || !password.trim() || !room.trim()) {
      setError('Please complete every field to join.');
      return;
    }
    setError('');
    try {
      localStorage.setItem(LS.sbcUrl, sbcUrl);
      localStorage.setItem(LS.sipRealm, sipRealm);
      localStorage.setItem(LS.appSid, appSid);
      localStorage.setItem(LS.username, username);
      localStorage.setItem(LS.password, password);
      localStorage.setItem(LS.room, room);
    } catch {
      /* ignore */
    }
    setPhoneState('joining');
    try {
      const c = createJambonzClient({
        server: sbcUrl,
        username,
        password,
        ...(sipRealm.trim() ? { realm: sipRealm.trim() } : {}),
        // keep the SIP socket warm through NAT idle timeouts (see useRoomMonitor)
        registerExpires: 30,
      });
      await c.connect();
      client.current = c;
      const mc = micConstraints();
      const jc = c.call(`app-${appSid}`, {
        headers: { 'X-Application-Sid': appSid, 'X-Room': room, 'X-Role': role },
        // Host candidates only — see useRoomMonitor.ts: waiting on third-party
        // STUN stalls the INVITE on UDP-filtered networks, and the publicly
        // reachable SBC doesn't need it.
        pcConfig: { iceServers: [] },
        ...(mc ? { mediaConstraints: mc } : {}),
      });
      call.current = jc;
      console.info('[room-monitor phone] placing leg', { target: `app-${appSid}`, room, role });
      jc.on('accepted', () => {
        console.info('[room-monitor phone] leg accepted');
        setPhoneState('in-room');
      });
      const dead = (cause: unknown) => {
        console.info('[room-monitor phone] leg ended', cause);
        leave();
      };
      jc.on('ended', dead);
      jc.on('failed', (cause: unknown) => {
        console.error('[room-monitor phone] leg FAILED', cause);
        const info = cause as { code?: number; reason?: string } | undefined;
        const detail = info?.reason ? ` (${info.reason}${info.code ? `, ${info.code}` : ''})` : '';
        setError(`Call failed${detail} — check the application SID and SBC URL.`);
        leave();
      });
    } catch (err) {
      console.error('[room-monitor phone] SBC registration failed', err);
      setError('Could not register with the SBC — check the URL and credentials.');
      leave();
    }
  }, [sbcUrl, appSid, username, password, room, role, leave]);

  const toggleMute = useCallback(() => {
    const c = call.current;
    if (!c) return;
    c.toggleMute();
    setMuted(c.isMuted);
  }, []);

  useEffect(() => () => leave(), [leave]);

  const inRoom = state === 'in-room';
  const joining = state === 'joining';

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dark)', padding: 24, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--white)', borderRadius: 16, padding: '30px 30px 24px', boxShadow: '0 18px 50px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ fontFamily: 'var(--font-bold)', fontSize: '1.4rem' }}>
            <span style={{ color: 'var(--jambonz)' }}>jam</span>bonz
          </div>
          <span style={{ width: 1, height: 22, background: '#e4e3e3' }} />
          <span style={{ fontFamily: 'var(--font-medium)', fontSize: '0.95rem', color: '#7a7778' }}>Demo Phone</span>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#9a9899', lineHeight: 1.5, margin: '8px 0 20px' }}>
          Join a room as an agent or caller — one tab per participant.
        </div>

        {!inRoom && (
          <>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={labelStyle}>SBC WebSocket URL</span>
              <input value={sbcUrl} onChange={(e) => setSbcUrl(e.target.value)} placeholder="wss://sbc.example.com:8443" style={inputStyle} disabled={joining} />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={labelStyle}>SIP realm</span>
              <input value={sipRealm} onChange={(e) => setSipRealm(e.target.value)} placeholder="sip.example.com" style={inputStyle} disabled={joining} />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={labelStyle}>Application SID</span>
              <input value={appSid} onChange={(e) => setAppSid(e.target.value)} placeholder="room-monitor application sid" style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} disabled={joining} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ display: 'block', marginBottom: 12, flex: 1 }}>
                <span style={labelStyle}>Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="agent1" style={inputStyle} disabled={joining} />
              </label>
              <label style={{ display: 'block', marginBottom: 12, flex: 1 }}>
                <span style={labelStyle}>Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} disabled={joining} />
              </label>
            </div>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={labelStyle}>Room</span>
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="demo-room" style={inputStyle} disabled={joining} />
            </label>

            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {(['agent', 'caller'] as const).map((r) => {
                const active = role === r;
                const color = r === 'agent' ? 'var(--teal)' : 'var(--blue)';
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    disabled={joining}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-medium)', fontSize: '0.9rem', border: `1.5px solid ${active ? color : 'var(--grey)'}`, color: active ? 'var(--white)' : '#5a5758', background: active ? color : 'var(--white)' }}
                  >
                    {r === 'agent' ? <Headphones size={16} /> : <User size={16} />}
                    {r === 'agent' ? 'Agent' : 'Caller'}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {inRoom && (
          <div style={{ textAlign: 'center', margin: '10px 0 20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 3, height: 28, marginBottom: 12 }}>
              {[0, 120, 260, 80, 340].map((d, i) => (
                <span key={i} style={{ width: 4, height: '100%', borderRadius: 3, background: role === 'agent' ? 'var(--teal)' : 'var(--blue)', transformOrigin: 'bottom', animation: `rm-eq 700ms ease-in-out ${d}ms infinite` }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-bold)', fontSize: '1.15rem' }}>{room}</div>
            <div style={{ fontSize: '0.85rem', color: '#7a7778', marginTop: 4 }}>
              In the room as <span style={{ fontFamily: 'var(--font-medium)', color: role === 'agent' ? 'var(--teal)' : 'var(--blue)' }}>{role}</span>
              {muted ? ' · muted' : ''}
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--red)', fontSize: '0.82rem', margin: '0 0 12px' }}>{error}</div>
        )}

        {!inRoom ? (
          <button onClick={() => void join()} disabled={joining} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', cursor: joining ? 'default' : 'pointer', background: 'var(--jambonz)', color: 'var(--white)', fontFamily: 'var(--font-medium)', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: joining ? 0.7 : 1 }}>
            <Phone size={16} /> {joining ? 'Joining…' : 'Join room'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={toggleMute} style={{ flex: 1, padding: 13, borderRadius: 10, cursor: 'pointer', border: '1.5px solid var(--grey)', background: muted ? 'var(--grey-light)' : 'var(--white)', color: '#5a5758', fontFamily: 'var(--font-medium)', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />} {muted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={leave} style={{ flex: 1, padding: 13, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--red)', color: 'var(--white)', fontFamily: 'var(--font-medium)', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <PhoneOff size={16} /> Leave
            </button>
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: '0.75rem', color: '#b3b1b2', textAlign: 'center' }}>
          Console: <a href="#" onClick={(e) => { e.preventDefault(); location.hash = ''; location.reload(); }} style={{ color: 'var(--jambonz)' }}>open the Call Monitor</a>
        </div>
      </div>
    </div>
  );
}
