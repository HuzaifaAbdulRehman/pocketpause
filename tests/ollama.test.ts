import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGenerator, GenerationError } from '../src/ollama.ts';

const request = { duration: 5 as const, surroundings: 'courtyard' as const };
const validActivity = { title: 'Notice light', steps: ['If a shadow is visible, observe it from a safe spot.'] };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function complete(activity: unknown = validActivity): Response {
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
    duration: 5, surroundings: 'courtyard', title: 'Notice light',
    steps: ['If a shadow is visible, observe it from a safe spot.'], source: 'local-ai',
  });
});

test('uses a fixed local endpoint and constrains the model request', async () => {
  const generate = createGenerator({ fetchImpl: async (url, init) => {
    assert.equal(String(url), 'http://127.0.0.1:11434/api/generate');
    assert.equal(init?.method, 'POST');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'qwen3:1.7b');
    assert.equal(body.stream, false);
    assert.equal(body.think, false);
    assert.equal(body.options.num_predict, 256);
    assert.equal(body.options.temperature, 0.2);
    assert.equal(body.options.seed, 42);
    assert.equal(body.format.additionalProperties, false);
    assert.deepEqual(body.format.required, ['title', 'steps']);
    assert.equal(body.format.properties.title.maxLength, 80);
    assert.equal(body.format.properties.steps.maxItems, 3);
    assert.equal(body.format.properties.steps.items.maxLength, 180);
    assert.ok(body.prompt.includes('10'));
    assert.ok(body.prompt.includes('terrace'));
    assert.ok(body.system.includes('stationary'));
    return complete();
  } });
  const card = await generate({ duration: 10, surroundings: 'terrace' });
  assert.equal(card.duration, 10);
  assert.equal(card.surroundings, 'terrace');
});

test('reports a missing model instead of returning a canned activity', async () => {
  const generate = createGenerator({ fetchImpl: async () => response({ error: 'model not found' }, 404) });
  await assert.rejects(generate(request), hasCode('unavailable'));
});

test('treats the scene as unknown rather than inventing its features', async () => {
  const generate = createGenerator({ fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.ok(body.system.includes('The actual scene is unknown'));
    assert.ok(body.system.includes('if visible'));
    assert.ok(body.system.includes('already audible'));
    assert.ok(body.system.includes('never assert'));
    return complete();
  } });
  await generate(request);
});

test('rejects unconditional scene descriptions from the measured failure', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({
    title: 'Observing the Courtyard',
    steps: ['Notice the shape and size of the courtyard. It is a rectangular space with a small fence around it.'],
  }) });
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
  const generate = createGenerator({ fetchImpl: async () => response({ response: JSON.stringify(validActivity), done: false }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects a response truncated by the token cap', async () => {
  const generate = createGenerator({ fetchImpl: async () => response({ response: JSON.stringify(validActivity), done: true, done_reason: 'length' }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects missing generated fields', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({ title: 'Look' }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects model attempts to change the selected duration', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({ ...validActivity, duration: 30 }) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

test('rejects a body larger than 16384 bytes', async () => {
  const generate = createGenerator({ fetchImpl: async () => new Response('x'.repeat(16385)) });
  await assert.rejects(generate(request), hasCode('invalid-output'));
});

for (const step of ['Cross the road.', 'Climb onto the roof.', 'Take a photo.', 'Record a bird.', 'Ask a stranger for directions.']) {
  test(`rejects disallowed instruction: ${step}`, async () => {
    const generate = createGenerator({ fetchImpl: async () => complete({ title: 'Observe', steps: [`If you are outside: ${step}`] }) });
    await assert.rejects(generate(request), hasCode('invalid-output'));
  });
}

test('allows safe observation text and words containing a blocked substring', async () => {
  const generate = createGenerator({ fetchImpl: async () => complete({
    title: 'Notice broad shapes', steps: ['If a window is visible, notice its outline from a stationary spot.'],
  }) });
  assert.equal((await generate(request)).title, 'Notice broad shapes');
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
  assert.equal((await generate(request)).title, 'Notice light');
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
  assert.equal((await generate(request)).title, 'Notice light');
});
