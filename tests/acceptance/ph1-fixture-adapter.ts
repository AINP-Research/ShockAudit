import { readFileSync } from "node:fs";

import { z } from "zod";

import { fingerprintSixScreenValue } from
  "../../src/core/six-screen/canonical";
import type { SixScreenWorkflowState } from
  "../../src/core/six-screen/contracts";
import { validateStudyFirstEventInvestigationCollections } from
  "../../src/core/six-screen/study-first-event-investigation";
import { openScreen3, openScreen4 } from
  "../../src/core/six-screen/workflow";
import {
  SIX_SCREEN_WORKFLOW_PRIVATE_SCHEMA_VERSION,
  type SixScreenWorkflowPrivateSnapshot,
} from "../../src/worker/six-screen-workflow-runtime";
import {
  browserEventCardFixtureAccessToken,
  browserEventCardFixtureAt,
  createBrowserEventCardFixture,
} from "../browser/six-screen-event-card-review-fixture";

const acceptanceCaseSchema = z.object({
  id: z.string().regex(/^AC\d{3}$/u),
  title: z.string().min(1),
  fixture_ids: z.array(z.string().regex(/^FX\d{2}$/u)),
  mutation_ids: z.array(z.string().regex(/^MU\d{2}$/u)),
  assertions: z.array(z.string().min(1)).min(1),
}).passthrough();

const syntheticFixtureSchema = z.object({
  id: z.string().regex(/^FX\d{2}$/u),
  title: z.string().min(1),
  kind: z.string().min(1),
  production_compatible: z.boolean(),
}).passthrough();

const syntheticMutationSchema = z.object({
  id: z.string().regex(/^MU\d{2}$/u),
  operation: z.string().min(1),
  requiredOutcome: z.string().min(1),
}).passthrough();

const acceptanceDocumentSchema = z.object({
  schema: z.literal("shockaudit-handoff-acceptance-v1"),
  cases: z.array(acceptanceCaseSchema).min(1),
});

const syntheticDocumentSchema = z.object({
  schema: z.literal("shockaudit-handoff-fixtures-v1"),
  synthetic: z.literal(true),
  provider_calls_authorized: z.literal(false),
  fixtures: z.array(syntheticFixtureSchema).min(1),
  mutations: z.array(syntheticMutationSchema).min(1),
});

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const acceptanceDocument = acceptanceDocumentSchema.parse(readJson(
  "./handoff/09-acceptance-cases.json",
));
const syntheticDocument = syntheticDocumentSchema.parse(readJson(
  "./handoff/10-synthetic-fixtures.json",
));

function uniqueIndex<T extends { id: string }>(values: T[], label: string) {
  const indexed = new Map(values.map((value) => [value.id, value]));
  if (indexed.size !== values.length) {
    throw new Error(`${label} contains duplicate IDs.`);
  }
  return indexed;
}

const acceptanceCases = uniqueIndex(acceptanceDocument.cases,
  "Acceptance document");
const syntheticFixtures = uniqueIndex(syntheticDocument.fixtures,
  "Synthetic fixture document");
const syntheticMutations = uniqueIndex(syntheticDocument.mutations,
  "Synthetic mutation document");

export function acceptanceCase(id: string) {
  const value = acceptanceCases.get(id);
  if (!value) throw new Error(`Acceptance case ${id} is missing.`);
  return value;
}

export function syntheticFixture(id: string) {
  const value = syntheticFixtures.get(id);
  if (!value) throw new Error(`Synthetic fixture ${id} is missing.`);
  return value;
}

export function syntheticMutation(id: string) {
  const value = syntheticMutations.get(id);
  if (!value) throw new Error(`Synthetic mutation ${id} is missing.`);
  return value;
}

/**
 * The handoff JSON is a declarative test-domain specification. This adapter
 * deliberately never coerces those objects into production workflow state.
 * Instead it uses current production constructors over an existing validated
 * repository fixture, then validates the added Screen 4 collection.
 */
export function createValidatedStudyFirstScenario() {
  const fixture = createBrowserEventCardFixture();
  const screen3State = openScreen3(fixture.state, {
    expectedRevision: fixture.state.revision,
    study: {
      population: "U.S. public energy firms",
      analysisUnit: "firm-year",
      geography: ["United States", "California"],
      industry: ["Energy"],
      period: { start: "2018", end: "2024" },
      outcome: "Firm performance",
      outcomeMeasure: "Return on assets",
      intendedConstruct: null,
      policySideConcept: "Participation flexibility",
      initialExplanation: "Market access can change operations.",
      proposedTreatment: "California firms",
      proposedComparison: "Other U.S. firms",
      resultsPreviouslyInspected: "not_disclosed",
    },
    proposedTiming: {
      mode: "year",
      year: 2020,
      milestoneReference: null,
    },
    openedAt: browserEventCardFixtureAt(40),
  }).state;
  const screen4State = openScreen4(screen3State, {
    expectedRevision: screen3State.revision,
    openedAt: browserEventCardFixtureAt(41),
  }).state;
  const plannedInvestigation = screen4State.studyFirstEventInvestigations?.at(-1);
  if (!plannedInvestigation) {
    throw new Error("Production Screen 4 constructor did not create an investigation.");
  }
  validateStudyFirstEventInvestigationCollections({
    investigations: screen4State.studyFirstEventInvestigations,
    handoffs: screen4State.studyFirstEventScreen5Handoffs,
  });
  return {
    fixture,
    screen3State,
    screen4State,
    plannedInvestigation,
  };
}

export function privateSnapshot(
  state: SixScreenWorkflowState,
): SixScreenWorkflowPrivateSnapshot {
  return {
    schemaVersion: SIX_SCREEN_WORKFLOW_PRIVATE_SCHEMA_VERSION,
    runId: state.runId,
    accessToken: browserEventCardFixtureAccessToken,
    revision: state.revision,
    stateFingerprint: fingerprintSixScreenValue(state),
    state: structuredClone(state),
  };
}
