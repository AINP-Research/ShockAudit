import type { ConfirmedShock } from "../core/six-screen/contracts";
import type { CoEventCandidateOccurrence } from
  "../core/six-screen/co-event-execution";
import {
  SIX_SCREEN_POLICY_LIFECYCLE_MAX_RETAINED_PASSAGE_CHARACTERS,
  SIX_SCREEN_POLICY_LIFECYCLE_STAGE_SOURCE_VERSION,
  createPolicyLifecycleStageOfficialSource,
  policyLifecycleStageLegalVersionDates,
  policyLifecycleStagePublicationDate,
  type PolicyLifecycleStageDocumentFailureCode,
  type PolicyLifecycleStageDocumentOutcome,
  type PolicyLifecycleStageFocalAnchorKind,
  type PolicyLifecycleStageOfficialSource,
} from "../core/six-screen/policy-lifecycle-stage-review";
import type { ResearchTaskOperationUsage } from
  "../core/six-screen/research-task";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import {
  federalRegisterExactDocumentRepresentations,
  fetchRepresentation,
} from "./screen02-federal-register-acquisition";

export const SIX_SCREEN_POLICY_LIFECYCLE_FEDERAL_REGISTER_ADAPTER_VERSION =
  "screen-02-policy-lifecycle-federal-register-v1" as const;

const MAX_RETAINED_PASSAGES = 6;
const PASSAGE_LOOKBEHIND = 600;
const PASSAGE_LOOKAHEAD = 1_400;
const FALLBACK_PASSAGE_CHARACTERS = 2_000;

export type Screen02PolicyLifecycleStageAcquisitionResult = {
  adapterVersion:
    typeof SIX_SCREEN_POLICY_LIFECYCLE_FEDERAL_REGISTER_ADAPTER_VERSION;
  attemptedSources: string[];
  outcome: PolicyLifecycleStageDocumentOutcome;
  failureCode: PolicyLifecycleStageDocumentFailureCode | null;
  limitation: string | null;
  source: PolicyLifecycleStageOfficialSource | null;
  usage: ResearchTaskOperationUsage;
};

function emptyUsage(): ResearchTaskOperationUsage {
  return {
    sourceQueries: 0,
    metadataRecords: 0,
    documentAttempts: 0,
    usefulDocuments: 0,
    transportHops: 0,
    receivedBytes: 0,
    decodedBytes: 0,
    activeResearchMs: 0,
    cpuMs: 0,
    providerCostUnits: {},
  };
}

function exactDocumentNumber(candidate: CoEventCandidateOccurrence) {
  const values = new Set([
    ...candidate.formalIdentifiers,
    candidate.sourceNativeId,
  ].flatMap((value) => value.match(/\b\d{4}-\d{4,6}\b/gu) ?? []));
  return values.size === 1 ? [...values][0]! : null;
}

function trimInterval(text: string, start: number, end: number) {
  let left = start;
  let right = end;
  while (left < right && /\s/u.test(text[left]!)) left += 1;
  while (right > left && /\s/u.test(text[right - 1]!)) right -= 1;
  return { start: left, end: right };
}

type Anchor = {
  kind: PolicyLifecycleStageFocalAnchorKind;
  value: string;
  start: number;
  end: number;
};

function exactAnchors(text: string, confirmedShock: ConfirmedShock) {
  const lower = text.toLocaleLowerCase("en-US");
  const anchors: Anchor[] = [];
  const seen = new Set<string>();
  for (const value of confirmedShock.formalIdentifiers) {
    const canonical = value.trim();
    if (canonical.length < 4 || canonical.length > 200) continue;
    const start = lower.indexOf(canonical.toLocaleLowerCase("en-US"));
    if (start < 0) continue;
    const key = `formal_identifier\u0000${start}\u0000${canonical.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    anchors.push({
      kind: "formal_identifier",
      value: canonical,
      start,
      end: start + canonical.length,
    });
  }
  const title = confirmedShock.officialTitle.trim();
  if (title.length >= 8 && title.length <= 1_000) {
    const start = lower.indexOf(title.toLocaleLowerCase("en-US"));
    const key = `official_title\u0000${start}\u0000${title.length}`;
    if (start >= 0 && !seen.has(key)) {
      anchors.push({
        kind: "official_title",
        value: title,
        start,
        end: start + title.length,
      });
    }
  }
  return anchors.sort((left, right) => left.start - right.start);
}

function retainedPassages(input: {
  text: string;
  confirmedShock: ConfirmedShock;
  coordinate: string;
  sourceId: string;
  documentVersionId: string;
}) {
  const anchors = exactAnchors(input.text, input.confirmedShock);
  const intervals: Array<{ start: number; end: number }> = [];
  for (const anchor of anchors) {
    const proposed = trimInterval(
      input.text,
      Math.max(0, anchor.start - PASSAGE_LOOKBEHIND),
      Math.min(input.text.length, anchor.end + PASSAGE_LOOKAHEAD),
    );
    const prior = intervals.at(-1);
    if (
      prior && proposed.start <= prior.end &&
      Math.max(prior.end, proposed.end) - prior.start <= 8_000
    ) {
      prior.end = Math.max(prior.end, proposed.end);
    } else if (prior && proposed.start <= prior.end) {
      if (anchor.end <= prior.end) continue;
      if (anchor.start < prior.end && anchor.end - prior.start <= 8_000) {
        prior.end = anchor.end;
        continue;
      }
      const nonOverlapping = trimInterval(
        input.text,
        Math.max(prior.end, proposed.start),
        proposed.end,
      );
      if (nonOverlapping.end > nonOverlapping.start) {
        intervals.push(nonOverlapping);
      }
    } else {
      intervals.push(proposed);
    }
    if (intervals.length >= MAX_RETAINED_PASSAGES) break;
  }
  if (!intervals.length) {
    intervals.push(trimInterval(
      input.text,
      0,
      Math.min(input.text.length, FALLBACK_PASSAGE_CHARACTERS),
    ));
  }
  let remainingCharacters =
    SIX_SCREEN_POLICY_LIFECYCLE_MAX_RETAINED_PASSAGE_CHARACTERS;
  const boundedIntervals: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    if (remainingCharacters < 1) break;
    const bounded = trimInterval(
      input.text,
      interval.start,
      Math.min(interval.end, interval.start + remainingCharacters),
    );
    if (bounded.end <= bounded.start) continue;
    boundedIntervals.push(bounded);
    remainingCharacters -= bounded.end - bounded.start;
  }
  const passages = boundedIntervals.map((interval, index) => {
    const focalPolicyAnchorKinds = [...new Set(anchors
      .filter(({ start, end }) => start >= interval.start && end <= interval.end)
      .map(({ kind }) => kind))];
    return {
      id: `policy-lifecycle-passage-${input.coordinate}-${index + 1}`,
      sourceId: input.sourceId,
      documentVersionId: input.documentVersionId,
      exactText: input.text.slice(interval.start, interval.end),
      locator: `visible text offsets ${interval.start}-${interval.end}`,
      startOffset: interval.start,
      endOffset: interval.end,
      focalPolicyAnchorKinds,
      qualification: focalPolicyAnchorKinds.length
        ? "The exact identifier/title context is retained for researcher review. A mention alone does not establish legal effect or a focal-policy lifecycle relationship."
        : "No exact focal-policy identifier or title anchor was found in this retained opening passage. Acquisition alone does not establish a focal-policy lifecycle relationship.",
      unresolvedCrossReferences: [],
    };
  });
  const kinds = new Set(passages.flatMap(
    ({ focalPolicyAnchorKinds }) => focalPolicyAnchorKinds,
  ));
  return {
    passages,
    focalPolicyReferenceStatus: kinds.has("formal_identifier")
      ? "exact_identifier_found" as const
      : kinds.has("official_title")
        ? "exact_title_found" as const
        : "not_found_in_retained_passages" as const,
  };
}

function failureOutcome(
  code: string,
): PolicyLifecycleStageDocumentFailureCode {
  return [
    "source_unavailable",
    "wrong_document",
    "unsupported_format",
    "response_limit",
    "unparsed",
  ].includes(code)
    ? code as PolicyLifecycleStageDocumentFailureCode
    : "unsupported_format";
}

export async function acquireScreen02PolicyLifecycleStageDocument(input: {
  candidate: CoEventCandidateOccurrence;
  confirmedShock: ConfirmedShock;
  coordinate: string;
  fetch: Screen02ConnectorFetch;
  retrievedAt: string;
  monotonicNow?: () => number;
  timeoutMs?: number;
}): Promise<Screen02PolicyLifecycleStageAcquisitionResult> {
  const usage = emptyUsage();
  const clock = input.monotonicNow ?? Date.now;
  const started = clock();
  const finish = () => {
    usage.activeResearchMs = Math.max(
      0,
      Math.round(clock() - started),
    );
  };
  if (input.candidate.providerId !== "federal_register") {
    finish();
    return {
      adapterVersion:
        SIX_SCREEN_POLICY_LIFECYCLE_FEDERAL_REGISTER_ADAPTER_VERSION,
      attemptedSources: [],
      outcome: "unsupported_source",
      failureCode: "unsupported_source",
      limitation:
        "This first bounded lifecycle-document route supports exact Federal Register records only.",
      source: null,
      usage,
    };
  }
  const documentNumber = exactDocumentNumber(input.candidate);
  if (!documentNumber) {
    finish();
    return {
      adapterVersion:
        SIX_SCREEN_POLICY_LIFECYCLE_FEDERAL_REGISTER_ADAPTER_VERSION,
      attemptedSources: [],
      outcome: "wrong_document",
      failureCode: "wrong_document",
      limitation:
        "The routed occurrence did not retain one exact Federal Register document number.",
      source: null,
      usage,
    };
  }
  const representations = federalRegisterExactDocumentRepresentations(
    input.candidate.evidence.map(({ locator }) => locator),
    documentNumber,
  );
  if (!representations.length) {
    finish();
    return {
      adapterVersion:
        SIX_SCREEN_POLICY_LIFECYCLE_FEDERAL_REGISTER_ADAPTER_VERSION,
      attemptedSources: [],
      outcome: "unsupported_format",
      failureCode: "unsupported_format",
      limitation:
        "The routed occurrence retained no exact Federal Register HTML or text representation.",
      source: null,
      usage,
    };
  }
  const attemptedSources: string[] = [];
  let lastFailure: {
    code: PolicyLifecycleStageDocumentFailureCode;
    limitation: string;
  } | null = null;
  for (const representation of representations) {
    attemptedSources.push(representation.url);
    usage.documentAttempts += 1;
    const attempt = await fetchRepresentation({
      fetch: input.fetch,
      representation,
      documentNumber,
      timeoutMs: input.timeoutMs ?? 10_000,
    });
    usage.transportHops += attempt.transportHops;
    usage.receivedBytes += attempt.receivedBytes;
    usage.decodedBytes += attempt.decodedBytes;
    if (!attempt.ok) {
      lastFailure = {
        code: failureOutcome(attempt.code),
        limitation: attempt.limitation,
      };
      if (lastFailure.code !== "source_unavailable") break;
      continue;
    }
    const sourceId = `policy-lifecycle-source-${input.coordinate}`;
    const documentVersionId =
      `policy-lifecycle-document-${input.coordinate}`;
    const retained = retainedPassages({
      text: attempt.parsedText,
      confirmedShock: input.confirmedShock,
      coordinate: input.coordinate,
      sourceId,
      documentVersionId,
    });
    const matchingEvidence = input.candidate.evidence.find(({ locator }) =>
      attemptedSources.includes(locator)) ?? input.candidate.evidence[0];
    const source = createPolicyLifecycleStageOfficialSource({
      schemaVersion: SIX_SCREEN_POLICY_LIFECYCLE_STAGE_SOURCE_VERSION,
      sourceId,
      documentVersionId,
      provider: "federal_register",
      nativeDocumentNumber: documentNumber,
      title: input.candidate.title,
      publisher: matchingEvidence?.publisher ?? "Federal Register",
      issuer: null,
      author: null,
      jurisdiction: "United States",
      role: "official structured record",
      documentType: "Federal Register publication representation",
      language: "en",
      canonicalUrl: attempt.canonicalUrl,
      publicationDate: policyLifecycleStagePublicationDate(input.candidate),
      legalVersionDates: policyLifecycleStageLegalVersionDates(
        input.candidate,
      ),
      retrievedAt: input.retrievedAt,
      representation: attempt.representation,
      contentHash: attempt.contentHash,
      acquisitionProvenance: "direct",
      accessStatus: "retained_passage",
      rightsStatus: "public-government-record",
      parserVersion:
        SIX_SCREEN_POLICY_LIFECYCLE_FEDERAL_REGISTER_ADAPTER_VERSION,
      textQualityStatus:
        "visible-text parsed; bounded exact retained spans",
      inspectedText: "partial",
      parsedTextLength: attempt.parsedText.length,
      retainedPassages: retained.passages,
      focalPolicyReferenceStatus: retained.focalPolicyReferenceStatus,
    });
    usage.usefulDocuments = 1;
    finish();
    return {
      adapterVersion:
        SIX_SCREEN_POLICY_LIFECYCLE_FEDERAL_REGISTER_ADAPTER_VERSION,
      attemptedSources,
      outcome: "document_retained",
      failureCode: null,
      limitation:
        "Only bounded exact passages are retained for disposition. The researcher must inspect the official document and decide whether it belongs in the focal-policy lifecycle review.",
      source,
      usage,
    };
  }
  finish();
  const failure = lastFailure ?? {
    code: "source_unavailable" as const,
    limitation: "No exact Federal Register representation completed.",
  };
  return {
    adapterVersion:
      SIX_SCREEN_POLICY_LIFECYCLE_FEDERAL_REGISTER_ADAPTER_VERSION,
    attemptedSources,
    outcome: failure.code,
    failureCode: failure.code,
    limitation: failure.limitation,
    source: null,
    usage,
  };
}
