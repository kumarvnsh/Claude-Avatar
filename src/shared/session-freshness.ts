import { SessionInfo } from './types';

export const SESSION_STALE_THRESHOLD_MS = 10 * 60 * 1000;

export function applySessionFreshness(
  previous: SessionInfo | undefined,
  next: SessionInfo,
  now = Date.now()
): SessionInfo {
  const hasMeaningfulUpdate = !previous ||
    previous.state !== next.state ||
    previous.currentTask !== next.currentTask;

  const lastUpdatedAt = hasMeaningfulUpdate
    ? now
    : previous.lastUpdatedAt;

  return {
    ...next,
    lastUpdatedAt,
    isStale: now - lastUpdatedAt >= SESSION_STALE_THRESHOLD_MS,
  };
}

export function formatLastUpdatedLabel(lastUpdatedAt: number, now = Date.now()): string {
  const elapsedMinutes = Math.max(0, Math.floor((now - lastUpdatedAt) / 60_000));
  return `Last updated: ${elapsedMinutes}m ago`;
}
