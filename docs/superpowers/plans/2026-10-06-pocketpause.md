# PocketPause Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans
> for native execution, or superpowers:subagent-driven-development if
> Huzaifa chooses that method. Track steps with the checkboxes below.

Goal: build a local outdoor-activity generator and an honest DEV entry package.

Architecture: React calls a loopback Node HTTP server. That server validates
two selectors, requests constrained JSON from local Ollama, and returns a
validated card. Model files and browser downloads are never committed.

Tech stack: Node 24.13.0, TypeScript, React, Vite, Node's test runner and
Playwright for browser checks. No Express, database or hosted API.

Spec: [approved design](../specs/2026-10-06-pocketpause-design.md).
Huzaifa approved the spec and this plan on 6 October 2026, choosing native
execution. Work is on build/pocketpause; main remains unchanged.

## Global constraints

- 5, 10 or 15 minutes; street, terrace, courtyard or campus.
- Default to 5 minutes and courtyard.
- Title at most 80 characters; one to three steps, each at most 180.
- One generation at a time; abort at 120 seconds and allow recovery.
- Warm generation target: within 60 seconds, measured on this laptop.
- Evaluate all 12 input combinations; target 12 valid and at least 10 usable.
- Save plain text; require no recording, photos, typing, tracking or lists.
- No runtime fallback that presents canned content as generated AI.
- No push, publishing, spending, public deployment or account changes.
- Complete before 12 October 2026 at 11:59 AM PKT.
- Use meaningful local commits, subjects at most 50 characters, no attribution
  trailers. Humanize prose and run the oss checkpoint for each commit.
- Approved project-code licence: MIT.
  Third-party software and model licences remain separate.
- Resolve exact supported dependency versions before installation, record
  inspected metadata, pin them in package.json and commit package-lock.json.
  Package/version validation and lockfile review happen at first installation.

## Review focus

1. Unexpected selector fields or wrong types must not reach inference.
2. Timeout, disconnection and concurrent requests must release the busy gate.
3. Changing selectors before a failed regeneration must not relabel the old card.
4. Model text containing markup must remain inert in the UI and download.
5. Cross-origin requests, oversized bodies and file traversal must be rejected.

Each condition has an owning test below. These are test targets, not results.

## Files and interfaces

- src/domain.ts: input/card types, validators and plain-text export.
- src/ollama.ts: local model request, prompt, deadline and response validation.
- src/server.ts: HTTP routes, busy gate and safe built-asset serving.
- src/main.tsx, src/App.tsx, src/styles.css: selectors, activity and status UI.
- tests/domain.test.ts, tests/ollama.test.ts, tests/server.test.ts:
  Node tests using controlled dependencies, not a running model.
- tests/browser.spec.ts: browser interactions and downloads.
- scripts/evaluate.ts, scripts/baseline.ts, tests/eval.test.ts:
  actual model measurement and the fixed non-AI comparison.
- scripts/dev.mjs: launch loopback API and Vite, stop owned child processes.
- package.json, package-lock.json, tsconfig.json, vite.config.ts,
  playwright.config.ts, index.html, .gitignore: local build/test setup.
- README.md, LICENSE, docs/demo.md, docs/outdoor-trial.md,
  docs/submission.md, docs/evaluation.md: setup and submission package.
- docs/evidence/: dated raw measurements, outputs and test summaries.
- .github/workflows/check.yml: offline unit/build/browser verification
  definition only. No workflow is run on GitHub without a push approval.

Use erasable server TypeScript and explicit .ts imports. Node executes the
server/tests directly; tsc checks types and Vite builds the React interface.
Do not add a TypeScript runtime transpiler.

Shared public types:

~~~ts
type Duration = 5 | 10 | 15;
type Surroundings = 'street' | 'terrace' | 'courtyard' | 'campus';
type ActivityRequest = { duration: Duration; surroundings: Surroundings };
type ModelActivity = { title: string; steps: string[] };
type ActivityCard = ActivityRequest & ModelActivity & { source: 'local-ai' };
~~~

Define these in src/domain.ts; later tasks import them rather than redefining.

## Task 1: validate and export an activity

Files: src/domain.ts, tests/domain.test.ts and the package/TypeScript setup.

Interfaces produced:
parseRequest(value: unknown): ActivityRequest;
parseModelActivity(value: unknown): ModelActivity;
makeCard(request: ActivityRequest, value: ModelActivity): ActivityCard;
formatCard(card: ActivityCard): string.

- [ ] Write tests before implementation. Include these exact boundaries:

~~~ts
assert.deepEqual(parseRequest({ duration: 5, surroundings: 'courtyard' }),
  { duration: 5, surroundings: 'courtyard' });
assert.throws(() => parseRequest({ duration: '5', surroundings: 'courtyard' }));
assert.throws(() => parseRequest({ duration: 5, surroundings: 'roof' }));
assert.throws(() => parseRequest({ duration: 5, surroundings: 'street', url: 'x' }));
assert.throws(() => parseModelActivity({ title: 'x'.repeat(81), steps: ['Look.'] }));
assert.throws(() => parseModelActivity({ title: 'Look', steps: ['x'.repeat(181)] }));
~~~

  Also assert rejection of null, arrays, empty/whitespace strings, zero/four
  steps, wrong step types and extra model fields; acceptance at 80/180.
  Export must contain duration, surroundings, every step and the safety
  reminder. Keep model markup as plain text, not a document.
- [ ] Run node --test tests/domain.test.ts; confirm missing implementation
  makes it fail. Setup only the tools needed to run this task.
- [ ] Implement the four functions and types without a validation dependency.
- [ ] Rerun the focused tests and typecheck. Expected: zero failures/errors.
- [ ] Complete the checkpoint and commit: Validate and export activity cards.

## Task 2: local inference with visible failures

Files: src/ollama.ts and tests/ollama.test.ts.

Consumes: Task 1 types and validators.
Produces createGenerator(options: { fetchImpl?: typeof fetch;
model?: string; timeoutMs?: number }): (request: ActivityRequest) =>
Promise<ActivityCard>. Endpoint is fixed at 127.0.0.1:11434/api/generate.
GenerationError extends Error exposes code: 'timeout' | 'unavailable' |
'invalid-output'. The server maps these without inspecting message text.

- [ ] Write tests that inspect the request: stream false, think false,
  title/steps JSON schema, selected context and Qwen3-1.7B candidate.
  A valid mock response returns makeCard(request, parsed response).
  Assert rejection of non-200 status, missing model, invalid JSON,
  truncated completion, excessive response size and unsafe action wording.
  Assert the corresponding GenerationError code. Cap upstream bodies at
  16384 bytes and output generation at 256 tokens.
  An injected short deadline must abort a hanging fetch; never wait 120
  seconds in unit tests. Assert no canned-success response on any failure.
- [ ] Run node --test tests/ollama.test.ts and observe failure first.
- [ ] Implement with built-in fetch, bounded response reading and the
  120000 ms default deadline. Prompt for stationary, permitted observation,
  no equipment, wildlife requirement, recordings, exertion or routes.
  Limit obvious unsafe action phrases, but document semantic limits.
- [ ] Run the focused tests and typecheck. Expected: zero failures/errors.
- [ ] Checkpoint and commit: Generate activities with local inference.

## Task 3: a loopback HTTP boundary

Files: src/server.ts and tests/server.test.ts.

Consumes: ActivityRequest, ActivityCard and the generator from Task 2.
Produces createAppServer(options: { generate: (request: ActivityRequest) =>
Promise<ActivityCard>; distDir: string }): import('node:http').Server.
Direct server execution listens on 127.0.0.1:3000.

- [ ] Write HTTP tests on ephemeral loopback ports. POST /api/activity
  returns a card; malformed input is 400, a concurrent request is 409,
  inference failure is 502 and a deadline is 504. Completion or failure
  must allow the next request. Never return upstream stack traces.
  Errors have the JSON shape { error: string }. Reject a foreign Origin/Host
  with 403, non-JSON content with 415 and bodies over 2048 bytes with 413.
  Reject traversal attempts. Serve only the built index/assets, not source,
  model files, .git or evidence files. Unmatched API routes are 404.
- [ ] Run node --test tests/server.test.ts; confirm initial failures.
- [ ] Implement the server with Node HTTP/fs/path and a bounded body
  reader. Use finally to release the inference gate. Permit local CLI
  requests with no Origin, but reject foreign browser origins.
- [ ] Rerun the focused tests and typecheck. Expected: zero failures/errors.
- [ ] Checkpoint and commit: Serve activities on a loopback endpoint.

## Task 4: select, generate and save in the browser

Files: UI/build/dev files listed above and tests/browser.spec.ts.

Consumes: POST /api/activity returning ActivityCard.
Produces the visible selector/card/download flow and a single-start local
development command. Production start serves the Vite build via Task 3.

- [ ] Add browser tests before the UI. Assert the specified defaults and
  all selector choices. Intercept the API to test loading, double-click
  suppression, clear error text, retry and saving plain text.
  After selector changes and failed regeneration, the old card must keep
  its original context and remain saveable.
  Return a markup-like title and assert it renders as text, executes no
  script and remains text in the download. Check keyboard operation and
  a narrow viewport without clipped controls or horizontal scrolling.
- [ ] Run npm.cmd run test:browser and confirm missing flow fails.
- [ ] Implement a compact labelled form, status/live region and activity
  card. Use React text rendering, a text/plain Blob and a revoked object
  URL for Save. Disable generation while busy; do not create a feed.
  Bind Vite to loopback and proxy only /api to the local Node server.
  Resolve/pin Playwright and Chromium for the required browser checks.
- [ ] Run browser tests, typecheck and build. Expected: zero failures and
  a runnable built interface. Inspect the rendered page as well.
- [ ] Checkpoint and commit: Add the outdoor activity interface.

## Task 5: measure actual inference against the baseline

Files: evaluation scripts/tests and docs/evidence/raw outputs.

Consumes: Task 1 contracts and Task 2 generator.
Produces baselineFor(request: ActivityRequest): ModelActivity and
evaluationCases(): ActivityRequest[] in scripts/baseline.ts;
scripts/evaluate.ts records each request, raw output/error, elapsed time,
model digest/settings, date and environment.

- [ ] Test that evaluationCases has exactly 12 unique combinations and
  every baseline card passes the contract. Run node --test tests/eval.test.ts
  and observe failure before implementing the harness.
- [ ] Implement the fixed non-AI baseline for comparison only, never as
  production fallback. Record failures rather than excluding them.
- [ ] Download official standalone Ollama locally after plan approval,
  if no usable runtime exists. Keep binaries/models in ignored local
  directories; use process-scoped environment values and no auto-start,
  provider settings, installer side effects or account connections.
  Record the download version/source and actual model digest.
- [ ] Measure one cold request, then all 12 warm combinations once.
  Report individual latency and the maximum, not only an average.
  Score each preserved output against the four spec criteria; mark any
  subjective assessment as a desk review, not an outdoor trial.
- [ ] If warm latency repeatedly exceeds 60 seconds or output fails the
  acceptance targets, diagnose the concrete failure and test a smaller
  local model or narrow prompt revision. Preserve original results.
  If no local option works, report the blocker; do not switch to a paid API.
- [ ] Exercise the complete built app with the real model and save one
  actual card. Record the check separately from mocked browser tests.
- [ ] Checkpoint and commit: Measure activities against a simple baseline.

## Task 6: verify distribution and prepare the submission

Files: README.md, LICENSE and the demo/trial/evaluation/submission docs;
.github/workflows/check.yml.

Consumes: measured evidence from Tasks 1-5 and the official DEV template.

- [ ] Write setup docs for the commands actually used, including model
  download, disk requirements, start/stop and recovery. Add the proposed
  MIT licence with Huzaifa's name only after this plan is approved.
- [ ] Create a clean temporary local clone of the committed app.
  Run npm.cmd ci, npm.cmd run typecheck, npm.cmd test,
  npm.cmd run build and npm.cmd run test:browser. Start the built app
  and check the real flow using the existing local runtime.
  Expected: all relevant commands exit 0 and the main flow works.
  Reuse valid evidence after prose-only edits; do not repeat model setup.
- [ ] Define CI with the same offline checks, not GPU/model downloads.
  Do not push or claim hosted CI ran. Review the actual diff using the
  playbook checklist router only after code exists; fix relevant findings.
- [ ] Prepare an outdoor checklist and a short demo shot list. Huzaifa
  chooses a permitted spot and may report his real trial; mark it pending
  until then. Demo evidence must come from the running app.
- [ ] Recheck the official template/rules, then write the DEV draft with
  What I Built, Demo, Code, How I Built It and Why Does Open Innovation
  Matter? Use devchallenge and hf26challenge. Optional agent-session and
  prize-category sections are omitted unless supported by actual work.
  State pending public links honestly; do not call the draft submitted.
- [ ] Humanize documentation and audit each factual claim against recorded
  commands/results. Complete the commit checkpoint and commit:
  Prepare the verified submission package.
- [ ] Audit the full goal requirement by requirement. Hand off the tested
  app and package with explicit publication and outdoor-trial steps.
  Do not mark completion if required software evidence is missing.

## Plan review and execution

Spec and plan approval are recorded. Huzaifa selected native execution:
implementation in this session with one fresh whole-branch review at the end.
Tasks are tracked in the plan-specific local ledger; this file does not
claim that the remaining software or measurements are complete.

## Sources checked for this plan

Checked 6 October 2026; these support the proposed runtime contracts, not
measured application behaviour:

- [Ollama Windows standalone CLI](https://docs.ollama.com/windows)
- [Ollama generation API](https://docs.ollama.com/api/generate)
- [Node 24.13 TypeScript execution](https://nodejs.org/download/release/v24.13.0/docs/api/typescript.html)
- [Vite local build tooling](https://vite.dev/guide/)
