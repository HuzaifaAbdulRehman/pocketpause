import { makeCard, parseModelActivity } from './domain.ts';
import type { ActivityCard, ActivityRequest } from './domain.ts';

export class GenerationError extends Error {
  code: 'timeout' | 'unavailable' | 'invalid-output';
  constructor(code: 'timeout' | 'unavailable' | 'invalid-output', message: string) {
    super(message);
    this.code = code;
  }
}

const format = {
  type: 'object', additionalProperties: false, required: ['title', 'steps'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 80 },
    steps: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 180 } },
  },
};

const system = `Make a short outdoor observation activity, in English, from a safe stationary spot.
Use only the selected surroundings, with no assumption about wildlife, plants, weather or equipment.
No walking routes, crossing roads, climbing, edges, touching, collecting, exercise, strangers, food or water.
No phone use, recording, photos, notes, tracking, timers, lists or purchases. No medical advice.
Use 1 to 3 short, concrete steps for noticing ordinary light, shapes, colours or ambient sounds.
Do not require the user to move or find anything. The duration is approximate, not something to measure.
Return only JSON with title and steps. Do not add duration or surroundings.`;

const disallowed = /\b(cross|climb|jump|run|jog|swim|touch|pick|collect|eat|drink|taste|photograph|record|write|track|timer|camera|phone|stranger|roof|ledge|traffic|road|purchase|buy)\b|\b(take|capture)\s+(a\s+)?(photo|picture)|\b(talk|speak|ask)\s+(to\s+)?(someone|anyone|a\s+person)/i;

function invalidOutput(): GenerationError {
  return new GenerationError('invalid-output', 'The local model returned an unusable activity. Try again.');
}

async function readBounded(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) throw invalidOutput();
  const reader = response.body.getReader();
  let abort: (() => void) | undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => {
      void reader.cancel().catch(() => {});
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), cancelled]);
      if (signal.aborted) throw signal.reason;
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) {
        await reader.cancel();
        throw invalidOutput();
      }
      chunks.push(value);
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(joined);
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

export function createGenerator(options: { fetchImpl?: typeof fetch; model?: string; timeoutMs?: number } = {}):
  (request: ActivityRequest) => Promise<ActivityCard> {
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (request) => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(new GenerationError('timeout',
      'The local model took too long. Try again or choose a smaller local model.')), options.timeoutMs ?? 120000);
    try {
      let response: Response;
      try {
        response = await fetchImpl('http://127.0.0.1:11434/api/generate', {
          method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: options.model ?? 'qwen3:1.7b', stream: false, think: false,
            system, prompt: `${request.duration} minutes, surroundings: ${request.surroundings}.`,
            format, options: { num_predict: 256, temperature: 0.7 }, keep_alive: '10m' }),
        });
      } catch {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw new GenerationError('unavailable', 'Start Ollama and download the configured model, then try again.');
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new GenerationError('unavailable', 'The local model is unavailable. Check Ollama and the configured model.');
      }
      try {
        const outer: unknown = JSON.parse(await readBounded(response, controller.signal));
        if (!outer || typeof outer !== 'object' || !('done' in outer) || outer.done !== true ||
          !('response' in outer) || typeof outer.response !== 'string' ||
          ('done_reason' in outer && outer.done_reason === 'length')) throw invalidOutput();
        const activity = parseModelActivity(JSON.parse(outer.response));
        if ([activity.title, ...activity.steps].some(text => disallowed.test(text))) throw invalidOutput();
        return makeCard(request, activity);
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        if (error instanceof GenerationError) throw error;
        throw invalidOutput();
      }
    } finally {
      clearTimeout(deadline);
    }
  };
}
