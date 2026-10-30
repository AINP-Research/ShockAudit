import { describe, expect, it } from "vitest";

import {
  SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036,
  buildScreen01HostDraftModelContext,
  buildScreen01HostDraftPrompt,
  serializeScreen01HostDraftJson,
} from "../../src/core/screen01-host-draft";
import { fieldKeys } from "../../src/core/scope-types";

describe("Screen 1 ChatGPT-host draft protocol", () => {
  it("keeps the capability out of visible prompt prose and inside bounded structured context", () => {
    const capabilityToken = "sa1-capability-v1.secret-payload.secret-signature";
    const context = buildScreen01HostDraftModelContext({
      operationId: "scope-operation-1",
      requestId: "scope-request-1",
      mode: "audit",
      sentence:
        "I study how the California Consumer Privacy Act affected innovation among California technology firms from 2016 to 2022.",
      capabilityToken,
    });
    const prompt = buildScreen01HostDraftPrompt("audit");

    expect(prompt).not.toContain(capabilityToken);
    expect(prompt).toContain("untrusted user data");
    expect(prompt).toContain(SCREEN_01_HOST_DRAFT_SUBMIT_TOOL_V036);
    expect(context.submission.capabilityToken).toBe(capabilityToken);
    expect(context.requestedScopeKeys).toEqual(fieldKeys);
    expect(context.safetyRules.join(" ")).toContain("Do not browse");
  });

  it("serializes signatures independently of object insertion order and rejects loss", () => {
    expect(serializeScreen01HostDraftJson({ b: 2, a: [true, null] })).toBe(
      serializeScreen01HostDraftJson({ a: [true, null], b: 2 }),
    );
    expect(() => serializeScreen01HostDraftJson({ missing: undefined })).toThrow(
      /losslessly JSON serializable/,
    );
  });
});
