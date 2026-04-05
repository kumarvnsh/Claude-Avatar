import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { screen } from 'electron';
import { DockInfo, DockPosition } from '../shared/types';

export class DockDetector extends EventEmitter {
  private currentDockInfo: DockInfo | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  start(intervalMs = 5000): void {
    this.detect();
    this.pollInterval = setInterval(() => this.detect(), intervalMs);

    // Listen for display changes
    screen.on('display-metrics-changed', () => this.detect());
    screen.on('display-added', () => this.detect());
    screen.on('display-removed', () => this.detect());
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getDockInfo(): DockInfo {
    if (!this.currentDockInfo) {
      this.detect();
    }
    return this.currentDockInfo!;
  }

  private detect(): void {
    try {
      const position = this.getDockPosition();
      const autoHide = this.getDockAutoHide();
      const bounds = this.calculateOverlayBounds(position, autoHide);

      const newInfo: DockInfo = { position, autoHide, bounds };

      // Check if changed
      if (!this.currentDockInfo ||
        this.currentDockInfo.position !== newInfo.position ||
        this.currentDockInfo.autoHide !== newInfo.autoHide ||
        this.currentDockInfo.bounds.x !== newInfo.bounds.x ||
        this.currentDockInfo.bounds.y !== newInfo.bounds.y ||
        this.currentDockInfo.bounds.width !== newInfo.bounds.width ||
        this.currentDockInfo.bounds.height !== newInfo.bounds.height) {
        this.currentDockInfo = newInfo;
        this.emit('dock-position-changed', newInfo);
      }
    } catch (err) {
      console.error('DockDetector error:', err);
    }
  }

  private getDockPosition(): DockPosition {
    try {
      const result = execSync('defaults read com.apple.dock orientation 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 2000,
      }).trim();

      if (result === 'left') return 'left';
      if (result === 'right') return 'right';
      return 'bottom';
    } catch {
      return 'bottom'; // Default assumption
    }
  }

  private getDockAutoHide(): boolean {
    try {
      const result = execSync('defaults read com.apple.dock autohide 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 2000,
      }).trim();
      return result === '1';
    } catch {
      return false;
    }
  }

  private calculateOverlayBounds(
    position: DockPosition,
    _autoHide: boolean
  ): DockInfo['bounds'] {
    const display = screen.getPrimaryDisplay();
    const { bounds: screenBounds, workArea } = display;

    const overlayHeight = 80;
    const overlayWidth = 80;

    switch (position) {
      case 'bottom': {
        // Overlay sits just above the Dock area
        const dockHeight = screenBounds.height - workArea.height - (workArea.y - screenBounds.y);
        return {
          x: screenBounds.x,
          y: workArea.y + workArea.height - overlayHeight,
          width: screenBounds.width,
          height: overlayHeight,
        };
      }
      case 'left': {
        return {
          x: workArea.x,
          y: workArea.y,
          width: overlayWidth,
          height: workArea.height,
        };
      }
      case 'right': {
        return {
          x: workArea.x + workArea.width - overlayWidth,
          y: workArea.y,
          width: overlayWidth,
          height: workArea.height,
        };
      }
    }
  }
}
