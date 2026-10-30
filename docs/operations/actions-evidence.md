# Actions evidence

Release checks retain bounded artifacts so results can be reviewed without committing execution logs and large diagnostic collections into the repository. The authoritative limits and file allowlists are in `scripts/actions-evidence-policy.json`; `scripts/manage-actions-evidence.mjs` prepares and verifies the artifacts.

| Profile | Soft target | Hard limit | Retention |
| --- | ---: | ---: | ---: |
| Release candidate | 4 MiB | 16 MiB | 90 days |
| Browser failure diagnostics | 12 MiB | 32 MiB | 3 days |
| Explicit active browser investigation | 12 MiB | 32 MiB | 7 days |
| Repeated live MCP verification | 256 KiB | 1 MiB | 90 days |
| Production matrix | 1 MiB | 4 MiB | 90 days |

Preparation records the repository, exact commit, run, attempt, profile, file sizes, and SHA-256 digests. It rejects missing required evidence, unsafe paths, symbolic links, wrong-source evidence, and hard-limit overflow. Downloaded artifacts are checked against their stored identity and digest.

Browser evidence includes the curated screenshots and accessibility material required by the current allowlist. Live and matrix evidence retains sanitized results and case-level observations. Do not include credentials, raw research data, private workflow capabilities, full traces, dependency trees, or unnecessary browser videos.

The inventory warning is 100 MiB and its engineering ceiling is 150 MiB. Neither authorizes deletion of protected evidence or additional spending. Artifact cleanup requires the specific manifest, retained-evidence rules, and applicable authorization; this documentation cleanup does not run storage cleanup.

The older artifact-storage manifest under `docs/evidence/` remains a test fixture. Its presence is not an instruction to repeat those operations. See the [evidence directory guide](../evidence/README.md).
