/**
 * Room Monitor — app shell.
 *
 * The UI specification (login, top bar, room rail, detail pane with the
 * Listen/Coach/Enter control bar and the live transcript) is in
 * docs/design-reference/. This shell will grow into:
 *   - <Login>      connect form (Base URL, Account SID, API key, user/pass)
 *   - <Console>    top bar + <RoomRail> + <RoomDetail>
 * wired to the backend over the data WS (see @room-monitor/shared) and to the
 * WebRTC SDK for the supervisor's media leg.
 */
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>
        <span style={{ color: '#da1c5c' }}>jam</span>bonz · Call Monitor
      </h1>
      <p>Scaffold — see docs/ARCHITECTURE.md.</p>
    </main>
  );
}
