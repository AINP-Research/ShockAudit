import { describe, expect, it } from "vitest";

import {
  confirmScopeContract,
  createInitialState,
} from "../../src/core/screen01-service";
import { createScreen02AuditState } from "../../src/core/screen02-workflow-state";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import { decisionKeys } from "../../src/core/scope-types";

function confirmedAuditContext(sentence: string) {
  const initial = createInitialState("audit", sentence);
  const result = confirmScopeContract({
    ...initial,
    revision: 1,
    resolvedKeys: [...decisionKeys],
  });
  if (!result.ok) {
    throw new Error(
      `${result.error} ${result.ambiguities
        .map((ambiguity) => `${ambiguity.key}: ${ambiguity.title}`)
        .join(" | ")}`,
    );
  }
  return buildScreen01StudyContext(result.state, result.ambiguities);
}

describe("Screen 2 Audit initial anchor", () => {
  it("preserves the Screen 1 shock wording without injecting event-specific identity facts", () => {
    const sentence =
      "Audit whether the California Consumer Privacy Act of 2018 affected annual profitability among European public technology firms from 2017 to 2023.";
    const state = createScreen02AuditState(
      confirmedAuditContext(sentence),
      "audit-initial-ccpa-anchor",
      "2026-08-12T12:00:00.000Z",
    );
    const anchor = state.anchor.revisions[0]!.fields;

    expect(state.anchor.originalWording).toBe(
      state.screen01Baseline.knownShock,
    );
    expect(state.screen01Baseline.scopeContract).toMatchObject({
      geography: "Europe",
      studyPeriod: "2017–2023",
    });
    expect(anchor).toMatchObject({
      shockName: "California Consumer Privacy Act",
      jurisdiction: null,
      issuingAuthority: null,
      approximateYear: null,
      versionType: "unspecified",
    });
    expect(state.anchor.revisions[0]!.reason).toContain(
      "source retrieval must resolve every identity field",
    );
  });

  it("does not turn the study geography into an unreviewed event jurisdiction", () => {
    const sentence =
      "Audit whether the Lakeview Data Privacy Regulation of 2024 affected annual profitability among U.S. public technology firms from 2023 to 2025.";
    const state = createScreen02AuditState(
      confirmedAuditContext(sentence),
      "audit-unreviewed-anchor",
      "2026-08-12T12:00:00.000Z",
    );
    const anchor = state.anchor.revisions[0]!.fields;

    expect(state.anchor.originalWording).toBe(
      state.screen01Baseline.knownShock,
    );
    expect(state.screen01Baseline.scopeContract.geography).toBe(
      "United States",
    );
    expect(anchor.jurisdiction).toBeNull();
    expect(anchor.issuingAuthority).toBeNull();
    expect(anchor.versionType).toBe("unspecified");
  });
});
