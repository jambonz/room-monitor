import { useCallback, useEffect, useState } from 'react';
import { Mic } from 'react-feather';
import { MIC_LS_KEY } from '../rawAudio.js';

/**
 * Microphone selector. The browser's default input device is frequently NOT
 * the one the user is speaking into (e.g. a USB interface wins over AirPods),
 * which makes the supervisor silently inaudible — audio flows, but it's the
 * wrong device's silence. Self-contained: persists the chosen deviceId to
 * localStorage, where micConstraints() picks it up for every call.
 */
export function MicPicker() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<string>(() => {
    try {
      return localStorage.getItem(MIC_LS_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [needsPermission, setNeedsPermission] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all.filter((d) => d.kind === 'audioinput' && d.deviceId);
      // labels are empty until the site has been granted mic permission
      setNeedsPermission(mics.length === 0 || mics.every((d) => !d.label));
      setDevices(mics);
    } catch {
      /* leave empty — default device will be used */
    }
  }, []);

  // Re-enumerate on every opportunity, not just `devicechange`: that event is
  // the documented signal but it is not dependable in practice (it can be
  // missed while the tab is unfocused, and a device paired *after* the page
  // loaded — AirPods connected mid-session — may not surface until something
  // asks again). So also refresh when the window regains focus and whenever the
  // user actually opens the selector, which is the moment the list must be
  // right.
  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* denied — selector stays in permission state */
    }
    await refresh();
  }, [refresh]);

  const choose = (id: string) => {
    setSelected(id);
    try {
      if (id) localStorage.setItem(MIC_LS_KEY, id);
      else localStorage.removeItem(MIC_LS_KEY);
    } catch {
      /* ignore */
    }
  };

  if (needsPermission) {
    return (
      <button
        onClick={() => void requestPermission()}
        title="Grant microphone access to choose an input device"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-regular)', fontSize: '0.8rem', border: '1.5px solid var(--grey)', color: '#6b6869', background: 'var(--white)', whiteSpace: 'nowrap' }}
      >
        <Mic size={14} /> Choose mic…
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <Mic size={14} style={{ color: '#9a9899', flex: 'none' }} />
      <select
        value={selected}
        onChange={(e) => choose(e.target.value)}
        onMouseDown={() => void refresh()}
        onFocus={() => void refresh()}
        title="Microphone used when you Listen / Coach / Enter. Applies to your next connection — if you are already in a room, Stop and re-engage to switch device."
        style={{ maxWidth: 190, padding: '8px 8px', borderRadius: 8, border: '1.5px solid var(--grey)', fontFamily: 'var(--font-regular)', fontSize: '0.8rem', color: '#5a5758', background: 'var(--white)', outline: 'none', textOverflow: 'ellipsis' }}
      >
        <option value="">System default mic</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
          </option>
        ))}
      </select>
    </span>
  );
}
