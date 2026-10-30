import { fingerprintSixScreenValue } from "../../core/six-screen/canonical";
import { currentStudyFirstMechanismRunForState } from "../../core/six-screen/workflow";
import type { SixScreenWorkflowPrivateSnapshot } from "../../worker/six-screen-workflow-runtime";

/** A recovered setup checkpoint is usable before it contains an analysis.
 * Require the same study and exact submitted input/job; a changed revision
 * alone is never evidence that an interrupted operation succeeded. */
export function screen5SetupRecovered(
  before: SixScreenWorkflowPrivateSnapshot,
  after: SixScreenWorkflowPrivateSnapshot,
  mutation: Record<string, unknown>,
) {
  if (!["compare_study_first_mechanisms", "ensure_study_first_mechanism_job",
    "authorize_study_first_mechanism_job"].includes(String(mutation.action))) return false;
  if (after.runId !== before.runId || after.revision < before.revision ||
      mutation.expectedRevision !== before.revision || after.state.activeScreen !== 5 ||
      after.state.study.revision !== before.state.study.revision ||
      after.state.confirmedShock?.identityFingerprint !== before.state.confirmedShock?.identityFingerprint ||
      typeof mutation.operationId !== "string") return false;
  let prior, current;
  try {
    prior = currentStudyFirstMechanismRunForState(before.state);
    current = currentStudyFirstMechanismRunForState(after.state);
  } catch { return false; }
  if (!current) return false;
  if (mutation.action === "compare_study_first_mechanisms") {
    const expectedId = `screen5-mechanism-input-${fingerprintSixScreenValue(mutation.operationId).slice("fnv1a64:".length)}`;
    return current.input.proposedMechanism === String(mutation.proposedMechanism ?? "").trim() &&
      current.input.theoreticalPerspective === (String(mutation.theoreticalPerspective ?? "").trim() || null) &&
      (current.input.id === expectedId || prior?.input.inputFingerprint === current.input.inputFingerprint) &&
      (!prior || current.context.contextFingerprint === prior.context.contextFingerprint);
  }
  if (!prior || current.input.inputFingerprint !== prior.input.inputFingerprint ||
      current.context.contextFingerprint !== prior.context.contextFingerprint) return false;
  const previousJob = prior.providerExecution, job = current.providerExecution;
  if (mutation.action === "ensure_study_first_mechanism_job") {
    return Boolean(job && job.provider === "openai" &&
      current.input.inputFingerprint === mutation.expectedInputFingerprint &&
      (current.runFingerprint === mutation.expectedRunFingerprint ||
        current.executionLineage?.sourceRunFingerprint === mutation.expectedRunFingerprint ||
        prior.runFingerprint === mutation.expectedRunFingerprint && previousJob?.id === job.id));
  }
  if (mutation.action === "authorize_study_first_mechanism_job") {
    if (!previousJob || !job || previousJob.id !== job.id ||
        previousJob.executionFingerprint !== mutation.expectedExecutionFingerprint ||
        job.authorization?.jobId !== job.id) return false;
    const matches = ["planning", "assessment"].some((nextStage) =>
      job.authorization?.authorizationId === `screen5-ui-${fingerprintSixScreenValue({
        jobId: previousJob.id, operationId: mutation.operationId,
        executionFingerprint: previousJob.executionFingerprint, nextStage,
      }).slice("fnv1a64:".length)}`);
    return matches || Boolean(previousJob.authorization &&
      job.authorization.authorizationId === previousJob.authorization.authorizationId &&
      job.executionFingerprint === previousJob.executionFingerprint);
  }
  return false;
}
