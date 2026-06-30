import { useState } from 'react';
import { Wifi, AlertTriangle } from 'react-feather';
import type { LoginForm } from '../useRoomMonitor.js';

const LS = {
  baseUrl: 'rm_baseUrl',
  accountSid: 'rm_accountSid',
  username: 'rm_username',
};
const ls = (k: string) => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  color: '#5a5758',
  fontFamily: 'var(--font-medium)',
  marginBottom: 6,
};
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
const sectionStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  color: '#a9a7a8',
  fontFamily: 'var(--font-medium)',
  marginBottom: 11,
};

export function Login({ error, busy, onConnect }: { error: string; busy: boolean; onConnect: (f: LoginForm) => void }) {
  const [baseUrl, setBaseUrl] = useState(ls(LS.baseUrl));
  const [accountSid, setAccountSid] = useState(ls(LS.accountSid));
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState(ls(LS.username));
  const [password, setPassword] = useState('');
  const [localErr, setLocalErr] = useState('');

  const submit = () => {
    if (!baseUrl.trim() || !accountSid.trim() || !apiKey.trim() || !username.trim() || !password.trim()) {
      setLocalErr('Please complete every field to connect.');
      return;
    }
    setLocalErr('');
    try {
      localStorage.setItem(LS.baseUrl, baseUrl);
      localStorage.setItem(LS.accountSid, accountSid);
      localStorage.setItem(LS.username, username);
    } catch {
      /* ignore */
    }
    onConnect({ baseUrl, accountSid, apiKey, username, password });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };
  const shownErr = localErr || error;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dark)', padding: 24, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--white)', borderRadius: 16, padding: '34px 34px 26px', boxShadow: '0 18px 50px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ fontFamily: 'var(--font-bold)', fontSize: '1.5rem' }}>
            <span style={{ color: 'var(--jambonz)' }}>jam</span>bonz
          </div>
          <span style={{ width: 1, height: 22, background: '#e4e3e3' }} />
          <span style={{ fontFamily: 'var(--font-medium)', fontSize: '0.95rem', color: '#7a7778' }}>Call Monitor</span>
        </div>
        <div style={{ fontSize: '0.92rem', color: '#9a9899', lineHeight: 1.5, margin: '8px 0 22px' }}>
          Connect to your jambonz system to monitor live calls.
        </div>

        <div style={sectionStyle}>Connection</div>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>Base URL</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} onKeyDown={onKey} placeholder="https://api.jambonz.cloud" style={inputStyle} />
        </label>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>Account SID</span>
          <input value={accountSid} onChange={(e) => setAccountSid(e.target.value)} onKeyDown={onKey} placeholder="e.g. 2708b1b3-94f0-4f3c-9c1e-..." style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }} />
        </label>
        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={labelStyle}>API key</span>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onKeyDown={onKey} placeholder="Used to query calls via the REST API" style={inputStyle} />
        </label>

        <div style={sectionStyle}>Credentials</div>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onKey} placeholder="supervisor" style={inputStyle} />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={labelStyle}>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKey} placeholder="••••••••" style={inputStyle} />
        </label>

        {shownErr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--red)', fontSize: '0.82rem', margin: '8px 0 4px' }}>
            <AlertTriangle size={15} /> {shownErr}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          style={{ width: '100%', marginTop: 14, padding: 14, borderRadius: 10, border: 'none', cursor: busy ? 'default' : 'pointer', background: 'var(--jambonz)', color: 'var(--white)', fontFamily: 'var(--font-medium)', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: busy ? 0.7 : 1 }}
        >
          <Wifi size={17} /> {busy ? 'Connecting…' : 'Connect'}
        </button>
        <div style={{ marginTop: 16, fontSize: '0.76rem', color: '#b3b1b2', lineHeight: 1.5, textAlign: 'center' }}>
          Your API key and password are used only to authenticate with this jambonz system.
        </div>
      </div>
    </div>
  );
}
