import type { Page } from "@playwright/test";

export type JsonObject = Record<string, unknown>;

export type McpCallToolResult = JsonObject & {
  isError?: boolean;
  structuredContent?: JsonObject;
};

export type HostToolNotification = {
  label: string;
  toolName?: string;
  arguments: JsonObject;
  result: McpCallToolResult;
};

export type HostModelToolCall = {
  label: string;
  name: string;
  arguments: JsonObject;
};

export type HostModelRequest = {
  message: JsonObject;
  latestModelContext: JsonObject | null;
  messageIndex: number;
  modelContextIndex: number;
};

export type HostSamplingRequest = {
  message: JsonObject;
  samplingIndex: number;
};

type McpEnvelope = {
  id?: string | number | null;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

let nextRequestId = 1;

function parseMcpEnvelope(text: string, contentType: string): McpEnvelope {
  if (!contentType.includes("text/event-stream")) {
    return JSON.parse(text) as McpEnvelope;
  }

  const envelopes = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map((line) => JSON.parse(line) as McpEnvelope);
  const envelope = envelopes.find(
    (candidate) => candidate.result !== undefined || candidate.error,
  );
  if (!envelope) {
    throw new Error(`MCP response contained no JSON-RPC result: ${text}`);
  }
  return envelope;
}

export async function callMcpTool(
  baseUrl: string,
  name: string,
  args: JsonObject,
): Promise<McpCallToolResult> {
  const id = nextRequestId++;
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `MCP ${name} returned HTTP ${response.status}: ${text}`,
    );
  }
  const envelope = parseMcpEnvelope(
    text,
    response.headers.get("content-type") ?? "",
  );
  if (envelope.error) {
    throw new Error(
      `MCP ${name} failed: ${envelope.error.message ?? JSON.stringify(envelope.error)}`,
    );
  }
  if (!envelope.result || typeof envelope.result !== "object") {
    throw new Error(`MCP ${name} returned no CallToolResult: ${text}`);
  }
  return envelope.result as McpCallToolResult;
}

function scriptJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export async function installMcpAppHost(
  page: Page,
  options: {
    appUrl: string;
    initialToolNotifications: HostToolNotification[];
    hostCapabilities?: JsonObject;
    downloadFileResult?: { isError?: boolean };
    hostContext?: JsonObject;
    messageResponseDelayMs?: number;
    toolResponseDelayMsByName?: Record<string, number>;
    splitToolResultMetadata?: boolean;
    suppressFirstSplitToolResultMetadataFor?: string;
    suppressSplitToolResultMetadataFor?: string[];
    suppressFirstModelToolResultNotificationFor?: string;
    permanentStructuredContentOnlyFor?: string[];
    stripSealedSnapshotFromDirectFor?: string[];
    stripFirstSealedSnapshotFromDirectFor?: string;
    installChatGptCompatibilityBridge?: boolean;
    installExternalNavigationBridge?: boolean;
    representativeHostShell?: {
      heightPx: number;
      composerHeightPx: number;
      safeAreaBottomPx: number;
    };
    initialCompatibilityWidgetState?: JsonObject;
    initialCompatibilityToolResponseMetadata?: JsonObject;
    preDirectMalformedToolResultFor?: string[];
    preDirectStaleSealedToolResultFor?: string[];
    toolResultNotificationDelayMs?: number;
    hostModelResponder?: (
      request: HostModelRequest,
    ) => Promise<HostModelToolCall[]> | HostModelToolCall[];
    hostSamplingResponder?: (
      request: HostSamplingRequest,
    ) => Promise<JsonObject> | JsonObject;
    callTool: (
      name: string,
      args: JsonObject,
    ) => Promise<McpCallToolResult>;
  },
) {
  await page.exposeFunction(
    "__shockAuditCallServerTool",
    async (request: { name: string; arguments?: JsonObject }) => {
      const delay = options.toolResponseDelayMsByName?.[request.name] ?? 0;
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return options.callTool(request.name, request.arguments ?? {});
    },
  );
  await page.exposeFunction(
    "__shockAuditRespondToHostMessage",
    async (request: HostModelRequest) => {
      if (!options.hostModelResponder) return [];
      const calls = await options.hostModelResponder(request);
      const notifications: HostToolNotification[] = [];
      for (const call of calls) {
        notifications.push({
          label: call.label,
          toolName: call.name,
          arguments: call.arguments,
          result: await options.callTool(call.name, call.arguments),
        });
      }
      return notifications;
    },
  );
  await page.exposeFunction(
    "__shockAuditRespondToSamplingMessage",
    async (request: HostSamplingRequest) => {
      if (!options.hostSamplingResponder) return null;
      return options.hostSamplingResponder(request);
    },
  );

  const appUrl = scriptJson(options.appUrl);
  const downloadFileResult = scriptJson(options.downloadFileResult ?? {});
  const initialNotifications = scriptJson(
    options.initialToolNotifications,
  );
  const initialCompatibilityWidgetState = scriptJson(
    options.initialCompatibilityWidgetState ?? null,
  );
  const hostCapabilities = scriptJson(
    options.hostCapabilities ?? {
      serverTools: {},
      logging: {},
      message: { text: {} },
      updateModelContext: { text: {}, structuredContent: {} },
    },
  );
  const representativeHostShell = scriptJson(
    options.representativeHostShell ?? null,
  );
  const hostContext = scriptJson({
    theme: "light",
    displayMode: "fullscreen",
    availableDisplayModes: ["inline", "fullscreen"],
    containerDimensions: {
      maxHeight: options.representativeHostShell?.heightPx ?? 1100,
      maxWidth: 1440,
    },
    locale: "en-US",
    timeZone: "America/Chicago",
    userAgent: "ShockAudit Playwright simulated acceptance host",
    platform: "web",
    safeAreaInsets: {
      top: 0,
      right: 0,
      bottom: options.representativeHostShell?.safeAreaBottomPx ?? 0,
      left: 0,
    },
    ...(options.hostContext ?? {}),
  });
  const messageResponseDelayMs = scriptJson(
    options.messageResponseDelayMs ?? 0,
  );
  const splitToolResultMetadata = scriptJson(
    options.splitToolResultMetadata ?? false,
  );
  const suppressFirstSplitToolResultMetadataFor = scriptJson(
    options.suppressFirstSplitToolResultMetadataFor ?? null,
  );
  const suppressSplitToolResultMetadataFor = scriptJson(
    options.suppressSplitToolResultMetadataFor ?? [],
  );
  const suppressFirstModelToolResultNotificationFor = scriptJson(
    options.suppressFirstModelToolResultNotificationFor ?? null,
  );
  const permanentStructuredContentOnlyFor = scriptJson(
    options.permanentStructuredContentOnlyFor ?? [],
  );
  const stripSealedSnapshotFromDirectFor = scriptJson(
    options.stripSealedSnapshotFromDirectFor ?? [],
  );
  const stripFirstSealedSnapshotFromDirectFor = scriptJson(
    options.stripFirstSealedSnapshotFromDirectFor ?? null,
  );
  if (options.installChatGptCompatibilityBridge) {
    await page.addInitScript((initialCompatibilityState) => {
      if (window.parent === window) return;
      const boundedTaskBegin =
        "--- BEGIN SHOCKAUDIT BOUNDED TASK (JSON) ---";
      const boundedTaskEnd =
        "--- END SHOCKAUDIT BOUNDED TASK (JSON) ---";
      const boundedTaskFromPrompt = (prompt: string) => {
        const begin = prompt.indexOf(boundedTaskBegin);
        const end = prompt.indexOf(boundedTaskEnd);
        if (begin < 0 || end <= begin) return null;
        const serialized = prompt
          .slice(begin + boundedTaskBegin.length, end)
          .trim();
        try {
          const value = JSON.parse(serialized) as unknown;
          return value && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null;
        } catch {
          return null;
        }
      };
      const parentHost = window.parent as unknown as {
        __shockAuditCompatibilityWidgetState?: Record<string, unknown>;
        __shockAuditHostState?: {
          mountId: number;
          events: Array<Record<string, unknown>>;
          compatibilityModelContextRequests: Array<{
            params: Record<string, unknown>;
          }>;
          toolCalls: Array<{
            name: string;
            arguments: Record<string, unknown>;
            mountId: number;
          }>;
          staleCompatibilityWidgetStateWrites: Array<{
            staleMountId: number;
            currentMountId: number;
          }>;
        };
      };
      const compatibilityMountId = parentHost.__shockAuditHostState?.mountId;
      const cloneWidgetState = (state: Record<string, unknown>) =>
        structuredClone(state);
      const initialParentWidgetState =
        parentHost.__shockAuditCompatibilityWidgetState;
      // The active host owns the saved widget snapshot. Resolve it at access
      // time because Playwright may initialize an iframe's transient document
      // before the replacement navigation consumes restored state; retired
      // mounts retain only their last local copy and cannot write it back. The
      // local copy must belong to the child realm because strict deterministic
      // state validation rejects objects whose prototype comes from the parent.
      let localWidgetState =
        (initialParentWidgetState
          ? cloneWidgetState(initialParentWidgetState)
          : undefined) ??
        initialCompatibilityState.initialWidgetState ??
        {} as Record<string, unknown>;
      let observedParentWidgetState = initialParentWidgetState;
      const compatibilityMountIsCurrent = () =>
        compatibilityMountId === undefined ||
        parentHost.__shockAuditHostState?.mountId === compatibilityMountId;
      const compatibility = {
        get widgetState() {
          if (compatibilityMountIsCurrent()) {
            const parentWidgetState =
              parentHost.__shockAuditCompatibilityWidgetState;
            if (
              parentWidgetState &&
              parentWidgetState !== observedParentWidgetState
            ) {
              localWidgetState = cloneWidgetState(parentWidgetState);
              observedParentWidgetState = parentWidgetState;
            }
          }
          return localWidgetState;
        },
        toolResponseMetadata:
          initialCompatibilityState.initialToolResponseMetadata as Record<
            string,
            unknown
          > | null,
        setWidgetState(state: Record<string, unknown>) {
          localWidgetState = state;
          const hostState = parentHost.__shockAuditHostState;
          if (!compatibilityMountIsCurrent()) {
            hostState?.staleCompatibilityWidgetStateWrites.push({
              staleMountId: compatibilityMountId!,
              currentMountId: hostState.mountId,
            });
            hostState?.events.push({
              direction: "app-to-host",
              method: "compatibility/stale-widget-state-write-ignored",
              mountId: compatibilityMountId,
              currentMountId: hostState.mountId,
            });
            return;
          }
          parentHost.__shockAuditCompatibilityWidgetState = state;
          observedParentWidgetState = state;
          if (hostState && state.modelContent !== undefined) {
            hostState.compatibilityModelContextRequests.push({
              params: { structuredContent: state.modelContent },
            });
            hostState.events.push({
              direction: "app-to-host",
              method: "compatibility/set-widget-model-content",
            });
          }
        },
        async sendFollowUpMessage(input: {
          prompt: string;
          scrollToBottom?: boolean;
        }) {
          const parent = window.parent as unknown as {
            __shockAuditHostState: {
              mountId: number;
              events: Array<Record<string, unknown>>;
              compatibilityMessageRequests: Array<{
                params: Record<string, unknown>;
              }>;
              compatibilityModelContextRequests: Array<{
                params: Record<string, unknown>;
              }>;
              modelToolCalls: Array<Record<string, unknown>>;
            };
            __shockAuditNotifyToolResult: (
              entry: HostToolNotification,
            ) => Promise<void>;
          };
          const hostState = parent.__shockAuditHostState;
          hostState.compatibilityMessageRequests.push({ params: input });
          hostState.events.push({
            direction: "app-to-host",
            method: "compatibility/send-follow-up-message",
          });
          const messageTask = boundedTaskFromPrompt(input.prompt);
          const latestModelContext = messageTask
            ? { structuredContent: messageTask }
            : compatibility.widgetState.modelContent !== undefined
              ? {
                  structuredContent:
                    compatibility.widgetState.modelContent,
                }
              : null;
          const notifications = await (
            window as unknown as {
              __shockAuditRespondToHostMessage: (
                request: HostModelRequest,
              ) => Promise<HostToolNotification[]>;
            }
          ).__shockAuditRespondToHostMessage({
            message: input,
            latestModelContext,
            messageIndex:
              hostState.compatibilityMessageRequests.length - 1,
            modelContextIndex:
              hostState.compatibilityModelContextRequests.length - 1,
          });
          for (const notification of notifications) {
            hostState.modelToolCalls.push({
              label: notification.label,
              name: notification.toolName ?? "model-tool",
              arguments: notification.arguments,
              mountId: hostState.mountId,
            });
            hostState.events.push({
              direction: "host-model-to-server",
              method: "tools/call",
              label: notification.label,
              mountId: hostState.mountId,
            });
            await parent.__shockAuditNotifyToolResult(notification);
          }
        },
        async callTool(
          name: string,
          arguments_: Record<string, unknown>,
        ) {
          const hostState = parentHost.__shockAuditHostState;
          if (hostState) {
            hostState.toolCalls.push({
              name,
              arguments: arguments_,
              mountId: hostState.mountId,
            });
            hostState.events.push({
              direction: "app-to-host",
              method: "compatibility/call-tool",
              name,
              mountId: hostState.mountId,
            });
          }
          const result = await (
            window as unknown as {
              __shockAuditCallServerTool: (request: {
                name: string;
                arguments: Record<string, unknown>;
              }) => Promise<McpCallToolResult>;
            }
          ).__shockAuditCallServerTool({
            name,
            arguments: arguments_,
          });
          const structuredContent =
            result.structuredContent &&
            typeof result.structuredContent === "object"
              ? Object.fromEntries(
                  Object.entries(result.structuredContent).filter(
                    ([key]) => key !== "sealedSnapshot",
                  ),
                )
              : result.structuredContent;
          const summaryOnlyResult = {
            ...Object.fromEntries(
              Object.entries(result).filter(
                ([key]) => key !== "_meta" && key !== "structuredContent",
              ),
            ),
            ...(structuredContent === undefined
              ? {}
              : { structuredContent }),
          };
          compatibility.toolResponseMetadata = {
            status: "complete",
            call_tool_result: summaryOnlyResult,
            mcp_tool_result: result,
          };
          return summaryOnlyResult;
        },
      };
      (
        window as unknown as {
          openai: typeof compatibility;
        }
      ).openai = compatibility;
    }, {
      initialToolResponseMetadata:
        options.initialCompatibilityToolResponseMetadata ?? null,
      initialWidgetState: options.initialCompatibilityWidgetState ?? null,
    });
  }
  if (options.installExternalNavigationBridge) {
    await page.addInitScript(() => {
      if (window.parent === window) return;
      const externalNavigationCalls: Array<{
        href: string;
        redirectUrl?: boolean;
      }> = [];
      const target = window as unknown as {
        __shockAuditExternalNavigationCalls: typeof externalNavigationCalls;
        openai?: Record<string, unknown>;
      };
      target.__shockAuditExternalNavigationCalls = externalNavigationCalls;
      const openai = target.openai ?? {};
      openai.openExternal = (
        input: { href: string; redirectUrl?: boolean },
      ) => {
        externalNavigationCalls.push({ ...input });
      };
      target.openai = openai;
    });
  }
  const preDirectMalformedToolResultFor = scriptJson(
    options.preDirectMalformedToolResultFor ?? [],
  );
  const preDirectStaleSealedToolResultFor = scriptJson(
    options.preDirectStaleSealedToolResultFor ?? [],
  );
  const toolResultNotificationDelayMs = scriptJson(
    options.toolResultNotificationDelayMs ?? 25,
  );
  // `page.setContent()` otherwise leaves the host at `about:blank`. A secure
  // child URL does not receive Web Crypto when an ancestor is not itself a
  // trustworthy context, so establish the fixture's localhost origin before
  // replacing its document with the simulated MCP Apps host.
  await page.goto(new URL("/health", options.appUrl).href, {
    waitUntil: "domcontentloaded",
  });
  await page.setContent(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ShockAudit MCP Apps acceptance host</title>
    <style>
      html, body { margin: 0; min-height: 100%; background: #eef2f5; }
      .simulation-label {
        padding: 8px 12px;
        border-bottom: 2px solid #8a5a00;
        background: #fff4ce;
        color: #3f2b00;
        font: 700 13px/1.35 system-ui, sans-serif;
      }
      #shockaudit-frame { display: block; width: 100%; height: 1100px; border: 0; background: white; }
      #representative-host-shell[data-enabled="true"] {
        height: var(--representative-host-height);
        overflow: hidden;
        position: relative;
      }
      #representative-host-shell[data-enabled="true"] #frame-root,
      #representative-host-shell[data-enabled="true"] #shockaudit-frame {
        height: 100%;
      }
      #simulated-chatgpt-composer {
        align-items: center;
        background: #fff;
        border-top: 1px solid #c8d0d5;
        bottom: 0;
        box-shadow: 0 -8px 24px rgb(20 27 31 / 18%);
        box-sizing: border-box;
        display: none;
        gap: 10px;
        height: calc(
          var(--representative-composer-height) +
          var(--representative-safe-bottom)
        );
        left: 0;
        padding: 12px 18px var(--representative-safe-bottom);
        pointer-events: auto;
        position: absolute;
        right: 0;
        z-index: 100;
      }
      #representative-host-shell[data-enabled="true"] #simulated-chatgpt-composer {
        display: flex;
      }
      #simulated-chatgpt-composer textarea {
        border: 1px solid #9aa7af;
        border-radius: 18px;
        flex: 1;
        min-height: 38px;
        padding: 8px 12px;
        resize: none;
      }
      #simulated-chatgpt-composer button {
        border: 0;
        border-radius: 999px;
        min-height: 38px;
        min-width: 38px;
      }
    </style>
  </head>
  <body>
    <div class="simulation-label" data-testid="simulated-browser-evidence" role="note">
      Local simulated MCP Apps browser harness — not signed-in ChatGPT evidence.
    </div>
    <div id="representative-host-shell" data-enabled="false">
      <div id="frame-root"></div>
      <div id="simulated-chatgpt-composer" data-testid="simulated-chatgpt-composer" aria-label="Simulated ChatGPT composer">
        <textarea aria-label="Message ChatGPT" readonly placeholder="Message ChatGPT"></textarea>
        <button type="button" aria-label="Send message" disabled>↑</button>
      </div>
    </div>
    <script>
      (() => {
        const appUrl = ${appUrl};
        const initialCompatibilityWidgetState = ${initialCompatibilityWidgetState};
        const hostCapabilities = ${hostCapabilities};
        const hostContext = ${hostContext};
        const representativeHostShell = ${representativeHostShell};
        const messageResponseDelayMs = ${messageResponseDelayMs};
        const splitToolResultMetadata = ${splitToolResultMetadata};
        const suppressFirstSplitToolResultMetadataFor = ${suppressFirstSplitToolResultMetadataFor};
        const suppressSplitToolResultMetadataFor = ${suppressSplitToolResultMetadataFor};
        const suppressFirstModelToolResultNotificationFor = ${suppressFirstModelToolResultNotificationFor};
        const permanentStructuredContentOnlyFor = ${permanentStructuredContentOnlyFor};
        const stripSealedSnapshotFromDirectFor = ${stripSealedSnapshotFromDirectFor};
        const stripFirstSealedSnapshotFromDirectFor = ${stripFirstSealedSnapshotFromDirectFor};
        const preDirectMalformedToolResultFor = ${preDirectMalformedToolResultFor};
        const preDirectStaleSealedToolResultFor = ${preDirectStaleSealedToolResultFor};
        const toolResultNotificationDelayMs = ${toolResultNotificationDelayMs};
        let queuedNotifications = ${initialNotifications};
        let suppressedSplitToolResultMetadata = false;
        let suppressedFirstModelToolResultNotification = false;
        let strippedFirstSealedSnapshot = false;
        let currentFrame = null;
        let mountId = 0;
        const hostState = window.__shockAuditHostState = {
          mountId: 0,
          events: [],
          initializedMounts: [],
          initializeRequests: [],
          toolCalls: [],
          messageRequests: [],
          samplingRequests: [],
          modelContextRequests: [],
          compatibilityMessageRequests: [],
          compatibilityModelContextRequests: [],
          sentToolNotifications: [],
          modelToolCalls: [],
          suppressedModelToolNotifications: [],
          staleCompatibilityWidgetStateWrites: [],
          reorderedResultProofs: [],
          directResultProofs: [],
          errors: [],
          foreignMessageCount: 0,
          downloadRequests: [],
        };
        if (representativeHostShell !== null) {
          const shell = document.getElementById("representative-host-shell");
          shell.dataset.enabled = "true";
          shell.style.setProperty(
            "--representative-host-height",
            representativeHostShell.heightPx + "px",
          );
          shell.style.setProperty(
            "--representative-composer-height",
            representativeHostShell.composerHeightPx + "px",
          );
          shell.style.setProperty(
            "--representative-safe-bottom",
            representativeHostShell.safeAreaBottomPx + "px",
          );
          window.__shockAuditSetRepresentativeHostLayout = (layout) => {
            if (
              !layout ||
              !Number.isFinite(layout.heightPx) ||
              layout.heightPx < 320 ||
              layout.heightPx > 1600 ||
              !Number.isFinite(layout.composerHeightPx) ||
              layout.composerHeightPx < 48 ||
              layout.composerHeightPx > 240
            ) {
              throw new Error("Representative host layout is outside its bounded test range.");
            }
            shell.style.setProperty(
              "--representative-host-height",
              layout.heightPx + "px",
            );
            shell.style.setProperty(
              "--representative-composer-height",
              layout.composerHeightPx + "px",
            );
            hostContext.containerDimensions.maxHeight = layout.heightPx;
          };
        }
        if (initialCompatibilityWidgetState !== null) {
          window.__shockAuditCompatibilityWidgetState =
            initialCompatibilityWidgetState;
        }

        function reverseObjectKeys(value) {
          if (Array.isArray(value)) return value.map(reverseObjectKeys);
          if (!value || typeof value !== "object") return value;
          return Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, nested]) => [key, reverseObjectKeys(nested)]),
          );
        }

        function keysAt(value, path) {
          let current = value;
          for (const key of path) current = current && current[key];
          return current && typeof current === "object" && !Array.isArray(current)
            ? Object.keys(current)
            : [];
        }

        function boundedTaskFromPrompt(prompt) {
          if (typeof prompt !== "string") return null;
          const beginMarker =
            "--- BEGIN SHOCKAUDIT BOUNDED TASK (JSON) ---";
          const endMarker =
            "--- END SHOCKAUDIT BOUNDED TASK (JSON) ---";
          const begin = prompt.indexOf(beginMarker);
          const end = prompt.indexOf(endMarker);
          if (begin < 0 || end <= begin) return null;
          try {
            const value = JSON.parse(
              prompt.slice(begin + beginMarker.length, end).trim(),
            );
            return value && typeof value === "object" && !Array.isArray(value)
              ? value
              : null;
          } catch {
            return null;
          }
        }

        function post(target, message) {
          target.postMessage(message, "*");
        }

        async function sendToolNotification(entry, target, activeMountId) {
          hostState.sentToolNotifications.push({
            label: entry.label,
            mountId: activeMountId,
          });
          post(target, {
            jsonrpc: "2.0",
            method: "ui/notifications/tool-input",
            params: { arguments: entry.arguments },
          });
          await new Promise((resolve) => setTimeout(resolve, 25));
          post(target, {
            jsonrpc: "2.0",
            method: "ui/notifications/tool-result",
            params: reverseObjectKeys(entry.result),
          });
        }

        async function deliverQueuedNotifications(target, activeMountId) {
          const entries = queuedNotifications;
          queuedNotifications = [];
          for (const entry of entries) {
            await sendToolNotification(entry, target, activeMountId);
          }
        }

        function createFrame() {
          const root = document.getElementById("frame-root");
          mountId += 1;
          hostState.mountId = mountId;
          currentFrame = null;
          root.replaceChildren();
          const frame = document.createElement("iframe");
          frame.id = "shockaudit-frame";
          frame.title = "ShockAudit workspace";
          frame.setAttribute(
            "sandbox",
            "allow-scripts allow-same-origin allow-forms allow-popups allow-modals",
          );
          frame.src = appUrl;
          currentFrame = frame;
          root.append(frame);
        }

        window.__shockAuditNotifyToolResult = (entry) => {
          if (!currentFrame || !currentFrame.contentWindow) {
            throw new Error("ShockAudit iframe is not mounted.");
          }
          if (
            !suppressedFirstModelToolResultNotification &&
            entry.toolName === suppressFirstModelToolResultNotificationFor
          ) {
            suppressedFirstModelToolResultNotification = true;
            hostState.suppressedModelToolNotifications.push(entry);
            return Promise.resolve();
          }
          return sendToolNotification(
            entry,
            currentFrame.contentWindow,
            mountId,
          );
        };

        window.__shockAuditReleaseSuppressedModelToolResults = async () => {
          if (!currentFrame || !currentFrame.contentWindow) {
            throw new Error("ShockAudit iframe is not mounted.");
          }
          const entries = hostState.suppressedModelToolNotifications.splice(0);
          for (const entry of entries) {
            await sendToolNotification(entry, currentFrame.contentWindow, mountId);
          }
          return entries.length;
        };

        window.__shockAuditRemount = (entries) => {
          queuedNotifications = entries;
          createFrame();
        };

        window.addEventListener("message", async (event) => {
          if (!currentFrame || event.source !== currentFrame.contentWindow) {
            hostState.foreignMessageCount += 1;
            return;
          }
          const message = event.data;
          if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
            return;
          }
          const activeMountId = mountId;
          hostState.events.push({
            direction: "app-to-host",
            method: message.method,
            mountId: activeMountId,
          });

          if (message.method === "ui/initialize") {
            hostState.initializeRequests.push({
              params: message.params,
              mountId: activeMountId,
            });
            post(event.source, {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                protocolVersion: message.params.protocolVersion,
                hostInfo: {
                  name: "ShockAudit browser acceptance host",
                  version: "1.0.0",
                },
                hostCapabilities,
                hostContext,
              },
            });
            return;
          }

          if (message.method === "ui/notifications/initialized") {
            hostState.initializedMounts.push(activeMountId);
            await deliverQueuedNotifications(event.source, activeMountId);
            return;
          }

          if (message.method === "ui/download-file") {
            hostState.downloadRequests.push(message.params);
            const result = ${downloadFileResult};
            if (!result.isError) {
              for (const item of message.params.contents) {
                const resource = item.resource;
                const binary = atob(resource.blob);
                const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
                const url = URL.createObjectURL(new Blob([bytes], { type: resource.mimeType }));
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = decodeURIComponent(new URL(resource.uri).pathname.split("/").at(-1));
                document.body.appendChild(anchor);
                anchor.click(); anchor.remove();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
              }
            }
            post(event.source, { jsonrpc: "2.0", id: message.id, result });
            return;
          }

          if (message.method === "tools/call") {
            const name = message.params && message.params.name;
            const args = (message.params && message.params.arguments) || {};
            hostState.toolCalls.push({ name, arguments: args, mountId: activeMountId });
            try {
              const original = await window.__shockAuditCallServerTool({
                name,
                arguments: args,
              });
              if (preDirectStaleSealedToolResultFor.includes(name)) {
                const sealedSnapshot = original.structuredContent?.sealedSnapshot;
                if (sealedSnapshot && typeof sealedSnapshot === "object") {
                  hostState.sentToolNotifications.push({
                    label: "pre-direct-stale-sealed-result:" + name,
                    mountId: activeMountId,
                  });
                  post(event.source, {
                    jsonrpc: "2.0",
                    method: "ui/notifications/tool-result",
                    params: {
                      structuredContent: {
                        ok: true,
                        sealedSnapshot: {
                          ...sealedSnapshot,
                          operationId: "screen02-v021-prior-browser-notification",
                        },
                      },
                    },
                  });
                  await new Promise((resolve) => setTimeout(resolve, 20));
                }
              }
              if (preDirectMalformedToolResultFor.includes(name)) {
                hostState.sentToolNotifications.push({
                  label: "pre-direct-malformed-result:" + name,
                  mountId: activeMountId,
                });
                post(event.source, {
                  jsonrpc: "2.0",
                  method: "ui/notifications/tool-result",
                  params: {
                    _meta: {
                      "shockaudit/screen02-workflow-v021": {
                        mode: "redacted",
                      },
                      "shockaudit/screen02-workflow-correlation-v1": {
                        operationId: args.operationId,
                      },
                    },
                  },
                });
                await new Promise((resolve) => setTimeout(resolve, 20));
              }
              if (name === "discover_shock_options") {
                // Keep the direct-response path beyond the historical
                // two-second fallback window before returning the real result.
                await new Promise((resolve) => setTimeout(resolve, 2500));
              }
              const reordered = reverseObjectKeys(original);
              hostState.reorderedResultProofs.push({
                toolName: name,
                topLevelBefore: Object.keys(original),
                topLevelAfter: Object.keys(reordered),
                structuredContentBefore: keysAt(original, ["structuredContent"]),
                structuredContentAfter: keysAt(reordered, ["structuredContent"]),
                sessionStateBefore: keysAt(original, ["structuredContent", "sessionState"]),
                sessionStateAfter: keysAt(reordered, ["structuredContent", "sessionState"]),
                sessionStatePayloadPreserved:
                  original.structuredContent?.sessionState?.payload ===
                  reordered.structuredContent?.sessionState?.payload,
                mountId: activeMountId,
              });
              const permanentStructuredContentOnly =
                permanentStructuredContentOnlyFor.includes(name);
              const stripSealedSnapshot =
                stripSealedSnapshotFromDirectFor.includes(name) ||
                (!strippedFirstSealedSnapshot &&
                  name === stripFirstSealedSnapshotFromDirectFor);
              if (
                !strippedFirstSealedSnapshot &&
                name === stripFirstSealedSnapshotFromDirectFor
              ) {
                strippedFirstSealedSnapshot = true;
              }
              const directStructuredContent =
                stripSealedSnapshot &&
                reordered.structuredContent &&
                typeof reordered.structuredContent === "object"
                  ? Object.fromEntries(
                      Object.entries(reordered.structuredContent).filter(
                        ([key]) => key !== "sealedSnapshot",
                      ),
                    )
                  : reordered.structuredContent;
              const directResult = permanentStructuredContentOnly
                ? {
                    ...(reordered.isError === true ? { isError: true } : {}),
                    ...(directStructuredContent === undefined
                      ? {}
                      : { structuredContent: directStructuredContent }),
                  }
                : splitToolResultMetadata && reordered._meta
                  ? Object.fromEntries(
                      Object.entries({
                        ...reordered,
                        structuredContent: directStructuredContent,
                      }).filter(([key]) => key !== "_meta"),
                    )
                  : {
                      ...reordered,
                      structuredContent: directStructuredContent,
                    };
              hostState.directResultProofs.push({
                toolName: name,
                topLevelKeys: Object.keys(directResult),
                structuredContentKeys: keysAt(directResult, ["structuredContent"]),
                hasMetadata: Object.prototype.hasOwnProperty.call(
                  directResult,
                  "_meta",
                ),
                mountId: activeMountId,
              });
              post(event.source, {
                jsonrpc: "2.0",
                id: message.id,
                result: directResult,
              });
              const suppressSplitMetadata =
                permanentStructuredContentOnly ||
                (splitToolResultMetadata &&
                  reordered._meta &&
                  (suppressSplitToolResultMetadataFor.includes(name) ||
                    (!suppressedSplitToolResultMetadata &&
                      name === suppressFirstSplitToolResultMetadataFor)));
              if (suppressSplitMetadata) {
                if (name === suppressFirstSplitToolResultMetadataFor) {
                  suppressedSplitToolResultMetadata = true;
                }
                if (!permanentStructuredContentOnly) {
                  hostState.sentToolNotifications.push({
                    label: "suppressed-split-result:" + name,
                    mountId: activeMountId,
                  });
                }
              } else if (splitToolResultMetadata && reordered._meta) {
                setTimeout(() => {
                  if (!currentFrame || activeMountId !== mountId) return;
                  hostState.sentToolNotifications.push({
                    label: "split-result:" + name,
                    mountId: activeMountId,
                  });
                  post(event.source, {
                    jsonrpc: "2.0",
                    method: "ui/notifications/tool-result",
                    params: reordered,
                  });
                }, toolResultNotificationDelayMs);
              }
            } catch (error) {
              const detail = error instanceof Error ? error.message : String(error);
              hostState.errors.push(detail);
              post(event.source, {
                jsonrpc: "2.0",
                id: message.id,
                error: { code: -32000, message: detail },
              });
            }
            return;
          }

          if (message.method === "sampling/createMessage") {
            hostState.samplingRequests.push({
              params: message.params,
              mountId: activeMountId,
            });
            try {
              const tools = Array.isArray(message.params?.tools)
                ? message.params.tools
                : [];
              if (
                tools.length !== 1 ||
                !tools[0] ||
                typeof tools[0] !== "object" ||
                typeof tools[0].name !== "string"
              ) {
                throw new Error(
                  "ShockAudit sampling acceptance expects one output tool.",
                );
              }
              const draft = await window.__shockAuditRespondToSamplingMessage({
                message: message.params || {},
                samplingIndex: hostState.samplingRequests.length - 1,
              });
              if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
                throw new Error(
                  "The simulated host returned no structured sampling draft.",
                );
              }
              post(event.source, {
                jsonrpc: "2.0",
                id: message.id,
                result: {
                  model: "shockaudit-playwright-simulated-host-model",
                  role: "assistant",
                  stopReason: "toolUse",
                  content: [{
                    type: "tool_use",
                    id: "screen03-sampling-tool-use-" +
                      hostState.samplingRequests.length,
                    name: tools[0].name,
                    input: draft,
                  }],
                },
              });
            } catch (error) {
              const detail = error instanceof Error ? error.message : String(error);
              hostState.errors.push(detail);
              post(event.source, {
                jsonrpc: "2.0",
                id: message.id,
                error: { code: -32000, message: detail },
              });
            }
            return;
          }

          if (message.method === "ui/update-model-context") {
            hostState.modelContextRequests.push({
              params: message.params,
              mountId: activeMountId,
            });
            post(event.source, { jsonrpc: "2.0", id: message.id, result: {} });
            return;
          }

          if (message.method === "ui/message") {
            hostState.messageRequests.push({
              params: message.params,
              mountId: activeMountId,
            });
            try {
              const messageText = Array.isArray(message.params?.content)
                ? message.params.content.find(
                    (item) => item?.type === "text" &&
                      typeof item.text === "string",
                  )?.text
                : null;
              const messageTask = boundedTaskFromPrompt(messageText);
              const latestModelContext = messageTask
                ? { structuredContent: messageTask }
                : hostState.modelContextRequests.at(-1)?.params ?? null;
              const notifications = await window.__shockAuditRespondToHostMessage({
                message: message.params || {},
                latestModelContext,
                messageIndex: hostState.messageRequests.length - 1,
                modelContextIndex: hostState.modelContextRequests.length - 1,
              });
              for (const notification of notifications) {
                hostState.modelToolCalls.push({
                  label: notification.label,
                  name: notification.toolName || "model-tool",
                  arguments: notification.arguments,
                  mountId: activeMountId,
                });
                hostState.events.push({
                  direction: "host-model-to-server",
                  method: "tools/call",
                  label: notification.label,
                  mountId: activeMountId,
                });
                await window.__shockAuditNotifyToolResult(notification);
              }
            } catch (error) {
              const detail = error instanceof Error ? error.message : String(error);
              hostState.errors.push(detail);
              post(event.source, {
                jsonrpc: "2.0",
                id: message.id,
                error: { code: -32000, message: detail },
              });
              return;
            }
            if (messageResponseDelayMs > 0) {
              await new Promise((resolve) =>
                setTimeout(resolve, messageResponseDelayMs),
              );
            }
            post(event.source, {
              jsonrpc: "2.0",
              id: message.id,
              result: { isError: false },
            });
            return;
          }

          if (message.method === "ui/request-display-mode") {
            post(event.source, {
              jsonrpc: "2.0",
              id: message.id,
              result: { mode: message.params.mode },
            });
            return;
          }

          if (message.method === "ping") {
            post(event.source, { jsonrpc: "2.0", id: message.id, result: {} });
          }
        });

        createFrame();
      })();
    </script>
  </body>
</html>`);
}
