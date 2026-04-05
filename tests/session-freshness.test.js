const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const now = 1_700_000_000_000;

async function loadFreshnessModule() {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../dist/shared/session-freshness.js')
  ).href;

  try {
    return await import(moduleUrl);
  } catch {
    assert.fail('session freshness helper missing');
  }
}

function createSession(overrides = {}) {
  return {
    sessionId: 'session-1',
    pid: 123,
    cwd: '/tmp/project',
    projectName: 'project',
    startedAt: now - 60_000,
    state: 'coding',
    currentTask: 'Implement feature',
    color: 'hsl(10, 65%, 55%)',
    lastUpdatedAt: now - 60_000,
    isStale: false,
    activityLabel: 'Thinking',
    ...overrides,
  };
}

test('marks unchanged sessions stale after the threshold', async () => {
  const { SESSION_STALE_THRESHOLD_MS, applySessionFreshness } = await loadFreshnessModule();
  const previous = createSession({
    lastUpdatedAt: now - SESSION_STALE_THRESHOLD_MS - 1,
  });
  const next = createSession();

  const result = applySessionFreshness(previous, next, now);

  assert.equal(result.lastUpdatedAt, previous.lastUpdatedAt);
  assert.equal(result.isStale, true);
});

test('resets lastUpdatedAt when the task changes', async () => {
  const { applySessionFreshness } = await loadFreshnessModule();
  const previous = createSession({
    lastUpdatedAt: now - 8 * 60_000,
  });
  const next = createSession({
    currentTask: 'Review pull request',
  });

  const result = applySessionFreshness(previous, next, now);

  assert.equal(result.lastUpdatedAt, now);
  assert.equal(result.isStale, false);
});

test('formats the last updated label in whole minutes', async () => {
  const { formatLastUpdatedLabel } = await loadFreshnessModule();

  const label = formatLastUpdatedLabel(now - 12 * 60_000, now);

  assert.equal(label, 'Last updated: 12m ago');
});
