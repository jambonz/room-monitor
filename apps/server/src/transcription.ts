import WebSocket from 'ws';
import { logger } from './logger.js';

/** A diarized transcript fragment from the room mix. */
export interface TranscriptFragment {
  /** Diarized speaker label, e.g. "Speaker 1". */
  speaker: string;
  text: string;
}

interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  speaker?: number;
}

interface DeepgramResult {
  type?: string;
  is_final?: boolean;
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
    private readonly opts: { sampleRate: number; channels?: number },
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
      diarize: 'true',
      punctuate: 'true',
      interim_results: 'false',
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
    if (!msg.is_final) return;
    const alt = msg.channel?.alternatives?.[0];
    if (!alt || !alt.transcript) return;

    // Group consecutive words by diarized speaker into separate lines.
    const words = alt.words ?? [];
    if (words.length === 0) {
      this.onFragment({ speaker: 'Speaker', text: alt.transcript });
      return;
    }
    let curSpeaker = words[0].speaker ?? 0;
    let buf: string[] = [];
    const flush = () => {
      if (buf.length === 0) return;
      this.fragmentsOut++;
      this.onFragment({ speaker: `Speaker ${curSpeaker + 1}`, text: buf.join(' ') });
      buf = [];
    };
    for (const w of words) {
      const sp = w.speaker ?? 0;
      if (sp !== curSpeaker) {
        flush();
        curSpeaker = sp;
      }
      buf.push(w.punctuated_word ?? w.word);
    }
    flush();
  }

  /** Feed a chunk of L16 PCM from the fork. */
  write(pcm: Buffer): void {
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
