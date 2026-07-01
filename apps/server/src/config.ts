import 'dotenv/config';

/**
 * Backend configuration. jambonz connection secrets (Base URL, Account SID,
 * API key, SIP username/password) arrive per-session from the supervisor's
 * login over the data WS and are held in memory — they are NOT sourced here.
 * This file holds only deployment/infra config.
 */
export const config = {
  port: Number(process.env.PORT ?? 3001),
  jambonzWsAppPort: Number(process.env.JAMBONZ_WS_APP_PORT ?? 3002),
  forkSink: {
    url: process.env.FORK_SINK_URL ?? '',
    username: process.env.FORK_SINK_USERNAME || undefined,
    password: process.env.FORK_SINK_PASSWORD || undefined,
  },
  deepgramApiKey: process.env.DEEPGRAM_API_KEY ?? '',
  /** wss:// URL of the jambonz SBC the browser's WebRTC SDK registers against. */
  webrtcSbcUrl: process.env.WEBRTC_SBC_URL ?? '',
  /** Name of the jambonz application provisioned for this monitor (see DEMO.md). */
  monitorAppName: process.env.MONITOR_APP_NAME ?? 'room-monitor',
  /** Port of the "normal caller" application (room name is a portal-editable
   *  application env var — see caller-app.ts). */
  callerAppPort: Number(process.env.CALLER_APP_PORT ?? 4003),
} as const;

/**
 * Fail fast on missing required config — these only surface at feature-use time
 * otherwise (empty Deepgram key = silent transcription failure, empty SBC URL =
 * WebRTC registration failure in the browser).
 */
export function validateConfig(): string[] {
  const missing: string[] = [];
  if (!config.deepgramApiKey) missing.push('DEEPGRAM_API_KEY');
  if (!config.webrtcSbcUrl) missing.push('WEBRTC_SBC_URL');
  if (!config.forkSink.url) missing.push('FORK_SINK_URL');
  return missing;
}
