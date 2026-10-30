import type { Screen01StudyContext } from "./scope-types";
import type { DeepReadonly } from "./screen02-types";

export const SCREEN02_DISCOVERY_FORMULA_VERSION =
  "screen-02-discovery-v1" as const;

/**
 * Builds the exact outcome-blind query recorded by the empty initial Screen 2
 * round. Profile expansion and researcher preferences begin only in later
 * discovery rounds.
 */
export function buildInitialScreen02DiscoveryQuery(
  context: Screen01StudyContext | DeepReadonly<Screen01StudyContext>,
) {
  const parts = [
    context.startingPoint === "audit" ? context.knownShock : "",
    context.scopeContract.population,
    context.scopeContract.assignmentLevel,
    context.scopeContract.analysisLevel,
    context.scopeContract.geography,
    context.scopeContract.industry,
    context.scopeContract.studyPeriod,
    context.scopeContract.eventFamily,
  ];
  return parts.filter(Boolean).join(" ");
}
