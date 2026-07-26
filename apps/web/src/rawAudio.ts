/**
 * Microphone constraint assembly for every call the web app places.
 *
 * - Device: the user's picked mic (MicPicker → localStorage) beats the browser
 *   default. The default is frequently the wrong device (a USB interface wins
 *   over the AirPods the user is talking into), which makes them silently
 *   inaudible — audio flows, but it's the wrong device's silence.
 * - Test hook: when the URL hash contains "raw" (e.g. #raw, #phone-raw),
 *   disable browser mic processing (echo cancellation / noise suppression /
 *   AGC). Chrome's processing treats a looping synthetic WAV
 *   (--use-file-for-fake-audio-capture) as steady background noise and
 *   suppresses it, so e2e runs must bypass it. Real users keep processing on.
 */
import type { MediaStreamConstraints as JambonzMediaConstraints } from '@jambonz/client-sdk-web';

export const MIC_LS_KEY = 'rm_micDeviceId';

export function rawAudioRequested(): boolean {
  return location.hash.includes('raw');
}

function pickedMicId(): string {
  try {
    return localStorage.getItem(MIC_LS_KEY) ?? '';
  } catch {
    return '';
  }
}

export function micConstraints(): JambonzMediaConstraints | undefined {
  const raw = rawAudioRequested();
  const micId = pickedMicId();
  if (!raw && !micId) return undefined; // browser default device + processing

  const audio: Record<string, unknown> = {};
  if (micId) audio.deviceId = { exact: micId };
  if (raw) {
    audio.echoCancellation = false;
    audio.noiseSuppression = false;
    audio.autoGainControl = false;
  }
  return { audio } as JambonzMediaConstraints;
}
