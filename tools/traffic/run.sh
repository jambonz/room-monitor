#!/usr/bin/env bash
# Background-traffic generator for the room-monitor demo.
#
# Spawns sipp participants into demo rooms via the jambonz SBC. Each call joins
# a room (X-Room) as agent or caller (X-Role), routed to the room-monitor
# application (X-Application-Sid), and loops a WAV as its speech.
#
# Usage:
#   SBC=sip.example.com APP_SID=<application_sid> WAV=speech.wav ./run.sh
#
# Optional:
#   ROOMS="alpha beta"     rooms to populate           (default: bg-room-1 bg-room-2)
#   AGENTS_PER_ROOM=1      tagged agents per room      (default: 1)
#   CALLERS_PER_ROOM=2     plain callers per room      (default: 2)
#   DURATION_MS=300000     call duration               (default: 5 min)
#   AUTH_USER= AUTH_PASS=  digest credentials if the SBC challenges
#   SBC_PORT=5060 TRANSPORT=u1 (sipp -t value; t1 for TCP)
#
# The WAV must be 8 kHz mono PCM (see make-wav.sh). Requires sipp with
# rtp_stream support (most distro builds have it).
set -euo pipefail

: "${SBC:?set SBC=<sbc host/ip>}"
: "${APP_SID:?set APP_SID=<room-monitor application sid>}"
: "${WAV:?set WAV=<path to 8k mono wav>}"

ROOMS=${ROOMS:-"bg-room-1 bg-room-2"}
AGENTS_PER_ROOM=${AGENTS_PER_ROOM:-1}
CALLERS_PER_ROOM=${CALLERS_PER_ROOM:-2}
DURATION_MS=${DURATION_MS:-300000}
SBC_PORT=${SBC_PORT:-5060}
TRANSPORT=${TRANSPORT:-u1}

command -v sipp >/dev/null || { echo "sipp not found in PATH" >&2; exit 1; }
[ -f "$WAV" ] || { echo "WAV not found: $WAV" >&2; exit 1; }

DIR=$(cd "$(dirname "$0")" && pwd)
CSV=$(mktemp -t rm-traffic.XXXXXX).csv

# injection file: one row per participant — room;role
echo "SEQUENTIAL" > "$CSV"
total=0
for room in $ROOMS; do
  for _ in $(seq 1 "$AGENTS_PER_ROOM");  do echo "${room};agent;"  >> "$CSV"; total=$((total+1)); done
  for _ in $(seq 1 "$CALLERS_PER_ROOM"); do echo "${room};caller;" >> "$CSV"; total=$((total+1)); done
done

AUTH_ARGS=()
if [ -n "${AUTH_USER:-}" ]; then AUTH_ARGS=(-au "$AUTH_USER" -ap "${AUTH_PASS:-}"); fi

echo "starting $total participants into rooms: $ROOMS (duration ${DURATION_MS}ms)"
exec sipp "$SBC:$SBC_PORT" \
  -sf "$DIR/participant.xml" \
  -inf "$CSV" \
  -t "$TRANSPORT" \
  -key app_sid "$APP_SID" \
  -key wav "$WAV" \
  -d "$DURATION_MS" \
  -m "$total" -l "$total" -r 1 \
  "${AUTH_ARGS[@]}" \
  -trace_err
