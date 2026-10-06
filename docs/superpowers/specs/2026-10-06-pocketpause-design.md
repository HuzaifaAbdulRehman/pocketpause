# PocketPause design

Written 6 October 2026. Conversational design approved; this written spec
awaits review. No application code or model has been installed.

## Purpose and finish line

PocketPause helps someone choose a short outdoor observation activity
without collecting data or maintaining a catalogue. Select a duration and
surroundings, generate one activity locally, then put the screen away.
A real outdoor trial is still a human action. Benefit remains a hypothesis.

Build a new repository at D:/Programming/Open_Source/pocketpause.
Keep the existing hacktoberfest-2026 research folder separate. Finish before
12 October 2026 at 11:59 AM Pakistan time. Completion means a working,
verified app, meaningful local commits and a complete submission package,
with remaining human actions stated plainly.

## The user flow

The first screen has two labelled selectors: 5, 10 or 15 minutes, and
street, terrace, courtyard or campus. These are broad surroundings, not
verified locations. Default to 5 minutes and courtyard; the user can change
both. A Generate button requests one activity.

Show a short title, up to three observation steps, the selected time and
surroundings, and a reminder to choose a safe, permitted outdoor spot.
Activities require no equipment, wildlife sightings or physical exertion.
They do not direct someone onto roads, roofs, restricted areas or into
contact with unfamiliar people. A terrace selection does not imply roof
access or permission. There is no claim that text checks guarantee safety.

Save downloads the card as a plain-text file, including its context and
the safety reminder. It works without further inference. Reading that
file elsewhere may require transferring it; the app does not install a
phone model or synchronise devices. Regenerate is optional, not a feed.

## Local architecture

Use a React and TypeScript browser interface, a small Node server and a
local Ollama runtime. Do not add Express or a database unless a concrete
requirement needs them. The server handles generation and validation;
the browser displays the resulting card and exports it.

Bind the application and model service to loopback. The browser calls
only the application's relative endpoint. The server contacts the fixed
local model endpoint, not a URL supplied by the browser. No accounts,
telemetry, location API, cloud inference or persistent activity history.

Qwen3-1.7B is the first model candidate because its published weights use
Apache-2.0 and its quantized Ollama package is small enough to investigate
on this laptop. That is not a performance claim or a sponsor requirement.
Use non-thinking mode and constrained JSON. Record the exact model
identifier and digest used for measurements. Keep model files out of Git.

## Generation and failure handling

Accept only the enumerated durations and surroundings. The model returns
a title and one to three steps. Validate types and non-empty strings, cap
the title at 80 characters and each step at 180, and reject unexpected
fields. The application supplies time and surroundings from the request;
the model cannot alter them. Render output as text, never executable HTML.

Prompt for concrete, stationary observation tasks that fit the surroundings
and require no objects or recorded evidence. Keep warnings static and
visible. Bounded output and phrase checks help reject obvious violations;
they are not a complete semantic safety test.

Allow one request at a time. Abort at 120 seconds, clear the busy state
and show a useful error. Missing runtime/model, malformed output and
connection failures must be visible. Do not substitute a canned activity
while presenting it as generated AI. Existing successful cards remain
available after a failed regeneration.

## Evidence before product claims

First prove a real inference returns a valid card on this laptop. Record
cold-start and warm latency separately. Aim for warm generation within
60 seconds. If repeated warm requests exceed that, report the problem
and evaluate a smaller local model rather than hiding the delay.

Evaluate all 12 duration/surroundings combinations against a fixed non-AI
picker. Preserve raw outputs, model settings and elapsed times. Score
context fit, no required equipment/data collection, clear instructions
and usable observation content. Target valid output for all 12 and
usable content for at least 10. Report both systems' results, including
cases where the simple baseline is better. Do not equate variation with
usefulness or claim measured health benefits.

Test input validation, output limits, rendering, download contents, busy
state and error recovery. Exercise the real browser flow and actual model,
not only mocks. Verify documented installation and build/test commands
from a clean local clone. No application build is needed for this spec.

Provide a short outdoor-trial checklist. Huzaifa chooses a safe, permitted
place and reports what happened if he tries it. Mark this pending until
he supplies real observations; never invent a trial or photographs.

## Submission and boundaries

Prepare setup instructions, a short demo plan and a DEV draft using the
official headings and tags devchallenge and hf26challenge. Explain the
local open model's role, licensing and limitations. Leave public code and
demo URLs explicitly pending until publication is authorised; the draft
must not imply a submission already exists. Include only prize categories
the finished project genuinely uses.

Exclude maps, weather, GPS, recordings, photos, journal entry, maintained
lists, notifications, paid APIs and public deployment. Do not push, publish,
submit, spend money or change account connections without approval.

## Approval state

The idea and in-chat design are approved. Next: Huzaifa reviews this spec.
Written-spec approval permits an implementation plan; he then reviews
that plan and selects the execution method before product implementation.

## Existing sources

Reuse the dated research in
D:/Programming/Open_Source/hacktoberfest-2026/week1-research.md.
The specific entry rules and official template remain authoritative:

- https://dev.to/challenges/hacktoberfest-week1-2026-10-05
- https://dev.to/page/hacktoberfest-week1-2026-10-05-contest-rules
- https://huggingface.co/Qwen/Qwen3-1.7B
- https://ollama.com/library/qwen3:1.7b
- https://docs.ollama.com/capabilities/structured-outputs
