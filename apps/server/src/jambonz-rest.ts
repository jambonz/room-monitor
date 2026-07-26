import type { Room } from '@room-monitor/shared';
import { logger } from './logger.js';

/** Per-session jambonz connection credentials (supplied at login, in-memory only). */
export interface JambonzCreds {
  baseUrl: string;
  accountSid: string;
  apiKey: string;
}

export interface ListenForkOptions {
  /** ws(s):// URL MediaJam should stream the audio to (our fork sink). */
  url: string;
  /** 'mix' (whole-room fork, one stream) or 'members' (one identity-tagged
   *  stream per participant — per-speaker transcripts without diarization). */
  scope?: 'mix' | 'members';
  sampleRate?: number;
  wsAuth?: { username: string; password: string };
  metadata?: Record<string, unknown>;
}

export type ListenStartResult =
  | { ok: true; scope: 'mix' | 'members' }
  | { ok: false; unsupported: boolean };

/**
 * Thin REST client for the jambonz API, scoped to one account. Uses the supplied
 * API key as a bearer token. Covers only the instance-independent calls:
 *   - discover live rooms (enriched Conferences listing)
 *   - resolve the monitor application + account SIP realm
 *   - start/stop a conference listen fork (transcription tap)
 * Supervisor mode changes are NOT done via REST — they're injected over the
 * leg's own websocket session (see session.ts applyMode), which works
 * regardless of how feature-server instances share HTTP ports on a box.
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

  /** Start a conference listen fork. `unsupported` distinguishes "this
   *  deployment doesn't know the members scope" (400/501 — caller can fall
   *  back to the mix scope) from other failures. */
  async startConferenceListen(roomName: string, opts: ListenForkOptions): Promise<ListenStartResult> {
    const res = await this.req('POST', `/Conferences/${encodeURIComponent(roomName)}/listen`, opts);
    if (!res.ok) {
      logger.warn({ roomName, scope: opts.scope ?? 'mix', status: res.status }, 'startConferenceListen failed');
      return { ok: false, unsupported: res.status === 400 || res.status === 501 };
    }
    return { ok: true, scope: opts.scope ?? 'mix' };
  }

  /** Stop the conference listen fork (of the given scope). */
  async stopConferenceListen(roomName: string, scope: 'mix' | 'members' = 'mix'): Promise<void> {
    const qs = scope === 'members' ? '?scope=members' : '';
    const res = await this.req('DELETE', `/Conferences/${encodeURIComponent(roomName)}/listen${qs}`);
    if (!res.ok && res.status !== 204 && res.status !== 404) {
      logger.warn({ roomName, scope, status: res.status }, 'stopConferenceListen non-success');
    }
  }
}
