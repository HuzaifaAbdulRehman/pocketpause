import type { ActivityRequest, ModelActivity } from '../src/domain.ts';
export function evaluationCases(): ActivityRequest[] {
  return ([5, 10, 15] as const).flatMap(duration =>
    (['street', 'terrace', 'courtyard', 'campus'] as const).map(surroundings => ({ duration, surroundings })));
}
export function baselineFor(request: ActivityRequest): ModelActivity {
  return {
    title: `A ${request.surroundings} pause`, steps: [
      'From a safe stationary spot, notice how light falls on the surfaces around you.',
      'Let your gaze settle on one ordinary shape. Notice its outline without needing to name it.',
      ...(request.duration === 15 ? ['If you feel like staying longer, notice the quiet gaps between nearby sounds.'] : []),
    ],
  };
}
