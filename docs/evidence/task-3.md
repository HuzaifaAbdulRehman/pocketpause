# HTTP boundary checks

The first run failed because server.ts did not exist. After implementation,
eight tests passed and the hostile Host case failed. A small wire check showed
that Node fetch replaced the supplied Host with the destination address.
That assertion now uses Node HTTP to send the actual hostile header; its
expected 403 is unchanged. No production fix was needed for that failure.

Nine HTTP tests now pass, covering valid generation, validation, concurrency,
failure recovery, origin/host rejection, size limits, methods and static paths.
Typechecking exits 0. Tests use ephemeral loopback ports and remove their
own temporary build fixtures. They do not require or measure a real model.

Only the built index and named assets are served. Model and repository files
are outside the public route allowlist. The server binds to loopback when
started directly. The UI and real-model checks are still pending.
