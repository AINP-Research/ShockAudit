import { HOST_REASONING_TASK_TYPES } from
  "../core/host-reasoning-task";
import { SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_MAX_BYTES } from
  "../core/six-screen/policy-event-card-review";
import { SIX_SCREEN_RESEARCH_PROFILES } from
  "../core/six-screen/research-task";
import { SOURCE_CAPABILITY_STATUSES } from
  "../core/six-screen/capabilities";
import { MAX_MCP_BODY_BYTES } from "./mcp-limits";
import { SIX_SCREEN_EVIDENCE_CHUNK_MAX_BYTES } from
  "./six-screen-evidence-store";
import {
  SIX_SCREEN_SOURCE_REGISTER_VERSION,
  buildSixScreenSourceRegister,
  type SixScreenCapabilityProbe,
  type SixScreenSecretName,
  type SixScreenSourceId,
} from "./six-screen-source-register";

export const SIX_SCREEN_RUNTIME_CAPABILITY_REPORT_VERSION =
  "shockaudit-runtime-capabilities-v1" as const;
export const SIX_SCREEN_DECLARED_RESOURCE_PROFILE_VERSION =
  "six-screen-declared-resource-profile-v1" as const;
export const SIX_SCREEN_RUNTIME_CAPABILITY_REPORT_MAX_BYTES = 64 * 1024;

export type SixScreenRuntimeHostReasoningMode =
  | "experimental-off"
  | "app-only"
  | "screen02-only"
  | "full";

function configuredHostReasoningMode(
  value: SixScreenRuntimeHostReasoningMode | undefined,
) {
  return value === "app-only" || value === "screen02-only" || value === "full"
    ? value
    : "experimental-off";
}

function hostReasoningCapability(
  configured: SixScreenRuntimeHostReasoningMode | undefined,
) {
  const mode = configuredHostReasoningMode(configured);
  const modelCallable = mode === "screen02-only" || mode === "full";
  const availableTaskTypes = mode === "full"
    ? HOST_REASONING_TASK_TYPES.filter((taskType) =>
      taskType !== "screen05-theoretical-planning" &&
      taskType !== "screen05-study-mechanism-comparison"
    )
    : mode === "screen02-only"
      ? ["screen02-search-review" as const]
      : [];
  return {
    configuredMode: mode,
    exposure: modelCallable
      ? "model-callable-unverified" as const
      : mode === "app-only"
        ? "app-only-unverified" as const
        : "disabled" as const,
    modelCallable,
    actualSignedInProof: false,
    genuineTraceCount: 0,
    availableTaskTypes,
    blocker: {
      stage: "authorization" as const,
      code: "SIGNED_IN_ROUND_TRIP_NOT_RECORDED",
      explanation:
        "No genuine signed-in frozen-task, model-submission, validated-persistence, and same-panel reconciliation trace is recorded for this build.",
    },
  };
}

/**
 * Build the public operational capability report from booleans only. Raw
 * credentials are deliberately outside this function's input contract.
 */
export function buildSixScreenRuntimeCapabilityReport(input: {
  configuredSecrets?: Partial<Record<SixScreenSecretName, boolean>>;
  probes?: Partial<Record<SixScreenSourceId, SixScreenCapabilityProbe>>;
  hostReasoningMode?: SixScreenRuntimeHostReasoningMode;
} = {}) {
  const sources = buildSixScreenSourceRegister({
    configuredSecrets: input.configuredSecrets,
    probes: input.probes,
  });
  const statusCounts = Object.fromEntries(
    SOURCE_CAPABILITY_STATUSES.map((status) => [status, 0]),
  ) as Record<(typeof SOURCE_CAPABILITY_STATUSES)[number], number>;
  const enabledSourceIds: SixScreenSourceId[] = [];
  for (const [sourceId, capability] of Object.entries(sources) as Array<
    [SixScreenSourceId, (typeof sources)[SixScreenSourceId]]
  >) {
    statusCounts[capability.status] += 1;
    if (capability.enabled) enabledSourceIds.push(sourceId);
  }
  enabledSourceIds.sort();
  const report = {
    schemaVersion: SIX_SCREEN_RUNTIME_CAPABILITY_REPORT_VERSION,
    sourceRegister: {
      schemaVersion: SIX_SCREEN_SOURCE_REGISTER_VERSION,
      sourceCount: Object.keys(sources).length,
      enabledSourceIds,
      statusCounts,
      entries: structuredClone(sources),
    },
    intelligence: hostReasoningCapability(input.hostReasoningMode),
    declaredResources: {
      schemaVersion: SIX_SCREEN_DECLARED_RESOURCE_PROFILE_VERSION,
      measurementStatus: "declared_not_deployed_measurement" as const,
      mcpRequestMaxBytes: MAX_MCP_BODY_BYTES,
      evidenceChunkMaxBytes: SIX_SCREEN_EVIDENCE_CHUNK_MAX_BYTES,
      policyEventCardReviewMaxBytes:
        SIX_SCREEN_POLICY_EVENT_CARD_REVIEW_MAX_BYTES,
      researchProfileVersion: "six-screen-research-profiles-v1" as const,
      researchProfiles: structuredClone(SIX_SCREEN_RESEARCH_PROFILES),
    },
  };
  if (
    new TextEncoder().encode(JSON.stringify(report)).byteLength >
      SIX_SCREEN_RUNTIME_CAPABILITY_REPORT_MAX_BYTES
  ) {
    throw new Error("Runtime capability report exceeds its public size limit.");
  }
  return report;
}
