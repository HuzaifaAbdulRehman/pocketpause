import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baselineFor, evaluationCases } from '../scripts/baseline.ts';
import { measureTrial } from '../scripts/evaluate.ts';
import { parseModelActivity } from '../src/domain.ts';
import { GenerationError } from '../src/ollama.ts';

test('evaluation covers exactly the twelve combinations once', () => {
  const cases = evaluationCases();
  assert.equal(cases.length, 12);
  assert.deepEqual(cases.map(c => `${c.duration}/${c.surroundings}`).sort(), [
    '10/campus', '10/courtyard', '10/street', '10/terrace',
    '15/campus', '15/courtyard', '15/street', '15/terrace',
    '5/campus', '5/courtyard', '5/street', '5/terrace',
  ]);
});

test('baseline cards satisfy the contract and contain no model provenance', () => {
  for (const request of evaluationCases()) {
    const baseline = baselineFor(request);
    assert.deepEqual(parseModelActivity(baseline), baseline);
    assert.deepEqual(Object.keys(baseline).sort(), ['steps', 'title']);
  }
  assert.deepEqual(baselineFor({ duration: 5, surroundings: 'courtyard' }), {
    title: 'A courtyard pause', steps: [
      'From a safe stationary spot, notice how light falls on the surfaces around you.',
      'Let your gaze settle on one ordinary shape. Notice its outline without needing to name it.',
    ],
  });
});

test('records successful generation with the original request and elapsed time', async () => {
  const input = { duration: 5 as const, surroundings: 'courtyard' as const };
  const card = { ...input, title: 'Light', steps: ['Notice light.'], source: 'local-ai' as const };
  const times = [100, 125];
  assert.deepEqual(await measureTrial(input, async () => card, () => times.shift()!), {
    request: input, elapsedMs: 25, card,
  });
});

test('keeps failures rather than dropping them from the report', async () => {
  const input = { duration: 10 as const, surroundings: 'street' as const };
  const times = [20, 50];
  const result = await measureTrial(input, async () => { throw new GenerationError('timeout', 'Timed out.'); }, () => times.shift()!);
  assert.deepEqual(result, { request: input, elapsedMs: 30, error: { code: 'timeout', message: 'Timed out.' } });
});
