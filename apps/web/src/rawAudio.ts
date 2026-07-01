/**
 * Test hook: when the URL hash contains "raw" (e.g. #raw, #phone-raw), disable
 * browser mic processing (echo cancellation / noise suppression / AGC).
 *
 * Chrome's processing treats a looping synthetic WAV (--use-file-for-fake-
 * audio-capture) as steady background noise and suppresses it, so e2e runs
 * must bypass it. Real users keep processing on.
 */
import type { MediaStreamConstraints as JambonzMediaConstraints } from '@jambonz/client-sdk-web';

export function rawAudioRequested(): boolean {
  return location.hash.includes('raw');
}

export function micConstraints(): JambonzMediaConstraints | undefined {
  if (!rawAudioRequested()) return undefined;
  return {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };
}
