# Development tools

Run package commands from the repository root. `package.json` defines the supported entry points; the [testing guide](../docs/TESTING.md) explains their coverage.

| Tools | Purpose |
| --- | --- |
| `windows/` | Configure local credentials, set up dependencies, start and stop the local Worker and tunnel, and verify the Windows preview. |
| `verify-build-artifact.mjs`, `verify-local-preview-artifact.mjs`, `verify-asset-module-graph.mjs` | Check browser artifacts, asset dependencies, identities, and size limits. |
| `run-repository-check.mjs`, `run-release-test-baseline.mjs`, `check-*.mjs` | Run repository checks and validate contracts, benchmarks, and evidence packages. |
| `verify-production-branch.mjs`, `verify-live-mcp.mjs`, `verify-production-matrix.mjs` | Verify release source identity and deployed behavior. |
| `manage-actions-evidence.mjs`, `write-release-gate-evidence.mjs` | Prepare, validate, and retain bounded Actions evidence. |
| `validate-public-event-index.mjs` | Validate or update the public event index through the corresponding package command. |

Windows usage is documented in [Local preview](../docs/LOCAL-CHATGPT-PREVIEW.md). `windows/Test-ShockAudit-Preview.ps1` runs the isolated verification sequence for a specified preview commit and tree. Production releases follow [Deployment](../docs/DEPLOYMENT.md).
