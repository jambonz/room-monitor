/**
 * Shared types for Room Monitor — the data-WebSocket contract between the
 * frontend (apps/web) and backend (apps/server), plus the domain shapes.
 *
 * See docs/ARCHITECTURE.md §4 for the contract overview.
 */

/** The supervisor's engagement with the selected room. */
export type SupervisorMode = 'idle' | 'monitor' | 'coach' | 'enter';

/** A member of a room (conference). */
export interface Participant {
  /** jambonz call_sid of this member's leg — used to address conferenceParticipantAction. */
  callSid: string;
  /** Caller id when we have one, otherwise the bare phone number. */
  label: string;
  /** True when this member carries memberTag === "agent". */
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

export type ServerMessage =
  | RoomsMessage
  | SupervisorStateMessage
  | TranscriptMessage
  | TranscriptStateMessage;

// ---------------------------------------------------------------------------
// Data-WS messages: client → server
// ---------------------------------------------------------------------------

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

export type ClientMessage = SelectCommand | SetModeCommand | TranscriptToggleCommand;

// ---------------------------------------------------------------------------
// Derived helpers (used by both ends)
// ---------------------------------------------------------------------------

export const agentCount = (room: Room): number =>
  room.participants.filter((p) => p.isAgent).length;

export const otherCount = (room: Room): number =>
  room.participants.filter((p) => !p.isAgent).length;

/** Coach is offered only when the room has at least one agent. */
export const coachAvailable = (room: Room): boolean => agentCount(room) > 0;
