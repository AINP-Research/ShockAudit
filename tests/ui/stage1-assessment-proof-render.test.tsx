import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  STAGE1_DRAFT_SCHEMA_VERSION,
  createStage1ProofOpenResult,
  evaluateStage1AssessmentDraft,
} from "../../src/core/stage1-assessment-proof";
import Stage1AssessmentProof from "../../src/ui/stage1-proof/Stage1AssessmentProof";
import type { Stage1ProofWidgetSnapshot } from "../../src/ui/mcp-bridge";

const preparedAt = "2026-08-09T12:00:00.000Z";
const observedAt = "2026-08-09T12:00:05.000Z";
const open = createStage1ProofOpenResult(
  preparedAt,
  "stage1-proof-render-test-0001",
);

const hostView = {
  connected: true,
  embedded: true,
  displayMode: "fullscreen" as const,
  canFullscreen: true,
  canSendMessage: true,
  canRequestAiReview: true,
};

function render(snapshot: Stage1ProofWidgetSnapshot) {
  return renderToStaticMarkup(
    <Stage1AssessmentProof
      snapshot={snapshot}
      hostView={hostView}
      onRequestAssessment={() => undefined}
      onRequestFullscreen={async () => true}
    />,
  );
}

function resultFor(draft: unknown) {
  return evaluateStage1AssessmentDraft(
    {
      schemaVersion: STAGE1_DRAFT_SCHEMA_VERSION,
      requestId: open.request.requestId,
      candidateId: open.request.candidateId,
      candidateSnapshotId: open.request.candidateSnapshotId,
      candidateFingerprint: open.request.candidateFingerprint,
      requestProof: open.request.requestProof,
      draft,
    },
    observedAt,
  );
}

const goldDraft = {
  studyFit: {
    category: "strong",
    explanation:
      "A policy applying to EU-facing data processing can vary exposure among U.S. public technology firms within the confirmed study boundary.",
    evidenceSourceIds: ["source-eu-gdpr-regulation-2016-679"],
  },
  outcomePathway: {
    category: "plausible",
    explanation:
      "Compliance duties can plausibly redirect engineering and organizational resources relevant to innovation, without asserting an observed outcome.",
    evidenceSourceIds: ["source-eu-gdpr-regulation-2016-679"],
  },
  measurementPotential: {
    category: "possible",
    explanation:
      "EU-facing operations and data-processing footprints may provide observable exposure proxies, subject to later coverage verification.",
    evidenceSourceIds: ["source-eu-gdpr-celex-metadata"],
  },
  mainConcern:
    "The study population is broader than the firms actually covered by GDPR territorial scope, so exposure cannot be assumed from U.S. listing status.",
  nextChecks: [
    "Verify firm-level EU establishment, offering, or monitoring indicators against Article 3 before constructing exposure.",
    "Check whether the resulting exposure measure varies meaningfully across firms and over the study period.",
  ],
};

describe("Stage 1 assessment proof interface", () => {
  it("renders the bounded immutable packet before any model request", () => {
    const html = render({ open, status: "prepared" });

    expect(html).toContain("Stage 1 assessment handshake");
    expect(html).toContain("Preparing the assessment");
    expect(html).toContain("General Data Protection Regulation");
    expect(html).toContain("U.S. publicly listed technology firms");
    expect(html).toContain(
      "European Parliament and Council; European Union",
    );
    expect(html).toContain("Request assessment from ChatGPT");
    expect(html).toContain(open.request.requestId);
    expect(html).toContain(open.request.candidateFingerprint);
    expect(html).not.toContain("Assessment ready.");
  });

  it("does not treat successful message delivery as assessment completion", () => {
    const html = render({
      open,
      status: "message-delivered",
      messageDeliveredAt: observedAt,
    });

    expect(html).toContain("Assessment requested. Waiting for ChatGPT");
    expect(html).toContain(
      "This confirms delivery only; completion still requires the matching model-only tool receipt.",
    );
    expect(html).toContain("Waiting for tool receipt");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Assessment ready.");
  });

  it("renders only a matching fixed-code completion receipt as ready", () => {
    const result = resultFor(goldDraft);
    const html = render({
      open,
      status: "completed",
      messageDeliveredAt: observedAt,
      result,
    });

    expect(result.status).toBe("completed");
    expect(result.candidateBeforeFingerprint).toBe(
      result.candidateAfterFingerprint,
    );
    expect(html).toContain("Assessment ready.");
    expect(html).toContain("Promising to verify");
    expect(html).toContain("Fixed computation");
    expect(html).toContain(result.receiptId);
    expect(html).toContain(result.draftFingerprint);
    expect(html).toContain(result.appliedResultFingerprint);
    expect(html).toContain("Eligible for tentative selection");
    expect(html).not.toContain(">Score<");
  });

  it("shows fixed validation findings without an assessment card", () => {
    const result = resultFor({ ...goldDraft, score: 92 });
    const html = render({ open, status: "rejected", result });

    expect(result.status).toBe("rejected");
    expect(html).toContain(
      "The assessment response was incomplete or invalid.",
    );
    expect(html).toContain("Fixed validation findings");
    expect(html).toContain(
      "The draft must contain only studyFit, outcomePathway, measurementPotential, mainConcern, and nextChecks.",
    );
    expect(html).not.toContain("Early research assessment");
  });
});
