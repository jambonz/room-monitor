import { Users, Headphones } from 'react-feather';
import type { Room, SupervisorMode } from '@room-monitor/shared';
import { agentCount, otherCount } from '@room-monitor/shared';
import { fmtDur } from '../format.js';

function Equalizer() {
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {[0, 160, 300].map((d) => (
        <span key={d} style={{ width: 2.5, height: '100%', borderRadius: 2, background: 'var(--blue)', transformOrigin: 'bottom', animation: `rm-eq 650ms ease-in-out ${d}ms infinite` }} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '36px 28px', gap: 13 }}>
      <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'var(--pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'rm-pulse 2200ms ease-out infinite' }}>
        <Headphones size={32} color="var(--jambonz)" strokeWidth={1.7} />
      </div>
      <div style={{ fontFamily: 'var(--font-bold)', fontSize: '1.1rem' }}>No active calls</div>
      <div style={{ fontSize: '0.88rem', color: '#7a7778', lineHeight: 1.55, maxWidth: 240 }}>
        There are no live calls on this system right now. New calls appear here automatically as they start.
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.8rem', color: 'var(--jambonz)', fontFamily: 'var(--font-medium)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--jambonz)', animation: 'rm-eq 1100ms ease-in-out infinite' }} /> Watching for new calls
      </div>
    </div>
  );
}

export function RoomRail({ rooms, selectedRoomId, mode, onSelect }: { rooms: Room[]; selectedRoomId: string | null; mode: SupervisorMode; onSelect: (id: string) => void }) {
  return (
    <div style={{ width: 380, flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--white)', borderRight: '1px solid #e4e3e3', minHeight: 0 }}>
      <div style={{ flex: 'none', padding: '16px 18px 12px', borderBottom: '1px solid var(--grey-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-bold)', fontSize: '1.05rem' }}>Rooms</span>
          <span style={{ fontSize: '0.75rem', color: '#9a9899', fontFamily: 'var(--font-medium)', background: 'var(--grey-light)', padding: '3px 9px', borderRadius: 20 }}>{rooms.length}</span>
        </div>
      </div>
      <div className="rm-list" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {rooms.length === 0 && <EmptyState />}
        {rooms.map((room) => {
          const isSel = room.id === selectedRoomId;
          const agents = agentCount(room);
          const others = otherCount(room);
          return (
            <div
              key={room.id}
              className="rm-row"
              onClick={() => onSelect(room.id)}
              style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px 14px 13px', cursor: 'pointer', borderBottom: '1px solid var(--grey-light)', borderLeft: `3px solid ${isSel ? 'var(--jambonz)' : 'transparent'}`, background: isSel ? 'var(--pink)' : 'transparent', position: 'relative' }}
            >
              <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', background: 'var(--purple)' }}>
                <Users size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-medium)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.name}</span>
                  <span style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: '#9a9899', flex: 'none' }}>{fmtDur(room.durationSec)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-medium)', color: agents > 0 ? 'var(--teal)' : '#9a9899' }}>
                    {agents} {agents === 1 ? 'agent' : 'agents'}
                  </span>
                  <span style={{ color: '#d2d0d0' }}>·</span>
                  <span style={{ fontSize: '0.8rem', color: '#9a9899' }}>
                    {others} {others === 1 ? 'other' : 'others'}
                  </span>
                </div>
              </div>
              {isSel && mode !== 'idle' && <Equalizer />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
