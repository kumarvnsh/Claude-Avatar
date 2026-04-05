import { SessionInfo, DockInfo } from '../shared/types';
import { AvatarRenderer } from './avatar-renderer';
import { Tooltip } from './tooltip';

// Initialize renderer
const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement;
const renderer = new AvatarRenderer(canvas);
const tooltip = new Tooltip();

// Set up renderer callbacks
renderer.setCallbacks({
  onHover: (session: SessionInfo | null, x: number, y: number) => {
    if (session) {
      tooltip.show(session, x, y);
    } else {
      tooltip.hide();
    }
  },

  onClick: (sessionId: string) => {
    window.claudeAvatars.avatarClicked(sessionId);
  },

  onMouseEnterAvatar: () => {
    window.claudeAvatars.setMouseEvents(true);
  },

  onMouseLeaveAvatar: () => {
    window.claudeAvatars.setMouseEvents(false);
  },
});

// Listen for session updates from main process
window.claudeAvatars.onSessionsUpdated((sessions: SessionInfo[]) => {
  renderer.updateSessions(sessions);
});

// Listen for dock position changes
window.claudeAvatars.onDockPositionChanged((dockInfo: DockInfo) => {
  renderer.setDockPosition(dockInfo.position);
});

// Start the animation loop
renderer.start();

// Handle window resize dynamically without forcing dock positioning
window.addEventListener('resize', () => {
  // Rely on Electron's IPC bounds dispatch instead of hardcoding
});
