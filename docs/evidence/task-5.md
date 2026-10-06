# PocketPause measurement record

Checked 7 October 2026 PKT. The conditional run meets the software pilot
targets. It does not prove an outdoor benefit or an advantage over the baseline.

## What ran

Three runs each unload the model, verify the empty resident-model list,
measure one cold request, then all 12 warm combinations once. No trial was
discarded. The JSON records contain inputs, prompt, schema, sampling settings,
raw responses, errors, latency and model identity:

- [Initial prompt](qwen3-1-7b-initial-2026-10-07.json): 9/12 warm valid.
- [Unknown-scene prompt](qwen3-1-7b-revised-2026-10-07.json): 11/12 valid.
- [Conditional prompt](qwen3-1-7b-conditional-2026-10-07.json): 12/12 valid.

Ollama v0.40.0; model qwen3:1.7b, Q4_K_M, 1,359,293,444 bytes;
digest `8f68893c685c3ddff2aa3fffce2aa60a30bb2da65ca488b61fff134a4d1730e7`.
The local metadata labels parameter size 2.0B; the upstream model card names
1.7B. These identifiers are recorded without resolving that discrepancy.
Node v24.13.0, Windows 10.0.19045, i5-8350U, 8 logical CPUs, 15.9 GiB RAM.

All times below are milliseconds. Scores are a subjective desk review:
context fit / no required equipment or data collection / clear instructions /
usable observation, each 1 or 0. Context fails when the text requires an
unverified specific scene feature. Usable means an accepted card offers a
clear stationary observation without that dependency. A rejected output
cannot be usable in the app. This is not a calibrated judge or field trial.

| Case | Initial ms / score | Revised ms / score | Conditional ms / score |
|---|---|---|---|
| 5 street | 7955.65 / 0100 | 10895.14 / 0110 | 12534.19 / 1111 |
| 5 terrace | 8495.34 / 0110 | 10288.88 / 0110 | 16525.32 / 1111 |
| 5 courtyard | 10309.01 / 0110 | 8223.87 / 1111 | 14448.04 / 1111 |
| 5 campus | 14802.60 / 0110 | 6979.75 / 0110 | 15138.66 / 1111 |
| 10 street | 11046.34 / 0110 | 9782.07 / 0110 | 12498.02 / 1111 |
| 10 terrace | 11980.23 / 0110 | 9926.15 / 1101 | 13242.54 / 1111 |
| 10 courtyard | 15905.09 / 0110 | 13548.60 / 0110 | 13097.93 / 1111 |
| 10 campus | 8576.66 / 0110 | 10093.16 / 0110 | 15278.36 / 1111 |
| 15 street | 12507.87 / 0110 | 9315.65 / 0110 | 14940.50 / 1111 |
| 15 terrace | 14611.11 / 0110 | 13483.91 / 0110 | 12065.72 / 1111 |
| 15 courtyard | 17289.19 / 1111 | 12176.10 / 0110 | 12916.78 / 1111 |
| 15 campus | 11906.66 / 0110 | 7972.97 / 0110 | 13034.84 / 1111 |

Cold 5/street: initial 19867.59 (0110, rejected), revised 23134.80 (0110),
conditional 27612.35 (1111). Warm maxima: 17289.19, 13548.60 and 16525.32.
Desk-usable warm cards: 1/12, 2/12 and 12/12. The fixed baseline's 12
preserved cards all pass the contract and score 1111. No baseline latency
benchmark was taken; it has no inference step.

The early runs invent glass walls, fencing, wet pavement or a particular
time of day. The revised 10/terrace card says to watch air move; its other
observations remain usable. The final cards use optional conditions, but
repeat the prompt's outline example. Temperature comparisons are awkward,
and duration/place barely affect the instructions. The baseline is clearer
and more consistent. There is no measured superiority claim.

The final prompt has temperature 0.2 and seed 42. A seed is not a promise of
identical output across hardware/runtime versions. The new format check
rejects steps that do not start with If. It is not a semantic safety proof.

## End-to-end evidence

After restarting the project-owned runtime under restricted execution,
[a registry probe failed](registry-denied-2026-10-07.json). The revised and
conditional runs still use downloaded local weights. Wi-Fi was not physically
disconnected, and no machine-wide networking settings changed.

`npm.cmd run smoke` exercised the built app with the real model, saved the
[actual card](real-card.txt), captured a [screenshot](real-flow.png) and
[video](real-demo.webm), and reported zero browser errors. The screenshot
was visually inspected. No outdoor action is represented by that recording.

Harness tests went RED against stubs, then GREEN. The unconditional courtyard
regression failed before the format change and passed afterward. The final
Node suite passes 75/75; typecheck exits 0; adapter LSP has no diagnostics.
The five controlled browser tests remain separate from this real-model run.
