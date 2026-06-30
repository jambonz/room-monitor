import { LogOut } from 'react-feather';
import { initials } from '../format.js';

export function TopBar({ liveCount, username, accountSid, onSignOut }: { liveCount: number; username: string; accountSid: string; onSignOut: () => void }) {
  return (
    <div style={{ flex: 'none', height: 64, display: 'flex', alignItems: 'center', gap: 24, padding: '0 24px', background: 'var(--dark)', color: 'var(--white)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-bold)', fontSize: '1.4rem' }}>
          <span style={{ color: 'var(--jambonz)' }}>jam</span>bonz
        </div>
        <span style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.18)' }} />
        <span style={{ fontFamily: 'var(--font-medium)', fontSize: '0.95rem', opacity: 0.85 }}>Call Monitor</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginLeft: 8 }}>
        <span style={{ fontFamily: 'var(--font-bold)', fontSize: '1.15rem' }}>{liveCount}</span>
        <span style={{ fontSize: '0.78rem', opacity: 0.6 }}>live calls</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 8 }}>
        <button onClick={onSignOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-medium)', fontSize: '0.8rem' }}>
          <LogOut size={15} /> Sign out
        </button>
        <span style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.18)' }} />
        <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
          <div style={{ fontFamily: 'var(--font-medium)', fontSize: '0.85rem' }}>{username || 'Supervisor'}</div>
          <div style={{ fontSize: '0.72rem', opacity: 0.55, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{accountSid || 'Operations'}</div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--jambonz)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-bold)', fontSize: '0.8rem' }}>
          {initials(username) || 'SU'}
        </div>
      </div>
    </div>
  );
}
