# Evidence and limits

The [measurement record](evidence/task-5.md) preserves all three model runs,
including failures and per-case desk scores. The final prompt passes the
12-case software pilot; that is not an estimate of future reliability.
The baseline matches its usable-card count and is simpler. Duration and
surroundings have little effect on the generated steps.

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
