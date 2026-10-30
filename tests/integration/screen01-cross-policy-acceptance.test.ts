import { describe, expect, it } from "vitest";

import casesJson from
  "../fixtures/screen01-cross-policy-cases.v0.5.2.json";
import providerRecordingsJson from
  "../fixtures/screen01-provider-recordings.v0.5.2.json";
import {
  PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS,
} from "../../src/core/screen02-public-event-index";
import {
  normalizePolicyIdentityText,
} from "../../src/worker/screen01-identity-resolution";
import {
  SixScreenWorkflowRuntime,
} from "../../src/worker/six-screen-workflow-runtime";
import {
  InMemorySixScreenWorkflowStorage,
  SixScreenWorkflowStore,
} from "../../src/worker/six-screen-workflow-store";
import { SixScreenResearchTaskStore } from
  "../../src/worker/six-screen-research-task-store";
import { SixScreenEvidenceStore } from
  "../../src/worker/six-screen-evidence-store";

type CrossPolicyCase = {
  caseId: string;
  policyName: string;
  expectedTitle: string;
  sourceFamily:
    | "reviewed-state-legislation-record"
    | "federal-administrative-rule"
    | "uk-legislation"
    | "eu-instrument";
  subjectArea: string;
  baselineCatalogStatus: "present" | "absent";
  officialLocator: string;
  evidenceMode: string;
  verificationCohort: "development" | "verification";
  firstAttempt: "pass" | "fixture_harness_failure_then_pass";
};

const cases = casesJson as CrossPolicyCase[];

type ProviderRecord = ({
  caseId: string;
  provider: string;
  recordedAt: string;
  discoveryUrl: string;
  contentUrl: string;
  title: string;
  date: string;
  officialText: string;
} & ({
  kind: "federal";
  documentNumber: string;
  issuer: string;
} | {
  kind: "uk";
  type: string;
  year: string;
  number: string;
} | {
  kind: "eu";
  celex: string;
  legalType: string;
}));

const providerRecords = Object.fromEntries(
  (providerRecordingsJson as ProviderRecord[]).map((record) => [
    record.caseId,
    record,
  ]),
) as Record<string, ProviderRecord>;

const providerRecordings = Object.values(providerRecords);

// The reviewed Order 841 catalog entry is intentionally separate from the
// eight cold-start provider recordings frozen below.
const fixtureProviderRecords: ProviderRecord[] = [
  ...providerRecordings,
  {
    caseId: "ferc-order-841",
    kind: "federal",
    provider: "Federal Register",
    recordedAt: "2026-09-11T00:00:00.000Z",
    discoveryUrl:
      "https://www.federalregister.gov/api/v1/documents/2018-03708.json",
    contentUrl:
      "https://www.federalregister.gov/documents/2018/03/06/2018-03708/electric-storage-participation-in-markets-operated-by-regional-transmission-organizations-and",
    documentNumber: "2018-03708",
    title:
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
    date: "2018-03-06",
    issuer: "Federal Energy Regulatory Commission",
    officialText:
      "FERC Order 841, 83 FR 9580 and FR Doc. 2018-03708, was published on 2018-03-06 and became effective on 2018-06-04. The Federal Energy Regulatory Commission requires regional transmission organizations and independent system operators to establish wholesale-market participation models for electric storage resources and their owners.",
  },
];

function locatorRecord(url: string): ProviderRecord | null {
  return fixtureProviderRecords.find((record) =>
    (record.kind === "federal" && url.includes(record.documentNumber)) ||
    (record.kind === "eu" && url.includes(record.celex)) ||
    (record.kind === "uk" && url.includes(
      `/${record.type}/${record.year}/${record.number}`,
    ))
  ) ?? null;
}

function queryRecord(url: string): ProviderRecord | null {
  const direct = locatorRecord(url);
  if (direct) return direct;
  const decoded = decodeURIComponent(url).replaceAll("+", " ")
    .toLocaleLowerCase("en-US");
  const entries = Object.entries(providerRecords);
  const exact = entries.find(([caseId, record]) => {
    const policy = cases.find((value) => value.caseId === caseId)!;
    return decoded.includes(policy.policyName.toLocaleLowerCase("en-US")) ||
      decoded.includes(record.title.toLocaleLowerCase("en-US")) ||
      (record.kind === "federal" && decoded.includes(record.documentNumber)) ||
      (record.kind === "eu" &&
        decoded.includes(record.celex.toLocaleLowerCase("en-US"))) ||
      (record.kind === "uk" && decoded.includes(
        `/${record.type}/${record.year}/${record.number}`,
      ));
  });
  if (exact) return exact[1];
  const normalizedRequest = normalizePolicyIdentityText(decoded);
  const ranked = entries.map(([caseId, record]) => {
    const policy = cases.find((value) => value.caseId === caseId)!;
    const terms = normalizePolicyIdentityText(policy.policyName).split(" ")
      .filter((value) => value.length > 3);
    const matches = terms.filter((term) =>
      normalizedRequest.includes(term)
    ).length;
    return { record, matches, total: terms.length };
  }).filter(({ matches, total }) =>
    total > 0 && matches >= Math.ceil(total * 0.6)
  ).sort((left, right) =>
    right.matches / right.total - left.matches / left.total ||
    right.matches - left.matches
  );
  return ranked[0]?.record ?? null;
}

function fixtureFetch() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/v1/documents")) {
      const record = queryRecord(url);
      const results = record?.kind === "federal" ? [{
        document_number: record.documentNumber,
        title: record.title,
        type: "Rule",
        abstract: record.officialText,
        action: "Final rule.",
        excerpts: [record.officialText],
        html_url:
          `https://www.federalregister.gov/documents/${record.date.replaceAll("-", "/")}/${record.documentNumber}/record`,
        raw_text_url:
          `https://www.federalregister.gov/documents/full_text/html/${record.date.replaceAll("-", "/")}/${record.documentNumber}.html`,
        body_html_url:
          `https://www.federalregister.gov/documents/full_text/html/${record.date.replaceAll("-", "/")}/${record.documentNumber}.html`,
        publication_date: record.date,
        effective_on: `${Number(record.date.slice(0, 4)) + 1}-01-01`,
        agencies: [{ name: record.issuer }],
      }] : [];
      const exactDocumentRequest =
        /\/api\/v1\/documents\/[^/?]+\.json(?:[?#]|$)/.test(url);
      if (exactDocumentRequest) {
        return new Response(JSON.stringify(results[0] ?? {}), {
          status: results.length === 1 ? 200 : 404,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ count: results.length, results }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("legislation.gov.uk") && url.includes("/data.feed")) {
      const record = queryRecord(url);
      const entry = record?.kind === "uk"
        ? `<entry><id>https://www.legislation.gov.uk/id/${record.type}/${record.year}/${record.number}</id><title>${record.title}</title><ukm:EnactmentDate Date="${record.date}"/><link rel="alternate" href="https://www.legislation.gov.uk/${record.type}/${record.year}/${record.number}"/></entry>`
        : "";
      return new Response(
        `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:ukm="http://www.legislation.gov.uk/namespaces/metadata">${entry}</feed>`,
        { status: 200, headers: { "content-type": "application/atom+xml" } },
      );
    }
    if (url.includes("publications.europa.eu")) {
      const record = queryRecord(url);
      const bindings = record?.kind === "eu" ? [{
        celex: { value: record.celex },
        title: { value: record.title },
        date: { value: record.date },
        type: {
          value:
            `http://publications.europa.eu/resource/authority/resource-type/${record.legalType}`,
        },
      }] : [];
      return new Response(JSON.stringify({ results: { bindings } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const record = locatorRecord(url) ?? queryRecord(url);
    const title = record?.title ?? "Official policy record";
    const identifier = record?.kind === "federal"
      ? `Federal Register document ${record.documentNumber}. [FR Doc. ${record.documentNumber} Filed 11-01-20; 8:45 am]`
      : record?.kind === "eu"
        ? `CELEX ${record.celex}.`
        : "";
    const body = `<main><h1>${title}</h1><p>${identifier} ${record?.officialText ?? "No recorded official text was available."}</p></main>`;
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": url.includes("/data.xml")
          ? "application/xml"
          : "text/html",
      },
    });
  };
}

function runtime() {
  const storage = new InMemorySixScreenWorkflowStorage();
  let tick = 0;
  const now = () => new Date(
    Date.parse("2026-09-16T12:00:00.000Z") + tick++ * 1_000,
  ).toISOString();
  return new SixScreenWorkflowRuntime({
    store: new SixScreenWorkflowStore(storage),
    taskStore: new SixScreenResearchTaskStore(storage),
    evidenceStore: new SixScreenEvidenceStore(storage),
    signingKey: "cross-policy-test-signing-key-with-more-than-thirty-two-chars",
    now,
    fetch: fixtureFetch(),
    monotonicNow: (() => {
      let value = 0;
      return () => (value += 3);
    })(),
  });
}

const blankStudy = {
  population: null,
  analysisUnit: null,
  geography: [],
  industry: [],
  period: { start: null, end: null },
  outcome: null,
  outcomeMeasure: null,
  intendedConstruct: null,
  policySideConcept: null,
  initialExplanation: null,
  proposedTreatment: null,
  proposedComparison: null,
  resultsPreviouslyInspected: "not_disclosed" as const,
};

async function completeHandoff(
  policy: CrossPolicyCase,
  mode: "name-only" | "supplied-source",
) {
  const target = runtime();
  const suffix = `${policy.caseId}-${mode}`;
  const created = await target.create({
    operationId: `create-${suffix}`,
    shockInput: policy.policyName,
    study: blankStudy,
    ...(mode === "supplied-source"
      ? { officialSourceLocators: [policy.officialLocator] }
      : {}),
  });
  const auth = {
    runId: created.privateSnapshot.runId,
    accessToken: created.privateSnapshot.accessToken,
  };
  const resolved = await target.resolveShock(auth, {
    expectedRevision: 0,
    operationId: `resolve-${suffix}`,
  });
  expect(
    resolved.resolution.status,
    `${suffix}: ${JSON.stringify(resolved.resolution)}`,
  ).toBe("resolved");
  const candidate = resolved.projection.candidates.find(({ officialTitle }) => {
    const actual = normalizePolicyIdentityText(officialTitle);
    const expected = normalizePolicyIdentityText(policy.expectedTitle);
    return actual === expected || actual.includes(expected) ||
      expected.includes(actual);
  });
  expect(candidate, `${suffix}: exact candidate`).toBeDefined();
  expect(candidate!.identitySources.some((source) =>
    source.accessStatus === "retained_passage" &&
    source.inspectedText !== "metadata_only" &&
    Boolean(source.contentHash)
  ), `${suffix}: retained source`).toBe(true);
  const expectedRouteId = policy.baselineCatalogStatus === "present"
    ? "reviewed_official_document"
    : policy.sourceFamily === "federal-administrative-rule"
      ? "exact_federal_register_document"
      : policy.sourceFamily === "uk-legislation"
        ? "uk_legislation_document"
        : "eu_legal_document";
  expect(candidate!.identitySources.some(({ routeId }) =>
    routeId === expectedRouteId
  ), `${suffix}: ${expectedRouteId} lineage`).toBe(true);
  expect(candidate!.displayedDescription.length, suffix).toBeGreaterThan(40);
  let snapshot = resolved.privateSnapshot;
  if (snapshot.state.displayedCandidateId !== candidate!.id) {
    const displayed = await target.displayCandidate(auth, {
      expectedRevision: snapshot.revision,
      operationId: `display-${suffix}`,
      candidateId: candidate!.id,
    });
    snapshot = displayed.privateSnapshot;
  }
  const confirmed = await target.confirmShock(auth, {
    expectedRevision: snapshot.revision,
    operationId: `confirm-${suffix}`,
    candidateId: candidate!.id,
    displayedIdentityFingerprint: candidate!.identityFingerprint,
    sourceSnapshotId: candidate!.sourceSnapshotId,
    sourceSnapshotFingerprint: candidate!.sourceSnapshotFingerprint,
    originalRequestFingerprint: snapshot.state.originalRequestFingerprint,
    currentRequestFingerprint: snapshot.state.currentRequestFingerprint,
    identityRevision: snapshot.state.identityRevision,
  });
  expect(confirmed.privateSnapshot.state.confirmedShock).toMatchObject({
    id: candidate!.id,
    identityFingerprint: candidate!.identityFingerprint,
    confirmation: { actor: "researcher" },
  });
  const opened = await target.openScreen2(auth, {
    expectedRevision: confirmed.privateSnapshot.revision,
    operationId: `open-screen2-${suffix}`,
  });
  const researched = await target.researchPolicy(auth, {
    expectedRevision: opened.privateSnapshot.revision,
    operationId: `research-screen2-${suffix}`,
  });
  expect(
    ["partial", "ready"],
    `${suffix}: ${JSON.stringify(researched.review)}`,
  ).toContain(researched.review.status);
  expect(researched.review.sourceCount, suffix).toBeGreaterThan(0);
  expect(researched.review.passageCount, suffix).toBeGreaterThan(0);
  const restored = await target.status(auth);
  expect(restored.privateSnapshot.state.confirmedShock?.identityFingerprint)
    .toBe(candidate!.identityFingerprint);
  expect(restored.projection.activeScreen).toBe(2);
}

describe("Screen 1 frozen cross-policy acceptance", () => {
  it("freezes twelve distinct identities, six untuned cases, and eight baseline misses outside production catalogs", () => {
    expect(cases).toHaveLength(12);
    expect(new Set(cases.map(({ policyName }) => policyName)).size).toBe(12);
    expect(new Set(cases.map(({ subjectArea }) => subjectArea)).size)
      .toBeGreaterThanOrEqual(4);
    expect(cases.filter(({ verificationCohort }) =>
      verificationCohort === "verification"
    )).toHaveLength(6);
    expect(cases.filter(({ baselineCatalogStatus }) =>
      baselineCatalogStatus === "absent"
    ).length).toBeGreaterThanOrEqual(6);
    const indexedNames = PUBLIC_SCREEN02_EVENT_INDEX_PROPOSALS.flatMap(
      (proposal) => [proposal.title, proposal.event.displayName],
    ).map(normalizePolicyIdentityText);
    for (const policy of cases) {
      const present = indexedNames.some((name) =>
        name.includes(normalizePolicyIdentityText(policy.policyName)) ||
        normalizePolicyIdentityText(policy.policyName).includes(name)
      );
      expect(present, policy.caseId).toBe(
        policy.baselineCatalogStatus === "present",
      );
    }
  });

  it("keeps the eight cold-start provider recordings test-only, source-attributed, and bounded", () => {
    expect(providerRecordings).toHaveLength(8);
    expect(new Set(providerRecordings.map(({ caseId }) => caseId)).size).toBe(8);
    for (const recording of providerRecordings) {
      expect(cases.find(({ caseId }) => caseId === recording.caseId))
        .toMatchObject({ baselineCatalogStatus: "absent" });
      expect(recording.provider.length).toBeGreaterThan(3);
      expect(recording.recordedAt).toBe("2026-09-16T14:30:00.000Z");
      expect(new URL(recording.discoveryUrl).protocol).toBe("https:");
      expect(new URL(recording.contentUrl).protocol).toBe("https:");
      expect(recording.officialText.length).toBeGreaterThan(80);
    }
  });

  it.each(cases)(
    "$caseId completes name-only selection, explicit confirmation, Screen 2 evidence, and restoration",
    async (policy) => completeHandoff(policy, "name-only"),
    20_000,
  );

  it.each(cases)(
    "$caseId binds the supplied official source to the same identity and handoff",
    async (policy) => completeHandoff(policy, "supplied-source"),
    20_000,
  );

  it("preserves exact whitespace while matching a separate normalized representation", async () => {
    const target = runtime();
    const original = "  California Consumer Privacy Act   ";
    const created = await target.create({
      operationId: "create-whitespace-regression",
      shockInput: original,
      study: blankStudy,
    });
    const resolved = await target.resolveShock({
      runId: created.privateSnapshot.runId,
      accessToken: created.privateSnapshot.accessToken,
    }, {
      expectedRevision: created.privateSnapshot.revision,
      operationId: "resolve-whitespace-regression",
    });
    expect(resolved.privateSnapshot.state.originalShockInput).toBe(original);
    expect(resolved.privateSnapshot.state.currentShockInput).toBe(original);
    expect(resolved.projection.originalShockInput).toBe(original);
    expect(resolved.projection.candidates[0]?.officialTitle).toBe(
      "California Consumer Privacy Act",
    );
  });

  it("isolates two policy runs so a later result cannot replace another identity", async () => {
    const target = runtime();
    const [ccpa, procurement] = await Promise.all([
      target.create({
        operationId: "create-isolated-ccpa",
        shockInput: "California Consumer Privacy Act",
        study: { ...blankStudy, outcome: "Privacy complaints" },
      }),
      target.create({
        operationId: "create-isolated-procurement",
        shockInput: "Procurement Act 2023",
        study: { ...blankStudy, outcome: "Bid participation" },
      }),
    ]);
    expect(ccpa.privateSnapshot.runId).not.toBe(
      procurement.privateSnapshot.runId,
    );
    const [ccpaResolved, procurementResolved] = await Promise.all([
      target.resolveShock({
        runId: ccpa.privateSnapshot.runId,
        accessToken: ccpa.privateSnapshot.accessToken,
      }, {
        expectedRevision: ccpa.privateSnapshot.revision,
        operationId: "resolve-isolated-ccpa",
      }),
      target.resolveShock({
        runId: procurement.privateSnapshot.runId,
        accessToken: procurement.privateSnapshot.accessToken,
      }, {
        expectedRevision: procurement.privateSnapshot.revision,
        operationId: "resolve-isolated-procurement",
      }),
    ]);
    expect(ccpaResolved.projection.candidates[0]?.officialTitle).toBe(
      "California Consumer Privacy Act",
    );
    expect(procurementResolved.projection.candidates[0]?.officialTitle).toBe(
      "Procurement Act 2023",
    );
    expect(ccpaResolved.privateSnapshot.state.study.outcome).toBe(
      "Privacy complaints",
    );
    expect(procurementResolved.privateSnapshot.state.study.outcome).toBe(
      "Bid participation",
    );
    const procurementAfter = await target.status({
      runId: procurement.privateSnapshot.runId,
      accessToken: procurement.privateSnapshot.accessToken,
    });
    expect(procurementAfter.privateSnapshot.state.confirmedShock).toBeNull();
    expect(procurementAfter.projection.candidates[0]?.officialTitle).toBe(
      "Procurement Act 2023",
    );
  });
});
