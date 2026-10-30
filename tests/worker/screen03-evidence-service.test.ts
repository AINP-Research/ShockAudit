import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildScreen02WorkflowHandoff,
  serializeScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import { buildReviewedScreen02AuditDiscovery } from "../../src/core/screen02-audit-discovery";
import { screen02FindCandidateFromProposal } from "../../src/core/screen02-find-discovery";
import { REVIEWED_SCREEN02_EVENT_REGISTRY } from "../../src/core/screen02-registry";
import {
  buildScreen03StateFromResearch,
  integrateScreen03HostInterpretation,
  requireScreen03ResearchPacket,
  screen03ProposalConfirmability,
} from "../../src/core/screen03-workflow";
import {
  createScreen02AuditState,
  fingerprintScreen02WorkflowValue,
} from "../../src/core/screen02-workflow-state";
import {
  SCREEN_03_SYNTHESIS_PROTOCOL_VERSION,
  screen03EvidenceSourceRole,
} from "../../src/worker/screen03-evidence-synthesis";
import {
  SCREEN_03_RESEARCH_MAX_ACTIVE_EVIDENCE,
  SCREEN_03_RESEARCH_MAX_CALLS,
  SCREEN_03_RESEARCH_MAX_PASSAGES,
  SCREEN_03_RESEARCH_TOTAL_DEADLINE_MS,
  SCREEN_03_COMPONENT_TARGET,
  SCREEN_03_DETAIL_MAX_PER_CATEGORY,
  SCREEN_03_DETAIL_MAX_TOTAL,
  SCREEN_03_DOCUMENT_MAX_ATTEMPTS,
  SCREEN_03_DOCUMENT_MAX_BYTES,
  SCREEN_03_DOCUMENT_MAX_TOTAL_BYTES,
  SCREEN_03_DOCUMENT_MAX_CONVERTED_TEXT,
  SCREEN_03_DOCUMENT_MAX_EXCERPTS,
  SCREEN_03_DOCUMENT_MAX_FETCHES,
  SCREEN_03_DOCUMENT_MAX_PDF_PAGES,
  SCREEN_03_DOCUMENT_MAX_PDF_CONVERSIONS,
  SCREEN_03_DOCUMENT_FETCH_TIMEOUT_MS,
  type Screen03ResearchTelemetry,
  researchScreen03Evidence,
  screen03FederalRegisterLocatorDocumentNumber,
  screen03FormalIdentifiersEquivalent,
  screen03ProposalIdentityRelationship,
} from "../../src/worker/screen03-evidence-service";
import type { Screen02ConnectorFetch } from "../../src/worker/screen02-connectors";
import {
  gdeltLeadToScreen02ContextLead,
} from "../../src/worker/contextual-discovery";
import { screen03ExtractiveClaimIsComplete } from "../../src/worker/screen03-claim-quality";
import {
  buildScreen03HostDraftRequest,
  interpretScreen03Packet,
  restoreScreen03HostInterpretation,
} from "../../src/worker/screen03-interpretation";
import { compileScreen03ExactExcerpts } from "../../src/worker/screen03-timeline-extraction";
import {
  buildReadyAuditState,
  buildReadyFindState,
  confirmedWorkflowAuditContext,
} from "../core/screen02-workflow-fixtures";

const researchedAt = "2026-08-12T16:00:00.000Z";
const isOfficialSubstantivePassage = (passage: { basis: string }) =>
  passage.basis === "official-document-passage" ||
  passage.basis === "official-guidance-passage";

function handoff() {
  return buildScreen02WorkflowHandoff(
    buildReadyFindState(),
    "0.3.3",
    "2026-08-12T15:59:00.000Z",
  );
}

function handoffWithReviewedGdprSource() {
  const selected = JSON.parse(JSON.stringify(handoff())) as
    Screen02WorkflowHandoff;
  const base = {
    id: selected.sources[0]!.id,
    title: "Regulation (EU) 2016/679",
    locator: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    publisher: "EUR-Lex",
    publishedDate: "2016-04-27",
    authorityTier: 1 as const,
    channel: "official-legislation",
    retrievedAt: "2026-09-11T14:00:00.000Z",
    userProvided: false,
  };
  selected.sources = [{
    ...base,
    sourceFingerprint: fingerprintScreen02WorkflowValue(base),
  }];
  return resealHandoff(selected);
}

function fdaDistributedManufacturingRfiHandoff() {
  const selected = JSON.parse(
    JSON.stringify(handoff()),
  ) as Screen02WorkflowHandoff;
  const sourceInput = {
    id: selected.sources[0]!.id,
    title:
      "Discussion Paper: Distributed Manufacturing and Point-of-Care Manufacturing of Drugs; Request for Information and Comments",
    locator:
      "https://www.federalregister.gov/documents/2022/10/14/2022-22386/discussion-paper-distributed-manufacturing-and-point-of-care-manufacturing-of-drugs-request-for",
    publisher: "Food and Drug Administration",
    publishedDate: "2022-10-14",
    authorityTier: 2 as const,
    channel: "Federal Register API v1 · rules, proposed rules, and notices",
    retrievedAt: "2026-08-12T15:58:00.000Z",
    userProvided: false,
  };
  selected.sources = [{
    ...sourceInput,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceInput),
  }];
  selected.event.identity = {
    canonicalTitle: sourceInput.title,
    commonNames: ["Distributed manufacturing and point-of-care manufacturing RFI"],
    formalIdentifier: "2022-22386",
    issuer: "Food and Drug Administration",
    issuingJurisdiction: "United States",
    eventType: "Regulation",
    status: "Notice",
  };
  selected.event.sourceIds = [sourceInput.id];
  selected.event.description = {
    ...selected.event.description,
    text:
      "FDA published a discussion paper and requested public information and comments about distributed and point-of-care drug manufacturing.",
    sourceIds: [sourceInput.id],
  };
  selected.event.dateLeads = [];
  selected.event.highLevelChanges = [];
  selected.event.keyComponents = [];
  selected.event.broadCoverage = [];
  selected.event.relatedVersions = [];
  selected.unresolved.provisionalClaimIds = [selected.event.description.id];
  return resealHandoff(selected);
}

function californiaConnectedDevicesHandoff() {
  const proposal = REVIEWED_SCREEN02_EVENT_REGISTRY.find(
    (candidate) =>
      candidate.id === "registry-us-california-iot-security-2020",
  );
  if (!proposal || proposal.mode !== "find") {
    throw new Error("Expected the reviewed California connected-devices record.");
  }
  const candidate = screen02FindCandidateFromProposal(
    proposal,
    "screen03-connected-devices-round",
    researchedAt,
  );
  const changed = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
  const reviewedSource = proposal.sources[0]!;
  // Preserve the original source ID because the sealed preliminary assessment
  // cites it; replace only the reviewed official record represented by that ID.
  const sourceInput = {
    id: changed.sources[0]!.id,
    title: reviewedSource.title,
    locator: reviewedSource.locator,
    publisher: reviewedSource.publisher,
    publishedDate: reviewedSource.publishedDate ?? null,
    authorityTier: reviewedSource.authorityTier,
    channel: reviewedSource.channel,
    retrievedAt: reviewedSource.retrievedAt ?? researchedAt,
    userProvided: false,
  };
  changed.sources = [{
    ...sourceInput,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceInput),
  }];
  changed.event.identity = candidate.identity;
  changed.event.sourceIds = [sourceInput.id];
  changed.event.description = {
    ...candidate.description,
    sourceIds: [sourceInput.id],
  };
  changed.event.dateLeads = candidate.dateLeads.map((lead) => ({
    ...lead,
    sourceIds: [sourceInput.id],
  }));
  changed.event.broadCoverage = candidate.broadCoverage.map((claim) => ({
    ...claim,
    sourceIds: [sourceInput.id],
  }));
  changed.event.highLevelChanges = [];
  changed.event.keyComponents = [];
  changed.event.relatedVersions = [];
  changed.unresolved.provisionalClaimIds = [
    changed.event.description.id,
    ...changed.event.dateLeads.map((lead) => lead.id),
    ...changed.event.broadCoverage.map((claim) => claim.id),
  ];
  return resealHandoff(changed);
}

function researcherProvidedOfficialHandoff(input: {
  title: string;
  locator: string;
  canonicalTitle: string;
  commonNames: string[];
  formalIdentifier: string | null;
  issuer: string;
  issuingJurisdiction: string;
  eventType: string;
  date: string;
  stage: "effective" | "occurrence";
}) {
  const selected = structuredClone(handoff());
  const sourceId = selected.sources[0]!.id;
  const sourceInput = {
    id: sourceId,
    title: input.title,
    locator: input.locator,
    publisher: "Unverified researcher label",
    publishedDate: null,
    authorityTier: 6 as const,
    channel: "researcher-provided-url",
    retrievedAt: "2026-08-12T15:58:00.000Z",
    userProvided: true,
  };
  selected.sources = [{
    ...sourceInput,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceInput),
  }];
  selected.event.identity = {
    canonicalTitle: input.canonicalTitle,
    commonNames: input.commonNames,
    formalIdentifier: input.formalIdentifier,
    issuer: input.issuer,
    issuingJurisdiction: input.issuingJurisdiction,
    eventType: input.eventType,
    status: null,
  };
  selected.event.sourceIds = [sourceId];
  selected.event.description = {
    ...selected.event.description,
    text: `${input.canonicalTitle} is the selected event.`,
    sourceIds: [sourceId],
  };
  selected.event.dateLeads = [{
    id: `researcher-official-${input.stage}-date`,
    date: input.date,
    label: input.stage === "occurrence"
      ? "Occurrence date"
      : "Effective date",
    stage: input.stage,
    sourceIds: [sourceId],
    status: "provisional",
    uncertainty: "Screen 3 must verify the exact official passage.",
  }];
  selected.event.broadCoverage = [];
  selected.event.highLevelChanges = [];
  selected.event.keyComponents = [];
  selected.event.relatedVersions = [];
  selected.unresolved.provisionalClaimIds = [
    selected.event.description.id,
    selected.event.dateLeads[0]!.id,
  ];
  return resealHandoff(selected);
}

function ccpaReviewedSourcePackHandoff() {
  const changed = JSON.parse(JSON.stringify(buildScreen02WorkflowHandoff(
    buildReadyAuditState(),
    "0.3.3",
    "2026-08-12T15:59:00.000Z",
  ))) as Screen02WorkflowHandoff;
  const source = (
    id: string,
    title: string,
    locator: string,
    authorityTier: 1 | 2,
    channel: string,
    publishedDate: string,
  ) => {
    const value = {
      id,
      title,
      locator,
      publisher: authorityTier === 1
        ? "California Legislative Information"
        : "California Department of Justice",
      publishedDate,
      authorityTier,
      channel,
      retrievedAt: "2026-08-13",
      userProvided: false,
    };
    return {
      ...value,
      sourceFingerprint: fingerprintScreen02WorkflowValue(value),
    };
  };
  changed.sources = [
    source(
      changed.sources[0]!.id,
      "California Assembly Bill 375, Chapter 55",
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375",
      1,
      "official-primary-statute",
      "2018-06-29",
    ),
    source(
      "source-us-california-ccpa-isor",
      "Initial Statement of Reasons for California Consumer Privacy Act Regulations",
      "https://oag.ca.gov/sites/all/files/agweb/pdfs/privacy/ccpa-isor-appendices.pdf",
      2,
      "official-administrative-record",
      "2019-10-11",
    ),
    source(
      "source-us-california-ccpa-oag-implementation",
      "Attorney General submits CCPA regulations for approval",
      "https://oag.ca.gov/news/press-releases/attorney-general-becerra-submits-proposed-regulations-approval-under-california",
      2,
      "official-regulator-press-release",
      "2020-06-02",
    ),
  ];
  const sourceIds = changed.sources.map((item) => item.id);
  changed.event.identity.canonicalTitle = "California Consumer Privacy Act";
  changed.event.identity.commonNames = [
    "CCPA",
    "California Consumer Privacy Act of 2018",
  ];
  changed.event.identity.formalIdentifier =
    "California Civil Code § 1798.100 et seq.";
  changed.event.sourceIds = sourceIds;
  changed.event.description.sourceIds = sourceIds;
  changed.event.dateLeads.forEach((lead) => {
    lead.sourceIds = sourceIds;
  });
  changed.event.broadCoverage.forEach((claim) => {
    claim.sourceIds = sourceIds;
  });
  changed.event.highLevelChanges.forEach((claim) => {
    claim.sourceIds = sourceIds;
  });
  changed.event.keyComponents.forEach((claim) => {
    claim.sourceIds = sourceIds;
  });
  changed.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(
    changed.event,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    changed.integrity;
  changed.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...changed,
    integrity,
  });
  return JSON.parse(
    serializeScreen02WorkflowHandoff(changed),
  ) as Screen02WorkflowHandoff;
}

function resealHandoff(changed: Screen02WorkflowHandoff) {
  changed.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(
    changed.event,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    changed.integrity;
  changed.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...changed,
    integrity,
  });
  return JSON.parse(
    serializeScreen02WorkflowHandoff(changed),
  ) as Screen02WorkflowHandoff;
}

function ccpaAnnouncementHandoff() {
  const changed = JSON.parse(
    JSON.stringify(ccpaReviewedSourcePackHandoff()),
  ) as Screen02WorkflowHandoff;
  const operativeSourceIds = changed.sources.map((source) => source.id);
  const base = {
    id: "source-us-california-ccpa-initiative-circulation",
    title:
      "Proposed initiative enters circulation: new consumer privacy rights",
    locator:
      "https://www.sos.ca.gov/administration/news-releases-and-advisories/2017-news-releases-and-advisories/proposed-initiative-enters-circulation39",
    publisher: "California Secretary of State",
    publishedDate: "2017-12-18",
    authorityTier: 1 as const,
    channel: "official-ballot-initiative-announcement",
    retrievedAt: "2026-08-14",
    userProvided: false,
  };
  changed.sources.push({
    ...base,
    sourceFingerprint: fingerprintScreen02WorkflowValue(base),
  });
  changed.event.sourceIds = [...operativeSourceIds, base.id];
  changed.event.description.sourceIds = operativeSourceIds;
  changed.event.dateLeads.forEach((lead) => {
    lead.sourceIds = operativeSourceIds;
  });
  changed.event.dateLeads.push({
    id: "ccpa-precursor-circulation-date",
    date: "2017-12-18",
    label: "Precursor privacy initiative cleared for circulation",
    stage: "announcement",
    sourceIds: [base.id],
    status: "provisional",
    uncertainty:
      "This is the official circulation date of ballot initiative 17-0039, a precursor to the enacted CCPA. It is not the introduction date of AB 375 and is not automatically the study treatment date.",
  });
  changed.event.broadCoverage.forEach((claim) => {
    claim.sourceIds = operativeSourceIds;
  });
  changed.event.highLevelChanges.forEach((claim) => {
    claim.sourceIds = operativeSourceIds;
  });
  changed.event.keyComponents.forEach((claim) => {
    claim.sourceIds = operativeSourceIds;
  });
  changed.unresolved.provisionalClaimIds = [
    changed.event.description.id,
    ...changed.event.dateLeads.map((lead) => lead.id),
    ...changed.event.broadCoverage.map((claim) => claim.id),
    ...changed.event.highLevelChanges.map((claim) => claim.id),
    ...changed.event.keyComponents.map((claim) => claim.id),
  ];
  return resealHandoff(changed);
}

function arbitraryCaliforniaBillHandoff() {
  const changed = JSON.parse(
    JSON.stringify(ccpaReviewedSourcePackHandoff()),
  ) as Screen02WorkflowHandoff;
  const base = {
    // Preserve the original source identity because the sealed preliminary
    // assessment also cites it; only its reviewed locator/content changes.
    id: changed.sources[0]!.id,
    title: "California Assembly Bill 1234",
    locator:
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240AB1234",
    publisher: "California Legislative Information",
    publishedDate: "2024-09-01",
    authorityTier: 1 as const,
    channel: "official-primary-statute",
    retrievedAt: "2026-08-14",
    userProvided: false,
  };
  changed.sources = [{
    ...base,
    sourceFingerprint: fingerprintScreen02WorkflowValue(base),
  }];
  changed.event.identity = {
    canonicalTitle: "California Workplace Notice Act",
    commonNames: ["Workplace Notice Act"],
    formalIdentifier: "AB 1234 (2023–2024 Reg. Sess.)",
    issuer: "California Legislature",
    issuingJurisdiction: "California, United States",
    eventType: "workplace legislation",
    status: "enacted",
  };
  changed.event.sourceIds = [base.id];
  changed.event.description = {
    ...changed.event.description,
    text: "A California workplace notice statute selected for lifecycle review.",
    sourceIds: [base.id],
  };
  changed.event.dateLeads = [{
    id: "arbitrary-effective-date",
    date: "2025-01-01",
    label: "Law became operative",
    stage: "effective",
    sourceIds: [base.id],
    status: "provisional",
    uncertainty: "The focal treatment clock remains unapproved.",
  }];
  changed.event.broadCoverage.forEach((claim) => {
    claim.sourceIds = [base.id];
  });
  changed.event.highLevelChanges.forEach((claim) => {
    claim.sourceIds = [base.id];
  });
  changed.event.keyComponents.forEach((claim) => {
    claim.sourceIds = [base.id];
  });
  changed.unresolved.provisionalClaimIds = [
    changed.event.description.id,
    ...changed.event.dateLeads.map((lead) => lead.id),
    ...changed.event.broadCoverage.map((claim) => claim.id),
    ...changed.event.highLevelChanges.map((claim) => claim.id),
    ...changed.event.keyComponents.map((claim) => claim.id),
  ];
  return resealHandoff(changed);
}

function auditHandoffWithReviewedPrecursorSource() {
  const opened = createScreen02AuditState(
    confirmedWorkflowAuditContext(),
    "reviewed-audit-source-pack",
    "2026-08-14T10:00:00.000Z",
  );
  const round = buildReviewedScreen02AuditDiscovery(opened, {
    matchSetSnapshotId: "reviewed-audit-ccpa-set",
    at: "2026-08-14T10:00:01.000Z",
  });
  const precursor = round.sources.find(
    (source) =>
      source.id === "reviewed:ccpa-initiative-circulation-17-0039",
  );
  if (!precursor) {
    throw new Error("Expected the reviewed Audit precursor source.");
  }
  const changed = JSON.parse(JSON.stringify(buildScreen02WorkflowHandoff(
    buildReadyAuditState(),
    "0.3.3",
    "2026-08-14T10:00:02.000Z",
  ))) as Screen02WorkflowHandoff;
  changed.sources.push(precursor);
  changed.event.sourceIds = [...changed.event.sourceIds, precursor.id];
  // Deliberately leave the Audit dossier's enactment/effective leads intact
  // and omit an upstream announcement lead. Screen 3 must discover it from
  // the exact reviewed official source excerpt.
  expect(changed.event.dateLeads.some((lead) => lead.stage === "announcement"))
    .toBe(false);
  return resealHandoff(changed);
}

function dateOnlyRetrievalHandoff() {
  const changed = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
  const source = changed.sources[0]!;
  source.retrievedAt = "2026-07-29";
  const { sourceFingerprint: _sourceFingerprint, ...sourceInput } = source;
  source.sourceFingerprint = fingerprintScreen02WorkflowValue(sourceInput);
  const {
    handoffFingerprint: _handoffFingerprint,
    ...integrityWithoutHandoff
  } = changed.integrity;
  changed.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...changed,
    integrity: integrityWithoutHandoff,
  });
  return JSON.parse(
    serializeScreen02WorkflowHandoff(changed),
  ) as Screen02WorkflowHandoff;
}

function labelledDateHandoff() {
  const changed = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
  changed.event.dateLeads[0]!.date = "Publication date: 2018-05-25";
  changed.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(
    changed.event,
  );
  const { handoffFingerprint: _handoffFingerprint, ...integrity } =
    changed.integrity;
  changed.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...changed,
    integrity,
  });
  return JSON.parse(
    serializeScreen02WorkflowHandoff(changed),
  ) as Screen02WorkflowHandoff;
}

function ambiguousDateHandoff() {
  const changed = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
  changed.event.dateLeads[0]!.date =
    "Implementation window: 2018-05-01 through 2018-05-25";
  changed.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(changed.event);
  const { handoffFingerprint: _handoffFingerprint, ...integrity } = changed.integrity;
  changed.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...changed,
    integrity,
  });
  return JSON.parse(serializeScreen02WorkflowHandoff(changed)) as Screen02WorkflowHandoff;
}

function findHandoffWithBroadContextLead() {
  const changed = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
  const manifest = changed.history.searchManifests.at(-1);
  if (!manifest) throw new Error("Expected a Find search manifest fixture.");
  manifest.contextLeads = [{
    id: "broad-find-context",
    title: "A different regulation discussed in the same industry",
    locator: "https://press.example.test/different-regulation",
    publisher: "Example Press",
    publishedDate: "2026-08-01",
    sourceRole: "contextual-secondary",
    status: "unverified",
    note: "Broad Find lead without a selected-event identity binding.",
  }];
  changed.integrity.historyFingerprint = fingerprintScreen02WorkflowValue(
    changed.history,
  );
  const {
    handoffFingerprint: _handoffFingerprint,
    ...integrityWithoutHandoff
  } = changed.integrity;
  changed.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({
    ...changed,
    integrity: integrityWithoutHandoff,
  });
  return JSON.parse(
    serializeScreen02WorkflowHandoff(changed),
  ) as Screen02WorkflowHandoff;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function euBindings(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    work: {
      value: `http://publications.europa.eu/resource/cellar/gdpr-${index + 1}`,
    },
    celex: {
      value: index === 0 ? "32016R0679" : `3202${index}R${String(index + 1).padStart(4, "0")}`,
    },
    title: {
      value:
        index === 0
          ? "General Data Protection Regulation"
          : `General Data Protection Regulation related record ${index + 1}`,
    },
    date: {
      value: `${2016 + Math.min(index, 8)}-05-0${(index % 8) + 1}`,
    },
    type: {
      value:
        "http://publications.europa.eu/resource/authority/resource-type/REG",
    },
  }));
}

function euFetch(
  bindings = euBindings(1),
  requestedUrls: string[] = [],
): Screen02ConnectorFetch {
  return async (input) => {
    requestedUrls.push(String(input));
    const url = new URL(String(input));
    if (url.hostname === "eur-lex.europa.eu") {
      return new Response(
        `<html><body><main>
          <h1>General Data Protection Regulation</h1>
          <p>Regulation (EU) 2016/679 protects natural persons with regard to processing personal data.</p>
          <p>It applies from 2018-05-25. Enforcement and exemptions remain subject to the controlling provisions.</p>
        </main></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    return jsonResponse({ results: { bindings } });
  };
}

function unfamiliarEuDirectiveHandoff() {
  const selected = structuredClone(handoff());
  const source = {
    ...selected.sources[0]!,
    title: "Directive (EU) 2022/2555",
    locator:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022L2555",
    publishedDate: "2022-12-27",
  };
  const { sourceFingerprint: _sourceFingerprint, ...sourceInput } = source;
  selected.sources = [{
    ...sourceInput,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceInput),
  }];
  selected.event.identity = {
    canonicalTitle: "Directive (EU) 2022/2555",
    commonNames: [],
    formalIdentifier: "Directive (EU) 2022/2555",
    issuer: null,
    issuingJurisdiction: "European Union",
    eventType: "Directive",
    status: null,
  };
  selected.event.sourceIds = [source.id];
  selected.event.description = {
    ...selected.event.description,
    text:
      "Member States shall ensure that essential and important entities take appropriate and proportionate technical, operational and organisational measures.",
    sourceIds: [source.id],
  };
  selected.event.dateLeads = [];
  selected.event.broadCoverage = [];
  selected.unresolved.provisionalClaimIds = [selected.event.description.id];
  return resealHandoff(selected);
}

function femaConstructedTitleHandoff() {
  const selected = structuredClone(handoff());
  const sourceInput = {
    // Preserve the selected source handle because the sealed preliminary
    // assessment cites it; only replace the official record it represents.
    id: selected.sources[0]!.id,
    title: "FEMA disaster 4321: PACIFIC COAST STORMS",
    locator: "https://www.fema.gov/disaster/4321",
    publisher: "Federal Emergency Management Agency (FEMA)",
    publishedDate: "2024-04-10",
    authorityTier: 2 as const,
    channel: "OpenFEMA Disaster Declarations Summaries v2",
    retrievedAt: "2026-08-12T15:58:00.000Z",
    userProvided: false,
  };
  selected.sources = [{
    ...sourceInput,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceInput),
  }];
  selected.event.identity = {
    canonicalTitle: "PACIFIC COAST STORMS (CA, FEMA-4321)",
    commonNames: [],
    formalIdentifier: "FEMA-4321",
    issuer: "Federal Emergency Management Agency (FEMA)",
    issuingJurisdiction: "United States",
    eventType: "Flood disaster",
    status: "DR declaration",
  };
  selected.event.sourceIds = [sourceInput.id];
  selected.event.description = {
    ...selected.event.description,
    text: "FEMA recorded a disaster declaration for Pacific Coast storms.",
    sourceIds: [sourceInput.id],
  };
  selected.event.dateLeads = [{
    id: "fema-declaration-date",
    date: "2024-04-10",
    label: "FEMA declaration date",
    stage: "announcement",
    sourceIds: [sourceInput.id],
    status: "provisional",
    uncertainty: "Confirm the declaration and incident clocks.",
  }];
  selected.event.broadCoverage = [];
  selected.event.highLevelChanges = [];
  selected.event.keyComponents = [];
  selected.event.relatedVersions = [];
  selected.unresolved.provisionalClaimIds = [
    selected.event.description.id,
    "fema-declaration-date",
  ];
  return resealHandoff(selected);
}

function ukConstructedMetadataHandoff() {
  const selected = structuredClone(handoff());
  const sourceInput = {
    id: selected.sources[0]!.id,
    title: "Data Protection Act 2018",
    locator: "https://www.legislation.gov.uk/ukpga/2018/12",
    publisher: "The National Archives, legislation.gov.uk",
    publishedDate: "2018-05-23",
    authorityTier: 2 as const,
    channel: "UK legislation.gov.uk Atom search",
    retrievedAt: "2026-08-12T15:58:00.000Z",
    userProvided: false,
  };
  selected.sources = [{
    ...sourceInput,
    sourceFingerprint: fingerprintScreen02WorkflowValue(sourceInput),
  }];
  selected.event.identity = {
    canonicalTitle: "Data Protection Act 2018",
    commonNames: [],
    formalIdentifier: "ukpga/2018/12",
    issuer: null,
    issuingJurisdiction: "United Kingdom",
    eventType: "Regulation",
    status: "Published legislation catalog record",
  };
  selected.event.sourceIds = [sourceInput.id];
  selected.event.description = {
    ...selected.event.description,
    text: "The Data Protection Act 2018 is the selected UK legislation event.",
    sourceIds: [sourceInput.id],
  };
  selected.event.dateLeads = [];
  selected.event.broadCoverage = [];
  selected.event.highLevelChanges = [];
  selected.event.keyComponents = [];
  selected.event.relatedVersions = [];
  selected.unresolved.provisionalClaimIds = [selected.event.description.id];
  return resealHandoff(selected);
}

function passageCount(packet: Awaited<ReturnType<typeof researchScreen03Evidence>>) {
  return packet.evidence.reduce(
    (sum, evidence) => sum + evidence.passages.length,
    0,
  );
}

describe("Screen 3 bounded official evidence research", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps European namespace, kind, and modifier coordinates out of exact-ID collisions", () => {
    expect(screen03FormalIdentifiersEquivalent(
      "Regulation (EU) 2016/679",
      "EU Regulation 2016/679",
    )).toBe(true);
    expect(screen03FormalIdentifiersEquivalent(
      "Regulation (EU) 2016/679",
      "32016R0679",
    )).toBe(true);
    expect(screen03FormalIdentifiersEquivalent(
      "Regulation (EC) No. 679/2016",
      "CELEX:32016R0679",
    )).toBe(true);
    expect(screen03FormalIdentifiersEquivalent(
      "Regulation (EEC) 2016/679",
      "32016R0679",
    )).toBe(true);
    expect(screen03FormalIdentifiersEquivalent(
      "Commission Implementing Regulation (EU) 2016/679",
      "32016R0679",
    )).toBe(true);

    for (const conflicting of [
      "Regulation (EC) 2016/679",
      "Regulation (EEC) 2016/679",
      "Regulation (UK) 2016/679",
      "Directive (EU) 2016/679",
      "Commission Implementing Regulation (EU) 2016/679",
      "Commission Delegated Regulation (EU) 2016/679",
    ]) {
      expect(screen03FormalIdentifiersEquivalent(
        "Regulation (EU) 2016/679",
        conflicting,
      )).toBe(false);
    }
    expect(screen03FormalIdentifiersEquivalent(
      "Regulation (UK) 2016/679",
      "32016R0679",
    )).toBe(false);
    expect(screen03FormalIdentifiersEquivalent(
      "Regulation (EU) 2016-1234",
      "Directive (EU) 2016-1234",
    )).toBe(false);
    expect(screen03FormalIdentifiersEquivalent(
      "Regulation (EU) 2016-1234",
      "FR Doc. 2016-1234",
    )).toBe(false);
    for (const localIdentifier of [
      "Order No. 2016-1234",
      "Law No. 2026-12345",
      "Rule 2019-1000",
    ]) {
      const coordinate = localIdentifier.match(/\d{4}-\d{4,8}/u)?.[0];
      expect(screen03FormalIdentifiersEquivalent(
        localIdentifier,
        `FR Doc. ${coordinate}`,
      ), localIdentifier).toBe(false);
    }
    expect(screen03FormalIdentifiersEquivalent(
      "FR Doc. 2026-12345",
      "2026-12345",
    )).toBe(true);
  });

  it("reads Federal Register document numbers only from official record locators", () => {
    expect(screen03FederalRegisterLocatorDocumentNumber(
      "https://www.federalregister.gov/documents/2020/01/15/2020-12345/example-reporting-rule",
    )).toBe("2020-12345");
    expect(screen03FederalRegisterLocatorDocumentNumber(
      "https://www.federalregister.gov/d/2026-12345",
    )).toBe("2026-12345");
    expect(screen03FederalRegisterLocatorDocumentNumber(
      "https://www.govinfo.gov/content/pkg/FR-2022-10-14/pdf/2022-22386.pdf",
    )).toBe("2022-22386");
    expect(screen03FederalRegisterLocatorDocumentNumber(
      "https://www.govinfo.gov/content/pkg/FR-2022-10-14/html/2022-22386.htm",
    )).toBe("2022-22386");

    for (const nonRecordLocator of [
      "Order No. 2022-22386",
      "https://records.example.test/notices/2022-22386.pdf",
      "https://www.govinfo.gov/content/pkg/FR-2022-10-14/pdf/2022-22386-amendment.pdf",
    ]) {
      expect(screen03FederalRegisterLocatorDocumentNumber(nonRecordLocator))
        .toBeNull();
    }
  });

  it("drops same-coordinate formal conflicts before title context can bind them", () => {
    const selected = handoff();
    const reviewed = REVIEWED_SCREEN02_EVENT_REGISTRY.find((proposal) =>
      proposal.id === "registry-eu-gdpr-2018"
    );
    if (!reviewed || reviewed.mode !== "find") {
      throw new Error("Expected the reviewed GDPR Find proposal.");
    }
    const matchingContext = {
      ...structuredClone(reviewed),
      title: selected.event.identity.canonicalTitle,
      nativeIdentity: {
        ...structuredClone(reviewed.nativeIdentity!),
        issuer: selected.event.identity.issuer,
        issuingJurisdiction: selected.event.identity.issuingJurisdiction,
      },
      event: {
        ...structuredClone(reviewed.event),
        displayName: selected.event.identity.canonicalTitle,
        geographies: [selected.event.identity.issuingJurisdiction!],
      },
    };

    for (const formalIdentifier of [
      "Regulation (EC) 2016/679",
      "Regulation (EEC) 2016/679",
      "Regulation (UK) 2016/679",
      "Directive (EU) 2016/679",
      "Commission Implementing Regulation (EU) 2016/679",
      "Commission Delegated Regulation (EU) 2016/679",
    ]) {
      expect(screen03ProposalIdentityRelationship({
        ...structuredClone(matchingContext),
        nativeIdentity: {
          ...structuredClone(matchingContext.nativeIdentity!),
          formalIdentifier,
        },
      }, selected), formalIdentifier).toBeNull();
    }

    expect(screen03ProposalIdentityRelationship({
      ...structuredClone(matchingContext),
      nativeIdentity: {
        ...structuredClone(matchingContext.nativeIdentity!),
        formalIdentifier: "Regulation (EU) 2016/680",
        status: "Final amendment",
      },
    }, selected)).toMatchObject({
      scope: "related",
      relatedStage: "amendment",
    });
  });

  it("preserves a direct CELEX handoff as the exact CELLAR lookup", async () => {
    const selected = structuredClone(handoff());
    selected.event.identity.formalIdentifier = "CELEX:32016R0679";
    const requestedUrls: string[] = [];

    requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: resealHandoff(selected),
      fetch: euFetch(euBindings(1), requestedUrls),
      retrievedAt: researchedAt,
    }));

    const cellarQueries = requestedUrls
      .filter((value) => new URL(value).hostname === "publications.europa.eu")
      .map((value) => new URL(value).searchParams.get("query") ?? "");
    expect(cellarQueries[0]).toContain(
      'FILTER(STR(?celex) = "32016R0679")',
    );
  });

  it.each([
    "Regulation (UK) 2016/679",
    "Regulation (EU) 2016/12345",
    "Regulation (EU) 2016/01234",
  ])("does not construct an invalid CELLAR exact lookup for %s", async (formalIdentifier) => {
    const selected = structuredClone(handoff());
    selected.event.identity.formalIdentifier = formalIdentifier;
    const requestedUrls: string[] = [];

    requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: resealHandoff(selected),
      fetch: euFetch([], requestedUrls),
      retrievedAt: researchedAt,
    }));

    const cellarQueries = requestedUrls
      .filter((value) => new URL(value).hostname === "publications.europa.eu")
      .map((value) => new URL(value).searchParams.get("query") ?? "");
    expect(cellarQueries.some((query) =>
      query.includes("FILTER(STR(?celex)")
    )).toBe(false);
  });

  it("keeps raw CELEX metadata direct while the public citation requires extractive text", async () => {
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch: euFetch(),
        retrievedAt: researchedAt,
      }),
    );
    const formal = packet.proposals.identity.find(
      (proposal) => proposal.label === "Formal identifier",
    );
    expect(formal).toMatchObject({
      value: "Regulation (EU) 2016/679",
      support: "direct",
    });
    expect(packet.evidence.flatMap((item) => item.passages)).toContainEqual(
      expect.objectContaining({
        text: "32016R0679",
        basis: "official-record-field",
        officialField: "formal-identifier",
      }),
    );
    expect(packet.evidence.flatMap((item) => item.passages)).not.toContainEqual(
      expect.objectContaining({
        text: "Regulation (EU) 2016/679",
        basis: "official-record-field",
      }),
    );
    expect(packet.evidence.flatMap((item) => item.passages)).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining("Regulation (EU) 2016/679"),
        basis: "official-document-passage",
      }),
    );
    expect(formal && screen03ProposalConfirmability(formal, packet.evidence))
      .toEqual({ confirmable: true, reason: "confirmable" });
  });

  it("keeps derived event taxonomy out of official-record fields", async () => {
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch: euFetch(),
        retrievedAt: researchedAt,
      }),
    );

    expect(packet.evidence.length).toBeGreaterThan(0);
    expect(packet.evidence.every((item) =>
      typeof item.sourceRole === "string" &&
      typeof item.sourcePlatform === "string" &&
      typeof item.documentType === "string" &&
      typeof item.language === "string"
    )).toBe(true);
    expect(packet.proposals.identity).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Common name", value: "GDPR" }),
      expect.objectContaining({ label: "Event type", value: "Regulation" }),
    ]));
    expect(packet.evidence.flatMap((item) => item.passages)).not.toContainEqual(
      expect.objectContaining({ officialField: "event-type" }),
    );
    expect(packet.evidence.flatMap((item) => item.passages)).toContainEqual(
      expect.objectContaining({
        basis: "source-metadata",
        text: expect.stringContaining(
          "Fixed-core event classification: Regulation.",
        ),
      }),
    );
  });

  it("does not promote CELLAR-derived citation, jurisdiction, or type metadata", async () => {
    const selected = structuredClone(handoff());
    selected.event.identity.status = "REG";
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealHandoff(selected),
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.hostname === "publications.europa.eu") {
            return jsonResponse({ results: { bindings: euBindings(1) } });
          }
          return new Response("not available", { status: 404 });
        },
        retrievedAt: researchedAt,
      }),
    );
    const identity = packet.proposals.identity;
    const passages = packet.evidence.flatMap((item) => item.passages);

    expect(identity.find((proposal) =>
      proposal.label === "Formal identifier"
    )?.support).not.toBe("direct");
    expect(identity.find((proposal) =>
      proposal.label === "Issuing jurisdiction"
    )?.support).not.toBe("direct");
    expect(identity.find((proposal) =>
      proposal.label === "Current status"
    )?.support).not.toBe("direct");
    expect(passages).toContainEqual(expect.objectContaining({
      basis: "official-record-field",
      officialField: "formal-identifier",
      text: "32016R0679",
    }));
    expect(passages).not.toContainEqual(expect.objectContaining({
      basis: "official-record-field",
      text: "Regulation (EU) 2016/679",
    }));
    expect(passages).not.toContainEqual(
      expect.objectContaining({ officialField: "issuing-jurisdiction" }),
    );
    expect(passages).not.toContainEqual(
      expect.objectContaining({ officialField: "status" }),
    );
    expect(passages).toContainEqual(expect.objectContaining({
      basis: "source-metadata",
      text: expect.stringContaining("Reported jurisdiction: European Union."),
    }));
    expect(passages).toContainEqual(expect.objectContaining({
      basis: "source-metadata",
      text: expect.stringContaining("Reported status: REG."),
    }));
  });

  it("requires extractive text rather than derived metadata to directly support an unfamiliar event type", async () => {
    const selected = unfamiliarEuDirectiveHandoff();
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.hostname === "eur-lex.europa.eu") {
            return new Response(
              `<document><title>Directive (EU) 2022/2555</title><article>Member States shall ensure that essential and important entities take appropriate and proportionate technical, operational and organisational measures.</article></document>`,
              { headers: { "content-type": "application/xml" } },
            );
          }
          return jsonResponse({
            results: {
              bindings: [{
                work: { value: "http://publications.europa.eu/resource/cellar/nis2" },
                celex: { value: "32022L2555" },
                title: { value: "Directive (EU) 2022/2555" },
                date: { value: "2022-12-27" },
                type: { value: "http://publications.europa.eu/resource/authority/resource-type/DIR" },
              }],
            },
          });
        },
        retrievedAt: researchedAt,
      }),
    );
    expect(packet.proposals.identity).toContainEqual(expect.objectContaining({
      label: "Formal identifier",
      value: "Directive (EU) 2022/2555",
      support: "direct",
    }));
    expect(packet.proposals.identity).toContainEqual(expect.objectContaining({
      label: "Event type",
      value: "Directive",
      support: "direct",
    }));
    expect(packet.proposals.identity).not.toContainEqual(
      expect.objectContaining({
        label: "Event type",
        value: "Regulation",
      }),
    );
    expect(packet.evidence.flatMap((item) => item.passages)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ basis: "official-record-field" }),
        expect.objectContaining({ basis: "official-document-passage" }),
      ]),
    );
    expect(packet.evidence.flatMap((item) => item.passages)).not.toContainEqual(
      expect.objectContaining({
        officialField: "event-type",
      }),
    );
  });

  it("does not promote constructed FEMA identity metadata as official record fields", async () => {
    const selected = femaConstructedTitleHandoff();
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.pathname.includes("DisasterDeclarationsSummaries")) {
            return jsonResponse({
              DisasterDeclarationsSummaries: [{
                id: "row-one",
                disasterNumber: 4321,
                state: "CA",
                declarationType: "DR",
                declarationDate: "2024-04-10T00:00:00.000Z",
                incidentType: "Flood",
                declarationTitle: "PACIFIC COAST STORMS",
                incidentBeginDate: "2024-04-01T00:00:00.000Z",
                incidentEndDate: "2024-04-12T00:00:00.000Z",
                designatedArea: "Alpha (County)",
              }],
            });
          }
          return new Response("not available", { status: 404 });
        },
        retrievedAt: researchedAt,
      }),
    );
    const identity = packet.proposals.identity;
    const title = identity.find((proposal) =>
      proposal.label === "Canonical event title"
    );
    const eventType = identity.find((proposal) =>
      proposal.label === "Event type"
    );
    const formalIdentifier = identity.find((proposal) =>
      proposal.label === "Formal identifier"
    );
    const issuer = identity.find((proposal) => proposal.label === "Issuer");
    const jurisdiction = identity.find((proposal) =>
      proposal.label === "Issuing jurisdiction"
    );
    const status = identity.find((proposal) =>
      proposal.label === "Current status"
    );

    expect(title?.support).not.toBe("direct");
    expect(eventType?.support).not.toBe("direct");
    expect(formalIdentifier?.support).not.toBe("direct");
    expect(issuer?.support).not.toBe("direct");
    expect(jurisdiction?.support).not.toBe("direct");
    expect(status?.support).not.toBe("direct");
    const passages = packet.evidence.flatMap((item) => item.passages);
    for (const officialField of [
      "canonical-title",
      "formal-identifier",
      "issuer",
      "issuing-jurisdiction",
      "status",
      "event-type",
    ]) {
      expect(passages).not.toContainEqual(
        expect.objectContaining({ officialField }),
      );
    }
    expect(passages).toContainEqual(expect.objectContaining({
      basis: "source-metadata",
      text: expect.stringContaining("Reported jurisdiction: United States."),
    }));
    expect(passages).toContainEqual(expect.objectContaining({
      basis: "source-metadata",
      text: expect.stringContaining("Reported status: DR declaration."),
    }));
  });

  it("keeps constructed UK path identifier, jurisdiction, and status indirect", async () => {
    const selected = ukConstructedMetadataHandoff();
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.pathname.endsWith("data.feed")) {
            return new Response(
              `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">
                <entry>
                  <id>https://www.legislation.gov.uk/id/ukpga/2018/12</id>
                  <title>Data Protection Act 2018</title>
                  <updated>2018-05-23T00:00:00Z</updated>
                  <ukm:EnactmentDate Date="2018-05-23"/>
                  <link rel="alternate" href="https://www.legislation.gov.uk/ukpga/2018/12"/>
                </entry>
              </feed>`,
              { headers: { "content-type": "application/atom+xml" } },
            );
          }
          return new Response("not available", { status: 404 });
        },
        retrievedAt: researchedAt,
      }),
    );
    const identity = packet.proposals.identity;
    const passages = packet.evidence.flatMap((item) => item.passages);

    expect(identity.find((proposal) =>
      proposal.label === "Canonical event title"
    )?.support).toBe("direct");
    expect(identity.find((proposal) =>
      proposal.label === "Formal identifier"
    )?.support).not.toBe("direct");
    expect(identity.find((proposal) =>
      proposal.label === "Issuing jurisdiction"
    )?.support).not.toBe("direct");
    expect(identity.find((proposal) =>
      proposal.label === "Current status"
    )?.support).not.toBe("direct");
    expect(passages).toContainEqual(expect.objectContaining({
      basis: "official-record-field",
      officialField: "canonical-title",
      text: "Data Protection Act 2018",
    }));
    for (const officialField of [
      "formal-identifier",
      "issuing-jurisdiction",
      "status",
    ]) {
      expect(passages).not.toContainEqual(
        expect.objectContaining({ officialField }),
      );
    }
    expect(passages).toContainEqual(expect.objectContaining({
      basis: "source-metadata",
      text: expect.stringContaining("Reported jurisdiction: United Kingdom."),
    }));
    expect(passages).toContainEqual(expect.objectContaining({
      basis: "source-metadata",
      text: expect.stringContaining(
        "Reported status: Published legislation catalog record.",
      ),
    }));
  });

  it("accepts bounded official JSON text and diagnoses malformed JSON", async () => {
    const run = (documentBody: string) => researchScreen03Evidence({
      handoff: handoff(),
      fetch: async (input) => {
        const url = new URL(String(input));
        if (url.hostname === "eur-lex.europa.eu") {
          return new Response(documentBody, {
            headers: { "content-type": "application/json" },
          });
        }
        return jsonResponse({ results: { bindings: euBindings(1) } });
      },
      retrievedAt: researchedAt,
    });
    const accepted = requireScreen03ResearchPacket(await run(JSON.stringify({
      title: "General Data Protection Regulation",
      provision: "Regulation (EU) 2016/679 applies from 25 May 2018.",
    })));
    expect(accepted.evidence.flatMap((item) => item.passages)).toContainEqual(
      expect.objectContaining({
        basis: "official-document-passage",
        text: expect.stringMatching(/applies from 25 May 2018/i),
      }),
    );

    const malformed = requireScreen03ResearchPacket(await run("{bad json"));
    expect(malformed.coverage.gaps.join(" ")).toMatch(/malformed JSON/i);
  });

  it("researches and integrates a structurally valid labelled Screen 2 date", async () => {
    const sourceHandoff = labelledDateHandoff();
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: sourceHandoff,
        fetch: euFetch(),
        retrievedAt: researchedAt,
      }),
    );
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-12T16:00:01.000Z",
    );

    expect(packet.proposals.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2018-05-25", value: "2018-05-25" }),
      ]),
    );
    expect(state.status).toBe("reviewing");
    expect(state.proposals.timeline.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date))).toBe(true);
  });

  it("keeps an ambiguous carried date as an explicit verification gap after research", async () => {
    const sourceHandoff = ambiguousDateHandoff();
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: sourceHandoff,
        fetch: euFetch(),
        retrievedAt: researchedAt,
      }),
    );
    const state = buildScreen03StateFromResearch(
      sourceHandoff,
      packet,
      "2026-08-12T16:00:01.000Z",
    );

    expect(
      state.proposals.requiredVariable.some((proposal) =>
        proposal.value.includes("2018-05-01 through 2018-05-25"),
      ),
    ).toBe(true);
    expect(state.proposals.timeline.every((proposal) => proposal.date !== "2018-05-01")).toBe(true);
  });

  it("returns carried evidence at one total deadline when a connector never resolves", async () => {
    vi.useFakeTimers();
    const fetchSignals: AbortSignal[] = [];
    const telemetry: Screen03ResearchTelemetry[] = [];
    let acknowledgeFetch: (() => void) | null = null;
    const fetchStarted = new Promise<void>((resolve) => {
      acknowledgeFetch = resolve;
    });
    const pending = researchScreen03Evidence({
      handoff: handoff(),
      fetch: async (_input, init) => {
        if (init?.signal) fetchSignals.push(init.signal);
        acknowledgeFetch?.();
        return new Promise<Response>(() => undefined);
      },
      retrievedAt: researchedAt,
      deadlineMs: 50,
      onTelemetry: (value) => {
        telemetry.push(value);
      },
    });

    await fetchStarted;
    await vi.advanceTimersByTimeAsync(50);
    const packet = requireScreen03ResearchPacket(await pending);
    expect(fetchSignals.length).toBeGreaterThan(0);
    expect(fetchSignals.every((signal) => signal.aborted)).toBe(true);
    expect(packet.evidence.some((item) => item.status === "carried")).toBe(true);
    expect(packet.coverage.stoppingRule.status).toBe("not-met");
    expect(packet.coverage.gaps.join(" ")).toMatch(/total research budget/i);
    expect(telemetry).toEqual([
      expect.objectContaining({
        event: "screen03-research-completed",
        stoppingRuleStatus: "not-met",
      }),
    ]);
  });

  it("retrieves the selected carried official document before stalled connectors exhaust the shared deadline", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis.crypto.subtle, "digest").mockResolvedValue(
      new Uint8Array(32).buffer,
    );
    const requestedUrls: string[] = [];
    const pending = researchScreen03Evidence({
      handoff: handoff(),
      fetch: async (input) => {
        const locator = String(input);
        requestedUrls.push(locator);
        const url = new URL(locator);
        if (url.hostname === "publications.europa.eu") {
          return new Promise<Response>(() => undefined);
        }
        return new Response(`<!doctype html><main>
          <h1>General Data Protection Regulation</h1>
          <p>Regulation (EU) 2016/679 applies from 25 May 2018.</p>
        </main>`, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
      retrievedAt: researchedAt,
      deadlineMs: 50,
    });

    expect(requestedUrls.some((locator) =>
      new URL(locator).hostname === "eur-lex.europa.eu"
    )).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(50);
    const packet = requireScreen03ResearchPacket(await pending);

    expect(packet.coverage.stoppingRule.status).toBe("not-met");
    expect(packet.coverage.stoppingRule.note).toMatch(/1 document fetch/i);
    expect(packet.proposals.identity).toContainEqual(
      expect.objectContaining({
        label: "Formal identifier",
        value: "Regulation (EU) 2016/679",
        support: "direct",
      }),
    );
  });

  it("bounds deadline overrides below the client margin", async () => {
    await expect(
      researchScreen03Evidence({
        handoff: handoff(),
        fetch: euFetch(),
        retrievedAt: researchedAt,
        deadlineMs: SCREEN_03_RESEARCH_TOTAL_DEADLINE_MS + 1,
      }),
    ).rejects.toThrow(/deadlineMs/i);
  });

  it("propagates the remaining total budget to optional synthesis", async () => {
    vi.useFakeTimers();
    const synthesisSignals: AbortSignal[] = [];
    let acknowledgeSynthesis: (() => void) | null = null;
    const synthesisStarted = new Promise<void>((resolve) => {
      acknowledgeSynthesis = resolve;
    });
    const pending = researchScreen03Evidence({
      handoff: handoff(),
      fetch: euFetch(),
      retrievedAt: researchedAt,
      deadlineMs: 50,
      synthesizer: async (_request, options) => {
        synthesisSignals.push(options.signal);
        acknowledgeSynthesis?.();
        return new Promise(() => undefined);
      },
    });

    await synthesisStarted;
    await vi.advanceTimersByTimeAsync(50);
    const packet = requireScreen03ResearchPacket(await pending);
    expect(synthesisSignals).toHaveLength(1);
    expect(synthesisSignals[0]?.aborted).toBe(true);
    expect(packet.coverage.stoppingRule.status).toBe("not-met");
    expect(packet.proposals.timeline).toEqual(expect.any(Array));
  });

  it("settles at the shared deadline when an injected context provider ignores abort", async () => {
    vi.useFakeTimers();
    let acknowledgeContext: (() => void) | null = null;
    const contextStarted = new Promise<void>((resolve) => {
      acknowledgeContext = resolve;
    });
    const pending = researchScreen03Evidence({
      handoff: handoff(),
      fetch: euFetch(),
      retrievedAt: researchedAt,
      deadlineMs: 2_500,
      contextSearch: async () => {
        acknowledgeContext?.();
        return new Promise(() => undefined);
      },
    });

    await contextStarted;
    await vi.advanceTimersByTimeAsync(2_500);
    const packet = requireScreen03ResearchPacket(await pending);
    expect(packet.contextLeads).toEqual([]);
    expect(packet.coverage.stoppingRule.status).toBe("not-met");
  });

  it("records the current retrieval after refreshing date-only carried evidence", async () => {
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: dateOnlyRetrievalHandoff(),
        fetch: euFetch([]),
        retrievedAt: researchedAt,
      }),
    );

    expect(
      packet.evidence.find((item) => item.sourceId === "gdpr-official")
        ?.retrievedAt,
    ).toBe(researchedAt);
  });

  it("keeps an unlisted secondary publisher metadata-only and never fetches its page", async () => {
    const relatedLocator = "https://news.example.org/gdpr-implementation";
    const requestedUrls: string[] = [];
    const contextSearch = vi.fn(async (input) => [
      gdeltLeadToScreen02ContextLead({
        lead: {
          id: "gdelt-context-implementation",
          title: "Regulator discusses GDPR implementation",
          locator: relatedLocator,
          publisher: "news.example.org",
          publishedDate: "2026-08-01",
          language: "English",
          sourceCountry: "United Kingdom",
          sourceRole: "contextual-secondary",
          authorityTier: 6,
          evidenceBasis: "source-metadata",
        },
        eventFamily: input.eventFamily,
        retrievedAt: input.retrievedAt,
        stage: input.stage,
      }),
    ]);
    const packet = await researchScreen03Evidence({
      handoff: handoff(),
      fetch: euFetch(euBindings(1), requestedUrls),
      retrievedAt: researchedAt,
      contextSearch,
    });

    expect(contextSearch).toHaveBeenCalledOnce();
    expect(packet.contextLeads).toEqual([
      expect.objectContaining({
        id: "gdelt-context-implementation",
        sourceRole: "contextual-secondary",
        status: "unverified",
      }),
    ]);
    expect(requestedUrls).not.toContain(relatedLocator);
    expect(packet.evidence.some((item) =>
      item.locator.includes("news.example.org")
    )).toBe(false);
    expect(JSON.stringify(packet.proposals)).not.toContain(
      "Regulator discusses GDPR implementation",
    );
    expect(requireScreen03ResearchPacket(packet)).toBeTruthy();
  });

  it("keeps a vetted related page contextual within the existing document budget", async () => {
    const selected = ccpaReviewedSourcePackHandoff();
    const relatedLocator =
      "https://www.reuters.com/world/us/california-consumer-privacy-act-implementation/";
    const relatedSentence =
      "The California Consumer Privacy Act does not apply to nonprofit organizations that operate solely for charitable purposes.";
    const documentRequests: Array<{ url: string; init?: RequestInit }> = [];
    const telemetry: Screen03ResearchTelemetry[] = [];
    const contextSearch = vi.fn(async (input) => [
      gdeltLeadToScreen02ContextLead({
        lead: {
          id: "gdelt-context-ccpa-reuters",
          title: "California Consumer Privacy Act implementation",
          locator: relatedLocator,
          publisher: "www.reuters.com",
          publishedDate: "2026-08-01",
          language: "English",
          sourceCountry: "United States",
          sourceRole: "contextual-secondary",
          authorityTier: 6,
          evidenceBasis: "source-metadata",
        },
        eventFamily: input.eventFamily,
        retrievedAt: input.retrievedAt,
        stage: input.stage,
      }),
    ]);
    const fetch: Screen02ConnectorFetch = async (input, init) => {
      const url = new URL(String(input));
      if (
        url.hostname === "www.reuters.com" ||
        url.hostname === "leginfo.legislature.ca.gov" ||
        url.hostname === "oag.ca.gov"
      ) {
        documentRequests.push({ url: url.toString(), init });
        const body = url.hostname === "www.reuters.com"
          ? `<html><body><article><h1>California Consumer Privacy Act implementation</h1><p>${relatedSentence}</p></article></body></html>`
          : "<html><body><main><h1>California Consumer Privacy Act</h1><p>The statute applies to covered businesses beginning January 1, 2020.</p></main></body></html>";
        return new Response(body, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return jsonResponse({ results: { bindings: [] } });
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
        contextSearch,
        onTelemetry: (value) => {
          telemetry.push(value);
        },
      }),
    );

    const relatedEvidence = packet.evidence.find(
      (item) => item.locator === relatedLocator,
    );
    expect(relatedEvidence).toMatchObject({
      authorityTier: 6,
      status: "retrieved",
      passages: expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining(relatedSentence),
          locator: relatedLocator,
          basis: "contextual-secondary",
        }),
      ]),
    });
    expect(relatedEvidence && screen03EvidenceSourceRole(relatedEvidence)).toBe(
      "related-secondary-record",
    );
    const relatedProposal = [
      ...packet.proposals.component,
      ...packet.proposals.eligibility,
    ].find(
      (proposal) => proposal.value === relatedSentence,
    );
    expect(relatedProposal).toBeUndefined();
    expect(packet.contextLeads?.[0]?.note).toMatch(
      /fetched this related page.+researcher confirmation/i,
    );
    expect(documentRequests).toHaveLength(SCREEN_03_DOCUMENT_MAX_FETCHES);
    expect(documentRequests.filter((request) =>
      request.url === relatedLocator
    )).toHaveLength(1);
    expect(documentRequests.every((request) =>
      request.init?.redirect === "manual"
    )).toBe(true);
    expect(telemetry).toEqual([
      expect.objectContaining({
        documentAttempts: SCREEN_03_DOCUMENT_MAX_FETCHES,
        documentUsable: SCREEN_03_DOCUMENT_MAX_FETCHES,
      }),
    ]);
    expect(telemetry[0]!.documentAttempts).toBeLessThanOrEqual(
      SCREEN_03_DOCUMENT_MAX_ATTEMPTS,
    );
  });

  it("does not follow a vetted related-page redirect or bind it as evidence", async () => {
    const relatedLocator =
      "https://www.reuters.com/world/europe/gdpr-implementation/";
    const requestedRelated: Array<{ url: string; init?: RequestInit }> = [];
    const officialFetch = euFetch();
    const contextSearch = vi.fn(async (input) => [
      gdeltLeadToScreen02ContextLead({
        lead: {
          id: "gdelt-context-gdpr-redirect",
          title: "General Data Protection Regulation implementation",
          locator: relatedLocator,
          publisher: "www.reuters.com",
          publishedDate: "2026-08-01",
          language: "English",
          sourceCountry: "United Kingdom",
          sourceRole: "contextual-secondary",
          authorityTier: 6,
          evidenceBasis: "source-metadata",
        },
        eventFamily: input.eventFamily,
        retrievedAt: input.retrievedAt,
        stage: input.stage,
      }),
    ]);
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch: async (input, init) => {
          const url = String(input);
          if (url === relatedLocator) {
            requestedRelated.push({ url, init });
            return new Response(null, {
              status: 302,
              headers: { location: "https://unlisted.example.org/article" },
            });
          }
          return officialFetch(input, init);
        },
        retrievedAt: researchedAt,
        contextSearch,
      }),
    );

    expect(requestedRelated).toEqual([
      expect.objectContaining({
        url: relatedLocator,
        init: expect.objectContaining({ redirect: "manual" }),
      }),
    ]);
    expect(packet.evidence.some((item) => item.locator === relatedLocator)).toBe(
      false,
    );
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /related source page redirected outside its reviewed HTTPS source policy/i,
    );
  });

  it("follows a bounded same-policy official redirect and records the resolved representation", async () => {
    const selected = structuredClone(handoff());
    const initial =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679";
    const source = { ...selected.sources[0]!, locator: initial };
    const { sourceFingerprint: _sourceFingerprint, ...sourceInput } = source;
    selected.sources[0] = {
      ...sourceInput,
      sourceFingerprint: fingerprintScreen02WorkflowValue(sourceInput),
    };
    const resealed = resealHandoff(selected);
    const resolved = "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng";
    const requested: string[] = [];
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealed,
        fetch: async (input) => {
          const url = String(input);
          requested.push(url);
          if (url === initial) {
            return new Response(null, {
              status: 302,
              headers: { location: resolved },
            });
          }
          if (url === resolved) {
            return new Response(
              "<article><h1>General Data Protection Regulation</h1><p>Regulation (EU) 2016/679 applies from 25 May 2018.</p></article>",
              { headers: { "content-type": "text/html" } },
            );
          }
          return jsonResponse({ results: { bindings: euBindings(1) } });
        },
        retrievedAt: researchedAt,
      }),
    );
    expect(requested).toEqual(expect.arrayContaining([initial, resolved]));
    expect(packet.coverage.channels).toContainEqual(expect.objectContaining({
      channel: "Official document representation resolver",
      status: "searched",
      note: expect.stringMatching(/policy-revalidated redirect.+eur-lex/i),
    }));
    expect(packet.proposals.identity).toContainEqual(expect.objectContaining({
      label: "Formal identifier",
      support: "direct",
    }));
  });

  it("does not relabel broad Find discovery leads as selected-event context", async () => {
    const packet = await researchScreen03Evidence({
      handoff: findHandoffWithBroadContextLead(),
      fetch: euFetch(),
      retrievedAt: researchedAt,
    });
    expect(packet.contextLeads).toEqual([]);
  });

  it("deepens the exact selected event with identity- and stage-specific official queries", async () => {
    const requestedUrls: string[] = [];
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch: euFetch(euBindings(1), requestedUrls),
        retrievedAt: researchedAt,
      }),
    );

    const connectorUrls = requestedUrls.filter(
      (value) => new URL(value).hostname === "publications.europa.eu",
    );
    expect(connectorUrls).toHaveLength(SCREEN_03_RESEARCH_MAX_CALLS);
    expect(
      connectorUrls.every(
        (value) => new URL(value).hostname === "publications.europa.eu",
      ),
    ).toBe(true);
    const decodedQueries = connectorUrls.map(
      (value) => new URL(value).searchParams.get("query") ?? "",
    );
    expect(decodedQueries.join(" ")).toMatch(/2016.*679/i);
    expect(decodedQueries[0]).toContain('FILTER(STR(?celex) = "32016R0679")');
    // The first bounded slot resolves the selected instrument exactly;
    // remaining slots retain the other five stage-discovery queries.
    for (const stageTerms of [
      /enactment|adoption|publication|final rule/i,
      /effective|application|commencement|in force/i,
      /implementation|compliance|phase in|deadline/i,
      /enforcement|penalty|inspection|sanction/i,
      /amendment|delay|extension|repeal/i,
    ]) {
      expect(decodedQueries.join(" ")).toMatch(stageTerms);
    }

    expect(packet.upstreamEventFingerprint).toBe(
      handoff().integrity.eventFingerprint,
    );
    expect(packet.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "carried",
          sourceId: "gdpr-official",
        }),
        expect.objectContaining({
          status: "retrieved",
          title: "General Data Protection Regulation",
          authorityTier: 2,
        }),
      ]),
    );
    expect(packet.proposals.overview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "What happened",
          reviewStatus: "proposed",
          support: "indirect",
        }),
      ]),
    );
    expect(packet.coverage).toMatchObject({
      routes: ["eu-cellar-sparql-v1"],
      exhaustive: false,
      outcomeValuesInspected: false,
      stoppingRule: { status: "met" },
    });
    expect(packet.coverage.stages).toEqual(
      expect.arrayContaining([
        "effective/application",
        "enforcement/penalty",
      ]),
    );
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /No active direct passage supports the implementation\/compliance research stage/i,
    );
    expect(packet.coverage.gaps.join(" ")).toMatch(/not an exhaustive search/i);
    expect(packet.proposals.identity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Canonical event title",
          support: "direct",
        }),
      ]),
    );
    expect(packet.proposals.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2018-05-25",
          support: "direct",
        }),
      ]),
    );
    const effectiveProposal = packet.proposals.timeline.find(
      (proposal) => proposal.date === "2018-05-25",
    );
    const effectivePassageText = packet.evidence
      .flatMap((item) => item.passages)
      .filter((passage) => effectiveProposal?.passageIds.includes(passage.id))
      .map((passage) => passage.text)
      .join(" ");
    expect(effectivePassageText).toMatch(/applies from 2018-05-25/i);
    const directPassageIds = new Set(
      packet.evidence.flatMap((item) =>
        item.passages
          .filter((passage) =>
            isOfficialSubstantivePassage(passage) ||
            passage.basis === "official-record-field",
          )
          .map((passage) => passage.id),
      ),
    );
    for (const proposal of Object.values(packet.proposals)
      .flat()
      .filter((proposal) => proposal.support === "direct")) {
      expect(proposal.passageIds.some((id) => directPassageIds.has(id))).toBe(
        true,
      );
    }
    expect(packet.evidence.some((item) =>
      /related record/i.test(item.title)
    )).toBe(false);
  });

  it("applies a strong same-event identity gate before ranking similar official records", async () => {
    const selected = JSON.parse(
      JSON.stringify(ccpaReviewedSourcePackHandoff()),
    ) as Screen02WorkflowHandoff;
    selected.event.identity = {
      ...selected.event.identity,
      canonicalTitle: "Clean Air Reporting Rule",
      commonNames: ["CARR"],
      formalIdentifier: "2026-12345",
      issuer: "Environmental Protection Agency",
      issuingJurisdiction: "United States",
    };
    const fetchedTitles: string[] = [];
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: [] } });
      }
      if (url.hostname === "www.federalregister.gov" && url.pathname.startsWith("/api/")) {
        return jsonResponse({
          count: 2,
          results: [
            {
              title: "Clean Air Reporting Rule",
              type: "Rule",
              abstract: "The agency establishes revised reporting requirements.",
              document_number: "2026-12345",
              html_url: "https://www.federalregister.gov/d/2026-12345",
              publication_date: "2026-07-01",
              effective_on: "2026-09-01",
              agencies: [{ name: "Environmental Protection Agency" }],
            },
            {
              title: "Clean Air Reporting Rule Extension",
              type: "Rule",
              abstract: "A related record extends a separate deadline.",
              document_number: "2026-99999",
              html_url: "https://www.federalregister.gov/d/2026-99999",
              publication_date: "2026-07-01",
              effective_on: "2026-09-01",
              agencies: [{ name: "Environmental Protection Agency" }],
            },
          ],
        });
      }
      if (url.hostname === "www.federalregister.gov") {
        fetchedTitles.push(url.pathname);
        return new Response(
          "Clean Air Reporting Rule 2026-12345 becomes effective on 2026-09-01.",
          { headers: { "content-type": "text/plain" } },
        );
      }
      if (url.hostname === "eur-lex.europa.eu") {
        return new Response("Unrelated carried record.", {
          headers: { "content-type": "text/plain" },
        });
      }
      throw new Error(`Unexpected route ${url.hostname}`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const serialized = JSON.stringify({
      evidence: packet.evidence,
      proposals: packet.proposals,
    });
    expect(serialized).toContain("Clean Air Reporting Rule");
    expect(serialized).toContain("2026-12345");
    expect(serialized).not.toContain("Clean Air Reporting Rule Extension");
    expect(serialized).not.toContain("2026-99999");
    expect(fetchedTitles).not.toContain("/d/2026-99999");
  });

  it("rejects an exact-title collision from a different issuer when the selected event has no formal identifier", async () => {
    const selected = JSON.parse(
      JSON.stringify(ccpaReviewedSourcePackHandoff()),
    ) as Screen02WorkflowHandoff;
    selected.event.identity = {
      ...selected.event.identity,
      canonicalTitle: "Consumer Protection Act",
      commonNames: [],
      formalIdentifier: null,
      issuer: "Environmental Protection Agency",
      issuingJurisdiction: "United States",
    };
    const resealed = resealHandoff(selected);
    const fetchedDocuments: string[] = [];
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (
        url.hostname === "www.federalregister.gov" &&
        url.pathname.startsWith("/api/")
      ) {
        return jsonResponse({
          count: 2,
          results: [
            {
              title: "Consumer Protection Act",
              type: "Rule",
              abstract: "The selected authority establishes covered-entity duties.",
              document_number: "2026-11111",
              html_url: "https://www.federalregister.gov/d/2026-11111",
              publication_date: "2026-07-01",
              agencies: [{ name: "Environmental Protection Agency" }],
            },
            {
              title: "Consumer Protection Act",
              type: "Rule",
              abstract: "A separate authority establishes unrelated duties.",
              document_number: "2026-22222",
              html_url: "https://www.federalregister.gov/d/2026-22222",
              publication_date: "2026-07-02",
              agencies: [{ name: "Department of Commerce" }],
            },
          ],
        });
      }
      if (url.hostname === "www.federalregister.gov") {
        fetchedDocuments.push(url.pathname);
        return new Response(
          url.pathname.includes("2026-11111")
            ? "Consumer Protection Act. Environmental Protection Agency selected-event duties."
            : "Consumer Protection Act. Department of Commerce unrelated duties.",
          { headers: { "content-type": "text/plain" } },
        );
      }
      return new Response("Carried source did not expose extractive text.", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealed,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const serialized = JSON.stringify({
      evidence: packet.evidence,
      proposals: packet.proposals,
    });
    expect(serialized).toContain("2026-11111");
    expect(serialized).not.toContain("2026-22222");
    expect(serialized).not.toContain("Department of Commerce");
    expect(fetchedDocuments).toContain("/d/2026-11111");
    expect(fetchedDocuments).not.toContain("/d/2026-22222");
  });

  it("rejects a reused formal identifier when authoritative issuer context conflicts", async () => {
    const selected = JSON.parse(
      JSON.stringify(ccpaReviewedSourcePackHandoff()),
    ) as Screen02WorkflowHandoff;
    selected.event.identity = {
      ...selected.event.identity,
      canonicalTitle: "Environmental Reporting Standard",
      commonNames: [],
      formalIdentifier: "2026-12345",
      issuer: "Environmental Protection Agency",
      issuingJurisdiction: "United States",
    };
    const fetchedDocuments: string[] = [];
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealHandoff(selected),
        fetch: async (input) => {
          const url = new URL(String(input));
          if (
            url.hostname === "www.federalregister.gov" &&
            url.pathname.startsWith("/api/")
          ) {
            return jsonResponse({
              count: 1,
              results: [{
                title: "Unrelated Trade Reporting Standard",
                type: "Rule",
                abstract: "A different authority published this record.",
                document_number: "2026-12345",
                html_url: "https://www.federalregister.gov/d/2026-12345",
                publication_date: "2026-07-01",
                agencies: [{ name: "Department of Commerce" }],
              }],
            });
          }
          if (url.hostname === "www.federalregister.gov") {
            fetchedDocuments.push(url.pathname);
          }
          return new Response("No controlling text.", {
            status: 404,
            headers: { "content-type": "text/plain" },
          });
        },
        retrievedAt: researchedAt,
      }),
    );
    const serialized = JSON.stringify({
      evidence: packet.evidence,
      proposals: packet.proposals,
    });
    expect(serialized).not.toContain("Department of Commerce");
    expect(serialized).not.toContain("Unrelated Trade Reporting Standard");
    expect(fetchedDocuments).not.toContain("/d/2026-12345");
  });

  it("rejects a reused non-namespaced formal identifier when issuer context is absent", async () => {
    const selected = JSON.parse(
      JSON.stringify(ccpaReviewedSourcePackHandoff()),
    ) as Screen02WorkflowHandoff;
    selected.event.identity = {
      ...selected.event.identity,
      canonicalTitle: "Selected Filing Standard",
      commonNames: [],
      formalIdentifier: "LOCAL-77",
      issuer: "Selected Public Authority",
      issuingJurisdiction: "United States",
    };
    const fetchedDocuments: string[] = [];
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealHandoff(selected),
        fetch: async (input) => {
          const url = new URL(String(input));
          if (
            url.hostname === "www.federalregister.gov" &&
            url.pathname.startsWith("/api/")
          ) {
            return jsonResponse({
              count: 1,
              results: [{
                title: "Unrelated Licensing Notice",
                type: "Notice",
                abstract: "A record from an unspecified issuing system.",
                document_number: "LOCAL-77",
                html_url: "https://records.example.test/notices/LOCAL-77",
                publication_date: "2026-07-01",
                agencies: [],
              }],
            });
          }
          if (url.hostname === "records.example.test") {
            fetchedDocuments.push(url.pathname);
          }
          return new Response("No controlling text.", {
            status: 404,
            headers: { "content-type": "text/plain" },
          });
        },
        retrievedAt: researchedAt,
      }),
    );
    const serialized = JSON.stringify({
      evidence: packet.evidence,
      proposals: packet.proposals,
    });
    expect(serialized).not.toContain("Unrelated Licensing Notice");
    expect(serialized).not.toContain("unspecified issuing system");
    expect(fetchedDocuments).not.toContain("/notices/LOCAL-77");
  });

  it("retains direct Federal Register evidence for a nonbinding drug-manufacturing RFI", async () => {
    const selected = fdaDistributedManufacturingRfiHandoff();
    const officialLocator = selected.sources[0]!.locator;
    const controllingPdfLocator =
      "https://www.govinfo.gov/content/pkg/FR-2022-10-14/pdf/2022-22386.pdf";
    const apiRecord = {
      document_number: "2022-22386",
      title: selected.event.identity.canonicalTitle,
      publication_date: "2022-10-14",
      type: "Notice",
      action: "Request for information and comments; notice of availability.",
      abstract:
        "FDA announces a discussion paper addressing distributed manufacturing and point-of-care manufacturing of drugs and requests public feedback.",
      pdf_url: controllingPdfLocator,
      html_url: officialLocator,
      agencies: [{ name: "Food and Drug Administration" }],
    };
    const fetchedDocuments: string[] = [];
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.pathname.startsWith("/api/v1/documents")) {
            return new Response(JSON.stringify({
              count: 1,
              results: [apiRecord],
            }), { headers: { "content-type": "application/json" } });
          }
          if (url.toString() === officialLocator) {
            fetchedDocuments.push(url.toString());
            return new Response(`<!doctype html><html><body><main>
              <h1>${selected.event.identity.canonicalTitle}</h1>
              <p>FDA is announcing the availability of a discussion paper entitled Distributed Manufacturing and Point-of-Care Manufacturing of Drugs.</p>
              <p>The purpose of this discussion paper is to communicate FDA's current thinking and to solicit public feedback on distributed manufacturing and point-of-care manufacturing of drugs.</p>
              <p>The discussion paper does not constitute guidance and does not establish any legally enforceable responsibilities.</p>
              <p>The discussion paper describes areas for consideration for a potential regulatory framework and asks questions for public comment.</p>
              <p>Submit either electronic or written comments by December 13, 2022.</p>
              <p>[FR Doc. 2022-22386 Filed 10-13-22; 8:45 am]</p>
            </main></body></html>`, {
              headers: { "content-type": "text/html; charset=utf-8" },
            });
          }
          if (url.toString() === controllingPdfLocator) {
            fetchedDocuments.push(url.toString());
            return new Response(
              "%PDF-1.7\n1 0 obj<</Type /Pages /Count 1>>endobj\n2 0 obj<</Type /Page>>endobj\n%%EOF",
              { headers: { "content-type": "application/pdf" } },
            );
          }
          throw new Error(`Unexpected FDA RFI fixture URL: ${url}`);
        },
        retrievedAt: researchedAt,
      }),
    );

    const officialEvidence = packet.evidence.find(
      (item) => item.locator === officialLocator,
    );
    const directPassageIds = officialEvidence?.passages
      .filter(isOfficialSubstantivePassage)
      .map((passage) => passage.id) ?? [];
    const directProposal = [
      ...packet.proposals.overview,
      ...packet.proposals.component,
      ...packet.proposals.eligibility,
      ...packet.proposals.amendment,
    ].find((proposal) =>
      proposal.support === "direct" &&
      proposal.sourceIds.includes(officialEvidence?.id ?? "") &&
      proposal.passageIds.some((id) => directPassageIds.includes(id))
    );

    expect(new Set(fetchedDocuments)).toEqual(new Set([
      officialLocator,
      controllingPdfLocator,
    ]));
    expect(officialEvidence).toBeDefined();
    expect(officialEvidence?.passages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        locator: officialLocator,
        basis: "official-document-passage",
        text: expect.stringMatching(/solicit public feedback/i),
      }),
    ]));
    expect(directProposal).toBeDefined();
    expect(packet.proposals.overview).toContainEqual(expect.objectContaining({
      label: "Announcement or discussion",
      support: "direct",
      sourceIds: [officialEvidence!.id],
      passageIds: expect.arrayContaining(directPassageIds.slice(0, 1)),
    }));
    expect(packet.coverage.gaps.join(" ")).not.toMatch(
      /could not be grounded to the document number|contained no excerpt/i,
    );

    const request = buildScreen03HostDraftRequest(packet, selected);
    const announcement = request.proposals.find((proposal) =>
      proposal.label === "Announcement or discussion"
    );
    const feedback = request.proposals.find((proposal) =>
      proposal.value.includes("solicit public feedback")
    );
    const nonbinding = request.proposals.find((proposal) =>
      proposal.group === "component" &&
      proposal.value.includes("legally enforceable responsibilities")
    );
    expect(announcement).toBeDefined();
    expect(feedback).toBeDefined();
    expect(nonbinding).toBeDefined();
    const briefing = restoreScreen03HostInterpretation({
      snapshot: {
        intro: {
          text:
            "This FDA discussion paper asks for public feedback about distributed and point-of-care drug manufacturing.",
          proposalIds: [announcement!.proposalId],
        },
        keyPoints: [
          {
            text:
              "FDA made the discussion paper available to address distributed and point-of-care drug manufacturing.",
            proposalIds: [announcement!.proposalId],
          },
          {
            text:
              "The paper presents FDA's current thinking and seeks public feedback about distributed and point-of-care manufacturing.",
            proposalIds: [feedback!.proposalId],
          },
          {
            text:
              "It is a discussion paper rather than FDA guidance and creates no legally enforceable responsibilities.",
            proposalIds: [nonbinding!.proposalId],
          },
        ],
      },
    }, request);
    expect(briefing).toMatchObject({
      origin: "chatgpt-host",
      snapshot: {
        intro: {
          evidenceIds: [officialEvidence!.id],
          passageIds: expect.arrayContaining(directPassageIds.slice(0, 1)),
        },
      },
    });
    const state = buildScreen03StateFromResearch(
      selected,
      packet,
      researchedAt,
    );
    const integrated = integrateScreen03HostInterpretation(
      state,
      briefing!,
      "2026-08-12T16:00:01.000Z",
      "fnv1a64:0123456789abcdef",
    );
    expect(integrated.interpretation?.origin).toBe("chatgpt-host");
    expect(integrated.interpretation?.snapshot.intro.evidenceIds).toEqual([
      officialEvidence!.id,
    ]);
  });

  it("attributes a direct retrieved timeline date only to evidence that contains its supporting passage", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const htmlLocator =
      "https://www.federalregister.gov/documents/2020/01/15/2020-12345/example-reporting-rule";
    const pdfLocator =
      "https://www.govinfo.gov/content/pkg/FR-2020-01-15/pdf/2020-12345.pdf";
    const carriedBase = {
      ...selected.sources[0]!,
      title: "Example Reporting Rule",
      locator: htmlLocator,
      publisher: "Example Agency",
      publishedDate: "2020-01-15",
      authorityTier: 2 as const,
      channel: "Federal Register API v1 · rules",
      retrievedAt: "2026-08-12T15:58:00.000Z",
      userProvided: false,
    };
    const { sourceFingerprint: _sourceFingerprint, ...carriedInput } = carriedBase;
    selected.sources = [{
      ...carriedInput,
      sourceFingerprint: fingerprintScreen02WorkflowValue(carriedInput),
    }];
    selected.event.identity = {
      canonicalTitle: "Example Reporting Rule",
      commonNames: [],
      formalIdentifier: "2020-12345",
      issuer: "Example Agency",
      issuingJurisdiction: "United States",
      eventType: "Regulation",
      status: "Final rule",
    };
    selected.event.sourceIds = [carriedInput.id];
    selected.event.description = {
      ...selected.event.description,
      text: "The selected event is an official reporting rule.",
      sourceIds: [carriedInput.id],
    };
    selected.event.dateLeads = [];
    selected.event.highLevelChanges = [];
    selected.event.keyComponents = [];
    selected.event.broadCoverage = [];
    selected.event.relatedVersions = [];
    selected.unresolved.provisionalClaimIds = [selected.event.description.id];

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealHandoff(selected),
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.pathname.startsWith("/api/v1/documents")) {
            return new Response(JSON.stringify({
              count: 1,
              results: [{
                document_number: "2020-12345",
                title: "Example Reporting Rule",
                publication_date: "2020-01-15",
                type: "Rule",
                action: "Final rule",
                abstract: "The agency adopted an official reporting rule.",
                pdf_url: pdfLocator,
                html_url: htmlLocator,
                agencies: [{ name: "Example Agency" }],
              }],
            }), { headers: { "content-type": "application/json" } });
          }
          if (url.toString() === pdfLocator) {
            return new Response(
              "<main><h1>Example Reporting Rule</h1><p>The rule contains general reporting provisions.</p></main>",
              { headers: { "content-type": "text/html" } },
            );
          }
          if (url.toString() === htmlLocator) {
            return new Response(
              "<main><h1>Example Reporting Rule</h1><p>The rule was published on January 15, 2020.</p><p>[FR Doc. 2020-12345 Filed 1-14-20]</p></main>",
              { headers: { "content-type": "text/html" } },
            );
          }
          throw new Error(`Unexpected provenance fixture URL: ${url}`);
        },
        retrievedAt: researchedAt,
      }),
    );
    const htmlEvidence = packet.evidence.find((item) =>
      item.locator === htmlLocator
    );
    const pdfEvidence = packet.evidence.find((item) =>
      item.locator === pdfLocator
    );
    const publication = packet.proposals.timeline.find(
      (proposal) =>
        proposal.stage === "rulemaking" &&
        proposal.date === "2020-01-15" &&
        proposal.support === "direct",
    );

    expect(htmlEvidence).toBeDefined();
    expect(pdfEvidence).toBeDefined();
    expect(publication).toBeDefined();
    expect(publication?.sourceIds).toEqual([htmlEvidence?.id]);
    expect(publication?.sourceIds).not.toContain(pdfEvidence?.id);
    expect(publication?.passageIds.every((passageId) =>
      htmlEvidence?.passages.some((passage) => passage.id === passageId)
    )).toBe(true);
  });

  it("caps calls, records, active evidence, and passages while deduplicating repeated official records", async () => {
    const requestedUrls: string[] = [];
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch: euFetch(euBindings(12), requestedUrls),
        retrievedAt: researchedAt,
      }),
    );

    expect(
      requestedUrls.filter(
        (value) => new URL(value).hostname === "publications.europa.eu",
      ).length,
    ).toBeLessThanOrEqual(
      SCREEN_03_RESEARCH_MAX_CALLS,
    );
    expect(packet.evidence.length).toBeLessThanOrEqual(
      SCREEN_03_RESEARCH_MAX_ACTIVE_EVIDENCE,
    );
    expect(passageCount(packet)).toBeLessThanOrEqual(
      SCREEN_03_RESEARCH_MAX_PASSAGES,
    );
    expect(
      new Set(packet.evidence.map((item) => item.locator)).size,
    ).toBe(packet.evidence.length);
    expect(packet.coverage.activeEvidenceCount).toBe(
      packet.evidence.filter((item) => item.status !== "changed").length,
    );
    expect(packet.coverage.recordsReviewed).toBeLessThanOrEqual(31);
    expect(packet.coverage.stoppingRule.rule).toMatch(
      new RegExp(
        `6 calls.*5 records.*5 active evidence.*${SCREEN_03_RESEARCH_MAX_PASSAGES} passages`,
        "i",
      ),
    );
  });

  it("preserves distinct phase-in clocks and selects one same-milestone representative", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    selected.event.dateLeads.push(
      {
        id: "small-entity-phase",
        date: "2019-01-01",
        label: "Compliance date",
        stage: "implementation",
        sourceIds: [selected.sources[0]!.id],
        status: "provisional",
        uncertainty: "Applies to small entities in the first phase.",
      },
      {
        id: "large-entity-phase",
        date: "2018-07-01",
        label: "Compliance date",
        stage: "implementation",
        sourceIds: [selected.sources[0]!.id],
        status: "provisional",
        uncertainty: "Applies to large entities in the first phase.",
      },
      {
        id: "enforcement-source-a",
        date: "2019-02-01",
        label: "Enforcement start",
        stage: "enforcement",
        sourceIds: [selected.sources[0]!.id],
        status: "provisional",
        uncertainty: null,
      },
      {
        id: "enforcement-source-b",
        date: "2019-03-01",
        label: "Enforcement start",
        stage: "enforcement",
        sourceIds: [selected.sources[0]!.id],
        status: "provisional",
        uncertainty: null,
      },
    );

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: euFetch([]),
        retrievedAt: researchedAt,
      }),
    );
    const sourceConflicts = packet.contradictions.filter(
      (item) => item.kind === "source-conflict",
    );
    expect(sourceConflicts).toEqual([]);
    expect(packet.proposals.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2019-01-01", stage: "implementation" }),
      expect.objectContaining({ date: "2018-07-01", stage: "implementation" }),
    ]));
    const enforcement = packet.proposals.timeline.filter(
      (proposal) => proposal.label === "Enforcement start",
    );
    expect(enforcement).toEqual([
      expect.objectContaining({ date: "2019-02-01", stage: "enforcement" }),
    ]);
  });

  it("does not promote identical researcher-supplied claims to direct support", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const exact = "Covered entities must keep compliance records.";
    const makeSource = (id: string, locator: string) => {
      const source = {
        ...selected.sources[0]!,
        id,
        locator,
        title: `Researcher supplied source ${id}`,
        evidenceText: exact,
        userProvided: true,
      };
      const { sourceFingerprint: _fingerprint, ...input } = source;
      return {
        ...input,
        sourceFingerprint: fingerprintScreen02WorkflowValue(input),
      };
    };
    selected.sources = [
      makeSource("corroborating-a", "https://eur-lex.europa.eu/source-a"),
      makeSource("corroborating-b", "https://publications.europa.eu/source-b"),
    ];

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async () => jsonResponse({ results: { bindings: [] } }),
        retrievedAt: researchedAt,
        synthesizer: async (request) => ({
          protocolVersion: SCREEN_03_SYNTHESIS_PROTOCOL_VERSION,
          claims: request.evidence.slice(0, 2).map((item, index) => ({
            id: `corroborating-claim-${index + 1}`,
            stageId: "implementation-compliance",
            group: "component",
            label: "Operative duty or component",
            value: exact,
            evidenceIds: [item.evidenceId],
            passageIds: [item.passages[0]!.passageId],
          })),
          outcomeValuesInspected: false,
        }),
      }),
    );
    const merged = packet.proposals.component.filter(
      (proposal) => proposal.value === exact,
    );
    expect(merged).toEqual([]);
    expect(packet.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceRole: "researcher-supplied-record",
        sourcePlatform: "researcher-supplied",
      }),
    ]));
    expect(packet.evidence.every((item) =>
      item.sourceRole !== "researcher-supplied-record" ||
      item.passages.every(
        (passage) => passage.basis !== "official-document-passage",
      )
    )).toBe(true);
  });

  it.each([
    {
      label: "state legislation",
      handoff: researcherProvidedOfficialHandoff({
        title: "S.B. 227 Consumer Privacy Act",
        locator: "https://le.utah.gov/~2022/bills/static/SB0227.html",
        canonicalTitle: "S.B. 227 Consumer Privacy Act",
        commonNames: ["Utah Consumer Privacy Act"],
        formalIdentifier: "S.B. 227",
        issuer: "Utah State Legislature",
        issuingJurisdiction: "Utah, United States",
        eventType: "Regulation",
        date: "2023-12-31",
        stage: "effective",
      }),
      body: `<!doctype html><main>
        <h1>S.B. 227 Consumer Privacy Act</h1>
        <p>This bill takes effect on December 31, 2023.</p>
      </main>`,
      expectedRole: "official-record",
      expectedPlatform: "regulatory-agency",
    },
    {
      label: "official hazard advisory",
      handoff: researcherProvidedOfficialHandoff({
        title: "Hurricane HARVEY",
        locator:
          "https://www.nhc.noaa.gov/archive/2017/al09/al092017.public_a.023.shtml",
        canonicalTitle: "Hurricane HARVEY",
        commonNames: ["Hurricane Harvey"],
        formalIdentifier: null,
        issuer: "National Hurricane Center",
        issuingJurisdiction: "Texas, United States",
        eventType: "Disaster",
        date: "2017-08-26",
        stage: "occurrence",
      }),
      body: `<!doctype html><main>
        <h1>Hurricane HARVEY Advisory 23A</h1>
        <p>Harvey made a second landfall near Copano Bay, Texas at 0300 UTC on August 26, 2017.</p>
      </main>`,
      expectedRole: "scientific-hazard-record",
      expectedPlatform: "official-disaster-repository",
    },
  ])("admits independently fetched identity-bound $label evidence without trusting researcher labels", async ({
    handoff: selected,
    body,
    expectedRole,
    expectedPlatform,
  }) => {
    const source = selected.sources[0]!;
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) =>
          String(input) === source.locator
            ? new Response(body, {
                headers: { "content-type": "text/html; charset=utf-8" },
              })
            : jsonResponse({
                DisasterDeclarationsSummaries: [],
                features: [],
                results: { bindings: [] },
              }),
        retrievedAt: researchedAt,
      }),
    );
    const evidence = packet.evidence.find(
      (item) => item.sourceId === source.id,
    );
    const timeline = packet.proposals.timeline.find(
      (proposal) => proposal.date === selected.event.dateLeads[0]!.date,
    );

    expect(source).toMatchObject({
      authorityTier: 6,
      publisher: "Unverified researcher label",
      userProvided: true,
    });
    expect(evidence).toMatchObject({
      authorityTier: 2,
      publisher: new URL(source.locator).hostname,
      sourceRole: expectedRole,
      sourcePlatform: expectedPlatform,
      status: "retrieved",
    });
    expect(evidence?.passages).toEqual(expect.arrayContaining([
      expect.objectContaining({ basis: "official-document-passage" }),
      expect.objectContaining({
        basis: "source-metadata",
        text: expect.stringMatching(/researcher supplied this locator/i),
      }),
    ]));
    expect(timeline).toMatchObject({ support: "direct" });
    expect(screen03ProposalConfirmability(timeline!, packet.evidence))
      .toMatchObject({ confirmable: true });
    expect(packet.coverage.stoppingRule.rule).toMatch(/4 total document attempts/i);
  });

  it("does not promote a researcher-selected official locator for a different exact record", async () => {
    const selected = researcherProvidedOfficialHandoff({
      title: "Selected Federal Register Privacy Rule",
      locator:
        "https://www.federalregister.gov/documents/2020/01/02/2020-12345/unrelated-notice",
      canonicalTitle: "Selected Federal Register Privacy Rule",
      commonNames: ["Selected Privacy Rule"],
      formalIdentifier: "2020-99999",
      issuer: "Federal Trade Commission",
      issuingJurisdiction: "United States",
      eventType: "Regulation",
      date: "2020-02-01",
      stage: "effective",
    });
    const source = selected.sources[0]!;
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) =>
          String(input) === source.locator
            ? new Response(`<!doctype html><main>
                <h1>Unrelated Federal Register Notice</h1>
                <p>This notice discusses the Selected Federal Register Privacy Rule.</p>
                <p>[FR Doc. 2020-12345]</p>
              </main>`, {
                headers: { "content-type": "text/html; charset=utf-8" },
              })
            : jsonResponse({
                DisasterDeclarationsSummaries: [],
                features: [],
                results: { bindings: [] },
              }),
        retrievedAt: researchedAt,
      }),
    );
    const evidence = packet.evidence.find(
      (item) => item.sourceId === source.id,
    );

    expect(evidence).toMatchObject({
      authorityTier: 6,
      sourceRole: "researcher-supplied-record",
      sourcePlatform: "researcher-supplied",
    });
    expect(evidence?.passages.every(
      (passage) => passage.basis !== "official-document-passage",
    )).toBe(true);
  });

  it("does not discard a fourth distinct critical component carried from Screen 2", async () => {
    const selected = JSON.parse(
      JSON.stringify(ccpaReviewedSourcePackHandoff()),
    ) as Screen02WorkflowHandoff;
    const sourceId = selected.sources[0]!.id;
    const upstreamValues = [
      "Covered organizations must keep processing records.",
      "Covered organizations must answer verified access requests.",
      "Covered organizations must honor eligible deletion requests.",
      "Covered organizations must provide a lawful opt-out method.",
    ];
    selected.event.highLevelChanges = upstreamValues.map((text, index) => ({
      id: `distinct-upstream-component-${index + 1}`,
      text,
      sourceIds: [sourceId],
      status: "provisional" as const,
      uncertainty: "Screen 3 must verify the exact controlling provision.",
    }));
    selected.event.keyComponents = [];
    selected.unresolved.provisionalClaimIds = [
      selected.event.description.id,
      ...selected.event.dateLeads.map((lead) => lead.id),
      ...selected.event.broadCoverage.map((claim) => claim.id),
      ...selected.event.highLevelChanges.map((claim) => claim.id),
    ];

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealHandoff(selected),
        fetch: euFetch(),
        retrievedAt: researchedAt,
      }),
    );

    expect(packet.proposals.component).toHaveLength(upstreamValues.length);
    expect(packet.proposals.component.map((proposal) => proposal.value)).toEqual(
      expect.arrayContaining(upstreamValues),
    );
  });

  it("reports languages only for active evidence, not attempted routes", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    selected.sources[0]!.locator =
      "https://eur-lex.europa.eu/legal-content/XX/TXT/?uri=unknown-language";
    selected.sources[0]!.channel = "catalog-route-without-language";
    const { sourceFingerprint: _old, ...sourceInput } = selected.sources[0]!;
    selected.sources[0]!.sourceFingerprint =
      fingerprintScreen02WorkflowValue(sourceInput);

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.hostname === "publications.europa.eu") {
            return jsonResponse({ results: { bindings: [] } });
          }
          return new Response("No stage-specific passage was found.", {
            headers: { "content-type": "text/plain" },
          });
        },
        retrievedAt: researchedAt,
      }),
    );

    expect(packet.coverage.routes).toContain("eu-cellar-sparql-v1");
    expect(packet.evidence.every((item) => item.language === "und")).toBe(true);
    expect(packet.coverage.languages).toEqual([]);
  });

  it("covers every eligible official route before using spare calls on follow-up queries", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    for (const source of [
      {
        id: "federal-route-source",
        title: "Federal Register identity lead",
        locator: "https://www.federalregister.gov/d/example",
        publisher: "Office of the Federal Register",
        channel: "Federal Register API",
      },
      {
        id: "uk-route-source",
        title: "UK legislation identity lead",
        locator: "https://www.legislation.gov.uk/uksi/2018/1/contents",
        publisher: "The National Archives",
        channel: "UK legislation.gov.uk Atom search",
      },
    ]) {
      const sourceBase = {
        ...source,
        publishedDate: "2018-01-01",
        authorityTier: 2 as const,
        retrievedAt: "2026-08-12T15:58:00.000Z",
        userProvided: false,
      };
      selected.sources.push({
        ...sourceBase,
        sourceFingerprint: fingerprintScreen02WorkflowValue(sourceBase),
      });
    }

    const requestedUrls: string[] = [];
    let connectorCalls = 0;
    let ukConnectorCalls = 0;
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      requestedUrls.push(url.toString());
      if (url.hostname === "publications.europa.eu") {
        if (url.searchParams.has("query")) connectorCalls += 1;
        return jsonResponse({ results: { bindings: [] } });
      }
      if (url.hostname === "www.federalregister.gov") {
        if (url.pathname.startsWith("/api/")) connectorCalls += 1;
        return jsonResponse({ count: 0, results: [] });
      }
      if (url.hostname === "www.legislation.gov.uk") {
        if (url.pathname.endsWith("data.feed")) {
          connectorCalls += 1;
          ukConnectorCalls += 1;
        }
        return new Response(
          '<feed xmlns="http://www.w3.org/2005/Atom"></feed>',
          { headers: { "content-type": "application/atom+xml" } },
        );
      }
      throw new Error(`Unexpected official route ${url.hostname}.`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const connectorUrls = requestedUrls.filter((value) => {
      const url = new URL(value);
      return url.searchParams.has("query") ||
        url.pathname.startsWith("/api/") ||
        url.pathname.endsWith("data.feed");
    });
    const firstPassHosts = connectorUrls
      .slice(0, 3)
      .map((value) => new URL(value).hostname);

    expect(connectorCalls).toBe(SCREEN_03_RESEARCH_MAX_CALLS);
    expect(ukConnectorCalls).toBe(1);
    expect(firstPassHosts).toEqual([
      "publications.europa.eu",
      "www.federalregister.gov",
      "www.legislation.gov.uk",
    ]);
    expect(new URL(connectorUrls[0]!).searchParams.get("query"))
      .toContain('FILTER(STR(?celex) = "32016R0679")');
    expect(decodeURIComponent(connectorUrls[1]!)).toMatch(
      /enactment|adoption|publication|final rule/i,
    );
    expect(new URL(connectorUrls[2]!).searchParams.get("title"))
      .toBe(selected.event.identity.canonicalTitle);
    expect(packet.coverage.routes).toEqual([
      "eu-cellar-sparql-v1",
      "federal-register-api-v1",
      "uk-legislation-atom-v1",
    ]);
  });

  it("attempts every eligible connector family when more than three are inferred", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const routeSources = [
      ["federal", "https://www.federalregister.gov/d/example"],
      ["fema", "https://www.fema.gov/disaster/1234"],
      ["uk", "https://www.legislation.gov.uk/uksi/2018/1/contents"],
      ["gdacs", "https://www.gdacs.org/report.aspx?eventid=1"],
      ["usgs", "https://earthquake.usgs.gov/earthquakes/eventpage/test"],
    ] as const;
    for (const [id, locator] of routeSources) {
      const sourceBase = {
        id: `route-${id}`,
        title: `Official ${id} route lead`,
        locator,
        publisher: `Official ${id} publisher`,
        publishedDate: "2018-01-01",
        authorityTier: 2 as const,
        channel: `Official ${id} route`,
        retrievedAt: "2026-08-12T15:58:00.000Z",
        userProvided: false,
      };
      selected.sources.push({
        ...sourceBase,
        sourceFingerprint: fingerprintScreen02WorkflowValue(sourceBase),
      });
    }
    const requestedHosts: string[] = [];
    const fetch: Screen02ConnectorFetch = async (input) => {
      requestedHosts.push(new URL(String(input)).hostname);
      throw new Error("bounded route-attempt fixture");
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const expectedRoutes = [
      "eu-cellar-sparql-v1",
      "federal-register-api-v1",
      "openfema-disaster-declarations-v2",
      "uk-legislation-atom-v1",
      "gdacs-event-search-v1",
      "usgs-earthquake-catalog-v1",
    ];
    expect(new Set(packet.coverage.routes)).toEqual(new Set(expectedRoutes));
    expect(packet.coverage.routes).toHaveLength(expectedRoutes.length);
    expect(packet.coverage.queries).toHaveLength(expectedRoutes.length);
    expect(packet.coverage.stoppingRule).toMatchObject({ status: "met" });
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /did not complete successfully/i,
    );
    for (const host of [
      "publications.europa.eu",
      "www.federalregister.gov",
      "www.fema.gov",
      "www.legislation.gov.uk",
      "www.gdacs.org",
      "earthquake.usgs.gov",
    ]) {
      expect(requestedHosts).toContain(host);
    }
  });

  it("keeps carried evidence usable when every eligible connector fails", async () => {
    const fetch: Screen02ConnectorFetch = async () => {
      throw new Error("simulated official connector outage");
    };
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch,
        retrievedAt: researchedAt,
      }),
    );

    expect(packet.evidence.length).toBeGreaterThan(0);
    expect(packet.evidence.every((item) => item.status === "carried")).toBe(
      true,
    );
    expect(packet.coverage.channels.length).toBeGreaterThan(0);
    expect(packet.coverage.channels.every((channel) => channel.status === "failed")).toBe(
      true,
    );
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /did not complete successfully.*carried evidence was retained/i,
    );
    expect(
      packet.evidence
        .flatMap((item) => item.passages)
        .filter((passage) =>
          passage.text.includes("source-backed privacy-regulation event lead"),
        )
        .every((passage) => passage.basis === "source-metadata"),
    ).toBe(true);
    expect(packet.proposals.eligibility).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Eligibility thresholds",
          support: "unsupported",
          reviewStatus: "proposed",
          critical: false,
          sourceIds: [],
          passageIds: [],
        }),
        expect.objectContaining({
          label: "Exemptions",
          support: "unsupported",
          reviewStatus: "proposed",
          critical: false,
        }),
      ]),
    );
  });

  it("bounds document backfill attempts and records unavailable PDF conversion gaps", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    selected.sources[0]!.locator =
      "https://eur-lex.europa.eu/legal-content/ENG/TXT/?uri=CELEX:32016R0679";
    const {
      sourceFingerprint: _oldSourceFingerprint,
      ...sourceWithoutFingerprint
    } = selected.sources[0]!;
    selected.sources[0]!.sourceFingerprint =
      fingerprintScreen02WorkflowValue(sourceWithoutFingerprint);
    const documentUrls: string[] = [];
    const fetchedDocumentBody =
      "General Data Protection Regulation Regulation (EU) 2016/679 applies from 2018-05-25. Irrelevant trailing source bytes still belong to the source fingerprint.";
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: euBindings(3) } });
      }
      documentUrls.push(url.toString());
      if (documentUrls.length === 1) {
        return new Response(fetchedDocumentBody, {
          headers: { "content-type": "text/plain" },
        });
      }
      return new Response("pdf", {
        headers: { "content-type": "application/pdf" },
      });
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );

    expect(documentUrls.length).toBeLessThanOrEqual(
      SCREEN_03_DOCUMENT_MAX_ATTEMPTS,
    );
    expect(
      packet.evidence.flatMap((item) => item.passages).some(
        isOfficialSubstantivePassage,
      ),
    ).toBe(true);
    expect(
      packet.evidence.find(
        (item) => item.locator === selected.sources[0]!.locator,
      ),
    ).toMatchObject({
      retrievedAt: researchedAt,
      contentFingerprint: `sha256:${createHash("sha256")
        .update(fetchedDocumentBody)
        .digest("hex")}`,
    });
    expect(packet.coverage.gaps.join(" ")).toMatch(/PDF|unsupported document/i);
  });

  it("backfills failed document slots from later canonical locators", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const primary = selected.sources[0]!;
    primary.locator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:first";
    const { sourceFingerprint: _primaryFingerprint, ...primaryBase } = primary;
    primary.sourceFingerprint = fingerprintScreen02WorkflowValue(primaryBase);
    for (const [id, locator] of [
      ["second-record", "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:second"],
      ["third-record", "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:third"],
    ] as const) {
      const sourceBase = {
        ...primaryBase,
        id,
        locator,
        title: `Official ${id}`,
      };
      selected.sources.push({
        ...sourceBase,
        sourceFingerprint: fingerprintScreen02WorkflowValue(sourceBase),
      });
      selected.event.sourceIds.push(id);
    }

    const documentUrls: string[] = [];
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: [] } });
      }
      documentUrls.push(url.toString());
      if (documentUrls.length < 3) {
        return new Response("redirect", {
          status: 302,
          headers: { location: "https://example.invalid/blocked" },
        });
      }
      return new Response(
        "General Data Protection Regulation. The amendment delayed implementation and imposed an enforcement penalty.",
        { headers: { "content-type": "text/plain" } },
      );
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );

    expect(documentUrls.length).toBeGreaterThan(2);
    expect(documentUrls.length).toBeLessThanOrEqual(
      SCREEN_03_DOCUMENT_MAX_ATTEMPTS,
    );
    expect(
      packet.evidence.flatMap((item) => item.passages).some((passage) =>
        /imposed an enforcement penalty/i.test(passage.text)
      ),
    ).toBe(true);
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /redirected outside its reviewed HTTPS source policy/i,
    );
  });

  it("admits a delayed official connected-devices excerpt and directly supports its SB 327 identity", async () => {
    const delayMs = 8_000;
    expect(SCREEN_03_DOCUMENT_FETCH_TIMEOUT_MS).toBeGreaterThan(delayMs);
    const selected = californiaConnectedDevicesHandoff();
    expect(selected.event.identity).toMatchObject({
      formalIdentifier: "SB 327",
      commonNames: expect.arrayContaining(["Security of Connected Devices"]),
    });
    vi.useFakeTimers();
    let acknowledgeFetch: (() => void) | null = null;
    const fetchStarted = new Promise<void>((resolve) => {
      acknowledgeFetch = resolve;
    });
    const fetch: Screen02ConnectorFetch = async (input) => {
      expect(String(input)).toBe(selected.sources[0]!.locator);
      acknowledgeFetch?.();
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      return new Response(`<!doctype html><html><body><main>
        <h1>SB-327 Information privacy: connected devices</h1>
        <p>This title shall be known, and may be cited, as the Security of Connected Devices.</p>
        <p>The title became operative on January 1, 2020.</p>
      </main></body></html>`, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    };

    const pending = researchScreen03Evidence({
      handoff: selected,
      fetch,
      retrievedAt: researchedAt,
    });
    await fetchStarted;
    await vi.advanceTimersByTimeAsync(delayMs);
    const researched = requireScreen03ResearchPacket(await pending);
    const packet = compileScreen03ExactExcerpts(
      researched,
      selected.event.identity.commonNames,
    );

    expect(packet.proposals.identity).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Formal identifier",
        value: "SB 327",
        support: "direct",
      }),
    ]));
    expect(
      packet.evidence.flatMap((item) => item.passages).some(
        (passage) =>
          isOfficialSubstantivePassage(passage) &&
          /SB-327 Information privacy: connected devices/i.test(passage.text),
      ),
    ).toBe(true);
  });

  it("keeps connected-devices identity metadata non-direct when the official page supplies no matching excerpt", async () => {
    const selected = californiaConnectedDevicesHandoff();
    const researched = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          expect(String(input)).toBe(selected.sources[0]!.locator);
          return new Response(
            "<!doctype html><html><body><main><p>No event text is available in this bounded fixture.</p></main></body></html>",
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        },
        retrievedAt: researchedAt,
      }),
    );
    const packet = compileScreen03ExactExcerpts(
      researched,
      selected.event.identity.commonNames,
    );

    expect(
      packet.proposals.identity.find(
        (proposal) => proposal.label === "Formal identifier",
      ),
    ).toMatchObject({ value: "SB 327", support: "indirect" });
    expect(
      packet.proposals.identity.some((proposal) => proposal.support === "direct"),
    ).toBe(false);
    expect(
      packet.evidence.flatMap((item) => item.passages).some(
        (passage) => passage.basis === "source-excerpt",
      ),
    ).toBe(false);
  });

  it("uses official CCPA HTML backfill when the bill fails and the PDF exceeds its page cap", async () => {
    const selected = ccpaReviewedSourcePackHandoff();
    const billUrl = selected.sources[0]!.locator;
    const pdfUrl = selected.sources[1]!.locator;
    const regulatorUrl = selected.sources[2]!.locator;
    const documentUrls: string[] = [];
    const convertDocument = vi.fn();
    const pdf = `%PDF-1.7\n${Array.from(
      { length: SCREEN_03_DOCUMENT_MAX_PDF_PAGES + 1 },
      (_, index) => `${index + 1} 0 obj<</Type /Page>>endobj`,
    ).join("\n")}\n%%EOF`;
    const html = `<!doctype html><html><body><main>
      <h1>California Consumer Privacy Act</h1>
      <p>The California Consumer Privacy Act was signed into law on June 28, 2018.</p>
      <p>The California Consumer Privacy Act went into effect on January 1, 2020 and will be enforced starting July 1, 2020.</p>
      <p>The regulations provide implementation guidance on compliance and enforcement for covered businesses.</p>
    </main></body></html>`;
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "www.federalregister.gov") {
        return jsonResponse({ count: 0, results: [] });
      }
      documentUrls.push(url.toString());
      if (url.toString() === billUrl) {
        throw new DOMException("fixture timeout", "AbortError");
      }
      if (url.toString() === regulatorUrl) {
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (url.toString() === pdfUrl) {
        return new Response(pdf, {
          headers: { "content-type": "application/pdf" },
        });
      }
      throw new Error(`Unexpected CCPA fixture URL: ${url}`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        convertDocument,
        retrievedAt: researchedAt,
      }),
    );
    const state = buildScreen03StateFromResearch(
      selected,
      packet,
      "2026-08-12T16:00:01.000Z",
    );
    const regulatorEvidence = packet.evidence.find(
      (item) => item.sourceId === "source-us-california-ccpa-oag-implementation",
    );
    const directPassageIds = regulatorEvidence?.passages
      .filter(isOfficialSubstantivePassage)
      .map((passage) => passage.id) ?? [];
    const directTimeline = packet.proposals.timeline.filter(
      (proposal) =>
        proposal.support === "direct" &&
        proposal.sourceIds.includes(regulatorEvidence?.id ?? "") &&
        proposal.passageIds.some((id) => directPassageIds.includes(id)),
    );

    expect(documentUrls).toEqual([
      billUrl,
      regulatorUrl,
      "https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=201720180AB375",
      pdfUrl,
    ]);
    expect(convertDocument).not.toHaveBeenCalled();
    expect(packet.coverage.gaps.join(" ")).toMatch(
      new RegExp(
        `timed out after ${SCREEN_03_DOCUMENT_FETCH_TIMEOUT_MS} ms`,
        "i",
      ),
    );
    expect(packet.coverage.gaps.join(" ")).toMatch(/exceeding the 40-page/i);
    expect(regulatorEvidence).toMatchObject({
      retrievedAt: researchedAt,
      status: "carried",
    });
    expect(regulatorEvidence?.channel).toMatch(/source role: official record/i);
    expect(
      regulatorEvidence?.passages.some(
        (passage) =>
          isOfficialSubstantivePassage(passage) &&
          /went into effect on January 1, 2020/i.test(passage.text),
      ),
    ).toBe(true);
    expect(directTimeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2018-06-28", value: "2018-06-28" }),
      expect.objectContaining({ date: "2020-01-01", value: "2020-01-01" }),
    ]));
    expect(state.status).toBe("reviewing");
    expect(
      state.proposals.timeline.some(
        (proposal) =>
          proposal.support === "direct" &&
          proposal.passageIds.some((id) => directPassageIds.includes(id)),
      ),
    ).toBe(true);
  });

  it("retains a directly reviewable CCPA identity when the exact reviewed bill fetch is unavailable", async () => {
    const opened = createScreen02AuditState(
      confirmedWorkflowAuditContext(),
      "reviewed-audit-ccpa-identity-fallback",
      "2026-08-14T10:00:00.000Z",
    );
    const round = buildReviewedScreen02AuditDiscovery(opened, {
      matchSetSnapshotId: "reviewed-audit-ccpa-identity-fallback-set",
      at: "2026-08-14T10:00:01.000Z",
    });
    const statute = round.sources.find(
      (source) => source.id === "reviewed:ccpa-statute-ab375",
    );
    if (!statute) throw new Error("Expected the exact reviewed CCPA statute source.");
    const selected = JSON.parse(JSON.stringify(buildScreen02WorkflowHandoff(
      buildReadyAuditState(),
      "0.3.3",
      "2026-08-14T10:00:02.000Z",
    ))) as Screen02WorkflowHandoff;
    const priorStatute = selected.sources.find(
      (source) => source.locator === statute.locator,
    );
    if (!priorStatute) throw new Error("Expected the fixture CCPA statute source.");
    const {
      sourceFingerprint: _reviewedSourceFingerprint,
      retrievedAt: _reviewedRetrievedAt,
      id: _reviewedSourceId,
      ...reviewedCoordinates
    } = statute;
    const replacement = {
      id: priorStatute.id,
      ...reviewedCoordinates,
      retrievedAt: priorStatute.retrievedAt,
    };
    selected.sources = selected.sources.map((source) =>
      source.id === priorStatute.id
        ? {
            ...replacement,
            sourceFingerprint: fingerprintScreen02WorkflowValue(replacement),
          }
        : source
    );
    const resealed = resealHandoff(selected);

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealed,
        fetch: async () => new Response("temporarily unavailable", {
          status: 503,
        }),
        retrievedAt: researchedAt,
      }),
    );
    const statuteEvidence = packet.evidence.find(
      (item) => item.sourceId === priorStatute.id,
    );
    const canonicalTitle = packet.proposals.identity.find(
      (proposal) => proposal.label === "Canonical event title",
    );

    expect(statuteEvidence?.passages).toContainEqual(expect.objectContaining({
      basis: "official-record-field",
      officialField: "canonical-title",
      text: "California Consumer Privacy Act of 2018",
    }));
    expect(canonicalTitle).toMatchObject({
      value: "California Consumer Privacy Act of 2018",
      support: "direct",
    });
    expect(
      canonicalTitle &&
        screen03ProposalConfirmability(canonicalTitle, packet.evidence),
    ).toEqual({ confirmable: true, reason: "confirmable" });
    expect(packet.proposals.timeline.some(
      (proposal) => proposal.support === "direct",
    )).toBe(false);
  });

  it("reserves bounded document attempts for controlling text and a carried official reader overview", async () => {
    const selected = JSON.parse(
      JSON.stringify(ccpaReviewedSourcePackHandoff()),
    ) as Screen02WorkflowHandoff;
    const overviewBase = {
      id: "source-us-california-ccpa-oag-overview",
      title: "California Consumer Privacy Act (CCPA)",
      locator: "https://oag.ca.gov/privacy/ccpa",
      publisher: "California Department of Justice",
      publishedDate: null,
      authorityTier: 2 as const,
      channel: "official-guidance",
      retrievedAt: "2026-08-13",
      userProvided: false,
    };
    selected.sources.push({
      ...overviewBase,
      sourceFingerprint: fingerprintScreen02WorkflowValue(overviewBase),
    });
    selected.event.sourceIds.push(overviewBase.id);
    const resealed = resealHandoff(selected);
    const documentUrls: string[] = [];
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "www.federalregister.gov") {
        return jsonResponse({ count: 0, results: [] });
      }
      documentUrls.push(url.toString());
      const text = url.toString() === overviewBase.locator
        ? [
            "The California Consumer Privacy Act gives California consumers more control over personal information collected by businesses.",
            "It provides rights to know, delete, opt out of sale or sharing, correct inaccurate information, limit sensitive-information use, and avoid discrimination for exercising those rights.",
            "It applies to qualifying for-profit businesses doing business in California.",
            "The California Privacy Rights Act later amended the CCPA and added protections beginning January 1, 2023.",
          ].join(" ")
        : "The California Consumer Privacy Act of 2018 was enacted by AB 375 and became operative on January 1, 2020.";
      return new Response(text, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: resealed,
        fetch,
        retrievedAt: researchedAt,
      }),
    );

    expect(documentUrls.slice(0, 2)).toEqual([
      resealed.sources[0]!.locator,
      overviewBase.locator,
    ]);
    const overview = packet.evidence.find(
      (item) => item.sourceId === overviewBase.id,
    );
    expect(overview).toBeDefined();
    expect(
      overview?.passages.some(
        (passage) =>
          isOfficialSubstantivePassage(passage) &&
          /rights to know, delete, opt out/i.test(passage.text),
      ),
    ).toBe(true);
    expect(packet.proposals.component).toContainEqual(
      expect.objectContaining({
        label: "Rights or protections",
        support: "direct",
        sourceIds: [overview!.id],
      }),
    );
    expect(packet.proposals.amendment).toContainEqual(
      expect.objectContaining({
        label: "Amendments and delays",
        support: "direct",
        sourceIds: [overview!.id],
        value: expect.stringMatching(/Privacy Rights Act later amended/i),
      }),
    );

    const interpreted = await interpretScreen03Packet({
      packet,
      handoff: resealed,
    });
    const briefing = interpreted.interpretation?.snapshot;
    expect(briefing?.intro.text).toMatch(
      /provides rights to know, delete, opt out/i,
    );
    const briefingText = [
      briefing?.intro.text,
      ...(briefing?.keyPoints.map((point) => point.text) ?? []),
    ].join(" ");
    expect(briefingText).toMatch(/rights to know, delete, opt out/i);
    expect(briefingText).toMatch(/qualifying for-profit businesses/i);
    expect(briefingText).toMatch(/January 1, 2020/i);
    expect(briefingText).toMatch(/Privacy Rights Act later amended/i);
    for (const block of [
      ...(briefing ? [briefing.intro] : []),
      ...(briefing?.keyPoints ?? []),
    ]) {
      expect(block.evidenceIds.length).toBeGreaterThan(0);
      expect(block.passageIds.length).toBeGreaterThan(0);
    }
  });

  it("retains reviewed GDPR identity fields when live EUR-Lex representations are challenged", async () => {
    const selected = handoffWithReviewedGdprSource();
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        retrievedAt: researchedAt,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.hostname === "publications.europa.eu" &&
              url.pathname === "/webapi/rdf/sparql") {
            return new Response("unavailable", { status: 503 });
          }
          return new Response(`<!doctype html><html><head><title>JavaScript is disabled</title></head>
            <body>Verify that you are not a robot. Enable JavaScript and reload.</body></html>`, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
      }),
    );

    expect(packet.proposals.identity).toContainEqual(expect.objectContaining({
      label: "Formal identifier",
      value: "Regulation (EU) 2016/679",
      support: "direct",
    }));
    const formal = packet.proposals.identity.find(
      (proposal) => proposal.label === "Formal identifier",
    )!;
    expect(packet.evidence.flatMap((item) => item.passages)
      .filter((passage) => formal.passageIds.includes(passage.id)))
      .toContainEqual(expect.objectContaining({
        basis: "official-record-field",
        officialField: "formal-identifier",
      }));
  });

  it("supports the CCPA precursor circulation clock without promoting proposed initiative duties as enacted-law components", async () => {
    const selected = ccpaAnnouncementHandoff();
    const billUrl = selected.sources.find((source) =>
      source.locator.includes("billTextClient.xhtml")
    )!.locator;
    const precursorUrl = selected.sources.find((source) =>
      source.id.includes("initiative-circulation")
    )!.locator;
    const regulatorUrl = selected.sources.find((source) =>
      source.id.includes("oag-implementation")
    )!.locator;
    const documentUrls: string[] = [];
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      documentUrls.push(url.toString());
      if (url.toString() === billUrl) {
        return new Response(`<!doctype html><main>
          <h1>California Consumer Privacy Act</h1>
          <p>The California Consumer Privacy Act was signed into law on June 28, 2018.</p>
          <p>The law became operative on January 1, 2020.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      if (url.toString() === precursorUrl) {
        return new Response(`<!doctype html><main>
          <h1>Proposed initiative enters circulation</h1>
          <p>For immediate release December 18, 2017. The California Secretary of State announced on December 18, 2017 that proponents of initiative 17-0039 were cleared to begin collecting petition signatures.</p>
          <p>The proposed initiative would require businesses to disclose categories of personal information and would impose civil penalties.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      if (url.toString() === regulatorUrl) {
        return new Response(`<!doctype html><main>
          <h1>CCPA regulations submitted for approval</h1>
          <p>The California Consumer Privacy Act went into effect on January 1, 2020 and enforcement began on July 1, 2020.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      if (
        url.hostname === "leginfo.legislature.ca.gov" &&
        url.pathname === "/faces/billHistoryClient.xhtml"
      ) {
        return new Response(`<!doctype html><main>
          <h1>AB 375 bill history</h1>
          <p>California Workplace Notice Act history was published for legislative review.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      return new Response("not used", { status: 404 });
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const compiled = compileScreen03ExactExcerpts(
      packet,
      selected.event.identity.commonNames,
    );
    const announcement = compiled.proposals.timeline.find(
      (proposal) =>
        proposal.stage === "announcement" &&
        proposal.date === "2017-12-18",
    );
    const precursorEvidence = compiled.evidence.find(
      (item) => item.locator === precursorUrl,
    );

    expect(documentUrls).toEqual(expect.arrayContaining([
      billUrl,
      precursorUrl,
      regulatorUrl,
    ]));
    expect(announcement).toMatchObject({
      label: "Precursor privacy initiative cleared for circulation",
      support: "direct",
      uncertainty: expect.stringMatching(
        /precursor.+not the introduction date of AB 375/i,
      ),
    });
    expect(announcement?.sourceIds).toContain(precursorEvidence?.id);
    expect(compiled.proposals.timeline.some((proposal) =>
      proposal.date === "2018-01-03"
    )).toBe(false);
    const operativeClaims = [
      ...compiled.proposals.identity,
      ...compiled.proposals.overview,
      ...compiled.proposals.component,
      ...compiled.proposals.eligibility,
      ...compiled.proposals.amendment,
    ];
    expect(operativeClaims.some((proposal) =>
      proposal.support === "direct" &&
      proposal.sourceIds.includes(precursorEvidence?.id ?? "")
    )).toBe(false);
    expect(compiled.proposals.timeline
      .filter((proposal) =>
        proposal.support === "direct" &&
        proposal.sourceIds.includes(precursorEvidence?.id ?? "")
      )
      .every((proposal) =>
        proposal.stage === "announcement" &&
        /precursor|circulation/i.test(proposal.label)
      )).toBe(true);
    expect(compiled.proposals.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2020-01-01", support: "direct" }),
      expect.objectContaining({ date: "2020-07-01", support: "direct" }),
    ]));
    expect(packet.coverage.stages).toEqual(expect.arrayContaining([
      "announcement/discussion",
      "effective/application",
      "enforcement/penalty",
    ]));
  });

  it("counts precursor initiative text only for announcement coverage", async () => {
    const selected = ccpaAnnouncementHandoff();
    const precursorUrl = selected.sources.find((source) =>
      source.id.includes("initiative-circulation")
    )!.locator;
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.toString() === precursorUrl) {
            return new Response(`<!doctype html><main>
              <p>The Secretary of State announced on December 18, 2017 that the precursor initiative was cleared to begin collecting petition signatures.</p>
              <p>The proposed initiative would take effect later and would impose civil penalties.</p>
            </main>`, { headers: { "content-type": "text/html" } });
          }
          return new Response("not available in this bounded fixture", {
            status: 404,
          });
        },
        retrievedAt: researchedAt,
      }),
    );

    expect(packet.coverage.stages).toEqual(["announcement/discussion"]);
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /No active direct passage supports the effective\/application research stage/i,
    );
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /No active direct passage supports the enforcement\/penalty research stage/i,
    );
  });

  it("discovers the precursor announcement from the real Audit source pack when its dossier has no announcement lead", async () => {
    const selected = auditHandoffWithReviewedPrecursorSource();
    const precursorUrl = selected.sources.find(
      (source) =>
        source.id === "reviewed:ccpa-initiative-circulation-17-0039",
    )!.locator;
    const billUrl = selected.sources.find(
      (source) => source.id === "ccpa-official",
    )!.locator;
    const historyUrl =
      "https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=201720180AB375";
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.toString() === precursorUrl) {
        return new Response(`<!doctype html><main>
          <h1>Proposed initiative enters circulation</h1>
          <p>The California Secretary of State announced on December 18, 2017 that proponents of initiative 17-0039 were cleared to begin collecting petition signatures.</p>
          <p>The proposed initiative would require businesses to disclose personal information and would impose civil penalties.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      if (url.toString() === billUrl) {
        return new Response(`<!doctype html><main>
          <h1>California Consumer Privacy Act of 2018</h1>
          <p>The Act was signed into law on June 28, 2018 and went into effect on January 1, 2020.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      if (url.toString() === historyUrl) {
        return new Response(`<!doctype html><main>
          <h1>AB 375 bill history</h1>
          <p>AB 375 was read first time on February 9, 2017.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      throw new Error(`Unexpected reviewed Audit source URL: ${url}`);
    };

    const researched = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    expect(researched.proposals.timeline.some((proposal) =>
      proposal.stage === "announcement"
    )).toBe(false);
    const compiled = compileScreen03ExactExcerpts(
      researched,
      selected.event.identity.commonNames,
    );
    const announcement = compiled.proposals.timeline.find(
      (proposal) => proposal.stage === "announcement",
    );
    const precursorEvidence = compiled.evidence.find(
      (item) => item.locator === precursorUrl,
    );

    expect(announcement).toMatchObject({
      date: "2017-12-18",
      label: "Precursor privacy initiative cleared for circulation",
      support: "direct",
      sourceIds: [precursorEvidence?.id],
      uncertainty: expect.stringMatching(
        /precursor ballot initiative.+not the selected law's introduction or enactment/i,
      ),
    });
    expect(compiled.proposals.timeline.some((proposal) =>
      proposal.date === "2017-02-09"
    )).toBe(false);
    expect([
      ...compiled.proposals.component,
      ...compiled.proposals.eligibility,
      ...compiled.proposals.amendment,
    ].some((proposal) =>
      proposal.sourceIds.includes(precursorEvidence?.id ?? "")
    )).toBe(false);
  });

  it("derives a bounded official bill-history companion for any carried California bill without calling its first action the selected reform announcement", async () => {
    const selected = arbitraryCaliforniaBillHandoff();
    const billUrl = selected.sources[0]!.locator;
    const historyUrl =
      "https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=202320240AB1234";
    const documentUrls: string[] = [];
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      documentUrls.push(url.toString());
      if (url.toString() === billUrl) {
        return new Response(`<!doctype html><main>
          <h1>California Workplace Notice Act</h1>
          <p>The California Workplace Notice Act became effective on January 1, 2025.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      if (url.toString() === historyUrl) {
        return new Response(`<!doctype html><main>
          <h1>California Workplace Notice Act bill history</h1>
          <p>AB 1234 was read first time on February 10, 2023 and later amended.</p>
        </main>`, { headers: { "content-type": "text/html" } });
      }
      throw new Error(`Unexpected lifecycle fixture URL: ${url}`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );

    expect(documentUrls).toEqual([billUrl, historyUrl]);
    expect(packet.evidence).toContainEqual(expect.objectContaining({
      locator: historyUrl,
      publisher: "California Legislative Information",
      status: "retrieved",
      passages: expect.arrayContaining([
        expect.objectContaining({
          basis: "official-document-passage",
          text: expect.stringMatching(/read first time on February 10, 2023/i),
        }),
      ]),
    }));
    expect(packet.proposals.timeline.some((proposal) =>
      proposal.stage === "announcement" && proposal.date === "2023-02-10"
    )).toBe(false);
  });

  it("converts an allowlisted bounded PDF through the optional converter", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const primary = selected.sources[0]!;
    primary.locator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/document.pdf";
    const { sourceFingerprint: _primaryFingerprint, ...primaryBase } = primary;
    primary.sourceFingerprint = fingerprintScreen02WorkflowValue(primaryBase);
    const telemetry: Screen03ResearchTelemetry[] = [];
    const fakePdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj<</Type /Page>>endobj\n2 0 obj<</Type /Page>>endobj\n%%EOF",
    );
    let converterInput: {
      detectedPageCount: number;
      maximumPages: number;
      maximumTextCharacters: number;
    } | null = null;
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: [] } });
      }
      return new Response(fakePdf, {
        headers: { "content-type": "application/pdf" },
      });
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
        convertDocument: async (input) => {
          converterInput = {
            detectedPageCount: input.detectedPageCount,
            maximumPages: input.maximumPages,
            maximumTextCharacters: input.maximumTextCharacters,
          };
          expect(input.blob.size).toBe(fakePdf.byteLength);
          expect(input.contentType).toBe("application/pdf");
          return {
            text: "General Data Protection Regulation. It applies from 25 May 2018 and covered entities must implement compliance records.",
          };
        },
        onTelemetry: (value) => {
          telemetry.push(value);
        },
      }),
    );

    expect(converterInput).toEqual({
      detectedPageCount: 2,
      maximumPages: SCREEN_03_DOCUMENT_MAX_PDF_PAGES,
      maximumTextCharacters: SCREEN_03_DOCUMENT_MAX_CONVERTED_TEXT,
    });
    expect(packet.evidence.flatMap((item) => item.passages)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          basis: "official-document-passage",
          text: expect.stringMatching(/applies from 25 May 2018/i),
        }),
      ]),
    );
    expect(telemetry).toHaveLength(1);
    expect(telemetry[0]).toMatchObject({
      event: "screen03-research-completed",
      pdfConversionSucceeded: 1,
      synthesisMode: "deterministic-fallback",
      contextSearchCallCount: 0,
      contextLeadCount: 0,
      contextSearchStatus: "not-configured",
    });
    expect(JSON.stringify(telemetry[0])).not.toMatch(
      /eur-lex|GDPR|https?:|locator|passageText/i,
    );
  });

  it("keeps the third usable document slot from triggering a third PDF conversion", async () => {
    const selected = JSON.parse(
      JSON.stringify(ccpaReviewedSourcePackHandoff()),
    ) as Screen02WorkflowHandoff;
    selected.sources = selected.sources.slice(0, 3).map((source, index) => {
      const base = {
        ...source,
        title: `California Consumer Privacy Act official PDF ${index + 1}`,
        locator:
          `https://oag.ca.gov/sites/all/files/agweb/pdfs/privacy/ccpa-test-${index + 1}.pdf`,
        channel: "official-administrative-record",
      };
      const { sourceFingerprint: _sourceFingerprint, ...fingerprintInput } = base;
      return {
        ...base,
        sourceFingerprint: fingerprintScreen02WorkflowValue(fingerprintInput),
      };
    });
    const sourceIds = selected.sources.map((source) => source.id);
    selected.event.sourceIds = sourceIds;
    selected.event.description.sourceIds = sourceIds;
    selected.event.dateLeads.forEach((lead) => {
      lead.sourceIds = sourceIds;
    });
    selected.event.broadCoverage.forEach((claim) => {
      claim.sourceIds = sourceIds;
    });
    selected.event.highLevelChanges.forEach((claim) => {
      claim.sourceIds = sourceIds;
    });
    selected.event.keyComponents.forEach((claim) => {
      claim.sourceIds = sourceIds;
    });
    const sealed = resealHandoff(selected);
    const fakePdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj<</Type /Page>>endobj\n%%EOF",
    );
    let converterCalls = 0;
    const telemetry: Screen03ResearchTelemetry[] = [];
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: sealed,
        fetch: async () => new Response(fakePdf, {
          headers: { "content-type": "application/pdf" },
        }),
        retrievedAt: researchedAt,
        convertDocument: async () => {
          converterCalls += 1;
          return {
            text:
              "California Consumer Privacy Act. The law went into effect on January 1, 2020.",
          };
        },
        onTelemetry: (value) => {
          telemetry.push(value);
        },
      }),
    );

    expect(SCREEN_03_DOCUMENT_MAX_PDF_CONVERSIONS).toBe(2);
    expect(converterCalls).toBe(2);
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /2-PDF conversion limit.+unresolved source lead/i,
    );
    expect(telemetry).toContainEqual(expect.objectContaining({
      documentAttempts: 3,
      documentUsable: 2,
      pdfConversionAttempts: 2,
      pdfConversionSucceeded: 2,
    }));
  });

  it("rejects PDFs above the fixed detected-page cap before conversion", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const primary = selected.sources[0]!;
    primary.locator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/oversized.pdf";
    const { sourceFingerprint: _primaryFingerprint, ...primaryBase } = primary;
    primary.sourceFingerprint = fingerprintScreen02WorkflowValue(primaryBase);
    const fakePdf = new TextEncoder().encode(
      `%PDF-1.7\n${"1 0 obj<</Type /Page>>endobj\n".repeat(
        SCREEN_03_DOCUMENT_MAX_PDF_PAGES + 1,
      )}%%EOF`,
    );
    let converterCalls = 0;
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.hostname === "publications.europa.eu") {
            return jsonResponse({ results: { bindings: [] } });
          }
          return new Response(fakePdf, {
            headers: { "content-type": "application/pdf" },
          });
        },
        retrievedAt: researchedAt,
        convertDocument: async () => {
          converterCalls += 1;
          return { text: "must not run" };
        },
      }),
    );

    expect(converterCalls).toBe(0);
    expect(packet.coverage.gaps.join(" ")).toMatch(
      new RegExp(`exceeding the ${SCREEN_03_DOCUMENT_MAX_PDF_PAGES}-page`, "i"),
    );
  });

  it.each([
    ["zero-page", "%PDF-1.7\n%%EOF"],
    [
      "object-stream",
      "%PDF-1.7\n1 0 obj<</Type /ObjStm /N 1>>stream /Type /Page endstream endobj\n%%EOF",
    ],
    [
      "forged-count",
      "%PDF-1.7\n1 0 obj<</Type /Pages /Count 1>>endobj\n2 0 obj<</Type /ObjStm /N 99>>stream hidden pages endstream endobj\n%%EOF",
    ],
  ])("fails closed for %s PDF page structures", async (_kind, body) => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    selected.sources[0]!.locator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/advisory.pdf";
    const { sourceFingerprint: _old, ...sourceInput } = selected.sources[0]!;
    selected.sources[0]!.sourceFingerprint =
      fingerprintScreen02WorkflowValue(sourceInput);
    let converterCalls = 0;
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.hostname === "publications.europa.eu") {
            return jsonResponse({ results: { bindings: [] } });
          }
          return new Response(new TextEncoder().encode(body), {
            headers: { "content-type": "application/pdf" },
          });
        },
        retrievedAt: researchedAt,
        convertDocument: async () => {
          converterCalls += 1;
          return { text: "must not convert" };
        },
      }),
    );

    expect(converterCalls).toBe(0);
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /advisory raw-byte scan could not safely bound/i,
    );
  });

  it("searches a full bounded official document and links a natural-language date near its end", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const filler = "Neutral legislative recital without a controlling date. ".repeat(400);
    const officialDocument = `<html><body><main><h1>Regulation (EU) 2016/679</h1><p>${filler}</p><p>Article 99. This Regulation shall apply from 25 May 2018.</p></main></body></html>`;
    expect(officialDocument.indexOf("Article 99")).toBeGreaterThan(12_000);
    expect(officialDocument).not.toContain("2018-05-25");

    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: euBindings(1) } });
      }
      if (url.hostname === "eur-lex.europa.eu") {
        return new Response(officialDocument, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      throw new Error(`Unexpected official route ${url.hostname}.`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const effectiveProposal = packet.proposals.timeline.find(
      (proposal) => proposal.date === "2018-05-25",
    );
    expect(effectiveProposal).toMatchObject({
      stage: "effective",
      support: "direct",
    });
    expect(
      packet.evidence
        .flatMap((item) => item.passages)
        .filter((passage) => effectiveProposal?.passageIds.includes(passage.id))
        .some((passage) => /apply from 25 May 2018/i.test(passage.text)),
    ).toBe(true);
  });

  it.each([
    ["2018-05-05", "05 May 2018"],
    ["2018-05-05", "May 05, 2018"],
    ["2018-05-05", "05th May 2018"],
    ["2018-05-05", "May 05th, 2018"],
    ["2018-09-05", "05 Sept. 2018"],
    ["2018-09-05", "Sep 05th, 2018"],
  ])(
    "links padded named-month official text %s rendered as %s",
    async (isoDate, officialDate) => {
      const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
      selected.event.dateLeads = [{
        ...selected.event.dateLeads[0]!,
        date: isoDate,
        stage: "effective",
        label: "Padded named-month effective date lead",
      }];
      const officialDocument =
        `<html><body><p>General Data Protection Regulation applies from ${officialDate}.</p></body></html>`;
      const fetch: Screen02ConnectorFetch = async (input) => {
        const url = new URL(String(input));
        if (url.hostname === "publications.europa.eu") {
          return jsonResponse({ results: { bindings: euBindings(1) } });
        }
        if (url.hostname === "eur-lex.europa.eu") {
          return new Response(officialDocument, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        throw new Error(`Unexpected official route ${url.hostname}.`);
      };

      const packet = requireScreen03ResearchPacket(
        await researchScreen03Evidence({
          handoff: selected,
          fetch,
          retrievedAt: researchedAt,
        }),
      );
      const proposal = packet.proposals.timeline.find(
        (candidate) => candidate.date === isoDate,
      );
      expect(proposal).toMatchObject({ support: "direct" });
      expect(
        packet.evidence
          .flatMap((item) => item.passages)
          .filter((passage) => proposal?.passageIds.includes(passage.id))
          .some((passage) => passage.text.includes(officialDate)),
      ).toBe(true);
    },
  );

  it.each(["06/05/2018", "05/06/2018"])(
    "does not infer a locale for an ambiguous numeric official date: %s",
    async (ambiguousDate) => {
      const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
      selected.event.dateLeads = [{
        ...selected.event.dateLeads[0]!,
        date: "2018-05-06",
        stage: "effective",
        label: "Ambiguous effective date lead",
      }];
      const officialDocument =
        `<html><body><p>This Regulation applies from ${ambiguousDate}.</p></body></html>`;
      const fetch: Screen02ConnectorFetch = async (input) => {
        const url = new URL(String(input));
        if (url.hostname === "publications.europa.eu") {
          return jsonResponse({ results: { bindings: euBindings(1) } });
        }
        if (url.hostname === "eur-lex.europa.eu") {
          return new Response(officialDocument, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        throw new Error(`Unexpected official route ${url.hostname}.`);
      };

      const packet = requireScreen03ResearchPacket(
        await researchScreen03Evidence({
          handoff: selected,
          fetch,
          retrievedAt: researchedAt,
        }),
      );
      expect(
        packet.proposals.timeline.find(
          (proposal) => proposal.date === "2018-05-06",
        ),
      ).toMatchObject({ support: "indirect" });
    },
  );

  it("balances dense identity aliases and date spellings while preserving a distinct controlling late excerpt", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const source = selected.sources[0]!;
    const sourceLocator = new URL(
      "https://eur-lex.europa.eu/legal-content/EN/TXT/",
    );
    sourceLocator.searchParams.set("uri", "CELEX:32016R0679");
    source.locator = sourceLocator.toString();
    const { sourceFingerprint: _oldSourceFingerprint, ...sourceWithoutFingerprint } =
      source;
    source.sourceFingerprint = fingerprintScreen02WorkflowValue(
      sourceWithoutFingerprint,
    );
    selected.event.identity.commonNames = Array.from(
      { length: 48 },
      (_, index) => `Legacy privacy designation ${String(index + 1).padStart(2, "0")}`,
    );
    selected.event.dateLeads = [
      {
        id: "announcement-iso",
        date: "2017-01-01",
        label: "Announcement date lead",
        stage: "announcement",
        sourceIds: [source.id],
        status: "provisional",
        uncertainty: "Confirm the announcement clock.",
      },
      {
        id: "implementation-numeric",
        date: "2018-02-20",
        label: "Implementation date lead",
        stage: "implementation",
        sourceIds: [source.id],
        status: "provisional",
        uncertainty: "Confirm the implementation clock.",
      },
      {
        id: "controlling-amendment-natural",
        date: "2021-11-30",
        label: "Controlling amendment lead",
        stage: "amendment",
        sourceIds: [source.id],
        status: "provisional",
        uncertainty: "Confirm the controlling amendment clock.",
      },
    ];

    const spacer = (marker: string) =>
      `${marker} ${"Neutral recital text without an event date. ".repeat(24)}`;
    const repeatedEarlyMentions = Array.from(
      { length: 6 },
      (_, index) =>
        `Historical section ${index + 1}. Legacy privacy designation 01 was announced on 2017-01-01. ${spacer(`early-${index + 1}`)}`,
    ).join(" ");
    const officialDocument = [
      "General Data Protection Regulation, Regulation (EU) 2016/679.",
      spacer("identity-boundary"),
      repeatedEarlyMentions,
      spacer("numeric-boundary"),
      "The implementation phase began on 20/02/2018 and imposed the first compliance threshold.",
      spacer("late-boundary"),
      "The controlling amendment became operative on 30 November 2021 and revised the applicable exemption.",
    ].join(" ");
    expect(selected.event.identity.commonNames.length).toBeGreaterThan(40);
    expect(officialDocument.indexOf("30 November 2021")).toBeGreaterThan(
      officialDocument.indexOf("2017-01-01") + 4_000,
    );

    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: euBindings(1) } });
      }
      if (url.hostname === "eur-lex.europa.eu") {
        return new Response(officialDocument, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      throw new Error(`Unexpected official route ${url.hostname}.`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const enriched = packet.evidence.find(
      (item) => item.locator === source.locator,
    );
    expect(enriched).toBeDefined();
    expect(enriched!.passages.length).toBeLessThanOrEqual(12);
    expect(enriched!.passages.length).toBeGreaterThan(
      SCREEN_03_DOCUMENT_MAX_EXCERPTS,
    );
    expect(
      enriched!.passages.slice(0, 4).every(
        isOfficialSubstantivePassage,
      ),
    ).toBe(true);
    expect(
      enriched!.passages.slice(SCREEN_03_DOCUMENT_MAX_EXCERPTS).every(
        (passage) => passage.basis === "official-record-field" ||
          passage.basis === "source-metadata",
      ),
    ).toBe(true);
    expect(enriched!.passages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        basis: "official-record-field",
        officialField: "canonical-title",
      }),
      expect.objectContaining({
        basis: "official-record-field",
        officialField: "formal-identifier",
      }),
      expect.objectContaining({
        basis: "source-metadata",
        text: expect.stringMatching(
          /Reported jurisdiction: European Union.*Fixed-core event classification/s,
        ),
      }),
    ]));
    expect(enriched!.passages).not.toContainEqual(
      expect.objectContaining({ officialField: "issuing-jurisdiction" }),
    );

    const excerpts = enriched!.passages.filter(
      isOfficialSubstantivePassage,
    );
    expect(excerpts.some((passage) => /announced on 2017-01-01/i.test(passage.text))).toBe(
      true,
    );
    expect(excerpts.some((passage) => /implementation phase began on 20\/02\/2018/i.test(passage.text))).toBe(
      true,
    );
    expect(excerpts.some((passage) => /controlling amendment became operative on 30 November 2021/i.test(passage.text))).toBe(
      true,
    );
    expect(
      excerpts.filter((passage) => /announced on 2017-01-01/i.test(passage.text)).length,
    ).toBeLessThan(SCREEN_03_DOCUMENT_MAX_EXCERPTS);

    for (const date of ["2017-01-01", "2018-02-20", "2021-11-30"]) {
      const proposal = packet.proposals.timeline.find(
        (candidate) => candidate.date === date,
      );
      expect(proposal).toMatchObject({ support: "direct" });
      expect(
        enriched!.passages.some(
          (passage) =>
            proposal!.passageIds.includes(passage.id) &&
            isOfficialSubstantivePassage(passage),
        ),
      ).toBe(true);
    }
  });

  it("proposes bounded event details only from exact official source excerpts", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const carriedSource = selected.sources[0]!;
    carriedSource.evidenceText =
      "SYNTHESIZED-METADATA-ONLY: a $999 million revenue threshold and nonprofit exemption.";
    const {
      sourceFingerprint: _oldSourceFingerprint,
      ...sourceWithoutFingerprint
    } = carriedSource;
    carriedSource.sourceFingerprint = fingerprintScreen02WorkflowValue(
      sourceWithoutFingerprint,
    );
    const officialDocument = [
      "General Data Protection Regulation, Regulation (EU) 2016/679.",
      "Businesses with annual gross revenue exceeding $25 million satisfy the revenue threshold.",
      "Nonprofit organizations are exempt from this regulation.",
      "Covered entities include controllers offering services to people in the Union.",
      "(a) Subject to limitation provided in subdivision (b), this title shall be operative January 1, 2020.",
      "Each covered entity must maintain a record of processing activities.",
      "The bill would require the Attorney General to, on or before July 1, 2020, solicit broad public participation and adopt regulations.",
      "The business’s duty to disclose and deliver the information within 45 days of receipt of the consumer’s request applies to verified requests.",
      "The 2021 amendment revised the reporting duty and delayed its operative date.",
      // Duplicate sentences and excess matches exercise deterministic dedupe
      // and the fixed per-category ceiling without affecting other categories.
      ...Array.from(
        { length: SCREEN_03_DETAIL_MAX_PER_CATEGORY + 3 },
        (_, index) =>
          `A separate revenue threshold applies at ${index + 30} million euros.`,
      ),
      "Businesses with annual gross revenue exceeding $25 million satisfy the revenue threshold.",
    ].join(" ");
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: euBindings(1) } });
      }
      if (url.hostname === "eur-lex.europa.eu") {
        return new Response(officialDocument, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      throw new Error(`Unexpected official route ${url.hostname}.`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const expectedDetails = [
      ["eligibility", "Eligibility thresholds", "$25 million"],
      ["eligibility", "Exemptions", "Nonprofit organizations"],
      ["eligibility", "Covered entities or eligibility", "Covered entities include"],
      ["amendment", "Amendments and delays", "2021 amendment revised"],
    ] as const;
    const passageById = new Map(
      packet.evidence.flatMap((item) =>
        item.passages.map((passage) => [passage.id, passage] as const),
      ),
    );
    const passageOwnerById = new Map(
      packet.evidence.flatMap((item) =>
        item.passages.map((passage) => [passage.id, item.id] as const),
      ),
    );
    for (const [group, label, valueFragment] of expectedDetails) {
      const proposal = packet.proposals[group].find(
        (candidate) =>
          candidate.label === label && candidate.value.includes(valueFragment),
      );
      expect(
        proposal,
        `${group}:${label}:${valueFragment} in ${JSON.stringify(packet.proposals[group])}`,
      ).toMatchObject({
        reviewStatus: "proposed",
        support: "direct",
      });
      expect(proposal!.sourceIds.length).toBeGreaterThan(0);
      expect(proposal!.passageIds.length).toBeGreaterThan(0);
      for (const passageId of proposal!.passageIds) {
        expect(isOfficialSubstantivePassage(passageById.get(passageId)!)).toBe(
          true,
        );
        expect(passageById.get(passageId)!.text).toContain(proposal!.value);
        expect(proposal!.sourceIds).toContain(passageOwnerById.get(passageId));
      }
    }

    const allProposals = Object.values(packet.proposals).flat();
    expect(
      allProposals.some((proposal) =>
        proposal.value.includes("SYNTHESIZED-METADATA-ONLY"),
      ),
    ).toBe(false);
    const thresholdDetails = packet.proposals.eligibility.filter(
      (proposal) =>
        proposal.label === "Eligibility thresholds" &&
        proposal.support === "direct",
    );
    expect(thresholdDetails.length).toBeLessThanOrEqual(
      SCREEN_03_DETAIL_MAX_PER_CATEGORY,
    );
    expect(new Set(thresholdDetails.map((proposal) => proposal.value)).size).toBe(
      thresholdDetails.length,
    );
    expect(
      allProposals.filter((proposal) =>
        /Fixed lexical extraction/.test(proposal.uncertainty ?? ""),
      ).length,
    ).toBeLessThanOrEqual(SCREEN_03_DETAIL_MAX_TOTAL);
    expect(packet.proposals.component.length).toBeLessThanOrEqual(
      SCREEN_03_COMPONENT_TARGET,
    );
    expect(packet.proposals.component.map((proposal) => proposal.value)).not.toContain(
      "The bill would require the Attorney General to,",
    );
    expect(packet.proposals.component.map((proposal) => proposal.value)).not.toContain(
      "’s duty to disclose and deliver the information within 45 days of receipt of the consumer’s request.",
    );
    expect(
      packet.proposals.eligibility.some((proposal) =>
        /subject to limitation provided in subdivision/i.test(proposal.value)
      ),
    ).toBe(false);
    expect(
      packet.proposals.component
        .filter((proposal) => proposal.support === "direct")
        .every((proposal) => screen03ExtractiveClaimIsComplete(proposal.value)),
    ).toBe(true);
  });

  it("keeps official HTML headings separate from complete operative sentences", async () => {
    const exactDuty =
      "Covered entities must maintain complete processing records.";
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: euBindings(1) } });
      }
      if (url.hostname === "eur-lex.europa.eu") {
        return new Response(
          `<html><body><main><h1>General Data Protection Regulation</h1><p>${exactDuty}</p></main></body></html>`,
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }
      throw new Error(`Unexpected official route ${url.hostname}.`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    expect(packet.proposals.component).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: exactDuty, support: "direct" }),
      ]),
    );
    expect(
      packet.proposals.component.some((proposal) =>
        /Regulation\s+Covered entities/u.test(proposal.value)
      ),
    ).toBe(false);
  });

  it("integrates only validated extractive synthesis claims as proposed direct fields", async () => {
    let synthesizerCalls = 0;
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch: euFetch(),
        retrievedAt: researchedAt,
        synthesizer: async (request) => {
          synthesizerCalls += 1;
          const owner = request.evidence.find((item) =>
            item.passages.some((passage) =>
              passage.text.includes("Enforcement and exemptions")
            )
          )!;
          const passage = owner.passages.find((candidate) =>
            candidate.text.includes("Enforcement and exemptions")
          )!;
          const exactValue =
            "Enforcement and exemptions remain subject to the controlling provisions.";
          return {
            protocolVersion: request.protocolVersion,
            claims: [{
              id: "validated-enforcement-claim",
              stageId: "enforcement-penalty",
              group: "component",
              label: "Enforcement or penalty",
              value: exactValue,
              evidenceIds: [owner.evidenceId],
              passageIds: [passage.passageId],
            }],
            outcomeValuesInspected: false,
          };
        },
      }),
    );

    expect(synthesizerCalls).toBe(1);
    const proposal = packet.proposals.component.find(
      (candidate) => candidate.label === "Enforcement or penalty",
    );
    expect(proposal).toMatchObject({
      value:
        "Enforcement and exemptions remain subject to the controlling provisions.",
      support: "direct",
      reviewStatus: "proposed",
      uncertainty: expect.stringMatching(/strict extractive/i),
    });
    const passage = packet.evidence.flatMap((item) => item.passages).find(
      (candidate) => proposal?.passageIds.includes(candidate.id),
    );
    expect(passage?.text).toContain(proposal!.value);
    expect(packet.coverage.gaps.join(" ")).not.toMatch(
      /optional synthesis response failed|semantic synthesizer was not configured/i,
    );
    expect(packet.proposals.component.length).toBeLessThanOrEqual(
      SCREEN_03_COMPONENT_TARGET,
    );
  });

  it("keeps case-sensitive official locator paths and queries isolated", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    const upperLocator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:Path-One";
    const lowerLocator =
      "https://eur-lex.europa.eu/legal-content/en/txt/?uri=celex:path-one";
    expect(
      upperLocator.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim(),
    ).toBe(
      lowerLocator.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim(),
    );

    const primary = selected.sources[0]!;
    primary.locator = upperLocator;
    const { sourceFingerprint: _oldPrimaryFingerprint, ...primaryBase } = primary;
    primary.sourceFingerprint = fingerprintScreen02WorkflowValue(primaryBase);
    const secondaryBase = {
      ...primaryBase,
      id: "case-sensitive-secondary",
      locator: lowerLocator,
      title: "Case-sensitive secondary official record",
    };
    selected.sources.push({
      ...secondaryBase,
      sourceFingerprint: fingerprintScreen02WorkflowValue(secondaryBase),
    });
    selected.event.sourceIds.push(secondaryBase.id);

    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: [] } });
      }
      if (url.pathname === "/legal-content/EN/TXT/") {
        return new Response(
          "General Data Protection Regulation. UPPER-LOCATOR amendment revised the operative duty.",
          { headers: { "content-type": "text/plain" } },
        );
      }
      if (url.pathname === "/legal-content/en/txt/") {
        return new Response(
          "General Data Protection Regulation. LOWER-LOCATOR revenue threshold is $40 million for covered entities.",
          { headers: { "content-type": "text/plain" } },
        );
      }
      throw new Error(`Unexpected official locator ${url.toString()}.`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    const upper = packet.evidence.find((item) => item.locator === upperLocator);
    const lower = packet.evidence.find((item) => item.locator === lowerLocator);
    expect(upper).toBeDefined();
    expect(lower).toBeDefined();
    expect(upper!.passages.map((passage) => passage.text).join(" ")).toMatch(
      /UPPER-LOCATOR/,
    );
    expect(upper!.passages.map((passage) => passage.text).join(" ")).not.toMatch(
      /LOWER-LOCATOR/,
    );
    expect(lower!.passages.map((passage) => passage.text).join(" ")).toMatch(
      /LOWER-LOCATOR/,
    );
    expect(lower!.passages.map((passage) => passage.text).join(" ")).not.toMatch(
      /UPPER-LOCATOR/,
    );
  });

  it("stops reading an official document body at the fixed cumulative byte limit", async () => {
    const selected = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    selected.sources[0]!.locator =
      "https://eur-lex.europa.eu/legal-content/ENG/TXT/?uri=CELEX:32016R0679";
    const {
      sourceFingerprint: _oldSourceFingerprint,
      ...sourceWithoutFingerprint
    } = selected.sources[0]!;
    selected.sources[0]!.sourceFingerprint =
      fingerprintScreen02WorkflowValue(sourceWithoutFingerprint);
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: euBindings(1) } });
      }
      return new Response("x".repeat(SCREEN_03_DOCUMENT_MAX_TOTAL_BYTES + 1), {
        headers: { "content-type": "text/plain" },
      });
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: selected,
        fetch,
        retrievedAt: researchedAt,
      }),
    );

    expect(packet.coverage.gaps.join(" ")).toMatch(
      /exceeded the fixed cumulative document-byte limit/i,
    );
  });

  it("bounds decompressed text independently of the encoded content length", async () => {
    const compressedLength = 1_000;
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: euBindings(1) } });
      }
      return new Response(
        `General Data Protection Regulation ${"expanded official text ".repeat(4_000)}`,
        {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "content-encoding": "gzip",
            "content-length": String(compressedLength),
          },
        },
      );
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch,
        retrievedAt: researchedAt,
      }),
    );
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /exceeded the fixed decompression-expansion limit/i,
    );
  });

  it("retains declared non-English source text without silently translating it", async () => {
    const frenchText =
      "Le Règlement général sur la protection des données Regulation (EU) 2016/679 protège les personnes physiques.";
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch: async (input) => {
          const url = new URL(String(input));
          if (url.hostname === "publications.europa.eu") {
            return jsonResponse({ results: { bindings: euBindings(1) } });
          }
          return new Response(
            `<html lang="fr-FR"><body><main><h1>General Data Protection Regulation</h1><p>${frenchText}</p></main></body></html>`,
            {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "content-language": "fr-FR",
              },
            },
          );
        },
        retrievedAt: researchedAt,
      }),
    );

    const frenchEvidence = packet.evidence.find(
      (item) => item.language === "fr-fr",
    );
    expect(frenchEvidence).toBeDefined();
    expect(frenchEvidence?.passages.map((passage) => passage.text).join(" "))
      .toContain(frenchText);
    expect(packet.coverage.languages).toContain("fr-fr");
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /did not silently translate.*review the original wording/i,
    );
  });

  it("routes one exact target claim through bounded connector queries and prioritizes its official-document passage", async () => {
    const targetValue =
      "Controllers must retain verifiable exposure ledgers for seven reporting cycles.";
    const targetProposalId = "screen03-proposal-targeted-exposure-ledger";
    const requestedUrls: string[] = [];
    const stageParagraphs = [
      "The proposal announcement opened consultation on the selected regulation.",
      "The enactment publication recorded adoption of the selected regulation.",
      "The regulation became effective and applicable on the recorded date.",
      "Implementation guidance established a compliance deadline.",
      "Enforcement provisions authorize a penalty after inspection.",
      "A later amendment did not repeal the selected regulation.",
    ].map((sentence) => `<p>${sentence} ${"Background material. ".repeat(45)}</p>`)
      .join("\n");
    const fetch: Screen02ConnectorFetch = async (input) => {
      const url = new URL(String(input));
      requestedUrls.push(url.toString());
      if (url.hostname === "publications.europa.eu") {
        return jsonResponse({ results: { bindings: euBindings(1) } });
      }
      if (url.hostname === "eur-lex.europa.eu") {
        return new Response(
          `<html lang="en"><body><main>
            <h1>General Data Protection Regulation</h1>
            ${stageParagraphs}
            <p>${targetValue}</p>
          </main></body></html>`,
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }
      throw new Error(`Unexpected official route ${url.hostname}.`);
    };

    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: handoff(),
        fetch,
        retrievedAt: researchedAt,
        targetClaim: {
          proposalId: targetProposalId,
          group: "component",
          label: "Exposure-ledger retention duty",
          value: targetValue,
          sourceIds: [],
          passageIds: [],
        },
      }),
    );

    const connectorRequests = requestedUrls
      .filter((value) => new URL(value).hostname === "publications.europa.eu")
      .map((value) => decodeURIComponent(value).toLocaleLowerCase("en-US"));
    expect(connectorRequests).toHaveLength(SCREEN_03_RESEARCH_MAX_CALLS);
    expect(connectorRequests[0]).toContain("32016r0679");
    expect(connectorRequests.slice(1).every((value) =>
      ["controllers", "retain", "verifiable", "exposure", "ledgers"].every(
        (term) => value.includes(term),
      )
    )).toBe(true);
    expect(packet.coverage.queries).toHaveLength(SCREEN_03_RESEARCH_MAX_CALLS);
    expect(packet.coverage.queries.every((query) =>
      query.purpose.includes(`target-proposal:${targetProposalId}`)
    )).toBe(true);
    expect(packet.evidence.flatMap((item) => item.passages)).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining(targetValue),
        basis: "official-document-passage",
      }),
    );
  });

  it("rejects non-factual or malformed claim targets before any connector call", async () => {
    let calls = 0;
    const fetch: Screen02ConnectorFetch = async () => {
      calls += 1;
      return jsonResponse({ results: { bindings: [] } });
    };
    const target = {
      proposalId: "screen03-proposal-design-variable",
      group: "required-variable" as const,
      label: "Required variable",
      value: "Firm exposure indicator",
      sourceIds: [],
      passageIds: [],
    };
    await expect(researchScreen03Evidence({
      handoff: handoff(),
      fetch,
      retrievedAt: researchedAt,
      targetClaim: target,
    })).rejects.toThrow(/targetClaim failed its bounded fixed contract/i);
    await expect(researchScreen03Evidence({
      handoff: handoff(),
      fetch,
      retrievedAt: researchedAt,
      targetClaim: {
        ...target,
        group: "timeline",
      },
    })).rejects.toThrow(/targetClaim failed its bounded fixed contract/i);
    expect(calls).toBe(0);
  });

  it("never inspects or returns outcome values", async () => {
    const value = JSON.parse(JSON.stringify(handoff())) as Screen02WorkflowHandoff;
    value.screen01Baseline.scopeContract.outcomeFamily =
      "DO-NOT-RETURN-OUTCOME-VALUE-94721";
    const packet = requireScreen03ResearchPacket(
      await researchScreen03Evidence({
        handoff: value,
        fetch: euFetch(),
        retrievedAt: researchedAt,
      }),
    );

    expect(packet.outcomeValuesInspected).toBe(false);
    expect(packet.coverage.outcomeValuesInspected).toBe(false);
    expect(JSON.stringify(packet)).not.toContain(
      "DO-NOT-RETURN-OUTCOME-VALUE-94721",
    );
    expect(
      Object.values(packet.proposals)
        .flat()
        .every((proposal) =>
          proposal.reviewStatus === "proposed",
        ),
    ).toBe(true);
  });
});
