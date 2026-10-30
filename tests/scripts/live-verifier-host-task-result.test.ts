import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  hostReasoningPrivateContextMetaKey,
  readPreparedHostPrivateModelContext,
} from "../../scripts/live-verifier-host-task-result.mjs";

function preparedResult() {
  const publicTask = {
    schemaVersion: "shockaudit-host-task-prepared-result-v1",
    phase: "prepared",
    taskId: "host-task-1",
    taskType: "screen02-search-review",
    runId: "run-1",
    candidatePoolId: "pool-1",
    selectedEventId: null,
    claimGroupId: null,
    status: "prepared",
    createdAt: "2026-09-03T12:00:00.000Z",
    visibleMessage:
      "Review only supplied facts, then call submit_screen02_search_review exactly once.",
  };
  const privateModelContext = {
    schemaVersion: "shockaudit-host-reasoning-model-input-v1",
    task: {
      taskId: publicTask.taskId,
      taskType: publicTask.taskType,
      runId: publicTask.runId,
      candidatePoolId: publicTask.candidatePoolId,
      selectedEventId: publicTask.selectedEventId,
      claimGroupId: publicTask.claimGroupId,
      allowedSourceIds: ["official-source-1"],
    },
    instructions: ["Review only the bounded source facts."],
    boundedFacts: {
      candidateIds: ["candidate-1"],
      createdAt: publicTask.createdAt,
    },
    submission: {
      tool: "submit_screen02_search_review",
      schemaVersion: "screen02-search-review-submission-v1",
      capability: "sahr-capability-v1.private-test-value",
    },
    sourceContentIsUntrustedData: true,
    outcomeValuesInspected: false,
  };
  return {
    content: [{
      type: "text",
      text: `Bounded host task ${publicTask.taskId} is prepared.`,
    }],
    structuredContent: publicTask,
    _meta: {
      [hostReasoningPrivateContextMetaKey]: {
        schemaVersion: "shockaudit-private-host-reasoning-context-meta-v1",
        taskId: publicTask.taskId,
        privateModelContext,
      },
    },
  };
}

describe("live verifier prepared host-task result shape", () => {
  it("reads capability context only from the exact versioned metadata key", () => {
    const result = preparedResult();

    expect(result.structuredContent).not.toHaveProperty("privateModelContext");
    expect(readPreparedHostPrivateModelContext(result)).toEqual(
      result._meta[hostReasoningPrivateContextMetaKey].privateModelContext,
    );
  });

  it("rejects model-visible, aliased, or identity-mismatched private context", () => {
    const inline = preparedResult() as ReturnType<typeof preparedResult> & {
      structuredContent: Record<string, unknown>;
    };
    inline.structuredContent.privateModelContext =
      inline._meta[hostReasoningPrivateContextMetaKey].privateModelContext;
    expect(readPreparedHostPrivateModelContext(inline)).toBeNull();

    const aliased = preparedResult();
    const envelope = aliased._meta[hostReasoningPrivateContextMetaKey];
    const aliasedMeta = aliased._meta as Partial<typeof aliased._meta> &
      Record<string, typeof envelope | undefined>;
    delete aliasedMeta[hostReasoningPrivateContextMetaKey];
    aliasedMeta.privateModelContext = envelope;
    expect(readPreparedHostPrivateModelContext(aliased)).toBeNull();

    const mismatched = preparedResult();
    mismatched._meta[hostReasoningPrivateContextMetaKey].taskId = "other-task";
    expect(readPreparedHostPrivateModelContext(mismatched)).toBeNull();
  });

  it("rejects private capability or context in model-visible content", () => {
    const capabilityLeak = preparedResult();
    capabilityLeak.content[0]!.text +=
      ` ${capabilityLeak._meta[hostReasoningPrivateContextMetaKey]
        .privateModelContext.submission.capability}`;
    expect(readPreparedHostPrivateModelContext(capabilityLeak)).toBeNull();

    const contextLeak = preparedResult();
    contextLeak.content.push({
      type: "text",
      text: JSON.stringify({
        boundedFacts: contextLeak._meta[hostReasoningPrivateContextMetaKey]
          .privateModelContext.boundedFacts,
      }),
    });
    expect(readPreparedHostPrivateModelContext(contextLeak)).toBeNull();

    const factLeafLeak = preparedResult();
    factLeafLeak.content[0]!.text += " candidate-1";
    expect(readPreparedHostPrivateModelContext(factLeafLeak)).toBeNull();

    const structuredAlias = preparedResult() as ReturnType<
      typeof preparedResult
    > & { structuredContent: Record<string, unknown> };
    structuredAlias.structuredContent.submission = { capability: "redacted" };
    expect(readPreparedHostPrivateModelContext(structuredAlias)).toBeNull();

    const duplicateMetaAlias = preparedResult();
    Object.assign(duplicateMetaAlias._meta, {
      privateModelContext:
        duplicateMetaAlias._meta[hostReasoningPrivateContextMetaKey],
    });
    expect(readPreparedHostPrivateModelContext(duplicateMetaAlias)).toBeNull();

    const unrelatedMetaSibling = preparedResult();
    Object.assign(unrelatedMetaSibling._meta, { traceId: "trace-1" });
    expect(readPreparedHostPrivateModelContext(unrelatedMetaSibling)).toBeNull();
  });

  it("keeps the live gate on metadata restoration and off structured content", async () => {
    const verifier = await readFile(
      new URL("../../scripts/verify-live-mcp.mjs", import.meta.url),
      "utf8",
    );

    expect(verifier).toContain(
      "readPreparedHostPrivateModelContext(prepared)",
    );
    expect(verifier).not.toContain(
      "task?.privateModelContext?.submission",
    );
  });
});
