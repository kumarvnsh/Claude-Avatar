const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadTerminalActivityModule() {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../dist/shared/terminal-activity.js')
  ).href;

  try {
    return await import(moduleUrl);
  } catch {
    assert.fail('terminal activity helper missing');
  }
}

test('prefers coding over planning when both signals appear', async () => {
  const { inferTerminalActivity } = await loadTerminalActivityModule();

  const activity = inferTerminalActivity(
    'Planning the fix, then implementing the patch and running tests'
  );

  assert.equal(activity, 'Coding');
});

test('falls back to thinking when text is generic', async () => {
  const { inferTerminalActivity } = await loadTerminalActivityModule();

  const activity = inferTerminalActivity(
    'Investigating the issue and reasoning about the next step'
  );

  assert.equal(activity, 'Thinking');
});

test('treats explicit user-choice prompts as waiting even in planning text', async () => {
  const { inferTerminalActivity } = await loadTerminalActivityModule();

  const activity = inferTerminalActivity(
    'Plan complete and saved. Two execution options: 1. Subagent-Driven 2. Inline Execution. Which approach?'
  );

  assert.equal(activity, 'Waiting');
});

test('prefers exact cwd terminal matches over unrelated terminals', async () => {
  const { chooseBestTerminalSnapshot } = await loadTerminalActivityModule();

  const match = chooseBestTerminalSnapshot(
    { cwd: '/tmp/project', projectName: 'project' },
    [
      { cwd: '/tmp/other', body: 'implement fix', recencyRank: 0 },
      { cwd: '/tmp/project', body: 'review findings', recencyRank: 1 },
    ]
  );

  assert.equal(match?.cwd, '/tmp/project');
});

test('does not derive activity from an unrelated terminal', async () => {
  const { deriveActivityLabel } = await loadTerminalActivityModule();

  const activity = deriveActivityLabel(
    {
      cwd: '/tmp/project',
      projectName: 'project',
      currentTask: null,
      state: 'thinking',
    },
    [{ cwd: '/tmp/other', body: 'implement fix', recencyRank: 0 }]
  );

  assert.equal(activity, 'Thinking');
});

test('uses matched terminal activity when cwd matches', async () => {
  const { deriveActivityLabel } = await loadTerminalActivityModule();

  const activity = deriveActivityLabel(
    {
      cwd: '/tmp/project',
      projectName: 'project',
      currentTask: null,
      state: 'thinking',
    },
    [{ cwd: '/tmp/project', body: 'review findings before patching bug', recencyRank: 0 }]
  );

  assert.equal(activity, 'Coding');
});

test('uses transcript text when no terminal snapshot matches', async () => {
  const { deriveActivityLabel } = await loadTerminalActivityModule();

  const activity = deriveActivityLabel(
    {
      cwd: '/tmp/project',
      projectName: 'project',
      currentTask: null,
      state: 'thinking',
    },
    [{ cwd: '/tmp/other', body: 'implement fix', recencyRank: 0 }],
    'Two execution options are available. Which approach?'
  );

  assert.equal(activity, 'Waiting');
});

test('prefers the latest transcript prompt over older coding text', async () => {
  const { inferRecentTranscriptActivity } = await loadTerminalActivityModule();

  const activity = inferRecentTranscriptActivity([
    'Implement patch and run tests for the collision fix',
    'Two execution options are available. Which approach?',
  ]);

  assert.equal(activity, 'Waiting');
});
