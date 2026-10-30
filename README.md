# ShockAudit - A Natural Experiment tool

ShockAudit is an AI-assisted research workspace for designing and reviewing natural experiments based on policy changes. It helps researchers identify a policy, reconstruct what changed and when, develop a causal comparison, examine concurrent events, and consider competing mechanisms. The six-screen workflow produces a source-linked design record for further research. ShockAudit supports pre-analysis decisions and documentation.

## Six-screen workflow

### 1. Your study and policy

Enter a policy name and describe the study. Review the proposed matches and confirm the exact policy instrument and episode that the later screens should investigate.

### 2. Understand the policy

Review the policy's substantive changes, timeline, formal coverage, and implementation evidence. Source links, conflicting information, and unresolved questions support a closer examination of the intervention.

### 3. Suggested Approach

Examine possible comparisons for the proposed study and select an approach for review. Six design checks help assess the assignment process, timing, exposure, comparison, and other assumptions that require further evidence.

### 4. Check other events

Find events that may overlap with the study's geography, period, population, and comparison. Assess why each event could matter and record which possibilities need further investigation.

### 5. Compare explanations

Examine the proposed mechanism alongside plausible alternative explanations. Review their causal sequences, conditional predictions, and evidence needs, with scholarly citation leads for follow-up.

### 6. Design summary

Bring the policy evidence, selected comparison, concurrent events, mechanisms, and design checks into one research record. Review the study diagram and export the complete report in PDF or Word format.

## APIs and source services

ShockAudit routes requests according to the policy jurisdiction, study scope, and available evidence. The current production version uses the following APIs and source services.

| API or source service | Purpose |
| --- | --- |
| OpenAI Responses API | Prepare plain-language policy briefings, study-specific design assessments, concurrent-event explanations, and mechanism comparisons. |
| Federal Register API | Identify U.S. federal rules and retrieve publication records and policy text. |
| GovInfo API | Locate federal statutes and retrieve official publications and historical regulatory material. |
| Congress.gov API | Resolve public-law and bill identities and retrieve text links and legislative summaries. |
| eCFR API | Inspect available historical versions of relevant U.S. regulatory provisions. |
| Regulations.gov API | Retrieve rulemaking and docket metadata and identify potentially overlapping regulatory events. |
| Open States API | Discover state bills nationwide, retrieve legislative history, and link to official state legislature records. |
| EU CELLAR / EUR-Lex | Find EU legal instruments and retrieve official metadata and text. |
| UK Legislation Atom / XML services | Find UK legislation and retrieve instrument text. |
| OpenAlex API | Retrieve scholarly-work metadata and abstract records for mechanism review. |
| Crossref REST API | Retrieve bibliographic metadata and publication records for scholarly and contextual searches. |
| GDELT DOC API | Locate supplementary explanatory documents for policy research. |
| OpenFEMA API | Find U.S. disaster declarations that may overlap with a study. |
| USGS Earthquake Catalog API | Identify earthquakes that may overlap with a study's place and period. |
| GDACS API | Find relevant hazard and disruption events for concurrent-event review. |
