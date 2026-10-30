import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";

import {
  SHOCKAUDIT_VERSION,
  SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
} from "../../version";
import {
  fingerprintSixScreenValue,
  sameSixScreenValue,
  serializeSixScreenValue,
} from "../../core/six-screen/canonical";
import { sixScreenMutationTimeoutMs } from
  "../../core/six-screen/long-running-operation";
import { sameHostTaskTransportValue } from
  "../../core/host-task-transport";
import {
  GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
  HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
  HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
  HOST_REASONING_PRIVATE_CONTEXT_META_KEY,
  HOST_REASONING_STATUS_INPUT_SCHEMA_VERSION,
  PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
  RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
  hostReasoningModeFromMetadata,
  hostReasoningPublicTaskMatchesCoordinates,
  privateCoordinatesFromPrepared,
  restoreHostReasoningMessageRecordResult,
  restoreHostReasoningPreparedResult,
  restoreHostReasoningPrivateTaskRegistry,
  restoreHostReasoningStatusResult,
  updatePrivateHostTaskCoordinates,
  upsertPrivateHostTask,
  type HostReasoningMessageDelivery,
  type HostReasoningMessageRecordInput,
  type HostReasoningMode,
  type HostReasoningPrivateTaskCoordinates,
  type HostReasoningPrivateTaskRegistry,
  type HostReasoningPublicTaskState,
  type HostReasoningTaskPrepareCoordinates,
} from "../host-task/host-task-client";
import type {
  SixScreenWorkflowPrivateSnapshot,
  SixScreenWorkflowPublicProjection,
} from
  "../../worker/six-screen-workflow-runtime";
import {
  SIX_SCREEN_WORKFLOW_META_KEY,
  SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY,
} from
  "../../core/six-screen/metadata-keys";
import {
  SIX_SCREEN_HYDRATED_STATE_PAYLOAD_META_KEY,
  SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES,
  SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES,
  SIX_SCREEN_MAX_STATE_CHUNKS,
  SIX_SCREEN_STATE_CHUNK_BYTES,
  SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
  SIX_SCREEN_WORKFLOW_RESPONSE_CONTRACT_VERSION,
  SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION,
  SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
  encodeSixScreenWorkflowPayload,
  sixScreenWorkflowResponseContractBody,
  sixScreenWorkflowStateTransferId,
  type SixScreenWorkflowResponseContract,
} from "../../core/six-screen/workflow-response-contract";
import {
  SIX_SCREEN_OPERATION_STATUS_TOOL,
  restoreSixScreenOperationStatus,
  type SixScreenOperationStatus,
  type SixScreenOperationStatusRequest,
} from "../../core/six-screen/operation-status";
import {
  SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
  restoreSixScreenRecoverySnapshot,
} from "../../core/six-screen/recovery-snapshot";
import {
  SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX,
  SixScreenWorkflowProblemError,
  classifySixScreenWorkflowProblem,
  createSixScreenWorkflowProblem,
  decodeSixScreenWorkflowProblemText,
  type SafeSixScreenWorkflowProblem,
} from "../../core/six-screen/workflow-problem";
import { sixScreenActionPolicy } from
  "../../core/six-screen/action-policy";
import { restoreSixScreenWorkflowToolResponse } from
  "./workflow-response";
import { downloadBrowserFile, type SixScreenDownloadFile } from "./file-download";

export type SixScreenHostView = {
  connected: boolean;
  embedded: boolean;
  displayMode: "inline" | "fullscreen" | "pip";
  canFullscreen: boolean;
};

export type SixScreenToolResponseTrace = {
  toolName: string;
  bridgePath: "mcp-app" | "chatgpt-compatibility";
  metadataKeys: string[];
  structuredContentKeys: string[];
};

export type SixScreenToolResponse<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  structuredContent: T;
  content: Array<{ type?: string; text?: string }>;
  metadata: Record<string, unknown>;
  trace: SixScreenToolResponseTrace;
};

export type Screen5MechanismDraft = {
  schemaVersion: "screen-05-mechanism-draft-v1";
  runId: string;
  baseInputFingerprint: string | null;
  theoreticalPerspective: string;
  proposedMechanism: string;
};

export type Screen3HandoffRecovery = {
  schemaVersion: "screen-03-handoff-recovery-v1";
  runId: string;
  operationId: string;
  operationKind: "open_screen_3";
  inputFingerprint: string;
  dependencyFingerprint: string;
  scientificBinding?: {
    schemaVersion: "screen-03-handoff-scientific-binding-v1";
    studyFingerprint: string;
    timingFingerprint: string;
    clarificationFingerprint: string;
    evidenceDependencyFingerprint: string;
  };
  state:
    | "pending"
    | "outcome_unknown"
    | "committed_display_pending"
    | "local_rebuild_required"
    | "saved_display_unavailable"
    | "operation_conflict";
};

type ToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown> | null;
  content?: Array<{ type?: string; text?: string }>;
  _meta?: Record<string, unknown>;
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

const SAFE_MODEL_CONTENT =
  "ShockAudit six-screen workspace state is private to this panel.";
const PRIVATE_TASK_CONTEXT_TIMEOUT_MS = 5_000;
const HOST_TASK_POLL_INTERVAL_MS = 2_500;
const HOST_TASK_RECONCILIATION_DEADLINE_MS = 45_000;

type PrivateTaskContextLease = {
  app: App;
  connectionGeneration: number;
  writeGeneration: number;
};

function operationId(kind: string) {
  return `six-host-${kind}:${crypto.randomUUID()}`;
}

function applyHostContext(context: McpUiHostContext | undefined) {
  if (!context) return;
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  document.documentElement.style.setProperty(
    "--host-safe-bottom",
    `${context.safeAreaInsets?.bottom ?? 0}px`,
  );
}

function hostView(
  context: McpUiHostContext | undefined,
  connected: boolean,
): SixScreenHostView {
  return {
    connected,
    embedded: true,
    displayMode: context?.displayMode ?? "inline",
    canFullscreen:
      context?.availableDisplayModes?.includes("fullscreen") ?? false,
  };
}

function privateContent(): Record<string, unknown> {
  const state = window.openai?.widgetState;
  if (!state || typeof state !== "object" || Array.isArray(state)) return {};
  const content = "privateContent" in state ? state.privateContent : null;
  return content && typeof content === "object" && !Array.isArray(content)
    ? content as Record<string, unknown>
    : {};
}

function decodedProblemText(text: unknown): SafeSixScreenWorkflowProblem | null {
  if (typeof text !== "string") return null;
  const normalized = text.trim();
  const prefixIndex = normalized.indexOf(
    SIX_SCREEN_WORKFLOW_PROBLEM_TEXT_PREFIX,
  );
  if (prefixIndex < 0) return null;
  // SDK promise rejections can prepend a bounded MCP error label. The signed
  // canonical envelope begins at the recognized prefix and is still parsed
  // strictly; arbitrary wrapper prose is never copied into the UI.
  const candidate = normalized.slice(prefixIndex);
  return decodeSixScreenWorkflowProblemText(candidate);
}

function problemFromToolResult(result: ToolResult) {
  const problems: SafeSixScreenWorkflowProblem[] = [];
  for (const item of result.content ?? []) {
    if (item.type !== "text") continue;
    const decoded = decodedProblemText(item.text);
    if (decoded) problems.push(decoded);
  }
  if (!problems.length) return null;
  const first = problems[0]!;
  return problems.every((candidate) => sameSixScreenValue(candidate, first))
    ? first
    : createSixScreenWorkflowProblem({
      code: "response_contract",
      stage: "serialization",
      recovery: "check_status",
      safeCauseCodes: ["response_contract_invalid"],
    });
}

function problemFromRejectedValue(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
): SafeSixScreenWorkflowProblem | null {
  if (value instanceof SixScreenWorkflowProblemError) return value.problem;
  if (typeof value === "string") return decodedProblemText(value);
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      depth > 3 || seen.has(value)) return null;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const direct = decodedProblemText(record.message);
  if (direct) return direct;
  if (Array.isArray(record.content)) {
    const fromResult = problemFromToolResult(record as ToolResult);
    if (fromResult) return fromResult;
  }
  for (const key of ["cause", "data", "result"] as const) {
    const nested = problemFromRejectedValue(record[key], seen, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function problemContext(name: string, args: Record<string, unknown>) {
  const mutation = args.mutation && typeof args.mutation === "object" &&
      !Array.isArray(args.mutation)
    ? args.mutation as Record<string, unknown>
    : null;
  const action = typeof mutation?.action === "string"
    ? mutation.action
    : name === SIX_SCREEN_OPERATION_STATUS_TOOL
      ? "operation_status"
      : name === SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL
        ? "get_state_chunk"
      : name === "get_six_screen_recovery_snapshot_v1"
        ? "get_recovery_snapshot"
      : "unknown";
  const policy = sixScreenActionPolicy(action);
  return {
    action,
    operationId: typeof mutation?.operationId === "string"
      ? mutation.operationId
      : typeof args.operationId === "string" ? args.operationId : null,
    screen: policy?.destinationScreen ??
      (name === SIX_SCREEN_OPERATION_STATUS_TOOL ? 3 : null),
    expectedRevision: typeof mutation?.expectedRevision === "number"
      ? mutation.expectedRevision : null,
  } as const;
}

function rejectedToolProblem(
  caught: unknown,
  name: string,
  args: Record<string, unknown>,
) {
  let decoded: SafeSixScreenWorkflowProblem | null = null;
  try {
    decoded = problemFromRejectedValue(caught);
  } catch {
    return createSixScreenWorkflowProblem({
      code: "response_contract",
      ...problemContext(name, args),
      stage: "serialization",
      commitCertainty: "unknown",
      recovery: "check_status",
      safeCauseCodes: ["response_contract_invalid"],
    });
  }
  if (decoded) return decoded;
  const context = problemContext(name, args);
  const classified = classifySixScreenWorkflowProblem(caught, {
    ...context,
    stage: "host_delivery",
    commitCertainty: "unknown",
    recovery: "check_status",
  });
  if (classified && classified.code !== "unclassified") return classified;
  return createSixScreenWorkflowProblem({
    code: "delivery_failure",
    ...context,
    stage: "host_delivery",
    commitCertainty: "unknown",
    recovery: "check_status",
    safeCauseCodes: ["delivery_interrupted"],
  });
}

function returnedToolProblem(
  result: ToolResult,
  name: string,
  args: Record<string, unknown>,
) {
  let decoded: SafeSixScreenWorkflowProblem | null = null;
  try {
    decoded = problemFromToolResult(result);
  } catch {
    // A recognized prefix with malformed, noncanonical, or forged contents is
    // itself a response-contract failure. Never fall back to its raw text.
  }
  if (decoded) return decoded;
  return createSixScreenWorkflowProblem({
    code: "response_contract",
    ...problemContext(name, args),
    stage: "serialization",
    commitCertainty: "unknown",
    recovery: "check_status",
    safeCauseCodes: ["response_contract_invalid"],
  });
}

const sixScreenWorkflowToolNames = new Set([
  "create_six_screen_workflow_v1",
  "get_six_screen_workflow_v1",
  "mutate_six_screen_workflow_v1",
]);

/** A standards-host tool-result notification has no separate tool-name field.
 * Use only the paired response contract and let the normal strict response
 * validator re-check the complete envelope before canonical acceptance. */
function notifiedWorkflowResponse(
  result: ToolResult,
  bridgePath: SixScreenToolResponseTrace["bridgePath"] = "mcp-app",
): SixScreenToolResponse | null {
  if (result.isError || !result.structuredContent || !result._meta) return null;
  const contract = result._meta[SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY];
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    return null;
  }
  const toolName = (contract as { toolName?: unknown }).toolName;
  if (typeof toolName !== "string" ||
      !sixScreenWorkflowToolNames.has(toolName)) return null;
  // Large app-originated responses are hydrated by the direct call path. A
  // pushed notification has no reliable request credentials, so ignore that
  // duplicate instead of presenting an unhydrated response as a failure.
  if ((contract as { statePayloadMode?: unknown }).statePayloadMode ===
      "chunked") return null;
  // A current mutation has an operation-bound direct response. Some hosts
  // push a transformed duplicate after that response or its state recovery.
  // The direct call owns validation and errors; the duplicate must not
  // bypass the binding check or overwrite a recovered screen with a warning.
  if (toolName === "mutate_six_screen_workflow_v1" &&
      (contract as { operationBinding?: unknown }).operationBinding) return null;
  return {
    structuredContent: result.structuredContent,
    content: result.content ?? [],
    metadata: result._meta,
    trace: {
      toolName,
      bridgePath,
      metadataKeys: Object.keys(result._meta),
      structuredContentKeys: Object.keys(result.structuredContent),
    },
  };
}

function completeCompatibilityResult(
  direct: ToolResult,
  metadata: unknown,
  args: Record<string, unknown>,
): ToolResult {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return direct;
  }
  // ChatGPT can expose the tool's _meta directly in toolResponseMetadata,
  // rather than repeat the complete CallToolResult inside a wrapper. Pair it
  // only with the same public revision; canonical validation still checks the
  // encoded payload, fingerprints and operation binding before acceptance.
  const rawMetadata = metadata as Record<string, unknown>;
  const rawContract = objectRecord(
    rawMetadata[SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY],
  );
  if (!direct._meta && direct.structuredContent && rawContract &&
      rawContract.runId === direct.structuredContent.runId &&
      rawContract.revision === direct.structuredContent.revision &&
      (typeof args.runId !== "string" || rawContract.runId === args.runId)) {
    return { ...direct, _meta: rawMetadata };
  }
  const wrappers = [
    "mcp_tool_result",
    "call_tool_result",
    "mcpToolResult",
    "callToolResult",
  ] as const;
  const matches: ToolResult[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number) => {
    if (
      depth > 2 || !value || typeof value !== "object" ||
      Array.isArray(value) || seen.has(value)
    ) return;
    seen.add(value);
    const candidate = value as ToolResult & Record<string, unknown>;
    if (candidate.isError !== true && candidate.structuredContent &&
        candidate._meta && typeof candidate._meta === "object" &&
        !Array.isArray(candidate._meta)) {
      const publicResult = candidate.structuredContent;
      const privateSnapshot = candidate._meta[SIX_SCREEN_WORKFLOW_META_KEY];
      const matchesDirect = Boolean(direct.structuredContent) &&
        sameHostTaskTransportValue(publicResult, direct.structuredContent);
      const matchesAuthenticatedWorkflow = Boolean(
        direct.isError && typeof args.runId === "string" &&
          typeof args.accessToken === "string" && privateSnapshot &&
          typeof privateSnapshot === "object" &&
          !Array.isArray(privateSnapshot) &&
          (privateSnapshot as Record<string, unknown>).runId === args.runId &&
          (privateSnapshot as Record<string, unknown>).accessToken ===
            args.accessToken &&
          publicResult.runId === args.runId &&
          publicResult.revision ===
            (privateSnapshot as Record<string, unknown>).revision,
      );
      if (matchesDirect || matchesAuthenticatedWorkflow) matches.push(candidate);
    }
    for (const key of wrappers) visit(candidate[key], depth + 1);
  };
  visit(metadata, 0);
  if (!matches.length) return direct;
  const first = matches[0]!;
  if (!matches.every((candidate) =>
    sameSixScreenValue(candidate._meta, first._meta) &&
    sameSixScreenValue(candidate.structuredContent, first.structuredContent)
  )) return direct;
  if (direct.isError) return first;
  return { ...direct, _meta: first._meta };
}

export class SixScreenBridge {
  private app: App | null = null;
  private connecting: App | null = null;
  private generation = 0;
  private saveQueue: Promise<void> = Promise.resolve();
  private privateShadow: Record<string, unknown> | null = null;
  private hostReasoningMode: HostReasoningMode | null = null;
  private modelContextGeneration = 0;
  private modelContextQueue: Promise<void> = Promise.resolve();
  private hostViewCallback: ((view: SixScreenHostView) => void) | null = null;
  private compatibilityGlobalsListener: ((event: Event) => void) | null = null;
  private sdkListenerCleanup: (() => void) | null = null;
  private observedPushedResults: string[] = [];

  private dispatchObservedResult(
    response: SixScreenToolResponse | null,
    callback: ((response: SixScreenToolResponse) => void) | undefined,
  ) {
    if (!response || !callback) return;
    const fingerprint = fingerprintSixScreenValue(response);
    if (this.observedPushedResults.includes(fingerprint)) return;
    this.observedPushedResults = [...this.observedPushedResults,
      fingerprint].slice(-8);
    try { callback(response); }
    catch (error) {
      console.warn("ShockAudit rejected a host-pushed tool result.", error);
    }
  }

  private installCompatibilityGlobalsListener(
    generation: number,
    callback: ((response: SixScreenToolResponse) => void) | undefined,
  ) {
    if (!callback) return;
    if (this.compatibilityGlobalsListener) {
      window.removeEventListener?.("openai:set_globals",
        this.compatibilityGlobalsListener);
      this.compatibilityGlobalsListener = null;
    }
    const inspect = (output: Record<string, unknown> | null | undefined,
      metadata: unknown) => {
      if (generation !== this.generation || !output) return;
      const completed = completeCompatibilityResult(
        { structuredContent: output }, metadata, {},
      );
      const advertisedMode = hostReasoningModeFromMetadata(
        completed,
        completed._meta,
      );
      if (advertisedMode) this.hostReasoningMode = advertisedMode;
      this.dispatchObservedResult(notifiedWorkflowResponse(
        completed, "chatgpt-compatibility"), callback);
    };
    const listener = (event: Event) => {
      const globals = (event as CustomEvent<{
        globals?: Partial<{
          toolOutput: Record<string, unknown> | null;
          toolResponseMetadata: unknown;
        }>;
      }>).detail?.globals;
      if (!globals || !("toolOutput" in globals ||
          "toolResponseMetadata" in globals)) return;
      inspect(globals.toolOutput ?? window.openai?.toolOutput,
        globals.toolResponseMetadata ?? window.openai?.toolResponseMetadata);
    };
    this.compatibilityGlobalsListener = listener;
    window.addEventListener?.("openai:set_globals", listener);
    inspect(window.openai?.toolOutput, window.openai?.toolResponseMetadata);
  }

  async connect(callbacks: {
    onHostView: (view: SixScreenHostView) => void;
    onToolResult?: (response: SixScreenToolResponse) => void;
    onToolCancelled?: (reason: string | null) => void;
  }) {
    this.hostViewCallback = callbacks.onHostView;
    const generation = ++this.generation;
    this.installCompatibilityGlobalsListener(generation,
      callbacks.onToolResult);
    if (window.parent === window) {
      callbacks.onHostView({
        connected: false,
        embedded: false,
        displayMode: "fullscreen",
        canFullscreen: false,
      });
      return;
    }
    const app = new App(
      { name: "ShockAudit six-screen workspace", version: SHOCKAUDIT_VERSION },
      { availableDisplayModes: ["inline", "fullscreen"] },
      { autoResize: true },
    );
    this.connecting = app;
    const current = () => generation === this.generation &&
      (this.connecting === app || this.app === app);
    app.onhostcontextchanged = (partial) => {
      if (!current()) return;
      const context = app.getHostContext() ?? partial;
      applyHostContext(context);
      callbacks.onHostView(hostView(context, true));
    };
    // The SDK requires these handlers before connect so the launch result or
    // an early cancellation cannot race the initialize handshake.
    const toolResultListener = (result: ToolResult) => {
      if (!current()) return;
      const advertisedMode = hostReasoningModeFromMetadata(
        result,
        result._meta,
      );
      if (advertisedMode) this.hostReasoningMode = advertisedMode;
      const response = notifiedWorkflowResponse(result);
      this.dispatchObservedResult(response, callbacks.onToolResult);
    };
    const toolCancelledListener = ({ reason }: { reason?: string }) => {
      if (!current()) return;
      const bounded = typeof reason === "string"
        ? reason.replace(/[\u0000-\u001f\u007f]+/gu, " ").trim().slice(0, 160)
        : "";
      callbacks.onToolCancelled?.(bounded || null);
    };
    app.addEventListener("toolresult", toolResultListener);
    app.addEventListener("toolcancelled", toolCancelledListener);
    this.sdkListenerCleanup = () => {
      app.removeEventListener("toolresult", toolResultListener);
      app.removeEventListener("toolcancelled", toolCancelledListener);
    };
    try {
      await app.connect();
      if (!current()) {
        void app.close();
        return;
      }
      this.connecting = null;
      this.app = app;
      const context = app.getHostContext();
      applyHostContext(context);
      callbacks.onHostView(hostView(context, true));
    } catch (error) {
      if (!current()) return;
      this.connecting = null;
      console.warn("ShockAudit could not connect to the host.", error);
      callbacks.onHostView(hostView(undefined, false));
    }
  }

  disconnect() {
    this.generation += 1;
    if (this.compatibilityGlobalsListener) {
      window.removeEventListener?.("openai:set_globals",
        this.compatibilityGlobalsListener);
      this.compatibilityGlobalsListener = null;
    }
    this.sdkListenerCleanup?.();
    this.sdkListenerCleanup = null;
    this.observedPushedResults = [];
    const connected = this.app;
    const connecting = this.connecting;
    void connected?.close();
    if (connecting && connecting !== connected) void connecting.close();
    this.app = null;
    this.connecting = null;
    this.hostViewCallback = null;
  }

  /** Keep exports in the host file channel: a blob anchor in the sandbox can
   * be blocked without throwing or notifying the app. */
  async downloadFile(file: SixScreenDownloadFile) {
    if (window.parent === window) return downloadBrowserFile(file);
    if (this.app?.getHostCapabilities()?.downloadFile) {
      let binary = "";
      for (let offset = 0; offset < file.bytes.length; offset += 32_768) {
        binary += String.fromCharCode(...file.bytes.subarray(offset, offset + 32_768));
      }
      const result = await this.app.downloadFile({ contents: [{
        type: "resource", resource: {
          uri: `file:///${encodeURIComponent(file.fileName)}`,
          mimeType: file.mimeType, blob: btoa(binary),
        },
      }] }, { timeout: 60_000 });
      if (result.isError) throw new Error("The report download was cancelled or declined.");
      return { status: "requested" } as const;
    }
    const host = window.openai;
    if (host?.uploadFile && host.getFileDownloadUrl) {
      const uploaded = await host.uploadFile(new File([file.bytes.slice().buffer],
        file.fileName, { type: file.mimeType }));
      if (!uploaded.fileId) throw new Error("The host did not accept the report file.");
      const { downloadUrl } = await host.getFileDownloadUrl({ fileId: uploaded.fileId });
      const url = new URL(downloadUrl);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("The host did not provide a secure report download.");
      }
      // Retain an explicit link even if the host declines automatic opening.
      try { await host.openExternal?.({ href: url.href }); } catch { /* Link remains usable. */ }
      return { status: "ready", fileName: file.fileName, url: url.href } as const;
    }
    throw new Error("This host does not support file downloads. Open ShockAudit in your local browser to download the report.");
  }

  async requestDisplayMode(mode: "inline" | "fullscreen") {
    try {
      if (this.app) {
        const result = await this.app.requestDisplayMode({ mode });
        const context = this.app.getHostContext();
        this.hostViewCallback?.(hostView({
          ...context,
          displayMode: result.mode,
        }, true));
        return result.mode === mode;
      }
      const fallback = window.openai?.requestDisplayMode;
      if (fallback) {
        const result = await fallback({ mode });
        this.hostViewCallback?.({
          connected: true,
          embedded: window.parent !== window,
          displayMode: result.mode,
          canFullscreen: true,
        });
        return result.mode === mode;
      }
    } catch (error) {
      console.warn(`ShockAudit could not request ${mode} display mode.`, error);
    }
    return false;
  }

  private async invokeToolTransport(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{
    result: ToolResult;
    bridgePath: SixScreenToolResponseTrace["bridgePath"];
  }> {
    if (this.app?.getHostCapabilities()?.serverTools) {
      return {
        bridgePath: "mcp-app",
        result: await this.app.callServerTool({
          name,
          arguments: args,
        }, {
          // The installed SDK defaults to 60 seconds, while the bounded local
          // provider stage permits 300 seconds. A timeout only makes the outcome
          // uncertain; it must never authorize an automatic resend.
          timeout: name === "mutate_six_screen_workflow_v1"
            ? sixScreenMutationTimeoutMs(args.mutation)
            : 60_000,
        }) as ToolResult,
      };
    }
    if (window.openai?.callTool) {
      const direct = await window.openai.callTool(name, args);
      return {
        bridgePath: "chatgpt-compatibility",
        result: completeCompatibilityResult(
          direct,
          window.openai.toolResponseMetadata,
          args,
        ),
      };
    }
    throw new Error(
      "The workspace connection is not ready. Refresh and try again.",
    );
  }

  private invalidStateTransferProblem(
    name: string,
    args: Record<string, unknown>,
  ) {
    return new SixScreenWorkflowProblemError(
      createSixScreenWorkflowProblem({
        code: "response_contract",
        ...problemContext(name, args),
        stage: "serialization",
        commitCertainty: "committed",
        dispatchCertainty: "not_dispatched",
        recovery: "check_status",
        safeCauseCodes: ["response_contract_invalid"],
      }),
    );
  }

  /** Hydrate a large committed workspace through bounded authenticated reads.
   * The initiating mutation is never repeated. Every slice is bound to the
   * exact revision, full-state fingerprint, transfer ID, and response build. */
  private async hydrateWorkflowStateResult(
    result: ToolResult,
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const metadata = objectRecord(result._meta);
    const rawContract = metadata?.[SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY];
    const contractRecord = objectRecord(rawContract);
    if (!contractRecord || contractRecord.statePayloadMode !== "chunked") {
      return result;
    }
    const contract = contractRecord as unknown as
      SixScreenWorkflowResponseContract;
    const wrapper = objectRecord(metadata?.[SIX_SCREEN_WORKFLOW_META_KEY]);
    const runId = typeof args.runId === "string"
      ? args.runId
      : typeof wrapper?.runId === "string" ? wrapper.runId : null;
    const accessToken = typeof args.accessToken === "string"
      ? args.accessToken
      : typeof wrapper?.accessToken === "string" ? wrapper.accessToken : null;
    const descriptorValid =
      sixScreenWorkflowToolNames.has(name) &&
      contract.schemaVersion === SIX_SCREEN_WORKFLOW_RESPONSE_CONTRACT_VERSION &&
      contract.buildId === SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID &&
      contract.appVersion === SHOCKAUDIT_VERSION &&
      contract.uiResourceUri === SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI &&
      contract.toolName === name &&
      contract.statePayloadMode === "chunked" &&
      contract.encodedStatePayload === "" &&
      typeof runId === "string" && /^sa6r_[A-Za-z0-9_-]{43}$/u.test(runId) &&
      typeof accessToken === "string" &&
        /^sa6a_[A-Za-z0-9_-]{43}$/u.test(accessToken) &&
      contract.runId === runId &&
      Number.isSafeInteger(contract.revision) && contract.revision >= 0 &&
      typeof contract.stateFingerprint === "string" &&
        /^fnv1a64:[0-9a-f]{16}$/u.test(contract.stateFingerprint) &&
      Number.isSafeInteger(contract.encodedStateBytes) &&
        contract.encodedStateBytes >= 4 &&
        contract.encodedStateBytes <= SIX_SCREEN_MAX_ENCODED_PAYLOAD_BYTES &&
      Number.isSafeInteger(contract.canonicalStateBytes) &&
        contract.canonicalStateBytes >= 2 &&
        contract.canonicalStateBytes <=
          SIX_SCREEN_MAX_CANONICAL_PAYLOAD_BYTES &&
      contract.stateChunkBytes === SIX_SCREEN_STATE_CHUNK_BYTES &&
      Number.isSafeInteger(contract.stateChunkCount) &&
        contract.stateChunkCount >= 1 &&
        contract.stateChunkCount <= SIX_SCREEN_MAX_STATE_CHUNKS &&
      contract.stateChunkCount === Math.ceil(
        contract.encodedStateBytes / SIX_SCREEN_STATE_CHUNK_BYTES,
      ) &&
      typeof contract.stateTransferId === "string" &&
      contract.stateTransferId === sixScreenWorkflowStateTransferId({
        runId: contract.runId,
        revision: contract.revision,
        stateFingerprint: contract.stateFingerprint,
        encodedStateBytes: contract.encodedStateBytes,
        canonicalStateBytes: contract.canonicalStateBytes,
      }) &&
      typeof contract.responseFingerprint === "string" &&
      contract.responseFingerprint === fingerprintSixScreenValue(
        sixScreenWorkflowResponseContractBody(contract),
      );
    if (!descriptorValid) throw this.invalidStateTransferProblem(name, args);

    const withHydratedState = (encodedPayload: string): ToolResult => ({
      ...result,
      _meta: {
        ...metadata,
        [SIX_SCREEN_HYDRATED_STATE_PAYLOAD_META_KEY]: encodedPayload,
      },
    });
    try {
      const chunks: string[] = [];
      for (let chunkIndex = 0;
        chunkIndex < contract.stateChunkCount;
        chunkIndex += 1) {
        const chunkArgs = {
          runId,
          accessToken,
          transferId: contract.stateTransferId,
          revision: contract.revision,
          stateFingerprint: contract.stateFingerprint,
          encodedStateBytes: contract.encodedStateBytes,
          canonicalStateBytes: contract.canonicalStateBytes,
          chunkIndex,
        };
        let chunkResult: ToolResult;
        try {
          ({ result: chunkResult } = await this.invokeToolTransport(
            SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
            chunkArgs,
          ));
        } catch (caught) {
          throw new SixScreenWorkflowProblemError(rejectedToolProblem(
            caught,
            SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
            chunkArgs,
          ));
        }
        if (!chunkResult || typeof chunkResult !== "object" ||
            chunkResult.isError) {
          throw new SixScreenWorkflowProblemError(returnedToolProblem(
            chunkResult ?? {},
            SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL,
            chunkArgs,
          ));
        }
        const envelope = objectRecord(chunkResult.structuredContent);
        // Response v6 carries the bytes in structuredContent because that is
        // the only nested app-tool result channel the ChatGPT host preserves
        // consistently. If it is absent or changed, the guarded snapshot
        // fallback runs without repeating the mutation or model request.
        const structuredChunk = envelope?.encodedStateChunk;
        const chunk = typeof structuredChunk === "string"
          ? structuredChunk : null;
        if (!envelope || typeof chunk !== "string") {
          throw this.invalidStateTransferProblem(name, args);
        }
        const { responseFingerprint, ...body } = envelope;
        const expectedChunkBytes = utf8ByteLength(chunk);
        const envelopeValid =
          Object.keys(envelope).length === 17 &&
          envelope.schemaVersion ===
            SIX_SCREEN_WORKFLOW_STATE_CHUNK_SCHEMA_VERSION &&
          envelope.buildId === SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID &&
          envelope.appVersion === SHOCKAUDIT_VERSION &&
          envelope.uiResourceUri ===
            SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI &&
          envelope.toolName === SIX_SCREEN_WORKFLOW_STATE_CHUNK_TOOL &&
          envelope.transferId === contract.stateTransferId &&
          envelope.runId === contract.runId &&
          envelope.revision === contract.revision &&
          envelope.stateFingerprint === contract.stateFingerprint &&
          envelope.encodedStateBytes === contract.encodedStateBytes &&
          envelope.canonicalStateBytes === contract.canonicalStateBytes &&
          envelope.chunkIndex === chunkIndex &&
          envelope.chunkCount === contract.stateChunkCount &&
          envelope.chunkBytes === expectedChunkBytes &&
          expectedChunkBytes > 0 &&
          expectedChunkBytes <= SIX_SCREEN_STATE_CHUNK_BYTES &&
          envelope.encodedStateChunk === chunk &&
          envelope.chunkFingerprint === fingerprintSixScreenValue(chunk) &&
          typeof responseFingerprint === "string" &&
          responseFingerprint === fingerprintSixScreenValue(body);
        if (!envelopeValid) {
          throw this.invalidStateTransferProblem(name, args);
        }
        chunks.push(chunk);
      }
      const assembled = chunks.join("");
      if (utf8ByteLength(assembled) !== contract.encodedStateBytes) {
        throw this.invalidStateTransferProblem(name, args);
      }
      return withHydratedState(assembled);
    } catch (chunkFailure) {
      // Some ChatGPT host paths preserve the authenticated chunk envelope but
      // omit the app-only chunk metadata. Recover the same already-committed
      // revision through the existing one-shot authenticated snapshot instead
      // of surfacing a serialization warning or repeating the mutation/model
      // request. Re-encoding the verified canonical state must reproduce the
      // original descriptor exactly before it is accepted.
      try {
        const recoveryArgs = { runId, accessToken };
        const { result: recoveryResult } = await this.invokeToolTransport(
          SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
          recoveryArgs,
        );
        if (!recoveryResult || typeof recoveryResult !== "object" ||
            recoveryResult.isError || !recoveryResult.structuredContent) {
          throw this.invalidStateTransferProblem(name, args);
        }
        const recovered = await restoreSixScreenRecoverySnapshot({
          value: recoveryResult.structuredContent,
          expectedRunId: runId,
          expectedAppVersion: SHOCKAUDIT_VERSION,
          expectedUiResourceUri:
            SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
        });
        const encoded = encodeSixScreenWorkflowPayload(
          serializeSixScreenValue(recovered.state),
        );
        if (recovered.envelope.revision !== contract.revision ||
            recovered.envelope.stateFingerprint !==
              contract.stateFingerprint ||
            encoded.encodedBytes !== contract.encodedStateBytes ||
            encoded.canonicalBytes !== contract.canonicalStateBytes ||
            utf8ByteLength(encoded.encodedPayload) !==
              contract.encodedStateBytes) {
          throw this.invalidStateTransferProblem(name, args);
        }
        return withHydratedState(encoded.encodedPayload);
      } catch {
        if (chunkFailure instanceof SixScreenWorkflowProblemError) {
          throw chunkFailure;
        }
        throw this.invalidStateTransferProblem(name, args);
      }
    }
  }

  async callToolWithMetadata<T extends Record<string, unknown>>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<SixScreenToolResponse<T>> {
    let result: ToolResult;
    let bridgePath: SixScreenToolResponseTrace["bridgePath"];
    try {
      ({ result, bridgePath } = await this.invokeToolTransport(name, args));
    } catch (caught) {
      throw new SixScreenWorkflowProblemError(
        rejectedToolProblem(caught, name, args),
      );
    }
    if (!result || typeof result !== "object" || result.isError) {
      throw new SixScreenWorkflowProblemError(
        returnedToolProblem(result ?? {}, name, args),
      );
    }
    if (!result.structuredContent) {
      throw new SixScreenWorkflowProblemError(returnedToolProblem(result, name, args));
    }
    result = await this.hydrateWorkflowStateResult(result, name, args);
    if (!result.structuredContent) {
      throw new SixScreenWorkflowProblemError(returnedToolProblem(result, name, args));
    }
    const advertisedMode = hostReasoningModeFromMetadata(result, result._meta);
    if (advertisedMode) this.hostReasoningMode = advertisedMode;
    return {
      structuredContent: result.structuredContent as T,
      content: result.content ?? [],
      metadata: result._meta ?? {},
      trace: {
        toolName: name,
        bridgePath,
        metadataKeys: Object.keys(result._meta ?? {}),
        structuredContentKeys: Object.keys(result.structuredContent),
      },
    };
  }

  async getSixScreenOperationStatus(input: {
    accessToken: string;
    request: SixScreenOperationStatusRequest;
  }): Promise<SixScreenOperationStatus> {
    const response = await this.callToolWithMetadata<Record<string, unknown>>(
      SIX_SCREEN_OPERATION_STATUS_TOOL,
      {
        ...input.request,
        accessToken: input.accessToken,
      },
    );
    try {
      return restoreSixScreenOperationStatus({
        value: response.structuredContent,
        request: input.request,
        expectedAppVersion: SHOCKAUDIT_VERSION,
        expectedUiResourceUri:
          SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
      });
    } catch {
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code: "response_contract",
          action: "operation_status",
          operationId: input.request.operationId,
          screen: input.request.operationKind === "open_screen_3" ? 3 : null,
          stage: "serialization",
          commitCertainty: "unknown",
          dispatchCertainty: "not_dispatched",
          recovery: "update_client",
          safeCauseCodes: ["response_contract_invalid"],
        }),
      );
    }
  }


  async getSixScreenRecoverySnapshot(input: {
    runId: string;
    accessToken: string;
  }): Promise<{
    snapshot: SixScreenWorkflowPrivateSnapshot;
    projection: SixScreenWorkflowPublicProjection;
    trace: SixScreenToolResponseTrace;
  }> {
    const response = await this.callToolWithMetadata<Record<string, unknown>>(
      SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
      input,
    );
    try {
      const restored = await restoreSixScreenRecoverySnapshot({
        value: response.structuredContent,
        expectedRunId: input.runId,
        expectedAppVersion: SHOCKAUDIT_VERSION,
        expectedUiResourceUri:
          SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI,
      });
      if (
        restored.state.schemaVersion !==
          "shockaudit-six-screen-workflow-v1" ||
        restored.publicProjection.schemaVersion !==
          "shockaudit-six-screen-public-v1"
      ) {
        throw new Error("Unsupported recovery snapshot schema.");
      }
      return {
        snapshot: {
          schemaVersion: "shockaudit-six-screen-private-v1",
          runId: restored.envelope.runId,
          accessToken: input.accessToken,
          revision: restored.envelope.revision,
          stateFingerprint: restored.envelope.stateFingerprint,
          state: restored.state as unknown as
            SixScreenWorkflowPrivateSnapshot["state"],
        },
        projection: restored.publicProjection as unknown as
          SixScreenWorkflowPublicProjection,
        trace: response.trace,
      };
    } catch {
      throw new SixScreenWorkflowProblemError(
        createSixScreenWorkflowProblem({
          code: "response_contract",
          action: "get_recovery_snapshot",
          stage: "serialization",
          commitCertainty: "unknown",
          dispatchCertainty: "not_dispatched",
          recovery: "update_client",
          safeCauseCodes: ["response_contract_invalid"],
        }),
      );
    }
  }

  private updatePrivateContent(
    update: (current: Record<string, unknown>) => Record<string, unknown>,
  ) {
    const write = async () => {
      const current = this.privateShadow ?? privateContent();
      const next = update(current);
      this.privateShadow = next;
      await window.openai?.setWidgetState?.({
        modelContent: SAFE_MODEL_CONTENT,
        privateContent: next,
      });
    };
    const queued = this.saveQueue.then(write, write);
    this.saveQueue = queued.then(() => undefined, () => undefined);
    return queued;
  }

  async saveSixScreenWorkflow(snapshot: SixScreenWorkflowPrivateSnapshot) {
    await this.updatePrivateContent((current) => ({
      ...current,
      sixScreenWorkflow: snapshot,
    }));
  }

  async clearSixScreenWorkspace(runId: string) {
    await this.updatePrivateContent((current) => {
      const next = { ...current };
      const savedWorkflow = objectRecord(next.sixScreenWorkflow);
      if (savedWorkflow?.runId === runId) delete next.sixScreenWorkflow;
      const mechanismDraft = objectRecord(next.screen5MechanismDraft);
      if (mechanismDraft?.runId === runId) delete next.screen5MechanismDraft;
      const handoff = objectRecord(next.screen3HandoffRecovery);
      if (handoff?.runId === runId) delete next.screen3HandoffRecovery;
      const hostTasks = restoreHostReasoningPrivateTaskRegistry(
        next.hostReasoningTasks,
      );
      next.hostReasoningTasks = {
        ...hostTasks,
        tasks: hostTasks.tasks.filter((task) => task.runId !== runId),
      };
      return next;
    });
  }

  getInitialScreen5MechanismDraft(runId: string | undefined) {
    const value = (this.privateShadow ?? privateContent()).screen5MechanismDraft;
    if (!runId || !value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const draft = value as Partial<Screen5MechanismDraft>;
    return draft.schemaVersion === "screen-05-mechanism-draft-v1" &&
        draft.runId === runId &&
        (draft.baseInputFingerprint === null ||
          typeof draft.baseInputFingerprint === "string") &&
        typeof draft.theoreticalPerspective === "string" &&
        draft.theoreticalPerspective.length <= 1_000 &&
        typeof draft.proposedMechanism === "string" &&
        draft.proposedMechanism.length <= 4_000
      ? structuredClone(draft as Screen5MechanismDraft)
      : null;
  }

  async saveScreen5MechanismDraft(draft: Screen5MechanismDraft) {
    await this.updatePrivateContent((current) => ({
      ...current,
      screen5MechanismDraft: structuredClone(draft),
    }));
  }

  getInitialScreen3HandoffRecovery(runId: string | undefined) {
    const value = (this.privateShadow ?? privateContent())
      .screen3HandoffRecovery;
    if (!runId || !value || typeof value !== "object" ||
        Array.isArray(value)) return null;
    const recovery = value as Partial<Screen3HandoffRecovery>;
    const scientificBinding = recovery.scientificBinding;
    const validScientificBinding = scientificBinding === undefined ||
      Boolean(scientificBinding && typeof scientificBinding === "object" &&
        !Array.isArray(scientificBinding) &&
        Object.keys(scientificBinding).length === 5 &&
        scientificBinding.schemaVersion ===
          "screen-03-handoff-scientific-binding-v1" &&
        [
          scientificBinding.studyFingerprint,
          scientificBinding.timingFingerprint,
          scientificBinding.clarificationFingerprint,
          scientificBinding.evidenceDependencyFingerprint,
        ].every((fingerprint) =>
          typeof fingerprint === "string" &&
          /^fnv1a64:[0-9a-f]{16}$/u.test(fingerprint)));
    return recovery.schemaVersion === "screen-03-handoff-recovery-v1" &&
        recovery.runId === runId &&
        recovery.operationKind === "open_screen_3" &&
        typeof recovery.operationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(recovery.operationId) &&
        typeof recovery.inputFingerprint === "string" &&
        /^fnv1a64:[0-9a-f]{16}$/u.test(recovery.inputFingerprint) &&
        typeof recovery.dependencyFingerprint === "string" &&
        /^fnv1a64:[0-9a-f]{16}$/u.test(recovery.dependencyFingerprint) &&
        validScientificBinding &&
        (recovery.state === "pending" ||
          recovery.state === "outcome_unknown" ||
          recovery.state === "committed_display_pending" ||
          recovery.state === "local_rebuild_required" ||
          recovery.state === "saved_display_unavailable" ||
          recovery.state === "operation_conflict")
      ? structuredClone(recovery as Screen3HandoffRecovery)
      : null;
  }

  async saveScreen3HandoffRecovery(recovery: Screen3HandoffRecovery) {
    await this.updatePrivateContent((current) => ({
      ...current,
      screen3HandoffRecovery: structuredClone(recovery),
    }));
  }

  async clearScreen3HandoffRecovery(input: {
    runId: string;
    operationId: string;
  }) {
    await this.updatePrivateContent((current) => {
      const saved = current.screen3HandoffRecovery;
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        return current;
      }
      const coordinates = saved as Partial<Screen3HandoffRecovery>;
      if (coordinates.runId !== input.runId ||
          coordinates.operationId !== input.operationId) return current;
      const { screen3HandoffRecovery: _removed, ...remaining } = current;
      return remaining;
    });
  }

  getHostReasoningMode() {
    return this.hostReasoningMode;
  }

  private updatePrivateHostTasks(
    update: (value: unknown) => HostReasoningPrivateTaskRegistry,
  ) {
    return this.updatePrivateContent((current) => ({
        ...current,
        hostReasoningTasks: update(current.hostReasoningTasks),
      }));
  }

  getInitialHostReasoningTasks(runId?: string) {
    const registry = restoreHostReasoningPrivateTaskRegistry(
      (this.privateShadow ?? privateContent()).hostReasoningTasks,
    );
    return registry.tasks.filter((task) => !runId || task.runId === runId);
  }

  private persistHostReasoningTask(
    task: HostReasoningPrivateTaskCoordinates,
  ) {
    return this.updatePrivateHostTasks((value) =>
      upsertPrivateHostTask(value, task)
    );
  }

  private persistHostReasoningTaskStatus(
    task: HostReasoningPrivateTaskCoordinates,
  ) {
    return this.updatePrivateHostTasks((value) => {
      const registry = restoreHostReasoningPrivateTaskRegistry(value);
      return {
        ...registry,
        tasks: registry.tasks.map((candidate) =>
          candidate.taskId === task.taskId ? task : candidate
        ),
      };
    });
  }

  async prepareSixScreenIntelligenceProof(input: {
    snapshot: SixScreenWorkflowPrivateSnapshot;
    taskType:
      | "six-screen-policy-fact-proof"
      | "six-screen-mechanism-proof"
      | "screen04-study-event-assessment"
      | "screen05-theoretical-planning"
      | "screen05-study-mechanism-comparison";
    eventId: string;
    eventCardFingerprint: string;
    retryOfTaskId?: string | null;
  }) {
    if (this.hostReasoningMode === null) {
      throw new Error(
        "Signed-in intelligence capability is still being checked against the authorized runtime.",
      );
    }
    if (this.hostReasoningMode !== "full") {
      throw new Error(
        "Signed-in intelligence proof is disabled in this ShockAudit environment.",
      );
    }
    const coordinates: HostReasoningTaskPrepareCoordinates = {
      taskType: input.taskType,
      runId: input.snapshot.runId,
      accessToken: input.snapshot.accessToken,
      expectedParentRevision: input.snapshot.revision,
      candidatePoolId: null,
      selectedEventId: input.eventId,
      claimGroupId: null,
      expectedScopeFingerprint: fingerprintSixScreenValue(
        input.snapshot.state,
      ),
      expectedCandidatePoolFingerprint: null,
      expectedEventFingerprint: input.eventCardFingerprint,
    };
    const response = await this.callToolWithMetadata<Record<string, unknown>>(
      PREPARE_SHOCKAUDIT_HOST_TASK_TOOL,
      {
        schemaVersion: HOST_REASONING_PREPARE_INPUT_SCHEMA_VERSION,
        operationId: operationId("prepare"),
        taskType: coordinates.taskType,
        runId: coordinates.runId,
        accessToken: coordinates.accessToken,
        candidatePoolId: coordinates.candidatePoolId,
        selectedEventId: coordinates.selectedEventId,
        claimGroupId: coordinates.claimGroupId,
        expectedScopeFingerprint: coordinates.expectedScopeFingerprint,
        expectedCandidatePoolFingerprint:
          coordinates.expectedCandidatePoolFingerprint,
        expectedEventFingerprint: coordinates.expectedEventFingerprint,
        retryOfTaskId: input.retryOfTaskId ?? null,
      },
    );
    const prepared = restoreHostReasoningPreparedResult(
      response.structuredContent,
      response.metadata[HOST_REASONING_PRIVATE_CONTEXT_META_KEY],
    );
    const privateCoordinates = prepared
      ? privateCoordinatesFromPrepared(coordinates, prepared)
      : null;
    if (!prepared || !privateCoordinates ||
        prepared.visibleMessage.includes(input.snapshot.accessToken)) {
      throw new Error(
        "ShockAudit rejected an unreadable or mismatched proof-task preparation.",
      );
    }
    await this.persistHostReasoningTask(privateCoordinates);
    return { prepared, coordinates: privateCoordinates };
  }

  private modelContextUpdate(
    capability: { text?: unknown; structuredContent?: unknown } | undefined,
    label: string,
    structuredContent: Record<string, unknown>,
  ): Parameters<App["updateModelContext"]>[0] | null {
    if (!capability?.text && !capability?.structuredContent) return null;
    return {
      ...(capability.text
        ? {
            content: [{
              type: "text" as const,
              text: capability.structuredContent
                ? label
                : `${label}\n${JSON.stringify(structuredContent)}`,
            }],
          }
        : {}),
      ...(capability.structuredContent ? { structuredContent } : {}),
    };
  }

  private queueModelContextUpdate(
    app: App,
    update: Parameters<App["updateModelContext"]>[0],
  ) {
    const writeGeneration = ++this.modelContextGeneration;
    const connectionGeneration = this.generation;
    const publish = async () => {
      if (this.app !== app || this.generation !== connectionGeneration ||
          writeGeneration !== this.modelContextGeneration) {
        return false;
      }
      await app.updateModelContext(update);
      return this.app === app && this.generation === connectionGeneration &&
        writeGeneration === this.modelContextGeneration;
    };
    const queued = this.modelContextQueue.then(publish, publish);
    this.modelContextQueue = queued.then(() => undefined, () => undefined);
    return {
      queued,
      lease: { app, connectionGeneration, writeGeneration },
    };
  }

  private modelContextLeaseIsCurrent(lease: PrivateTaskContextLease) {
    return this.app === lease.app &&
      this.generation === lease.connectionGeneration &&
      this.modelContextGeneration === lease.writeGeneration;
  }

  private scrubTimedOutPrivateTaskContext(
    lease: PrivateTaskContextLease,
    capability: { text?: unknown; structuredContent?: unknown } | undefined,
  ) {
    if (!this.modelContextLeaseIsCurrent(lease)) return;
    const update = this.modelContextUpdate(
      capability,
      "ShockAudit private proof context cleared after incomplete publication.",
      {
        schemaVersion: "shockaudit-private-host-task-cleared-v1",
        status: "cleared",
        outcomeValuesInspected: false,
      },
    );
    if (!update) return;
    void this.queueModelContextUpdate(lease.app, update).queued.catch(() => {
      // The proof task is already classified as unavailable. Never retry a
      // visible message because a best-effort context scrub was rejected.
    });
  }

  private async publishPrivateTaskContext(
    context: Record<string, unknown>,
  ): Promise<PrivateTaskContextLease | false> {
    const app = this.app;
    const capability = app?.getHostCapabilities()?.updateModelContext;
    if (!app) return false;
    const update = this.modelContextUpdate(
      capability,
      "ShockAudit private signed-in proof task.",
      context,
    );
    if (!update) return false;
    const publication = this.queueModelContextUpdate(app, update);
    const timeoutError = new Error("Private proof context timed out.");
    let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;
    try {
      const published = await Promise.race([
        publication.queued,
        new Promise<never>((_resolve, reject) => {
          timeout = globalThis.setTimeout(
            () => reject(timeoutError),
            PRIVATE_TASK_CONTEXT_TIMEOUT_MS,
          );
        }),
      ]);
      return published && this.modelContextLeaseIsCurrent(publication.lease)
        ? publication.lease
        : false;
    } catch (error) {
      if (error === timeoutError) {
        this.scrubTimedOutPrivateTaskContext(
          publication.lease,
          capability,
        );
      }
      return false;
    } finally {
      if (timeout !== null) globalThis.clearTimeout(timeout);
    }
  }

  private async recordHostMessage(input: Omit<
    HostReasoningMessageRecordInput,
    "schemaVersion" | "operationId"
  >, writeOperationId = operationId("message")) {
    const response = await this.callToolWithMetadata<Record<string, unknown>>(
      RECORD_SHOCKAUDIT_HOST_MESSAGE_DELIVERY_TOOL,
      {
        schemaVersion: HOST_REASONING_MESSAGE_RECORD_SCHEMA_VERSION,
        operationId: writeOperationId,
        ...input,
      },
    );
    const result = restoreHostReasoningMessageRecordResult(
      response.structuredContent,
    );
    if (!result || result.taskId !== input.taskId) {
      throw new Error("ShockAudit returned an unreadable host-message receipt.");
    }
    return result;
  }

  async deliverSixScreenIntelligenceProof(input: {
    prepared: Awaited<ReturnType<
      SixScreenBridge["prepareSixScreenIntelligenceProof"]
    >>["prepared"];
    coordinates: HostReasoningPrivateTaskCoordinates;
    accessToken: string;
  }): Promise<HostReasoningMessageDelivery> {
    if (input.prepared.status !== "prepared" ||
        input.coordinates.status !== "prepared" ||
        input.coordinates.resultId !== null ||
        !hostReasoningPublicTaskMatchesCoordinates(
          input.prepared,
          input.coordinates,
        )) {
      throw new Error(
        "ShockAudit refused to deliver mismatched proof-task coordinates.",
      );
    }
    const requestedAt = new Date().toISOString();
    let channel: HostReasoningMessageDelivery["channel"] = "unavailable";
    let accepted = false;
    let failureCode: string | null = "private-context-unavailable";
    let failureExplanation: string | null =
      "The signed-in host could not receive the private proof context.";
    let shouldRecordResolution = true;
    const app = this.app;
    const canSendStandard = Boolean(
      app?.getHostCapabilities()?.message?.text,
    );
    const compatibility = canSendStandard
      ? undefined
      : window.openai?.sendFollowUpMessage;
    const privateContextLease = await this.publishPrivateTaskContext(
      input.prepared.privateModelContext as unknown as Record<string, unknown>,
    );
    const published = privateContextLease !== false;
    let requestOperationId: string | null = null;
    let requestJournaled = false;
    if (published && app && (canSendStandard || compatibility)) {
      channel = canSendStandard ? "ui/message" : "sendFollowUpMessage";
      requestOperationId = operationId("message-request");
      shouldRecordResolution = false;
      try {
        const requested = await this.recordHostMessage({
          phase: "requested",
          requestOperationId: null,
          taskId: input.prepared.taskId,
          runId: input.prepared.runId,
          accessToken: input.accessToken,
          channel,
          accepted: null,
          requestedAt,
          resolvedAt: null,
          failureCode: null,
          failureExplanation: null,
        }, requestOperationId);
        shouldRecordResolution = requested.disposition === "updated" ||
          requested.disposition === "replayed";
        requestJournaled = shouldRecordResolution &&
          requested.status === "message-requested" &&
          requested.messageChannel === channel &&
          requested.messageDeliveryStatus === "requested";
      } catch {
        // The request may have committed before its receipt was lost. Close
        // only that exact journal below; never send an unjournaled message.
        shouldRecordResolution = true;
      }
      if (requestJournaled &&
          !this.modelContextLeaseIsCurrent(privateContextLease)) {
        failureCode = "private-context-superseded";
        failureExplanation =
          "The private proof context changed before the visible request could be sent.";
      } else if (requestJournaled) {
        try {
          if (canSendStandard) {
            const delivered = await app.sendMessage({
              role: "user",
              content: [{ type: "text", text: input.prepared.visibleMessage }],
            });
            accepted = !delivered.isError;
          } else if (compatibility) {
            await compatibility.call(window.openai, {
              prompt: input.prepared.visibleMessage,
              scrollToBottom: false,
            });
            accepted = true;
          }
        } catch {
          accepted = false;
        }
        failureCode = accepted ? null : "host-message-rejected";
        failureExplanation = accepted
          ? null
          : "The signed-in host rejected the visible proof request.";
      } else {
        failureCode = "host-message-journal-unavailable";
        failureExplanation =
          "ShockAudit could not durably journal the proof request, so no visible message was sent.";
      }
    } else if (published) {
      failureCode = "host-message-unavailable";
      failureExplanation =
        "The signed-in host has no supported visible-message route for this proof task.";
    }
    const resolvedAt = new Date().toISOString();
    let record = null;
    if (shouldRecordResolution) {
      try {
        record = await this.recordHostMessage({
          phase: "resolved",
          requestOperationId,
          taskId: input.prepared.taskId,
          runId: input.prepared.runId,
          accessToken: input.accessToken,
          channel,
          accepted,
          requestedAt,
          resolvedAt,
          failureCode,
          failureExplanation,
        });
      } catch {
        // Never repeat an ambiguously delivered visible message.
      }
    }
    if (record?.messageDeliveryStatus === "accepted") {
      // A structured submission can win the race with the host message
      // Promise. Its authenticated receipt is stronger delivery evidence.
      accepted = true;
      failureCode = null;
      failureExplanation = null;
    }
    return {
      taskId: input.prepared.taskId,
      channel,
      accepted,
      requestedAt,
      resolvedAt,
      retryCount: input.prepared.retryCount,
      failureCode,
      failureExplanation,
      record,
    };
  }

  async getHostReasoningTaskStatus(
    coordinates: HostReasoningPrivateTaskCoordinates,
    accessToken: string,
    acknowledgeResultId: string | null = null,
  ) {
    const response = await this.callToolWithMetadata<Record<string, unknown>>(
      GET_SHOCKAUDIT_HOST_TASK_STATUS_TOOL,
      {
        schemaVersion: HOST_REASONING_STATUS_INPUT_SCHEMA_VERSION,
        operationId: operationId("status"),
        taskId: coordinates.taskId,
        runId: coordinates.runId,
        accessToken,
        acknowledgeResultId,
      },
    );
    const result = restoreHostReasoningStatusResult(response.structuredContent);
    if (!result || result.outcome !== "found" || !result.task) {
      throw new Error("The signed-in proof task is no longer available.");
    }
    const updated = updatePrivateHostTaskCoordinates(
      coordinates,
      result.task,
    );
    if (!updated) {
      throw new Error("The proof status does not match its frozen coordinates.");
    }
    await this.persistHostReasoningTaskStatus(updated);
    return result.task;
  }

  async waitForHostReasoningTask(input: {
    coordinates: HostReasoningPrivateTaskCoordinates;
    accessToken: string;
    onUpdate?: (task: HostReasoningPublicTaskState) => void;
    deadlineMs?: number;
  }) {
    const deadline = Date.now() +
      (input.deadlineMs ?? HOST_TASK_RECONCILIATION_DEADLINE_MS);
    let task = await this.getHostReasoningTaskStatus(
      input.coordinates,
      input.accessToken,
    );
    input.onUpdate?.(task);
    while (![
      "applied", "message-rejected", "validation-failed", "expired",
      "superseded", "retry-exhausted", "cancelled",
    ].includes(task.status) && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, HOST_TASK_POLL_INTERVAL_MS);
      });
      task = await this.getHostReasoningTaskStatus(
        input.coordinates,
        input.accessToken,
      );
      input.onUpdate?.(task);
    }
    return task;
  }

  async acknowledgeHostReasoningTask(
    coordinates: HostReasoningPrivateTaskCoordinates,
    accessToken: string,
    resultId: string,
  ) {
    const task = await this.getHostReasoningTaskStatus(
      coordinates,
      accessToken,
      resultId,
    );
    if (task.status !== "applied" || task.resultId !== resultId ||
        task.panelReconciliation.status !== "reconciled") {
      throw new Error("The proof result did not reconcile into this panel.");
    }
    return task;
  }
}
