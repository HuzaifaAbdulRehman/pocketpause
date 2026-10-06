# Browser flow checks

Checked 7 October 2026 PKT. Five Chromium tests pass against the built app
with controlled API responses. They cover defaults and choices, keyboard
generation, duplicate-click suppression, saving text, error recovery, old-card
context after failed regeneration, inert markup and a 320-pixel viewport.

The first run began before the browser download finished and failed to launch.
After installation, all five tests failed on missing placeholder-page controls,
before the UI was implemented. Windows shell-server teardown also hung. The
test wrapper now owns an in-process HTTP server and closes it after the tests;
the passing run exits normally. No unknown process was stopped.

Typechecking exits 0, the Vite build exits 0, and LSP reports no App diagnostics.
A default-page screenshot was captured from the built interface and inspected
for spacing, readable controls and layout. This was not a model or outdoor trial.
An invalid CSS import reported during the first UI build was removed; the
subsequent build is clean.

React and React DOM 19.3.0, their 19.3.0 types, Vite 8.3.1 and Playwright 1.63.0
were pinned after registry and deps.dev checks. The inspected direct versions
have no reported advisories and exceed seven days of release age. Package
licences on disk match MIT, except Playwright's Apache-2.0. The resolved npm
audit reports zero known vulnerabilities across 52 dependency entries.

Playwright downloaded Chromium 153.0.8010.12, revision 1243, and its helpers
into the ignored .tools/browsers directory. Everyday Chrome was not changed.
Vite's built-in TSX support avoids a separate refresh plugin. Dependencies,
model files, browser binaries, build outputs and test traces are not staged.
