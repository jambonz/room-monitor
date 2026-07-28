import WebSocket from 'ws';
import { logger } from './logger.js';

/** A transcript fragment from one audio stream. */
export interface TranscriptFragment {
  /** Speaker label ("Speaker 1" diarized, or the stream's fixed label). */
  speaker: string;
  text: string;
  /** Wall-clock ms when this speech STARTED. With per-member streams,
   *  finals arrive when each utterance ENDS, so arrival order across streams
   *  is not speech order — consumers must order by this instead. Derived from
   *  Deepgram's stream-relative start + the stream's first-audio epoch (valid
   *  because the fork paces silence continuously, so stream time ≈ wall time). */
  startMs: number;
  /** Stable id for the utterance (stream-relative start): interim updates and
   *  the eventual final all carry the same id, so a consumer replaces in place. */
  id: string;
  /** True while the utterance is still in progress (Deepgram interim result). */
  interim: boolean;
}

interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  speaker?: number;
  start?: number; // seconds, stream-relative
}

interface DeepgramResult {
  type?: string;
  is_final?: boolean;
  start?: number; // seconds, stream-relative
  channel?: { alternatives?: Array<{ transcript?: string; words?: DeepgramWord[] }> };
}

const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen';

/**
 * Streams L16 PCM (the room mix from the MediaJam listen fork) to Deepgram's
 * realtime API with speaker diarization, and emits speaker-labelled fragments.
 *
 * jambonz/MediaJam transports the audio; this is the consumer's private STT —
 * nothing here touches jambonz.
 */
export class Transcriber {
  private ws: WebSocket | null = null;
  private closed = false;

  constructor(
    private readonly apiKey: string,
    private readonly opts: {
      sampleRate: number;
      channels?: number;
      /** Fixed speaker label for this stream (a member-scoped fork: the
       *  participant's identity is known, so diarization is off and every
       *  fragment carries this label). Unset = the mix stream: diarize and
       *  label fragments "Speaker N" (best-effort — see docs/DIARIZATION.md). */
      label?: string;
      /** Optional content gate: when it returns false, the stream is paced with
       *  SILENCE instead of the real audio, so this speech never reaches the STT
       *  engine at all. Used for the supervisor's stream, which must only be
       *  transcribed while they are audible to the room (barge-in) — the media
       *  server tees a member's audio before the mute check, so their mic
       *  reaches us even while they monitor silently. Pacing with silence rather
       *  than skipping keeps stream time aligned with wall time, which the
       *  speech-start timestamps depend on. */
      audioGate?: () => boolean;
    },
    private readonly onFragment: (f: TranscriptFragment) => void
  ) {
    this.connect();
  }

  private connect(): void {
    const params = new URLSearchParams({
      encoding: 'linear16',
      sample_rate: String(this.opts.sampleRate),
      channels: String(this.opts.channels ?? 1),
      model: 'nova-3-general',
      diarize: this.opts.label ? 'false' : 'true',
      punctuate: 'true',
      // Interim results let a line appear WHILE it is being spoken instead of
      // after the utterance completes (finals wait on endpointing, which is
      // most of the perceived transcript latency). Only useful on a
      // single-speaker stream: on the diarized mix the speaker isn't known
      // until the final carries per-word speaker ids, so interims are dropped
      // there (see onMessage).
      interim_results: 'true',
      smart_format: 'true',
    });
    const ws = new WebSocket(`${DEEPGRAM_URL}?${params.toString()}`, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });
    this.ws = ws;

    ws.on('open', () => logger.info({ sampleRate: this.opts.sampleRate }, 'Transcriber: deepgram connected'));
    ws.on('message', (data) => this.onMessage(data));
    ws.on('error', (err) => logger.warn({ err }, 'Transcriber: deepgram error'));
    ws.on('close', (code, reason) => {
      if (!this.closed) {
        logger.warn({ code, reason: reason?.toString() }, 'Transcriber: deepgram closed unexpectedly');
      }
    });
  }

  /** counters for pipeline observability (logged by the fork sink) */
  bytesIn = 0;
  resultsIn = 0;
  fragmentsOut = 0;
  /** peak |sample| seen since the last takePeak() — silence detector */
  private peak = 0;

  takePeak(): number {
    const p = this.peak;
    this.peak = 0;
    return p;
  }

  private onMessage(data: WebSocket.RawData): void {
    let msg: DeepgramResult;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type && msg.type !== 'Results') {
      logger.info({ type: msg.type }, 'Transcriber: deepgram non-result message');
      return;
    }
    this.resultsIn++;
    const alt = msg.channel?.alternatives?.[0];
    if (!alt || !alt.transcript) return;
    const interim = !msg.is_final;
    // The mix stream's speaker only becomes known when the final arrives with
    // per-word speaker ids, so its interims carry no usable attribution.
    if (interim && !this.opts.label) return;

    // stream-relative seconds → wall-clock ms via the stream's first-audio
    // epoch (now() fallback keeps lines usable if either is missing)
    const at = (relSec: number | undefined): number =>
      this.epochMs && relSec !== undefined ? this.epochMs + relSec * 1000 : Date.now();
    const words = alt.words ?? [];

    // A member-scoped stream has one known speaker — no grouping needed.
    if (this.opts.label) {
      // One id per utterance, from a sequence counter — NOT from Deepgram's
      // timestamps: those shift between interim updates of the same utterance,
      // so a timestamp-derived id made every update a new line instead of
      // replacing the previous one (grey interim lines piled up above the
      // final). The counter advances only when an utterance finalizes, so all
      // of its interims and its final share one id.
      if (this.utteranceStartMs === 0) this.utteranceStartMs = at(words[0]?.start ?? msg.start);
      this.onFragment({
        speaker: this.opts.label,
        text: alt.transcript,
        // the utterance keeps the position it first took, so a line firming up
        // never jumps even if the refined timestamps move slightly
        startMs: this.utteranceStartMs,
        id: `u${this.utteranceSeq}`,
        interim,
      });
      if (!interim) {
        this.fragmentsOut++;
        this.utteranceSeq++;
        this.utteranceStartMs = 0;
      }
      return;
    }

    // Group consecutive words by diarized speaker into separate lines.
    if (words.length === 0) {
      this.onFragment({
        speaker: 'Speaker',
        text: alt.transcript,
        startMs: at(msg.start),
        id: `u${(msg.start ?? 0).toFixed(2)}`,
        interim: false,
      });
      return;
    }
    let curSpeaker = words[0].speaker ?? 0;
    let bufStart: number | undefined = words[0].start;
    let buf: string[] = [];
    const flush = () => {
      if (buf.length === 0) return;
      this.fragmentsOut++;
      this.onFragment({
        speaker: `Speaker ${curSpeaker + 1}`,
        text: buf.join(' '),
        startMs: at(bufStart),
        id: `u${(bufStart ?? 0).toFixed(2)}-s${curSpeaker}`,
        interim: false,
      });
      buf = [];
    };
    for (const w of words) {
      const sp = w.speaker ?? 0;
      if (sp !== curSpeaker) {
        flush();
        curSpeaker = sp;
        bufStart = w.start;
      }
      buf.push(w.punctuated_word ?? w.word);
    }
    flush();
  }

  /** Wall-clock ms when this stream's first audio was written — the epoch that
   *  maps Deepgram's stream-relative timestamps to absolute time. */
  private epochMs = 0;

  /** counts chunks replaced by silence because the content gate was closed */
  gatedChunks = 0;

  /** utterance identity for a single-speaker stream: every interim update of the
   *  utterance in flight, and its final, share this sequence number; the start
   *  time is pinned at the first update so the line does not move as it grows. */
  private utteranceSeq = 0;
  private utteranceStartMs = 0;

  /** Feed a chunk of L16 PCM from the fork. */
  write(pcm: Buffer): void {
    if (this.epochMs === 0) this.epochMs = Date.now();
    if (this.opts.audioGate && !this.opts.audioGate()) {
      // paced silence: keeps the stream (and its clock) alive without ever
      // letting this speech reach the STT engine
      this.gatedChunks++;
      const silence = Buffer.alloc(pcm.length);
      this.bytesIn += silence.length;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(silence);
      return;
    }
    this.bytesIn += pcm.length;
    // silence detector: track the peak sample amplitude
    for (let i = 0; i + 1 < pcm.length; i += 2) {
      const v = Math.abs(pcm.readInt16LE(i));
      if (v > this.peak) this.peak = v;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(pcm);
    }
  }

  /** Stop transcription and close the Deepgram connection. */
  close(): void {
    this.closed = true;
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        }
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }
}
