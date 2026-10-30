/**
 * Transparent review heuristics for the Screen 4 natural-experiment sample
 * assessment. These are cautions, never causal-validity rules.
 */
export const SCREEN_04_SCIENTIFIC_HEURISTICS = Object.freeze({
  smallGroupMaximumExclusive: 10,
  numericalImbalanceRatio: 4,
  thresholdReviewBandShare: 0.05,
  weakOneSideSupportYears: 1,
  substantialMissingSideShare: 0.25,
  substantialCompositionChangeShare: 0.2,
  maximumExposureConditions: 8,
  maximumPriorityFindings: 5,
});

export function screen04Ratio(
  left: number,
  right: number,
): number | null {
  return right === 0 ? null : left / right;
}

export function screen04Share(
  numerator: number,
  denominator: number,
): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function screen04Percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function screen04Number(value: number): string {
  return value.toLocaleString("en-US");
}
