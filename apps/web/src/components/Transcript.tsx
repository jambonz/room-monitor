import { useEffect, useRef } from 'react';
import { FileText } from 'react-feather';
import type { TranscriptLine } from '@room-monitor/shared';
import { fmtClock, initials, speakerColor } from '../format.js';

export function TranscriptOff({ onTurnOn }: { onTurnOn: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 13, padding: 40, minHeight: 0, background: 'var(--white)' }}>
      <div style={{ width: 60, height: 60, borderRadius: 14, background: 'var(--grey-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FileText size={26} color="#9a9899" strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: 'var(--font-medium)', fontSize: '1.02rem', color: '#6b6869' }}>Transcript is off</div>
      <div style={{ fontSize: '0.9rem', color: '#9a9899', maxWidth: 310, lineHeight: 1.55 }}>
        Turn on transcription to capture a live, speaker-labelled record of this room. It runs independently of monitoring.
      </div>
      <button onClick={onTurnOn} style={{ marginTop: 4, padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-medium)', fontSize: '0.9rem', color: 'var(--white)', background: 'var(--jambonz)' }}>
        Turn on transcript
      </button>
    </div>
  );
}

export function TranscriptList({ lines }: { lines: TranscriptLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div ref={ref} className="rm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '2px 24px 14px', minHeight: 0, background: 'var(--white)' }}>
      {lines.length === 0 && (
        <div style={{ padding: '14px 10px', color: '#a9a7a8', fontSize: '0.9rem', fontStyle: 'italic' }}>Transcribing — waiting for speech…</div>
      )}
      {lines.map((ln, i) => {
        const supervisor = !!ln.channel;
        const coach = ln.channel === 'coach';
        const color = supervisor ? (coach ? 'var(--purple)' : 'var(--jambonz)') : speakerColor(ln.speaker);
        const note = supervisor ? (coach ? '🔒 private to agents' : 'live to all') : '';
        const rowBg = supervisor ? (coach ? '#f7f1fb' : 'var(--pink)') : 'transparent';
        const tag = supervisor ? 'SU' : initials(ln.speaker);
        const speaker = supervisor ? 'You · Supervisor' : ln.speaker;
        return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 10px', margin: '2px 0', borderRadius: 10, background: rowBg }}>
            <div style={{ width: 30, height: 30, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-bold)', fontSize: '0.66rem', color: 'var(--white)', background: color }}>{tag}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-medium)', fontSize: '0.88rem', color }}>{speaker}</span>
                <span style={{ fontSize: '0.72rem', color: '#b3b1b2', fontVariantNumeric: 'tabular-nums' }}>{fmtClock(ln.tsMs)}</span>
                {note && <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-medium)', color }}>{note}</span>}
              </div>
              <div style={{ fontSize: '0.96rem', lineHeight: 1.5, color: '#3a3637', marginTop: 2 }}>{ln.text}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
