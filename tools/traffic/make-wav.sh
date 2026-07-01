#!/usr/bin/env bash
# Synthesize a speech WAV (8 kHz mono PCM) for the traffic generator.
# Uses macOS `say` or espeak, then sox/ffmpeg to resample.
set -euo pipefail

OUT=${1:-speech.wav}
TEXT=${TEXT:-"Thanks for calling. Let me pull up your account. Can you confirm the order number for me? Great, I can see the issue now, give me just a moment to apply the credit."}

TMP=$(mktemp -t rm-say.XXXXXX).wav

if command -v say >/dev/null; then            # macOS
  say -o "$TMP" --data-format=LEI16@22050 "$TEXT"
elif command -v espeak >/dev/null; then        # linux
  espeak -w "$TMP" "$TEXT"
else
  echo "need macOS 'say' or 'espeak' to synthesize speech" >&2; exit 1
fi

if command -v sox >/dev/null; then
  sox "$TMP" -r 8000 -c 1 -b 16 "$OUT"
elif command -v ffmpeg >/dev/null; then
  ffmpeg -y -loglevel error -i "$TMP" -ar 8000 -ac 1 -sample_fmt s16 "$OUT"
else
  echo "need sox or ffmpeg to resample to 8k mono" >&2; exit 1
fi

rm -f "$TMP"
echo "wrote $OUT (8 kHz mono PCM)"
