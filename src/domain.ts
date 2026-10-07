export type Duration = 5 | 10 | 15;
export type Surroundings = 'street' | 'terrace' | 'courtyard' | 'campus';
export type ActivityRequest = { duration: Duration; surroundings: Surroundings };
export type ModelActivity = { title: string; steps: string[] };
export type ActivityCard = ActivityRequest & ModelActivity & { source: 'local-ai' };
export const OBSERVATION_CUES = [
  'outline_shape',
  'outline_edge',
  'brightness_contrast',
  'brightness_change',
  'sound_rhythm',
  'sound_loudness',
] as const;
export type ObservationCue = typeof OBSERVATION_CUES[number];
export type ModelCues = { cues: ObservationCue[] };

export const SAFETY_REMINDER = 'Choose a safe, permitted outdoor spot. Stay away from traffic and edges. Stop if the activity feels unsafe.';

function exactObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object.');
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error('Unexpected or missing fields.');
  }
  return value as Record<string, unknown>;
}

export function parseRequest(value: unknown): ActivityRequest {
  const input = exactObject(value, ['duration', 'surroundings']);
  if (input.duration !== 5 && input.duration !== 10 && input.duration !== 15) {
    throw new Error('Choose 5, 10 or 15 minutes.');
  }
  if (input.surroundings !== 'street' && input.surroundings !== 'terrace'
      && input.surroundings !== 'courtyard' && input.surroundings !== 'campus') {
    throw new Error('Choose one of the listed surroundings.');
  }
  return { duration: input.duration, surroundings: input.surroundings };
}

function boundedText(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max) {
    throw new Error(`Expected non-empty text of at most ${max} characters.`);
  }
  return value.trim();
}

export function parseModelActivity(value: unknown): ModelActivity {
  const activity = exactObject(value, ['title', 'steps']);
  const title = boundedText(activity.title, 80);
  if (!Array.isArray(activity.steps) || activity.steps.length < 1 || activity.steps.length > 3) {
    throw new Error('Expected one to three steps.');
  }
  return { title, steps: activity.steps.map(step => boundedText(step, 180)) };
}

export function parseModelCues(value: unknown, expectedCount: number): ModelCues {
  if (expectedCount !== 1 && expectedCount !== 2 && expectedCount !== 3) {
    throw new Error('Expected one to three cues.');
  }
  const output = exactObject(value, ['cues']);
  if (!Array.isArray(output.cues) || output.cues.length !== expectedCount) {
    throw new Error(`Expected exactly ${expectedCount} cues.`);
  }
  const parsed = output.cues.map(cue => {
    if (!OBSERVATION_CUES.includes(cue as ObservationCue)) {
      throw new Error('Unknown observation cue.');
    }
    return cue as ObservationCue;
  });
  if (new Set(parsed).size !== parsed.length) {
    throw new Error('Observation cues must be distinct.');
  }
  return { cues: parsed };
}

const cueSteps: Record<ObservationCue, string> = {
  outline_shape: 'If an outline is visible, notice its shape.',
  outline_edge: 'If an outline is visible, notice where its edge begins and ends.',
  brightness_contrast: 'If light and shadow are visible, notice their contrast.',
  brightness_change: 'If brightness changes across a visible area, notice the transition.',
  sound_rhythm: 'If a sound is already audible, notice its rhythm.',
  sound_loudness: 'If a sound is already audible, notice its loudness.',
};

export function renderCueActivity(cues: ModelCues): ModelActivity {
  const families = [
    ['shape', ['outline_shape', 'outline_edge']],
    ['light', ['brightness_contrast', 'brightness_change']],
    ['sound', ['sound_rhythm', 'sound_loudness']],
  ].filter(([, members]) => cues.cues.some(cue => (members as ObservationCue[]).includes(cue)))
    .map(([family]) => family);
  if (families.length === 0) {
    throw new Error('Expected at least one observation cue.');
  }
  const title = families.length === 1 && families[0] === 'sound'
    ? 'Listen nearby'
    : `Notice ${families.join(' and ')}`;
  return { title, steps: cues.cues.map(cue => cueSteps[cue]) };
}

export function makeCard(request: ActivityRequest, value: ModelActivity): ActivityCard {
  return { ...value, ...request, source: 'local-ai' };
}

export function formatCard(card: ActivityCard): string {
  return [
    'PocketPause', card.title, `${card.duration} minutes · ${card.surroundings}`,
    '', ...card.steps.map((step, index) => `${index + 1}. ${step}`),
    '', SAFETY_REMINDER, '', 'Generated with a local open-weight model.', '',
  ].join('\n');
}
