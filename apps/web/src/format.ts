/** Duration: seconds under a minute (0:57), whole minutes above (3m). */
export function fmtDur(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  if (s < 60) return `0:${String(s).padStart(2, '0')}`;
  return `${Math.floor(s / 60)}m`;
}

/** Precise m:ss for transcript timestamps. */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function isPhone(s: string): boolean {
  const t = (s || '').trim();
  return /^[+(]/.test(t) || /^[\d().\s-]+$/.test(t);
}

/** Initials for an avatar, or "#" for phone-number labels. */
export function initials(name: string): string {
  if (isPhone(name)) return '#';
  return (
    (name || '')
      .replace(/[,.]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '#'
  );
}

/** Stable per-speaker colour from the design palette. */
const PALETTE = ['var(--blue)', 'var(--teal)', 'var(--purple)', 'var(--jambonz)', 'var(--green)', 'var(--dark)'];
export function speakerColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
