import { randomUUID } from 'node:crypto';
import type { Room, ServerMessage, SupervisorMode, TranscriptLine } from '@room-monitor/shared';
import { JambonzRest, type JambonzCreds } from './jambonz-rest.js';
import { Transcriber } from './transcription.js';
import { config } from './config.js';
import { logger } from './logger.js';

const POLL_INTERVAL_MS = 2000;

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

  private transcriber: Transcriber | null = null;
  private rooms: Room[] = [];
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(cfg: SessionConfig) {
    this.send = cfg.send;
  }

  /** Attach credentials and start polling rooms. Throws if creds are invalid. */
  async connect(creds: JambonzCreds): Promise<void> {
    this.rest = new JambonzRest(creds);
    await this.rest.verify();
    await this.poll();
    this.pollTimer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    if (!this.rest) return;
    try {
      this.rooms = await this.rest.listRooms();
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

  /** Translate a mode into conference participant actions on a call leg. */
  async applyMode(callSid: string, mode: SupervisorMode): Promise<void> {
    if (!this.rest) return;
    switch (mode) {
      case 'monitor':
        await this.rest.participantAction(callSid, 'uncoach');
        await this.rest.setMute(callSid, true);
        break;
      case 'coach':
        await this.rest.participantAction(callSid, 'coach', 'agent');
        await this.rest.setMute(callSid, false);
        break;
      case 'enter':
        await this.rest.participantAction(callSid, 'uncoach');
        await this.rest.setMute(callSid, false);
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

  /** Turn the per-room transcription tap on/off. */
  async setTranscript(on: boolean): Promise<void> {
    const roomId = this.selectedRoomId;
    if (!this.rest || !roomId) return;
    if (on === this.transcriptOn) return;
    this.transcriptOn = on;

    if (on) {
      await this.rest.startConferenceListen(roomId, {
        url: config.forkSink.url,
        sampleRate: 16000,
        ...(config.forkSink.username
          ? { wsAuth: { username: config.forkSink.username, password: config.forkSink.password ?? '' } }
          : {}),
        metadata: { sessionId: this.id, roomName: roomId },
      });
    } else {
      await this.rest.stopConferenceListen(roomId);
      this.stopTranscriber();
    }
    this.send({ type: 'transcriptState', roomId, on });
  }

  /** Wire the fork audio stream (from the ws app) into a Deepgram transcriber. */
  attachTranscriptionStream(roomName: string, sampleRate: number): Transcriber {
    this.stopTranscriber();
    this.transcriber = new Transcriber(config.deepgramApiKey, { sampleRate }, (frag) => {
      const room = this.room(roomName);
      const line: TranscriptLine = {
        speaker: frag.speaker,
        text: frag.text,
        tsMs: (room?.durationSec ?? 0) * 1000,
      };
      this.send({ type: 'transcript', roomId: roomName, line });
    });
    return this.transcriber;
  }

  private stopTranscriber(): void {
    if (this.transcriber) {
      this.transcriber.close();
      this.transcriber = null;
    }
  }

  /** Tear everything down (data-WS closed / sign out). */
  async dispose(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.transcriptOn && this.selectedRoomId && this.rest) {
      await this.rest.stopConferenceListen(this.selectedRoomId).catch(() => {});
    }
    this.stopTranscriber();
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

  async remove(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (s) {
      await s.dispose();
      this.sessions.delete(id);
    }
  }
}

export const sessionManager = new SessionManager();
