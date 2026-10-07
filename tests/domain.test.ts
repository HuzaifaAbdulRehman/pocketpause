import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatCard,
  makeCard,
  parseModelActivity,
  parseModelCues,
  parseRequest,
  renderCueActivity,
} from '../src/domain.ts';

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

const cues = [
  'outline_shape',
  'outline_edge',
  'brightness_contrast',
  'brightness_change',
  'sound_rhythm',
  'sound_loudness',
] as const;

test('accepts every allowed observation cue', () => {
  assert.deepEqual(parseModelCues({ cues: cues.slice(0, 3) }, 3), { cues: cues.slice(0, 3) });
});

for (const cue of cues) {
  test(`accepts a single ${cue} cue`, () => {
    assert.deepEqual(parseModelCues({ cues: [cue] }, 1), { cues: [cue] });
  });
}

const invalidCueOutputs: [string, unknown, number][] = [
  ['unknown cue', { cues: ['tree'] }, 1],
  ['duplicate cues', { cues: ['outline_shape', 'outline_shape'] }, 2],
  ['wrong cue count', { cues: ['outline_shape'] }, 2],
  ['too many cues', { cues: ['outline_shape', 'outline_edge', 'brightness_contrast', 'brightness_change'] }, 4],
  ['non-array cues', { cues: 'outline_shape' }, 1],
  ['missing cues', {}, 1],
  ['extra fields', { cues: ['outline_shape'], title: 'invented text' }, 1],
  ['null output', null, 1],
];

for (const [name, value, expectedCount] of invalidCueOutputs) {
  test(`rejects ${name} in model cues`, () => assert.throws(() => parseModelCues(value, expectedCount)));
}

test('renders every cue to fixed conditional wording', () => {
  assert.deepEqual(renderCueActivity({ cues: [...cues] }), {
    title: 'Notice shape and light and sound',
    steps: [
      'If an outline is visible, notice its shape.',
      'If an outline is visible, notice where its edge begins and ends.',
      'If light and shadow are visible, notice their contrast.',
      'If brightness changes across a visible area, notice the transition.',
      'If a sound is already audible, notice its rhythm.',
      'If a sound is already audible, notice its loudness.',
    ],
  });
});

test('renders a sound-only title without inventing a source', () => {
  assert.deepEqual(renderCueActivity({ cues: ['sound_loudness'] }), {
    title: 'Listen nearby',
    steps: ['If a sound is already audible, notice its loudness.'],
  });
});
