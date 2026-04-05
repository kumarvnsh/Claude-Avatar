import { ActivityLabel, SessionState } from '../shared/types';

interface TooltipActivityInput {
  state: SessionState;
  activityLabel: ActivityLabel;
}

const ACTIVITY_EMOJI: Record<ActivityLabel, string> = {
  Coding: '✨',
  Planning: '🗂',
  Reviewing: '🔎',
  Waiting: '⏳',
  Thinking: '💭',
};

export function getPrimaryTooltipStatus(input: TooltipActivityInput): string {
  const { activityLabel, state } = input;
  const label = activityLabel || stateLabelFromState(state);
  const emoji = ACTIVITY_EMOJI[label];
  return `${emoji} ${label}`;
}

function stateLabelFromState(state: SessionState): ActivityLabel {
  switch (state) {
    case 'coding':
      return 'Coding';
    case 'idle':
      return 'Thinking';
    case 'error':
      return 'Thinking';
    case 'thinking':
    default:
      return 'Thinking';
  }
}
