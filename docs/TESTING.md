# Testing

Run checks from the repository root with the supported Node.js version and locked dependencies. `package.json` is the command reference.

## Local checks

| Command | Coverage |
| --- | --- |
| `npm run test:release` | Regression tests with the retained baseline in `scripts/release-test-baseline.json`. |
| `npm run build` | Browser compilation, production artifact verification, and TypeScript checks. |
| `npm run check:release-gates` | Generalization fixtures, catalog budgets, public event index, prohibited paths, and matrix-verifier contracts. |
| `npm run test:browser:list` | Browser test discovery. |
| `npm run test:browser` | Browser interaction, accessibility, restoration, and report-download checks using the configured harness. |
| `npm run check:full` | Regression, production build, and release gates. |
| `npm run audit:runtime` / `npm run audit:full` | Locked dependency audits. |

Install the supported Playwright Chromium runtime before browser execution. The Wrangler smoke and deterministic browser fixture exercise different boundaries. Keep actual runtime checks distinct from simulated host journeys.

The regression baseline explicitly records retained failures. A baseline comparison can detect a new regression; it does not turn an existing failure into a passing test. Review the actual output and any changed baseline rather than reporting only an aggregate count.

## Production verification

The `live-mcp.yml` workflow runs repeated MCP journeys and the complete 22-case production matrix after a release. Both bind their observations to the expected commit and delivered assets. The matrix distinguishes positive journeys, honest source shortfalls, and unsupported-evidence rejection.

Useful entry points are `npm run check:live`, `npm run check:production-matrix`, and `npm run check:post-deployment-acceptance`. Read each verifier's required arguments and evidence inputs before invocation. These checks call the deployed service and are separate from local unit tests.

## Frozen fixtures

The schemas under `docs/qualification/`, templates under `docs/evidence/`, and fixtures under `tests/` support regression and compatibility checks. Preserve their identities and documented limitations. Synthetic fixtures and older release templates are not fresh evidence of current product performance.

## Documentation-only verification

For a prose cleanup, check Markdown links, file references, required compatibility text, and the complete changed-file list. Verify that production source, assets, build configuration, workflows, launchers, and dependency files retain their original Git blob identities. A source-preserving documentation change does not need a new application release.

See [deployment](DEPLOYMENT.md) before merging documentation to an automatically deployed branch and [Actions evidence](operations/actions-evidence.md) for artifact retention.
