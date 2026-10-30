# Architecture

ShockAudit consists of a React workspace, a Cloudflare Worker, and a Durable Object that serves the MCP interface and persists workflow state. The current workspace follows the six-screen journey described in the [operating manual](OPERATING-MANUAL.md).

## Components

| Location | Responsibility |
| --- | --- |
| `src/ui/six-screen/` | Current workspace, navigation, diagrams, and report presentation. |
| `src/core/six-screen/` | Workflow contracts, validation, design records, evidence relationships, and exports. |
| `src/worker/six-screen-workflow-runtime.ts` | Saved operations, source work, model execution, and workflow transitions. |
| `src/worker/server.ts` | MCP tools, transport contracts, authentication boundaries, and runtime construction. |
| `src/worker/index.ts` | Worker routing, readiness checks, assets, and Durable Object integration. |
| Other `src/core/`, `src/ui/`, and `src/worker/` modules | Shared services and retained tool and state compatibility. |

## Evidence and interpretation

Source adapters retrieve bounded official records and permitted documentary material. A source's role, identity, retrieval status, and relevant text remain separate from a model's interpretation. The source register describes implemented operations and configuration requirements; an adapter declaration alone does not establish that a route succeeded for a study.

OpenAI Responses API requests run on the server for study-specific design advice, event interpretation, and mechanism work. Fixed code validates the returned structure and its binding to the saved inputs before committing a result. Citation suggestions remain research leads unless the underlying work has been checked. See [source integrations](SOURCE-ADAPTERS.md) and the [evidence policy](EVIDENCE-POLICY.md).

## State and execution

The Durable Object retains workflow records, task checkpoints, model receipts, and execution accounting. Revisions, operation identities, and input fingerprints prevent an old response or repeated action from silently replacing a newer decision. Recovery uses saved state and receipts where the relevant contract permits it.

The UI receives validated projections rather than server credentials. Source credentials and the OpenAI key stay server-side. The standard evidence workflow does not require a dataset upload. Any optional data-assisted path has its own input and computation boundaries.

## Build and delivery

Vite builds the browser assets and TypeScript checks the source contracts. Artifact verifiers enforce the module graph, permitted output files, release identities, and size budgets. `wrangler.jsonc` binds the existing Worker to its assets and Durable Object. Build labels and the source commit identify the delivered bundle.

Changing documentation must not require a new UI resource or a change to runtime flags. Build-watch exclusions must be checked separately because a repository push can otherwise trigger deployment. See [deployment](DEPLOYMENT.md).

## Compatibility

Previously published resource URIs, tool names, serialized contracts, and earlier workflow modules remain registered where saved sessions require them. A module's age or version number is not sufficient reason to remove it.

The retained Screen 3 acquisition contract permits four additional bounded HTTPS document attempts to fill three usable document-text slots. The production runtime has no model-backed document converter. Unsupported PDF extraction remains an explicit limitation rather than invented document text. These compatibility bounds are covered by existing contract tests and do not describe an additional screen in the current journey.

See [testing](TESTING.md) for regression and live-verification boundaries.
