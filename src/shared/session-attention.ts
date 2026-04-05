import { SessionInfo } from './types';

export function applySessionAttention(session: SessionInfo): SessionInfo {
  if (session.isStale && session.currentTask) {
    return {
      ...session,
      attentionScore: 90,
      attentionReason: 'Stale task',
    };
  }

  if (session.state === 'error') {
    return {
      ...session,
      attentionScore: 80,
      attentionReason: 'Needs attention',
    };
  }

  if (session.activityLabel === 'Coding' || session.state === 'coding') {
    return {
      ...session,
      attentionScore: 70,
      attentionReason: 'Active coding',
    };
  }

  if (session.activityLabel === 'Reviewing') {
    return {
      ...session,
      attentionScore: 65,
      attentionReason: 'Reviewing work',
    };
  }

  if (session.activityLabel === 'Planning') {
    return {
      ...session,
      attentionScore: 60,
      attentionReason: 'Active planning',
    };
  }

  if (session.activityLabel === 'Waiting') {
    return {
      ...session,
      attentionScore: 55,
      attentionReason: 'Waiting for reply',
    };
  }

  if (session.state === 'thinking') {
    return {
      ...session,
      attentionScore: 60,
      attentionReason: 'Active thinking',
    };
  }

  if (session.isStale) {
    return {
      ...session,
      attentionScore: 50,
      attentionReason: 'Stale idle',
    };
  }

  return {
    ...session,
    attentionScore: 20,
    attentionReason: 'Fresh idle',
  };
}

export function sortSessionsByAttention(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort((left, right) => {
    if (right.attentionScore !== left.attentionScore) {
      return right.attentionScore - left.attentionScore;
    }

    if (left.startedAt !== right.startedAt) {
      return left.startedAt - right.startedAt;
    }

    return left.sessionId.localeCompare(right.sessionId);
  });
}
