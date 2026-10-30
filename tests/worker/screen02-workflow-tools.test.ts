import { describe, expect, it } from "vitest";

import type { McpServer } from "@modelcontextprotocol/server";
import {
  SCREEN_02_WORKFLOW_ACTION_TOOL_V021,
  SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
} from "../../src/worker/screen02-workflow-controller";
import type { Screen02WorkflowRuntime } from "../../src/worker/screen02-workflow-runtime";
import {
  SCREEN_02_WORKFLOW_RETIRE_TOOL_V021,
  registerScreen02WorkflowTools,
} from "../../src/worker/screen02-workflow-tools";

function registeredToolNames(legacyHostAssessments?: boolean) {
  const names: string[] = [];
  const server = {
    registerTool(name: string) {
      names.push(name);
    },
  } as unknown as McpServer;
  registerScreen02WorkflowTools(server, {} as Screen02WorkflowRuntime, {
    ...(legacyHostAssessments !== undefined
      ? { legacyHostAssessments }
      : {}),
  });
  return names;
}

describe("Screen 2 workflow tool registration", () => {
  it("preserves legacy model-submit tools by default", () => {
    expect(registeredToolNames()).toEqual([
      SCREEN_02_WORKFLOW_RETIRE_TOOL_V021,
      SCREEN_02_WORKFLOW_ACTION_TOOL_V021,
      SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
      "submit_screen02_find_assessment_draft_v021",
      "submit_screen02_audit_draft_v021",
    ]);
  });

  it("keeps app-only saved-widget tools but omits model-submit tools on current routes", () => {
    expect(registeredToolNames(false)).toEqual([
      SCREEN_02_WORKFLOW_RETIRE_TOOL_V021,
      SCREEN_02_WORKFLOW_ACTION_TOOL_V021,
      SCREEN_02_WORKFLOW_ACTION_TOOL_V024,
    ]);
  });
});
