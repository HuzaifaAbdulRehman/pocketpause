# Local inference checks

Checked 6 October 2026 with Node 24.13.0. These tests use simulated Ollama
responses, not a downloaded model.

The 20 tests failed against the stub, then all passed after implementation.
They cover the fixed loopback endpoint, request settings, validated cards,
missing models, refused connections, upstream errors, malformed JSON,
truncation, oversized bodies and disallowed instructions. Separate tests
exercise timeout during fetch and a stalled response body, then retry.
Typechecking exits 0 and LSP reports no diagnostics for the adapter.

The post-code pipeline review found no repaired JSON or fabricated fallback.
Schema constraints are checked again in code. The phrase filter catches
some obvious unsafe instructions; it cannot establish that every generated
activity is safe. The user must still choose a safe, permitted spot.

No dependency changed. The previous lockfile audit still applies. Real model
quality, speed and browser use remain pending.
