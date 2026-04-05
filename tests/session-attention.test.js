const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadAttentionModule() {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../dist/shared/session-attention.js')
  ).href;

  try {
    return await import(moduleUrl);
  } catch {
    assert.fail('session attention helper missing');
  }
}

function createSession(overrides = {}) {
  return {
    sessionId: 'session-1',
    pid: 123,
    cwd: '/tmp/project',
    projectName: 'project',
    startedAt: 100,
    state: 'idle',
    currentTask: null,
    color: 'hsl(10, 65%, 55%)',
    lastUpdatedAt: 1_700_000_000_000,
    isStale: false,
    attentionScore: 0,
    attentionReason: '',
    activityLabel: 'Thinking',
    ...overrides,
  };
}

test('scores stale sessions with active tasks above fresh idle sessions', async () => {
  const { applySessionAttention } = await loadAttentionModule();

  const staleTask = applySessionAttention(createSession({
    currentTask: 'Implement feature',
    isStale: true,
  }));
  const freshIdle = applySessionAttention(createSession());

  assert.ok(staleTask.attentionScore > freshIdle.attentionScore);
  assert.equal(staleTask.attentionReason, 'Stale task');
  assert.equal(freshIdle.attentionReason, 'Fresh idle');
});

test('keeps coding sessions above fresh idle sessions', async () => {
  const { applySessionAttention } = await loadAttentionModule();

  const coding = applySessionAttention(createSession({
    state: 'coding',
    currentTask: 'Write tests',
  }));
  const freshIdle = applySessionAttention(createSession());

  assert.ok(coding.attentionScore > freshIdle.attentionScore);
  assert.equal(coding.attentionReason, 'Active coding');
});

test('labels waiting sessions as waiting for reply', async () => {
  const { applySessionAttention } = await loadAttentionModule();

  const waiting = applySessionAttention(createSession({
    state: 'thinking',
    activityLabel: 'Waiting',
  }));

  assert.equal(waiting.attentionReason, 'Waiting for reply');
});

test('sorts by score then by startedAt for stable ties', async () => {
  const { sortSessionsByAttention } = await loadAttentionModule();

  const sessions = [
    createSession({ sessionId: 'later', startedAt: 200, state: 'coding', currentTask: 'Task A', attentionScore: 70 }),
    createSession({ sessionId: 'earlier', startedAt: 100, state: 'coding', currentTask: 'Task B', attentionScore: 70 }),
    createSession({ sessionId: 'idle', startedAt: 50, attentionScore: 20 }),
  ];

  const sorted = sortSessionsByAttention(sessions);

  assert.deepEqual(sorted.map(session => session.sessionId), ['earlier', 'later', 'idle']);
});
