import { describe, expect, it } from "vitest";

import {
  SCREEN_03_HOST_DRAFT_RECEIPT_NOTICE_SCHEMA_VERSION,
  isScreen03HostDraftReceiptNotice,
} from "../../src/core/screen03-host-draft-client";

describe("Screen 3 host-draft receipt transport", () => {
  const rejectedReceipt = {
    schemaVersion: SCREEN_03_HOST_DRAFT_RECEIPT_NOTICE_SCHEMA_VERSION,
    phase: "canonical-receipt-result",
    runId: `s2r_${"a".repeat(43)}`,
    requestId: "s3h_request_rejected-draft",
    disposition: "rejected",
    reason:
      "The explanation could not be safely grounded in the bounded sources.",
  } as const;

  it("accepts an exact authenticated semantic-rejection receipt", () => {
    expect(isScreen03HostDraftReceiptNotice(rejectedReceipt)).toBe(true);
  });

  it("rejects spoofed or extended semantic-rejection receipts", () => {
    expect(isScreen03HostDraftReceiptNotice({
      ...rejectedReceipt,
      runId: "unbound-run",
    })).toBe(false);
    expect(isScreen03HostDraftReceiptNotice({
      ...rejectedReceipt,
      untrustedDetail: "hidden validator output",
    })).toBe(false);
  });
});
