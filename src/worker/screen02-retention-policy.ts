export const SCREEN_02_WORKFLOW_STORE_IDLE_RETENTION_MS =
  24 * 60 * 60 * 1_000;
export const SCREEN_02_WORKFLOW_STORE_ABSOLUTE_RETENTION_MS =
  7 * 24 * 60 * 60 * 1_000;
export const SCREEN_02_WORKFLOW_STORE_CONTINUED_RETENTION_MS =
  60 * 60 * 1_000;
export const SCREEN_02_WORKFLOW_STORE_CLEANUP_BATCH_SIZE = 128;

export const SCREEN_02_WORKFLOW_RETENTION_PUBLIC_POLICY = {
  schemaVersion: "screen-02-retention-policy-v1",
  idleHours: 24,
  absoluteDays: 7,
  continuedHours: 1,
  immediateRetirement: true,
  cleanup: "durable-object-alarm",
} as const;
