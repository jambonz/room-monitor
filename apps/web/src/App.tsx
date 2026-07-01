import { useRoomMonitor } from './useRoomMonitor.js';
import { Login } from './components/Login.js';
import { TopBar } from './components/TopBar.js';
import { RoomRail } from './components/RoomRail.js';
import { RoomDetail } from './components/RoomDetail.js';

export function App() {
  const rm = useRoomMonitor();

  if (rm.phase !== 'console') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Login error={rm.loginError} busy={rm.phase === 'connecting'} onConnect={rm.connect} />
      </div>
    );
  }

  const room = rm.rooms.find((r) => r.id === rm.selectedRoomId) ?? null;
  const lines = rm.selectedRoomId ? rm.transcriptsByRoom[rm.selectedRoomId] ?? [] : [];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar liveCount={rm.rooms.length} username={rm.identity.username} accountSid={rm.identity.accountSid} onSignOut={rm.signOut} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <RoomRail rooms={rm.rooms} selectedRoomId={rm.selectedRoomId} mode={rm.mode} onSelect={rm.selectRoom} />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <RoomDetail
            room={room}
            mode={rm.mode}
            modePending={rm.modePending}
            transcriptOn={rm.transcriptOn}
            lines={lines}
            onSetMode={rm.setMode}
            onStop={rm.stop}
            onToggleTranscript={rm.toggleTranscript}
          />
        </div>
      </div>
    </div>
  );
}
