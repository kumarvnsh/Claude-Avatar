const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadSessionStateModule() {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../dist/shared/session-state.js')
  ).href;

  try {
    return await import(moduleUrl);
  } catch {
    assert.fail('session state helper missing');
  }
}

test('classifies live interactive sessions without todos as thinking', async () => {
  const { determineSessionState } = await loadSessionStateModule();

  const state = determineSessionState({
    currentTask: null,
    kind: 'interactive',
    entrypoint: 'cli',
  });

  assert.equal(state, 'thinking');
});

test('keeps explicit active work as coding', async () => {
  const { determineSessionState } = await loadSessionStateModule();

  const state = determineSessionState({
    currentTask: 'Implement session monitor',
    kind: 'interactive',
    entrypoint: 'cli',
  });

  assert.equal(state, 'coding');
});

test('treats planning-style task text as thinking', async () => {
  const { determineSessionState } = await loadSessionStateModule();

  const state = determineSessionState({
    currentTask: 'Researching packaging issue',
    kind: 'interactive',
    entrypoint: 'cli',
  });

  assert.equal(state, 'thinking');
});
