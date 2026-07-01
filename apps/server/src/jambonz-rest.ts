import type { Room } from '@room-monitor/shared';
import { logger } from './logger.js';

/** Per-session jambonz connection credentials (supplied at login, in-memory only). */
export interface JambonzCreds {
  baseUrl: string;
  accountSid: string;
  apiKey: string;
}

export interface ListenForkOptions {
  /** ws(s):// URL MediaJam should stream the room mix to (our fork sink). */
  url: string;
  sampleRate?: number;
  wsAuth?: { username: string; password: string };
  metadata?: Record<string, unknown>;
}

/**
 * Thin REST client for the jambonz API, scoped to one account. Uses the supplied
 * API key as a bearer token. Covers the three things the monitor needs:
 *   - discover live rooms (enriched Conferences listing)
 *   - change the supervisor's engagement (conferenceParticipantAction / mute)
 *   - start/stop a conference listen fork (transcription tap)
 */
export class JambonzRest {
  private readonly base: string;
  readonly accountSid: string;
  private readonly apiKey: string;

  constructor(creds: JambonzCreds) {
    this.base = creds.baseUrl.replace(/\/+$/, '');
    this.accountSid = creds.accountSid;
    this.apiKey = creds.apiKey;
  }

  private url(path: string): string {
    return `${this.base}/v1/Accounts/${this.accountSid}${path}`;
  }

  private async req(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(this.url(path), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return res;
  }

  /** Validate credentials by listing conferences; throws on auth/connection failure. */
  async verify(): Promise<void> {
    const res = await this.req('GET', '/Conferences');
    if (!res.ok) throw new Error(`jambonz auth failed (${res.status})`);
  }

  /** The account's SIP realm (for WebRTC registration). */
  async getAccountSipRealm(): Promise<string> {
    const res = await this.req('GET', '');
    if (!res.ok) return '';
    const account = (await res.json()) as { sip_realm?: string };
    return account.sip_realm ?? '';
  }

  /** Resolve a jambonz application on this account by name; returns its sid. */
  async findApplicationByName(name: string): Promise<string | null> {
    const res = await this.req('GET', '/Applications');
    if (!res.ok) {
      logger.warn({ status: res.status }, 'findApplicationByName: list failed');
      return null;
    }
    const apps = (await res.json()) as Array<{ application_sid: string; name: string }>;
    return apps.find((a) => a.name === name)?.application_sid ?? null;
  }

  /** Live rooms with participants (enriched listing). */
  async listRooms(): Promise<Room[]> {
    const res = await this.req('GET', '/Conferences?expand=participants');
    if (!res.ok) throw new Error(`listRooms failed (${res.status})`);
    return (await res.json()) as Room[];
  }

  /** Apply a conferenceParticipantAction to the supervisor's call leg. */
  async participantAction(
    callSid: string,
    action: 'coach' | 'uncoach' | 'mute' | 'unmute' | 'tag' | 'untag',
    tag?: string
  ): Promise<void> {
    const res = await this.req('PUT', `/Calls/${callSid}`, {
      conferenceParticipantAction: { action, ...(tag ? { tag } : {}) },
    });
    if (!res.ok && res.status !== 202) {
      logger.warn({ callSid, action, status: res.status }, 'participantAction non-success');
    }
  }

  /** Mute/unmute the supervisor's call leg in the conference. */
  async setMute(callSid: string, muted: boolean): Promise<void> {
    const res = await this.req('PUT', `/Calls/${callSid}`, {
      conf_mute_status: muted ? 'mute' : 'unmute',
    });
    if (!res.ok && res.status !== 202) {
      logger.warn({ callSid, muted, status: res.status }, 'setMute non-success');
    }
  }

  /** Start a conference listen fork; returns the bot member id (for stop). */
  async startConferenceListen(roomName: string, opts: ListenForkOptions): Promise<number | null> {
    const res = await this.req('POST', `/Conferences/${encodeURIComponent(roomName)}/listen`, opts);
    if (!res.ok) {
      logger.warn({ roomName, status: res.status }, 'startConferenceListen failed');
      return null;
    }
    const body = (await res.json()) as { botMemberId?: number };
    return body.botMemberId ?? null;
  }

  /** Stop the conference listen fork. */
  async stopConferenceListen(roomName: string): Promise<void> {
    const res = await this.req('DELETE', `/Conferences/${encodeURIComponent(roomName)}/listen`);
    if (!res.ok && res.status !== 204 && res.status !== 404) {
      logger.warn({ roomName, status: res.status }, 'stopConferenceListen non-success');
    }
  }
}
