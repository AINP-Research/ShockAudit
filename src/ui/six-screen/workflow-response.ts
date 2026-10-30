import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
  serializeSixScreenValue,
} from "../../core/six-screen/canonical";
import { SIX_SCREEN_WORKFLOW_SCHEMA_VERSION } from
  "../../core/six-screen/contracts";
import {
  SIX_SCREEN_WORKFLOW_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
} from "../../core/six-screen/metadata-keys";
import {
  SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
  SIX_SCREEN_WORKFLOW_RESPONSE_CONTRACT_VERSION,
  SIX_SCREEN_WORKFLOW_STATE_ENCODING,
  SIX_SCREEN_HYDRATED_STATE_PAYLOAD_META_KEY,
  SIX_SCREEN_MAX_STATE_CHUNKS,
  SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
  SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
  SIX_SCREEN_STATE_CHUNK_BYTES,
  decodeSixScreenWorkflowPayload,
  sixScreenWorkflowStateTransferId,
  sixScreenWorkflowResponseContractBody,
  type SixScreenWorkflowResponseOperationBinding,
  type SixScreenWorkflowResponseContract,
} from "../../core/six-screen/workflow-response-contract";
import {
  SHOCKAUDIT_VERSION,
  SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
} from "../../version";
import type {
  SixScreenWorkflowPrivateSnapshot,
  SixScreenWorkflowPublicProjection,
} from
  "../../worker/six-screen-workflow-runtime";

const PRIVATE_SCHEMA_VERSION = "shockaudit-six-screen-private-v1";
const PUBLIC_SCHEMA_VERSION = "shockaudit-six-screen-public-v1";
const RUN_ID_PATTERN = /^sa6r_[A-Za-z0-9_-]{43}$/u;
const ACCESS_TOKEN_PATTERN = /^sa6a_[A-Za-z0-9_-]{43}$/u;
const FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/u;
const MAX_CANONICAL_STATE_BYTES = SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES;
const MAX_CANONICAL_PUBLIC_PROJECTION_BYTES =
  SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES;
const MAX_ENCODED_STATE_BYTES = SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES;
const MAX_ENCODED_PUBLIC_PROJECTION_BYTES =
  SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES;
const MAX_SHAPE_DIFFERENCES = 16;

export type SixScreenWorkflowResponseTrace = {
  toolName: string;
  bridgePath: "mcp-app" | "chatgpt-compatibility";
  metadataKeys: string[];
  structuredContentKeys: string[];
};

export type SixScreenWorkflowResponseDiagnostic = {
  diagnosticVersion: "shockaudit-six-screen-response-diagnostic-v2";
  failure: string;
  operationStage: string;
  toolName: string;
  bridgePath: string;
  expectedBuildId: string;
  receivedBuildId: string | null;
  appVersion: { expected: string; received: string | null };
  uiResourceUri: { expected: string; received: string | null };
  schemas: {
    response: string | null;
    public: string | null;
    private: string | null;
    state: string | null;
  };
  comparisons: Record<string, boolean | null>;
  revisions: {
    contract: number | null;
    wrapper: number | null;
    state: number | null;
    public: number | null;
    receivedPublic: number | null;
  };
  fingerprints: {
    contract: string | null;
    calculatedState: string | null;
    wrapper: string | null;
    public: string | null;
    calculatedPublic: string | null;
    receivedPublic: string | null;
    response: string | null;
    calculatedResponse: string | null;
  };
  runReferences: {
    contract: string | null;
    wrapper: string | null;
    state: string | null;
    public: string | null;
    receivedPublic: string | null;
  };
  shape: {
    metadataKeys: string[];
    structuredContentKeys: string[];
    wrapperStateKind: string;
    canonicalStateKind: string;
    receivedPublicKind: string;
    canonicalPublicKind: string;
    differences: string[];
    publicDifferences: string[];
  };
};

export class SixScreenWorkflowResponseError extends Error {
  readonly code: string;
  readonly reference: string;
  readonly diagnostic: SixScreenWorkflowResponseDiagnostic;

  constructor(
    code: string,
    publicMessage: string,
    diagnostic: SixScreenWorkflowResponseDiagnostic,
  ) {
    super(publicMessage);
    this.name = "SixScreenWorkflowResponseError";
    this.code = code;
    this.diagnostic = diagnostic;
    this.reference = fingerprintSixScreenValue({
      code,
      diagnostic,
    }).slice(-8).toUpperCase();
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function kind(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function diagnosticLabel(value: unknown, maxLength = 200) {
  if (typeof value !== "string") return null;
  const bounded = value
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .trim()
    .slice(0, maxLength);
  return /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/u.test(bounded)
    ? bounded
    : `[invalid:${fingerprintSixScreenValue(value).slice(-8)}]`;
}

function diagnosticKey(value: string) {
  return diagnosticLabel(value, 96) ?? "[invalid-key]";
}

function safeFingerprint(value: unknown) {
  try {
    return fingerprintSixScreenValue(value);
  } catch {
    return null;
  }
}

function runReference(value: unknown) {
  return typeof value === "string"
    ? fingerprintSixScreenValue(value)
    : null;
}

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function shapeDifferences(
  expected: unknown,
  received: unknown,
  path = "state",
  differences: string[] = [],
  depth = 0,
) {
  if (differences.length >= MAX_SHAPE_DIFFERENCES) return differences;
  const expectedKind = kind(expected);
  const receivedKind = kind(received);
  if (expectedKind !== receivedKind) {
    differences.push(`${path}: ${receivedKind} received; ${expectedKind} expected`);
    return differences;
  }
  if (Array.isArray(expected) && Array.isArray(received)) {
    if (expected.length !== received.length) {
      differences.push(
        `${path}: array length ${received.length} received; ${expected.length} expected`,
      );
    }
    if (depth >= 3) return differences;
    for (let index = 0;
      index < Math.min(expected.length, received.length) &&
      differences.length < MAX_SHAPE_DIFFERENCES;
      index += 1) {
      shapeDifferences(
        expected[index],
        received[index],
        `${path}[${index}]`,
        differences,
        depth + 1,
      );
    }
    return differences;
  }
  const expectedRecord = record(expected);
  const receivedRecord = record(received);
  if (!expectedRecord || !receivedRecord) {
    if (!Object.is(expected, received)) {
      differences.push(`${path}: ${receivedKind} value differs`);
    }
    return differences;
  }
  if (depth >= 3) return differences;
  const expectedKeys = new Set(Object.keys(expectedRecord));
  const receivedKeys = new Set(Object.keys(receivedRecord));
  for (const key of expectedKeys) {
    if (!receivedKeys.has(key)) {
      differences.push(`${path}.${diagnosticKey(key)}: missing key`);
    }
    if (differences.length >= MAX_SHAPE_DIFFERENCES) return differences;
  }
  for (const key of receivedKeys) {
    if (!expectedKeys.has(key)) {
      differences.push(`${path}.${diagnosticKey(key)}: unexpected key`);
    }
    if (differences.length >= MAX_SHAPE_DIFFERENCES) return differences;
  }
  for (const key of expectedKeys) {
    if (!receivedKeys.has(key)) continue;
    shapeDifferences(
      expectedRecord[key],
      receivedRecord[key],
      `${path}.${diagnosticKey(key)}`,
      differences,
      depth + 1,
    );
    if (differences.length >= MAX_SHAPE_DIFFERENCES) return differences;
  }
  return differences;
}

function contractRecord(
  value: unknown,
): SixScreenWorkflowResponseContract | null {
  const candidate = record(value);
  if (!candidate) return null;
  return candidate as unknown as SixScreenWorkflowResponseContract;
}

function validOperationBinding(
  value: unknown,
): value is Exclude<SixScreenWorkflowResponseOperationBinding, null> {
  const binding = record(value);
  return Boolean(binding &&
    Object.keys(binding).length === 3 &&
    typeof binding.operationId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(binding.operationId) &&
    typeof binding.operationKind === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(binding.operationKind) &&
    typeof binding.requestFingerprint === "string" &&
    FINGERPRINT_PATTERN.test(binding.requestFingerprint));
}

function privateSnapshotRecord(value: unknown) {
  const candidate = record(value);
  if (!candidate) return null;
  return candidate;
}

function diagnostic(input: {
  failure: string;
  trace: SixScreenWorkflowResponseTrace;
  contract: SixScreenWorkflowResponseContract | null;
  wrapper: Record<string, unknown> | null;
  canonicalState: unknown;
  projection: unknown;
  canonicalProjection?: unknown;
  comparisons: Record<string, boolean | null>;
  calculatedResponseFingerprint?: string | null;
}) : SixScreenWorkflowResponseDiagnostic {
  const contract = input.contract;
  const wrapperState = input.wrapper?.state;
  const canonicalStateRecord = record(input.canonicalState);
  const receivedProjectionRecord = record(input.projection);
  const canonicalProjection = input.canonicalProjection ?? null;
  const canonicalProjectionRecord = record(canonicalProjection);
  return {
    diagnosticVersion: "shockaudit-six-screen-response-diagnostic-v2",
    failure: input.failure,
    operationStage: diagnosticLabel(contract?.operationStage, 120) ?? "unknown",
    toolName: diagnosticLabel(contract?.toolName, 120) ??
      diagnosticLabel(input.trace.toolName, 120) ?? "unknown",
    bridgePath: input.trace.bridgePath,
    expectedBuildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
    receivedBuildId: diagnosticLabel(contract?.buildId),
    appVersion: {
      expected: SHOCKAUDIT_VERSION,
      received: diagnosticLabel(contract?.appVersion),
    },
    uiResourceUri: {
      expected: SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
      received: diagnosticLabel(contract?.uiResourceUri),
    },
    schemas: {
      response: diagnosticLabel(contract?.schemaVersion),
      public: diagnosticLabel(contract?.publicSchemaVersion),
      private: diagnosticLabel(input.wrapper?.schemaVersion),
      state: diagnosticLabel(canonicalStateRecord?.schemaVersion),
    },
    comparisons: input.comparisons,
    revisions: {
      contract: Number.isSafeInteger(contract?.revision)
        ? contract!.revision
        : null,
      wrapper: Number.isSafeInteger(input.wrapper?.revision)
        ? Number(input.wrapper!.revision)
        : null,
      state: Number.isSafeInteger(canonicalStateRecord?.revision)
        ? Number(canonicalStateRecord!.revision)
        : null,
      public: Number.isSafeInteger(canonicalProjectionRecord?.revision)
        ? Number(canonicalProjectionRecord!.revision)
        : null,
      receivedPublic: Number.isSafeInteger(receivedProjectionRecord?.revision)
        ? Number(receivedProjectionRecord!.revision)
        : null,
    },
    fingerprints: {
      contract: typeof contract?.stateFingerprint === "string"
        ? contract.stateFingerprint
        : null,
      calculatedState: safeFingerprint(input.canonicalState),
      wrapper: typeof input.wrapper?.stateFingerprint === "string"
        ? input.wrapper.stateFingerprint
        : null,
      public: typeof contract?.publicProjectionFingerprint === "string"
        ? contract.publicProjectionFingerprint
        : null,
      calculatedPublic: safeFingerprint(canonicalProjection),
      receivedPublic: safeFingerprint(input.projection),
      response: typeof contract?.responseFingerprint === "string"
        ? contract.responseFingerprint
        : null,
      calculatedResponse: input.calculatedResponseFingerprint ??
        (contract ? safeFingerprint(
          sixScreenWorkflowResponseContractBody(contract),
        ) : null),
    },
    runReferences: {
      contract: runReference(contract?.runId),
      wrapper: runReference(input.wrapper?.runId),
      state: runReference(canonicalStateRecord?.runId),
      public: runReference(canonicalProjectionRecord?.runId),
      receivedPublic: runReference(receivedProjectionRecord?.runId),
    },
    shape: {
      metadataKeys: [...input.trace.metadataKeys].sort().slice(0, 32)
        .map(diagnosticKey),
      structuredContentKeys:
        [...input.trace.structuredContentKeys].sort().slice(0, 64)
          .map(diagnosticKey),
      wrapperStateKind: kind(wrapperState),
      canonicalStateKind: kind(input.canonicalState),
      receivedPublicKind: kind(input.projection),
      canonicalPublicKind: kind(canonicalProjection),
      differences: shapeDifferences(
        input.canonicalState,
        wrapperState,
      ),
      publicDifferences: shapeDifferences(
        canonicalProjection,
        input.projection,
        "public",
      ),
    },
  };
}

function fail(input: Parameters<typeof diagnostic>[0] & {
  code: string;
  message: string;
}): never {
  throw new SixScreenWorkflowResponseError(
    input.code,
    input.message,
    diagnostic(input),
  );
}

export function restoreSixScreenWorkflowToolResponse(input: {
  structuredContent: unknown;
  metadata: Record<string, unknown>;
  trace: SixScreenWorkflowResponseTrace;
  expectedOperationBinding?: SixScreenWorkflowResponseOperationBinding;
}) {
  const projection = record(input.structuredContent);
  const wrapper = privateSnapshotRecord(
    input.metadata[SIX_SCREEN_WORKFLOW_META_KEY],
  );
  const contract = contractRecord(
    input.metadata[SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY],
  );
  const comparisons: Record<string, boolean | null> = {};
  if (!wrapper) {
    fail({
      code: "private_snapshot_missing",
      message:
        "ShockAudit rejected a workflow result that omitted its authenticated private snapshot.",
      failure: "private snapshot missing or not an object",
      trace: input.trace,
      contract,
      wrapper,
      canonicalState: null,
      projection,
      comparisons,
    });
  }
  if (!contract) {
    fail({
      code: "response_contract_missing",
      message:
        "ShockAudit rejected a workflow result from an unpaired server build. Refresh the Local Preview metadata before retrying.",
      failure: "versioned response contract missing or not an object",
      trace: input.trace,
      contract,
      wrapper,
      canonicalState: null,
      projection,
      comparisons,
    });
  }
  const contractShapeValid =
    contract.schemaVersion === SIX_SCREEN_WORKFLOW_RESPONSE_CONTRACT_VERSION &&
    contract.buildId === SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID &&
    contract.appVersion === SHOCKAUDIT_VERSION &&
    contract.uiResourceUri === SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI &&
    contract.privateSchemaVersion === PRIVATE_SCHEMA_VERSION &&
    contract.publicSchemaVersion === PUBLIC_SCHEMA_VERSION &&
    contract.stateSchemaVersion === SIX_SCREEN_WORKFLOW_SCHEMA_VERSION &&
    contract.stateEncoding === SIX_SCREEN_WORKFLOW_STATE_ENCODING &&
    contract.publicProjectionEncoding ===
      SIX_SCREEN_WORKFLOW_STATE_ENCODING &&
    (contract.operationBinding === undefined ||
      validOperationBinding(contract.operationBinding)) &&
    typeof contract.operationStage === "string" &&
    contract.operationStage.length > 0 &&
    contract.operationStage.length <= 120 &&
    typeof contract.toolName === "string" &&
    contract.toolName === input.trace.toolName &&
    typeof contract.runId === "string" &&
    RUN_ID_PATTERN.test(contract.runId) &&
    Number.isSafeInteger(contract.revision) && contract.revision >= 0 &&
    typeof contract.stateFingerprint === "string" &&
    FINGERPRINT_PATTERN.test(contract.stateFingerprint) &&
    typeof contract.publicProjectionFingerprint === "string" &&
    FINGERPRINT_PATTERN.test(contract.publicProjectionFingerprint) &&
    typeof contract.encodedPublicProjectionPayload === "string" &&
    Number.isSafeInteger(contract.encodedPublicProjectionBytes) &&
    contract.encodedPublicProjectionBytes >= 4 &&
    contract.encodedPublicProjectionBytes <=
      MAX_ENCODED_PUBLIC_PROJECTION_BYTES &&
    Number.isSafeInteger(contract.canonicalPublicProjectionBytes) &&
    contract.canonicalPublicProjectionBytes >= 2 &&
    contract.canonicalPublicProjectionBytes <=
      MAX_CANONICAL_PUBLIC_PROJECTION_BYTES &&
    typeof contract.encodedStatePayload === "string" &&
    (contract.statePayloadMode === "inline" ||
      contract.statePayloadMode === "chunked") &&
    Number.isSafeInteger(contract.encodedStateBytes) &&
    contract.encodedStateBytes >= 4 &&
    contract.encodedStateBytes <= MAX_ENCODED_STATE_BYTES &&
    Number.isSafeInteger(contract.canonicalStateBytes) &&
    contract.canonicalStateBytes >= 2 &&
    contract.canonicalStateBytes <= MAX_CANONICAL_STATE_BYTES &&
    contract.stateChunkBytes === SIX_SCREEN_STATE_CHUNK_BYTES &&
    Number.isSafeInteger(contract.stateChunkCount) &&
    contract.stateChunkCount >= 0 &&
    contract.stateChunkCount <= SIX_SCREEN_MAX_STATE_CHUNKS &&
    typeof contract.stateTransferId === "string" &&
    FINGERPRINT_PATTERN.test(contract.stateTransferId) &&
    contract.stateTransferId === sixScreenWorkflowStateTransferId({
      runId: contract.runId,
      revision: contract.revision,
      stateFingerprint: contract.stateFingerprint,
      encodedStateBytes: contract.encodedStateBytes,
      canonicalStateBytes: contract.canonicalStateBytes,
    }) &&
    (contract.statePayloadMode === "inline"
      ? contract.stateChunkCount === 0 &&
        utf8Bytes(contract.encodedStatePayload) === contract.encodedStateBytes
      : contract.encodedStatePayload === "" &&
        contract.stateChunkCount === Math.ceil(
          contract.encodedStateBytes / contract.stateChunkBytes,
        )) &&
    typeof contract.responseFingerprint === "string" &&
    FINGERPRINT_PATTERN.test(contract.responseFingerprint);
  comparisons.contractShapeValid = contractShapeValid;
  if (!contractShapeValid) {
    fail({
      code: "response_contract_version",
      message:
        "ShockAudit rejected a workflow result from a different UI or server contract. Refresh the Local Preview metadata before retrying.",
      failure: "response build, schema, tool, or bounded field mismatch",
      trace: input.trace,
      contract,
      wrapper,
      canonicalState: null,
      projection,
      comparisons,
    });
  }
  comparisons.operationBindingMatchesExpected =
    input.expectedOperationBinding === undefined
      ? null
      : sameSixScreenValue(
          contract.operationBinding ?? null,
          input.expectedOperationBinding,
        );
  if (comparisons.operationBindingMatchesExpected === false) {
    fail({
      code: "operation_binding",
      message:
        "ShockAudit rejected a workflow result bound to a different operation or submitted input.",
      failure: "operation binding mismatch",
      trace: input.trace,
      contract,
      wrapper,
      canonicalState: null,
      projection,
      comparisons,
    });
  }
  const calculatedResponseFingerprint = fingerprintSixScreenValue(
    sixScreenWorkflowResponseContractBody(contract),
  );
  comparisons.responseFingerprintEqual =
    contract.responseFingerprint === calculatedResponseFingerprint;
  if (!comparisons.responseFingerprintEqual) {
    fail({
      code: "response_fingerprint",
      message:
        "ShockAudit rejected a workflow result whose response envelope changed in transit.",
      failure: "response envelope fingerprint mismatch",
      trace: input.trace,
      contract,
      wrapper,
      canonicalState: null,
      projection,
      comparisons,
      calculatedResponseFingerprint,
    });
  }
  let canonicalState: unknown = null;
  let canonicalStatePayload: string | null = null;
  const transferredStatePayload = contract.statePayloadMode === "inline"
    ? contract.encodedStatePayload
    : input.metadata[SIX_SCREEN_HYDRATED_STATE_PAYLOAD_META_KEY];
  try {
    canonicalStatePayload = decodeSixScreenWorkflowPayload({
      encodedPayload: typeof transferredStatePayload === "string"
        ? transferredStatePayload : "",
      encodedBytes: contract.encodedStateBytes,
      canonicalBytes: contract.canonicalStateBytes,
    });
    canonicalState = JSON.parse(canonicalStatePayload) as unknown;
  } catch {
    // The common failure path below emits only bounded shape diagnostics.
  }
  const canonicalStateRecord = record(canonicalState);
  comparisons.canonicalPayloadParsed = Boolean(canonicalStateRecord);
  comparisons.canonicalPayloadExact = Boolean(
    canonicalStateRecord &&
      serializeSixScreenValue(canonicalStateRecord) ===
        canonicalStatePayload &&
      canonicalStatePayload !== null &&
      utf8Bytes(canonicalStatePayload) ===
        contract.canonicalStateBytes,
  );
  if (!comparisons.canonicalPayloadExact) {
    fail({
      code: "state_payload",
      message:
        "ShockAudit rejected a workflow result whose canonical state payload was unreadable or noncanonical.",
      failure: "canonical state payload parse, encoding, or byte-length mismatch",
      trace: input.trace,
      contract,
      wrapper,
      canonicalState,
      projection,
      comparisons,
      calculatedResponseFingerprint,
    });
  }
  let canonicalProjection: unknown = null;
  let canonicalPublicProjectionPayload: string | null = null;
  try {
    canonicalPublicProjectionPayload = decodeSixScreenWorkflowPayload({
      encodedPayload: contract.encodedPublicProjectionPayload,
      encodedBytes: contract.encodedPublicProjectionBytes,
      canonicalBytes: contract.canonicalPublicProjectionBytes,
    });
    canonicalProjection = JSON.parse(canonicalPublicProjectionPayload) as unknown;
  } catch {
    // The common failure path below emits only bounded shape diagnostics.
  }
  const canonicalProjectionRecord = record(canonicalProjection);
  comparisons.canonicalPublicPayloadParsed = Boolean(
    canonicalProjectionRecord,
  );
  comparisons.canonicalPublicPayloadExact = Boolean(
    canonicalProjectionRecord &&
      serializeSixScreenValue(canonicalProjectionRecord) ===
        canonicalPublicProjectionPayload &&
      canonicalPublicProjectionPayload !== null &&
      utf8Bytes(canonicalPublicProjectionPayload) ===
        contract.canonicalPublicProjectionBytes,
  );
  if (!comparisons.canonicalPublicPayloadExact) {
    fail({
      code: "public_payload",
      message:
        "ShockAudit rejected a workflow result whose canonical public payload was unreadable or noncanonical.",
      failure:
        "canonical public payload parse, encoding, or byte-length mismatch",
      trace: input.trace,
      contract,
      wrapper,
      canonicalState,
      projection,
      canonicalProjection,
      comparisons,
      calculatedResponseFingerprint,
    });
  }
  const calculatedStateFingerprint = fingerprintSixScreenValue(canonicalState);
  const calculatedPublicFingerprint = fingerprintSixScreenValue(
    canonicalProjection,
  );
  comparisons.stateFingerprintEqual =
    contract.stateFingerprint === calculatedStateFingerprint;
  comparisons.publicFingerprintEqual =
    contract.publicProjectionFingerprint === calculatedPublicFingerprint;
  comparisons.receivedPublicFingerprintEqual =
    contract.publicProjectionFingerprint === safeFingerprint(projection);
  comparisons.contractRunEqualsStateRun =
    contract.runId === canonicalStateRecord!.runId;
  comparisons.contractRevisionEqualsStateRevision =
    contract.revision === canonicalStateRecord!.revision;
  comparisons.contractRunEqualsWrapperRun =
    contract.runId === wrapper.runId;
  comparisons.contractRevisionEqualsWrapperRevision =
    contract.revision === wrapper.revision;
  comparisons.contractFingerprintEqualsWrapperFingerprint =
    contract.stateFingerprint === wrapper.stateFingerprint;
  comparisons.contractRunEqualsPublicRun =
    contract.runId === canonicalProjectionRecord!.runId;
  comparisons.contractRevisionEqualsPublicRevision =
    contract.revision === canonicalProjectionRecord!.revision;
  comparisons.legacyStateMatchesCanonicalPayload = wrapper.state === undefined
    ? null
    : sameSixScreenValue(wrapper.state, canonicalState);
  // The host-delivered objects remain useful diagnostics, but the canonical
  // strings are authoritative because the real MCP App bridge elides nulls.
  comparisons.legacyPublicMatchesCanonicalPayload =
    sameSixScreenValue(projection, canonicalProjection);
  comparisons.receivedPublicRunEqualsCanonicalPublicRun =
    projection?.runId === canonicalProjectionRecord!.runId;
  comparisons.receivedPublicRevisionEqualsCanonicalPublicRevision =
    projection?.revision === canonicalProjectionRecord!.revision;
  const wrapperShapeValid =
    wrapper.schemaVersion === PRIVATE_SCHEMA_VERSION &&
    typeof wrapper.runId === "string" && RUN_ID_PATTERN.test(wrapper.runId) &&
    typeof wrapper.accessToken === "string" &&
    ACCESS_TOKEN_PATTERN.test(wrapper.accessToken) &&
    Number.isSafeInteger(wrapper.revision) &&
    typeof wrapper.stateFingerprint === "string" &&
    FINGERPRINT_PATTERN.test(wrapper.stateFingerprint);
  comparisons.wrapperShapeValid = wrapperShapeValid;
  const publicShapeValid = Boolean(
    canonicalProjectionRecord &&
      canonicalProjectionRecord.schemaVersion === PUBLIC_SCHEMA_VERSION,
  );
  comparisons.publicShapeValid = publicShapeValid;
  const failedCoordinate = !comparisons.stateFingerprintEqual
    ? "state_fingerprint"
    : !comparisons.contractRunEqualsStateRun
      ? "run_id"
      : !comparisons.contractRevisionEqualsStateRevision
        ? "revision"
        : !comparisons.contractRunEqualsWrapperRun
          ? "wrapper_run_id"
          : !comparisons.contractRevisionEqualsWrapperRevision
            ? "wrapper_revision"
            : !comparisons.contractFingerprintEqualsWrapperFingerprint
              ? "wrapper_state_fingerprint"
              : !comparisons.contractRunEqualsPublicRun
                ? "public_run_id"
                : !comparisons.contractRevisionEqualsPublicRevision
                  ? "public_revision"
                  : !comparisons.publicFingerprintEqual
                    ? "public_fingerprint"
                    : !wrapperShapeValid
                      ? "private_snapshot_shape"
                      : !publicShapeValid
                        ? "public_projection_shape"
                        : null;
  if (failedCoordinate) {
    const descriptions: Record<string, string> = {
      state_fingerprint:
        "its state fingerprint did not match the canonical serialized state",
      run_id: "its run ID did not match the canonical serialized state",
      revision: "its revision did not match the canonical serialized state",
      wrapper_run_id: "its private wrapper and response envelope used different run IDs",
      wrapper_revision:
        "its private wrapper and response envelope used different revisions",
      wrapper_state_fingerprint:
        "its private wrapper and response envelope used different state fingerprints",
      public_run_id: "its public and private run IDs differed",
      public_revision: "its public and private revisions differed",
      public_fingerprint:
        "its canonical public projection did not match its bound fingerprint",
      private_snapshot_shape: "its private snapshot shape was invalid",
      public_projection_shape: "its public projection shape was invalid",
    };
    fail({
      code: failedCoordinate,
      message:
        `ShockAudit rejected a workflow result because ${descriptions[failedCoordinate]}. The action may already be saved; do not repeat it until the Local Preview is refreshed and the response build is reconciled.`,
      failure: failedCoordinate,
      trace: input.trace,
      contract,
      wrapper,
      canonicalState,
      projection,
      canonicalProjection,
      comparisons,
      calculatedResponseFingerprint,
    });
  }
  return {
    snapshot: {
      schemaVersion: PRIVATE_SCHEMA_VERSION,
      runId: contract.runId,
      accessToken: wrapper.accessToken as string,
      revision: contract.revision,
      stateFingerprint: contract.stateFingerprint,
      state: canonicalState,
    } as SixScreenWorkflowPrivateSnapshot,
    projection:
      canonicalProjection as SixScreenWorkflowPublicProjection,
    contract,
    recoveredTransformedLegacyState:
      comparisons.legacyStateMatchesCanonicalPayload === false,
    recoveredTransformedLegacyProjection:
      !comparisons.legacyPublicMatchesCanonicalPayload,
    diagnostic: diagnostic({
      failure: "none",
      trace: input.trace,
      contract,
      wrapper,
      canonicalState,
      projection,
      canonicalProjection,
      comparisons,
      calculatedResponseFingerprint,
    }),
  };
}

function coordinateDiagnostic(input: {
  failure: string;
  incoming: SixScreenWorkflowPrivateSnapshot;
  current?: SixScreenWorkflowPrivateSnapshot | null;
}) {
  const incomingState = record(input.incoming.state);
  const comparisons = {
    incomingRunEqualsStateRun:
      input.incoming.runId === incomingState?.runId,
    incomingRevisionEqualsStateRevision:
      input.incoming.revision === incomingState?.revision,
    incomingFingerprintEqualsStateFingerprint:
      input.incoming.stateFingerprint ===
        safeFingerprint(input.incoming.state),
    incomingRunEqualsCurrentRun: input.current
      ? input.incoming.runId === input.current.runId
      : null,
    incomingAuthorizationEqualsCurrentAuthorization: input.current
      ? input.incoming.accessToken === input.current.accessToken
      : null,
  };
  const trace: SixScreenWorkflowResponseTrace = {
    toolName: "frontend-disposition",
    bridgePath: "mcp-app",
    metadataKeys: [],
    structuredContentKeys: [],
  };
  const wrapper = input.incoming as unknown as Record<string, unknown>;
  return diagnostic({
    failure: input.failure,
    trace,
    contract: null,
    wrapper,
    canonicalState: input.incoming.state,
    projection: null,
    comparisons,
  });
}

export function workflowSnapshotResponseDisposition(
  current: SixScreenWorkflowPrivateSnapshot | null,
  incoming: SixScreenWorkflowPrivateSnapshot,
): "accept" | "obsolete" {
  const state = record(incoming.state);
  if (incoming.runId !== state?.runId) {
    throw new SixScreenWorkflowResponseError(
      "run_id",
      "ShockAudit rejected a workflow result because its run ID did not match its canonical state.",
      coordinateDiagnostic({ failure: "run_id", incoming, current }),
    );
  }
  if (incoming.revision !== state.revision) {
    throw new SixScreenWorkflowResponseError(
      "revision",
      "ShockAudit rejected a workflow result because its revision did not match its canonical state.",
      coordinateDiagnostic({ failure: "revision", incoming, current }),
    );
  }
  if (incoming.stateFingerprint !== fingerprintSixScreenValue(incoming.state)) {
    throw new SixScreenWorkflowResponseError(
      "state_fingerprint",
      "ShockAudit rejected a workflow result because its state fingerprint did not match its canonical state.",
      coordinateDiagnostic({
        failure: "state_fingerprint",
        incoming,
        current,
      }),
    );
  }
  if (!current) return "accept";
  if (incoming.runId !== current.runId) {
    throw new SixScreenWorkflowResponseError(
      "wrong_run",
      "ShockAudit rejected a workflow result that belongs to a different run.",
      coordinateDiagnostic({ failure: "wrong_run", incoming, current }),
    );
  }
  if (incoming.accessToken !== current.accessToken) {
    throw new SixScreenWorkflowResponseError(
      "authorization_binding",
      "ShockAudit rejected a workflow result that changed its authorization binding.",
      coordinateDiagnostic({
        failure: "authorization_binding",
        incoming,
        current,
      }),
    );
  }
  if (incoming.revision < current.revision) return "obsolete";
  if (
    incoming.revision === current.revision &&
    incoming.stateFingerprint !== current.stateFingerprint
  ) {
    throw new SixScreenWorkflowResponseError(
      "conflicting_revision",
      "ShockAudit rejected conflicting canonical state at one workflow revision.",
      coordinateDiagnostic({
        failure: "conflicting_revision",
        incoming,
        current,
      }),
    );
  }
  return "accept";
}
