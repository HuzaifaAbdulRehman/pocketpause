# PocketPause Cue Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unreliable free-form model prose with validated observation cues while keeping the public card, browser flow and local-only architecture stable.

**Architecture:** The model returns only an exact `cues` array from a six-value enum. The domain validates cue count and uniqueness, then renders fixed optional sentences and a safe title into the existing `ModelActivity` and `ActivityCard` shapes. Ollama, the Node API and React UI keep their current public interfaces.

**Tech Stack:** TypeScript, Node test runner, React, Node HTTP server, Ollama structured JSON, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-pocketpause-cue-contract-design.md`

## Global Constraints

- Keep the app local-first, account-free and bound to loopback; add no service, database, dependency, GPS, recording or cloud inference.
- Preserve the public `ActivityCard` fields, `/api/activity` response, plain-text download and current error behavior.
- Use exactly six cues: `outline_shape`, `outline_edge`, `brightness_contrast`, `brightness_change`, `sound_rhythm`, `sound_loudness`.
- Require one cue for 5 minutes, two for 10 and three for 15; cues in one response must be distinct.
- Render only fixed conditional sentences; do not trust model prose or assert unverified objects, weather, materials or sound sources.
- Preserve raw responses, rendered cards, failures, timings, model identity and source hashes in evaluation evidence.
- Do not push, publish, submit or change external accounts.

## Review Focus

- Unknown, duplicate or wrong-count cues must fail closed rather than produce a card. Test in the domain parser and adapter.
- A model response with extra fields or a valid-looking old `title` and `steps` object must not bypass the cue contract. Test exact object validation in the adapter.
- A cue sentence must remain optional and stationary when its sensation is absent. Test every renderer mapping and the forbidden-action vocabulary by inspecting fixed output.
- A 5, 10 or 15-minute request must control cue count without changing the public context. Test all three counts and API response compatibility.
- Timeouts, malformed JSON and caller cancellation must release the generator and preserve existing server/UI recovery. Reuse the existing adapter and server regressions.

---

### Task 1: Add cue parsing and deterministic rendering

**Files:**
- Modify: `src/domain.ts`
- Test: `tests/domain.test.ts`

**Interfaces:**
- Produces `ObservationCue`, `ModelCues`, `parseModelCues(value: unknown, expectedCount: number): ModelCues`, and `renderCueActivity(cues: ModelCues): ModelActivity`.
- Keeps `ModelActivity`, `parseModelActivity`, `makeCard`, `formatCard` and `ActivityCard` compatible for the API and UI.

- [ ] **Step 1: Write failing parser tests**

Add tests for every allowed cue, exact object keys, unknown cue rejection,
duplicate rejection, wrong counts 1/2/3, non-array values and extra fields.
Add renderer assertions for all six fixed sentences and a title that contains
only the approved cue-derived wording.

- [ ] **Step 2: Run the focused domain tests**

Run: `node --test tests/domain.test.ts`

Expected: the new parser and renderer tests fail because the cue interfaces do
not yet exist; existing public-card tests continue to identify the unchanged
contract.

- [ ] **Step 3: Implement the cue boundary**

Define the literal cue tuple and type. `parseModelCues` must use the existing
exact-object helper, accept only the six strings, require the supplied count
from 1 through 3, and reject duplicates. `renderCueActivity` maps each cue to
the exact sentence in the spec. Derive the title from first-seen cue families
in order (`shape`, `light`, `sound`): use `Listen nearby` for sound alone,
otherwise use `Notice` plus the family names joined with `and`. Do not use
model text for the title.

- [ ] **Step 4: Run the focused domain tests**

Run: `node --test tests/domain.test.ts`

Expected: all domain tests pass, including the new cue parser and renderer
cases.

- [ ] **Step 5: Commit the domain boundary**

```powershell
git add src/domain.ts tests/domain.test.ts
git commit -m "Add validated observation cues"
```

### Task 2: Switch the Ollama adapter to cues

**Files:**
- Modify: `src/ollama.ts`
- Test: `tests/ollama.test.ts`

**Interfaces:**
- Consumes `parseModelCues` and `renderCueActivity` from `src/domain.ts`.
- Keeps `createGenerator(options)` and its returned `(request, signal?) => Promise<ActivityCard>` signature unchanged.

- [ ] **Step 1: Update fixtures and write failing adapter tests**

Change successful Ollama fixtures to return `{"cues":[...]}`. Assert the
structured schema has only `cues`, the six-value enum, and request-specific
minimum and maximum counts. Add failures for unknown, duplicate and wrong-count
cues and for the old free-form `title`/`steps` response. Keep timeout,
unavailable, body-limit, abort and server-response tests.

- [ ] **Step 2: Run the focused adapter tests**

Run: `node --test tests/ollama.test.ts`

Expected: the new cue tests fail against the current free-form adapter while
the unchanged transport regressions show their existing behavior.

- [ ] **Step 3: Implement cue-only generation**

Replace the free-form response schema and prompt with the exact cue object.
Keep the local endpoint, model, seed behavior, timeout, bounded body reader,
caller cancellation and error mapping. Pass the expected cue count to
`parseModelCues`, render the result with `renderCueActivity`, and build the
existing card. Remove model-text phrase checking from this path because no
model prose is accepted; fixed renderer text remains covered by domain tests.

- [ ] **Step 4: Run the focused adapter tests**

Run: `node --test tests/ollama.test.ts`

Expected: all adapter tests pass, including rejection of legacy free-form
responses and acceptance of the exact cue contract.

- [ ] **Step 5: Commit the adapter**

```powershell
git add src/ollama.ts tests/ollama.test.ts
git commit -m "Generate activities from observation cues"
```

### Task 3: Verify integration and measure the candidate

**Files:**
- Modify: `scripts/evaluate.ts`
- Verify: `src/server.ts`, `src/App.tsx`, `tests/server.test.ts`, `tests/browser.spec.ts`, `tests/eval.test.ts`
- Create: `docs/evidence/qwen3-1-7b-upgrade-cues-2026-10-07.json`

**Interfaces:**
- Consumes the unchanged public `ActivityCard` from the adapter.
- Produces a 37-trial report: one cold request and three warm samples for all 12 combinations, using seeds 42, 43 and 44.

- [ ] **Step 1: Run integration tests before changing them**

Run: `npm.cmd test`

Expected: any remaining fixtures that depend on the old adapter contract are
identified; server and browser behavior must remain unchanged after fixture
updates.

- [ ] **Step 2: Update only contract-dependent fixtures**

Adjust server and evaluator stubs to use rendered `ActivityCard` responses. Add
`domainSha256` beside `generatorSha256` and `evaluatorSha256` so the report
identifies the renderer that produced every card.
Do not weaken request validation, browser assertions, cancellation checks or
the saved-card regressions.

- [ ] **Step 3: Run the full model-free verification**

Run: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build`, and
`npm.cmd run test:browser`.

Expected: 0 failures, clean typecheck, successful production build and all
browser regressions passing.

- [ ] **Step 4: Run the repeated local-model evaluation**

Run: `npm.cmd run evaluate -- qwen3-1-7b-upgrade-cues-2026-10-07.json 3`

Expected: the report preserves every trial, raw response and failure. Review
all 12 combinations with the stated desk rubric, compare against the unchanged
baseline, and record cue variety, duration fit, latency and any remaining
weaknesses. Do not call an accepted card usable without desk review.

- [ ] **Step 5: Commit the verified runtime and evidence**

Stage only the changed source, tests and the completed report after the
contribution checkpoint confirms scope and claims.

### Task 4: Refresh final media and submission documents

**Files:**
- Modify: `README.md`, `docs/evaluation.md`, `docs/demo.md`, `docs/dev-submission.md`, `.superpowers/upgrade-progress.md`
- Refresh: `docs/evidence/real-flow.png`, `docs/evidence/real-demo.webm`, `docs/evidence/real-card.txt` only after final code and evaluation pass

**Interfaces:**
- Consumes the final measured report, current built app and actual smoke output.
- Produces a local DEV-ready package with no claim of outdoor trial, health benefit, model superiority or publication.

- [ ] **Step 1: Run the real smoke flow on the final build**

Run: `npm.cmd run smoke`

Expected: a real local card, matching download, screenshot, video and zero
browser errors. Inspect the screenshot and verify the video decodes and shows
the final cue-rendered card.

- [ ] **Step 2: Reconcile documentation and draft claims**

Replace stale free-form evaluation claims with the cue report’s actual counts,
latencies and limitations. Keep historical reports dated. Confirm the DEV
template headings, tags, links and `published: false` state.

- [ ] **Step 3: Run prose and link checks**

Run the humanize mechanical checks on changed public prose, `git diff --check`,
and the existing local link/media checks. Correct factual drift without adding
new public URLs.

- [ ] **Step 4: Commit the final local package**

Stage only reconciled docs and final media after the contribution checkpoint,
verification-before-completion review and final code review. Do not push or
publish.
