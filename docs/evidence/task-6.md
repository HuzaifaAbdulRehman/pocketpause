# Distribution and submission verification

Checked 7 October 2026 PKT. Source revision
`d7dff8894f5f403c484b6e485bf6c0286141039b` on build/pocketpause.
Later package-document changes do not alter the tested application.

A new local clone was created with git clone --no-hardlinks. It had no
node_modules or build output. npm.cmd ci --ignore-scripts --no-fund
--no-audit --offline installed 27 packages from the existing npm cache.
No credentials or runtime profiles were copied. The ignored browser path
was a junction to already downloaded Chromium. The existing local Ollama
service supplied inference. This is a clean-code/dependency-tree check,
not an untouched-machine or fresh-download test.

| Command in the clone | Result |
|---|---|
| npm.cmd run typecheck | exit 0 |
| npm.cmd test | 75/75, exit 0 |
| npm.cmd run build | exit 0, 17 transformed modules |
| npm.cmd run test:browser | 5/5, exit 0, 9.6 seconds |
| npm.cmd run smoke | exit 0, actual generated card saved, no browser errors |

The clone's real-model flow generated Outdoor Pause in Courtyard and saved
matching text. Its automatic recording is kept only in local ignored scratch;
the final real-model [demo asset](real-demo.webm) is preserved
in Git. Neither recording claims outdoor usage. Model-free tests cover
invalid input, timeouts, failed output, loading, retry, inert markup, saved
context, hostile origin/host and restricted static files.

The README's runtime source/hash and model setup reflect commands already
used locally. Archive SHA256:
`3623e256762ca89bd6fa99b0cc4106401919ce9df926411673e632e3ea287bb5`.
Fresh runtime/browser downloads were not repeated for the clone. The 8 GiB
disk allowance is a recommendation, not a peak-use measurement.

CI is defined with immutable official checkout/setup-node references,
read-only contents permission and a 15-minute Windows job limit. Its
commands mirror the local checks and never download model weights.
Package/browser installation requires network on an uncached runner.
No push or GitHub workflow run occurred; hosted behavior is unverified.

The [Week 1 rules](https://dev.to/page/hacktoberfest-week1-2026-10-05-contest-rules)
and the template linked from the [challenge](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)
were rechecked on 7 October. The local draft has the required headings and
tags. The entry deadline converts to 12 October, 11:59 AM PKT.
No sponsor-prize integration or optional agent-session embed is asserted.
Huzaifa still needs to review eligibility and the final claims, approve
public code/video links, and publish the post before that deadline.

The app meets the approved software scope. It uses actual local inference,
saves text, records all 12 combinations and a baseline, and has a real-model
browser and clean-clone check. An outdoor trial remains explicitly pending.
The submission is prepared locally, not submitted or guaranteed eligible.

The later [review and fixes](review.md) add disconnect cancellation and a
readable demo capture. Their regressions verify the changed runtime path;
unchanged dependency/setup/build evidence above is retained.
