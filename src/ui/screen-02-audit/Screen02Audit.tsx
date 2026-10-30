import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  screen02AssessmentUnavailableScreen03Checks,
  type Screen02AuditAnchorFields,
  type Screen02AuditState,
  type Screen02AuditVersionType,
  type Screen02ProvisionalClaim,
  type Screen02WorkflowSource,
} from "../../core/screen02-workflow-types";
import {
  screen02AuditAssessmentUnavailableContinuationGate,
} from "../../core/screen02-workflow-state";
import {
  auditPhaseCopy,
  formatAuditDate,
  lifecycleCopy,
  measurementPotentialCopy,
  outcomePathwayCopy,
  preliminaryJudgmentCopy,
  readableAuditChannel,
  relationshipCopy,
  screen02AuditCopy,
  sourceAuthorityLabel,
  studyFitCopy,
  versionTypeCopy,
} from "./content";
import {
  buildScreen02AuditViewModel,
  isRetryableAuditRequest,
  type Screen02AuditMatchView,
  type Screen02AuditViewModel,
} from "./audit-view-model";
import Screen02WorkflowReset from "../screen-02/Screen02WorkflowReset";
import ContextLeads from "../screen-02/ContextLeads";
import { screen02ProviderNeutralCopy } from
  "../screen-02/provider-neutral-copy";
import {
  screen02UnavailableAssessmentAcknowledgment,
  screen02UnavailableAssessmentReason,
  screen02TemporaryWorkflowRetention,
} from "../screen-02/content";
import "./screen-02-audit.css";

const secondaryButtonClassName =
  "s2-audit-button s2-audit-button--secondary";
const dossierSectionClassName = "s2-audit-dossier-section";
const activeAssessmentStatuses = new Set([
  "prepared",
  "message-delivered",
  "draft-received",
  "validating",
]);

export type Screen02AuditAnchorRevisionDraft = Screen02AuditAnchorFields;

export type Screen02AuditProps = {
  state: Screen02AuditState;
  busy?: boolean;
  /** View-only selection. Canonical Audit state is never mutated here. */
  openedMatchSnapshotId?: string | null;
  onReviseAnchor: (
    draft: Screen02AuditAnchorRevisionDraft,
    reason: string,
  ) => void;
  onOpenMatch: (matchSnapshotId: string) => void;
  onConfirmMatch: (matchSnapshotId: string, reason: string) => void;
  onChooseRelatedVersion: (
    matchSnapshotId: string,
    reason: string,
  ) => void;
  onRejectMatch: (matchSnapshotId: string, reason: string) => void;
  onNoMatch: (reason: string) => void;
  onRetryDossier?: (matchSnapshotId: string) => void;
  onRetryAssessment?: (confirmationSnapshotId: string) => void;
  onContinue: () => void;
  onContinueWithoutAssessment?: (
    reason: string,
    acknowledgment: string,
  ) => void;
  onReconsiderIdentity: (reason: string) => void;
  onEditStudy: () => void;
  onReset: () => void;
  onAddSource?: () => void;
};

const versionTypes: Screen02AuditVersionType[] = [
  "unspecified",
  "original",
  "amendment",
  "implementing-rule",
  "enforcement-action",
];

function formText(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

function nullableFormText(form: HTMLFormElement, name: string) {
  const value = formText(form, name);
  return value || null;
}

function PhaseNavigator({ view }: { view: Screen02AuditViewModel }) {
  const activeIndex = auditPhaseCopy.findIndex(
    (phase) => phase.id === view.phase,
  );
  const assessmentComplete = view.assessment?.status === "completed";
  return (
    <nav className="s2-audit-phases" aria-label="Audit phases">
      <ol>
        {auditPhaseCopy.map((phase, index) => {
          const complete = index < activeIndex || (index === 3 && assessmentComplete);
          const active = index === activeIndex && !complete;
          return (
            <li
              key={phase.id}
              className={`${active ? "s2-audit-phases__item--active" : ""} ${
                complete ? "s2-audit-phases__item--complete" : ""
              }`}
              aria-current={active ? "step" : undefined}
            >
              <span aria-hidden="true">{complete ? "✓" : phase.number}</span>
              <div>
                <strong>{phase.title}</strong>
                <small>{phase.description}</small>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StudyContext({
  state,
  onEditStudy,
  onReset,
}: Pick<Screen02AuditProps, "state" | "onEditStudy" | "onReset">) {
  const study = state.screen01Baseline.scopeContract;
  return (
    <section className="s2-audit-study" aria-labelledby="s2-audit-study-title">
      <div className="s2-audit-section-heading">
        <div>
          <h2 id="s2-audit-study-title">Your confirmed study</h2>
          <p>{state.screen01Baseline.studySentence}</p>
        </div>
        <div className="s2-audit-study__actions">
          <button
            className={secondaryButtonClassName}
            type="button"
            onClick={onEditStudy}
          >
            Edit on Screen 1
          </button>
          <Screen02WorkflowReset
            mode="audit"
            buttonClassName="s2-audit-button s2-audit-button--quiet"
            onReset={onReset}
          />
        </div>
      </div>
      <dl className="s2-audit-study-grid">
        <div>
          <dt>Population</dt>
          <dd>{study.population}</dd>
        </div>
        <div>
          <dt>Study geography</dt>
          <dd>{study.geography}</dd>
        </div>
        <div>
          <dt>Study period</dt>
          <dd>{study.studyPeriod}</dd>
        </div>
        <div>
          <dt>Event family</dt>
          <dd>{study.eventFamily}</dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>{study.outcomeFamily}</dd>
        </div>
      </dl>
    </section>
  );
}

function AnchorWorkspace({
  state,
  view,
  onReviseAnchor,
  onAddSource,
}: Pick<
  Screen02AuditProps,
  "state" | "onReviseAnchor" | "onAddSource"
> & { view: Screen02AuditViewModel }) {
  const anchor = view.activeAnchor.fields;
  const identityLocked = Boolean(view.confirmedIdentity);
  const editLockReasonId = "s2-audit-anchor-edit-lock";
  const editorRef = useRef<HTMLDetailsElement>(null);
  const sourceLocatorRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [documentStatus, setDocumentStatus] = useState<string | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const fileUploadAvailable =
    typeof window !== "undefined" &&
    typeof window.openai?.uploadFile === "function" &&
    typeof window.openai?.getFileDownloadUrl === "function";
  const revealSourceLocator = () => {
    if (identityLocked) return;
    if (editorRef.current) editorRef.current.open = true;
    sourceLocatorRef.current?.focus();
    onAddSource?.();
  };
  const submitRevision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (identityLocked) return;
    const form = event.currentTarget;
    onReviseAnchor(
      {
        shockName: formText(form, "shockName"),
        jurisdiction: nullableFormText(form, "jurisdiction"),
        issuingAuthority: nullableFormText(form, "issuingAuthority"),
        approximateYear: nullableFormText(form, "approximateYear"),
        versionType: formText(form, "versionType") as Screen02AuditVersionType,
        distinguishingFeature: nullableFormText(
          form,
          "distinguishingFeature",
        ),
        sourceLocator: nullableFormText(form, "sourceLocator"),
        clarification: nullableFormText(form, "clarification"),
      },
      formText(form, "revisionReason"),
    );
  };
  const submitDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || identityLocked || documentBusy) return;
    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/xhtml+xml",
      "text/html",
      "text/plain",
    ]);
    const allowedExtension = /\.(?:pdf|txt|html?|xhtml)$/i.test(file.name);
    if (
      file.size <= 0 ||
      file.size > 300_000 ||
      (!allowedMimeTypes.has(file.type) && !allowedExtension)
    ) {
      setDocumentStatus(
        "Choose one PDF, plain-text, or HTML document no larger than 300 KB.",
      );
      return;
    }
    const host = window.openai;
    if (!host?.uploadFile || !host.getFileDownloadUrl) {
      setDocumentStatus(
        "Document upload is unavailable in this view. Paste an official public URL instead.",
      );
      return;
    }
    setDocumentBusy(true);
    setDocumentStatus(`Uploading ${file.name}…`);
    try {
      const uploaded = await host.uploadFile(file, { library: false });
      if (!uploaded.fileId) throw new Error("The upload returned no file ID.");
      const download = await host.getFileDownloadUrl({
        fileId: uploaded.fileId,
      });
      if (!download.downloadUrl) {
        throw new Error("The upload returned no temporary download URL.");
      }
      onReviseAnchor(
        {
          ...anchor,
          sourceLocator: download.downloadUrl,
          clarification: [
            anchor.clarification,
            `Researcher uploaded ${file.name} (${file.type || "type not reported"}) as provisional identity material.`,
          ]
            .filter(Boolean)
            .join(" "),
        },
        `Inspect the researcher-uploaded document ${file.name} as provisional identity material.`,
      );
      setDocumentStatus(
        `${file.name} was uploaded. The identity search record will show whether it could be inspected.`,
      );
    } catch (error) {
      setDocumentStatus(
        `The document could not be uploaded: ${
          error instanceof Error ? error.message : "unknown upload failure"
        }`,
      );
    } finally {
      setDocumentBusy(false);
    }
  };

  return (
    <section className="s2-audit-anchor" aria-labelledby="s2-audit-anchor-title">
      <div className="s2-audit-section-heading">
        <div>
          <span className="s2-audit-provenance">Researcher wording</span>
          <h2 id="s2-audit-anchor-title">Known-shock anchor</h2>
          <p>
            The exact wording from Screen 1 remains preserved while structured
            details guide identity retrieval.
          </p>
        </div>
        <span className="s2-audit-revision">
          Anchor revision {state.anchor.revisions.indexOf(view.activeAnchor) + 1}
        </span>
      </div>
      <blockquote>
        <small>Original wording</small>
        <p>{state.anchor.originalWording}</p>
      </blockquote>
      <dl className="s2-audit-anchor-grid">
        <div>
          <dt>Shock name</dt>
          <dd>{anchor.shockName}</dd>
        </div>
        <div>
          <dt>Jurisdiction</dt>
          <dd>{anchor.jurisdiction ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Issuing authority</dt>
          <dd>{anchor.issuingAuthority ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Approximate year</dt>
          <dd>{anchor.approximateYear ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Version type</dt>
          <dd>{versionTypeCopy[anchor.versionType]}</dd>
        </div>
        <div>
          <dt>Distinguishing feature</dt>
          <dd>{anchor.distinguishingFeature ?? "Not supplied"}</dd>
        </div>
        <div>
          <dt>Official URL</dt>
          <dd>
            {anchor.sourceLocator ? (
              <a href={anchor.sourceLocator} target="_blank" rel="noreferrer">
                {anchor.sourceLocator}
                <span className="s2-audit-sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              "Not supplied"
            )}
          </dd>
        </div>
        <div>
          <dt>Clarification</dt>
          <dd>{anchor.clarification ?? "Not supplied"}</dd>
        </div>
      </dl>

      {identityLocked && (
        <p
          id={editLockReasonId}
          className="s2-audit-disabled-reason"
          role="status"
        >
          Reconsider identity before revising the anchor or adding a source.
        </p>
      )}
      <div className="s2-audit-source-correction">
        <div className="s2-audit-source-correction__actions">
          <button
            className={secondaryButtonClassName}
            type="button"
            disabled={identityLocked}
            aria-describedby={identityLocked ? editLockReasonId : undefined}
            onClick={revealSourceLocator}
          >
            {anchor.sourceLocator
              ? "Replace official URL"
              : "Add an official URL"}
          </button>
          <button
            className={secondaryButtonClassName}
            type="button"
            disabled={identityLocked || documentBusy || !fileUploadAvailable}
            aria-describedby={
              identityLocked ? editLockReasonId : "s2-audit-document-help"
            }
            onClick={() => documentInputRef.current?.click()}
          >
            {documentBusy ? "Uploading document…" : "Upload a document"}
          </button>
          <input
            ref={documentInputRef}
            className="s2-audit-sr-only"
            type="file"
            aria-label="Upload an official shock document"
            aria-describedby="s2-audit-document-help"
            accept=".pdf,.txt,.html,.htm,.xhtml,application/pdf,text/plain,text/html,application/xhtml+xml"
            disabled={identityLocked || documentBusy || !fileUploadAvailable}
            onChange={(event) => void submitDocument(event)}
          />
        </div>
        <p>
          Paste the page for the exact shock or version you mean, then search
          again. Its title and bounded visible text remain provisional identity
          evidence until you confirm the match.
        </p>
        <p id="s2-audit-document-help">
          Where document upload is available, you may instead provide one PDF,
          text, or HTML document up to 300 KB. The file is inspected immediately
          through a temporary URL; PDF text is not treated as extracted evidence.
        </p>
        {!fileUploadAvailable && (
          <p className="s2-audit-disabled-reason">
            Document upload is unavailable in this view. The official-URL path
            remains available.
          </p>
        )}
        {documentStatus && (
          <p className="s2-audit-document-status" role="status" aria-live="polite">
            {documentStatus}
          </p>
        )}
      </div>
      <details
        ref={editorRef}
        className="s2-audit-anchor-form"
        open={!view.activeMatchSet && !identityLocked}
        key={view.activeAnchor.anchorRevisionId}
      >
        <summary>Correct the match or add an official URL</summary>
        <form
          onSubmit={submitRevision}
          aria-describedby={identityLocked ? editLockReasonId : undefined}
        >
          <p>
            Revise only what helps distinguish the intended event or version.
            The original wording above will remain unchanged.
          </p>
          <fieldset disabled={identityLocked}>
            <div className="s2-audit-form-grid">
            <label>
              <span>Shock name</span>
              <input name="shockName" defaultValue={anchor.shockName} required />
            </label>
            <label>
              <span>Jurisdiction</span>
              <input
                name="jurisdiction"
                defaultValue={anchor.jurisdiction ?? ""}
                placeholder="e.g., California, United States"
              />
            </label>
            <label>
              <span>Issuing authority</span>
              <input
                name="issuingAuthority"
                defaultValue={anchor.issuingAuthority ?? ""}
              />
            </label>
            <label>
              <span>Approximate year</span>
              <input
                name="approximateYear"
                defaultValue={anchor.approximateYear ?? ""}
                inputMode="numeric"
              />
            </label>
            <label>
              <span>Version type</span>
              <select name="versionType" defaultValue={anchor.versionType}>
                {versionTypes.map((versionType) => (
                  <option key={versionType} value={versionType}>
                    {versionTypeCopy[versionType]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Distinguishing feature</span>
              <input
                name="distinguishingFeature"
                defaultValue={anchor.distinguishingFeature ?? ""}
              />
            </label>
            <label className="s2-audit-form-grid__wide">
              <span>Official URL</span>
              <input
                ref={sourceLocatorRef}
                id="s2-audit-source-locator"
                name="sourceLocator"
                type="url"
                defaultValue={anchor.sourceLocator ?? ""}
                placeholder="https://"
              />
            </label>
            <label className="s2-audit-form-grid__wide">
              <span>Clarification</span>
              <textarea
                name="clarification"
                defaultValue={anchor.clarification ?? ""}
              />
            </label>
            <label className="s2-audit-form-grid__wide">
              <span>Reason for this revision</span>
              <textarea
                name="revisionReason"
                required
                placeholder="Explain what should be corrected or distinguished."
              />
            </label>
            </div>
            <div className="s2-audit-form-actions">
              <button
                className="s2-audit-button"
                type="submit"
                disabled={identityLocked}
              >
                Search with revised details
              </button>
            </div>
          </fieldset>
        </form>
      </details>
    </section>
  );
}

function IdentitySearchRecord({ view }: { view: Screen02AuditViewModel }) {
  const activeSet = view.activeMatchSet;
  if (!activeSet) return null;
  const manifest = activeSet.manifest;
  const suppliedUrl = view.activeAnchor.fields.sourceLocator;
  const urlChannel = manifest.channels.find(
    (channel) => channel.channel === "researcher-provided-url",
  );
  const urlFailed = Boolean(suppliedUrl && urlChannel?.status === "failed");
  const urlSucceeded = Boolean(
    suppliedUrl && urlChannel?.status === "searched",
  );

  return (
    <section
      className="s2-audit-search-record"
      aria-labelledby="s2-audit-search-record-title"
    >
      <div className="s2-audit-section-heading">
        <div>
          <span className="s2-audit-provenance">Retrieval record</span>
          <h2 id="s2-audit-search-record-title">Identity search record</h2>
          <p>
            See which routes were searched, which records were excluded, and
            whether the supplied URL was actually inspected.
          </p>
        </div>
      </div>

      {suppliedUrl && (
        <div
          className={`s2-audit-url-result ${
            urlFailed
              ? "s2-audit-url-result--failed"
              : urlSucceeded
                ? "s2-audit-url-result--searched"
                : "s2-audit-url-result--missing"
          }`}
          role="status"
        >
          <strong>
            {urlFailed
              ? "The supplied URL could not be inspected"
              : urlSucceeded
                ? "The supplied URL was inspected"
                : "No result was recorded for the supplied URL"}
          </strong>
          <span>
            {urlChannel?.note
              ? screen02ProviderNeutralCopy(urlChannel.note)
              :
              "Revise the anchor and search again before treating this URL as identity evidence."}
          </span>
        </div>
      )}

      <details open={urlFailed}>
        <summary>How this identity search was conducted</summary>
        <dl>
          <div>
            <dt>Search request</dt>
            <dd>{manifest.exactRequest}</dd>
          </div>
          <div>
            <dt>Retrieved</dt>
            <dd>{manifest.retrievedAt}</dd>
          </div>
          <div>
            <dt>Stopping rule</dt>
            <dd>{screen02ProviderNeutralCopy(manifest.stoppingRule.note)}</dd>
          </div>
        </dl>

        <h3>Source routes</h3>
        <ul>
          {manifest.channels.map((channel, index) => (
            <li key={`${channel.channel}:${index}`}>
              <strong>{readableAuditChannel(channel.channel)}</strong>
              <span>
                {channel.status.replace("-", " ")} · {screen02ProviderNeutralCopy(channel.note)}
              </span>
            </li>
          ))}
        </ul>

        <ContextLeads
          leads={manifest.contextLeads}
          note="These secondary-source leads can help locate discussion or implementation material. They cannot establish the event's identity or operative date."
        />

        {manifest.queryMatrix.length > 0 && (
          <>
            <h3>Queries</h3>
            <ul>
              {manifest.queryMatrix.map((query) => (
                <li key={query.id}>
                  <strong>{screen02ProviderNeutralCopy(query.purpose)}</strong>
                  <span>{screen02ProviderNeutralCopy(query.query)}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {manifest.exclusions.length > 0 && (
          <>
            <h3>Documented exclusions</h3>
            <ul>
              {manifest.exclusions.map((exclusion, index) => (
                <li key={`${exclusion.recordId}:${index}`}>
                  <strong>Excluded lead {index + 1}</strong>
                  <span>{screen02ProviderNeutralCopy(exclusion.reason)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  );
}

function MatchRow({
  row,
  onOpen,
}: {
  row: Screen02AuditMatchView;
  onOpen: () => void;
}) {
  const identity = row.match.identity;
  const status = row.dossier?.status === "completed"
    ? "Dossier ready"
    : row.dossierRequest
      ? lifecycleCopy[row.dossierRequest.status]
      : "Dossier not requested";
  const mainDate = row.sources
    .map((source) => source.publishedDate)
    .filter((date): date is string => Boolean(date))
    .sort()[0] ?? null;
  return (
    <li>
      <button
        className={`s2-audit-match ${row.opened ? "s2-audit-match--open" : ""} ${
          row.confirmed ? "s2-audit-match--confirmed" : ""
        }`}
        type="button"
        aria-pressed={row.opened}
        aria-controls="s2-audit-match-detail"
        onClick={onOpen}
      >
        <span className="s2-audit-match__title">
          <strong>{identity.commonNames[0] ?? identity.canonicalTitle}</strong>
          {row.confirmed && <b>Identity confirmed</b>}
          {row.disposition && (
            <b
              className={`s2-audit-match__disposition s2-audit-match__disposition--${row.disposition}`}
            >
              {row.disposition === "rejected"
                ? "Rejected"
                : "Marked related version"}
            </b>
          )}
          {row.currentNoMatchDecision && (
            <b className="s2-audit-match__disposition s2-audit-match__disposition--no-match">
              Snapshot closed · no match
            </b>
          )}
        </span>
        <span>{identity.canonicalTitle}</span>
        <span>
          {identity.issuingJurisdiction ?? "Jurisdiction unknown"} · {relationshipCopy[row.match.relationship]}
        </span>
        <span>
          {identity.issuer ?? "Issuing authority unknown"}
          {mainDate
            ? ` · Earliest online-source date: ${formatAuditDate(mainDate)}`
            : ""}
        </span>
        <span>{status}</span>
        <span>
          {row.sources.length} online source{row.sources.length === 1 ? "" : "s"} · {sourceAuthorityLabel(row.sources)}
        </span>
        <span className="s2-audit-sr-only">
          . Open the match-specific dossier for {identity.canonicalTitle}.
        </span>
      </button>
    </li>
  );
}

function ClaimSources({
  sourceIds,
  sourceById,
}: {
  sourceIds: readonly string[];
  sourceById: ReadonlyMap<string, Screen02WorkflowSource>;
}) {
  if (sourceIds.length === 0) {
    return <small className="s2-audit-claim__sources">No source attached</small>;
  }
  return (
    <small className="s2-audit-claim__sources">
      Source{sourceIds.length === 1 ? "" : "s"}: {sourceIds
        .map((sourceId) => sourceById.get(sourceId)?.title ?? sourceId)
        .join("; ")}
    </small>
  );
}

function Claim({
  claim,
  sourceById,
}: {
  claim: Screen02ProvisionalClaim;
  sourceById: ReadonlyMap<string, Screen02WorkflowSource>;
}) {
  return (
    <article className="s2-audit-claim">
      <p>{screen02ProviderNeutralCopy(claim.text)}</p>
      {claim.uncertainty && (
        <p className="s2-audit-claim__uncertainty">
          <strong>Unresolved:</strong>{" "}
          {screen02ProviderNeutralCopy(claim.uncertainty)}
        </p>
      )}
      <ClaimSources sourceIds={claim.sourceIds} sourceById={sourceById} />
    </article>
  );
}

function ClaimCollection({
  claims,
  sourceById,
  empty,
}: {
  claims: readonly Screen02ProvisionalClaim[];
  sourceById: ReadonlyMap<string, Screen02WorkflowSource>;
  empty: string;
}) {
  return claims.length > 0 ? (
    <div className="s2-audit-claim-list">
      {claims.map((claim) => (
        <Claim key={claim.id} claim={claim} sourceById={sourceById} />
      ))}
    </div>
  ) : (
    <p className="s2-audit-empty">{empty}</p>
  );
}

function SourceList({ sources }: { sources: readonly Screen02WorkflowSource[] }) {
  if (sources.length === 0) {
    return <p className="s2-audit-empty">No source is attached to this dossier.</p>;
  }
  return (
    <ul className="s2-audit-source-list">
      {sources.map((source) => {
        const linked = /^https?:\/\//i.test(source.locator);
        return (
          <li key={source.id}>
            <div>
              {linked ? (
                <a href={source.locator} target="_blank" rel="noreferrer">
                  {source.title}
                  <span className="s2-audit-sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <strong>{source.title}</strong>
              )}
              <small>
                {source.publisher}
                {source.publishedDate ? ` · ${source.publishedDate}` : ""}
                {` · retrieved ${source.retrievedAt}`}
                {source.userProvided ? " · added by researcher" : ""}
              </small>
            </div>
            <b>{sourceAuthorityLabel([source])}</b>
          </li>
        );
      })}
    </ul>
  );
}

function IdentityActions({
  row,
  onConfirmMatch,
  onChooseRelatedVersion,
  onRejectMatch,
}: Pick<
  Screen02AuditProps,
  "onConfirmMatch" | "onChooseRelatedVersion" | "onRejectMatch"
> & { row: Screen02AuditMatchView }) {
  const [reason, setReason] = useState("");
  const reasonReady = reason.trim().length > 0;
  const decisionLocked =
    row.disposition !== null || row.currentNoMatchDecision !== null;
  const gateReasonId = `s2-audit-confirm-gate-${row.match.matchSnapshotId}`;
  const actionReasonId = `s2-audit-action-reason-${row.match.matchSnapshotId}`;
  const actionReasonHelpId = `${actionReasonId}-help`;
  const describedBy = row.confirmationGate.eligible
    ? actionReasonHelpId
    : `${actionReasonHelpId} ${gateReasonId}`;

  return (
    <section className="s2-audit-identity-actions" aria-labelledby="s2-audit-identity-actions-title">
      <span className="s2-audit-provenance">Researcher decision</span>
      <h3 id="s2-audit-identity-actions-title">Confirm or correct this match</h3>
      <label htmlFor={actionReasonId}>Reason for the identity decision</label>
      <textarea
        id={actionReasonId}
        value={reason}
        onChange={(event) => setReason(event.currentTarget.value)}
        placeholder="Record why this is the intended shock, a related version, or a different event."
        disabled={decisionLocked}
        aria-describedby={describedBy}
        required
      />
      <p id={actionReasonHelpId} className="s2-audit-form-help">
        {decisionLocked
          ? "This identity decision has already been recorded."
          : !row.confirmationGate.eligible
            ? "Review the source-backed dossier first. The confirmation button will become available automatically when its required sections are ready."
            : !reasonReady
              ? "Add one short reason above to enable the identity buttons."
              : "Your reason is ready. Choose the identity decision that matches your judgment."}
      </p>
      {!row.confirmationGate.eligible && row.confirmationGate.visibleReason && (
        <p id={gateReasonId} className="s2-audit-disabled-reason" role="status">
          {row.confirmationGate.visibleReason}
        </p>
      )}
      <div className="s2-audit-identity-actions__buttons">
        <button
          className="s2-audit-button"
          type="button"
          disabled={
            decisionLocked || !row.confirmationGate.eligible || !reasonReady
          }
          aria-describedby={describedBy}
          onClick={
            decisionLocked
              ? undefined
              : () =>
                  onConfirmMatch(row.match.matchSnapshotId, reason.trim())
          }
        >
          {screen02AuditCopy.confirm}
        </button>
        <button
          className={secondaryButtonClassName}
          type="button"
          disabled={decisionLocked || !reasonReady}
          aria-describedby={describedBy}
          onClick={
            decisionLocked
              ? undefined
              : () =>
                  onChooseRelatedVersion(
                    row.match.matchSnapshotId,
                    reason.trim(),
                  )
          }
        >
          {screen02AuditCopy.relatedVersion}
        </button>
        <button
          className="s2-audit-button s2-audit-button--danger"
          type="button"
          disabled={decisionLocked || !reasonReady}
          aria-describedby={describedBy}
          onClick={
            decisionLocked
              ? undefined
              : () =>
                  onRejectMatch(row.match.matchSnapshotId, reason.trim())
          }
        >
          {screen02AuditCopy.reject}
        </button>
      </div>
    </section>
  );
}

function Dossier({
  state,
  row,
  sourceById,
  onRetryDossier,
  onConfirmMatch,
  onChooseRelatedVersion,
  onRejectMatch,
}: Pick<
  Screen02AuditProps,
  | "onRetryDossier"
  | "onConfirmMatch"
  | "onChooseRelatedVersion"
  | "onRejectMatch"
> & {
  state: Screen02AuditState;
  row: Screen02AuditMatchView;
  sourceById: ReadonlyMap<string, Screen02WorkflowSource>;
}) {
  const dossier = row.dossier;
  const identity = row.match.identity;
  const study = state.screen01Baseline.scopeContract;
  const fixedFallbackDossier = usedConservativeFixedFallback(
    row.dossierRequest,
  );
  if (!dossier) {
    const dossierUnavailable = Boolean(
      row.dossierRequest &&
        [
          "delivery-rejected",
          "no-tool-submission",
          "validation-failed",
          "timed-out",
        ].includes(row.dossierRequest.status),
    );
    const status = row.dossierRequest
      ? lifecycleCopy[row.dossierRequest.status]
      : "Preparing a match-specific provisional dossier…";
    const dossierPending = !row.dossierRequest ||
      activeAssessmentStatuses.has(row.dossierRequest.status);
    return (
      <section id="s2-audit-match-detail" className="s2-audit-dossier" role="status">
        <span className="s2-audit-provenance">Source-backed identity record</span>
        <h2>{identity.canonicalTitle}</h2>
        <p
          className="s2-audit-working-status"
          aria-busy={dossierPending || undefined}
        >
          {dossierPending && (
            <span className="s2-audit-spinner" aria-hidden="true" />
          )}
          <span>{status}</span>
        </p>
        <dl className="s2-audit-identity-grid">
          <div>
            <dt>Issuing authority</dt>
            <dd>{identity.issuer ?? "Not yet established"}</dd>
          </div>
          <div>
            <dt>Issuing jurisdiction</dt>
            <dd>{identity.issuingJurisdiction ?? "Not yet established"}</dd>
          </div>
          <div>
            <dt>Formal identifier</dt>
            <dd>{identity.formalIdentifier ?? "Not yet established"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{identity.status ?? "Not yet established"}</dd>
          </div>
        </dl>
        <p>
          {dossierUnavailable
            ? "The source-linked dossier did not arrive. Your immutable identity record and official sources are unchanged; retrying will not discard them."
            : "A source-linked snapshot is being prepared for this exact identity. It will appear here automatically. You can review the immutable identity record and online sources now."}
        </p>
        <h3>Online sources</h3>
        <SourceList sources={row.sources} />
        {onRetryDossier && isRetryableAuditRequest(row.dossierRequest) && (
          <button
            className={secondaryButtonClassName}
            type="button"
            onClick={() => onRetryDossier(row.match.matchSnapshotId)}
          >
            {row.dossierRequest?.status === "delivery-rejected"
              ? "Try preparing the dossier again"
              : "Retry missing dossier parts"}
          </button>
        )}
      </section>
    );
  }
  const preliminaryStudyRelation = /privacy|data protection/i.test(
    `${identity.eventType} ${identity.canonicalTitle}`,
  )
    ? `${study.population} in ${study.geography} during ${study.studyPeriod} may be exposed if they operate in the issuing jurisdiction, meet the law's coverage thresholds, and handle covered personal information. Firm-level coverage is still unverified.`
    : `${study.population} in ${study.geography} during ${study.studyPeriod} may be exposed if the event's operative scope reaches them directly or changes the market or institutions around them. Unit-level coverage is still unverified.`;
  const preliminaryOutcomeRelation = /privacy|data protection/i.test(
    `${identity.eventType} ${identity.canonicalTitle}`,
  )
    ? `${identity.canonicalTitle} could affect ${study.outcomeFamily} through compliance, data-governance, contracting, or legal costs; customer trust or retention could offset some costs. The direction and size are unknown.`
    : `${identity.canonicalTitle} could affect ${study.outcomeFamily} through direct obligations, costs, incentives, or spillovers. The direction and size are unknown.`;
  return (
    <article id="s2-audit-match-detail" className="s2-audit-dossier">
      <header className="s2-audit-dossier__header">
        <div>
          <span className="s2-audit-provenance">
            {fixedFallbackDossier
              ? "Saved source-derived · provisional dossier"
              : "Source-linked provisional dossier"}
          </span>
          <h2>{identity.canonicalTitle}</h2>
          <p>{screen02ProviderNeutralCopy(row.match.relationshipReason)}</p>
        </div>
        <span className="s2-audit-relationship">
          {relationshipCopy[row.match.relationship]}
        </span>
      </header>

      <p className="s2-audit-verification-note">
        {fixedFallbackDossier
          ? "This saved source-derived text is not a verified fact. Check every claim against its linked online source before confirming the identity."
          : "This provisional snapshot was prepared from the bounded source packet. Source links show the material used, but validation does not prove that every sentence follows from a source. Check the linked pages before confirming the identity."}
      </p>

      {dossier.status === "partial" && (
        <div className="s2-audit-dossier-status" role="status" aria-live="polite">
          <div>
            <strong>
              {row.dossierRequest
                ? lifecycleCopy[row.dossierRequest.status]
                : "The provisional dossier is incomplete."}
            </strong>
            <span>
              Ready sections remain visible. Identity confirmation waits for
              the required source-backed parts.
            </span>
          </div>
          {onRetryDossier && isRetryableAuditRequest(row.dossierRequest) && (
            <button
              className={secondaryButtonClassName}
              type="button"
              onClick={() => onRetryDossier(row.match.matchSnapshotId)}
            >
              {row.dossierRequest?.status === "delivery-rejected"
                ? "Try preparing the dossier again"
                : "Retry missing dossier parts"}
            </button>
          )}
        </div>
      )}

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-at-glance-title">
        <h3 id="s2-audit-at-glance-title">At a glance</h3>
        <dl className="s2-audit-identity-grid">
          <div>
            <dt>Canonical title</dt>
            <dd>{identity.canonicalTitle}</dd>
          </div>
          <div>
            <dt>Common names</dt>
            <dd>{identity.commonNames.join(", ") || "None recorded"}</dd>
          </div>
          <div>
            <dt>Formal identifier</dt>
            <dd>{identity.formalIdentifier ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Issuer</dt>
            <dd>{identity.issuer ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Issuing jurisdiction</dt>
            <dd>{identity.issuingJurisdiction ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Event type and status</dt>
            <dd>{identity.eventType}{identity.status ? ` · ${identity.status}` : ""}</dd>
          </div>
        </dl>
        <ClaimCollection
          claims={dossier.atAGlance}
          sourceById={sourceById}
          empty="No additional at-a-glance claim was returned."
        />
      </section>

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-what-happened-title">
        <h3 id="s2-audit-what-happened-title">What happened</h3>
        {dossier.whatHappened ? (
          <Claim claim={dossier.whatHappened} sourceById={sourceById} />
        ) : (
          <p className="s2-audit-empty">
            This source-linked provisional explanation is not ready yet.
          </p>
        )}
      </section>

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-what-changed-title">
        <h3 id="s2-audit-what-changed-title">What changed</h3>
        <ClaimCollection
          claims={dossier.whatChanged}
          sourceById={sourceById}
          empty="No high-level change component is established yet."
        />
      </section>

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-timeline-title">
        <h3 id="s2-audit-timeline-title">Preliminary timeline</h3>
        {dossier.timeline.length > 0 ? (
          <ol className="s2-audit-timeline">
            {dossier.timeline.map((lead) => (
              <li key={lead.id}>
                <time dateTime={lead.date}>{formatAuditDate(lead.date)}</time>
                <div>
                  <strong>{screen02ProviderNeutralCopy(lead.label)}</strong>
                  <span>{screen02ProviderNeutralCopy(lead.stage)} · provisional</span>
                  {lead.uncertainty && (
                    <p>{screen02ProviderNeutralCopy(lead.uncertainty)}</p>
                  )}
                  <ClaimSources sourceIds={lead.sourceIds} sourceById={sourceById} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="s2-audit-empty">No date lead is established yet.</p>
        )}
      </section>

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-coverage-title">
        <h3 id="s2-audit-coverage-title">Who may be affected</h3>
        <ClaimCollection
          claims={dossier.broadCoverage}
          sourceById={sourceById}
          empty="Broad apparent coverage is not established."
        />
        <p className="s2-audit-verification-note">
          Organization-level eligibility remains unknown until Screen 3.
        </p>
      </section>

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-study-relation-title">
        <span className="s2-audit-provenance">Early hypothesis · not a source fact</span>
        <h3 id="s2-audit-study-relation-title">How this shock may relate to your study</h3>
        <p>{preliminaryStudyRelation}</p>
        <p>{preliminaryOutcomeRelation}</p>
        <p className="s2-audit-verification-note">
          Preliminary interpretation only—please double-check it against the online sources and verify it on later screens.
        </p>
      </section>

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-components-title">
        <h3 id="s2-audit-components-title">Key components</h3>
        <ClaimCollection
          claims={dossier.keyComponents}
          sourceById={sourceById}
          empty="No distinguishing component is established yet."
        />
      </section>

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-related-title">
        <h3 id="s2-audit-related-title">Related versions</h3>
        {dossier.relatedVersions.length > 0 ? (
          <ul className="s2-audit-related-list">
            {dossier.relatedVersions.map((related, index) => (
              <li key={`${related.identity.canonicalTitle}:${related.relationship}:${index}`}>
                <strong>{related.identity.canonicalTitle}</strong>
                <span>{relationshipCopy[related.relationship]}</span>
                <p>{screen02ProviderNeutralCopy(related.note)}</p>
                <ClaimSources sourceIds={related.sourceIds} sourceById={sourceById} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="s2-audit-empty">No related version is recorded.</p>
        )}
      </section>

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-unknowns-title">
        <h3 id="s2-audit-unknowns-title">Unresolved facts</h3>
        {dossier.unresolvedFacts.length > 0 ? (
          <ul className="s2-audit-unknown-list">
            {dossier.unresolvedFacts.map((fact, index) => (
              <li key={`${fact}:${index}`}>
                {screen02ProviderNeutralCopy(fact)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="s2-audit-empty">
            No additional unresolved identity fact is recorded. Screen 3
            verification is still required.
          </p>
        )}
      </section>

      {row.match.limitations.length > 0 && (
        <section className={dossierSectionClassName} aria-labelledby="s2-audit-limitations-title">
          <h3 id="s2-audit-limitations-title">What to verify before using this shock</h3>
          <ul className="s2-audit-unknown-list">
            {row.match.limitations.map((limitation, index) => (
              <li key={`${limitation}:${index}`}>
                {/connector metadata|identity lead/i.test(limitation)
                  ? `Open the official text for ${identity.canonicalTitle} and confirm its exact version, operative dates, and legal status.`
                  : screen02ProviderNeutralCopy(limitation)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={dossierSectionClassName} aria-labelledby="s2-audit-sources-title">
        <h3 id="s2-audit-sources-title">Online sources</h3>
        <SourceList sources={row.sources} />
      </section>

      {row.decisions.length > 0 && (
        <details className="s2-audit-decision-history">
          <summary>Identity decision history</summary>
          <ol>
            {row.decisions.map((decision) => (
              <li key={decision.decisionId}>
                <strong>{decision.action.replace("-", " ")}</strong>
                <span>{decision.reason}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {!row.confirmed && (
        <IdentityActions
          row={row}
          onConfirmMatch={onConfirmMatch}
          onChooseRelatedVersion={onChooseRelatedVersion}
          onRejectMatch={onRejectMatch}
        />
      )}
    </article>
  );
}

function NoMatchAction({
  noResult,
  onNoMatch,
  recordedReason = null,
}: Pick<Screen02AuditProps, "onNoMatch"> & {
  noResult: boolean;
  recordedReason?: string | null;
}) {
  const [reason, setReason] = useState("");
  const reasonHelpId = "s2-audit-no-match-reason-help";
  return (
    <section className={`s2-audit-no-match ${noResult ? "s2-audit-no-match--result" : ""}`}>
      {noResult ? (
        <>
          <span className="s2-audit-provenance">Bounded search result</span>
          <h2>{screen02AuditCopy.noResult}</h2>
          <p>
            This does not establish that the shock does not exist. Edit the
            structured anchor, add an official source, broaden the documented
            search protocol, or stop.
          </p>
        </>
      ) : (
        <h3>None of these records match</h3>
      )}
      {recordedReason ? (
        <p className="s2-audit-no-match__recorded-reason">
          <strong>Recorded reason:</strong> {recordedReason}
        </p>
      ) : (
        <>
          <label htmlFor="s2-audit-no-match-reason">
            Reason for recording no match
          </label>
          <textarea
            id="s2-audit-no-match-reason"
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            placeholder="Explain what the retained records do not resolve."
            aria-describedby={reasonHelpId}
          />
          <p id={reasonHelpId} className="s2-audit-form-help">
            Enter a reason before recording that no retained record matches.
          </p>
          <button
            className={secondaryButtonClassName}
            type="button"
            disabled={!reason.trim()}
            aria-describedby={reasonHelpId}
            onClick={() => onNoMatch(reason.trim())}
          >
            Record no match under this protocol
          </button>
        </>
      )}
    </section>
  );
}

function PossibleMatches({
  state,
  view,
  onOpenMatch,
  onNoMatch,
  onRetryDossier,
  onConfirmMatch,
  onChooseRelatedVersion,
  onRejectMatch,
}: Pick<
  Screen02AuditProps,
  | "state"
  | "onOpenMatch"
  | "onNoMatch"
  | "onRetryDossier"
  | "onConfirmMatch"
  | "onChooseRelatedVersion"
  | "onRejectMatch"
> & { view: Screen02AuditViewModel }) {
  const sourceById = useMemo(
    () => new Map(state.sources.map((source) => [source.id, source])),
    [state.sources],
  );
  if (!view.activeMatchSet) {
    return (
      <section className="s2-audit-awaiting" role="status">
        <h2>No identity search has been recorded yet.</h2>
        <p>
          Review the structured anchor, then search. Study geography and period
          will inform the later assessment but will not exclude the named event
          during identity matching.
        </p>
      </section>
    );
  }
  if (view.noMatch && view.matches.length === 0) {
    return (
      <NoMatchAction
        noResult
        recordedReason={view.currentNoMatchDecision?.reason}
        onNoMatch={onNoMatch}
      />
    );
  }
  return (
    <section className="s2-audit-matches" aria-labelledby="s2-audit-matches-title">
      <div className="s2-audit-matches__heading">
        <h2 id="s2-audit-matches-title">{screen02AuditCopy.listTitle}</h2>
        <p>{screen02AuditCopy.listHelp}</p>
      </div>
      <div className="s2-audit-matches__workspace">
        <section aria-label="Possible matches">
          <ol className="s2-audit-match-list">
            {view.matches.map((row) => (
              <MatchRow
                key={row.match.matchSnapshotId}
                row={row}
                onOpen={() => onOpenMatch(row.match.matchSnapshotId)}
              />
            ))}
          </ol>
          {view.currentNoMatchDecision ? (
            <NoMatchAction
              noResult
              recordedReason={view.currentNoMatchDecision.reason}
              onNoMatch={onNoMatch}
            />
          ) : !view.confirmedIdentity ? (
            <NoMatchAction noResult={false} onNoMatch={onNoMatch} />
          ) : null}
        </section>
        {view.opened && (
          <Dossier
            key={view.opened.match.matchSnapshotId}
            state={state}
            row={view.opened}
            sourceById={sourceById}
            onRetryDossier={onRetryDossier}
            onConfirmMatch={onConfirmMatch}
            onChooseRelatedVersion={onChooseRelatedVersion}
            onRejectMatch={onRejectMatch}
          />
        )}
      </div>
    </section>
  );
}

function AssessmentComponent({
  title,
  category,
  explanation,
}: {
  title: string;
  category: string | null;
  explanation: string | null;
}) {
  return (
    <article className="s2-audit-assessment-component">
      <h3>
        {title}
        {category ? ` · ${category}` : ""}
      </h3>
      <p>
        {explanation
          ? screen02ProviderNeutralCopy(explanation)
          : "This part of the preliminary assessment is not ready yet."}
      </p>
    </article>
  );
}

function usedConservativeFixedFallback(
  request: Screen02AuditViewModel["assessmentRequest"],
) {
  return Boolean(
    request?.lifecycle.some((event) =>
      /fixed fallback/i.test(event.note ?? ""),
    ),
  );
}

function ConfirmedAssessment({
  state,
  view,
  onRetryAssessment,
  onContinue,
  onContinueWithoutAssessment,
  onReconsiderIdentity,
}: Pick<
  Screen02AuditProps,
  | "state"
  | "onRetryAssessment"
  | "onContinue"
  | "onContinueWithoutAssessment"
  | "onReconsiderIdentity"
> & { view: Screen02AuditViewModel }) {
  const [reconsiderReason, setReconsiderReason] = useState("");
  if (!view.confirmedIdentity || !view.confirmed) return null;
  const identity = view.confirmed.match.identity;
  const assessment = view.assessment;
  const request = view.assessmentRequest;
  const fixedFallback = usedConservativeFixedFallback(request);
  const assessmentUnavailable = Boolean(
    !assessment &&
      request &&
      [
        "delivery-rejected",
        "no-tool-submission",
        "validation-failed",
        "timed-out",
        "service-unavailable",
        "retry-exhausted",
      ].includes(request.status),
  );
  const status = request
    ? lifecycleCopy[request.status]
    : "Identity confirmed. Preparing the confirmed-shock assessment…";
  const assessmentPending = !assessment &&
    (!request || activeAssessmentStatuses.has(request.status));
  const sourceById = new Map(
    state.sources.map((source) => [source.id, source]),
  );
  const assessmentSources = assessment?.evidenceSourceIds.flatMap(
    (sourceId) => {
      const source = sourceById.get(sourceId);
      return source ? [source] : [];
    },
  ) ?? [];
  const continueReasonId = "s2-audit-continuation-reason";
  const reconsiderReasonHelpId = "s2-audit-reconsider-reason-help";
  const unavailableAssessmentGate =
    screen02AuditAssessmentUnavailableContinuationGate(state);
  const canContinueWithExtraChecks = Boolean(
    !view.continuationGate.eligible &&
      unavailableAssessmentGate.eligible &&
      onContinueWithoutAssessment,
  );
  const continueToScreen03 = () => {
    if (view.continuationGate.eligible) {
      onContinue();
      return;
    }
    if (canContinueWithExtraChecks && onContinueWithoutAssessment) {
      onContinueWithoutAssessment(
        screen02UnavailableAssessmentReason,
        screen02UnavailableAssessmentAcknowledgment,
      );
    }
  };

  return (
    <section className="s2-audit-assessment" aria-labelledby="s2-audit-assessment-title">
      <header className="s2-audit-assessment__header">
        <div>
          <span className="s2-audit-provenance">
            {fixedFallback
              ? "Conservative source-derived preliminary assessment"
              : assessment
                ? "Source-linked preliminary interpretation"
                : assessmentUnavailable
                  ? "Source-backed event · Assessment unavailable"
                  : "Assessment pending"}
          </span>
          <h2 id="s2-audit-assessment-title">
            {fixedFallback
              ? "Source-derived assessment for your study"
              : assessmentUnavailable
                ? "Continue with source facts and extra checks"
                : screen02AuditCopy.assessmentTitle}
          </h2>
          <p>
            {fixedFallback
              ? "The requested review did not arrive before the bounded deadline, so this conservative aid was assembled from the confirmed dossier, linked sources, and your confirmed study. It still requires verification."
              : assessmentUnavailable
              ? "The preliminary assessment did not arrive. No interpretation is being claimed; the confirmed identity and sources remain available for Screen 3 verification."
              : screen02AuditCopy.assessmentPurpose}
          </p>
        </div>
        {assessment?.overallJudgment && (
          <span className="s2-audit-judgment">
            <small>Fixed computation</small>
            <strong>{preliminaryJudgmentCopy[assessment.overallJudgment]}</strong>
          </span>
        )}
      </header>

      <section className="s2-audit-confirmed-identity" aria-labelledby="s2-audit-confirmed-identity-title">
        <div>
          <span className="s2-audit-confirmed-mark" aria-hidden="true">✓</span>
          <div>
            <small>Identity confirmed by researcher</small>
            <h3 id="s2-audit-confirmed-identity-title">{identity.canonicalTitle}</h3>
            <p>
              {identity.formalIdentifier ?? "Formal identifier unknown"} · {identity.issuingJurisdiction ?? "Jurisdiction unknown"}
            </p>
          </div>
        </div>
        <p>
          Confirmation means this is the event the researcher intended. It
          does not verify every date, provision, threshold, exemption, or
          organization-level exposure.
        </p>
      </section>

      <div
        className="s2-audit-assessment-status"
        role="status"
        aria-live="polite"
        aria-busy={assessmentPending || undefined}
      >
        {assessmentPending && (
          <span className="s2-audit-spinner" aria-hidden="true" />
        )}
        <strong>{status}</strong>
        {request?.status === "partial" && (
          <span>
            Accepted: {request.acceptedPartIds.join(", ") || "none yet"}.
          </span>
        )}
        {onRetryAssessment && isRetryableAuditRequest(request) && (
          <button
            className={secondaryButtonClassName}
            type="button"
            onClick={() =>
              onRetryAssessment(view.confirmedIdentity!.confirmationSnapshotId)
            }
          >
            {request?.status === "delivery-rejected"
              ? "Try the brief assessment again"
              : "Retry missing assessment parts"}
          </button>
        )}
      </div>

      {assessment && (
        <>
          <p className="s2-audit-verification-note">
            {fixedFallback ? (
              <>
                <strong>Unclear — verify before use.</strong> This conservative
                source-derived summary preserved the linked facts and explicit
                evidence gaps without inventing a categorical answer. Verify
                every statement against the online sources and on later screens.
              </>
            ) : (
              <>
                Source-linked preliminary interpretation. It may be wrong
                and should be checked against the online sources and verified
                on later screens.
              </>
            )}
          </p>
          <div className="s2-audit-assessment-grid">
            <AssessmentComponent
              title={`How this shock may reach ${state.screen01Baseline.scopeContract.population}`}
              category={assessment.studyFit ? studyFitCopy[assessment.studyFit.category] : null}
              explanation={[
                assessment.studyFit?.explanation,
                assessment.coverageRelation?.explanation,
              ].filter(Boolean).join(" ") || null}
            />
            <AssessmentComponent
              title={`How it may affect ${state.screen01Baseline.scopeContract.outcomeFamily}`}
              category={assessment.outcomePathway ? outcomePathwayCopy[assessment.outcomePathway.category] : null}
              explanation={assessment.outcomePathway?.explanation ?? null}
            />
            <AssessmentComponent
              title="What would need to be observed"
              category={assessment.measurementPotential ? measurementPotentialCopy[assessment.measurementPotential.category] : null}
              explanation={assessment.measurementPotential?.explanation ?? null}
            />
          </div>
          <div className="s2-audit-assessment-notes">
            <article>
              <h3>Main feasibility concern</h3>
              <p>
                {assessment.mainConcern
                  ? screen02ProviderNeutralCopy(assessment.mainConcern)
                  : "No main concern was returned."}
              </p>
            </article>
            <article>
              <h3>Next checks</h3>
              {assessment.nextChecks.length > 0 ? (
                <ol>
                  {assessment.nextChecks.map((check, index) => (
                    <li key={`${check}:${index}`}>
                      {screen02ProviderNeutralCopy(check)}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No next check was returned.</p>
              )}
            </article>
          </div>
          <details className="s2-audit-assessment-evidence">
            <summary>Online sources used for event facts</summary>
            <SourceList sources={assessmentSources} />
          </details>
        </>
      )}

      <section className="s2-audit-handoff" aria-labelledby="s2-audit-handoff-title">
        <div>
          <span className="s2-audit-provenance">Researcher decision</span>
          <h2 id="s2-audit-handoff-title">
            {view.alreadyContinued ? "Event sent to verification" : "Continue with this event"}
          </h2>
          <p>{screen02AuditCopy.boundary}</p>
          {!view.continuationGate.eligible && view.continuationGate.visibleReason && (
            <p id={continueReasonId} className="s2-audit-disabled-reason">
              {view.continuationGate.visibleReason}
            </p>
          )}
        </div>
        <button
          className="s2-audit-button"
          type="button"
          disabled={
            !view.continuationGate.eligible && !canContinueWithExtraChecks
          }
          aria-describedby={
            !view.continuationGate.eligible && !canContinueWithExtraChecks
              ? continueReasonId
              : undefined
          }
          onClick={continueToScreen03}
        >
          {canContinueWithExtraChecks
            ? "Continue to Screen 3 with extra checks"
            : "Continue to Screen 3: Verify event"}
        </button>
      </section>

      {!view.alreadyContinued &&
        !view.continuationGate.eligible &&
        unavailableAssessmentGate.eligible &&
        onContinueWithoutAssessment && (
          <details className="s2-audit-assessment-exception">
            <summary>What the extra checks mean</summary>
            <p>
              The preliminary assessment did not arrive. You can still
              continue with this source-backed event. Choosing the visible
              extra-checks button records that limitation and requires Screen 3
              to complete every check below.
            </p>
            <ul>
              {screen02AssessmentUnavailableScreen03Checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </details>
        )}

      <details className="s2-audit-reconsider">
        <summary>Reconsider identity</summary>
        <p>
          Return to the possible matches if this is not the intended event or
          version. The reversal reason becomes part of the Audit record.
        </p>
        <label htmlFor="s2-audit-reconsider-reason">Reason for reconsidering</label>
        <textarea
          id="s2-audit-reconsider-reason"
          value={reconsiderReason}
          onChange={(event) => setReconsiderReason(event.currentTarget.value)}
          aria-describedby={reconsiderReasonHelpId}
        />
        <p id={reconsiderReasonHelpId} className="s2-audit-form-help">
          Enter a reason before returning to the possible matches.
        </p>
        <button
          className={secondaryButtonClassName}
          type="button"
          disabled={!reconsiderReason.trim()}
          aria-describedby={reconsiderReasonHelpId}
          onClick={() => onReconsiderIdentity(reconsiderReason.trim())}
        >
          Reconsider identity
        </button>
      </details>
    </section>
  );
}

export default function Screen02Audit({
  state,
  busy = false,
  openedMatchSnapshotId = null,
  onReviseAnchor,
  onOpenMatch,
  onConfirmMatch,
  onChooseRelatedVersion,
  onRejectMatch,
  onNoMatch,
  onRetryDossier,
  onRetryAssessment,
  onContinue,
  onContinueWithoutAssessment,
  onReconsiderIdentity,
  onEditStudy,
  onReset,
  onAddSource,
}: Screen02AuditProps) {
  const view = buildScreen02AuditViewModel(state, openedMatchSnapshotId);
  const autoOpenMatch =
    !view.confirmedIdentity &&
    view.opened &&
    !view.opened.dossier &&
    !view.opened.dossierRequest
      ? view.opened.match.matchSnapshotId
      : null;
  useEffect(() => {
    if (autoOpenMatch && !busy) onOpenMatch(autoOpenMatch);
  }, [autoOpenMatch, busy, onOpenMatch]);
  const sealed = view.alreadyContinued;
  const headerStatus = sealed
    ? "Handoff sealed"
    : view.assessment?.status === "completed"
      ? "Assessment ready"
      : view.confirmedIdentity
        ? "Identity confirmed"
        : view.activeMatchSet
          ? "Resolving identity"
          : "Anchor ready";

  return (
    <main className="s2-audit" data-testid="screen02-audit">
      <header className="s2-audit-header">
        <div>
          <span className="s2-audit-badge">{screen02AuditCopy.eyebrow}</span>
          <h1>{screen02AuditCopy.identifyTitle}</h1>
          <p>{screen02AuditCopy.identifyPurpose}</p>
        </div>
        <span className="s2-audit-badge s2-audit-badge--status" role="status" aria-live="polite">
          {headerStatus}
        </span>
      </header>

      <PhaseNavigator view={view} />
      <StudyContext state={state} onEditStudy={onEditStudy} onReset={onReset} />
      {sealed && (
        <section
          className="s2-audit-sealed"
          data-testid="screen02-audit-sealed"
          role="status"
        >
          <h2>Screen 2 identity sealed</h2>
          <p>
            The confirmed event has been handed to Screen 3. Its identity
            record and assessment remain visible here, but Screen 2 actions are
            read-only for this run.
          </p>
        </section>
      )}
      <fieldset
        className="s2-audit-workspace-lock"
        disabled={sealed || busy}
        aria-busy={busy || undefined}
      >
        <legend className="s2-audit-sr-only">
          {sealed
            ? "Read-only completed Screen 2 Audit workspace"
            : "Screen 2 Audit workspace"}
        </legend>
        <AnchorWorkspace
          state={state}
          view={view}
          onReviseAnchor={onReviseAnchor}
          onAddSource={onAddSource}
        />

        <IdentitySearchRecord view={view} />

        {!view.confirmedIdentity && (
          <PossibleMatches
            state={state}
            view={view}
            onOpenMatch={onOpenMatch}
            onNoMatch={onNoMatch}
            onRetryDossier={onRetryDossier}
            onConfirmMatch={onConfirmMatch}
            onChooseRelatedVersion={onChooseRelatedVersion}
            onRejectMatch={onRejectMatch}
          />
        )}

        <ConfirmedAssessment
          state={state}
          view={view}
          onRetryAssessment={onRetryAssessment}
          onContinue={onContinue}
          onContinueWithoutAssessment={onContinueWithoutAssessment}
          onReconsiderIdentity={onReconsiderIdentity}
        />
      </fieldset>

      <aside className="s2-audit-boundary" aria-label="Screen 2 to Screen 3 boundary">
        <strong>Screen boundary</strong>
        <p>{screen02AuditCopy.boundary}</p>
      </aside>
      <aside
        className="s2-audit-boundary"
        aria-label="Temporary workflow data retention"
      >
        <strong>Temporary workflow data</strong>
        <p>{screen02TemporaryWorkflowRetention}</p>
      </aside>
    </main>
  );
}
