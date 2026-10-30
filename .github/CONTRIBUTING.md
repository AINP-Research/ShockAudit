# Contributing

## Repository layout

| Path | Contents |
| --- | --- |
| `src/` | Application, shared contracts, source adapters, and retained compatibility modules. |
| `tests/` | Unit, contract, browser, and frozen acceptance fixtures. |
| `scripts/` | Build, validation, and release utilities; Windows preview helpers in `scripts/windows/`. |
| `config/previews/` | Isolated preview profiles used by compatibility checks. |
| `docs/` | User, architecture, source, testing, and operations guides. |
| `.github/workflows/` | Automated checks and retained release workflows. |

Keep the package manifests and TypeScript, Vite, Playwright, and production Wrangler configuration at the repository root. Place platform-specific helpers and optional configurations in their respective folders. Update callers, documentation, and path resolution when moving a tool.

## Documentation

Keep `README.md` focused on the product description, one short paragraph for each of the six screens, and the APIs used by the normal workflow. Update it only when that overview, workflow, or service inventory changes.

Maintain technical guides under `docs/` and record release history through Git commits and GitHub Releases. Keep test fixtures with the checks that consume them. Preserve published resource identities, saved-state contracts, and machine-consumed schemas.

## Code and validation

Keep names and comments precise. Explain a non-obvious constraint or design choice rather than restating the code or narrating a development conversation. Make code changes for a concrete maintenance or behavior requirement and verify them with appropriate checks; do not perform broad cosmetic rewrites as part of a documentation cleanup.

Describe the resulting behavior, validation performed, and remaining limits in pull requests. Preserve source provenance and distinguish tests from live observations.

For repository maintenance, review changed paths against their callers and verify that production inputs are unchanged. Check [deployment settings](../docs/DEPLOYMENT.md) before merging into an automatically deployed branch.
