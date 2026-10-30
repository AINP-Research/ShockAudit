# Release-evidence templates

This directory contains machine-consumed release templates and a historical artifact-storage fixture. Their paths and contents remain available to existing checks.

- `STAGE-6-*.template.*` defines retained release-control and acceptance-record shapes. Their target release identifies an earlier contract, not the current production build.
- `actions-artifact-storage-recovery-2026-09-07.json` is the frozen manifest read by `tests/scripts/actions-artifact-storage.test.ts`. It is test data, not authorization for another cleanup.

New execution results belong in bounded GitHub Actions artifacts under the [Actions evidence policy](../operations/actions-evidence.md). Current verification commands are listed in [Testing](../TESTING.md).
