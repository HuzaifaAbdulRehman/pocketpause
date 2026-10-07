# PocketPause cue-based generation

Written 7 October 2026 after the approved prompt-only experiments showed that
free-form Qwen3 output can invent scenery, end mid-sentence, or include a
placeholder. The goal is to keep local open-weight AI responsible for choosing
the observation focus while making the user-facing instruction deterministic.

## Problem and evidence

PocketPause does not receive a photo, microphone input, GPS position or scene
description. It sends only a duration and one broad surroundings value to the
local model. The model therefore cannot know whether trees, wind, shadows or
textures are present.

The preserved reports show the limitation:

- The original prompt copied its outline example across all 12 cases.
- The guided prompt accepted 11 of 12 warm outputs, but included clipped
  prose, invented wind or trees, and a missed `touching` instruction.
- A concise prompt accepted 6 of 12 warm outputs after stricter validation.
- A pattern prompt accepted 7 of 12 and sometimes copied `[ambient sound]`
  placeholders.

These are not solved reliably by adding more free-form prompt wording. The
fixed non-AI baseline remains the comparison, and no AI superiority claim is
made until the new design is measured.

## Scope and compatibility

The existing React UI, Node server, request fields, public `/api/activity`
response, plain-text download, loopback Ollama endpoint and error behavior stay
unchanged. No database, account, cloud service, recording, GPS or new runtime
dependency is added. Existing successful cards remain available after a failed
regeneration.

Only the internal model response changes. The model will return an exact object
with one field:

```json
{"cues":["outline_shape","brightness_contrast","sound_rhythm"]}
```

The number of cues is one for 5 minutes, two for 10 minutes and three for 15
minutes. Cues in one response must be distinct. The model has no free-form
instruction text to clip or use for invented scene details.

## Cue vocabulary and rendering

The first vocabulary is deliberately small and grounded in sensations the
person may or may not notice:

The cue-to-instruction mapping is fixed:

- `outline_shape`: If an outline is visible, notice its shape.
- `outline_edge`: If an outline is visible, notice where its edge begins and ends.
- `brightness_contrast`: If light and shadow are visible, notice their contrast.
- `brightness_change`: If brightness changes across a visible area, notice the transition.
- `sound_rhythm`: If a sound is already audible, notice its rhythm.
- `sound_loudness`: If a sound is already audible, notice its loudness.

The application maps cues to these fixed sentences and creates a short title
from the selected cue group. The title uses the first occurrence of each cue
family in order: `shape`, `light` and `sound`; a sound-only title is `Listen
nearby`, and other titles are `Notice` followed by the family names joined with
`and`. The renderer never names an object, weather,
material or sound source. It never asks the person to touch, move, record,
collect, identify people or read signs. A missing sensation is optional because
each sentence starts with `If`.

The surroundings value continues to guide which cues the model prefers, but it
does not grant facts about the place. The duration controls cue count only; it
does not create a timer or require measuring time.

## Validation and failure behavior

The adapter sends a structured schema with `additionalProperties: false`, an
exact `cues` requirement, and an enum for every allowed cue. It validates the
parsed response again because schema support is model/runtime behavior, not a
safety proof. It rejects unknown cues, duplicate cues, wrong counts, missing
fields, incomplete Ollama responses, oversized bodies, timeouts and transport
errors. It returns the existing user-facing generation error rather than a
canned activity.

The public `ActivityCard` still contains `title` and rendered `steps`, so the
browser and download do not consume model text directly. The server renders
cue-derived values as plain text. Raw model responses and rendered cards remain
in evaluation evidence.

## Evaluation and tests

Add unit tests for the cue vocabulary, count and duplicate checks, unknown cue
rejection, exact Ollama schema, and deterministic rendering. Keep existing
server, browser and security tests. The evaluation planner remains one cold
request plus three samples for each of the 12 combinations, with explicit seeds
42, 43 and 44. Each report preserves prompts, schema, settings, raw responses,
rendered cards, failures, timings and hashes for the generator, domain renderer
and evaluator sources.

Desk review scores context fit, no required equipment or collection, clear
instructions, usable stationary observation, duration fit and within-setting
variety. Compare every result with the unchanged baseline. Report reduced
wording variety as a limitation if the finite cue vocabulary causes it.

After implementation, refresh the real-model screenshot and video only if the
final evaluation supports them. Reconcile README, evaluation notes and the DEV
draft with measured results. Do not claim an outdoor trial, health benefit or
model superiority.

## Rollout and boundaries

There is no persisted model-response data or migration. The change is local to
the generator/domain boundary and keeps the browser API compatible. If the
finite cue vocabulary cannot produce enough setting or duration variety, report
that limitation rather than reintroducing free-form scene prose. Any further
change to the public API, safety model or runtime architecture requires a new
specification and approval.
