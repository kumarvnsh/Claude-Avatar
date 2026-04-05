import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SessionMonitor } from './session-monitor';
import { DockDetector } from './dock-detector';
import { WindowFocus } from './window-focus';
import { TrayManager } from './tray';
import { DockInfo, IPC_CHANNELS, SessionInfo } from '../shared/types';

class ClaudeAvatarsApp {
  private mainWindow: BrowserWindow | null = null;
  private sessionMonitor: SessionMonitor;
  private dockDetector: DockDetector;
  private trayManager: TrayManager;
  private currentSessions: SessionInfo[] = [];

  // Enable mock data for development/testing
  private useMockData = process.argv.includes('--mock') || !this.hasClaudeDir();

  constructor() {
    this.sessionMonitor = new SessionMonitor(this.useMockData);
    this.dockDetector = new DockDetector();
    this.trayManager = new TrayManager();
  }

  private syncRendererState(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    const dockInfo = this.dockDetector.getDockInfo();
    this.mainWindow.webContents.send(IPC_CHANNELS.DOCK_POSITION_CHANGED, dockInfo);
    this.mainWindow.webContents.send(IPC_CHANNELS.SESSIONS_UPDATED, this.currentSessions);
  }

  private getOverlayWindowBounds(dockInfo: DockInfo): DockInfo['bounds'] {
    const overlaySize = 160;
    const bounds = { ...dockInfo.bounds };

    if (dockInfo.position === 'bottom') {
      bounds.y = dockInfo.bounds.y - (overlaySize - dockInfo.bounds.height);
      bounds.height = overlaySize;
    } else if (dockInfo.position === 'left') {
      bounds.width = overlaySize;
    } else if (dockInfo.position === 'right') {
      bounds.x = dockInfo.bounds.x - (overlaySize - dockInfo.bounds.width);
      bounds.width = overlaySize;
    }

    return bounds;
  }

  private hasClaudeDir(): boolean {
    try {
      const fs = require('fs');
      const os = require('os');
      return fs.existsSync(path.join(os.homedir(), '.claude', 'sessions'));
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    await app.whenReady();

    this.createOverlayWindow();
    this.setupIPC();
    this.startMonitors();
    this.trayManager.create();

    if (this.useMockData) {
      console.log('🎭 Running in mock data mode (no Claude sessions directory found)');
    }

    app.on('window-all-closed', () => {
      // Don't quit on window close — tray keeps running
    });
  }

  private createOverlayWindow(): void {
    // Get initial dock info for window positioning
    const dockInfo = this.dockDetector.getDockInfo();
    console.log('🖥️  Display info:', JSON.stringify(require('electron').screen.getPrimaryDisplay().bounds));
    console.log('📐 Work area:', JSON.stringify(require('electron').screen.getPrimaryDisplay().workArea));
    console.log('📍 Dock info:', JSON.stringify(dockInfo));

    const bounds = this.getOverlayWindowBounds(dockInfo);

    this.mainWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: false,
      focusable: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false, // Keep rendering when unfocused
      },
    });

    // Click-through with mouse event forwarding
    this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    // Floating level — above normal windows but NOT above full-screen apps
    this.mainWindow.setAlwaysOnTop(true, 'floating');
    // Show on all desktops but NOT on full-screen spaces
    this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

    // Load the renderer
    this.mainWindow.loadFile(
      path.join(__dirname, '..', 'renderer', 'index.html')
    );

    this.mainWindow.webContents.once('did-finish-load', () => {
      this.mainWindow?.showInactive();
      this.mainWindow?.moveTop();
      this.syncRendererState();
    });

    // Uncomment for debugging:
    // this.mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  private setupIPC(): void {
    // Handle avatar click — bring the corresponding terminal to front
    ipcMain.on(IPC_CHANNELS.AVATAR_CLICKED, (_event, sessionId: string) => {
      const session = this.currentSessions.find(s => s.sessionId === sessionId);
      if (session) {
        WindowFocus.focusSession(session.pid);
      }
    });

    // Handle mouse event toggling (click-through ↔ interactive)
    ipcMain.on(IPC_CHANNELS.SET_MOUSE_EVENTS, (_event, enabled: boolean) => {
      if (this.mainWindow) {
        if (enabled) {
          this.mainWindow.setIgnoreMouseEvents(false);
        } else {
          this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
        }
      }
    });
  }

  private startMonitors(): void {
    // Session monitor
    this.sessionMonitor.on('sessions-updated', (sessions: SessionInfo[]) => {
      this.currentSessions = sessions;
      this.trayManager.updateSessionCount(sessions.length);

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(IPC_CHANNELS.SESSIONS_UPDATED, sessions);
      }
    });
    this.sessionMonitor.start();

    // Dock detector
    this.dockDetector.on('dock-position-changed', (dockInfo) => {
      // Reposition overlay window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.setBounds(this.getOverlayWindowBounds(dockInfo));
        this.mainWindow.webContents.send(IPC_CHANNELS.DOCK_POSITION_CHANGED, dockInfo);
      }
    });
    this.dockDetector.start();
  }
}

// Launch the app
const avatarsApp = new ClaudeAvatarsApp();
avatarsApp.init().catch(console.error);
