import { uniquePolicyBriefingSections } from "../../core/six-screen/policy-presentation";
import type { SixScreenWorkflowState, PolicyBriefingSection } from
  "../../core/six-screen/contracts";
import type { Screen6CurrentPlan } from
  "../../core/six-screen/screen6-current-plan";
import { screen6NamedEventOccurrences, screen6RetainedEventInvestigation,
  screen6StateWithEventSource } from
  "../../core/six-screen/screen6-current-plan";
import type { Screen6DesignMapProjection } from
  "../../core/six-screen/screen6-design-map";
import { currentStudyDesignAdvice, currentStudyDesignSelection } from
  "../../core/six-screen/study-design-advice";
import { currentStudyFirstMechanismRunForState } from
  "../../core/six-screen/workflow";
import type { StudyFirstSuggestedCitation } from
  "../../core/six-screen/study-first-mechanism-comparison";
import { screen5ProposedDirectionLabel } from "./screen5-presentation";
import type { Screen3ContextualCritique } from
  "../../worker/screen3-contextualizer";
import type { StudyFirstEventInvestigationWorkspace } from
  "../../worker/six-screen-workflow-runtime";

export type CompleteReportBlock = {
  title?: string;
  label?: string;
  text?: string;
  bullets?: string[];
  chain?: string[];
  references?: string[];
  tone?: "normal" | "note";
  fields?: Array<{ label: string; value: string }>;
  table?: { columns: string[]; rows: string[][]; widths?: number[] };
  timeline?: { date: string; label: string; detail: string };
  numbered?: string[];
};
export type CompleteReportSection = {
  number: string;
  title: string;
  subtitle: string;
  blocks: CompleteReportBlock[];
  figure?: boolean;
};
export type CompleteReportReference = {
  key: string;
  citation: string;
  url: string | null;
  note?: string;
};
export type CompleteReport = {
  title: string;
  generatedAt: string;
  study: Array<{ label: string; value: string }>;
  sections: CompleteReportSection[];
  references: CompleteReportReference[];
  designMap: Screen6DesignMapProjection;
};

const prose = (value: string | null | undefined) => (value ?? "")
  .normalize("NFKC").replace(/\s+/gu, " ").trim();
const policyProse = (value: string) => prose(value)
  .replace(/^\[\s*/u, "").replace(/^(?:\([a-z]+\)\s*)+/iu, "");
const unique = (values: string[]) => [...new Set(values.map(prose).filter(Boolean))];
const list = (label: string, values: string[]): CompleteReportBlock[] =>
  values.length ? [{ label, bullets: unique(values) }] : [];

/** Content-only export from the same saved facts that supply Screens 2–6.
 * No source query, model request, decision or diagnostic is performed here. */
export function createCompleteReport(input: {
  state: SixScreenWorkflowState;
  plan: Screen6CurrentPlan;
  designMap: Screen6DesignMapProjection;
  eventWorkspace?: StudyFirstEventInvestigationWorkspace;
  generatedAt?: string;
}): CompleteReport {
  const { state, plan, designMap } = input;
  const references: CompleteReportReference[] = [];
  const referenceByIdentity = new Map<string, string>();
  function reference(citation: string, url: string | null,
    category: "P" | "E" | "L" | "M", note?: string) {
    const identity = `${category}|${url || prose(citation).toLocaleLowerCase()}`;
    const previous = referenceByIdentity.get(identity);
    if (previous) return previous;
    const key = `${category}${references.filter((item) => item.key[0] === category).length + 1}`;
    references.push({ key, citation: prose(citation), url, ...(note ? { note } : {}) });
    referenceByIdentity.set(identity, key);
    return key;
  }
  const review = state.policyReview?.identityFingerprint ===
      state.confirmedShock?.identityFingerprint &&
      state.policyReview?.artifactStatus !== "archived"
    ? state.policyReview : null;
  const claimSources = new Map((review?.claims ?? []).map((claim) => [
    claim.claimId,
    reference(claim.citation.sourceTitle || "Official policy document",
      claim.citation.canonicalUrl || null, "P"),
  ]));
  const policyRefs = (ids: string[]) => unique(ids.flatMap((id) =>
    claimSources.has(id) ? [claimSources.get(id)!] : []));
  const shockBlocks: CompleteReportBlock[] = [];
  const policy = state.confirmedShock;
  if (policy) {
    shockBlocks.push({ title: policy.officialTitle },
      { label: "Institution", text: unique([policy.issuer, policy.issuingJurisdiction]).join(" · ") },
      { label: "Instrument and episode", text: unique([policy.instrumentType, policy.episode, policy.versionScope]).join(" · ") });
    if (policy.formalIdentifiers.length) shockBlocks.push({
      label: "Official identifiers", text: policy.formalIdentifiers.join("; "),
    });
  }
  const briefing = review?.briefing;
  if (briefing) {
    shockBlocks.push({ title: "Policy episode overview", text: policyProse(briefing.overview),
      references: policyRefs(briefing.overviewClaimIds) });
    function briefingBlocks(section: PolicyBriefingSection) {
      shockBlocks.push({ title: section.title });
      if (section.findings?.length) {
        for (const finding of section.findings) shockBlocks.push({
          label: finding.label, text: policyProse(finding.text),
          references: policyRefs(finding.claimIds),
        });
      } else for (const paragraph of section.paragraphs) shockBlocks.push({
        text: policyProse(paragraph), references: policyRefs(section.claimIds),
      });
    }
    for (const section of uniquePolicyBriefingSections([
      briefing.whatChanged, briefing.coverage, briefing.enforcement,
    ])) if (section.findings.length) briefingBlocks(section);
    shockBlocks.push({ title: "Policy timeline" });
    for (const milestone of briefing.timeline) shockBlocks.push({
      timeline: { date: `${milestone.date.start ?? "Date not established"}${milestone.date.end ? `–${milestone.date.end}` : ""}`,
        label: milestone.label, detail: policyProse(milestone.statement) },
      references: policyRefs(milestone.claimIds ?? [milestone.claimId]),
      ...(milestone.qualification ? { bullets: [milestone.qualification] } : {}),
    });
    if (briefing.laterTimeline?.length) {
      shockBlocks.push({ title: "Later policy stages outside the study window" });
      for (const milestone of briefing.laterTimeline) shockBlocks.push({
        timeline: { date: milestone.date.start ?? "Date not established",
          label: milestone.label, detail: policyProse(milestone.statement) },
        references: policyRefs(milestone.claimIds ?? [milestone.claimId]),
      });
    }
  } else {
    for (const claim of plan.upstream.policyEvidence.claims) {
      if (claim.decision === "rejected") continue;
      shockBlocks.push({ text: policyProse(claim.effectiveStatement ?? claim.statement),
        references: [reference(claim.sourceTitle || "Policy evidence",
          claim.sourceUrl || null, "P")] });
    }
    if (!shockBlocks.length) shockBlocks.push({ text: "The shock briefing has not been saved." });
  }

  const methodBlocks: CompleteReportBlock[] = [
    { title: "Study context", fields: [
      { label: "Population", value: state.study.population ?? "Not stated" },
      { label: "Observation unit", value: state.study.analysisUnit ?? "Not stated" },
      { label: "Geography", value: state.study.geography.join("; ") || "Not stated" },
      { label: "Industry", value: state.study.industry.join("; ") || "Not stated" },
      { label: "Study period", value: `${state.study.period.start ?? "?"}–${state.study.period.end ?? "?"}` },
      { label: "Policy-side construct", value: state.study.policySideConcept ?? "Not stated" },
      { label: "Selected comparison", value: plan.study.selectedComparison ?? "A comparison has not been selected." },
      { label: "Proposed treatment", value: state.study.proposedTreatment ?? "Not stated" },
      { label: "Proposed comparison", value: state.study.proposedComparison ?? "Not stated" },
      { label: "Treatment timing", value: designMap.comparison.timing },
      { label: "Outcome target", value: designMap.comparison.outcomeTarget },
    ] },
    ...(state.study.initialExplanation ? [{ label: "Proposed explanation", text: state.study.initialExplanation }] : []),
  ];
  const critique = plan.upstream.designCritique as Screen3ContextualCritique | null;
  if (Array.isArray(critique?.concerns) && critique.concerns.length) {
    methodBlocks.push({ title: "Study-specific methodological assessment" });
    for (const concern of critique.concerns) {
      if ("specific_heading" in concern) methodBlocks.push({
        title: concern.specific_heading, fields: [
          { label: "Relevant fact or proposal", value: concern.relevant_fact_or_proposal },
          { label: "Why it matters", value: concern.why_it_matters },
          { label: "Open question", value: concern.unresolved_question },
          { label: "Next check", value: concern.next_check },
          { label: "Interpretation limit", value: concern.check_limit },
        ], references: policyRefs(concern.documentary_claim_ids),
      });
      else methodBlocks.push({ title: "Design concern", text: concern.study_specific_reason },
        { label: "Known from sources", text: concern.known_from_sources,
          references: policyRefs(concern.documentary_claim_ids ?? []) },
        { label: "Open question", text: concern.unresolved_question },
        { label: "Next check", text: concern.next_check });
    }
  }
  const advice = currentStudyDesignAdvice(state);
  if (advice?.warnings.length) {
    methodBlocks.push({ title: "Methodological alerts" });
    for (const [index, warning] of advice.warnings.entries()) methodBlocks.push({
      title: `${index + 1}. ${warning.message}`, fields: [
        { label: "Why it matters", value: warning.whyItMatters },
        { label: "What to check", value: warning.whatToCheck },
      ], references: policyRefs(warning.triggerEvidenceRefs),
    });
  }
  const decision = currentStudyDesignSelection(state)?.decision;
  const options = decision?.mode === "selected"
    ? advice?.options.filter((item) => item.optionId === decision.optionId) ?? []
    : advice?.options ?? [];
  if (options.length) methodBlocks.push({ title: "Conditional method guidance" });
  for (const option of options) methodBlocks.push(
    { title: option.label, text: option.whyThisAppears },
    { label: "Proposed contrast", text: option.proposedContrast },
    { label: "Target effect", text: option.effectTarget },
    ...list("Assumptions", option.assumptions),
    ...list("Data required", option.dataNeeds),
    ...list("Inference considerations", option.inferenceNotes),
    ...list("Unresolved design issues", unique([...option.unknowns, ...option.incompatibilities])),
  );

  const eventBlocks: CompleteReportBlock[] = [];
  const eventSource = input.eventWorkspace?.retainedSource ?? input.eventWorkspace;
  const eventState = eventSource ? screen6StateWithEventSource(state, eventSource) : state;
  const investigation = screen6RetainedEventInvestigation(eventState);
  const occurrences = screen6NamedEventOccurrences(investigation);
  const savedAssessments = eventSource?.investigation?.snapshotId === investigation?.snapshotId
    ? eventSource?.interpretationQueue?.results ?? [] : [];
  const analyzedEvents = occurrences.flatMap((occurrence) => {
    const analysis = investigation?.analyses.find((item) => item.eventId === occurrence.id);
    return analysis ? [analysis] : [];
  });
  function sharedEventNotes(field: "requiredExposureAssumptions" | "uncertainties" | "nextChecks") {
    if (analyzedEvents.length < 2) return [];
    return unique(analyzedEvents[0]![field]).filter((note) =>
      analyzedEvents.every((analysis) => analysis[field].some((value) => prose(value) === note)));
  }
  const commonAssumptions = sharedEventNotes("requiredExposureAssumptions");
  const commonLimits = sharedEventNotes("uncertainties");
  const commonChecks = sharedEventNotes("nextChecks");
  if (plan.upstream.otherEvents?.contextFit &&
      plan.upstream.otherEvents.contextFit !== "current") eventBlocks.push({
    text: plan.upstream.otherEvents.contextFit === "same_study_earlier_scan"
      ? "These named events and assessments come from an earlier saved scan. The latest scan retained no names; review the earlier leads before treating them as current competing explanations."
      : "These event leads were retained under an earlier study or comparison. Their applicability to the present design needs reassessment.", tone: "note",
  });
  if (!occurrences.length) eventBlocks.push({
    text: !investigation || ["planned", "running"].includes(investigation.status)
      ? "The Screen 4 source investigation has not finished. No no-event conclusion can be drawn; finish or resume its saved source scan to include named events in this report."
      : investigation.status === "failed"
        ? "The Screen 4 scan could not be completed. No conclusion about the absence of concurrent events is available."
        : "No qualifying named event was retained in the completed Screen 4 scan. This does not establish that the study has no competing events.",
    tone: "note",
  });
  if (occurrences.length) eventBlocks.push({ title: "Event review at a glance",
    table: { columns: ["Potential concurrent event", "Timing", "Assessment"], widths: [0.48, 0.2, 0.32],
      rows: occurrences.map((event) => [event.title,
        event.typedDates.map((date) => date.value).join("; ") || "Unresolved",
        savedAssessments.some((item) => item.eventId === event.id) ? "Saved study-specific assessment"
          : investigation?.analyses.some((item) => item.eventId === event.id)
            ? "Source-bounded assessment" : "Named lead; assessment pending"]) } });
  for (const [index, occurrence] of occurrences.entries()) {
    const analysis = investigation?.analyses.find((item) => item.eventId === occurrence.id);
    const savedAssessment = savedAssessments.find((item) => item.eventId === occurrence.id);
    const refs = unique(occurrence.evidence.map((evidence) => reference(
      evidence.title || occurrence.title, evidence.locator || null, "E")));
    eventBlocks.push({ title: `${index + 1}. ${occurrence.title}`, fields: [
      { label: "Event timing", value: occurrence.typedDates.map((date) =>
        `${date.kind.replaceAll("_", " ")}: ${date.value}`).join("; ") || "The occurrence date has not been established." },
      { label: "What happened", value: savedAssessment?.documentedChange || analysis?.whatHappened || occurrence.description },
      ...(savedAssessment ? [
        { label: "Saved assessment", value: savedAssessment.outcomePathway },
        { label: "Next check", value: savedAssessment.nextCheck },
      ] : []),
    ], references: refs });
    if (analysis) eventBlocks.push(
      { label: "Source-bounded screening context", fields: [
        { label: "Relevance", value: analysis.whyRelevant },
        { label: "Potential pathway", value: analysis.outcomePathway },
        { label: "Comparison implication", value: analysis.comparisonImplication },
        { label: "Timing interpretation", value: analysis.temporalInterpretation },
      ] },
      ...list("Exposure assumptions to examine", analysis.requiredExposureAssumptions.filter((note) => !commonAssumptions.includes(prose(note)))),
      ...list("Limits of the assessment", unique([
        ...(analysis.materialUncertainty ? [analysis.materialUncertainty] : []),
        ...analysis.uncertainties.filter((note) => !commonLimits.includes(prose(note)))])),
      ...(analysis.nextChecks.filter((note) => !commonChecks.includes(prose(note))).length
        ? [{ label: "Event-specific checks", numbered: unique(analysis.nextChecks.filter((note) => !commonChecks.includes(prose(note)))) }] : []),
    );
    else if (!savedAssessment) eventBlocks.push({ label: "Assessment", text: "This named event remains a lead; its relationship to the proposed comparison has not been assessed.", tone: "note" });
  }
  if (commonAssumptions.length || commonLimits.length || commonChecks.length) eventBlocks.push(
    { title: "Common source-bounded assessment notes",
      text: "These conditions and limits recur across the assessed event leads and are recorded once here." },
    ...list("Shared exposure assumptions", commonAssumptions),
    ...list("Shared assessment limits", commonLimits),
    ...(commonChecks.length ? [{ label: "Shared next checks", numbered: commonChecks }] : []),
  );

  const mechanismBlocks: CompleteReportBlock[] = [];
  const run = currentStudyFirstMechanismRunForState(state);
  const planning = run?.planning?.plan;
  const comparison = run?.providerExecution?.comparison;
  const inspectedReferences = new Map((run?.providerExecution?.evidencePacket?.entries ?? []).map((entry) => {
    const citation = `${entry.authors.join(", ")} (${entry.publicationYear ?? "Year not recorded"}). ${entry.title}. ${entry.publicationVenue ?? "Venue not recorded"}.`;
    const key = reference(citation, entry.stableLocators.find((url) => /^https?:\/\//iu.test(url)) ?? null,
      "L", "Scholarly abstract inspected. Support is limited to the proposition stated in the retained abstract.");
    return [entry.evidenceId, key] as const;
  }));
  function cite(citations: StudyFirstSuggestedCitation[] | undefined) {
    return (citations ?? []).map((citation) => reference(citation.fullCitation,
      citation.stableUrl || (citation.doi ? `https://doi.org/${citation.doi}` : null),
      "L", `ChatGPT-suggested bibliographic lead; not independently verified. Supports: ${citation.supportScope}`));
  }
  function assessedBlocks(candidateId: string) {
    const mechanism = comparison?.mechanisms.find((item) =>
      item.candidateId === candidateId || item.relation === "focal" && candidateId === "m0");
    if (mechanism) {
      mechanismBlocks.push({ label: "Assessed pathway", chain: mechanism.chain });
      for (const argument of mechanism.argument) mechanismBlocks.push({
        label: argument.basis === "inspected_proposition" ||
            argument.supportStatus === "source_linked"
          ? "Inspected proposition" : argument.basis === "study_transfer"
            ? "Fit to this study" : "Analytical hypothesis",
        text: argument.text,
        references: unique(argument.evidenceIds.flatMap((id) =>
          inspectedReferences.has(id) ? [inspectedReferences.get(id)!] : [])),
      });
      if (mechanism.direction) mechanismBlocks.push({ label: "Conditional outcome implication",
        text: `${mechanism.direction.outcomeImplication.replaceAll("_", " ")} · ${mechanism.direction.condition}` });
      mechanismBlocks.push({ label: "Contextual fit", text: mechanism.fit },
        { label: "Material limit", text: mechanism.limit });
    }
    const disposition = comparison?.dispositions?.find((item) => item.candidateId === candidateId);
    if (disposition) mechanismBlocks.push({ label: "Assessment disposition",
      text: `${disposition.status.replaceAll("_", " ")}: ${disposition.reason}` });
  }
  const focal = plan.upstream.mechanisms.finalizedFocal;
  mechanismBlocks.push({ title: "Main mechanism", text: focal?.originalText ??
    "A main mechanism has not been finalized." });
  const focalRefs = cite(planning?.focalSuggestedCitations);
  if (focalRefs.length) mechanismBlocks.push({ label: "Scholarly citation",
    text: planning!.focalSuggestedCitations!.map((item) => `(${item.citationLabel})`).join("; "), references: focalRefs });
  assessedBlocks("m0");
  if (planning) {
    mechanismBlocks.push({ title: "Alternative mechanisms",
      text: planning.conceptualQuestion });
    if (planning.candidates.length) mechanismBlocks.push({
      title: "Competing pathways at a glance", table: {
        columns: ["Mechanism", "Directional proposal", "Assessment"], widths: [0.43, 0.28, 0.29],
        rows: planning.candidates.map((candidate) => [candidate.conceptLabel,
          candidate.proposedDirection?.scenarios.length
            ? `${unique(candidate.proposedDirection.scenarios.map((item) => item.sign)).join(" / ")} · conditional`
            : "Under-specified",
          comparison?.dispositions?.find((item) => item.candidateId === candidate.id)?.status.replaceAll("_", " ")
            ?? "Provisional hypothesis"]),
      },
    });
    const sharedConditions = new Set([
      `Population: ${state.study.population}`,
      `Unit: ${state.study.analysisUnit ?? "unresolved"}`,
      `Period: ${state.study.period.start}–${state.study.period.end}`,
    ]);
    if (planning.candidates.some((candidate) => candidate.contextualConditions
        .some((condition) => sharedConditions.has(condition)))) mechanismBlocks.push({
      label: "Study scope shared by the mechanisms", fields: [
        { label: "Population", value: state.study.population ?? "Not stated" },
        { label: "Observation unit", value: state.study.analysisUnit ?? "Unresolved" },
        { label: "Period", value: `${state.study.period.start}–${state.study.period.end}` },
      ],
    });
    for (const [index, candidate] of planning.candidates.entries()) {
      mechanismBlocks.push({ title: `${index + 1}. ${candidate.conceptLabel}` },
        { label: "Proposed pathway", chain: candidate.processNodes },
        { fields: [
          { label: "Actor", value: candidate.actor },
          { label: "Distinctness", value: candidate.distinctionFromFocal },
        ] },
        ...list("Material conditions", unique([
          ...(candidate.condition ? [candidate.condition] : []),
          ...candidate.contextualConditions.filter((condition) => !sharedConditions.has(condition))])),
        { label: "Directional hypothesis", text: screen5ProposedDirectionLabel(
          candidate.proposedDirection, true, { outcome: state.study.outcome, measure: state.study.outcomeMeasure }) },
      );
      for (const scenario of candidate.proposedDirection?.scenarios ?? []) mechanismBlocks.push({
        label: "Reason for the proposed direction", text: scenario.rationale,
      });
      if (candidate.proposedDirection?.missing_assumption) mechanismBlocks.push({
        label: "Premise required", text: candidate.proposedDirection.missing_assumption,
      });
      const refs = cite(candidate.suggestedCitations);
      if (refs.length) mechanismBlocks.push({ label: "Scholarly citation", text:
        candidate.suggestedCitations!.map((item) => `(${item.citationLabel})`).join("; "), references: refs });
      const needs = planning.evidenceNeeds.filter((item) => item.candidateId === candidate.id);
      mechanismBlocks.push(...list("Evidence to examine", needs.map((item) => item.propositionToInvestigate)));
      assessedBlocks(candidate.id);
    }
    if (!planning.candidates.length) mechanismBlocks.push({ text: "This generation retained no distinct alternative mechanism." });
    if (planning.supplementaryAccounts.length) {
      mechanismBlocks.push({ title: "Boundary conditions and other accounts" });
      for (const account of planning.supplementaryAccounts) mechanismBlocks.push({
        label: account.label, text: account.explanation,
      });
    }
  } else if (plan.upstream.mechanisms.proposals.length) {
    for (const [index, candidate] of plan.upstream.mechanisms.proposals.entries()) mechanismBlocks.push(
      { title: `${index + 1}. ${candidate.concept}`, chain: candidate.chain },
      { label: "Condition", text: candidate.condition },
      { label: "Distinctness", text: candidate.distinction },
    );
  }
  if (comparison?.predictions.length) {
    mechanismBlocks.push({ title: "Observations that could distinguish the mechanisms" });
    for (const prediction of comparison.predictions) {
      mechanismBlocks.push({ label: prediction.observation,
        text: `Measure: ${prediction.measure}. Level: ${prediction.level}. Timing: ${prediction.timing}.` });
      for (const pattern of prediction.patterns) {
        const mechanism = comparison.mechanisms.find((item) => item.id === pattern.mechanismId);
        mechanismBlocks.push({ label: mechanism?.concept ?? "Mechanism implication", text: pattern.detail });
      }
      mechanismBlocks.push({ label: "Interpretation limit", text: prediction.caution });
    }
  }

  const designBlocks: CompleteReportBlock[] = [];
  for (const panel of designMap.panels) designBlocks.push({ title: panel.title,
    fields: panel.rows.map((row) => ({ label: row.label, value: row.value })) });
  designBlocks.push({ title: "Key dependencies requiring attention", bullets: designMap.attention },
    { title: "Current claim boundary", text: plan.boundary.plannedTarget },
    ...list("Required assumptions", plan.boundary.requiredAssumptions),
    ...list("Claims not established", plan.boundary.unsupportedClaims),
    { label: "Next action", text: plan.boundary.nextAction },
    { title: "Prioritized research checks" });
  for (const [index, card] of plan.priorities.entries()) designBlocks.push(
    { title: `${index + 1}. ${card.label}`, text: card.reason },
    ...(card.procedure.length ? [{ label: "Practical checks", numbered: unique(card.procedure) }] : []),
    ...list("Data and prerequisites", card.prerequisites),
    ...list("Interpretation limit", card.limits.slice(0, 1)),
    ...list("Next action", card.response.slice(0, 1)),
  );

  return {
    title: policy?.officialTitle ?? plan.study.policy ?? "Natural experiment research plan",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    study: [
      { label: "Population", value: state.study.population ?? "Not stated" },
      { label: "Observation unit", value: state.study.analysisUnit ?? "Not stated" },
      { label: "Geography", value: state.study.geography.join("; ") || "Not stated" },
      { label: "Industry", value: state.study.industry.join("; ") || "Not stated" },
      { label: "Study period", value: `${state.study.period.start ?? "?"}–${state.study.period.end ?? "?"}` },
      { label: "Outcome", value: unique([state.study.outcome ?? "", state.study.outcomeMeasure ?? ""]).join(" · ") || "Not stated" },
      { label: "Policy-side construct", value: state.study.policySideConcept ?? state.study.intendedConstruct ?? "Not stated" },
      { label: "Comparison", value: designMap.comparison.method },
    ],
    sections: [
      { number: "01", title: "Shock and institutional foundation", subtitle: "Screen 2 · Policy change, formal coverage and chronology", blocks: shockBlocks },
      { number: "02", title: "Methodological assessment", subtitle: "Screen 3 · Comparison, alerts and identifying assumptions", blocks: methodBlocks },
      { number: "03", title: "Potential concurrent events", subtitle: "Screen 4 · Alternative shocks and their assessment", blocks: eventBlocks },
      { number: "04", title: "Mechanisms and competing pathways", subtitle: "Screen 5 · Main mechanism, all generated alternatives and distinguishing observations", blocks: mechanismBlocks },
      { number: "05", title: "Integrated research design", subtitle: "Screen 6 · Design map, dependencies and research checks", blocks: designBlocks, figure: true },
    ],
    references,
    designMap,
  };
}
