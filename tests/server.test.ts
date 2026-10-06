import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createAppServer } from '../src/server.ts';
import { GenerationError } from '../src/ollama.ts';
import type { ActivityCard, ActivityRequest } from '../src/domain.ts';

const input = { duration: 5 as const, surroundings: 'courtyard' as const };
const card: ActivityCard = { ...input, title: 'Light', steps: ['Notice light.'], source: 'local-ai' };
const dist = await mkdtemp(join(tmpdir(), 'pocketpause-http-'));
await mkdir(join(dist, 'assets'));
await writeFile(join(dist, 'index.html'), '<h1>PocketPause</h1>');
await writeFile(join(dist, 'assets', 'app.js'), 'console.log("app")');
await writeFile(join(dist, 'private.txt'), 'not public');
after(() => rm(dist, { recursive: true, force: true }));

async function fixture(generate: (input: ActivityRequest) => Promise<ActivityCard> = async () => card) {
  const server = createAppServer({ generate, distDir: dist });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  const url = `http://127.0.0.1:${address.port}`;
  const close = () => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  });
  const post = (body: unknown = input, headers: Record<string, string> = {}) => fetch(`${url}/api/activity`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  const postHost = (host: string) => new Promise<number>((resolveStatus, reject) => {
    const request = httpRequest(`${url}/api/activity`, {
      method: 'POST', headers: { Host: host, 'Content-Type': 'application/json' },
    }, response => { response.resume(); response.once('end', () => resolveStatus(response.statusCode ?? 0)); });
    request.once('error', reject);
    request.end(JSON.stringify(input));
  });
  return { url, close, post, postHost };
}

test('returns a generated card and serves only public build files', async () => {
  const f = await fixture(async request => { assert.deepEqual(request, input); return card; });
  try {
    const response = await f.post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), card);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(await (await fetch(f.url)).text(), /PocketPause/);
    assert.match((await fetch(`${f.url}/assets/app.js`)).headers.get('Content-Type') ?? '', /javascript/);
    for (const path of ['/private.txt', '/src/server.ts', '/.git/config', '/docs/evidence/task-1.md', '/models/a', '/api/unknown']) {
      assert.equal((await fetch(f.url + path)).status, 404, path);
    }
  } finally { await f.close(); }
});

test('rejects invalid requests without calling inference', async () => {
  let calls = 0;
  const f = await fixture(async () => { calls++; return card; });
  try {
    for (const body of [null, [], { duration: '5', surroundings: 'courtyard' }, { ...input, url: 'https://example.org' }]) {
      assert.equal((await f.post(body)).status, 400);
    }
    assert.equal((await fetch(`${f.url}/api/activity`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await f.post(input, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await f.post('x'.repeat(2049))).status, 413);
    assert.equal((await f.post(input, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await f.post(input, { Origin: 'null' })).status, 403);
    assert.equal(await f.postHost('evil.example'), 403);
    assert.equal(await f.postHost('127.0.0.1:12345'), 403);
    assert.equal(calls, 0);
  } finally { await f.close(); }
});

test('allows same-origin browser requests and the next generation', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post(input, { Origin: f.url })).status, 200);
    assert.equal((await f.post()).status, 200);
  } finally { await f.close(); }
});

for (const [error, status] of [
  [new GenerationError('timeout', 'secret timeout'), 504],
  [new GenerationError('unavailable', 'secret path'), 502],
  [new GenerationError('invalid-output', 'secret text'), 502],
  [new Error('private stack trace'), 502],
] as const) {
  test(`maps ${error instanceof GenerationError ? error.code : 'unexpected error'} and releases busy`, async () => {
    let calls = 0;
    const f = await fixture(async () => { if (++calls === 1) throw error; return card; });
    try {
      const response = await f.post();
      assert.equal(response.status, status);
      const body = await response.json();
      assert.deepEqual(Object.keys(body), ['error']);
      assert.equal(typeof body.error, 'string');
      assert.doesNotMatch(body.error, /secret|private|stack/);
      assert.equal((await f.post()).status, 200);
    } finally { await f.close(); }
  });
}

test('rejects overlapping generation then releases the gate', async () => {
  let release!: (card: ActivityCard) => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  let calls = 0;
  const f = await fixture(async () => {
    if (++calls > 1) return card;
    entered();
    return await new Promise<ActivityCard>(resolve => { release = resolve; });
  });
  try {
    const pending = f.post();
    await started;
    assert.equal((await f.post()).status, 409);
    release(card);
    assert.equal((await pending).status, 200);
    assert.equal((await f.post()).status, 200);
  } finally { release?.(card); await f.close(); }
});

test('rejects encoded traversal and unsupported methods', async () => {
  const f = await fixture();
  try {
    for (const path of ['/assets/..%2Fprivate.txt', '/assets/%2e%2e%5cprivate.txt', '/assets/%00.js']) {
      assert.equal((await fetch(f.url + path)).status, 404);
    }
    assert.equal((await fetch(`${f.url}/api/activity`)).status, 405);
    assert.equal((await fetch(f.url, { method: 'POST' })).status, 405);
  } finally { await f.close(); }
});
