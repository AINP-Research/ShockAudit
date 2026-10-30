import { describe, expect, it } from "vitest";

import {
  canonicalScreen02FederalRegisterFormalIdentifier,
  isScreen02ContextOfficialBridgeProvenance,
  screen02FederalRegisterBridgeQueryMatchesIdentifier,
  screen02VisibleTitleFederalRegisterIdentifier,
} from "../../src/core/screen02-context-bridge";

const baseBridge = {
  schemaVersion: "screen-02-context-official-bridge-v1" as const,
  contextualLeadId: "context-lead-x",
  bridgeQueryId: "official-query-x",
  formalIdentifier: "2020-12345",
  returnedOfficialRecordIds: ["2020-12345"],
  status: "corroborated" as const,
};

describe("Screen 2 contextual-to-official bridge provenance", () => {
  it("canonicalizes compatibility forms but rejects noncanonical identifiers", () => {
    expect(canonicalScreen02FederalRegisterFormalIdentifier("2020-12345"))
      .toBe("2020-12345");
    expect(canonicalScreen02FederalRegisterFormalIdentifier("２０２０－１２３４５"))
      .toBe("2020-12345");
    expect(canonicalScreen02FederalRegisterFormalIdentifier(" 2020-12345"))
      .toBeNull();
    expect(canonicalScreen02FederalRegisterFormalIdentifier("FR Doc. 2020-12345"))
      .toBeNull();
    expect(canonicalScreen02FederalRegisterFormalIdentifier("2020-123"))
      .toBeNull();
  });

  it("extracts one visible identifier and rejects absent or ambiguous titles", () => {
    expect(screen02VisibleTitleFederalRegisterIdentifier(
      "Study of Federal Register 2020-12345",
    )).toBe("2020-12345");
    expect(screen02VisibleTitleFederalRegisterIdentifier(
      "Study compares 2020-12345 with 2021-54321",
    )).toBeNull();
    expect(screen02VisibleTitleFederalRegisterIdentifier(
      "Study without an official document number",
    )).toBeNull();
  });

  it("binds the bridge query URL to the exact canonical identifier", () => {
    const exactQuery =
      "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=2020-12345&per_page=5";
    expect(screen02FederalRegisterBridgeQueryMatchesIdentifier(
      exactQuery,
      "2020-12345",
    )).toBe(true);
    expect(screen02FederalRegisterBridgeQueryMatchesIdentifier(
      exactQuery.replace("2020-12345", "2020-54321"),
      "2020-12345",
    )).toBe(false);
    expect(screen02FederalRegisterBridgeQueryMatchesIdentifier(
      exactQuery.replace("www.federalregister.gov", "federalregister.gov"),
      "2020-12345",
    )).toBe(false);
    expect(screen02FederalRegisterBridgeQueryMatchesIdentifier(
      `${exactQuery}&conditions%5Bterm%5D=2020-54321`,
      "2020-12345",
    )).toBe(false);
  });

  it("accepts exact X-to-X corroboration and empty negative outcomes", () => {
    expect(isScreen02ContextOfficialBridgeProvenance(baseBridge)).toBe(true);
    expect(isScreen02ContextOfficialBridgeProvenance({
      ...baseBridge,
      returnedOfficialRecordIds: [],
      status: "no-corroboration",
    })).toBe(true);
    expect(isScreen02ContextOfficialBridgeProvenance({
      ...baseBridge,
      returnedOfficialRecordIds: [],
      status: "failed",
    })).toBe(true);
  });

  it("rejects X-to-Y, invalid-X, and false empty corroboration", () => {
    expect(isScreen02ContextOfficialBridgeProvenance({
      ...baseBridge,
      returnedOfficialRecordIds: ["2020-54321"],
    })).toBe(false);
    expect(isScreen02ContextOfficialBridgeProvenance({
      ...baseBridge,
      formalIdentifier: "FR Doc. 2020-12345",
      returnedOfficialRecordIds: ["FR Doc. 2020-12345"],
    })).toBe(false);
    expect(isScreen02ContextOfficialBridgeProvenance({
      ...baseBridge,
      returnedOfficialRecordIds: [],
    })).toBe(false);
  });
});
