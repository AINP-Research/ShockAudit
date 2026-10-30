import { describe, expect, it } from "vitest";

import {
  SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_BYTES,
  SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_LATENCY_MS,
  SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION,
  isScreen02DocumentAcquisition,
  sanitizeScreen02AcquisitionFailureReason,
  sanitizeScreen02AcquisitionUrl,
  type Screen02DocumentAcquisition,
} from "../../src/core/screen02-document-acquisition";

const acquisition = {
  schemaVersion: SCREEN_02_DOCUMENT_ACQUISITION_SCHEMA_VERSION,
  acquisitionId: "screen02-document-1-abcdef",
  candidateId: "candidate-1",
  sourceId: "source-1",
  level: 2,
  requestedUrl: "https://agency.gov/rules/example",
  redirectChain: [{
    status: 302,
    fromUrl: "https://agency.gov/rules/example",
    toUrl: "https://www.agency.gov/rules/example",
  }],
  finalUrl: "https://www.agency.gov/rules/example",
  httpStatus: 200,
  mediaType: "text/html",
  receivedBytes: 240,
  latencyMs: 18,
  parserPath: "official-html-visible-text",
  parserOutcome: "parsed",
  outcome: "succeeded",
  failureReason: null,
} satisfies Screen02DocumentAcquisition;

describe("Screen 2 document-acquisition contract", () => {
  it("accepts only a strict candidate-bound v1 record", () => {
    expect(isScreen02DocumentAcquisition(acquisition)).toBe(true);
    expect(isScreen02DocumentAcquisition({ ...acquisition, extra: true }))
      .toBe(false);
    expect(isScreen02DocumentAcquisition({
      ...acquisition,
      requestedUrl: "https://agency.gov/rules/example?token=secret",
    })).toBe(false);
    expect(isScreen02DocumentAcquisition({
      ...acquisition,
      outcome: "failed",
      failureReason: null,
    })).toBe(false);
    expect(isScreen02DocumentAcquisition({
      ...acquisition,
      receivedBytes: SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_BYTES + 1,
    })).toBe(false);
    expect(isScreen02DocumentAcquisition({
      ...acquisition,
      latencyMs:
        SCREEN_02_DOCUMENT_ACQUISITION_MAX_RECORDED_LATENCY_MS + 1,
    })).toBe(false);
  });

  it("strips credentials, query strings, and fragments from diagnostics", () => {
    expect(sanitizeScreen02AcquisitionUrl(
      "https://user:password@agency.gov/rules/example?token=secret#private",
    )).toBe("https://agency.gov/rules/example");
    expect(sanitizeScreen02AcquisitionUrl("https://localhost./secret"))
      .toBeNull();
    expect(sanitizeScreen02AcquisitionUrl("https://agency.gov:8443/rule"))
      .toBeNull();
    const reason = sanitizeScreen02AcquisitionFailureReason(
      "Fetch https://user:pass@agency.gov/rule?token=secret failed",
    );
    expect(reason).toContain("https://agency.gov/rule");
    expect(reason).not.toMatch(/user|pass|secret/u);
  });
});
