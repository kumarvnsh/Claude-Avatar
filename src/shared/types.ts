// Shared types for Claude Avatars

export type SessionState = 'thinking' | 'coding' | 'idle' | 'error';

export type DockPosition = 'bottom' | 'left' | 'right';

export interface SessionInfo {
  sessionId: string;
  pid: number;
  cwd: string;
  projectName: string;   // basename of cwd
  startedAt: number;
  state: SessionState;
  currentTask: string | null;  // activeForm text
  color: string;         // HSL color string, deterministic from sessionId
}

export interface DockInfo {
  position: DockPosition;
  autoHide: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AvatarBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  sessionId: string;
}

// IPC channel names
export const IPC_CHANNELS = {
  SESSIONS_UPDATED: 'sessions-updated',
  DOCK_POSITION_CHANGED: 'dock-position-changed',
  AVATAR_CLICKED: 'avatar-clicked',
  SET_MOUSE_EVENTS: 'set-mouse-events',
} as const;
