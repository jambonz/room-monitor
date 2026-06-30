/**
 * Shared types for Room Monitor — the data-WebSocket contract between the
 * frontend (apps/web) and backend (apps/server), plus the domain shapes.
 *
 * See docs/ARCHITECTURE.md §4 for the contract overview.
 */

/** The supervisor's engagement with the selected room. */
export type SupervisorMode = 'idle' | 'monitor' | 'coach' | 'enter';

/** A member of a room (conference). Matches the api-server wire shape. */
export interface Participant {
  /** jambonz call_sid of this member's leg — used to address conferenceParticipantAction. */
  call_sid: string;
  /** Caller id when we have one, otherwise the bare phone number. */
  label: string;
  /** The member's conference tag ('agent' marks an agent; '' otherwise). */
  memberTag: string;
  /** Convenience: memberTag === "agent". */
  isAgent: boolean;
}

/** A live room (conference) scoped to the connected account. */
export interface Room {
  /** Stable room id (conference name, account-scoped). */
  id: string;
  /** Display name. */
  name: string;
  /** Seconds since the conference started. */
  durationSec: number;
  participants: Participant[];
}

/** One transcript line for a room. */
export interface TranscriptLine {
  /** Diarized speaker label (or participant label when mapped). */
  speaker: string;
  text: string;
  /** Milliseconds since the room started, for the m:ss timestamp. */
  tsMs: number;
  /**
   * Set for supervisor-originated audio: "coach" = private to agents,
   * "enter" = heard by all. Absent for participant speech.
   */
  channel?: 'coach' | 'enter';
}

// ---------------------------------------------------------------------------
// Data-WS messages: server → client
// ---------------------------------------------------------------------------

export interface RoomsMessage {
  type: 'rooms';
  rooms: Room[];
}

export interface SupervisorStateMessage {
  type: 'supervisorState';
  roomId: string;
  mode: SupervisorMode;
}

export interface TranscriptMessage {
  type: 'transcript';
  roomId: string;
  line: TranscriptLine;
}

export interface TranscriptStateMessage {
  type: 'transcriptState';
  roomId: string;
  on: boolean;
}

/** Sent once after a successful `connect`. */
export interface ConnectedMessage {
  type: 'connected';
  /** Correlation id the browser passes as a SIP header (X-Session-Id) when it
   *  places the WebRTC call, so the backend can link the leg to this session. */
  sessionId: string;
  /** wss:// URL of the jambonz SBC for the WebRTC SDK to register against. */
  sbcUrl: string;
}

/** Sent when `connect` fails (bad credentials / unreachable system). */
export interface ConnectErrorMessage {
  type: 'connectError';
  message: string;
}

export type ServerMessage =
  | ConnectedMessage
  | ConnectErrorMessage
  | RoomsMessage
  | SupervisorStateMessage
  | TranscriptMessage
  | TranscriptStateMessage;

// ---------------------------------------------------------------------------
// Data-WS messages: client → server
// ---------------------------------------------------------------------------

/** Authenticate the session with a jambonz system (REST credentials only —
 *  the SIP username/password stay in the browser for the WebRTC SDK). */
export interface ConnectCommand {
  type: 'connect';
  baseUrl: string;
  accountSid: string;
  apiKey: string;
}

export interface SelectCommand {
  type: 'select';
  roomId: string;
}

export interface SetModeCommand {
  type: 'setMode';
  roomId: string;
  mode: SupervisorMode;
}

export interface TranscriptToggleCommand {
  type: 'transcript';
  roomId: string;
  on: boolean;
}

export type ClientMessage =
  | ConnectCommand
  | SelectCommand
  | SetModeCommand
  | TranscriptToggleCommand;

// ---------------------------------------------------------------------------
// Derived helpers (used by both ends)
// ---------------------------------------------------------------------------

export const agentCount = (room: Room): number =>
  room.participants.filter((p) => p.isAgent).length;

export const otherCount = (room: Room): number =>
  room.participants.filter((p) => !p.isAgent).length;

/** Coach is offered only when the room has at least one agent. */
export const coachAvailable = (room: Room): boolean => agentCount(room) > 0;
