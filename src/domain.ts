export type Duration = 5 | 10 | 15;
export type Surroundings = 'street' | 'terrace' | 'courtyard' | 'campus';
export type ActivityRequest = { duration: Duration; surroundings: Surroundings };
export type ModelActivity = { title: string; steps: string[] };
export type ActivityCard = ActivityRequest & ModelActivity & { source: 'local-ai' };

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
