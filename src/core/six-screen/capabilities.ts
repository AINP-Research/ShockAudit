import { requireCanonicalInstant } from "./contracts";

export const SOURCE_CAPABILITY_STATUSES = [
  "not_configured",
  "configured_not_tested",
  "enabled_not_tested",
  "healthy",
  "degraded",
  "quota_exhausted",
  "policy_blocked",
  "unsupported_for_request",
] as const;

export type SourceCapabilityStatus =
  (typeof SOURCE_CAPABILITY_STATUSES)[number];

export type SourceCapability = {
  provider: string;
  adapterVersion: string;
  implemented: boolean;
  configured: boolean;
  tested: boolean;
  enabled: boolean;
  status: SourceCapabilityStatus;
  permittedHosts: string[];
  jurisdictions: string[];
  languages: string[];
  documentFamilies: string[];
  historicalCoverage: string;
  authentication: "none" | "server_secret" | "unsupported";
  operations: {
    resolveIdentity: boolean;
    searchRecords: boolean;
    getRecord: boolean;
    listRepresentations: boolean;
    fetchRepresentation: boolean;
  };
  supportedFormats: string[];
  ratePolicy: string;
  lastHarmlessProbe: null | {
    at: string;
    endpoint: string;
    outcome: "success" | "auth_required" | "rate_limited" | "failure";
    httpStatus: number | null;
    note: string;
  };
  limitation: string | null;
};

const hostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/u;

export function validateSourceCapability(capability: SourceCapability) {
  if (!capability.provider.trim() || !capability.adapterVersion.trim()) {
    throw new Error("Source capability requires provider and adapter version.");
  }
  for (const host of capability.permittedHosts) {
    if (!hostnamePattern.test(host)) {
      throw new Error(`Source capability contains invalid permitted host ${host}.`);
    }
  }
  if (capability.status === "not_configured" && capability.configured) {
    throw new Error("A configured source cannot have not_configured status.");
  }
  if (capability.status === "healthy" && (!capability.tested || !capability.enabled)) {
    throw new Error("A healthy source must be tested and enabled.");
  }
  if (capability.status === "configured_not_tested" && capability.enabled) {
    throw new Error("A configured but untested source cannot be enabled.");
  }
  if (capability.enabled && !capability.implemented) {
    throw new Error("An unimplemented source cannot be enabled.");
  }
  if (capability.tested && capability.lastHarmlessProbe === null) {
    throw new Error("A tested source capability requires a harmless probe record.");
  }
  if (capability.lastHarmlessProbe) {
    requireCanonicalInstant(
      capability.lastHarmlessProbe.at,
      `${capability.provider} probe time`,
    );
    const url = new URL(capability.lastHarmlessProbe.endpoint);
    if (!capability.permittedHosts.includes(url.hostname)) {
      throw new Error("Source capability probe endpoint is outside permitted hosts.");
    }
    for (const key of url.searchParams.keys()) {
      if (/^(?:api[_-]?key|key|token|access[_-]?token)$/iu.test(key)) {
        throw new Error("Source capability probe endpoint must be sanitized.");
      }
    }
  }
  return capability;
}

export function sourceCapabilityForRequest(
  capability: SourceCapability,
  input: { jurisdiction: string; documentFamily: string; language: string },
) {
  validateSourceCapability(capability);
  const supports =
    capability.jurisdictions.includes(input.jurisdiction) &&
    capability.documentFamilies.includes(input.documentFamily) &&
    capability.languages.includes(input.language);
  return supports
    ? capability
    : {
        ...capability,
        enabled: false,
        status: "unsupported_for_request" as const,
        limitation:
          `The adapter does not declare ${input.jurisdiction}, ${input.documentFamily}, ${input.language}.`,
      };
}

export const INTELLIGENCE_TASK_KINDS = [
  "identity_wording",
  "policy_fact_extraction",
  "policy_overview",
  "design_option_explanation",
  "coevent_relation",
  "mechanism_proposal",
  "prediction_comparison",
  "diagnostic_explanation",
] as const;

export type IntelligenceTaskKind = (typeof INTELLIGENCE_TASK_KINDS)[number];
export type IntelligenceMode = "disabled" | "host_verified" | "backend_approved";

export type IntelligenceCapability = {
  mode: IntelligenceMode;
  provider: string | null;
  providerVersion: string | null;
  verifiedTaskKinds: IntelligenceTaskKind[];
  maximumInputTokens: number;
  maximumOutputTokens: number;
  maximumTimeMs: number;
  maximumRepairAttempts: 0 | 1;
  actualSignedInProof: boolean;
  testedAt: string | null;
  blocker: null | {
    stage:
      | "task_preparation"
      | "host_delivery"
      | "model_submission"
      | "validation"
      | "persistence"
      | "panel_reconciliation"
      | "authorization";
    code: string;
    explanation: string;
  };
};

export function validateIntelligenceCapability(
  capability: IntelligenceCapability,
) {
  if (capability.mode === "disabled") {
    if (capability.actualSignedInProof || capability.verifiedTaskKinds.length) {
      throw new Error("Disabled intelligence cannot advertise verified task kinds.");
    }
  } else if (!capability.actualSignedInProof || !capability.testedAt) {
    throw new Error("Enabled intelligence requires an actual signed-in round-trip proof.");
  }
  if (capability.testedAt) {
    requireCanonicalInstant(capability.testedAt, "Intelligence testedAt");
  }
  if (capability.maximumRepairAttempts > 1) {
    throw new Error("Intelligence permits at most one bounded repair attempt.");
  }
  return capability;
}

export type IntelligenceTask<Input, Output> = {
  taskId: string;
  kind: IntelligenceTaskKind;
  input: Input;
  inputSchemaVersion: string;
  evidenceSnapshotId: string;
  evidenceSnapshotFingerprint: string;
  allowedSourceIds: string[];
  outputSchemaVersion: string;
  parentRevision: number;
  requestFingerprint: string;
};

export type IntelligenceResult<Output> = {
  taskId: string;
  output: Output;
  outputSchemaVersion: string;
  parentRevision: number;
  evidenceSnapshotFingerprint: string;
  citedSourceIds: string[];
};

export interface IntelligenceProvider {
  readonly capability: IntelligenceCapability;
  run<Input, Output>(
    task: IntelligenceTask<Input, Output>,
    signal: AbortSignal,
  ): Promise<IntelligenceResult<Output>>;
  cancel(taskId: string): Promise<void>;
}

export function validateIntelligenceResult<Output>(input: {
  task: IntelligenceTask<unknown, Output>;
  result: IntelligenceResult<Output>;
  currentParentRevision: number;
}) {
  const { task, result } = input;
  if (
    result.taskId !== task.taskId ||
    result.outputSchemaVersion !== task.outputSchemaVersion ||
    result.parentRevision !== task.parentRevision ||
    input.currentParentRevision !== task.parentRevision ||
    result.evidenceSnapshotFingerprint !== task.evidenceSnapshotFingerprint
  ) {
    throw new Error("Intelligence result does not match its frozen task coordinates.");
  }
  const allowed = new Set(task.allowedSourceIds);
  if (result.citedSourceIds.some((id) => !allowed.has(id))) {
    throw new Error("Intelligence result cites a source outside its frozen evidence packet.");
  }
  return result;
}
