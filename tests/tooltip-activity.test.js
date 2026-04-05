const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadTooltipActivityModule() {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../dist/renderer/tooltip-activity.js')
  ).href;

  try {
    return await import(moduleUrl);
  } catch {
    assert.fail('tooltip activity helper missing');
  }
}

test('uses the richer activity label for the primary tooltip line', async () => {
  const { getPrimaryTooltipStatus } = await loadTooltipActivityModule();

  const status = getPrimaryTooltipStatus({
    state: 'thinking',
    activityLabel: 'Planning',
  });

  assert.equal(status, '🗂 Planning');
});

test('shows waiting as the primary tooltip line', async () => {
  const { getPrimaryTooltipStatus } = await loadTooltipActivityModule();

  const status = getPrimaryTooltipStatus({
    state: 'thinking',
    activityLabel: 'Waiting',
  });

  assert.equal(status, '⏳ Waiting');
});
