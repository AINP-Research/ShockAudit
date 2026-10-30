# Screen 3 briefing proposal schema

Follow the current `render_screen3_briefing` input schema. Preserve the packet's exact safe run reference, packet ID, packet hash, and selected event ID.

The render envelope uses these exact versions:

- `schemaVersion`: `screen-03-briefing-render-v1`
- `skillVersion`: `screen3-shock-briefing-v1`
- `workflowVersion`: `screen3-host-native-v1`

The `content` object uses these exact camel-case fields:

- `schemaVersion`: `screen-03-host-briefing-content-v1`
- `briefingStatus`: copy the packet's `requiredBriefingStatus` exactly (`complete`, `evidence-insufficient`, or `evidence-conflicted`)
- `title`
- `oneSentenceSummary`
- `whatTheShockIs`
- `whatChanged`
- `whyItMatters`
- `whoIsAffected`
- `eligibilityThresholdsAndExemptions`
- `importantTimingAndTreatmentStages`
- `enforcementAndPenalties`
- `laterChanges`
- `plausiblePathwayToResearcherOutcome`
- `unresolvedUncertainties`
- `acknowledgedMissingEvidenceIds`
- `acknowledgedConflictIds`
- `sectionEvidenceIds`
- `conciseRationale`
- `hostModel`: `host_model_not_exposed`

## Evidence rules

- Cite only stable evidence IDs returned in the current packet.
- Copy every `missingEvidence[].missingEvidenceId` into `acknowledgedMissingEvidenceIds`; include no missing or foreign ID.
- Copy every `unresolvedConflicts[].conflictId` and each conflicted claim's `proposalId` into `acknowledgedConflictIds`; include no missing or foreign ID.
- Express unresolved uncertainty as substantive natural-language paraphrases. Do not copy a packet description merely to pass validation.
- Give each factual section its own evidence IDs; do not use a general source list as support for every statement.
- Required text fields cannot be empty. For a factual field the packet does not establish, use exactly `Not established by the bounded evidence packet.`, attach no evidence ID to that field, and explain the gap in `unresolvedUncertainties`.
- Copy `requiredBriefingStatus` exactly; do not choose or infer another status.
- Do not turn provisional or researcher-supplied material into verified evidence.

## Interpretation boundary

Begin `plausiblePathwayToResearcherOutcome` with **ChatGPT interpretation:**. Explain only a plausible theoretical channel supported by the selected event and confirmed outcome family. Do not claim that the source proves the mechanism, direction, magnitude, exogeneity, or causal validity.

Keep the rationale concise. Never include hidden chain-of-thought. The render call creates a proposal for explicit researcher review; it does not confirm or alter approved Event Card facts.
