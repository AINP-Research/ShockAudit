import { describe, expect, it } from "vitest";

import manifest from "../../scripts/production-matrix-cases.json";
import { confirmScopeContract } from "../../src/core/screen01-service";
import { buildScreen01StudyContext } from "../../src/core/study-context";
import { decisionKeys, fieldKeys, type ScopeContract } from "../../src/core/scope-types";

describe("production matrix Scope Contracts through the released producer", () => {
  for (const suite of ["screen2", "screen3"] as const) {
    for (const input of manifest[suite]) {
      it(`confirms the exact declared scope for ${input.caseId}`, () => {
        const mode = suite === "screen2" ? "find" : "audit";
        const knownShock = "anchor" in input ? input.anchor.shockName : "";
        const result = confirmScopeContract({
          revision: 1,
          mode,
          sentence: input.sentence,
          contractSourceSentence: input.sentence,
          scope: input.scope as ScopeContract,
          knownShock,
          resolvedKeys: mode === "audit" ? [...decisionKeys] : [...fieldKeys],
          acknowledgedDifferences: [],
          scopeDirty: false,
        });
        expect(result.ok, result.error).toBe(true);
        expect(result.state.scope).toEqual(input.scope);
        const context = buildScreen01StudyContext(result.state, result.ambiguities);
        expect(context.readyForLaterScreens).toBe(true);
        expect(context.scopeContract).toEqual(input.scope);
        expect(context.unresolvedDecisions).toEqual([]);
      });
    }
  }
});
