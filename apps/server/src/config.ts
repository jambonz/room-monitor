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
    url: process.env.FORK_SINK_URL ?? 'ws://localhost:3002/fork',
    username: process.env.FORK_SINK_USERNAME || undefined,
    password: process.env.FORK_SINK_PASSWORD || undefined,
  },
  deepgramApiKey: process.env.DEEPGRAM_API_KEY ?? '',
  /** wss:// URL of the jambonz SBC the browser's WebRTC SDK registers against. */
  webrtcSbcUrl: process.env.WEBRTC_SBC_URL ?? '',
} as const;
