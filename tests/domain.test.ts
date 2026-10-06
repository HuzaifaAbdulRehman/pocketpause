import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCard, makeCard, parseModelActivity, parseRequest } from '../src/domain.ts';

for (const duration of [5, 10, 15]) {
  for (const surroundings of ['street', 'terrace', 'courtyard', 'campus']) {
    test(`accepts ${duration} minutes in ${surroundings}`, () => {
      assert.deepEqual(parseRequest({ duration, surroundings }), { duration, surroundings });
    });
  }
}

const invalidRequests: [string, unknown][] = [
  ['null', null],
  ['an array', [5, 'street']],
  ['a numeric string', { duration: '5', surroundings: 'courtyard' }],
  ['an unsupported duration', { duration: 6, surroundings: 'street' }],
  ['a missing duration', { surroundings: 'street' }],
  ['a missing surroundings value', { duration: 5 }],
  ['an unlisted place', { duration: 5, surroundings: 'roof' }],
  ['a differently cased place', { duration: 5, surroundings: 'Street' }],
  ['extra fields', { duration: 5, surroundings: 'street', url: 'https://example.com' }],
];

for (const [name, value] of invalidRequests) {
  test(`rejects ${name} in a request`, () => assert.throws(() => parseRequest(value)));
}

test('accepts and trims a valid model activity', () => {
  assert.deepEqual(parseModelActivity({ title: ' Notice light ', steps: [' Look at shadows. '] }), {
    title: 'Notice light', steps: ['Look at shadows.'],
  });
});

test('accepts the title and step length boundaries', () => {
  const activity = parseModelActivity({ title: 'x'.repeat(80), steps: ['y'.repeat(180)] });
  assert.equal(activity.title.length, 80);
  assert.equal(activity.steps[0]?.length, 180);
});

test('counts Unicode characters rather than UTF-16 code units', () => {
  assert.equal(parseModelActivity({ title: '🌿'.repeat(80), steps: ['Look at light.'] }).title, '🌿'.repeat(80));
  assert.throws(() => parseModelActivity({ title: '🌿'.repeat(81), steps: ['Look at light.'] }));
});

const invalidActivities: [string, unknown][] = [
  ['null', null],
  ['an array', []],
  ['an empty title', { title: '', steps: ['Look.'] }],
  ['a whitespace title', { title: '  ', steps: ['Look.'] }],
  ['a numeric title', { title: 7, steps: ['Look.'] }],
  ['an overlong title', { title: 'x'.repeat(81), steps: ['Look.'] }],
  ['an overlong step', { title: 'Look', steps: ['x'.repeat(181)] }],
  ['no steps', { title: 'Look', steps: [] }],
  ['too many steps', { title: 'Look', steps: ['A', 'B', 'C', 'D'] }],
  ['an empty step', { title: 'Look', steps: [''] }],
  ['a whitespace step', { title: 'Look', steps: ['  '] }],
  ['a numeric step', { title: 'Look', steps: [1] }],
  ['a string instead of steps', { title: 'Look', steps: 'Look.' }],
  ['extra fields', { title: 'Look', steps: ['Look.'], duration: 20 }],
];

for (const [name, value] of invalidActivities) {
  test(`rejects ${name} in model output`, () => assert.throws(() => parseModelActivity(value)));
}

test('keeps request context separate from model output', () => {
  assert.deepEqual(makeCard({ duration: 10, surroundings: 'campus' }, {
    title: 'Notice light', steps: ['Look at the ground.'],
  }), {
    duration: 10, surroundings: 'campus', title: 'Notice light',
    steps: ['Look at the ground.'], source: 'local-ai',
  });
});

test('exports every card field and the safety reminder as plain text', () => {
  const text = formatCard({
    duration: 15, surroundings: 'terrace', title: '<b>Notice light</b>',
    steps: ['Notice a shadow.', 'Notice a bright patch.'], source: 'local-ai',
  });
  for (const part of ['15 minutes', 'terrace', '<b>Notice light</b>',
    'Notice a shadow.', 'Notice a bright patch.', 'safe, permitted outdoor spot', 'local']) {
    assert.ok(text.includes(part), `missing exported content: ${part}`);
  }
  assert.ok(!text.includes('<html'));
  assert.ok(!text.includes('<!DOCTYPE'));
});
