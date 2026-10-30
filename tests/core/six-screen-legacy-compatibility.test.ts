import { describe, expect, it } from "vitest";

import {
  createLegacyReadOnlyExport,
  SIX_SCREEN_LEGACY_EXPORT_MAX_BYTES,
} from "../../src/core/six-screen/legacy-compatibility";

describe("six-screen legacy compatibility", () => {
  it("exports legacy records read-only without promoting a selected event", () => {
    const exported = createLegacyReadOnlyExport({
      modelContent: "not part of the private saved record",
      privateContent: {
        screen01: { population: "Hospitals", confirmed: true },
        screen02: { selectedCandidateId: "candidate-old", title: "Old rule" },
      },
    }, "2026-09-12T10:00:00.000Z");
    expect(exported).toMatchObject({
      disposition: "read_only",
      migration: {
        automaticConversion: false,
        selectedCandidateBecameConfirmedShock: false,
      },
      legacy: {
        screen01: { population: "Hospitals" },
        screen02: { selectedCandidateId: "candidate-old" },
      },
    });
    expect(exported).not.toHaveProperty("confirmedShock");
  });

  it("removes private coordinates and sanitizes credential-bearing URLs", () => {
    const exported = createLegacyReadOnlyExport({
      screen02Workflow: {
        runId: "legacy-run",
        accessToken: "private-token",
        nested: {
          capabilityToken: "private-capability",
          sourceUrl: "https://api.example.gov/doc/1?api_key=private&view=full",
        },
      },
    }, "2026-09-12T10:00:00.000Z");
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain("private-token");
    expect(serialized).not.toContain("private-capability");
    expect(serialized).not.toContain("api_key=private");
    expect(serialized).toContain("api_key=%5Bredacted%5D");
    expect(serialized).toContain("view=full");
  });

  it("rejects missing, circular, and oversized saved state", () => {
    expect(() => createLegacyReadOnlyExport(
      { privateContent: {} },
      "2026-09-12T10:00:00.000Z",
    )).toThrow(/No saved legacy workflow/u);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => createLegacyReadOnlyExport(
      { screen01: circular },
      "2026-09-12T10:00:00.000Z",
    )).toThrow(/circular/u);
    expect(() => createLegacyReadOnlyExport({
      screen01: { value: "x".repeat(SIX_SCREEN_LEGACY_EXPORT_MAX_BYTES) },
    }, "2026-09-12T10:00:00.000Z")).toThrow(/safe export capacity/u);
  });
});
