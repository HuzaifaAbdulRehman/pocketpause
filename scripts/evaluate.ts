import type { ActivityRequest, ActivityCard } from '../src/domain.ts';
import { createGenerator, GenerationError } from '../src/ollama.ts';
import { baselineFor, evaluationCases } from './baseline.ts';
import { cpus, totalmem, platform, release } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Trial = { request: ActivityRequest; elapsedMs: number } &
  ({ card: ActivityCard } | { error: { code: string; message: string } });

export function evaluationTrials(samples = 1): { phase: 'cold' | 'warm'; sample: number; seed: number; request: ActivityRequest }[] {
  if (!Number.isInteger(samples) || samples < 1 || samples > 3) throw new RangeError('Use 1 to 3 samples per combination.');
  const cases = evaluationCases();
  return [{ phase: 'cold', sample: 0, seed: 42, request: cases[0] },
    ...cases.flatMap(request => Array.from({ length: samples }, (_, index) =>
      ({ phase: 'warm' as const, sample: index + 1, seed: 42 + index, request })))];
}

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
  const samples = Number(process.argv[3] ?? 1);
  const trials = evaluationTrials(samples);
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
    protocol: { samplesPerCombination: samples, expectedTrials: trials.length,
      generatorSha256: createHash('sha256').update(await readFile(new URL('../src/ollama.ts', import.meta.url))).digest('hex'),
      domainSha256: createHash('sha256').update(await readFile(new URL('../src/domain.ts', import.meta.url))).digest('hex'),
      evaluatorSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex') },
    coldBefore: before, trials: [] as unknown[],
    baseline: evaluationCases().map(request => ({ request, activity: baselineFor(request) })),
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  for (const trial of trials) {
    const { request } = trial;
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
    const result = await measureTrial(request, createGenerator({ model, seed: trial.seed, fetchImpl: captureFetch }));
    const raw = Buffer.concat(chunks).toString('utf8');
    report.trials.push({ ...trial, ...result, settings, raw, rawTruncated: truncated });
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`${trial.phase} ${request.duration}/${request.surroundings} sample ${trial.sample}: ${result.elapsedMs} ms, ${'card' in result ? 'valid' : result.error.code}`);
  }
  console.log(`Preserved evidence: docs/evidence/${name}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await evaluate();
}
