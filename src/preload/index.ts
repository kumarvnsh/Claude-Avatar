import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, SessionInfo, DockInfo } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('claudeAvatars', {
  // Listen for session updates from main process
  onSessionsUpdated: (callback: (sessions: SessionInfo[]) => void) => {
    ipcRenderer.on(IPC_CHANNELS.SESSIONS_UPDATED, (_event, sessions: SessionInfo[]) => {
      callback(sessions);
    });
  },

  // Listen for dock position changes
  onDockPositionChanged: (callback: (dockInfo: DockInfo) => void) => {
    ipcRenderer.on(IPC_CHANNELS.DOCK_POSITION_CHANGED, (_event, dockInfo: DockInfo) => {
      callback(dockInfo);
    });
  },

  // Notify main process when an avatar is clicked
  avatarClicked: (sessionId: string) => {
    ipcRenderer.send(IPC_CHANNELS.AVATAR_CLICKED, sessionId);
  },

  // Toggle mouse event pass-through
  setMouseEvents: (enabled: boolean) => {
    ipcRenderer.send(IPC_CHANNELS.SET_MOUSE_EVENTS, enabled);
  },
});

// Type augmentation for window object
declare global {
  interface Window {
    claudeAvatars: {
      onSessionsUpdated: (callback: (sessions: SessionInfo[]) => void) => void;
      onDockPositionChanged: (callback: (dockInfo: DockInfo) => void) => void;
      avatarClicked: (sessionId: string) => void;
      setMouseEvents: (enabled: boolean) => void;
    };
  }
}
