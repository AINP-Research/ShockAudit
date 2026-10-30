# Source integrations

The current six-screen workflow combines official-source retrieval with server-side OpenAI assessments. Routes depend on the confirmed policy, jurisdiction, study scope, available credentials, and operation-specific capability checks. This guide describes implemented routes; it is not a guarantee that every provider is accessible for every request.

## Current workflow

| Service | Main role | Implementation reference |
| --- | --- | --- |
| OpenAI Responses API | Design advice, concurrent-event interpretation, and mechanism planning and comparison. | `screen5-openai-transport.ts`, `screen5-openai-provider.ts`, `six-screen-workflow-runtime.ts` |
| Federal Register | Federal rule identity, publication metadata, published text, and overlapping policy discovery. | `screen02-connectors.ts`, `screen02-federal-register-acquisition.ts` |
| GovInfo | Public-law name discovery, official publication retrieval, and bounded related-event search. | `screen01-govinfo-statute-discovery.ts`, `screen04-govinfo-event-search.ts` |
| Congress.gov | Exact law-to-bill identity, text representations, and attributed legislative summaries. | `screen01-congress-statute-identity.ts`, `screen02-complementary-evidence-acquisition.ts` |
| eCFR | Bounded point-in-time regulatory metadata and text. | `screen02-ecfr-history-acquisition.ts` |
| Regulations.gov | Administrative records, docket binding, and overlapping rulemaking candidates. | `screen02-regulations-gov-acquisition.ts`, `screen04-regulations-gov-event-search.ts` |
| Open States | Nationwide state-bill discovery, legislative history, and official legislature locators. | `openstates-bills.ts`, `screen01-identity-resolution.ts`, `screen04-study-first-investigation.ts` |
| EU CELLAR / EUR-Lex | EU instrument metadata and identity-bound document text. | `screen02-global-connectors.ts`, `official-document-html.ts` |
| UK Legislation | Bounded Atom title search and matching instrument text. | `screen02-global-connectors.ts`, `official-document-html.ts` |
| GDELT DOC | Supplementary policy-document discovery; a returned lead requires separate inspection. | `contextual-discovery.ts`, `screen02-complementary-evidence-acquisition.ts` |
| OpenFEMA | U.S. disaster declarations relevant to concurrent-event review. | `screen02-connectors.ts`, `screen04-study-first-investigation.ts` |
| GDACS | Bounded hazard-event discovery for supported study geographies. | `screen02-global-connectors.ts`, `screen04-study-first-investigation.ts` |

Implementation filenames in the table are under `src/worker/`. Reviewed official state, agency, and explanatory pages also supply evidence through controlled document retrieval; these are document routes rather than additional search APIs. A retained public event index accelerates matching but does not establish unrestricted jurisdictional coverage.

## Credentials and capability

The OpenAI and Open States credentials are `OPENAI_API_KEY` and `OPENSTATES_API_KEY`. GovInfo, Congress.gov, and Regulations.gov use their respective server-side credentials where required. No credential belongs in the UI, source text, example reports, or repository.

`src/worker/six-screen-source-register.ts` defines operations and permitted hosts. `src/worker/six-screen-source-capability-probes.ts` checks selected operation-shaped requests. Configuration, enablement, a successful probe, and successful study-specific retrieval are distinct states.

## Retained and inactive routes

The current OpenAI mechanism-plan contract requires a citation lead for the focal mechanism and each alternative. When those citations are present, `screen05-study-first-mechanism.ts` returns before the OpenAlex and Crossref retrieval operations. They are therefore omitted from the README's normal-workflow API table. Their adapters remain for older or incomplete-plan paths, including bibliographic discovery. USGS and older contextual-source routes also remain in compatibility modules rather than the current study-first event executor.

LegiScan, Tavily, and Brave are declared capability placeholders without implemented adapters in the source register. Groq is no longer the current reasoning backend. None is presented as an active service in the front-page table. These documentation distinctions do not remove or reconfigure any runtime code.

## Source boundaries

Metadata identifies records and guides retrieval. Operative policy claims require the appropriate inspected text or exact authoritative field. Administrative docket metadata is not controlling legal text. EU metadata does not establish national transposition; a UK catalog result does not establish commencement or historical completeness. Hazard occurrence does not establish organization-level exposure.

See the [evidence policy](EVIDENCE-POLICY.md) for claim support and the [architecture](ARCHITECTURE.md) for execution and persistence.
