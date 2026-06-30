import pino from 'pino';

export const logger = pino({
  name: 'room-monitor',
  level: process.env.LOG_LEVEL ?? 'info',
});

export type Logger = typeof logger;
