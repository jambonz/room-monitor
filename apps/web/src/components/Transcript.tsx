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

/**
 * Live pane: what is being said RIGHT NOW, anchored below the settled
 * transcript. Keeping in-progress text out of the record means the transcript
 * above never reflows or reorders as words arrive, and two people talking at
 * once simply get a row each. Each row disappears the instant its final lands
 * in the record above.
 *
 * The pane holds its height whether or not anyone is speaking, so the
 * transcript does not jump every time someone starts and stops.
 */
export function LiveTranscript({ lines }: { lines: TranscriptLine[] }) {
  return (
    <div
      style={{
        flex: 'none',
        minHeight: 62,
        maxHeight: 96,
        overflowY: 'auto',
        padding: '9px 24px 11px',
        borderTop: '1px solid var(--grey-light)',
        background: '#fbfbfc',
      }}
    >
      <div
        style={{
          fontSize: '0.66rem',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          color: '#b3b1b2',
          fontFamily: 'var(--font-medium)',
          marginBottom: 4,
        }}
      >
        Being said now
      </div>
      {lines.length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: '#c9c7c8', fontStyle: 'italic' }}>…</div>
      ) : (
        lines.map((ln) => (
          <div key={ln.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 1 }}>
            <span
              style={{
                fontFamily: 'var(--font-medium)',
                fontSize: '0.78rem',
                color: ln.channel ? 'var(--jambonz)' : speakerColor(ln.speaker),
                flex: 'none',
              }}
            >
              {ln.speaker}
            </span>
            <span style={{ fontSize: '0.9rem', color: '#8a8788', fontStyle: 'italic', minWidth: 0 }}>{ln.text}</span>
          </div>
        ))
      )}
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
        // the backend names the speaker ("supervisor", "agent", or a phone
        // number); the channel only drives the styling + heard-by note
        const speaker = ln.speaker;
        return (
          <div key={ln.id ?? i} style={{ display: 'flex', gap: 12, padding: '9px 10px', margin: '2px 0', borderRadius: 10, background: rowBg }}>
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
