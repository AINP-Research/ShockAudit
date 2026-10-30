import { describe, expect, it } from "vitest";

import {
  SCREEN_02_MAX_PROPOSALS,
  SCREEN_02_MAX_SEARCH_ROUNDS,
  lockScreen02Choice,
  selectScreen02Item,
  serializeScreen01StudyContext,
} from "../../src/core/screen02-service";
import {
  restoreScreen02StateEnvelope,
  type Screen02StateEnvelope,
} from "../../src/core/screen02-state-envelope";
import type { Screen01StudyContext } from "../../src/core/scope-types";
import { fieldKeys } from "../../src/core/scope-types";
import {
  type Screen02FindItem,
  type Screen02FindProposal,
  type Screen02Session,
} from "../../src/core/screen02-types";
import {
  SCREEN02_NATIVE_QUERY_MAX_VARIANTS,
  SCREEN02_NATIVE_QUERY_MIN_VARIANTS,
} from "../../src/core/screen02-discovery";
import { SHOCKAUDIT_VERSION } from "../../src/version";
import worker from "../../src/worker/index";
import {
  type ShockAuditEnv,
  UI_RESOURCE_URI,
} from "../../src/worker/server";

const FEDERAL_REGISTER_RESPONSE_FIELDS = [
  "document_number",
  "title",
  "type",
  "abstract",
  "action",
  "excerpts",
  "html_url",
  "pdf_url",
  "raw_text_url",
  "body_html_url",
  "publication_date",
  "effective_on",
  "agencies",
] as const;

const env: ShockAuditEnv = {
  SHOCKAUDIT_LOCAL_DEV_IN_PROCESS_MCP: "true",
  SCREEN02_SEARCH_EXPANSION_MODE: "off",
  ASSETS: {
    fetch: async () =>
      new Response(
        '<!doctype html><html><body><div id="root"></div></body></html>',
        { headers: { "content-type": "text/html" } },
      ),
  } as unknown as ShockAuditEnv["ASSETS"],
  NOW: () => "2026-07-29T20:00:00.000Z",
};

const executionContext = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
};

function mcpRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      host: "localhost",
    },
    body: JSON.stringify(body),
  });
}

async function readMcpPayload(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    if (!data) throw new Error(`MCP response contained no SSE data: ${text}`);
    return JSON.parse(data) as Record<string, unknown>;
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  id = 1,
  toolEnv: ShockAuditEnv = env,
) {
  const response = await worker.fetch(
    mcpRequest({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }) as never,
    toolEnv as never,
    executionContext as never,
  );
  expect(response.status).toBe(200);
  return readMcpPayload(response);
}

function confirmedAuditContext(
  appVersion = SHOCKAUDIT_VERSION,
): Screen01StudyContext {
  const sentence =
    "Audit whether the California Consumer Privacy Act changed weekly innovation among U.S. exchange-listed technology firms with state-level assignment and firm-level analysis from 2015 to 2023.";
  return {
    schemaVersion: "1.0",
    appVersion,
    sourceScreen: "screen-01",
    startingPoint: "audit",
    studySentence: sentence,
    contractSourceSentence: sentence,
    knownShock: "California Consumer Privacy Act",
    scopeContract: {
      population: "U.S. exchange-listed technology firms",
      assignmentLevel: "State",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: "2015–2023",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Weekly",
    },
    resolvedKeys: [...fieldKeys, "knownShock"],
    unresolvedDecisions: [],
    scopeDirty: false,
    confirmed: true,
    readyForLaterScreens: true,
    revision: 42,
  };
}

function confirmedFindContext(): Screen01StudyContext {
  const sentence =
    "Find a regulatory shock affecting annual profitability among U.S. exchange-listed manufacturing firms with state-level assignment and firm-level analysis from 2014 to 2022.";
  return {
    schemaVersion: "1.0",
    appVersion: SHOCKAUDIT_VERSION,
    sourceScreen: "screen-01",
    startingPoint: "find",
    studySentence: sentence,
    contractSourceSentence: sentence,
    knownShock: "",
    scopeContract: {
      population: "U.S. exchange-listed manufacturing firms",
      assignmentLevel: "State",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Manufacturing",
      studyPeriod: "2014–2022",
      eventFamily: "Regulation",
      outcomeFamily: "Profitability",
      outcomeFrequency: "Annual",
    },
    resolvedKeys: [...fieldKeys],
    unresolvedDecisions: [],
    scopeDirty: false,
    confirmed: true,
    readyForLaterScreens: true,
    revision: 7,
  };
}

function scopedFindContext(
  scope: Partial<Screen01StudyContext["scopeContract"]>,
) {
  const baseline = confirmedFindContext();
  const mergedScope = {
    ...baseline.scopeContract,
    assignmentLevel:
      scope.assignmentLevel ??
      (scope.geography &&
      scope.geography !== baseline.scopeContract.geography
        ? "Country"
        : baseline.scopeContract.assignmentLevel),
    ...scope,
  };
  const sentence = `Find a ${mergedScope.eventFamily} shock affecting ${mergedScope.outcomeFrequency.toLowerCase()} ${mergedScope.outcomeFamily.toLowerCase()} among ${mergedScope.population} in ${mergedScope.geography} with ${mergedScope.assignmentLevel.toLowerCase()}-level assignment and ${mergedScope.analysisLevel.toLowerCase()}-level analysis from ${mergedScope.studyPeriod}.`;
  return {
    ...baseline,
    studySentence: sentence,
    contractSourceSentence: sentence,
    scopeContract: mergedScope,
  };
}

function hostAiProposal(
  id = "host-ai-china-rule",
): Record<string, unknown> {
  const sourceId = `${id}-source`;
  const candidateTitle = `Provincial Energy Reporting Rule ${id}`;
  const profile = id.includes("ledger")
    ? {
        feature: "certificate-ledger reconciliation schedule",
        external:
          `${candidateTitle} was issued by the securities authority after a commodity-certificate settlement review; issuer lobbying still leaves the assignment process provisional.`,
        population:
          `${candidateTitle} covers listed energy issuers that settle commodity certificates through the provincial ledger, rather than every listed energy firm.`,
        exposure:
          `${candidateTitle} appendices identify ledger account numbers that could be joined to issuer registration records.`,
        timing:
          `${candidateTitle} starts with the first quarterly certificate reconciliation after 2021-07-01, so the accounting calendar defines the provisional onset.`,
        variation:
          `${candidateTitle} distinguishes ledger-settling issuers from firms that sell energy without certificate accounts.`,
        mechanism:
          "certificate reconciliation staffing, working-capital timing, and settlement error risk",
      }
    : id.includes("threshold")
      ? {
          feature: "generation-capacity reporting threshold",
          external:
            `${candidateTitle} followed a grid-reliability directive from the provincial energy bureau; whether firms anticipated the capacity cutoff remains unresolved.`,
          population:
            `${candidateTitle} applies to listed generators whose installed capacity exceeds the order's stated megawatt threshold.`,
          exposure:
            `${candidateTitle} publishes plant capacity bands that can be linked to listed parent companies through ownership records.`,
          timing:
            `${candidateTitle} phases reporting in at the first permit renewal after 2021-07-01 instead of on one universal filing date.`,
          variation:
            `${candidateTitle} creates a capacity-cutoff comparison between plants immediately above and below the filing threshold.`,
          mechanism:
            "meter installation, engineering certification, and permit-renewal expense",
        }
      : id.includes("exemption")
        ? {
            feature: "rural microgrid reporting exemption",
            external:
              `${candidateTitle} records an administrative exemption for isolated microgrids after a rural-service consultation; discretionary waiver decisions require checking.`,
            population:
              `${candidateTitle} excludes qualifying rural microgrid operators while retaining reporting duties for interconnected listed utilities.`,
            exposure:
              `${candidateTitle} names exempt network classes that could be matched to utility service-territory filings.`,
            timing:
              `${candidateTitle} makes each exemption operative when the bureau approves a utility's rural-service petition.`,
            variation:
              `${candidateTitle} may support a comparison between approved isolated microgrids and otherwise similar interconnected systems.`,
            mechanism:
              "rural telemetry procurement, petition preparation, and network reporting overhead",
          }
        : id.includes("disclosure") || id.includes("saffron")
          ? {
              feature: "methane-intensity disclosure bulletin",
              external:
                `${candidateTitle} reflects an environmental bureau disclosure bulletin triggered by regional methane monitoring, although operator input into the bulletin needs review.`,
              population:
                `${candidateTitle} names listed gas processors with covered methane-intensive facilities in the provincial inventory.`,
              exposure:
                `${candidateTitle} facility codes can be cross-walked to processor ownership using the cited emissions inventory.`,
              timing:
                `${candidateTitle} uses the first annual inventory submitted after 2021-07-01 as its reporting start.`,
              variation:
                `${candidateTitle} separates inventory-listed gas processors from energy firms without covered processing facilities.`,
              mechanism:
                "leak-detection investment, public emissions scrutiny, and maintenance scheduling",
            }
          : {
              feature: "smart-meter calibration mandate",
              external:
                `${candidateTitle} was promulgated by the provincial grid regulator after a metering-accuracy proceeding; regulated-firm participation in that proceeding remains a caveat.`,
              population:
                `${candidateTitle} directly covers listed energy operators responsible for grid-connected commercial smart meters.`,
              exposure:
                `${candidateTitle} requires calibration certificates whose meter identifiers can be mapped to operator license records.`,
              timing:
                `${candidateTitle} begins with calibration cycles scheduled after its 2021-07-01 effective date.`,
              variation:
                `${candidateTitle} varies by meter class and scheduled calibration cohort rather than applying identically to every operator.`,
              mechanism:
                "calibration equipment purchases, technician deployment, and billing-quality controls",
            };
  return {
    id,
    mode: "find",
    kind: "event",
    title: candidateTitle,
    description:
      `A host-located ${profile.feature} lead for ${candidateTitle} used to test the completed AI-review boundary. The cited record describes an administrative filing mandate and states this coverage population: ${profile.population}`,
    event: {
      displayName: candidateTitle,
      eventDate: "2021-07-01",
      eventFamily: "Regulation",
      geographies: ["China"],
      populations: ["Chinese publicly listed energy firms"],
    },
    origin: "newly-discovered",
    provisionalDates: ["2021-07-01"],
    affectedPopulation:
      "Chinese publicly listed energy firms",
    requiredVariables: [
      "Covered-firm indicator",
      "Effective date",
    ],
    outcomeLink: {
      text: `Preliminary AI hypothesis: ${candidateTitle}'s ${profile.feature} could affect Profitability through ${profile.mechanism}, subject to later causal verification.`,
      status: "ai-hypothesis",
    },
    likelyServiceLevel: "event-reconnaissance",
    limitations: [
      "The host-located record remains an unverified discovery lead.",
    ],
    reasons: [
      `${candidateTitle} remains in the comparison because its host-located ${profile.feature} record falls inside the locked Chinese energy regulation scope and period.`,
    ],
    sources: [
      {
        id: sourceId,
        title: `Host-located ${profile.feature} record for ${candidateTitle}`,
        locator: `https://example.com/${id}`,
        publisher: "Host-located source",
        publishedDate: "2021-07-01",
        authorityTier: 6,
        channel: "host-global-discovery",
      },
    ],
    assessments: {
      externalShockPlausibility: {
        category: "plausible",
        method: "ai-rubric",
        evidenceSourceIds: [sourceId],
        reason: profile.external,
      },
      populationApplicability: {
        category: "documented-direct",
        method: "ai-rubric",
        evidenceSourceIds: [sourceId],
        sourceEstablishedPopulation: {
          text: profile.population,
          evidenceSourceIds: [sourceId],
        },
        reason: profile.population,
      },
      outcomePathway: {
        category: "source-anchored-specific",
        method: "ai-rubric",
        evidenceSourceIds: [sourceId],
        reason: `${candidateTitle}'s ${profile.feature} supplies a source-anchored Profitability pathway through ${profile.mechanism}, while effect direction and size remain untested.`,
      },
      exposureObservability: {
        category: "observable-with-linkage",
        method: "ai-rubric",
        evidenceSourceIds: [sourceId],
        reason: profile.exposure,
      },
      timeSupport: {
        category: "adequate",
        method: "ai-rubric",
        evidenceSourceIds: [sourceId],
        reason: profile.timing,
      },
      variation: {
        category: "uncertain",
        method: "ai-rubric",
        evidenceSourceIds: [sourceId],
        reason: profile.variation,
      },
    },
  };
}

function unknownAiProposalForNativeItem(
  item: Screen02FindItem,
): Screen02FindProposal {
  const sourceTitle =
    item.sources[0]?.title ?? `${item.title} source record`;
  const isEmissions = /emission/i.test(item.title);
  const isSafety = /safety/i.test(item.title);
  const review = isEmissions
    ? {
        mechanism:
          "pollution-control investment, monitoring expense, and production redesign",
        external:
          `${item.title} appears in ${sourceTitle} as an environmental-agency mandate, but the record does not show whether manufacturers could influence the emissions threshold.`,
        externalTask:
          `Check the ${item.title} rulemaking docket for industry-authored threshold proposals and agency responses.`,
        population:
          `${item.title} does not identify which manufacturing facilities cross the emissions-intensity cutoff or how those plants map to public parent firms.`,
        populationTask:
          `Map the ${item.title} pollutant thresholds, facility exemptions, and parent-company ownership links.`,
        exposure:
          `${item.title} mentions facility emissions reporting, but ${sourceTitle} supplies no tested crosswalk from facility identifiers to the analysis firms.`,
        exposureTask:
          `Test whether ${item.title} facility IDs join uniquely to manufacturing-firm identifiers in the study panel.`,
        timing:
          `${item.title} lists publication and effective dates, yet ${sourceTitle} does not distinguish compliance onset from the first reporting period.`,
        timingTask:
          `Verify the first mandatory ${item.title} emissions report and any transition dates against the outcome frequency.`,
        variation:
          `${item.title} suggests threshold-based emissions coverage without documenting how many study facilities fall on either side of the cutoff.`,
        variationTask:
          `Measure ${item.title} facility counts above and below each emissions threshold before treating the cutoff as usable variation.`,
      }
    : isSafety
      ? {
          mechanism:
            "workplace-system redesign, incident-prevention staffing, and reporting downtime",
          external:
            `${sourceTitle} describes ${item.title} as a workplace-agency action, while the record leaves employer participation in drafting the safety schedule unexamined.`,
          externalTask:
            `Check consultation submissions for ${item.title} to determine whether covered manufacturers shaped the reporting schedule.`,
          population:
            `${item.title} does not resolve whether its safety-reporting duties reach every manufacturer or only establishments in designated hazard classes.`,
          populationTask:
            `Map the ${item.title} hazard classes and small-establishment exclusions to firms in the Screen 1 population.`,
          exposure:
            `${sourceTitle} names reportable safety incidents but does not establish whether establishment reports contain stable firm-linkage keys.`,
          exposureTask:
            `Test ${item.title} incident filings for stable establishment-to-parent identifiers and historical linkage.`,
          timing:
            `${item.title} provides a formal effective date without showing when each hazard class first had to submit a safety report.`,
          timingTask:
            `Verify the initial ${item.title} filing deadline for every covered hazard class and any grace periods.`,
          variation:
            `${item.title} separates hazard classes conceptually, but ${sourceTitle} does not demonstrate populated comparison cells across those classes.`,
          variationTask:
            `Measure covered and exempt ${item.title} establishment counts by hazard class before selecting a comparison design.`,
        }
      : {
          mechanism:
            "compliance-system changes specific to the candidate's documented requirement",
          external:
            `${item.title} is recorded in ${sourceTitle}, but the initiating authority and focal-organization influence are not established by the current material.`,
          externalTask:
            `Locate the initiating docket and consultation history specifically for ${item.title}.`,
          population:
            `${item.title} does not yet establish which Screen 1 units satisfy its legal or administrative coverage conditions.`,
          populationTask:
            `Identify thresholds, exemptions, and covered-unit definitions specifically from ${sourceTitle}.`,
          exposure:
            `${sourceTitle} does not identify a stable field that links ${item.title} exposure to the confirmed analysis unit.`,
          exposureTask:
            `Test candidate identifiers from ${sourceTitle} against the study-panel keys.`,
          timing:
            `${item.title} has provisional dates, but the first binding obligation remains ambiguous in the attached record.`,
          timingTask:
            `Determine publication, legal effect, and first compliance dates for ${item.title}.`,
          variation:
            `${item.title} does not yet document populated threshold, cohort, or jurisdiction contrasts for the study sample.`,
          variationTask:
            `Measure the candidate-specific exposure distribution after applying ${item.title} coverage rules.`,
        };
  return {
    id: item.id,
    mode: "find",
    kind: "event",
    title: item.title,
    description: item.description,
    ...(item.nativeIdentity
      ? {
          nativeIdentity: JSON.parse(
            JSON.stringify(item.nativeIdentity),
          ) as Screen02FindProposal["nativeIdentity"],
        }
      : {}),
    event: JSON.parse(
      JSON.stringify(item.event),
    ) as Screen02FindProposal["event"],
    origin: item.origin,
    ...(item.origin === "fictional-demonstration"
      ? { fictionalDemo: true as const }
      : {}),
    provisionalDates: [...item.provisionalDates],
    affectedPopulation: item.affectedPopulation,
    requiredVariables: [...item.requiredVariables],
    outcomeLink: {
      text: `Preliminary AI hypothesis: ${item.title}, described as ${item.description}, could affect Profitability through ${review.mechanism}; that pathway remains unverified.`,
      status: "ai-hypothesis",
    },
    likelyServiceLevel: item.likelyServiceLevel,
    limitations: [...item.limitations],
    reasons: [
      ...item.reasons.slice(0, 29),
      `${item.title} remains in the comparison because its description—${item.description}—and ${sourceTitle} place a dated manufacturing regulation inside the locked scope, while verification remains pending.`,
    ],
    // Fixed-retrieval evidence is private canonical-state material. The
    // legacy proposal boundary can replay only the public source projection;
    // the server rehydrates an exact existing source from its retained state.
    sources: item.sources.map(({ evidenceText: _evidenceText, ...source }) =>
      JSON.parse(JSON.stringify(source)) as Screen02FindProposal["sources"][number]
    ),
    assessments: {
      externalShockPlausibility: {
        category: "unknown",
        method: "ai-rubric",
        evidenceSourceIds: [],
        reason: review.external,
        unresolved: [review.externalTask],
      },
      populationApplicability: {
        category: "unknown",
        method: "ai-rubric",
        evidenceSourceIds: [],
        sourceEstablishedPopulation: null,
        reason: review.population,
        unresolved: [review.populationTask],
      },
      outcomePathway: {
        category: "unclear",
        method: "ai-rubric",
        evidenceSourceIds: item.sources[0]?.id
          ? [item.sources[0].id]
          : [],
        reason: `${item.title}, described as ${item.description}, has a plausible Profitability pathway through ${review.mechanism}, but the current record does not establish that mechanism.`,
        unresolved: [
          `Trace the ${item.title} requirement into firm-level operating or investment changes before claiming its Profitability pathway.`,
        ],
      },
      exposureObservability: {
        category: "unknown",
        method: "ai-rubric",
        evidenceSourceIds: [],
        reason: review.exposure,
        unresolved: [review.exposureTask],
      },
      timeSupport: {
        category: "unknown",
        method: "ai-rubric",
        evidenceSourceIds: [],
        reason: review.timing,
        unresolved: [review.timingTask],
      },
      variation: {
        category: "unknown",
        method: "ai-rubric",
        evidenceSourceIds: [],
        reason: review.variation,
        unresolved: [review.variationTask],
      },
    },
  };
}

type Screen02ToolPayload = {
  result?: {
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
    _meta?: Record<string, unknown>;
    structuredContent?: {
      screen?: string;
      ok?: boolean;
      error?: string;
      sessionSummary?: {
        runId?: string;
        revision?: number;
        latestRoundId?: string;
        currentItems?: Array<{ id?: string; title?: string }>;
        sessionLocation?: string;
      };
      sessionState?: Screen02StateEnvelope;
      session?: {
        sourceScreen?: string;
        runId?: string;
        mode?: string;
        screen01Baseline?: Screen01StudyContext;
        screen01Fingerprint?: string;
        revision?: number;
        items?: Array<{
          id?: string;
          mode?: string;
          kind?: string;
          anchorShock?: string;
          representationType?: string;
          sources?: Array<{
            id?: string;
            channel?: string;
            retrievedAt?: string;
            authorityTier?: number;
            authorityAssessment?: { method?: string };
          }>;
          sourceSummary?: {
            uniqueSourceCount?: number;
            strongestAuthorityTier?: number | null;
          };
          outcomeLink?: {
            text?: string;
            status?: string;
          };
          rank?: number;
        }>;
        selectedItemId?: string | null;
        lockedChoice?: unknown | null;
        searchManifest?: {
          queryMatrix?: Array<{
            id?: string;
            query?: string;
          }>;
          channels?: Array<{
            channel?: string;
            status?: string;
            note?: string;
          }>;
          stoppingRule?: {
            rule?: string;
            status?: string;
            note?: string;
          };
          coverage?: {
            status?: string;
            proposalsReceived?: number;
            itemsRetained?: number;
            uniqueSourcesLocated?: number;
          };
          outcomeValuesInspected?: boolean;
        };
        interaction?: {
          searchRounds?: Array<{
            id?: string;
            revision?: number;
            requestType?: string;
            exactRequest?: string;
            retrievedAt?: string;
            preferenceCriteriaIds?: string[];
            proposalIdsReceived?: string[];
            itemIdsRetained?: string[];
            parentRoundId?: string;
            semanticDecisions?: Array<{
              itemId?: string;
              decision?: string;
              criterionIds?: string[];
              reason?: string;
            }>;
            shockEvidence?: {
              anchorShock?: string;
              matchMethod?: string;
              proposalIds?: string[];
              candidateNames?: string[];
              sources?: Array<{
                id?: string;
                authorityTier?: number;
                authorityAssessment?: { method?: string };
              }>;
            };
            manifest?: {
              outcomeValuesInspected?: boolean;
              coverage?: {
                status?: string;
                proposalsReceived?: number;
                itemsRetained?: number;
              };
              channels?: Array<{
                channel?: string;
                note?: string;
              }>;
            };
          }>;
          preferences?: {
            criteria?: Array<{
              id?: string;
              kind?: string;
              text?: string;
            }>;
          };
        };
      };
    };
  };
  error?: { message?: string };
};

function screen02SessionFromPayload(
  payload: Screen02ToolPayload,
): Screen02Session | undefined {
  return (
    restoreScreen02StateEnvelope(
      payload.result?.structuredContent?.sessionState,
    ) ?? undefined
  );
}

function expectCompleteScreen02DataOutput(
  payload: Screen02ToolPayload,
) {
  const output = payload.result?.structuredContent;
  const summary = output?.sessionSummary;
  const session = screen02SessionFromPayload(payload);
  expect(output).toBeDefined();
  expect(output).toHaveProperty("sessionState");
  expect(output).not.toHaveProperty("session");
  expect(output).toHaveProperty("sessionSummary");
  expect(session?.sourceScreen).toBe("screen-02");
  expect(payload.result?._meta).toBeUndefined();
  expect(
    output?.sessionState?.payload.length,
  ).toBeLessThanOrEqual(256 * 1024);
  expect(JSON.stringify(output).length).toBeLessThan(270 * 1024);
  expect(summary).toMatchObject({
    runId: session?.runId,
    revision: session?.revision,
    latestRoundId: session?.interaction.searchRounds.at(-1)?.id,
    sessionLocation: "state-envelope",
  });
}

describe("Screen 2 MCP contract", () => {
  it("discovers render tools and an app-callable, non-remounting discovery tool", async () => {
    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }) as never,
      env as never,
      executionContext as never,
    );
    const payload = (await readMcpPayload(response)) as {
      result?: {
        tools?: Array<{
          name?: string;
          description?: string;
          annotations?: { openWorldHint?: boolean };
          _meta?: Record<string, unknown>;
          inputSchema?: {
            properties?: {
              requestType?: { enum?: string[] };
            };
          };
          outputSchema?: {
            properties?: Record<string, unknown>;
            required?: string[];
          };
        }>;
      };
    };

    for (const name of [
      "open_shockaudit_screen_2",
      "assess_shock_options",
      "discover_shock_options",
    ]) {
      const tool = payload.result?.tools?.find(
        (candidate) => candidate.name === name,
      );
      expect(tool).toBeDefined();
      expect(tool?.annotations?.openWorldHint).toBe(
        name === "discover_shock_options",
      );
      const uiMeta = tool?._meta?.ui as
        | { resourceUri?: string; visibility?: string[] }
        | undefined;
      if (
        name === "discover_shock_options" ||
        name === "assess_shock_options"
      ) {
        expect(tool?._meta?.["openai/outputTemplate"]).toBeUndefined();
        expect(tool?._meta?.["ui/resourceUri"]).toBeUndefined();
        expect(uiMeta?.resourceUri).toBeUndefined();
        expect(tool?._meta?.["openai/widgetAccessible"]).toBe(true);
      } else {
        expect(tool?._meta?.["openai/outputTemplate"]).toBe(UI_RESOURCE_URI);
        expect(tool?._meta?.["ui/resourceUri"]).toBe(UI_RESOURCE_URI);
        expect(uiMeta?.resourceUri).toBe(UI_RESOURCE_URI);
      }
      expect(
        uiMeta?.visibility,
      ).toContain("app");
      if (name === "assess_shock_options") {
        expect(tool?.description).toMatch(
          /without resubmitting or changing their factual records/i,
        );
        expect(tool?.description).toMatch(/validated independently/i);
      }
      if (name === "discover_shock_options") {
        expect(tool?.description).toMatch(/bounded source-backed/i);
        expect(tool?.description).toMatch(/targets ten|target ten/i);
        expect(tool?.description).toMatch(/identity matches/i);
      }
      if (
        name === "discover_shock_options" ||
        name === "assess_shock_options"
      ) {
        expect(tool?.outputSchema?.properties).toHaveProperty(
          "sessionSummary",
        );
        expect(tool?.outputSchema?.properties).toHaveProperty(
          "sessionState",
        );
        expect(tool?.outputSchema?.properties).not.toHaveProperty(
          "session",
        );
        expect(tool?.outputSchema?.required).toContain("sessionState");
        if (name === "discover_shock_options") {
          expect(
            tool?.inputSchema?.properties?.requestType?.enum,
          ).toEqual([
            "find-more",
            "refine",
            "none-fit",
            "user-source",
          ]);
        } else {
          const inputContract = JSON.stringify(tool?.inputSchema);
          expect(inputContract).toContain("assessmentVersion");
          expect(inputContract).toContain(
            "screen02-preliminary-assessment-v1",
          );
          expect(inputContract).toContain("requestType");
        }
      } else {
        const openerOutputContract = JSON.stringify(tool?.outputSchema);
        expect(openerOutputContract).toContain("sessionState");
        expect(openerOutputContract).not.toContain(
          "screen-02-workflow-summary-v1",
        );
        expect(tool?.outputSchema?.required).toEqual(
          expect.arrayContaining([
            "screen",
            "ok",
            "error",
            "sessionState",
            "sessionSummary",
          ]),
        );
      }
    }
  });

  it("opens Audit mode from a compatible v0.1.1 context without rewriting its canonical baseline JSON", async () => {
    const studyContext = confirmedAuditContext("0.1.1");
    const exactBaselineJson =
      serializeScreen01StudyContext(studyContext);
    const payload = (await callTool("open_shockaudit_screen_2", {
      studyContext,
    })) as Screen02ToolPayload;
    const output = payload.result?.structuredContent;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError).not.toBe(true);
    expect(output?.screen).toBe("screen-02");
    expect(output?.ok).toBe(true);
    expect(session?.sourceScreen).toBe("screen-02");
    expect(session?.mode).toBe("audit");
    expect(session?.screen01Baseline).toStrictEqual(studyContext);
    expect(
      serializeScreen01StudyContext(session!.screen01Baseline!),
    ).toBe(exactBaselineJson);
    expect(session?.screen01Baseline?.appVersion).toBe("0.1.1");
    expect(session?.screen01Fingerprint).toMatch(
      /^fnv1a64:[a-f0-9]{16}$/,
    );
    expect(session?.selectedItemId).toBeNull();
    expect(session?.lockedChoice).toBeNull();
    expect(session?.items).toEqual([]);
    expect(session?.interaction.itemVersions).toEqual([]);
    expect(session?.interaction.searchRounds).toHaveLength(1);
    expect(session?.interaction.searchRounds[0]).toMatchObject({
      requestType: "initial",
      proposalIdsReceived: [],
      itemIdsRetained: [],
    });
    expect(payload.result?.content?.[0]?.text).toContain(
      "No match has been assumed",
    );
    expect(payload.result?.content?.[0]?.text).toContain(
      "source-backed exact-name or controlled-alias event matches",
    );
  });

  it("opens Find mode with a blank result set and no selected candidate", async () => {
    const studyContext = confirmedFindContext();
    const runId = "screen02-run-open-test";
    const payload = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext, runId },
      2,
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(session?.mode).toBe("find");
    expect(session?.runId).toBe(runId);
    expect(session?.screen01Baseline).toStrictEqual(studyContext);
    expect(session?.items).toEqual([]);
    expect(session?.selectedItemId).toBeNull();
    expect(session?.revision).toBe(0);
    expect(session?.interaction?.searchRounds).toHaveLength(1);
    expect(session?.searchManifest?.coverage?.itemsRetained).toBe(0);
    expect(session?.searchManifest?.outcomeValuesInspected).toBe(false);
    expect(payload.result?.content?.[0]?.text).toContain(
      "No search has run",
    );
  });

  it("assesses externally supplied Find proposals while preserving the exact Screen 1 baseline separately", async () => {
    const studyContext = confirmedFindContext();
    const exactBaselineJson =
      serializeScreen01StudyContext(studyContext);
    const payload = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        proposals: [
          {
            id: "official-rule-2019",
            mode: "find",
            kind: "event",
            title: "2019 manufacturing disclosure rule",
            description:
              "A source-backed regulatory event supplied to the deterministic assessor.",
            event: {
              displayName: "2019 Manufacturing Disclosure Rule",
              eventDate: "2019-07-01",
              eventFamily: "Regulation",
              geographies: ["United States"],
              populations: [
                "U.S. exchange-listed manufacturing firms",
              ],
            },
            origin: "newly-discovered",
            provisionalDates: ["2019-07-01"],
            affectedPopulation:
              "U.S. exchange-listed manufacturing firms covered by the supplied final rule.",
            requiredVariables: [
              "Rule coverage indicator",
              "Rule effective date",
            ],
            outcomeLink: {
              text: "It is an AI-generated hypothesis that compliance exposure could affect annual profitability.",
              status: "ai-hypothesis",
            },
            likelyServiceLevel: "full-audit",
            limitations: [
              "The Worker has not independently verified the supplied rule text.",
            ],
            reasons: [
              "The supplied event falls within all four confirmed hard filters.",
            ],
            sources: [
              {
                id: "official-rule-text",
                title: "Final rule",
                locator: "https://agency.example/final-rule",
                publisher: "Example Agency",
                publishedDate: "2019-06-01",
                authorityTier: 1,
                channel: "official register",
              },
            ],
            assessments: {
              exposureObservability: {
                category: "observable-with-linkage",
                method: "ai-rubric",
                evidenceSourceIds: ["official-rule-text"],
                reason:
                  "The supplied rule identifies covered exchange-listed manufacturers.",
              },
              timeSupport: {
                category: "adequate",
                method: "ai-rubric",
                evidenceSourceIds: ["official-rule-text"],
                reason: "The supplied record gives an exact effective date.",
              },
              variation: {
                category: "usable",
                method: "ai-rubric",
                evidenceSourceIds: ["official-rule-text"],
                reason:
                  "The supplied coverage rule distinguishes covered and uncovered firms.",
              },
            },
          },
        ],
        searchManifest: {
          queryMatrix: [
            {
              id: "q-1",
              query: "2019 manufacturing disclosure final rule",
              purpose: "Locate the controlling event record.",
            },
          ],
          channels: [
            {
              channel: "official register",
              status: "searched",
              note: "One controlling record was supplied.",
            },
          ],
          stoppingRule: {
            rule: "Stop after locating the final rule and coverage text.",
            status: "met",
            note: "Both were in the supplied official record.",
          },
        },
        interpretationSource: "researcher-structured",
      },
      3,
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);
    const retained = session?.items?.find(
      (item) => item.id === "official-rule-2019",
    );

    expect(payload.result?.isError).not.toBe(true);
    expectCompleteScreen02DataOutput(payload);
    expect(session?.screen01Baseline).toStrictEqual(studyContext);
    expect(
      serializeScreen01StudyContext(session!.screen01Baseline!),
    ).toBe(exactBaselineJson);
    expect(session?.revision).toBe(1);
    expect(session?.items?.length).toBeGreaterThanOrEqual(1);
    expect(session?.interaction?.searchRounds).toHaveLength(2);
    expect(retained?.rank).toBe(1);
    expect(retained?.sourceSummary?.uniqueSourceCount).toBe(1);
    expect(retained?.sourceSummary?.strongestAuthorityTier).toBe(6);
    expect(retained?.sources?.[0]).toMatchObject({
      authorityTier: 6,
      authorityAssessment: { method: "unverified" },
    });
    expect(session?.searchManifest?.queryMatrix).toHaveLength(1);
    expect(session?.searchManifest?.coverage).toMatchObject({
      proposalsReceived: 1,
    });
    expect(
      session?.searchManifest?.coverage?.uniqueSourcesLocated,
    ).toBeGreaterThanOrEqual(1);
    expect(session?.searchManifest?.outcomeValuesInspected).toBe(false);
    expect(payload.result?.content?.[0]?.text).toContain(
      "did not browse",
    );
    expect(payload.result?.content?.[0]?.text).toContain(
      "independently verify",
    );
  });

  it("enforces source and origin provenance even when the interpretation label is omitted", async () => {
    const studyContext = scopedFindContext({
      population: "Chinese publicly listed energy firms",
      geography: "China",
      industry: "Energy",
      studyPeriod: "2018–2024",
      eventFamily: "Regulation",
    });
    const proposal = hostAiProposal(
      "omitted-interpretation-provenance",
    );
    const source = (
      proposal.sources as Array<Record<string, unknown>>
    )[0]!;
    source.locator =
      "https://www.sec.gov/rules/unverified-omitted-label";
    source.channel = "primary regulation";
    source.authorityTier = 1;

    const bounded = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        proposals: [proposal],
      },
      301,
    )) as Screen02ToolPayload;
    expect(
      bounded.result?.isError,
      JSON.stringify(bounded),
    ).not.toBe(true);
    expect(
      screen02SessionFromPayload(bounded)?.items.find(
        (item) =>
          item.id ===
          "omitted-interpretation-provenance",
      )?.sources?.[0],
    ).toMatchObject({
      authorityTier: 6,
      authorityAssessment: { method: "unverified" },
    });

    const privileged = hostAiProposal(
      "omitted-interpretation-privileged",
    );
    privileged.origin = "registry-reviewed";
    const rejected = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        proposals: [privileged],
      },
      302,
    )) as Screen02ToolPayload;
    expect(
      rejected.result?.isError === true ||
        Boolean(rejected.error),
    ).toBe(true);
    expect(JSON.stringify(rejected)).toMatch(
      /cannot claim privileged origin/i,
    );
  });

  it("appends an official Federal Register discovery round without inspecting outcomes", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      31,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) {
      throw new Error(`Screen 2 did not open: ${JSON.stringify(opened)}`);
    }

    const requestedUrls: string[] = [];
    const connectorEnv: ShockAuditEnv = {
      ...env,
      CONNECTOR_FETCH: async (input) => {
        requestedUrls.push(String(input));
        return new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                title:
                  "Manufacturing Climate Disclosure Final Rule",
                type: "Rule",
                abstract:
                  "The final rule requires covered manufacturers to submit annual facility-level climate disclosures beginning in July 2020.",
                document_number: "2020-12345",
                html_url:
                  "https://www.federalregister.gov/documents/2020/06/01/2020-12345/manufacturing-climate-disclosure-final-rule",
                publication_date: "2020-06-01",
                effective_on: "2020-07-01",
                agencies: [{ name: "Example Federal Agency" }],
              },
            ],
          }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      },
    };
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "refine",
        exactRequest:
          "Prefer official national rules with observable coverage.",
        criteria: [
          {
            id: "prefer-official-national",
            kind: "prefer",
            text: "official national rule",
          },
        ],
      },
      32,
      connectorEnv,
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(
      payload.result?.isError,
      JSON.stringify(payload),
    ).not.toBe(true);
    expectCompleteScreen02DataOutput(payload);
    const federalRegisterRequest = requestedUrls.find((url) =>
      url.includes("/api/v1/documents.json")
    );
    expect(federalRegisterRequest).toContain("federalregister.gov");
    expect(federalRegisterRequest).toContain(
      "conditions%5Bpublication_date%5D%5Bgte%5D=2014-01-01",
    );
    expect(
      new URL(federalRegisterRequest!).searchParams.getAll("conditions[type][]"),
    ).toEqual(["RULE", "PRORULE", "NOTICE"]);
    expect(
      new URL(federalRegisterRequest!).searchParams.getAll("fields[]"),
    ).toEqual(FEDERAL_REGISTER_RESPONSE_FIELDS);
    expect(session?.revision).toBe(1);
    expect(session?.screen01Baseline).toStrictEqual(studyContext);
    expect(session?.interaction?.searchRounds).toHaveLength(2);
    expect(session?.interaction?.preferences?.criteria).toContainEqual(
      expect.objectContaining({
        id: "prefer-official-national",
        kind: "prefer",
      }),
    );
    const officialItem = session?.items?.find((item) =>
      item.sources?.some(
        (source) => source.id === "fr-source-2020-12345",
      ),
    );
    expect(officialItem).toBeDefined();
    expect(officialItem?.outcomeLink).toMatchObject({
      status: "system-template",
      text: expect.stringMatching(/Source-grounded event feature/),
    });
    expect(
      officialItem?.sources?.find(
        (source) => source.id === "fr-source-2020-12345",
      ),
    ).toMatchObject({
      authorityTier: 2,
      authorityAssessment: { method: "connector-native" },
      retrievedAt: "2026-07-29T20:00:00.000Z",
    });
    expect(
      session?.searchManifest?.channels?.some((channel) =>
        channel.channel?.includes(
          "federal-register-api-v1 diagnostics",
        ),
      ),
    ).toBe(true);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel?.includes(
            "Coverage limitation · Federal Register API v1 · declared-source-boundary",
          ) &&
          channel.status === "not-searched" &&
          channel.note?.includes("state, local, tribal") &&
          channel.note?.includes(
            "Host-assisted discovery required: yes",
          ),
      ),
    ).toBe(true);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel?.includes(
            "Coverage limitation · Federal Register API v1 · declared-source-boundary",
          ) &&
          channel.note?.includes(
            "operative treatment date or unit-level coverage",
          ),
      ),
    ).toBe(true);
    expect(session?.searchManifest?.outcomeValuesInspected).toBe(false);
    expect(
      session?.interaction?.searchRounds?.[1]?.manifest
        ?.outcomeValuesInspected,
    ).toBe(false);
  });

  it("excludes nonbinding Manufacturing Council recruitment notices from a generic regulatory Find", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3191,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");

    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find source-supported manufacturing regulations.",
      },
      3192,
      {
        ...env,
        CONNECTOR_FETCH: async () =>
          new Response(
            JSON.stringify({
              count: 2,
              results: [
                {
                  title: "Manufacturing Council",
                  type: "Notice",
                  action: "Notice of Renewal and Opportunity to Apply.",
                  abstract:
                    "The Secretary renewed the Manufacturing Council and is seeking candidates for membership.",
                  document_number: "2014-21513",
                  html_url:
                    "https://www.federalregister.gov/d/2014-21513",
                  publication_date: "2014-09-10",
                  agencies: [
                    { name: "International Trade Administration" },
                  ],
                },
                {
                  title: "Manufacturing Emissions Reporting Rule",
                  type: "Rule",
                  abstract:
                    "The agency establishes binding emissions reporting requirements that require covered manufacturers to submit annual facility-level pollution records.",
                  document_number: "2014-binding-rule",
                  html_url:
                    "https://www.federalregister.gov/d/2014-binding-rule",
                  publication_date: "2014-12-01",
                  effective_on: "2015-01-01",
                  agencies: [
                    { name: "Environmental Protection Agency" },
                  ],
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          ),
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(
      session?.items.some(
        (item) =>
          item.title === "Manufacturing Council" ||
          item.sources?.some(
            (source) => source.id === "fr-source-2014-21513",
          ),
      ),
    ).toBe(false);
    expect(
      session?.items.some((item) =>
        item.sources?.some(
          (source) => source.id === "fr-source-2014-binding-rule",
        ),
      ),
    ).toBe(true);
  });

  it("applies the common substantive-information gate to the legacy discovery route", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3193,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");

    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find source-supported manufacturing regulations.",
      },
      3194,
      {
        ...env,
        CONNECTOR_FETCH: async () =>
          new Response(
            JSON.stringify({
              count: 2,
              results: [
                {
                  title: "Manufacturing Facility Safety Final Rule",
                  type: "Rule",
                  abstract:
                    "The final rule requires covered public manufacturers to replace legacy facility-safety reports with incident-level electronic reports.",
                  document_number: "2019-substantive",
                  html_url:
                    "https://www.federalregister.gov/d/2019-substantive",
                  publication_date: "2019-06-01",
                  effective_on: "2019-09-01",
                  agencies: [{ name: "Example Safety Agency" }],
                },
                {
                  title: "Manufacturing Administrative Rule",
                  type: "Rule",
                  document_number: "2019-sparse",
                  html_url:
                    "https://www.federalregister.gov/d/2019-sparse",
                  publication_date: "2019-06-02",
                  agencies: [{ name: "Example Safety Agency" }],
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          ),
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(
      session?.items.some((item) =>
        item.sources?.some(
          (source) => source.id === "fr-source-2019-substantive",
        ),
      ),
    ).toBe(true);
    expect(
      session?.items.some((item) =>
        item.sources?.some(
          (source) => source.id === "fr-source-2019-sparse",
        ),
      ),
    ).toBe(false);
    expect(session?.items.length).toBeLessThanOrEqual(10);
  });

  it("uses the common bounded ladder to recover a sparse legacy Find record", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3195,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const requestedUrls: URL[] = [];

    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find source-supported manufacturing regulations.",
        resultLimit: 10,
      },
      3196,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          const url = input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
          requestedUrls.push(url);
          if (url.pathname.includes("/api/v1/documents")) {
            return new Response(
              JSON.stringify({
                count: 1,
                results: [{
                  title: "Manufacturing Facility Electronic Reporting Rule",
                  type: "Rule",
                  abstract:
                    "Rule published in the Federal Register on 2019-06-06.",
                  document_number: "2019-10002",
                  html_url:
                    "https://www.federalregister.gov/d/2019-10002",
                  publication_date: "2019-06-06",
                  agencies: [{ name: "Example Safety Agency" }],
                }],
              }),
              { headers: { "content-type": "application/json" } },
            );
          }
          if (url.pathname === "/d/2019-10002") {
            return new Response(
              "<!doctype html><html><head><title>Manufacturing Facility Electronic Reporting Rule</title></head><body><main><h1>Manufacturing Facility Electronic Reporting Rule</h1><h2>AGENCY:</h2><p>Example Safety Agency.</p><h2>ACTION:</h2><p>Final rule.</p><p>Document Number: 2019-10002.</p><p>The final rule applies throughout the United States to U.S. exchange-listed manufacturing firms that operate covered production facilities.</p><p>It requires each covered firm to replace paper facility-safety reports with incident-level electronic filings beginning on September 1, 2019.</p></main></body></html>",
              { headers: { "content-type": "text/html; charset=utf-8" } },
            );
          }
          return new Response("Not found", { status: 404 });
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);
    const round = session?.interaction.searchRounds.at(-1);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(
      requestedUrls.some((url) => url.pathname === "/d/2019-10002"),
    ).toBe(true);
    expect(
      session?.items.some((item) =>
        item.sources.some(
          (source) => source.id === "fr-source-2019-10002",
        )
      ),
    ).toBe(true);
    expect(round?.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: "Bounded substantive-information retrieval ladder",
        status: "searched",
      }),
    );
    expect(round?.manifest.stoppingRule.note).toMatch(
      /common substantive ladder/i,
    );
  });

  it("excludes a sparse PDF-only legacy record without sending PDF bytes to the text extractor", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3197,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const requestedUrls: URL[] = [];

    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find source-supported manufacturing regulations.",
        resultLimit: 10,
      },
      3198,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          const url = input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
          requestedUrls.push(url);
          return new Response(
            JSON.stringify({
              count: 1,
              results: [{
                title: "Manufacturing PDF-only Reporting Rule",
                type: "Rule",
                abstract:
                  "Rule published in the Federal Register on 2019-06-07.",
                document_number: "2019-pdf-only-manufacturing",
                pdf_url:
                  "https://www.govinfo.gov/content/pkg/FR-2019-06-07/pdf/2019-pdf-only-manufacturing.pdf",
                publication_date: "2019-06-07",
                agencies: [{ name: "Example Safety Agency" }],
              }],
            }),
            { headers: { "content-type": "application/json" } },
          );
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);
    const round = session?.interaction.searchRounds.at(-1);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(
      requestedUrls.some((url) =>
        url.hostname === "www.govinfo.gov" &&
        url.pathname.endsWith("/2019-pdf-only-manufacturing.pdf")
      ),
    ).toBe(false);
    expect(round?.proposalIdsReceived).toContain(
      "fr-2019-pdf-only-manufacturing",
    );
    expect(
      session?.items.some((item) =>
        item.sources.some(
          (source) =>
            source.id === "fr-source-2019-pdf-only-manufacturing",
        )
      ),
    ).toBe(false);
    expect(round?.manifest.stoppingRule.note).toMatch(
      /exhausted every permitted text and explanatory route/i,
    );
  });

  it("filters source-irrelevant records before the display cap and backfills eligible industry matches", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3201,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const requestedUrls: string[] = [];
    let nativeRequestNumber = 0;
    const records = [
      ["Alaska Fishery Gear Rule", "fishery quotas", "2016-00001"],
      ["Bingo, Keno, and Slot Machine Returns", "gambling returns", "2016-00002"],
      ["Municipal Water Records Rule", "public water systems", "2016-00003"],
      ["Hospital Claims Reporting Rule", "health claims", "2016-00004"],
      [
        "Manufacturing Emissions Disclosure Rule",
        "The rule requires covered manufacturers to submit annual facility-level emissions disclosures beginning in 2015.",
        "2015-10001",
      ],
      [
        "Manufacturing Product Safety Rule",
        "The rule requires covered manufacturers to replace annual product-safety summaries with incident-level electronic reports beginning in 2015.",
        "2015-10002",
      ],
      [
        "Manufacturing Energy Reporting Rule",
        "The rule requires covered manufacturers to report annual industrial energy use for each operating facility beginning in 2015.",
        "2015-10003",
      ],
      [
        "Manufacturing Export Documentation Rule",
        "The rule requires covered manufacturers to submit standardized export documentation for each shipment beginning in 2015.",
        "2015-10004",
      ],
    ];
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find four source-relevant manufacturing shocks.",
        resultLimit: 4,
        criteria: [
          {
            id: "require-public-evidence-backfill",
            kind: "require",
            text: "public evidence",
          },
        ],
      },
      3202,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          const requestedUrl = String(input);
          requestedUrls.push(requestedUrl);
          if (!requestedUrl.includes("/api/v1/documents.json")) {
            return new Response("Not found", { status: 404 });
          }
          const offset = nativeRequestNumber % records.length;
          nativeRequestNumber += 1;
          const rotatedRecords = [
            ...records.slice(offset),
            ...records.slice(0, offset),
          ];
          return new Response(
            JSON.stringify({
              count: records.length,
              results: rotatedRecords.map(
                ([title, abstract, documentNumber], index) => ({
                  title,
                  type: "Rule",
                  abstract,
                  document_number: documentNumber,
                  html_url: `https://www.federalregister.gov/d/${documentNumber}`,
                  publication_date: `2015-0${(index % 8) + 1}-01`,
                  agencies: [{ name: "Example Federal Agency" }],
                }),
              ),
            }),
            { headers: { "content-type": "application/json" } },
          );
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);
    const currentRound = session?.interaction.searchRounds.at(-1);
    const currentItems = (currentRound?.itemIdsRetained ?? []).map(
      (id) => session?.items.find((item) => item.id === id),
    );

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(
      currentRound?.manifest.queryMatrix.filter((query) =>
        query.id.startsWith("federal-register-native-")
      ),
    ).toHaveLength(SCREEN02_NATIVE_QUERY_MIN_VARIANTS);
    const searchUrls = requestedUrls.filter((url) =>
      url.includes("/api/v1/documents.json")
    );
    expect(searchUrls).toHaveLength(SCREEN02_NATIVE_QUERY_MAX_VARIANTS);
    expect(
      searchUrls.every((url) => {
        const perPage = Number(new URL(url).searchParams.get("per_page"));
        return Number.isSafeInteger(perPage) && perPage >= 1 && perPage <= 8;
      }),
    ).toBe(true);
    expect(currentItems).toHaveLength(4);
    const retainedConnectorItems = currentItems.filter((item) =>
      item?.id.startsWith("fr-"),
    );
    expect(retainedConnectorItems).toHaveLength(4);
    expect(
      retainedConnectorItems.every((item) =>
        item?.title.toLowerCase().includes("manufacturing"),
      ),
    ).toBe(true);
    expect(
      currentItems.some((item) => /fishery|bingo|hospital|water/i.test(item?.title ?? "")),
    ).toBe(false);
    expect(
      currentRound?.manifest.queryMatrix.map((query) => query.id),
    ).toEqual(
      expect.arrayContaining([
        "federal-register-native-01-federal-register",
        "federal-register-native-02-federal-register",
      ]),
    );
    expect(
      currentRound?.manifest.channels.filter(
        (channel) =>
          channel.channel === "federal-register-api-v1 diagnostics",
      ),
    ).toHaveLength(1);
  });

  it("caps disjoint first-round legal results at sixty unique raw leads", async () => {
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext: confirmedFindContext() },
      3203,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const requestedUrls: URL[] = [];
    let requestNumber = 0;
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find a bounded set of manufacturing regulations.",
        resultLimit: 10,
      },
      3204,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          const url = input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
          requestedUrls.push(url);
          requestNumber += 1;
          const batch = requestNumber;
          return new Response(JSON.stringify({
            count: 8,
            results: Array.from({ length: 8 }, (_, index) => {
              const record = `${batch}-${index + 1}`;
              return {
                title: `Manufacturing Digital Safety Rule ${record}`,
                type: "Rule",
                abstract:
                  "The final rule requires U.S. publicly listed manufacturing firms to change digital product-safety controls beginning in 2019.",
                document_number: `2019-budget-${record}`,
                publication_date: "2019-06-01",
                effective_on: "2019-09-01",
                agencies: [{ name: "Example Federal Agency" }],
              };
            }),
          }), { headers: { "content-type": "application/json" } });
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);
    const round = session?.interaction.searchRounds.at(-1);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    const searchRequests = requestedUrls.filter((url) =>
      url.pathname.includes("/api/v1/documents")
    );
    expect(searchRequests).toHaveLength(SCREEN02_NATIVE_QUERY_MIN_VARIANTS);
    expect(searchRequests.every((url) =>
      url.searchParams.get("per_page") === "5"
    )).toBe(true);
    expect(round?.proposalIdsReceived).toHaveLength(SCREEN_02_MAX_PROPOSALS);
    expect(new Set(round?.proposalIdsReceived ?? []).size).toBe(
      SCREEN_02_MAX_PROPOSALS,
    );
    expect(round?.manifest.channels).toContainEqual(
      expect.objectContaining({
        channel: expect.stringMatching(/^Screen 2 exact retrieval funnel/),
        note: expect.stringMatching(
          /generated 60 provisional proposals.*retained 60 unique raw event leads after common semantic deduplication/i,
        ),
      }),
    );
  });

  it("routes an EU regulation scope to CELLAR without calling a U.S. connector", async () => {
    const studyContext = scopedFindContext({
      population: "EU exchange-listed energy firms",
      geography: "European Union",
      industry: "Energy",
      studyPeriod: "2020–2024",
      eventFamily: "Regulation",
    });
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      321,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) {
      throw new Error(`Screen 2 did not open: ${JSON.stringify(opened)}`);
    }
    const requestedUrls: string[] = [];
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find EU energy regulations.",
        criteria: [
          {
            id: "prefer-hydrogen-ranking-only",
            kind: "prefer",
            text: "ultra-rare hydrogen preference",
          },
        ],
      },
      322,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          requestedUrls.push(String(input));
          return new Response(
            JSON.stringify({
              results: {
                bindings: [
                  {
                    work: {
                      value:
                        "http://publications.europa.eu/resource/cellar/example",
                    },
                    celex: { value: "32023R0956" },
                    title: {
                      value:
                        "Carbon Border Adjustment Mechanism",
                    },
                    date: { value: "2023-05-16" },
                    type: {
                      value:
                        "http://publications.europa.eu/resource/authority/resource-type/REG",
                    },
                  },
                ],
              },
            }),
            { headers: { "content-type": "application/json" } },
          );
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(
      requestedUrls.filter((url) => url.includes("publications.europa.eu")),
    ).toHaveLength(SCREEN02_NATIVE_QUERY_MAX_VARIANTS);
    expect(requestedUrls.find((url) => url.includes("eur-lex.europa.eu"))).toBe(
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956",
    );
    expect(
      requestedUrls.every((url) => !url.includes("federalregister.gov")),
    ).toBe(true);
    expect(decodeURIComponent(requestedUrls[0]!)).not.toContain(
      "ultra-rare hydrogen preference",
    );
    expect(session?.items).toEqual([]);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel === "eu-cellar-sparql-v1 diagnostics" &&
          channel.status === "searched",
      ),
    ).toBe(true);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel?.includes(
            "Coverage limitation · EU Publications Office CELLAR SPARQL · execution-language-boundary",
          ) &&
          channel.status === "not-searched" &&
          channel.note?.includes(
            "queried English-language metadata only",
          ) &&
          channel.note?.includes(
            "Other official EU languages were not searched",
          ) &&
          channel.note?.includes(
            "Host-assisted discovery required: yes",
          ),
      ),
    ).toBe(true);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel?.includes(
            "Coverage limitation · EU Publications Office CELLAR SPARQL · declared-source-boundary",
          ) &&
          channel.note?.includes("national transposition"),
      ),
    ).toBe(true);
    expect(session?.searchManifest?.outcomeValuesInspected).toBe(false);
  });

  it("keeps an unsupported non-U.S. regulation scope empty and records the host-discovery gap", async () => {
    const studyContext = scopedFindContext({
      population: "Chinese publicly listed energy firms",
      geography: "China",
      industry: "Energy",
      studyPeriod: "2018–2024",
      eventFamily: "Regulation",
    });
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      323,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) {
      throw new Error(`Screen 2 did not open: ${JSON.stringify(opened)}`);
    }
    let fetchCalls = 0;
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find Chinese energy regulations.",
      },
      324,
      {
        ...env,
        CONNECTOR_FETCH: async () => {
          fetchCalls += 1;
          throw new Error("No U.S. source may substitute for China.");
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(fetchCalls).toBe(0);
    expect(session?.items).toEqual([]);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel?.includes(
            "national-primary-source-not-configured",
          ) &&
          channel.status === "not-searched" &&
          channel.note?.includes("China"),
      ),
    ).toBe(true);
    expect(
      session?.searchManifest?.channels?.some((channel) =>
        /Federal Register|OpenFEMA/.test(channel.channel ?? ""),
      ),
    ).toBe(false);
  });

  it("searches GDACS for a Thailand earthquake scope and skips unbounded USGS retrieval", async () => {
    const studyContext = scopedFindContext({
      population: "Thai publicly listed firms",
      geography: "Thailand",
      industry: "All industries",
      studyPeriod: "2020–2024",
      eventFamily: "Earthquake disaster",
    });
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      325,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) {
      throw new Error(`Screen 2 did not open: ${JSON.stringify(opened)}`);
    }
    const requestedUrls: string[] = [];
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find earthquake events affecting Thailand.",
      },
      326,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          requestedUrls.push(String(input));
          return new Response(
            JSON.stringify({
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: [99.841, 19.912],
                  },
                  properties: {
                    eventtype: "EQ",
                    eventid: 1001,
                    episodeid: 2,
                    name: "Northern Thailand Earthquake",
                    fromdate: "2024-08-10T00:00:00Z",
                    alertlevel: "orange",
                    affectedcountries: [
                      { countryname: "Thailand", iso3: "THA" },
                    ],
                    url: {
                      details:
                        "https://www.gdacs.org/report.aspx?eventid=1001&eventtype=EQ",
                    },
                  },
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          );
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain("gdacs.org");
    expect(requestedUrls[0]).not.toContain("earthquake.usgs.gov");
    expect(
      new URL(requestedUrls[0]!).searchParams.get("country"),
    ).toBe("Thailand");
    expect(
      session?.items?.some((item) => item.id === "gdacs-eq-1001-2"),
    ).toBe(true);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel?.includes(
            "USGS FDSN earthquake catalog",
          ) &&
          channel.status === "not-searched" &&
          channel.note?.includes("validated geographic bounding box"),
      ),
    ).toBe(true);
    expect(
      session?.searchManifest?.channels?.some((channel) =>
        channel.channel?.includes(
          "GDACS event search · execution-filter-boundary",
        ),
      ),
    ).toBe(false);
    expect(
      session?.searchManifest?.channels?.some((channel) =>
        /Federal Register|OpenFEMA/.test(channel.channel ?? ""),
      ),
    ).toBe(false);
  });

  it("passes a U.S. state to FEMA and its country to GDACS", async () => {
    const run = async (
      geography: string,
      id: number,
    ) => {
      const studyContext = scopedFindContext({
        population: `${geography} publicly listed firms`,
        geography,
        industry: "All industries",
        studyPeriod: "2020–2024",
        eventFamily: "Flood disaster",
      });
      const opened = (await callTool(
        "open_shockaudit_screen_2",
        { studyContext },
        id,
      )) as Screen02ToolPayload;
      const initial = screen02SessionFromPayload(opened);
      if (!initial) {
        throw new Error(
          `Screen 2 did not open: ${JSON.stringify(opened)}`,
        );
      }
      const requestedUrls: string[] = [];
      const result = (await callTool(
        "discover_shock_options",
        {
          session: initial,
          expectedRevision: 0,
          requestType: "find-more",
          exactRequest: `Find flood events affecting ${geography}.`,
        },
        id + 1,
        {
          ...env,
          CONNECTOR_FETCH: async (input) => {
            const requestedUrl = String(input);
            requestedUrls.push(requestedUrl);
            if (
              requestedUrl.includes(
                "/api/open/v2/DisasterDeclarationsSummaries",
              )
            ) {
              return new Response(
                JSON.stringify({
                  DisasterDeclarationsSummaries: [
                    {
                      id: "california-flood-row",
                      disasterNumber: 4999,
                      state: "CA",
                      declarationType: "DR",
                      declarationDate: "2024-04-10T00:00:00.000Z",
                      incidentType: "Flood",
                      declarationTitle:
                        "CALIFORNIA SEVERE STORMS AND FLOODING",
                      incidentBeginDate:
                        "2024-04-01T00:00:00.000Z",
                      incidentEndDate:
                        "2024-04-12T00:00:00.000Z",
                      designatedArea: "Los Angeles (County)",
                    },
                    {
                      id: "california-flood-incomplete-row",
                      disasterNumber: 5000,
                      state: "CA",
                      declarationType: "DR",
                      declarationDate: "2024-05-10T00:00:00.000Z",
                      incidentType: "Flood",
                      declarationTitle:
                        "CALIFORNIA FLOOD WITH NO DESIGNATED AREA",
                      incidentBeginDate:
                        "2024-05-01T00:00:00.000Z",
                    },
                  ],
                }),
                { headers: { "content-type": "application/json" } },
              );
            }
            return new Response(
              JSON.stringify({
                type: "FeatureCollection",
                features: [],
              }),
              { headers: { "content-type": "application/json" } },
            );
          },
        },
      )) as Screen02ToolPayload;
      expect(result.result?.isError, JSON.stringify(result)).not.toBe(
        true,
      );
      return {
        requestedUrls,
        session: screen02SessionFromPayload(result),
      };
    };

    const china = await run("China", 327);
    expect(china.requestedUrls).toHaveLength(1);
    expect(
      new URL(china.requestedUrls[0]!).searchParams.get("country"),
    ).toBe("China");
    expect(
      china.session?.searchManifest?.channels?.some((channel) =>
        channel.channel?.includes("execution-filter-boundary"),
      ),
    ).toBe(false);

    const subnational = await run("California", 329);
    const femaUrl = subnational.requestedUrls.find((url) =>
      url.includes("/api/open/v2/DisasterDeclarationsSummaries"),
    );
    const gdacsUrl = subnational.requestedUrls.find((url) =>
      url.includes("gdacs.org"),
    );
    expect(femaUrl).toBeDefined();
    expect(gdacsUrl).toBeDefined();
    expect(
      new URL(femaUrl!).searchParams.get("$filter"),
    ).toContain("state eq 'CA'");
    expect(new URL(gdacsUrl!).searchParams.get("country")).toBe(
      "United States",
    );
    expect(
      subnational.session?.items.some(
        (item) =>
          item.mode === "find" &&
          item.event.geographies.includes("California") &&
          item.title.includes("CALIFORNIA SEVERE STORMS"),
      ),
    ).toBe(true);
    expect(
      subnational.session?.interaction.searchRounds.at(-1)?.proposalIdsReceived,
    ).toEqual(expect.arrayContaining(["fema-4999", "fema-5000"]));
    expect(
      subnational.session?.items.some((item) => item.id === "fema-5000"),
    ).toBe(false);
    expect(
      subnational.session?.searchManifest?.channels?.some(
        (channel) => channel.channel?.includes("execution-filter-boundary"),
      ),
    ).toBe(false);
  });

  it("does not misrepresent a one-country GDACS route as EU-wide coverage", async () => {
    const studyContext = scopedFindContext({
      population: "EU firms",
      geography: "European Union",
      industry: "All industries",
      studyPeriod: "2020–2024",
      eventFamily: "Earthquake disaster",
    });
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3261,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    let fetchCalls = 0;
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find earthquake events affecting the EU.",
      },
      3262,
      {
        ...env,
        CONNECTOR_FETCH: async () => {
          fetchCalls += 1;
          throw new Error("An unbounded EU hazard fetch is unsafe.");
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(fetchCalls).toBe(0);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel?.includes("GDACS event search") &&
          channel.status === "not-searched" &&
          channel.note?.includes(
            "confirmed European Union boundary spans multiple member states",
          ),
      ),
    ).toBe(true);
  });

  it("executes both bounded global hazard routes for a worldwide earthquake scope", async () => {
    const studyContext = scopedFindContext({
      population: "Publicly listed firms worldwide",
      geography: "Worldwide",
      industry: "All industries",
      studyPeriod: "2020–2024",
      eventFamily: "Earthquake disaster",
    });
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      327,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) {
      throw new Error(`Screen 2 did not open: ${JSON.stringify(opened)}`);
    }
    const requestedHosts: string[] = [];
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find worldwide earthquake events.",
      },
      328,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          const host = new URL(String(input)).hostname;
          requestedHosts.push(host);
          if (host === "www.gdacs.org") {
            return new Response(
              JSON.stringify({
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: {
                      type: "Point",
                      coordinates: [99.21, 18.79],
                    },
                    properties: {
                      eventtype: "EQ",
                      eventid: 2001,
                      episodeid: 1,
                      name: "Thailand Earthquake",
                      fromdate: "2022-03-10T00:00:00Z",
                      alertlevel: "orange",
                      affectedcountries: [
                        { countryname: "Thailand", iso3: "THA" },
                      ],
                      url: {
                        details:
                          "https://www.gdacs.org/report.aspx?eventid=2001&eventtype=EQ",
                      },
                    },
                  },
                ],
              }),
              { headers: { "content-type": "application/json" } },
            );
          }
          if (host === "earthquake.usgs.gov") {
            return new Response(
              JSON.stringify({
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    id: "us7000worldwide",
                    geometry: {
                      type: "Point",
                      coordinates: [138.7, 35.3, 10],
                    },
                    properties: {
                      title: "M 6.4 - Japan",
                      place: "Japan",
                      time: Date.UTC(2023, 4, 5, 12, 0),
                      mag: 6.4,
                      url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000worldwide",
                    },
                  },
                ],
              }),
              { headers: { "content-type": "application/json" } },
            );
          }
          throw new Error(`Unexpected connector host: ${host}`);
        },
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError, JSON.stringify(payload)).not.toBe(true);
    expect(new Set(requestedHosts)).toEqual(
      new Set(["www.gdacs.org", "earthquake.usgs.gov"]),
    );
    expect(
      session?.items?.map((item) => item.id),
    ).toEqual(
      expect.arrayContaining([
        "gdacs-eq-2001-1",
        "usgs-earthquake-us7000worldwide",
      ]),
    );
    for (const sourceName of [
      "GDACS event search",
      "USGS FDSN earthquake catalog",
    ]) {
      expect(
        session?.searchManifest?.channels?.some(
          (channel) =>
            channel.channel?.includes(
              `Coverage limitation · ${sourceName} · declared-source-boundary`,
            ) && channel.status === "not-searched",
        ),
      ).toBe(true);
    }
    expect(
      session?.searchManifest?.channels?.some((channel) =>
        /Federal Register|OpenFEMA/.test(channel.channel ?? ""),
      ),
    ).toBe(false);
    expect(
      session?.searchManifest?.channels?.some(
        (channel) =>
          channel.channel?.includes(
            "GDACS event search · execution-filter-boundary",
          ),
      ),
    ).toBe(false);
  });

  it("keeps the exact Audit shock and returns a lockable source-backed event-identity match without selecting a representation", async () => {
    const studyContext = confirmedAuditContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      33,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");

    let requestedUrl = "";
    const connectorEnv: ShockAuditEnv = {
      ...env,
      CONNECTOR_FETCH: async (input) => {
        requestedUrl = String(input);
        return new Response(
          JSON.stringify({
            count: 1,
            results: [
              {
                title:
                  "California Consumer Privacy Act Regulations",
                type: "Notice",
                abstract:
                  "Final regulations implementing the California Consumer Privacy Act.",
                document_number: "2020-09876",
                html_url:
                  "https://www.federalregister.gov/documents/2020/07/01/2020-09876/california-consumer-privacy-act-regulations",
                publication_date: "2020-07-01",
                effective_on: "2020-08-01",
                agencies: [{ name: "Example Federal Agency" }],
              },
            ],
          }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      },
    };
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest:
          "Find source-backed ways to represent the named shock.",
      },
      34,
      connectorEnv,
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(
      payload.result?.isError,
      JSON.stringify(payload),
    ).not.toBe(true);
    expect(session?.revision).toBe(1);
    expect(session?.mode).toBe("audit");
    expect(
      new URL(requestedUrl).searchParams.getAll("conditions[type][]"),
    ).toEqual(["RULE", "PRORULE", "NOTICE"]);
    expect(
      new URL(requestedUrl).searchParams.getAll("fields[]"),
    ).toEqual(FEDERAL_REGISTER_RESPONSE_FIELDS);
    expect(session?.items.length).toBeGreaterThan(0);
    expect(
      session?.items?.every(
        (item) =>
          item.mode === "audit" &&
          item.anchorShock === studyContext.knownShock &&
          (item.sources?.length ?? 0) > 0 &&
          item.sourceSummary.uniqueSourceCount > 0,
      ),
    ).toBe(true);
    expect(
      new Set(
        session?.items
          ?.filter((item) => item.mode === "audit")
          .map((item) => item.representationType),
      ),
    ).toEqual(new Set(["whole-package"]));
    expect(
      session?.items?.some((item) =>
        item.id.startsWith("audit-formal-eligibility") ||
        item.id.startsWith("audit-phase-clock") ||
        item.id.startsWith("audit-realized-exposure"),
      ),
    ).toBe(false);
    expect(session?.selectedItemId).toBeNull();
    expect(session?.lockedChoice).toBeNull();
    const shockEvidence =
      session?.interaction?.searchRounds?.[1]?.shockEvidence;
    expect(shockEvidence).toMatchObject({
      anchorShock: studyContext.knownShock,
      matchMethod: "exact-name-or-controlled-alias",
    });
    expect(shockEvidence?.sources?.length).toBeGreaterThan(0);
    expect(
      session?.items?.some((item) => item.mode === "find"),
    ).toBe(false);
    expect(session?.screen01Baseline).toStrictEqual(studyContext);
    expect(session?.searchManifest?.outcomeValuesInspected).toBe(false);

    const match = session?.items[0];
    if (!session || !match) {
      throw new Error("The source-backed Audit match was not retained.");
    }
    const selected = selectScreen02Item(session, match.id);
    expect(selected.selectedItemId).toBe(match.id);
    expect(selected.lockedChoice).toBeNull();
    const locked = lockScreen02Choice(selected);
    expect(locked.lockedChoice).toMatchObject({
      status: "locked",
      itemId: match.id,
      mode: "audit",
      shockName: studyContext.knownShock,
      knownShockAnchor: studyContext.knownShock,
      downstreamStatus: "screen-03-ready",
    });
    expect(
      locked.interaction.selectionHistory.at(-1)?.reason,
    ).toContain("shock for Screen 3 evidence verification");
    expect(locked.items.find((item) => item.id === match.id)?.sources.length)
      .toBeGreaterThan(0);
  });

  it("matches an explicitly nested U.S. registry geography without admitting foreign or sibling-local Audit records", async () => {
    const emptyConnectorEnv: ShockAuditEnv = {
      ...env,
      CONNECTOR_FETCH: async () =>
        new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json" },
        }),
    };
    const auditRegistryAt = async (geography: string, id: number) => {
      const base = confirmedAuditContext();
      const foreignScope = geography === "Canada";
      const studySentence = foreignScope
        ? base.studySentence.replace(
            "U.S. exchange-listed technology firms",
            "Canadian exchange-listed technology firms",
          )
        : base.studySentence;
      const studyContext: Screen01StudyContext = {
        ...base,
        studySentence,
        contractSourceSentence: studySentence,
        scopeContract: {
          ...base.scopeContract,
          geography,
          population: foreignScope
            ? "Canadian exchange-listed technology firms"
            : base.scopeContract.population,
          assignmentLevel: foreignScope
            ? "Province"
            : base.scopeContract.assignmentLevel,
        },
      };
      const opened = (await callTool(
        "open_shockaudit_screen_2",
        { studyContext },
        id,
        emptyConnectorEnv,
      )) as Screen02ToolPayload;
      const initial = screen02SessionFromPayload(opened);
      if (!initial) {
        throw new Error(
          `Screen 2 did not open for ${geography}: ${JSON.stringify(opened)}`,
        );
      }
      const discovered = (await callTool(
        "discover_shock_options",
        {
          sessionState: opened.result?.structuredContent?.sessionState,
          expectedRevision: initial.revision,
          requestType: "find-more",
          exactRequest:
            "Resolve the exact CCPA anchor using only the reviewed registry fallback.",
        },
        id + 1,
        emptyConnectorEnv,
      )) as Screen02ToolPayload;
      expect(
        discovered.result?.isError,
        JSON.stringify(discovered),
      ).not.toBe(true);
      const session = screen02SessionFromPayload(discovered);
      if (!session) throw new Error("Audit discovery returned no session.");
      return session;
    };

    const unitedStates = await auditRegistryAt("United States", 3410);
    const registryQuery = unitedStates.searchManifest.queryMatrix.find(
      (query) => query.id === "reviewed-event-registry",
    );
    expect(registryQuery?.returnedRecordIds).toContain(
      "registry-us-california-ccpa-2020",
    );
    expect(unitedStates.items).toHaveLength(1);
    expect(unitedStates.items[0]).toMatchObject({
      mode: "audit",
      anchorShock: "California Consumer Privacy Act",
      title: "California Consumer Privacy Act of 2018",
    });
    expect(
      unitedStates.items[0]?.sources.map((source) => source.id),
    ).toEqual(
      expect.arrayContaining([
        "source-us-california-ccpa-ab375",
        "source-us-california-ccpa-isor",
      ]),
    );
    expect(
      unitedStates.interaction.searchRounds.at(-1)?.shockEvidence
        ?.candidateNames,
    ).toEqual(["California Consumer Privacy Act of 2018"]);

    for (const [geography, id] of [
      ["Nevada, United States", 3420],
      ["Canada", 3430],
    ] as const) {
      const outOfScope = await auditRegistryAt(geography, id);
      const outOfScopeRegistryQuery =
        outOfScope.searchManifest.queryMatrix.find(
          (query) => query.id === "reviewed-event-registry",
        );
      expect(outOfScopeRegistryQuery?.returnedRecordIds).not.toContain(
        "registry-us-california-ccpa-2020",
      );
      expect(outOfScope.items).toHaveLength(0);
      expect(
        outOfScope.interaction.searchRounds.at(-1)?.shockEvidence,
      ).toBeUndefined();
    }
  });

  it("rejects a stale discovery revision before invoking an official connector", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      35,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    let connectorCalls = 0;
    const connectorEnv: ShockAuditEnv = {
      ...env,
      CONNECTOR_FETCH: async () => {
        connectorCalls += 1;
        throw new Error("A stale request must not reach the connector.");
      },
    };
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 99,
        requestType: "find-more",
        exactRequest: "Find more options.",
      },
      36,
      connectorEnv,
    )) as Screen02ToolPayload;

    expect(
      payload.result?.isError === true || Boolean(payload.error),
    ).toBe(true);
    expect(connectorCalls).toBe(0);
  });

  it("rejects a locked discovery request before invoking an official connector", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      351,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const searched = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find one source-backed option before locking.",
      },
      3511,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          const url = input instanceof URL
            ? input
            : new URL(typeof input === "string" ? input : input.url);
          if (url.pathname.includes("/api/v1/documents")) {
            return new Response(
              JSON.stringify({
                count: 1,
                results: [
                  {
                    title: "Manufacturing Disclosure Final Rule",
                    type: "Rule",
                    document_number: "2019-10001",
                    html_url:
                      "https://www.federalregister.gov/documents/2019/07/01/2019-10001/manufacturing-disclosure-final-rule",
                    publication_date: "2019-07-01",
                    agencies: [{ name: "Securities and Exchange Commission" }],
                  },
                ],
              }),
              { headers: { "content-type": "application/json" } },
            );
          }
          if (url.pathname.includes("/2019-10001/")) {
            return new Response(
              "<!doctype html><html><head><title>Manufacturing Disclosure Final Rule</title></head><body><main><h1>Manufacturing Disclosure Final Rule</h1><h2>AGENCY:</h2><p>Securities and Exchange Commission.</p><h2>ACTION:</h2><p>Final rule.</p><p>Document Number: 2019-10001.</p><p>The final rule requires U.S. publicly listed manufacturing firms to change disclosure controls. It became effective on 2019-07-01.</p></main></body></html>",
              { headers: { "content-type": "text/html; charset=utf-8" } },
            );
          }
          return new Response("Not found", { status: 404 });
        },
      },
    )) as Screen02ToolPayload;
    const sourceBacked = screen02SessionFromPayload(searched);
    const sourceBackedId = sourceBacked?.items?.find(
      (item) => (item.sources?.length ?? 0) > 0,
    )?.id;
    if (!sourceBacked || !sourceBackedId) {
      throw new Error("A source-backed candidate was not retained.");
    }
    const selected = selectScreen02Item(
      sourceBacked as never,
      sourceBackedId,
    );
    const locked = lockScreen02Choice(selected);
    let connectorCalls = 0;
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: locked,
        expectedRevision: locked.revision,
        requestType: "find-more",
        exactRequest: "Find more options after locking.",
      },
      352,
      {
        ...env,
        CONNECTOR_FETCH: async () => {
          connectorCalls += 1;
          throw new Error("A locked request must not reach the connector.");
        },
      },
    )) as Screen02ToolPayload;

    expect(
      payload.result?.isError === true || Boolean(payload.error),
    ).toBe(true);
    expect(connectorCalls).toBe(0);
  });

  it("does not attach a similarly named but different law when the reviewed registry has the exact Audit shock", async () => {
    const studyContext = confirmedAuditContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      353,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) {
      throw new Error(`Screen 2 did not open: ${JSON.stringify(opened)}`);
    }
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find evidence for the exact named shock.",
      },
      354,
      {
        ...env,
        CONNECTOR_FETCH: async () =>
          new Response(
            JSON.stringify({
              count: 1,
              results: [
                {
                  title: "California Consumer Safety Act Final Rule",
                  type: "Rule",
                  document_number: "2020-00001",
                  html_url:
                    "https://www.federalregister.gov/documents/2020/01/01/2020-00001/california-consumer-safety-act-final-rule",
                  publication_date: "2020-01-01",
                  agencies: [{ name: "Environmental Protection Agency" }],
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          ),
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError).not.toBe(true);
    expect(
      session?.interaction?.searchRounds?.[1]?.shockEvidence?.sources?.some(
        (source) => source.id === "fr-source-2020-00001",
      ) ?? false,
    ).toBe(false);
    expect(session?.items).toHaveLength(1);
    expect(session?.items[0]).toMatchObject({
      mode: "audit",
      anchorShock: studyContext.knownShock,
      title: "California Consumer Privacy Act of 2018",
    });
    expect(
      session?.items[0]?.sources.map((source) => source.id),
    ).toEqual(
      expect.arrayContaining([
        "source-us-california-ccpa-ab375",
        "source-us-california-ccpa-isor",
      ]),
    );
    expect(session?.selectedItemId).toBeNull();
    expect(session?.lockedChoice).toBeNull();
    expect(session?.screen01Baseline.knownShock).toBe(
      studyContext.knownShock,
    );
  });

  it("bounds a maximum connector round while retaining source-backed Audit identity matches", async () => {
    const studyContext = confirmedAuditContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      355,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Run the bounded exact-shock reconnaissance.",
        resultLimit: 20,
      },
      356,
      {
        ...env,
        CONNECTOR_FETCH: async () =>
          new Response(
            JSON.stringify({
              count: 20,
              results: Array.from({ length: 20 }, (_, index) => ({
                title: `California Consumer Privacy Act Regulation ${
                  index + 1
                }`,
                type: "Rule",
                document_number: `2020-${String(index).padStart(5, "0")}`,
                html_url: `https://www.federalregister.gov/documents/2020/01/01/2020-${String(
                  index,
                ).padStart(5, "0")}/ccpa-${index}`,
                publication_date: "2020-01-01",
                effective_on: "2020-07-01",
                agencies: [{ name: "Example Federal Agency" }],
              })),
            }),
            { headers: { "content-type": "application/json" } },
          ),
      },
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);
    const evidence =
      session?.interaction?.searchRounds?.[1]?.shockEvidence;

    expect(
      payload.result?.isError,
      JSON.stringify(payload),
    ).not.toBe(true);
    expect(evidence?.proposalIds?.length).toBeGreaterThanOrEqual(20);
    expect(evidence?.proposalIds?.length).toBeLessThanOrEqual(40);
    expect(evidence?.sources?.length).toBeGreaterThanOrEqual(20);
    expect(evidence?.sources?.length).toBeLessThanOrEqual(50);
    expect(session?.items.length).toBeGreaterThan(0);
    expect(session?.items.length).toBeLessThanOrEqual(40);
    expect(
      session?.items?.every(
        (item) =>
          item.mode === "audit" &&
          item.anchorShock === studyContext.knownShock &&
          (item.sources?.length ?? 0) > 0,
      ),
    ).toBe(true);
    expect(session?.selectedItemId).toBeNull();
    expect(session?.lockedChoice).toBeNull();
  });

  it("reports submitted and retained counts truthfully when fixed validation removes every fallback", async () => {
    const baseContext = confirmedFindContext();
    const studySentence = baseContext.studySentence.replace(
      "from 2014 to 2022",
      "from 2004 to 2006",
    );
    const studyContext: Screen01StudyContext = {
      ...baseContext,
      studySentence,
      contractSourceSentence: studySentence,
      scopeContract: {
        ...baseContext.scopeContract,
        studyPeriod: "2004–2006",
      },
    };
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      37,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const connectorEnv: ShockAuditEnv = {
      ...env,
      CONNECTOR_FETCH: async () =>
        new Response(JSON.stringify({ count: 0, results: [] }), {
          headers: { "content-type": "application/json" },
        }),
    };
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find another feasible shock.",
      },
      38,
      connectorEnv,
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);
    const lastRound =
      session?.interaction?.searchRounds?.[
        (session.interaction.searchRounds.length ?? 1) - 1
      ];

    expect(payload.result?.isError).not.toBe(true);
    expect(session?.revision).toBe(1);
    const proposalsReceived = lastRound?.proposalIdsReceived.length ?? 0;
    expect(proposalsReceived).toBeGreaterThan(0);
    expect(lastRound?.proposalIdsReceived).toContain(
      "registry-us-california-ccpa-2020",
    );
    expect(lastRound?.itemIdsRetained).toEqual([]);
    expect(lastRound?.manifest?.coverage).toMatchObject({
      status: "no-results",
      proposalsReceived,
      itemsRetained: 0,
    });
    expect(
      payload.result?.structuredContent?.sessionSummary
        ?.currentItems,
    ).toEqual([]);
    const summary =
      payload.result?.content?.find((item) => item.type === "text")
        ?.text ?? "";
    expect(summary).toContain(
      `It received ${proposalsReceived} provisional event proposals`,
    );
    expect(summary).toContain(
      "retained 0 after fixed validation",
    );
    expect(summary).not.toMatch(/retained [1-9]\d* provisional/i);
    expect(
      lastRound?.manifest?.channels?.some((channel) =>
        channel.channel?.includes("Reviewed event registry"),
      ),
    ).toBe(true);
    expect(lastRound?.manifest?.outcomeValuesInspected).toBe(false);
  });

  it("uses only current criteria in later retrieval and rejects duplicate historical ids before fetch", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      381,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const recorded = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        session: initial,
        expectedRevision: 0,
        requestType: "refine",
        exactRequest: "Require rarepriorconstraint evidence.",
        criteria: [
          {
            id: "require-prior",
            kind: "require",
            text: "rarepriorconstraint",
          },
        ],
        proposals: [],
      },
      382,
    )) as Screen02ToolPayload;
    const recordedSession = screen02SessionFromPayload(recorded);
    if (!recordedSession) throw new Error("Criterion was not recorded.");

    let requestedUrl = "";
    const searched = (await callTool(
      "discover_shock_options",
      {
        session: recordedSession,
        expectedRevision: 1,
        requestType: "find-more",
        exactRequest: "Search again with the current blank criteria.",
      },
      383,
      {
        ...env,
        CONNECTOR_FETCH: async (input) => {
          requestedUrl = String(input);
          return new Response(
            JSON.stringify({ count: 0, results: [] }),
            { headers: { "content-type": "application/json" } },
          );
        },
      },
    )) as Screen02ToolPayload;
    expect(searched.result?.isError).not.toBe(true);
    expect(decodeURIComponent(requestedUrl)).not.toContain(
      "rarepriorconstraint",
    );

    let duplicateFetches = 0;
    const duplicate = (await callTool(
      "discover_shock_options",
      {
        session: recordedSession,
        expectedRevision: 1,
        requestType: "refine",
        exactRequest: "Repeat the same criterion id.",
        criteria: [
          {
            id: "require-prior",
            kind: "require",
            text: "rarepriorconstraint",
          },
        ],
      },
      384,
      {
        ...env,
        CONNECTOR_FETCH: async () => {
          duplicateFetches += 1;
          throw new Error("Duplicate criteria must fail before fetch.");
        },
      },
    )) as Screen02ToolPayload;
    expect(
      duplicate.result?.isError === true || Boolean(duplicate.error),
    ).toBe(true);
    expect(duplicateFetches).toBe(0);
  });

  it("accepts three current criteria after seven prior researcher rounds", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      385,
    )) as Screen02ToolPayload;
    let session = screen02SessionFromPayload(opened);
    if (!session) throw new Error("Screen 2 did not open.");

    for (let round = 0; round < 7; round += 1) {
      const assessed = (await callTool(
        "assess_shock_options",
        {
          studyContext,
          session,
          expectedRevision: round,
          requestType: "refine",
          exactRequest: `Record three criteria for round ${round + 1}.`,
          criteria: [
            {
              id: `require-capacity-${round}`,
              kind: "require",
              text: `Required condition ${round + 1}`,
            },
            {
              id: `prefer-capacity-${round}`,
              kind: "prefer",
              text: `Preferred condition ${round + 1}`,
            },
            {
              id: `avoid-capacity-${round}`,
              kind: "avoid",
              text: `Excluded condition ${round + 1}`,
            },
          ],
          proposals: [],
        },
        386 + round,
      )) as Screen02ToolPayload;
      expect(
        assessed.result?.isError,
        JSON.stringify(assessed),
      ).not.toBe(true);
      session = screen02SessionFromPayload(assessed);
      if (!session) throw new Error("Assessment round was not recorded.");
    }

    const searched = (await callTool(
      "discover_shock_options",
      {
        session,
        expectedRevision: 7,
        requestType: "refine",
        exactRequest: "Search with the next three current criteria.",
        criteria: [
          {
            id: "require-capacity-final",
            kind: "require",
            text: "Final required condition",
          },
          {
            id: "prefer-capacity-final",
            kind: "prefer",
            text: "Final preferred condition",
          },
          {
            id: "avoid-capacity-final",
            kind: "avoid",
            text: "Final excluded condition",
          },
        ],
      },
      399,
      {
        ...env,
        CONNECTOR_FETCH: async () =>
          new Response(JSON.stringify({ count: 0, results: [] }), {
            headers: { "content-type": "application/json" },
          }),
      },
    )) as Screen02ToolPayload;

    expect(
      searched.result?.isError,
      JSON.stringify(searched),
    ).not.toBe(true);
    expect(
      screen02SessionFromPayload(searched)?.interaction.preferences.criteria,
    ).toHaveLength(24);
  });

  it("accepts compact assessments independently and retries only failed candidates", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3831,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");

    const native = (await callTool(
      "discover_shock_options",
      {
        sessionState: opened.result?.structuredContent?.sessionState,
        expectedRevision: initial.revision,
        requestType: "find-more",
        exactRequest: "Find two source-backed manufacturing rules.",
        resultLimit: 2,
      },
      3832,
      {
        ...env,
        CONNECTOR_FETCH: async () =>
          new Response(
            JSON.stringify({
              count: 2,
              results: [
                {
                  title: "Manufacturing Energy Disclosure Final Rule",
                  abstract:
                    "The final rule requires covered manufacturers operating manufacturing facilities to submit annual energy-use disclosures beginning in July 2020.",
                  document_number: "2020-compact-energy",
                  html_url:
                    "https://www.federalregister.gov/documents/2020/06/01/2020-compact-energy/manufacturing-energy-disclosure-final-rule",
                  publication_date: "2020-06-01",
                  effective_on: "2020-07-01",
                  agencies: [{ name: "Example Energy Agency" }],
                },
                {
                  title: "Manufacturing Safety Reporting Final Rule",
                  abstract:
                    "The final rule requires covered manufacturers operating manufacturing plants to replace quarterly safety summaries with incident-level reports beginning in May 2021.",
                  document_number: "2021-compact-safety",
                  html_url:
                    "https://www.federalregister.gov/documents/2021/03/01/2021-compact-safety/manufacturing-safety-reporting-final-rule",
                  publication_date: "2021-03-01",
                  effective_on: "2021-05-01",
                  agencies: [{ name: "Example Safety Agency" }],
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          ),
      },
    )) as Screen02ToolPayload;
    const nativeSession = screen02SessionFromPayload(native);
    const nativeRound = nativeSession?.interaction.searchRounds.at(-1);
    if (
      !nativeSession ||
      nativeRound?.stage !== "native-retrieval" ||
      nativeRound.itemIdsRetained.length !== 2
    ) {
      throw new Error("Expected two compact-assessment candidates.");
    }
    const [firstId, secondId] = nativeRound.itemIdsRetained;
    const first = nativeSession.items.find((item) => item.id === firstId)!;
    const second = nativeSession.items.find((item) => item.id === secondId)!;
    const firstSourceId = first.sources[0]?.id;
    const secondSourceId = second.sources[0]?.id;
    if (!firstSourceId || !secondSourceId) {
      throw new Error("Expected attached candidate sources.");
    }
    const factualSnapshot = (item: typeof first) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      affectedPopulation: item.affectedPopulation,
      provisionalDates: item.provisionalDates,
      sources: item.sources,
      mode: item.mode,
    });
    const firstFacts = factualSnapshot(first);
    const secondFacts = factualSnapshot(second);

    const partial = (await callTool(
      "assess_shock_options",
      {
        assessmentVersion: "screen02-preliminary-assessment-v1",
        studyContext,
        sessionState: native.result?.structuredContent?.sessionState,
        expectedRevision: nativeSession.revision,
        exactRequest: nativeRound.exactRequest,
        rootNativeRoundId: nativeRound.id,
        assessmentParentRoundId: nativeRound.id,
        assessments: [
          {
            itemId: first.id,
            judgment: "worth-exploring",
            studyFit: `${first.title} falls within the confirmed U.S. manufacturing regulation period and study boundary.`,
            affectedPopulation: null,
            outcomeMechanism: `${first.title} could affect Profitability through compliance spending and production-process changes.`,
            mainConcern:
              "The operative coverage rule and firm-level exposure crosswalk remain unverified.",
            evidenceSourceIds: [firstSourceId],
            nextChecks: [
              "Verify the controlling coverage provision and effective date.",
              "Map covered facilities to the focal public firms.",
            ],
          },
          {
            judgment: "worth-exploring",
            studyFit:
              "This malformed generated entry omitted its candidate identifier entirely.",
          },
          {
            itemId: 42,
            judgment: "worth-exploring",
            studyFit:
              "This malformed generated entry supplied a non-string candidate identifier.",
          },
          null,
        ],
      },
      3833,
    )) as Screen02ToolPayload;
    expect(partial.result?.isError, JSON.stringify(partial)).not.toBe(true);
    const partialSession = screen02SessionFromPayload(partial)!;
    const partialRound = partialSession.interaction.searchRounds.at(-1)!;
    expect(partialRound.stage).toBe("preliminary-assessment");
    expect(partialRound.assessmentResults).toEqual([
      expect.objectContaining({ itemId: first.id, status: "assessed" }),
      expect.objectContaining({ itemId: second.id, status: "needs-retry" }),
    ]);
    expect(
      (partial.result?.structuredContent as Record<string, unknown>)
        .assessmentResults,
    ).toEqual(partialRound.assessmentResults);
    expect(factualSnapshot(partialSession.items.find((item) => item.id === first.id)!)).toEqual(firstFacts);
    expect(factualSnapshot(partialSession.items.find((item) => item.id === second.id)!)).toEqual(secondFacts);
    const acceptedAssessment = partialSession.items.find(
      (item) => item.id === first.id,
    )!.preliminaryAssessment;

    const adversarialRetry = (await callTool(
      "assess_shock_options",
      {
        assessmentVersion: "screen02-preliminary-assessment-v1",
        studyContext,
        sessionState: partial.result?.structuredContent?.sessionState,
        expectedRevision: partialSession.revision,
        exactRequest:
          "Try to replace an accepted assessment while the failed peer remains malformed.",
        rootNativeRoundId: nativeRound.id,
        assessmentParentRoundId: partialRound.id,
        assessments: [
          {
            itemId: first.id,
            judgment: "low-priority",
            studyFit: `${first.title} is deliberately reassessed with a conflicting judgment that must be ignored.`,
            affectedPopulation:
              "A deliberately changed population description for covered manufacturing facilities",
            outcomeMechanism: `${first.title} could affect Profitability through an intentionally different administrative-cost mechanism.`,
            mainConcern:
              "This valid-looking replacement must not mutate the previously accepted compact assessment.",
            evidenceSourceIds: [firstSourceId],
            nextChecks: [
              "Ignore this replacement check for the already accepted candidate.",
            ],
          },
          {
            itemId: second.id,
            judgment: "promising-to-verify",
            studyFit: "Still too short",
          },
        ],
      },
      3834,
    )) as Screen02ToolPayload;
    expect(
      adversarialRetry.result?.isError,
      JSON.stringify(adversarialRetry),
    ).not.toBe(true);
    const adversarialSession = screen02SessionFromPayload(adversarialRetry)!;
    const adversarialRound = adversarialSession.interaction.searchRounds.at(-1)!;
    expect(
      adversarialSession.items.find((item) => item.id === first.id)
        ?.preliminaryAssessment,
    ).toEqual(acceptedAssessment);
    expect(adversarialRound.assessmentResults).toEqual([
      expect.objectContaining({
        itemId: first.id,
        status: "assessed",
        reason: expect.stringMatching(/resubmitted replacement was ignored/i),
      }),
      expect.objectContaining({ itemId: second.id, status: "needs-retry" }),
    ]);

    const completed = (await callTool(
      "assess_shock_options",
      {
        assessmentVersion: "screen02-preliminary-assessment-v1",
        studyContext,
        sessionState:
          adversarialRetry.result?.structuredContent?.sessionState,
        expectedRevision: adversarialSession.revision,
        exactRequest: "Use the final retry for only the failed assessment.",
        rootNativeRoundId: nativeRound.id,
        assessmentParentRoundId: adversarialRound.id,
        assessments: [
          {
            itemId: first.id,
            judgment: "promising-to-verify",
            studyFit: `${first.title} receives another conflicting replacement that must remain inert.`,
            affectedPopulation:
              "Another deliberately changed manufacturing-facility population description",
            outcomeMechanism: `${first.title} could affect Profitability through an intentionally changed capital-spending mechanism.`,
            mainConcern:
              "The append-only contract must ignore this second accepted-candidate replacement attempt.",
            evidenceSourceIds: [firstSourceId],
            nextChecks: [
              "Ignore this second replacement check for the accepted candidate.",
            ],
          },
          {
            itemId: second.id,
            judgment: "promising-to-verify",
            studyFit: `${second.title} falls within the confirmed U.S. manufacturing regulation period and study boundary.`,
            affectedPopulation: null,
            outcomeMechanism: `${second.title} could affect Profitability through safety-reporting costs and plant operating changes.`,
            mainConcern:
              "The plant coverage threshold and parent-company linkage remain provisional.",
            evidenceSourceIds: [secondSourceId],
            nextChecks: [
              "Verify the safety-reporting threshold and compliance date.",
              "Link covered plants to the focal public firms.",
            ],
          },
        ],
      },
      3835,
    )) as Screen02ToolPayload;
    expect(completed.result?.isError, JSON.stringify(completed)).not.toBe(true);
    const completedSession = screen02SessionFromPayload(completed)!;
    expect(
      completedSession.interaction.searchRounds.at(-1)?.assessmentResults,
    ).toEqual([
      expect.objectContaining({ itemId: first.id, status: "assessed" }),
      expect.objectContaining({ itemId: second.id, status: "assessed" }),
    ]);
    expect(
      completedSession.items.find((item) => item.id === first.id)
        ?.preliminaryAssessment,
    ).toEqual(acceptedAssessment);
    expect(
      completedSession.items.find((item) => item.id === second.id)
        ?.preliminaryAssessment?.judgment,
    ).toBe("promising-to-verify");
    const overCap = (await callTool(
      "assess_shock_options",
      {
        assessmentVersion: "screen02-preliminary-assessment-v1",
        studyContext,
        sessionState: completed.result?.structuredContent?.sessionState,
        expectedRevision: completedSession.revision,
        exactRequest: "A fourth compact assessment round must be rejected.",
        rootNativeRoundId: nativeRound.id,
        assessmentParentRoundId:
          completedSession.interaction.searchRounds.at(-1)!.id,
        assessments: [{ itemId: first.id }],
      },
      3836,
    )) as Screen02ToolPayload;
    expect(overCap.result?.isError === true || Boolean(overCap.error)).toBe(
      true,
    );
    expect(JSON.stringify(overCap)).toMatch(
      /at most 3 preliminary-assessment rounds per native result set/i,
    );
  });

  it("carries native source coverage into the completed AI-review record", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3841,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");

    const native = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Run the bounded native search.",
        criteria: [
          {
            id: "avoid-native-combined-manifest-test",
            kind: "avoid",
            text: "Exclude every native candidate after semantic review",
          },
        ],
      },
      3842,
      {
        ...env,
        CONNECTOR_FETCH: async () =>
          new Response(
            JSON.stringify({
              count: 1,
              results: [
                {
                  title:
                    "Manufacturing Energy Disclosure Final Rule",
                  abstract:
                    "The final rule requires covered manufacturers to submit annual facility-level energy-use disclosures beginning in July 2020.",
                  document_number: "2020-unknown-review",
                  html_url:
                    "https://www.federalregister.gov/documents/2020/06/01/2020-unknown-review/manufacturing-energy-disclosure-final-rule",
                  publication_date: "2020-06-01",
                  effective_on: "2020-07-01",
                  agencies: [
                    { name: "Example Federal Agency" },
                  ],
                },
              ],
            }),
            {
              headers: { "content-type": "application/json" },
            },
          ),
      },
    )) as Screen02ToolPayload;
    const nativeSession = screen02SessionFromPayload(native);
    if (!nativeSession) {
      throw new Error("The native search did not return a session.");
    }
    const nativeRound =
      nativeSession.interaction?.searchRounds?.at(-1);
    if (!nativeRound?.id) {
      throw new Error("The native search did not record its round id.");
    }
    const fullNativeSession =
      nativeSession as unknown as Screen02Session;
    const retainedNativeItem = fullNativeSession.items.find(
      (item) =>
        item.mode === "find" &&
        item.sources.some(
          (source) => source.id === "fr-source-2020-unknown-review",
        ),
    );
    const retainedNativeId = retainedNativeItem?.id;
    if (
      !retainedNativeId ||
      retainedNativeItem.mode !== "find" ||
      !nativeRound.itemIdsRetained.includes(retainedNativeId)
    ) {
      throw new Error(
        "The native search did not retain the source-backed Find candidate.",
      );
    }
    if (!retainedNativeItem.sources[0]?.id) {
      throw new Error(
        "The native candidate did not retain its source record.",
      );
    }
    const unknownProposal =
      unknownAiProposalForNativeItem(retainedNativeItem);
    const rewrittenAlias: Screen02FindProposal = {
      ...JSON.parse(JSON.stringify(unknownProposal)),
      id: "native-fact-rewrite-alias",
      title: "AI-Rewritten Rule Title",
      description:
        "An AI-rewritten offshore turbine licensing alias submitted to test native-fact identity protection.",
      outcomeLink: {
        text:
          "Preliminary AI hypothesis: the AI-Rewritten Rule Title's offshore turbine licensing alias could change Profitability through vessel-charter delays and installation costs.",
        status: "ai-hypothesis",
      },
      sources: [
        {
          id: "native-fact-rewrite-alias-source",
          title: "Host alias source",
          locator: "https://example.com/native-fact-rewrite-alias",
          publisher: "Host-located source",
          publishedDate: retainedNativeItem.event.eventDate,
          authorityTier: 6,
          channel: "host-global-discovery",
        },
      ],
      assessments: {
        externalShockPlausibility: {
          category: "unknown",
          method: "ai-rubric",
          evidenceSourceIds: [],
          reason:
            "The AI-Rewritten Rule Title alias lacks the offshore licensing docket needed to determine whether turbine operators shaped its assignment.",
          unresolved: [
            "Locate the AI-Rewritten Rule Title licensing docket and compare operator submissions with the final assignment terms.",
          ],
        },
        populationApplicability: {
          category: "unknown",
          method: "ai-rubric",
          evidenceSourceIds: [],
          sourceEstablishedPopulation: null,
          reason:
            "The AI-Rewritten Rule Title alias does not identify which turbine manufacturers require an offshore installation license.",
          unresolved: [
            "Extract vessel-size, turbine-capacity, and coastal-zone coverage conditions for the AI-Rewritten Rule Title.",
          ],
        },
        outcomePathway: {
          category: "unclear",
          method: "ai-rubric",
          evidenceSourceIds: [],
          reason:
            "The AI-Rewritten Rule Title's offshore turbine licensing alias suggests a Profitability pathway through vessel-charter delays, but the Host alias source does not establish it.",
          unresolved: [
            "Trace AI-Rewritten Rule Title licensing delays into vessel-charter expenses and manufacturer Profitability records.",
          ],
        },
        exposureObservability: {
          category: "unknown",
          method: "ai-rubric",
          evidenceSourceIds: [],
          reason:
            "The Host alias source contains no license number that links AI-Rewritten Rule Title exposure to turbine manufacturers.",
          unresolved: [
            "Check offshore license records for stable applicant and turbine-model identifiers tied to the AI-Rewritten Rule Title.",
          ],
        },
        timeSupport: {
          category: "unknown",
          method: "ai-rubric",
          evidenceSourceIds: [],
          reason:
            "The AI-Rewritten Rule Title alias supplies a nominal date but no vessel-mobilization or license-compliance deadline.",
          unresolved: [
            "Verify the first binding AI-Rewritten Rule Title offshore license deadline and any project-specific transition periods.",
          ],
        },
        variation: {
          category: "unknown",
          method: "ai-rubric",
          evidenceSourceIds: [],
          reason:
            "The AI-Rewritten Rule Title alias does not show whether coastal zones or turbine-capacity bands create populated exposure contrasts.",
          unresolved: [
            "Measure AI-Rewritten Rule Title license coverage by coastal zone and turbine-capacity band before proposing variation.",
          ],
        },
      },
    };
    const aliasRewrite = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        session: nativeSession,
        expectedRevision: 1,
        requestType: "refine",
        exactRequest: "Attempt to rewrite a native candidate through an alias.",
        interpretationSource: "ai-interpretation",
        proposals: [unknownProposal, rewrittenAlias],
        parentRoundId: nativeRound.id,
        semanticDecisions: (nativeRound.itemIdsRetained ?? []).map(
          (itemId) => ({
            itemId,
            decision:
              itemId === retainedNativeId ? "retained" : "excluded",
            criterionIds:
              itemId === retainedNativeId
                ? []
                : ["avoid-native-combined-manifest-test"],
            reason:
              itemId === retainedNativeId
                ? "The native candidate remains eligible under its exact factual record."
                : "The candidate is excluded under the recorded do-not-show criterion.",
          }),
        ),
        searchManifest: {
          queryMatrix: [],
          channels: [
            {
              channel: "Host alias integrity test",
              status: "not-searched",
              note: "No extra search was needed for this integrity test.",
            },
          ],
          stoppingRule: {
            rule: "Stop after the alias integrity check.",
            status: "met",
            note: "The integrity check completed.",
          },
        },
      },
      38420,
    )) as Screen02ToolPayload;
    expect(aliasRewrite.result?.isError).toBe(true);
    expect(JSON.stringify(aliasRewrite)).toMatch(
      /clusters with native candidate/i,
    );
    const unknownCompletion = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        session: nativeSession,
        expectedRevision: 1,
        requestType: "refine",
        exactRequest:
          "Complete an explicitly inconclusive preliminary review.",
        interpretationSource: "ai-interpretation",
        proposals: [unknownProposal],
        parentRoundId: nativeRound.id,
        semanticDecisions: (
          nativeRound.itemIdsRetained ?? []
        ).map((itemId) => ({
          itemId,
          decision:
            itemId === retainedNativeId
              ? "retained"
              : "excluded",
          criterionIds:
            itemId === retainedNativeId
              ? []
              : ["avoid-native-combined-manifest-test"],
          reason:
            itemId === retainedNativeId
              ? `${retainedNativeItem.title} remains eligible because its documented candidate description fits the locked manufacturing regulation scope, although all six preliminary judgments remain inconclusive.`
              : "The candidate is excluded under the recorded do-not-show criterion.",
        })),
        searchManifest: {
          queryMatrix: [
            {
              id: "host-unknown-review-search",
              query: "additional jurisdiction source check",
              purpose:
                "Document the host route for an inconclusive review.",
            },
          ],
          channels: [
            {
              channel: "Host unknown-review check",
              status: "searched",
              note:
                "The host completed the declared preliminary source check.",
            },
          ],
          stoppingRule: {
            rule:
              "Stop after the declared preliminary source check.",
            status: "met",
            note:
              "The declared preliminary source check completed.",
          },
        },
      },
      38421,
    )) as Screen02ToolPayload;
    expect(
      unknownCompletion.result?.isError,
      JSON.stringify(unknownCompletion),
    ).not.toBe(true);
    const unknownSession = screen02SessionFromPayload(unknownCompletion);
    if (!unknownSession) {
      throw new Error("The inconclusive review did not return a session.");
    }
    const unknownItem = unknownSession.items.find(
      (item) => item.id === retainedNativeId,
    );
    expect(
      unknownSession.interaction.searchRounds.at(-1)
        ?.preferenceCriteriaIds,
    ).toEqual([
      "avoid-native-combined-manifest-test",
    ]);
    expect(
      [
        "exposureObservability",
        "timeSupport",
        "variation",
      ].map(
        (key) =>
          unknownItem!.scorecard.componentDetails[
            key as
              | "exposureObservability"
              | "timeSupport"
              | "variation"
          ],
      ),
    ).toEqual([
      expect.objectContaining({
        method: "ai-rubric",
        category: "unknown",
      }),
      expect.objectContaining({
        method: "ai-rubric",
        category: "unknown",
      }),
      expect.objectContaining({
        method: "ai-rubric",
        category: "unknown",
      }),
    ]);
    expect(unknownItem?.sources[0]).toEqual(
      retainedNativeItem.sources[0],
    );

    const completed = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        session: nativeSession,
        expectedRevision: 1,
        requestType: "refine",
        exactRequest: "Complete the semantic and global review.",
        interpretationSource: "ai-interpretation",
        proposals: [],
        parentRoundId: nativeRound.id,
        semanticDecisions: (
          nativeRound.itemIdsRetained ?? []
        ).map((itemId) => ({
          itemId,
          decision: "excluded",
          criterionIds: [
            "avoid-native-combined-manifest-test",
          ],
          reason:
            "The researcher asked the semantic review to exclude every native candidate in this test.",
        })),
        searchManifest: {
          queryMatrix: [
            {
              id: "host-global-search",
              query: "jurisdiction-specific regulation search",
              purpose: "Search uncovered jurisdiction-specific sources.",
            },
          ],
          channels: [
            {
              channel: "Host global discovery",
              status: "searched",
              note: "The host searched an additional declared source route.",
            },
          ],
          stoppingRule: {
            rule: "Stop after the declared host route is searched.",
            status: "met",
            note: "The declared host route completed.",
          },
        },
      },
      3843,
    )) as Screen02ToolPayload;
    const completedSession = screen02SessionFromPayload(completed);
    const manifest = completedSession?.searchManifest;

    expect(completed.result?.isError).not.toBe(true);
    expect(completedSession?.revision).toBe(2);
    expect(
      manifest?.queryMatrix?.map((query) => query.id),
    ).toEqual(
      expect.arrayContaining([
        "reviewed-event-registry",
        "host-global-search",
      ]),
    );
    expect(
      manifest?.channels?.some(
        (channel) =>
          channel.channel === "Host global discovery",
      ),
    ).toBe(true);
    expect(
      manifest?.channels?.some((channel) =>
        channel.note?.includes("state, local, tribal"),
      ),
    ).toBe(true);
    expect(manifest?.stoppingRule?.status).toBe("met");
    expect(manifest?.stoppingRule?.note).toContain(
      "Native stage:",
    );
    expect(manifest?.stoppingRule?.note).toContain(
      "Host-assisted stage:",
    );
  });

  it("preserves the submitted AI display order through the public native-to-AI boundary", async () => {
    const baseContext = confirmedFindContext();
    const studySentence = baseContext.studySentence.replace(
      "among U.S. exchange-listed manufacturing firms",
      "among Nevada-based U.S. exchange-listed manufacturing firms",
    );
    const studyContext: Screen01StudyContext = {
      ...baseContext,
      studySentence,
      contractSourceSentence: studySentence,
      scopeContract: {
        ...baseContext.scopeContract,
        geography: "Nevada, United States",
        population:
          "Nevada-based U.S. exchange-listed manufacturing firms",
      },
    };
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      38422,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");

    const native = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find two native candidates for the ordering contract.",
        resultLimit: 2,
      },
      38423,
      {
        ...env,
        CONNECTOR_FETCH: async () =>
          new Response(
            JSON.stringify({
              count: 2,
              results: [
                {
                  title: "Industrial Emissions Final Rule",
                  abstract:
                    "The final rule requires covered manufacturers to report facility emissions above specified pollutant thresholds beginning in July 2020.",
                  document_number: "2020-order-alpha",
                  html_url:
                    "https://www.federalregister.gov/documents/2020/05/01/2020-order-alpha/industrial-emissions-final-rule",
                  publication_date: "2020-05-01",
                  effective_on: "2020-07-01",
                  agencies: [
                    { name: "Example Environmental Agency" },
                  ],
                },
                {
                  title: "Manufacturing Safety Reporting Final Rule",
                  abstract:
                    "The final rule requires covered manufacturers to submit workplace-incident safety reports beginning in June 2018.",
                  document_number: "2018-order-zulu",
                  html_url:
                    "https://www.federalregister.gov/documents/2018/04/01/2018-order-zulu/manufacturing-safety-reporting-final-rule",
                  publication_date: "2018-04-01",
                  effective_on: "2018-06-01",
                  agencies: [
                    { name: "Example Workplace Agency" },
                  ],
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          ),
      },
    )) as Screen02ToolPayload;
    const nativeSession = screen02SessionFromPayload(native);
    const nativeRound =
      nativeSession?.interaction.searchRounds.at(-1);
    if (!nativeSession || !nativeRound?.id) {
      throw new Error("The native ordering round was not recorded.");
    }
    expect(nativeRound.itemIdsRetained).toHaveLength(2);
    expect(
      nativeRound.itemIdsRetained.map(
        (itemId) =>
          nativeSession.items.find((item) => item.id === itemId)
            ?.outcomeLink.status,
      ),
    ).toEqual(["system-template", "system-template"]);

    const nativeItemsById = new Map(
      nativeSession.items
        .filter((item): item is Screen02FindItem => item.mode === "find")
        .map((item) => [item.id, item]),
    );
    const submittedIds = [...nativeRound.itemIdsRetained].reverse();
    const proposals = submittedIds.map((itemId) => {
      const item = nativeItemsById.get(itemId);
      if (!item) throw new Error(`Missing native item ${itemId}.`);
      return unknownAiProposalForNativeItem(item);
    });

    const researcherPromotionProposal = JSON.parse(
      JSON.stringify(proposals[0]),
    ) as Screen02FindProposal;
    researcherPromotionProposal.outcomeLink = {
      text:
        "Researcher-structured caller label that must not promote the native system template.",
      status: "ai-hypothesis",
    };
    const researcherPromotion = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        session: nativeSession,
        expectedRevision: nativeSession.revision,
        requestType: "user-source",
        exactRequest:
          "Attempt a non-authoritative outcome-link promotion.",
        interpretationSource: "researcher-structured",
        proposals: [researcherPromotionProposal],
      },
      384231,
    )) as Screen02ToolPayload;
    expect(
      researcherPromotion.result?.isError,
      JSON.stringify(researcherPromotion),
    ).not.toBe(true);
    expect(
      screen02SessionFromPayload(researcherPromotion)?.items.find(
        (item) => item.id === researcherPromotionProposal.id,
      )?.outcomeLink,
    ).toEqual(
      nativeItemsById.get(researcherPromotionProposal.id)
        ?.outcomeLink,
    );
    expect(
      screen02SessionFromPayload(researcherPromotion)?.items.find(
        (item) => item.id === researcherPromotionProposal.id,
      )?.sources[0]?.evidenceText,
    ).toBe(
      nativeItemsById.get(researcherPromotionProposal.id)
        ?.sources[0]?.evidenceText,
    );

    const reviewed = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        session: nativeSession,
        expectedRevision: nativeSession.revision,
        requestType: "refine",
        exactRequest:
          "Retain both candidates in this explicit AI display order.",
        interpretationSource: "ai-interpretation",
        parentRoundId: nativeRound.id,
        semanticDecisions: nativeRound.itemIdsRetained.map((itemId) => {
          const nativeItem = nativeItemsById.get(itemId)!;
          return {
            itemId,
            decision: "retained" as const,
            criterionIds: [],
            reason: `${nativeItem.title} remains inside the locked scope because ${nativeItem.description} documents a candidate-specific manufacturing regulation for preliminary comparison.`,
          };
        }),
        proposals,
        searchManifest: {
          queryMatrix: [],
          channels: [
            {
              channel: "Host ordering regression",
              status: "not-searched",
              note:
                "The regression reuses exact native records and performs no additional search.",
            },
          ],
          stoppingRule: {
            rule:
              "Stop after retaining both native candidates in the submitted order.",
            status: "met",
            note: "Both candidates received complete preliminary judgments.",
          },
        },
      },
      38424,
    )) as Screen02ToolPayload;
    expect(
      reviewed.result?.isError,
      JSON.stringify(reviewed),
    ).not.toBe(true);
    const reviewedSession = screen02SessionFromPayload(reviewed);
    if (!reviewedSession) {
      throw new Error("The AI review did not return a session.");
    }
    const aiRound = reviewedSession?.interaction.searchRounds.at(-1);

    expect(aiRound?.itemIdsRetained).toEqual(submittedIds);
    expect(
      aiRound?.discovery?.rankings?.map(
        (ranking) => ranking.proposalId,
      ),
    ).toEqual(submittedIds);
    for (const proposal of proposals) {
      expect(
        reviewedSession.items.find((item) => item.id === proposal.id)
          ?.outcomeLink,
      ).toEqual(proposal.outcomeLink);
    }

    const researcherOverwriteProposal = JSON.parse(
      JSON.stringify(proposals[0]),
    ) as Screen02FindProposal;
    researcherOverwriteProposal.outcomeLink = {
      text:
        "Researcher-structured caller label that must not overwrite the authoritative AI hypothesis.",
      status: "ai-hypothesis",
    };
    const researcherOverwrite = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        session: reviewedSession,
        expectedRevision: reviewedSession.revision,
        requestType: "user-source",
        exactRequest:
          "Attempt a non-authoritative outcome-link overwrite.",
        interpretationSource: "researcher-structured",
        proposals: [researcherOverwriteProposal],
      },
      384241,
    )) as Screen02ToolPayload;
    expect(
      researcherOverwrite.result?.isError,
      JSON.stringify(researcherOverwrite),
    ).not.toBe(true);
    expect(
      screen02SessionFromPayload(researcherOverwrite)?.items.find(
        (item) => item.id === researcherOverwriteProposal.id,
      )?.outcomeLink,
    ).toEqual(proposals[0].outcomeLink);
  });

  it("requires an auditable parent, host manifest, source citations, and honest provenance for AI review", async () => {
    const studyContext = scopedFindContext({
      population: "Chinese publicly listed energy firms",
      geography: "China",
      industry: "Energy",
      studyPeriod: "2018–2024",
      eventFamily: "Regulation",
    });
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      3844,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const native = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Find Chinese energy regulations.",
      },
      3845,
    )) as Screen02ToolPayload;
    const nativeSession = screen02SessionFromPayload(native);
    const parentRound =
      nativeSession?.interaction?.searchRounds?.at(-1);
    if (!nativeSession || !parentRound?.id) {
      throw new Error("Native Screen 2 round was not recorded.");
    }
    expect(parentRound.itemIdsRetained).toEqual([]);

    const hostManifest = {
      queryMatrix: [],
      channels: [
        {
          channel: "Host jurisdiction discovery",
          status: "not-searched",
          note:
            "No additional authoritative host route was accessible in this test.",
        },
      ],
      stoppingRule: {
        rule:
          "Stop after recording the unavailable jurisdiction route.",
        status: "not-met",
        note:
          "The route was declared but could not be searched.",
      },
    };
    const validArguments = {
      studyContext,
      session: nativeSession,
      expectedRevision: 1,
      requestType: "refine",
      exactRequest: "Complete the semantic review.",
      interpretationSource: "ai-interpretation",
      parentRoundId: parentRound.id,
      semanticDecisions: [],
      searchManifest: hostManifest,
      proposals: [hostAiProposal()],
    };

    const completed = (await callTool(
      "assess_shock_options",
      validArguments,
      3846,
    )) as Screen02ToolPayload;
    expect(
      completed.result?.isError,
      JSON.stringify(completed),
    ).not.toBe(true);
    expect(
      screen02SessionFromPayload(completed)?.interaction.searchRounds.at(-1),
    ).toMatchObject({
      parentRoundId: parentRound.id,
      semanticDecisions: [],
    });

    const inflatedHostTier = hostAiProposal(
      "host-ai-inflated-tier",
    );
    const inflatedHostSource = (
      inflatedHostTier.sources as Array<Record<string, unknown>>
    )[0]!;
    inflatedHostSource.authorityTier = 1;
    inflatedHostSource.authorityAssessment = {
      method: "ai-rubric",
      reason:
        "The host cannot establish source authority merely by assigning a rubric tier.",
      policyVersion: "screen-02-source-policy-v1",
    };
    const boundedHostTier = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        proposals: [inflatedHostTier],
      },
      38461,
    )) as Screen02ToolPayload;
    expect(
      boundedHostTier.result?.isError,
      JSON.stringify(boundedHostTier),
    ).not.toBe(true);
    expect(
      screen02SessionFromPayload(boundedHostTier)?.items.find(
        (item) => item.id === "host-ai-inflated-tier",
      )?.sources?.[0],
    ).toMatchObject({
      authorityTier: 6,
      authorityAssessment: {
        method: "unverified",
      },
    });

    const officialDomainClaim = hostAiProposal(
      "host-ai-official-domain-claim",
    );
    const officialDomainSource = (
      officialDomainClaim.sources as Array<
        Record<string, unknown>
      >
    )[0]!;
    officialDomainSource.locator =
      "https://www.sec.gov/rules/unverified-host-lead";
    officialDomainSource.authorityTier = 1;
    officialDomainSource.channel = "primary regulation";
    const boundedOfficialDomain = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        proposals: [officialDomainClaim],
      },
      38462,
    )) as Screen02ToolPayload;
    expect(
      boundedOfficialDomain.result?.isError,
      JSON.stringify(boundedOfficialDomain),
    ).not.toBe(true);
    expect(
      screen02SessionFromPayload(boundedOfficialDomain)?.items.find(
        (item) => item.id === "host-ai-official-domain-claim",
      )?.sources?.[0],
    ).toMatchObject({
      authorityTier: 6,
      authorityAssessment: {
        method: "unverified",
      },
    });

    const hostEvidenceClaim = hostAiProposal(
      "host-ai-source-evidence-claim",
    );
    (
      hostEvidenceClaim.sources as Array<Record<string, unknown>>
    )[0]!.evidenceText =
      "Host-authored prose must never become fixed-retrieval source evidence.";
    const boundedHostEvidence = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        proposals: [hostEvidenceClaim],
      },
      384625,
    )) as Screen02ToolPayload;
    expect(
      boundedHostEvidence.result?.isError,
      JSON.stringify(boundedHostEvidence),
    ).not.toBe(true);
    const boundedEvidenceSource = screen02SessionFromPayload(
      boundedHostEvidence,
    )?.items.find(
      (item) => item.id === "host-ai-source-evidence-claim",
    )?.sources[0];
    expect(boundedEvidenceSource).toMatchObject({
      authorityTier: 6,
      authorityAssessment: { method: "unverified" },
    });
    expect(boundedEvidenceSource).not.toHaveProperty("evidenceText");

    const conflictingLocator = hostAiProposal(
      "host-ai-conflicting-locator",
    );
    const firstConflictingSource = (
      conflictingLocator.sources as Array<
        Record<string, unknown>
      >
    )[0]!;
    (
      conflictingLocator.sources as Array<Record<string, unknown>>
    ).push({
      ...firstConflictingSource,
      id: "host-ai-conflicting-locator-source-alias",
      title: "Conflicting authority record for the same locator",
      authorityTier: 1,
    });
    const conflictingAuthority = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        proposals: [conflictingLocator],
      },
      38463,
    )) as Screen02ToolPayload;
    expect(
      conflictingAuthority.result?.isError === true ||
        Boolean(conflictingAuthority.error),
    ).toBe(true);
    expect(JSON.stringify(conflictingAuthority)).toMatch(
      /conflicts with another source record.*same id or locator/i,
    );

    const noManifest = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        searchManifest: undefined,
      },
      3847,
    )) as Screen02ToolPayload;
    expect(
      noManifest.result?.isError === true ||
        Boolean(noManifest.error),
    ).toBe(true);
    expect(JSON.stringify(noManifest)).toMatch(
      /host search manifest/i,
    );

    const noDecisions = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        semanticDecisions: undefined,
      },
      3848,
    )) as Screen02ToolPayload;
    expect(
      noDecisions.result?.isError === true ||
        Boolean(noDecisions.error),
    ).toBe(true);
    expect(JSON.stringify(noDecisions)).toMatch(
      /account for every candidate/i,
    );

    const uncited = hostAiProposal("host-ai-uncited");
    delete (
      uncited.assessments as Record<
        string,
        Record<string, unknown>
      >
    ).variation!.evidenceSourceIds;
    const noEvidence = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        proposals: [uncited],
      },
      3849,
    )) as Screen02ToolPayload;
    expect(
      noEvidence.result?.isError === true ||
        Boolean(noEvidence.error),
    ).toBe(true);
    expect(JSON.stringify(noEvidence)).toMatch(
      /explicitly cite attached source IDs/i,
    );

    const privileged = hostAiProposal(
      "host-ai-privileged-origin",
    );
    privileged.origin = "registry-reviewed";
    const falseOrigin = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        proposals: [privileged],
      },
      3850,
    )) as Screen02ToolPayload;
    expect(
      falseOrigin.result?.isError === true ||
        Boolean(falseOrigin.error),
    ).toBe(true);
    expect(JSON.stringify(falseOrigin)).toMatch(
      /cannot claim privileged origin/i,
    );

    const falseConfirmation = hostAiProposal(
      "host-ai-false-confirmation",
    );
    (
      (falseConfirmation.sources as Array<
        Record<string, unknown>
      >)[0]!
    ).authorityAssessment = {
      method: "researcher-confirmed",
      reason: "The host cannot manufacture researcher confirmation.",
      policyVersion: "screen-02-source-policy-v1",
    };
    const falseAuthority = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        proposals: [falseConfirmation],
      },
      3851,
    )) as Screen02ToolPayload;
    expect(
      falseAuthority.result?.isError === true ||
        Boolean(falseAuthority.error),
    ).toBe(true);
    expect(JSON.stringify(falseAuthority)).toMatch(
      /researcher-confirmed|Invalid option|Invalid input/i,
    );

    const falseNative = hostAiProposal(
      "host-ai-false-native-source",
    );
    (
      (falseNative.sources as Array<
        Record<string, unknown>
      >)[0]!
    ).authorityAssessment = {
      method: "connector-native",
      reason:
        "A host discovery cannot manufacture connector provenance.",
      policyVersion: "screen-02-source-policy-v1",
    };
    const falseNativeAuthority = (await callTool(
      "assess_shock_options",
      {
        ...validArguments,
        proposals: [falseNative],
      },
      3852,
    )) as Screen02ToolPayload;
    expect(
      falseNativeAuthority.result?.isError === true ||
        Boolean(falseNativeAuthority.error),
    ).toBe(true);
    expect(JSON.stringify(falseNativeAuthority)).toMatch(
      /cannot claim native or fixed-domain provenance/i,
    );
  });

  it("rejects interchangeable and ungrounded AI comparison narratives without requiring different ordinal categories", async () => {
    const studyContext = scopedFindContext({
      population: "Chinese publicly listed energy firms",
      geography: "China",
      industry: "Energy",
      studyPeriod: "2018–2024",
      eventFamily: "Regulation",
    });
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      38521,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const native = (await callTool(
      "discover_shock_options",
      {
        session: initial,
        expectedRevision: 0,
        requestType: "find-more",
        exactRequest: "Create an auditable parent for specificity checks.",
      },
      38522,
    )) as Screen02ToolPayload;
    const nativeSession = screen02SessionFromPayload(native);
    const parentRound = nativeSession?.interaction.searchRounds.at(-1);
    if (!nativeSession || !parentRound?.id) {
      throw new Error("The native parent round was not recorded.");
    }
    const baseArguments = {
      studyContext,
      session: nativeSession,
      expectedRevision: nativeSession.revision,
      requestType: "refine" as const,
      exactRequest:
        "Compare candidate-specific preliminary assessments without inspecting outcomes.",
      interpretationSource: "ai-interpretation" as const,
      parentRoundId: parentRound.id,
      semanticDecisions: [],
      searchManifest: {
        queryMatrix: [],
        channels: [
          {
            channel: "Specificity regression fixture",
            status: "not-searched" as const,
            note:
              "The fixture uses its attached candidate records and performs no additional search.",
          },
        ],
        stoppingRule: {
          rule: "Stop after the assessment-specificity boundary is exercised.",
          status: "met" as const,
          note: "Every submitted fixture received a complete review.",
        },
      },
    };

    const duplicateOutcomeA = hostAiProposal(
      "arcadian-metering-standard",
    );
    const duplicateOutcomeB = hostAiProposal(
      "arcadian-ledger-standard",
    );
    const sharedOutcome =
      "The Arcadian smart-meter calibration mandate and certificate-ledger reconciliation schedule could affect Profitability through compliance-system investment and recurring information-processing costs.";
    (
      duplicateOutcomeA.outcomeLink as Record<string, unknown>
    ).text = sharedOutcome;
    (
      duplicateOutcomeB.outcomeLink as Record<string, unknown>
    ).text = sharedOutcome;
    const duplicateOutcome = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [duplicateOutcomeA, duplicateOutcomeB],
      },
      38523,
    )) as Screen02ToolPayload;
    expect(duplicateOutcome.result?.isError).toBe(true);
    expect(JSON.stringify(duplicateOutcome)).toMatch(
      /outcomeLink\.text duplicates the normalized outcome narrative/i,
    );

    const duplicatePopulationA = hostAiProposal(
      "arcadian-threshold-order",
    );
    const duplicatePopulationB = hostAiProposal(
      "arcadian-exemption-order",
    );
    const sharedPopulationReason =
      "The Arcadian order dated 2021-07-01 documents conditional coverage of listed energy firms based on provincial capacity and filing provisions.";
    (
      (
        duplicatePopulationA.assessments as Record<
          string,
          Record<string, unknown>
        >
      ).populationApplicability
    ).reason = sharedPopulationReason;
    (
      (
        duplicatePopulationB.assessments as Record<
          string,
          Record<string, unknown>
        >
      ).populationApplicability
    ).reason = sharedPopulationReason;
    const duplicatePopulation = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [duplicatePopulationA, duplicatePopulationB],
      },
      38524,
    )) as Screen02ToolPayload;
    expect(duplicatePopulation.result?.isError).toBe(true);
    expect(JSON.stringify(duplicatePopulation)).toMatch(
      /assessments\.populationApplicability\.reason duplicates the normalized coverage narrative/i,
    );

    const ungroundedOutcome = hostAiProposal(
      "cobalt-disclosure-order",
    );
    (
      ungroundedOutcome.outcomeLink as Record<string, unknown>
    ).text =
      "A policy could affect business performance through changing organizational behavior.";
    const rejectedUngroundedOutcome = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [ungroundedOutcome],
      },
      38525,
    )) as Screen02ToolPayload;
    expect(rejectedUngroundedOutcome.result?.isError).toBe(true);
    expect(JSON.stringify(rejectedUngroundedOutcome)).toMatch(
      /outcomeLink\.text must contain at least one candidate-distinctive token/i,
    );

    const ungroundedPopulation = hostAiProposal(
      "saffron-threshold-order",
    );
    (
      (
        ungroundedPopulation.assessments as Record<
          string,
          Record<string, unknown>
        >
      ).populationApplicability
    ).reason =
      "The current evidence supports a conditional match to the target organizations.";
    const rejectedUngroundedPopulation = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [ungroundedPopulation],
      },
      38526,
    )) as Screen02ToolPayload;
    expect(rejectedUngroundedPopulation.result?.isError).toBe(true);
    expect(JSON.stringify(rejectedUngroundedPopulation)).toMatch(
      /populationApplicability\.reason must contain at least one candidate-distinctive token/i,
    );

    const rubricReasonFields = [
      "externalShockPlausibility",
      "populationApplicability",
      "outcomePathway",
      "exposureObservability",
      "timeSupport",
      "variation",
    ] as const;
    for (const [index, field] of rubricReasonFields.entries()) {
      const titleSwapA = hostAiProposal(
        `title-swap-metering-${field}`,
      );
      const titleSwapB = hostAiProposal(
        `title-swap-ledger-${field}`,
      );
      const titleA = String(titleSwapA.title);
      const titleB = String(titleSwapB.title);
      const repeatedAssessment = (title: string) =>
        `${title} receives an intentionally repeated detailed administrative assessment of assignment, covered units, timing, linkage, pathway, and comparison structure for this regression check.`;
      (
        titleSwapA.assessments as Record<
          string,
          Record<string, unknown>
        >
      )[field]!.reason = repeatedAssessment(titleA);
      (
        titleSwapB.assessments as Record<
          string,
          Record<string, unknown>
        >
      )[field]!.reason = repeatedAssessment(titleB);
      const rejectedTitleSwap = (await callTool(
        "assess_shock_options",
        {
          ...baseArguments,
          proposals: [titleSwapA, titleSwapB],
        },
        38530 + index,
      )) as Screen02ToolPayload;
      expect(rejectedTitleSwap.result?.isError).toBe(true);
      expect(JSON.stringify(rejectedTitleSwap)).toMatch(
        /reuses the exact candidate-title-normalized narrative skeleton/i,
      );
    }

    const titleSwapOutcomeA = hostAiProposal(
      "title-swap-metering-outcome",
    );
    const titleSwapOutcomeB = hostAiProposal(
      "title-swap-ledger-outcome",
    );
    const repeatedOutcome = (title: string) =>
      `${title}'s administrative filing mandate could affect Profitability through compliance-system investment and recurring information-processing costs, while the proposed pathway remains unverified.`;
    (
      titleSwapOutcomeA.outcomeLink as Record<string, unknown>
    ).text = repeatedOutcome(String(titleSwapOutcomeA.title));
    (
      titleSwapOutcomeB.outcomeLink as Record<string, unknown>
    ).text = repeatedOutcome(String(titleSwapOutcomeB.title));
    const rejectedTitleSwapOutcome = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [titleSwapOutcomeA, titleSwapOutcomeB],
      },
      38536,
    )) as Screen02ToolPayload;
    expect(rejectedTitleSwapOutcome.result?.isError).toBe(true);
    expect(JSON.stringify(rejectedTitleSwapOutcome)).toMatch(
      /reuses the exact candidate-title-normalized narrative skeleton/i,
    );

    const boilerplateA = hostAiProposal(
      "boilerplate-metering-reason",
    );
    const boilerplateB = hostAiProposal(
      "boilerplate-ledger-reason",
    );
    boilerplateA.reasons = [
      `${String(boilerplateA.title)} remains eligible because the administrative materials identify an imposed obligation inside the locked jurisdiction and period, with organizational linkage, coverage, timing, comparison structure, and causal interpretation still requiring careful verification before Screen 3.`,
    ];
    boilerplateB.reasons = [
      `${String(boilerplateB.title)} remains eligible because the administrative materials identify an imposed obligation inside the locked jurisdiction and period, with organizational linkage, coverage, timing, comparison structure, and causal interpretation still requiring targeted verification before Screen 3.`,
    ];
    const rejectedBoilerplate = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [boilerplateA, boilerplateB],
      },
      38537,
    )) as Screen02ToolPayload;
    expect(rejectedBoilerplate.result?.isError).toBe(true);
    expect(JSON.stringify(rejectedBoilerplate)).toMatch(
      /unconditional 0\.95 same-field narrative similarity ceiling/i,
    );

    const oneNounA = hostAiProposal(
      "one-noun-metering-reason",
    );
    const oneNounB = hostAiProposal(
      "one-noun-ledger-reason",
    );
    const oneNounTemplate = (title: string, noun: string) =>
      `${title} remains eligible because the administrative filing identifies a binding obligation with organizational coverage, timing, linkage, assignment, comparison, feasibility, implementation, monitoring, enforcement, auditing, documentation, review, controls, uncertainty, and ${noun} evidence requiring later Screen 3 verification.`;
    oneNounA.reasons = [
      oneNounTemplate(String(oneNounA.title), "calibration"),
    ];
    oneNounB.reasons = [
      oneNounTemplate(String(oneNounB.title), "reconciliation"),
    ];
    const rejectedOneNoun = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [oneNounA, oneNounB],
      },
      38544,
    )) as Screen02ToolPayload;
    expect(rejectedOneNoun.result?.isError).toBe(true);
    expect(JSON.stringify(rejectedOneNoun)).toMatch(
      /unconditional 0\.95 same-field narrative similarity ceiling/i,
    );

    const distinctFeatureA = hostAiProposal(
      "distinct-metering-reason",
    );
    const distinctFeatureB = hostAiProposal(
      "distinct-ledger-reason",
    );
    const featureReason = (title: string, feature: string) =>
      `${title} remains eligible because the cited ${feature} materials identify binding duties inside the locked jurisdiction and period, while organizational coverage, assignment, timing, linkage, comparison construction, implementation, monitoring, and uncertainty remain tasks for Screen 3 verification.`;
    distinctFeatureA.reasons = [
      featureReason(
        String(distinctFeatureA.title),
        "smart meter calibration mandate",
      ),
    ];
    distinctFeatureB.reasons = [
      featureReason(
        String(distinctFeatureB.title),
        "certificate ledger reconciliation schedule",
      ),
    ];
    const acceptedDistinctFeatures = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [distinctFeatureA, distinctFeatureB],
      },
      38545,
    )) as Screen02ToolPayload;
    expect(
      acceptedDistinctFeatures.result?.isError,
      JSON.stringify(acceptedDistinctFeatures),
    ).not.toBe(true);

    const unknownCategoryByField: Record<
      (typeof rubricReasonFields)[number],
      "unknown" | "unclear"
    > = {
      externalShockPlausibility: "unknown",
      populationApplicability: "unknown",
      outcomePathway: "unclear",
      exposureObservability: "unknown",
      timeSupport: "unknown",
      variation: "unknown",
    };
    for (const [index, field] of rubricReasonFields.entries()) {
      const nonActionableUnknown = hostAiProposal(
        `non-actionable-unknown-${field}`,
      );
      const assessment = (
        nonActionableUnknown.assessments as Record<
          string,
          Record<string, unknown>
        >
      )[field]!;
      assessment.category = unknownCategoryByField[field];
      assessment.evidenceSourceIds = [];
      if (field === "populationApplicability") {
        assessment.sourceEstablishedPopulation = null;
      }
      assessment.unresolved = ["More checking may be needed later."];
      const rejectedUnknown = (await callTool(
        "assess_shock_options",
        {
          ...baseArguments,
          proposals: [nonActionableUnknown],
        },
        38538 + index,
      )) as Screen02ToolPayload;
      expect(rejectedUnknown.result?.isError).toBe(true);
      expect(JSON.stringify(rejectedUnknown)).toMatch(
        /must include a concrete verification task/i,
      );
    }

    // Both valid controls deliberately keep the same published ordinal
    // categories. Candidate-specific evidence and reasoning—not forced label
    // diversity—is the contract under test.
    const validSameCategoryA = hostAiProposal("verdant-metering-rule");
    const validSameCategoryB = hostAiProposal("indigo-ledger-rule");
    const acceptedSameCategories = (await callTool(
      "assess_shock_options",
      {
        ...baseArguments,
        proposals: [validSameCategoryA, validSameCategoryB],
      },
      38527,
    )) as Screen02ToolPayload;
    expect(
      acceptedSameCategories.result?.isError,
      JSON.stringify(acceptedSameCategories),
    ).not.toBe(true);
  });

  it("rejects an exhausted search-round ledger before invoking a connector", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      385,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial?.interaction?.searchRounds?.[0]) {
      throw new Error("Screen 2 did not open with an initial round.");
    }
    const initialRound = initial.interaction.searchRounds[0];
    const exhausted = {
      ...initial,
      revision: SCREEN_02_MAX_SEARCH_ROUNDS - 1,
      interaction: {
        ...initial.interaction,
        searchRounds: Array.from(
          { length: SCREEN_02_MAX_SEARCH_ROUNDS },
          (_, index) => ({
            ...initialRound,
            id: `round-${String(index).padStart(3, "0")}`,
            revision: index,
          }),
        ),
      },
    };
    let connectorCalls = 0;
    const payload = (await callTool(
      "discover_shock_options",
      {
        session: exhausted,
        expectedRevision: SCREEN_02_MAX_SEARCH_ROUNDS - 1,
        requestType: "find-more",
        exactRequest:
          "A search beyond eight complete native-plus-AI pairs must be rejected.",
      },
      386,
      {
        ...env,
        CONNECTOR_FETCH: async () => {
          connectorCalls += 1;
          throw new Error("An exhausted ledger must not fetch.");
        },
      },
    )) as Screen02ToolPayload;

    expect(
      payload.result?.isError === true || Boolean(payload.error),
    ).toBe(true);
    expect(connectorCalls).toBe(0);
  });

  it("rejects an incomplete AI-interpreted proposal at the public tool boundary", async () => {
    const studyContext = confirmedFindContext();
    const payload = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        proposals: [
          {
            id: "incomplete-public-ai-review",
            mode: "find",
            kind: "event",
            title: "Incomplete public AI review",
            description:
              "A source-backed proposal missing the variation assessment.",
            event: {
              displayName: "Incomplete Public AI Review Rule",
              eventDate: "2019-07-01",
              eventFamily: "Regulation",
              geographies: ["United States"],
              populations: [
                "U.S. exchange-listed manufacturing firms",
              ],
            },
            origin: "newly-discovered",
            provisionalDates: ["2019-07-01"],
            affectedPopulation:
              "U.S. exchange-listed manufacturing firms",
            requiredVariables: ["Rule coverage indicator"],
            outcomeLink: {
              text:
                "AI hypothesis: regulatory exposure could affect profitability.",
              status: "ai-hypothesis",
            },
            likelyServiceLevel: "assisted-audit",
            limitations: ["Variation remains unevaluated."],
            reasons: ["Public AI-completeness contract test."],
            sources: [
              {
                id: "incomplete-ai-source",
                title: "Official rule record",
                locator: "https://agency.example/incomplete-ai-rule",
                publisher: "Example Agency",
                publishedDate: "2019-07-01",
                authorityTier: 1,
                channel: "official register",
              },
            ],
            assessments: {
              exposureObservability: {
                category: "observable-with-linkage",
                method: "ai-rubric",
                evidenceSourceIds: ["incomplete-ai-source"],
                reason: "The rule identifies potentially covered firms.",
              },
              timeSupport: {
                category: "adequate",
                method: "ai-rubric",
                evidenceSourceIds: ["incomplete-ai-source"],
                reason: "The rule supplies a bounded effective date.",
              },
            },
          },
        ],
        interpretationSource: "ai-interpretation",
      },
      387,
    )) as Screen02ToolPayload;

    expect(
      payload.result?.isError === true || Boolean(payload.error),
    ).toBe(true);
    expect(payload.result?.structuredContent).toBeUndefined();
  });

  it("appends assess_shock_options to a supplied session instead of replacing its ledger", async () => {
    const studyContext = confirmedFindContext();
    const opened = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      39,
    )) as Screen02ToolPayload;
    const initial = screen02SessionFromPayload(opened);
    if (!initial) throw new Error("Screen 2 did not open.");
    const payload = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        session: initial,
        expectedRevision: 0,
        requestType: "refine",
        exactRequest: "Record my refinement without new proposals.",
        proposals: [],
      },
      40,
    )) as Screen02ToolPayload;
    const session = screen02SessionFromPayload(payload);

    expect(payload.result?.isError).not.toBe(true);
    expect(session?.revision).toBe(1);
    expect(session?.items).toStrictEqual(initial.items);
    expect(session?.interaction?.searchRounds).toHaveLength(2);
    expect(session?.screen01Baseline).toStrictEqual(studyContext);
  });

  it("rejects arbitrary AI numeric scores at the public assessment boundary", async () => {
    const studyContext = confirmedFindContext();
    const payload = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        proposals: [
          {
            id: "numeric-ai-score",
            mode: "find",
            kind: "event",
            title: "Numeric AI score proposal",
            description:
              "A proposal used to verify the public rubric contract.",
            event: {
              displayName: "Numeric AI Score Rule",
              eventDate: "2019-01-01",
              eventFamily: "Regulation",
              geographies: ["United States"],
              populations: [
                "U.S. exchange-listed manufacturing firms",
              ],
            },
            origin: "user-provided",
            provisionalDates: ["2019-01-01"],
            affectedPopulation:
              "U.S. exchange-listed manufacturing firms",
            requiredVariables: ["Rule coverage indicator"],
            outcomeLink: {
              text: "AI hypothesis: exposure could affect profitability.",
              status: "ai-hypothesis",
            },
            likelyServiceLevel: "event-reconnaissance",
            limitations: ["The proposal is not independently verified."],
            reasons: ["Public-schema scoring contract test."],
            sources: [],
            assessments: {
              exposureObservability: {
                method: "ai-rubric",
                value: 78,
                reason:
                  "An AI assessment cannot invent an arbitrary numeric value.",
              },
            },
          },
        ],
      },
      41,
    )) as Screen02ToolPayload;

    expect(
      payload.result?.isError === true || Boolean(payload.error),
    ).toBe(true);
    expect(payload.result?.structuredContent).toBeUndefined();
  });

  it("rejects an unconfirmed Screen 1 context instead of creating a Screen 2 session", async () => {
    const studyContext = {
      ...confirmedAuditContext(),
      confirmed: false,
      readyForLaterScreens: false,
    };
    const payload = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      4,
    )) as Screen02ToolPayload;

    expect(
      payload.result?.isError === true || Boolean(payload.error),
    ).toBe(true);
    expect(payload.result?.structuredContent).toBeUndefined();
  });

  it("rejects extra baseline properties instead of stripping or rewriting them at the boundary", async () => {
    const studyContext = {
      ...confirmedAuditContext(),
      screen02Guess: "must not be folded into Screen 1",
    };
    const payload = (await callTool(
      "open_shockaudit_screen_2",
      { studyContext },
      5,
    )) as Screen02ToolPayload;

    expect(
      payload.result?.isError === true || Boolean(payload.error),
    ).toBe(true);
    expect(payload.result?.structuredContent).toBeUndefined();
  });

  it("rejects proposal collections beyond the bounded public tool schema", async () => {
    const studyContext = confirmedFindContext();
    const proposal = {
      id: "bounded-proposal",
      mode: "find",
      kind: "event",
      title: "Bounded proposal",
      description: "A proposal used to test the public schema limit.",
      event: {
        displayName: "Bounded event",
        eventDate: "2019-01-01",
        eventFamily: "Regulation",
        geographies: ["United States"],
        populations: ["U.S. exchange-listed manufacturing firms"],
      },
      sources: [],
    };
    const payload = (await callTool(
      "assess_shock_options",
      {
        studyContext,
        proposals: Array.from({ length: 41 }, (_, index) => ({
          ...proposal,
          id: `bounded-proposal-${index}`,
        })),
      },
      6,
    )) as Screen02ToolPayload;

    expect(
      payload.result?.isError === true || Boolean(payload.error),
    ).toBe(true);
    expect(payload.result?.structuredContent).toBeUndefined();
  });
});
