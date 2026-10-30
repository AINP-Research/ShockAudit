import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  fingerprintScreen03ProposalForInterpretation,
  screen03DirectSupportSearchResultIsCurrent,
  screen03EvidenceItemProvidesAuthoritativeDirectSupport,
  screen03FactualClaims,
  screen03ProposalConfirmability,
  screen03ProposalHasActiveDirectSupport,
  screen03ProposalIsAssessmentUnavailableCheck,
  type Screen03AnyProposal,
  type Screen03EvidenceItem,
  type Screen03ProposalConfirmabilityReason,
  type Screen03VerificationState,
} from "../../core/screen03-workflow";
import { projectScreen03CompactOverview } from "../../core/screen03-compact-overview";
import type {
  Screen03BriefingContent,
  Screen03BriefingFactualSectionKey,
} from "../../core/screen03-briefing";
import { restoreScreen03BriefingContent } from "../../core/screen03-briefing";
import { contextLeadSearchLocator } from "../screen-02/ContextLeads";
import type { HostTaskStatus } from "../host-task/HostTaskStatusPanel";
import type { HostReasoningMode } from "../host-task/host-task-client";
import { Screen03HostOverview } from "../host-task/Screen03HostOverview";
import "./screen-03.css";

export type Screen03ReviewDecision =
  | "accept"
  | "edit"
  | "reject"
  | "unresolved";
export type Screen03BulkReviewMode = "confirm" | "unconfirm";
export type Screen03HostReasoningStatus =
  | "idle"
  | "requesting"
  | "waiting"
  | "complete"
  | "unavailable";
export type Screen03HostBriefingDecision =
  | "proposed"
  | "confirmed"
  | "revised"
  | "rejected";
export type Screen03HostBriefingReview =
  | { action: "confirm" | "reject" }
  | {
      action: "revise";
      reason: string;
      content: Screen03BriefingContent;
    };
type Proposal = Screen03AnyProposal;
const HostTaskStatusPanel = lazy(
  () => import("../host-task/HostTaskStatusPanel"),
);
type TimelineProposal =
  Screen03VerificationState["proposals"]["timeline"][number];
type EvidenceItem = Screen03VerificationState["evidence"][number];
type EvidencePassage = EvidenceItem["passages"][number];
type LinkedPassage = {
  number: number;
  source: EvidenceItem;
  passage: EvidencePassage;
};

const LOCKED_DECISIONS = new Set(["accepted", "edited"]);

function isGeneratedInterpretation(
  interpretation: Screen03VerificationState["interpretation"],
): interpretation is NonNullable<Screen03VerificationState["interpretation"]> & {
  origin: "chatgpt-host" | "workers-ai";
} {
  return interpretation?.origin === "chatgpt-host" ||
    interpretation?.origin === "workers-ai";
}

type InterpretationBlock = NonNullable<
  Screen03VerificationState["interpretation"]
>["snapshot"]["intro"];

function interpretationBlockIsCurrent(
  state: Screen03VerificationState,
  block: InterpretationBlock,
) {
  const proposalById = new Map(
    [
      ...state.proposals.identity,
      ...state.proposals.overview,
      ...state.proposals.component,
      ...state.proposals.eligibility,
      ...state.proposals.amendment,
      ...state.proposals.timeline,
    ].map((proposal) => [proposal.id, proposal]),
  );
  const proposals = block.proposalIds.map((proposalId) =>
    proposalById.get(proposalId)
  );
  return proposals.length > 0 && proposals.every(
    (proposal): proposal is Proposal =>
      proposal !== undefined &&
      proposal.reviewStatus !== "rejected" &&
      proposal.reviewStatus !== "edited",
  );
}

function hasCurrentSourceLinkedSnapshot(
  state: Screen03VerificationState,
  interpretation: Screen03VerificationState["interpretation"],
): interpretation is NonNullable<Screen03VerificationState["interpretation"]> {
  const blockIsCurrentAndCited = (block: InterpretationBlock) => {
    if (
      block.proposalIds.length === 0 || block.passageIds.length === 0 ||
      block.evidenceIds.length === 0 ||
      !interpretationBlockIsCurrent(state, block)
    ) return false;
    const evidenceById = new Map(
      state.evidence.map((evidence) => [evidence.id, evidence]),
    );
    const sources = block.evidenceIds.map((evidenceId) =>
      evidenceById.get(evidenceId)
    );
    if (sources.some((source) => source === undefined)) return false;
    const citedPassageIds = new Set(
      sources.flatMap((source) => source?.passages.map((passage) => passage.id) ?? []),
    );
    return block.passageIds.every((passageId) =>
      citedPassageIds.has(passageId)
    );
  };
  return Boolean(
    interpretation &&
      blockIsCurrentAndCited(interpretation.snapshot.intro) &&
      interpretation.snapshot.keyPoints.every(blockIsCurrentAndCited),
  );
}

export type Screen03Props = {
  state: Screen03VerificationState;
  busy?: boolean;
  researchBusy?: boolean;
  errorMessage?: string | null;
  hostReasoningStatus?: Screen03HostReasoningStatus;
  hostBriefingDecision?: Screen03HostBriefingDecision;
  onRetryResearch: () => void;
  onFindDirectSupport?: (proposalId: string) => void;
  hostTaskStatus?: HostTaskStatus | null;
  onCheckHostTask?: () => void;
  onRetryHostTask?: () => void;
  hostReasoningMode?: HostReasoningMode;
  hostEvidenceTaskStatus?: HostTaskStatus | null;
  hostOverviewTaskStatus?: HostTaskStatus | null;
  hostOverviewResult?: unknown | null;
  onRequestEvidenceMapping?: () => void;
  onCheckEvidenceMapping?: () => void;
  onRetryEvidenceMapping?: () => void;
  onRequestOverviewImprovement?: () => void;
  onCheckOverviewImprovement?: () => void;
  onRetryOverviewImprovement?: () => void;
  onRequestHostReasoning?: () => void;
  onReviewHostBriefing?: (decision: Screen03HostBriefingReview) => void;
  onReviewField: (
    fieldId: string,
    decision: Screen03ReviewDecision,
    editedValue?: string,
    note?: string,
  ) => void;
  onReviewAll: (mode: Screen03BulkReviewMode) => void;
  onLockEventCard: () => void;
  onOpenScreen4?: () => void;
  onBack: () => void;
};

const groupHeading = {
  component: "What changed",
  eligibility: "Who or what is covered",
  amendment: "Later changes and enforcement",
  requiredVariable: "What later analysis will need",
} as const;

function factualClaimSection(proposal: Proposal) {
  switch (proposal.group) {
    case "identity":
    case "overview":
      return "Event identity and summary";
    case "component":
      return groupHeading.component;
    case "eligibility":
      return groupHeading.eligibility;
    case "amendment":
      return groupHeading.amendment;
    case "timeline":
      return "When the shock unfolded";
    case "required-variable":
      return "Screen 3";
  }
}

const reviewCopy: Record<Proposal["reviewStatus"], string> = {
  proposed: "Needs your decision",
  accepted: "Confirmed",
  edited: "Corrected and confirmed",
  rejected: "Marked not correct",
  unresolved: "Needs more evidence",
};

const supportCopy: Record<Proposal["support"], string> = {
  direct: "Direct official support",
  indirect: "Lead only",
  conflicting: "Sources disagree",
  unsupported: "No supporting quote",
};

function proposalSupportLabel(
  proposal: Proposal,
  linkedPassages: LinkedPassage[],
) {
  if (proposal.support !== "direct") return supportCopy[proposal.support];
  return linkedPassages.some(
      ({ passage }) => passage.basis === "official-record-field",
    )
    ? "Direct official field"
    : "Direct quoted support";
}

const reviewActions = [
  ["accept", "confirm", "Confirm", "s3-action s3-action--accept"],
  ["edit", "correct", "Correct", ""],
  ["unresolved", "unresolved", "Needs more evidence", "s3-action--unresolved"],
  ["reject", "reject", "Not correct", "s3-action--reject"],
] as const;

const lifecycleStages = [
  ["announcement", "Announcement / discussion"],
  ["enactment", "Enactment / publication"],
  ["effective", "Effective / application"],
  ["implementation", "Implementation / compliance"],
  ["enforcement", "Enforcement / penalty"],
  ["amendment", "Amendment / delay / repeal"],
] as const;

type LifecycleStage = (typeof lifecycleStages)[number][0];

const timelineStage = {
  announcement: ["Announcement / discussion", "announcement", 0],
  publication: ["Publication", "announcement", 1],
  rulemaking: ["Rulemaking / publication", "announcement", 1],
  occurrence: ["Shock occurrence", "announcement", 2],
  other: ["Other dated milestone", "announcement", 3],
  adoption: ["Adoption / decision", "enactment", 4],
  enactment: ["Enactment / publication", "enactment", 4],
  scheduled_effect: ["Scheduled effective date", "effective", 5],
  effective: ["Effective / application", "effective", 5],
  implementation: ["Implementation / compliance", "implementation", 6],
  ruling: ["Court or agency ruling", "enforcement", 7],
  enforcement: ["Enforcement / penalty", "enforcement", 7],
  injunction: ["Stay or injunction", "enforcement", 7],
  invalidation: ["Invalidation or vacatur", "enforcement", 7],
  amendment: ["Amendment / delay / repeal", "amendment", 8],
  withdrawal: ["Withdrawal", "amendment", 8],
  repeal: ["Repeal or removal", "amendment", 8],
  supersession: ["Supersession", "amendment", 8],
} as const satisfies Record<
  TimelineProposal["stage"],
  readonly [string, LifecycleStage, number]
>;

function display(value: string | null | undefined) {
  return value?.trim() || "Not yet confirmed";
}

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^\p{Ll}/u, (letter) => letter.toLocaleUpperCase("en-US"));
}

function currentValue(proposal: Proposal) {
  return proposal.reviewStatus === "edited" && proposal.editedValue
    ? proposal.editedValue
    : proposal.value;
}

function displayedTimelineDate(proposal: TimelineProposal) {
  return proposal.reviewStatus === "edited" && proposal.editedValue
    ? proposal.editedValue
    : proposal.date;
}

function chronologicalTimeline(proposals: TimelineProposal[]) {
  return [...proposals].sort((left, right) => {
    const byDate = displayedTimelineDate(left).localeCompare(
      displayedTimelineDate(right),
    );
    if (byDate) return byDate;
    const byStage = timelineStage[left.stage][2] - timelineStage[right.stage][2];
    if (byStage) return byStage;
    const byLabel = left.label.localeCompare(right.label);
    return byLabel || left.id.localeCompare(right.id);
  });
}

function editableValue(proposal: Proposal) {
  if (proposal.reviewStatus === "edited" && proposal.editedValue) {
    return proposal.editedValue;
  }
  return proposal.group === "timeline" ? proposal.date : proposal.value;
}

function canOpenLocator(locator: string) {
  return /^https?:\/\//i.test(locator);
}

function sourceRole(source: EvidenceItem) {
  if (source.sourceRole) return titleCase(source.sourceRole.replace(/-/g, " "));
  const role = /source role:\s*([^·]+)/i.exec(source.channel)?.[1]?.trim();
  return role ? titleCase(role) : "Source role not classified";
}

function openSource(
  event: ReactMouseEvent<HTMLAnchorElement>,
  locator: string,
) {
  const openExternal = window.openai?.openExternal;
  if (!openExternal) return;
  event.preventDefault();
  void openExternal({ href: locator, redirectUrl: false });
}

function linkedPassagesFor(
  proposal: Proposal,
  passageById: Map<string, LinkedPassage>,
) {
  return proposal.passageIds
    .map((passageId) => passageById.get(passageId))
    .filter((passage): passage is LinkedPassage => passage !== undefined);
}

function citationLabel(linkedPassages: LinkedPassage[]) {
  if (linkedPassages.length === 0) return "No cited passage";
  const numbers = linkedPassages.map(({ number }) => `#${number}`).join(", ");
  return `Passage${linkedPassages.length === 1 ? "" : "s"} ${numbers}`;
}

function ClaimEvidence({
  linkedPassages,
  proposalId,
  claimLabel,
  testIdPrefix = "screen03-evidence",
}: {
  linkedPassages: LinkedPassage[];
  proposalId: string;
  claimLabel: string;
  testIdPrefix?: string;
}) {
  if (linkedPassages.length === 0) {
    return (
      <p className="s3-claim-evidence--empty">
        No direct official support.
      </p>
    );
  }

  return (
    <details
      className="s3-claim-evidence"
      data-testid={`${testIdPrefix}-${proposalId}`}
      data-proposal-id={proposalId}
    >
      <summary aria-label={`Read cited evidence for ${claimLabel}`}>
        Read cited evidence · <small>{citationLabel(linkedPassages)}</small>
      </summary>
      <div className="s3-claim-evidence__body">
        {linkedPassages.map(({ number, passage, source }) => {
          const officialField = passage.basis === "official-record-field";
          const content = (
            <>
            {passage.text}
            <footer>
              <strong>{officialField ? "Official field" : "Passage"} #{number}</strong>
              {" · "}{source.title} · {source.publisher}<br />
              <span>
                {sourceRole(source)} · authority tier {source.authorityTier} ·{" "}
                {source.publishedDate
                  ? `published ${source.publishedDate}`
                  : "publication date not provided"}
              </span>{" · "}
              {canOpenLocator(source.locator) && (
                <a
                  href={source.locator}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open source record for ${claimLabel}`}
                  onClick={(event) => openSource(event, source.locator)}
                >
                  Open source record ↗
                </a>
              )}
            </footer>
            </>
          );
          return officialField
            ? <div className="s3-official-field" key={`${source.id}:${passage.id}`}>{content}</div>
            : <blockquote key={`${source.id}:${passage.id}`}>{content}</blockquote>;
        })}
      </div>
    </details>
  );
}

function ReviewControls({
  proposal,
  evidence,
  locked,
  busy,
  onReviewField,
}: {
  proposal: Proposal;
  evidence: Screen03EvidenceItem[];
  locked: boolean;
  busy: boolean;
  onReviewField: Screen03Props["onReviewField"];
}) {
  const editorId = useId();
  const [editing, setEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(editableValue(proposal));
  const [note, setNote] = useState("");
  const [pendingDecision, setPendingDecision] =
    useState<Screen03ReviewDecision | null>(null);
  const confirmability = screen03ProposalConfirmability(proposal, evidence);
  const canEdit = screen03ProposalHasActiveDirectSupport(proposal, evidence);
  const guidanceId = `${editorId}-confirm-guidance`;
  const confirmabilityCopy: Record<
    Exclude<Screen03ProposalConfirmabilityReason, "confirmable">,
    string
  > = {
    "no-direct-support":
      "Confirm becomes available when an official field or quoted passage directly supports this claim. Find support or choose another decision.",
    "inactive-direct-support":
      "The linked source passage is no longer active. Refresh the evidence before confirming it.",
    "incomplete-component":
      "This is an incomplete source statement. Correct it from the quoted passage or choose Needs more evidence.",
    "reviewed-value-not-supported":
      "This wording does not appear in the linked passage. Correct it from the quote or choose Needs more evidence.",
  };
  const editedConfirmability = screen03ProposalConfirmability(
    proposal,
    evidence,
    editedValue.trim(),
    true,
  );

  useEffect(() => {
    if (!busy) setPendingDecision(null);
  }, [busy]);

  function closeEditor() {
    setEditing(false);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const value = editedValue.trim();
    if (!value) return;
    setPendingDecision("edit");
    onReviewField(proposal.id, "edit", value, note.trim() || undefined);
    closeEditor();
  }

  if (locked) return null;

  return (
    <div
      className="s3-review"
      aria-label={`Review ${proposal.label}`}
      data-testid={`screen03-review-${proposal.id}`}
      data-proposal-id={proposal.id}
    >
      <span>What do you conclude?</span>
      <p
        className={`s3-review__status s3-review__status--${proposal.reviewStatus}`}
        role="status"
        aria-live="polite"
        data-testid={`screen03-decision-status-${proposal.id}`}
      >
        {pendingDecision && busy
          ? "Saving this decision…"
          : proposal.reviewStatus === "proposed"
            ? "No decision saved yet."
            : `Saved: ${reviewCopy[proposal.reviewStatus]}.`}
      </p>
      {!confirmability.confirmable && (
        <p
          id={guidanceId}
          className="s3-review__guidance"
          data-testid={`screen03-confirm-guidance-${proposal.id}`}
        >
          {confirmabilityCopy[confirmability.reason]}
        </p>
      )}
      <div className="s3-review__actions">
        {reviewActions.map(([decision, testKey, label, className]) => {
          const edits = decision === "edit";
          const savedDecision =
            proposal.reviewStatus ===
              (decision === "unresolved" ? decision : `${decision}ed`);
          // Correct is an editor launcher, not a terminal decision button. Keep
          // it available after a saved correction so the researcher can make a
          // second, still-cited correction without first clearing the review.
          const selected = !edits && savedDecision;
          const saving = busy && pendingDecision === decision && !selected;
          const accessibleName = saving
            ? `Saving ${proposal.label}`
            : edits && savedDecision
              ? `Correct ${proposal.label} again`
              : selected
              ? `${reviewCopy[proposal.reviewStatus]}: ${proposal.label}`
              : decision === "accept"
                ? `Confirm ${proposal.label}`
                : edits
                  ? `Correct ${proposal.label}`
                  : `Mark ${proposal.label} as ${decision === "reject" ? "not correct" : "needing more evidence"}`;
          return (
            <button
              key={decision}
              type="button"
              className={`${className} ${selected ? `s3-action--saved s3-action--saved-${decision}` : ""}`.trim() || undefined}
              disabled={
                busy ||
                selected ||
                (edits && !canEdit) ||
                (decision === "accept" && !confirmability.confirmable)
              }
              aria-describedby={
                (decision === "accept" && !confirmability.confirmable) ||
                  (edits && !canEdit)
                  ? guidanceId
                  : undefined
              }
              aria-label={accessibleName}
              aria-pressed={edits ? undefined : selected}
              aria-busy={saving || undefined}
              aria-expanded={
                edits
                  ? editing
                  : undefined
              }
              aria-controls={edits ? editorId : undefined}
              data-testid={`screen03-${testKey}-${proposal.id}`}
              onClick={() => {
                if (busy || selected) return;
                if (!edits) {
                  setPendingDecision(decision);
                  onReviewField(proposal.id, decision);
                  return;
                }
                if (!editing) {
                  setEditedValue(editableValue(proposal));
                  setNote("");
                }
                setEditing(!editing);
              }}
            >
              {saving
                ? "Saving…"
                : edits && savedDecision
                  ? "Correct again"
                : selected
                  ? `✓ ${reviewCopy[proposal.reviewStatus]}`
                  : label}
            </button>
          );
        })}
      </div>

      {editing && (
        <form id={editorId} className="s3-edit" onSubmit={submitEdit}>
          <label htmlFor={`${editorId}-value`}>
            {proposal.group === "timeline"
              ? "Corrected date"
              : "Corrected wording"}
          </label>
          {proposal.group === "timeline" ? (
            <input
              id={`${editorId}-value`}
              type="date"
              autoFocus
              value={editedValue}
              onChange={(event) => setEditedValue(event.currentTarget.value)}
              required
            />
          ) : (
            <textarea
              id={`${editorId}-value`}
              rows={3}
              autoFocus
              value={editedValue}
              onChange={(event) => setEditedValue(event.currentTarget.value)}
              required
            />
          )}
          <label htmlFor={`${editorId}-note`}>Why did you change it? (optional)</label>
          <input
            id={`${editorId}-note`}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <p className="s3-edit__constraint">
            Confirm a correction only when the linked quote supports its wording
            or date. Otherwise choose Needs more evidence.
          </p>
          {!editedConfirmability.confirmable && editedValue.trim() && (
            <p className="s3-review__guidance" role="status">
              {confirmabilityCopy[editedConfirmability.reason]}
            </p>
          )}
          <div>
            <button
              className="s3-primary"
              type="submit"
              disabled={busy || !editedConfirmability.confirmable}
              aria-label={`Save correction for ${proposal.label}`}
              data-testid={`screen03-save-correction-${proposal.id}`}
            >
              Save correction
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={`Cancel correction for ${proposal.label}`}
              data-testid={`screen03-cancel-correction-${proposal.id}`}
              onClick={closeEditor}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function interpretationSources(
  state: Screen03VerificationState,
  evidenceIds: string[],
) {
  const selected = new Set(evidenceIds);
  return state.evidence.filter(
    (evidence) => evidence.status !== "changed" && selected.has(evidence.id),
  );
}

function proposalReaderHelp(
  state: Screen03VerificationState,
  proposal: Proposal,
) {
  const interpretation = state.interpretation;
  const fingerprint = fingerprintScreen03ProposalForInterpretation(proposal);
  const generated = isGeneratedInterpretation(interpretation);
  const explanation = generated
    ? interpretation.claimExplanations.find(
        (candidate) =>
          candidate.proposalId === proposal.id &&
          candidate.proposalFingerprint === fingerprint,
      )
    : undefined;
  const sources = explanation
    ? interpretationSources(state, explanation.evidenceIds)
    : [];
  if (!explanation || sources.length === 0) return null;
  return {
    text: explanation.text,
    sourceCount: sources.length,
    hostGenerated: generated && interpretation.origin === "chatgpt-host",
  };
}

function ProposalCard({
  state,
  proposal,
  linkedPassages,
  locked,
  busy,
  onReviewField,
  onFindDirectSupport,
}: {
  state: Screen03VerificationState;
  proposal: Proposal;
  linkedPassages: LinkedPassage[];
  locked: boolean;
  busy: boolean;
  onReviewField: Screen03Props["onReviewField"];
  onFindDirectSupport?: Screen03Props["onFindDirectSupport"];
}) {
  const titleId = useId();
  const incomplete = screen03ProposalConfirmability(
    proposal,
    state.evidence,
    currentValue(proposal),
    proposal.reviewStatus === "edited",
  ).reason === "incomplete-component";
  const readerHelp = proposal.reviewStatus === "edited"
    ? null
    : proposalReaderHelp(state, proposal);
  const sourceDerivedValue = currentValue(proposal);
  const displayedValue = incomplete
    ? "Incomplete source fragment omitted. Correct it from the cited passage or choose Needs more evidence."
    : sourceDerivedValue;

  return (
    <article
      id={`screen03-factual-claim-${proposal.id}`}
      className={`s3-field s3-field--${proposal.reviewStatus}`}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid={`screen03-field-${proposal.id}`}
      data-proposal-id={proposal.id}
    >
      <div className="s3-field__heading">
        <div>
          <span className="s3-eyebrow">
            {proposal.critical ? "Decision required" : "Additional detail"}
          </span>
          <h3 id={titleId}>{proposal.label}</h3>
        </div>
        <span className={`s3-tag s3-tag--${proposal.reviewStatus}`}>
          {reviewCopy[proposal.reviewStatus]}
        </span>
      </div>

      <div className="s3-field__value">
        <span>{proposal.reviewStatus === "edited" ? "Your corrected value" : "Claim to check"}</span>
        <p>{displayedValue}</p>
        {readerHelp && (
          <aside
            className="s3-field__reader-help"
            aria-label="Interpretive reader help"
          >
            <strong>Interpretive help — not the value Confirm will accept</strong>
            <p>{readerHelp.text}</p>
            <small>
              {readerHelp.hostGenerated
                ? "ChatGPT-assisted wording"
                : "Reader-friendly wording"}{" "}
              · grounded in {readerHelp.sourceCount} linked online source
              {readerHelp.sourceCount === 1 ? "" : "s"}. Review the exact
              passages below before deciding.
            </small>
          </aside>
        )}
        {proposal.reviewStatus === "edited" && proposal.editedValue && (
          <details>
            <summary aria-label={`Show original proposal for ${proposal.label}`}>
              Original proposal
            </summary>
            <p>{proposal.value}</p>
          </details>
        )}
      </div>

      <div className="s3-support-line">
        <span className={`s3-support s3-support--${proposal.support}`}>
          {proposalSupportLabel(proposal, linkedPassages)}
        </span>
        <span>{citationLabel(linkedPassages)}</span>
      </div>

      {proposal.uncertainty && (
        <p className="s3-field__uncertainty">
          <strong>Still uncertain:</strong> {proposal.uncertainty}
        </p>
      )}
      {proposal.support === "conflicting" && (
        <p className="s3-field__conflict" role="alert">
          <strong>Conflict:</strong> official sources disagree.
        </p>
      )}

      <ClaimEvidence
        linkedPassages={linkedPassages}
        proposalId={proposal.id}
        claimLabel={proposal.label}
      />
      {!locked && proposal.support !== "direct" && onFindDirectSupport && (
        <button
          type="button"
          className="s3-find-support"
          disabled={busy}
          data-testid={`screen03-find-direct-support-${proposal.id}`}
          onClick={() => onFindDirectSupport(proposal.id)}
        >
          Find direct official support
        </button>
      )}
      <DirectSupportSearchStatus state={state} proposalId={proposal.id} />
      <ReviewControls
        proposal={proposal}
        evidence={state.evidence}
        locked={locked}
        busy={busy}
        onReviewField={onReviewField}
      />
    </article>
  );
}

function DirectSupportSearchStatus({
  state,
  proposalId,
}: {
  state: Screen03VerificationState;
  proposalId: string;
}) {
  const result = [...(state.directSupportSearches ?? [])]
    .reverse()
    .find((record) => record.proposalId === proposalId);
  if (!result) return null;
  if (!screen03DirectSupportSearchResultIsCurrent(result, state)) {
    return (
      <p
        className="s3-review__status s3-review__status--unresolved"
        role="status"
        data-testid={`screen03-direct-support-result-${proposalId}`}
        data-outcome="stale"
      >
        The previous targeted-search result is no longer current because the
        claim or its linked evidence changed. Search the official sources again
        before relying on it.
      </p>
    );
  }
  return (
    <p
      className={`s3-review__status s3-review__status--${
        result.resultingConfirmable ? "accepted" : "unresolved"
      }`}
      role="status"
      data-testid={`screen03-direct-support-result-${proposalId}`}
      data-outcome={result.outcome}
    >
      {result.note} {result.evidenceIds.length > 0
        ? `${result.evidenceIds.length} relevant official source${result.evidenceIds.length === 1 ? "" : "s"} recorded.`
        : "No relevant official source was promoted."}
    </p>
  );
}

function ProposalSection({
  state,
  id,
  title,
  description,
  proposals,
  passageById,
  locked,
  busy,
  onReviewField,
  onFindDirectSupport,
}: {
  state: Screen03VerificationState;
  id: string;
  title: string;
  description: string;
  proposals: Proposal[];
  passageById: Map<string, LinkedPassage>;
  locked: boolean;
  busy: boolean;
  onReviewField: Screen03Props["onReviewField"];
  onFindDirectSupport?: Screen03Props["onFindDirectSupport"];
}) {
  return (
    <section className="s3-section" aria-labelledby={id}>
      <div className="s3-section__heading">
        <div>
          <span className="s3-eyebrow">Claim review</span>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="s3-count">{proposals.length} claim{proposals.length === 1 ? "" : "s"}</span>
      </div>
      {proposals.length > 0 ? (
        <div className="s3-field-grid">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              state={state}
              proposal={proposal}
              linkedPassages={linkedPassagesFor(proposal, passageById)}
              locked={locked}
              busy={busy}
              onReviewField={onReviewField}
              onFindDirectSupport={onFindDirectSupport}
            />
          ))}
        </div>
      ) : (
        <p className="s3-empty">No claims were found for this part of the event.</p>
      )}
    </section>
  );
}

function Timeline({
  state,
  proposals,
  passageById,
  locked,
  busy,
  onReviewField,
  onFindDirectSupport,
}: {
  state: Screen03VerificationState;
  proposals: TimelineProposal[];
  passageById: Map<string, LinkedPassage>;
  locked: boolean;
  busy: boolean;
  onReviewField: Screen03Props["onReviewField"];
  onFindDirectSupport?: Screen03Props["onFindDirectSupport"];
}) {
  const ordered = chronologicalTimeline(proposals);
  const stageCounts = new Map<TimelineProposal["stage"], number>();
  const stageOrdinals = new Map<TimelineProposal["stage"], number>();
  const represented = new Set<LifecycleStage>();
  for (const proposal of ordered) {
    stageCounts.set(proposal.stage, (stageCounts.get(proposal.stage) ?? 0) + 1);
    if (
      screen03ProposalConfirmability(
        proposal,
        state.evidence,
        currentValue(proposal),
        proposal.reviewStatus === "edited",
      ).confirmable
    ) {
      represented.add(timelineStage[proposal.stage][1]);
    }
  }
  const missingStages = lifecycleStages.filter(([key]) => !represented.has(key));

  function moveTimeline(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.currentTarget.scrollBy({
      left: event.key === "ArrowRight" ? 300 : -300,
      behavior: "auto",
    });
  }

  return (
    <section
      className="s3-section s3-timeline-panel"
      aria-labelledby="s3-timeline-title"
      data-testid="screen03-timeline"
    >
      <div className="s3-section__heading">
        <div>
          <span className="s3-eyebrow">Start here · dates from the record</span>
          <h2 id="s3-timeline-title">When the shock unfolded</h2>
          <p id="s3-timeline-help">
            Dates run earliest to latest. A stage can appear more than once when
            separate records describe different milestones. The cards preserve
            those stages separately so later analysis does not collapse
            announcement, enactment, implementation, and enforcement into one
            date. Every dated claim still needs an explicit researcher
            decision before the Event Card can be saved.
          </p>
        </div>
        <span className="s3-count">6 stages · {proposals.length} dated</span>
      </div>
      <div
        className="s3-timeline-scroll"
        role="region"
        aria-label="Scrollable shock timeline"
        aria-describedby="s3-timeline-help"
        tabIndex={0}
        onKeyDown={moveTimeline}
      >
        <ol className="s3-timeline">
          {ordered.map((proposal) => {
              const [stageLabel, lifecycleStage] = timelineStage[proposal.stage];
              const stageIndex = lifecycleStages.findIndex(
                ([key]) => key === lifecycleStage,
              );
              const stageCount = stageCounts.get(proposal.stage) ?? 1;
              const stageOrdinal = (stageOrdinals.get(proposal.stage) ?? 0) + 1;
              stageOrdinals.set(proposal.stage, stageOrdinal);
              const resolvedDate = displayedTimelineDate(proposal);
              const linkedPassages = linkedPassagesFor(proposal, passageById);
              const readerHelp = proposal.reviewStatus === "edited"
                ? null
                : proposalReaderHelp(state, proposal);
              const sourceDerivedValue = currentValue(proposal);
              return (
                <li
                  key={proposal.id}
                  id={`screen03-factual-claim-${proposal.id}`}
                  className={`s3-time-card s3-time-card--${stageIndex}`}
                  tabIndex={-1}
                  data-testid={`screen03-stage-${proposal.id}`}
                  data-proposal-id={proposal.id}
                  data-lifecycle-stage={lifecycleStage}
                  data-date-stage={proposal.stage}
                >
                  <div className="s3-time-card__topline">
                    <span className="s3-time-card__stage">
                      <span aria-hidden="true" />
                      {stageLabel}
                    </span>
                    <span className={`s3-tag s3-tag--${proposal.reviewStatus}`}>
                      {reviewCopy[proposal.reviewStatus]}
                    </span>
                  </div>
                  {stageCount > 1 && (
                    <small className="s3-time-card__ordinal">
                      Milestone {stageOrdinal} of {stageCount} in this stage
                    </small>
                  )}
                  <span className="s3-time-card__claim-label">
                    {proposal.reviewStatus === "edited"
                      ? "Previously corrected date"
                      : "Source-linked date"}
                  </span>
                  <time dateTime={resolvedDate}>{resolvedDate}</time>
                  <h3>{proposal.label}</h3>
                  {sourceDerivedValue !== proposal.date && (
                    <p className="s3-time-card__claim">
                      {sourceDerivedValue}
                    </p>
                  )}
                  {readerHelp && (
                    <aside
                      className="s3-time-card__reader-help"
                      aria-label="Interpretive timeline help"
                    >
                      <strong>
                        Interpretive help — not the date Confirm will accept
                      </strong>
                      <p>{readerHelp.text}</p>
                      <small>
                        {readerHelp.hostGenerated
                          ? "ChatGPT-assisted wording"
                          : "Reader-friendly wording"}{" "}
                        · compare it with the exact dated passage below.
                      </small>
                    </aside>
                  )}
                  <div className="s3-support-line">
                    <span className={`s3-support s3-support--${proposal.support}`}>
                      {proposalSupportLabel(proposal, linkedPassages)}
                    </span>
                    <span>{citationLabel(linkedPassages)}</span>
                  </div>
                  {proposal.uncertainty && (
                    <p className="s3-field__uncertainty">
                      <strong>Uncertainty:</strong> {proposal.uncertainty}
                    </p>
                  )}
                  <ClaimEvidence
                    linkedPassages={linkedPassages}
                    proposalId={proposal.id}
                    claimLabel={proposal.label}
                  />
                  {!locked && proposal.support !== "direct" &&
                    onFindDirectSupport && (
                    <button
                      type="button"
                      className="s3-find-support"
                      disabled={busy}
                      data-testid={`screen03-find-direct-support-${proposal.id}`}
                      onClick={() => onFindDirectSupport(proposal.id)}
                    >
                      Find direct official support
                    </button>
                  )}
                  <DirectSupportSearchStatus
                    state={state}
                    proposalId={proposal.id}
                  />
                  <ReviewControls
                    proposal={proposal}
                    evidence={state.evidence}
                    locked={locked}
                    busy={busy}
                    onReviewField={onReviewField}
                  />
                </li>
              );
            })}
        </ol>
      </div>
      <div
        className="s3-timeline-gaps"
        aria-labelledby="s3-timeline-gaps-title"
        data-testid="screen03-timeline-gaps"
      >
        <h3 id="s3-timeline-gaps-title">Lifecycle stages with no directly supported date</h3>
        <p>
          A gap means this bounded search did not retrieve a date with direct
          quoted support. It does not mean the stage never occurred.
        </p>
        {missingStages.length ? (
          <ul>
            {missingStages.map(([stageKey, stageLabel]) => (
              <li
                key={stageKey}
                data-testid={`screen03-stage-placeholder-${stageKey}`}
                data-lifecycle-stage={stageKey}
              >
                <strong>{stageLabel}</strong>
                <span>No directly supported date found</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Every lifecycle stage has at least one dated milestone.</p>
        )}
      </div>
    </section>
  );
}

const INTERPRETATION_CAVEAT =
  "ChatGPT interpretation — not a verified event fact and not proof of the true mechanism. This ChatGPT-assisted interpretation is a research-design hypothesis. It does not establish exposure, a causal mechanism, effect direction, or effect size.";

const BRIEFING_HEADING_RIGHTS =
  /\b(?:right|rights|access|delete|deletion|opt[- ]?out|non[- ]?discrimination|protect(?:ion|ed)?|entitl(?:e|ed|ement))\b/iu;
const BRIEFING_HEADING_DUTIES =
  /\b(?:duty|duties|must|required|requirement|obligation|prohibit(?:s|ed|ion)?|compliance|disclos(?:e|ure)|notify|notification|report(?:ing)?|standard)\b/iu;
const BRIEFING_HEADING_ENFORCEMENT =
  /\b(?:enforc(?:e|ed|ement)|penalt(?:y|ies)|fine|remed(?:y|ies)|violation|regulator|attorney general)\b/iu;

function interpretationPointHeading(
  state: Screen03VerificationState,
  block: InterpretationBlock,
) {
  const proposalById = new Map(
    [
      ...state.proposals.identity,
      ...state.proposals.overview,
      ...state.proposals.component,
      ...state.proposals.eligibility,
      ...state.proposals.amendment,
      ...state.proposals.timeline,
    ].map((proposal) => [proposal.id, proposal]),
  );
  const proposals = block.proposalIds
    .map((proposalId) => proposalById.get(proposalId))
    .filter((proposal): proposal is Proposal => proposal !== undefined);
  const searchable = proposals
    .map((proposal) => `${proposal.label} ${currentValue(proposal)}`)
    .join(" ");
  if (
    proposals.some((proposal) => proposal.group === "amendment") ||
    BRIEFING_HEADING_ENFORCEMENT.test(searchable)
  ) return "Enforcement and later changes";
  if (proposals.some((proposal) => proposal.group === "timeline")) {
    return "Key timing";
  }
  if (proposals.some((proposal) => proposal.group === "eligibility")) {
    return "Who is covered";
  }
  if (BRIEFING_HEADING_RIGHTS.test(searchable)) {
    return "Rights and protections";
  }
  if (BRIEFING_HEADING_DUTIES.test(searchable)) {
    return "Duties and requirements";
  }
  return "What it does";
}

function InterpretationInlineSources({
  state,
  evidenceIds,
  sourceNumbers,
  testId,
}: {
  state: Screen03VerificationState;
  evidenceIds: string[];
  sourceNumbers: ReadonlyMap<string, number>;
  testId: string;
}) {
  const sources = interpretationSources(state, evidenceIds);
  if (sources.length === 0) return null;
  return (
    <span
      className="s3-inline-sources"
      aria-label="Sources for this statement"
      data-testid={testId}
    >
      {sources.map((source) => {
        const number = sourceNumbers.get(source.id);
        if (number === undefined) return null;
        return canOpenLocator(source.locator)
          ? (
              <a
                key={source.id}
                href={source.locator}
                target="_blank"
                rel="noreferrer"
                title={`${source.title} · ${source.publisher}`}
                aria-label={`Source ${number}: ${source.title}`}
                onClick={(event) => openSource(event, source.locator)}
              >
                [{number}]
              </a>
            )
          : (
              <span
                key={source.id}
                title={`${source.title} · ${source.publisher}`}
                aria-label={`Source ${number}: ${source.title}; link unavailable`}
              >
                [{number}]
              </span>
            );
      })}
    </span>
  );
}

function deterministicBriefingEvidenceIds(
  state: Screen03VerificationState,
  proposal: Proposal,
) {
  const passageIds = new Set(proposal.passageIds);
  return state.evidence
    .filter((evidence) =>
      evidence.status !== "changed" &&
      evidence.passages.some((passage) => passageIds.has(passage.id))
    )
    .map((evidence) => evidence.id);
}

function deterministicBriefingHeading(proposal: Proposal) {
  if (proposal.group === "timeline") return "Key timing";
  if (proposal.group === "eligibility") return "Who is covered";
  if (proposal.group === "amendment") return "Enforcement and later changes";
  if (proposal.group === "component") return "What changed";
  if (proposal.group === "identity") return "Event identity";
  return "What the shock is";
}

function deterministicBriefingProposals(state: Screen03VerificationState) {
  const groupRank: Record<Proposal["group"], number> = {
    overview: 0,
    component: 1,
    eligibility: 2,
    timeline: 3,
    amendment: 4,
    identity: 5,
    "required-variable": 6,
  };
  const candidates = [
    ...state.proposals.overview,
    ...state.proposals.component,
    ...state.proposals.eligibility,
    ...state.proposals.timeline,
    ...state.proposals.amendment,
    ...state.proposals.identity,
  ].filter((proposal) =>
    (proposal.reviewStatus === "accepted" ||
      proposal.reviewStatus === "edited") &&
    screen03ProposalHasActiveDirectSupport(proposal, state.evidence) &&
    screen03ProposalConfirmability(proposal, state.evidence).reason !==
      "incomplete-component" &&
    deterministicBriefingEvidenceIds(state, proposal).length > 0
  ).sort((left, right) =>
    groupRank[left.group] - groupRank[right.group] ||
    left.id.localeCompare(right.id)
  );
  const seen = new Set<string>();
  return candidates.filter((proposal) => {
    const normalized = currentValue(proposal)
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

const briefingRevisionFields = [
  ["title", "Title", 240],
  ["oneSentenceSummary", "One-sentence summary", 600],
  ["whatTheShockIs", "What the shock is", 1_600],
  ["whatChanged", "What changed", 1_600],
  ["whyItMatters", "Why it matters", 1_600],
  ["whoIsAffected", "Who is affected", 1_600],
  ["eligibilityThresholdsAndExemptions", "Eligibility, thresholds, and exemptions", 1_600],
  ["importantTimingAndTreatmentStages", "Important timing and treatment stages", 1_600],
  ["enforcementAndPenalties", "Enforcement and penalties", 1_600],
  ["laterChanges", "Later changes", 1_600],
  ["plausiblePathwayToResearcherOutcome", "Plausible pathway to the researcher outcome", 1_600],
  ["conciseRationale", "Concise rationale", 600],
] as const satisfies ReadonlyArray<[
  Exclude<keyof Screen03BriefingContent,
    | "schemaVersion"
    | "briefingStatus"
    | "unresolvedUncertainties"
    | "acknowledgedMissingEvidenceIds"
    | "acknowledgedConflictIds"
    | "sectionEvidenceIds"
    | "hostModel">,
  string,
  number,
]>;

function BriefingRevisionForm({
  content,
  onReview,
}: {
  content: Screen03BriefingContent;
  onReview: (review: Screen03HostBriefingReview) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) =>
      String(data.get(name) ?? "").trim().normalize("NFKC");
    const revised = restoreScreen03BriefingContent({
      ...content,
      hostModel: "host_model_not_exposed",
      unresolvedUncertainties: text("unresolvedUncertainties")
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter(Boolean),
      ...Object.fromEntries(
        briefingRevisionFields.map(([key]) => [key, text(key)]),
      ),
    });
    const reason = text("revisionReason");
    if (!revised || !reason) {
      setError(
        "Keep every required field as bounded plain text and give a reason for the revision.",
      );
      return;
    }
    setError(null);
    onReview({ action: "revise", reason, content: revised });
  };
  return (
    <details className="s3-host-briefing-revision">
      <summary>Revise briefing</summary>
      <form className="s3-edit" onSubmit={submit}>
        <p>
          Edit the briefing text only. Linked evidence remains read-only and is
          preserved with the original ChatGPT proposal.
        </p>
        <p data-testid="screen03-briefing-revision-read-only-status">
          <strong>Evidence status:</strong> {display(content.briefingStatus)}.
          The packet-required status, evidence links, and {content.acknowledgedMissingEvidenceIds.length} missing-evidence / {content.acknowledgedConflictIds.length} conflict acknowledgement IDs remain read-only.
        </p>
        {briefingRevisionFields.map(([key, label, maxLength]) => (
          <label key={key}>
            {label}
            <textarea
              name={key}
              defaultValue={content[key]}
              maxLength={maxLength}
              required
            />
          </label>
        ))}
        <label>
          Unresolved uncertainties (one per line, at most 16)
          <textarea
            name="unresolvedUncertainties"
            defaultValue={content.unresolvedUncertainties.join("\n")}
            maxLength={9_616}
          />
        </label>
        <label>
          Reason for revision
          <textarea name="revisionReason" maxLength={1_000} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="s3-primary">
          Save revision and confirm
        </button>
      </form>
    </details>
  );
}

function hostTaskIsActive(task: HostTaskStatus | null | undefined) {
  return Boolean(
    task && ["starting", "waiting", "applying"].includes(task.phase),
  );
}

function EventBrief({
  state,
  hostReasoningStatus = state.interpretation?.origin === "chatgpt-host"
    ? "complete"
    : "idle",
  onRequestHostReasoning,
  hostBriefingDecision = "proposed",
  onReviewHostBriefing,
  hostReasoningMode,
  hostOverviewTaskStatus,
  hostOverviewResult,
  onRequestOverviewImprovement,
}: {
  state: Screen03VerificationState;
  hostReasoningStatus?: Screen03HostReasoningStatus;
  onRequestHostReasoning?: Screen03Props["onRequestHostReasoning"];
  hostBriefingDecision?: Screen03HostBriefingDecision;
  onReviewHostBriefing?: Screen03Props["onReviewHostBriefing"];
  hostReasoningMode?: Screen03Props["hostReasoningMode"];
  hostOverviewTaskStatus?: Screen03Props["hostOverviewTaskStatus"];
  hostOverviewResult?: Screen03Props["hostOverviewResult"];
  onRequestOverviewImprovement?: Screen03Props["onRequestOverviewImprovement"];
}) {
  const compactOverview = projectScreen03CompactOverview(state);
  if (compactOverview) {
    return (
      <Screen03HostOverview
        overview={compactOverview}
        hostReasoningMode={hostReasoningMode}
        hostOverviewTaskStatus={hostOverviewTaskStatus}
        hostOverviewResult={hostOverviewResult}
        onRequestOverviewImprovement={onRequestOverviewImprovement}
      />
    );
  }
  const interpretation = state.interpretation;
  const activeHostProposal = state.briefing?.activeProposalId
    ? state.briefing.proposals.find(
        (proposal) => proposal.proposalId === state.briefing?.activeProposalId,
      ) ?? null
    : null;
  const activeHostContent = activeHostProposal
    ? state.briefing?.confirmedIsCurrent &&
        state.briefing.confirmed?.proposalId === activeHostProposal.proposalId
      ? state.briefing.confirmed.content
      : activeHostProposal.content
    : null;
  const latestHostProposalWasRejected =
    state.briefing?.decisions.at(-1)?.action === "reject";
  const referencedEvidenceIds = hasCurrentSourceLinkedSnapshot(
      state,
      interpretation,
    )
    ? [
        ...interpretation.snapshot.intro.evidenceIds,
        ...interpretation.snapshot.keyPoints.flatMap((point) => point.evidenceIds),
      ]
    : [];
  const snapshotSources = interpretationSources(state, referencedEvidenceIds);
  const rich = interpretation?.origin === "chatgpt-host" &&
    hasCurrentSourceLinkedSnapshot(state, interpretation) &&
    snapshotSources.length === new Set(referencedEvidenceIds).size;
  const legacyRich = rich && !latestHostProposalWasRejected;
  const studyEvidenceIds = interpretation
    ? [
        ...interpretation.studyRelevance.sampleConnection.evidenceIds,
        ...interpretation.studyRelevance.outcomeConnection.evidenceIds,
      ]
    : [];
  const studySources = interpretationSources(state, studyEvidenceIds);
  const deterministicProposals = deterministicBriefingProposals(state);
  const deterministicIntro = deterministicProposals[0] ?? null;
  const deterministicPoints = deterministicProposals.slice(
    deterministicIntro ? 1 : 0,
    deterministicIntro ? 7 : 6,
  );
  const deterministicEvidenceIds = [
    ...(deterministicIntro
      ? deterministicBriefingEvidenceIds(state, deterministicIntro)
      : []),
    ...deterministicPoints.flatMap((proposal) =>
      deterministicBriefingEvidenceIds(state, proposal)
    ),
  ];
  const hostBriefingEvidenceIds = activeHostContent
    ? Object.values(activeHostContent.sectionEvidenceIds).flat()
    : [];
  const sourceNumbers = new Map(
    interpretationSources(
      state,
      activeHostContent
        ? hostBriefingEvidenceIds
        : legacyRich
        ? [...referencedEvidenceIds, ...studyEvidenceIds]
        : deterministicEvidenceIds,
    ).map((source, index) => [source.id, index + 1]),
  );
  const showStudyRelevance = Boolean(
    legacyRich &&
      interpretation.studyRelevance.sampleConnection.evidenceIds.length > 0 &&
      interpretation.studyRelevance.outcomeConnection.evidenceIds.length > 0 &&
      interpretationBlockIsCurrent(
        state,
        interpretation.studyRelevance.sampleConnection,
      ) &&
      interpretationBlockIsCurrent(
        state,
        interpretation.studyRelevance.outcomeConnection,
      ) &&
      studySources.length === new Set(studyEvidenceIds).size,
  );
  const reasoningPending = hostReasoningStatus === "requesting" ||
    hostReasoningStatus === "waiting";
  const actionLabel = reasoningPending
      ? "Request sent to ChatGPT…"
      : "Ask ChatGPT to prepare the shock briefing";
  const eyebrow = activeHostContent
    ? hostBriefingDecision === "revised"
      ? "Researcher-revised ChatGPT host briefing"
      : hostBriefingDecision === "confirmed"
        ? "Researcher-confirmed ChatGPT host briefing"
        : "ChatGPT host proposal — researcher review required"
    : legacyRich
      ? "ChatGPT-generated source-linked overview"
      : "Source-linked factual summary — no ChatGPT interpretation";
  const hostBriefingSections: Array<{
    key: Screen03BriefingFactualSectionKey;
    heading: string;
    text: string;
  }> = activeHostContent
    ? [
        { key: "whatTheShockIs" as const, heading: "What the shock is", text: activeHostContent.whatTheShockIs },
        { key: "whatChanged" as const, heading: "What changed", text: activeHostContent.whatChanged },
        { key: "whyItMatters" as const, heading: "Why it matters", text: activeHostContent.whyItMatters },
        { key: "whoIsAffected" as const, heading: "Who is affected", text: activeHostContent.whoIsAffected },
        {
          key: "eligibilityThresholdsAndExemptions" as const,
          heading: "Eligibility, thresholds, and exemptions",
          text: activeHostContent.eligibilityThresholdsAndExemptions,
        },
        {
          key: "importantTimingAndTreatmentStages" as const,
          heading: "Important timing and treatment stages",
          text: activeHostContent.importantTimingAndTreatmentStages,
        },
        {
          key: "enforcementAndPenalties" as const,
          heading: "Enforcement and penalties",
          text: activeHostContent.enforcementAndPenalties,
        },
        { key: "laterChanges" as const, heading: "Later changes", text: activeHostContent.laterChanges },
      ].filter((section) => section.text.trim().length > 0)
    : [];
  return (
    <section
      className="s3-section s3-brief"
      aria-labelledby="s3-brief-title"
      data-testid="screen03-understand-shock"
    >
      <div className="s3-section__heading">
        <div>
          <span className="s3-eyebrow">
            {eyebrow} · research aid
          </span>
          <h2 id="s3-brief-title">Understand this shock</h2>
          <p>
            Start with the short explanation, then confirm the exact claims and
            quotes below.
          </p>
        </div>
        <div className="s3-brief__actions">
          <span className="s3-event-status">{display(state.eventIdentity.status)}</span>
          {onRequestHostReasoning && (
            <button
              type="button"
              className="s3-primary s3-host-reasoning-action"
              onClick={onRequestHostReasoning}
              disabled={reasoningPending}
              aria-busy={reasoningPending || undefined}
              data-testid="screen03-request-host-reasoning"
            >
              {reasoningPending && (
                <span className="s3-spinner" aria-hidden="true" />
              )}
              {actionLabel}
            </button>
          )}
          {onRequestHostReasoning && (
            <small
              className="s3-brief__action-help"
              {...(reasoningPending
                ? { role: "status", "aria-live": "polite" as const }
                : {})}
            >
              {reasoningPending
                  ? rich
                    ? "This card remains an unchanged snapshot while ChatGPT handles the new packet and render sequence. Review the newest ShockAudit card that appears with the render result."
                    : "This card remains an unchanged factual fallback. ChatGPT must read the bounded packet, then render the proposal in a new ShockAudit card in the conversation."
                  : hostReasoningStatus === "unavailable"
                    ? rich
                      ? "The latest render call did not reopen a newer widget. The current proposal remains available and is unchanged."
                      : "ChatGPT did not complete a validated render call. This fixed, source-linked factual fallback is not ChatGPT-generated."
                    : "Uses this ChatGPT conversation. It never confirms a claim for you. One visible turn requests the evidence packet, host reasoning, and a new result card; this earlier card remains a snapshot."}
            </small>
          )}
        </div>
      </div>

      <article className="s3-snapshot">
        {activeHostContent && activeHostProposal ? (
          <>
            <h3 className="s3-snapshot__title">
              {activeHostContent.title}
            </h3>
            {activeHostContent.oneSentenceSummary && (
              <p className="s3-snapshot__intro">
                {activeHostContent.oneSentenceSummary}{" "}
                <InterpretationInlineSources
                  state={state}
                  evidenceIds={activeHostContent.sectionEvidenceIds.oneSentenceSummary}
                  sourceNumbers={sourceNumbers}
                  testId="screen03-host-briefing-citations-summary"
                />
              </p>
            )}
            <p className={`s3-briefing-status s3-briefing-status--${activeHostContent.briefingStatus}`}>
              {activeHostContent.briefingStatus === "complete"
                ? "Complete against the bounded evidence packet"
                : activeHostContent.briefingStatus === "evidence-conflicted"
                  ? "Evidence-conflicted briefing — conflicts remain unresolved"
                  : "Evidence-insufficient briefing — gaps remain explicit"}
            </p>
            {hostBriefingSections.length > 0 && (
              <ul
                className="s3-snapshot__points"
                data-testid="screen03-host-briefing-sections"
              >
                {hostBriefingSections.map((section) => (
                  <li key={section.key}>
                    <strong>{section.heading}</strong>
                    <p>
                      {section.text}{" "}
                      <InterpretationInlineSources
                        state={state}
                        evidenceIds={activeHostContent.sectionEvidenceIds[section.key]}
                        sourceNumbers={sourceNumbers}
                        testId={`screen03-host-briefing-citations-${section.key}`}
                      />
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {activeHostContent.plausiblePathwayToResearcherOutcome && (
              <section
                className="s3-snapshot__study"
                data-testid="screen03-host-briefing-pathway"
              >
                <span className="s3-eyebrow">ChatGPT interpretation</span>
                <h3>ChatGPT interpretation: plausible pathway to the researcher outcome</h3>
                <p>{activeHostContent.plausiblePathwayToResearcherOutcome}</p>
                <p className="s3-snapshot__guardrail">{INTERPRETATION_CAVEAT}</p>
              </section>
            )}
            {activeHostContent.unresolvedUncertainties.length > 0 && (
              <section
                className="s3-host-briefing-uncertainties"
                data-testid="screen03-host-briefing-uncertainties"
              >
                <h3>Unresolved uncertainties</h3>
                <ul>
                  {activeHostContent.unresolvedUncertainties.map((uncertainty) => (
                    <li key={uncertainty}>{uncertainty}</li>
                  ))}
                </ul>
              </section>
            )}
            {(activeHostProposal.provenance.uncertaintySnapshot?.length ?? 0) > 0 && (
              <section
                className="s3-host-briefing-uncertainties"
                data-testid="screen03-host-briefing-packet-uncertainties"
              >
                <h3>Packet-recorded gaps and conflicts</h3>
                <p>
                  These fixed descriptions come from the proposal-era bounded
                  packet, not from ChatGPT wording.
                </p>
                <ul>
                  {activeHostProposal.provenance.uncertaintySnapshot!.map((item) => (
                    <li key={`${item.kind}:${item.id}`}>
                      <strong>
                        {item.kind === "missing-evidence"
                          ? "Missing evidence"
                          : item.kind === "unresolved-conflict"
                            ? "Unresolved conflict"
                            : "Conflicted claim"}:
                      </strong>{" "}{item.description}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {activeHostContent.conciseRationale && (
              <details className="s3-host-briefing-rationale">
                <summary>Why ChatGPT structured the briefing this way</summary>
                <p>{activeHostContent.conciseRationale}</p>
              </details>
            )}
            <section
              className={`s3-host-proposal-review s3-host-proposal-review--${hostBriefingDecision}`}
              aria-labelledby="s3-host-proposal-review-title"
              data-testid="screen03-host-briefing-review"
            >
              <div>
                <strong id="s3-host-proposal-review-title">
                  {hostBriefingDecision === "confirmed"
                    ? "Researcher confirmed this briefing"
                    : hostBriefingDecision === "revised"
                      ? "Researcher revised and confirmed this briefing"
                    : "Researcher review required"}
                </strong>
                <p>
                  {hostBriefingDecision === "confirmed"
                    ? "The human decision is recorded separately from the original ChatGPT host proposal."
                    : hostBriefingDecision === "revised"
                      ? "The researcher revision is recorded separately; the original ChatGPT proposal and evidence links remain in the audit history."
                    : "This proposal is not an approved Event Card fact. Review its linked evidence before confirming or rejecting it."}
                </p>
              </div>
              {hostBriefingDecision === "proposed" && onReviewHostBriefing && (
                <div className="s3-host-proposal-review__actions">
                  <button
                    type="button"
                    className="s3-primary"
                    onClick={() => onReviewHostBriefing({ action: "confirm" })}
                    data-testid="screen03-confirm-host-briefing"
                  >
                    Confirm briefing
                  </button>
                  <button
                    type="button"
                    className="s3-action--reject"
                    onClick={() => onReviewHostBriefing({ action: "reject" })}
                    data-testid="screen03-reject-host-briefing"
                  >
                    Reject briefing
                  </button>
                  <BriefingRevisionForm
                    content={activeHostContent}
                    onReview={onReviewHostBriefing}
                  />
                </div>
              )}
            </section>
            {latestHostProposalWasRejected &&
              (hostBriefingDecision === "confirmed" ||
                hostBriefingDecision === "revised") && (
                <p
                  className="s3-host-proposal-review s3-host-proposal-review--rejected"
                  role="status"
                  data-testid="screen03-host-briefing-rejected"
                >
                  <strong>The researcher rejected the latest ChatGPT proposal.</strong>{" "}
                  The previously confirmed briefing remains displayed.
                </p>
              )}
          </>
        ) : legacyRich ? (
          <>
            <h3 className="s3-snapshot__title">
              {state.eventIdentity.canonicalTitle}
            </h3>
            <p className="s3-snapshot__intro">
              {interpretation.snapshot.intro.text}{" "}
              <InterpretationInlineSources
                state={state}
                evidenceIds={interpretation.snapshot.intro.evidenceIds}
                sourceNumbers={sourceNumbers}
                testId="screen03-briefing-citations-intro"
              />
            </p>
            {interpretation.snapshot.keyPoints.length > 0 && (
              <ul className="s3-snapshot__points">
                {interpretation.snapshot.keyPoints.slice(0, 6).map((point, index) => (
                  <li key={`${index}:${point.text}`}>
                    <strong>{interpretationPointHeading(state, point)}</strong>
                    <p>
                      {point.text}{" "}
                      <InterpretationInlineSources
                        state={state}
                        evidenceIds={point.evidenceIds}
                        sourceNumbers={sourceNumbers}
                        testId={`screen03-briefing-citations-point-${index + 1}`}
                      />
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {showStudyRelevance && (
              <section
                className="s3-snapshot__study"
                data-testid="screen03-study-relevance"
              >
                <span className="s3-eyebrow">Frozen Screen 2 study</span>
                <h3>Why this may matter for your study</h3>
                <p className="s3-snapshot__scope">
                  <strong>{display(interpretation.studyContext.population)}</strong>
                  {" in "}<strong>{display(interpretation.studyContext.geography)}</strong>
                  {" · "}{display(interpretation.studyContext.industry)}
                  {" · "}{display(interpretation.studyContext.studyPeriod)}
                  {" · outcome: "}<strong>{display(interpretation.studyContext.outcomeFamily)}</strong>
                </p>
                <div className="s3-snapshot__connections">
                  <p>
                    <strong>Connection to your sample.</strong>{" "}
                    {interpretation.studyRelevance.sampleConnection.text}{" "}
                    <InterpretationInlineSources
                      state={state}
                      evidenceIds={interpretation.studyRelevance.sampleConnection.evidenceIds}
                      sourceNumbers={sourceNumbers}
                      testId="screen03-briefing-citations-study-sample"
                    />
                  </p>
                  <p>
                    <strong>
                      ChatGPT interpretation: plausible pathway to {display(
                        interpretation.studyContext.outcomeFamily,
                      )}.
                    </strong>{" "}
                    {interpretation.studyRelevance.outcomeConnection.text}{" "}
                    <InterpretationInlineSources
                      state={state}
                      evidenceIds={interpretation.studyRelevance.outcomeConnection.evidenceIds}
                      sourceNumbers={sourceNumbers}
                      testId="screen03-briefing-citations-study-outcome"
                    />
                  </p>
                </div>
                <p className="s3-snapshot__guardrail">{INTERPRETATION_CAVEAT}</p>
              </section>
            )}
          </>
        ) : (
          <>
            <h3 className="s3-snapshot__title">
              {state.eventIdentity.canonicalTitle}
            </h3>
            {deterministicIntro ? (
              <p className="s3-snapshot__intro">
                {currentValue(deterministicIntro)}{" "}
                <InterpretationInlineSources
                  state={state}
                  evidenceIds={deterministicBriefingEvidenceIds(
                    state,
                    deterministicIntro,
                  )}
                  sourceNumbers={sourceNumbers}
                  testId="screen03-factual-summary-citations-intro"
                />
              </p>
            ) : (
              <p className="s3-snapshot__intro">
                No directly supported Event Card field is available for a
                factual summary yet. The bounded evidence and unresolved gaps
                remain visible below.
              </p>
            )}
            {deterministicPoints.length > 0 && (
              <ul
                className="s3-snapshot__points"
                data-testid="screen03-factual-summary-points"
              >
                {deterministicPoints.map((proposal, index) => (
                  <li key={proposal.id}>
                    <strong>{deterministicBriefingHeading(proposal)}</strong>
                    <p>
                      {currentValue(proposal)}{" "}
                      <InterpretationInlineSources
                        state={state}
                        evidenceIds={deterministicBriefingEvidenceIds(
                          state,
                          proposal,
                        )}
                        sourceNumbers={sourceNumbers}
                        testId={`screen03-factual-summary-citations-point-${index + 1}`}
                      />
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {hostBriefingDecision === "rejected" && (
              <p
                className="s3-host-proposal-review s3-host-proposal-review--rejected"
                role="status"
                data-testid="screen03-host-briefing-rejected"
              >
                <strong>Researcher rejected the latest ChatGPT host proposal.</strong>{" "}
                This source-linked factual fallback is shown instead; the rejected
                proposal remains in the audit history.
              </p>
            )}
            <p
              className="s3-snapshot__guardrail"
              data-testid="screen03-factual-summary-guardrail"
            >
              Fixed software assembled this fallback from directly linked
              Event Card fields. It adds no ChatGPT interpretation and does not
              resolve conflicts or unknowns.
            </p>
          </>
        )}
      </article>

      <p className="s3-identity__guardrail">
        Screen 3 checks the event selected on Screen 2. If the evidence points
        to a different event, return to Screen 2 before continuing.
      </p>
    </section>
  );
}

function AssessmentUnavailableReminders({
  proposals,
}: {
  proposals: Screen03VerificationState["proposals"]["requiredVariable"];
}) {
  if (proposals.length === 0) return null;
  return (
    <section
      className="s3-section s3-actionability"
      aria-labelledby="s3-assessment-checks-title"
      data-testid="screen03-assessment-unavailable-checks"
    >
      <div className="s3-section__heading">
        <div>
          <span className="s3-eyebrow">Planning reminders · no decision required</span>
          <h2 id="s3-assessment-checks-title">
            Additional checks to keep in mind
          </h2>
          <p>
            These reminders were carried forward because the preliminary
            Screen 2 assessment was unavailable. They do not change the
            verified Event Card and do not block continuation.
          </p>
        </div>
        <span className="s3-count">{proposals.length} reminder{proposals.length === 1 ? "" : "s"}</span>
      </div>
      <ul>
        {proposals.map((proposal, index) => (
          <li
            key={proposal.id}
            data-testid={`screen03-assessment-check-${index + 1}`}
          >
            <span aria-hidden="true">→</span>
            <strong>{proposal.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionabilityChecklist({
  proposals,
}: {
  proposals: Screen03VerificationState["proposals"]["requiredVariable"];
}) {
  return (
    <section
      className="s3-section s3-actionability"
      aria-labelledby="s3-variables-title"
      data-testid="screen03-actionability-checklist"
    >
      <div className="s3-section__heading">
        <div>
          <span className="s3-eyebrow">Planning aid · no decision required</span>
          <h2 id="s3-variables-title">{groupHeading.requiredVariable}</h2>
          <p>
            Collect these later. They are not evidence claims and do not block
            the Event Card.
          </p>
        </div>
        <span className="s3-count">{proposals.length} inputs</span>
      </div>
      <ul>{proposals.map((proposal) => (
        <li key={proposal.id} data-testid={`screen03-actionability-${proposal.id}`}>
          <span aria-hidden="true">→</span><strong>{proposal.value}</strong>
        </li>
      ))}</ul>
    </section>
  );
}

function CoverageEligibility({
  state,
  busy,
  onRetryResearch,
}: {
  state: Screen03VerificationState;
  busy: boolean;
  onRetryResearch: Screen03Props["onRetryResearch"];
}) {
  const eligibility = state.proposals.eligibility;
  const confirmed = eligibility.filter(
    (proposal) => LOCKED_DECISIONS.has(proposal.reviewStatus),
  ).length;
  const pending = eligibility.filter(
    (proposal) => proposal.reviewStatus === "proposed",
  ).length;
  const limitations = eligibility.filter(
    (proposal) =>
      proposal.reviewStatus === "rejected" ||
      proposal.reviewStatus === "unresolved",
  ).length;
  const direct = eligibility.filter(
    (proposal) => proposal.support === "direct",
  ).length;
  const searchFinished = state.researchCoverage.status === "completed";
  const stoppingMet = state.researchCoverage.stoppingRule.status === "met";

  const signalPanels = [
    ["Source search", [
      ["Source search", searchFinished ? "Finished" : titleCase(state.researchCoverage.status), searchFinished ? "complete" : "pending"],
      ["Search limit", stoppingMet ? "Reached as planned" : "Not reached", stoppingMet ? "complete" : "warning"],
      ["Records checked", state.researchCoverage.recordsReviewed, state.researchCoverage.recordsReviewed ? "complete" : "warning"],
      ["Supported routes", state.researchCoverage.routes.length, state.researchCoverage.routes.length ? "complete" : "warning"],
    ]],
    ["Coverage rules", [
      ["Confirmed rules", confirmed, "complete"],
      ["Need a decision", pending, pending ? "pending" : "complete"],
      ["Kept as limits", limitations, limitations ? "warning" : "complete"],
      ["With direct quotes", direct, direct ? "complete" : "warning"],
    ]],
  ] as const;

  return (
    <section
      className="s3-section s3-map"
      aria-labelledby="s3-map-title"
      data-testid="screen03-coverage-map"
    >
      <div className="s3-section__heading">
        <div>
          <span className="s3-eyebrow">Deterministic status · no hidden score</span>
          <h2 id="s3-map-title">What the search covered</h2>
          <p>This limited search is not exhaustive; counts are not scores.</p>
        </div>
        <button
          type="button"
          onClick={onRetryResearch}
          disabled={busy}
          aria-label="Refresh bounded supported-source research"
          data-testid="screen03-refresh-research"
        >
          Check for updated sources
        </button>
      </div>

      <div className="s3-map__grid" aria-label="Search and coverage-rule status">
        {signalPanels.map(([title, signals]) => (
          <div key={title} className="s3-map__panel">
            <h3>{title}</h3>
            <ul className="s3-signal-grid">
              {signals.map(([label, value, tone]) => (
                <li key={label} className={`s3-signal s3-signal--${tone}`}>
                  <span aria-hidden="true" />
                  <div><small>{label}</small><strong>{value}</strong></div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <details className="s3-disclosure">
        <summary>Known gaps and search boundary</summary>
        <div className="s3-disclosure__body">
          <p className="s3-search-summary">
            {state.researchCoverage.activeEvidenceCount} sources support claims;
            {" "}{state.researchCoverage.stages.length} event stages and{" "}
            {state.researchCoverage.languages.length} languages were represented.
            {" "}{state.researchCoverage.stoppingRule.note}
          </p>
          <div className="s3-gaps">
            <h3>Known gaps</h3>
            {state.researchCoverage.gaps.length ? (
              <ul>{state.researchCoverage.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
            ) : (
              <p>No gap was recorded inside this bounded search.</p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}

function TechnicalProvenance({ state }: { state: Screen03VerificationState }) {
  return (
    <details
      className="s3-section s3-provenance"
      data-testid="screen03-technical-provenance"
    >
      <summary>
        <span>
          <span className="s3-eyebrow">Collapsed by default</span>
          <strong>Technical source provenance</strong>
          <small>Source IDs, retrieval details, and fingerprints</small>
        </span>
        <span className="s3-count">{state.evidence.length} sources</span>
      </summary>
      <div className="s3-provenance__body">
        <pre><code>{state.evidence.map((source) => [
          source.title,
          `${source.publisher} · tier ${source.authorityTier} · ${source.language} · ${source.retrievedAt}`,
          `role ${source.sourceRole ?? "legacy-untyped"} · platform ${source.sourcePlatform ?? "legacy-untyped"} · document ${source.documentType ?? "legacy-untyped"}`,
          source.id,
          source.locator,
          source.contentFingerprint,
          source.passages.map((passage) => passage.id).join(", ") || "No passage IDs",
        ].join("\n")).join("\n\n") || "No evidence items are available."}</code></pre>
      </div>
    </details>
  );
}

function ContextLeads({ state }: { state: Screen03VerificationState }) {
  const leads = state.contextLeads ?? [];
  if (!leads.length) return null;
  return (
    <section className="s3-section" data-testid="screen03-context-leads">
      <div className="s3-section__heading"><div>
        <span className="s3-eyebrow">Related online sources · inspect before use</span>
        <h2>Additional sources to review</h2>
        <p>
          These related results may support a claim when their page contains a
          relevant passage. A title or search result alone is not treated as
          evidence; open the source and verify its wording.
        </p>
      </div><span className="s3-count">{leads.length} leads</span></div>
      <ul>{leads.map((lead) => <li key={lead.id}>
        <strong>{lead.title}</strong>{" · "}{lead.publisher}{lead.publishedDate ? ` · ${lead.publishedDate}` : ""}{" · "}
        <a
          href={contextLeadSearchLocator(lead)}
          target="_blank"
          rel="noreferrer"
        >Find this title</a>
      </li>)}</ul>
    </section>
  );
}

export default function Screen03({
  state,
  busy = false,
  researchBusy = false,
  errorMessage = null,
  hostReasoningStatus,
  hostBriefingDecision,
  onRetryResearch,
  onFindDirectSupport,
  hostTaskStatus,
  onCheckHostTask,
  onRetryHostTask,
  hostReasoningMode,
  hostEvidenceTaskStatus,
  hostOverviewTaskStatus,
  hostOverviewResult,
  onRequestEvidenceMapping,
  onCheckEvidenceMapping,
  onRetryEvidenceMapping,
  onRequestOverviewImprovement,
  onCheckOverviewImprovement,
  onRetryOverviewImprovement,
  onRequestHostReasoning,
  onReviewHostBriefing,
  onReviewField,
  onReviewAll,
  onLockEventCard,
  onOpenScreen4,
  onBack,
}: Screen03Props) {
  const locked = state.status === "locked";
  const researching =
    researchBusy ||
    state.status === "loading" ||
    state.researchCoverage.status === "pending";
  const factualClaims = useMemo(
    () => screen03FactualClaims(state.proposals),
    [state.proposals],
  );
  const mappableClaimCount = factualClaims.filter(
    (proposal) => proposal.support !== "direct",
  ).length;
  const hasAuthoritativePassages = state.evidence.some(
    (evidence) =>
      screen03EvidenceItemProvidesAuthoritativeDirectSupport(evidence) &&
      evidence.passages.length > 0,
  );
  const evidenceMappingAvailable =
    hostReasoningMode === "full" && mappableClaimCount > 0 &&
    hasAuthoritativePassages && Boolean(onRequestEvidenceMapping);
  const mandatoryAssessmentChecks = useMemo(
    () => state.proposals.requiredVariable.filter(
      screen03ProposalIsAssessmentUnavailableCheck,
    ),
    [state.proposals.requiredVariable],
  );
  const planningVariables = useMemo(
    () => state.proposals.requiredVariable.filter(
      (proposal) => !screen03ProposalIsAssessmentUnavailableCheck(proposal),
    ),
    [state.proposals.requiredVariable],
  );
  const passageById = useMemo(() => {
    const passages = new Map<string, LinkedPassage>();
    let globalNumber = 0;
    for (const source of state.evidence) {
      for (const passage of source.passages) {
        globalNumber += 1;
        passages.set(passage.id, { number: globalNumber, source, passage });
      }
    }
    return passages;
  }, [state.evidence]);
  let pendingDecisionCount = 0;
  let acceptedWithoutDirectSupportCount = 0;
  let confirmedDecisionCount = 0;
  let stillNeedsReviewCount = 0;
  let rejectedDecisionCount = 0;
  let bulkConfirmationWouldChange = false;
  for (const proposal of factualClaims) {
    const confirmable = screen03ProposalConfirmability(
      proposal,
      state.evidence,
      currentValue(proposal),
      proposal.reviewStatus === "edited",
    ).confirmable;
    if (proposal.reviewStatus === "proposed") pendingDecisionCount += 1;
    if (LOCKED_DECISIONS.has(proposal.reviewStatus) && confirmable) {
      confirmedDecisionCount += 1;
    }
    if (
      proposal.reviewStatus === "proposed" ||
      proposal.reviewStatus === "unresolved" ||
      (LOCKED_DECISIONS.has(proposal.reviewStatus) && !confirmable)
    ) stillNeedsReviewCount += 1;
    if (proposal.reviewStatus === "rejected") rejectedDecisionCount += 1;
    if (
      LOCKED_DECISIONS.has(proposal.reviewStatus) &&
      !confirmable
    ) acceptedWithoutDirectSupportCount += 1;
    if (
      confirmable &&
      (proposal.reviewStatus === "proposed" ||
        proposal.reviewStatus === "unresolved")
    ) {
      bulkConfirmationWouldChange = true;
    }
  }
  const acceptedIdentity = state.proposals.identity.some((proposal) =>
    LOCKED_DECISIONS.has(proposal.reviewStatus) &&
    screen03ProposalConfirmability(
      proposal,
      state.evidence,
      currentValue(proposal),
      proposal.reviewStatus === "edited",
    ).confirmable);
  const nextUndecidedClaim = factualClaims.find(
    (proposal) => proposal.reviewStatus === "proposed",
  ) ?? null;
  const lockBlockers: string[] = [];
  if (state.researchCoverage.status !== "completed") lockBlockers.push("The source search must finish before saving.");
  if (!researching && nextUndecidedClaim) {
    const section = factualClaimSection(nextUndecidedClaim);
    lockBlockers.push(
      pendingDecisionCount === 1
        ? `One claim in “${section}” still needs your decision.`
        : `${pendingDecisionCount} factual claims still need decisions. The next is in “${section}”.`,
    );
  }
  if (!researching && acceptedWithoutDirectSupportCount) lockBlockers.push(`${acceptedWithoutDirectSupportCount} confirmed claim${acceptedWithoutDirectSupportCount === 1 ? " has" : "s have"} lost supporting evidence.`);
  if (!researching && !acceptedIdentity) lockBlockers.push("Confirm one directly supported identity claim.");
  const readyToLock = !busy && !researching && lockBlockers.length === 0;
  const reviewSections = [
    ["s3-event-facts-title", "Event identity and summary", "Confirm identity and summary.", factualClaims.filter((proposal) => proposal.group === "identity" || proposal.group === "overview")],
    ["s3-components-title", groupHeading.component, "Check each change against its quote.", factualClaims.filter((proposal) => proposal.group === "component")],
    ["s3-eligibility-title", groupHeading.eligibility, "Confirm coverage, thresholds, and exemptions.", factualClaims.filter((proposal) => proposal.group === "eligibility")],
    ["s3-amendments-title", groupHeading.amendment, "Check later changes separately.", factualClaims.filter((proposal) => proposal.group === "amendment")],
  ] as const;
  if (!locked && !researching) {
    const renderedClaimIds = new Set(
      [
        ...state.proposals.timeline.map((proposal) => proposal.id),
        ...reviewSections.flatMap(([, , , proposals]) =>
          proposals.map((proposal) => proposal.id)
        ),
      ],
    );
    const hiddenPendingClaim = factualClaims.find(
      (proposal) =>
        proposal.reviewStatus === "proposed" &&
        !renderedClaimIds.has(proposal.id),
    );
    if (hiddenPendingClaim) {
      throw new Error(
        `Pending factual claim ${hiddenPendingClaim.id} has no visible decision card.`,
      );
    }
  }

  function goToNextUndecidedClaim() {
    if (!nextUndecidedClaim) return;
    const card = document.getElementById(
      `screen03-factual-claim-${nextUndecidedClaim.id}`,
    );
    if (!card) {
      throw new Error(
        `Pending factual claim ${nextUndecidedClaim.id} has no visible decision card.`,
      );
    }
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    card.focus({ preventScroll: true });
  }

  return (
    <main
      className="s3"
      data-testid="screen03"
      data-screen03-status={state.status}
      aria-busy={busy || researching}
    >
      <nav className="s3-back" aria-label="Screen 3 navigation">
        <button type="button" onClick={onBack} data-testid="screen03-back">
          <span aria-hidden="true">←</span> Back to chosen shock
        </button>
        <span>Screen 3 of 8</span>
      </nav>

      <header className="s3-hero">
        <div>
          <span className="s3-eyebrow">Verify the chosen event</span>
          <h1>Verify what changed and when</h1>
          <p>Check the timeline and cited claims.</p>
        </div>
        <span className={`s3-status s3-status--${state.status}`}>
          <span aria-hidden="true" />
          {locked
            ? "Event Card locked"
            : researching
              ? "Research in progress"
              : busy
                ? "Saving your review"
              : "Researcher review"}
        </span>
      </header>

      {hostReasoningMode !== undefined && hostReasoningMode !== "full" && (
        <p
          className="s3-host-task-unavailable"
          role="status"
          data-testid="screen03-host-reasoning-unavailable"
        >
          Optional ChatGPT passage mapping and overview improvement are
          unavailable in this release. The fixed orientation, official-source
          search, evidence review, and researcher controls remain available.
        </p>
      )}

      {hostTaskStatus && onCheckHostTask && (
        <Suspense fallback={<p role="status">Loading task status…</p>}>
        <HostTaskStatusPanel
          task={hostTaskStatus}
          busy={busy || researching}
          onCheck={onCheckHostTask}
          onRetry={onRetryHostTask}
        />
        </Suspense>
      )}

      {hostEvidenceTaskStatus && onCheckEvidenceMapping && (
        <Suspense fallback={<p role="status">Loading task status…</p>}>
        <HostTaskStatusPanel
          task={hostEvidenceTaskStatus}
          busy={busy || researching}
          onCheck={onCheckEvidenceMapping}
          onRetry={onRetryEvidenceMapping}
        />
        </Suspense>
      )}

      {hostOverviewTaskStatus && onCheckOverviewImprovement && (
        <Suspense fallback={<p role="status">Loading task status…</p>}>
        <HostTaskStatusPanel
          task={hostOverviewTaskStatus}
          busy={busy || researching}
          onCheck={onCheckOverviewImprovement}
          onRetry={onRetryOverviewImprovement}
        />
        </Suspense>
      )}

      {!locked && (
        <section
          className="s3-section s3-section__heading s3-bulk-review"
          aria-labelledby="s3-bulk-review-title"
          data-testid="screen03-bulk-review"
        >
          <div>
            <span className="s3-eyebrow">Optional shortcut</span>
            <h2 id="s3-bulk-review-title">Confirm directly supported claims</h2>
            <p>
              Confirm every visible claim that has active direct official
              support. Indirect, unsupported, stale, and conflicting claims
              stay unchanged and still require an individual decision.
              Corrections and Not correct decisions are preserved.
            </p>
            <p
              className="s3-bulk-review__status"
              role="status"
              aria-live="polite"
              data-testid="screen03-bulk-review-status"
            >
              {`${confirmedDecisionCount} confirmed · ${stillNeedsReviewCount} still need${stillNeedsReviewCount === 1 ? "s" : ""} review · ${rejectedDecisionCount} not correct`}
            </p>
          </div>
          <div className="s3-bulk-review__actions">
            <button
              type="button"
              className="s3-primary"
              data-testid="screen03-confirm-all"
              disabled={busy || researching || !bulkConfirmationWouldChange}
              aria-busy={busy || undefined}
              onClick={() => onReviewAll("confirm")}
            >
              Confirm directly supported claims
            </button>
            {nextUndecidedClaim && (
              <button
                type="button"
                data-testid="screen03-next-undecided-claim"
                disabled={busy || researching}
                onClick={goToNextUndecidedClaim}
              >
                Go to the next undecided claim
              </button>
            )}
            {evidenceMappingAvailable && onRequestEvidenceMapping && (
              <button
                type="button"
                data-testid="screen03-request-evidence-mapping"
                disabled={
                  busy || researching ||
                  hostTaskIsActive(hostEvidenceTaskStatus)
                }
                aria-busy={
                  hostTaskIsActive(hostEvidenceTaskStatus) || undefined
                }
                onClick={onRequestEvidenceMapping}
              >
                Ask ChatGPT to locate supporting passages
              </button>
            )}
            <button
              type="button"
              data-testid="screen03-unconfirm-all"
              disabled={
                busy ||
                researching ||
                factualClaims.every(
                  (proposal) =>
                    proposal.reviewStatus === "proposed" &&
                    proposal.editedValue === null,
                )
              }
              onClick={() => onReviewAll("unconfirm")}
            >
              Clear all decisions
            </button>
          </div>
        </section>
      )}

      {errorMessage && (
        <div className="s3-alert s3-alert--error" role="alert">
          <div>
            <strong>ShockAudit could not complete this Screen 3 action</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {researching && (
        <div className="s3-alert" role="status" aria-live="polite">
          <span className="s3-spinner" aria-hidden="true" />
          <div>
            <strong>Checking the event across supported online records</strong>
            <p>Results appear when this bounded search finishes.</p>
          </div>
        </div>
      )}

      <Timeline
        state={state}
        proposals={state.proposals.timeline}
        passageById={passageById}
        locked={locked}
        busy={busy || researching}
        onReviewField={onReviewField}
        onFindDirectSupport={onFindDirectSupport}
      />

      <EventBrief
        state={state}
        hostReasoningStatus={hostReasoningStatus}
        hostBriefingDecision={hostBriefingDecision}
        onRequestHostReasoning={onRequestHostReasoning}
        onReviewHostBriefing={onReviewHostBriefing}
        hostReasoningMode={hostReasoningMode}
        hostOverviewTaskStatus={hostOverviewTaskStatus}
        hostOverviewResult={hostOverviewResult}
        onRequestOverviewImprovement={onRequestOverviewImprovement}
      />

      {reviewSections.map(([id, title, description, proposals]) => (
        <ProposalSection
          key={id}
          state={state}
          id={id}
          title={title}
          description={description}
          proposals={proposals as Proposal[]}
          passageById={passageById}
          locked={locked}
          busy={busy || researching}
          onReviewField={onReviewField}
          onFindDirectSupport={onFindDirectSupport}
        />
      ))}

      <AssessmentUnavailableReminders
        proposals={mandatoryAssessmentChecks}
      />

      <ActionabilityChecklist proposals={planningVariables} />

      <CoverageEligibility
        state={state}
        busy={busy}
        onRetryResearch={onRetryResearch}
      />

      <ContextLeads state={state} />

      <TechnicalProvenance state={state} />

      <section
        className={`s3-lock s3-lock--${locked ? "locked" : readyToLock ? "ready" : "blocked"}`}
        aria-labelledby="s3-lock-title"
        data-testid="screen03-finish-gate"
        data-status={locked ? "locked" : readyToLock ? "ready" : "blocked"}
      >
        <div>
          <span className="s3-eyebrow">Final check</span>
          <h2 id="s3-lock-title">
            {locked
              ? "Verified Event Card saved"
              : readyToLock
                ? "Ready to save the verified Event Card"
                : "Finish the checks before saving"}
          </h2>
          <p>
            Saving preserves evidence, decisions, and limitations.
          </p>
          {!locked && (
            <section
              aria-labelledby="screen04-entry-gate-title"
              data-testid="screen04-entry-gate"
            >
              <h3 id="screen04-entry-gate-title">
                Finish verifying the shock first
              </h3>
              <p>
                Resolve all visible factual claims and lock the Event Card
                before auditing exposure in your sample.
              </p>
            </section>
          )}
          {!locked && lockBlockers.length > 0 && (
            <ul>{lockBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
          )}
          {locked && state.lockedEventCard && (
            <details className="s3-lock__technical">
              <summary>Event Card fingerprint</summary>
              <code>{state.lockedEventCard.eventCardFingerprint}</code>
            </details>
          )}
        </div>
        {!locked && (
          <button
            className="s3-primary"
            type="button"
            disabled={!readyToLock}
            data-testid="screen03-save-event-card"
            onClick={onLockEventCard}
          >
            Save verified Event Card
          </button>
        )}
        {locked && onOpenScreen4 && (
          <button
            className="s3-primary"
            type="button"
            data-testid="screen03-open-screen04"
            onClick={onOpenScreen4}
          >
            Audit exposure in your sample
          </button>
        )}
      </section>

      <p className="s3-method-note">
        No outcome values were inspected.
      </p>
    </main>
  );
}
