import { describe, expect, it } from "vitest";

import {
  attachHostTaskTransport,
  restoreHostTaskTransport,
  sameHostTaskTransportValue,
} from "../../src/core/host-task-transport";

function removeNullObjectProperties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeNullObjectProperties);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== null)
      .map(([key, item]) => [key, removeNullObjectProperties(item)]));
  }
  return value;
}

describe("host-task canonical transport", () => {
  it("restores only host-elided null object fields", () => {
    const canonical = {
      schemaVersion: "example-v1",
      task: {
        selectedEventId: null,
        result: { candidates: [{ perspective: null, label: "Trust" }] },
      },
      outcomeValuesInspected: false,
    };
    const transported = attachHostTaskTransport(canonical, "status");
    const normalized = removeNullObjectProperties(transported);
    expect(restoreHostTaskTransport(normalized, "status")?.value)
      .toStrictEqual(canonical);
    expect(sameHostTaskTransportValue(transported, normalized)).toBe(true);
  });

  it("fails closed for removed non-null fields and changed values", () => {
    const transported = attachHostTaskTransport({
      schemaVersion: "example-v1",
      taskId: "task-one",
      failureCode: null,
    }, "status");
    const removed = structuredClone(transported) as Record<string, unknown>;
    delete removed.taskId;
    expect(restoreHostTaskTransport(removed, "status")).toBeNull();

    const changed = structuredClone(transported);
    changed.taskId = "task-two";
    expect(restoreHostTaskTransport(changed, "status")).toBeNull();
  });

  it("rejects mismatched, corrupted, and conflicting canonical bodies", () => {
    const transported = attachHostTaskTransport({
      schemaVersion: "example-v1",
      failureCode: null,
    }, "status");
    expect(restoreHostTaskTransport(transported, "cancel")).toBeNull();

    const forged = structuredClone(transported);
    forged.transport.canonicalPayload = forged.transport.canonicalPayload
      .replace("example-v1", "example-v2");
    expect(restoreHostTaskTransport(forged, "status")).toBeNull();

    const corruptFingerprint = structuredClone(transported);
    corruptFingerprint.transport.canonicalFingerprint =
      "fnv1a64:ffffffffffffffff";
    expect(restoreHostTaskTransport(corruptFingerprint, "status")).toBeNull();

    const undeclared = structuredClone(transported) as Record<string, unknown>;
    undeclared.unexpected = null;
    expect(restoreHostTaskTransport(undeclared, "status")).toBeNull();
  });

  it("continues to accept exact legacy values without normalizing them", () => {
    const legacy = { schemaVersion: "legacy-v1", nullable: null };
    expect(restoreHostTaskTransport(legacy)).toEqual({
      value: legacy,
      transported: false,
      kind: null,
    });
  });
});
