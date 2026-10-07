# Evidence and limits

The [cue-contract report](evidence/qwen3-1-7b-upgrade-cues-2026-10-07.json)
preserves one cold request and three warm samples for each of the 12
duration/setting combinations. All 37 requests returned valid cue cards. The
fixed renderer, rather than model prose, supplied the user-facing sentences.

Warm requests took 1.85–6.91 seconds, averaging 3.71 seconds. The cold
request took 16.89 seconds. The 36 warm cards produced 11 distinct rendered
step sets. Eleven of the twelve combinations repeated the same rendered steps
across all three warm seeds; only 15-minute terrace produced two variants.
That limited variety is an honest limitation of the six-cue vocabulary, not
evidence that the model understands a particular place.

The unchanged baseline still supplies 12 usable cards and remains simpler.
Manual desk review checked context fit, no required equipment or collection,
clear conditional wording, stationary observation, duration fit and
within-setting variety. The cue cards pass those software checks because each
sentence is optional and names no object or sound source. This is not an
outdoor trial, a health study or a model-superiority claim.

The earlier prompt experiments remain dated historical evidence:
[task-5](evidence/task-5.md), [baseline](evidence/qwen3-1-7b-upgrade-baseline-2026-10-07.json),
[guided](evidence/qwen3-1-7b-upgrade-guided-2026-10-07.json),
[concise](evidence/qwen3-1-7b-upgrade-concise-2026-10-07.json) and
[pattern](evidence/qwen3-1-7b-upgrade-pattern-2026-10-07.json). They document
why free-form model wording was replaced with the cue contract.

The [registry denial](evidence/registry-denied-2026-10-07.json) and subsequent
local generation support operation without model-registry access after
setup. No physical Wi-Fi-disconnection test was performed. The app's source
makes no external inference request. Installation still downloads software.

The runtime archive's SHA256 matches its pinned official release.
[Ollama v0.40.0](https://github.com/ollama/ollama/releases/tag/v0.40.0)
uses [MIT](https://github.com/ollama/ollama/blob/v0.40.0/LICENSE).
[Qwen3-1.7B](https://huggingface.co/Qwen/Qwen3-1.7B) publishes weights under
Apache-2.0; the measured [Ollama tag](https://ollama.com/library/qwen3:1.7b)
has its exact digest in each report. Runtime metadata calls it 2.0B even
though the upstream name is 1.7B. No sponsor technology is claimed.

The [verification record](evidence/task-6.md) separates a clean-code clone,
cached dependency/browser assets, controlled browser tests and actual inference.
CI is defined locally, but not pushed or run on GitHub.
