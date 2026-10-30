import {
  createStudyFirstMechanismRun,
  createStudyFirstScholarlyWork,
  type StudyFirstMechanismInput,
  type StudyFirstMechanismPlan,
  type StudyFirstMechanismRun,
  type StudyFirstMechanismSearchAttempt,
  type StudyFirstScholarlyWork,
} from "../core/six-screen/study-first-mechanism-comparison";
import { fingerprintSixScreenValue } from
  "../core/six-screen/canonical";
import type { StudyFirstEventContext } from
  "../core/six-screen/study-first-event-investigation";
import type { Screen02ConnectorFetch } from "./screen02-connectors";
import {
  discoverCrossrefLiteratureMetadata,
  type CrossrefLiteratureMetadata,
} from "./screen05-crossref-literature";
import {
  discoverOpenAlexLiteratureMetadata,
  type OpenAlexLiteratureMetadata,
} from "./screen05-openalex-literature";

export const STUDY_FIRST_MECHANISM_EXECUTOR_VERSION =
  "screen-05-study-first-scholarly-discovery-v2" as const;

function cleanQueryTerm(value: string, maximum = 160) {
  const normalized = value.normalize("NFKC")
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/[^\p{L}\p{N}\p{M}\s'\-]/gu, " ")
    .replace(/\s+/gu, " ").trim();
  if (normalized.length <= maximum) return normalized;
  const words = normalized.split(" ");
  let result = "";
  for (const word of words) {
    const proposed = result ? `${result} ${word}` : word;
    if (proposed.length > maximum) break;
    result = proposed;
  }
  return result;
}

type MechanismSearchIntent = NonNullable<
  StudyFirstMechanismRun["searchPlan"]["intentQueries"]
>[number];

function quotedTerm(value: string) {
  const term = cleanQueryTerm(value);
  return term.includes(" ") ? `"${term.replaceAll('"', "")}"` : term;
}

function boundedSegments(segments: string[], separator: string) {
  const included: string[] = [];
  for (const segment of segments.filter(Boolean)) {
    const proposed = [...included, segment].join(separator);
    // Both reviewed scholarly adapters cap the complete encoded request URL.
    // A 500-character Boolean query can expand past that cap once quotes,
    // spaces, parentheses, and the fixed select list are percent encoded.
    if (proposed.length > 260) break;
    included.push(segment);
  }
  return included.join(separator);
}

function openAlexQuery(intent: StudyFirstMechanismPlan["queryIntents"][number]) {
  const groups = intent.conceptGroups.map((group) => {
    const terms = group.slice(0, 5).map(quotedTerm).filter(Boolean);
    return terms.length > 1 ? `(${terms.join(" OR ")})` : terms[0] ?? "";
  }).filter(Boolean);
  const scopes = intent.scopeTerms.slice(0, 2).map(quotedTerm).filter(Boolean);
  return boundedSegments([...groups, ...scopes], " AND ");
}

function crossrefQuery(intent: StudyFirstMechanismPlan["queryIntents"][number]) {
  return boundedSegments([
    ...intent.conceptGroups.flatMap((group) => group.slice(0, 3))
      .map(quotedTerm),
    ...intent.scopeTerms.slice(0, 2).map(quotedTerm),
  ], " ");
}

function aggregateCandidateQuery(input: {
  provider: "openalex" | "crossref";
  intents: StudyFirstMechanismPlan["queryIntents"];
}) {
  const candidateTerms = input.intents.map((intent) =>
    quotedTerm(intent.conceptGroups[0]?.[0] ?? ""));
  const outcomeTerms = input.intents[0]?.conceptGroups[1]?.slice(0, 2)
    .map(quotedTerm).filter(Boolean) ?? [];
  return input.provider === "openalex"
    ? boundedSegments([
        candidateTerms.length > 1
          ? `(${candidateTerms.join(" OR ")})`
          : candidateTerms[0] ?? "",
        outcomeTerms.length > 1
          ? `(${outcomeTerms.join(" OR ")})`
          : outcomeTerms[0] ?? "",
      ], " AND ")
    : boundedSegments([...candidateTerms, ...outcomeTerms], " ");
}

export function compileStudyFirstMechanismQueries(input: {
  context: StudyFirstEventContext;
  mechanismInput: StudyFirstMechanismInput;
  mechanismPlan?: StudyFirstMechanismPlan | null;
}) {
  if (input.mechanismPlan) {
    const compiled: MechanismSearchIntent[] = [];
    const direct = input.mechanismPlan.queryIntents.find(({ intent }) =>
      intent === "direct_x_y_open_ended");
    const addIntent = (
      intent: StudyFirstMechanismPlan["queryIntents"][number] | undefined,
      provider: "openalex" | "crossref",
    ) => {
      if (!intent) return;
      const query = provider === "openalex"
        ? openAlexQuery(intent)
        : crossrefQuery(intent);
      if (!query) return;
      compiled.push({
        queryId: intent.id,
        candidateIds: [...(intent.candidateIds ?? [])],
        evidenceNeedIds: [...intent.evidenceNeedIds],
        intent: intent.intent,
        provider,
        query,
      });
    };
    // Search both independent bibliographic routes for the focal pathway and
    // for the bounded set of alternatives. The model supplies concepts only;
    // every displayed citation must still resolve to provider-returned work
    // metadata (and inspected text remains required for claim support).
    addIntent(direct, "openalex");
    addIntent(direct, "crossref");
    const candidates = input.mechanismPlan.queryIntents.filter(({ id }) =>
      id !== direct?.id);
    for (const provider of ["openalex", "crossref"] as const) {
      const group = candidates;
      if (!group.length) continue;
      const candidateIds = [...new Set(group.flatMap(({ candidateIds = [] }) =>
        candidateIds))];
      const evidenceNeedIds = [...new Set(group.flatMap(({ evidenceNeedIds }) =>
        evidenceNeedIds))];
      const query = aggregateCandidateQuery({ provider, intents: group });
      if (!query) continue;
      compiled.push({
        queryId: `query-bundle-${fingerprintSixScreenValue({
          provider,
          ids: group.map(({ id }) => id),
        }).slice("fnv1a64:".length)}`,
        candidateIds,
        evidenceNeedIds,
        intent: group.find(({ intent }) =>
          intent === "distinguishing_observation")?.intent ??
          (group.length === 1 ? group[0]!.intent : "alternative_pathway"),
        provider,
        query,
      });
    }
    const deduplicated = compiled.slice(0, 4).filter((item, index, values) =>
      values.findIndex((candidate) =>
        candidate.provider === item.provider &&
        candidate.query.toLocaleLowerCase("en-US") ===
          item.query.toLocaleLowerCase("en-US")) === index
    );
    return deduplicated;
  }
  const mechanism = input.mechanismInput.proposedMechanism;
  const outcome = input.context.study.outcomeMeasure ??
    input.context.study.outcome;
  const industry = input.context.study.industry.slice(0, 2).join(" ");
  const focal = boundedSegments([
    input.context.policy.officialTitle,
    mechanism,
  ].map(quotedTerm), " ");
  const analogous = boundedSegments([
    input.mechanismInput.theoreticalPerspective,
    mechanism,
    "organizational process",
  ].filter((value): value is string => Boolean(value)).map(quotedTerm), " ");
  const rival = boundedSegments([
    outcome,
    industry,
    "alternative explanation mechanism",
  ].filter(Boolean).map(quotedTerm), " ");
  const boundary = boundedSegments([
    mechanism,
    "boundary condition temporal order distinguishing observation",
  ].map(quotedTerm), " ");
  return [
    { intent: "focal_process", provider: "openalex", query: focal },
    { intent: "analogous_process", provider: "crossref", query: analogous },
    { intent: "same_outcome_rival", provider: "openalex", query: rival },
    {
      intent: "boundary_or_distinguishing_observation",
      provider: "crossref",
      query: boundary,
    },
  ].filter(({ query }) => Boolean(query)) as MechanismSearchIntent[];
}

function titleKey(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function workKey(value: Pick<
  StudyFirstScholarlyWork,
  "doi" | "title" | "providerIds"
>) {
  if (value.doi) return `doi:${value.doi}`;
  const providerIdentity = value.providerIds[0];
  return providerIdentity
    ? `provider:${providerIdentity.provider}:${providerIdentity.nativeId}`
    : `unresolved:${titleKey(value.title)}`;
}

function scholarlyWorkId(provider: "openalex" | "crossref", nativeId: string) {
  return `scholarly-work-${provider}-${fingerprintSixScreenValue(nativeId).slice("fnv1a64:".length)}`;
}

function openAlexWork(record: OpenAlexLiteratureMetadata) {
  const reportedOpenLocations: StudyFirstScholarlyWork["access"]["reportedOpenLocations"] =
    record.reportedLocations.flatMap((location) => [
    ...(location.landingPageUrl
      ? [{
          url: location.landingPageUrl,
          version: location.version,
          license: location.license,
          locationKind: "landing_page" as const,
          followed: false as const,
        }]
      : []),
    ...(location.pdfUrl
      ? [{
          url: location.pdfUrl,
          version: location.version,
          license: location.license,
          locationKind: "pdf" as const,
          followed: false as const,
        }]
      : []),
    ]);
  for (const url of [record.contentUrls.pdf, record.contentUrls.grobidXml]) {
    if (url && !reportedOpenLocations.some((location) => location.url === url)) {
      reportedOpenLocations.push({
        url,
        version: null,
        license: null,
        locationKind: "openalex_content",
        followed: false,
      });
    }
  }
  return createStudyFirstScholarlyWork({
    id: scholarlyWorkId("openalex", record.providerNativeId),
    providerIds: [{
      provider: "openalex",
      nativeId: record.providerNativeId,
    }],
    doi: record.doi,
    title: record.title,
    authors: record.authors,
    publicationYear: record.publicationYear,
    publicationVenue: record.publicationVenue,
    publisher: record.publisher,
    workType: record.workType,
    stableLocators: [record.stableLocator],
    versionCaveat:
      "OpenAlex locations can represent different manuscript versions; no location was followed in this discovery stage.",
    updateOrRetraction: {
      retractedFlag: record.isRetracted ? "flagged" : "not_flagged",
      updateRelations: [],
    },
    access: {
      level: record.abstractText ? "abstract_inspected" : "metadata_only",
      abstractText: record.abstractText,
      abstractSource: record.abstractSource,
      reportedOpenLocations,
    },
    claimBoundary: record.abstractText
      ? "Only the reconstructed OpenAlex abstract was inspected. It may support a limited statement actually present there, not detailed methods, measures, estimates, or the complete mechanism."
      : "This is a bibliographic discovery lead. No scholarly text was inspected, so it cannot support a mechanism, theory attribution, measure, or empirical claim.",
  });
}

function crossrefWork(record: CrossrefLiteratureMetadata) {
  return createStudyFirstScholarlyWork({
    id: scholarlyWorkId("crossref", record.providerNativeId),
    providerIds: [{
      provider: "crossref",
      nativeId: record.providerNativeId,
    }],
    doi: record.doi,
    title: record.title,
    authors: record.authors,
    publicationYear: record.publicationYear,
    publicationVenue: record.publicationVenue,
    publisher: record.publisher,
    workType: record.workType,
    stableLocators: [record.stableLocator],
    versionCaveat: record.updateRelations.length
      ? "Crossref reports deposited update relations; inspect the related records before using this work."
      : "Crossref reports no deposited update relation for this record; absence is not certification that the work is unchanged or unretracted.",
    updateOrRetraction: {
      retractedFlag: "not_checked",
      updateRelations: record.updateRelations,
    },
    access: {
      level: record.abstractText ? "abstract_inspected" : "metadata_only",
      abstractText: record.abstractText,
      abstractSource: record.abstractSource,
      reportedOpenLocations: [],
    },
    claimBoundary: record.abstractText
      ? "Only the Crossref member-deposited abstract was inspected. It may support a limited statement actually present there, not detailed methods, measures, estimates, or the complete mechanism."
      : "This is a bibliographic discovery lead. No scholarly text was inspected, so it cannot support a mechanism, theory attribution, measure, or empirical claim.",
  });
}

function mergeWork(
  left: StudyFirstScholarlyWork,
  right: StudyFirstScholarlyWork,
) {
  const preferred = (right.access.abstractText?.length ?? 0) >
      (left.access.abstractText?.length ?? 0)
    ? right
    : left;
  const {
    schemaVersion: _schemaVersion,
    workFingerprint: _workFingerprint,
    ...preferredBody
  } = structuredClone(preferred);
  return createStudyFirstScholarlyWork({
    ...preferredBody,
    id: left.id,
    providerIds: [...left.providerIds, ...right.providerIds].filter(
      (value, index, values) => values.findIndex((candidate) =>
        candidate.provider === value.provider &&
        candidate.nativeId === value.nativeId) === index,
    ),
    // Prefer one coherent bibliographic representation. Do not manufacture
    // an author list by unioning deposits that may describe different
    // manuscript versions.
    authors: preferred.authors,
    stableLocators: [...new Set([
      ...left.stableLocators,
      ...right.stableLocators,
    ])],
    versionCaveat: [left.versionCaveat, right.versionCaveat]
      .filter(Boolean).join(" ") || null,
    updateOrRetraction: {
      retractedFlag: [
          left.updateOrRetraction.retractedFlag,
          right.updateOrRetraction.retractedFlag,
        ].includes("flagged")
        ? "flagged"
        : [
            left.updateOrRetraction.retractedFlag,
            right.updateOrRetraction.retractedFlag,
          ].includes("not_flagged")
          ? "not_flagged"
          : "not_checked",
      updateRelations: [
        ...left.updateOrRetraction.updateRelations,
        ...right.updateOrRetraction.updateRelations,
      ].filter((value, index, values) => values.findIndex((candidate) =>
        candidate.relationType === value.relationType &&
        candidate.relatedDoi === value.relatedDoi &&
        candidate.label === value.label) === index),
    },
    access: {
      ...preferred.access,
      reportedOpenLocations: [
        ...left.access.reportedOpenLocations,
        ...right.access.reportedOpenLocations,
      ].filter((value, index, values) => values.findIndex((candidate) =>
        candidate.url === value.url) === index),
    },
  });
}

export async function executeStudyFirstMechanismDiscovery(input: {
  id: string;
  ordinal: number;
  previousRunId: string | null;
  context: StudyFirstEventContext;
  mechanismInput: StudyFirstMechanismInput;
  inputAssessment: StudyFirstMechanismRun["inputAssessment"];
  theoreticalProblem?: StudyFirstMechanismRun["theoreticalProblem"];
  planning?: StudyFirstMechanismRun["planning"];
  providerExecution?: StudyFirstMechanismRun["providerExecution"];
  mechanismPlan?: StudyFirstMechanismPlan | null;
  fetch: Screen02ConnectorFetch;
  openAlexApiKey?: string;
  now: () => string;
}) {
  const intentQueries = compileStudyFirstMechanismQueries(input);
  const queries = intentQueries.map(({ query }) => query);
  const createdAt = input.now();
  if (input.inputAssessment.status === "needs_clarification") {
    return createStudyFirstMechanismRun({
      id: input.id,
      ordinal: input.ordinal,
      previousRunId: input.previousRunId,
      context: input.context,
      input: input.mechanismInput,
      inputAssessment: input.inputAssessment,
      ...(input.theoreticalProblem
        ? { theoreticalProblem: input.theoreticalProblem }
        : {}),
      ...(input.planning ? { planning: input.planning } : {}),
      ...(input.providerExecution
        ? { providerExecution: input.providerExecution }
        : {}),
      searchPlan: {
        queries,
        providerQueryCeiling: 2,
        providerOperationCeiling: 4,
        intentQueries,
        metadataRecordCeiling: 10,
        abstractInspectionCeiling: 10,
        publicationWindowRule:
          "study_period_does_not_limit_scholarship_publication_year",
      },
      attempts: [],
      works: [],
      status: "needs_clarification",
      hostComparison: {
        status: "not_started",
        taskId: null,
        limitation:
          input.inputAssessment.clarification ??
          "The proposed mechanism needs a process statement.",
      },
      phases: {
        retrieval: "not_needed",
        textInspection: "not_needed",
        screening: "not_needed",
        synthesis: "not_needed",
        validation: "not_needed",
        presentation: "complete",
      },
      createdAt,
    });
  }

  const modelCitationPlan = input.mechanismPlan;
  const hasCompleteModelCitations = Boolean(
    modelCitationPlan?.focalSuggestedCitations?.length &&
    modelCitationPlan.candidates.every((candidate) =>
      candidate.suggestedCitations?.length),
  );
  if (hasCompleteModelCitations) {
    return createStudyFirstMechanismRun({
      id: input.id,
      ordinal: input.ordinal,
      previousRunId: input.previousRunId,
      context: input.context,
      input: input.mechanismInput,
      inputAssessment: input.inputAssessment,
      ...(input.theoreticalProblem
        ? { theoreticalProblem: input.theoreticalProblem }
        : {}),
      ...(input.planning ? { planning: input.planning } : {}),
      ...(input.providerExecution
        ? { providerExecution: input.providerExecution }
        : {}),
      searchPlan: {
        queries: [],
        providerQueryCeiling: 2,
        providerOperationCeiling: 4,
        intentQueries: [],
        metadataRecordCeiling: 10,
        abstractInspectionCeiling: 10,
        publicationWindowRule:
          "study_period_does_not_limit_scholarship_publication_year",
      },
      attempts: [],
      works: [],
      status: "completed_no_records",
      hostComparison: {
        status: "available_via_signed_host_task",
        taskId: null,
        limitation:
          "ChatGPT supplied one scholarly citation lead for the focal process and each proposed alternative. No OpenAlex or Crossref request was made. These citations are unverified research leads, not inspected evidence or proof of a complete pathway.",
      },
      phases: {
        retrieval: "not_needed",
        textInspection: "not_needed",
        screening: "not_needed",
        synthesis: "pending",
        validation: "pending",
        presentation: "complete",
      },
      createdAt,
    });
  }

  const operationLimits = [3, 3, 2, 2] as const;
  const operations = intentQueries.map((operation, index) =>
    operation.provider === "openalex"
      ? discoverOpenAlexLiteratureMetadata({
          fetch: input.fetch,
          apiKey: input.openAlexApiKey,
          query: operation.query,
          retrievedAt: createdAt,
          resultLimit: operationLimits[index] ?? 2,
          timeoutMs: 10_000,
        }).then((result) => ({ ...operation, result }))
      : discoverCrossrefLiteratureMetadata({
          fetch: input.fetch,
          query: operation.query,
          retrievedAt: createdAt,
          resultLimit: operationLimits[index] ?? 2,
          timeoutMs: 10_000,
        }).then((result) => ({ ...operation, result }))
  );
  const settled = await Promise.allSettled(operations);
  const results = settled.flatMap((item) =>
    item.status === "fulfilled" ? [item.value] : []);
  const attempts: StudyFirstMechanismSearchAttempt[] = settled.flatMap(
    (item, index) => item.status === "rejected" ? [{
      provider: intentQueries[index]!.provider,
      queryId: intentQueries[index]!.queryId,
      candidateIds: intentQueries[index]!.candidateIds,
      evidenceNeedIds: intentQueries[index]!.evidenceNeedIds,
      intent: intentQueries[index]!.intent,
      query: intentQueries[index]!.query,
      status: "failed" as const,
      requestUrl: null,
      recordsReceived: 0,
      recordsRetained: 0,
      retainedWorkIds: [],
      abstractsInspected: 0,
      failureReason: "request_construction_failed",
    }] : [],
  );
  const workByKey = new Map<string, StudyFirstScholarlyWork>();
  const workKeysByAttempt = new Map<string, string[]>();
  const attemptKey = (value: Pick<MechanismSearchIntent,
    "provider" | "queryId" | "query">) =>
    `${value.provider}:${value.queryId ?? value.query}`;
  for (const item of results) {
    const records = item.result.records;
    const diagnostics = item.result.diagnostics;
    const retainedKeys: string[] = [];
    for (const record of records) {
      const work = item.provider === "openalex"
        ? openAlexWork(record as OpenAlexLiteratureMetadata)
        : crossrefWork(record as CrossrefLiteratureMetadata);
      const key = workKey(work);
      retainedKeys.push(key);
      const existing = workByKey.get(key);
      workByKey.set(key, existing ? mergeWork(existing, work) : work);
    }
    workKeysByAttempt.set(attemptKey(item), [...new Set(retainedKeys)]);
    attempts.push({
      provider: item.provider,
      queryId: item.queryId,
      candidateIds: item.candidateIds,
      evidenceNeedIds: item.evidenceNeedIds,
      intent: item.intent,
      query: item.query,
      status: diagnostics.status === "searched" ? "completed" : "failed",
      requestUrl: diagnostics.requestUrl,
      recordsReceived: diagnostics.recordsReceived,
      recordsRetained: records.length,
      abstractsInspected: records.filter(({ abstractText }) =>
        abstractText !== null).length,
      failureReason: diagnostics.status === "failed"
        ? diagnostics.failureReason
        : null,
    });
  }
  const retainedWorkEntries = [...workByKey.entries()].sort((left, right) => {
    const access = left[1].access.level === right[1].access.level
      ? 0
      : left[1].access.level === "abstract_inspected" ? -1 : 1;
    return access || (right[1].publicationYear ?? 0) -
      (left[1].publicationYear ?? 0) || left[1].title.localeCompare(
        right[1].title);
  }).slice(0, 10);
  const workIdByKey = new Map(retainedWorkEntries.map(([key, work]) =>
    [key, work.id] as const));
  for (const attempt of attempts) {
    attempt.retainedWorkIds = (workKeysByAttempt.get(attemptKey(attempt)) ?? [])
      .flatMap((key) => workIdByKey.get(key) ?? []);
  }
  const works = retainedWorkEntries.map(([, work]) => work);
  const completed = attempts.filter(({ status }) => status === "completed");
  const failed = attempts.filter(({ status }) => status === "failed");
  const abstracts = works.filter(({ access }) =>
    access.level === "abstract_inspected");
  const status = completed.length === 0
    ? "retrieval_unavailable" as const
    : failed.length
      ? "retrieval_partial" as const
      : works.length === 0
        ? "completed_no_records" as const
        : abstracts.length
          ? "scholarly_evidence_ready" as const
          : "metadata_only" as const;
  return createStudyFirstMechanismRun({
    id: input.id,
    ordinal: input.ordinal,
    previousRunId: input.previousRunId,
    context: input.context,
    input: input.mechanismInput,
    inputAssessment: input.inputAssessment,
    ...(input.theoreticalProblem
      ? { theoreticalProblem: input.theoreticalProblem }
      : {}),
    ...(input.planning ? { planning: input.planning } : {}),
    ...(input.providerExecution
      ? { providerExecution: input.providerExecution }
      : {}),
    searchPlan: {
      queries,
      providerQueryCeiling: 2,
      providerOperationCeiling: 4,
      intentQueries,
      metadataRecordCeiling: 10,
      abstractInspectionCeiling: 10,
      publicationWindowRule:
        "study_period_does_not_limit_scholarship_publication_year",
    },
    attempts,
    works,
    status,
    hostComparison: {
      status: input.mechanismPlan
        ? "available_via_signed_host_task"
        : abstracts.length
          ? "available_via_signed_host_task"
          : "not_started",
      taskId: null,
      limitation: abstracts.length
        ? "Stage B can evaluate the saved theoretical problem and provisional plan against the inspected abstracts. Its output remains a conditional synthesis, not a researcher decision or causal estimate."
        : input.mechanismPlan
          ? "No scholarly abstract was inspected. Stage B may still present explicit analytical hypotheses, but it cannot attach detailed scholarly claims or imply that no-match evidence disproves a pathway."
          : "No scholarly abstract was inspected and no validated theoretical plan is attached.",
    },
    phases: {
      retrieval: completed.length === 0
        ? "failed"
        : failed.length
          ? "partial"
          : "complete",
      textInspection: abstracts.length
        ? abstracts.length === works.length
          ? "complete"
          : "partial"
        : completed.length
          ? "partial"
          : "failed",
      screening: completed.length
        ? failed.length
          ? "partial"
          : "complete"
        : "failed",
      synthesis: input.mechanismPlan || abstracts.length
        ? "pending"
        : "unavailable",
      validation: input.mechanismPlan || abstracts.length
        ? "pending"
        : "unavailable",
      presentation: "complete",
    },
    createdAt,
  });
}
