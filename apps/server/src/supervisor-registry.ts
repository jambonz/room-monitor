import type { Session } from '@jambonz/sdk/websocket';

/**
 * Live supervisor call legs, keyed by call_sid.
 *
 * Mode changes (coach/uncoach/mute) are injected over these sessions' own
 * websocket control channels — by construction that reaches the exact
 * feature-server process that owns the leg. This keeps the app independent of
 * how feature-server instances are deployed (multiple instances on one box
 * share one HTTP port under the stock jambonz config, so leg-scoped REST
 * updateCall cannot be routed to a specific instance there).
 */
const legs = new Map<string, Session>();

export const registerSupervisorLeg = (callSid: string, session: Session): void => {
  legs.set(callSid, session);
};

export const unregisterSupervisorLeg = (callSid: string): void => {
  legs.delete(callSid);
};

export const getSupervisorLeg = (callSid: string): Session | undefined => legs.get(callSid);
