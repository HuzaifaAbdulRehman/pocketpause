import { makeCard, OBSERVATION_CUES, parseModelCues, renderCueActivity } from './domain.ts';
import type { ActivityCard, ActivityRequest, Surroundings } from './domain.ts';
import { randomInt } from 'node:crypto';

export class GenerationError extends Error {
  code: 'timeout' | 'unavailable' | 'invalid-output';
  constructor(code: 'timeout' | 'unavailable' | 'invalid-output', message: string) {
    super(message);
    this.code = code;
  }
}

const format = {
  type: 'object', additionalProperties: false, required: ['cues'],
  properties: {
    cues: {
      type: 'array', minItems: 1, maxItems: 3, uniqueItems: true,
      items: { type: 'string', enum: [...OBSERVATION_CUES] },
    },
  },
};

const system = `Choose brief optional observation cues, not descriptive prose.
The actual scene is unknown: never assert that specific objects, wildlife, plants or weather exist.
Use only outline cues if visible, brightness cues if visible, or sound cues already audible.
The fixed application wording starts with If and remains optional when a sensation is absent.
Do not explain the observation or describe its result. Do not name objects, weather or sound sources.
The person remains in a safe stationary spot. No movement, contact, equipment or data collection.
Return JSON with exactly one field, cues, containing only the allowed cue names. No other fields.`;

const settingGuidance: Record<Surroundings, string> = {
  street: 'Focus on a stationary detail nearby, without following movement or changing position.',
  terrace: 'Focus on nearby contrasts, without seeking a wider view or moving toward an edge.',
  courtyard: 'Notice relationships between whatever outlines, colours or sounds are present.',
  campus: 'Notice an ordinary detail without identifying people or reading signs.',
};

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

export function createGenerator(options: { fetchImpl?: typeof fetch; model?: string; timeoutMs?: number; seed?: number } = {}):
  (request: ActivityRequest, signal?: AbortSignal) => Promise<ActivityCard> {
  if (options.seed !== undefined && (!Number.isInteger(options.seed) || options.seed < 0 || options.seed >= 2147483648)) {
    throw new RangeError('Seed must be an integer from 0 to 2147483647.');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let nextSeed = options.seed ?? randomInt(2147483648);
  return async (request, signal) => {
    const count = request.duration / 5;
    const seed = options.seed ?? nextSeed;
    nextSeed = (nextSeed + 1) % 2147483648;
    const controller = new AbortController();
    const cancel = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const deadline = setTimeout(() => controller.abort(new GenerationError('timeout',
      'The local model took too long. Try again or choose a smaller local model.')), options.timeoutMs ?? 120000);
    try {
      if (controller.signal.aborted) throw controller.signal.reason;
      let response: Response;
      try {
        response = await fetchImpl('http://127.0.0.1:11434/api/generate', {
          method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: options.model ?? 'qwen3:1.7b', stream: false, think: false,
            system, prompt: `Choose exactly ${count} distinct cues for a ${request.surroundings} pause.
Setting guidance: ${settingGuidance[request.surroundings]}
Choose only from the six allowed cue names in the schema. Do not return title or steps.
About ${request.duration} minutes is a loose suggestion, not something to count or time.`,
            format: { ...format, properties: { ...format.properties,
              cues: { ...format.properties.cues, minItems: count, maxItems: count } } },
            options: { num_predict: 256, temperature: 0.2, seed }, keep_alive: '10m' }),
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
        const cues = parseModelCues(JSON.parse(outer.response), count);
        return makeCard(request, renderCueActivity(cues));
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        if (error instanceof GenerationError) throw error;
        throw invalidOutput();
      }
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener('abort', cancel);
    }
  };
}
