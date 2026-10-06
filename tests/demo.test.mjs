import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('real demo holds the generated card and saved state for reading', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/smoke.mjs'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), timeout: 150000,
  });
  const report = JSON.parse(stdout.split('\n').find(line => line.startsWith('{')));
  assert.ok(report.cardVisibleMs >= 4000, 'generated card needs four readable seconds');
  assert.ok(report.savedVisibleMs >= 4000, 'saved confirmation needs four readable seconds');
  assert.equal(report.savedInViewport, true);
});
