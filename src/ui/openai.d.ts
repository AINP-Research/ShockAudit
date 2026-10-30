import type {
  LegacyScreen01State,
  Screen01State,
  Screen01WidgetSnapshot,
} from "../core/scope-types";
import type {
  Screen02StateEnvelope,
  Screen02StateSummary,
} from "../core/screen02-state-envelope";
import type { Screen02Session } from "../core/screen02-types";
import type {
  Screen02PendingAiReviewMarker,
  Screen02WorkflowWidgetSnapshot,
} from "./mcp-bridge";
import type { Screen03WorkflowWidgetSnapshot } from "./screen-03/screen03-widget-state";
import type { Screen04WorkflowWidgetSnapshot } from "./screen-04/screen04-widget-state";
import type { HostReasoningPrivateTaskRegistry } from "./host-task/host-task-client";
import type { SixScreenWorkflowPrivateSnapshot } from
  "../worker/six-screen-workflow-runtime";

type ShockAuditLegacyToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown> | null;
  content?: Array<{
    type?: string;
    text?: string;
    [key: string]: unknown;
  }>;
  _meta?: Record<string, unknown>;
};

type ShockAuditToolResponseMetadata = Record<string, unknown> & {
  status?: string;
  call_tool_result?: ShockAuditLegacyToolResult | null;
  mcp_tool_result?: ShockAuditLegacyToolResult | null;
};

export type ShockAuditPrivateWidgetState = {
  /**
   * Screen01State remains accepted for backward compatibility with v0.1.0
   * widgets. v0.1.1 writes the complete snapshot.
   */
  screen01?:
    | Screen01WidgetSnapshot
    | Screen01State
    | LegacyScreen01State;
  /**
   * v0.2.15 and later write the bounded state capsule and compact summary.
   * Complete sessions remain readable so saved v0.2.14 conversations can reopen.
   */
  screen02?:
    | {
        sessionState: Screen02StateEnvelope;
        sessionSummary: Screen02StateSummary;
        /** Delivery-only UI state; excluded from canonical Screen 2 data. */
        pendingAiReview?: Screen02PendingAiReviewMarker;
      }
    | Screen02StateEnvelope
    | Screen02Session;
  /** Private v2.1 state, navigation, and opened-dossier restoration data. */
  screen02Workflow?: Screen02WorkflowWidgetSnapshot;
  /** Screen 3 review state is a sibling; Screen 2's exact widget stays stable. */
  screen03Workflow?: Screen03WorkflowWidgetSnapshot;
  /** Screen 4 contains only bounded metadata, exact selections, and safe summaries. */
  screen04Workflow?: Screen04WorkflowWidgetSnapshot;
  /** Non-secret coordinates used to reconcile optional host tasks in this panel. */
  hostReasoningTasks?: HostReasoningPrivateTaskRegistry;
  /** Canonical six-screen coordinates remain private to the mounted panel. */
  sixScreenWorkflow?: SixScreenWorkflowPrivateSnapshot;
  /** Unsaved Screen 5 editor text; never treated as a finalized model input. */
  screen5MechanismDraft?: {
    schemaVersion: "screen-05-mechanism-draft-v1";
    runId: string;
    baseInputFingerprint: string | null;
    theoreticalPerspective: string;
    proposedMechanism: string;
  };
  [futureScreen: string]: unknown;
};

export type ShockAuditStructuredWidgetState = {
  /** Deliberately contains no workflow state, credential, or evidence packet. */
  modelContent?: string | Record<string, unknown> | null;
  /** Complete restoration state is visible only to this widget instance. */
  privateContent?: ShockAuditPrivateWidgetState | null;
  imageIds?: string[];
};

export type ShockAuditWidgetState =
  | ShockAuditStructuredWidgetState
  | ShockAuditPrivateWidgetState;

declare global {
  interface Window {
    /**
     * Optional ChatGPT compatibility bridge. The standards-based MCP Apps
     * bridge is used for tool calls and composer context; these two fields
     * preserve draft state in ChatGPT hosts that expose widget state.
     */
    openai?: {
      widgetState?: ShockAuditWidgetState | null;
      setWidgetState?: (
        state: ShockAuditStructuredWidgetState,
      ) => void | Promise<void>;
      toolOutput?: Record<string, unknown> | null;
      /**
       * Compatibility path for ChatGPT hosts that expose the original Apps
       * SDK component bridge but not the standards-based MCP Apps
       * `serverTools` capability.
       */
      callTool?: (
        name: string,
        arguments_: Record<string, unknown>,
      ) => Promise<ShockAuditLegacyToolResult>;
      /**
       * ChatGPT compatibility alias for MCP Apps `ui/message`. ShockAudit
       * publishes each bounded task through standards-based
       * `updateModelContext` first. This alias receives the same identity-only
       * visible message as `ui/message`; capability material is never copied
       * into its prompt.
       */
      sendFollowUpMessage?: (input: {
        prompt: string;
        scrollToBottom?: boolean;
      }) => void | Promise<void>;
      /** Open a destination that the resource CSP explicitly allowlists. */
      openExternal?: (input: {
        href: string;
        redirectUrl?: boolean;
      }) => void | Promise<void>;
      /** Documented ChatGPT presentation-mode compatibility bridge. */
      requestDisplayMode?: (input: {
        mode: "inline" | "fullscreen" | "pip";
      }) => Promise<{ mode: "inline" | "fullscreen" | "pip" }>;
      /** ChatGPT-only file helpers. Feature-detect before use. */
      uploadFile?: (
        file: File,
        options?: { library?: boolean },
      ) => Promise<{ fileId: string }>;
      selectFiles?: () => Promise<
        Array<{ fileId: string; fileName: string; mimeType: string }>
      >;
      getFileDownloadUrl?: (input: {
        fileId: string;
      }) => Promise<{ downloadUrl: string }>;
      /**
       * Canonical metadata for the tool result that mounted or most recently
       * updated this widget. Current ChatGPT hosts preserve the full MCP
       * result (including hidden `_meta`) under `mcp_tool_result` and may also
       * expose `call_tool_result`; older hosts used a flat metadata object.
       */
      toolResponseMetadata?: ShockAuditToolResponseMetadata | null;
    };
  }
}

export {};
