import type { StudyDesignAdvice } from "../core/six-screen/study-design-advice";
import type { SixScreenWorkflowState } from "../core/six-screen/contracts";
import { readCurrentPolicyEvidence } from "../core/six-screen/current-policy-evidence";

/** Exact v23 packet builder solely for read-only compatibility with an existing
 * completed, packet-bound critique. Do not dispatch new requests with it. */
export function screen3LegacyContextualPacket(state: SixScreenWorkflowState,
  advice: StudyDesignAdvice) {
  const evidence = readCurrentPolicyEvidence(state);
  const year = advice.proposalEcho.timing?.year ?? null;
  const dateRank = (stage: string) => ["announcement", "adoption",
    "publication", "legal_effect", "compliance", "enforcement", "amendment"]
    .indexOf(stage);
  const rankedDates = [...evidence.chronology].sort((left, right) => {
    const lYear = Number(left.date.start?.slice(0, 4));
    const rYear = Number(right.date.start?.slice(0, 4));
    const lDistance = year && Number.isFinite(lYear)
      ? Math.abs(lYear - year) : 0;
    const rDistance = year && Number.isFinite(rYear)
      ? Math.abs(rYear - year) : 0;
    return lDistance - rDistance ||
      (dateRank(left.stage) < 0 ? 10 : dateRank(left.stage)) -
        (dateRank(right.stage) < 0 ? 10 : dateRank(right.stage)) ||
      left.id.localeCompare(right.id);
  });
  const chosenDates = rankedDates.slice(0, 10);
  const dates = [...chosenDates].sort((left, right) =>
    (left.date.start ?? "9999").localeCompare(right.date.start ?? "9999") ||
    left.id.localeCompare(right.id));
  const dateClaimIds = new Set(chosenDates.flatMap(({ claimIds }) => claimIds));
  const warningRefs = new Set(advice.warnings.flatMap((warning) =>
    warning.triggerEvidenceRefs));
  const claimsRanked = [...evidence.claims].sort((left, right) => {
    const priority = (claim: typeof left) =>
      (evidence.exceptionClaimIds.includes(claim.id) ? 0
        : evidence.coverageClaimIds.includes(claim.id) ? 1
          : warningRefs.has(claim.id) ? 2
            : dateClaimIds.has(claim.id) ? 3
              : claim.support === "conflicting" ? 4
                : ["operative_change", "substantive_obligation",
                    "previous_baseline", "historical_version_change",
                    "contemporaneous_amendment_record"].includes(claim.predicate)
                  ? 5 : 6);
    return priority(left) - priority(right) ||
      left.id.localeCompare(right.id);
  });
  const selected: typeof claimsRanked = [];
  let sourceBytes = 0;
  for (const claim of claimsRanked) {
    if (selected.length >= 20) break;
    const bytes = new TextEncoder().encode(JSON.stringify(claim)).byteLength;
    // Select whole propositions. Long source passages remain in Screen 2,
    // with omitted counts disclosed rather than a misleading sentence cut.
    if (selected.length && sourceBytes + bytes > 45_000) continue;
    selected.push(claim);
    sourceBytes += bytes;
  }
  const selectedIds = new Set(selected.map(({ id }) => id));
  const dated = dates.map((item) => {
    const claim_ids = item.claimIds.filter((id) => selectedIds.has(id));
    const linked = selected.filter(({ id }) => claim_ids.includes(id));
    return {
      id: item.id, label: item.label, stage: item.stage,
      date: item.date.start, end: item.date.end,
      precision: item.date.precision, qualification: item.qualification,
      claim_ids,
      source_ids: [...new Set(linked.map(({ sourceId }) => sourceId))],
      document_version_ids: [...new Set(linked.map(({ documentVersionId }) =>
        documentVersionId))],
      conflict_claim_ids: item.conflictIds.filter((id) => selectedIds.has(id)),
    };
  }).filter(({ claim_ids }) => claim_ids.length > 0);
  const claims = selected.map((item) => ({
    id: item.id, kind: item.predicate, support: item.support,
    statement: item.statement, qualification: item.qualification,
    source_id: item.sourceId, source_title: item.sourceTitle,
    source_url: item.sourceUrl, source_role: item.sourceRole,
    passage_id: item.passageId,
    document_version_id: item.documentVersionId,
    version_label: item.versionLabel,
  }));
  return {
    task: "screen-03-contextual-critique-v2",
    fingerprint: advice.adviceFingerprint,
    study: advice.proposalEcho,
    timing: advice.proposalEcho.timing,
    clarifications: advice.clarifications,
    policy: { title: state.confirmedShock?.officialTitle ?? null,
      episode: evidence.episode, evidence_status: evidence.status,
      chronology_origin: evidence.chronologyOrigin,
      snapshot_fingerprint: evidence.evidenceSnapshotFingerprint,
      dated, claims,
      coverage_claim_ids: evidence.coverageClaimIds.filter((id) =>
        selectedIds.has(id)),
      exception_claim_ids: evidence.exceptionClaimIds.filter((id) =>
        selectedIds.has(id)),
      requirements: evidence.requirements.filter(({ kind }) => [
        "coverage", "exemption", "temporal_stage", "implementation",
        "operative_change", "previous_baseline", "version",
      ].includes(kind)),
      unresolved: evidence.unresolved.slice(0, 4),
      omitted: { dated: evidence.chronology.length - dated.length,
        claims: evidence.claims.length - claims.length,
        coverage_or_exception: evidence.coverageClaimIds.filter((id) =>
          !selectedIds.has(id)).length,
        unresolved: Math.max(0, evidence.unresolved.length - 4),
        selection_rule: "Source-dated milestones nearest proposed timing, then complete coverage, exception, concern-linked, dated and conflicting propositions within a 45 kB source packet; omitted propositions remain in saved Screen 2 evidence.",
      } },
    eligible_options: advice.options.map((option) => ({
      id: option.optionId, label: option.label,
      applicability: option.applicability,
      assumptions: option.assumptions.slice(0, 4),
      references: option.referenceIds,
    })),
    current_concerns: advice.warnings.map((item) => ({
      rule_id: item.ruleId, basis: item.basis ?? "empirical_requirement",
      severity: item.severity, title: item.message,
      reason: item.whyItMatters, check: item.whatToCheck,
      evidence_refs: item.triggerEvidenceRefs,
      method_refs: item.methodReferenceIds,
    })),
  };
}
