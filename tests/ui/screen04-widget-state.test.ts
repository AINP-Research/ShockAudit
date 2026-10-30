import { describe, expect, it } from "vitest";

import { fingerprintScreen03Value } from
  "../../src/core/screen03-workflow";
import {
  SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
  type Screen04EventCardBinding,
} from "../../src/core/screen04-event-card-binding";
import { createScreen04WorkflowState } from
  "../../src/core/screen04-workflow";
import {
  SCREEN_04_LEGACY_WIDGET_SCHEMA_VERSION,
  SCREEN_04_WIDGET_SCHEMA_VERSION,
  restoreScreen04WorkflowWidgetSnapshot,
} from "../../src/ui/screen-04/screen04-widget-state";

function binding(): Screen04EventCardBinding {
  const value = {
    schemaVersion: SCREEN_04_EVENT_CARD_BINDING_SCHEMA_VERSION,
    screen02: {
      runId: "screen02-run",
      mode: "find" as const,
      selectedEventId: "selected-event",
      selectedEventFingerprint: "fnv1a64:1111111111111111",
      handoffFingerprint: "fnv1a64:2222222222222222",
    },
    screen03: {
      runId: "screen03-run",
      stateFingerprint: "fnv1a64:3333333333333333",
    },
    eventCard: {
      id: "screen03:screen03-run:event-card",
      version: "locked-at:2026-09-03T00:00:00.000Z",
      fingerprint: "fnv1a64:4444444444444444",
      lockedAt: "2026-09-03T00:00:00.000Z",
    },
    verifiedShockName: "Verified shock",
    verifiedTimeline: [],
    focalClock: { selected: null, alternatives: [] },
    assignmentUnit: [],
    geographicCoverage: [],
    eligibilityConditions: [],
    thresholds: [],
    exemptions: [],
    treatmentComponents: [],
    amendmentsAndVersions: [],
    exposureDimensions: [],
    unresolvedLimitations: {
      gaps: [],
      unknownProposalIds: [],
      rejectedProposalIds: [],
      unsupportedProposalIds: [],
      uncertainties: [],
    },
    compilerLimitations: [],
    linkedEvidenceIds: [],
  };
  return {
    ...value,
    bindingFingerprint: fingerprintScreen03Value(value),
  };
}

function auditBundle() {
  return {
    schemaVersion: "shockaudit-host-reasoning-run-audit-bundle-v1" as const,
    type: "host-reasoning-run-audit-bundle" as const,
    runId: "screen02-run",
    includedTaskCount: 0,
    truncated: false,
    tasks: [],
    outcomeValuesInspected: false as const,
  };
}

describe("Screen 4 private host-audit cache binding", () => {
  it("restores an audit only with its exact Event Card binding fingerprint", () => {
    const state = createScreen04WorkflowState(
      binding(),
      "screen04-run",
      "2026-09-03T00:00:01.000Z",
    );
    const restored = restoreScreen04WorkflowWidgetSnapshot({
      schemaVersion: SCREEN_04_WIDGET_SCHEMA_VERSION,
      state,
      activeScreen: 4,
      hostReasoningTaskAudit: auditBundle(),
      hostReasoningTaskAuditBindingFingerprint:
        state.eventCardBinding.bindingFingerprint,
    });
    expect(restored).toMatchObject({
      schemaVersion: SCREEN_04_WIDGET_SCHEMA_VERSION,
      activeScreen: 4,
      hostReasoningTaskAudit: { runId: "screen02-run" },
      hostReasoningTaskAuditBindingFingerprint:
        state.eventCardBinding.bindingFingerprint,
    });
  });

  it("rejects an unbound, mismatched, or legacy injected audit", () => {
    const state = createScreen04WorkflowState(
      binding(),
      "screen04-run",
      "2026-09-03T00:00:01.000Z",
    );
    const base = {
      schemaVersion: SCREEN_04_WIDGET_SCHEMA_VERSION,
      state,
      activeScreen: 4,
      hostReasoningTaskAudit: auditBundle(),
    };
    expect(restoreScreen04WorkflowWidgetSnapshot(base)).toBeNull();
    expect(restoreScreen04WorkflowWidgetSnapshot({
      ...base,
      hostReasoningTaskAuditBindingFingerprint:
        "fnv1a64:0000000000000000",
    })).toBeNull();
    expect(restoreScreen04WorkflowWidgetSnapshot({
      ...base,
      schemaVersion: SCREEN_04_LEGACY_WIDGET_SCHEMA_VERSION,
      hostReasoningTaskAuditBindingFingerprint:
        state.eventCardBinding.bindingFingerprint,
    })).toBeNull();
  });

  it("keeps legacy snapshots without host-audit material compatible", () => {
    const state = createScreen04WorkflowState(
      binding(),
      "screen04-run",
      "2026-09-03T00:00:01.000Z",
    );
    expect(restoreScreen04WorkflowWidgetSnapshot({
      schemaVersion: SCREEN_04_LEGACY_WIDGET_SCHEMA_VERSION,
      state,
      activeScreen: 3,
    })).toMatchObject({
      schemaVersion: SCREEN_04_WIDGET_SCHEMA_VERSION,
      activeScreen: 3,
    });
  });
});
