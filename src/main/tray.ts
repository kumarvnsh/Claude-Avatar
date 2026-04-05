import { app, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';

export class TrayManager {
  private tray: Tray | null = null;
  private sessionCount = 0;

  create(): void {
    // Create a simple 22x22 tray icon
    // Use a tiny inline icon since we may not have the asset file yet
    const iconPath = path.join(__dirname, '..', '..', 'assets', 'tray-icon.png');

    let trayIcon: Electron.NativeImage;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      trayIcon = trayIcon.resize({ width: 22, height: 22 });
    } catch {
      // Fallback: create a simple colored square icon
      trayIcon = this.createFallbackIcon();
    }

    // If the icon is empty (file not found), use fallback
    if (trayIcon.isEmpty()) {
      trayIcon = this.createFallbackIcon();
    }

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Claude Avatars');
    this.updateMenu();
  }

  updateSessionCount(count: number): void {
    this.sessionCount = count;
    this.updateMenu();
  }

  private updateMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Watching ${this.sessionCount} session${this.sessionCount !== 1 ? 's' : ''}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Claude Avatars',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private createFallbackIcon(): Electron.NativeImage {
    // Create a minimal 22x22 icon using a base64-encoded 1x1 orange PNG scaled up
    // This is a tiny valid PNG — a solid orange circle
    const size = 22;

    // Build a simple BMP-like image data for nativeImage
    // Use createFromDataURL with an inline SVG for a clean circle
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="11" cy="11" r="9" fill="#D97706"/>
        <circle cx="8" cy="9" r="1.5" fill="#1a1a2e"/>
        <circle cx="14" cy="9" r="1.5" fill="#1a1a2e"/>
        <path d="M8 14 Q11 17 14 14" stroke="#1a1a2e" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      </svg>
    `.trim();

    const base64 = Buffer.from(svg).toString('base64');
    return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${base64}`);
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
