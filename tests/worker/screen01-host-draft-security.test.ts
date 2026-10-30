import { describe, expect, it } from "vitest";

import {
  SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
  isScreen01HostDraftPreparedTask,
} from "../../src/core/screen01-host-draft";
import type { Screen01State } from "../../src/core/scope-types";
import {
  applySignedScreen01HostDraftReceipt,
  createScreen01HostDraftTask,
  createSignedScreen01HostDraftReceipt,
  type Screen01HostDraftSigningConfig,
} from "../../src/worker/screen01-host-draft-security";

const signingConfig: Screen01HostDraftSigningConfig = {
  keyId: "screen01-host-test-key",
  key: "0123456789abcdef0123456789abcdef",
};
const issuedAt = "2026-08-15T18:00:00.000Z";
const receivedAt = "2026-08-15T18:00:15.000Z";
const appliedAt = "2026-08-15T18:00:30.000Z";

function sourceState(mode: "find" | "audit" = "audit"): Screen01State {
  const sentence =
    mode === "audit"
      ? "I study how the California Consumer Privacy Act affected innovation among California technology firms from 2016 to 2022."
      : "I study regulation-driven innovation among California technology firms from 2016 to 2022.";
  return {
    revision: 7,
    mode,
    sentence,
    contractSourceSentence: sentence,
    scope: {
      population: "California technology firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "California",
      industry: "Technology",
      studyPeriod: "2016–2022",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Not specified",
    },
    knownShock:
      mode === "audit" ? "California Consumer Privacy Act" : "",
    resolvedKeys: [],
    scopeDirty: false,
    confirmed: false,
  };
}

function proposal(mode: "find" | "audit" = "audit") {
  return {
    scope: {
      population: "California technology firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "California",
      industry: "Technology",
      studyPeriod: "2016–2022",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Not specified",
    },
    knownShock:
      mode === "audit" ? "California Consumer Privacy Act" : "",
  };
}

async function issued(mode: "find" | "audit" = "audit") {
  return createScreen01HostDraftTask(
    {
      sourceState: sourceState(mode),
      operationId: "screen01-operation-1",
      requestId: "screen01-request-1",
      capabilityId: "screen01-capability-1",
      issuedAt,
    },
    signingConfig,
  );
}

describe("Screen 1 signed ChatGPT-host draft transport", () => {
  it("binds one exact snapshot and applies an unconfirmed successor for user review", async () => {
    const task = await issued();
    expect(task.task.modelContext.submission.capabilityToken).toBe(
      task.capabilityToken,
    );
    expect(task.task.prompt).not.toContain(task.capabilityToken);
    expect(task.task.sourceStateDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(isScreen01HostDraftPreparedTask(task.task)).toBe(true);
    expect(
      isScreen01HostDraftPreparedTask({ ...task.task, unexpected: true }),
    ).toBe(false);

    const signed = await createSignedScreen01HostDraftReceipt(
      {
        submission: {
          schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: task.capabilityToken,
          requestId: "screen01-request-1",
          draft: proposal(),
        },
        receiptId: "screen01-receipt-1",
        receivedAt,
      },
      signingConfig,
    );
    const applied = await applySignedScreen01HostDraftReceipt(
      {
        sourceState: sourceState(),
        operationId: "screen01-operation-1",
        receiptToken: signed.receiptToken,
        appliedAt,
      },
      signingConfig,
    );

    expect(applied.proposedState).toMatchObject({
      revision: 8,
      confirmed: false,
      scopeDirty: false,
      resolvedKeys: [],
      knownShock: "California Consumer Privacy Act",
    });
    expect(applied.proposedState).not.toHaveProperty("hostDraft");
    expect(applied.message).toContain("Review");
  });

  it("rejects token tampering, mismatched requests, and stale source snapshots", async () => {
    const task = await issued();
    const last = task.capabilityToken.at(-1)!;
    const tampered = `${task.capabilityToken.slice(0, -1)}${
      last === "A" ? "B" : "A"
    }`;
    await expect(
      createSignedScreen01HostDraftReceipt(
        {
          submission: {
            schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
            capabilityToken: tampered,
            requestId: "screen01-request-1",
            draft: proposal(),
          },
          receiptId: "screen01-receipt-bad",
          receivedAt,
        },
        signingConfig,
      ),
    ).rejects.toThrow(/authentication|base64url/);

    await expect(
      createSignedScreen01HostDraftReceipt(
        {
          submission: {
            schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
            capabilityToken: task.capabilityToken,
            requestId: "wrong-request",
            draft: proposal(),
          },
          receiptId: "screen01-receipt-bad",
          receivedAt,
        },
        signingConfig,
      ),
    ).rejects.toThrow(/request ID does not match/);

    const signed = await createSignedScreen01HostDraftReceipt(
      {
        submission: {
          schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
          capabilityToken: task.capabilityToken,
          requestId: "screen01-request-1",
          draft: proposal(),
        },
        receiptId: "screen01-receipt-1",
        receivedAt,
      },
      signingConfig,
    );
    const changed = {
      ...sourceState(),
      scope: { ...sourceState().scope, industry: "Healthcare" },
    };
    await expect(
      applySignedScreen01HostDraftReceipt(
        {
          sourceState: changed,
          operationId: "screen01-operation-1",
          receiptToken: signed.receiptToken,
          appliedAt,
        },
        signingConfig,
      ),
    ).rejects.toThrow(/changed while ChatGPT was drafting/);
  });

  it("fails closed on expiry, extra proposal fields, and a Find shock injection", async () => {
    const auditTask = await issued();
    await expect(
      createSignedScreen01HostDraftReceipt(
        {
          submission: {
            schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
            capabilityToken: auditTask.capabilityToken,
            requestId: "screen01-request-1",
            draft: { ...proposal(), extra: "not allowed" },
          },
          receiptId: "screen01-receipt-extra",
          receivedAt,
        },
        signingConfig,
      ),
    ).rejects.toThrow(/exactly scope and knownShock/);

    await expect(
      createSignedScreen01HostDraftReceipt(
        {
          submission: {
            schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
            capabilityToken: auditTask.capabilityToken,
            requestId: "screen01-request-1",
            draft: proposal(),
          },
          receiptId: "screen01-receipt-expired",
          receivedAt: "2026-08-15T18:03:00.000Z",
        },
        signingConfig,
      ),
    ).rejects.toThrow(/not active/);

    const findTask = await issued("find");
    await expect(
      createSignedScreen01HostDraftReceipt(
        {
          submission: {
            schemaVersion: SCREEN_01_HOST_DRAFT_SUBMISSION_SCHEMA_VERSION,
            capabilityToken: findTask.capabilityToken,
            requestId: "screen01-request-1",
            draft: {
              ...proposal("find"),
              knownShock: "California Consumer Privacy Act",
            },
          },
          receiptId: "screen01-receipt-find",
          receivedAt,
        },
        signingConfig,
      ),
    ).rejects.toThrow(/must return an empty knownShock/);
  });
});
