import { SessionState } from './types';

interface SessionStateInput {
  currentTask: string | null;
  kind?: string;
  entrypoint?: string;
}

export function determineSessionState(input: SessionStateInput): SessionState {
  const { currentTask, kind, entrypoint } = input;

  if (currentTask) {
    const lower = currentTask.toLowerCase();
    if (lower.includes('thinking') || lower.includes('planning') || lower.includes('researching')) {
      return 'thinking';
    }
    return 'coding';
  }

  if (kind === 'interactive' || entrypoint === 'cli') {
    return 'thinking';
  }

  return 'idle';
}
