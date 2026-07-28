import { randomUUID } from 'node:crypto';
import type { Room, ServerMessage, SupervisorMode, TranscriptLine } from '@room-monitor/shared';
import { JambonzRest, type JambonzCreds } from './jambonz-rest.js';
import { getSupervisorLeg } from './supervisor-registry.js';
import { Transcriber } from './transcription.js';
import { config } from './config.js';
import { logger } from './logger.js';

const POLL_INTERVAL_MS = 2000;
/** PCM rate we request for the conference listen fork (and advertise in its metadata). */
export const FORK_SAMPLE_RATE = 16000;

export interface SessionConfig {
  send: (msg: ServerMessage) => void;
}

/**
 * One supervisor's server-side state: jambonz credentials, the selected room,
 * the engagement mode, transcript on/off, the linked supervisor call leg, and
 * the active transcriber. Owns the room-discovery poll and the engagement /
 * transcript actions.
 */
export class SupervisorSession {
  readonly id = randomUUID();
  private rest: JambonzRest | null = null;
  private send: (msg: ServerMessage) => void;

  selectedRoomId: string | null = null;
  mode: SupervisorMode = 'idle';
  transcriptOn = false;

  /** jambonz call_sid of the supervisor's media leg, once it lands (set by the ws app). */
  supervisorCallSid: string | null = null;

  /** Live transcribers: one per member stream (keyed by callSid) with
   *  scope=members, or a single 'mix' entry on the diarized fallback. */
  private transcribers = new Map<string, Transcriber>();
  /** Which fork scope is running for the transcript (for teardown). */
  private transcriptScope: 'members' | 'mix' | null = null;

  /**
   * True only while the supervisor is a full participant (barge-in), i.e. while
   * what they say is audible to the whole room.
   *
   * This gates the supervisor's TRANSCRIPTION AUDIO, not its text, and that
   * choice is deliberate: the media server tees a member's inbound frame
   * before the mute check, so the supervisor's microphone reaches us even while
   * they monitor silently. Gating the audio means coach whispers and idle
   * chatter never reach the STT engine at all — privacy by construction, with
   * no dependence on comparing STT timestamps against mode-change times (which
   * would misattribute any utterance spanning a switch, in the unsafe
   * direction, whenever the two clocks drifted).
   */
  private supervisorAudible(): boolean {
    return this.mode === 'enter';
  }
  private rooms: Room[] = [];
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(cfg: SessionConfig) {
    this.send = cfg.send;
  }

  /** application_sid of the provisioned monitor app (resolved at connect). */
  monitorAppSid = '';
  /** the account's SIP realm (resolved at connect, for WebRTC registration). */
  sipRealm = '';

  /** Attach credentials and start polling rooms. Throws if creds are invalid
   *  or the account has no provisioned monitor application. */
  async connect(creds: JambonzCreds): Promise<void> {
    this.rest = new JambonzRest(creds);
    await this.rest.verify();
    const appSid = await this.rest.findApplicationByName(config.monitorAppName);
    if (!appSid) {
      this.rest = null;
      throw new Error(
        `no application named "${config.monitorAppName}" on this account — see DEMO.md provisioning`);
    }
    this.monitorAppSid = appSid;
    this.sipRealm = await this.rest.getAccountSipRealm();
    await this.poll();
    this.pollTimer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    if (!this.rest) return;
    try {
      const rooms = await this.rest.listRooms();
      // Monitoring legs (ours or another supervisor's) are not room participants:
      // they must not show up in the chips or the agent/other counts.
      for (const room of rooms) {
        room.participants = room.participants.filter((p) => p.memberTag !== 'supervisor');
      }
      this.rooms = rooms;
      this.send({ type: 'rooms', rooms: this.rooms });
      // Coach is gated on agent presence; if the supervisor is coaching and the
      // agents have left, fall back to listen.
      if (this.mode === 'coach' && this.supervisorCallSid) {
        const room = this.rooms.find((r) => r.id === this.selectedRoomId);
        if (room && !room.participants.some((p) => p.isAgent)) {
          await this.setMode('monitor');
        }
      }
    } catch (err) {
      logger.warn({ err }, 'poll: listRooms failed');
    }
  }

  private room(id: string | null): Room | undefined {
    return this.rooms.find((r) => r.id === id);
  }

  /** Select a room: resets engagement to idle and transcript off (per the design). */
  async selectRoom(roomId: string): Promise<void> {
    if (roomId === this.selectedRoomId) return;
    await this.setTranscript(false);
    this.selectedRoomId = roomId;
    this.mode = 'idle';
    this.send({ type: 'supervisorState', roomId, mode: 'idle' });
    this.send({ type: 'transcriptState', roomId, on: false });
  }

  /**
   * Apply an engagement mode to the live supervisor leg. The browser places /
   * tears down the WebRTC media leg (idle ⇄ connected); switching among the
   * connected modes is a conferenceParticipantAction here. When no leg exists
   * yet we just record the desired mode — the ws app applies it on connect.
   */
  async setMode(mode: SupervisorMode): Promise<void> {
    this.mode = mode;
    const roomId = this.selectedRoomId;
    if (this.rest && this.supervisorCallSid && mode !== 'idle') {
      await this.applyMode(this.supervisorCallSid, mode);
    }
    if (roomId) this.send({ type: 'supervisorState', roomId, mode });
  }

  /**
   * Translate a mode into conference participant actions on the supervisor's
   * live leg. Injected over the leg's own websocket session — this reaches the
   * exact feature-server process that owns the leg regardless of deployment
   * topology (stock multi-instance boxes share one HTTP port, so leg-scoped
   * REST updateCall cannot be routed there; the control channel always can).
   */
  async applyMode(callSid: string, mode: SupervisorMode): Promise<void> {
    const leg = getSupervisorLeg(callSid);
    if (!leg) {
      logger.warn({ callSid, mode }, 'applyMode: no live supervisor leg session');
      return;
    }
    switch (mode) {
      case 'monitor':
        leg.injectCommand('conf:participant-action', { action: 'uncoach' });
        leg.injectCommand('conf:mute-status', { conf_mute_status: 'mute' });
        break;
      case 'coach':
        leg.injectCommand('conf:participant-action', { action: 'coach', tag: 'agent' });
        leg.injectCommand('conf:mute-status', { conf_mute_status: 'unmute' });
        break;
      case 'enter':
        leg.injectCommand('conf:participant-action', { action: 'uncoach' });
        leg.injectCommand('conf:mute-status', { conf_mute_status: 'unmute' });
        break;
      case 'idle':
        break;
    }
  }

  /**
   * Called by the ws app when the supervisor's media leg lands in the conference.
   * The conference verb already set the initial mute/coach state at join (to
   * avoid a race), so here we just record the leg and broadcast state.
   */
  onSupervisorCallConnected(callSid: string, mode: SupervisorMode): void {
    this.supervisorCallSid = callSid;
    this.mode = mode;
    if (this.selectedRoomId) {
      this.send({ type: 'supervisorState', roomId: this.selectedRoomId, mode });
    }
  }

  /** Called by the ws app when the supervisor's media leg ends. */
  onSupervisorCallEnded(): void {
    this.supervisorCallSid = null;
    this.mode = 'idle';
    if (this.selectedRoomId) {
      this.send({ type: 'supervisorState', roomId: this.selectedRoomId, mode: 'idle' });
    }
  }

  /** Turn the per-room transcription tap on/off. Prefers member-scoped forks
   *  (one identity-tagged stream per participant → real names, no diarization);
   *  falls back to the whole-room mix with best-effort diarization on
   *  deployments without member-fork support (see docs/DIARIZATION.md). */
  async setTranscript(on: boolean): Promise<void> {
    const roomId = this.selectedRoomId;
    if (!this.rest || !roomId) return;
    if (on === this.transcriptOn) return;
    this.transcriptOn = on;

    if (on) {
      const common = {
        url: config.forkSink.url,
        sampleRate: FORK_SAMPLE_RATE,
        ...(config.forkSink.username
          ? { wsAuth: { username: config.forkSink.username, password: config.forkSink.password ?? '' } }
          : {}),
      };
      let started = await this.rest.startConferenceListen(roomId, {
        ...common,
        scope: 'members',
        // merged (member identity over it) into each stream's first text frame
        metadata: { sessionId: this.id, roomName: roomId, sampleRate: FORK_SAMPLE_RATE },
      });
      if (started.ok) {
        this.transcriptScope = 'members';
      } else if (started.unsupported) {
        logger.info({ roomId }, 'member-scoped forks unsupported here — falling back to mix + diarization');
        started = await this.rest.startConferenceListen(roomId, {
          ...common,
          // MediaJam delivers this verbatim as the mix fork's first text frame
          metadata: { sessionId: this.id, roomName: roomId, sampleRate: FORK_SAMPLE_RATE },
        });
        if (started.ok) this.transcriptScope = 'mix';
      }
      if (!started.ok) {
        // fork failed to start — revert so the UI toggle doesn't lie
        this.transcriptOn = false;
        this.send({ type: 'transcriptState', roomId, on: false });
        return;
      }
    } else {
      await this.rest.stopConferenceListen(roomId, this.transcriptScope ?? 'mix');
      this.stopTranscribers();
    }
    this.send({ type: 'transcriptState', roomId, on });
  }

  /** Speaker label for a member stream: the participant's caller-id/username
   *  from the live room listing, falling back to the leg's coach/whisper tag
   *  or call sid. Resolved per fragment, not at stream attach: a late joiner's
   *  fork connects before the next room poll knows the participant, so the
   *  label self-heals as soon as the listing catches up. */
  private labelForCall(roomName: string, callSid: string, tag: string): string {
    // Agents are labelled by ROLE — the stream's own conference tag says so, no
    // lookup needed (and no dependence on the room poll having caught up).
    if (tag === 'agent') return 'agent';
    // Everyone else is labelled by their phone number: who called in (inbound)
    // or who we dialed (outbound). `number` comes from the enriched listing;
    // `label` is the older caller-id-or-number field, kept as a fallback for
    // deployments without it and for webrtc clients (a SIP username).
    const p = this.room(roomName)?.participants.find((pp) => pp.call_sid === callSid);
    return p?.number || p?.label || tag || callSid.slice(0, 8);
  }

  /** Stable per-room wall-clock start estimates, so every line's tsMs shares
   *  one baseline (recomputing from durationSec per line would jitter with the
   *  2s poll and could itself reorder lines). */
  private roomEpochs = new Map<string, number>();

  private roomEpoch(roomName: string): number {
    let epoch = this.roomEpochs.get(roomName);
    if (epoch === undefined) {
      epoch = Date.now() - (this.room(roomName)?.durationSec ?? 0) * 1000;
      this.roomEpochs.set(roomName, epoch);
    }
    return epoch;
  }

  /** Emit one transcript line. tsMs is the SPEECH-START time (ms since room
   *  start): with per-member streams, finals arrive when utterances END, so
   *  arrival order is not speech order — the frontend insert-sorts on tsMs. */
  private emitFragment(
    roomName: string,
    speaker: string,
    text: string,
    startMs: number,
    channel?: 'coach' | 'enter'
  ): void {
    const tsMs = Math.max(0, startMs - this.roomEpoch(roomName));
    const line: TranscriptLine = { speaker, text, tsMs, ...(channel ? { channel } : {}) };
    this.send({ type: 'transcript', roomId: roomName, line });
  }

  /** Wire one member's fork stream into its own transcriber (no diarization —
   *  the stream's speaker is known). Keyed by callSid; a reconnect replaces.
   *  The Transcriber's fixed label is a placeholder ('member'); the real label
   *  is resolved fresh on every fragment via labelForCall. */
  attachMemberStream(roomName: string, sampleRate: number, callSid: string, tag: string): Transcriber {
    this.transcribers.get(callSid)?.close();
    const t = new Transcriber(config.deepgramApiKey, { sampleRate, label: 'member' }, (frag) =>
      this.emitFragment(roomName, this.labelForCall(roomName, callSid, tag), frag.text, frag.startMs));
    this.transcribers.set(callSid, t);
    return t;
  }

  /**
   * Wire the SUPERVISOR's own member stream. Labelled "supervisor" and marked
   * channel 'enter' (the console renders those as heard-by-all), and gated so
   * only barge-in speech ever reaches the STT engine — while coaching or
   * monitoring silently the stream is paced with silence, so private coaching
   * cannot appear in the room's transcript.
   */
  attachSupervisorStream(roomName: string, sampleRate: number, callSid: string): Transcriber {
    this.transcribers.get(callSid)?.close();
    const t = new Transcriber(
      config.deepgramApiKey,
      { sampleRate, label: 'supervisor', audioGate: () => this.supervisorAudible() },
      (frag) => this.emitFragment(roomName, 'supervisor', frag.text, frag.startMs, 'enter')
    );
    this.transcribers.set(callSid, t);
    return t;
  }

  /** A member stream's fork closed (leg left / policy stopped). */
  detachMemberStream(callSid: string): void {
    this.transcribers.get(callSid)?.close();
    this.transcribers.delete(callSid);
  }

  /** Wire the whole-room mix fork into a diarizing transcriber (fallback). */
  attachTranscriptionStream(roomName: string, sampleRate: number): Transcriber {
    this.stopTranscribers();
    const t = new Transcriber(config.deepgramApiKey, { sampleRate }, (frag) =>
      this.emitFragment(roomName, frag.speaker, frag.text, frag.startMs));
    this.transcribers.set('mix', t);
    return t;
  }

  private stopTranscribers(): void {
    for (const t of this.transcribers.values()) t.close();
    this.transcribers.clear();
    this.transcriptScope = null;
    // next transcript session re-derives the room's wall-clock baseline
    this.roomEpochs.clear();
  }

  /** Tear everything down (data-WS closed / sign out). */
  async dispose(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.transcriptOn && this.selectedRoomId && this.rest) {
      // best-effort: if this fails the fork(s) keep streaming until the room
      // ends (MediaJam reaps them then) — surface it rather than hide it
      await this.rest.stopConferenceListen(this.selectedRoomId, this.transcriptScope ?? 'mix').catch((err) => {
        logger.warn({ err, roomId: this.selectedRoomId }, 'dispose: failed to stop conference listen fork');
      });
    }
    this.stopTranscribers();
    this.rest = null;
  }
}

/** Registry shared by the data-WS server and the jambonz ws app. */
export class SessionManager {
  private sessions = new Map<string, SupervisorSession>();

  create(cfg: SessionConfig): SupervisorSession {
    const s = new SupervisorSession(cfg);
    this.sessions.set(s.id, s);
    return s;
  }

  get(id: string): SupervisorSession | undefined {
    return this.sessions.get(id);
  }

  /** Fallback lookup for a fork whose metadata lacks a sessionId: the session
   *  currently transcribing the named room. */
  findTranscribing(roomName: string): SupervisorSession | undefined {
    for (const s of this.sessions.values()) {
      if (s.transcriptOn && s.selectedRoomId === roomName) return s;
    }
    return undefined;
  }

  async remove(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (s) {
      await s.dispose();
      this.sessions.delete(id);
    }
  }
}

export const sessionManager = new SessionManager();
