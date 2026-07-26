# Transcript speaker labels: measured limits and the path forward

## TL;DR

Speaker diarization on the conference-mix transcript is **best-effort, not
reliable**, on this platform: every conference member leg is G.711/PCMU into
the media server regardless of the caller's codec, so the room mix is always
narrowband — and streaming diarization on narrowband mono audio measures at
**~70–85% word attribution** across every Deepgram configuration we tested,
even with perfectly clean turn-taking. Reliable per-speaker transcripts need a
platform feature (below), not app-side tuning.

## What we measured (2026-07-26, eu.jambonz.io)

Method: fake-mic legs with known scripts into a live room, the room's real
conference-listen fork audio captured, then replayed against Deepgram's
streaming API (`tools/e2e/rehearse.mjs` choreographs the legs; keyword-based
attribution scoring against the known scripts).

| Configuration | Attribution purity |
|---|---|
| nova-3-general @16k (app default) | ~70% |
| nova-2-general @16k | ~70% |
| nova-2-phonecall @8k | ~70% |
| nova-3-general @8k | ~70% (hallucinated a 3rd speaker) |
| nova-3-general, zero-overlap choreographed turns | ~75–85% |

Notes:
- The media server negotiates **PCMU with every conference member leg** (the
  browser↔SBC hop may be Opus, but SBC↔media server is G.711), so the fork's
  16 kHz stream only ever carries ≤4 kHz content. Diarization quality on
  wideband audio is far better — but no conference audio is wideband here.
- Overlapping speech makes it worse; clean turn-taking does not make it good.
- Run-to-run variance is high: occasionally a run splits nearly perfectly,
  which is how early screenshots were produced. Do not mistake a good run for
  the expected behavior.

## The right fix (platform work, not app work)

A **member-scoped fork** in the media server: like the existing server-scoped
`room.fork` (which feeds the conference mix), but per conference member,
carrying only that member's inbound audio. The app already knows every
member's identity (client username / caller number / memberTag), so transcripts
get authoritative labels — "agent1 (agent)", "+15085551234" — and diarization
is not needed at all. Per-leg `listen` via the `config` verb is NOT a viable
substitute for conferenced legs: the conference bridge itself occupies the
leg's fork machinery.

Until then the UI's "Speaker N" labels should be treated as approximate.
