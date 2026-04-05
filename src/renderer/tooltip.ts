import { SessionInfo } from '../shared/types';

export class Tooltip {
  private element: HTMLElement;

  constructor(elementId = 'tooltip') {
    this.element = document.getElementById(elementId)!;
  }

  show(session: SessionInfo, x: number, y: number): void {
    // Build tooltip content
    const projectLabel = document.createElement('div');
    projectLabel.className = 'tooltip-project';
    projectLabel.style.color = session.color;
    projectLabel.textContent = session.projectName;

    this.element.innerHTML = '';
    this.element.appendChild(projectLabel);

    if (session.currentTask) {
      const taskLabel = document.createElement('div');
      taskLabel.className = 'tooltip-task';
      taskLabel.textContent = session.currentTask;
      this.element.appendChild(taskLabel);
    }

    const stateLabel = document.createElement('div');
    stateLabel.className = 'tooltip-state';
    stateLabel.textContent = this.stateEmoji(session.state) + ' ' + session.state;
    this.element.appendChild(stateLabel);

    // Position above the cursor
    const tooltipRect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let left = x - tooltipRect.width / 2;
    left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));

    this.element.style.left = `${left}px`;
    
    // Instead of being relative to cursor Y (which can push it off the top of the window),
    // force it to a fixed position perfectly above the avatars.
    // Since avatars are ~24px from bottom + 48px height = 72px total, bottom: 85px is safe.
    this.element.style.bottom = `85px`;
    this.element.style.top = 'auto';
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  private stateEmoji(state: string): string {
    switch (state) {
      case 'coding': return '✨';
      case 'thinking': return '💭';
      case 'idle': return '😴';
      case 'error': return '❌';
      default: return '•';
    }
  }
}
