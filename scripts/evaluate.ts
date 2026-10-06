import type { ActivityRequest, ActivityCard } from '../src/domain.ts';
import { createGenerator, GenerationError } from '../src/ollama.ts';
import { baselineFor, evaluationCases } from './baseline.ts';
import { cpus, totalmem, platform, release } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Trial = { request: ActivityRequest; elapsedMs: number } &
  ({ card: ActivityCard } | { error: { code: string; message: string } });

export async function measureTrial(request: ActivityRequest, generate: (request: ActivityRequest) => Promise<ActivityCard>, now = performance.now.bind(performance)): Promise<Trial> {
  const start = now();
  try {
    const card = await generate(request);
    return { request, elapsedMs: Math.round((now() - start) * 100) / 100, card };
  } catch (error) {
    return { request, elapsedMs: Math.round((now() - start) * 100) / 100,
      error: { code: error instanceof GenerationError ? error.code : 'unexpected',
        message: error instanceof Error ? error.message : 'Unknown error' } };
  }
}

async function local(path: string, init?: RequestInit) {
  const response = await fetch(`http://127.0.0.1:11434${path}`, { ...init, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Ollama metadata request failed: ${response.status}`);
  return await response.json();
}

async function evaluate() {
  const name = process.argv[2];
  if (!name || !/^[a-z0-9-]+\.json$/.test(name)) throw new Error('Supply a new evidence filename, such as qwen3-1-7b-2026-10-07.json');
  const output = new URL(`../docs/evidence/${name}`, import.meta.url);
  const model = process.env.POCKETPAUSE_MODEL ?? 'qwen3:1.7b';
  const tags = await local('/api/tags');
  const identity = tags.models.find((entry: { name: string }) => entry.name === model);
  if (!identity) throw new Error(`Download ${model} before evaluating.`);
  const version = await local('/api/version');
  const details = await local('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
  await local('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, keep_alive: 0, stream: false }) });
  const before = await local('/api/ps');
  if (before.models.some((entry: { name: string }) => entry.name === model)) throw new Error('Model still loaded; cold measurement would be misleading.');
  const report = {
    checkedAt: new Date().toISOString(), model: { name: model, digest: identity.digest, bytes: identity.size, details: details.details },
    runtime: version, environment: { node: process.version, platform: platform(), release: release(),
      cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: Math.round(totalmem() / 2 ** 30 * 10) / 10 },
    coldBefore: before, trials: [] as unknown[],
    baseline: evaluationCases().map(request => ({ request, activity: baselineFor(request) })),
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  for (const [index, request] of [evaluationCases()[0], ...evaluationCases()].entries()) {
    const chunks: Uint8Array[] = [];
    let captured = 0;
    let truncated = false;
    let settings: unknown;
    const captureFetch: typeof fetch = async (url, init) => {
      settings = JSON.parse(String(init?.body));
      const response = await fetch(url, init);
      if (!response.body) return response;
      return new Response(response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          const keep = Math.min(chunk.length, 16384 - captured);
          if (keep > 0) chunks.push(chunk.slice(0, keep));
          captured += keep;
          if (keep < chunk.length) truncated = true;
          controller.enqueue(chunk);
        },
      })), { status: response.status, headers: response.headers });
    };
    const result = await measureTrial(request, createGenerator({ model, fetchImpl: captureFetch }));
    const raw = Buffer.concat(chunks).toString('utf8');
    report.trials.push({ phase: index === 0 ? 'cold' : 'warm', ...result, settings, raw, rawTruncated: truncated });
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`${index === 0 ? 'cold' : 'warm'} ${request.duration}/${request.surroundings}: ${result.elapsedMs} ms, ${'card' in result ? 'valid' : result.error.code}`);
  }
  console.log(`Preserved evidence: docs/evidence/${name}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await evaluate();
}
