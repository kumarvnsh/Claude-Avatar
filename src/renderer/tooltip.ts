import { SessionInfo } from '../shared/types';
import { formatLastUpdatedLabel } from '../shared/session-freshness';
import { getPrimaryTooltipStatus } from './tooltip-activity';
import { getTooltipTop } from './tooltip-position';

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
    stateLabel.textContent = getPrimaryTooltipStatus({
      state: session.state,
      activityLabel: session.activityLabel,
    });
    this.element.appendChild(stateLabel);

    const updatedLabel = document.createElement('div');
    updatedLabel.className = 'tooltip-meta';
    updatedLabel.textContent = formatLastUpdatedLabel(session.lastUpdatedAt);
    this.element.appendChild(updatedLabel);

    const priorityLabel = document.createElement('div');
    priorityLabel.className = 'tooltip-meta';
    priorityLabel.textContent = `Priority: ${session.attentionReason}`;
    this.element.appendChild(priorityLabel);

    if (session.isStale) {
      const staleLabel = document.createElement('div');
      staleLabel.className = 'tooltip-stale';
      staleLabel.textContent = 'Stale';
      this.element.appendChild(staleLabel);
    }

    // Measure after content update so we can clamp the card inside the overlay.
    const tooltipRect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x - tooltipRect.width / 2;
    left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));
    const top = getTooltipTop({
      anchorY: y,
      tooltipHeight: tooltipRect.height,
      viewportHeight,
    });

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.element.style.bottom = 'auto';
    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }
}
