import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { inferRecentTranscriptActivity, TerminalSnapshot } from '../shared/terminal-activity';

const CURSOR_PROJECTS_DIR = path.join(os.homedir(), '.cursor', 'projects');
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const TERMINAL_BODY_CHAR_LIMIT = 2_500;
const TRANSCRIPT_TEXT_CHAR_LIMIT = 2_500;

export function readTerminalSnapshots(): TerminalSnapshot[] {
  if (!fs.existsSync(CURSOR_PROJECTS_DIR)) {
    return [];
  }

  const terminalFiles: Array<{ path: string; mtimeMs: number }> = [];

  for (const entry of fs.readdirSync(CURSOR_PROJECTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const terminalsDir = path.join(CURSOR_PROJECTS_DIR, entry.name, 'terminals');
    if (!fs.existsSync(terminalsDir)) {
      continue;
    }

    for (const file of fs.readdirSync(terminalsDir)) {
      if (!file.endsWith('.txt')) {
        continue;
      }

      const filePath = path.join(terminalsDir, file);
      try {
        terminalFiles.push({
          path: filePath,
          mtimeMs: fs.statSync(filePath).mtimeMs,
        });
      } catch {
        // Skip snapshots that disappear mid-poll.
      }
    }
  }

  terminalFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);

  return terminalFiles
    .map((entry, index) => parseTerminalSnapshot(entry.path, index))
    .filter((snapshot): snapshot is TerminalSnapshot => snapshot !== null);
}

function parseTerminalSnapshot(filePath: string, recencyRank: number): TerminalSnapshot | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sections = content.split('\n---\n');
    if (sections.length < 2) {
      return null;
    }

    const metadata = parseMetadata(sections[0]);
    const body = sections.slice(1).join('\n---\n').trim();

    if (!metadata.cwd) {
      return null;
    }

    return {
      cwd: metadata.cwd,
      activeCommand: metadata.active_command,
      lastCommand: metadata.last_command ?? metadata.command,
      body: body.slice(-TERMINAL_BODY_CHAR_LIMIT),
      recencyRank,
    };
  } catch {
    return null;
  }
}

function parseMetadata(rawHeader: string): Record<string, string> {
  const lines = rawHeader
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== '---');

  const metadata: Record<string, string> = {};
  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    metadata[key] = value.replace(/^"(.*)"$/, '$1');
  }

  return metadata;
}

export function readClaudeTranscriptSnippet(sessionId: string): string | null {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    return null;
  }

  for (const entry of fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const transcriptPath = path.join(CLAUDE_PROJECTS_DIR, entry.name, `${sessionId}.jsonl`);
    if (!fs.existsSync(transcriptPath)) {
      continue;
    }

    try {
      const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n');
      const collected: string[] = [];

      for (let index = lines.length - 1; index >= 0 && collected.length < 6; index--) {
        const text = extractTranscriptText(lines[index]);
        if (text) {
          collected.unshift(text);
        }
      }

      const latestRelevantText = getLatestTranscriptText(collected);
      return latestRelevantText ? latestRelevantText.slice(-TRANSCRIPT_TEXT_CHAR_LIMIT) : null;
    } catch {
      return null;
    }
  }

  return null;
}

function getLatestTranscriptText(textBlocks: string[]): string | null {
  const activity = inferRecentTranscriptActivity(textBlocks);

  for (let index = textBlocks.length - 1; index >= 0; index--) {
    const text = textBlocks[index]?.trim();
    if (!text) {
      continue;
    }

    if (inferRecentTranscriptActivity([text]) === activity) {
      return text;
    }
  }

  return textBlocks[textBlocks.length - 1]?.trim() || null;
}

function extractTranscriptText(line: string): string | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed?.type === 'assistant') {
      const content = parsed.message?.content;
      if (Array.isArray(content)) {
        return content
          .filter((block: { type?: string; text?: string }) => block?.type === 'text' && block.text)
          .map((block: { text: string }) => block.text)
          .join('\n')
          .trim() || null;
      }
    }

    if (parsed?.type === 'user') {
      const content = parsed.message?.content;
      if (Array.isArray(content)) {
        return content
          .filter((block: { type?: string; text?: string }) => block?.type === 'text' && block.text)
          .map((block: { text: string }) => block.text)
          .join('\n')
          .trim() || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}
