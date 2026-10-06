# Card validation and export checks

Checked 6 October 2026 on Windows with Node 24.13.0 and npm 11.6.2.
This records the first code slice, not a working outdoor app.

- Initial node --test tests/domain.test.ts: exit 1, missing src/domain.ts.
  The tests were written first. This was an import failure because the
  module did not exist, not an assertion-level regression experiment.
- After implementation: the same command exits 0, 40 tests pass.
  Cases include all 12 selector combinations, invalid fields/types, title
  and step boundaries, Unicode code points, request context and export.
- npm.cmd run typecheck: exit 0, TypeScript 5.9.3.
- LSP diagnostics: no reported diagnostics for domain.ts or its test file.
  The static test finder returned no match; the explicit domain test file
  was used. An empty static match is not evidence of missing tests.
- npm.cmd audit --json: exit 0, no reported vulnerabilities in the
  three resolved development packages. This is not a guarantee of safety.

Pinned development dependencies are TypeScript 5.9.3 and @types/node
24.13.6, resolved from the public npm registry with lifecycle scripts off.
The lockfile records undici-types 7.18.2 as the only transitive package.
Public deps.dev reports completed for the two direct packages, with no
known direct advisories. Source/registry metadata records Apache-2.0 for
TypeScript and MIT for the types packages.

No model has been downloaded or evaluated. The browser, server, outdoor
trial and clean-clone setup are still pending.
