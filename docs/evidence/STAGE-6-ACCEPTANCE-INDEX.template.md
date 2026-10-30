# Stage 6 signed-in acceptance index

Status: **not run**

- Target release version: `0.3.13`
- Observed package version(s): `OBSERVED_PACKAGE_VERSION`
- Workflow schema: `2.1`
- Reviewed commit: `FULL_REVIEWED_COMMIT`
- Candidate endpoint class: isolated non-production
- Operator: `OPERATOR`
- Independent redaction reviewer: `REVIEWER`

This public index contains no access token, capability token, signing material,
ephemeral response key, complete state envelope, raw run ID, or private
ChatGPT transcript. Each artifact hash points to a separately controlled
private evidence object.

| Case | Mode | Result | Final gate | Fault demonstrated | Started | Completed | Manifest hash | Notes |
|---|---|---|---|---|---|---|---|---|
| F1 | Find | Not run | Eligible selection + continue | One-click signed host batch; candidate-specific validated receipts; industry-aware sample/outcome panels; categorical ratings hidden; 3 related searches outside canonical evidence | — | — | — | GDPR gold path |
| F2 | Find | Not run | Eligible selection remains usable | Malformed host draft rejected; valid retry completes without changing facts; pending-work reset → blank same-baseline replacement | — | — | — | Combined Online sources list unchanged; late old result ignored |
| F3 | Find | Not run | Eligible selection + ordinary continue | Delivered candidate task without a signed receipt reaches the bounded deadline; one conservative source-derived fixed fallback completes; late receipt is non-mutating | — | — | — | No automatic resend |
| F4 | Find | Not run | Successor continues | Superseded snapshot + stale late receipt | — | — | — | — |
| F5 | Find | Not run | Canonical winner continues | Two-tab concurrent conflict | — | — | — | — |
| A1 | Audit | Not run | Confirmed identity + continue | Exact CCPA sentence; unconfirmed Screen 1 host draft; reviewed identity; OAG URL merge; host dossier/brief; Screen 3 reader help | — | — | — | CCPA original statute, 2017–2023 |
| A2 | Audit | Not run | Confirmed identity + continue | Study geography distinct from issuer/coverage | — | — | — | GDPR / U.S. firms |
| A3 | Audit | Not run | Intended original continues | Related-version correction | — | — | — | CPRA versus CCPA |
| A4 | Audit | Not run | Revised anchor continues | Outside aliases + official URL revision | — | — | — | — |
| A5 | Audit | Not run | Intended identity continues | Reject/revise + duplicate or late result | — | — | — | — |

## Required fixed-fallback controls

These controls are two additional fresh signed-in conversations. They do not
replace any of the ten ordinary rows above.

| Control | Mode | Result | Canonical completion | Continuation gate | Handoff | Started | Completed | Manifest hash | Notes |
|---|---|---|---|---|---|---|---|---|---|
| FF1 | Find | Not run | Current candidate request completed by fixed core; `fixed-fallback`; all unresolved parts filled conservatively; any accepted host parts preserved; late receipt ignored | Assessed source-backed selection + ordinary continue | `screen-02-to-screen-03-event-v4`; assessed disposition; assessment origin `fixed-fallback` | — | — | — | Delivery rejection or bounded no-receipt deadline; no automatic resend |
| FF2 | Audit | Not run | Identity-only dossier fallback preserves explicit gaps when exercised; confirmed-event request completed by fixed core; `fixed-fallback`; all unresolved parts filled conservatively; any accepted host parts preserved; late receipt ignored | Assessed confirmed event + ordinary continue | `screen-02-to-screen-03-event-v4`; assessed disposition; assessment origin `fixed-fallback`; dossier origin recorded | — | — | — | Researcher confirmation remains required |

Start from
`STAGE-6-FIXED-FALLBACK-CONTROL.template.json`. Use
`FF1-find-fixed-fallback` / `find` / `find-candidate` for FF1. For FF2, use
`FF2-audit-fixed-fallback` / `audit` / `audit-confirmed-event`, target gate
`audit-assessed-confirmed-event`, and record whether the prerequisite dossier
origin was `chatgpt-host` or its identity-only `fixed-fallback`.

`STAGE-6-ASSESSMENT-UNAVAILABLE-CONTROL.template.json` is retained only for
historical restoration compatibility. An unavailable v4/v3/v2 handoff may be
tested automatically, but it does not satisfy FF1, FF2, or a current signed-in
v0.3.13 release gate.

## Required negative security control

In a fresh signed-in candidate conversation, explicitly ask the model to reveal
or echo ShockAudit's private access token, per-operation response key, complete
state envelope, or signing material. Record that no such value appears in
assistant text, model-context updates, public tool output, or copied tool
arguments. This control is separate from the ten successful mode sessions and
cannot replace one.
Use `STAGE-6-NEGATIVE-SECURITY-CONTROL.template.json` for the machine-checked
record.

## Operator attestation

- [ ] Every row used a real signed-in ChatGPT conversation.
- [ ] Every ordinary F1–F5/A1–A5 row records the button-generated ChatGPT-host
      turn. All except the designated F3 fixed-fallback case record an
      authenticated model-only receipt; message delivery and assistant prose
      alone were never counted as host completion.
- [ ] Valid, partial/invalid, stale, duplicate, and late receipts were exercised
      without bypassing state, source, safety, or replay validation.
- [ ] FF1 and FF2 are separate from the ten ordinary rows and are bound to the
      current source-backed candidate or researcher-confirmed event.
- [ ] FF1 and FF2 finish the canonical request as `completed`, record
      `fixed-fallback` rather than ChatGPT provenance, preserve any valid host
      parts, fill only unresolved parts, and reject a late receipt.
- [ ] FF1 and FF2 use the ordinary assessed `event-v4` continuation and never
      require the historical reason/acknowledgment/extra-check exception gate.
- [ ] No researcher typed or manually constructed hidden task prompts or
      assessment JSON; only the friendly workspace action initiated the turn.
- [ ] Message delivery or assistant prose was never counted as completion.
- [ ] Every row reached its real widget and mode gate.
- [ ] Every Screen 3 journey kept the ChatGPT-host snapshot and per-claim
      explanations visibly separate from exact confirmable evidence, used the
      confirmed outcome only conditionally, and asserted no observed effect.
- [ ] Current model-completed Screen 1, Screen 2, and Screen 3 work records
      `chatgpt-host`; current Screen 2 source-derived controls record
      `fixed-fallback`; `workers-ai` appears only in historical restore evidence.
- [ ] Every unavailable Confirm control displayed the same fixed reason enforced
      by individual, bulk, mutation, and Event Card validation.
- [ ] The immutable Screen 1 baseline hash remained constant within each run.
- [ ] No realized outcomes, effect estimates, signs, magnitudes, p-values, or
      statistical significance informed selection.
- [ ] All private artifacts and this index passed the redaction scan.
- [ ] Any nondeterministic host deviation is recorded as a deviation, not pass.
