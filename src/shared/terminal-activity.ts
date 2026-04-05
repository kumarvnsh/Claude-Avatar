import { ActivityLabel, SessionState } from './types';

export interface TerminalSnapshot {
  cwd: string;
  body: string;
  activeCommand?: string;
  lastCommand?: string;
  recencyRank: number;
}

interface SessionActivityInput {
  cwd: string;
  projectName: string;
  currentTask: string | null;
  state: SessionState;
}

const ACTIVITY_RULES: Array<{ label: ActivityLabel; patterns: RegExp[] }> = [
  {
    label: 'Coding',
    patterns: [
      /\bimplement(?:ing|ation)?\b/i,
      /\bpatch(?:ing)?\b/i,
      /\bfix(?:ing|ed)?\b/i,
      /\bedit(?:ing)?\b/i,
      /\brefactor(?:ing)?\b/i,
      /\bbuild(?:ing)?\b/i,
      /\btest(?:s|ing)?\b/i,
      /\bcompile(?:r|s|d|ing)?\b/i,
      /\bbundle(?:d|ing)?\b/i,
      /\bwrite(?:s|ing)? code\b/i,
    ],
  },
  {
    label: 'Planning',
    patterns: [
      /\bplan(?:ning)?\b/i,
      /\bdesign(?:ing)?\b/i,
      /\bbrainstorm(?:ing)?\b/i,
      /\bspec\b/i,
      /\barchitecture\b/i,
      /\bapproach\b/i,
      /\broadmap\b/i,
    ],
  },
  {
    label: 'Reviewing',
    patterns: [
      /\breview(?:ing)?\b/i,
      /\baudit(?:ing)?\b/i,
      /\binspect(?:ing)?\b/i,
      /\bfindings\b/i,
      /\bverify(?:ing|ication)?\b/i,
      /\bdiff\b/i,
    ],
  },
  {
    label: 'Waiting',
    patterns: [
      /\bawait(?:ing)?\b/i,
      /\bwaiting for\b/i,
      /\bblocked\b/i,
      /\bneed your input\b/i,
      /\blet me know\b/i,
      /\bplease review\b/i,
      /\bapproval\b/i,
    ],
  },
  {
    label: 'Thinking',
    patterns: [
      /\bthink(?:ing)?\b/i,
      /\binvestigat(?:e|ing|ion)\b/i,
      /\banaly(?:sis|zing|ze)\b/i,
      /\breason(?:ing)?\b/i,
      /\bresearch(?:ing)?\b/i,
      /\btrace\b/i,
    ],
  },
];

const WAITING_PROMPT_PATTERNS: RegExp[] = [
  /\bwhich approach\??\b/i,
  /\bwhich option\??\b/i,
  /\bwhich one\??\b/i,
  /\bwhich path\??\b/i,
  /\bchoose\b/i,
  /\byour turn\b/i,
  /\bwhat do you want\b/i,
  /\bwaiting for (?:your |user )?(?:response|input)\b/i,
];

export function inferTerminalActivity(text: string): ActivityLabel {
  const normalized = text.trim();
  if (!normalized) {
    return 'Thinking';
  }

  if (WAITING_PROMPT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'Waiting';
  }

  for (const rule of ACTIVITY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return rule.label;
    }
  }

  return 'Thinking';
}

export function inferRecentTranscriptActivity(textBlocks: string[]): ActivityLabel {
  for (let index = textBlocks.length - 1; index >= 0; index--) {
    const text = textBlocks[index]?.trim();
    if (text) {
      return inferTerminalActivity(text);
    }
  }

  return 'Thinking';
}

export function chooseBestTerminalSnapshot(
  session: Pick<SessionActivityInput, 'cwd' | 'projectName'>,
  snapshots: TerminalSnapshot[]
): TerminalSnapshot | null {
  const normalizedCwd = normalizePath(session.cwd);
  let best: { snapshot: TerminalSnapshot; score: number } | null = null;

  for (const snapshot of snapshots) {
    const score = scoreSnapshotMatch(normalizedCwd, session.projectName, snapshot);
    if (score < 60) {
      continue;
    }

    if (!best || score > best.score) {
      best = { snapshot, score };
    }
  }

  return best?.snapshot ?? null;
}

export function deriveActivityLabel(
  session: SessionActivityInput,
  snapshots: TerminalSnapshot[],
  transcriptText?: string
): ActivityLabel {
  const snapshot = chooseBestTerminalSnapshot(session, snapshots);
  if (snapshot) {
    const combined = [snapshot.activeCommand, snapshot.lastCommand, snapshot.body]
      .filter(Boolean)
      .join('\n');
    return inferTerminalActivity(combined);
  }

  if (transcriptText?.trim()) {
    return inferTerminalActivity(transcriptText);
  }

  if (session.currentTask) {
    return inferTerminalActivity(session.currentTask);
  }

  if (session.state === 'coding') {
    return 'Coding';
  }

  if (session.state === 'error') {
    return 'Thinking';
  }

  return 'Thinking';
}

function scoreSnapshotMatch(
  normalizedCwd: string,
  projectName: string,
  snapshot: TerminalSnapshot
): number {
  const snapshotCwd = normalizePath(snapshot.cwd);
  const combinedText = [
    snapshot.cwd,
    snapshot.activeCommand,
    snapshot.lastCommand,
    snapshot.body,
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  let score = 0;
  if (snapshotCwd === normalizedCwd) {
    score += 100;
  } else if (combinedText.includes(normalizedCwd.toLowerCase())) {
    score += 90;
  } else if (combinedText.includes(projectName.toLowerCase())) {
    score += 20;
  }

  if (combinedText.includes('claude')) {
    score += 10;
  }

  score += Math.max(0, 5 - snapshot.recencyRank);
  return score;
}

function normalizePath(value: string): string {
  return value.trim().replace(/^"(.*)"$/, '$1');
}
