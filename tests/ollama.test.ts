import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGenerator, GenerationError } from '../src/ollama.ts';

const request = { duration: 5 as const, surroundings: 'courtyard' as const };
const validCues = { cues: ['outline_shape'] };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function complete(activity: unknown = validCues): Response {
  return response({
    model: 'qwen3:1.7b', created_at: '2026-10-06T18:00:00Z',
    response: JSON.stringify(activity), done: true, done_reason: 'stop',
    total_duration: 1000000, load_duration: 100, prompt_eval_count: 50,
    prompt_eval_duration: 100, eval_count: 20, eval_duration: 100,
  });
}

const hasCode = (code: string) => (error: unknown) =>
  error instanceof GenerationError && error.code === code;

test('returns a validated card with the original context', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete() });
  assert.deepEqual(await generate(request), {
    duration: 5, surroundings: 'courtyard', title: 'Notice shape',
    steps: ['If an outline is visible, notice its shape.'], source: 'local-ai',
  });
});

test('uses a fixed local endpoint and constrains the model request', async () => {
  let endpoint = '';
  let sent: RequestInit | undefined;
  const generate = createGenerator({ fetchImpl: async (url, init) => {
    endpoint = String(url);
    sent = init;
    return complete({ cues: ['outline_shape', 'sound_rhythm'] });
  } });
  const card = await generate({ duration: 10, surroundings: 'terrace' });
    assert.equal(endpoint, 'http://127.0.0.1:11434/api/generate');
    assert.equal(sent?.method, 'POST');
    const body = JSON.parse(String(sent?.body));
    assert.equal(body.model, 'qwen3:1.7b');
    assert.equal(body.stream, false);
    assert.equal(body.think, false);
    assert.equal(body.options.num_predict, 256);
    assert.equal(body.options.temperature, 0.2);
    assert.ok(Number.isInteger(body.options.seed) && body.options.seed >= 0 && body.options.seed < 2147483648);
    assert.equal(body.format.additionalProperties, false);
    assert.deepEqual(body.format.required, ['cues']);
    assert.deepEqual(Object.keys(body.format.properties), ['cues']);
    assert.deepEqual(body.format.properties.cues.items.enum, [
      'outline_shape', 'outline_edge', 'brightness_contrast', 'brightness_change',
      'sound_rhythm', 'sound_loudness',
    ]);
    assert.equal(body.format.properties.cues.minItems, 2);
    assert.equal(body.format.properties.cues.maxItems, 2);
    assert.ok(body.prompt.includes('10'));
    assert.ok(body.prompt.includes('terrace'));
    assert.ok(body.system.includes('stationary'));
  assert.equal(card.duration, 10);
  assert.equal(card.surroundings, 'terrace');
});

test('uses a fresh seed for each request without storing previous cards', async () => {
  const seeds: number[] = [];
  const generate = createGenerator({ fetchImpl: async (_url, init) => {
    seeds.push(JSON.parse(String(init?.body)).options.seed);
    return complete();
  } });
  await generate(request);
  await generate(request);
  assert.equal(new Set(seeds).size, 2);
});

test('allows an explicit seed for reproducible evaluation', async () => {
  const seeds: number[] = [];
  const generate = createGenerator({ seed: 123, fetchImpl: async (_url, init) => {
    seeds.push(JSON.parse(String(init?.body)).options.seed);
    return complete();
  } });
  await generate(request);
  await generate(request);
  assert.deepEqual(seeds, [123, 123]);
});

for (const seed of [-1, 2147483648, NaN, Infinity]) {
  test(`rejects invalid evaluation seed ${seed}`, () => {
    assert.throws(() => createGenerator({ seed }), RangeError);
  });
}

for (const [duration, count, steps] of [
  [5, 1, ['outline_shape']],
  [10, 2, ['outline_shape', 'sound_rhythm']],
  [15, 3, ['outline_shape', 'brightness_contrast', 'sound_rhythm']],
] as const) {
  test(`requests ${count} optional observations for ${duration} minutes`, async () => {
    let sent: RequestInit | undefined;
    const generate = createGenerator({ fetchImpl: async (_url, init) => {
      sent = init;
      return complete({ cues: steps });
    } });
    assert.equal((await generate({ ...request, duration })).steps.length, count);
    const body = JSON.parse(String(sent?.body));
    assert.equal(body.format.properties.cues.minItems, count);
    assert.equal(body.format.properties.cues.maxItems, count);
    assert.ok(!body.prompt.includes('If any outline catches your eye'));
  });
}

test('rejects a model that ignores the chosen duration guidance', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete() });
  await assert.rejects(generate({ duration: 15, surroundings: 'courtyard' }), hasCode('invalid-output'));
});

test('rejects a model that returns an unknown cue', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({ cues: ['tree'] }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects a model that returns duplicate cues', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({ cues: ['outline_shape', 'outline_shape'] }) });
  await assert.rejects(generate({ ...request, duration: 10 }), hasCode('invalid-output'));
});

test('rejects the legacy free-form response contract', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({
    title: 'Invented scene', steps: ['Look at the courtyard.'],
  }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('reports a missing model instead of returning a canned activity', async () => {
  const generate = createGenerator({ fetchImpl: async () => response({ error: 'model not found' }, 404) });
  await assert.rejects(generate(request), hasCode('unavailable'));
});

test('treats the scene as unknown rather than inventing its features', async () => {
  let system = '';
  const generate = createGenerator({ fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    system = body.system;
    return complete();
  } });
  await generate(request);
  assert.ok(system.includes('The actual scene is unknown'));
  assert.ok(system.includes('if visible'));
  assert.ok(system.includes('already audible'));
  assert.ok(system.includes('never assert'));
});

test('rejects extra fields even when the cues are valid', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({ cues: ['outline_shape'], title: 'Invented scene' }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('reports an upstream server error', async () => {
  const generate = createGenerator({ fetchImpl: async () => response({ error: 'internal error' }, 500) });
  await assert.rejects(generate(request), hasCode('unavailable'));
});

test('reports a refused connection', async () => {
  const generate = createGenerator({ fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(generate(request), hasCode('unavailable'));
});

test('rejects invalid outer JSON', async () => {
  const generate = createGenerator({ fetchImpl: async () => new Response('not JSON') });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects invalid generated JSON', async () => {
  const generate = createGenerator({ fetchImpl: async () => response({ response: 'not JSON', done: true, done_reason: 'stop' }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects a response that did not complete', async () => {
  const generate = createGenerator({ fetchImpl: async () => response({ response: JSON.stringify(validCues), done: false }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects a response truncated by the token cap', async () => {
  const generate = createGenerator({ fetchImpl: async () => response({ response: JSON.stringify(validCues), done: true, done_reason: 'length' }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects missing generated fields', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({}) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects model attempts to change the selected duration', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({ ...validCues, duration: 30 }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects a body larger than 16384 bytes', async () => {
  const generate = createGenerator({ fetchImpl: async () => new Response('x'.repeat(16385)) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('renders accepted cues without model-controlled action text', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({ cues: ['brightness_change'] }) });
  const card = await generate(request);
  assert.equal(card.title, 'Notice light');
  assert.equal(card.steps[0], 'If brightness changes across a visible area, notice the transition.');
});

test('aborts a hanging request and succeeds on the next request', async () => {
  let calls = 0;
  let aborted = false;
  const generate = createGenerator({ timeoutMs: 20, fetchImpl: async (_url, init) => {
    if (++calls === 2) return complete();
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true;
        reject(init.signal?.reason);
      }, { once: true });
    });
  } });
  await assert.rejects(generate(request), hasCode('timeout'));
  assert.equal(aborted, true);
  assert.equal((await generate(request)).title, 'Notice shape');
});

test('bounds response-body reading with the same deadline', async () => {
  let cancelled = false;
  const generate = createGenerator({ timeoutMs: 20, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
    cancel() { cancelled = true; },
  })) });
  await assert.rejects(generate(request), hasCode('timeout'));
  assert.equal(cancelled, true);
});

test('propagates caller cancellation to inference and remains reusable', async () => {
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  let calls = 0;
  let cancelled = false;
  const generate = createGenerator({ timeoutMs: 100, fetchImpl: async (_url, init) => {
    if (++calls > 1) return complete();
    entered();
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { cancelled = true; reject(init.signal?.reason); }, { once: true });
    });
  } });
  const controller = new AbortController();
  const pending = generate(request, controller.signal);
  await started;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cancelled, true);
  assert.equal((await generate(request)).title, 'Notice shape');
});
