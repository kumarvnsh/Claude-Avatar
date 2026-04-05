const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadTooltipPositionModule() {
  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../dist/renderer/tooltip-position.js')
  ).href;

  try {
    return await import(moduleUrl);
  } catch {
    assert.fail('tooltip position helper missing');
  }
}

test('clamps tooltip top so tall cards stay inside overlay', async () => {
  const { getTooltipTop } = await loadTooltipPositionModule();

  const top = getTooltipTop({
    anchorY: 120,
    tooltipHeight: 96,
    viewportHeight: 160,
  });

  assert.equal(top, 16);
});

test('positions tooltip above avatar when there is room', async () => {
  const { getTooltipTop } = await loadTooltipPositionModule();

  const top = getTooltipTop({
    anchorY: 120,
    tooltipHeight: 48,
    viewportHeight: 160,
  });

  assert.equal(top, 64);
});
