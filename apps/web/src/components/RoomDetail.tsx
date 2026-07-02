import { Headphones, Mic, LogIn, LogOut, Users, Lock } from 'react-feather';
import type { Room, SupervisorMode, TranscriptLine } from '@room-monitor/shared';
import { agentCount, otherCount, coachAvailable } from '@room-monitor/shared';
import { fmtDur, speakerColor } from '../format.js';
import { TranscriptList, TranscriptOff } from './Transcript.js';

const MODE_STATUS: Record<Exclude<SupervisorMode, 'idle'>, string> = {
  monitor: 'Monitoring silently — the participants cannot hear you',
  coach: 'Coaching — only the agents hear you',
  enter: 'In the room — everyone can hear you',
};
const MODE_COLOR: Record<Exclude<SupervisorMode, 'idle'>, string> = {
  monitor: 'var(--blue)',
  coach: 'var(--purple)',
  enter: 'var(--jambonz)',
};
const SUP_ROLE: Record<SupervisorMode, { role: string; color: string; bg: string; border: string; dot: string }> = {
  idle: { role: 'not listening', color: '#9a9899', bg: 'var(--grey-light)', border: 'var(--grey-light)', dot: 'var(--grey)' },
  monitor: { role: 'listening', color: 'var(--blue)', bg: '#e6f0ff', border: '#cfe0ff', dot: 'var(--blue)' },
  coach: { role: 'coaching', color: 'var(--purple)', bg: '#f3ecf7', border: '#e3d2ee', dot: 'var(--purple)' },
  enter: { role: 'in room', color: 'var(--jambonz)', bg: 'var(--pink)', border: '#f6d3df', dot: 'var(--jambonz)' },
};

function ModeButton({ active, disabled, color, icon, label, onClick }: { active: boolean; disabled: boolean; color: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 9, cursor: disabled ? 'default' : 'pointer', opacity: disabled && !active ? 0.55 : 1, whiteSpace: 'nowrap', flex: 'none', fontFamily: 'var(--font-medium)', fontSize: '0.9rem', border: `1.5px solid ${active ? color : 'var(--grey)'}`, color: active ? 'var(--white)' : '#5a5758', background: active ? color : 'var(--white)' }}
    >
      {icon} {label}
    </button>
  );
}

/** Tinted footer shown while coaching / in the room — the design's "speak" bar
 *  minus the prototype text box (the supervisor's mic is the real input). */
function ModeBanner({ mode }: { mode: 'coach' | 'enter' }) {
  const coach = mode === 'coach';
  return (
    <div style={{ flex: 'none', padding: '12px 24px 16px', borderTop: '1px solid var(--grey-light)', background: coach ? '#faf6fd' : '#fff6f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontFamily: 'var(--font-medium)', color: coach ? 'var(--purple)' : 'var(--jambonz)' }}>
        {coach ? <Lock size={14} /> : <Users size={14} />}
        {coach
          ? 'Coaching the agents privately — other participants will not hear this'
          : 'You are in the room — everyone can hear you'}
      </div>
    </div>
  );
}

function Wave({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24 }}>
      {[0, 120, 260, 80, 340].map((d, i) => (
        <span key={i} style={{ width: 3, height: '100%', borderRadius: 3, background: color, transformOrigin: 'bottom', animation: `rm-eq 700ms ease-in-out ${d}ms infinite` }} />
      ))}
    </div>
  );
}

export function RoomDetail({
  room,
  mode,
  modePending,
  engageError,
  transcriptOn,
  lines,
  onSetMode,
  onStop,
  onToggleTranscript,
}: {
  room: Room | null;
  mode: SupervisorMode;
  modePending: boolean;
  engageError: string;
  transcriptOn: boolean;
  lines: TranscriptLine[];
  onSetMode: (m: Exclude<SupervisorMode, 'idle'>) => void;
  onStop: () => void;
  onToggleTranscript: () => void;
}) {
  if (!room) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#9a9899', padding: 40, textAlign: 'center', background: 'var(--white)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--grey-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={28} color="#bdbcbc" strokeWidth={1.8} />
        </div>
        <div style={{ fontFamily: 'var(--font-medium)', fontSize: '1.05rem', color: '#6b6869' }}>No room selected</div>
        <div style={{ fontSize: '0.9rem', maxWidth: 240, lineHeight: 1.5 }}>Select a room from the list to view its participants and tap in to monitor.</div>
      </div>
    );
  }

  const agents = agentCount(room);
  const others = otherCount(room);
  const hasAgents = coachAvailable(room);
  const listening = mode !== 'idle' && !modePending;
  const sup = modePending
    ? { role: 'connecting…', color: '#9a9899', bg: 'var(--grey-light)', border: 'var(--grey-light)', dot: 'var(--grey)' }
    : SUP_ROLE[mode];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--white)', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--grey-light)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', background: 'var(--purple)' }}>
              <Users size={24} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-bold)', fontSize: '1.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.name}</div>
              <div style={{ marginTop: 5, color: '#7a7778', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-medium)', color: hasAgents ? 'var(--teal)' : '#9a9899' }}>{agents} {agents === 1 ? 'agent' : 'agents'}</span>
                <span style={{ color: '#d2d0d0' }}>·</span>
                <span>{others} {others === 1 ? 'other' : 'others'}</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ fontFamily: 'var(--font-bold)', fontSize: '1.6rem', fontVariantNumeric: 'tabular-nums' }}>{fmtDur(room.durationSec)}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: '0.78rem', color: '#9a9899', fontFamily: 'var(--font-medium)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} /> Active
            </div>
          </div>
        </div>

        {/* Participants */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          {room.participants.map((p, i) => (
            <span key={p.call_sid || i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8, background: p.isAgent ? '#eafaf8' : 'var(--grey-light)', border: `1px solid ${p.isAgent ? '#cdeeea' : 'var(--grey-light)'}`, fontSize: '0.85rem' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: speakerColor(p.label || p.call_sid) }} />
              {p.label}
              {p.isAgent && <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-medium)', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--teal)' }}>agent</span>}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem', whiteSpace: 'nowrap', color: sup.color, background: sup.bg, border: `1px solid ${sup.border}` }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: sup.dot }} />
            You <span style={{ opacity: 0.7 }}>· {sup.role}</span>
          </span>
        </div>
      </div>

      {/* Control bar */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--grey-light)', display: 'flex', alignItems: 'center', gap: 16, background: '#fcfbfb', minHeight: 62 }}>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <ModeButton active={mode === 'monitor'} disabled={modePending} color="var(--blue)" icon={<Headphones size={17} />} label="Listen" onClick={() => onSetMode('monitor')} />
          {hasAgents && <ModeButton active={mode === 'coach'} disabled={modePending} color="var(--purple)" icon={<Mic size={17} />} label="Coach" onClick={() => onSetMode('coach')} />}
          <ModeButton active={mode === 'enter'} disabled={modePending} color="var(--jambonz)" icon={<LogIn size={17} />} label="Enter Room" onClick={() => onSetMode('enter')} />
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {modePending ? (
            <span style={{ fontSize: '0.88rem', fontFamily: 'var(--font-medium)', color: '#9a9899' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--grey)', marginRight: 8, animation: 'rm-eq 900ms ease-in-out infinite' }} />
              Connecting…
            </span>
          ) : listening ? (
            <>
              <Wave color={MODE_COLOR[mode as Exclude<SupervisorMode, 'idle'>]} />
              <span style={{ fontSize: '0.88rem', fontFamily: 'var(--font-medium)', color: MODE_COLOR[mode as Exclude<SupervisorMode, 'idle'>], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {MODE_STATUS[mode as Exclude<SupervisorMode, 'idle'>]}
              </span>
            </>
          ) : engageError ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{engageError}</span>
          ) : (
            <span style={{ fontSize: '0.85rem', color: '#9a9899' }}>You are not connected to this room — the participants won't hear you.</span>
          )}
        </div>

        {(listening || modePending) && (
          <button onClick={onStop} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 9, cursor: 'pointer', flex: 'none', fontFamily: 'var(--font-medium)', fontSize: '0.9rem', border: '1.5px solid var(--grey)', color: '#6b6869', background: 'var(--white)' }}>
            <LogOut size={16} /> {modePending ? 'Cancel' : mode === 'enter' ? 'Leave room' : 'Stop'}
          </button>
        )}
      </div>

      {/* Transcript header + toggle */}
      <div style={{ flex: 'none', padding: '14px 24px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#7a7778', fontFamily: 'var(--font-medium)' }}>Live transcript</span>
          {transcriptOn && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', animation: 'rm-eq 1200ms ease-in-out infinite' }} />}
        </div>
        <button onClick={onToggleTranscript} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-medium)', fontSize: '0.8rem', color: transcriptOn ? 'var(--jambonz)' : '#9a9899' }}>
          {transcriptOn ? 'On' : 'Off'}
          <span style={{ width: 40, height: 23, borderRadius: 23, background: transcriptOn ? 'var(--jambonz)' : 'var(--grey)', position: 'relative', flex: 'none' }}>
            <span style={{ position: 'absolute', top: 2.5, left: transcriptOn ? 19 : 2.5, width: 18, height: 18, borderRadius: '50%', background: 'var(--white)', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
          </span>
        </button>
      </div>

      {transcriptOn ? <TranscriptList lines={lines} /> : <TranscriptOff onTurnOn={onToggleTranscript} />}

      {(mode === 'coach' || mode === 'enter') && !modePending && <ModeBanner mode={mode} />}
    </div>
  );
}
