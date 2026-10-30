import { describe, expect, it } from "vitest";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import {
  SIX_SCREEN_RECOVERY_SNAPSHOT_ENCODING,
  SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
  createSixScreenRecoverySnapshot,
  restoreSixScreenRecoverySnapshot,
} from "../../src/core/six-screen/recovery-snapshot";
import { SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID } from
  "../../src/core/six-screen/workflow-response-contract";

const runId = `sa6r_${"r".repeat(43)}`;
const appVersion = "0.6.2";
const uiResourceUri = "ui://shockaudit/recovery-test.html";

function values() {
  const retainedEvidence = Array.from({ length: 160 }, (_, index) => ({
    id: `evidence-${index}`,
    text: `Repeated bounded recovery evidence ${index % 8}. ${"x".repeat(800)}`,
    nullable: null,
  }));
  return {
    state: {
      schemaVersion: "shockaudit-six-screen-workflow-v1",
      runId,
      revision: 8,
      activeScreen: 3,
      retainedEvidence,
    },
    publicProjection: {
      schemaVersion: "shockaudit-six-screen-public-v1",
      runId,
      revision: 8,
      activeScreen: 3,
      statusMessage: "Comparison guidance is ready.",
      retainedEvidence,
      optionalPanel: null,
    },
  };
}

describe("six-screen canonical recovery snapshot", () => {
  it("round trips one compressed canonical state and projection", async () => {
    const input = values();
    const snapshot = await createSixScreenRecoverySnapshot({
      appVersion,
      uiResourceUri,
      ...input,
    });
    const restored = await restoreSixScreenRecoverySnapshot({
      value: JSON.parse(JSON.stringify(snapshot)),
      expectedRunId: runId,
      expectedAppVersion: appVersion,
      expectedUiResourceUri: uiResourceUri,
    });

    expect(snapshot).toMatchObject({
      buildId: SIX_SCREEN_WORKFLOW_RESPONSE_BUILD_ID,
      toolName: SIX_SCREEN_RECOVERY_SNAPSHOT_TOOL,
      encoding: SIX_SCREEN_RECOVERY_SNAPSHOT_ENCODING,
      runId,
      revision: 8,
      stateFingerprint: fingerprintSixScreenValue(input.state),
      publicProjectionFingerprint:
        fingerprintSixScreenValue(input.publicProjection),
    });
    expect(restored.state).toEqual(input.state);
    expect(restored.publicProjection).toEqual(input.publicProjection);
    expect(snapshot.encodedStateBytes +
      snapshot.encodedPublicProjectionBytes).toBeLessThan(
        (snapshot.canonicalStateBytes +
          snapshot.canonicalPublicProjectionBytes) / 8,
      );
  });

  it("rejects coordinate, envelope, and compressed-payload tampering", async () => {
    const snapshot = await createSixScreenRecoverySnapshot({
      appVersion,
      uiResourceUri,
      ...values(),
    });
    const restore = (value: unknown) => restoreSixScreenRecoverySnapshot({
      value,
      expectedRunId: runId,
      expectedAppVersion: appVersion,
      expectedUiResourceUri: uiResourceUri,
    });

    await expect(restore({ ...snapshot, revision: 9 })).rejects.toThrow(
      /invalid contract/iu,
    );
    await expect(restore({
      ...snapshot,
      encodedStatePayload:
        `${snapshot.encodedStatePayload.slice(0, -4)}AAAA`,
    })).rejects.toThrow(/invalid contract/iu);
    await expect(restore({ ...snapshot, undeclared: true })).rejects.toThrow(
      /invalid contract/iu,
    );
  });
});
