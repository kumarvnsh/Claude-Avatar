import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionInfo, SessionState } from '../shared/types';
import { applySessionFreshness } from '../shared/session-freshness';
import { applySessionAttention, sortSessionsByAttention } from '../shared/session-attention';
import { determineSessionState } from '../shared/session-state';
import { deriveActivityLabel } from '../shared/terminal-activity';
import { readClaudeTranscriptSnippet, readTerminalSnapshots } from './terminal-activity';

interface RawSessionFile {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind?: string;
  entrypoint?: string;
}

interface TodoFile {
  activeForm?: string;
}

export class SessionMonitor extends EventEmitter {
  private sessionsDir: string;
  private todosDir: string;
  private pollInterval: NodeJS.Timeout | null = null;
  private currentSessions: Map<string, SessionInfo> = new Map();
  private useMockData: boolean;

  constructor(useMockData = false) {
    super();
    const homeDir = os.homedir();
    this.sessionsDir = path.join(homeDir, '.claude', 'sessions');
    this.todosDir = path.join(homeDir, '.claude', 'todos');
    this.useMockData = useMockData;
  }

  start(intervalMs = 3000): void {
    // Do an initial poll immediately
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private poll(): void {
    if (this.useMockData) {
      this.pollMock();
      return;
    }

    try {
      const sessions = this.discoverSessions();
      const terminalSnapshots = readTerminalSnapshots();
      const enriched = sessions.map(s => this.enrichSession(s, terminalSnapshots));
      this.updateSessions(enriched);
    } catch (err) {
      // Sessions dir might not exist yet — that's fine
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('SessionMonitor poll error:', err);
      }
    }
  }

  private discoverSessions(): RawSessionFile[] {
    if (!fs.existsSync(this.sessionsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
    const sessions: RawSessionFile[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.sessionsDir, file), 'utf-8');
        const data: RawSessionFile = JSON.parse(content);

        // Validate PID is alive
        if (this.isPidAlive(data.pid)) {
          sessions.push(data);
        }
      } catch {
        // Skip invalid files
      }
    }

    return sessions;
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0); // Signal 0 = existence check
      return true;
    } catch {
      return false;
    }
  }

  private enrichSession(raw: RawSessionFile, terminalSnapshots = readTerminalSnapshots()): SessionInfo {
    const currentTask = this.getCurrentTask(raw.sessionId);
    const state = this.determineState(raw, currentTask);
    const now = Date.now();
    const projectName = path.basename(raw.cwd);
    const transcriptText = readClaudeTranscriptSnippet(raw.sessionId);

    return {
      sessionId: raw.sessionId,
      pid: raw.pid,
      cwd: raw.cwd,
      projectName,
      startedAt: raw.startedAt,
      state,
      currentTask,
      color: this.sessionIdToColor(raw.sessionId),
      lastUpdatedAt: now,
      isStale: false,
      attentionScore: 0,
      attentionReason: '',
      activityLabel: deriveActivityLabel(
        {
          cwd: raw.cwd,
          projectName,
          currentTask,
          state,
        },
        terminalSnapshots,
        transcriptText ?? undefined
      ),
    };
  }

  private determineState(raw: RawSessionFile, currentTask: string | null): SessionState {
    return determineSessionState({
      currentTask,
      kind: raw.kind,
      entrypoint: raw.entrypoint,
    });
  }

  private getCurrentTask(sessionId: string): string | null {
    if (!fs.existsSync(this.todosDir)) {
      return null;
    }

    try {
      const todoFiles = fs.readdirSync(this.todosDir)
        .filter(f => f.startsWith(`${sessionId}-agent-`) && f.endsWith('.json'))
        .map(f => ({
          name: f,
          mtime: fs.statSync(path.join(this.todosDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (todoFiles.length === 0) return null;

      const content = fs.readFileSync(
        path.join(this.todosDir, todoFiles[0].name),
        'utf-8'
      );
      const todo: TodoFile = JSON.parse(content);
      return todo.activeForm || null;
    } catch {
      return null;
    }
  }

  private sessionIdToColor(sessionId: string): string {
    // Hash sessionId to get a deterministic hue
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      const char = sessionId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  }

  private updateSessions(newSessions: SessionInfo[]): void {
    const now = Date.now();
    const scoredSessions = sortSessionsByAttention(
      newSessions.map((session) =>
        applySessionAttention(
          applySessionFreshness(this.currentSessions.get(session.sessionId), session, now)
        )
      )
    );
    const newMap = new Map(scoredSessions.map(s => [s.sessionId, s]));

    // Check if anything changed
    let changed = newMap.size !== this.currentSessions.size;
    if (!changed) {
      for (const [id, session] of newMap) {
        const existing = this.currentSessions.get(id);
        if (!existing ||
          existing.state !== session.state ||
          existing.currentTask !== session.currentTask ||
          existing.activityLabel !== session.activityLabel ||
          existing.isStale !== session.isStale ||
          existing.attentionScore !== session.attentionScore ||
          existing.attentionReason !== session.attentionReason) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      this.currentSessions = newMap;
      this.emit('sessions-updated', scoredSessions);
    }
  }

  // --- Mock Data Mode ---
  private mockPhase = 0;

  private pollMock(): void {
    const mockSessions: SessionInfo[] = [
      {
        sessionId: 'mock-session-001',
        pid: process.pid,
        cwd: '/Users/dev/projects/my-app',
        projectName: 'my-app',
        startedAt: Date.now() - 60000 * 30,
        state: 'coding',
        currentTask: 'Implementing user authentication',
        color: this.sessionIdToColor('mock-session-001'),
        lastUpdatedAt: Date.now(),
        isStale: false,
        attentionScore: 0,
        attentionReason: '',
        activityLabel: 'Coding',
      },
      {
        sessionId: 'mock-session-002',
        pid: process.pid,
        cwd: '/Users/dev/projects/api-server',
        projectName: 'api-server',
        startedAt: Date.now() - 60000 * 15,
        state: 'thinking',
        currentTask: 'Researching database architecture',
        color: this.sessionIdToColor('mock-session-002'),
        lastUpdatedAt: Date.now(),
        isStale: false,
        attentionScore: 0,
        attentionReason: '',
        activityLabel: 'Planning',
      },
      {
        sessionId: 'mock-session-003',
        pid: process.pid,
        cwd: '/Users/dev/projects/docs-site',
        projectName: 'docs-site',
        startedAt: Date.now() - 60000 * 5,
        state: 'idle',
        currentTask: null,
        color: this.sessionIdToColor('mock-session-003'),
        lastUpdatedAt: Date.now(),
        isStale: false,
        attentionScore: 0,
        attentionReason: '',
        activityLabel: 'Thinking',
      },
    ];

    // Cycle states for visual testing
    this.mockPhase = (this.mockPhase + 1) % 12;
    const states: SessionState[] = ['coding', 'thinking', 'idle', 'error'];
    mockSessions[0].state = states[Math.floor(this.mockPhase / 3) % 4];

    this.updateSessions(mockSessions);
  }
}
