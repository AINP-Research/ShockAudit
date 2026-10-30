import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import type { Server } from "node:http";
import { resolve } from "node:path";
import {
  expect,
  test,
  type FrameLocator,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import {
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
  SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
  SCREEN_02_WORKFLOW_CREATE_TOOL_V024,
  SCREEN_02_WORKFLOW_CORRELATION_META_KEY,
  SCREEN_02_WORKFLOW_META_KEY,
  SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX,
  restoreScreen02WorkflowClientSnapshot,
  stateFromScreen02WorkflowClientSnapshot,
  type Screen02WorkflowClientSnapshot,
} from "../../src/core/screen02-workflow-client";
import {
  SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES,
  deriveScreen02FindComparison,
} from "../../src/core/screen02-find-workflow";
import {
  screen02AssessmentUnavailableScreen03Checks,
  type Screen02WorkflowState,
} from "../../src/core/screen02-workflow-types";
import {
  SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
  SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
} from "../../src/core/screen03-workflow-client";
import {
  attachScreen03BriefingLifecycle,
  fingerprintScreen03Value,
  screen03FactualClaims,
  screen03ProposalConfirmability,
  type Screen03VerificationState,
} from "../../src/core/screen03-workflow";
import {
  SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036,
  SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036,
  SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
  SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
} from "../../src/core/screen01-host-draft-client";
import {
  SCREEN_03_HOST_DRAFT_BATCH_SCHEMA_VERSION,
  SCREEN_03_HOST_DRAFT_DEFAULT_CAPABILITY_TTL_MS,
  SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036,
  SCREEN_03_HOST_DRAFT_SAMPLING_OUTPUT_TOOL,
  SCREEN_03_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
  SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
} from "../../src/core/screen03-host-draft-client";
import {
  decryptScreen03VerificationState,
  type Screen03SealedResultKind,
} from "../../src/core/screen03-sealed-result";
import {
  screen02SealedResultBase64UrlToBytes,
  type Screen02ResponseKeyMaterial,
} from "../../src/core/screen02-sealed-result";
import {
  SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
} from "../../src/worker/screen02-audit-assessment-security";
import {
  SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
} from "../../src/worker/screen02-find-assessment-security";
import {
  SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
  SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
} from "../../src/worker/screen02-workflow-controller";
import {
  GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
  HOST_REASONING_META_KEY,
} from "../../src/ui/host-task/host-task-client";
import { SCREEN_02_WORKFLOW_WIDGET_SCHEMA_VERSION } from
  "../../src/ui/mcp-bridge";
import {
  confirmedWorkflowAuditContext,
  confirmedWorkflowFindContext,
} from "../core/screen02-workflow-fixtures";
import {
  callMcpTool,
  installMcpAppHost,
  type HostModelRequest,
  type HostModelToolCall,
  type HostSamplingRequest,
  type JsonObject,
  type McpCallToolResult,
} from "./mcp-app-host";
import {
  SCREEN02_BROWSER_CLIENT_NOW_ISO,
  SCREEN02_BROWSER_FIXTURE_NOW_ISO,
} from "./fixture-clock";
import { startNodeFixtureServer } from "./node-fixture-server";

const OFFICIAL_TRANSPORT_PROBE_PATH =
  "/__browser-fixture/official-transport-probe";
const OFFICIAL_TRANSPORT_PROBE_UPSTREAM_URL =
  "https://www.legislation.gov.uk/all/2023/data.feed?title=Procurement%20Act%202023";

const baseUrl =
  process.env.SHOCKAUDIT_BROWSER_BASE_URL ??
  "http://127.0.0.1:8791";
const screen02BrowserClientClockLeadMs =
  Date.parse(SCREEN02_BROWSER_CLIENT_NOW_ISO) -
  Date.parse(SCREEN02_BROWSER_FIXTURE_NOW_ISO);

function accelerateScreen03CapabilityDeadline(input: {
  deadlineMs: number;
  clientClockLeadMs: number;
}) {
  const nativeSetTimeout = window.setTimeout.bind(window);
  const signedRemainingTimeFloor = Math.max(
    1,
    input.deadlineMs - input.clientClockLeadMs - 10_000,
  );
  const acceleratedSetTimeout = (
    handler: Parameters<typeof window.setTimeout>[0],
    delay?: number,
    ...args: unknown[]
  ) =>
    nativeSetTimeout(
      handler,
      typeof delay === "number" &&
          delay <= input.deadlineMs &&
          delay >= signedRemainingTimeFloor
        ? 3_000
        : delay,
      ...args,
    );
  Object.defineProperty(window, "setTimeout", {
    configurable: true,
    writable: true,
    value: acceleratedSetTimeout,
  });
}

const workflowActionTool = "mutate_screen02_workflow_v021";
const currentWorkflowActionTool = SCREEN_02_WORKFLOW_ACTION_TOOL_V024;
const currentWorkflowCreateTool = SCREEN_02_WORKFLOW_CREATE_TOOL_V024;
const screen03HostMessageTaskSchemaVersion =
  "screen-03-host-message-task-v1" as const;
const browserWorkflowActionTools = new Set([
  workflowActionTool,
  currentWorkflowActionTool,
]);
let canonicalOpenSequence = 0;
let nodeFixtureServer: Server | null = null;
const wcagTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

type BrowserIssues = {
  consoleErrors: string[];
  pageErrors: string[];
};

type CapturedToolCall = {
  name?: string;
  arguments?: JsonObject;
};

type ServerToolResult = {
  name: string;
  arguments: JsonObject;
  result: McpCallToolResult;
};

type SubmittedAssessment = {
  arguments: JsonObject;
  request: JsonObject;
  result: McpCallToolResult;
};

function confirmedWorkflowGdprAuditContext(): ReturnType<
  typeof confirmedWorkflowAuditContext
> {
  const baseline = confirmedWorkflowAuditContext();
  const studySentence =
    "Audit whether GDPR affected innovation among U.S. firms from 2015 to 2023.";
  return {
    ...baseline,
    studySentence,
    contractSourceSentence: studySentence,
    knownShock: "GDPR",
    scopeContract: {
      ...baseline.scopeContract,
      population: "U.S. firms",
      geography: "United States",
      industry: "All industries",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Annual",
    },
  };
}

type AutomaticHostReasoningOptions = {
  screen01?: boolean;
  screen02?: boolean;
  screen02FindPlanningOnly?: boolean;
  screen03?: boolean;
  screen03StudyRelevance?: "full" | "omit";
  screen03ClaimHelp?: "full" | "partial" | "empty";
};

function record(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return value as JsonObject;
}

function optionalRecord(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function screen03TaskFromBatch(batch: JsonObject) {
  const sourcePacket = optionalRecord(batch.sourcePacket);
  const containers = [
    optionalRecord(sourcePacket?.request),
    optionalRecord(batch.task),
    optionalRecord(batch.modelContext),
    optionalRecord(sourcePacket?.modelContext),
    optionalRecord(batch.request),
  ].filter((candidate): candidate is JsonObject => candidate !== null);
  const detailed = containers.find((candidate) =>
    Array.isArray(candidate.proposals) && candidate.proposals.length > 0
  );
  const compact = containers.find((candidate) =>
    Array.isArray(candidate.claims) && candidate.claims.length > 0
  );
  const task = detailed ?? compact;
  if (!task) {
    throw new Error("The Screen 3 host batch has no compact or detailed task.");
  }
  const event = optionalRecord(task.event) ?? optionalRecord(batch.event);
  const study = optionalRecord(task.studyContext) ??
    optionalRecord(task.study) ?? optionalRecord(batch.studyContext);
  if (!event || !study) {
    throw new Error("The Screen 3 host task omitted its event or study context.");
  }
  const rawProposals = Array.isArray(task.proposals)
    ? task.proposals
    : Array.isArray(task.claims)
      ? task.claims
      : [];
  const proposals: JsonObject[] = rawProposals.map((value, index): JsonObject => {
    const candidate = record(value, `Screen 3 host claim ${index + 1}`);
    const proposalId = candidate.proposalId;
    const claim = candidate.value ?? candidate.claim;
    if (
      typeof proposalId !== "string" || proposalId.length === 0 ||
      typeof claim !== "string" || claim.length === 0
    ) {
      throw new Error(`Screen 3 host claim ${index + 1} is incomplete.`);
    }
    return {
      ...candidate,
      proposalId,
      label: typeof candidate.label === "string" && candidate.label.length > 0
        ? candidate.label
        : "Event claim",
      value: claim,
    };
  });
  if (proposals.length === 0) {
    throw new Error("The Screen 3 host task has no bounded claim.");
  }
  return { event, study, proposals, sourcePacket };
}

function stringList(value: unknown, label: string) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`Expected ${label} to be a string array.`);
  }
  return value as string[];
}

function screen03HostSubmission(
  serverToolResults: ServerToolResult[],
) {
  const submissions = serverToolResults.filter(
    (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
  );
  if (submissions.length !== 1 || !submissions[0]) {
    throw new Error(
      `Expected one Screen 3 host submission, received ${submissions.length}.`,
    );
  }
  const sourcePacket = optionalRecord(submissions[0].arguments.sourcePacket);
  const prepared = [...serverToolResults].reverse().find(
    (entry) => entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036,
  );
  const batch = sourcePacket
    ? { sourcePacket }
    : prepared?.result.structuredContent;
  const requestedProposalIds = screen03TaskFromBatch(
    record(batch, "Screen 3 prepared host batch"),
  ).proposals.map((proposal, index) => {
    const proposalId = proposal.proposalId;
    if (typeof proposalId !== "string" || proposalId.length === 0) {
      throw new Error(
        `Screen 3 host proposal ${index + 1} has no proposalId.`,
      );
    }
    return proposalId;
  });
  if (new Set(requestedProposalIds).size !== requestedProposalIds.length) {
    throw new Error("The Screen 3 host request contains duplicate proposals.");
  }
  return {
    submission: submissions[0],
    requestedProposalIds,
  };
}

function assessmentBatchRequests(snapshot: Screen02WorkflowClientSnapshot) {
  const batch = snapshot.assessmentBatch;
  if (!batch) throw new Error("Expected an active assessment batch.");
  const requests = record(batch.modelContext, "assessment model context")
    .requests;
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error("Expected at least one bounded assessment request.");
  }
  return requests.map((request, index) =>
    record(request, `assessment request ${index + 1}`),
  );
}

function assessmentRequestId(request: JsonObject) {
  if (typeof request.requestId === "string") return request.requestId;
  const sourcePacket = record(
    request.sourcePacket,
    "assessment source packet",
  );
  if (typeof sourcePacket.requestId !== "string") {
    throw new Error("The bounded assessment request has no request ID.");
  }
  return sourcePacket.requestId;
}

function evidenceSourceIdsFromFindRequest(request: JsonObject) {
  const candidate = record(request.candidate, "Find candidate packet");
  const sourceIds = stringList(
    candidate.sourceIds,
    "Find candidate source IDs",
  );
  if (sourceIds.length === 0) {
    throw new Error("A Find assessment needs at least one bounded source ID.");
  }
  return sourceIds;
}

function findDraftForRequest(
  request: JsonObject,
  options?: { invalidMainConcern?: boolean },
  modelContext?: JsonObject,
) {
  if (request.mode === "find-discovery-plan") {
    const study = modelContext && typeof modelContext.study === "object"
      ? record(modelContext.study, "Find planning study")
      : {};
    const studyText = Object.values(study).join(" ");
    return /electricity|northern europe|nordic/i.test(studyText)
      ? {
          queryTerms: [
            "electricity market reform Northern Europe",
            "official electricity market regulation profitability",
          ],
          rationale:
            "These bounded phrases add regional and sector vocabulary to the supported official-source search without asserting an event fact or ranking.",
        }
      : {
          queryTerms: [
            "California consumer privacy business thresholds",
            "consumer data privacy regulation technology firms",
          ],
          rationale:
            "These bounded phrases add privacy, jurisdiction, and business-coverage vocabulary to the supported official-source search without asserting an event fact or ranking.",
        };
  }
  const sourceIds = evidenceSourceIdsFromFindRequest(request);
  if (request.mode === "find-criterion") {
    const criterion = record(request.criterion, "Find criterion packet");
    return {
      result:
        criterion.kind === "do-not-show"
          ? "does-not-violate"
          : "meets",
      reason:
        "The bounded source record supports this preliminary criterion result while later verification remains necessary.",
      evidenceSourceIds: sourceIds,
    };
  }
  const requestedPartIds = stringList(
    request.requestedPartIds,
    "Find requested part IDs",
  );
  const candidate = record(request.candidate, "Find candidate packet");
  if (typeof candidate.title !== "string") {
    throw new Error("A Find candidate assessment needs its immutable title.");
  }
  const candidateTitle = candidate.title;
  const electricity = /electricity|energy market/i.test(candidateTitle);
  const ccpa = /california consumer privacy act|ccpa/i.test(candidateTitle);
  const parts: JsonObject = {
    studyFit: {
      category: "strong",
      explanation:
        electricity
          ? `${candidateTitle}'s official record falls inside the confirmed 2021–2024 period for electricity firms in Northern Europe, while organization-level coverage remains unresolved.`
          : ccpa
            ? `${candidateTitle}'s June 28, 2018 enactment and January 1, 2020 operative date fall inside the confirmed 2017–2023 period for U.S. publicly listed technology firms. Historical AB 375 coverage required California business nexus plus at least one threshold: annual gross revenue over $25 million; personal information volume of 50,000 or more consumers, households, or devices; or 50 percent or more annual revenue from selling consumers' personal information. Personal-information activity and exemptions still require firm-level verification.`
          : `${candidateTitle}'s bounded record provides an early fit with the confirmed period and population while formal coverage remains unresolved.`,
      evidenceSourceIds: sourceIds,
    },
    outcomePathway: {
      category: "plausible",
      explanation:
        electricity
          ? "The electricity-market duties may reshape contracting, supply, and compliance pathways connected to the profitability outcome, without establishing an effect direction."
          : ccpa
            ? "For Profitability, the CCPA's privacy rights and compliance duties create plausible mechanisms through compliance, technology, and data-governance costs; limits or redesigns affecting data-enabled products, advertising, or data sales; fines, litigation, and other legal exposure; and possible trust, retention, or loss-avoidance benefits. These are hypotheses to investigate, not an observed or established causal effect; direction and magnitude remain unknown."
          : "The documented duties may redirect compliance and product work connected to the confirmed outcome family.",
      evidenceSourceIds: sourceIds,
    },
    measurementPotential: {
      category: "possible",
      explanation:
        electricity
          ? "Official identifiers, document dates, and electricity-market roles could support exposure indicators, but national implementation and firm linkage still require verification."
          : ccpa
            ? "Dated official CCPA records could anchor event timing, while California business nexus, historical statutory threshold fields, personal-information activity, and applicable exemptions are still needed to classify organization-level exposure."
          : "The public record suggests observable exposure indicators, although organization-level classification still requires verification.",
      evidenceSourceIds: sourceIds,
    },
    mainConcern: options?.invalidMainConcern
      ? "Too short."
      : electricity
        ? "EU-level and UK records do not establish comparable coverage across every Northern European country or individual electricity firm."
        : ccpa
          ? "U.S. publicly listed technology firms are not uniformly covered because CCPA applicability depends on California nexus, historical thresholds, personal-information activity, and exemptions."
        : "The confirmed population is broader than organizations demonstrably covered by the current source packet.",
    nextChecks: ccpa
      ? [
          "Verify each firm's California business nexus, historical threshold status, personal-information activity, and exemption status before constructing CCPA exposure.",
          "Keep the 2018 enactment, 2020 operative date, and later implementation or enforcement milestones separate.",
        ]
      : [
          "Verify historical organization-level coverage before constructing the exposure measure.",
        ],
  };
  return Object.fromEntries(
    requestedPartIds.map((partId) => [partId, parts[partId]]),
  );
}

function evidenceSourceIdFromAuditRequest(request: JsonObject) {
  const sourcePacket = record(request.sourcePacket, "Audit source packet");
  const sources = sourcePacket.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("An Audit assessment needs a bounded source packet.");
  }
  const source = record(sources[0], "Audit source");
  if (typeof source.id !== "string") {
    throw new Error("The bounded Audit source has no ID.");
  }
  return source.id;
}

function auditDraftForRequest(request: JsonObject) {
  const sourceId = evidenceSourceIdFromAuditRequest(request);
  const requestedPartIds = stringList(
    record(request.draftContract, "Audit draft contract").requestedPartIds,
    "Audit requested part IDs",
  );
  const claim = (text: string) => ({
    text,
    evidenceSourceIds: [sourceId],
    uncertainty:
      "Screen 3 must verify the operative details and study relevance.",
  });
  const parts: JsonObject =
    record(request.sourcePacket, "Audit source packet").mode ===
    "audit-dossier"
      ? {
          atAGlance: [
            claim(
              "The possible match is the California Consumer Privacy Act of 2018, commonly called the CCPA.",
            ),
          ],
          whatHappened: claim(
            "California enacted a consumer privacy statute that created rights and duties for covered businesses.",
          ),
          whatChanged: [],
          timeline: [
            {
              date: "2018-06-28",
              label: "CCPA enactment date",
              stage: "enactment",
              evidenceSourceIds: [sourceId],
              uncertainty:
                "Screen 3 must distinguish enactment from the later operative, implementation, and enforcement clocks.",
            },
          ],
          broadCoverage: [],
          keyComponents: [],
          relatedVersions: [],
          unresolvedFacts: [
            "Evidence gap — whatChanged: The bounded source does not establish a change summary.",
            "Evidence gap — timeline: The bounded source does not establish a complete event timeline.",
            "Evidence gap — broadCoverage: The bounded source does not establish historical organization-level coverage.",
            "Evidence gap — keyComponents: The bounded source does not establish a component inventory.",
            "Evidence gap — relatedVersions: The bounded source does not establish related version identities.",
            "The focal event stage and organization-level historical coverage remain unresolved.",
          ],
        }
      : {
          studyFit: {
            category: "strong",
            explanation:
              "The source-backed date leads fall inside the confirmed study period and the statute may reach the study population.",
            evidenceSourceIds: [sourceId],
          },
          outcomePathway: {
            category: "plausible",
            explanation:
              "Privacy duties may redirect compliance and product work connected to the confirmed outcome family.",
            evidenceSourceIds: [sourceId],
          },
          coverageRelation: {
            category: "mixed",
            explanation:
              "The confirmed population is broader than the historically covered businesses in the bounded packet.",
            evidenceSourceIds: [sourceId],
          },
          measurementPotential: {
            category: "difficult",
            explanation:
              "Public disclosures may support exposure indicators, although organization-level California activity may be incomplete.",
            evidenceSourceIds: [sourceId],
          },
          mainConcern:
            "Different event stages and related amendments could be collapsed without later fixed verification.",
          nextChecks: [
            "Verify the focal statutory version and event clock before constructing exposure.",
          ],
        };
  return Object.fromEntries(
    requestedPartIds.map((partId) => [partId, parts[partId]]),
  );
}

function labelledScreen03Proposal(proposal: JsonObject) {
  return `${String(proposal.label)}: ${String(proposal.value)}`;
}

function screen03ProposalSupportText(proposal: JsonObject) {
  const evidence = Array.isArray(proposal.evidence)
    ? proposal.evidence.filter((item): item is string => typeof item === "string")
    : [];
  return [labelledScreen03Proposal(proposal), ...evidence].join("\n");
}

function groundedScreen03FixtureText(
  proposal: JsonObject,
  prefix: string,
  maximum: number,
) {
  const stopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "but",
    "by", "for", "from", "has", "have", "in", "is", "it", "its", "of",
    "on", "or", "that", "the", "their", "this", "to", "was", "were",
    "which", "with",
  ]);
  const summaryTerms = (String(proposal.value)
    .normalize("NFKC")
    .match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length >= 3 || /^\d+$/u.test(word))
    .filter((word) => !stopWords.has(word.toLocaleLowerCase("en-US")))
    .filter((word, index, words) =>
      words.findIndex((candidate) =>
        candidate.toLocaleLowerCase("en-US") ===
          word.toLocaleLowerCase("en-US")
      ) === index
    )
    .slice(0, 12);
  const reorderedTerms = [
    ...summaryTerms.filter((_, index) => index % 2 === 0),
    ...summaryTerms.filter((_, index) => index % 2 === 1),
  ];
  const shortLabel = String(proposal.label).split(/\s+/u).slice(0, 4).join(" ");
  const paraphrasedValue = reorderedTerms.length > 0
    ? reorderedTerms.join(", ")
    : String(proposal.value);
  return `${prefix} ${shortLabel}: ${paraphrasedValue}.`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function screen03KeyPointText(proposal: JsonObject, eventTitle: string) {
  const source = labelledScreen03Proposal(proposal);
  const support = screen03ProposalSupportText(proposal);
  if (
    /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle) &&
    /25 million/i.test(source) && /50,000/i.test(source)
  ) {
    return "The historical definition covered a qualifying California for-profit business if it exceeded $25 million in annual revenue, handled personal information for at least 50,000 consumers, households, or devices, or earned at least 50 percent of annual revenue by selling consumers' personal information.";
  }
  if (
    /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle) &&
    /disclosure[\s\S]*deletion[\s\S]*opt[- ]?out[\s\S]*nondiscrimination/i.test(
      source,
    )
  ) {
    return "The act created disclosure, deletion, opt-out, and nondiscrimination rights, together with compliance duties for covered businesses.";
  }
  if (
    /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle) &&
    /covered entities|eligibility|qualifying (?:for-profit )?business/i.test(
      source,
    )
  ) {
    return "The law covers qualifying for-profit businesses doing business in California when the applicable statutory thresholds are met.";
  }
  if (
    /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle) &&
    /2020-01-01|January 1, 2020|operative date/i.test(source)
  ) {
    if (/2018-06-28|June 28, 2018|enact(?:ed|ment)/i.test(support)) {
      return "California enacted the privacy law on 2018-06-28 and made it operative on 2020-01-01.";
    }
    return "The privacy law became operative in California on 2020-01-01.";
  }
  if (
    /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle) &&
    /2018-06-28|June 28, 2018|enact(?:ed|ment)/i.test(source)
  ) {
    return "California enacted the privacy law on 2018-06-28.";
  }
  if (
    /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle) &&
    /enforc/i.test(source)
  ) {
    return /2020-07-01|July 1, 2020/i.test(source)
      ? "California authorities began enforcing the privacy law on 2020-07-01."
      : "California authorities enforce the privacy duties that apply to covered businesses.";
  }
  if (
    /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle) &&
    /implementation (?:guidance|rules)|regulations?/i.test(source)
  ) {
    return "California later adopted implementation rules explaining how covered businesses should handle the privacy requirements.";
  }
  if (
    /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle) &&
    /amend|later|expand|update|revision/i.test(source)
  ) {
    return "The California Privacy Rights Act was a later amendment to the CCPA, broadening consumer rights and adding protections beginning January 1, 2023.";
  }
  if (
    /Non-Financial Reporting|\bNFRD\b/i.test(eventTitle) &&
    /large public-interest[\s\S]*500 employees/i.test(source)
  ) {
    return "The scope includes large public-interest entities and parent undertakings above 500 employees.";
  }
  if (
    /Non-Financial Reporting|\bNFRD\b/i.test(eventTitle) &&
    /non-financial statement/i.test(source)
  ) {
    return "Covered entities must report environmental, social, employee, human-rights, and anti-corruption matters in a non-financial statement.";
  }
  if (
    /Non-Financial Reporting|\bNFRD\b/i.test(eventTitle) &&
    /2017-01-01|January 1, 2017|financial years beginning/i.test(source)
  ) {
    return "Starting with financial years beginning on 2017-01-01, reporting duties under the directive apply.";
  }
  if (
    /Electricity Market/i.test(eventTitle) &&
    /market participants[\s\S]*electricity suppliers/i.test(source)
  ) {
    return "The updated European Union electricity-market rules affect market participants and electricity suppliers.";
  }
  if (
    /Electricity Market/i.test(eventTitle) &&
    /consumer contracting[\s\S]*power purchase agreements/i.test(source)
  ) {
    return "The electricity-market update addresses consumer contracting and power purchase agreements.";
  }
  if (
    /Electricity Market/i.test(eventTitle) &&
    /2024-06-13|June 13, 2024|adopted/i.test(source)
  ) {
    return "The European Union adopted the electricity-market update on 2024-06-13.";
  }
  if (
    /Electricity Market/i.test(eventTitle) &&
    /member-state implementation|national market role|applicable provision/i.test(
      source,
    )
  ) {
    return "Practical coverage depends on member-state implementation, each firm's national market role, and the applicable provision.";
  }
  return groundedScreen03FixtureText(proposal, "A key event point is", 350);
}

function screen03IntroText(proposal: JsonObject, eventTitle: string) {
  if (/California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle)) {
    return "In plain terms, the California Consumer Privacy Act is a state privacy law establishing consumer controls over personal information and duties for covered businesses.";
  }
  if (/Non-Financial Reporting|\bNFRD\b/i.test(eventTitle)) {
    return "The EU Non-Financial Reporting Directive sets reporting duties for large public-interest entities.";
  }
  if (/Electricity Market/i.test(eventTitle)) {
    return "This European Union regulation updates rules for electricity markets and related participants.";
  }
  return groundedScreen03FixtureText(
    proposal,
    `In plain language, ${eventTitle} is described by`,
    350,
  );
}

function screen03DraftFromBatch(
  batch: JsonObject,
  options: Pick<
    AutomaticHostReasoningOptions,
    "screen03StudyRelevance" | "screen03ClaimHelp"
  > = {},
) {
  const { event, study, proposals } = screen03TaskFromBatch(batch);
  const compactTask = optionalRecord(batch.task);
  const compactClaimsArePrepared = Array.isArray(compactTask?.claims);
  const sourceLinked = compactClaimsArePrepared
    ? proposals
    : proposals.filter((proposal) =>
        (Array.isArray(proposal.ownPassageIds) &&
          proposal.ownPassageIds.length > 0) ||
        (Array.isArray(proposal.evidence) && proposal.evidence.length > 0) ||
        (!("ownPassageIds" in proposal) && !("evidence" in proposal))
      );
  if (sourceLinked.length === 0) {
    throw new Error("The Screen 3 host task has no source-linked claim.");
  }
  const chooseByGroup = (...groups: string[]) =>
    groups
      .map((group) =>
        sourceLinked.find((proposal) => proposal.group === group),
      )
      .find((proposal) => proposal !== undefined);
  const chooseByMeaning = (...patterns: RegExp[]) =>
    patterns
      .map((pattern) =>
        sourceLinked.find((proposal) =>
          pattern.test(labelledScreen03Proposal(proposal))
        ),
      )
      .find((proposal) => proposal !== undefined);
  const chooseByGroupAndMeaning = (group: string, ...patterns: RegExp[]) =>
    patterns
      .map((pattern) =>
        sourceLinked.find((proposal) =>
          proposal.group === group &&
          pattern.test(labelledScreen03Proposal(proposal))
        ),
      )
      .find((proposal) => proposal !== undefined);
  const introProposal = chooseByGroup("overview", "component", "identity") ??
    sourceLinked[0]!;
  const identityProposal = chooseByGroup("identity", "overview", "component") ??
    sourceLinked[0]!;
  const sampleProposal = chooseByGroup(
    "eligibility",
    "component",
    "overview",
    "identity",
  ) ?? sourceLinked[0]!;
  const eventTitle = String(event.canonicalTitle ?? identityProposal.value);
  const isCcpa = /California Consumer Privacy Act|\bCCPA\b/i.test(eventTitle);
  const isNfrd = /Non-Financial Reporting|\bNFRD\b/i.test(eventTitle);
  const isElectricityMarket = /Electricity Market/i.test(eventTitle);
  const semanticCandidates = isCcpa
    ? [
        chooseByMeaning(
          /disclosure[\s\S]*deletion[\s\S]*opt[- ]?out/i,
          /consumer[\s\S]*rights/i,
        ),
        chooseByMeaning(
          /^Eligibility thresholds:/i,
          /qualifying for-profit[\s\S]*(?:threshold|25 million|50,000)/i,
          /annual gross revenue[\s\S]*25 million/i,
        ),
        chooseByMeaning(
          /^Covered entities or eligibility:/i,
          /covered[\s\S]*(?:business|organization)/i,
        ),
        chooseByMeaning(
          /2020-01-01|January 1, 2020|operative date/i,
          /2018-06-28|June 28, 2018|enact(?:ed|ment)/i,
        ),
        chooseByMeaning(
          /enforc(?:e|ed|ement|ing)/i,
          /implementation guidance|implementation rules/i,
          /later amendment/i,
        ),
        chooseByMeaning(/^Later amendment:/i, /amend|later|revision/i),
      ]
    : isNfrd
      ? [
          chooseByGroupAndMeaning(
            "eligibility",
            /large public-interest[\s\S]*500 employees/i,
          ),
          chooseByGroupAndMeaning("component", /non-financial statement/i),
          chooseByGroupAndMeaning(
            "timeline",
            /2017-01-01|January 1, 2017|financial years beginning/i,
          ),
        ]
      : isElectricityMarket
        ? [
            chooseByMeaning(/market participants[\s\S]*electricity suppliers/i),
            chooseByMeaning(
              /consumer contracting[\s\S]*power purchase agreements/i,
              /price crises|market-design safeguards/i,
            ),
            chooseByMeaning(/2024-06-13|June 13, 2024|adopted/i),
            chooseByMeaning(
              /member-state implementation/i,
              /national market role|applicable provision/i,
            ),
          ]
        : [
            chooseByGroup("component", "overview", "identity"),
            chooseByGroup("eligibility", "overview", "identity"),
            chooseByGroup("timeline", "amendment", "identity"),
            chooseByGroup("amendment", "component", "overview"),
          ];
  const keyPointProposals = [
    ...semanticCandidates,
    chooseByGroup("component", "overview", "identity"),
    chooseByGroup("eligibility", "overview", "identity"),
    chooseByGroup("timeline", "amendment", "identity"),
    chooseByGroup("amendment", "component", "overview"),
  ].filter((proposal): proposal is JsonObject => proposal !== undefined).filter(
    (proposal, index, values) =>
      values.findIndex(
        (candidate) => candidate.proposalId === proposal.proposalId,
      ) === index,
  ).slice(0, isCcpa ? 6 : isNfrd ? 3 : 4);
  if (keyPointProposals.length === 0) {
    keyPointProposals.push(sourceLinked[0]!);
  }
  const population = String(study.population ?? "the selected sample");
  const geography = String(study.geography ?? "the selected geography");
  const outcomeFamily = String(study.outcomeFamily ?? "the selected outcome");
  const identityId = String(identityProposal.proposalId);
  const claimHelp = options.screen03ClaimHelp ?? "full";
  const claimExplanations = claimHelp === "empty"
    ? []
    : proposals
      .filter((_, index) => claimHelp === "full" || index % 2 === 0)
      .map((proposal) => ({
        proposalId: String(proposal.proposalId),
        text: groundedScreen03FixtureText(
          proposal,
          "In plain terms,",
          275,
        ),
      }));
  const draft: JsonObject = {
    snapshot: {
      intro: {
        text: screen03IntroText(introProposal, eventTitle),
        proposalIds: [introProposal, ...keyPointProposals]
          .filter((proposal, index, values) =>
            values.findIndex((candidate) =>
              candidate.proposalId === proposal.proposalId
            ) === index
          )
          .slice(0, 4)
          .map((proposal) => String(proposal.proposalId)),
      },
      keyPoints: keyPointProposals.map((proposal) => {
        const text = screen03KeyPointText(proposal, eventTitle);
        // A synthesized point can be supported by more than one bounded claim.
        // Preserve each matching claim group without repeating the same bullet.
        const proposalIds = [
          proposal,
          ...sourceLinked.filter((candidate) =>
            candidate.proposalId !== proposal.proposalId &&
            screen03KeyPointText(candidate, eventTitle) === text
          ),
        ]
          .map((candidate) => String(candidate.proposalId))
          .slice(0, 4);
        return { text, proposalIds };
      }),
    },
    claimExplanations,
  };
  if (options.screen03StudyRelevance !== "omit") {
    draft.studyRelevance = {
      sampleConnection: {
        text: groundedScreen03FixtureText(
          sampleProposal,
          `For ${population} in ${geography}, the cited claim may help define the relevant sample:`,
          350,
        ),
        proposalIds: [String(sampleProposal.proposalId)],
      },
      outcomeConnection: {
        text: groundedScreen03FixtureText(
          identityProposal,
          `${outcomeFamily} may be related to this cited event as an untested research-design hypothesis:`,
          350,
        ),
        proposalIds: [identityId],
      },
    };
  }
  return draft;
}

function screen01DraftFromContext(modelContext: JsonObject) {
  const source = record(modelContext.source, "Screen 1 host source");
  const sentence = String(source.sentence ?? "");
  const mode = source.mode;
  if (mode === "find" && /electricity|northern europe|nordic/i.test(sentence)) {
    return {
      scope: {
        population: "Electricity firms",
        assignmentLevel: "Firm",
        analysisLevel: "Firm",
        geography: "Northern Europe",
        industry: "Electricity",
        studyPeriod: "2021–2024",
        eventFamily: "Regulation",
        outcomeFamily: "Profitability",
        outcomeFrequency: "Annual",
      },
      knownShock: "",
    };
  }
  if (
    mode === "find" &&
    /u\.?s\.? publicly listed technology firms/i.test(sentence) &&
    /profitability/i.test(sentence)
  ) {
    return {
      scope: {
        population: "U.S. publicly listed technology firms",
        assignmentLevel: "Firm",
        analysisLevel: "Firm",
        geography: "United States",
        industry: "Technology",
        studyPeriod: "2017–2023",
        eventFamily: "Regulation",
        outcomeFamily: "Profitability",
        outcomeFrequency: "Annual",
      },
      knownShock: "",
    };
  }
  if (mode === "audit" && /california consumer privacy act|ccpa/i.test(sentence)) {
    return {
      scope: {
        population: "U.S. publicly listed technology firms",
        assignmentLevel: "Firm",
        analysisLevel: "Firm",
        geography: "United States",
        industry: "Technology",
        studyPeriod: "2015–2023",
        eventFamily: "Regulation",
        outcomeFamily: "Innovation",
        outcomeFrequency: "Annual",
      },
      knownShock: "California Consumer Privacy Act",
    };
  }
  throw new Error(`No deterministic host draft fixture matches: ${sentence}`);
}

function automaticV036HostResponder(
  options: AutomaticHostReasoningOptions = {},
) {
  const enabled = {
    screen01: options.screen01 ?? true,
    screen02: options.screen02 ?? true,
    screen02FindPlanningOnly: options.screen02FindPlanningOnly ?? false,
    screen03: options.screen03 ?? true,
  };
  return (request: HostModelRequest): HostModelToolCall[] => {
    const contextUpdate = request.latestModelContext;
    const modelContext = contextUpdate &&
        typeof contextUpdate.structuredContent === "object" &&
        contextUpdate.structuredContent !== null &&
        !Array.isArray(contextUpdate.structuredContent)
      ? contextUpdate.structuredContent as JsonObject
      : null;
    if (!modelContext) return [];

    if (
      enabled.screen01 &&
      modelContext.schemaVersion === "screen-01-host-draft-model-context-v1"
    ) {
      const submission = record(
        modelContext.submission,
        "Screen 1 host submission contract",
      );
      return [{
        label: `automatic-screen01-host-draft-${String(modelContext.requestId)}`,
        name: SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
        arguments: {
          schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: submission.capabilityToken,
          requestId: modelContext.requestId,
          draft: screen01DraftFromContext(modelContext),
        },
      }];
    }

    if (
      (enabled.screen02 || enabled.screen02FindPlanningOnly) &&
      modelContext.schemaVersion === "screen-02-find-model-context-v1"
    ) {
      const requests = Array.isArray(modelContext.requests)
        ? modelContext.requests.map((candidate, index) =>
            record(candidate, `automatic Find request ${index + 1}`),
          )
        : [];
      const selectedRequests = enabled.screen02
        ? requests
        : requests.filter(
            (candidate) => candidate.mode === "find-discovery-plan",
          );
      return selectedRequests.map((candidate) => ({
        label: `automatic-find-assessment-${assessmentRequestId(candidate)}`,
        name: "submit_screen02_find_assessment_draft_v021",
        arguments: {
          schemaVersion: SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: candidate.capabilityToken,
          requestId: assessmentRequestId(candidate),
          draft: findDraftForRequest(candidate, undefined, modelContext),
        },
      }));
    }

    if (
      enabled.screen02 &&
      modelContext.schemaVersion === "screen-02-audit-model-context-v1"
    ) {
      const requests = Array.isArray(modelContext.requests)
        ? modelContext.requests.map((candidate, index) =>
            record(candidate, `automatic Audit request ${index + 1}`),
          )
        : [];
      return requests.map((candidate) => ({
        label: `automatic-audit-assessment-${assessmentRequestId(candidate)}`,
        name: "submit_screen02_audit_draft_v021",
        arguments: {
          schemaVersion: SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: candidate.capabilityToken,
          requestId: assessmentRequestId(candidate),
          draft: auditDraftForRequest(candidate),
        },
      }));
    }

    if (
      enabled.screen03 &&
      (modelContext.schemaVersion === SCREEN_03_HOST_DRAFT_BATCH_SCHEMA_VERSION ||
        modelContext.schemaVersion === screen03HostMessageTaskSchemaVersion)
    ) {
      return [{
        label: `automatic-screen03-host-draft-${String(modelContext.requestId)}`,
        name: SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
        arguments: {
          schemaVersion: SCREEN_03_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: modelContext.capabilityToken,
          requestId: modelContext.requestId,
          draft: screen03DraftFromBatch(modelContext, options),
        },
      }];
    }
    return [];
  };
}

function automaticFindPlanningOnlyHostResponder() {
  return automaticV036HostResponder({
    screen01: false,
    screen02: false,
    screen02FindPlanningOnly: true,
    screen03: false,
  });
}

async function submitAssessmentBatch(
  snapshot: Screen02WorkflowClientSnapshot,
  draftForRequest: (request: JsonObject, index: number) => JsonObject,
  requests = assessmentBatchRequests(snapshot),
) {
  const batch = snapshot.assessmentBatch;
  if (!batch) throw new Error("Expected an active assessment batch.");
  const submitted: SubmittedAssessment[] = [];
  for (const [index, request] of requests.entries()) {
    if (typeof request.capabilityToken !== "string") {
      throw new Error("The bounded assessment request is missing authority.");
    }
    const requestId = assessmentRequestId(request);
    const args: JsonObject = {
      schemaVersion:
        batch.mode === "find"
          ? SCREEN_02_FIND_DRAFT_SUBMISSION_SCHEMA_VERSION
          : SCREEN_02_AUDIT_DRAFT_SUBMISSION_SCHEMA_VERSION,
      capabilityToken: request.capabilityToken,
      requestId,
      draft: draftForRequest(request, index),
    };
    const result = await callMcpTool(baseUrl, batch.requiredTool, args);
    expect(result.isError).not.toBe(true);
    submitted.push({ arguments: args, request, result });
  }
  return submitted;
}

async function notifySubmittedAssessments(
  page: Page,
  submissions: SubmittedAssessment[],
  label: string,
  serverToolResults?: ServerToolResult[],
) {
  let latestRefresh: ServerToolResult | null = null;
  for (const [index, submission] of submissions.entries()) {
    const beforeRefresh = serverToolResults?.length ?? 0;
    await page.evaluate(
      ({ entryLabel, args, result }) =>
        (
          window as unknown as {
            __shockAuditNotifyToolResult: (entry: {
              label: string;
              arguments: JsonObject;
              result: McpCallToolResult;
            }) => Promise<void>;
          }
        ).__shockAuditNotifyToolResult({
          label: entryLabel,
          arguments: args,
          result,
        }),
      {
        entryLabel: `${label}-${index + 1}`,
        args: submission.arguments,
        result: submission.result,
      },
    );
    if (serverToolResults) {
      latestRefresh = await waitForServerWorkflowResult(
        serverToolResults,
        "refresh",
        beforeRefresh,
      );
    }
  }
  return latestRefresh;
}

async function notifyToolResult(
  page: Page,
  label: string,
  args: JsonObject,
  result: McpCallToolResult,
) {
  await page.evaluate(
    ({ entryLabel, entryArguments, entryResult }) =>
      (
        window as unknown as {
          __shockAuditNotifyToolResult: (entry: {
            label: string;
            arguments: JsonObject;
            result: McpCallToolResult;
          }) => Promise<void>;
        }
      ).__shockAuditNotifyToolResult({
        label: entryLabel,
        arguments: entryArguments,
        result: entryResult,
      }),
    {
      entryLabel: label,
      entryArguments: args,
      entryResult: result,
    },
  );
}

test.beforeAll(async () => {
  if (process.env.SHOCKAUDIT_BROWSER_NODE_FIXTURE === "1") {
    nodeFixtureServer = await startNodeFixtureServer(baseUrl);
  }
});

test.afterAll(async () => {
  if (!nodeFixtureServer) return;
  await new Promise<void>((resolveClose, rejectClose) =>
    nodeFixtureServer!.close((error) =>
      error ? rejectClose(error) : resolveClose(),
    ),
  );
});

function captureBrowserIssues(page: Page): BrowserIssues {
  const issues: BrowserIssues = {
    consoleErrors: [],
    pageErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => issues.pageErrors.push(error.message));
  return issues;
}

function privateWorkflowSnapshot(
  result: McpCallToolResult,
): Screen02WorkflowClientSnapshot {
  const metadata = result._meta;
  const value =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as JsonObject)[SCREEN_02_WORKFLOW_META_KEY]
      : null;
  const snapshot = restoreScreen02WorkflowClientSnapshot(value);
  if (!snapshot) {
    throw new Error(
      "The simulated canonical opener returned no valid private v2.1 snapshot.",
    );
  }
  return snapshot;
}

async function privateScreen03State(
  entry: ServerToolResult,
  kind: Screen03SealedResultKind = "mutation",
) {
  const output = record(
    entry.result.structuredContent,
    "Screen 3 sealed output",
  );
  const sealedState = record(
    output.sealedState,
    "Screen 3 sealed state",
  );
  const operationId = entry.arguments.operationId;
  const responseKeyId = entry.arguments.responseKeyId;
  const responseKey = entry.arguments.responseKey;
  if (
    typeof operationId !== "string" ||
    typeof responseKeyId !== "string" ||
    typeof responseKey !== "string"
  ) {
    throw new Error("The Screen 3 result lacks its one-call response key.");
  }
  const rawKey = screen02SealedResultBase64UrlToBytes(responseKey, {
    exactBytes: 32,
    maximumBytes: 32,
    maximumCharacters: 43,
  });
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      true,
      ["decrypt"],
    );
  } finally {
    rawKey.fill(0);
  }
  const material: Screen02ResponseKeyMaterial = Object.freeze({
    keyId: responseKeyId,
    key,
  });
  return decryptScreen03VerificationState(sealedState, {
    operationId,
    kind,
    responseKey: material,
  });
}

async function capturedToolCalls(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __shockAuditHostState: { toolCalls: CapturedToolCall[] };
        }
      ).__shockAuditHostState.toolCalls,
  );
}

async function hostErrors(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __shockAuditHostState: { errors: string[] };
        }
      ).__shockAuditHostState.errors,
  );
}

async function hostReasoningTranscript(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __shockAuditHostState: {
            events: Array<{
              direction: string;
              method: string;
              label?: string;
            }>;
            messageRequests: Array<{ params: JsonObject }>;
            samplingRequests: Array<{ params: JsonObject }>;
            modelContextRequests: Array<{ params: JsonObject }>;
            compatibilityMessageRequests: Array<{ params: JsonObject }>;
            compatibilityModelContextRequests: Array<{ params: JsonObject }>;
            modelToolCalls: Array<{
              label: string;
              name: string;
              arguments: JsonObject;
            }>;
            suppressedModelToolNotifications: Array<{
              label: string;
              toolName?: string;
            }>;
          };
        }
      ).__shockAuditHostState,
  );
}

const screen01HostDraftToolNames = new Set<string>([
  SCREEN_01_HOST_DRAFT_PREPARE_TOOL_V036,
  SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
  SCREEN_01_HOST_DRAFT_APPLY_TOOL_V036,
]);

async function expectNoScreen01ScopeDrafting(
  app: FrameLocator,
  page: Page,
  serverToolResults: ServerToolResult[],
) {
  await expect(
    app.getByRole("button", { name: /scope fields with ChatGPT/i }),
  ).toHaveCount(0);
  await expect(
    app.getByRole("button", { name: /scope fields from my description/i }),
  ).toHaveCount(0);
  await expect(app.locator("#host-draft-help")).toHaveCount(0);
  expect(
    serverToolResults.filter((entry) =>
      screen01HostDraftToolNames.has(entry.name)
    ),
  ).toHaveLength(0);

  const transcript = await hostReasoningTranscript(page);
  expect(
    transcript.modelToolCalls.filter((entry) =>
      screen01HostDraftToolNames.has(entry.name)
    ),
  ).toHaveLength(0);
  const screen01HostRequests = [
    ...transcript.messageRequests,
    ...transcript.samplingRequests,
    ...transcript.modelContextRequests,
    ...transcript.compatibilityMessageRequests,
    ...transcript.compatibilityModelContextRequests,
  ].filter((request) => {
    const serialized = JSON.stringify(request.params);
    return serialized.includes("screen-01-host-draft") ||
      [...screen01HostDraftToolNames].some((name) =>
        serialized.includes(name)
      );
  });
  expect(screen01HostRequests).toHaveLength(0);
}

async function releaseSuppressedModelToolResults(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as {
        __shockAuditReleaseSuppressedModelToolResults: () => Promise<number>;
      }
    ).__shockAuditReleaseSuppressedModelToolResults()
  );
}

async function openSavedScreen03AsHistoricalV0315(sourcePage: Page) {
  await expect.poll(() =>
    sourcePage.evaluate(() => {
      const saved = (
        window as unknown as {
          __shockAuditCompatibilityWidgetState?: JsonObject;
        }
      ).__shockAuditCompatibilityWidgetState;
      const privateContent = saved?.privateContent as JsonObject | undefined;
      const screen03 = privateContent?.screen03Workflow as
        | JsonObject
        | undefined;
      const state = screen03?.state as JsonObject | undefined;
      return {
        releaseLabel: state?.releaseLabel,
        status: state?.status,
        activeScreen: screen03?.activeScreen,
        hasOrientation: Boolean(state?.orientation),
      };
    })
  ).toEqual({
    releaseLabel: "v0.3.17",
    status: "reviewing",
    activeScreen: 3,
    hasOrientation: true,
  });
  const widgetState = await sourcePage.evaluate(() =>
    (
      window as unknown as {
        __shockAuditCompatibilityWidgetState: JsonObject;
      }
    ).__shockAuditCompatibilityWidgetState
  );
  const privateContent = record(
    widgetState.privateContent,
    "saved compatibility private content",
  );
  const screen03Widget = record(
    privateContent.screen03Workflow,
    "saved Screen 3 widget",
  );
  const currentState = record(
    screen03Widget.state,
    "saved current Screen 3 state",
  ) as unknown as Screen03VerificationState;
  expect(currentState.releaseLabel).toBe("v0.3.17");
  expect(currentState.orientation).toBeDefined();
  expect(currentState.briefing).toBeUndefined();

  const currentPage = await sourcePage.context().newPage();
  await currentPage.setViewportSize({ width: 1024, height: 900 });
  await currentPage.addInitScript((now) => {
    Date.now = () => now;
  }, Date.parse(SCREEN02_BROWSER_CLIENT_NOW_ISO));
  const currentIssues = captureBrowserIssues(currentPage);
  const currentServerToolResults: ServerToolResult[] = [];
  await installMcpAppHost(currentPage, {
    appUrl: `${baseUrl}/`,
    initialToolNotifications: [],
    splitToolResultMetadata: true,
    installChatGptCompatibilityBridge: true,
    initialCompatibilityWidgetState: JSON.parse(
      JSON.stringify(widgetState),
    ) as JsonObject,
    hostModelResponder: automaticV036HostResponder({
      screen01: false,
      screen02: false,
      screen03: false,
    }),
    callTool: async (name, args) => {
      const result = await callMcpTool(baseUrl, name, args);
      currentServerToolResults.push({ name, arguments: args, result });
      return result;
    },
  });
  const currentApp = currentPage.frameLocator("#shockaudit-frame");
  const restoredCurrentOverview = currentApp.getByTestId(
    "screen03-understand-shock",
  );
  const restoredCurrentScreen03 = currentApp.getByTestId("screen03");
  await expect(restoredCurrentScreen03).toBeVisible();
  await expect(restoredCurrentScreen03).toHaveAttribute("aria-busy", "false");
  await expectCurrentScreen03Orientation(restoredCurrentOverview, 0);
  await expect(
    restoredCurrentOverview.getByTestId("screen03-orientation-summary"),
  ).toHaveText("California Consumer Privacy Act is a privacy legislation.");
  await expect(
    restoredCurrentOverview.getByTestId("screen03-orientation-key-points"),
  ).toHaveCount(0);
  await expectNoCurrentScreen03HostActivity(currentApp, currentPage);
  expect(
    currentServerToolResults.filter((entry) =>
      entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036 ||
      entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036
    ),
  ).toHaveLength(0);
  await expectNoBrowserOrHostErrors(currentPage, currentIssues);
  await currentPage.close();

  const historical = JSON.parse(
    JSON.stringify(currentState),
  ) as Screen03VerificationState;
  historical.releaseLabel = "v0.3.15";
  delete historical.orientation;
  const { integrity: _integrity, ...fingerprintInput } = historical;
  historical.integrity = {
    stateFingerprint: fingerprintScreen03Value(fingerprintInput),
  };
  const historicalWithBriefing = attachScreen03BriefingLifecycle(
    historical,
    `s3ref_${"H".repeat(43)}`,
    historical.updatedAt,
  );
  expect(historicalWithBriefing.revision).toBe(currentState.revision + 1);
  screen03Widget.state = historicalWithBriefing;
  widgetState.modelContent = "ShockAudit saved workflow compatibility state.";

  const historicalPage = await sourcePage.context().newPage();
  await historicalPage.setViewportSize({ width: 1440, height: 1000 });
  await historicalPage.addInitScript((now) => {
    Date.now = () => now;
  }, Date.parse(SCREEN02_BROWSER_CLIENT_NOW_ISO));
  await historicalPage.addInitScript(accelerateScreen03CapabilityDeadline, {
    deadlineMs: SCREEN_03_HOST_DRAFT_DEFAULT_CAPABILITY_TTL_MS,
    clientClockLeadMs: screen02BrowserClientClockLeadMs,
  });
  const issues = captureBrowserIssues(historicalPage);
  const serverToolResults: ServerToolResult[] = [];
  await installMcpAppHost(historicalPage, {
    appUrl: `${baseUrl}/`,
    initialToolNotifications: [],
    splitToolResultMetadata: true,
    installChatGptCompatibilityBridge: true,
    initialCompatibilityWidgetState: widgetState,
    hostModelResponder: automaticV036HostResponder({
      screen01: false,
      screen02: false,
      screen03: false,
    }),
    messageResponseDelayMs: 150,
    callTool: async (name, args) => {
      const result = await callMcpTool(baseUrl, name, args);
      serverToolResults.push({ name, arguments: args, result });
      return result;
    },
  });
  await expect(
    historicalPage.getByTestId("simulated-browser-evidence"),
  ).toContainText("not signed-in ChatGPT evidence");

  const restorationRefresh = await waitForServerWorkflowResult(
    serverToolResults,
    "refresh",
  );
  expect(restorationRefresh.name).toBe(currentWorkflowActionTool);
  expect(restorationRefresh.result.isError).not.toBe(true);
  expect(restorationRefresh.result.structuredContent).toMatchObject({
    ok: true,
    outcome: "refreshed",
    mode: "audit",
  });

  await expect.poll(() =>
    historicalPage.evaluate(() => {
      const hostState = (
        window as unknown as {
          __shockAuditHostState: {
            mountId: number;
            initializedMounts: number[];
          };
        }
      ).__shockAuditHostState;
      return {
        mountId: hostState.mountId,
        initializedMounts: hostState.initializedMounts,
      };
    })
  ).toEqual({
    mountId: 1,
    initializedMounts: [1],
  });

  await expect
    .poll(() => sentToolNotificationLabels(historicalPage))
    .toEqual([`split-result:${currentWorkflowActionTool}`]);
  const app = historicalPage.frameLocator("#shockaudit-frame");
  await expect.poll(() =>
    app.locator("body").evaluate(() => {
      const saved = (
        window as unknown as {
          openai?: {
            widgetState?: JsonObject;
          };
        }
      ).openai?.widgetState;
      const privateContent = saved?.privateContent as JsonObject | undefined;
      const screen03 = privateContent?.screen03Workflow as
        | JsonObject
        | undefined;
      const state = screen03?.state as JsonObject | undefined;
      const usesChildObjectPrototype = (value: unknown) =>
        Boolean(value) &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype;
      return {
        releaseLabel: state?.releaseLabel,
        revision: state?.revision,
        activeScreen: screen03?.activeScreen,
        savedUsesChildObjectPrototype: usesChildObjectPrototype(saved),
        privateContentUsesChildObjectPrototype:
          usesChildObjectPrototype(privateContent),
        screen02UsesChildObjectPrototype: usesChildObjectPrototype(
          privateContent?.screen02Workflow,
        ),
        screen03UsesChildObjectPrototype:
          usesChildObjectPrototype(screen03),
      };
    })
  ).toEqual({
    releaseLabel: "v0.3.15",
    revision: historicalWithBriefing.revision,
    activeScreen: 3,
    savedUsesChildObjectPrototype: true,
    privateContentUsesChildObjectPrototype: true,
    screen02UsesChildObjectPrototype: true,
    screen03UsesChildObjectPrototype: true,
  });
  expect(
    serverToolResults.map((entry) => ({
      name: entry.name,
      action: entry.arguments.action,
    })),
  ).toEqual([
    {
      name: currentWorkflowActionTool,
      action: "refresh",
    },
  ]);

  const preActionTranscript = await hostReasoningTranscript(historicalPage);
  expect(preActionTranscript.messageRequests).toHaveLength(0);
  expect(preActionTranscript.compatibilityMessageRequests).toHaveLength(0);
  expect(preActionTranscript.samplingRequests).toHaveLength(0);
  expect(preActionTranscript.modelToolCalls).toHaveLength(0);
  return {
    app,
    historicalPage,
    historicalState: historicalWithBriefing,
    issues,
    serverToolResults,
  };
}

async function expectGeneratedBriefHygiene(overview: Locator) {
  const snapshot = overview.locator(".s3-snapshot");
  const intro = snapshot.locator(".s3-snapshot__intro");
  await expect(intro).toBeVisible();
  await expect(intro.locator(".s3-inline-sources a").first()).toBeVisible();
  const points = snapshot.locator(".s3-snapshot__points li");
  await expect(points.first()).toBeVisible();
  const pointCount = await points.count();
  expect(pointCount).toBeGreaterThanOrEqual(3);
  expect(pointCount).toBeLessThanOrEqual(6);
  for (let index = 0; index < pointCount; index += 1) {
    const point = points.nth(index);
    await expect(point.locator(".s3-inline-sources a").first()).toBeVisible();
  }
  await expect(overview).not.toContainText("SHARE THIS");
  await expect(overview).not.toContainText(/active online source records?/i);
  await expect(overview).not.toContainText(/dated milestones? to check/i);
  await expect(overview).not.toContainText(/workflow status/i);
  await expect(overview).not.toContainText(/source[- ]backed orientation/i);
  await expect(overview).not.toContainText(
    "The ChatGPT wording did not return",
  );
}

async function expectDeterministicScreen03Fallback(overview: Locator) {
  await expect(overview).toContainText(
    "Source-linked factual summary — no ChatGPT interpretation",
  );
  await expect(
    overview.getByTestId("screen03-factual-summary-guardrail"),
  ).toContainText(
    "Fixed software assembled this fallback from directly linked Event Card fields.",
  );
  await expect(overview).not.toContainText(
    "ChatGPT-generated source-linked overview",
  );
}

async function expectCurrentScreen03Orientation(
  overview: Locator,
  minimumPoints: 0 | 1 = 1,
) {
  await expect(overview).toHaveAttribute("aria-labelledby", "s3-brief-title");
  await expect(
    overview.getByRole("heading", { name: "Understand this shock" }),
  ).toBeVisible();
  await expect(overview.getByText("Brief overview", { exact: true }))
    .toBeVisible();
  const summary = overview.getByTestId("screen03-orientation-summary");
  await expect(summary).not.toBeEmpty();
  const points = overview
    .getByTestId("screen03-orientation-key-points")
    .getByRole("listitem");
  const pointCount = await points.count();
  expect(pointCount).toBeGreaterThanOrEqual(minimumPoints);
  expect(pointCount).toBeLessThanOrEqual(5);
  for (let index = 0; index < pointCount; index += 1) {
    await expect(points.nth(index)).not.toBeEmpty();
    const words = ((await points.nth(index).textContent()) ?? "")
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(25);
  }
  const visibleText = ((await overview.innerText()) ?? "").replace(/\s+/gu, " ");
  expect(visibleText.split(/\s+/u).filter(Boolean).length).toBeLessThanOrEqual(200);
  for (const forbidden of [
    /Screen 2/iu,
    /Screen 3/iu,
    /provisional timing leads?/iu,
    /formal identifier/iu,
    /possible exposure indicators?/iu,
    /study-relevant event clock/iu,
    /does not establish exogeneity/iu,
    /causal mechanism/iu,
    /realized effects?/iu,
    /fixed software/iu,
    /source-derived preliminary orientation/iu,
  ]) {
    expect(visibleText).not.toMatch(forbidden);
  }
  for (const heading of [
    "Who is broadly affected",
    "Important timing",
    "Important caveat or later change",
    "Main sources",
  ]) {
    await expect(overview.getByRole("heading", { name: heading })).toHaveCount(0);
  }
  await expect(overview.getByTestId("screen03-orientation-provenance"))
    .toHaveCount(0);
  await expect(overview.getByTestId("screen03-orientation-guardrail"))
    .toHaveCount(0);
  await expect(overview.locator(".s3-event-status")).toHaveCount(0);
  await expect(overview.getByRole("list", {
    name: "Main retained sources",
  })).toHaveCount(0);
  await expect(overview).not.toContainText(
    "Source-linked factual summary — no ChatGPT interpretation",
  );
  await expect(overview).not.toContainText(/factual fallback|render call|host coordinates/i);
}

async function expectNoCurrentScreen03HostActivity(
  app: FrameLocator,
  page: Page,
) {
  await expect(app.getByTestId("screen03-request-host-reasoning")).toHaveCount(0);
  const transcript = await hostReasoningTranscript(page);
  const screen03Messages = transcript.messageRequests.filter((request) => {
    const text = standardMessageText(request.params);
    return text?.includes("get_screen3_briefing_packet") === true ||
      text?.includes("screen3-shock-briefing") === true;
  });
  const compatibilityMessages = transcript.compatibilityMessageRequests.filter(
    (request) => {
      const prompt = typeof request.params.prompt === "string"
        ? request.params.prompt
        : "";
      return prompt.includes("get_screen3_briefing_packet") ||
        prompt.includes("screen3-shock-briefing");
    },
  );
  const safeContexts = [
    ...transcript.modelContextRequests,
    ...transcript.compatibilityModelContextRequests,
  ].filter((request) => JSON.stringify(request.params).includes("safeRunRef"));
  const screen03ModelCalls = transcript.modelToolCalls.filter((entry) =>
    entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036 ||
    entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036 ||
    entry.name === "get_screen3_briefing_packet" ||
    entry.name === "render_screen3_briefing"
  );
  expect(screen03Messages).toHaveLength(0);
  expect(compatibilityMessages).toHaveLength(0);
  expect(safeContexts).toHaveLength(0);
  expect(screen03ModelCalls).toHaveLength(0);
}

async function expectCcpaGeneratedBrief(overview: Locator) {
  await expectGeneratedBriefHygiene(overview);
  await expect(overview).toContainText(
    /California (?:consumer )?privacy (?:law|statute)|California Consumer Privacy Act/i,
  );
  await expect(overview).toContainText(/disclosure|right to know/i);
  await expect(overview).toContainText(/deletion|delete/i);
  await expect(overview).toContainText(/opt[- ]?out/i);
  await expect(overview).toContainText(/nondiscrimination|non-discrimination/i);
  await expect(overview).toContainText(
    /qualifying(?: California)? for-profit|covered organizations/i,
  );
  await expect(overview).toContainText(/25 million/i);
  await expect(overview).toContainText(/50,000/i);
  await expect(overview).toContainText(/2018-06-28|June 28, 2018/i);
  await expect(overview).toContainText(/2020-01-01|January 1, 2020/i);
  await expect(overview).toContainText(
    /enforc|implementation (?:guidance|rules)|later amend(?:ment|ed)/i,
  );
}

async function expectNordicElectricityGeneratedBrief(overview: Locator) {
  await expectGeneratedBriefHygiene(overview);
  await expect(overview).toContainText(/updates?[^.]*electricity-market rules/i);
  await expect(overview).toContainText(/market participants/i);
  await expect(overview).toContainText(/electricity suppliers/i);
  await expect(overview).toContainText(/consumer contracting/i);
  await expect(overview).toContainText(/power purchase agreements/i);
  await expect(overview).toContainText(/2024-06-13|June 13, 2024/i);
  await expect(overview).toContainText(
    /member-state implementation|national market role|applicable provision/i,
  );
  await expect(overview).not.toContainText(
    /California Consumer Privacy Act|\bCCPA\b|personal information|deletion rights|privacy statute/i,
  );
}

function compatibilityTaskFromPrompt(prompt: unknown): JsonObject | null {
  if (typeof prompt !== "string") return null;
  const beginMarker = "--- BEGIN SHOCKAUDIT BOUNDED TASK (JSON) ---";
  const endMarker = "--- END SHOCKAUDIT BOUNDED TASK (JSON) ---";
  const begin = prompt.indexOf(beginMarker);
  const end = prompt.indexOf(endMarker);
  if (begin < 0 || end <= begin) return null;
  try {
    const value = JSON.parse(
      prompt.slice(begin + beginMarker.length, end).trim(),
    ) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as JsonObject
      : null;
  } catch {
    return null;
  }
}

function standardTaskFromMessage(params: JsonObject): JsonObject | null {
  if (!Array.isArray(params.content)) return null;
  const text = params.content.find(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (item as JsonObject).type === "text" &&
      typeof (item as JsonObject).text === "string",
  ) as JsonObject | undefined;
  return compatibilityTaskFromPrompt(text?.text);
}

function standardMessageText(params: JsonObject): string | null {
  if (!Array.isArray(params.content)) return null;
  const text = params.content.find(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (item as JsonObject).type === "text" &&
      typeof (item as JsonObject).text === "string",
  ) as JsonObject | undefined;
  return typeof text?.text === "string" ? text.text : null;
}

function modelContextFromSamplingMessage(params: JsonObject): JsonObject {
  if (!Array.isArray(params.messages)) {
    throw new Error("The Screen 3 sampling request has no messages.");
  }
  const userMessage = params.messages.find(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (item as JsonObject).role === "user",
  ) as JsonObject | undefined;
  const content = optionalRecord(userMessage?.content);
  const text = content?.type === "text" && typeof content.text === "string"
    ? content.text
    : null;
  if (!text) {
    throw new Error("The Screen 3 sampling request has no bounded text.");
  }
  const jsonStart = text.indexOf("{");
  if (jsonStart < 0) {
    throw new Error("The Screen 3 sampling request omitted its bounded JSON.");
  }
  try {
    return record(
      JSON.parse(text.slice(jsonStart)) as unknown,
      "Screen 3 sampling model context",
    );
  } catch (error) {
    throw new Error("The Screen 3 sampling request has invalid bounded JSON.", {
      cause: error,
    });
  }
}

async function screen03HostMessageTasks(page: Page) {
  const transcript = await hostReasoningTranscript(page);
  return [
    ...transcript.messageRequests.map((request) =>
      standardTaskFromMessage(request.params)
    ),
    ...transcript.compatibilityMessageRequests.map((request) =>
      compatibilityTaskFromPrompt(request.params.prompt)
    ),
  ].filter(
    (task): task is JsonObject =>
      task?.schemaVersion === screen03HostMessageTaskSchemaVersion,
  );
}

function expectCompactScreen03HostMessageTask(task: JsonObject) {
  expect(task).toMatchObject({
    schemaVersion: screen03HostMessageTaskSchemaVersion,
    requiredTool: SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
  });
  expect(typeof task.requestId).toBe("string");
  expect(String(task.capabilityToken)).toMatch(/^sa3h-capability-v1\./);
  expect(task).not.toHaveProperty("sourcePacket");
  const boundedTask = record(task.task, "compact Screen 3 model task");
  expect(boundedTask.event).toEqual(expect.any(Object));
  expect(boundedTask.studyContext).toEqual(expect.any(Object));
  expect(Array.isArray(boundedTask.claims)).toBe(true);
  expect((boundedTask.claims as unknown[]).length).toBeGreaterThan(0);
  expect(JSON.stringify(task)).not.toMatch(
    /"sourcePacket"|"passages"|"ownPassageIds"/,
  );
}

async function expectAutomaticHostTraffic(
  page: Page,
  expectedModelTools: readonly string[],
) {
  const transcript = await hostReasoningTranscript(page);
  const reasoningEvents = transcript.events.filter(
    (event) =>
      event.direction === "app-to-host" &&
      (event.method === "ui/update-model-context" ||
        event.method === "ui/message" ||
        event.method === "compatibility/set-widget-model-content" ||
        event.method === "compatibility/send-follow-up-message"),
  );
  const messageEvents = reasoningEvents.filter((event) =>
    event.method === "ui/message" ||
    event.method === "compatibility/send-follow-up-message"
  );
  expect(messageEvents.length).toBeGreaterThan(0);
  expect(transcript.modelToolCalls.map((call) => call.name)).toEqual(
    expect.arrayContaining([...expectedModelTools]),
  );
  const optionalContext = JSON.stringify([
    ...transcript.modelContextRequests,
    ...transcript.compatibilityModelContextRequests,
  ]);
  expect(optionalContext).not.toMatch(
    /receiptToken|stateEnvelope|"accessToken"/,
  );
  expect(optionalContext).not.toMatch(
    /sa1-capability-v1\.|sa2[af]-capability-v1\.|sa3h-capability-v1\./,
  );
  for (const request of transcript.messageRequests) {
    const task = standardTaskFromMessage(request.params);
    expect(task).not.toBeNull();
    expect(JSON.stringify(task)).toMatch(
      /sa1-capability-v1\.|sa2[af]-capability-v1\.|sa3h-capability-v1\./,
    );
    expect(JSON.stringify(request.params)).not.toMatch(
      /receiptToken|stateEnvelope|"accessToken"/,
    );
  }
  for (const request of transcript.compatibilityMessageRequests) {
    expect(request.params.scrollToBottom).toBe(false);
    const task = compatibilityTaskFromPrompt(request.params.prompt);
    expect(task).not.toBeNull();
    expect(JSON.stringify(task)).toMatch(
      /sa1-capability-v1\.|sa2[af]-capability-v1\.|sa3h-capability-v1\./,
    );
    expect(JSON.stringify(request.params)).not.toMatch(
      /receiptToken|stateEnvelope|"accessToken"/,
    );
  }
  const messageCount =
    transcript.messageRequests.length +
    transcript.compatibilityMessageRequests.length;
  expect(messageCount).toBeGreaterThanOrEqual(3);
  expect(messageCount).toBeLessThanOrEqual(
    transcript.modelToolCalls.length,
  );
}

async function sentToolNotificationLabels(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __shockAuditHostState: {
            sentToolNotifications: Array<{ label: string }>;
          };
        }
      ).__shockAuditHostState.sentToolNotifications.map(
        (entry) => entry.label,
      ),
  );
}

async function directResultProofs(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __shockAuditHostState: {
            directResultProofs: Array<{
              toolName: string;
              topLevelKeys: string[];
              structuredContentKeys: string[];
              hasMetadata: boolean;
            }>;
          };
        }
      ).__shockAuditHostState.directResultProofs,
  );
}

function expectSealedWorkflowResult(
  entry: ServerToolResult,
  kind: "open" | "mutation",
  mode: "find" | "audit",
) {
  const output = record(
    entry.result.structuredContent,
    `${kind} sealed structured output`,
  );
  const sealedSnapshot = record(
    output.sealedSnapshot,
    `${kind} sealed snapshot`,
  );
  expect(entry.arguments.responseKeyId).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(entry.arguments.responseKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(output).toMatchObject({
    schemaVersion: "screen-02-workflow-summary-v1",
    screen: "screen-02",
    ok: true,
    mode,
  });
  expect(output).not.toHaveProperty("accessToken");
  expect(output).not.toHaveProperty("stateEnvelope");
  expect(output).not.toHaveProperty("assessmentBatch");
  expect(Object.keys(sealedSnapshot).sort()).toEqual(
    [
      "schemaVersion",
      "algorithm",
      "kind",
      "operationId",
      "keyId",
      "iv",
      "ciphertext",
    ].sort(),
  );
  expect(sealedSnapshot).toMatchObject({
    schemaVersion: "screen-02-workflow-sealed-result-v1",
    algorithm: "A256GCM",
    kind,
    operationId: entry.arguments.operationId,
    keyId: entry.arguments.responseKeyId,
  });
  expect(sealedSnapshot.iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
  expect(sealedSnapshot.ciphertext).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(JSON.stringify(output)).not.toContain(
    String(entry.arguments.responseKey),
  );
}

async function expectNoLegacyPrivateResultChannel(app: FrameLocator) {
  const compatibility = await app.locator("html").evaluate(() => {
    const openai = (
      window as unknown as {
        openai?: {
          callTool?: unknown;
          toolResponseMetadata?: unknown;
        };
      }
    ).openai;
    return {
      callToolType: typeof openai?.callTool,
      toolResponseMetadata: openai?.toolResponseMetadata ?? null,
    };
  });
  expect(compatibility).toEqual({
    callToolType: "undefined",
    toolResponseMetadata: null,
  });
}

async function expectOnlySealedStructuredResultsForCurrentWorkflow(
  page: Page,
) {
  const proofs = (await directResultProofs(page)).filter((proof) =>
    [currentWorkflowCreateTool, currentWorkflowActionTool].includes(
      proof.toolName as
        | typeof currentWorkflowCreateTool
        | typeof currentWorkflowActionTool,
    ),
  );
  expect(proofs.length).toBeGreaterThanOrEqual(2);
  for (const proof of proofs) {
    expect(proof.topLevelKeys).toEqual(["structuredContent"]);
    expect(proof.hasMetadata).toBe(false);
    expect(proof.structuredContentKeys).toContain("sealedSnapshot");
  }
  const labels = await sentToolNotificationLabels(page);
  expect(
    labels.filter(
      (label) =>
        label.includes(currentWorkflowCreateTool) ||
        label.includes(currentWorkflowActionTool),
    ),
  ).toEqual([]);
}

async function waitForWorkflowAction(page: Page, action: string) {
  await expect
    .poll(async () =>
      (await capturedToolCalls(page)).some(
        (call) =>
          browserWorkflowActionTools.has(call.name ?? "") &&
          call.arguments?.action === action,
      ),
    )
    .toBe(true);
}

async function waitForServerWorkflowResult(
  results: ServerToolResult[],
  action: string,
  afterIndex = 0,
  timeoutMs?: number,
) {
  await expect
    .poll(
      () =>
        results
          .slice(afterIndex)
          .some(
            (entry) =>
              browserWorkflowActionTools.has(entry.name) &&
              entry.arguments.action === action,
          ),
      timeoutMs === undefined ? undefined : { timeout: timeoutMs },
    )
    .toBe(true);
  return results
    .slice(afterIndex)
    .filter(
      (entry) =>
        browserWorkflowActionTools.has(entry.name) &&
        entry.arguments.action === action,
    )
    .at(-1)!;
}

async function waitForServerToolResult(
  results: ServerToolResult[],
  name: string,
  afterIndex = 0,
) {
  await expect
    .poll(() =>
      results.slice(afterIndex).some((entry) => entry.name === name),
    )
    .toBe(true);
  return results
    .slice(afterIndex)
    .filter((entry) => entry.name === name)
    .at(-1)!;
}

async function exerciseAssessmentUnavailableScreen03Reminders(
  app: FrameLocator,
  serverToolResults: ServerToolResult[],
) {
  await expect(app.getByTestId("screen03")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(app.getByTestId("screen03-coverage-map")).toContainText(
    "Finished",
  );

  const checks = app.getByTestId("screen03-assessment-unavailable-checks");
  await expect(checks).toBeVisible();
  await expect(
    checks.getByRole("heading", {
      name: "Additional checks to keep in mind",
    }),
  ).toBeVisible();
  await expect(
    checks.locator('li[data-testid^="screen03-assessment-check-"]'),
  ).toHaveCount(screen02AssessmentUnavailableScreen03Checks.length);
  await expect(checks.locator(".s3-count")).toHaveText("6 reminders");
  await expect(checks).toContainText(
    "These reminders were carried forward because the preliminary Screen 2 assessment was unavailable.",
  );
  await expect(checks).toContainText(
    "They do not change the verified Event Card and do not block continuation.",
  );

  for (const [index, check] of
    screen02AssessmentUnavailableScreen03Checks.entries()) {
    const number = index + 1;
    await expect(app.getByTestId(`screen03-assessment-check-${number}`))
      .toContainText(check);
  }
  await expect(
    checks.locator('button[data-testid*="screen03-assessment-check-"]'),
  ).toHaveCount(0);

  await expect(app.getByTestId("screen03-confirm-all")).toHaveText(
    "Confirm directly supported claims",
  );
  const beforeClaimReview = serverToolResults.length;
  await app.getByTestId("screen03-confirm-all").click();
  const claimReview = await waitForServerToolResult(
    serverToolResults,
    SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
    beforeClaimReview,
  );
  expect(
    record(claimReview.arguments.action, "Screen 3 bulk review action"),
  ).toMatchObject({ type: "review-all-fields", mode: "confirm" });
  const bulkReviewedState = await privateScreen03State(claimReview);
  const bulkReviewedClaims = screen03FactualClaims(
    bulkReviewedState.proposals,
  );
  const nonconfirmableClaims = bulkReviewedClaims.filter(
    (proposal) =>
      !screen03ProposalConfirmability(
        proposal,
        bulkReviewedState.evidence,
      ).confirmable,
  );
  expect(nonconfirmableClaims.length).toBeGreaterThan(0);
  expect(
    bulkReviewedClaims.every((proposal) =>
      screen03ProposalConfirmability(
          proposal,
          bulkReviewedState.evidence,
        ).confirmable
        ? proposal.reviewStatus === "accepted" ||
          proposal.reviewStatus === "edited"
        : proposal.reviewStatus === "proposed"
    ),
  ).toBe(true);
  const reminderIds = screen02AssessmentUnavailableScreen03Checks.map(
    (_check, index) => `carried:assessment-unavailable-check:${index + 1}`,
  );
  expect(
    bulkReviewedState.proposals.requiredVariable
      .filter((proposal) => reminderIds.includes(proposal.id))
      .every((proposal) => proposal.reviewStatus === "proposed"),
  ).toBe(true);

  for (const proposal of nonconfirmableClaims) {
    const beforeDecision = serverToolResults.length;
    await app.getByTestId(`screen03-unresolved-${proposal.id}`).click();
    const decision = await waitForServerToolResult(
      serverToolResults,
      SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
      beforeDecision,
    );
    expect(
      record(decision.arguments.action, "Screen 3 individual review action"),
    ).toMatchObject({
      type: "review-field",
      proposalId: proposal.id,
      decision: "unresolved",
    });
  }

  const finishGate = app.getByTestId("screen03-finish-gate");
  await expect(finishGate).toHaveAttribute("data-status", "ready");
  const save = app.getByTestId("screen03-save-event-card");
  await expect(save).toBeEnabled();

  const beforeLock = serverToolResults.length;
  await save.click();
  const lock = await waitForServerToolResult(
    serverToolResults,
    SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
    beforeLock,
  );
  expect(record(lock.arguments.action, "Screen 3 lock action")).toMatchObject({
    type: "lock-event-card",
  });
  const lockedState = await privateScreen03State(lock);
  expect(lockedState.status).toBe("locked");
  expect(lockedState.lockedEventCard?.acceptedProposals.requiredVariable)
    .toEqual([]);
  expect(lockedState.lockedEventCard?.reviewedProposals.requiredVariable)
    .toEqual([]);
  const reminderLimitationIds = [
    ...(lockedState.lockedEventCard?.limitations.unknownProposalIds ?? []),
    ...(lockedState.lockedEventCard?.limitations.rejectedProposalIds ?? []),
    ...(lockedState.lockedEventCard?.limitations.unsupportedProposalIds ?? []),
  ];
  for (const reminderId of reminderIds) {
    expect(reminderLimitationIds).not.toContain(reminderId);
  }
  await expect(app.getByTestId("screen03")).toHaveAttribute(
    "data-screen03-status",
    "locked",
  );
  await expect(finishGate).toHaveAttribute("data-status", "locked");
}

async function exerciseScreen03FullEventCardJourney(
  app: FrameLocator,
  serverToolResults: ServerToolResult[],
  mode: "find" | "audit",
  page: Page,
  testInfo: TestInfo,
  heldReview?: { wait: () => Promise<void>; release: () => void },
) {
  await expect(app.getByTestId("screen03")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(app.getByTestId("screen03-open-screen04")).toHaveCount(0);
  await expect(app.getByTestId("screen04-entry-gate")).toContainText(
    "Finish verifying the shock first",
  );
  await expect(app.getByTestId("screen04-entry-gate")).toContainText(
    "Resolve all visible factual claims and lock the Event Card before auditing exposure in your sample.",
  );
  await expect(
    app.getByRole("button", {
      name: /Step 4: Audit exposure in your sample, unavailable/i,
    }),
  ).toBeDisabled();
  const initialOverview = app.getByTestId("screen03-understand-shock");
  await expectCurrentScreen03Orientation(initialOverview, mode === "audit" ? 0 : 1);
  if (mode === "audit") {
    // The fixed Audit dossier has no substantive orientation bullets before
    // researcher review; exact source evidence is available in the fields.
    await expect(initialOverview.getByTestId("screen03-orientation-summary"))
      .toHaveText("California Consumer Privacy Act is a privacy legislation.");
    await expect(initialOverview.getByTestId("screen03-orientation-key-points"))
      .toHaveCount(0);
  }
  await expect(app.getByTestId("screen03-request-host-reasoning")).toHaveCount(0);
  const openedScreen03 = serverToolResults.findLast(
    (entry) => entry.name === SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
  );
  if (!openedScreen03) {
    throw new Error("The active Screen 3 journey has no canonical open result.");
  }
  const initialReviewState = await privateScreen03State(
    openedScreen03,
    "open",
  );
  // The deterministic GDELT fixture returns no articles. Preserve that
  // canonical empty result instead of manufacturing a contextual source.
  expect(initialReviewState.contextLeads).toEqual([]);
  await expect(app.getByTestId("screen03-context-leads")).toHaveCount(0);
  await expect(app.getByRole("link", { name: "Find this title" })).toHaveCount(0);

  const canonicalFactualIds = screen03FactualClaims(
    initialReviewState.proposals,
  ).map((proposal) => proposal.id);
  const reviewControls = app.locator(
    '[data-testid^="screen03-review-"][data-proposal-id]',
  );
  const proposalIds = await reviewControls.evaluateAll((elements) =>
    elements.map((element) =>
      element.getAttribute("data-testid")!.slice("screen03-review-".length),
    ),
  );
  expect(proposalIds.length).toBeGreaterThan(0);
  expect(new Set(proposalIds).size).toBe(proposalIds.length);
  expect([...proposalIds].sort()).toEqual([...canonicalFactualIds].sort());
  await expect(
    app.getByRole("heading", { name: "Confirm directly supported claims" }),
  ).toBeVisible();
  await expect(app.getByTestId("screen03-bulk-review")).toContainText(
    "Confirm every visible claim that has active direct official support.",
  );
  await expect(app.getByTestId("screen03-bulk-review-status")).toHaveText(
    `0 confirmed · ${proposalIds.length} still need${proposalIds.length === 1 ? "s" : ""} review · 0 not correct`,
  );
  await expect(app.getByTestId("screen03-confirm-all")).toHaveText(
    "Confirm directly supported claims",
  );
  await expect(
    app.locator('[data-testid^="screen03-review-"][data-proposal-id]'),
  ).toHaveCount(proposalIds.length);
  const nextUndecided = app.getByTestId("screen03-next-undecided-claim");
  const firstPendingCard = app.locator("article.s3-field--proposed").first();
  await expect(nextUndecided).toBeVisible();
  await expect(app.getByTestId("screen03-finish-gate")).toContainText(
    "The next is in “Event identity and summary”",
  );
  await nextUndecided.click();
  await expect(firstPendingCard).toBeFocused();

  const unavailableConfirm = reviewControls
    .locator('button[data-testid^="screen03-confirm-"]:disabled')
    .first();
  await expect(unavailableConfirm).toBeVisible();
  await expect(unavailableConfirm).toBeDisabled();
  await expect(unavailableConfirm).toHaveText("Confirm");
  const unavailableConfirmId = (
    await unavailableConfirm.getAttribute("data-testid")
  )
    ?.slice("screen03-confirm-".length);
  expect(unavailableConfirmId).toBeTruthy();
  await expect(
    app.getByTestId(`screen03-confirm-guidance-${unavailableConfirmId}`),
  ).toContainText(
    "Confirm becomes available when an official field or quoted passage directly supports this claim. Find support or choose another decision.",
  );
  await expect(
    app.getByTestId(`screen03-unresolved-${unavailableConfirmId}`),
  ).toBeEnabled();
  await expect(app.getByText("Why can’t I confirm?", { exact: true }))
    .toHaveCount(0);
  await expect(app.getByText("What is missing?", { exact: true }))
    .toHaveCount(0);

  async function firstEnabled(candidates: Locator, label: string) {
    const count = await candidates.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      if ((await candidate.isVisible()) && (await candidate.isEnabled())) {
        return candidate;
      }
    }
    throw new Error(`Expected an enabled ${label}.`);
  }

  function proposalIdFromButton(
    testId: string | null,
    prefix: string,
    label: string,
  ) {
    if (!testId?.startsWith(prefix) || testId.length === prefix.length) {
      throw new Error(`Expected a stable ${label} identifier.`);
    }
    return testId.slice(prefix.length);
  }

  let lastResultRevision: number | null = null;
  let checkedSavingState = false;
  const reviewed = new Map<
    string,
    {
      decision: "accept" | "unresolved" | "reject";
      directlySupported: boolean;
    }
  >();

  async function mutationAfter(
    trigger: () => Promise<void>,
    label: string,
  ) {
    const beforeMutation = serverToolResults.length;
    await trigger();
    const mutation = await waitForServerToolResult(
      serverToolResults,
      SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
      beforeMutation,
    );
    expect(mutation.result.isError, label).not.toBe(true);
    const expectedRevision = Number(
      mutation.arguments.expectedScreen03Revision,
    );
    expect(Number.isSafeInteger(expectedRevision), label).toBe(true);
    if (lastResultRevision !== null) {
      expect(expectedRevision, label).toBe(lastResultRevision);
    }
    const nextState = await privateScreen03State(mutation);
    expect(nextState.revision, label).toBeGreaterThan(expectedRevision);
    lastResultRevision = nextState.revision;
    return mutation;
  }

  async function reviewProposal(
    proposalId: string,
    decision: "accept" | "unresolved" | "reject",
    interaction: "mouse" | "keyboard-space" = "mouse",
  ) {
    expect(reviewed.has(proposalId)).toBe(false);
    const prefix = decision === "accept"
      ? "screen03-confirm-"
      : decision === "reject"
        ? "screen03-reject-"
        : "screen03-unresolved-";
    const button = app.getByTestId(`${prefix}${proposalId}`);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    const fieldLabel = (await app
      .getByTestId(`screen03-review-${proposalId}`)
      .getAttribute("aria-label"))?.replace(/^Review /, "") ?? "";
    const mutation = await mutationAfter(
      async () => {
        if (interaction === "keyboard-space") {
          await button.focus();
          await expect(button).toBeFocused();
          await button.press("Space");
        } else {
          await button.click();
        }
        if (!checkedSavingState && heldReview) {
          checkedSavingState = true;
          await heldReview.wait();
          await expect(button).toHaveAttribute(
            "aria-label",
            `Saving ${fieldLabel}`,
          );
          await expect(button).toHaveAttribute("aria-busy", "true");
          await expect(button).toHaveText("Saving…");
          await expect(
            app.getByTestId(`screen03-decision-status-${proposalId}`),
          ).toHaveText("Saving this decision…");
          await expect(app.getByText("Saving your review", { exact: true }))
            .toBeVisible();
          await expect(
            app.getByText("Research in progress", { exact: true }),
          ).toHaveCount(0);
          heldReview.release();
        }
      },
      `review ${proposalId}`,
    );
    expect(
      record(mutation.arguments.action, "Screen 3 review action"),
    ).toMatchObject({
      type: "review-field",
      proposalId,
      decision,
    });
    const field = initialReviewState.proposals.timeline.some(
        (proposal) => proposal.id === proposalId,
      )
      ? app.getByTestId(`screen03-stage-${proposalId}`)
      : app.getByTestId(`screen03-field-${proposalId}`);
    await expect(field).toBeVisible();
    await expect(field.locator(".s3-tag").first()).toHaveText(
      decision === "accept"
        ? "Confirmed"
        : decision === "reject"
          ? "Marked not correct"
          : "Needs more evidence",
    );
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toHaveAttribute(
      "aria-label",
      `${decision === "accept" ? "Confirmed" : decision === "reject" ? "Marked not correct" : "Needs more evidence"}: ${fieldLabel}`,
    );
    await expect(button).toBeDisabled();
    await expect(button).toContainText(
      decision === "accept"
        ? "✓ Confirmed"
        : decision === "reject"
          ? "✓ Marked not correct"
          : "✓ Needs more evidence",
    );
    await expect(
      app.getByTestId(`screen03-decision-status-${proposalId}`),
    ).toHaveText(
      decision === "accept"
        ? "Saved: Confirmed."
        : decision === "reject"
          ? "Saved: Marked not correct."
          : "Saved: Needs more evidence.",
    );
    reviewed.set(proposalId, {
      decision,
      directlySupported: decision === "accept",
    });
  }

  async function correctDirectProposalTwice() {
    const passageTextById = new Map(
      initialReviewState.evidence.flatMap((evidence) =>
        evidence.passages.map((passage) => [passage.id, passage.text] as const)
      ),
    );
    const correctionCandidate = screen03FactualClaims(
      initialReviewState.proposals,
    )
      .filter(
        (proposal) =>
          proposal.group !== "timeline" &&
          proposal.group !== "identity" &&
          !reviewed.has(proposal.id) &&
          screen03ProposalConfirmability(
            proposal,
            initialReviewState.evidence,
          ).confirmable,
      )
      .flatMap((proposal) =>
        proposal.passageIds.flatMap((passageId) => {
          const compactPassage = (passageTextById.get(passageId) ?? "")
            .replace(/\s+/gu, " ")
            .trim();
          const sentenceCandidates = compactPassage
            .split(/(?<=[.!?])\s+/u)
            .filter((sentence) => sentence.length >= 24);
          return [compactPassage, ...sentenceCandidates]
            .filter(
              (value, index, values) =>
                value.length >= 24 &&
                value.length <= 4_000 &&
                value !== proposal.value.trim() &&
                values.indexOf(value) === index &&
                screen03ProposalConfirmability(
                  proposal,
                  initialReviewState.evidence,
                  value,
                  true,
                ).confirmable,
            )
            .map((firstCorrection) => ({ proposal, firstCorrection }));
        })
      )[0];
    if (!correctionCandidate) {
      throw new Error(
        "The active Screen 3 journey has no directly supported correction round-trip candidate.",
      );
    }
    const { proposal, firstCorrection } = correctionCandidate;
    const card = app.getByTestId(`screen03-field-${proposal.id}`);
    const correct = app.getByTestId(`screen03-correct-${proposal.id}`);

    async function saveCorrection(
      value: string,
      label: "first" | "second",
    ) {
      await expect(correct).toBeEnabled();
      await correct.click();
      const review = app.getByTestId(`screen03-review-${proposal.id}`);
      const editor = review.getByLabel("Corrected wording");
      await expect(editor).toBeVisible();
      if (label === "second") {
        await expect(editor).toHaveValue(firstCorrection);
      }
      await editor.fill(value);
      const save = app.getByTestId(`screen03-save-correction-${proposal.id}`);
      await expect(save).toBeEnabled();
      const mutation = await mutationAfter(
        () => save.click(),
        `${label} saved correction for ${proposal.id}`,
      );
      expect(
        record(mutation.arguments.action, `${label} correction action`),
      ).toMatchObject({
        type: "review-field",
        proposalId: proposal.id,
        decision: "edit",
        editedValue: value,
      });
      expect(
        screen03FactualClaims((await privateScreen03State(mutation)).proposals)
          .find((candidate) => candidate.id === proposal.id),
      ).toMatchObject({
        reviewStatus: "edited",
        editedValue: value,
      });
      await expect(card.locator(".s3-tag").first()).toHaveText(
        "Corrected and confirmed",
      );
      await expect(card).toContainText(value);
      await expect(correct).toHaveText("Correct again");
      await expect(correct).toHaveAttribute(
        "aria-label",
        `Correct ${proposal.label} again`,
      );
      await expect(correct).toBeEnabled();
    }

    await saveCorrection(firstCorrection, "first");
    const beforeResumeMutation = serverToolResults.findLast(
      (entry) => entry.name === SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
    );
    if (!beforeResumeMutation) throw new Error("Expected the saved correction result.");
    const beforeResumeState = await privateScreen03State(beforeResumeMutation);
    const beforeBackAndResume = serverToolResults.length;
    await app.getByTestId("screen03-back").click();
    await expect(app.getByTestId(`screen02-${mode}`)).toBeVisible();
    await app.getByRole("button", {
      name: /Step 3: Verify event and timing, available; resume Screen 3/i,
    }).click();
    await expect(app.getByTestId("screen03")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const resumed = await waitForServerToolResult(
      serverToolResults,
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      beforeBackAndResume,
    );
    expect(resumed.arguments).not.toHaveProperty("refresh");
    expect(resumed.result.structuredContent?.outcome).toBe("restored");
    expect(await privateScreen03State(resumed, "open")).toEqual(beforeResumeState);
    expect(serverToolResults.slice(beforeBackAndResume).filter(
      (entry) => entry.name === SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
    )).toHaveLength(0);
    await expect(card).toContainText(firstCorrection);
    await expect(correct).toHaveText("Correct again");
    await expect(correct).toBeEnabled();
    await saveCorrection(proposal.value, "second");
    reviewed.set(proposal.id, {
      decision: "accept",
      directlySupported: true,
    });
    return {
      proposalId: proposal.id,
      firstCorrection,
      restoredCorrection: firstCorrection,
      secondCorrection: proposal.value,
    };
  }

  const directIdentityButton = await firstEnabled(
    app
      .locator('section[aria-labelledby="s3-event-facts-title"]')
      .getByRole("button", {
        name: /^Confirm (?:Canonical (?:event )?title|Formal identifier)$/i,
      }),
    "directly supported identity confirmation",
  );
  const directIdentityProposalId = proposalIdFromButton(
    await directIdentityButton.getAttribute("data-testid"),
    "screen03-confirm-",
    "Screen 3 identity proposal",
  );
  expect(proposalIds).toContain(directIdentityProposalId);
  await reviewProposal(directIdentityProposalId, "accept");

  const directTimelineProposal = initialReviewState.proposals.timeline.find(
    (proposal) => proposal.support === "direct",
  );
  if (!directTimelineProposal) {
    throw new Error("The active Screen 3 journey has no direct timeline information.");
  }
  const directTimelineProposalId = directTimelineProposal.id;
  const initialTimelineReviewSnapshot = initialReviewState.proposals.timeline
    .map(({ id, reviewStatus, editedValue }) => ({
      id,
      reviewStatus,
      editedValue,
    }));
  expect(proposalIds).toContain(directTimelineProposalId);
  const directTimelineCard = app.getByTestId(
    `screen03-stage-${directTimelineProposalId}`,
  );
  await expect(directTimelineCard).toBeVisible();
  await expect(directTimelineCard.locator(".s3-tag")).toHaveText(
    "Needs your decision",
  );
  await expect(directTimelineCard.locator(".s3-time-card__claim-label"))
    .toHaveText("Source-linked date");
  await expect(
    app.getByTestId(`screen03-evidence-${directTimelineProposalId}`),
  ).toBeVisible();
  await expect(
    app.getByTestId(`screen03-review-${directTimelineProposalId}`),
  ).toBeVisible();
  await expect(
    app.getByTestId(`screen03-confirm-${directTimelineProposalId}`),
  ).toBeEnabled();
  await expect(
    app.locator(`[data-testid="screen03-plain-language-${directTimelineProposalId}"]`),
  ).toHaveCount(0);

  await reviewProposal(directTimelineProposalId, "accept");
  const correctionRoundTrip = await correctDirectProposalTwice();

  for (const proposalId of proposalIds) {
    if (reviewed.has(proposalId)) continue;
    const confirm = app.getByTestId(`screen03-confirm-${proposalId}`);
    await reviewProposal(
      proposalId,
      await confirm.isEnabled() ? "accept" : "unresolved",
    );
  }
  expect([...reviewed.keys()].sort()).toEqual([...proposalIds].sort());

  await expect(app.getByText("Choose a supported main study date", { exact: false }))
    .toHaveCount(0);
  await expect(app.getByText("Source conflicts and timeline warnings", { exact: true }))
    .toHaveCount(0);

  const unconfirmAllMutation = await mutationAfter(
    async () => {
      const unconfirmAll = app.getByTestId("screen03-unconfirm-all");
      await unconfirmAll.focus();
      await expect(unconfirmAll).toBeFocused();
      await unconfirmAll.press("Enter");
    },
    "unconfirm every Screen 3 claim atomically",
  );
  expect(
    record(unconfirmAllMutation.arguments.action, "Screen 3 unconfirm-all action"),
  ).toMatchObject({
    type: "review-all-fields",
    mode: "unconfirm",
  });
  const unconfirmedState = await privateScreen03State(
    unconfirmAllMutation,
  );
  const unconfirmedFactualClaims = screen03FactualClaims(
    unconfirmedState.proposals,
  );
  expect(unconfirmedFactualClaims.map((proposal) => proposal.id).sort())
    .toEqual([...proposalIds].sort());
  expect(
    unconfirmedFactualClaims.every(
      (proposal) =>
        proposal.reviewStatus === "proposed" && proposal.editedValue === null,
    ),
  ).toBe(true);
  expect(
    unconfirmedState.proposals.timeline.map(
      ({ id, reviewStatus, editedValue }) => ({
        id,
        reviewStatus,
        editedValue,
      }),
    ),
  ).toEqual(initialTimelineReviewSnapshot);
  await expect(app.getByTestId("screen03-finish-gate")).toHaveAttribute(
    "data-status",
    "blocked",
  );
  const unconfirmedById = new Map(
    unconfirmedFactualClaims.map((proposal) => [proposal.id, proposal]),
  );
  const bulkConfirmableIds = new Set(
    unconfirmedFactualClaims
      .filter((proposal) =>
        screen03ProposalConfirmability(
          proposal,
          unconfirmedState.evidence,
        ).confirmable
      )
      .map((proposal) => proposal.id),
  );
  expect(bulkConfirmableIds.size).toBeGreaterThan(0);
  expect(bulkConfirmableIds.size).toBeLessThan(
    unconfirmedFactualClaims.length,
  );

  const confirmAllMutation = await mutationAfter(
    () => app.getByTestId("screen03-confirm-all").click(),
    "confirm every supported Screen 3 claim atomically",
  );
  expect(
    record(confirmAllMutation.arguments.action, "Screen 3 confirm-all action"),
  ).toMatchObject({
    type: "review-all-fields",
    mode: "confirm",
  });
  const bulkReviewedState = await privateScreen03State(
    confirmAllMutation,
  );
  const bulkReviewedProposals = screen03FactualClaims(
    bulkReviewedState.proposals,
  );
  expect(bulkReviewedProposals).toHaveLength(proposalIds.length);
  for (const proposal of bulkReviewedProposals) {
    const beforeBulk = unconfirmedById.get(proposal.id);
    expect(beforeBulk).toBeDefined();
    if (bulkConfirmableIds.has(proposal.id)) {
      expect(proposal).toMatchObject({
        reviewStatus: "accepted",
        editedValue: null,
      });
    } else {
      expect(proposal).toEqual(beforeBulk);
    }
  }
  const stillNeedsReview = bulkReviewedProposals.length -
    bulkConfirmableIds.size;
  await expect(app.getByTestId("screen03-bulk-review-status")).toHaveText(
    `${bulkConfirmableIds.size} confirmed · ${stillNeedsReview} still need${stillNeedsReview === 1 ? "s" : ""} review · 0 not correct`,
  );
  await expect(app.getByTestId("screen03-finish-gate")).toHaveAttribute(
    "data-status",
    "blocked",
  );
  reviewed.clear();
  let rejectedWithKeyboard = false;
  for (const proposal of bulkReviewedProposals) {
    if (bulkConfirmableIds.has(proposal.id)) {
      reviewed.set(proposal.id, {
        decision: "accept",
        directlySupported: true,
      });
      continue;
    }
    await reviewProposal(
      proposal.id,
      rejectedWithKeyboard ? "unresolved" : "reject",
      rejectedWithKeyboard ? "mouse" : "keyboard-space",
    );
    rejectedWithKeyboard = true;
  }
  expect(rejectedWithKeyboard).toBe(true);
  const unresolvedAfterReview = stillNeedsReview - 1;
  await expect(app.getByTestId("screen03-bulk-review-status")).toHaveText(
    `${bulkConfirmableIds.size} confirmed · ${unresolvedAfterReview} still need${unresolvedAfterReview === 1 ? "s" : ""} review · 1 not correct`,
  );

  const reviewedOverview = app.getByTestId("screen03-understand-shock");
  // Accepted source-backed fields can refine the initial Audit orientation.
  await expectCurrentScreen03Orientation(reviewedOverview, mode === "audit" ? 0 : 1);
  await expect(reviewedOverview.getByTestId("screen03-orientation-provenance"))
    .toHaveCount(0);
  await expect(app.getByTestId("screen03-coverage-status")).toHaveCount(0);
  await expect(app.getByTestId("screen03-study-implications")).toHaveCount(0);
  await expect(app.locator('[data-testid^="screen03-plain-language-"]'))
    .toHaveCount(0);

  await expect(app.getByTestId("screen03-finish-gate")).toHaveAttribute(
    "data-status",
    "ready",
  );

  const beforeRefresh = serverToolResults.length;
  await app.getByTestId("screen03-refresh-research").click();
  const refreshed = await waitForServerToolResult(
    serverToolResults,
    SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
    beforeRefresh,
  );
  expect(refreshed.arguments.refresh).toBe(true);
  expect(refreshed.result.isError).not.toBe(true);
  expect(refreshed.result.structuredContent?.outcome).toBe("restored");
  const restoredAfterRefresh = await privateScreen03State(refreshed, "open");
  expect(
    screen03FactualClaims(restoredAfterRefresh.proposals).map((proposal) => ({
      id: proposal.id,
      reviewStatus: proposal.reviewStatus,
      editedValue: proposal.editedValue,
    })),
  ).toEqual(
    screen03FactualClaims(bulkReviewedState.proposals).map((proposal) => {
      const finalReview = reviewed.get(proposal.id);
      return {
        id: proposal.id,
        reviewStatus: finalReview?.decision === "reject"
          ? "rejected"
          : finalReview?.decision === "unresolved"
            ? "unresolved"
            : "accepted",
        editedValue: null,
      };
    }),
  );
  await expect(app.getByTestId("screen03")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    app
      .getByTestId(`screen03-field-${directIdentityProposalId}`)
      .locator(".s3-tag")
      .first(),
  ).toHaveText("Confirmed");
  await expect(
    app
      .getByTestId(`screen03-stage-${directTimelineProposalId}`)
      .locator(".s3-tag")
      .first(),
  ).toHaveText("Confirmed");
  await expect(app.getByTestId("screen03-finish-gate")).toHaveAttribute(
    "data-status",
    "ready",
  );

  const lockMutation = await mutationAfter(
    () => app.getByTestId("screen03-save-event-card").click(),
    "lock verified Screen 3 Event Card",
  );
  expect(
    record(lockMutation.arguments.action, "Screen 3 lock action"),
  ).toMatchObject({ type: "lock-event-card" });
  const lockedState = await privateScreen03State(lockMutation);
  expect(lockedState).toMatchObject({
    status: "locked",
    revision:
      Number(lockMutation.arguments.expectedScreen03Revision) + 1,
    outcomeValuesInspected: false,
    focalClock: {
      selectedProposalId: null,
      alternativeProposalIds: [],
    },
    lockedEventCard: {
      outcomeValuesInspected: false,
      focalClock: {
        selected: null,
        alternatives: [],
      },
    },
  });
  expect(lockedState.lockedEventCard).not.toBeNull();
  expect(lockedState.contextLeads).toEqual(initialReviewState.contextLeads);
  expect(lockedState.contextLeads).toEqual([]);
  expect(
    lockedState.lockedEventCard!.acceptedProposals.identity,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: directIdentityProposalId,
        decision: "accepted",
        support: "direct",
        passageIds: expect.arrayContaining([expect.any(String)]),
      }),
    ]),
  );
  expect(lockedState.lockedEventCard!.acceptedProposals.timeline).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: directTimelineProposalId,
        decision: "accepted",
        support: "direct",
        passageIds: expect.arrayContaining([expect.any(String)]),
      }),
    ]),
  );
  expect(lockedState.lockedEventCard!.reviewedProposals.timeline).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: directTimelineProposalId,
        decision: "accepted",
        support: "direct",
      }),
    ]),
  );
  expect(lockedState.lockedEventCard!.reviewedProposals.timeline).toHaveLength(
    bulkReviewedState.proposals.timeline.length,
  );
  const acceptedTimelineIds = bulkReviewedState.proposals.timeline
    .filter(
      (proposal) =>
        proposal.reviewStatus === "accepted" ||
        proposal.reviewStatus === "edited",
    )
    .map((proposal) => proposal.id);
  expect(
    lockedState.lockedEventCard!.timeline
      .map((entry) => entry.proposalId)
      .sort(),
  ).toEqual([...acceptedTimelineIds].sort());
  expect(lockedState.lockedEventCard!.timeline).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        proposalId: directTimelineProposalId,
        stage: directTimelineProposal.stage,
        proposedDate: directTimelineProposal.date,
        resolvedDate:
          directTimelineProposal.editedValue ?? directTimelineProposal.date,
        passageIds: expect.arrayContaining([expect.any(String)]),
      }),
    ]),
  );
  expect(lockedState.history).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "review-field",
        targetId: directTimelineProposalId,
        nextReviewStatus: "accepted",
      }),
    ]),
  );
  for (const [proposalId, review] of reviewed) {
    expect(lockedState.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "review-field",
          targetId: proposalId,
          nextReviewStatus:
            review.decision === "accept"
              ? "accepted"
              : review.decision === "reject"
                ? "rejected"
                : "unresolved",
        }),
      ]),
    );
  }
  expect(lockedState.history).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "review-field",
        targetId: directIdentityProposalId,
      }),
    ]),
  );
  expect(lockedState.history.at(-1)).toMatchObject({
    action: "lock-event-card",
    targetId: null,
    value: lockedState.lockedEventCard!.eventCardFingerprint,
  });
  await expect(app.getByTestId("screen04")).toBeVisible();
  await expect(
    app.getByRole("heading", {
      level: 1,
      name: "Audit exposure in your sample",
    }),
  ).toBeVisible();
  await expect(
    app.getByText(/^Shock being assessed:/u),
  ).toBeVisible();
  await expect(
    app.getByRole("button", {
      name: /Step 4: Audit exposure in your sample, current/i,
    }),
  ).toHaveAttribute("aria-current", "step");

  const screen04 = app.getByTestId("screen04");
  const forbiddenReaderText = [
    "Locked Event Card",
    "Exact shock binding",
    "screen03-proposal-",
    "screen03-evidence-",
    "machine-executable",
    "compiler contract",
    "machine-typed",
    "Software / rule version",
    "screen-04-audit-engine",
    "screen-04-rule-ast",
    "SCREEN04_",
    "Blocks full exposure",
    "Result fingerprint",
    "Reproducible exports",
    "What was assessed",
    "What could not be assessed",
  ] as const;

  async function expectReaderSafeScreen04() {
    const readerSurface = await screen04.evaluate((root) => ({
      text: root.textContent ?? "",
      attributes: Array.from(
        root.querySelectorAll("[aria-label], [aria-description], [title]"),
      ).flatMap((element) => [
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("aria-description") ?? "",
        element.getAttribute("title") ?? "",
      ]).join("\n"),
    }));
    for (const forbidden of forbiddenReaderText) {
      expect(readerSurface.text, `${forbidden} in visible Screen 4 text`).not
        .toContain(forbidden);
      expect(readerSurface.attributes, `${forbidden} in accessible metadata`).not
        .toContain(forbidden);
    }
  }

  await expect(screen04).toHaveAttribute("data-mode", "dataset");
  await expect(screen04).toContainText(
    "Screen 4 uses the shock facts you confirmed in Screen 3.",
  );
  await expectReaderSafeScreen04();

  // Nodata mode is a first-class, reversible route and keeps its own work.
  await app.getByTestId("screen04-mode-switch").click();
  await expect(screen04).toHaveAttribute("data-mode", "nodata");
  const nodataForm = app.getByTestId("screen04-nodata-form");
  await expect(nodataForm).toBeVisible();
  await expect(app.getByTestId("screen04-file-input")).toHaveCount(0);
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await nodataForm.getByLabel(/^Unit of analysis/u).fill("Firm-year");
  await nodataForm.getByLabel(/^Sample units/u).fill(
    "U.S. publicly listed technology firms",
  );
  await nodataForm.getByLabel(/^Data frequency/u).selectOption("annual");
  await nodataForm.getByLabel(/^Sample start year/u).fill("2017");
  await nodataForm.getByLabel(/^Sample end year/u).fill("2021");
  await nodataForm.getByLabel(/^Treatment year/u).fill("2020");
  await nodataForm.getByLabel(/^Treatment-group description/u).fill(
    "Firms headquartered in California",
  );
  await nodataForm.getByLabel(/^Control-group description/u).fill(
    "Firms headquartered outside California",
  );
  await nodataForm.getByLabel(/^Main basis distinguishing the groups/u)
    .selectOption("geography");
  await nodataForm.getByLabel(/^Geographic concept used for the groups/u)
    .selectOption("headquarters");
  await nodataForm.getByRole("button", {
    name: "Save this sample description and continue",
  }).click();
  await expect(screen04).toHaveAttribute("data-status", "ready-to-continue");
  await expect(app.getByTestId("screen04-ready")).toContainText(
    "Sample profile saved",
  );
  await expectNoSeriousOrCriticalWcagViolations(
    page,
    testInfo,
    `simulated-${mode}-screen04-nodata`,
  );

  await app.getByTestId("screen04-mode-switch").click();
  await expect(screen04).toHaveAttribute("data-mode", "dataset");

  const issueRichCsv = await readFile(
    new URL(
      "../fixtures/screen04/CCPA_Screen4_issue_rich.csv",
      import.meta.url,
    ),
    "utf8",
  );
  const issueRichFilename = `${mode}-CCPA_Screen4_issue_rich.csv`;
  await app.getByTestId("screen04-file-input").setInputFiles({
    name: issueRichFilename,
    mimeType: "text/csv",
    buffer: Buffer.from(issueRichCsv, "utf8"),
  });
  await expect(app.getByTestId("screen04-file-name")).toContainText(
    issueRichFilename,
  );
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await expect(app.getByTestId("screen04-priority-finding")).toHaveCount(0);
  await expect(app.getByTestId("screen04-action-bar")).toHaveAttribute(
    "data-state",
    "incomplete-setup",
  );
  await expect(app.getByTestId("screen04-calculate")).toBeDisabled();

  const datasetForm = app.locator("form.s4-form");
  await datasetForm.getByLabel(/^Unit of analysis/u).fill("Firm-year");
  await datasetForm.getByLabel(/^Sample units/u).fill(
    "U.S. publicly listed technology firms",
  );
  await datasetForm.getByLabel(/^What does your treatment group represent/u)
    .fill("Firms headquartered in California");
  await datasetForm.getByLabel(/^What does your control group represent/u)
    .fill("Firms headquartered outside California");
  await datasetForm.getByLabel(/^What mainly distinguishes the two groups/u)
    .selectOption("geography");
  await datasetForm.getByLabel(/^Geographic concept used for the groups/u)
    .selectOption("headquarters");
  await datasetForm.getByLabel(/^Geographic concept used by the shock/u)
    .selectOption("operating-location");
  await datasetForm.getByLabel(/^Dataset assignment unit/u)
    .selectOption("parent-company");
  await datasetForm.getByLabel(/^Unit to which the shock applies/u)
    .selectOption("firm");
  await app.locator("#s4-unit").selectOption("GVKEY");
  await app.locator("#s4-year").selectOption("Year");
  await app.locator("#s4-group").selectOption("ProposedGroup");
  const treatmentYearField = datasetForm.getByLabel(/^Treatment year/u);
  await treatmentYearField.pressSequentially("202");
  await expect(treatmentYearField).toHaveValue("202");
  // insertText emits text input without key-by-key events, matching paste/IME
  // entry; fill below covers a browser/autofill-style full replacement.
  await page.keyboard.insertText("0");
  await expect(treatmentYearField).toHaveValue("2020");
  await treatmentYearField.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await treatmentYearField.press("Backspace");
  await expect(treatmentYearField).toHaveValue("");
  await treatmentYearField.fill("2020");
  await expect(treatmentYearField).toHaveValue("2020");
  await datasetForm.getByLabel(/^Exact treated value/u).fill("T");
  await datasetForm.getByLabel(/^Exact comparison value/u).fill("C");
  const exposureDetails = app.getByTestId("screen04-exposure-details");
  await expect(exposureDetails).not.toHaveAttribute("open", "");
  await expect(
    datasetForm.getByLabel("Skip this optional check", { exact: false }),
  ).toBeChecked();
  await exposureDetails.locator("summary").click();
  await expect(exposureDetails).toHaveAttribute("open", "");
  await datasetForm.getByLabel(
    "Use dataset fields to determine who was covered",
    { exact: false },
  ).check();
  const addCondition = datasetForm.getByRole("button", {
    name: "Add field",
    exact: true,
  });
  const conditions = app.getByTestId("screen04-exposure-condition");

  const businessNexus = conditions.nth(0);
  await businessNexus.getByLabel("Exposure dimension")
    .selectOption("geography");
  await businessNexus.getByLabel("Condition type")
    .selectOption("categorical-equals");
  await businessNexus.getByLabel("Exact CSV column")
    .selectOption("DoesBusinessCA");
  await businessNexus.getByLabel(/^Exact value meaning condition met/u)
    .fill("yes");
  await businessNexus.getByLabel("Effective year", { exact: true }).fill("2020");

  await addCondition.click();
  const threshold = conditions.nth(1);
  await threshold.getByLabel("Exposure dimension").selectOption("threshold");
  await threshold.getByLabel("Condition type")
    .selectOption("numeric-threshold");
  await threshold.getByLabel("Exact CSV column")
    .selectOption("Revenue2017M");
  await threshold.getByLabel("Comparison").selectOption(">=");
  await threshold.getByLabel("Threshold value").fill("25");
  await threshold.getByLabel("Threshold unit").fill("USD millions");
  await threshold.getByLabel("Unit used by the CSV values")
    .fill("USD millions");
  await threshold.getByLabel("Required historical measurement year")
    .fill("2017");
  await threshold.getByLabel("Historical year used by the CSV values")
    .fill("2017");
  await threshold.getByRole("button", {
    name: "Add alternative threshold",
  }).click();
  await threshold.getByLabel("Alternative threshold column")
    .selectOption("DataVolumeThousands");
  await threshold.getByLabel("Comparison").last().selectOption(">=");
  await threshold.getByLabel("Threshold value").last().fill("50");
  await threshold.getByLabel("Threshold unit").last().fill("thousands");
  await threshold.getByLabel("Unit used by the CSV values").last()
    .fill("thousands");
  await threshold.getByLabel("Required historical measurement year").last()
    .fill("2017");
  await threshold.getByLabel("Historical year used by the CSV values").last()
    .fill("2017");

  await addCondition.click();
  const exemption = conditions.nth(2);
  await exemption.getByLabel("Exposure dimension").selectOption("exemption");
  await exemption.getByLabel("Condition type").selectOption("exemption");
  await exemption.getByLabel("Exact CSV column").selectOption("Exempt");
  await exemption.getByLabel(/^Exact value meaning exempt/u).fill("yes");
  await expect(conditions).toHaveCount(3);

  const calculate = app.getByTestId("screen04-calculate");
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await expect(app.getByTestId("screen04-priority-finding")).toHaveCount(0);
  await expect(app.getByTestId("screen04-action-bar")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await expect(calculate).toBeEnabled();

  const layoutEvidence: Array<Record<string, unknown>> = [];
  if (mode === "find") {
    const layoutMatrix = [
      { width: 390, heightPx: 500, composerHeightPx: 76, zoom: 1 },
      { width: 768, heightPx: 600, composerHeightPx: 88, zoom: 1.25 },
      { width: 1_024, heightPx: 700, composerHeightPx: 88, zoom: 1.5 },
      { width: 1_440, heightPx: 800, composerHeightPx: 88, zoom: 1 },
    ] as const;
    const composer = page.getByTestId("simulated-chatgpt-composer");
    await expect(composer).toBeVisible();

    for (const layout of layoutMatrix) {
      await page.setViewportSize({
        width: layout.width,
        height: layout.heightPx + 80,
      });
      await page.evaluate(({ heightPx, composerHeightPx }) => {
        const setter = (
          window as unknown as {
            __shockAuditSetRepresentativeHostLayout?: (value: {
              heightPx: number;
              composerHeightPx: number;
            }) => void;
          }
        ).__shockAuditSetRepresentativeHostLayout;
        if (!setter) {
          throw new Error("The representative ChatGPT host layout is unavailable.");
        }
        setter({ heightPx, composerHeightPx });
      }, layout);
      await app.locator("html").evaluate((root, zoom) => {
        root.style.zoom = String(zoom);
      }, layout.zoom);

      await expect(calculate).toBeVisible();
      await calculate.click({ trial: true });
      await calculate.focus();
      // Exercise keyboard entry before checking the keyboard-only focus ring.
      await calculate.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(calculate).toBeFocused();
      const focusEvidence = await calculate.evaluate((button) => {
        const style = getComputedStyle(button);
        return {
          focusVisible: button.matches(":focus-visible"),
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      });
      expect(
        focusEvidence.focusVisible ||
          (focusEvidence.outlineStyle !== "none" &&
            Number.parseFloat(focusEvidence.outlineWidth) >= 2),
      ).toBe(true);

      const finalEffectiveYear = conditions.last().getByLabel(
        "Effective year",
        { exact: true },
      );
      await finalEffectiveYear.evaluate((field) => {
        field.scrollIntoView({ block: "center", inline: "nearest" });
      });
      await expect(finalEffectiveYear).toBeVisible();
      const actionBox = await app.getByTestId("screen04-action-bar")
        .boundingBox();
      const buttonBox = await calculate.boundingBox();
      const fieldBox = await finalEffectiveYear.boundingBox();
      const composerBox = await composer.boundingBox();
      if (!actionBox || !buttonBox || !fieldBox || !composerBox) {
        throw new Error("Representative host geometry was unavailable.");
      }
      expect(buttonBox.y).toBeGreaterThanOrEqual(0);
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(
        composerBox.y - 1,
      );
      expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(
        composerBox.y - 1,
      );
      expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(
        actionBox.y - 1,
      );
      const composerEvidence = await composer.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const topmost = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        );
        return {
          pointerEvents: getComputedStyle(element).pointerEvents,
          topmost: Boolean(topmost && element.contains(topmost)),
        };
      });
      expect(composerEvidence).toEqual({
        pointerEvents: "auto",
        topmost: true,
      });
      await expectNoHorizontalPageOverflow(app);
      layoutEvidence.push({
        ...layout,
        safeAreaBottomPx: 16,
        actionBox,
        buttonBox,
        finalFieldBox: fieldBox,
        composerBox,
        focusEvidence,
        composerEvidence,
      });
    }
    await testInfo.attach("screen04-representative-host-layout-matrix.json", {
      body: JSON.stringify(layoutEvidence, null, 2),
      contentType: "application/json",
    });
  }

  const serverCallsBeforeScreen04Calculation = serverToolResults.length;
  await calculate.click();
  const results = app.getByTestId("screen04-results");
  await expect(results).toBeVisible();
  await expect(results.getByRole("heading", {
    name: "Revise the treatment or comparison definition",
  })).toBeVisible();
  await expect(results).toContainText(
    "Why does your treatment coding differ from the shock rules?",
  );
  await expect(results).toContainText(
    "Proposed coding disagrees with verified coverage",
  );
  await expect(results).toContainText(
    "34 observations across 34 units disagree with the deterministic coverage classification or remain unresolved.",
  );
  await expect(results).toContainText(
    "How much could unknown exposure change your groups?",
  );
  await expect(results).toContainText(
    "Unknown exposure is concentrated in the comparison group",
  );
  await expect(results).toContainText(
    "10 of 34 operative classifications (29%) are unknown.",
  );
  await expect(results).toContainText("What ShockAudit found");
  await expect(results).toContainText("Why it matters");
  await expect(results).toContainText("Possible next step");
  await expect(results.getByRole("status")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  expect(await results.getByTestId("screen04-priority-finding").count())
    .toBeLessThanOrEqual(5);
  await expect(app.getByText("Reproducible exports", { exact: true }))
    .toHaveCount(0);
  await expect(screen04.getByRole("button", { name: /export|download/i }))
    .toHaveCount(0);
  expect(serverToolResults).toHaveLength(serverCallsBeforeScreen04Calculation);
  await expectReaderSafeScreen04();

  await datasetForm.getByLabel(/^What does your treatment group represent/u)
    .fill("Firms with headquarters in California");
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await expect(app.getByTestId("screen04-assessment-stale")).toContainText(
    "Your sample setup changed",
  );
  await expect(app.getByTestId("screen04-assessment-stale")).toContainText(
    "Run the assessment again to update the findings.",
  );
  await expect(app.getByTestId("screen04-action-bar")).toHaveAttribute(
    "data-state",
    "rerun-required",
  );
  await expect(calculate).toBeEnabled();
  await calculate.click();
  await expect(app.getByTestId("screen04-results")).toBeVisible();
  await expect(app.getByTestId("screen04-assessment-stale")).toHaveCount(0);
  await expect(app.getByTestId("screen04-action-bar")).toHaveAttribute(
    "data-state",
    "assessment-complete",
  );
  expect(serverToolResults).toHaveLength(serverCallsBeforeScreen04Calculation);

  await expectNoSeriousOrCriticalWcagViolations(
    page,
    testInfo,
    `simulated-${mode}-screen04-results`,
  );
  const savedAssessmentProvenance = await app
    .getByTestId("screen04-assessment-provenance").innerText();
  await screen04.getByRole("button", {
    name: "Save assessment and continue",
  }).click();
  await expect(app.getByTestId("screen04-ready")).toContainText(
    "Sample profile saved",
  );
  await expect(screen04).toHaveAttribute("data-status", "ready-to-continue");
  expect(serverToolResults).toHaveLength(serverCallsBeforeScreen04Calculation);

  // Switching modes hides the inactive controls/results without erasing work.
  await app.getByTestId("screen04-mode-switch").click();
  await expect(screen04).toHaveAttribute("data-mode", "nodata");
  await expect(app.getByTestId("screen04-file-input")).toHaveCount(0);
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await expect(nodataForm.getByLabel(/^Unit of analysis/u)).toHaveValue(
    "Firm-year",
  );
  await expect(nodataForm.getByLabel(/^Treatment year/u)).toHaveValue("2020");
  await app.getByTestId("screen04-mode-switch").click();
  await expect(screen04).toHaveAttribute("data-mode", "dataset");
  await expect(app.getByTestId("screen04-file-name")).toContainText(
    issueRichFilename,
  );
  await expect(screen04).toHaveAttribute("data-status", "ready-to-continue");
  const savedFindings = app.getByTestId("screen04-saved-findings");
  await expect(savedFindings).toBeVisible();
  await expect(savedFindings.getByTestId("screen04-assessment-provenance"))
    .toHaveText(savedAssessmentProvenance);

  const cleanCsv = await readFile(
    new URL(
      "../fixtures/screen04/CCPA_Screen4_clean.csv",
      import.meta.url,
    ),
    "utf8",
  );
  const cleanFilename = `${mode}-CCPA_Screen4_clean.csv`;
  await app.getByTestId("screen04-file-input").setInputFiles({
    name: cleanFilename,
    mimeType: "text/csv",
    buffer: Buffer.from(cleanCsv, "utf8"),
  });
  await expect(app.getByTestId("screen04-file-name")).toContainText(
    cleanFilename,
  );
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await expect(app.getByTestId("screen04-priority-finding")).toHaveCount(0);
  await expect(calculate).toBeEnabled();
  const serverCallsBeforeCleanCalculation = serverToolResults.length;
  await calculate.click();
  const cleanResults = app.getByTestId("screen04-results");
  await expect(cleanResults).toBeVisible();
  await expect(cleanResults).not.toContainText(
    "Why does your treatment coding differ from the shock rules?",
  );
  await expect(cleanResults).not.toContainText(
    "Proposed coding disagrees with verified coverage",
  );
  await expect(cleanResults).not.toContainText(
    "How much could unknown exposure change your groups?",
  );
  await expect(cleanResults).not.toContainText(
    "Unknown exposure is concentrated in the comparison group",
  );
  await expect(cleanResults).not.toContainText(/control contamination/i);
  await expect(cleanResults).not.toContainText(/highly imbalanced/i);
  await expect(app.getByTestId("screen04-assessment-provenance")).toContainText(
    "Assessment based on 80 rows, 20 units, and annual data from 2017 to 2021.",
  );
  expect(serverToolResults).toHaveLength(serverCallsBeforeCleanCalculation);

  // File/setup faults stay beside the controls and never become findings.
  const blockingCsv = await readFile(
    new URL(
      "../fixtures/screen04/CCPA_Screen4_blocking_errors.csv",
      import.meta.url,
    ),
    "utf8",
  );
  await app.getByTestId("screen04-file-input").setInputFiles({
    name: `${mode}-CCPA_Screen4_blocking_errors.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(blockingCsv, "utf8"),
  });
  const serverCallsBeforeBlockingCheck = serverToolResults.length;
  await app.getByTestId("screen04-calculate").click();
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await expect(
    datasetForm.getByTestId("screen04-setup-message").filter({
      hasText: "Duplicate unit-year",
    }),
  ).toBeVisible();
  await expect(app.locator("#s4-group-message")).toContainText(
    "Treatment-group membership changes",
  );
  await expect(app.getByTestId("screen04-priority-finding")).toHaveCount(0);
  expect(serverToolResults).toHaveLength(serverCallsBeforeBlockingCheck);
  await expectReaderSafeScreen04();

  await app.getByTestId("screen04-back").click();
  await expect(app.getByTestId("screen03")).toHaveAttribute(
    "data-screen03-status",
    "locked",
  );
  await expect(app.getByTestId("screen03-finish-gate")).toHaveAttribute(
    "data-status",
    "locked",
  );
  await expect(
    app.getByText("Verified Event Card saved", { exact: true }),
  ).toBeVisible();
  await expect(app.getByTestId("screen03-save-event-card")).toHaveCount(0);

  const advancedEvidence = await page.request.post(
    `${baseUrl}/__browser-fixture/advance-screen03-evidence`,
  );
  expect(advancedEvidence.ok()).toBe(true);
  expect(await advancedEvidence.json()).toMatchObject({
    revision: expect.any(Number),
  });
  const beforeChangedRefresh = serverToolResults.length;
  await app.getByTestId("screen03-refresh-research").click();
  const changedRefresh = await waitForServerToolResult(
    serverToolResults,
    SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
    beforeChangedRefresh,
  );
  expect(changedRefresh.arguments.refresh).toBe(true);
  expect(
    changedRefresh.result.isError,
    JSON.stringify(changedRefresh.result.content),
  ).not.toBe(true);
  expect(changedRefresh.result.structuredContent?.outcome).toBe("replaced");
  const reopenedState = await privateScreen03State(changedRefresh, "open");
  expect(reopenedState.status).toBe("reviewing");
  expect(reopenedState.lockedEventCard).toBeNull();
  expect(reopenedState.revision).toBeGreaterThan(lockedState.revision);
  lastResultRevision = reopenedState.revision;
  await expect(app.getByTestId("screen03")).toHaveAttribute(
    "data-screen03-status",
    "reviewing",
  );
  await expect(app.getByTestId("screen03-finish-gate")).toHaveAttribute(
    "data-status",
    "blocked",
  );

  const reconfirmChangedMutation = await mutationAfter(
    () => app.getByTestId("screen03-confirm-all").click(),
    "confirm changed Screen 3 evidence",
  );
  expect(
    record(
      reconfirmChangedMutation.arguments.action,
      "Screen 3 changed-evidence confirmation",
    ),
  ).toMatchObject({ type: "review-all-fields", mode: "confirm" });
  const reconfirmedChangedState = await privateScreen03State(
    reconfirmChangedMutation,
  );
  const changedClaimsStillAwaitingReview = screen03FactualClaims(
    reconfirmedChangedState.proposals,
  ).filter((proposal) => proposal.reviewStatus === "proposed");
  for (const proposal of changedClaimsStillAwaitingReview) {
    const decision = await mutationAfter(
      () => app.getByTestId(`screen03-unresolved-${proposal.id}`).click(),
      `resolve changed nonconfirmable claim ${proposal.id}`,
    );
    expect(
      record(decision.arguments.action, "changed claim review action"),
    ).toMatchObject({
      type: "review-field",
      proposalId: proposal.id,
      decision: "unresolved",
    });
  }
  await expect(app.getByTestId("screen03-finish-gate")).toHaveAttribute(
    "data-status",
    "ready",
  );

  const relockMutation = await mutationAfter(
    () => app.getByTestId("screen03-save-event-card").click(),
    "relock changed Screen 3 Event Card",
  );
  const relockedState = await privateScreen03State(relockMutation);
  expect(relockedState.status).toBe("locked");
  expect(relockedState.lockedEventCard).not.toBeNull();
  expect(relockedState.lockedEventCard?.eventCardFingerprint).not.toBe(
    lockedState.lockedEventCard?.eventCardFingerprint,
  );

  await expect(app.getByTestId("screen04")).toHaveAttribute(
    "data-status",
    "stale",
  );
  await expect(
    screen04.getByRole("heading", { name: "The verified shock changed" }),
  ).toBeVisible();
  await expect(app.getByTestId("screen04")).toContainText(
    "Review this sample again before relying on the earlier assessment.",
  );
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await expectReaderSafeScreen04();
  await app.getByTestId("screen04-start-fresh").click();
  await expect(app.getByTestId("screen04")).toHaveAttribute(
    "data-status",
    "no-file",
  );
  await expect(app.getByTestId("screen04-results")).toHaveCount(0);
  await expect(app.getByTestId("screen04-file-name")).toHaveCount(0);
  await expectReaderSafeScreen04();
  await app.getByTestId("screen04-back").click();
  await expect(app.getByTestId("screen03")).toHaveAttribute(
    "data-screen03-status",
    "locked",
  );

  await app.getByTestId("screen03-open-screen04").click();
  await expect(app.getByTestId("screen04")).toBeVisible();
  await expect(app.getByTestId("screen04-file-name")).toHaveCount(0);
  await expectReaderSafeScreen04();
  await app.getByTestId("screen04-back").click();

  const beforeBackAndResume = serverToolResults.length;
  await app.getByTestId("screen03-back").click();
  await expect(app.getByTestId(`screen02-${mode}`)).toBeVisible();
  await app
    .getByRole("button", {
      name: /Step 3: Verify event and timing, available; resume Screen 3/i,
    })
    .click();
  await expect(app.getByTestId("screen03")).toBeVisible();
  await expect(app.getByTestId("screen03")).toHaveAttribute(
    "data-screen03-status",
    "locked",
  );
  await expect(app.getByTestId("screen03-finish-gate")).toHaveAttribute(
    "data-status",
    "locked",
  );
  expect(relockedState.history.at(-1)).toMatchObject({
    action: "lock-event-card",
    value: relockedState.lockedEventCard!.eventCardFingerprint,
  });
  const resumedLockedCard = await waitForServerToolResult(
    serverToolResults,
    SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
    beforeBackAndResume,
  );
  expect(resumedLockedCard.arguments).not.toHaveProperty("refresh");
  expect(resumedLockedCard.result.structuredContent?.outcome).toBe("restored");
  expect(await privateScreen03State(resumedLockedCard, "open")).toEqual(relockedState);
  expect(serverToolResults.slice(beforeBackAndResume).filter(
    (entry) => entry.name === SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
  )).toHaveLength(0);

  return {
    reviewedFactualClaimCount: reviewed.size,
    informationalTimelineCount:
      relockedState.lockedEventCard!.timeline.length,
    acceptedDirectProposalCount: [...reviewed.values()].filter(
      (review) => review.directlySupported,
    ).length,
    unresolvedProposalCount: [...reviewed.values()].filter(
      (review) => review.decision === "unresolved",
    ).length,
    directIdentityProposalId,
    directTimelineProposalId,
    disabledConfirmReasonChecked: true,
    sourceConflictPanelRemoved: true,
    focalStudyDateRequired: false,
    bulkReviewRoundTripCompleted: true,
    correctionRoundTrip,
    finalRevision: relockedState.revision,
    historyEntryCount: relockedState.history.length,
    eventCardFingerprint:
      relockedState.lockedEventCard!.eventCardFingerprint,
    eventCardLocked: true,
    screen04OpenedImmediately: true,
    screen04CalculatedWithoutServerTool: true,
    screen04Fixture: "CCPA_Screen4_issue_rich.csv",
    screen04CleanFixture: "CCPA_Screen4_clean.csv",
    screen04BlockingFixture: "CCPA_Screen4_blocking_errors.csv",
    screen04NoFindingsBeforeExplicitAssessment: true,
    screen04StaleMappingRerunCompleted: true,
    screen04CleanNegativeFindingsChecked: true,
    screen04RepresentativeHostLayoutsChecked: layoutEvidence.length,
    screen04SetupIssuesStayedInline: true,
    screen04NodataSavedAndRestored: true,
    screen04ForbiddenReaderTextAbsent: true,
    screen04PriorityFindingLimitChecked: true,
    screen04ExportsAbsent: true,
    screen04StaleAfterEventCardRelock: true,
    screen04StaleResetCompleted: true,
    unchangedRefreshOutcome: refreshed.result.structuredContent?.outcome,
    backAndResumeUsedLocalCanonicalState: true,
    contextLeadCount: lockedState.contextLeads?.length ?? 0,
  };
}

function expectOnModeSearchExpansionIntegrity(
  state: Screen02WorkflowState,
) {
  const activeSet = state.mode === "find"
    ? state.candidateSets.find(
        (candidateSet) =>
          candidateSet.candidateSetSnapshotId ===
          state.activeCandidateSetSnapshotId,
      )
    : state.matchSets.find(
        (matchSet) =>
          matchSet.matchSetSnapshotId === state.activeMatchSetSnapshotId,
      );
  expect(activeSet).toBeDefined();
  const comparison = activeSet!.manifest.channels.find((channel) =>
    channel.channel.includes("baseline-versus-expanded comparison"),
  );
  expect(comparison).toBeDefined();
  expect(comparison!.status).toBe("searched");
  if (state.mode === "find") {
    const baseline = comparison!.note.match(
      /Baseline selected (\d+);.*Baseline preserved: (\d+)\./,
    );
    expect(baseline).not.toBeNull();
    expect(baseline?.[2]).toBe(baseline?.[1]);
    if (baseline?.[1] === "0") {
      expect(activeSet!.manifest.channels.some((channel) =>
        channel.status === "searched" &&
        (channel.channel === "bounded-reviewed-event-registry" ||
          channel.channel.includes("Reviewed event registry"))
      )).toBe(true);
      expect(state.candidates.length).toBeGreaterThan(0);
    }
    expect(activeSet!.manifest.queryMatrix.some((query) =>
      query.purpose.includes("Expanded") &&
      query.purpose.includes("Source role: official")
    )).toBe(true);
  } else {
    expect(comparison!.note).toMatch(
      /Baseline selected 0;.*Baseline preserved: 0\./,
    );
    expect(activeSet!.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: "reviewed-official-records",
        status: "searched",
      }),
    );
    expect(activeSet!.manifest.queryMatrix.some((query) =>
      query.purpose.includes("Expanded") &&
      query.purpose.includes("Source role: context")
    )).toBe(true);
    expect(state.possibleMatches.length).toBeGreaterThan(0);
  }
  expect(state.outcomeValuesInspected).toBe(false);
}

function workflowMutationArguments(
  snapshot: Screen02WorkflowClientSnapshot,
  operationId: string,
  action: string,
  payload: JsonObject,
): JsonObject {
  return {
    schemaVersion: "screen-02-workflow-action-v1",
    operationId,
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    expectedRevision: snapshot.revision,
    expectedStateFingerprint: snapshot.stateFingerprint,
    action,
    payload,
  };
}

async function openCanonicalWorkflow(
  page: Page,
  mode: "find" | "audit",
  options?: {
    studyContext?: ReturnType<typeof confirmedWorkflowAuditContext>;
    hostContext?: JsonObject;
    browserNowIso?: string;
    holdWorkflowAction?: string;
    holdWorkflowActionOccurrence?: 1 | 2;
    holdWorkflowCreate?: boolean;
    restoreAppliedScreen02HostTask?: boolean;
    holdScreen03Review?: boolean;
    hostModelResponder?: (
      request: HostModelRequest,
    ) => HostModelToolCall[] | Promise<HostModelToolCall[]>;
    hostSamplingResponder?: (
      request: HostSamplingRequest,
    ) => JsonObject | Promise<JsonObject>;
    messageResponseDelayMs?: number;
    toolResponseDelayMsByName?: Record<string, number>;
    suppressFirstModelToolResultNotificationFor?: string;
    hostCapabilities?: JsonObject;
    installChatGptCompatibilityBridge?: boolean;
    representativeHostShell?: {
      heightPx: number;
      composerHeightPx: number;
      safeAreaBottomPx: number;
    };
  },
) {
  const studyContext = options?.studyContext ??
    (mode === "find"
      ? confirmedWorkflowFindContext()
      : confirmedWorkflowAuditContext());
  const openArguments: JsonObject = {
    schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION,
    operationId: `${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}browser-${mode}-${Date.now()}-${++canonicalOpenSequence}`,
    studyContext,
  };
  const openResult = await callMcpTool(
    baseUrl,
    SCREEN_02_WORKFLOW_CREATE_TOOL_V023,
    openArguments,
  );
  expect(openResult.isError).not.toBe(true);
  expect(openResult.structuredContent).toMatchObject({
    schemaVersion: "screen-02-workflow-summary-v1",
    screen: "screen-02",
    ok: true,
    outcome: "created",
    mode,
  });
  let initialWorkflowResult = openResult;
  let snapshot = privateWorkflowSnapshot(openResult);
  expect(snapshot).toMatchObject({
    schemaVersion: "screen-02-workflow-client-v1",
    mode,
    assessmentAvailable: false,
    assessmentBatch: null,
  });
  if (options?.restoreAppliedScreen02HostTask) {
    initialWorkflowResult = await callMcpTool(
      baseUrl,
      workflowActionTool,
      workflowMutationArguments(
        snapshot,
        "browser-seed-host-review-candidate-pool",
        "find-search",
        { criteria: [] },
      ),
    );
    expect(initialWorkflowResult.isError).not.toBe(true);
    snapshot = privateWorkflowSnapshot(initialWorkflowResult);
  }
  const restoredHostTask = options?.restoreAppliedScreen02HostTask
    ? (() => {
        const state = stateFromScreen02WorkflowClientSnapshot(snapshot);
        if (state.mode !== "find") {
          throw new Error("The restored Screen 2 host task requires Find mode.");
        }
        const activeSet = state.candidateSets.find((candidateSet) =>
          candidateSet.candidateSetSnapshotId ===
            state.activeCandidateSetSnapshotId
        );
        if (!activeSet) {
          throw new Error("The restored Screen 2 host task needs a candidate pool.");
        }
        const taskId = "host-task:browser-retired-refresh";
        const resultId = "host-result:browser-retired-refresh";
        const createdAt = "2026-08-09T18:00:00.000Z";
        const expiresAt = "2026-09-09T18:00:00.000Z";
        return {
          coordinates: {
            schemaVersion: "shockaudit-private-host-task-coordinates-v1",
            taskId,
            taskType: "screen02-search-review",
            screen: "screen-02",
            runId: snapshot.runId,
            candidatePoolId: activeSet.candidateSetSnapshotId,
            selectedEventId: null,
            claimGroupId: null,
            expectedParentRevision: snapshot.revision,
            expectedScopeFingerprint: state.screen01Fingerprint,
            expectedCandidatePoolFingerprint:
              activeSet.candidateSetFingerprint,
            expectedEventFingerprint: null,
            createdAt,
            expiresAt,
            status: "applied",
            retryCount: 0,
            resultId,
          },
          statusResult: {
            isError: false,
            structuredContent: {
              schemaVersion: "shockaudit-host-task-status-result-v1",
              outcome: "found",
              task: {
                taskId,
                taskType: "screen02-search-review",
                screen: "screen-02",
                runId: snapshot.runId,
                candidatePoolId: activeSet.candidateSetSnapshotId,
                selectedEventId: null,
                claimGroupId: null,
                status: "applied",
                messageChannel: "ui/message",
                messageDeliveryStatus: "accepted",
                createdAt,
                expiresAt,
                retryCount: 0,
                resultId,
                failureCode: null,
                failureExplanation: null,
                panelReconciliation: {
                  status: "pending",
                  lastCheckedAt: createdAt,
                  reconciledAt: null,
                  failureCode: null,
                  failureExplanation: null,
                },
                result: {
                  schemaVersion: "shockaudit-screen02-host-review-result-v1",
                  origin: "chatgpt-host",
                  nonCanonical: true,
                  review: {
                    schemaVersion: "screen-02-pool-host-review-v1",
                    taskId,
                    capability: "screen-02-pool-review",
                    profileAdditions: {},
                    candidateReviews: [],
                    followUpQueries: [],
                    officialSourceLeads: [],
                    conciseRationale:
                      "No additional candidate suggestion was required for this retired-refresh race fixture.",
                    hostModel: "fixture-host-model",
                  },
                  enrichedProfile: state.relevanceProfile,
                  rankings: [],
                  outcomeValuesInspected: false,
                },
                outcomeValuesInspected: false,
              },
            },
          } satisfies McpCallToolResult,
        };
      })()
    : null;
  if (restoredHostTask) {
    initialWorkflowResult._meta = {
      ...(initialWorkflowResult._meta as JsonObject | undefined),
      [HOST_REASONING_META_KEY]: {
        mode: "screen02-only",
        enabled: true,
        genuineTraceCount: 0,
        availableTaskTypes: ["screen02-search-review"],
      },
    };
  }

  const browserNow = Date.parse(
    options?.browserNowIso ?? SCREEN02_BROWSER_CLIENT_NOW_ISO,
  );
  if (!Number.isFinite(browserNow)) {
    throw new Error("The simulated browser clock must be a valid timestamp.");
  }
  await page.addInitScript((now) => {
    Date.now = () => now;
  }, browserNow);

  const serverToolResults: ServerToolResult[] = [];
  let heldWorkflowAction = false;
  let heldWorkflowActionMatchCount = 0;
  let releaseHeldWorkflowAction!: () => void;
  let markHeldWorkflowActionStarted!: () => void;
  const heldWorkflowActionGate = new Promise<void>((resolve) => {
    releaseHeldWorkflowAction = resolve;
  });
  const heldWorkflowActionStarted = new Promise<void>((resolve) => {
    markHeldWorkflowActionStarted = resolve;
  });
  let heldWorkflowCreate = false;
  let releaseHeldWorkflowCreate!: () => void;
  let markHeldWorkflowCreateStarted!: () => void;
  const heldWorkflowCreateGate = new Promise<void>((resolve) => {
    releaseHeldWorkflowCreate = resolve;
  });
  const heldWorkflowCreateStarted = new Promise<void>((resolve) => {
    markHeldWorkflowCreateStarted = resolve;
  });

  await installMcpAppHost(page, {
    appUrl: `${baseUrl}/`,
    initialToolNotifications: [
      {
        label: `simulated-canonical-${mode}-open-v021`,
        arguments: openArguments,
        result: initialWorkflowResult,
      },
    ],
    ...(options?.hostContext
      ? { hostContext: options.hostContext }
      : {}),
    splitToolResultMetadata: true,
    installExternalNavigationBridge: mode === "find",
    ...(options?.hostModelResponder
      ? { hostModelResponder: options.hostModelResponder }
      : {}),
    ...(options?.hostSamplingResponder
      ? { hostSamplingResponder: options.hostSamplingResponder }
      : {}),
    ...(options?.messageResponseDelayMs !== undefined
      ? { messageResponseDelayMs: options.messageResponseDelayMs }
      : {}),
    ...(options?.toolResponseDelayMsByName
      ? { toolResponseDelayMsByName: options.toolResponseDelayMsByName }
      : {}),
    ...(options?.suppressFirstModelToolResultNotificationFor
      ? {
          suppressFirstModelToolResultNotificationFor:
            options.suppressFirstModelToolResultNotificationFor,
        }
      : {}),
    ...(options?.hostCapabilities
      ? { hostCapabilities: options.hostCapabilities }
      : {}),
    ...(options?.representativeHostShell
      ? { representativeHostShell: options.representativeHostShell }
      : {}),
    ...(restoredHostTask
      ? {
          installChatGptCompatibilityBridge: true,
          initialCompatibilityWidgetState: {
            modelContent: "ShockAudit private restoration state.",
            privateContent: {
              screen02Workflow: {
                schemaVersion: SCREEN_02_WORKFLOW_WIDGET_SCHEMA_VERSION,
                workflow: snapshot,
                activeScreen: 2,
                openedMatchSnapshotId: null,
              },
              hostReasoningTasks: {
                schemaVersion: "shockaudit-private-host-task-registry-v1",
                tasks: [restoredHostTask.coordinates],
              },
            },
          },
        }
      : {}),
    callTool: async (name, args) => {
      if (restoredHostTask && name === GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL) {
        const result = restoredHostTask.statusResult;
        serverToolResults.push({ name, arguments: args, result });
        return result;
      }
      if (
        options?.holdWorkflowCreate &&
        name === currentWorkflowCreateTool &&
        !heldWorkflowCreate
      ) {
        heldWorkflowCreate = true;
        markHeldWorkflowCreateStarted();
        await heldWorkflowCreateGate;
      }
      const matchesHeldWorkflowAction =
        options?.holdWorkflowAction !== undefined &&
        browserWorkflowActionTools.has(name) &&
        args.action === options.holdWorkflowAction;
      if (matchesHeldWorkflowAction) {
        heldWorkflowActionMatchCount += 1;
      }
      if (
        ((matchesHeldWorkflowAction &&
          heldWorkflowActionMatchCount ===
            (options?.holdWorkflowActionOccurrence ?? 1)) ||
          (options?.holdScreen03Review &&
            name === SCREEN_03_WORKFLOW_MUTATE_TOOL_V030 &&
            typeof args.action === "object" &&
            args.action !== null &&
            !Array.isArray(args.action) &&
            (args.action as JsonObject).type === "review-field")) &&
        !heldWorkflowAction
      ) {
        heldWorkflowAction = true;
        markHeldWorkflowActionStarted();
        await heldWorkflowActionGate;
      }
      const result = await callMcpTool(baseUrl, name, args);
      serverToolResults.push({ name, arguments: args, result });
      return result;
    },
  });

  await expect(
    page.getByTestId("simulated-browser-evidence"),
  ).toContainText("not signed-in ChatGPT evidence");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __shockAuditHostState: { initializedMounts: number[] };
            }
          ).__shockAuditHostState.initializedMounts.length,
      ),
    )
    .toBeGreaterThan(0);
  const app = page.frameLocator("#shockaudit-frame");
  await expect(app.getByTestId(`screen02-${mode}`)).toBeVisible();
  return {
    app,
    snapshot,
    openArguments,
    openResult,
    serverToolResults,
    waitForHeldWorkflowAction: () => heldWorkflowActionStarted,
    releaseHeldWorkflowAction,
    waitForHeldWorkflowCreate: () => heldWorkflowCreateStarted,
    releaseHeldWorkflowCreate,
  };
}

async function openDefaultScreen01(
  page: Page,
  mode: "find" | "audit",
  options?: {
    sentence?: string;
    suppressFirstOpenMetadata?: boolean;
    compatibilityFallbackForSummaryOnly?: boolean;
    permanentStructuredContentOnly?: boolean;
    mixedCompatibilityMetadata?: boolean;
    malformedNotificationBeforeSeal?: boolean;
    staleSealedNotificationBeforeSeal?: boolean;
    browserNowIso?: string;
    holdScreen03Review?: boolean;
    holdWorkflowCreate?: boolean;
    hostModelResponder?: (
      request: HostModelRequest,
    ) => HostModelToolCall[] | Promise<HostModelToolCall[]>;
    hostSamplingResponder?: (
      request: HostSamplingRequest,
    ) => JsonObject | Promise<JsonObject>;
    messageResponseDelayMs?: number;
    toolResponseDelayMsByName?: Record<string, number>;
    suppressFirstModelToolResultNotificationFor?: string;
    hostCapabilities?: JsonObject;
    installChatGptCompatibilityBridge?: boolean;
    representativeHostShell?: {
      heightPx: number;
      composerHeightPx: number;
      safeAreaBottomPx: number;
    };
  },
) {
  const openArguments: JsonObject = {
    mode,
    ...(options?.sentence ? { sentence: options.sentence } : {}),
  };
  const initialResult = await callMcpTool(
    baseUrl,
    "open_shockaudit_screen_1",
    openArguments,
  );
  expect(initialResult.isError).not.toBe(true);
  const serverToolResults: ServerToolResult[] = [];

  if (options?.browserNowIso) {
    const browserNow = Date.parse(options.browserNowIso);
    if (!Number.isFinite(browserNow)) {
      throw new Error("The simulated browser clock must be a valid timestamp.");
    }
    await page.addInitScript((now) => {
      Date.now = () => now;
    }, browserNow);
  }

  let heldScreen03Review = false;
  let releaseHeldScreen03Review!: () => void;
  let markHeldScreen03ReviewStarted!: () => void;
  const heldScreen03ReviewGate = new Promise<void>((resolve) => {
    releaseHeldScreen03Review = resolve;
  });
  const heldScreen03ReviewStarted = new Promise<void>((resolve) => {
    markHeldScreen03ReviewStarted = resolve;
  });
  let heldWorkflowCreate = false;
  let releaseHeldWorkflowCreate!: () => void;
  let markHeldWorkflowCreateStarted!: () => void;
  const heldWorkflowCreateGate = new Promise<void>((resolve) => {
    releaseHeldWorkflowCreate = resolve;
  });
  const heldWorkflowCreateStarted = new Promise<void>((resolve) => {
    markHeldWorkflowCreateStarted = resolve;
  });

  await installMcpAppHost(page, {
    appUrl: `${baseUrl}/`,
    initialToolNotifications: [
      {
        label: `simulated-default-${mode}-screen-01`,
        arguments: openArguments,
        result: initialResult,
      },
    ],
    callTool: async (name, args) => {
      if (
        options?.holdWorkflowCreate &&
        name === currentWorkflowCreateTool &&
        !heldWorkflowCreate
      ) {
        heldWorkflowCreate = true;
        markHeldWorkflowCreateStarted();
        await heldWorkflowCreateGate;
      }
      if (
        options?.holdScreen03Review &&
        name === SCREEN_03_WORKFLOW_MUTATE_TOOL_V030 &&
        typeof args.action === "object" &&
        args.action !== null &&
        !Array.isArray(args.action) &&
        (args.action as JsonObject).type === "review-field" &&
        !heldScreen03Review
      ) {
        heldScreen03Review = true;
        markHeldScreen03ReviewStarted();
        await heldScreen03ReviewGate;
      }
      const result = await callMcpTool(baseUrl, name, args);
      serverToolResults.push({ name, arguments: args, result });
      return result;
    },
    ...(options?.hostModelResponder
      ? { hostModelResponder: options.hostModelResponder }
      : {}),
    ...(options?.hostSamplingResponder
      ? { hostSamplingResponder: options.hostSamplingResponder }
      : {}),
    ...(options?.messageResponseDelayMs !== undefined
      ? { messageResponseDelayMs: options.messageResponseDelayMs }
      : {}),
    ...(options?.toolResponseDelayMsByName
      ? { toolResponseDelayMsByName: options.toolResponseDelayMsByName }
      : {}),
    ...(options?.suppressFirstModelToolResultNotificationFor
      ? {
          suppressFirstModelToolResultNotificationFor:
            options.suppressFirstModelToolResultNotificationFor,
        }
      : {}),
    ...(options?.hostCapabilities
      ? { hostCapabilities: options.hostCapabilities }
      : {}),
    ...(options?.representativeHostShell
      ? { representativeHostShell: options.representativeHostShell }
      : {}),
    splitToolResultMetadata: true,
    ...(options?.mixedCompatibilityMetadata
      ? {
          installChatGptCompatibilityBridge: true,
          initialCompatibilityToolResponseMetadata: {
            status: "complete",
            mcp_tool_result: {
              _meta: {
                [SCREEN_02_WORKFLOW_META_KEY]: {
                  schemaVersion: "redacted-legacy-view",
                  mode,
                },
                [SCREEN_02_WORKFLOW_CORRELATION_META_KEY]: {
                  operationId: "screen02-v021-open-stale-browser-operation",
                },
              },
            },
          },
        }
      : {}),
    ...(options?.malformedNotificationBeforeSeal
      ? {
          preDirectMalformedToolResultFor: [
            currentWorkflowCreateTool,
            currentWorkflowActionTool,
          ],
        }
      : {}),
    ...(options?.staleSealedNotificationBeforeSeal
      ? {
          preDirectStaleSealedToolResultFor: [
            currentWorkflowCreateTool,
            currentWorkflowActionTool,
          ],
        }
      : {}),
    ...(options?.compatibilityFallbackForSummaryOnly
      ? {
          suppressSplitToolResultMetadataFor: [
            currentWorkflowCreateTool,
            currentWorkflowActionTool,
          ],
          stripSealedSnapshotFromDirectFor: [
            currentWorkflowCreateTool,
            currentWorkflowActionTool,
          ],
          installChatGptCompatibilityBridge: true,
        }
      : {}),
    ...(options?.permanentStructuredContentOnly
      ? {
          permanentStructuredContentOnlyFor: [
            currentWorkflowCreateTool,
            currentWorkflowActionTool,
          ],
        }
      : {}),
    ...(options?.suppressFirstOpenMetadata
      ? {
          suppressFirstSplitToolResultMetadataFor:
            currentWorkflowCreateTool,
          stripFirstSealedSnapshotFromDirectFor:
            currentWorkflowCreateTool,
        }
      : {}),
    ...(options?.installChatGptCompatibilityBridge
      ? { installChatGptCompatibilityBridge: true }
      : {}),
  });

  const app = page.frameLocator("#shockaudit-frame");
  await expect(app.locator(`[data-mode="${mode}"]`)).toHaveAttribute(
    "aria-checked",
    "true",
  );

  return {
    app,
    initialResult,
    serverToolResults,
    waitForHeldWorkflowAction: () => heldScreen03ReviewStarted,
    releaseHeldWorkflowAction: releaseHeldScreen03Review,
    waitForHeldWorkflowCreate: () => heldWorkflowCreateStarted,
    releaseHeldWorkflowCreate,
  };
}

async function expectNoSeriousOrCriticalWcagViolations(
  page: Page,
  testInfo: TestInfo,
  label: string,
) {
  // An Axe FramesSelector is a cross-tree selector path: first the iframe in
  // the host document, then the target inside that frame.
  const results = await new AxeBuilder({ page })
    .include(["#shockaudit-frame", "main"])
    .withTags([...wcagTags])
    .analyze();
  const severe = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  await testInfo.attach(`${label}-axe-wcag-a-aa.json`, {
    body: JSON.stringify(
      {
        simulatedEvidence: true,
        signedInChatGptEvidence: false,
        url: results.url,
        testEngine: results.testEngine,
        testEnvironment: results.testEnvironment,
        violations: results.violations,
        incomplete: results.incomplete,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(
    severe.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.flatMap((node) => node.target),
    })),
    "The simulated iframe must have no serious or critical Axe violations for WCAG A/AA tags.",
  ).toEqual([]);
}

async function expectVisibleFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  const focusStyle = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  expect(
    (focusStyle.outlineStyle !== "none" &&
      Number.parseFloat(focusStyle.outlineWidth) > 0) ||
      focusStyle.boxShadow !== "none",
  ).toBe(true);
}

async function expectNoHorizontalPageOverflow(app: FrameLocator) {
  const measurement = await app.locator("html").evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const visibleOverflow = Array.from(
      document.querySelectorAll<HTMLElement>("main *"),
    )
      .filter((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        let ancestor = element.parentElement;
        let containedByHorizontalOverflow = false;
        while (ancestor && ancestor !== document.body) {
          const ancestorStyle = getComputedStyle(ancestor);
          const ancestorBounds = ancestor.getBoundingClientRect();
          if (
            ["auto", "scroll", "hidden", "clip"].includes(
              ancestorStyle.overflowX,
            ) &&
            ancestorBounds.left >= -1 &&
            ancestorBounds.right <= viewportWidth + 1
          ) {
            containedByHorizontalOverflow = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          bounds.width > 1 &&
          bounds.height > 1 &&
          !containedByHorizontalOverflow &&
          (bounds.left < -1 || bounds.right > viewportWidth + 1)
        );
      })
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: element.className,
        bounds: element.getBoundingClientRect().toJSON(),
      }));
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      visibleOverflow,
    };
  });
  expect(measurement.visibleOverflow).toEqual([]);
  expect(measurement.scrollWidth).toBeLessThanOrEqual(
    measurement.clientWidth + 1,
  );
}

async function saveSimulatedScreenshot(
  page: Page,
  _testInfo: TestInfo,
  name: string,
) {
  const screenshotDirectory = resolve(
    "artifacts/release-gates/screenshots",
  );
  await mkdir(screenshotDirectory, { recursive: true });
  const path = resolve(screenshotDirectory, `${name}.png`);
  await page.screenshot({
    path,
    fullPage: true,
    animations: "disabled",
  });
}

async function expectNoBrowserOrHostErrors(
  page: Page,
  issues: BrowserIssues,
) {
  expect(issues.consoleErrors).toEqual([]);
  expect(issues.pageErrors).toEqual([]);
  expect(await hostErrors(page)).toEqual([]);
}

test.describe.skip("Historical v0.4.10 Screen 1–4 browser suite — retired replacement interface", () => {
  // Every journey owns its page and workflow run. Keep sequential execution
  // from the one-worker config, but execute later journeys after a failure.
  test.describe.configure({ mode: "default" });

  test.beforeEach(({}, testInfo) => {
    testInfo.annotations.push({
      type: "evidence-boundary",
      description:
        "Local deterministic MCP Apps simulation only; this is not a signed-in ChatGPT acceptance session.",
    });
  });

  test("scripted Screen 3 responder accepts compact tasks and optional reader-help sections", () => {
    const request: HostModelRequest = {
      message: {},
      latestModelContext: {
        structuredContent: {
          schemaVersion: screen03HostMessageTaskSchemaVersion,
          requestId: "screen03-browser-compact-task",
          capabilityToken: "sa3h-capability-v1.browser-fixture",
          requiredTool: SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
          instructions: "Prepare the bounded briefing and call the required tool.",
          task: {
            event: {
              canonicalTitle: "Example Regulation",
              eventType: "Regulation",
            },
            studyContext: {
              population: "Example firms",
              geography: "Example region",
              industry: "Example industry",
              studyPeriod: "2020–2024",
              outcomeFamily: "Innovation",
            },
            claims: [
              {
                proposalId: "claim-overview",
                group: "overview",
                label: "What happened",
                claim: "The regulation changed a bounded market rule.",
                evidence: ["The regulation changed the market rule."],
              },
              {
                proposalId: "claim-duty",
                group: "component",
                label: "Event component",
                claim: "Covered firms must publish a new notice.",
                evidence: ["Covered firms must publish the notice."],
              },
              {
                proposalId: "claim-coverage",
                group: "eligibility",
                label: "Covered population",
                claim: "The rule covers qualifying market participants.",
                evidence: ["Qualifying market participants are covered."],
              },
              {
                proposalId: "claim-timing",
                group: "timeline",
                label: "Effective date",
                claim: "2024-01-01",
                evidence: ["The rule took effect on 2024-01-01."],
              },
            ],
          },
        },
      },
      messageIndex: 0,
      modelContextIndex: -1,
    };
    const partial = automaticV036HostResponder({
      screen01: false,
      screen02: false,
      screen03StudyRelevance: "omit",
      screen03ClaimHelp: "partial",
    })(request);
    expect(partial).toHaveLength(1);
    expect(partial[0]!.arguments).not.toHaveProperty("sourcePacket");
    const partialDraft = record(
      partial[0]!.arguments.draft,
      "partial compact Screen 3 draft",
    );
    expect(partialDraft).not.toHaveProperty("studyRelevance");
    expect(partialDraft.claimExplanations).toHaveLength(2);

    const complete = automaticV036HostResponder({
      screen01: false,
      screen02: false,
      screen03StudyRelevance: "omit",
    })(request);
    const completeDraft = record(
      complete[0]!.arguments.draft,
      "complete compact Screen 3 draft",
    );
    expect(completeDraft.claimExplanations).toHaveLength(4);
    expect(JSON.stringify(completeDraft.claimExplanations)).not.toContain(
      "In plain terms, The regulation changed a bounded market rule.",
    );

    const empty = automaticV036HostResponder({
      screen01: false,
      screen02: false,
      screen03StudyRelevance: "omit",
      screen03ClaimHelp: "empty",
    })(request);
    const emptyDraft = record(
      empty[0]!.arguments.draft,
      "empty compact Screen 3 draft",
    );
    expect(emptyDraft.claimExplanations).toEqual([]);
  });

  test("untouched default Screen 1 confirms and opens canonical Find through the versioned app-only creator", async ({
    page,
  }, testInfo) => {
    if (process.env.SHOCKAUDIT_BROWSER_GATE_KIND === "wrangler-smoke") {
      const response = await page.request.get(OFFICIAL_TRANSPORT_PROBE_PATH);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/json");
      const probe = record(
        await response.json(),
        "official transport probe response",
      );
      expect(Object.keys(probe).sort()).toEqual([
        "byteCount",
        "contentType",
        "sha256",
        "status",
        "upstreamUrl",
      ]);
      expect(probe).toMatchObject({
        upstreamUrl: OFFICIAL_TRANSPORT_PROBE_UPSTREAM_URL,
        status: 200,
        contentType: expect.stringMatching(
          /^(?:application\/atom\+xml|application\/xml|text\/xml)(?:\s*;|$)/iu,
        ),
        byteCount: expect.any(Number),
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      });
      expect(probe.byteCount).toBeGreaterThan(0);
      await testInfo.attach("official-transport-probe.json", {
        body: JSON.stringify(probe, null, 2),
        contentType: "application/json",
      });
    }

    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      hostModelResponder: automaticFindPlanningOnlyHostResponder(),
    });
    const confirm = app.locator(".confirm-row button");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();

    const opener = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
    );
    expect(opener.arguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
    });
    expect(opener.arguments.operationId).toMatch(
      new RegExp(`^${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}`),
    );
    const snapshot = privateWorkflowSnapshot(opener.result);
    expect(snapshot.mode).toBe("find");
    expect(stateFromScreen02WorkflowClientSnapshot(snapshot)).toMatchObject({
      mode: "find",
      candidates: [],
      decision: {
        openedCandidateSnapshotId: null,
        tentativeSelectionSnapshotId: null,
        continuedRevision: null,
        history: [],
      },
    });

    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    const searched = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    expect(privateWorkflowSnapshot(searched.result).revision).toBeGreaterThan(
      snapshot.revision,
    );
    const searchedState = stateFromScreen02WorkflowClientSnapshot(
      privateWorkflowSnapshot(searched.result),
    );
    expect(searchedState.mode).toBe("find");
    if (searchedState.mode !== "find") {
      throw new Error("Expected the untouched default to remain in Find mode.");
    }
    const manufacturingCandidate = searchedState.candidates.find(
      (candidate) =>
        candidate.candidateId ===
          "registry-us-california-iot-security-2020",
    );
    expect(manufacturingCandidate?.qualification).toMatchObject({
      eligible: true,
      substantiveOverview: {
        passed: true,
        evidenceSourceIds: expect.arrayContaining([expect.any(String)]),
      },
    });
    const activeSet = searchedState.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
          searchedState.activeCandidateSetSnapshotId,
    );
    expect(activeSet?.manifest.funnel).toMatchObject({
      substantiveInformationPassed: expect.any(Number),
      qualifiedCandidates: expect.any(Number),
      displayedCandidates: expect.any(Number),
    });
    expect(activeSet!.manifest.funnel!.substantiveInformationPassed).toBeGreaterThan(
      0,
    );
    expect(activeSet!.manifest.funnel!.qualifiedCandidates).toBeGreaterThan(0);
    await expect
      .poll(() => app.locator(".s2-find-candidate-row").count())
      .toBeGreaterThan(0);
  });

  test("untouched default Screen 1 opens canonical Audit from the Step 2 rail action", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "audit");
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app
      .getByRole("button", {
        name: "Step 2: Represent known shock, available next",
      })
      .click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();

    const opener = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
    );
    expect(opener.arguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
    });
    expect(opener.arguments.operationId).toMatch(
      new RegExp(`^${SCREEN_02_WORKFLOW_OPEN_REQUEST_PREFIX}`),
    );
    const snapshot = privateWorkflowSnapshot(opener.result);
    expect(snapshot.mode).toBe("audit");

    const beforeOpen = serverToolResults.length;
    const firstMatch = app.locator(".s2-audit-match").first();
    await expect(firstMatch).toBeVisible();
    await firstMatch.click();
    const opened = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-open",
      beforeOpen,
    );
    expect(privateWorkflowSnapshot(opened.result).revision).toBeGreaterThan(
      snapshot.revision,
    );
    await expect(app.locator("#s2-audit-match-detail")).toBeVisible();
  });

  test("Find opens and remains usable when standards calls are summary-only and ChatGPT supplies compatibility metadata", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      compatibilityFallbackForSummaryOnly: true,
      hostModelResponder: automaticFindPlanningOnlyHostResponder(),
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();

    const openCalls = serverToolResults.filter(
      (entry) => entry.name === currentWorkflowCreateTool,
    );
    expect(openCalls).toHaveLength(2);
    expect(openCalls[1]!.arguments).toEqual(openCalls[0]!.arguments);
    expect(openCalls[0]!.result.structuredContent?.outcome).toBe("created");
    expect(openCalls[1]!.result.structuredContent?.outcome).toBe("replayed");

    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    await expect
      .poll(() => app.locator(".s2-find-candidate-row").count())
      .toBeGreaterThan(0);
    const searchCalls = serverToolResults
      .slice(beforeSearch)
      .filter(
        (entry) =>
          entry.name === currentWorkflowActionTool &&
          entry.arguments.action === "find-search",
      );
    expect(searchCalls).toHaveLength(2);
    expect(searchCalls[1]!.arguments).toEqual(searchCalls[0]!.arguments);
  });

  test("Audit opens and remains usable when standards calls are summary-only and ChatGPT supplies compatibility metadata", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "audit", {
      compatibilityFallbackForSummaryOnly: true,
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    const beforeContinue = serverToolResults.length;
    await app
      .getByRole("button", {
        name: "Step 2: Represent known shock, available next",
      })
      .click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();

    const openCalls = serverToolResults.filter(
      (entry) => entry.name === currentWorkflowCreateTool,
    );
    expect(openCalls).toHaveLength(2);
    expect(openCalls[1]!.arguments).toEqual(openCalls[0]!.arguments);
    expect(openCalls[0]!.result.structuredContent?.outcome).toBe("created");
    expect(openCalls[1]!.result.structuredContent?.outcome).toBe("replayed");

    await expect
      .poll(
        () =>
          serverToolResults
            .slice(beforeContinue)
            .filter(
              (entry) =>
                entry.name === currentWorkflowActionTool &&
                entry.arguments.action === "audit-open",
            ).length,
      )
      .toBe(2);
    const matchCalls = serverToolResults
      .slice(beforeContinue)
      .filter(
        (entry) =>
          entry.name === currentWorkflowActionTool &&
          entry.arguments.action === "audit-open",
      );
    expect(matchCalls).toHaveLength(2);
    expect(matchCalls[1]!.arguments).toEqual(matchCalls[0]!.arguments);
    expect(matchCalls[0]!.result.structuredContent?.outcome).toBe("applied");
    expect(matchCalls[1]!.result.structuredContent?.outcome).toBe("replayed");
    await expect(app.locator("#s2-audit-match-detail")).toBeVisible();
  });

  test("Find opens and mutates when the host permanently returns only sealed structuredContent", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      permanentStructuredContentOnly: true,
      hostModelResponder: automaticFindPlanningOnlyHostResponder(),
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    await expect(app.locator(".confirmation-error")).toHaveCount(0);

    const openCalls = serverToolResults.filter(
      (entry) => entry.name === currentWorkflowCreateTool,
    );
    expect(openCalls).toHaveLength(1);
    expect(openCalls[0]!.arguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
    });
    expectSealedWorkflowResult(openCalls[0]!, "open", "find");

    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    await expect
      .poll(() => app.locator(".s2-find-candidate-row").count())
      .toBeGreaterThan(0);
    const searchCalls = serverToolResults
      .slice(beforeSearch)
      .filter(
        (entry) =>
          entry.name === currentWorkflowActionTool &&
          entry.arguments.action === "find-search",
      );
    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0]!.arguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
      action: "find-search",
    });
    expectSealedWorkflowResult(searchCalls[0]!, "mutation", "find");
    expect(searchCalls[0]!.result.structuredContent).toMatchObject({
      outcome: "applied",
    });

    await expectNoLegacyPrivateResultChannel(app);
    await expectOnlySealedStructuredResultsForCurrentWorkflow(page);
  });

  test("Audit opens and mutates when the host permanently returns only sealed structuredContent", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "audit", {
      permanentStructuredContentOnly: true,
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app
      .getByRole("button", {
        name: "Step 2: Represent known shock, available next",
      })
      .click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();
    await expect(app.locator(".confirmation-error")).toHaveCount(0);

    const openCalls = serverToolResults.filter(
      (entry) => entry.name === currentWorkflowCreateTool,
    );
    expect(openCalls).toHaveLength(1);
    expect(openCalls[0]!.arguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
    });
    expectSealedWorkflowResult(openCalls[0]!, "open", "audit");

    const beforeOpen = serverToolResults.length;
    const firstMatch = app.locator(".s2-audit-match").first();
    await expect(firstMatch).toBeVisible();
    await firstMatch.click();
    await expect(app.locator("#s2-audit-match-detail")).toBeVisible();
    await expect
      .poll(
        () =>
          serverToolResults
            .slice(beforeOpen)
            .filter(
              (entry) =>
                entry.name === currentWorkflowActionTool &&
                entry.arguments.action === "audit-open",
            ).length,
      )
      .toBe(1);
    const matchCalls = serverToolResults
      .slice(beforeOpen)
      .filter(
        (entry) =>
          entry.name === currentWorkflowActionTool &&
          entry.arguments.action === "audit-open",
      );
    expect(matchCalls).toHaveLength(1);
    expect(matchCalls[0]!.arguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_ACTION_SCHEMA_VERSION_V024,
      action: "audit-open",
    });
    expectSealedWorkflowResult(matchCalls[0]!, "mutation", "audit");
    expect(matchCalls[0]!.result.structuredContent).toMatchObject({
      outcome: "applied",
    });

    await expectNoLegacyPrivateResultChannel(app);
    await expectOnlySealedStructuredResultsForCurrentWorkflow(page);
  });

  test("Find crosses Screen 1 to Screen 2 and remains usable when a valid seal arrives beside stale redacted compatibility metadata", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      mixedCompatibilityMetadata: true,
      staleSealedNotificationBeforeSeal: true,
      hostModelResponder: automaticFindPlanningOnlyHostResponder(),
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    await expect(app.getByText(/SA-S2-/)).toHaveCount(0);

    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    await expect
      .poll(() => app.locator(".s2-find-candidate-row").count())
      .toBeGreaterThan(0);
    const searched = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    expectSealedWorkflowResult(searched, "mutation", "find");
    expect(await sentToolNotificationLabels(page)).toContain(
      `pre-direct-stale-sealed-result:${currentWorkflowCreateTool}`,
    );
    expect(await sentToolNotificationLabels(page)).toContain(
      `pre-direct-stale-sealed-result:${currentWorkflowActionTool}`,
    );
  });

  test("Audit crosses Screen 1 to Screen 2 and remains usable when a valid seal arrives beside stale redacted compatibility metadata", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "audit", {
      mixedCompatibilityMetadata: true,
      staleSealedNotificationBeforeSeal: true,
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();
    await expect(app.getByText(/SA-S2-/)).toHaveCount(0);

    const beforeOpen = serverToolResults.length;
    await app.locator(".s2-audit-match").first().click();
    await expect(app.locator("#s2-audit-match-detail")).toBeVisible();
    const opened = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-open",
      beforeOpen,
    );
    expectSealedWorkflowResult(opened, "mutation", "audit");
    expect(await sentToolNotificationLabels(page)).toContain(
      `pre-direct-stale-sealed-result:${currentWorkflowCreateTool}`,
    );
    expect(await sentToolNotificationLabels(page)).toContain(
      `pre-direct-stale-sealed-result:${currentWorkflowActionTool}`,
    );
  });

  test("Find crosses the visible Continue action and searches when malformed metadata is notified before each valid seal", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      malformedNotificationBeforeSeal: true,
      hostModelResponder: automaticFindPlanningOnlyHostResponder(),
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    await expect(app.getByText(/SA-S2-/)).toHaveCount(0);

    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    await expect
      .poll(() => app.locator(".s2-find-candidate-row").count())
      .toBeGreaterThan(0);
    const searched = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    expectSealedWorkflowResult(searched, "mutation", "find");
    expect(await sentToolNotificationLabels(page)).toContain(
      `pre-direct-malformed-result:${currentWorkflowCreateTool}`,
    );
    expect(await sentToolNotificationLabels(page)).toContain(
      `pre-direct-malformed-result:${currentWorkflowActionTool}`,
    );
  });

  test("Audit crosses the visible Continue action and opens a match when malformed metadata is notified before each valid seal", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "audit", {
      malformedNotificationBeforeSeal: true,
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    await app.locator(".continue-screen-two").click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();
    await expect(app.getByText(/SA-S2-/)).toHaveCount(0);

    const beforeOpen = serverToolResults.length;
    await app.locator(".s2-audit-match").first().click();
    await expect(app.locator("#s2-audit-match-detail")).toBeVisible();
    const opened = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-open",
      beforeOpen,
    );
    expectSealedWorkflowResult(opened, "mutation", "audit");
    expect(await sentToolNotificationLabels(page)).toContain(
      `pre-direct-malformed-result:${currentWorkflowCreateTool}`,
    );
    expect(await sentToolNotificationLabels(page)).toContain(
      `pre-direct-malformed-result:${currentWorkflowActionTool}`,
    );
  });

  test("a created Screen 2 run with no usable result shows recovery and retries the same operation safely", async ({
    page,
  }) => {
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      suppressFirstOpenMetadata: true,
    });
    const confirm = app.locator(".confirm-row button");
    await confirm.click();
    await expect(confirm).toHaveText("Scope confirmed");

    const continueButton = app.getByRole("button", {
      name: "Continue to shock feasibility",
    });
    await continueButton.click();
    const recoveryPanel = app.getByTestId("screen02-preparation");
    await expect(recoveryPanel).toContainText(
      "[SA-S2-RESULT-METADATA-TIMEOUT]",
    );
    await expect(recoveryPanel.locator(".s2w-inline-failure")).toContainText(
      "Screen 2 did not open",
    );
    await expect(
      app.getByRole("button", { name: "Retry opening Screen 2" }),
    ).toBeVisible();
    await expect(
      app.getByRole("button", { name: "Back to Screen 1", exact: true }),
    ).toBeVisible();
    await expect(app.getByTestId("screen02-find")).toHaveCount(0);
    expect(
      serverToolResults.filter(
        (entry) => entry.name === currentWorkflowCreateTool,
      ),
    ).toHaveLength(1);

    await app
      .getByRole("button", { name: "Retry opening Screen 2" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    const openAttempts = serverToolResults.filter(
      (entry) => entry.name === currentWorkflowCreateTool,
    );
    expect(openAttempts).toHaveLength(2);
    expect(openAttempts[0]!.result.structuredContent?.outcome).toBe("created");
    expect(openAttempts[1]!.result.structuredContent?.outcome).toBe("replayed");
    expect(openAttempts[1]!.arguments.operationId).toBe(
      openAttempts[0]!.arguments.operationId,
    );
    expect(openAttempts[1]!.arguments.responseKeyId).toBe(
      openAttempts[0]!.arguments.responseKeyId,
    );
    expect(openAttempts[1]!.arguments.responseKey).toBe(
      openAttempts[0]!.arguments.responseKey,
    );

    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    const searched = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    expect(privateWorkflowSnapshot(searched.result).revision).toBeGreaterThan(
      0,
    );
  });

  test("Find supports keyboard search/open, live status, negative reset, WCAG checks, and desktop layout", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const {
      app,
      snapshot,
      openArguments,
      openResult,
      serverToolResults,
      waitForHeldWorkflowAction,
      releaseHeldWorkflowAction,
    } = await openCanonicalWorkflow(page, "find", {
      holdWorkflowAction: "find-open",
      holdWorkflowActionOccurrence: 2,
    });
    expect(snapshot.revision).toBe(0);

    const assessmentStatus = app.getByTestId(
      "screen02-find-assessment-count",
    );
    await expect(assessmentStatus).toHaveAttribute("role", "status");
    await expect(assessmentStatus).toHaveAttribute("aria-live", "polite");
    await expect(assessmentStatus).toContainText("No assessments requested");
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-find-initial-desktop",
    );

    const editStudy = app.getByRole("button", { name: "Edit on Screen 1" });
    const reset = app.getByRole("button", { name: "Reset Screen 2" });
    await editStudy.focus();
    await page.keyboard.press("Tab");
    await expectVisibleFocus(reset);

    const search = app.getByRole("button", {
      name: /find candidate shocks/i,
    });
    await search.focus();
    await search.press("Enter");
    await waitForWorkflowAction(page, "find-search");
    const deterministicSearch = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
    );
    const deterministicSnapshot = privateWorkflowSnapshot(
      deterministicSearch.result,
    );
    const deterministicState = stateFromScreen02WorkflowClientSnapshot(
      deterministicSnapshot,
    );
    expect(deterministicSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    expect(deterministicState.mode).toBe("find");
    if (deterministicState.mode !== "find") {
      throw new Error("Expected deterministic Find state after search.");
    }
    expect(deterministicState.assessmentRequests).toEqual([]);
    expect(deterministicState.assessments).toEqual([]);
    expect(
      deterministicState.candidates.every(
        (candidate) => candidate.qualification?.eligible === true,
      ),
    ).toBe(true);
    await expect(
      app.getByText("Preliminary assessment is unavailable in this view.", {
        exact: false,
      }),
    ).toHaveCount(0);
    const candidates = app.locator(".s2-find-candidate-row");
    await expect.poll(() => candidates.count()).toBeGreaterThan(0);
    await expect(assessmentStatus).toContainText("No assessments requested");
    await expect(
      app.getByTestId("screen02-host-reasoning-unavailable"),
    ).toHaveCount(0);
    await expect(
      app.getByRole("button", { name: "Search more widely" }),
    ).toHaveCount(0);
    await expect(
      app.getByText("ChatGPT is reviewing this candidate for your study…", {
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      serverToolResults.filter(
        (entry) =>
          browserWorkflowActionTools.has(entry.name) &&
          entry.arguments.action === "assessment-delivery",
      ),
    ).toHaveLength(0);
    await expect(
      app
        .getByRole("button", {
          name: /^Retry (?:sending this assessment|missing assessment parts)$/,
        })
        .first(),
    ).toHaveCount(0);

    const firstCandidate = candidates.first();
    const beforeLatestOpen = serverToolResults.length;
    await firstCandidate.focus();
    await firstCandidate.press("Space");
    await waitForWorkflowAction(page, "find-open");
    const latestOpen = await waitForServerWorkflowResult(
      serverToolResults,
      "find-open",
      beforeLatestOpen,
    );
    const latestSnapshot = privateWorkflowSnapshot(latestOpen.result);
    const latestState = stateFromScreen02WorkflowClientSnapshot(
      latestSnapshot,
    );
    expect(latestState.mode).toBe("find");
    if (latestState.mode !== "find") {
      throw new Error("Expected a canonical Find state after opening a candidate.");
    }
    const activeSet = latestState.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
        latestState.activeCandidateSetSnapshotId,
    );
    expect(activeSet).toBeDefined();
    expect(activeSet!.candidateSnapshotIds.length).toBeGreaterThan(1);
    const openedCandidateId = latestState.decision.openedCandidateSnapshotId;
    expect(openedCandidateId).not.toBeNull();
    const openedCandidate = latestState.candidates.find(
      (candidate) => candidate.candidateSnapshotId === openedCandidateId,
    );
    const externalWinner = latestState.candidates.find(
      (candidate) =>
        activeSet!.candidateSnapshotIds.includes(
          candidate.candidateSnapshotId,
        ) && candidate.candidateSnapshotId !== openedCandidateId,
    );
    expect(openedCandidate).toBeDefined();
    expect(externalWinner).toBeDefined();
    const openedCandidateTitle =
      openedCandidate!.identity.commonNames[0] ??
      openedCandidate!.identity.canonicalTitle;
    const externalWinnerTitle =
      externalWinner!.identity.commonNames[0] ??
      externalWinner!.identity.canonicalTitle;
    await expect(firstCandidate).toHaveAttribute("aria-pressed", "true");
    await expect(
      app.locator("#s2-find-candidate-detail h2"),
    ).toBeVisible();
    await expect(
      app.getByRole("heading", { name: "Why this candidate is shown" }),
    ).toBeVisible();
    await expect(
      app.locator("#s2-find-candidate-detail"),
    ).not.toContainText("Assessment pending");
    await expect(firstCandidate).toContainText("Source-backed candidate");

    const onlineSourcesSection = app
      .locator(".s2-find-detail-section")
      .filter({ has: app.getByRole("heading", { name: "Online sources" }) });
    await expect(onlineSourcesSection).toHaveCount(1);
    await expect(
      app.getByRole("heading", { name: /related links/i }),
    ).toHaveCount(0);
    const relatedSearchLinks = onlineSourcesSection.locator(
      ".s2-find-source--related-search a",
    );
    await expect(relatedSearchLinks).toHaveCount(3);
    const firstRelatedSearchHref = await relatedSearchLinks
      .first()
      .getAttribute("href");
    expect(firstRelatedSearchHref).toMatch(
      /^https:\/\/(?:www\.google\.com|scholar\.google\.com|en\.wikipedia\.org)\//,
    );
    await relatedSearchLinks.first().click();
    await expect
      .poll(() =>
        app.locator("body").evaluate(() =>
          (
            window as unknown as {
              __shockAuditExternalNavigationCalls: Array<{
                href: string;
                redirectUrl?: boolean;
              }>;
            }
          ).__shockAuditExternalNavigationCalls,
        ),
      )
      .toEqual([
        {
          href: firstRelatedSearchHref,
          redirectUrl: false,
        },
      ]);

    const mountBeforeRestore = await page.evaluate(
      () =>
        (
          window as unknown as {
            __shockAuditHostState: { mountId: number };
          }
        ).__shockAuditHostState.mountId,
    );
    const beforeRestorationRefresh = serverToolResults.length;
    await page.evaluate(
      ({ latest, stale }) => {
        (
          window as unknown as {
            __shockAuditRemount: (
              entries: Array<{
                label: string;
                arguments: JsonObject;
                result: McpCallToolResult;
              }>,
            ) => void;
          }
        ).__shockAuditRemount([
          {
            label: "simulated-latest-find-open-v021",
            arguments: latest.arguments,
            result: latest.result,
          },
          {
            label: "simulated-stale-find-open-v021",
            arguments: stale.arguments,
            result: stale.result,
          },
        ]);
      },
      {
        latest: {
          arguments: latestOpen.arguments,
          result: latestOpen.result,
        },
        stale: { arguments: openArguments, result: openResult },
      },
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __shockAuditHostState: { mountId: number };
              }
            ).__shockAuditHostState.mountId,
        ),
      )
      .toBe(mountBeforeRestore + 1);
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    const restoredCandidates = app.locator(".s2-find-candidate-row");
    await expect(restoredCandidates).toHaveCount(
      activeSet!.candidateSnapshotIds.length,
    );
    const restoredOpenedCandidate = restoredCandidates.filter({
      hasText: openedCandidateTitle,
    });
    await expect(restoredOpenedCandidate).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(app.locator("#s2-find-candidate-detail h2")).toContainText(
      openedCandidate!.identity.canonicalTitle,
    );
    const restoreNotifications = await page.evaluate(
      (mountId) =>
        (
          window as unknown as {
            __shockAuditHostState: {
              sentToolNotifications: Array<{
                label: string;
                mountId: number;
              }>;
            };
          }
        ).__shockAuditHostState.sentToolNotifications
          .filter(
            (entry) =>
              entry.mountId === mountId &&
              entry.label.startsWith("simulated-") &&
              entry.label.endsWith("-find-open-v021"),
          )
          .map((entry) => entry.label),
      mountBeforeRestore + 1,
    );
    expect(restoreNotifications).toEqual([
      "simulated-latest-find-open-v021",
      "simulated-stale-find-open-v021",
    ]);
    const restorationRefresh = await waitForServerWorkflowResult(
      serverToolResults,
      "refresh",
      beforeRestorationRefresh,
    );
    expect(restorationRefresh.arguments).toMatchObject({
      runId: latestSnapshot.runId,
      expectedRevision: latestSnapshot.revision,
      expectedStateFingerprint: latestSnapshot.stateFingerprint,
      action: "refresh",
    });
    expect(restorationRefresh.result.structuredContent).toMatchObject({
      ok: true,
      outcome: "refreshed",
      mode: "find",
    });
    const restorationSnapshot = privateWorkflowSnapshot(
      restorationRefresh.result,
    );
    expect(restorationSnapshot).toMatchObject({
      runId: latestSnapshot.runId,
      mode: latestSnapshot.mode,
      revision: latestSnapshot.revision,
      stateFingerprint: latestSnapshot.stateFingerprint,
    });
    await expect(restoredOpenedCandidate).toBeEnabled();
    await restoredOpenedCandidate.focus();
    await expectVisibleFocus(restoredOpenedCandidate);
    const callsBeforeConflict = await capturedToolCalls(page);
    expect(
      callsBeforeConflict.filter(
        (call) =>
          browserWorkflowActionTools.has(call.name ?? "") &&
          call.arguments?.action === "find-open",
      ),
    ).toHaveLength(1);
    const beforeConflictToolCalls = callsBeforeConflict.length;
    await page.keyboard.press("Enter");

    let externalResult: McpCallToolResult | null = null;
    let heldConflictOperationId: string | null = null;
    let beforeConflictRestore = -1;
    try {
      await waitForHeldWorkflowAction();
      const heldFindOpenCalls = (await capturedToolCalls(page))
        .slice(beforeConflictToolCalls)
        .filter(
          (call) =>
            browserWorkflowActionTools.has(call.name ?? "") &&
            call.arguments?.action === "find-open",
        );
      expect(heldFindOpenCalls).toHaveLength(1);
      expect(heldFindOpenCalls[0]!.arguments).toMatchObject({
        runId: restorationSnapshot.runId,
        expectedRevision: restorationSnapshot.revision,
        expectedStateFingerprint: restorationSnapshot.stateFingerprint,
        payload: { candidateSnapshotId: openedCandidateId },
      });
      const operationId = heldFindOpenCalls[0]!.arguments?.operationId;
      if (typeof operationId !== "string") {
        throw new Error(
          "Expected the held stale Find action to have an operation ID.",
        );
      }
      heldConflictOperationId = operationId;
      beforeConflictRestore = serverToolResults.length;
      externalResult = await callMcpTool(baseUrl, workflowActionTool, {
        schemaVersion: "screen-02-workflow-action-v1",
        operationId: "simulated-browser-external-find-open",
        runId: restorationSnapshot.runId,
        accessToken: restorationSnapshot.accessToken,
        expectedRevision: restorationSnapshot.revision,
        expectedStateFingerprint: restorationSnapshot.stateFingerprint,
        action: "find-open",
        payload: {
          candidateSnapshotId: externalWinner!.candidateSnapshotId,
        },
      });
    } finally {
      releaseHeldWorkflowAction();
    }
    if (
      !externalResult ||
      !heldConflictOperationId ||
      beforeConflictRestore < 0
    ) {
      throw new Error(
        "Expected the external winner and held stale Find operation.",
      );
    }
    expect(externalResult.structuredContent).toMatchObject({
      outcome: "applied",
      mode: "find",
    });
    const externalSnapshot = privateWorkflowSnapshot(externalResult);
    expect(externalSnapshot.revision).toBeGreaterThan(
      restorationSnapshot.revision,
    );
    const externalState = stateFromScreen02WorkflowClientSnapshot(
      externalSnapshot,
    );
    expect(externalState.mode).toBe("find");
    if (externalState.mode !== "find") {
      throw new Error("Expected the external winner to remain in Find mode.");
    }
    expect(externalState.decision.openedCandidateSnapshotId).toBe(
      externalWinner!.candidateSnapshotId,
    );

    await expect
      .poll(() =>
        serverToolResults
          .slice(beforeConflictRestore)
          .some(
            (entry) =>
              browserWorkflowActionTools.has(entry.name) &&
              entry.arguments.action === "find-open" &&
              entry.arguments.operationId === heldConflictOperationId,
          ),
      )
      .toBe(true);
    const conflictRestore = serverToolResults
      .slice(beforeConflictRestore)
      .filter(
        (entry) =>
          browserWorkflowActionTools.has(entry.name) &&
          entry.arguments.action === "find-open" &&
          entry.arguments.operationId === heldConflictOperationId,
      )
      .at(-1)!;
    expect(conflictRestore.arguments).toMatchObject({
      expectedRevision: restorationSnapshot.revision,
      expectedStateFingerprint: restorationSnapshot.stateFingerprint,
      payload: { candidateSnapshotId: openedCandidateId },
    });
    expect(conflictRestore.arguments.expectedRevision).not.toBe(
      snapshot.revision,
    );
    expect(conflictRestore.result.structuredContent).toMatchObject({
      ok: false,
      outcome: "conflict",
      mode: "find",
    });
    const restoredConflictSnapshot = privateWorkflowSnapshot(
      conflictRestore.result,
    );
    expect(restoredConflictSnapshot).toMatchObject({
      mode: "find",
      revision: externalSnapshot.revision,
      stateFingerprint: externalSnapshot.stateFingerprint,
    });
    await expect(app.locator(".workflow-notice")).toContainText(
      "Screen 2 restored the canonical result for this operation.",
    );
    const restoredExternalWinner = restoredCandidates.filter({
      hasText: externalWinnerTitle,
    });
    await expect(restoredExternalWinner).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(app.locator("#s2-find-candidate-detail h2")).toContainText(
      externalWinner!.identity.canonicalTitle,
    );
    await testInfo.attach("simulated-find-remount-conflict-restore.json", {
      body: JSON.stringify(
        {
          simulatedEvidence: true,
          signedInChatGptEvidence: false,
          restored: {
            mode: restorationSnapshot.mode,
            revision: restorationSnapshot.revision,
            stateFingerprint: restorationSnapshot.stateFingerprint,
            openedCandidateSnapshotId: openedCandidateId,
          },
          ignoredNotificationRevision: snapshot.revision,
          conflictWinner: {
            mode: externalSnapshot.mode,
            revision: externalSnapshot.revision,
            stateFingerprint: externalSnapshot.stateFingerprint,
            openedCandidateSnapshotId:
              externalState.decision.openedCandidateSnapshotId,
          },
        },
        null,
        2,
      ),
      contentType: "application/json",
    });

    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-find-searched-desktop",
    );
    await expectNoHorizontalPageOverflow(app);

    const callsBeforeDismissedReset = await capturedToolCalls(page);
    const restoredReset = app.getByRole("button", {
      name: "Reset Screen 2",
    });
    await restoredReset.press("Enter");
    const resetDialog = app.getByRole("dialog", {
      name: "Reset Screen 2?",
    });
    await expect(resetDialog).toBeVisible();
    await expect(resetDialog).toContainText(
      "It starts a blank Find run while preserving the confirmed Screen 1 study exactly.",
    );
    const cancelReset = resetDialog.getByRole("button", { name: "Cancel" });
    await expect(cancelReset).toBeFocused();
    await cancelReset.press("Enter");
    await expect(resetDialog).toHaveCount(0);
    await expect(restoredReset).toBeFocused();
    await expect(candidates.first()).toContainText(openedCandidateTitle);
    const callsAfterDismissedReset = await capturedToolCalls(page);
    expect(
      callsAfterDismissedReset.filter(
        (call) => call.name === currentWorkflowCreateTool,
      ),
    ).toEqual(
      callsBeforeDismissedReset.filter(
        (call) => call.name === currentWorkflowCreateTool,
      ),
    );
    expect(
      callsAfterDismissedReset.filter(
        (call) => call.name === "retire_screen02_workflow_v021",
      ),
    ).toEqual([]);

    await saveSimulatedScreenshot(
      page,
      testInfo,
      "simulated-find-v021-desktop-success",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("Reset opens a blank replacement before retiring the old canonical run", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const issues = captureBrowserIssues(page);
    const { app, snapshot, serverToolResults } =
      await openCanonicalWorkflow(page, "find");
    const callsBeforeReset = (await capturedToolCalls(page)).length;
    const resultsBeforeReset = serverToolResults.length;

    await app
      .getByRole("button", { name: "Reset Screen 2" })
      .click();
    const resetDialog = app.getByRole("dialog", {
      name: "Reset Screen 2?",
    });
    await expect(resetDialog).toBeVisible();
    await resetDialog
      .getByRole("button", { name: "Confirm reset Screen 2" })
      .click();
    await expect(resetDialog).toHaveCount(0);

    const replacement = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
      resultsBeforeReset,
    );
    const retirement = await waitForServerToolResult(
      serverToolResults,
      "retire_screen02_workflow_v021",
      resultsBeforeReset,
    );
    const resetCalls = (await capturedToolCalls(page)).slice(callsBeforeReset);
    const replacementCallIndex = resetCalls.findIndex(
      (call) => call.name === currentWorkflowCreateTool,
    );
    const retirementCallIndex = resetCalls.findIndex(
      (call) => call.name === "retire_screen02_workflow_v021",
    );
    expect(replacementCallIndex).toBeGreaterThanOrEqual(0);
    expect(retirementCallIndex).toBeGreaterThan(replacementCallIndex);

    const replacementSnapshot = privateWorkflowSnapshot(replacement.result);
    expect(replacementSnapshot).toMatchObject({
      mode: "find",
      revision: 0,
      assessmentBatch: null,
      handoff: null,
    });
    expect(replacementSnapshot.runId).not.toBe(snapshot.runId);
    expect(retirement.arguments).toMatchObject({
      runId: snapshot.runId,
      accessToken: snapshot.accessToken,
      expectedRevision: snapshot.revision,
      expectedStateFingerprint: snapshot.stateFingerprint,
    });
    expect(retirement.result.structuredContent).toMatchObject({
      ok: true,
      outcome: "retired",
      runId: snapshot.runId,
    });
    await expect(app.getByTestId("screen02-find-assessment-count")).toHaveText(
      "No assessments requested",
    );
    await expect(
      app.getByRole("button", { name: /find candidate shocks/i }),
    ).toBeVisible();

    const retiredRunProbe = await callMcpTool(
      baseUrl,
      workflowActionTool,
      workflowMutationArguments(
        snapshot,
        "simulated-browser-retired-run-refresh",
        "refresh",
        {},
      ),
    );
    expect(retiredRunProbe.isError).toBe(true);
    expect(JSON.stringify(retiredRunProbe.content)).toContain(
      "This Screen 2 run is unavailable or expired",
    );
    await testInfo.attach("simulated-positive-reset-order.json", {
      body: JSON.stringify(
        {
          simulatedEvidence: true,
          signedInChatGptEvidence: false,
          orderedCalls: resetCalls.map((call) => call.name),
          replacementUsesDifferentRun:
            replacementSnapshot.runId !== snapshot.runId,
          retirementOutcome: retirement.result.structuredContent?.outcome,
          oldRunUnavailableAfterRetirement: true,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await saveSimulatedScreenshot(
      page,
      testInfo,
      "simulated-find-v021-positive-reset-success",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("a retired host-task refresh cannot release a replacement opener", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const {
      app,
      serverToolResults,
      waitForHeldWorkflowAction,
      releaseHeldWorkflowAction,
      waitForHeldWorkflowCreate,
      releaseHeldWorkflowCreate,
    } = await openCanonicalWorkflow(page, "find", {
      holdWorkflowAction: "refresh",
      holdWorkflowCreate: true,
      restoreAppliedScreen02HostTask: true,
    });

    await waitForHeldWorkflowAction();
    await app
      .getByRole("button", { name: "Reset Screen 2" })
      .click();
    await app
      .getByRole("dialog", { name: "Reset Screen 2?" })
      .getByRole("button", { name: "Confirm reset Screen 2" })
      .click();
    await waitForHeldWorkflowCreate();

    releaseHeldWorkflowAction();
    await waitForServerWorkflowResult(
      serverToolResults,
      "refresh",
    );
    await expect(app.getByTestId("screen02-preparation")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    const beforeReplacement = serverToolResults.length;
    releaseHeldWorkflowCreate();
    const replacement = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
      beforeReplacement,
    );
    const replacementSnapshot = privateWorkflowSnapshot(replacement.result);
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    const search = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    expect(search.arguments.runId).toBe(replacementSnapshot.runId);
  });

  test("a retired Screen 2 opener cannot unlock or overwrite a newer opener", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const {
      app,
      initialResult,
      serverToolResults,
      waitForHeldWorkflowCreate,
      releaseHeldWorkflowCreate,
    } = await openDefaultScreen01(page, "find", {
      sentence: confirmedWorkflowFindContext().studySentence,
      browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
      holdWorkflowCreate: true,
    });

    const confirm = app.locator(".confirm-row button");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await waitForHeldWorkflowCreate();
    await expect(app.getByTestId("screen02-preparation")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    const initialStructured = record(
      initialResult.structuredContent,
      "initial Screen 1 result",
    );
    const interruptedState = structuredClone(
      record(initialStructured.state, "initial Screen 1 state"),
    );
    interruptedState.revision = 10_000;
    interruptedState.confirmed = false;
    await notifyToolResult(
      page,
      "simulated-screen01-invalidation-during-old-opener",
      {},
      {
        structuredContent: {
          state: interruptedState,
        },
      },
    );

    await expect(app.locator('[data-mode="find"]')).toBeVisible();
    const replacementConfirm = app.locator(".confirm-row button");
    await expect(replacementConfirm).toBeEnabled();
    await replacementConfirm.click();
    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    const newerOpen = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
    );
    const newerSnapshot = privateWorkflowSnapshot(newerOpen.result);
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    await expect(
      app.getByRole("button", { name: /find candidate shocks/i }),
    ).toBeEnabled();

    releaseHeldWorkflowCreate();
    await expect.poll(() =>
      serverToolResults.filter(
        (entry) => entry.name === currentWorkflowCreateTool,
      ).length
    ).toBe(2);
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    await expect(
      app.getByRole("button", { name: /find candidate shocks/i }),
    ).toBeEnabled();
    await expect(
      app.getByText(/could not safely open Screen 2/i),
    ).toHaveCount(0);

    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    const search = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    expect(search.arguments.runId).toBe(newerSnapshot.runId);
  });

  test("Reset replaces a Find run while an old mutation is pending and ignores its late result", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const {
      app,
      snapshot,
      serverToolResults,
      waitForHeldWorkflowAction,
      releaseHeldWorkflowAction,
    } = await openCanonicalWorkflow(page, "find", {
      holdWorkflowAction: "find-search",
    });

    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    await waitForHeldWorkflowAction();
    const beforeReset = serverToolResults.length;
    await app
      .getByRole("button", { name: "Reset Screen 2" })
      .click();
    await app
      .getByRole("dialog", { name: "Reset Screen 2?" })
      .getByRole("button", { name: "Confirm reset Screen 2" })
      .click();

    const replacement = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
      beforeReset,
    );
    expect(replacement.arguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
      initialState: "blank",
      studyContext: confirmedWorkflowFindContext(),
    });
    await waitForServerToolResult(
      serverToolResults,
      "retire_screen02_workflow_v021",
      beforeReset,
    );
    const replacementSnapshot = privateWorkflowSnapshot(replacement.result);
    expect(replacementSnapshot.runId).not.toBe(snapshot.runId);
    expect(
      stateFromScreen02WorkflowClientSnapshot(replacementSnapshot)
        .screen01Baseline,
    ).toEqual(confirmedWorkflowFindContext());

    releaseHeldWorkflowAction();
    await expect
      .poll(
        () =>
          serverToolResults.filter(
            (entry) =>
              browserWorkflowActionTools.has(entry.name) &&
              entry.arguments.action === "find-search",
          ).length,
      )
      .toBe(1);
    await expect(app.getByTestId("screen02-find-assessment-count")).toHaveText(
      "No assessments requested",
    );
    await expect(
      app.getByRole("button", { name: /find candidate shocks/i }),
    ).toBeVisible();
    expect(
      serverToolResults.filter(
        (entry) => entry.name === currentWorkflowCreateTool,
      ),
    ).toHaveLength(1);
  });

  test("Audit reset preserves the exact anchor and permits a fresh identity search", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const issues = captureBrowserIssues(page);
    const { app, snapshot, serverToolResults } =
      await openCanonicalWorkflow(page, "audit");
    const beforeReset = serverToolResults.length;

    await app
      .getByRole("button", { name: "Reset Screen 2" })
      .click();
    const resetDialog = app.getByRole("dialog", {
      name: "Reset Screen 2?",
    });
    await expect(resetDialog).toContainText(
      "preserving the exact known-shock anchor and confirmed Screen 1 study",
    );
    await resetDialog
      .getByRole("button", { name: "Confirm reset Screen 2" })
      .click();

    const replacement = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
      beforeReset,
    );
    expect(replacement.arguments).toMatchObject({
      schemaVersion: SCREEN_02_WORKFLOW_CREATE_SCHEMA_VERSION_V024,
      initialState: "blank",
      studyContext: confirmedWorkflowAuditContext(),
    });
    await waitForServerToolResult(
      serverToolResults,
      "retire_screen02_workflow_v021",
      beforeReset,
    );
    const replacementSnapshot = privateWorkflowSnapshot(replacement.result);
    const replacementState = stateFromScreen02WorkflowClientSnapshot(
      replacementSnapshot,
    );
    expect(replacementState.mode).toBe("audit");
    if (replacementState.mode !== "audit") {
      throw new Error("Expected a fresh Audit replacement.");
    }
    expect(replacementState.runId).not.toBe(snapshot.runId);
    expect(replacementState.revision).toBe(0);
    expect(replacementState.screen01Baseline).toEqual(
      confirmedWorkflowAuditContext(),
    );
    expect(replacementState.anchor.originalWording).toBe(
      "California Consumer Privacy Act",
    );
    expect(replacementState.sources).toEqual([]);
    expect(replacementState.matchSets).toEqual([]);
    expect(replacementState.activeMatchSetSnapshotId).toBeNull();
    expect(replacementState.possibleMatches).toEqual([]);
    expect(replacementState.dossiers).toEqual([]);
    expect(replacementState.identityDecisions).toEqual([]);
    expect(replacementState.confirmedIdentity).toBeNull();
    expect(replacementState.assessments).toEqual([]);
    expect(replacementState.assessmentRequests).toEqual([]);
    expect(replacementState.continuationHistory).toEqual([]);
    expect(
      serverToolResults.some(
        (entry) =>
          browserWorkflowActionTools.has(entry.name) &&
          entry.arguments.action === "audit-open" &&
          entry.arguments.runId === replacementSnapshot.runId,
      ),
    ).toBe(false);

    const beforeFreshSearch = serverToolResults.length;
    const anchorDetails = app.locator("details.s2-audit-anchor-form");
    await anchorDetails
      .getByLabel("Reason for this revision")
      .fill("Run a fresh identity search after reset.");
    await anchorDetails
      .getByRole("button", { name: "Search with revised details" })
      .click();
    const searched = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-revise-anchor",
      beforeFreshSearch,
    );
    expect(searched.arguments.runId).toBe(replacementSnapshot.runId);
    expect(privateWorkflowSnapshot(searched.result).revision).toBeGreaterThan(
      0,
    );
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-audit-reset-fresh-search",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test.skip("historical v0.3.13 compatibility-only CCPA Find route is not a current Stage B path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const sentence =
      "Find a regulatory shock affecting U.S. publicly listed technology firms from 2017 to 2023 that may affect annual profitability.";
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      sentence,
      browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
      hostModelResponder: automaticV036HostResponder(),
      messageResponseDelayMs: 150,
      hostCapabilities: { serverTools: {}, logging: {} },
      installChatGptCompatibilityBridge: true,
    });

    const draftButton = app.getByRole("button", {
      name: "Fill scope fields with ChatGPT",
    });
    await expect(draftButton).toBeEnabled();
    await draftButton.click();
    await expect(
      app.getByRole("button", { name: "Update scope fields with ChatGPT" }),
    ).toBeVisible();
    await expect(app.locator("#host-draft-help")).toContainText(
      "ChatGPT drafted the Scope Contract. Review every field before confirming.",
    );
    for (const value of [
      "U.S. publicly listed technology firms",
      "United States",
      "Technology",
      "2017–2023",
      "Regulation",
      "Profitability",
    ]) {
      await expect(app.getByText(value, { exact: true })).toBeVisible();
    }

    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expect(scopeConfirm).toHaveText("Scope confirmed");
    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();

    await app.getByRole("button", {
      name: "Plan with ChatGPT and find candidate shocks",
    }).click();
    const candidates = app.locator(".s2-find-candidate-row");
    const ccpaRow = candidates.filter({
      hasText: "California Consumer Privacy Act",
    });
    await expect(ccpaRow).toBeVisible();
    await expect(ccpaRow).toContainText("Assessment ready.");
    await ccpaRow.click();

    const details = app.locator("#s2-find-candidate-detail");
    await expect(details.getByRole("heading", {
      name: "California Consumer Privacy Act",
    })).toBeVisible();
    await expect(details).toContainText("California Civil Code § 1798.100 et seq.");
    await expect(details).toContainText("California Legislature");
    await expect(details).toContainText("California, United States");
    await expect(details).toContainText("1 Jan 2020");
    await expect(details).toContainText(
      "Qualifying for-profit businesses doing business in California",
    );
    await expect(details).toContainText(/California business nexus/i);
    await expect(details).toContainText("annual gross revenue over $25 million");
    await expect(details).toContainText(
      "50,000 or more consumers, households, or devices",
    );
    await expect(details).toContainText(
      "50 percent or more annual revenue from selling consumers' personal information",
    );
    await expect(details).toContainText(/personal-information activity/i);
    await expect(details).toContainText(
      /exemptions still require firm-level verification/i,
    );
    await expect(details).toContainText("June 28, 2018 enactment");
    await expect(details).toContainText("January 1, 2020 operative date");
    await expect(details).toContainText(
      "compliance, technology, and data-governance costs",
    );
    await expect(details).toContainText(
      "data-enabled products, advertising, or data sales",
    );
    await expect(details).toContainText(
      "fines, litigation, and other legal exposure",
    );
    await expect(details).toContainText(
      "trust, retention, or loss-avoidance benefits",
    );
    await expect(details).toContainText(
      "not an observed or established causal effect",
    );
    await expect(details).toContainText(
      "direction and magnitude remain unknown",
    );
    await expect(details).toContainText(
      "are not uniformly covered because CCPA applicability depends on California nexus",
    );

    const statuteLink = details.getByRole("link", {
      name: /California Assembly Bill 375, Chapter 55/u,
    });
    await expect(statuteLink).toBeVisible();
    await expect(statuteLink).toHaveAttribute(
      "href",
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375",
    );
    await expect(details.getByRole("link", {
      name: /Initial Statement of Reasons for California Consumer Privacy Act Regulations/u,
    })).toBeVisible();
    expect(await details.locator(".s2-find-source a").count()).toBeGreaterThanOrEqual(2);

    const searchRecord = app.locator(".s2-find-coverage details");
    await searchRecord.locator("summary").click();
    await expect(searchRecord).toContainText(
      "ChatGPT planned bounded retrieval vocabulary",
    );
    await expect(searchRecord).toContainText(
      "California consumer privacy business thresholds",
    );
    await expect(searchRecord).toContainText("prove no event fact");

    const choose = details.getByRole("button", { name: "Choose this shock" });
    await expect(choose).toBeEnabled();
    const beforeSelection = serverToolResults.length;
    await choose.click();
    await waitForServerWorkflowResult(
      serverToolResults,
      "find-select",
      beforeSelection,
    );
    await expect(
      details.getByRole("button", { name: "Chosen" }),
    ).toBeDisabled();
    await expect(
      app.getByRole("button", { name: "Undo choice" }),
    ).toBeEnabled();
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(app.getByTestId("screen03")).toBeVisible();
    await expect(app.getByTestId("screen03-timeline")).toContainText(
      "2018-06-28",
    );
    await expect(app.getByTestId("screen03-timeline")).toContainText(
      "2020-01-01",
    );
    const briefingAction = app.getByTestId(
      "screen03-request-host-reasoning",
    );
    await expect(briefingAction).toHaveText(
      "Generate this overview with ChatGPT",
    );
    await briefingAction.click();
    const overview = app.getByTestId("screen03-understand-shock");
    await expect(overview).toContainText("California Consumer Privacy Act");
    await expect(overview).toContainText(
      "ChatGPT-generated source-linked overview · research aid",
    );
    await expectCcpaGeneratedBrief(overview);
    const studyRelevance = app.getByTestId("screen03-study-relevance");
    await expect(studyRelevance).toContainText(
      "U.S. publicly listed technology firms",
    );
    await expect(studyRelevance).toContainText("Profitability");
    const actionability = app.getByTestId("screen03-actionability-checklist");
    for (const variable of [
      "Threshold, exemption, and phase-in inputs needed to classify exposure",
      "Thresholds and exemptions have changed; current summaries cannot be used automatically for a historical 2020 treatment",
      "Verify each firm's California business nexus, historical threshold status, personal-information activity, and exemption status before constructing CCPA exposure",
      "Keep the 2018 enactment, 2020 operative date, and later implementation or enforcement milestones separate",
    ]) {
      await expect(actionability).toContainText(variable);
    }
    const eligibility = app.locator(
      'section[aria-labelledby="s3-eligibility-title"]',
    );
    await expect(eligibility).toContainText(
      "Qualifying for-profit businesses doing business in California",
    );
    const citedEvidence = app
      .locator('details[data-testid^="screen03-evidence-"]')
      .filter({
        has: app.locator('a[aria-label^="Open source record for"]'),
      })
      .first();
    await expect(citedEvidence).toBeVisible();
    const citedEvidenceSummary = citedEvidence.locator("summary");
    await expect(citedEvidenceSummary).toBeVisible();
    await expect(citedEvidenceSummary).toHaveAccessibleName(
      /Read cited evidence for/u,
    );
    await citedEvidenceSummary.click();
    await expect(citedEvidence).toHaveAttribute("open", "");
    await expect(
      citedEvidence.getByRole("link", {
        name: /Open source record for/u,
      }).first(),
    ).toBeVisible();

    await expectAutomaticHostTraffic(page, [
      SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
      "submit_screen02_find_assessment_draft_v021",
      SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    ]);
    const transcript = await hostReasoningTranscript(page);
    expect(transcript.messageRequests).toHaveLength(0);
    expect(transcript.modelContextRequests).toHaveLength(0);
    expect(transcript.compatibilityMessageRequests.length).toBeGreaterThanOrEqual(3);
    expect(
      JSON.stringify(transcript.compatibilityModelContextRequests),
    ).not.toMatch(
      /sa1-capability-v1\.|sa2[af]-capability-v1\.|sa3h-capability-v1\./,
    );
    const screen03Tasks = await screen03HostMessageTasks(page);
    expect(screen03Tasks).toHaveLength(1);
    expectCompactScreen03HostMessageTask(screen03Tasks[0]!);
    const screen03Submission = screen03HostSubmission(serverToolResults);
    expect(screen03Submission.submission.arguments).not.toHaveProperty(
      "sourcePacket",
    );
    expect(screen03Submission.submission.result.isError).not.toBe(true);
    expect(screen03Submission.submission.result.structuredContent).toMatchObject({
      disposition: "applied",
    });

    await app.getByRole("button", {
      name: "Step 2: Choose feasible shock, complete; return to Screen 2",
    }).click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    const reopenChoice = app.getByTestId("screen02-find-reopen-choice");
    await expect(reopenChoice).toHaveCount(1);
    await expect(reopenChoice).toBeEnabled();
    await expect(
      app.getByRole("button", { name: "Undo choice", exact: true }),
    ).toHaveCount(1);

    const beforeUndo = serverToolResults.length;
    await reopenChoice.click();
    const reopened = await waitForServerWorkflowResult(
      serverToolResults,
      "find-clear-selection",
      beforeUndo,
    );
    const reopenedSnapshot = privateWorkflowSnapshot(reopened.result);
    const reopenedState = stateFromScreen02WorkflowClientSnapshot(
      reopenedSnapshot,
    );
    expect(reopenedSnapshot.handoff).toBeNull();
    expect(reopenedState.mode).toBe("find");
    if (reopenedState.mode !== "find") {
      throw new Error("Expected the handed-off Find comparison to reopen.");
    }
    expect(reopenedState.decision.tentativeSelectionSnapshotId).toBeNull();
    expect(reopenedState.decision.continuedRevision).toBeNull();
    await expect(app.getByTestId("screen02-find-sealed")).toHaveCount(0);
    await expect(candidates).toHaveCount(reopenedState.candidates.length);

    const alternativeRow = candidates
      .filter({ hasNotText: "California Consumer Privacy Act" })
      .filter({ hasText: "Assessment ready." })
      .first();
    await expect(alternativeRow).toBeVisible();
    const alternativeShortTitle = (
      await alternativeRow.locator(".s2-find-candidate-row__heading strong")
        .textContent()
    )?.trim();
    expect(alternativeShortTitle).toBeTruthy();
    const beforeAlternativeOpen = serverToolResults.length;
    await alternativeRow.click();
    await waitForServerWorkflowResult(
      serverToolResults,
      "find-open",
      beforeAlternativeOpen,
    );
    await expect(alternativeRow).toHaveAttribute("aria-pressed", "true");
    const alternativeDetail = app.locator("#s2-find-candidate-detail");
    const alternativeHeading = alternativeDetail.getByRole("heading", {
      level: 2,
    });
    await expect(alternativeHeading).toContainText(alternativeShortTitle!);
    const alternativeTitle = (
      await alternativeHeading.textContent()
    )?.trim();
    expect(alternativeTitle).toBeTruthy();
    expect(alternativeTitle).not.toBe("California Consumer Privacy Act");

    const beforeAlternativeSelection = serverToolResults.length;
    await alternativeDetail.getByRole("button", {
      name: "Choose this shock",
    }).click();
    await waitForServerWorkflowResult(
      serverToolResults,
      "find-select",
      beforeAlternativeSelection,
    );
    await expect(
      app.getByRole("button", { name: "Continue to Screen 3: Verify event" }),
    ).toBeEnabled();
    await app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    }).click();
    await expect(app.getByTestId("screen03")).toBeVisible();
    const alternativeBriefingAction = app.getByTestId(
      "screen03-request-host-reasoning",
    );
    await expect(alternativeBriefingAction).toHaveText(
      "Generate this overview with ChatGPT",
    );
    await alternativeBriefingAction.click();
    const alternativeOverview = app.getByTestId("screen03-understand-shock");
    await expect(alternativeOverview).toContainText(alternativeTitle!);
    await expect(alternativeOverview).not.toContainText(
      "California Consumer Privacy Act",
    );
    await expectGeneratedBriefHygiene(alternativeOverview);
    await expect(alternativeOverview).toContainText(
      /large public-interest entities/i,
    );
    await expect(alternativeOverview).toContainText(/500 employees/i);
    await expect(alternativeOverview).toContainText(
      /2017-01-01|January 1, 2017/i,
    );
    await expect(alternativeOverview).toContainText(
      /non-financial statement/i,
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test.skip("historical v0.3.13 CCPA Audit host-draft route is not a current Stage B path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const sentence = confirmedWorkflowAuditContext().studySentence;
    const automaticResponder = automaticV036HostResponder();
    let markScreen03Started!: () => void;
    let releaseScreen03!: () => void;
    const screen03Started = new Promise<void>((resolve) => {
      markScreen03Started = resolve;
    });
    const screen03Gate = new Promise<void>((resolve) => {
      releaseScreen03 = resolve;
    });
    const delayedScreen03Responder = async (request: HostModelRequest) => {
      const context = optionalRecord(
        request.latestModelContext?.structuredContent,
      );
      if (
        context?.schemaVersion === SCREEN_03_HOST_DRAFT_BATCH_SCHEMA_VERSION ||
        context?.schemaVersion === screen03HostMessageTaskSchemaVersion
      ) {
        markScreen03Started();
        await screen03Gate;
      }
      return automaticResponder(request);
    };
    const { app, serverToolResults } = await openDefaultScreen01(
      page,
      "audit",
      {
        sentence,
        browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
        hostModelResponder: delayedScreen03Responder,
        messageResponseDelayMs: 200,
        hostCapabilities: { serverTools: {}, logging: {} },
        installChatGptCompatibilityBridge: true,
      },
    );

    const draftButton = app.getByRole("button", {
      name: "Fill scope fields with ChatGPT",
    });
    await expect(draftButton).toBeEnabled();
    await draftButton.click();
    await expect(
      app.getByRole("button", { name: "Update scope fields with ChatGPT" }),
    ).toBeVisible();
    await expect(app.locator("#host-draft-help")).toContainText(
      "ChatGPT drafted the Scope Contract. Review every field before confirming.",
    );
    await expect(app.getByText("California Consumer Privacy Act", { exact: true }))
      .toBeVisible();
    await expect(app.getByText("U.S. publicly listed technology firms", { exact: true }))
      .toBeVisible();

    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expect(scopeConfirm).toHaveText("Scope confirmed");
    await app
      .getByRole("button", {
        name: "Step 2: Represent known shock, available next",
      })
      .click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();

    const matchRow = app.locator(".s2-audit-match").filter({
      hasText: "California Consumer Privacy Act",
    }).first();
    await expect(matchRow).toBeVisible();
    await matchRow.click();
    const dossier = app.locator("#s2-audit-match-detail");
    await expect(dossier).toContainText("At a glance");
    await expect(dossier).toContainText(
      "California enacted a consumer privacy statute",
    );
    await dossier.getByLabel("Reason for the identity decision").fill(
      "The official title, California jurisdiction, and statute identity match the named CCPA shock.",
    );
    const confirmIdentity = dossier.getByRole("button", {
      name: "Yes, this is the shock I meant",
    });
    await expect(confirmIdentity).toBeEnabled();
    await confirmIdentity.click();
    await expect(app.locator(".s2-audit-assessment-status")).toContainText(
      "Assessment ready.",
    );
    const outcomeAssessment = app
      .getByRole("heading", { name: /How it may affect Innovation/u })
      .locator("..");
    await expect(outcomeAssessment).toContainText(
      "Privacy duties may redirect compliance and product work",
    );

    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(app.getByTestId("screen03")).toBeVisible();
    const overview = app.getByTestId("screen03-understand-shock");
    const intro = overview.locator(".s3-snapshot__intro");
    const briefingAction = app.getByTestId("screen03-request-host-reasoning");
    await expect(briefingAction).toHaveText(
      "Generate this overview with ChatGPT",
    );
    await briefingAction.click();
    await screen03Started;
    await expect(briefingAction).toHaveText(
      "ChatGPT is generating…",
    );
    await expect(overview).toContainText(
      "Preparing what the shock is, what it does, who it covers, and its key timing.",
    );
    await expectDeterministicScreen03Fallback(overview);
    await expect(overview).not.toContainText(
      "The bill would require the Attorney General to solicit public participation",
    );
    releaseScreen03();
    await expectCcpaGeneratedBrief(overview);
    await expect(overview).toContainText(
      "ChatGPT-generated source-linked overview · research aid",
    );
    const generatedIntro = (await intro.textContent())?.trim();
    expect(generatedIntro).toBeTruthy();
    // The panel keeps its deterministic source-linked fallback until the
    // host-origin draft is validated. The completed action, bounded
    // submission, citations, and full briefing checks establish provenance.
    await expect(
      overview.getByRole("heading", { name: "Understand this shock" }),
    ).toBeVisible();
    await expect(overview).not.toContainText(
      "These selected source-backed claims bound the event content",
    );
    await expect(overview).not.toContainText(
      "Plain-language interpretation unavailable",
    );
    await expect(overview).toContainText(/In plain terms,/);
    await expectCcpaGeneratedBrief(overview);
    const studyRelevance = app.getByTestId("screen03-study-relevance");
    await expect(studyRelevance).toContainText(
      "Why this may matter for your study",
    );
    await expect(studyRelevance).toContainText(
      "U.S. publicly listed technology firms",
    );
    await expect(studyRelevance).toContainText("Innovation");
    await expect(
      app.getByTestId("screen03-request-host-reasoning"),
    ).toHaveText("Refresh this overview with ChatGPT");
    const screen03Submission = screen03HostSubmission(serverToolResults);
    const readerHelp = app.locator(
      ".s3-field__reader-help, .s3-time-card__reader-help",
    );
    expect(await readerHelp.count()).toBe(
      screen03Submission.requestedProposalIds.length,
    );
    for (const proposalId of screen03Submission.requestedProposalIds) {
      const inlineHelp = app.locator(
        `[data-testid="screen03-field-${proposalId}"] .s3-field__reader-help, ` +
          `[data-testid="screen03-stage-${proposalId}"] .s3-time-card__reader-help`,
      );
      await expect(inlineHelp).toContainText("ChatGPT-assisted wording");
    }
    await expect(
      app.locator(".s3-field__reader-help").first(),
    ).toContainText("linked online source");
    await expect(
      app.locator('[data-testid^="screen03-plain-language-"]'),
    ).toHaveCount(0);

    await expectAutomaticHostTraffic(page, [
      SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
      "submit_screen02_audit_draft_v021",
      SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    ]);
    const screen03Tasks = await screen03HostMessageTasks(page);
    expect(screen03Tasks).toHaveLength(1);
    expectCompactScreen03HostMessageTask(screen03Tasks[0]!);
    expect(screen03Submission.submission.arguments).not.toHaveProperty(
      "sourcePacket",
    );
    expect(
      serverToolResults.filter(
        (entry) => entry.name === SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
      ),
    ).toHaveLength(1);
    expect(
      serverToolResults.filter(
        (entry) => entry.name === "submit_screen02_audit_draft_v021",
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen03Submission.submission.result.isError).not.toBe(true);
    expect(screen03Submission.submission.result.structuredContent).toMatchObject({
      disposition: "applied",
    });
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test.skip("historical Screen 3 sampling route is not a current Stage B path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    let markSamplingStarted!: () => void;
    let releaseSampling!: () => void;
    const samplingStarted = new Promise<void>((resolve) => {
      markSamplingStarted = resolve;
    });
    const samplingGate = new Promise<void>((resolve) => {
      releaseSampling = resolve;
    });
    const { app, serverToolResults } = await openDefaultScreen01(
      page,
      "audit",
      {
        sentence: confirmedWorkflowAuditContext().studySentence,
        browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
        hostCapabilities: {
          sampling: { tools: {} },
          serverTools: {},
          logging: {},
          message: { text: {} },
          updateModelContext: { text: {}, structuredContent: {} },
        },
        hostModelResponder: automaticV036HostResponder({ screen03: false }),
        hostSamplingResponder: async (request) => {
          markSamplingStarted();
          await samplingGate;
          const modelContext = modelContextFromSamplingMessage(
            request.message,
          );
          return screen03DraftFromBatch({ modelContext });
        },
      },
    );

    await app.getByRole("button", {
      name: "Fill scope fields with ChatGPT",
    }).click();
    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await app
      .getByRole("button", {
        name: "Step 2: Represent known shock, available next",
      })
      .click();

    const matchRow = app.locator(".s2-audit-match").filter({
      hasText: "California Consumer Privacy Act",
    }).first();
    await expect(matchRow).toBeVisible();
    await matchRow.click();
    const dossier = app.locator("#s2-audit-match-detail");
    await dossier.getByLabel("Reason for the identity decision").fill(
      "The official title, California jurisdiction, and statute identity match the named CCPA shock.",
    );
    await dossier.getByRole("button", {
      name: "Yes, this is the shock I meant",
    }).click();
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    const briefingAction = app.getByTestId(
      "screen03-request-host-reasoning",
    );
    await expect(briefingAction).toHaveText(
      "Generate this overview with ChatGPT",
    );
    await briefingAction.click();
    await samplingStarted;

    const screen03 = app.getByTestId("screen03");
    const overview = app.getByTestId("screen03-understand-shock");
    await expect(screen03).toBeVisible();
    await expect(
      app.getByTestId("screen03-request-host-reasoning"),
    ).toHaveText("ChatGPT is generating…");
    await expect(overview).toContainText(
      "Preparing what the shock is, what it does, who it covers, and its key timing.",
    );
    await expectDeterministicScreen03Fallback(overview);
    await expect(overview).not.toContainText(
      "The bill would require the Attorney General to solicit public participation",
    );
    await expect(overview).not.toContainText(
      "This title is intended to supplement federal and state law",
    );

    let pendingTranscript = await hostReasoningTranscript(page);
    expect(pendingTranscript.samplingRequests).toHaveLength(1);
    expect(pendingTranscript.samplingRequests[0]!.params).toMatchObject({
      includeContext: "none",
      toolChoice: { mode: "required" },
      tools: [{ name: SCREEN_03_HOST_DRAFT_SAMPLING_OUTPUT_TOOL }],
    });
    expect(await screen03HostMessageTasks(page)).toHaveLength(0);

    releaseSampling();
    await expectCcpaGeneratedBrief(overview);
    await expect(
      app.getByTestId("screen03-request-host-reasoning"),
    ).toHaveText("Refresh this overview with ChatGPT");
    await expect(
      app.getByTestId("screen03-briefing-citations-intro")
        .getByRole("link")
        .first(),
    ).toBeVisible();
    await expect(
      app.getByTestId("screen03-briefing-citations-point-1")
        .getByRole("link")
        .first(),
    ).toBeVisible();

    const submission = screen03HostSubmission(serverToolResults).submission;
    expect(submission.arguments).not.toHaveProperty("sourcePacket");
    expect(submission.result.isError).not.toBe(true);
    expect(submission.result.structuredContent).toMatchObject({
      disposition: "applied",
    });
    pendingTranscript = await hostReasoningTranscript(page);
    expect(pendingTranscript.samplingRequests).toHaveLength(1);
    expect(
      pendingTranscript.events.filter(
        (event) => event.method === "sampling/createMessage",
      ),
    ).toHaveLength(1);
    expect(await screen03HostMessageTasks(page)).toHaveLength(0);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test.skip("historical Screen 3 sampling retry is not a current Stage B path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    let samplingAttempt = 0;
    const { app, serverToolResults } = await openDefaultScreen01(
      page,
      "audit",
      {
        sentence: confirmedWorkflowAuditContext().studySentence,
        browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
        hostCapabilities: {
          sampling: { tools: {} },
          serverTools: {},
          logging: {},
        },
        hostSamplingResponder: (request) => {
          samplingAttempt += 1;
          if (samplingAttempt === 1) {
            return {
              snapshot: {
                intro: {
                  text: "This invalid draft cites no bounded proposal.",
                  proposalIds: ["screen03-unknown-proposal"],
                },
                keyPoints: [{
                  text: "The server must reject this stale proposal reference.",
                  proposalIds: ["screen03-unknown-proposal"],
                }],
              },
            };
          }
          const modelContext = modelContextFromSamplingMessage(
            request.message,
          );
          return screen03DraftFromBatch({ modelContext });
        },
      },
    );

    await app.getByRole("button", {
      name: "Fill scope fields from my description",
    }).click();
    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await app.getByRole("button", {
      name: "Step 2: Represent known shock, available next",
    }).click();
    const matchRow = app.locator(".s2-audit-match").filter({
      hasText: "California Consumer Privacy Act",
    }).first();
    await expect(matchRow).toBeVisible();
    await matchRow.click();
    const dossier = app.locator("#s2-audit-match-detail");
    await dossier.getByLabel("Reason for the identity decision").fill(
      "The official title, jurisdiction, and statute identifier match the named CCPA shock.",
    );
    const confirmIdentity = dossier.getByRole("button", {
      name: "Yes, this is the shock I meant",
    });
    await expect(confirmIdentity).toBeEnabled();
    await confirmIdentity.click();
    await expect(app.locator(".s2-audit-assessment-status")).toContainText(
      "Assessment ready.",
    );
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    const overview = app.getByTestId("screen03-understand-shock");
    const retry = app.getByTestId("screen03-request-host-reasoning");
    await expect(retry).toHaveText("Generate this overview with ChatGPT");
    await retry.click();
    await expect(retry).toHaveText("Try the briefing again");
    await expect(retry).toBeEnabled();
    await expect(overview).toContainText(
      "The validated briefing did not arrive. Retry without changing the exact claims below.",
    );
    await expectDeterministicScreen03Fallback(overview);
    await expect(overview).not.toContainText(
      "This invalid draft cites no bounded proposal.",
    );

    let prepares = serverToolResults.filter(
      (entry) => entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036,
    );
    let submissions = serverToolResults.filter(
      (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    );
    expect(prepares).toHaveLength(1);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]!.result.isError).not.toBe(true);
    expect(submissions[0]!.result.structuredContent).toMatchObject({
      disposition: "rejected",
      reason: expect.stringMatching(/safely grounded|exact facts/iu),
    });
    const firstBatch = record(
      prepares[0]!.result.structuredContent,
      "first Screen 3 sampling batch",
    );
    expect(submissions[0]!.arguments).toMatchObject({
      requestId: firstBatch.requestId,
      capabilityToken: firstBatch.capabilityToken,
    });

    await retry.click();
    await expectCcpaGeneratedBrief(overview);
    await expect(retry).toHaveText("Refresh this overview with ChatGPT");

    prepares = serverToolResults.filter(
      (entry) => entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036,
    );
    submissions = serverToolResults.filter(
      (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    );
    expect(prepares).toHaveLength(2);
    expect(submissions).toHaveLength(2);
    const secondBatch = record(
      prepares[1]!.result.structuredContent,
      "second Screen 3 sampling batch",
    );
    expect(secondBatch.requestId).not.toBe(firstBatch.requestId);
    expect(secondBatch.capabilityToken).not.toBe(firstBatch.capabilityToken);
    expect(submissions[1]!.arguments).toMatchObject({
      requestId: secondBatch.requestId,
      capabilityToken: secondBatch.capabilityToken,
    });
    expect(submissions[1]!.arguments.requestId).not.toBe(
      submissions[0]!.arguments.requestId,
    );
    expect(submissions[1]!.arguments.capabilityToken).not.toBe(
      submissions[0]!.arguments.capabilityToken,
    );
    expect(submissions[1]!.result.isError).not.toBe(true);
    expect(submissions[1]!.result.structuredContent).toMatchObject({
      disposition: "applied",
    });
    const transcript = await hostReasoningTranscript(page);
    expect(transcript.samplingRequests).toHaveLength(2);
    expect(await screen03HostMessageTasks(page)).toHaveLength(0);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test.skip("historical late sampling result is not a current Stage B path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    let samplingAttempt = 0;
    let markLateCcpaStarted!: () => void;
    let markLateCcpaReturned!: () => void;
    let releaseLateCcpa!: () => void;
    let markAlternativeStarted!: () => void;
    let releaseAlternative!: () => void;
    const lateCcpaStarted = new Promise<void>((resolve) => {
      markLateCcpaStarted = resolve;
    });
    const lateCcpaReturned = new Promise<void>((resolve) => {
      markLateCcpaReturned = resolve;
    });
    const lateCcpaGate = new Promise<void>((resolve) => {
      releaseLateCcpa = resolve;
    });
    const alternativeStarted = new Promise<void>((resolve) => {
      markAlternativeStarted = resolve;
    });
    const alternativeGate = new Promise<void>((resolve) => {
      releaseAlternative = resolve;
    });
    const sentence =
      "Find a regulatory shock affecting U.S. publicly listed technology firms from 2017 to 2023 that may affect annual profitability.";
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      sentence,
      browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
      hostCapabilities: {
        sampling: { tools: {} },
        serverTools: {},
        logging: {},
        message: { text: {} },
        updateModelContext: { text: {}, structuredContent: {} },
      },
      hostModelResponder: automaticV036HostResponder({ screen03: false }),
      hostSamplingResponder: async (request) => {
        samplingAttempt += 1;
        const modelContext = modelContextFromSamplingMessage(request.message);
        if (samplingAttempt === 2) {
          markLateCcpaStarted();
          await lateCcpaGate;
          markLateCcpaReturned();
        } else if (samplingAttempt === 3) {
          markAlternativeStarted();
          await alternativeGate;
        }
        return screen03DraftFromBatch({ modelContext });
      },
    });

    await app.getByRole("button", {
      name: "Fill scope fields with ChatGPT",
    }).click();
    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await app.getByRole("button", {
      name: "Continue to shock feasibility",
    }).click();
    await app.getByRole("button", {
      name: "Plan with ChatGPT and find candidate shocks",
    }).click();

    const candidates = app.locator(".s2-find-candidate-row");
    const ccpaRow = candidates.filter({
      hasText: "California Consumer Privacy Act",
    });
    await expect(ccpaRow).toBeVisible();
    await ccpaRow.click();
    const details = app.locator("#s2-find-candidate-detail");
    await details.getByRole("button", { name: "Choose this shock" }).click();
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    const overview = app.getByTestId("screen03-understand-shock");
    const briefingAction = app.getByTestId("screen03-request-host-reasoning");
    await expect(briefingAction).toHaveText(
      "Generate this overview with ChatGPT",
    );
    await briefingAction.click();
    await expectCcpaGeneratedBrief(overview);
    await expect(briefingAction).toHaveText(
      "Refresh this overview with ChatGPT",
    );
    await briefingAction.click();
    await lateCcpaStarted;
    await expect(briefingAction).toHaveText("ChatGPT is generating…");
    await expect(overview).toContainText(
      "The current ChatGPT-generated overview remains visible while a new one is generated.",
    );
    await expectCcpaGeneratedBrief(overview);

    await app.getByRole("button", {
      name: "Step 2: Choose feasible shock, complete; return to Screen 2",
    }).click();
    const reopenChoice = app.getByTestId("screen02-find-reopen-choice");
    await expect(reopenChoice).toBeEnabled();
    await reopenChoice.click();
    const alternativeRow = candidates
      .filter({ hasNotText: "California Consumer Privacy Act" })
      .filter({ hasText: "Assessment ready." })
      .first();
    await expect(alternativeRow).toBeVisible();
    await alternativeRow.click();
    const alternativeDetail = app.locator("#s2-find-candidate-detail");
    const alternativeHeading = alternativeDetail.getByRole("heading", {
      level: 2,
    });
    await expect(alternativeHeading).not.toHaveText(
      "California Consumer Privacy Act",
    );
    const alternativeTitle = (
      await alternativeHeading.textContent()
    )?.trim();
    expect(alternativeTitle).toBeTruthy();
    expect(alternativeTitle).not.toBe("California Consumer Privacy Act");
    await alternativeDetail.getByRole("button", {
      name: "Choose this shock",
    }).click();
    await app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    }).click();
    await expect(briefingAction).toHaveText(
      "Generate this overview with ChatGPT",
    );
    await briefingAction.click();
    await alternativeStarted;

    await expect(overview).toContainText(
      "Preparing what the shock is, what it does, who it covers, and its key timing.",
    );
    await expectDeterministicScreen03Fallback(overview);
    await expect(overview).not.toContainText("California Consumer Privacy Act");
    await expect(overview).not.toContainText(/25 million|50,000/);

    releaseAlternative();
    await expect(overview).toContainText(alternativeTitle!);
    await expectGeneratedBriefHygiene(overview);
    await expect(overview).not.toContainText("California Consumer Privacy Act");
    const alternativeIntro = (
      await overview.locator(".s3-snapshot__intro").textContent()
    )?.trim();
    expect(alternativeIntro).toBeTruthy();

    releaseLateCcpa();
    await lateCcpaReturned;
    await page.waitForTimeout(500);
    await expect(overview).toContainText(alternativeTitle!);
    await expect(overview).not.toContainText("California Consumer Privacy Act");
    expect(
      (await overview.locator(".s3-snapshot__intro").textContent())?.trim(),
    ).toBe(alternativeIntro);

    const prepares = serverToolResults.filter(
      (entry) => entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036,
    );
    const submissions = serverToolResults.filter(
      (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    );
    expect(prepares).toHaveLength(3);
    expect(submissions).toHaveLength(2);
    const batches = prepares.map((entry, index) =>
      record(
        entry.result.structuredContent,
        `Screen 3 switch batch ${index + 1}`,
      )
    );
    expect(new Set(batches.map((batch) => batch.requestId)).size).toBe(3);
    expect(new Set(batches.map((batch) => batch.capabilityToken)).size).toBe(3);
    const lateCcpaSubmission = submissions.find(
      (entry) => entry.arguments.requestId === batches[1]!.requestId,
    );
    const alternativeSubmission = submissions.find(
      (entry) => entry.arguments.requestId === batches[2]!.requestId,
    );
    expect(lateCcpaSubmission).toBeUndefined();
    expect(alternativeSubmission?.result.isError).not.toBe(true);
    expect(alternativeSubmission?.result.structuredContent).toMatchObject({
      disposition: "applied",
    });
    const transcript = await hostReasoningTranscript(page);
    expect(transcript.samplingRequests).toHaveLength(3);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("Audit opens the current orientation without a host turn while a saved v0.3.15 briefing remains compatible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(accelerateScreen03CapabilityDeadline, {
      deadlineMs: SCREEN_03_HOST_DRAFT_DEFAULT_CAPABILITY_TTL_MS,
      clientClockLeadMs: screen02BrowserClientClockLeadMs,
    });
    const issues = captureBrowserIssues(page);
    const { app, serverToolResults } = await openDefaultScreen01(
      page,
      "audit",
      {
        sentence: confirmedWorkflowAuditContext().studySentence,
        browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
        hostModelResponder: automaticV036HostResponder({ screen03: false }),
        messageResponseDelayMs: 150,
        installChatGptCompatibilityBridge: true,
      },
    );

    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expect(scopeConfirm).toHaveText("Scope confirmed");
    await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
    await app
      .getByRole("button", {
        name: "Step 2: Represent known shock, available next",
      })
      .click();

    const matchRow = app.locator(".s2-audit-match").filter({
      hasText: "California Consumer Privacy Act",
    }).first();
    await expect(matchRow).toBeVisible();
    await matchRow.click();
    const dossier = app.locator("#s2-audit-match-detail");
    await dossier.getByLabel("Reason for the identity decision").fill(
      "The official title, California jurisdiction, and statute identity match the named CCPA shock.",
    );
    await dossier.getByRole("button", {
      name: "Yes, this is the shock I meant",
    }).click();
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    const screen03 = app.getByTestId("screen03");
    const overview = app.getByTestId("screen03-understand-shock");
    await expect(screen03).toBeVisible();
    await expect(screen03).toHaveAttribute("aria-busy", "false");
    await expectCurrentScreen03Orientation(overview, 0);
    await expect(
      overview.getByTestId("screen03-orientation-summary"),
    ).toHaveText("California Consumer Privacy Act is a privacy legislation.");
    await expect(
      overview.getByTestId("screen03-orientation-key-points"),
    ).toHaveCount(0);
    await expectNoCurrentScreen03HostActivity(app, page);
    await expect(overview).not.toContainText(
      "The bill would require the Attorney General to solicit public participation",
    );
    expect(
      serverToolResults.filter(
        (entry) => entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036,
      ),
    ).toHaveLength(0);
    expect(
      serverToolResults.filter(
        (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
      ),
    ).toHaveLength(0);
    await expectNoBrowserOrHostErrors(page, issues);

    const {
      app: historicalApp,
      historicalPage,
      historicalState,
      issues: historicalIssues,
      serverToolResults: historicalServerToolResults,
    } = await openSavedScreen03AsHistoricalV0315(page);
    expect(historicalState.releaseLabel).toBe("v0.3.15");
    expect(historicalState.orientation).toBeUndefined();
    expect(historicalState.briefing?.safeRunRef).toMatch(
      /^s3ref_[A-Za-z0-9_-]{43,128}$/,
    );
    await expect(historicalApp.getByTestId("screen03")).toBeVisible();
    const historicalOverview = historicalApp.getByTestId(
      "screen03-understand-shock",
    );
    const historicalAction = historicalApp.getByTestId(
      "screen03-request-host-reasoning",
    );
    await expect(historicalAction).toHaveText(
      "Ask ChatGPT to prepare the shock briefing",
    );
    await expectDeterministicScreen03Fallback(historicalOverview);
    await historicalAction.click();
    await expect(historicalAction).toHaveText("Request sent to ChatGPT…");

    const historicalTranscript = await hostReasoningTranscript(historicalPage);
    const historicalMessages = historicalTranscript.messageRequests.filter(
      (request) =>
        standardMessageText(request.params)?.includes(
          "First call get_screen3_briefing_packet",
        ) === true,
    );
    expect(historicalMessages).toHaveLength(1);
    expect(standardMessageText(historicalMessages[0]!.params)).toContain(
      `safeRunRef: ${historicalState.briefing!.safeRunRef}`,
    );
    expect(
      historicalServerToolResults.filter(
        (entry) => entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036,
      ),
    ).toHaveLength(0);
    expect(
      historicalServerToolResults.filter(
        (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
      ),
    ).toHaveLength(0);
    await expectNoBrowserOrHostErrors(historicalPage, historicalIssues);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("Find to Screen 3 preserves a qualified shock and reports an honest shortfall without a host turn", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const sentence =
      "Find a regulatory shock affecting U.S. publicly listed technology firms from 2017 to 2023 that may affect annual profitability.";
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      sentence,
      browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
      hostModelResponder: automaticV036HostResponder({ screen03: false }),
    });

    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
    await app.getByRole("button", {
      name: "Continue to shock feasibility",
    }).click();
    const beforeSearch = serverToolResults.length;
    await app.getByRole("button", {
      name: "Find candidate shocks",
    }).click();

    const searched = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    const searchedState = stateFromScreen02WorkflowClientSnapshot(
      privateWorkflowSnapshot(searched.result),
    );
    expect(searchedState.mode).toBe("find");
    if (searchedState.mode !== "find") {
      throw new Error("The bounded technology search changed workflow mode.");
    }
    const activeSet = searchedState.candidateSets.find(
      (candidateSet) =>
        candidateSet.candidateSetSnapshotId ===
          searchedState.activeCandidateSetSnapshotId,
    );
    expect(activeSet?.manifest.funnel).toBeDefined();
    const displayedCount = activeSet!.manifest.funnel!.displayedCandidates;
    expect(displayedCount).toBeGreaterThan(0);
    expect(displayedCount).toBeLessThanOrEqual(
      SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES,
    );
    expect(activeSet!.manifest.funnel!.qualifiedCandidates).toBeGreaterThanOrEqual(
      displayedCount,
    );

    const candidates = app.locator(".s2-find-candidate-row");
    await expect(candidates).toHaveCount(displayedCount);
    if (displayedCount < SCREEN_02_FIND_MAX_VISIBLE_CANDIDATES) {
      await expect(app.locator(".s2-find-search-shortfall")).toContainText(
        `The bounded search found ${displayedCount} displayable candidates`,
      );
    }
    const ccpaRow = candidates.filter({
      hasText: "California Consumer Privacy Act",
    });
    await expect(ccpaRow).toBeVisible();
    await ccpaRow.click();
    await expect(ccpaRow).toHaveAttribute("aria-pressed", "true");
    await expect(
      app.getByRole("heading", { name: "Why this candidate is shown" }),
    ).toBeVisible();
    const chooseCcpa = app
      .locator("#s2-find-candidate-detail")
      .getByRole("button", { name: "Investigate this shock" });
    await expect(chooseCcpa).toBeEnabled();
    await chooseCcpa.click();
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    const screen03 = app.getByTestId("screen03");
    const overview = app.getByTestId("screen03-understand-shock");
    await expect(screen03).toBeVisible();
    await expect(overview).toContainText("California Consumer Privacy Act");
    await expectCurrentScreen03Orientation(overview);
    await expectNoCurrentScreen03HostActivity(app, page);
    expect(
      serverToolResults.filter((entry) =>
        entry.name === SCREEN_03_HOST_DRAFT_PREPARE_TOOL_V036 ||
        entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036
      ),
    ).toHaveLength(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    await app.locator("html").evaluate((element) => {
      element.dataset.theme = "dark";
    });
    await expect(app.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(overview).toBeVisible();
    await expectNoHorizontalPageOverflow(app);
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-screen03-compact-overview-390px-dark",
    );
    await saveSimulatedScreenshot(
      page,
      testInfo,
      "simulated-screen03-compact-overview-390px-dark",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  for (const regression of [
    {
      label: "U.S. video-gaming FTC recovery",
      industry: "Video gaming",
      outcomeFamily: "Profitability",
      title:
        "FTC Approves Modifications to Video Game Industry Self-Regulatory COPPA Safe Harbor Program",
      formalIdentifier: null,
      sourceLocator:
        "https://www.ftc.gov/news-events/news/press-releases/2018/08/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program",
      primaryLocator:
        "https://www.ftc.gov/system/files/attachments/press-releases/ftc-approves-modifications-video-game-industry-self-regulatory-coppa-safe-harbor-program/p024526_commission_letter_approving_modified_esrb_program_and_exhibit_a.pdf",
    },
    {
      label: "U.S. energy final-rule discovery",
      industry: "Energy",
      outcomeFamily: "Investment",
      title:
        "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
      formalIdentifier: "2018-03708",
      sourceLocator:
        "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
      primaryLocator: null,
    },
  ] as const) {
    test(`v0.4.10 positive acceptance uses the search control, selection, and Screen 3 handoff for ${regression.label}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 1000 });
      const issues = captureBrowserIssues(page);
      const context = confirmedWorkflowFindContext(regression.industry, {
        studyPeriod: "2014–2022",
        outcomeFamily: regression.outcomeFamily,
        eventDescriptor: "regulation",
      });
      const { app, serverToolResults } = await openDefaultScreen01(
        page,
        "find",
        {
          sentence: context.studySentence,
          browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
          hostModelResponder: automaticV036HostResponder({
            screen01: false,
            screen02: false,
            screen03: false,
          }),
        },
      );

      const scopeConfirm = app.getByRole("button", { name: "Confirm scope" });
      await expect(scopeConfirm).toBeEnabled();
      await scopeConfirm.click();
      await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
      const continueToFeasibility = app.getByRole("button", {
        name: "Continue to shock feasibility",
      });
      await expect(continueToFeasibility).toBeEnabled();
      await continueToFeasibility.click();
      await expect(app.getByTestId("screen02-find")).toBeVisible();

      const beforeSearch = serverToolResults.length;
      await app.getByRole("button", {
        name: /find candidate shocks/i,
      }).click();
      const searched = await waitForServerWorkflowResult(
        serverToolResults,
        "find-search",
        beforeSearch,
      );
      const searchedSnapshot = privateWorkflowSnapshot(searched.result);
      const searchedState = stateFromScreen02WorkflowClientSnapshot(
        searchedSnapshot,
      );
      expect(searchedState.mode).toBe("find");
      if (searchedState.mode !== "find") {
        throw new Error(`${regression.label} changed workflow mode.`);
      }
      const candidate = searchedState.candidates.find((item) =>
        item.identity.canonicalTitle === regression.title &&
        item.identity.formalIdentifier === regression.formalIdentifier
      );
      expect(candidate).toBeDefined();
      expect(candidate?.qualification?.eligible).toBe(true);
      expect(["direct", "adjacent"]).toContain(
        candidate?.qualification?.classification,
      );
      expect(candidate?.qualification?.evidenceSourceIds.length)
        .toBeGreaterThan(0);
      expect(
        searchedState.sources.some((source) =>
          candidate?.sourceIds.includes(source.id) &&
          source.locator === regression.sourceLocator &&
          Boolean(source.evidenceText)
        ),
      ).toBe(true);

      const row = app.locator(".s2-find-candidate-row").filter({
        hasText: regression.title,
      });
      await expect(row).toBeVisible();
      const beforeOpen = serverToolResults.length;
      await row.click();
      await waitForServerWorkflowResult(
        serverToolResults,
        "find-open",
        beforeOpen,
      );
      const details = app.locator("#s2-find-candidate-detail");
      if (regression.primaryLocator) {
        await expect(
          details.locator(`a[href="${regression.primaryLocator}"]`),
        ).toContainText(/Commission Letter Approving/i);
      }
      const beforeSelection = serverToolResults.length;
      await details.getByRole("button", {
        name: "Investigate this shock",
      }).click();
      await waitForServerWorkflowResult(
        serverToolResults,
        "find-select",
        beforeSelection,
      );
      const continueButton = app.getByRole("button", {
        name: "Continue to Screen 3: Verify event",
      });
      await expect(continueButton).toBeEnabled();
      const beforeContinue = serverToolResults.length;
      await continueButton.click();
      const continued = await waitForServerWorkflowResult(
        serverToolResults,
        "find-continue",
        beforeContinue,
      );
      const handoff = privateWorkflowSnapshot(continued.result).handoff;
      expect(handoff).toMatchObject({
        mode: "find",
        destinationScreen: "screen-03",
        outcomeValuesInspected: false,
        decision: {
          candidateSnapshotId: candidate!.candidateSnapshotId,
        },
        event: {
          identity: {
            canonicalTitle: regression.title,
            formalIdentifier: regression.formalIdentifier,
          },
          preliminaryQualification: {
            eligible: true,
            classification: expect.stringMatching(/^(?:direct|adjacent)$/u),
          },
        },
      });
      expect(
        handoff?.sources.some((source) =>
          source.locator === regression.sourceLocator &&
          Boolean(source.evidenceText)
        ),
      ).toBe(true);
      if (regression.primaryLocator) {
        const primaryReference = handoff?.sources.find((source) =>
          source.locator === regression.primaryLocator
        );
        expect(primaryReference).toMatchObject({
          authorityTier: 1,
          channel: "official-controlling-primary-reference-unparsed",
        });
        expect(primaryReference).not.toHaveProperty("evidenceText");
      }
      const screen03 = app.getByTestId("screen03");
      await expect(screen03).toBeVisible();
      await expect(screen03).toHaveAttribute("aria-busy", "false");
      await expect(app.getByTestId("screen03-understand-shock"))
        .toContainText(regression.title);
      await expectNoCurrentScreen03HostActivity(app, page);
      await expectNoBrowserOrHostErrors(page, issues);
    });
  }

  test.skip("historical v0.3.13 Nordic Screen 3 explanation route is not a current Stage B path", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    await page.addInitScript(accelerateScreen03CapabilityDeadline, {
      deadlineMs: SCREEN_03_HOST_DRAFT_DEFAULT_CAPABILITY_TTL_MS,
      clientClockLeadMs: screen02BrowserClientClockLeadMs,
    });
    const sentence =
      "Find a regulatory shock affecting electricity firms in Northern Europe from 2021 to 2024 that may influence profitability.";
    const automaticResponder = automaticV036HostResponder();
    let screen03TaskCount = 0;
    const hostModelResponder = (request: HostModelRequest) => {
      const context = request.latestModelContext?.structuredContent;
      if (
        (optionalRecord(context)?.schemaVersion ===
            SCREEN_03_HOST_DRAFT_BATCH_SCHEMA_VERSION ||
          optionalRecord(context)?.schemaVersion ===
            screen03HostMessageTaskSchemaVersion)
      ) {
        screen03TaskCount += 1;
        if (screen03TaskCount > 1) return [];
      }
      return automaticResponder(request);
    };
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      sentence,
      browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
      hostModelResponder,
      messageResponseDelayMs: 150,
      suppressFirstModelToolResultNotificationFor:
        SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    });

    const draftButton = app.getByRole("button", {
      name: "Fill scope fields with ChatGPT",
    });
    await draftButton.click();
    await expect(
      app.getByRole("button", { name: "Update scope fields with ChatGPT" }),
    ).toBeVisible();
    await expect(app.getByText("Electricity firms", { exact: true })).toBeVisible();
    await expect(app.getByText("Northern Europe", { exact: true })).toBeVisible();
    await expect(app.getByText("Profitability", { exact: true })).toBeVisible();
    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();

    await app.getByRole("button", { name: /find candidate shocks/i }).click();
    const candidates = app.locator(".s2-find-candidate-row");
    await expect(candidates.filter({
      hasText: "Electricity Market Design Regulation",
    })).toBeVisible();
    await expect(candidates.filter({
      hasText: "Electricity Market Reform Act 2023",
    })).toBeVisible();
    await expect(app.getByTestId("screen02-find-assessment-count")).toContainText(
      /2 assessments ready/,
    );

    const selectedRow = candidates.filter({
      hasText: "Electricity Market Design Regulation",
    });
    await selectedRow.click();
    const details = app.locator("#s2-find-candidate-detail");
    await expect(details).toContainText(
      "official record falls inside the confirmed 2021–2024 period",
    );
    await expect(details).toContainText(
      "electricity-market duties may reshape contracting",
    );
    const choose = details.getByRole("button", { name: "Choose this shock" });
    await expect(choose).toBeEnabled();
    await choose.click();
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(app.getByTestId("screen03")).toBeVisible();
    const initialBriefingAction = app.getByTestId(
      "screen03-request-host-reasoning",
    );
    await expect(initialBriefingAction).toHaveText(
      "Generate this overview with ChatGPT",
    );
    await initialBriefingAction.click();
    await expect
      .poll(async () =>
        (await hostReasoningTranscript(page)).suppressedModelToolNotifications
          .length)
      .toBe(1);
    await expect
      .poll(() =>
        serverToolResults.filter(
          (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
        ).length)
      .toBe(1);
    const appliedWithoutReceipt = serverToolResults.find(
      (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    );
    expect(appliedWithoutReceipt?.arguments).not.toHaveProperty("sourcePacket");
    expect(appliedWithoutReceipt?.result.structuredContent).toMatchObject({
      disposition: "applied",
    });
    const overview = app.getByTestId("screen03-understand-shock");
    await expect(overview).toContainText(
      "ChatGPT-generated source-linked overview · research aid",
    );
    await expect(overview).not.toContainText(
      "Plain-language interpretation unavailable",
    );
    await expect(overview).toContainText(/Electricity Market/i);
    await expectNordicElectricityGeneratedBrief(overview);
    const studyRelevance = app.getByTestId("screen03-study-relevance");
    await expect(studyRelevance).toContainText("Electricity firms");
    await expect(studyRelevance).toContainText("Northern Europe");
    await expect(studyRelevance).toContainText("Profitability");
    await expect(studyRelevance).toContainText(
      "untested research-design hypothesis",
    );
    await expect(
      app.getByTestId("screen03-request-host-reasoning"),
    ).toHaveText("Refresh this overview with ChatGPT");
    const screen03Submission = screen03HostSubmission(serverToolResults);
    const readerHelp = app.locator(
      ".s3-field__reader-help, .s3-time-card__reader-help",
    );
    expect(await readerHelp.count()).toBe(
      screen03Submission.requestedProposalIds.length,
    );
    for (const proposalId of screen03Submission.requestedProposalIds) {
      const inlineHelp = app.locator(
        `[data-testid="screen03-field-${proposalId}"] .s3-field__reader-help, ` +
          `[data-testid="screen03-stage-${proposalId}"] .s3-time-card__reader-help`,
      );
      await expect(inlineHelp).toContainText("ChatGPT-assisted wording");
    }
    await expect(
      app.locator('[data-testid^="screen03-plain-language-"]'),
    ).toHaveCount(0);

    await expectAutomaticHostTraffic(page, [
      SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
      "submit_screen02_find_assessment_draft_v021",
      SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    ]);
    expect(screen03Submission.submission.result.isError).not.toBe(true);
    expect(screen03Submission.submission.result.structuredContent).toMatchObject({
      disposition: "applied",
    });
    const initialScreen03Tasks = await screen03HostMessageTasks(page);
    expect(initialScreen03Tasks).toHaveLength(1);
    expectCompactScreen03HostMessageTask(initialScreen03Tasks[0]!);
    expect(await releaseSuppressedModelToolResults(page)).toBe(1);
    const briefingAction = app.getByTestId("screen03-request-host-reasoning");
    await briefingAction.click();
    await expect(briefingAction).toHaveText(
      "ChatGPT is generating…",
    );
    await expect(overview).toContainText(
      "The current ChatGPT-generated overview remains visible while a new one is generated.",
    );
    await expectNordicElectricityGeneratedBrief(overview);
    await expect(briefingAction).toHaveText("Try a new ChatGPT overview", {
      timeout: 7_500,
    });
    await expect(briefingAction).not.toHaveAttribute("aria-busy", "true");
    await expect(overview).toContainText(
      "The current ChatGPT-generated overview remains available; you can try generating a new one.",
    );
    await expectNordicElectricityGeneratedBrief(overview);
    await expect(overview).not.toContainText("SHARE THIS");
    await expect(overview).not.toContainText(/source[- ]backed orientation/i);
    await expect(overview.locator(".s3-source-backed-summary")).toHaveCount(0);
    const finalTranscript = await hostReasoningTranscript(page);
    const finalScreen03Tasks = await screen03HostMessageTasks(page);
    expect(finalScreen03Tasks).toHaveLength(2);
    for (const task of finalScreen03Tasks) {
      expectCompactScreen03HostMessageTask(task);
    }
    expect(
      finalTranscript.modelToolCalls.filter(
        (entry) => entry.name === SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
      ),
    ).toHaveLength(1);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("Screen 1 manually aligns manufacturing to video gaming and opens Screen 2 without scope drafting", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const issues = captureBrowserIssues(page);
    const manufacturingSentence =
      "Find a regulatory shock affecting U.S. public manufacturing firms between 2014 and 2022 that may influence firm innovation.";
    const videoGamingSentence = manufacturingSentence.replace(
      "manufacturing firms",
      "video gaming firms",
    );
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      sentence: manufacturingSentence,
      browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
      hostModelResponder: automaticV036HostResponder(),
      hostCapabilities: { serverTools: {}, logging: {} },
      installChatGptCompatibilityBridge: true,
    });

    await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
    const sentence = app.locator("#study-sentence");
    await expect(sentence).toHaveValue(manufacturingSentence);
    await sentence.fill(videoGamingSentence);
    await expect(sentence).toHaveValue(videoGamingSentence);

    const alignmentWarnings = app.locator(".alignment-warning");
    await expect(alignmentWarnings).toHaveCount(1);
    await expect(alignmentWarnings).toContainText(
      "Industry may not match your description",
    );
    await expect(alignmentWarnings).toContainText(
      "Your description refers to Video gaming, while the Scope Contract currently says Manufacturing.",
    );
    await expect(
      app.getByRole("button", { name: "Use Video gaming" }),
    ).toBeVisible();
    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await expect(scopeConfirm).toHaveAttribute("data-blocked", "true");

    await app.getByRole("button", {
      name: /Edit Industry: Manufacturing\. Status: May not match/i,
    }).click();
    const industryEditor = app.getByRole("dialog", {
      name: "Edit Industry",
    });
    await industryEditor.getByLabel("Industry").fill("Video gaming");
    await industryEditor.getByRole("button", { name: "Save value" }).click();

    await expect(alignmentWarnings).toHaveCount(0);
    await expect(
      app.getByText("Your description and Scope Contract are aligned."),
    ).toBeVisible();
    await expect(
      app.getByRole("button", {
        name: /Edit Industry: Video gaming\. Status: Accepted/i,
      }),
    ).toBeVisible();
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expect(scopeConfirm).toHaveText("Scope confirmed");
    await app.getByRole("button", {
      name: "Continue to shock feasibility",
    }).click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();

    const opener = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
    );
    const expectedScopeContract = {
      population: "Public firms",
      assignmentLevel: "Not specified",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Video gaming",
      studyPeriod: "2014–2022",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Not specified",
    };
    expect(opener.arguments.studyContext).toMatchObject({
      schemaVersion: "1.0",
      sourceScreen: "screen-01",
      startingPoint: "find",
      studySentence: videoGamingSentence,
      contractSourceSentence: videoGamingSentence,
      knownShock: "",
      scopeContract: expectedScopeContract,
      resolvedKeys: ["industry"],
      unresolvedDecisions: [],
      scopeDirty: false,
      confirmed: true,
      readyForLaterScreens: true,
    });
    const openedState = stateFromScreen02WorkflowClientSnapshot(
      privateWorkflowSnapshot(opener.result),
    );
    expect(openedState.screen01Baseline).toEqual(
      opener.arguments.studyContext,
    );
    await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("no-message-capability CCPA Find uses fixed qualification and displays the source-derived current orientation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const { app, serverToolResults } = await openDefaultScreen01(page, "find", {
      sentence: confirmedWorkflowFindContext().studySentence,
      browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
      hostCapabilities: { serverTools: {}, logging: {} },
    });

    await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
    for (const value of [
      "Public firms",
      "United States",
      "Technology",
      "2016–2020",
      "Regulation",
      "Innovation",
    ]) {
      await expect(app.getByText(value, { exact: true })).toBeVisible();
    }

    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expect(scopeConfirm).toHaveText("Scope confirmed");
    await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();

    const beforeSearch = serverToolResults.length;
    await app.getByRole("button", {
      name: "Find candidate shocks",
    }).click();
    const preparedSearch = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    const deterministicSnapshot = privateWorkflowSnapshot(preparedSearch.result);
    const deterministicState = stateFromScreen02WorkflowClientSnapshot(
      deterministicSnapshot,
    );
    expect(deterministicSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    expect(deterministicState.mode).toBe("find");
    if (deterministicState.mode !== "find") {
      throw new Error("The deterministic CCPA search changed workflow mode.");
    }
    expect(deterministicState.assessmentRequests).toEqual([]);
    expect(deterministicState.assessments).toEqual([]);
    const ccpaCandidate = deterministicState.candidates.find((candidate) =>
      candidate.identity.canonicalTitle.includes(
        "California Consumer Privacy Act",
      )
    );
    expect(ccpaCandidate).toBeDefined();
    expect(ccpaCandidate?.qualification).toMatchObject({
      eligible: true,
    });
    expect(
      ccpaCandidate?.qualification?.evidenceSourceIds.length,
    ).toBeGreaterThan(0);

    const ccpaRow = app.locator(".s2-find-candidate-row").filter({
      hasText: "California Consumer Privacy Act",
    });
    await expect(ccpaRow).toBeVisible();
    const fixedSearchRecord = app.locator(".s2-find-coverage details");
    await fixedSearchRecord.locator("summary").click();
    await expect(fixedSearchRecord).toContainText(
      "fixed deterministic query plan was used because optional planning was unavailable",
    );
    await expect(fixedSearchRecord).toContainText("proves no event fact");
    await ccpaRow.click();
    const details = app.locator("#s2-find-candidate-detail");
    await expect(details).toContainText(
      "Source-backed qualification · Preliminary",
    );
    await expect(details).toContainText("Why this candidate is shown");
    await expect(details).toContainText("Qualified candidate overview");
    await expect(
      details.getByRole("button", { name: "Try the brief assessment again" }),
    ).toHaveCount(0);
    await expect(details).not.toContainText("Assessment pending");
    await expect(details).not.toContainText("Preparing assessment");
    const statuteLink = details.getByRole("link", {
      name: /California Assembly Bill 375, Chapter 55/u,
    });
    await expect(statuteLink).toBeVisible();
    await expect(statuteLink).toHaveAttribute(
      "href",
      "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB375",
    );
    const choose = details.getByRole("button", {
      name: "Investigate this shock",
    });
    await expect(choose).toBeEnabled();
    await choose.click();

    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await expect(
      app.getByRole("button", {
        name: "Continue to Screen 3 with extra checks",
      }),
    ).toHaveCount(0);

    const beforeContinue = serverToolResults.length;
    await continueButton.click();
    const continued = await waitForServerWorkflowResult(
      serverToolResults,
      "find-continue",
      beforeContinue,
    );
    const continuedSnapshot = privateWorkflowSnapshot(continued.result);
    const continuedState = stateFromScreen02WorkflowClientSnapshot(
      continuedSnapshot,
    );
    expect(continuedState.mode).toBe("find");
    if (continuedState.mode !== "find") {
      throw new Error(
        "The no-message-capability CCPA continuation changed workflow mode.",
      );
    }
    expect(continuedState.decision.history.at(-1)).toMatchObject({
      action: "continued",
    });
    expect(continuedSnapshot.handoff).toMatchObject({
      mode: "find",
      event: {
        preliminaryQualification: {
          eligible: true,
        },
      },
    });

    const screen03 = app.getByTestId("screen03");
    await expect(screen03).toBeVisible();
    await expect(screen03).toHaveAttribute("aria-busy", "false");
    const overview = app.getByTestId("screen03-understand-shock");
    await expect(screen03).toContainText("California Consumer Privacy Act");
    await expectCurrentScreen03Orientation(overview);
    await expect(overview.getByTestId("screen03-orientation-provenance"))
      .toHaveCount(0);
    await expect(app.getByTestId("screen03-request-host-reasoning")).toHaveCount(0);
    await expect(overview).not.toContainText(
      "The bill would require the Attorney General to solicit public participation",
    );
    await expect(app.getByTestId("screen03-timeline")).toContainText(
      "2018-06-28",
    );
    const enactedEvidence = app
      .locator('[data-testid^="screen03-evidence-"]')
      .filter({
        hasText: "AB 375 was enacted and approved on June 28, 2018",
      })
      .first();
    await expect(enactedEvidence).toBeVisible();
    await enactedEvidence.locator("summary").click();
    const enactedPassage = enactedEvidence
      .locator("blockquote")
      .filter({
        hasText:
          "AB 375 was enacted and approved on June 28, 2018 (2018-06-28).",
      })
      .first();
    await expect(enactedPassage).toContainText(
      "AB 375 was enacted and approved on June 28, 2018 (2018-06-28).",
    );
    await expect(
      enactedPassage.getByRole("link", { name: /Open source record for/u }),
    ).toBeVisible();
    for (const name of [
      SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
      "submit_screen02_find_assessment_draft_v021",
      SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    ]) {
      expect(
        serverToolResults.filter((entry) => entry.name === name),
      ).toHaveLength(0);
    }
    const transcript = await hostReasoningTranscript(page);
    expect(transcript.messageRequests).toHaveLength(0);
    expect(transcript.modelContextRequests).toHaveLength(0);
    expect(transcript.compatibilityMessageRequests).toHaveLength(0);
    expect(transcript.compatibilityModelContextRequests).toHaveLength(0);
    expect(
      serverToolResults
        .slice(beforeSearch)
        .filter(
          (entry) =>
            browserWorkflowActionTools.has(entry.name) &&
            entry.arguments.action === "assessment-delivery",
        ).length,
    ).toBe(0);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("GDPR official fields support mouse and keyboard confirmation while Lead-only claims remain protected and decisions persist", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const { app, serverToolResults } = await openCanonicalWorkflow(
      page,
      "audit",
      {
        studyContext: confirmedWorkflowGdprAuditContext(),
        browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
        hostCapabilities: { serverTools: {}, logging: {} },
      },
    );

    const openedDossier = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-open",
    );
    const dossierSnapshot = privateWorkflowSnapshot(openedDossier.result);
    const dossierState = stateFromScreen02WorkflowClientSnapshot(
      dossierSnapshot,
    );
    expect(dossierSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    expect(dossierState.mode).toBe("audit");
    if (dossierState.mode !== "audit") {
      throw new Error("The GDPR workflow did not remain in Audit mode.");
    }
    expect(dossierState.anchor.originalWording).toBe("GDPR");
    expect(dossierState.possibleMatches[0]).toMatchObject({
      relationship: "supported-alias",
      identity: {
        canonicalTitle: "General Data Protection Regulation",
        formalIdentifier: "Regulation (EU) 2016/679",
      },
    });
    expect(
      dossierState.assessmentRequests.some((request) =>
        ["prepared", "message-delivered"].includes(request.status)
      ),
    ).toBe(false);

    const dossier = app.locator("#s2-audit-match-detail");
    await expect(dossier).toContainText("General Data Protection Regulation");
    await expect(dossier).toContainText(
      "Saved source-derived · provisional dossier",
    );
    await dossier.getByLabel("Reason for the identity decision").fill(
      "The official EU title and Regulation (EU) 2016/679 identifier match the named GDPR shock.",
    );
    const confirmIdentity = dossier.getByRole("button", {
      name: "Yes, this is the shock I meant",
    });
    await expect(confirmIdentity).toBeEnabled();
    const beforeIdentityConfirm = serverToolResults.length;
    await confirmIdentity.focus();
    await confirmIdentity.press("Enter");
    await waitForServerWorkflowResult(
      serverToolResults,
      "audit-confirm",
      beforeIdentityConfirm,
    );

    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    const beforeContinue = serverToolResults.length;
    await continueButton.click();
    await waitForServerWorkflowResult(
      serverToolResults,
      "audit-continue",
      beforeContinue,
    );
    const openedScreen03 = await waitForServerToolResult(
      serverToolResults,
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      beforeContinue,
    );
    const initialScreen03 = await privateScreen03State(openedScreen03, "open");
    expect(initialScreen03.eventIdentity).toMatchObject({
      issuer: "European Parliament and Council of the European Union",
      issuingJurisdiction: "European Union",
    });
    await expect(app.getByTestId("screen03")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(app.getByTestId("screen03")).toContainText(
      "General Data Protection Regulation",
    );

    const passages = initialScreen03.evidence.flatMap((source) => source.passages);
    const officialFields = passages.filter((passage) =>
      passage.basis === "official-record-field"
    );
    expect(officialFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "32016R0679", officialField: "formal-identifier",
      }),
      expect.objectContaining({
        text: "General Data Protection Regulation", officialField: "canonical-title",
      }),
    ]));
    // CELLAR's raw CELEX identifier is not the public legal citation. The
    // latter requires exact official text under the existing evidence policy.
    expect(officialFields).not.toContainEqual(expect.objectContaining({
      text: "Regulation (EU) 2016/679",
    }));
    const officialDocumentPassages = passages.filter((passage) =>
      passage.basis === "official-document-passage"
    );
    const officialDocumentPassageIds = new Set(
      officialDocumentPassages.map((passage) => passage.id),
    );
    const directIdentityProposals = screen03FactualClaims(
      initialScreen03.proposals,
    ).filter(
      (proposal) =>
        proposal.group === "identity" &&
        ["Canonical event title", "Formal identifier"].includes(proposal.label) &&
        proposal.support === "direct" &&
        proposal.passageIds.some((id) => officialDocumentPassageIds.has(id)),
    );
    expect(directIdentityProposals).toHaveLength(2);
    expect(directIdentityProposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Canonical event title",
          value: "General Data Protection Regulation",
        }),
        expect.objectContaining({
          label: "Formal identifier",
          value: "Regulation (EU) 2016/679",
        }),
      ]),
    );
    for (const proposal of directIdentityProposals) {
      expect(officialDocumentPassages.some((passage) =>
        proposal.passageIds.includes(passage.id) && passage.text.includes(proposal.value)
      )).toBe(true);
      expect(screen03ProposalConfirmability(proposal, initialScreen03.evidence))
        .toEqual({ confirmable: true, reason: "confirmable" });
    }
    const identityProposals = screen03FactualClaims(
      initialScreen03.proposals,
    );
    const issuerProposal = identityProposals.find(
      (proposal) => proposal.label === "Issuer",
    );
    const jurisdictionProposal = identityProposals.find(
      (proposal) => proposal.label === "Issuing jurisdiction",
    );
    expect(issuerProposal).toMatchObject({
      value: "European Parliament and Council of the European Union",
    });
    expect(jurisdictionProposal).toMatchObject({
      value: "European Union",
    });
    await expect(app.getByTestId(`screen03-field-${issuerProposal!.id}`))
      .toContainText("European Parliament and Council of the European Union");
    await expect(app.getByTestId(`screen03-field-${jurisdictionProposal!.id}`))
      .toContainText("European Union");

    const firstOfficialField = directIdentityProposals[0]!;
    const firstFieldCard = app.getByTestId(
      `screen03-field-${firstOfficialField.id}`,
    );
    await expect(firstFieldCard).toContainText("Direct quoted support");
    const firstEvidence = app.getByTestId(
      `screen03-evidence-${firstOfficialField.id}`,
    );
    await firstEvidence.locator("summary").click();
    await expect(firstEvidence.locator("blockquote").first())
      .toContainText(firstOfficialField.value);
    await expect(firstEvidence.locator("blockquote footer strong").first())
      .toContainText("Passage #");

    async function confirmOfficialFieldWithKeyboard(
      proposalId: string,
      key: "Enter" | "Space",
    ) {
      const button = app.getByTestId(`screen03-confirm-${proposalId}`);
      await expect(button).toBeEnabled();
      await expect(button).toHaveAttribute("aria-pressed", "false");
      const beforeReview = serverToolResults.length;
      await button.focus();
      await expect(button).toBeFocused();
      await button.press(key);
      const reviewed = await waitForServerToolResult(
        serverToolResults,
        SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
        beforeReview,
      );
      expect(record(reviewed.arguments.action, `${key} review action`))
        .toMatchObject({
          type: "review-field",
          proposalId,
          decision: "accept",
        });
      expect(
        screen03FactualClaims((await privateScreen03State(reviewed)).proposals)
          .find((proposal) => proposal.id === proposalId),
      ).toMatchObject({ reviewStatus: "accepted", support: "direct" });
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(button).toBeDisabled();
      await expect(app.getByTestId(`screen03-decision-status-${proposalId}`))
        .toContainText("Saved: Confirmed.");
    }

    async function confirmOfficialFieldWithMouse(proposalId: string) {
      const button = app.getByTestId(`screen03-confirm-${proposalId}`);
      await expect(button).toBeEnabled();
      await expect(button).toHaveAttribute("aria-pressed", "false");
      const beforeReview = serverToolResults.length;
      await button.click();
      const reviewed = await waitForServerToolResult(
        serverToolResults,
        SCREEN_03_WORKFLOW_MUTATE_TOOL_V030,
        beforeReview,
      );
      expect(record(reviewed.arguments.action, "mouse review action"))
        .toMatchObject({
          type: "review-field",
          proposalId,
          decision: "accept",
        });
      expect(
        screen03FactualClaims((await privateScreen03State(reviewed)).proposals)
          .find((proposal) => proposal.id === proposalId),
      ).toMatchObject({ reviewStatus: "accepted", support: "direct" });
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(button).toBeDisabled();
      await expect(app.getByTestId(`screen03-decision-status-${proposalId}`))
        .toContainText("Saved: Confirmed.");
    }

    await confirmOfficialFieldWithMouse(firstOfficialField.id);
    await confirmOfficialFieldWithKeyboard(
      directIdentityProposals[1]!.id,
      "Enter",
    );

    const leadOnlyProposal = screen03FactualClaims(
      initialScreen03.proposals,
    ).find((proposal) => proposal.support === "indirect");
    expect(leadOnlyProposal).toBeDefined();
    const leadOnlyCard = app.getByTestId(
      `${leadOnlyProposal!.group === "timeline" ? "screen03-stage" : "screen03-field"}-${leadOnlyProposal!.id}`,
    );
    await expect(leadOnlyCard).toContainText("Lead only");
    const leadOnlyConfirm = app.getByTestId(
      `screen03-confirm-${leadOnlyProposal!.id}`,
    );
    await expect(leadOnlyConfirm).toBeDisabled();
    await expect(
      app.getByTestId(`screen03-confirm-guidance-${leadOnlyProposal!.id}`),
    ).toContainText(
      "Confirm becomes available when an official field or quoted passage directly supports this claim. Find support or choose another decision.",
    );
    await expect(
      app.getByTestId(`screen03-find-direct-support-${leadOnlyProposal!.id}`),
    ).toBeEnabled();

    const beforeRefresh = serverToolResults.length;
    await app.getByTestId("screen03-refresh-research").click();
    const restored = await waitForServerToolResult(
      serverToolResults,
      SCREEN_03_WORKFLOW_OPEN_TOOL_V030,
      beforeRefresh,
    );
    expect(restored.result.structuredContent?.outcome).toBe("restored");
    const restoredState = await privateScreen03State(restored, "open");
    for (const proposal of directIdentityProposals) {
      expect(screen03FactualClaims(restoredState.proposals).find(
        (candidate) => candidate.id === proposal.id,
      )).toMatchObject({ reviewStatus: "accepted" });
      await expect(
        app.getByTestId(`screen03-field-${proposal.id}`).locator(".s3-tag").first(),
      ).toHaveText("Confirmed");
      await expect(app.getByTestId(`screen03-decision-status-${proposal.id}`))
        .toContainText("Saved: Confirmed.");
    }
    await expect(leadOnlyConfirm).toBeDisabled();

    await app.getByTestId("screen03-back").click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();
    await app.getByRole("button", {
      name: /Step 3: Verify event and timing, available; resume Screen 3/i,
    }).click();
    await expect(app.getByTestId("screen03")).toBeVisible();
    for (const proposal of directIdentityProposals) {
      await expect(
        app.getByTestId(`screen03-field-${proposal.id}`).locator(".s3-tag").first(),
      ).toHaveText("Confirmed");
      await expect(app.getByTestId(`screen03-decision-status-${proposal.id}`))
        .toContainText("Saved: Confirmed.");
    }
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-gdpr-official-field-keyboard-persistence",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("deterministic Audit completes a source-derived dossier without a legacy host turn", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const { app, serverToolResults } = await openCanonicalWorkflow(
      page,
      "audit",
      { browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO },
    );

    const automaticOpen = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-open",
      0,
    );
    const automaticOpenPayload = record(
      automaticOpen.arguments.payload,
      "automatic deterministic Audit open payload",
    );
    const targetMatchSnapshotId = automaticOpenPayload.matchSnapshotId;
    if (typeof targetMatchSnapshotId !== "string") {
      throw new Error(
        "The automatic deterministic Audit open has no match snapshot ID.",
      );
    }
    const openedSnapshot = privateWorkflowSnapshot(automaticOpen.result);
    const openedState = stateFromScreen02WorkflowClientSnapshot(openedSnapshot);
    expect(openedSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    expect(openedState.mode).toBe("audit");
    if (openedState.mode !== "audit") {
      throw new Error(
        "The automatic deterministic open changed workflow mode.",
      );
    }
    const targetMatch = openedState.possibleMatches.find(
      (match) => match.matchSnapshotId === targetMatchSnapshotId,
    );
    expect(targetMatch).toBeDefined();
    const matchRow = app.locator(".s2-audit-match").filter({
      hasText: targetMatch!.identity.canonicalTitle,
    });
    await expect(matchRow).toHaveAttribute("aria-pressed", "true");
    const completedRequest = openedState.assessmentRequests.find(
      (request) => request.target.mode === "audit-dossier",
    );
    expect(completedRequest).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({
          status: "service-unavailable",
          note: expect.stringContaining("Legacy Screen 2 host dossier turns are disabled"),
        }),
        expect.objectContaining({
          status: "completed",
          note: expect.stringContaining("fixed fallback dossier"),
        }),
      ]),
    });
    if (!completedRequest || completedRequest.target.mode !== "audit-dossier") {
      throw new Error(
        "The deterministic Audit open has no completed dossier request.",
      );
    }
    expect(openedState.dossiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: completedRequest.requestId,
          status: "completed",
        }),
      ]),
    );

    const dossier = app.locator("#s2-audit-match-detail");
    await expect(dossier).toContainText(
      "Saved source-derived · provisional dossier",
    );
    await expect(dossier).toContainText("At a glance");
    const confirmIdentity = dossier.getByRole("button", {
      name: "Yes, this is the shock I meant",
    });
    await expect(confirmIdentity).toBeVisible();
    await expect(confirmIdentity).toBeDisabled();

    const transcript = await hostReasoningTranscript(page);
    expect(transcript.messageRequests).toHaveLength(0);
    expect(transcript.modelContextRequests).toHaveLength(0);
    expect(transcript.compatibilityMessageRequests).toHaveLength(0);
    expect(transcript.compatibilityModelContextRequests).toHaveLength(0);
    expect(transcript.modelToolCalls).toHaveLength(0);
    expect(
      serverToolResults.filter(
        (entry) =>
          browserWorkflowActionTools.has(entry.name) &&
          entry.arguments.action === "assessment-delivery",
      ),
    ).toHaveLength(0);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("no-message-capability CCPA Audit completes deterministic fallbacks and displays the source-derived orientation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const { app, serverToolResults } = await openDefaultScreen01(page, "audit", {
      sentence: confirmedWorkflowAuditContext().studySentence,
      browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
      hostCapabilities: { serverTools: {}, logging: {} },
    });

    await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
    await expect(
      app.getByText("California Consumer Privacy Act", { exact: true }),
    ).toBeVisible();

    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expect(scopeConfirm).toHaveText("Scope confirmed");
    await expectNoScreen01ScopeDrafting(app, page, serverToolResults);
    await app
      .getByRole("button", {
        name: "Step 2: Represent known shock, available next",
      })
      .click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();

    const beforeDossier = serverToolResults.length;
    const matchRow = app
      .locator(".s2-audit-match")
      .filter({ hasText: "California Consumer Privacy Act" })
      .first();
    await expect(matchRow).toBeVisible();
    await matchRow.click();
    const dossierResult = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-open",
      beforeDossier,
    );
    const dossierSnapshot = privateWorkflowSnapshot(dossierResult.result);
    expect(dossierSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    const dossierState = stateFromScreen02WorkflowClientSnapshot(
      dossierSnapshot,
    );
    expect(dossierState.mode).toBe("audit");
    if (dossierState.mode !== "audit") {
      throw new Error(
        "The no-message-capability CCPA dossier changed workflow mode.",
      );
    }
    const dossierRequest = dossierState.assessmentRequests.find(
      (request) => request.target.mode === "audit-dossier",
    );
    expect(dossierRequest).toMatchObject({ status: "completed" });
    expect(
      dossierRequest?.lifecycle.some(
        (event) =>
          event.status === "service-unavailable" &&
          /legacy Screen 2 host dossier turns are disabled/i.test(
            event.note ?? "",
          ),
      ),
    ).toBe(true);

    const dossier = app.locator("#s2-audit-match-detail");
    await expect(dossier).toContainText(
      "Saved source-derived · provisional dossier",
    );
    await expect(dossier).toContainText("At a glance");
    await expect(dossier).toContainText(
      "this alternate path does not confirm the identity or add substantive event facts",
    );
    await expect(dossier).toContainText("Evidence gap — timeline");
    await expect(dossier).toContainText("Evidence gap — broadCoverage");
    await dossier.getByLabel("Reason for the identity decision").fill(
      "The official title, California jurisdiction, and statute identifier match the named CCPA shock; substantive details remain for verification.",
    );
    const confirmIdentity = dossier.getByRole("button", {
      name: "Yes, this is the shock I meant",
    });
    await expect(confirmIdentity).toBeEnabled();
    const beforeConfirm = serverToolResults.length;
    await confirmIdentity.click();
    const assessmentResult = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-confirm",
      beforeConfirm,
    );
    const assessedSnapshot = privateWorkflowSnapshot(assessmentResult.result);
    expect(assessedSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    const assessedState = stateFromScreen02WorkflowClientSnapshot(
      assessedSnapshot,
    );
    expect(assessedState.mode).toBe("audit");
    if (assessedState.mode !== "audit") {
      throw new Error(
        "The no-message-capability CCPA assessment changed workflow mode.",
      );
    }
    expect(assessedState.assessments.at(-1)).toMatchObject({
      status: "completed",
      studyFit: { category: "unclear" },
      outcomePathway: { category: "unclear" },
      coverageRelation: { category: "unclear" },
      measurementPotential: { category: "unclear" },
      overallJudgment: "not-enough-evidence",
      overallJudgmentMethod: "fixed-computation",
    });
    await expect(
      app.getByText("Conservative source-derived preliminary assessment", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(app.locator(".s2-audit-assessment-status")).toContainText(
      "Assessment ready.",
    );
    await expect(app.getByText("Source-derived assessment for your study", {
      exact: true,
    })).toBeVisible();
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    await expect(
      app.getByRole("button", {
        name: "Continue to Screen 3 with extra checks",
      }),
    ).toHaveCount(0);

    const beforeContinue = serverToolResults.length;
    await continueButton.click();
    const continued = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-continue",
      beforeContinue,
    );
    const continuedSnapshot = privateWorkflowSnapshot(continued.result);
    expect(continuedSnapshot.handoff).toMatchObject({
      dossierCompletionOrigin: "fixed-fallback",
      preliminaryAssessment: {
        completionOrigin: "fixed-fallback",
        judgment: "not-enough-evidence",
      },
    });

    const screen03 = app.getByTestId("screen03");
    await expect(screen03).toBeVisible();
    await expect(screen03).toHaveAttribute("aria-busy", "false");
    await expect(screen03).toContainText("California Consumer Privacy Act");
    const overview = app.getByTestId("screen03-understand-shock");
    await expectCurrentScreen03Orientation(overview, 0);
    await expect(
      overview.getByTestId("screen03-orientation-summary"),
    ).toHaveText("California Consumer Privacy Act is a privacy legislation.");
    await expect(
      overview.getByTestId("screen03-orientation-key-points"),
    ).toHaveCount(0);
    await expect(overview.getByTestId("screen03-orientation-provenance"))
      .toHaveCount(0);
    await expect(app.getByTestId("screen03-request-host-reasoning")).toHaveCount(0);
    await expect(overview).not.toContainText(
      "The bill would require the Attorney General to solicit public participation",
    );
    for (const name of [
      SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
      "submit_screen02_audit_draft_v021",
      SCREEN_03_HOST_DRAFT_SUBMIT_TOOL_V036,
    ]) {
      expect(
        serverToolResults.filter((entry) => entry.name === name),
      ).toHaveLength(0);
    }
    expect(
      serverToolResults.filter(
        (entry) =>
          browserWorkflowActionTools.has(entry.name) &&
          entry.arguments.action === "assessment-delivery",
      ),
    ).toHaveLength(0);
    const transcript = await hostReasoningTranscript(page);
    expect(transcript.messageRequests).toHaveLength(0);
    expect(transcript.modelContextRequests).toHaveLength(0);
    expect(transcript.compatibilityMessageRequests).toHaveLength(0);
    expect(transcript.compatibilityModelContextRequests).toHaveLength(0);
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("Screen 1 to deterministic Find selects a fixed-qualified event, locks the Event Card, and completes combined Screen 4", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const {
      app,
      serverToolResults,
      waitForHeldWorkflowAction,
      releaseHeldWorkflowAction,
    } = await openDefaultScreen01(
      page,
      "find",
      {
        sentence: confirmedWorkflowFindContext().studySentence,
        browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
        holdScreen03Review: true,
        hostModelResponder: automaticV036HostResponder({
          screen01: false,
          screen02: false,
          screen03: true,
        }),
        representativeHostShell: {
          heightPx: 1_000,
          composerHeightPx: 88,
          safeAreaBottomPx: 16,
        },
      },
    );

    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expect(scopeConfirm).toHaveText("Scope confirmed");
    await app
      .getByRole("button", { name: "Continue to shock feasibility" })
      .click();
    await expect(app.getByTestId("screen02-find")).toBeVisible();
    const screen02Open = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
    );
    expect(privateWorkflowSnapshot(screen02Open.result).mode).toBe("find");

    const beforeSearch = serverToolResults.length;
    await app
      .getByRole("button", { name: /find candidate shocks/i })
      .click();
    const searched = await waitForServerWorkflowResult(
      serverToolResults,
      "find-search",
      beforeSearch,
    );
    const completedSnapshot = privateWorkflowSnapshot(searched.result);
    const completedState = stateFromScreen02WorkflowClientSnapshot(
      completedSnapshot,
    );
    expect(completedSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    expect(completedState.mode).toBe("find");
    if (completedState.mode !== "find") {
      throw new Error("Expected deterministic Find state before selection.");
    }
    expect(completedState.assessmentRequests).toEqual([]);
    expect(completedState.assessments).toEqual([]);
    expectOnModeSearchExpansionIntegrity(completedState);
    expect(
      serverToolResults
        .slice(beforeSearch)
        .filter(
          (entry) =>
            browserWorkflowActionTools.has(entry.name) &&
            entry.arguments.action === "assessment-delivery",
        ),
    ).toHaveLength(0);

    const eligible = deriveScreen02FindComparison(completedState).find(
      (row) =>
        row.displayGroup === "comparison" &&
        row.gate.eligible &&
        row.candidate.qualification?.eligible === true,
    );
    expect(eligible).toBeDefined();
    const candidateRows = app.locator(".s2-find-candidate-row");
    const eligibleRow = candidateRows.filter({
      hasText: eligible!.candidate.identity.canonicalTitle,
    });
    const beforeSelection = serverToolResults.length;
    await eligibleRow.click();
    await waitForServerWorkflowResult(
      serverToolResults,
      "find-open",
      beforeSelection,
    );
    const choose = app
      .locator("#s2-find-candidate-detail")
      .getByRole("button", { name: "Investigate this shock" });
    await expect(choose).toBeEnabled();
    await choose.click();
    await waitForServerWorkflowResult(
      serverToolResults,
      "find-select",
      beforeSelection,
    );
    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    const beforeContinue = serverToolResults.length;
    await continueButton.click();
    const continued = await waitForServerWorkflowResult(
      serverToolResults,
      "find-continue",
      beforeContinue,
    );
    expect(continued.result.structuredContent).toMatchObject({
      ok: true,
      mode: "find",
      continuationReady: true,
    });
    const continuedSnapshot = privateWorkflowSnapshot(continued.result);
    expect(continuedSnapshot.handoff).toMatchObject({
      schemaVersion: "screen-02-to-screen-03-event-v4",
      mode: "find",
      destinationScreen: "screen-03",
      decision: {
        mode: "find",
        candidateSnapshotId: eligible!.candidate.candidateSnapshotId,
      },
      outcomeValuesInspected: false,
    });
    await expect(app.getByTestId("screen03")).toBeVisible();
    await expect(
      app.getByText("Verify what changed and when", { exact: true }),
    ).toBeVisible();
    await expect(app.getByText("Researcher review", { exact: true }))
      .toBeVisible();
    const screen03ReviewJourney = await exerciseScreen03FullEventCardJourney(
      app,
      serverToolResults,
      "find",
      page,
      testInfo,
      {
        wait: waitForHeldWorkflowAction,
        release: releaseHeldWorkflowAction,
      },
    );
    await expectNoCurrentScreen03HostActivity(app, page);
    await testInfo.attach("simulated-find-fixed-qualification-handoff.json", {
      body: JSON.stringify(
        {
          simulatedEvidence: true,
          signedInChatGptEvidence: false,
          deterministicFind: {
            legacyAssessmentRequests: completedState.assessmentRequests.length,
            fixedQualificationEligible:
              eligible!.candidate.qualification?.eligible,
            fixedQualificationFingerprint:
              eligible!.candidate.qualification?.sourceFingerprint,
          },
          eligibleCandidateSelected: true,
          screen03ReviewJourney,
          handoff: {
            mode: continuedSnapshot.handoff?.mode,
            destinationScreen:
              continuedSnapshot.handoff?.destinationScreen,
            outcomeValuesInspected:
              continuedSnapshot.handoff?.outcomeValuesInspected,
          },
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-find-fixed-qualified-handoff",
    );
    await saveSimulatedScreenshot(
      page,
      testInfo,
      "simulated-find-v0404-fixed-qualification-handoff-success",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("Audit supports keyboard anchor revision and match opening at 390px in dark reduced-motion mode", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    const issues = captureBrowserIssues(page);
    const { app, snapshot, serverToolResults } = await openCanonicalWorkflow(page, "audit", {
      hostContext: {
        theme: "dark",
        containerDimensions: { maxHeight: 1100, maxWidth: 390 },
      },
    });
    expect(snapshot.mode).toBe("audit");
    await expect(app.locator("html")).toHaveAttribute("data-theme", "dark");

    const headerStatus = app.locator(".s2-audit-badge--status");
    await expect(headerStatus).toHaveAttribute("role", "status");
    await expect(headerStatus).toHaveAttribute("aria-live", "polite");
    await expect(headerStatus).toContainText("Resolving identity");
    const uploadInput = app.getByLabel("Upload an official shock document");
    const uploadInputStyle = await uploadInput.evaluate((input) => {
      const style = getComputedStyle(input);
      const bounds = input.getBoundingClientRect();
      return {
        position: style.position,
        width: bounds.width,
        height: bounds.height,
        paddingInlineStart: Number.parseFloat(style.paddingInlineStart),
        paddingInlineEnd: Number.parseFloat(style.paddingInlineEnd),
        borderInlineStartWidth: Number.parseFloat(style.borderInlineStartWidth),
        borderInlineEndWidth: Number.parseFloat(style.borderInlineEndWidth),
      };
    });
    expect(uploadInputStyle).toEqual({
      position: "absolute",
      width: 1,
      height: 1,
      paddingInlineStart: 0,
      paddingInlineEnd: 0,
      borderInlineStartWidth: 0,
      borderInlineEndWidth: 0,
    });
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-audit-initial-mobile-dark",
    );

    const anchorDetails = app.locator("details.s2-audit-anchor-form");
    const anchorSummary = anchorDetails.locator("summary");
    await anchorSummary.focus();
    await anchorSummary.press("Enter");
    await expect(anchorDetails).toHaveAttribute("open", "");
    await anchorDetails
      .getByLabel("Clarification")
      .fill("Original 2018 statute, not CPRA or implementing rules.");
    await anchorDetails
      .getByLabel("Reason for this revision")
      .fill("Distinguish the original statute in this simulated accessibility run.");
    const revise = anchorDetails.getByRole("button", {
      name: "Search with revised details",
    });
    await revise.focus();
    await revise.press("Enter");
    await waitForWorkflowAction(page, "audit-revise-anchor");
    await expect(app.getByText("Anchor revision 2", { exact: true })).toBeVisible();

    const matches = app.locator(".s2-audit-match");
    await expect.poll(() => matches.count()).toBeGreaterThan(0);
    const firstMatch = matches.first();
    const matchGeometry = await firstMatch.evaluate((button) => ({
      buttonWidth: button.getBoundingClientRect().width,
      listItemWidth: button.parentElement?.getBoundingClientRect().width ?? 0,
    }));
    expect(matchGeometry.listItemWidth).toBeGreaterThan(0);
    expect(
      Math.abs(matchGeometry.buttonWidth - matchGeometry.listItemWidth),
    ).toBeLessThanOrEqual(1);
    await expectNoHorizontalPageOverflow(app);
    const beforeMatchOpen = serverToolResults.length;
    await firstMatch.focus();
    await firstMatch.press("Enter");
    await waitForWorkflowAction(page, "audit-open");
    const opened = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-open",
      beforeMatchOpen,
    );
    const openedState = stateFromScreen02WorkflowClientSnapshot(
      privateWorkflowSnapshot(opened.result),
    );
    if (openedState.mode !== "audit") throw new Error("Expected the opened Audit state.");
    const openedPayload = record(opened.arguments.payload, "keyboard Audit open payload");
    const openedMatch = openedState.possibleMatches.find(
      (match) => match.matchSnapshotId === openedPayload.matchSnapshotId,
    );
    expect(openedMatch).toBeDefined();
    await expect(firstMatch).toHaveAttribute("aria-pressed", "true");
    await expect(firstMatch).toHaveAttribute("aria-controls", "s2-audit-match-detail");
    const dossier = app.locator("article#s2-audit-match-detail");
    await expect(dossier).toBeVisible();
    await expect(dossier.getByRole("heading", { level: 2 }))
      .toHaveText(openedMatch!.identity.canonicalTitle);
    await expect(dossier).toContainText("Saved source-derived · provisional dossier");
    await expect(dossier).toContainText("At a glance");
    const completionNotice = app.locator(".workflow-notice--success");
    await expect(completionNotice).toHaveAttribute("role", "status");
    await expect(completionNotice).toHaveAttribute("aria-live", "polite");
    await expect(completionNotice).toHaveText("Screen 2 restored the canonical result for this operation.");

    const reducedMotion = await app.locator("html").evaluate(() => ({
      requested: matchMedia("(prefers-reduced-motion: reduce)").matches,
      transitionDuration: getComputedStyle(
        document.querySelector(".s2-audit-match")!,
      ).transitionDuration,
    }));
    expect(reducedMotion.requested).toBe(true);
    expect(
      Math.max(
        ...reducedMotion.transitionDuration
          .split(",")
          .map((duration) => Number.parseFloat(duration)),
      ),
    ).toBeLessThanOrEqual(0.001);

    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-audit-opened-mobile-dark",
    );
    await expectNoHorizontalPageOverflow(app);
    await saveSimulatedScreenshot(
      page,
      testInfo,
      "simulated-audit-v021-390px-dark-success",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("Screen 1 to deterministic Audit completes fixed fallbacks, locks the Event Card, and completes combined Screen 4", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const issues = captureBrowserIssues(page);
    const { app, serverToolResults } = await openDefaultScreen01(
      page,
      "audit",
      {
        sentence: confirmedWorkflowAuditContext().studySentence,
        browserNowIso: SCREEN02_BROWSER_CLIENT_NOW_ISO,
        hostModelResponder: automaticV036HostResponder({
          screen01: false,
          screen02: false,
          screen03: true,
        }),
      },
    );
    const scopeConfirm = app.locator(".confirm-row button");
    await expect(scopeConfirm).toBeEnabled();
    await scopeConfirm.click();
    await expect(scopeConfirm).toHaveText("Scope confirmed");
    const beforeAuditNavigation = serverToolResults.length;
    await app
      .getByRole("button", {
        name: "Step 2: Represent known shock, available next",
      })
      .click();
    await expect(app.getByTestId("screen02-audit")).toBeVisible();
    const screen02Open = await waitForServerToolResult(
      serverToolResults,
      currentWorkflowCreateTool,
    );
    const snapshot = privateWorkflowSnapshot(screen02Open.result);
    const initialState = stateFromScreen02WorkflowClientSnapshot(snapshot);
    expect(initialState.mode).toBe("audit");
    if (initialState.mode !== "audit") {
      throw new Error("Expected an initial Audit state.");
    }
    expectOnModeSearchExpansionIntegrity(initialState);
    const preparedDossier = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-open",
      beforeAuditNavigation,
    );
    const preparedDossierPayload = record(
      preparedDossier.arguments.payload,
      "automatic Audit open payload",
    );
    const targetMatchSnapshotId = preparedDossierPayload.matchSnapshotId;
    if (typeof targetMatchSnapshotId !== "string") {
      throw new Error("The automatic Audit open has no match snapshot ID.");
    }
    const targetMatch = initialState.possibleMatches.find(
      (match) => match.matchSnapshotId === targetMatchSnapshotId,
    );
    expect(targetMatch).toBeDefined();
    expect(["supported-alias", "exact"]).toContain(
      targetMatch!.relationship,
    );

    const matchRow = app.locator(".s2-audit-match").filter({
      hasText: targetMatch!.identity.canonicalTitle,
    });
    await expect(matchRow).toHaveAttribute("aria-pressed", "true");
    const preparedDossierSnapshot = privateWorkflowSnapshot(
      preparedDossier.result,
    );
    expect(preparedDossierSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    const dossierState = stateFromScreen02WorkflowClientSnapshot(
      preparedDossierSnapshot,
    );
    expect(dossierState.mode).toBe("audit");
    if (dossierState.mode !== "audit") {
      throw new Error("Expected deterministic Audit dossier state.");
    }
    const dossierRequest = dossierState.assessmentRequests.find(
      (request) =>
        request.target.mode === "audit-dossier" &&
        request.target.matchSnapshotId === targetMatchSnapshotId,
    );
    expect(dossierRequest).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({ status: "service-unavailable" }),
        expect.objectContaining({ status: "completed" }),
      ]),
    });
    expect(
      dossierState.dossiers.find(
        (candidate) =>
          candidate.identitySnapshotId === targetMatch!.identitySnapshotId,
      ),
    ).toMatchObject({
      requestId: dossierRequest?.requestId,
      status: "completed",
    });
    expect(
      serverToolResults
        .slice(beforeAuditNavigation)
        .filter(
          (entry) =>
            browserWorkflowActionTools.has(entry.name) &&
            entry.arguments.action === "assessment-delivery",
        ),
    ).toHaveLength(0);

    const dossier = app.locator("#s2-audit-match-detail");
    await expect(dossier).toContainText("At a glance");
    const identityReason = dossier.getByLabel(
      "Reason for the identity decision",
    );
    await identityReason.fill(
      "The official source-backed title, alias, jurisdiction, and 2018 statute match the named shock.",
    );
    const confirm = dossier.getByRole("button", {
      name: "Yes, this is the shock I meant",
    });
    await expect(confirm).toBeEnabled();
    const beforeConfirm = serverToolResults.length;
    await confirm.click();
    const preparedAssessment = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-confirm",
      beforeConfirm,
    );
    const assessedSnapshot = privateWorkflowSnapshot(
      preparedAssessment.result,
    );
    expect(assessedSnapshot).toMatchObject({
      assessmentAvailable: false,
      assessmentBatch: null,
    });
    const assessedState = stateFromScreen02WorkflowClientSnapshot(
      assessedSnapshot,
    );
    expect(assessedState.mode).toBe("audit");
    if (assessedState.mode !== "audit") {
      throw new Error("Expected deterministic assessed Audit state.");
    }
    expect(assessedState.confirmedIdentity).not.toBeNull();
    expect(assessedState.assessments.at(-1)).toMatchObject({
      status: "completed",
      overallJudgment: "not-enough-evidence",
      overallJudgmentMethod: "fixed-computation",
    });
    const confirmedRequest = assessedState.assessmentRequests.find(
      (request) => request.target.mode === "audit-confirmed-event",
    );
    expect(confirmedRequest).toMatchObject({
      status: "completed",
      lifecycle: expect.arrayContaining([
        expect.objectContaining({ status: "service-unavailable" }),
        expect.objectContaining({ status: "completed" }),
      ]),
    });
    expect(
      serverToolResults
        .slice(beforeConfirm)
        .filter(
          (entry) =>
            browserWorkflowActionTools.has(entry.name) &&
            entry.arguments.action === "assessment-delivery",
        ),
    ).toHaveLength(0);
    await expect(
      app.getByText("Identity confirmed by researcher", { exact: true }),
    ).toBeVisible();
    await expect(app.locator(".s2-audit-assessment-status")).toContainText(
      "Assessment ready.",
    );

    const continueButton = app.getByRole("button", {
      name: "Continue to Screen 3: Verify event",
    });
    await expect(continueButton).toBeEnabled();
    const beforeContinue = serverToolResults.length;
    await continueButton.click();
    const continued = await waitForServerWorkflowResult(
      serverToolResults,
      "audit-continue",
      beforeContinue,
    );
    expect(continued.result.structuredContent).toMatchObject({
      ok: true,
      mode: "audit",
      continuationReady: true,
    });
    const continuedSnapshot = privateWorkflowSnapshot(continued.result);
    expect(continuedSnapshot.handoff).toMatchObject({
      schemaVersion: "screen-02-to-screen-03-event-v4",
      mode: "audit",
      destinationScreen: "screen-03",
      decision: { mode: "audit" },
      outcomeValuesInspected: false,
    });
    const continuedState = stateFromScreen02WorkflowClientSnapshot(
      continuedSnapshot,
    );
    expect(continuedState.mode).toBe("audit");
    if (continuedState.mode !== "audit") {
      throw new Error("Expected continued Audit state.");
    }
    expect(continuedState.continuationHistory).toHaveLength(1);
    await expect(app.getByTestId("screen03")).toBeVisible();
    await expect(
      app.getByText("Verify what changed and when", { exact: true }),
    ).toBeVisible();
    await expect(app.getByText("Researcher review", { exact: true }))
      .toBeVisible();
    const screen03ReviewJourney = await exerciseScreen03FullEventCardJourney(
      app,
      serverToolResults,
      "audit",
      page,
      testInfo,
    );
    await expectNoCurrentScreen03HostActivity(app, page);
    await testInfo.attach("simulated-audit-confirmation-handoff.json", {
      body: JSON.stringify(
        {
          simulatedEvidence: true,
          signedInChatGptEvidence: false,
          dossierCompleted: true,
          researcherIdentityConfirmed: true,
          confirmedAssessmentCompleted: true,
          judgmentDerivedByFixedComputation: true,
          legacyAssessmentDeliveries: 0,
          continuationRecordedOnce: true,
          screen03ReviewJourney,
          handoff: {
            mode: continuedSnapshot.handoff?.mode,
            destinationScreen:
              continuedSnapshot.handoff?.destinationScreen,
            outcomeValuesInspected:
              continuedSnapshot.handoff?.outcomeValuesInspected,
          },
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-audit-confirmed-assessed-handoff",
    );
    await saveSimulatedScreenshot(
      page,
      testInfo,
      "simulated-audit-v021-confirmation-handoff-success",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });

  test("Find remains operable with forced colors, reduced motion, dark theme, and simulated 200% zoom", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.emulateMedia({
      colorScheme: "dark",
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    const issues = captureBrowserIssues(page);
    const { app } = await openCanonicalWorkflow(page, "find", {
      hostContext: {
        theme: "dark",
        containerDimensions: { maxHeight: 1100, maxWidth: 720 },
      },
      hostModelResponder: automaticFindPlanningOnlyHostResponder(),
    });
    await app.locator("html").evaluate((element) => {
      element.style.zoom = "2";
    });

    const preferences = await app.locator("html").evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      forcedColors: matchMedia("(forced-colors: active)").matches,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      zoom: document.documentElement.style.zoom,
    }));
    expect(preferences).toEqual({
      theme: "dark",
      forcedColors: true,
      reducedMotion: true,
      zoom: "2",
    });

    const search = app.getByRole("button", {
      name: /find candidate shocks/i,
    });
    await search.focus();
    await search.press("Enter");
    await waitForWorkflowAction(page, "find-search");
    const firstCandidate = app.locator(".s2-find-candidate-row").first();
    await expect(firstCandidate).toBeVisible();
    await expect(firstCandidate).toBeEnabled();
    await firstCandidate.focus();
    await expectVisibleFocus(firstCandidate);
    const reducedTransitionDuration = await firstCandidate.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    );
    expect(
      Math.max(
        ...reducedTransitionDuration
          .split(",")
          .map((duration) => Number.parseFloat(duration)),
      ),
    ).toBeLessThanOrEqual(0.001);

    const searchProtocol = app.locator(".s2-find-coverage details");
    const sourceRouteRow = searchProtocol.locator("ul > li").first();
    await expect(searchProtocol).not.toHaveAttribute("open", "");
    await expect(sourceRouteRow).toBeHidden();
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-find-forced-colors-200-percent-zoom",
    );
    await expectNoHorizontalPageOverflow(app);
    const searchProtocolSummary = searchProtocol.locator("summary");
    await searchProtocolSummary.focus();
    await searchProtocolSummary.press("Enter");
    await expect(searchProtocol).toHaveAttribute("open", "");
    await expect(sourceRouteRow).toBeVisible();
    await expectNoSeriousOrCriticalWcagViolations(
      page,
      testInfo,
      "simulated-find-forced-colors-200-percent-zoom-expanded-protocol",
    );
    await expectNoHorizontalPageOverflow(app);
    await saveSimulatedScreenshot(
      page,
      testInfo,
      "simulated-find-v021-forced-colors-200-percent-zoom-success",
    );
    await expectNoBrowserOrHostErrors(page, issues);
  });
});
