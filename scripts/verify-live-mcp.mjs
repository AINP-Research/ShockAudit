import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createDecipheriv, createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

import { SIX_SCREEN_REPLACEMENT_BUILD } from
  "../src/core/six-screen/replacement-build.ts";

import {
  assertScreen02HandoffMatchesCanonicalState,
  firstActiveAuditMatchSnapshotId,
  readCanonicalWorkflowState,
  sameCanonicalJsonValue,
  screen02ContextBridgeMismatches,
} from "./live-mcp-workflow-state.mjs";
import { driveFindSearchToTerminal } from "./find-search-continuation.mjs";
import {
  fingerprintScreen03VerifierState,
  screen03RefreshDecisionIsCurrent,
} from "./live-verifier-screen03.mjs";
import { verifyAssetModuleGraph } from "./verify-asset-module-graph.mjs";
import {
  captureFindDiscoveryDiagnostics,
  liveVerifierFailureDiagnostic,
} from "./live-verifier-diagnostics.mjs";
import { readPreparedHostPrivateModelContext } from
  "./live-verifier-host-task-result.mjs";
import {
  introductoryPolicyReviewDiagnostic,
  isSourceBackedAttemptedPrecisePolicyReview,
  isSourceBackedInitialPolicyReview,
  policyEvidenceRouteStatus,
  precisePolicyRouteForInstrumentFamily,
} from "./live-verifier-policy-review.mjs";
import { hasExpectedEvidenceProvider } from
  "./live-verifier-records.mjs";

const packageMetadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const acceptanceManifest = JSON.parse(
  await readFile(new URL("./production-matrix-cases.json", import.meta.url), "utf8"),
);
const reviewedFindAcceptance = acceptanceManifest.screen2.find(
  (item) => item.caseId === "s2-uk-finance-regulation",
);
if (reviewedFindAcceptance?.expectedMode !== "positive-journey" ||
    reviewedFindAcceptance.acceptance?.sourceLocators?.length === 0) {
  throw new Error("The repeated Find journey requires its reviewed source-backed positive acceptance scope.");
}
const expectedVersion = packageMetadata.version;
const expectedReleaseLabel = "0.6.2-production-v109-r1";
const expectedResourceUri =
  `ui://shockaudit/workspace-v${expectedReleaseLabel}.html`;
const expectedSixScreenResponseBuildId =
  "production-six-screen-handoff-2026-10-25-v109-r1";
const sixScreenWorkflowMetaKey = "shockaudit/sixScreenWorkflow";
const sixScreenWorkflowResponseMetaKey =
  "shockaudit/sixScreenWorkflowResponse";
const sixScreenResponseContractVersion =
  "shockaudit-six-screen-workflow-response-v6";
const sixScreenStateEncoding = "canonical-json-gzip-base64-v1";
const sixScreenStateChunkTool =
  "get_six_screen_workflow_state_chunk_v2";
const sixScreenStateChunkSchemaVersion =
  "shockaudit-six-screen-state-chunk-v2";
const sixScreenStateChunkBytes = 192 * 1024;
const workflowMetaKey = "shockaudit/screen02-workflow-v021";
const workflowCorrelationMetaKey =
  "shockaudit/screen02-workflow-correlation-v1";
const screen03HostNativeDefaultMetaKey =
  "shockaudit/screen03HostNativeDefault";
const hostReasoningMetaKey = "shockaudit/hostReasoning";
const workflowCreateTool = "create_screen02_workflow_v024";
const workflowCreateSchemaVersion = "screen-02-workflow-create-v2";
const workflowMutationTool = "mutate_screen02_workflow_v024";
const workflowMutationSchemaVersion = "screen-02-workflow-action-v2";
const screen03OpenTool = "open_screen03_workflow_v030";
const screen03MutationTool = "mutate_screen03_workflow_v030";
const screen03OpenSchemaVersion = "screen-03-workflow-open-v1";
const screen03MutationSchemaVersion = "screen-03-workflow-mutation-v1";
const screen03ResultSchemaVersion = "screen-03-workflow-result-v1";
const screen01HostPrepareTool = "prepare_screen01_scope_draft_v036";
const screen01HostSubmitTool = "submit_screen01_scope_draft_v036";
const screen01HostApplyTool = "apply_screen01_scope_draft_v036";
const screen03HostPrepareTool = "prepare_screen03_host_draft_v036";
const screen03HostSubmitTool = "submit_screen03_host_draft_v036";
const screen03BriefingGetTool = "get_screen3_briefing_packet";
const screen03BriefingRenderTool = "render_screen3_briefing";
const screen03BriefingConfirmTool = "confirm_screen3_briefing";
const hostTaskPrepareTool = "prepare_shockaudit_host_task";
const hostTaskStatusTool = "get_shockaudit_host_task_status";
const hostTaskRecordMessageTool = "record_shockaudit_host_message_delivery";
const hostTaskRecordPanelTool =
  "record_shockaudit_host_panel_reconciliation";
const hostTaskCancelTool = "cancel_shockaudit_host_task";
const screen02SearchReviewSubmitTool = "submit_screen02_search_review";
const screen03EvidenceMappingSubmitTool =
  "submit_screen03_evidence_mapping";
const screen03OverviewSubmitTool = "submit_screen03_overview";
const hostReasoningTaskTypes = [
  "screen02-search-review",
  "screen03-evidence-mapping",
  "screen03-overview-improvement",
];
const defaultEvidenceDir = fileURLToPath(
  new URL("../artifacts/stage6-live/", import.meta.url),
);

// Intentionally independent of src/version.ts. A release must update both
// ledgers so deleting a previously published link cannot make implementation
// and acceptance checks agree on the same broken contract.
const releasedResourceUris = [
  "ui://shockaudit/workspace-v0.6.2-production-v109-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v108-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v107-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v106-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v105-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v104-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v103-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v102-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v101-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v100-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v99-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v98-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v97-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v96-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v95-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v94-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v93-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v92-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v91-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v90-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v89-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v88-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v87-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v86-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v85-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v84-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v83-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v82-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v81-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v80-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v79-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v78-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v77-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v76-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v75-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v74-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v73-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v72-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v71-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v70-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v69-r1.html",
  "ui://shockaudit/workspace-v0.6.2-production-v68-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-transition-v67-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v66-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v65-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v64-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v63-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v62-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v61-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v60-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v59-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v58-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v57-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v56-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v55-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v54-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v53-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v52-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v51-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v50-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v49-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v48-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v47-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v46-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v45-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v44-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v43-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v42-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v41-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v40-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v39-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v38-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v37-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v36-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v35-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v34-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v33-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v32-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v31-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v30-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v29-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v28-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-assessment-v27-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r8.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r7.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r6.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r5.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r4.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r3.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r2.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-handoff-v26-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-integrated-v25-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-integrated-v24-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-integrated-v23-r1.html",
  "ui://shockaudit/workspace-v0.6.2-six-screen-integrated-v22-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screens56-evidence-v21-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screens56-plan-v20-r1.html",
  "ui://shockaudit/screen-01-v0.1.0.html",
  "ui://shockaudit/screen-01-v0.1.1.html",
  "ui://shockaudit/workspace-v0.2.0.html",
  "ui://shockaudit/workspace-v0.2.1.html",
  "ui://shockaudit/workspace-v0.2.2.html",
  "ui://shockaudit/workspace-v0.2.3.html",
  "ui://shockaudit/workspace-v0.2.4.html",
  "ui://shockaudit/workspace-v0.2.5.html",
  "ui://shockaudit/workspace-v0.2.6.html",
  "ui://shockaudit/workspace-v0.2.7.html",
  "ui://shockaudit/workspace-v0.2.8.html",
  "ui://shockaudit/workspace-v0.2.9.html",
  "ui://shockaudit/workspace-v0.2.10.html",
  "ui://shockaudit/workspace-v0.2.11.html",
  "ui://shockaudit/workspace-v0.2.12.html",
  "ui://shockaudit/workspace-v0.2.13.html",
  "ui://shockaudit/workspace-v0.2.14.html",
  "ui://shockaudit/workspace-v0.2.15.html",
  "ui://shockaudit/workspace-v0.2.16.html",
  "ui://shockaudit/workspace-v0.2.17.html",
  "ui://shockaudit/workspace-v0.2.18.html",
  "ui://shockaudit/workspace-v0.2.19.html",
  "ui://shockaudit/workspace-v0.2.20.html",
  "ui://shockaudit/workspace-v0.2.21.html",
  "ui://shockaudit/workspace-v0.2.22.html",
  "ui://shockaudit/workspace-v0.2.23.html",
  "ui://shockaudit/workspace-v0.2.24.html",
  "ui://shockaudit/workspace-v0.2.25.html",
  "ui://shockaudit/workspace-v0.2.26.html",
  "ui://shockaudit/workspace-v0.2.27.html",
  "ui://shockaudit/workspace-v0.2.28.html",
  "ui://shockaudit/workspace-v0.2.29.html",
  "ui://shockaudit/workspace-v0.3.00.html",
  "ui://shockaudit/workspace-v0.3.01.html",
  "ui://shockaudit/workspace-v0.3.02.html",
  "ui://shockaudit/workspace-v0.3.03.html",
  "ui://shockaudit/workspace-v0.3.04.html",
  "ui://shockaudit/workspace-v0.3.05.html",
  "ui://shockaudit/workspace-v0.3.06.html",
  "ui://shockaudit/workspace-v0.3.07.html",
  "ui://shockaudit/workspace-v0.3.08.html",
  "ui://shockaudit/workspace-v0.3.09.html",
  "ui://shockaudit/workspace-v0.3.10.html",
  "ui://shockaudit/workspace-v0.3.11.html",
  "ui://shockaudit/workspace-v0.3.12.html",
  "ui://shockaudit/workspace-v0.3.13.html",
  "ui://shockaudit/workspace-v0.3.14.html",
  "ui://shockaudit/workspace-v0.3.15.html",
  "ui://shockaudit/workspace-v0.3.16.html",
  "ui://shockaudit/workspace-v0.3.17.html",
  "ui://shockaudit/workspace-v0.4.00.html",
  "ui://shockaudit/workspace-v0.4.01.html",
  "ui://shockaudit/workspace-v0.4.02.html",
  "ui://shockaudit/workspace-v0.4.03.html",
  "ui://shockaudit/workspace-v0.4.04.html",
  "ui://shockaudit/workspace-v0.4.05.html",
  "ui://shockaudit/workspace-v0.4.06.html",
  "ui://shockaudit/workspace-v0.4.07.html",
  "ui://shockaudit/workspace-v0.4.08.html",
  "ui://shockaudit/workspace-v0.4.09.html",
  "ui://shockaudit/workspace-v0.4.10.html",
  "ui://shockaudit/workspace-v0.5.0.html",
  "ui://shockaudit/workspace-v0.5.1.html",
  "ui://shockaudit/workspace-v0.5.2.html",
  "ui://shockaudit/workspace-v0.6.0.html",
  "ui://shockaudit/workspace-v0.6.1.html",
  "ui://shockaudit/workspace-v0.6.2.html",
  "ui://shockaudit/workspace-v0.6.2-screen1-response-r2.html",
  "ui://shockaudit/workspace-v0.6.2-screens34-investigation-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screens45-study-first-v5-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screens45-analysis-first-v6-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-synthesis-v7-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-execution-v8-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-groq-v9-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-groq-v10-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-groq-v11-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-groq-v12-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-groq-v13-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-groq-v14-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-openai-v15-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-openai-v17-r1.html",
  "ui://shockaudit/workspace-v0.6.2-screen5-openai-v18-r1.html",
];
const expectedSupportedResourceUris = [
  expectedResourceUri,
  ...releasedResourceUris.filter((uri) => uri !== expectedResourceUri),
];

const coreToolNames = [
  "open_shockaudit_screen_1",
  "draft_scope_contract",
  "confirm_scope_contract",
  "create_screen02_workflow_v024",
  "create_screen02_workflow_v023",
  "open_shockaudit_screen_2",
  "mutate_screen02_workflow_v024",
  "mutate_screen02_workflow_v021",
  "retire_screen02_workflow_v021",
  "open_screen03_workflow_v030",
  "mutate_screen03_workflow_v030",
  screen03BriefingConfirmTool,
];
const screen01LegacyDraftToolNames = [
  screen01HostPrepareTool,
  screen01HostSubmitTool,
  screen01HostApplyTool,
];
const screen03LegacyDraftToolNames = [
  screen03HostPrepareTool,
  screen03HostSubmitTool,
];
const legacyDraftToolNames = [
  ...screen01LegacyDraftToolNames,
  ...screen03LegacyDraftToolNames,
];
const historicalPacketRenderToolNames = [
  screen03BriefingGetTool,
  screen03BriefingRenderTool,
];
const hostLifecycleToolNames = [
  hostTaskPrepareTool,
  hostTaskStatusTool,
  hostTaskRecordMessageTool,
  hostTaskRecordPanelTool,
  hostTaskCancelTool,
];
const hostModelSubmissionToolNames = [
  screen02SearchReviewSubmitTool,
  screen03EvidenceMappingSubmitTool,
  screen03OverviewSubmitTool,
];

const sixScreenWorkflowToolNames = [
  "create_six_screen_workflow_v1",
  "get_six_screen_workflow_v1",
  sixScreenStateChunkTool,
  "get_six_screen_operation_status_v1",
  "get_six_screen_recovery_snapshot_v1",
  "mutate_six_screen_workflow_v1",
  "retire_six_screen_workflow_v1",
];
const sixScreenModelSubmissionToolNames = [
  "submit_six_screen_policy_fact_proof",
  "submit_six_screen_mechanism_proof",
];

function expectedToolNamesForHostMode(mode) {
  if (mode === "full") {
    return [
      ...coreToolNames,
      ...sixScreenWorkflowToolNames,
      ...hostLifecycleToolNames,
      ...hostModelSubmissionToolNames,
      ...sixScreenModelSubmissionToolNames,
    ];
  }
  if (mode === "screen02-only") {
    return [
      ...coreToolNames,
      ...sixScreenWorkflowToolNames,
      ...hostLifecycleToolNames,
      screen02SearchReviewSubmitTool,
    ];
  }
  if (mode === "app-only") {
    return [
      ...coreToolNames,
      ...sixScreenWorkflowToolNames,
      ...hostLifecycleToolNames,
    ];
  }
  return [
    ...coreToolNames,
    ...sixScreenWorkflowToolNames,
    ...historicalPacketRenderToolNames,
  ];
}

const toolContracts = {
  open_shockaudit_screen_1: {
    visibility: ["model", "app"],
    annotations: [true, false, true, false],
    renders: true,
  },
  draft_scope_contract: {
    visibility: ["model", "app"],
    annotations: [true, false, true, false],
    renders: false,
  },
  confirm_scope_contract: {
    visibility: ["model", "app"],
    annotations: [true, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [workflowCreateTool]: {
    visibility: ["app"],
    annotations: [false, false, true, true],
    renders: false,
    widgetAccessible: true,
  },
  create_screen02_workflow_v023: {
    visibility: ["app"],
    annotations: [false, false, true, true],
    renders: false,
    widgetAccessible: true,
  },
  open_shockaudit_screen_2: {
    visibility: ["model", "app"],
    annotations: [false, false, false, true],
    renders: true,
    widgetAccessible: true,
  },
  [workflowMutationTool]: {
    visibility: ["app"],
    annotations: [false, false, true, true],
    renders: false,
    widgetAccessible: true,
  },
  mutate_screen02_workflow_v021: {
    visibility: ["app"],
    annotations: [false, false, true, true],
    renders: false,
    widgetAccessible: true,
  },
  retire_screen02_workflow_v021: {
    visibility: ["app"],
    annotations: [false, true, true, false],
    renders: false,
    widgetAccessible: true,
  },
  open_screen03_workflow_v030: {
    visibility: ["app"],
    annotations: [false, false, false, true],
    renders: false,
    widgetAccessible: true,
  },
  mutate_screen03_workflow_v030: {
    visibility: ["app"],
    annotations: [false, false, false, false],
    renders: false,
    widgetAccessible: true,
  },
  [screen01HostPrepareTool]: {
    visibility: ["app"],
    annotations: [true, false, false, false],
    renders: false,
    widgetAccessible: true,
  },
  [screen01HostSubmitTool]: {
    // The current Screen 1 workflow retired host drafting. Preserve this
    // compatibility submission for saved widgets without exposing it to the
    // model-visible catalog.
    visibility: ["app"],
    annotations: [true, false, false, false],
    renders: false,
    submission: true,
    receiptShape: "screen01",
  },
  [screen01HostApplyTool]: {
    visibility: ["app"],
    annotations: [true, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [screen03HostPrepareTool]: {
    visibility: ["app"],
    annotations: [true, false, false, false],
    renders: false,
    widgetAccessible: true,
  },
  [screen03HostSubmitTool]: {
    // Stage B keeps this historical compatibility submission callable only
    // by an already-open saved widget. It must not be available to the model
    // for a new current Screen 3 briefing.
    visibility: ["app"],
    annotations: [false, false, true, false],
    renders: false,
    submission: true,
    receiptShape: "screen03",
    widgetAccessible: true,
  },
  [screen03BriefingGetTool]: {
    visibility: ["app"],
    annotations: [true, false, false, false],
    renders: false,
    widgetAccessible: true,
  },
  [screen03BriefingRenderTool]: {
    visibility: ["app"],
    annotations: [false, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [screen03BriefingConfirmTool]: {
    visibility: ["app"],
    annotations: [false, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [hostTaskPrepareTool]: {
    visibility: ["app"],
    annotations: [false, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [hostTaskStatusTool]: {
    visibility: ["app"],
    annotations: [false, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [hostTaskRecordMessageTool]: {
    visibility: ["app"],
    annotations: [false, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [hostTaskRecordPanelTool]: {
    visibility: ["app"],
    annotations: [false, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [hostTaskCancelTool]: {
    visibility: ["app"],
    annotations: [false, true, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [screen02SearchReviewSubmitTool]: {
    visibility: ["model"],
    annotations: [false, false, true, false],
    renders: false,
    submission: true,
    receiptShape: "host-task",
  },
  [screen03EvidenceMappingSubmitTool]: {
    visibility: ["model"],
    annotations: [false, false, true, false],
    renders: false,
    submission: true,
    receiptShape: "host-task",
  },
  [screen03OverviewSubmitTool]: {
    visibility: ["model"],
    annotations: [false, false, true, false],
    renders: false,
    submission: true,
    receiptShape: "host-task",
  },
  submit_six_screen_policy_fact_proof: {
    visibility: ["model"],
    annotations: [false, false, true, false],
    renders: false,
    submission: true,
    receiptShape: "host-task",
  },
  submit_six_screen_mechanism_proof: {
    visibility: ["model"],
    annotations: [false, false, true, false],
    renders: false,
    submission: true,
    receiptShape: "host-task",
  },
  create_six_screen_workflow_v1: {
    visibility: ["app"],
    annotations: [false, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  get_six_screen_workflow_v1: {
    visibility: ["app"],
    annotations: [true, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  [sixScreenStateChunkTool]: {
    visibility: ["app"],
    annotations: [true, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  get_six_screen_operation_status_v1: {
    visibility: ["app"],
    annotations: [true, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  get_six_screen_recovery_snapshot_v1: {
    visibility: ["app"],
    annotations: [true, false, true, false],
    renders: false,
    widgetAccessible: true,
  },
  mutate_six_screen_workflow_v1: {
    visibility: ["app"],
    annotations: [false, false, true, true],
    renders: false,
    widgetAccessible: true,
  },
  retire_six_screen_workflow_v1: {
    visibility: ["app"],
    annotations: [false, true, false, false],
    renders: false,
    widgetAccessible: true,
  },
};

const summaryKeys = [
  "schemaVersion",
  "screen",
  "ok",
  "outcome",
  "mode",
  "assessmentAvailable",
  "preparedRequestCount",
  "deliveredRequestCount",
  "completedRequestCount",
  "continuationReady",
  "message",
];
const snapshotKeys = [
  "schemaVersion",
  "runId",
  "accessToken",
  "mode",
  "revision",
  "stateFingerprint",
  "stateEnvelope",
  "assessmentAvailable",
  "assessmentBatch",
  "handoff",
];
const sealedSnapshotKeys = [
  "schemaVersion",
  "algorithm",
  "kind",
  "operationId",
  "keyId",
  "iv",
  "ciphertext",
];
const screen03SummaryKeys = [
  "schemaVersion",
  "screen",
  "ok",
  "outcome",
  "message",
  "sealedState",
];
const retireResultKeys = [
  "schemaVersion",
  "screen",
  "ok",
  "outcome",
  "runId",
  "message",
];
const scopeKeys = [
  "population",
  "assignmentLevel",
  "analysisLevel",
  "geography",
  "industry",
  "studyPeriod",
  "eventFamily",
  "outcomeFamily",
  "outcomeFrequency",
];
const decisionKeys = [...scopeKeys, "knownShock"];
const annotationKeys = [
  "readOnlyHint",
  "destructiveHint",
  "idempotentHint",
  "openWorldHint",
];
const requestTimeoutMs = 60_000;
const roundsRequired = 5;
const liveVerifierRunId = crypto.randomUUID();
const negotiatedProtocolHeaders = {
  "MCP-Protocol-Version": "2025-06-18",
};

function usage() {
  return [
    "Usage: node scripts/verify-live-mcp.mjs [options]",
    "",
    "Options:",
    "  --wait [seconds]       Wait for the expected deployment (default with flag: 600).",
    "  --evidence-dir <path>  Write sanitized JSON and Markdown evidence here.",
    `                         Default: ${defaultEvidenceDir}`,
    "  --help                 Show this help without contacting the live service.",
    "",
    "Environment:",
    "  SHOCKAUDIT_BASE_URL         Live Worker URL.",
    "  SHOCKAUDIT_EXPECTED_COMMIT  Required full 40-hex production commit.",
  ].join("\n");
}

function parseArguments(argv) {
  const parsed = {
    help: false,
    waitSeconds: 0,
    evidenceDir: defaultEvidenceDir,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      continue;
    }
    if (argument === "--wait") {
      const candidate = argv[index + 1];
      if (candidate !== undefined && !candidate.startsWith("--")) {
        parsed.waitSeconds = Number(candidate);
        index += 1;
      } else {
        parsed.waitSeconds = 600;
      }
      continue;
    }
    if (argument.startsWith("--wait=")) {
      parsed.waitSeconds = Number(argument.slice("--wait=".length));
      continue;
    }
    if (argument === "--evidence-dir") {
      const candidate = argv[index + 1];
      if (!candidate || candidate.startsWith("--")) {
        throw new Error("--evidence-dir requires a path.");
      }
      parsed.evidenceDir = resolve(candidate);
      index += 1;
      continue;
    }
    if (argument.startsWith("--evidence-dir=")) {
      const candidate = argument.slice("--evidence-dir=".length);
      if (!candidate) throw new Error("--evidence-dir requires a path.");
      parsed.evidenceDir = resolve(candidate);
      continue;
    }
    throw new Error(`Unknown option ${argument}.`);
  }
  if (
    !Number.isFinite(parsed.waitSeconds) ||
    parsed.waitSeconds < 0 ||
    parsed.waitSeconds > 3_600
  ) {
    throw new Error("--wait must be a number from 0 through 3600 seconds.");
  }
  return parsed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return sameJson(actual, expected);
}

function containsKey(value, keys) {
  if (Array.isArray(value)) return value.some((item) => containsKey(item, keys));
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, item]) => keys.has(key) || containsKey(item, keys),
  );
}

function serializeDeterministicJson(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeDeterministicJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serializeDeterministicJson(value[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Value is not deterministic JSON.");
}

function fingerprintSixScreenValue(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(
    serializeDeterministicJson(value),
  )) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function decodeSixScreenWorkflowPayload(
  encodedPayload,
  encodedBytes,
  canonicalBytes,
) {
  assert(
    typeof encodedPayload === "string" &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
        .test(encodedPayload) &&
      Buffer.byteLength(encodedPayload, "utf8") === encodedBytes,
    "The response-v6 state payload was not valid bounded base64.",
  );
  const canonicalPayload = gunzipSync(
    Buffer.from(encodedPayload, "base64"),
  ).toString("utf8");
  assert(
    Buffer.byteLength(canonicalPayload, "utf8") === canonicalBytes,
    "The response-v6 state payload did not reconcile its canonical byte length.",
  );
  const parsed = JSON.parse(canonicalPayload);
  assert(
    canonicalPayload === serializeDeterministicJson(parsed),
    "The response-v6 state payload was not deterministic JSON.",
  );
  return parsed;
}

const workflowResponseKeys = new Map();

function responseKeyFields(operationId) {
  const existing = workflowResponseKeys.get(operationId);
  if (existing) {
    return {
      responseKeyId: existing.responseKeyId,
      responseKey: existing.responseKey,
    };
  }
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const responseKey = Buffer.from(raw).toString("base64url");
  const responseKeyId = createHash("sha256")
    .update(raw)
    .digest("base64url");
  workflowResponseKeys.set(operationId, {
    raw: Uint8Array.from(raw),
    responseKey,
    responseKeyId,
  });
  raw.fill(0);
  return { responseKeyId, responseKey };
}

function decryptSealedWorkflowSnapshot(sealed) {
  assert(
    hasExactKeys(sealed, sealedSnapshotKeys) &&
      sealed.schemaVersion === "screen-02-workflow-sealed-result-v1" &&
      sealed.algorithm === "A256GCM" &&
      ["open", "mutation"].includes(sealed.kind) &&
      /^[A-Za-z0-9_-]{43}$/.test(sealed.keyId) &&
      /^[A-Za-z0-9_-]{16}$/.test(sealed.iv) &&
      /^[A-Za-z0-9_-]+$/.test(sealed.ciphertext),
    "Canonical Screen 2 result returned an invalid sealed snapshot shape.",
  );
  const responseKey = workflowResponseKeys.get(sealed.operationId);
  assert(
    responseKey?.responseKeyId === sealed.keyId,
    "Canonical Screen 2 result used the wrong response-key binding.",
  );
  const encrypted = Buffer.from(sealed.ciphertext, "base64url");
  assert(
    encrypted.byteLength > 16,
    "Canonical Screen 2 sealed snapshot omitted authenticated ciphertext.",
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    responseKey.raw,
    Buffer.from(sealed.iv, "base64url"),
  );
  decipher.setAAD(
    Buffer.from(
      serializeDeterministicJson({
        schemaVersion: sealed.schemaVersion,
        algorithm: sealed.algorithm,
        kind: sealed.kind,
        operationId: sealed.operationId,
        keyId: sealed.keyId,
      }),
    ),
  );
  decipher.setAuthTag(encrypted.subarray(encrypted.byteLength - 16));
  const plaintext = Buffer.concat([
    decipher.update(encrypted.subarray(0, encrypted.byteLength - 16)),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext);
  assert(
    plaintext === serializeDeterministicJson(parsed),
    "Canonical Screen 2 sealed snapshot was not deterministic JSON.",
  );
  return parsed;
}

function decryptSealedScreen03State(sealed, expectedKind) {
  assert(
    hasExactKeys(sealed, sealedSnapshotKeys) &&
      sealed.schemaVersion === "screen-03-workflow-sealed-result-v1" &&
      sealed.algorithm === "A256GCM" &&
      sealed.kind === expectedKind &&
      /^[A-Za-z0-9_-]{43}$/.test(sealed.keyId) &&
      /^[A-Za-z0-9_-]{16}$/.test(sealed.iv) &&
      /^[A-Za-z0-9_-]+$/.test(sealed.ciphertext),
    "Canonical Screen 3 result returned an invalid sealed state shape.",
  );
  const responseKey = workflowResponseKeys.get(sealed.operationId);
  assert(
    responseKey?.responseKeyId === sealed.keyId,
    "Canonical Screen 3 result used the wrong response-key binding.",
  );
  const encrypted = Buffer.from(sealed.ciphertext, "base64url");
  assert(
    encrypted.byteLength > 16,
    "Canonical Screen 3 sealed state omitted authenticated ciphertext.",
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    responseKey.raw,
    Buffer.from(sealed.iv, "base64url"),
  );
  decipher.setAAD(
    Buffer.from(
      serializeDeterministicJson({
        schemaVersion: sealed.schemaVersion,
        algorithm: sealed.algorithm,
        kind: sealed.kind,
        operationId: sealed.operationId,
        keyId: sealed.keyId,
      }),
    ),
  );
  decipher.setAuthTag(encrypted.subarray(encrypted.byteLength - 16));
  const plaintext = Buffer.concat([
    decipher.update(encrypted.subarray(0, encrypted.byteLength - 16)),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext);
  assert(
    plaintext === serializeDeterministicJson(parsed),
    "Canonical Screen 3 sealed state was not deterministic JSON.",
  );
  return parsed;
}

const sensitiveEvidenceKeys = new Set([
  "accessToken",
  "capabilityToken",
  "receiptToken",
  "responseKey",
  "stateEnvelope",
  "assessmentBatch",
  "sourcePacket",
  "modelContext",
  "draft",
  "runId",
  "requestId",
  "receiptId",
  "payload",
  "interpretation",
]);

function sanitizeText(value) {
  return String(value)
    .replace(/\bs2a_[A-Za-z0-9_-]{20,128}\b/g, "[access-token-redacted]")
    .replace(/\bs2r_[A-Za-z0-9_-]{20,128}\b/g, "[run-id-redacted]")
    .replace(
      /\bsa2[fa]-(?:capability|receipt)-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[signed-token-redacted]",
    )
    .replace(
      /\bsa(?:1-(?:capability|receipt)|3h-capability)-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[signed-token-redacted]",
    )
    .replace(
      /\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g,
      "[signed-value-redacted]",
    )
    .replace(
      /("(?:accessToken|capabilityToken|receiptToken|responseKey|stateEnvelope|assessmentBatch|sourcePacket|modelContext|draft|runId|requestId|receiptId|payload)"\s*:\s*)"(?:[^"\\]|\\.)*"/g,
      '$1"[redacted]"',
    );
}

function sanitizeEvidence(value, key = "") {
  if (sensitiveEvidenceKeys.has(key)) return "[redacted]";
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeEvidence(item));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, item]) => [
      entryKey,
      sanitizeEvidence(item, entryKey),
    ]),
  );
}

function safeErrorMessage(error) {
  return sanitizeText(error instanceof Error ? error.message : String(error));
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function timedFetch(url, init = {}) {
  return fetch(url, {
    redirect: "error",
    ...init,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
}

function parseMcpPayload(text, contentType) {
  if (!contentType.includes("text/event-stream")) return JSON.parse(text);
  const payloads = [];
  for (const block of text.split(/\r?\n\r?\n/u)) {
    const data = block
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      payloads.push(JSON.parse(data));
    } catch {
      // A non-JSON SSE status event is not the JSON-RPC result.
    }
  }
  assert(payloads.length > 0, "MCP SSE response contained no JSON-RPC payload.");
  return payloads.at(-1);
}

let nextRpcId = 1;

async function rawMcpExchange(
  method,
  params = {},
  pathname = "/mcp",
  headers = {},
) {
  const id = nextRpcId++;
  const response = await timedFetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await response.text();
  let payload = null;
  if (response.ok) {
    try {
      payload = parseMcpPayload(
        text,
        response.headers.get("content-type") ?? "",
      );
    } catch {
      throw new Error(`${pathname} ${method} returned an unreadable MCP response.`);
    }
  }
  return { response, text, payload };
}

const safeMcpFailurePhases = new Set([
  "durable-object-fetch",
  "retention-cleanup",
  "handler-dispatch",
  "response-finalization",
  "retention-scheduling",
]);

class LiveMcpHttpError extends Error {
  constructor(message, status, phase) {
    super(message);
    this.name = "LiveMcpHttpError";
    this.status = status;
    this.phase = safeMcpFailurePhases.has(phase) ? phase : null;
  }
}

async function mcpCall(
  method,
  params = {},
  pathname = "/mcp",
  headers = negotiatedProtocolHeaders,
) {
  const exchange = await rawMcpExchange(method, params, pathname, headers);
  if (!exchange.response.ok) {
    throw new LiveMcpHttpError(
      `${pathname} ${method} returned HTTP ${exchange.response.status}: ${sanitizeText(exchange.text).slice(0, 240)}`,
      exchange.response.status,
      exchange.response.headers.get("x-shockaudit-mcp-failure-phase"),
    );
  }
  if (exchange.payload?.error) {
    const code = exchange.payload.error.code ?? "unknown";
    const message = sanitizeText(exchange.payload.error.message ?? "unknown error");
    throw new Error(`${pathname} ${method} returned JSON-RPC error ${code}: ${message}`);
  }
  assert(
    Object.prototype.hasOwnProperty.call(exchange.payload ?? {}, "result"),
    `${pathname} ${method} returned no JSON-RPC result.`,
  );
  return exchange.payload.result;
}

async function mcpRead(method, params = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await mcpCall(method, params);
    } catch (error) {
      if (
        attempt >= 1 ||
        !(error instanceof LiveMcpHttpError) ||
        error.status !== 503
      ) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

async function initialize(
  pathname = "/mcp",
  headers = negotiatedProtocolHeaders,
) {
  const result = await mcpCall(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "ShockAudit Stage 6 live release gate",
        version: expectedVersion,
      },
    },
    pathname,
    headers,
  );
  assert(result?.serverInfo?.name === "ShockAudit", `${pathname} initialized the wrong service.`);
  assert(
    result?.serverInfo?.version === expectedVersion,
    `${pathname} initialized the wrong server version.`,
  );
  return result;
}

async function callTool(name, argumentsValue) {
  return mcpCall("tools/call", { name, arguments: argumentsValue });
}

function assertToolSuccess(result, label) {
  assert(isRecord(result), `${label} returned no tool result.`);
  const toolError = Array.isArray(result.content)
    ? result.content
      .map((item) => typeof item?.text === "string" ? item.text : "")
      .join(" ")
      .trim()
    : "";
  assert(
    result.isError !== true,
    `${label} returned a tool-level error${
      toolError ? `: ${sanitizeText(toolError).slice(0, 240)}` : "."
    }`,
  );
}

function assertToolError(result, expectedMessage, label) {
  assert(result?.isError === true, `${label} did not fail closed.`);
  const text = Array.isArray(result?.content)
    ? result.content.map((item) => item?.text ?? "").join(" ")
    : "";
  assert(expectedMessage.test(text), `${label} returned the wrong generic rejection.`);
}

let expectedCommitFull = "";
let expectedCommit = "";
const configuredBaseUrl = (
  process.env.SHOCKAUDIT_BASE_URL ??
  "https://shockaudit.ainp-research.workers.dev"
).replace(/\/+$/, "");
let baseUrl = "";
let publicOrigin = "";

function configureTarget() {
  const configuredCommit =
    process.env.SHOCKAUDIT_EXPECTED_COMMIT?.trim() ?? "";
  assert(
    /^[0-9a-f]{40}$/iu.test(configuredCommit),
    "SHOCKAUDIT_EXPECTED_COMMIT must be the full 40-hex production commit.",
  );
  expectedCommitFull = configuredCommit.toLowerCase();
  expectedCommit = expectedCommitFull.slice(0, 7);

  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(configuredBaseUrl);
  } catch {
    throw new Error("SHOCKAUDIT_BASE_URL must be a valid URL.");
  }
  assert(
    parsedBaseUrl.protocol === "https:" || parsedBaseUrl.hostname === "localhost",
    "SHOCKAUDIT_BASE_URL must be an HTTPS URL or localhost.",
  );
  assert(
    parsedBaseUrl.pathname === "/" && !parsedBaseUrl.search && !parsedBaseUrl.hash,
    "SHOCKAUDIT_BASE_URL must contain only an origin.",
  );
  baseUrl = configuredBaseUrl;
  publicOrigin = parsedBaseUrl.origin;
}

async function readHealthProbe() {
  const response = await timedFetch(`${baseUrl}/health`, {
    headers: { accept: "application/json" },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // The readiness loop reports only safe status data.
  }
  return { status: response.status, ok: response.ok, body };
}

async function readLiveSourceCapabilityProbe() {
  const response = await timedFetch(`${baseUrl}/health?source-probe=live`, {
    headers: { accept: "application/json" },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // The caller reports only finite capability status data.
  }
  return { status: response.status, ok: response.ok, body };
}

async function expectedCommitIsActive() {
  if (!expectedCommit) return true;
  const response = await timedFetch(
    `${publicOrigin}/assets/shockaudit-app.js?v=${expectedReleaseLabel}`,
  );
  if (!response.ok) {
    await response.arrayBuffer();
    return false;
  }
  return (await response.text()).includes(expectedCommit);
}

async function waitForReadyHealth(waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1_000;
  let diagnostic = { status: 0, version: "unreadable", code: "unreadable" };
  while (true) {
    try {
      const probe = await readHealthProbe();
      diagnostic = {
        status: probe.status,
        version: typeof probe.body?.version === "string" ? probe.body.version : "unreadable",
        code:
          typeof probe.body?.readiness?.code === "string"
            ? probe.body.readiness.code
            : "unreadable",
      };
      if (probe.ok && probe.body?.version === expectedVersion) {
        if (await expectedCommitIsActive()) {
          try {
            await initialize("/mcp");
            await initialize("/mcp/");
            return probe.body;
          } catch (error) {
            if (error instanceof LiveMcpHttpError && error.phase) {
              diagnostic.code = `MCP_${error.phase
                .replaceAll("-", "_")
                .toUpperCase()}_FAILED`;
            } else if (
              safeErrorMessage(error).includes(
                "initialized the wrong server version",
              )
            ) {
              diagnostic.code = "AWAITING_EXPECTED_MCP_VERSION";
            } else {
              diagnostic.code = "AWAITING_EXPECTED_MCP_RESPONSE";
            }
          }
        } else {
          diagnostic.code = "AWAITING_EXPECTED_COMMIT";
        }
      }
    } catch (error) {
      diagnostic = {
        status: 0,
        version: "unreachable",
        code: safeErrorMessage(error).slice(0, 120),
      };
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for production v${expectedVersion}${
          expectedCommit ? ` at commit ${expectedCommit}` : ""
        }; last safe diagnostic was HTTP ${diagnostic.status}, version ${diagnostic.version}, readiness ${diagnostic.code}.`,
      );
    }
    await wait(10_000);
  }
}

function verifyHealthContract(healthValue) {
  assert(healthValue?.ok === true && healthValue?.ready === true, "/health is not ready.");
  assert(
    healthValue?.service === "ShockAudit" && healthValue?.version === expectedVersion,
    "/health advertised the wrong service or version.",
  );
  assert(
    sameJson(healthValue?.readiness, {
      status: "ready",
      mode: "integrated",
      mcpRuntime: "durable-object",
      workersAi: "not-applicable",
      reasoning: "chatgpt-host",
      assessmentSigning: "ready",
      code: "READY",
    }),
    "/health did not advertise integrated fail-closed readiness.",
  );
  assert(
    healthValue?.uiResourceUri === expectedResourceUri,
    "/health advertised the wrong current UI resource.",
  );
  assert(
    sameJson(healthValue?.supportedUiResourceUris, expectedSupportedResourceUris),
    "/health advertised the wrong current/legacy UI compatibility set.",
  );
  assert(
    sameJson(healthValue?.retention, {
      schemaVersion: "screen-02-retention-policy-v1",
      idleHours: 24,
      absoluteDays: 7,
      continuedHours: 1,
      immediateRetirement: true,
      cleanup: "durable-object-alarm",
    }),
    "/health advertised the wrong temporary-record retention policy.",
  );
  return verifyRuntimeCapabilities(healthValue?.capabilities);
}

function verifyRuntimeCapabilities(value) {
  const sourceStatuses = [
    "not_configured",
    "configured_not_tested",
    "enabled_not_tested",
    "healthy",
    "degraded",
    "quota_exhausted",
    "policy_blocked",
    "unsupported_for_request",
  ];
  const secretNames = [
    "GOVINFO_API_KEY",
    "CONGRESS_API_KEY",
    "REGULATIONS_API_KEY",
    "LEGISCAN_API_KEY",
    "OPENSTATES_API_KEY",
    "TAVILY_API_KEY",
    "BRAVE_API_KEY",
    "OPENALEX_API_KEY",
  ];
  assert(
    isRecord(value) &&
      value.schemaVersion === "shockaudit-runtime-capabilities-v1",
    "/health returned no versioned runtime capability report.",
  );
  const serialized = JSON.stringify(value);
  const reportBytes = Buffer.byteLength(serialized);
  assert(
    reportBytes <= 64 * 1024,
    "/health runtime capabilities exceeded the 64 KiB release budget.",
  );
  assert(
    secretNames.every((name) => !serialized.includes(name)) &&
      !containsKey(value, new Set(secretNames)),
    "/health runtime capabilities exposed a server secret identifier.",
  );

  const register = value.sourceRegister;
  assert(
    isRecord(register) &&
      register.schemaVersion === "shockaudit-source-register-v4" &&
      register.sourceCount === 18 &&
      isRecord(register.entries) &&
      Object.keys(register.entries).length === register.sourceCount &&
      Array.isArray(register.enabledSourceIds) &&
      hasExactKeys(register.statusCounts, sourceStatuses),
    "/health returned an invalid source capability register.",
  );
  const computedCounts = Object.fromEntries(
    sourceStatuses.map((status) => [status, 0]),
  );
  const computedEnabled = [];
  for (const [sourceId, entry] of Object.entries(register.entries)) {
    assert(
      isRecord(entry) &&
        typeof entry.configured === "boolean" &&
        typeof entry.implemented === "boolean" &&
        typeof entry.tested === "boolean" &&
        typeof entry.enabled === "boolean" &&
        sourceStatuses.includes(entry.status) &&
        !Object.hasOwn(entry, "secretName"),
      `/health returned an invalid ${sourceId} capability entry.`,
    );
    if (entry.authentication === "server_secret" && !entry.tested) {
      assert(
        entry.enabled === false,
        `/health enabled credentialed source ${sourceId} without a successful probe.`,
      );
    }
    computedCounts[entry.status] += 1;
    if (entry.enabled) computedEnabled.push(sourceId);
  }
  computedEnabled.sort();
  assert(
    sameJson(register.statusCounts, computedCounts) &&
      sameJson(register.enabledSourceIds, computedEnabled) &&
      register.entries.federal_register?.implemented === true &&
      register.entries.federal_register?.enabled === true &&
      register.entries.ecfr?.implemented === true &&
      register.entries.ecfr?.enabled === true &&
      register.entries.reviewed_official_documents?.implemented === true &&
      register.entries.reviewed_official_documents?.enabled === true &&
      register.entries.reviewed_official_documents?.operations
        ?.resolveIdentity === true &&
      register.entries.reviewed_official_documents?.operations
        ?.fetchRepresentation === true &&
      ["govinfo", "congress_gov", "regulations_gov", "openstates",
        "openalex"].every(
        (sourceId) =>
          register.entries[sourceId]?.implemented === true &&
          register.entries[sourceId]?.configured === true,
      ),
    "/health source counts or required bounded adapters were inconsistent.",
  );

  const intelligence = value.intelligence;
  const configuredModes = [
    "experimental-off",
    "app-only",
    "screen02-only",
    "full",
  ];
  const expectedModelCallable =
    intelligence?.configuredMode === "screen02-only" ||
    intelligence?.configuredMode === "full";
  const expectedExposure = expectedModelCallable
    ? "model-callable-unverified"
    : intelligence?.configuredMode === "app-only"
      ? "app-only-unverified"
      : "disabled";
  const expectedTaskTypes = intelligence?.configuredMode === "full"
    ? hostReasoningTaskTypes
    : intelligence?.configuredMode === "screen02-only"
      ? ["screen02-search-review"]
      : [];
  assert(
    isRecord(intelligence) &&
      configuredModes.includes(intelligence.configuredMode) &&
      intelligence.exposure === expectedExposure &&
      intelligence.modelCallable === expectedModelCallable &&
      intelligence.actualSignedInProof === false &&
      intelligence.genuineTraceCount === 0 &&
      sameJson(intelligence.availableTaskTypes, expectedTaskTypes) &&
      intelligence.blocker?.code === "SIGNED_IN_ROUND_TRIP_NOT_RECORDED",
    "/health overstated or malformed the host-intelligence capability.",
  );

  const resources = value.declaredResources;
  assert(
    isRecord(resources) &&
      resources.schemaVersion === "six-screen-declared-resource-profile-v1" &&
      resources.measurementStatus === "declared_not_deployed_measurement" &&
      resources.mcpRequestMaxBytes === 16 * 1024 * 1024 &&
      resources.evidenceChunkMaxBytes === 96_000 &&
      resources.policyEventCardReviewMaxBytes === 96_000 &&
      resources.researchProfileVersion === "six-screen-research-profiles-v1" &&
      resources.researchProfiles?.["policy-standard"]?.kind === "policy" &&
      resources.researchProfiles?.["policy-deep"]?.kind === "policy",
    "/health misstated measured status or code-declared resource ceilings.",
  );

  return {
    schemaVersion: value.schemaVersion,
    reportBytes,
    sourceCount: register.sourceCount,
    enabledSourceIds: register.enabledSourceIds,
    statusCounts: register.statusCounts,
    intelligence: {
      configuredMode: intelligence.configuredMode,
      exposure: intelligence.exposure,
      actualSignedInProof: intelligence.actualSignedInProof,
    },
    resourceMeasurement: resources.measurementStatus,
  };
}

async function verifyCredentialedSourceCapabilities() {
  const probe = await readLiveSourceCapabilityProbe();
  assert(
    probe.ok && probe.body?.version === expectedVersion,
    "The explicit live source-capability probe did not return the expected release.",
  );
  const capabilities = verifyHealthContract(probe.body);
  const required = [
    "govinfo", "congress_gov", "regulations_gov", "openstates", "openalex",
  ];
  const entries = probe.body?.capabilities?.sourceRegister?.entries;
  assert(isRecord(entries), "The live source-capability probe returned no source register.");
  const matrix = {};
  for (const sourceId of required) {
    const entry = entries[sourceId];
    assert(
      isRecord(entry) &&
        entry.implemented === true &&
        entry.configured === true &&
        entry.tested === true &&
        entry.enabled === true &&
        entry.status === "healthy" &&
        entry.lastHarmlessProbe?.outcome === "success",
      `The ${sourceId} provider did not pass its operation-shaped live capability probe.`,
    );
    matrix[sourceId] = {
      implemented: entry.implemented,
      configured: entry.configured,
      tested: entry.tested,
      enabled: entry.enabled,
      status: entry.status,
      probeOutcome: entry.lastHarmlessProbe.outcome,
      adapterVersion: entry.adapterVersion,
    };
  }
  return { runtimeCapabilities: capabilities, providers: matrix };
}

function requireHostReasoningMetadata(value) {
  assert(
    hasExactKeys(value, [
      "mode",
      "enabled",
      "genuineTraceCount",
      "availableTaskTypes",
    ]) &&
      ["experimental-off", "app-only", "screen02-only", "full"].includes(value.mode) &&
      typeof value.enabled === "boolean" &&
      Number.isSafeInteger(value.genuineTraceCount) &&
      value.genuineTraceCount >= 0 &&
      Array.isArray(value.availableTaskTypes),
    "The UI resource did not advertise exact bounded host-reasoning metadata.",
  );
  const full = value.mode === "full";
  const screen02Only = value.mode === "screen02-only";
  assert(
    value.enabled === (full || screen02Only) &&
      sameJson(
        value.availableTaskTypes,
        full
          ? hostReasoningTaskTypes
          : screen02Only
            ? ["screen02-search-review"]
            : [],
      ),
    "The advertised host-reasoning mode, enablement, and task types disagreed.",
  );
  return value;
}

function verifyCatalog(tools, hostReasoning) {
  assert(Array.isArray(tools), "tools/list returned no catalog.");
  const catalogBytes = Buffer.byteLength(JSON.stringify(tools));
  // Every supported exposure profile must remain within the same ChatGPT Scan
  // Tools release gate. Compatibility-only tools are mode-pruned rather than
  // weakening the generic task schemas.
  assert(
    catalogBytes < 64 * 1024,
    "tools/list exceeded the 64 KiB release budget.",
  );
  const expectedToolNames = expectedToolNamesForHostMode(hostReasoning.mode);
  const names = tools.map((tool) => tool?.name);
  assert(
    new Set(names).size === expectedToolNames.length &&
      sameJson([...names].sort(), [...expectedToolNames].sort()),
    `tools/list did not expose the exact ${expectedToolNames.length}-tool release catalog.`,
  );

  for (const name of expectedToolNames) {
    const tool = tools.find((candidate) => candidate?.name === name);
    const contract = toolContracts[name];
    assert(tool, `${name} was missing from tools/list.`);
    assert(
      sameJson(tool?._meta?.ui?.visibility, contract.visibility),
      `${name} advertised the wrong UI visibility.`,
    );
    const actualAnnotations = annotationKeys.map((key) => tool?.annotations?.[key]);
    assert(
      sameJson(actualAnnotations, contract.annotations),
      `${name} advertised the wrong MCP annotations.`,
    );
    const resourceLinks = [
      tool?._meta?.ui?.resourceUri,
      tool?._meta?.["ui/resourceUri"],
      tool?._meta?.["openai/outputTemplate"],
    ];
    assert(
      contract.renders
        ? resourceLinks.every((uri) => uri === expectedResourceUri)
        : resourceLinks.every((uri) => uri === undefined),
      `${name} advertised the wrong UI resource-link boundary.`,
    );
    if (contract.widgetAccessible) {
      assert(
        tool?._meta?.["openai/widgetAccessible"] === true,
        `${name} is not callable by the mounted widget.`,
      );
    }
    if (contract.submission) {
      const properties = tool?.inputSchema?.properties;
      const required = tool?.inputSchema?.required;
      const requiredSubmissionKeys = contract.receiptShape === "host-task"
        ? ["schemaVersion", "taskId", "capability"]
        : ["schemaVersion", "capabilityToken", "requestId", "draft"];
      assert(
        isRecord(properties) &&
          requiredSubmissionKeys.every(
            (key) => Object.prototype.hasOwnProperty.call(properties, key),
          ) &&
          Array.isArray(required) &&
          requiredSubmissionKeys.every(
            (key) => required.includes(key),
          ),
        `${name} did not advertise the bounded signed-submission input contract.`,
      );
      const outputProperties = tool?.outputSchema?.properties;
      const expectedReceiptKeys = contract.receiptShape === "screen01"
        ? [
            "schemaVersion",
            "phase",
            "operationId",
            "requestId",
            "receiptId",
            "sourceRevision",
            "sourceStateDigest",
            "receivedAt",
            "receiptToken",
          ]
        : contract.receiptShape === "screen03"
          ? [
              "schemaVersion",
              "phase",
              "runId",
              "requestId",
              "disposition",
              "reason",
            ]
          : contract.receiptShape === "host-task"
            ? [
                "schemaVersion",
                "taskId",
                "taskType",
                "disposition",
                "status",
                "resultId",
                "reason",
                "outcomeValuesInspected",
              ]
          : [
              "schemaVersion",
              "phase",
              "runId",
              "mode",
              "requestId",
              "receiptId",
              "disposition",
              "reason",
            ];
      assert(
        isRecord(outputProperties) &&
          sameJson(
            Object.keys(outputProperties).sort(),
            expectedReceiptKeys.sort(),
          ),
        `${name} exposed the wrong bounded receipt schema.`,
      );
    }
  }
  const creator = tools.find((tool) => tool?.name === workflowCreateTool);
  assert(
    creator?.outputSchema?.type === "object" &&
      creator?.outputSchema?.anyOf === undefined &&
      isRecord(creator?.outputSchema?.properties) &&
      creator.outputSchema.properties.result === undefined &&
      sameJson(
        Object.keys(creator.outputSchema.properties).sort(),
        [...summaryKeys, "sealedSnapshot"].sort(),
      ),
    "The current Screen 2 creator did not advertise one sealed object output schema.",
  );
  assert(
    sameJson(
      Object.keys(creator?.inputSchema?.properties ?? {}).sort(),
      [
        "schemaVersion",
        "operationId",
        "responseKeyId",
        "responseKey",
        "initialState",
        "studyContext",
      ].sort(),
    ) &&
      [
        "schemaVersion",
        "operationId",
        "responseKeyId",
        "responseKey",
        "studyContext",
      ].every((key) => creator?.inputSchema?.required?.includes(key)),
    "The current Screen 2 creator did not require the bounded response-key contract.",
  );
  assert(
    creator?.inputSchema?.required?.includes("initialState") !== true &&
      creator?.inputSchema?.properties?.initialState?.type === "string" &&
      sameJson(
        creator.inputSchema.properties.initialState.enum,
        ["standard", "blank"],
      ),
    "The current Screen 2 creator did not advertise the optional standard/blank initialization contract.",
  );
  const legacyCreator = tools.find(
    (tool) => tool?.name === "create_screen02_workflow_v023",
  );
  assert(
    isRecord(legacyCreator?.outputSchema?.properties) &&
      sameJson(
        Object.keys(legacyCreator.outputSchema.properties).sort(),
        [...summaryKeys].sort(),
      ),
    "The legacy Screen 2 creator no longer preserves its compact summary contract.",
  );
  const currentMutation = tools.find(
    (tool) => tool?.name === workflowMutationTool,
  );
  assert(
    isRecord(currentMutation?.outputSchema?.properties) &&
      sameJson(
        Object.keys(currentMutation.outputSchema.properties).sort(),
        [...summaryKeys, "sealedSnapshot"].sort(),
      ) &&
      ["responseKeyId", "responseKey"].every(
        (key) =>
          Object.prototype.hasOwnProperty.call(
            currentMutation?.inputSchema?.properties ?? {},
            key,
          ) && currentMutation?.inputSchema?.required?.includes(key),
      ),
    "The current Screen 2 mutation did not advertise its sealed response contract.",
  );
  const stableOpener = tools.find(
    (tool) => tool?.name === "open_shockaudit_screen_2",
  );
  assert(
    isRecord(stableOpener?.outputSchema?.properties) &&
      sameJson(
        Object.keys(stableOpener.outputSchema.properties).sort(),
        [
          "screen",
          "ok",
          "error",
          "sessionState",
          "sessionSummary",
          "assessmentResults",
        ].sort(),
      ),
    "The stable Screen 2 opener no longer matches the frozen object output contract.",
  );
  const assertBriefingToolShape = (name, inputKeys, outputKeys) => {
    const tool = tools.find((candidate) => candidate?.name === name);
    assert(
      isRecord(tool?.inputSchema?.properties) &&
        sameJson(Object.keys(tool.inputSchema.properties).sort(), [...inputKeys].sort()) &&
        inputKeys.every((key) => tool?.inputSchema?.required?.includes(key)),
      `${name} exposed the wrong exact input schema.`,
    );
    assert(
      tool?.outputSchema?.type === "object" &&
        isRecord(tool?.outputSchema?.properties) &&
        sameJson(Object.keys(tool.outputSchema.properties).sort(), [...outputKeys].sort()) &&
        outputKeys.every((key) => tool?.outputSchema?.required?.includes(key)),
      `${name} exposed the wrong exact output schema.`,
    );
  };
  if (hostReasoning.mode === "experimental-off") {
    assertBriefingToolShape(
      screen03BriefingGetTool,
      ["schemaVersion", "safeRunRef", "selectedEventId"],
      [
        "schemaVersion", "requiredBriefingStatus", "safeRunRef",
        "selectedEventId", "canonicalEventName",
        "aliases",
        "jurisdiction", "responsibleAuthority", "eventType", "eventStatus",
        "formalIdentifier", "eventFingerprint", "screen03Revision",
        "screen03StateFingerprint", "claims", "evidence", "unresolvedConflicts",
        "missingEvidence", "studyScope", "existingResearcherApprovals",
        "instructions", "outcomeValuesInspected",
        "packetId", "packetHash",
        "issuedAt", "expiresAt",
      ],
    );
    assertBriefingToolShape(
      screen03BriefingRenderTool,
      [
        "schemaVersion", "skillVersion", "workflowVersion", "safeRunRef",
        "packetId", "packetHash", "selectedEventId", "content",
      ],
      [
        "schemaVersion", "outcome", "proposalId", "briefing", "sources",
        "issues", "message",
      ],
    );
  }
  assertBriefingToolShape(
    screen03BriefingConfirmTool,
    [
      "schemaVersion", "continuationToken", "proposalId",
      "expectedScreen03Revision", "expectedScreen03StateFingerprint", "decision",
    ],
    ["schemaVersion", "outcome", "proposalId", "decisionId", "message"],
  );
  if (hostReasoning.mode === "experimental-off") {
    const briefingPacket = tools.find(
      (tool) => tool?.name === screen03BriefingGetTool,
    );
    assert(
      !containsKey(briefingPacket?.outputSchema, new Set([
        "accessToken", "continuationToken", "responseKey", "stateEnvelope",
      ])),
      "The read-only briefing packet schema exposed a private run credential.",
    );
  }
  return catalogBytes;
}

async function verifyOriginBehavior() {
  await initialize("/mcp", {
    ...negotiatedProtocolHeaders,
    origin: "https://chatgpt.com",
  });

  for (const origin of ["https://chatgpt.com.evil.example", "null"]) {
    const exchange = await rawMcpExchange(
      "initialize",
      {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "Stage 6 origin rejection probe", version: "1" },
      },
      "/mcp",
      { ...negotiatedProtocolHeaders, origin },
    );
    assert(exchange.response.status === 403, "An untrusted MCP Origin was not rejected.");
  }

  const preflight = await timedFetch(`${baseUrl}/mcp`, {
    method: "OPTIONS",
    headers: {
      origin: "https://chatgpt.com",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,mcp-protocol-version",
    },
  });
  await preflight.arrayBuffer();
  assert(preflight.status === 200, "ChatGPT MCP preflight did not return HTTP 200.");
  assert(
    preflight.headers.get("access-control-allow-origin") === "*" &&
      preflight.headers.get("access-control-allow-methods")?.includes("POST"),
    "ChatGPT MCP preflight returned the wrong CORS policy.",
  );
  return { trustedStatus: 200, rejectedStatuses: [403, 403], preflightStatus: 200 };
}

function extractAssetUrls(html) {
  const urls = [];
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"'<>]+)["']/giu)) {
    let parsed;
    try {
      parsed = new URL(match[1], publicOrigin);
    } catch {
      continue;
    }
    if (parsed.pathname.startsWith("/assets/")) urls.push(parsed.href);
  }
  return urls;
}

async function verifyResourcesAndAssets(healthValue) {
  const listed = await mcpRead("resources/list");
  const resources = listed?.resources ?? [];
  const listedUris = resources.map((resource) => resource?.uri);
  assert(
    sameJson(listedUris, expectedSupportedResourceUris),
    "resources/list differed from the health compatibility ledger.",
  );
  assert(
    resources.every((resource) => resource?.mimeType === "text/html;profile=mcp-app"),
    "resources/list advertised the wrong MCP App MIME type.",
  );

  const templates = await mcpRead("resources/templates/list");
  assert(
    Array.isArray(templates?.resourceTemplates),
    "resources/templates/list returned the wrong response shape.",
  );

  const modernCsp = {
    connectDomains: [],
    resourceDomains: [publicOrigin],
    frameDomains: [],
  };
  const legacyCsp = {
    connect_domains: [],
    resource_domains: [publicOrigin],
    redirect_domains: [
      "https://files.oaiusercontent.com",
      "https://usercontent.openai.com",
      "https://chatgpt.com",
      "https://www.google.com",
      "https://scholar.google.com",
      "https://en.wikipedia.org",
      "https://federalregister.gov",
      "https://www.federalregister.gov",
      "https://openstates.org",
      "https://v3.openstates.org",
      "https://govinfo.gov",
      "https://www.govinfo.gov",
      "https://ftc.gov",
      "https://www.ftc.gov",
      "https://fema.gov",
      "https://www.fema.gov",
      "https://eur-lex.europa.eu",
      "https://publications.europa.eu",
      "https://climate.ec.europa.eu",
      "https://commission.europa.eu",
      "https://digital-markets-act.ec.europa.eu",
      "https://legislation.gov.uk",
      "https://www.legislation.gov.uk",
      "https://gdacs.org",
      "https://www.gdacs.org",
      "https://earthquake.usgs.gov",
      "https://leginfo.legislature.ca.gov",
      "https://oag.ca.gov",
      "https://www.sos.ca.gov",
      "https://vig.cdn.sos.ca.gov",
      "https://www.irs.gov",
      "https://www.nhc.noaa.gov",
      "https://www.sec.gov",
    ],
  };
  const resourceReads = [];
  const resourceReadBatchSize = 8;
  for (let offset = 0; offset < healthValue.supportedUiResourceUris.length;
    offset += resourceReadBatchSize) {
    const batch = healthValue.supportedUiResourceUris.slice(
      offset,
      offset + resourceReadBatchSize,
    );
    resourceReads.push(...await Promise.all(
      batch.map((uri) => mcpRead("resources/read", { uri })),
    ));
  }
  let currentHtml = "";
  let migrationResourceCount = 0;
  let hostReasoning = null;
  for (const [index, uri] of healthValue.supportedUiResourceUris.entries()) {
    const read = resourceReads[index];
    const content = read?.contents?.[0];
    assert(content?.uri === uri, "resources/read changed a requested compatibility URI.");
    assert(
      content?.mimeType === "text/html;profile=mcp-app",
      "resources/read returned the wrong MCP App MIME type.",
    );
    assert(typeof content?.text === "string", "resources/read returned no HTML text.");
    if (uri === expectedResourceUri) {
      assert(
        content.text.includes('<div id="root">') &&
          !content.text.includes("data-shockaudit-migration"),
        "The current UI resource returned no runnable workspace root.",
      );
      currentHtml = content.text;
    } else {
      assert(
        content.text.includes('data-shockaudit-migration="legacy-resource"') &&
          content.text.includes("Safe migration required") &&
          !content.text.includes('<div id="root">') &&
          !content.text.includes("shockaudit-app.js") &&
          !content.text.includes("shockaudit-app.css"),
        "A historical resource URI executed the current bundle instead of the migration boundary.",
      );
      migrationResourceCount += 1;
    }
    assert(
      Buffer.byteLength(content.text) < 8 * 1024,
      "A UI resource returned an oversized inline template.",
    );
    assert(
      sameJson(content?._meta?.ui?.csp, modernCsp) &&
        sameJson(content?._meta?.["openai/widgetCSP"], legacyCsp),
      "A UI resource returned the wrong closed CSP contract.",
    );
    const resourceHostReasoning = requireHostReasoningMetadata(
      content?._meta?.[hostReasoningMetaKey],
    );
    assert(
      hostReasoning === null ||
        sameJson(resourceHostReasoning, hostReasoning),
      "UI resource versions advertised inconsistent host-reasoning modes.",
    );
    hostReasoning ??= resourceHostReasoning;
  }

  const assetUrls = extractAssetUrls(currentHtml);
  const stableAssetUrls = [
    `${publicOrigin}/assets/shockaudit-app.js?v=${expectedReleaseLabel}`,
    `${publicOrigin}/assets/shockaudit-app.css?v=${expectedReleaseLabel}`,
  ];
  const preloadAssets = [
    {
      label: "Rolldown runtime",
      pattern: /^\/assets\/shockaudit-rolldown-runtime-([0-9a-f]{7}|local)\.js$/u,
    },
    {
      label: "Screen 2 runtime",
      pattern: /^\/assets\/shockaudit-screen02-runtime-([0-9a-f]{7}|local)\.js$/u,
    },
    {
      label: "Screen 2 engine",
      pattern: /^\/assets\/shockaudit-screen02-engine-([0-9a-f]{7}|local)\.js$/u,
    },
    {
      label: "Screen 3 handoff contract",
      pattern: /^\/assets\/shockaudit-screen3-handoff-contract-([0-9a-f]{7}|local)\.js$/u,
    },
    {
      label: "Screen 5 state contract",
      pattern: /^\/assets\/shockaudit-screen5-state-contract-([0-9a-f]{7}|local)\.js$/u,
    },
  ].map(({ label, pattern }) => {
    const matches = assetUrls.flatMap((url) => {
      const parsed = new URL(url);
      const match = parsed.pathname.match(pattern);
      return match ? [{ url, parsed, marker: match[1] }] : [];
    });
    assert(
      matches.length === 1,
      `The current UI template did not module-preload exactly one commit-bound ${label}.`,
    );
    assert(
      matches[0].parsed.search === "",
      `The commit-bound ${label} preload unexpectedly used a query string.`,
    );
    return { label, ...matches[0] };
  });
  const preloadMarkers = new Set(preloadAssets.map(({ marker }) => marker));
  assert(
    preloadMarkers.size === 1,
    "The five declared startup preloads did not share one build marker.",
  );
  const startupBuildMarker = preloadAssets[0].marker;
  if (expectedCommit) {
    assert(
      startupBuildMarker === expectedCommit,
      "The startup preload filenames did not match the expected production commit.",
    );
  }
  const expectedAssetUrls = [
    ...stableAssetUrls,
    ...preloadAssets.map(({ url }) => url),
  ];
  assert(
    sameJson([...assetUrls].sort(), [...expectedAssetUrls].sort()),
    "The current UI template did not reference exactly the version-qualified app/CSS and five declared commit-bound preloads.",
  );

  const assetContents = new Map();
  for (const assetUrl of assetUrls) {
    const response = await timedFetch(assetUrl);
    assert(response.ok, "A version-qualified UI asset was unavailable.");
    const pathname = new URL(assetUrl).pathname;
    const contentType = response.headers.get("content-type") ?? "";
    assert(
      pathname.endsWith(".js")
        ? contentType.includes("javascript")
        : contentType.includes("text/css"),
      "A version-qualified UI asset returned the wrong content type.",
    );
    assert(
      response.headers.get("access-control-allow-origin") === "*" &&
        response.headers.get("cross-origin-resource-policy") === "cross-origin" &&
        response.headers.get("cache-control")?.includes("no-store") &&
        response.headers.get("x-content-type-options") === "nosniff",
      "A version-qualified UI asset returned the wrong cross-origin or cache headers.",
    );
    assetContents.set(assetUrl, await response.text());
  }
  const mainAssetUrl = `${publicOrigin}/assets/shockaudit-app.js?v=${expectedReleaseLabel}`;
  const mainAssetContents = assetContents.get(mainAssetUrl) ?? "";
  const cssAssetUrl = `${publicOrigin}/assets/shockaudit-app.css?v=${expectedReleaseLabel}`;
  assert(
    (assetContents.get(cssAssetUrl) ?? "").length > 0 &&
      mainAssetContents.includes(startupBuildMarker),
    "The stable startup assets were empty or omitted their common build marker.",
  );
  for (const { label, parsed, url } of preloadAssets) {
    const preloadContents = assetContents.get(url) ?? "";
    assert(
      mainAssetContents.includes(`./${parsed.pathname.split("/").at(-1)}`) &&
        preloadContents.length > 0 &&
        !preloadContents.toLowerCase().includes("<!doctype html"),
      `The ${label} preload was empty, resolved to HTML, or was not referenced by the stable startup module.`,
    );
  }
  const deferredChunkPaths = [];
  let screen02FindModuleGraph = {
    entryPath: null,
    modulePaths: [],
    edges: [],
  };
  const legacyDeferredChunks = [
    {
      label: "Screen 2 Find",
      fileStem: "Screen02Find",
      requiredImport:
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
      primaryFind: true,
    },
    {
      label: "Screen 2 Audit",
      fileStem: "Screen02Audit",
      requiredImport:
        `./shockaudit-screen02-runtime-${startupBuildMarker}.js`,
    },
    {
      label: "Screen 3",
      fileStem: "screen03",
      requiredImport:
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
    },
    {
      label: "Screen 4",
      fileStem: "screen04",
      requiredImport:
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
    },
    {
      label: "host-reasoning audit",
      fileStem: "host-reasoning-audit",
      requiredImport:
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
    },
  ];
  if (SIX_SCREEN_REPLACEMENT_BUILD) {
    assert(
      mainAssetContents.includes("create_six_screen_workflow_v1") &&
        mainAssetContents.includes("shockaudit-six-screen-public-v1"),
      "The production startup asset did not contain the adopted six-screen workflow contract.",
    );
    for (const requiredUiText of [
      "Your study and policy",
      "Understand the policy",
      "Suggested Approach",
      "Check other events",
      "Compare explanations",
      "Design summary",
      "Policy or shock name",
      "Find my policy",
      "Confirm this policy and continue",
    ]) {
      assert(
        mainAssetContents.includes(requiredUiText),
        `The production startup asset omitted the revised six-screen UI marker “${requiredUiText}”.`,
      );
    }
    for (const { label, fileStem } of legacyDeferredChunks) {
      assert(
        !new RegExp(
          `\\./shockaudit-${fileStem}-(?:[0-9a-f]{7}|local)\\.js`,
          "u",
        ).test(mainAssetContents),
        `The six-screen replacement startup unexpectedly referenced the retired ${label} chunk.`,
      );
    }
  } else {
    let screen02FindChunkUrl = "";
    for (
      const {
        label,
        fileStem,
        requiredImport,
        primaryFind = false,
      } of legacyDeferredChunks
    ) {
      const chunkReferences = [
        ...new Set(
          [...mainAssetContents.matchAll(
            new RegExp(
              `\\./shockaudit-${fileStem}-(?:[0-9a-f]{7}|local)\\.js`,
              "g",
            ),
          )].map((match) => match[0]),
        ),
      ];
      assert(
        chunkReferences.length === 1,
        `The production startup asset did not reference exactly one commit-bound ${label} chunk.`,
      );
      const chunkUrl = new URL(chunkReferences[0], mainAssetUrl).href;
      if (primaryFind) screen02FindChunkUrl = chunkUrl;
      const chunkPath = new URL(chunkUrl).pathname;
      deferredChunkPaths.push(chunkPath);
      assert(
        chunkPath ===
          `/assets/shockaudit-${fileStem}-${startupBuildMarker}.js`,
        `The ${label} chunk filename did not share the startup build marker.`,
      );
      const chunkResponse = await timedFetch(chunkUrl);
      assert(
        chunkResponse.ok &&
          chunkResponse.headers.get("content-type")?.includes("javascript") &&
          chunkResponse.headers.get("access-control-allow-origin") === "*" &&
          chunkResponse.headers.get("cross-origin-resource-policy") === "cross-origin" &&
          chunkResponse.headers.get("cache-control")?.includes("no-store") &&
          chunkResponse.headers.get("x-content-type-options") === "nosniff",
        `The commit-bound ${label} chunk was unavailable or returned unsafe asset headers.`,
      );
      const chunkContents = await chunkResponse.text();
      assert(
        chunkContents.length > 0 &&
          !chunkContents.toLowerCase().includes("<!doctype html") &&
          chunkContents.includes(requiredImport),
        `The ${label} chunk was empty, resolved to HTML, or did not share its exact startup module.`,
      );
      assetContents.set(chunkUrl, chunkContents);
    }
    assert(
      screen02FindChunkUrl !== "",
      "The primary Screen 2 Find lazy chunk was not resolved.",
    );
    screen02FindModuleGraph = await verifyAssetModuleGraph({
      entryUrl: screen02FindChunkUrl,
      publicOrigin,
      expectedCommitShort: startupBuildMarker,
      expectedReleaseLabel,
      requiredEntrySpecifiers: [
        `./shockaudit-screen02-runtime-${startupBuildMarker}.js`,
        `./shockaudit-screen02-engine-${startupBuildMarker}.js`,
        `./shockaudit-app.js?v=${expectedReleaseLabel}`,
      ],
      fetchModule: async (moduleUrl) => {
        if (assetContents.has(moduleUrl)) return assetContents.get(moduleUrl);
        const response = await timedFetch(moduleUrl);
        assert(
          response.ok &&
            response.headers.get("content-type")?.includes("javascript") &&
            response.headers.get("access-control-allow-origin") === "*" &&
            response.headers.get("cross-origin-resource-policy") === "cross-origin" &&
            response.headers.get("cache-control")?.includes("no-store") &&
            response.headers.get("x-content-type-options") === "nosniff",
          "A recursively imported Screen 2 Find module was unavailable or returned unsafe asset headers.",
        );
        const body = await response.text();
        assetContents.set(moduleUrl, body);
        return body;
      },
    });
    for (const { label, fileStem } of legacyDeferredChunks) {
      const absentChunkResponse = await timedFetch(
        `${publicOrigin}/assets/shockaudit-${fileStem}-0000000.js`,
      );
      assert(
        absentChunkResponse.status === 404 &&
          absentChunkResponse.headers.get("access-control-allow-origin") === "*" &&
          absentChunkResponse.headers.get("cross-origin-resource-policy") === "cross-origin" &&
          absentChunkResponse.headers.get("cache-control")?.includes("no-store") &&
          absentChunkResponse.headers.get("content-type")?.includes("text/plain") &&
          absentChunkResponse.headers.get("x-content-type-options") === "nosniff",
        `An absent ${label} chunk did not fail closed as a non-cacheable 404.`,
      );
    }
  }
  const priorResourceUri = releasedResourceUris
    .filter((uri) => uri !== expectedResourceUri)
    .at(-1);
  const priorVersion = priorResourceUri?.match(/-v([^/]+)\.html$/)?.[1];
  assert(priorVersion, "No prior UI version was available for the stale-asset probe.");
  for (const assetName of ["shockaudit-app.js", "shockaudit-app.css"]) {
    const response = await timedFetch(
      `${publicOrigin}/assets/${assetName}?v=${priorVersion}`,
    );
    const body = await response.text();
    assert(
      response.status === 410 &&
        response.headers.get("access-control-allow-origin") === "*" &&
        response.headers.get("cross-origin-resource-policy") === "cross-origin" &&
        response.headers.get("cache-control")?.includes("no-store") &&
        response.headers.get("content-type")?.includes("text/plain") &&
        response.headers.get("x-content-type-options") === "nosniff" &&
        body.includes("UI asset version is retired") &&
        (!expectedCommit || !body.includes(expectedCommit)),
      "A historical version-qualified UI asset did not fail closed at the migration boundary.",
    );
  }
  return {
    artifactProfile: SIX_SCREEN_REPLACEMENT_BUILD
      ? "six-screen-replacement"
      : "legacy-deferred",
    resourceCount: resources.length,
    migrationResourceCount,
    templateCount: templates.resourceTemplates.length,
    assetPaths: [...new Set([
      ...assetUrls.map((url) => new URL(url).pathname),
      ...deferredChunkPaths,
      ...screen02FindModuleGraph.modulePaths.map(
        (path) => new URL(path, publicOrigin).pathname,
      ),
    ])].sort(),
    screen02FindModuleGraph: {
      entryPath: screen02FindModuleGraph.entryPath,
      modulePaths: screen02FindModuleGraph.modulePaths,
      edgeCount: screen02FindModuleGraph.edges.length,
    },
    legacyAssetBoundary: `410-v${priorVersion}`,
    csp: "closed",
    hostReasoning,
  };
}

async function verifySixScreenReplacementWorkflow() {
  if (!SIX_SCREEN_REPLACEMENT_BUILD) {
    return { profile: "legacy-deferred", exercised: false };
  }

  const ccpaStudy = {
    population: "US public firms",
    analysisUnit: "firm-year",
    geography: ["United States"],
    industry: ["Manufacturing industry"],
    period: { start: "2010", end: "2022" },
    outcome: "Firm performance",
    outcomeMeasure: null,
    intendedConstruct: "Customer protection",
    policySideConcept: null,
    initialExplanation: "How customer protection affects firm performance",
    proposedTreatment: "California firms",
    proposedComparison: "non-california firms",
    resultsPreviouslyInspected: "no",
  };
  const federalStudy = {
    population: "Regional transmission organizations and independent system operators",
    analysisUnit: "Market operator",
    geography: ["United States"],
    industry: ["Energy"],
    period: { start: "2016", end: "2022" },
    outcome: "Storage participation",
    outcomeMeasure: null,
    intendedConstruct: null,
    policySideConcept: "Policy-induced market participation",
    initialExplanation: null,
    proposedTreatment: null,
    proposedComparison: null,
    resultsPreviouslyInspected: "not_disclosed",
  };
  const minimalCrossPolicyStudy = {
    population: null,
    analysisUnit: null,
    geography: [],
    industry: [],
    period: { start: null, end: null },
    outcome: null,
    outcomeMeasure: null,
    intendedConstruct: null,
    policySideConcept: null,
    initialExplanation: null,
    proposedTreatment: null,
    proposedComparison: null,
    resultsPreviouslyInspected: "not_disclosed",
  };

  async function privateSnapshot(result, label) {
    const metadata = isRecord(result?._meta) ? result._meta : {};
    const wrapper = metadata[sixScreenWorkflowMetaKey];
    const contract = metadata[sixScreenWorkflowResponseMetaKey];
    assert(
      isRecord(wrapper) && isRecord(contract) &&
        /^sa6r_[A-Za-z0-9_-]{43}$/u.test(wrapper.runId ?? "") &&
        /^sa6a_[A-Za-z0-9_-]{43}$/u.test(wrapper.accessToken ?? "") &&
        Number.isSafeInteger(wrapper.revision) &&
        /^fnv1a64:[0-9a-f]{16}$/u.test(
          wrapper.stateFingerprint ?? "",
        ) &&
        contract.runId === wrapper.runId &&
        contract.revision === wrapper.revision &&
        contract.stateFingerprint === wrapper.stateFingerprint,
      `${label} omitted its private possession boundary.`,
    );
    const { responseFingerprint, ...contractBody } = contract;
    const expectedTransferId = fingerprintSixScreenValue({
      schemaVersion: sixScreenStateChunkSchemaVersion,
      buildId: expectedSixScreenResponseBuildId,
      runId: contract.runId,
      revision: contract.revision,
      stateFingerprint: contract.stateFingerprint,
      encodedStateBytes: contract.encodedStateBytes,
      canonicalStateBytes: contract.canonicalStateBytes,
    });
    assert(
      contract.schemaVersion === sixScreenResponseContractVersion &&
        contract.buildId === expectedSixScreenResponseBuildId &&
        contract.appVersion === expectedVersion &&
        contract.uiResourceUri === expectedResourceUri &&
        [
          "create_six_screen_workflow_v1",
          "get_six_screen_workflow_v1",
          "mutate_six_screen_workflow_v1",
        ].includes(contract.toolName) &&
        contract.privateSchemaVersion ===
          "shockaudit-six-screen-private-v1" &&
        contract.publicSchemaVersion ===
          "shockaudit-six-screen-public-v1" &&
        contract.stateSchemaVersion ===
          "shockaudit-six-screen-workflow-v1" &&
        contract.stateEncoding === sixScreenStateEncoding &&
        contract.publicProjectionEncoding === sixScreenStateEncoding &&
        Number.isSafeInteger(contract.encodedStateBytes) &&
        contract.encodedStateBytes >= 4 &&
        Number.isSafeInteger(contract.canonicalStateBytes) &&
        contract.canonicalStateBytes >= 2 &&
        Number.isSafeInteger(contract.encodedPublicProjectionBytes) &&
        contract.encodedPublicProjectionBytes >= 4 &&
        Number.isSafeInteger(contract.canonicalPublicProjectionBytes) &&
        contract.canonicalPublicProjectionBytes >= 2 &&
        contract.stateChunkBytes === sixScreenStateChunkBytes &&
        contract.stateTransferId === expectedTransferId &&
        responseFingerprint === fingerprintSixScreenValue(contractBody),
      `${label} returned an invalid response-v6 envelope.`,
    );
    let encodedStatePayload = contract.encodedStatePayload;
    if (contract.statePayloadMode === "chunked") {
      assert(
        contract.encodedStatePayload === "" &&
          Number.isSafeInteger(contract.stateChunkCount) &&
          contract.stateChunkCount >= 1 &&
          contract.stateChunkCount === Math.ceil(
            contract.encodedStateBytes / sixScreenStateChunkBytes,
          ) &&
          typeof contract.stateTransferId === "string",
        `${label} returned an invalid chunked state descriptor.`,
      );
      const chunks = [];
      for (let chunkIndex = 0;
        chunkIndex < contract.stateChunkCount;
        chunkIndex += 1) {
        const chunkResult = await callTool(
          sixScreenStateChunkTool,
          {
            runId: wrapper.runId,
            accessToken: wrapper.accessToken,
            transferId: contract.stateTransferId,
            revision: contract.revision,
            stateFingerprint: contract.stateFingerprint,
            encodedStateBytes: contract.encodedStateBytes,
            canonicalStateBytes: contract.canonicalStateBytes,
            chunkIndex,
          },
        );
        assertToolSuccess(chunkResult, `${label} state chunk ${chunkIndex}`);
        const envelope = chunkResult?.structuredContent;
        const encodedStateChunk = envelope?.encodedStateChunk;
        const { responseFingerprint, ...body } = isRecord(envelope)
          ? envelope : {};
        const chunkBytes = typeof encodedStateChunk === "string"
          ? Buffer.byteLength(encodedStateChunk, "utf8") : 0;
        assert(
          isRecord(envelope) &&
            Object.keys(envelope).length === 17 &&
            envelope.schemaVersion ===
              sixScreenStateChunkSchemaVersion &&
            envelope.buildId === expectedSixScreenResponseBuildId &&
            envelope.appVersion === expectedVersion &&
            envelope.uiResourceUri === expectedResourceUri &&
            envelope.toolName === sixScreenStateChunkTool &&
            envelope.transferId === contract.stateTransferId &&
            envelope.runId === contract.runId &&
            envelope.revision === contract.revision &&
            envelope.stateFingerprint === contract.stateFingerprint &&
            envelope.encodedStateBytes === contract.encodedStateBytes &&
            envelope.canonicalStateBytes === contract.canonicalStateBytes &&
            envelope.chunkIndex === chunkIndex &&
            envelope.chunkCount === contract.stateChunkCount &&
            envelope.chunkBytes === chunkBytes && chunkBytes > 0 &&
            chunkBytes <= sixScreenStateChunkBytes &&
            envelope.chunkFingerprint ===
              fingerprintSixScreenValue(encodedStateChunk) &&
            responseFingerprint === fingerprintSixScreenValue(body),
          `${label} returned an invalid authenticated state chunk.`,
        );
        chunks.push(encodedStateChunk);
      }
      encodedStatePayload = chunks.join("");
      assert(
        Buffer.byteLength(encodedStatePayload, "utf8") ===
          contract.encodedStateBytes,
        `${label} returned an incomplete authenticated state transfer.`,
      );
    } else {
      assert(
        contract.statePayloadMode === "inline" &&
          contract.stateChunkCount === 0,
        `${label} returned an invalid inline state descriptor.`,
      );
    }
    const state = decodeSixScreenWorkflowPayload(
      encodedStatePayload,
      contract.encodedStateBytes,
      contract.canonicalStateBytes,
    );
    const publicProjection = decodeSixScreenWorkflowPayload(
      contract.encodedPublicProjectionPayload,
      contract.encodedPublicProjectionBytes,
      contract.canonicalPublicProjectionBytes,
    );
    const snapshot = {
      schemaVersion: wrapper.schemaVersion,
      runId: wrapper.runId,
      accessToken: wrapper.accessToken,
      revision: wrapper.revision,
      stateFingerprint: wrapper.stateFingerprint,
      state,
    };
    assert(
      snapshot.runId === wrapper.runId &&
        snapshot.accessToken === wrapper.accessToken &&
        snapshot.revision === wrapper.revision &&
        snapshot.stateFingerprint === wrapper.stateFingerprint &&
        isRecord(snapshot.state) &&
        state.runId === contract.runId &&
        state.revision === contract.revision &&
        fingerprintSixScreenValue(state) === contract.stateFingerprint &&
        isRecord(publicProjection) &&
        publicProjection.runId === contract.runId &&
        publicProjection.revision === contract.revision &&
        fingerprintSixScreenValue(publicProjection) ===
          contract.publicProjectionFingerprint,
      `${label} response-v6 state did not match its private coordinates.`,
    );
    assert(
      !JSON.stringify(result?.structuredContent ?? {}).includes(
        wrapper.accessToken,
      ),
      `${label} exposed its possession token publicly.`,
    );
    return snapshot;
  }

  function retainedStudyDraft(study) {
    return {
      population: study?.population ?? null,
      analysisUnit: study?.analysisUnit ?? null,
      geography: study?.geography ?? [],
      industry: study?.industry ?? [],
      period: study?.period ?? { start: null, end: null },
      outcome: study?.outcome ?? null,
      outcomeMeasure: study?.outcomeMeasure ?? null,
      intendedConstruct: study?.intendedConstruct ?? null,
      policySideConcept: study?.policySideConcept ?? null,
      initialExplanation: study?.initialExplanation ?? null,
      proposedTreatment: study?.proposedTreatment ?? null,
      proposedComparison: study?.proposedComparison ?? null,
      resultsPreviouslyInspected:
        study?.resultsPreviouslyInspected ?? "not_disclosed",
    };
  }

  async function runJourney(input) {
    const operationPrefix =
      `live-six-${input.id}-${liveVerifierRunId}`;
    const created = await callTool("create_six_screen_workflow_v1", {
      operationId: `${operationPrefix}-create`,
      shockInput: input.shockInput,
      study: input.study,
      requestedJurisdiction: input.requestedJurisdiction,
      approximateYear: input.approximateYear,
      intendedEpisode: input.intendedEpisode,
      ...(input.officialSourceLocators
        ? { officialSourceLocators: input.officialSourceLocators }
        : {}),
    });
    assertToolSuccess(created, `${input.label} creation`);
    const createdProjection = created.structuredContent;
    const createdPrivate = await privateSnapshot(
      created,
      `${input.label} creation`,
    );
    assert(
      createdProjection?.schemaVersion === "shockaudit-six-screen-public-v1" &&
        createdProjection.activeScreen === 1 &&
        createdProjection.status === "identity_input" &&
        createdProjection.revision === 0 &&
        createdProjection.originalShockInput === input.shockInput &&
        createdProjection.currentShockInput === input.shockInput &&
        createdProjection.confirmedShock === null &&
        createdProjection.candidates?.length === 0 &&
        createdPrivate.runId === createdProjection.runId,
      `${input.label} creation returned the wrong initial public projection.`,
    );
    assert(
      serializeDeterministicJson(retainedStudyDraft(createdProjection.study)) ===
        serializeDeterministicJson(input.study),
      `${input.label} creation did not preserve the exact study fields.`,
    );

    const resolved = await callTool("mutate_six_screen_workflow_v1", {
      runId: createdPrivate.runId,
      accessToken: createdPrivate.accessToken,
      mutation: {
        action: "resolve_shock",
        expectedRevision: createdProjection.revision,
        operationId: `${operationPrefix}-resolve`,
      },
    });
    assertToolSuccess(resolved, `${input.label} identity resolution`);
    const resolvedProjection = resolved.structuredContent;
    const resolvedPrivate = await privateSnapshot(
      resolved,
      `${input.label} identity resolution`,
    );
    assert(
      resolvedProjection.status === "identity_review" &&
        resolvedProjection.confirmedShock === null &&
        resolvedProjection.candidates.length >= 1 &&
        resolvedProjection.candidates.length <= 3,
      `${input.label} did not return one to three unconfirmed candidates.`,
    );
    const candidate = resolvedProjection.candidates.find((item) =>
      item.officialTitle === input.expectedTitle
    );
    assert(
      candidate && candidate.issuingJurisdiction === input.expectedJurisdiction &&
        candidate.instrumentType === input.expectedInstrumentType &&
        candidate.identitySources.some((source) =>
          source.accessStatus === "retained_passage" &&
          source.inspectedText !== "metadata_only" &&
          typeof source.retainedText === "string" &&
          source.retainedText.trim().length > 0
        ),
      `${input.label} did not return the expected source-backed continuation candidate.`,
    );
    if (input.expectedFormalIdentifier) {
      assert(
        candidate.formalIdentifiers.includes(input.expectedFormalIdentifier),
        `${input.label} did not preserve the expected formal identifier.`,
      );
    }
    if (input.expectedRouteIds) {
      assert(
        candidate.identitySources.some(
          ({ routeId }) => input.expectedRouteIds.includes(routeId),
        ),
        `${input.label} did not use the expected operational source route.`,
      );
    }
    if (input.expectedAllRouteIds) {
      assert(
        input.expectedAllRouteIds.every((expectedRouteId) =>
          candidate.identitySources.some(({ routeId }) =>
            routeId === expectedRouteId)),
        `${input.label} did not complete every expected operational source route.`,
      );
    }
    if (input.expectedAlias) {
      assert(
        candidate.aliases.includes(input.expectedAlias),
        `${input.label} did not preserve the expected alias.`,
      );
    }
    if (input.expectedLocator) {
      assert(
        candidate.identitySources.some(
          ({ locator }) => locator === input.expectedLocator,
        ),
        `${input.label} did not retain the supplied official locator.`,
      );
    }
    if (input.descriptionWordRange) {
      const wordCount = candidate.displayedDescription.trim().split(/\s+/u).length;
      assert(
        wordCount >= input.descriptionWordRange[0] &&
          wordCount <= input.descriptionWordRange[1],
        `${input.label} returned a match description outside the reviewed word range.`,
      );
    }

    let confirmationProjection = resolvedProjection;
    let confirmationPrivate = resolvedPrivate;
    if (resolvedPrivate.state.displayedCandidateId !== candidate.id) {
      const displayed = await callTool("mutate_six_screen_workflow_v1", {
        runId: resolvedPrivate.runId,
        accessToken: resolvedPrivate.accessToken,
        mutation: {
          action: "display_identity",
          expectedRevision: resolvedProjection.revision,
          operationId: `${operationPrefix}-display-candidate`,
          candidateId: candidate.id,
        },
      });
      assertToolSuccess(displayed, `${input.label} candidate display`);
      confirmationProjection = displayed.structuredContent;
      confirmationPrivate = await privateSnapshot(
        displayed,
        `${input.label} candidate display`,
      );
      assert(
        confirmationProjection.status === "identity_review" &&
          confirmationProjection.confirmedShock === null &&
          confirmationPrivate.state.displayedCandidateId === candidate.id &&
          confirmationProjection.candidates.some((item) =>
            item.id === candidate.id &&
            item.identityFingerprint === candidate.identityFingerprint
          ),
        `${input.label} did not display the selected identity before confirmation.`,
      );
    }

    const confirmationMutation = {
      action: "confirm_shock",
      expectedRevision: confirmationProjection.revision,
      operationId: `${operationPrefix}-confirm`,
      candidateId: candidate.id,
      displayedIdentityFingerprint: candidate.identityFingerprint,
      sourceSnapshotId: candidate.sourceSnapshotId,
      sourceSnapshotFingerprint: candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:
        confirmationPrivate.state.originalRequestFingerprint,
      currentRequestFingerprint:
        confirmationPrivate.state.currentRequestFingerprint,
      identityRevision: confirmationProjection.identityRevision,
    };
    const confirmed = await callTool("mutate_six_screen_workflow_v1", {
      runId: confirmationPrivate.runId,
      accessToken: confirmationPrivate.accessToken,
      mutation: confirmationMutation,
    });
    assertToolSuccess(confirmed, `${input.label} explicit confirmation`);
    const confirmedProjection = confirmed.structuredContent;
    const confirmedPrivate = await privateSnapshot(
      confirmed,
      `${input.label} explicit confirmation`,
    );
    assert(
      confirmedProjection.status === "shock_confirmed" &&
        confirmedProjection.activeScreen === 1 &&
        confirmedProjection.confirmedShock?.id === candidate.id &&
        confirmedProjection.confirmedShock?.identityFingerprint ===
          candidate.identityFingerprint &&
        confirmedPrivate.state.confirmedShock?.confirmation?.actor ===
          "researcher",
      `${input.label} confirmation was not bound to the displayed identity.`,
    );
    const replayedConfirmation = await callTool(
      "mutate_six_screen_workflow_v1",
      {
        runId: confirmationPrivate.runId,
        accessToken: confirmationPrivate.accessToken,
        mutation: confirmationMutation,
      },
    );
    assertToolSuccess(
      replayedConfirmation,
      `${input.label} confirmation replay`,
    );
    const replayedPrivate = await privateSnapshot(
      replayedConfirmation,
      `${input.label} confirmation replay`,
    );
    assert(
      replayedConfirmation.structuredContent.revision ===
        confirmedProjection.revision &&
        replayedPrivate.state.confirmedShock?.confirmation?.decisionId ===
          confirmedPrivate.state.confirmedShock.confirmation.decisionId,
      `${input.label} repeated confirmation created a second decision.`,
    );

    const opened = await callTool("mutate_six_screen_workflow_v1", {
      runId: confirmedPrivate.runId,
      accessToken: confirmedPrivate.accessToken,
      mutation: {
        action: "open_screen_2",
        expectedRevision: confirmedProjection.revision,
        operationId: `${operationPrefix}-open-screen-2`,
      },
    });
    assertToolSuccess(opened, `${input.label} Screen 2 handoff`);
    const openedProjection = opened.structuredContent;
    const openedPrivate = await privateSnapshot(
      opened,
      `${input.label} Screen 2 handoff`,
    );
    assert(
      openedProjection.activeScreen === 2 &&
        openedProjection.confirmedShock?.identityFingerprint ===
          candidate.identityFingerprint,
      `${input.label} did not open Screen 2 for the confirmed identity.`,
    );

    const researched = await callTool("mutate_six_screen_workflow_v1", {
      runId: openedPrivate.runId,
      accessToken: openedPrivate.accessToken,
      mutation: {
        action: "research_policy",
        expectedRevision: openedProjection.revision,
        operationId: `${operationPrefix}-research-policy`,
      },
    });
    assertToolSuccess(researched, `${input.label} Screen 2 research`);
    let researchedProjection = researched.structuredContent;
    let researchedPrivate = await privateSnapshot(
      researched,
      `${input.label} Screen 2 research`,
    );
    let review = researchedProjection.policyReview;
    const expectedPlanFamily = input.expectedPlanFamily ?? "official_document";
    assert(
      researchedProjection.activeScreen === 2 &&
        researchedProjection.confirmedShock?.identityFingerprint ===
          candidate.identityFingerprint &&
        isSourceBackedInitialPolicyReview(review, expectedPlanFamily),
      `${input.label} did not produce source-backed initial Screen 2 evidence. Diagnostic: ${JSON.stringify(
        introductoryPolicyReviewDiagnostic(review, expectedPlanFamily),
      )}`,
    );
    const introductoryReview = {
      status: review.status,
      evidenceSnapshotId: review.evidenceSnapshotId,
      sourceCount: review.sourceCount,
      passageCount: review.passageCount,
      claimCount: review.claimCount,
      explanationRouteStatus: policyEvidenceRouteStatus(
        review,
        "complementary_policy_explanations",
      ),
    };
    const precisePolicyRoute = precisePolicyRouteForInstrumentFamily(
      expectedPlanFamily,
    );
    if (policyEvidenceRouteStatus(review, precisePolicyRoute) === "not_started") {
      const continued = await callTool("mutate_six_screen_workflow_v1", {
        runId: researchedPrivate.runId,
        accessToken: researchedPrivate.accessToken,
        mutation: {
          action: "continue_policy_research",
          expectedRevision: researchedProjection.revision,
          operationId: `${operationPrefix}-continue-policy-precise`,
        },
      });
      assertToolSuccess(
        continued,
        `${input.label} precise Screen 2 continuation`,
      );
      researchedProjection = continued.structuredContent;
      researchedPrivate = await privateSnapshot(
        continued,
        `${input.label} precise Screen 2 continuation`,
      );
      review = researchedProjection.policyReview;
    }
    assert(
      researchedProjection.activeScreen === 2 &&
        researchedProjection.confirmedShock?.identityFingerprint ===
          candidate.identityFingerprint &&
        isSourceBackedAttemptedPrecisePolicyReview(
          review,
          expectedPlanFamily,
        ),
      `${input.label} did not attempt its precise policy route while retaining independently supported Screen 2 evidence.`,
    );
    for (let index = 0; index < (input.continuePolicySteps ?? 0); index += 1) {
      const continued = await callTool("mutate_six_screen_workflow_v1", {
        runId: researchedPrivate.runId,
        accessToken: researchedPrivate.accessToken,
        mutation: {
          action: "continue_policy_research",
          expectedRevision: researchedProjection.revision,
          operationId: `${operationPrefix}-continue-policy-${index + 1}`,
        },
      });
      assertToolSuccess(
        continued,
        `${input.label} Screen 2 continuation ${index + 1}`,
      );
      researchedProjection = continued.structuredContent;
      researchedPrivate = await privateSnapshot(
        continued,
        `${input.label} Screen 2 continuation ${index + 1}`,
      );
      review = researchedProjection.policyReview;
      assert(
        review?.evidenceSnapshotId && review.claimCount >= 1,
        `${input.label} lost source-backed evidence during continuation ${index + 1}.`,
      );
    }
    if (input.expectedPolicyPredicates) {
      const missingPredicates = input.expectedPolicyPredicates.filter(
        (predicate) => !review.claims.some((claim) =>
          claim.predicate === predicate &&
          typeof claim.citation?.exactText === "string" &&
          claim.citation.exactText.trim().length > 0 &&
          typeof claim.citation?.canonicalUrl === "string" &&
          claim.citation.canonicalUrl.startsWith("https://")),
      );
      assert(
        missingPredicates.length === 0,
        `${input.label} omitted expected source-linked policy facts: ${missingPredicates.join(", ")}.`,
      );
    }
    const briefingShape = {
      overviewHasTitle:
        typeof review.briefing?.overview === "string" &&
        review.briefing.overview.includes(candidate.officialTitle),
      whatChangedParagraphs:
        Array.isArray(review.briefing?.whatChanged?.paragraphs)
          ? review.briefing.whatChanged.paragraphs.length
          : -1,
      hasTimeline: Array.isArray(review.briefing?.timeline),
      coverageParagraphs: Array.isArray(review.briefing?.coverage?.paragraphs)
        ? review.briefing.coverage.paragraphs.length
        : -1,
      enforcementParagraphs:
        Array.isArray(review.briefing?.enforcement?.paragraphs)
          ? review.briefing.enforcement.paragraphs.length
          : -1,
      hasUnresolvedQuestions:
        Array.isArray(review.briefing?.unresolvedQuestions),
    };
    assert(
      briefingShape.overviewHasTitle &&
        briefingShape.whatChangedParagraphs > 0 &&
        briefingShape.hasTimeline &&
        briefingShape.coverageParagraphs >= 0 &&
        briefingShape.enforcementParagraphs >= 0 &&
        briefingShape.hasUnresolvedQuestions,
      `${input.label} did not produce the expected substantive Screen 2 briefing structure (${JSON.stringify(briefingShape)}).`,
    );
    if (input.expectedSearchedSourceRoute) {
      assert(
        review.plan.steps.some((step) =>
          step.sourceRoute === input.expectedSearchedSourceRoute &&
          step.status === "searched"),
        `${input.label} did not complete the expected credentialed Screen 2 source step.`,
      );
    }
    if (input.expectedEvidenceProvider) {
      assert(
        hasExpectedEvidenceProvider(
          review.claims,
          input.expectedEvidenceProvider,
        ),
        `${input.label} retained no source-linked evidence from the expected provider.`,
      );
    }

    const restored = await callTool("get_six_screen_workflow_v1", {
      runId: researchedPrivate.runId,
      accessToken: researchedPrivate.accessToken,
    });
    assertToolSuccess(restored, `${input.label} durable restoration`);
    assert(
      restored.structuredContent.revision === researchedProjection.revision &&
        restored.structuredContent.activeScreen === 2 &&
        restored.structuredContent.confirmedShock?.identityFingerprint ===
          candidate.identityFingerprint &&
        restored.structuredContent.policyReview?.evidenceSnapshotId ===
          review.evidenceSnapshotId &&
        serializeDeterministicJson(
          retainedStudyDraft(restored.structuredContent.study),
        ) === serializeDeterministicJson(input.study),
      `${input.label} did not durably restore identity, study, and evidence.`,
    );

    return {
      label: input.label,
      originalInput: input.shockInput,
      suppliedSource: input.expectedLocator ?? null,
      candidateCount: resolvedProjection.candidates.length,
      confirmedTitle: candidate.officialTitle,
      confirmedJurisdiction: candidate.issuingJurisdiction,
      confirmedInstrumentType: candidate.instrumentType,
      confirmedEpisode: candidate.episode,
      sourceRouteIds: [...new Set(
        candidate.identitySources.map(({ routeId }) => routeId).filter(Boolean),
      )],
      explicitConfirmation: true,
      confirmationReplayStable: true,
      activeScreen: restored.structuredContent.activeScreen,
      policyReviewStatus: review.status,
      policyReviewTaskId: review.taskId,
      evidenceSnapshotId: review.evidenceSnapshotId,
      sourceCount: review.sourceCount,
      passageCount: review.passageCount,
      claimCount: review.claimCount,
      introductoryReview,
      precisePolicyRoute,
      precisePolicyRouteStatus: policyEvidenceRouteStatus(
        review,
        precisePolicyRoute,
      ),
      unresolved: review.unresolved,
      studyPreserved: true,
      durableReadAfterResearch: true,
    };
  }

  const journeys = [];
  journeys.push(await runJourney({
    id: "ccpa-name",
    label: "CCPA name-only journey",
    shockInput: "California Consumer Privacy Act",
    study: ccpaStudy,
    requestedJurisdiction: "California",
    approximateYear: null,
    intendedEpisode: "Not sure yet",
    expectedTitle: "California Consumer Privacy Act",
    expectedAlias: "CCPA",
    expectedJurisdiction: "California, United States",
    expectedInstrumentType: "state legislation",
    descriptionWordRange: [80, 120],
  }));
  journeys.push(await runJourney({
    id: "ccpa-source",
    label: "CCPA supplied-source journey",
    shockInput: "California Consumer Privacy Act",
    officialSourceLocators: ["https://oag.ca.gov/privacy/ccpa"],
    study: ccpaStudy,
    requestedJurisdiction: "California",
    approximateYear: "2018",
    intendedEpisode: "Implementation",
    expectedTitle: "California Consumer Privacy Act",
    expectedAlias: "CCPA",
    expectedJurisdiction: "California, United States",
    expectedInstrumentType: "state legislation",
    expectedLocator: "https://oag.ca.gov/privacy/ccpa",
    descriptionWordRange: [80, 120],
  }));
  journeys.push(await runJourney({
    id: "ferc-order-841",
    label: "federal Order 841 regression journey",
    shockInput: "FERC Order 841",
    study: federalStudy,
    requestedJurisdiction: "United States",
    approximateYear: "2018",
    intendedEpisode: "Adoption or final rule",
    expectedTitle: "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
    expectedAlias: "FERC Order 841 Electric Storage Participation Rule",
    expectedJurisdiction: "United States",
    expectedInstrumentType: "federal administrative rule",
    expectedPlanFamily: "federal_rule",
    expectedPolicyPredicates: [
      "operative_change", "legal_effect_date", "implementation_schedule",
    ],
  }));
  journeys.push(await runJourney({
    id: "ada-amendments-2008",
    label: "uncataloged ADA Amendments Act federal-statute journey",
    shockInput: "ADA Amendments Act of 2008",
    study: minimalCrossPolicyStudy,
    requestedJurisdiction: "United States",
    approximateYear: "2008",
    intendedEpisode: "Enactment",
    expectedTitle: "ADA Amendments Act of 2008",
    expectedFormalIdentifier: "PLAW-110publ325",
    expectedAllRouteIds: [
      "govinfo_public_law",
      "congress_public_law_bill_text",
    ],
    expectedJurisdiction: "United States",
    expectedInstrumentType: "federal statute (public law)",
    expectedPlanFamily: "federal_statute",
    expectedPolicyPredicates: [
      "operative_change", "coverage_condition", "exemption_rule",
      "legal_effect_date",
    ],
  }));
  journeys.push(await runJourney({
    id: "tobacco-control-2009",
    label: "uncataloged Tobacco Control Act federal-statute journey",
    shockInput: "Family Smoking Prevention and Tobacco Control Act",
    study: minimalCrossPolicyStudy,
    requestedJurisdiction: "United States",
    approximateYear: "2009",
    intendedEpisode: "Enactment",
    expectedTitle: "Family Smoking Prevention and Tobacco Control Act",
    expectedFormalIdentifier: "PLAW-111publ31",
    expectedAllRouteIds: [
      "govinfo_public_law",
      "congress_public_law_bill_text",
    ],
    expectedJurisdiction: "United States",
    expectedInstrumentType: "federal statute (public law)",
    expectedPlanFamily: "federal_statute",
    expectedPolicyPredicates: [
      "operative_change", "coverage_condition", "threshold_condition",
      "implementation_schedule", "enforcement_authority",
    ],
  }));
  journeys.push(await runJourney({
    id: "defend-trade-secrets-2016",
    label: "uncataloged Defend Trade Secrets Act federal-statute journey",
    shockInput: "Defend Trade Secrets Act of 2016",
    study: minimalCrossPolicyStudy,
    requestedJurisdiction: "United States",
    approximateYear: "2016",
    intendedEpisode: "Enactment",
    expectedTitle: "Defend Trade Secrets Act of 2016",
    expectedFormalIdentifier: "PLAW-114publ153",
    expectedAllRouteIds: [
      "govinfo_public_law",
      "congress_public_law_bill_text",
    ],
    expectedJurisdiction: "United States",
    expectedInstrumentType: "federal statute (public law)",
    expectedPlanFamily: "federal_statute",
    expectedPolicyPredicates: [
      "coverage_condition", "operative_change", "remedy", "penalty",
      "legal_effect_date",
    ],
  }));
  journeys.push(await runJourney({
    id: "hospital-price-transparency-name",
    label: "uncataloged Hospital Price Transparency name-only journey",
    shockInput: "Hospital Price Transparency Final Rule",
    study: minimalCrossPolicyStudy,
    expectedTitle: "Medicare and Medicaid Programs: CY 2020 Hospital Outpatient PPS Policy Changes and Payment Rates and Ambulatory Surgical Center Payment System Policy Changes and Payment Rates. Price Transparency Requirements for Hospitals To Make Standard Charges Public",
    expectedFormalIdentifier: "2019-24931",
    expectedRouteIds: [
      "exact_federal_register_document",
      "federal_register_api_excerpt",
    ],
    expectedJurisdiction: "United States",
    expectedInstrumentType: "Rule",
    expectedPlanFamily: "federal_rule",
    continuePolicySteps: 3,
    expectedSearchedSourceRoute: "regulations_gov_docket",
    expectedEvidenceProvider: "Regulations.gov",
    expectedPolicyPredicates: [
      "coverage_condition", "operative_change", "legal_effect_date",
      "enforcement_authority", "penalty", "historical_version_change",
    ],
  }));
  journeys.push(await runJourney({
    id: "procurement-act-2023-name",
    label: "uncataloged Procurement Act 2023 name-only journey",
    shockInput: "Procurement Act 2023",
    study: minimalCrossPolicyStudy,
    expectedTitle: "Procurement Act 2023",
    expectedFormalIdentifier: "ukpga/2023/54",
    expectedRouteIds: ["uk_legislation_document"],
    expectedJurisdiction: "United Kingdom",
    expectedInstrumentType: "UK legislation",
  }));

  return {
    profile: "six-screen-replacement",
    exercised: true,
    tools: [
      "create_six_screen_workflow_v1",
      "get_six_screen_workflow_v1",
      "mutate_six_screen_workflow_v1",
    ],
    schemaVersion: "shockaudit-six-screen-public-v1",
    possessionTokenPublic: false,
    journeyCount: journeys.length,
    journeys,
  };
}

async function verifyNoCurrentSkillsSurface() {
  const initialized = await initialize();
  assert(
    !isRecord(initialized?.capabilities?.extensions) ||
      !Object.prototype.hasOwnProperty.call(
        initialized.capabilities.extensions,
        "io.modelcontextprotocol/skills",
      ),
    "The current MCP server still advertised the retired skills extension.",
  );
  for (const [method, params] of [
    ["skills/list", {}],
    ["skills/get", { uri: "skill://shockaudit/retired" }],
  ]) {
    const exchange = await rawMcpExchange(
      method,
      params,
      "/mcp",
      negotiatedProtocolHeaders,
    );
    assert(
      exchange.response.ok &&
        exchange.payload?.error?.code === -32601 &&
        !Object.prototype.hasOwnProperty.call(exchange.payload ?? {}, "result"),
      `${method} remained callable on the current MCP surface.`,
    );
  }
  return {
    status: "not-advertised",
    extension: "absent",
    methods: "method-not-found",
  };
}

async function verifyBodyLimit() {
  const response = await timedFetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: Buffer.alloc(16 * 1024 * 1024 + 1, 0x78),
  });
  await response.arrayBuffer();
  assert(response.status === 413, "The 16 MiB MCP request limit did not reject an oversized body.");
  return { limitBytes: 16 * 1024 * 1024, oversizedStatus: 413 };
}

function screen01Fixture(mode, round) {
  const audit = mode === "audit";
  const sentence = audit
    ? "Audit whether the California Consumer Privacy Act affected innovation among U.S. publicly listed technology firms from 2015 to 2023."
    : reviewedFindAcceptance.sentence;
  return {
    mode,
    sentence,
    revision: (audit ? 9 : 8) + round,
    contractSourceSentence: sentence,
    scope: audit ? {
      population: "U.S. publicly listed technology firms",
      assignmentLevel: "Firm",
      analysisLevel: "Firm",
      geography: "United States",
      industry: "Technology",
      studyPeriod: audit ? "2015–2023" : "2016–2020",
      eventFamily: "Regulation",
      outcomeFamily: "Innovation",
      outcomeFrequency: "Annual",
    } : { ...reviewedFindAcceptance.scope },
    knownShock: audit ? "California Consumer Privacy Act" : "",
    resolvedKeys: decisionKeys,
    scopeDirty: false,
  };
}

function assertScreen01Result(result, label) {
  assertToolSuccess(result, label);
  assert(
    result?.structuredContent?.screen === "screen-01" &&
      result?.structuredContent?.ok === true,
    `${label} returned the wrong Screen 1 result.`,
  );
}

async function confirmedSignedScreen01Context(mode, round) {
  const fixture = screen01Fixture(mode, round);
  const sourceState = { ...fixture, confirmed: false };
  const opened = await callTool("open_shockaudit_screen_1", {
    mode,
    sentence: fixture.sentence,
  });
  assertScreen01Result(opened, `Round ${round} Screen 1 open`);

  const operationId =
    `live-screen01-host-${mode}-${round}-${liveVerifierRunId}`;
  const prepared = await callTool(screen01HostPrepareTool, {
    schemaVersion: "screen-01-host-draft-prepare-input-v1",
    operationId,
    sourceState,
  });
  assertToolSuccess(prepared, `Round ${round} Screen 1 host preparation`);
  const task = prepared.structuredContent;
  assert(
    hasExactKeys(task, [
      "schemaVersion",
      "phase",
      "operationId",
      "requestId",
      "sourceRevision",
      "sourceStateDigest",
      "mode",
      "sentence",
      "issuedAt",
      "expiresAt",
      "requiredTool",
      "prompt",
      "modelContext",
    ]) &&
      task.schemaVersion === "screen-01-host-draft-task-v1" &&
      task.phase === "prepared" &&
      task.operationId === operationId &&
      task.mode === mode &&
      task.sentence === fixture.sentence &&
      task.requiredTool === screen01HostSubmitTool &&
      task.modelContext?.requestId === task.requestId &&
      task.modelContext?.submission?.tool === screen01HostSubmitTool &&
      task.modelContext?.submission?.capabilityToken,
    `Round ${round} ${mode} Screen 1 did not prepare the exact signed ChatGPT-host task.`,
  );
  const draft = { scope: fixture.scope, knownShock: fixture.knownShock };
  const submission = {
    schemaVersion: "screen-01-host-draft-submission-v1",
    capabilityToken: task.modelContext.submission.capabilityToken,
    requestId: task.requestId,
    draft,
  };
  const wrongPacket = await callTool(screen01HostSubmitTool, {
    ...submission,
    ...(mode === "find"
      ? { draft: { ...draft, knownShock: "Out-of-packet shock" } }
      : { draft: { ...draft, unexpected: "out-of-packet" } }),
  });
  assertToolError(
    wrongPacket,
    mode === "find" ? /empty knownShock/i : /unrecognized|malformed/i,
    `Round ${round} ${mode} Screen 1 out-of-packet host draft`,
  );
  const submitted = await callTool(screen01HostSubmitTool, submission);
  assertToolSuccess(submitted, `Round ${round} Screen 1 host submission`);
  const receipt = submitted.structuredContent;
  assert(
    hasExactKeys(receipt, [
      "schemaVersion",
      "phase",
      "operationId",
      "requestId",
      "receiptId",
      "sourceRevision",
      "sourceStateDigest",
      "receivedAt",
      "receiptToken",
    ]) &&
      receipt.schemaVersion === "screen-01-host-draft-receipt-v1" &&
      receipt.phase === "signed-receipt" &&
      receipt.operationId === operationId &&
      receipt.requestId === task.requestId &&
      typeof receipt.receiptToken === "string",
    `Round ${round} ${mode} Screen 1 host submission returned the wrong signed receipt.`,
  );
  const applyInput = {
    schemaVersion: "screen-01-host-draft-apply-input-v1",
    operationId,
    sourceState,
    receiptToken: receipt.receiptToken,
  };
  const applied = await callTool(screen01HostApplyTool, applyInput);
  assertToolSuccess(applied, `Round ${round} Screen 1 host receipt application`);
  const application = applied.structuredContent;
  assert(
    hasExactKeys(application, [
      "schemaVersion",
      "phase",
      "ok",
      "operationId",
      "requestId",
      "receiptId",
      "sourceRevision",
      "sourceStateDigest",
      "proposedState",
      "ambiguities",
      "message",
    ]) &&
      application.schemaVersion === "screen-01-host-draft-application-v1" &&
      application.phase === "applied" &&
      application.ok === true &&
      application.proposedState?.confirmed === false &&
      application.proposedState?.revision === sourceState.revision + 1 &&
      sameCanonicalJsonValue(application.proposedState?.scope, fixture.scope) &&
      application.proposedState?.knownShock === fixture.knownShock,
    `Round ${round} ${mode} Screen 1 did not apply the authenticated host proposal as an unconfirmed draft.`,
  );
  const replayedApplication = await callTool(screen01HostApplyTool, applyInput);
  assertToolSuccess(
    replayedApplication,
    `Round ${round} Screen 1 host receipt replay`,
  );
  assert(
    sameJson(replayedApplication.structuredContent, application),
    `Round ${round} ${mode} Screen 1 receipt replay changed the stateless proposal.`,
  );
  const staleApplication = await callTool(screen01HostApplyTool, {
    ...applyInput,
    sourceState: application.proposedState,
  });
  assertToolError(
    staleApplication,
    /changed while ChatGPT was drafting/i,
    `Round ${round} ${mode} Screen 1 stale receipt`,
  );

  const { confirmed: _unconfirmed, ...confirmInput } =
    application.proposedState;
  const confirmed = await callTool("confirm_scope_contract", {
    ...confirmInput,
    resolvedKeys: fixture.resolvedKeys,
  });
  assertScreen01Result(confirmed, `Round ${round} Scope Contract confirmation`);
  const context = confirmed.structuredContent.studyContext;
  assert(
    context?.schemaVersion === "1.0" &&
      context?.appVersion === expectedVersion &&
      context?.sourceScreen === "screen-01" &&
      context?.startingPoint === mode &&
      context?.studySentence === fixture.sentence &&
      context?.contractSourceSentence === fixture.sentence &&
      context?.knownShock === fixture.knownShock &&
      sameCanonicalJsonValue(context?.scopeContract, fixture.scope) &&
      sameJson(context?.resolvedKeys, mode === "audit" ? decisionKeys : scopeKeys) &&
      sameJson(context?.unresolvedDecisions, []) &&
      context?.scopeDirty === false &&
      context?.confirmed === true &&
      context?.readyForLaterScreens === true &&
      context?.revision === application.proposedState.revision,
    `Round ${round} ${mode} confirmation did not return the exact immutable handoff.`,
  );
  return {
    context,
    hostEvidence: {
      prepared: true,
      receipt: "signed",
      applied: "unconfirmed-proposal",
      replay: "idempotent",
      stale: "rejected",
      outOfPacket: "rejected",
      userConfirmation: "fixed-validation",
    },
  };
}

async function confirmedDeterministicScreen01Context(mode, round) {
  const fixture = screen01Fixture(mode, round);
  const opened = await callTool("open_shockaudit_screen_1", {
    mode,
    sentence: fixture.sentence,
  });
  assertScreen01Result(opened, `Round ${round} Screen 1 open`);

  const drafted = await callTool("draft_scope_contract", {
    mode,
    sentence: fixture.sentence,
  });
  assertScreen01Result(drafted, `Round ${round} Screen 1 deterministic draft`);
  assert(
    drafted.structuredContent?.state?.confirmed === false,
    `Round ${round} ${mode} Screen 1 deterministic draft was not unconfirmed.`,
  );

  const confirmed = await callTool("confirm_scope_contract", {
    revision: fixture.revision,
    mode,
    sentence: fixture.sentence,
    contractSourceSentence: fixture.contractSourceSentence,
    scope: fixture.scope,
    knownShock: fixture.knownShock,
    resolvedKeys: fixture.resolvedKeys,
    acknowledgedDifferences: [],
    scopeDirty: false,
  });
  assertScreen01Result(
    confirmed,
    `Round ${round} deterministic Scope Contract confirmation`,
  );
  const context = confirmed.structuredContent.studyContext;
  assert(
    context?.schemaVersion === "1.0" &&
      context?.appVersion === expectedVersion &&
      context?.sourceScreen === "screen-01" &&
      context?.startingPoint === mode &&
      context?.studySentence === fixture.sentence &&
      context?.contractSourceSentence === fixture.sentence &&
      context?.knownShock === fixture.knownShock &&
      sameCanonicalJsonValue(context?.scopeContract, fixture.scope) &&
      sameJson(context?.resolvedKeys, mode === "audit" ? decisionKeys : scopeKeys) &&
      sameJson(context?.unresolvedDecisions, []) &&
      context?.scopeDirty === false &&
      context?.confirmed === true &&
      context?.readyForLaterScreens === true &&
      context?.revision === fixture.revision,
    `Round ${round} ${mode} deterministic confirmation did not return the exact immutable handoff.`,
  );
  return {
    context,
    hostEvidence: {
      prepared: false,
      receipt: "not-applicable",
      applied: "fixed-draft",
      replay: "not-applicable",
      stale: "not-applicable",
      outOfPacket: "not-applicable",
      userConfirmation: "fixed-validation",
    },
  };
}

async function confirmedScreen01Context(mode, round, hostReasoning) {
  return SIX_SCREEN_REPLACEMENT_BUILD || hostReasoning.mode === "full"
    ? confirmedDeterministicScreen01Context(mode, round)
    : confirmedSignedScreen01Context(mode, round);
}

function privateSnapshot(result) {
  const snapshot = result?._meta?.[workflowMetaKey];
  assert(isRecord(snapshot), "Canonical Screen 2 result omitted its private workflow snapshot.");
  return snapshot;
}

function assertWorkflowBoundary(
  result,
  mode,
  expectedOutcome,
  expectedKind = expectedOutcome === "created" ? "open" : "mutation",
) {
  assertToolSuccess(result, `Canonical ${mode} ${expectedOutcome}`);
  const sealedSnapshot = result?.structuredContent?.sealedSnapshot;
  const summary = isRecord(result?.structuredContent)
    ? Object.fromEntries(
        Object.entries(result.structuredContent).filter(
          ([key]) => key !== "sealedSnapshot",
        ),
      )
    : null;
  const snapshot = privateSnapshot(result);
  const correlation = result?._meta?.[workflowCorrelationMetaKey];
  if (expectedKind === "open") {
    requireHostReasoningMetadata(result?._meta?.[hostReasoningMetaKey]);
  }
  const expectedMetaKeys = expectedKind === "open"
    ? [
        hostReasoningMetaKey,
        screen03HostNativeDefaultMetaKey,
        workflowMetaKey,
        workflowCorrelationMetaKey,
      ]
    : [workflowMetaKey, workflowCorrelationMetaKey];
  const safeBoundaryProjection = JSON.stringify({
    schemaVersion: summary?.schemaVersion ?? null,
    screen: summary?.screen ?? null,
    outcome: summary?.outcome ?? null,
    mode: summary?.mode ?? null,
    summaryAssessmentAvailable: summary?.assessmentAvailable ?? null,
    snapshotAssessmentAvailable: snapshot.assessmentAvailable ?? null,
    correlationKind: correlation?.kind ?? null,
  });
  assert(
    hasExactKeys(summary, summaryKeys) &&
      Buffer.byteLength(JSON.stringify(summary)) < 2_000,
    `Canonical ${mode} ${expectedOutcome} did not return the compact public summary: ${safeBoundaryProjection}.`,
  );
  assert(
    hasExactKeys(snapshot, snapshotKeys) &&
      hasExactKeys(result._meta, expectedMetaKeys) &&
      (expectedKind !== "open" ||
        result._meta[screen03HostNativeDefaultMetaKey] === false) &&
      hasExactKeys(correlation, [
        "schemaVersion",
        "operationId",
        "kind",
        "runId",
        "mode",
        "revision",
        "stateFingerprint",
      ]) &&
      correlation.schemaVersion === "screen-02-workflow-correlation-v1" &&
      correlation.kind === expectedKind &&
      sealedSnapshot?.kind === expectedKind &&
      sealedSnapshot?.operationId === correlation.operationId &&
      correlation.runId === snapshot.runId &&
      correlation.mode === snapshot.mode &&
      correlation.revision === snapshot.revision &&
      correlation.stateFingerprint === snapshot.stateFingerprint,
    `Canonical ${mode} ${expectedOutcome} did not isolate complete state in private metadata.`,
  );
  const decryptedSnapshot = decryptSealedWorkflowSnapshot(sealedSnapshot);
  assert(
    serializeDeterministicJson(decryptedSnapshot) ===
      serializeDeterministicJson(snapshot),
    `Canonical ${mode} ${expectedOutcome} sealed a different workflow snapshot.`,
  );
  assert(
    summary.schemaVersion === "screen-02-workflow-summary-v1" &&
    summary.screen === "screen-02" &&
      summary.outcome === expectedOutcome &&
      summary.mode === mode &&
      summary.assessmentAvailable === snapshot.assessmentAvailable,
    `Canonical ${mode} ${expectedOutcome} returned an inconsistent public status summary: ${safeBoundaryProjection}.`,
  );
  assert(
    !containsKey(
      summary,
      new Set(["runId", "revision", "stateFingerprint"]),
    ),
    `Canonical ${mode} ${expectedOutcome} exposed private workflow coordinates.`,
  );
  assert(
    snapshot.schemaVersion === "screen-02-workflow-client-v1" &&
      snapshot.mode === mode &&
      /^s2r_[A-Za-z0-9_-]{43}$/.test(snapshot.runId) &&
      /^s2a_[A-Za-z0-9_-]{43}$/.test(snapshot.accessToken) &&
      /^fnv1a64:[0-9a-f]{16}$/.test(snapshot.stateFingerprint) &&
      Number.isSafeInteger(snapshot.revision) &&
      snapshot.revision >= 0 &&
      isRecord(snapshot.stateEnvelope) &&
      typeof snapshot.assessmentAvailable === "boolean" &&
      (snapshot.assessmentBatch === null || isRecord(snapshot.assessmentBatch)) &&
      (snapshot.handoff === null || isRecord(snapshot.handoff)),
    `Canonical ${mode} ${expectedOutcome} returned an invalid private snapshot shape.`,
  );
  const publicValue = {
    content: result.content,
    structuredContent: result.structuredContent,
  };
  const responseKey = workflowResponseKeys.get(correlation.operationId);
  assert(
    !containsKey(publicValue, new Set(["accessToken", "stateEnvelope", "assessmentBatch"])) &&
      !JSON.stringify(publicValue).includes(snapshot.accessToken) &&
      !JSON.stringify(publicValue).includes(responseKey?.responseKey ?? "__missing__"),
    `Canonical ${mode} ${expectedOutcome} crossed the public/private state boundary.`,
  );
  assert(
    summary.assessmentAvailable === false &&
      snapshot.assessmentAvailable === false &&
      snapshot.assessmentBatch === null &&
      summary.preparedRequestCount === 0 &&
      summary.deliveredRequestCount === 0,
    `Canonical ${mode} ${expectedOutcome} reopened a retired Screen 2 host-assessment boundary.`,
  );
  const canonicalState = readCanonicalWorkflowState(snapshot, mode);
  const manifests = mode === "find"
    ? canonicalState.candidateSets.map((set) => set.manifest)
    : canonicalState.matchSets.map((set) => set.manifest);
  const bridgeIssues = manifests.flatMap((manifest, index) =>
    screen02ContextBridgeMismatches(
      manifest,
      `Canonical ${mode} search manifest ${index}`,
    )
  );
  assert(
    bridgeIssues.length === 0,
    `Canonical ${mode} returned invalid contextual-to-official bridge evidence: ${bridgeIssues.join(" ")}`,
  );
  return { summary, snapshot };
}

function mutationInput(snapshot, operationId, action, payload = {}) {
  return {
    schemaVersion: workflowMutationSchemaVersion,
    operationId,
    ...responseKeyFields(operationId),
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    expectedRevision: snapshot.revision,
    expectedStateFingerprint: snapshot.stateFingerprint,
    action,
    payload,
  };
}

function screen03ParentInput(snapshot, operationId) {
  assert(
    isRecord(snapshot?.handoff) &&
      isRecord(snapshot.handoff.integrity) &&
      typeof snapshot.handoff.producerAppVersion === "string" &&
      typeof snapshot.handoff.integrity.handoffFingerprint === "string",
    "Screen 3 requires a canonical Screen 2 continuation handoff.",
  );
  return {
    operationId,
    ...responseKeyFields(operationId),
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    expectedRevision: snapshot.revision,
    expectedStateFingerprint: snapshot.stateFingerprint,
    expectedHandoffProducerAppVersion:
      snapshot.handoff.producerAppVersion,
    expectedHandoffFingerprint:
      snapshot.handoff.integrity.handoffFingerprint,
  };
}

function screen03OpenInput(snapshot, operationId, refresh = false) {
  return {
    schemaVersion: screen03OpenSchemaVersion,
    ...screen03ParentInput(snapshot, operationId),
    ...(refresh ? { refresh: true } : {}),
  };
}

function screen03MutationInput(snapshot, state, operationId, action) {
  return {
    schemaVersion: screen03MutationSchemaVersion,
    ...screen03ParentInput(snapshot, operationId),
    expectedScreen03Revision: state.revision,
    // The Durable Object CAS coordinate fingerprints the complete canonical
    // state. The nested integrity field intentionally omits its own wrapper.
    expectedScreen03StateFingerprint: fingerprintScreen03VerifierState(state),
    action,
  };
}

function expectedScreen03InitialOrientationProvenance(parentSnapshot) {
  const qualification =
    parentSnapshot.handoff?.event?.preliminaryQualification;
  return qualification?.eligible === true &&
    qualification.substantiveOverview?.passed === true
    ? "screen-02-qualified-preliminary"
    : "screen-02-preliminary";
}

function assertScreen03Boundary(
  result,
  parentSnapshot,
  expectedOutcome,
  expectedKind,
  label,
) {
  assertToolSuccess(result, label);
  const summary = result?.structuredContent;
  const summaryDiagnostic = JSON.stringify({
    keys: isRecord(summary) ? Object.keys(summary).sort() : [],
    schemaVersion: summary?.schemaVersion ?? null,
    screen: summary?.screen ?? null,
    ok: summary?.ok ?? null,
    outcome: summary?.outcome ?? null,
    messageType: typeof summary?.message,
    sealedKind: summary?.sealedState?.kind ?? null,
  });
  assert(
    hasExactKeys(summary, screen03SummaryKeys) &&
      summary.schemaVersion === screen03ResultSchemaVersion &&
      summary.screen === "screen-03" &&
      summary.outcome === expectedOutcome &&
      summary.ok === (expectedOutcome !== "conflict") &&
      typeof summary.message === "string" &&
      summary.message.length > 0 &&
      summary.sealedState?.kind === expectedKind,
    `${label} returned the wrong compact Screen 3 summary: ${summaryDiagnostic}`,
  );
  const state = decryptSealedScreen03State(
    summary.sealedState,
    expectedKind,
  );
  assert(
    state?.schemaVersion === "screen-03-verification-state-v1" &&
      state.releaseLabel === "v0.3.17" &&
      state.runId === parentSnapshot.runId &&
      state.upstream?.runId === parentSnapshot.runId &&
      state.upstream?.handoffFingerprint ===
        parentSnapshot.handoff?.integrity?.handoffFingerprint &&
      Number.isSafeInteger(state.revision) &&
      state.revision >= 0 &&
      ["loading", "reviewing", "locked"].includes(state.status) &&
      Array.isArray(state.evidence) &&
      isRecord(state.proposals) &&
      isRecord(state.researchCoverage) &&
      isRecord(state.orientation) &&
      state.orientation.schemaVersion === "screen-03-orientation-state-v1" &&
      [
        "screen-02-preliminary",
        "screen-02-qualified-preliminary",
        "screen-03-reviewed",
      ].includes(state.orientation.provenance) &&
      isRecord(state.orientation.initial) &&
      isRecord(state.orientation.current) &&
      state.orientation.current.schemaVersion === "screen-02-shock-glance-v1" &&
      state.orientation.current.runId === parentSnapshot.runId &&
      state.orientation.current.eventFingerprint ===
        state.upstream.eventFingerprint &&
      state.briefing === undefined &&
      state.outcomeValuesInspected === false &&
      state.researchCoverage.outcomeValuesInspected === false &&
      /^fnv1a64:[0-9a-f]{16}$/.test(
        state.integrity?.stateFingerprint ?? "",
      ),
    `${label} decrypted an invalid canonical Screen 3 state.`,
  );
  const publicValue = {
    content: result.content,
    structuredContent: summary,
  };
  const responseKey = workflowResponseKeys.get(
    summary.sealedState.operationId,
  );
  assert(
    !containsKey(
      publicValue,
      new Set([
        "accessToken",
        "responseKey",
        "state",
        "evidence",
        "proposals",
        "researchCoverage",
        "interpretation",
        "orientation",
      ]),
    ) &&
      !JSON.stringify(publicValue).includes(parentSnapshot.accessToken) &&
      !JSON.stringify(publicValue).includes(
        responseKey?.responseKey ?? "__missing__",
      ) &&
      !JSON.stringify(publicValue).includes(
        state.eventIdentity?.canonicalTitle ?? "__missing-title__",
      ),
    `${label} crossed the public/private Screen 3 state boundary.`,
  );
  return { summary, state };
}

function firstActiveFindCandidateSnapshotId(snapshot) {
  const state = readCanonicalWorkflowState(snapshot, "find");
  const activeSet = state.candidateSets?.find(
    (candidateSet) =>
      candidateSet.candidateSetSnapshotId ===
      state.activeCandidateSetSnapshotId,
  );
  const ordered = [...(activeSet?.ordering ?? [])].sort(
    (left, right) => left.rank - right.rank,
  );
  const activeCandidateIds = new Set(activeSet?.candidateSnapshotIds ?? []);
  const candidateById = new Map(
    (state.candidates ?? []).map((candidate) => [
      candidate.candidateSnapshotId,
      candidate,
    ]),
  );
  const candidateSnapshotId = ordered
    .map((item) => item.candidateSnapshotId)
    .find((candidateId) =>
      activeCandidateIds.has(candidateId) &&
      candidateById.get(candidateId)?.qualification?.eligible === true
    ) ?? (activeSet?.candidateSnapshotIds ?? []).find(
      (candidateId) => candidateById.get(candidateId)?.qualification?.eligible === true,
    );
  const candidate = candidateSnapshotId
    ? candidateById.get(candidateSnapshotId)
    : null;
  assert(
    typeof candidateSnapshotId === "string" &&
      candidate?.qualification?.eligible === true &&
      candidate.qualification.classification !== "mismatch" &&
      candidate.qualification.evidenceSourceIds.length > 0,
    "Canonical Find state has no fixed-qualified active candidate for Screen 3.",
  );
  return candidateSnapshotId;
}

function assertDeterministicFindDiscovery(snapshot, summary, round) {
  const state = readCanonicalWorkflowState(snapshot, "find");
  const activeSet = state.candidateSets?.find(
    (candidateSet) =>
      candidateSet.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
  );
  const funnel = activeSet?.manifest?.funnel;
  const candidateSnapshotId = firstActiveFindCandidateSnapshotId(snapshot);
  assert(
    activeSet?.status === "active" &&
      activeSet.candidateSnapshotIds.length > 0 &&
      state.assessmentRequests?.length === 0 &&
      state.assessments?.length === 0 &&
      summary.assessmentAvailable === false &&
      summary.preparedRequestCount === 0 &&
      summary.deliveredRequestCount === 0 &&
      summary.completedRequestCount === 0 &&
      funnel?.schemaVersion === "screen-02-search-funnel-v2" &&
      funnel.displayedCandidates === activeSet.candidateSnapshotIds.length &&
      funnel.qualifiedCandidates >= funnel.displayedCandidates &&
      funnel.evaluatedUniqueLeads >= funnel.qualifiedCandidates &&
      funnel.hardScopePassed + funnel.hardScopeDemonstratedMismatch +
          funnel.hardScopeInsufficientEvidence + funnel.hardScopeMixed ===
        funnel.evaluatedUniqueLeads &&
      Number.isSafeInteger(funnel.retrievalFailures) &&
      funnel.retrievalFailures >= 0 &&
      activeSet.manifest.outcomeValuesInspected === false,
    `Round ${round} Find did not complete the fixed qualification funnel without retired host assessment work.`,
  );
  return {
    state,
    candidateSnapshotId,
    evidence: {
      path: "fixed-deterministic-discovery",
      legacyAssessmentRequests: 0,
      eligibleCandidateCount: state.candidates.filter(
        (candidate) => candidate.qualification?.eligible === true,
      ).length,
      displayedCandidateCount: activeSet.candidateSnapshotIds.length,
      sourceRecordsRetrieved: funnel.sourceRecordsRetrieved,
      evaluatedUniqueLeads: funnel.evaluatedUniqueLeads,
      qualificationCounts: {
        direct: funnel.directCandidates,
        adjacent: funnel.adjacentCandidates,
        broad: funnel.broadCandidates,
        mismatch: funnel.mismatchCandidates,
      },
    },
  };
}

function screen03Proposals(state) {
  return [
    ...(state.proposals.identity ?? []),
    ...(state.proposals.overview ?? []),
    ...(state.proposals.timeline ?? []),
    ...(state.proposals.component ?? []),
    ...(state.proposals.eligibility ?? []),
    ...(state.proposals.amendment ?? []),
  ];
}

function screen03FactualProposals(state) {
  return [
    ...(state.proposals.identity ?? []),
    ...(state.proposals.overview ?? []),
    ...(state.proposals.timeline ?? []),
    ...(state.proposals.component ?? []),
    ...(state.proposals.eligibility ?? []),
    ...(state.proposals.amendment ?? []),
  ];
}

function screen03InterpretationOrigin(state, mode, round) {
  const interpretation = state.interpretation;
  assert(
    isRecord(interpretation) &&
      interpretation.protocolVersion === "screen-03-interpretation-v1" &&
      ["chatgpt-host", "screen02-reuse", "unavailable"].includes(
        interpretation.origin,
      ) &&
      interpretation.nonCanonical === true &&
      interpretation.outcomeValuesInspected === false,
    `Round ${round} ${mode} Screen 3 omitted its bounded noncanonical interpretation status.`,
  );
  if (interpretation.origin === "chatgpt-host") {
    assert(
      isRecord(interpretation.snapshot) &&
        isRecord(interpretation.snapshot.intro) &&
        typeof interpretation.snapshot.intro.text === "string" &&
        interpretation.snapshot.intro.text.length > 0 &&
        Array.isArray(interpretation.snapshot.intro.proposalIds) &&
        interpretation.snapshot.intro.proposalIds.length > 0 &&
        Array.isArray(interpretation.snapshot.intro.passageIds) &&
        interpretation.snapshot.intro.passageIds.length > 0 &&
        Array.isArray(interpretation.snapshot.keyPoints) &&
        interpretation.snapshot.keyPoints.length > 0 &&
        isRecord(interpretation.studyRelevance) &&
        isRecord(interpretation.studyRelevance.sampleConnection) &&
        isRecord(interpretation.studyRelevance.outcomeConnection) &&
        Array.isArray(interpretation.claimExplanations) &&
        interpretation.claimExplanations.length > 0,
      `Round ${round} ${mode} Screen 3 claimed ChatGPT-host interpretation without a source-bound lead, bounded snapshot, study-relevance result, and per-claim explanation.`,
    );
  }
  return interpretation.origin;
}

function safeDiagnosticHost(locator) {
  try {
    return typeof locator === "string" ? new URL(locator).hostname : null;
  } catch {
    return "invalid-locator";
  }
}

function screen03GapCategory(gap) {
  const text = typeof gap === "string" ? gap.toLowerCase() : "";
  if (text.includes("timed out") || text.includes("deadline")) return "timeout";
  if (text.includes("size") || text.includes("page-count")) return "bounded-size";
  if (text.includes("pdf")) return "pdf";
  if (text.includes("no active direct passage")) return "missing-direct-stage";
  if (text.includes("connector") || text.includes("route")) return "route";
  if (text.includes("synthesis")) return "synthesis";
  return "other";
}

function screen03SupportDiagnostic(state) {
  const proposals = screen03Proposals(state);
  const gaps = state.researchCoverage?.gaps ?? [];
  const supportStatuses = [
    "direct",
    "conflicting",
    "indirect",
    "unsupported",
  ];
  const proposalGroups = [
    "identity",
    "overview",
    "timeline",
    "component",
    "eligibility",
    "amendment",
  ];
  return JSON.stringify({
    evidence: (state.evidence ?? []).map((item) => ({
      host: safeDiagnosticHost(item.locator),
      status: item.status,
      authorityTier: item.authorityTier,
      passageBases: (item.passages ?? []).map((passage) => passage.basis),
    })),
    proposalSupport: Object.fromEntries(
      supportStatuses.map((support) => [
        support,
        proposals.filter((proposal) => proposal.support === support).length,
      ]),
    ),
    proposalSupportByGroup: Object.fromEntries(
      proposalGroups.map((group) => [
        group,
        Object.fromEntries(
          supportStatuses.map((support) => [
            support,
            (state.proposals?.[group] ?? []).filter(
              (proposal) => proposal.support === support,
            ).length,
          ]),
        ),
      ]),
    ),
    coverage: {
      status: state.researchCoverage?.status ?? null,
      stoppingRule: state.researchCoverage?.stoppingRule?.status ?? null,
      activeEvidenceCount:
        state.researchCoverage?.activeEvidenceCount ?? null,
      recordsReviewed: state.researchCoverage?.recordsReviewed ?? null,
      gapCount: gaps.length,
      gapCategories: [...new Set(gaps.map(screen03GapCategory))].sort(),
    },
  });
}

async function applyScreen03LiveMutation(
  parentSnapshot,
  state,
  mode,
  round,
  operationSuffix,
  action,
) {
  const operationId =
    `stage6-screen03-${mode}-${operationSuffix}-${round}-${liveVerifierRunId}`;
  const result = await callTool(
    screen03MutationTool,
    screen03MutationInput(
      parentSnapshot,
      state,
      operationId,
      action,
    ),
  );
  const applied = assertScreen03Boundary(
    result,
    parentSnapshot,
    "applied",
    "mutation",
    `Round ${round} ${mode} Screen 3 ${operationSuffix}`,
  );
  assert(
    applied.state.revision > state.revision,
    `Round ${round} ${mode} Screen 3 ${operationSuffix} did not advance the canonical revision.`,
  );
  return applied.state;
}

async function completeAndLockScreen03(
  parentSnapshot,
  initialState,
  mode,
  round,
) {
  let state = initialState;
  const findProposal = (proposalId) =>
    screen03FactualProposals(state).find(
      (proposal) => proposal.id === proposalId,
    );
  const accepted = (proposal) =>
    proposal?.reviewStatus === "accepted" ||
    proposal?.reviewStatus === "edited";
  if (
    screen03FactualProposals(state).some(
      (proposal) => proposal.reviewStatus !== "proposed",
    )
  ) {
    state = await applyScreen03LiveMutation(
      parentSnapshot,
      state,
      mode,
      round,
      "reset-reviewed-claims",
      {
        type: "review-all-fields",
        mode: "unconfirm",
        reason:
          "Reset the gate's earlier probe decisions before reviewing the current post-refresh evidence packet.",
      },
    );
  }
  const directIdentity = state.proposals.identity.find(
    (proposal) => proposal.support === "direct",
  );
  assert(
    directIdentity,
    `Round ${round} ${mode} Screen 3 cannot complete its Event Card without a directly supported identity field: ${screen03SupportDiagnostic(state)}`,
  );
  state = await applyScreen03LiveMutation(
    parentSnapshot,
    state,
    mode,
    round,
    "confirm-all-claims",
    {
      type: "review-all-fields",
      mode: "confirm",
      reason:
        "Confirm every directly supported Screen 3 claim and preserve unsupported items as explicit evidence gaps.",
    },
  );
  const unsupportedClaims = screen03FactualProposals(state).filter(
    (proposal) => proposal.reviewStatus === "proposed",
  );
  for (const [index, proposal] of unsupportedClaims.entries()) {
    state = await applyScreen03LiveMutation(
      parentSnapshot,
      state,
      mode,
      round,
      `record-evidence-gap-${index + 1}`,
      {
        type: "review-field",
        proposalId: proposal.id,
        decision: "unresolved",
        reason:
          "Retain this unsupported or indirect claim as an explicit evidence gap before locking the bounded verification record.",
      },
    );
  }
  assert(
    accepted(findProposal(directIdentity.id)) &&
      screen03FactualProposals(state).every(
        (proposal) => proposal.reviewStatus !== "proposed",
      ) &&
      state.focalClock.selectedProposalId === null,
    `Round ${round} ${mode} Screen 3 did not persist the atomic all-claims review without a required study date.`,
  );
  state = await applyScreen03LiveMutation(
    parentSnapshot,
    state,
    mode,
    round,
    "lock-event-card",
    {
      type: "lock-event-card",
      reason:
        "All bounded evidence decisions and limitations were reviewed by the live gate; no researcher-selected main study date is required.",
    },
  );
  assert(
    state.status === "locked" &&
      state.lockedEventCard?.eventCardFingerprint &&
      state.history?.at(-1)?.action === "lock-event-card" &&
      screen03FactualProposals(state).every(
        (proposal) => proposal.reviewStatus !== "proposed",
      ) &&
      state.lockedEventCard.focalClock?.selected === null,
    `Round ${round} ${mode} Screen 3 did not return a locked Event Card.`,
  );
  return state;
}

async function verifyScreen03Workflow(parentSnapshot, mode, round) {
  const openOperationId =
    `stage6-screen03-${mode}-open-${round}-${liveVerifierRunId}`;
  const openedResult = await callTool(
    screen03OpenTool,
    screen03OpenInput(parentSnapshot, openOperationId),
  );
  const opened = assertScreen03Boundary(
    openedResult,
    parentSnapshot,
    "opened",
    "open",
    `Round ${round} ${mode} Screen 3 open`,
  );
  assert(
    opened.state.status === "reviewing" &&
      opened.state.researchCoverage.status !== "pending" &&
      screen03Proposals(opened.state).length > 0 &&
      opened.state.orientation.provenance ===
        expectedScreen03InitialOrientationProvenance(parentSnapshot) &&
      ["chatgpt-host", "fixed-source-derived"].includes(
        opened.state.orientation.current.origin,
      ) &&
      opened.state.orientation.current.keyPoints.length >= 3 &&
      opened.state.orientation.current.keyPoints.length <= 5 &&
      opened.state.orientation.current.sourceIds.length >= 1 &&
      opened.state.orientation.current.sourceIds.length <= 4 &&
      opened.state.orientation.initial.eventFingerprint ===
        opened.state.orientation.current.eventFingerprint &&
      Array.isArray(opened.state.orientation.refinements) &&
      opened.state.orientation.refinements.length === 0,
    `Round ${round} ${mode} Screen 3 did not complete a reviewable research packet.`,
  );
  const initialOrientation = serializeDeterministicJson(
    opened.state.orientation.initial,
  );
  const directProposal = screen03FactualProposals(opened.state).find(
    (proposal) =>
      proposal.reviewStatus === "proposed" &&
      proposal.support === "direct" &&
      Array.isArray(proposal.passageIds) &&
      proposal.passageIds.length > 0,
  );
  assert(
    directProposal,
    `Round ${round} ${mode} Screen 3 returned no directly supported proposal to review: ${screen03SupportDiagnostic(opened.state)}`,
  );
  const mutationOperationId =
    `stage6-screen03-${mode}-review-${round}-${liveVerifierRunId}`;
  const reviewedResult = await callTool(
    screen03MutationTool,
    screen03MutationInput(
      parentSnapshot,
      opened.state,
      mutationOperationId,
      {
        type: "review-field",
        proposalId: directProposal.id,
        decision: "accept",
        reason:
          "The exact active passage supports this bounded live-gate fact.",
      },
    ),
  );
  const reviewed = assertScreen03Boundary(
    reviewedResult,
    parentSnapshot,
    "applied",
    "mutation",
    `Round ${round} ${mode} Screen 3 supported review`,
  );
  const reviewedProposal = screen03Proposals(reviewed.state).find(
    (proposal) => proposal.id === directProposal.id,
  );
  assert(
    reviewed.state.revision > opened.state.revision &&
      reviewedProposal?.reviewStatus === "accepted" &&
      reviewed.state.history?.at(-1)?.action === "review-field" &&
      reviewed.state.orientation.provenance === "screen-03-reviewed" &&
      serializeDeterministicJson(reviewed.state.orientation.initial) ===
        initialOrientation &&
      reviewed.state.orientation.refinements.some(
        (refinement) =>
          refinement.proposalId === directProposal.id &&
          refinement.decision === "accept" &&
          Array.isArray(refinement.fieldsUsed),
      ),
    `Round ${round} ${mode} Screen 3 did not persist the supported review decision.`,
  );

  const unsupportedProposal = screen03FactualProposals(reviewed.state).find(
    (proposal) =>
      proposal.reviewStatus === "proposed" &&
      proposal.support !== "direct",
  );
  assert(
    unsupportedProposal,
    `Round ${round} ${mode} Screen 3 returned no unsupported proposal for its fail-closed acceptance probe.`,
  );
  const unsupportedOperationId =
    `stage6-screen03-${mode}-unsupported-${round}-${liveVerifierRunId}`;
  const unsupportedResult = await callTool(
    screen03MutationTool,
    screen03MutationInput(
      parentSnapshot,
      reviewed.state,
      unsupportedOperationId,
      {
        type: "review-field",
        proposalId: unsupportedProposal.id,
        decision: "accept",
        reason:
          "This probe must fail because the proposal has no active direct passage.",
      },
    ),
  );
  assertToolError(
    unsupportedResult,
    /direct|passage|support/i,
    `Round ${round} ${mode} Screen 3 unsupported acceptance`,
  );

  const staleOperationId =
    `stage6-screen03-${mode}-stale-${round}-${liveVerifierRunId}`;
  const staleResult = await callTool(
    screen03MutationTool,
    screen03MutationInput(
      parentSnapshot,
      opened.state,
      staleOperationId,
      {
        type: "review-field",
        proposalId: directProposal.id,
        decision: "unresolved",
        reason: "This stale fork must lose to the accepted canonical review.",
      },
    ),
  );
  const stale = assertScreen03Boundary(
    staleResult,
    parentSnapshot,
    "conflict",
    "mutation",
    `Round ${round} ${mode} Screen 3 stale review`,
  );
  assert(
    stale.state.revision === reviewed.state.revision &&
      stale.state.integrity.stateFingerprint ===
        reviewed.state.integrity.stateFingerprint,
    `Round ${round} ${mode} Screen 3 stale mutation did not restore the canonical winner.`,
  );

  const refreshOperationId =
    `stage6-screen03-${mode}-refresh-${round}-${liveVerifierRunId}`;
  const refreshedResult = await callTool(
    screen03OpenTool,
    screen03OpenInput(parentSnapshot, refreshOperationId, true),
  );
  const refreshOutcome = refreshedResult?.structuredContent?.outcome;
  assert(
    refreshOutcome === "restored" || refreshOutcome === "replaced",
    `Round ${round} ${mode} Screen 3 refresh returned an unexpected outcome.`,
  );
  const refreshed = assertScreen03Boundary(
    refreshedResult,
    parentSnapshot,
    refreshOutcome,
    "open",
    `Round ${round} ${mode} Screen 3 refresh`,
  );
  const refreshedReviewedProposal = screen03Proposals(refreshed.state).find(
    (proposal) => proposal.id === directProposal.id,
  );
  if (refreshOutcome === "restored") {
    assert(
      refreshed.state.revision === reviewed.state.revision &&
        refreshed.state.integrity.stateFingerprint ===
          reviewed.state.integrity.stateFingerprint &&
        refreshedReviewedProposal?.reviewStatus === "accepted",
      `Round ${round} ${mode} Screen 3 changed an unchanged refresh or lost its review decision.`,
    );
  } else {
    const refreshAction = refreshed.state.history?.at(-1)?.action;
    if (refreshAction === "context-refreshed") {
      assert(
        refreshed.state.revision > reviewed.state.revision &&
          refreshedReviewedProposal?.reviewStatus === "accepted" &&
          refreshed.state.lockedEventCard === reviewed.state.lockedEventCard,
        `Round ${round} ${mode} Screen 3 did not preserve decisions across context-only refresh churn.`,
      );
    } else {
      assert(
        refreshed.state.revision > reviewed.state.revision &&
          refreshAction === "research-refreshed" &&
          screen03RefreshDecisionIsCurrent(
            refreshed.state,
            directProposal.id,
          ),
        `Round ${round} ${mode} Screen 3 did not visibly reopen a substantively changed refresh.`,
      );
    }
  }

  const lockRequired = round <= 2;
  const finalState = lockRequired
    ? await completeAndLockScreen03(
        parentSnapshot,
        refreshed.state,
        mode,
        round,
      )
    : refreshed.state;
  const interpretationOrigin = screen03InterpretationOrigin(
    finalState,
    mode,
    round,
  );
  assert(
    interpretationOrigin !== "chatgpt-host" &&
      serializeDeterministicJson(finalState.orientation.initial) ===
        initialOrientation &&
      finalState.briefing === undefined,
    `Round ${round} ${mode} Screen 3 entered the retired current host-briefing path or lost its original glance.`,
  );

  return {
    state: finalState,
    evidence: {
      open: "opened",
      supportedReview: "accepted",
      unsupportedAcceptance: "rejected",
      staleReview: "conflict-restored",
      refresh: refreshOutcome,
      currentHostPath: "not-invoked",
      currentModelRequest: "none",
      originalGlance: "preserved",
      refinement: reviewed.state.orientation.provenance,
      eventCard: lockRequired ? "locked" : "reviewed",
      evidenceCount: finalState.evidence.length,
      proposalCount: screen03Proposals(finalState).length,
      interpretationOrigin,
      outcomeBlind: true,
      sealedState: "decrypted-in-memory-only",
    },
  };
}

function fixedCoreRequestCompleted(request) {
  return isRecord(request) &&
    request.status === "completed" &&
    Array.isArray(request.lifecycle) &&
    request.lifecycle.some(
      (event) => isRecord(event) &&
        event.status === "service-unavailable" &&
        event.actor === "fixed-core",
    ) &&
    request.lifecycle.some(
      (event) => isRecord(event) &&
        event.status === "completed" &&
        event.actor === "fixed-core",
    ) &&
    !JSON.stringify(request).includes("chatgpt-host");
}

function assertDeterministicAuditDossier(
  snapshot,
  summary,
  matchSnapshotId,
  round,
) {
  const state = readCanonicalWorkflowState(snapshot, "audit");
  const requests = state.assessmentRequests.filter(
    (request) =>
      isRecord(request) &&
      isRecord(request.target) &&
      request.target.mode === "audit-dossier" &&
      request.target.matchSnapshotId === matchSnapshotId,
  );
  const request = requests[0];
  const dossier = state.dossiers.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.requestId === request?.requestId &&
      candidate.identitySnapshotId === request?.target?.identitySnapshotId,
  );
  assert(
    requests.length === 1 &&
      fixedCoreRequestCompleted(request) &&
      dossier?.status === "completed" &&
      snapshot.assessmentAvailable === false &&
      snapshot.assessmentBatch === null &&
      summary.preparedRequestCount === 0 &&
      summary.deliveredRequestCount === 0 &&
      summary.completedRequestCount === 1,
    `Round ${round} Audit did not complete its source-derived fixed dossier without a retired host turn.`,
  );
  return {
    state,
    completedDossierCount: 1,
    completedRequestCount: summary.completedRequestCount,
    evidence: {
      path: "source-derived-fixed-fallback",
      requestOrigin: "fixed-core",
      hostSubmission: "not-invoked",
    },
  };
}

function assertDeterministicAuditAssessment(snapshot, summary, round) {
  const state = readCanonicalWorkflowState(snapshot, "audit");
  const confirmedIdentity = state.confirmedIdentity;
  assert(
    isRecord(confirmedIdentity) &&
      typeof confirmedIdentity.confirmationSnapshotId === "string" &&
      typeof confirmedIdentity.identitySnapshotId === "string" &&
      typeof confirmedIdentity.matchSnapshotId === "string",
    `Round ${round} Audit did not preserve the researcher-confirmed identity.`,
  );
  const requests = state.assessmentRequests.filter(
    (request) =>
      isRecord(request) &&
      isRecord(request.target) &&
      request.target.mode === "audit-confirmed-event",
  );
  const request = requests[0];
  const assessments = state.assessments.filter(
    (candidate) =>
      isRecord(candidate) &&
      candidate.requestId === request?.requestId &&
      candidate.identitySnapshotId === confirmedIdentity.identitySnapshotId,
  );
  assert(
    requests.length === 1 &&
      fixedCoreRequestCompleted(request) &&
      request.target.matchSnapshotId === confirmedIdentity.matchSnapshotId &&
      request.target.identitySnapshotId === confirmedIdentity.identitySnapshotId &&
      request.target.confirmationSnapshotId ===
        confirmedIdentity.confirmationSnapshotId &&
      assessments.length === 1 &&
      assessments[0]?.status === "completed" &&
      snapshot.assessmentAvailable === false &&
      snapshot.assessmentBatch === null &&
      summary.preparedRequestCount === 0 &&
      summary.deliveredRequestCount === 0 &&
      summary.completedRequestCount === state.assessmentRequests.length &&
      summary.completedRequestCount === 2,
    `Round ${round} Audit did not complete its conservative fixed review without a retired host turn.`,
  );
  return {
    state,
    completedAssessmentCount: 1,
    completedRequestCount: summary.completedRequestCount,
    evidence: {
      path: "conservative-fixed-fallback",
      requestOrigin: "fixed-core",
      hostSubmission: "not-invoked",
    },
  };
}

async function verifyOptionalGenericHostLifecycle(
  snapshot,
  round,
  hostReasoning,
) {
  if (!["screen02-only", "full"].includes(hostReasoning.mode)) {
    return { path: "not-invoked", reason: hostReasoning.mode };
  }
  const state = readCanonicalWorkflowState(snapshot, "find");
  const activeSet = state.candidateSets.find(
    (candidateSet) =>
      candidateSet.candidateSetSnapshotId === state.activeCandidateSetSnapshotId,
  );
  assert(activeSet, `Round ${round} full-mode host task has no candidate pool.`);
  const prepared = await callTool(hostTaskPrepareTool, {
    schemaVersion: "shockaudit-host-task-prepare-input-v1",
    operationId: `live-generic-host-prepare-${round}-${liveVerifierRunId}`,
    taskType: "screen02-search-review",
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    candidatePoolId: activeSet.candidateSetSnapshotId,
    selectedEventId: null,
    claimGroupId: null,
    expectedScopeFingerprint: state.screen01Fingerprint,
    expectedCandidatePoolFingerprint: activeSet.candidateSetFingerprint,
    expectedEventFingerprint: null,
    retryOfTaskId: null,
  });
  assertToolSuccess(prepared, `Round ${round} generic host task preparation`);
  const task = prepared.structuredContent;
  const privateModelContext = readPreparedHostPrivateModelContext(prepared);
  const capability = privateModelContext?.submission?.capability;
  assert(
    task?.schemaVersion === "shockaudit-host-task-prepared-result-v1" &&
      task?.phase === "prepared" &&
      task?.taskType === "screen02-search-review" &&
      task?.runId === snapshot.runId &&
      task?.status === "prepared" &&
      privateModelContext?.submission?.tool ===
        screen02SearchReviewSubmitTool &&
      typeof capability === "string" &&
      !JSON.stringify(task).includes(capability) &&
      !JSON.stringify(prepared.content ?? null).includes(capability),
    `Round ${round} generic host task did not preserve its private capability boundary.`,
  );
  const requestedAt = new Date().toISOString();
  const delivery = await callTool(hostTaskRecordMessageTool, {
    schemaVersion: "shockaudit-host-task-message-record-v1",
    operationId: `live-generic-host-message-${round}-${liveVerifierRunId}`,
    taskId: task.taskId,
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    channel: "unavailable",
    accepted: false,
    requestedAt,
    resolvedAt: requestedAt,
    failureCode: "live-verifier-no-host-turn",
    failureExplanation:
      "The live verifier has no signed-in ChatGPT message channel and did not request a model submission.",
  });
  assertToolSuccess(delivery, `Round ${round} generic host message disposition`);
  assert(
    delivery.structuredContent?.disposition === "updated" &&
      delivery.structuredContent?.status === "message-rejected" &&
      delivery.structuredContent?.messageDeliveryStatus === "rejected",
    `Round ${round} generic host task did not fail closed without a real host turn.`,
  );
  const status = await callTool(hostTaskStatusTool, {
    schemaVersion: "shockaudit-host-task-status-input-v1",
    operationId: `live-generic-host-status-${round}-${liveVerifierRunId}`,
    taskId: task.taskId,
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    acknowledgeResultId: null,
  });
  assertToolSuccess(status, `Round ${round} generic host task status`);
  assert(
    status.structuredContent?.outcome === "found" &&
      status.structuredContent?.task?.status === "message-rejected" &&
      status.structuredContent?.task?.result === null,
    `Round ${round} generic host task status did not preserve the terminal no-result state.`,
  );
  return {
    path: "generic-lifecycle-no-model",
    prepared: true,
    messageDisposition: "rejected-unavailable",
    status: "message-rejected",
    modelSubmission: "not-invoked",
  };
}

function retirementInput(snapshot) {
  return {
    schemaVersion: "screen-02-workflow-retire-v1",
    runId: snapshot.runId,
    accessToken: snapshot.accessToken,
    expectedRevision: snapshot.revision,
    expectedStateFingerprint: snapshot.stateFingerprint,
  };
}

function assertRetireResult(result, expectedOutcome, expectedRunId) {
  assertToolSuccess(result, `Screen 2 retire ${expectedOutcome}`);
  const output = result.structuredContent;
  assert(
    hasExactKeys(output, retireResultKeys) &&
      output.schemaVersion === "screen-02-workflow-retire-result-v1" &&
      output.screen === "screen-02" &&
      output.outcome === expectedOutcome &&
      output.runId === expectedRunId &&
      output.ok === (expectedOutcome !== "conflict") &&
      (!result._meta || Object.keys(result._meta).length === 0),
    `Screen 2 retire did not return the expected ${expectedOutcome} signal.`,
  );
  return output;
}

function changedToken(token) {
  const replacement = token.endsWith("A") ? "B" : "A";
  return `${token.slice(0, -1)}${replacement}`;
}

async function bestEffortRetire(snapshot) {
  if (!snapshot) return;
  try {
    await callTool("retire_screen02_workflow_v021", retirementInput(snapshot));
  } catch {
    // This is a cleanup attempt only; the original bounded gate error wins.
  }
}

async function verifyRound(round, roundEvidence, hostReasoning) {
  let latestFindSnapshot = null;
  let latestAuditSnapshot = null;
  let findRetired = false;
  let auditRetired = false;
  roundEvidence.lastCompletedStep = "round-started";
  try {
    await initialize("/mcp");
    await initialize("/mcp/");
    roundEvidence.lastCompletedStep = "mcp-initialization";

    const listed = await mcpRead("tools/list");
    roundEvidence.catalogBytes = verifyCatalog(listed?.tools, hostReasoning);
    roundEvidence.hostReasoningMode = hostReasoning.mode;
    roundEvidence.endpoints = ["/mcp", "/mcp/"];
    roundEvidence.lastCompletedStep = "tool-catalog";

    const findScreen01 = await confirmedScreen01Context(
      "find",
      round,
      hostReasoning,
    );
    const findContext = findScreen01.context;
    roundEvidence.lastCompletedStep = "find-screen1-confirmed";
    const findOpenOperationId =
      `screen02-v021-open-live-find-${round}-${liveVerifierRunId}`;
    const findOpenArguments = {
      schemaVersion: workflowCreateSchemaVersion,
      operationId: findOpenOperationId,
      ...responseKeyFields(findOpenOperationId),
      initialState: "standard",
      studyContext: findContext,
    };
    const openedFindResult = await callTool(
      workflowCreateTool,
      findOpenArguments,
    );
    const openedFind = assertWorkflowBoundary(openedFindResult, "find", "created");
    latestFindSnapshot = openedFind.snapshot;
    assert(
      openedFind.summary.ok === true &&
        openedFind.snapshot.revision === 0 &&
        openedFind.snapshot.runId !== findOpenOperationId &&
        openedFindResult._meta[workflowCorrelationMetaKey].operationId ===
          findOpenOperationId &&
        openedFind.summary.preparedRequestCount === 0,
      `Round ${round} did not open a fresh server-owned Find run.`,
    );
    roundEvidence.lastCompletedStep = "find-workflow-created";
    const replayedFindOpenResult = await callTool(
      workflowCreateTool,
      findOpenArguments,
    );
    const replayedFindOpen = assertWorkflowBoundary(
      replayedFindOpenResult,
      "find",
      "replayed",
      "open",
    );
    assert(
      replayedFindOpen.snapshot.runId === openedFind.snapshot.runId &&
        replayedFindOpen.snapshot.accessToken === openedFind.snapshot.accessToken &&
        replayedFindOpen.snapshot.stateFingerprint ===
          openedFind.snapshot.stateFingerprint,
      `Round ${round} idempotent Find open did not replay one durable workflow.`,
    );
    roundEvidence.lastCompletedStep = "find-open-replayed";

    const compatibilityOperationId =
      `screen02-v021-open-live-compat-${round}-${liveVerifierRunId}`;
    const compatibilityResult = await callTool(
      "open_shockaudit_screen_2",
      {
        studyContext: findContext,
        runId: compatibilityOperationId,
      },
    );
    assertToolSuccess(
      compatibilityResult,
      `Round ${round} stable opener compatibility call`,
    );
    const compatibilityOutput = compatibilityResult.structuredContent;
    const compatibilitySnapshot = privateSnapshot(compatibilityResult);
    const compatibilityCorrelation =
      compatibilityResult._meta?.[workflowCorrelationMetaKey];
    assert(
      hasExactKeys(compatibilityOutput, [
        "screen",
        "ok",
        "error",
        "sessionState",
        "sessionSummary",
      ]) &&
        compatibilityOutput.screen === "screen-02" &&
        compatibilityOutput.ok === true &&
        compatibilityOutput.error === "" &&
        compatibilityOutput.sessionSummary?.runId === compatibilityOperationId &&
        compatibilityOutput.sessionSummary?.mode === "find" &&
        compatibilityCorrelation?.operationId === compatibilityOperationId &&
        compatibilityCorrelation?.kind === "open" &&
        compatibilityCorrelation?.runId === compatibilitySnapshot.runId,
      `Round ${round} stable opener did not preserve the frozen v0.2.20 output contract.`,
    );
    const compatibilityRetire = await callTool(
      "retire_screen02_workflow_v021",
      retirementInput(compatibilitySnapshot),
    );
    assertRetireResult(
      compatibilityRetire,
      "retired",
      compatibilitySnapshot.runId,
    );
    roundEvidence.lastCompletedStep = "find-compatibility-contract";

    const wrongTokenInput = mutationInput(
      openedFind.snapshot,
      `stage6-find-auth-${round}`,
      "find-search",
      { criteria: [] },
    );
    wrongTokenInput.accessToken = changedToken(wrongTokenInput.accessToken);
    const wrongToken = await callTool(workflowMutationTool, wrongTokenInput);
    assertToolError(
      wrongToken,
      /unavailable or expired/i,
      `Round ${round} wrong-token mutation`,
    );
    roundEvidence.lastCompletedStep = "find-possession-auth";

    const appliedInput = mutationInput(
      openedFind.snapshot,
      `stage6-find-apply-${round}`,
      "find-search",
      { criteria: [] },
    );
    const appliedResult = await callTool(workflowMutationTool, appliedInput);
    latestFindSnapshot = privateSnapshot(appliedResult);
    const applied = assertWorkflowBoundary(appliedResult, "find", "applied");
    latestFindSnapshot = applied.snapshot;
    assert(
      applied.summary.ok === true &&
        applied.snapshot.revision > openedFind.snapshot.revision &&
        applied.snapshot.assessmentAvailable === false &&
        applied.snapshot.assessmentBatch === null &&
        applied.summary.preparedRequestCount === 0,
      `Round ${round} Find mutation reopened a retired host-assessment boundary.`,
    );
    roundEvidence.lastCompletedStep = "find-search-applied";

    const replayResult = await callTool(workflowMutationTool, appliedInput);
    const replay = assertWorkflowBoundary(replayResult, "find", "replayed");
    latestFindSnapshot = replay.snapshot;
    assert(
      replay.snapshot.revision === applied.snapshot.revision &&
        replay.snapshot.stateFingerprint === applied.snapshot.stateFingerprint,
      `Round ${round} exact replay changed canonical Find coordinates.`,
    );
    roundEvidence.lastCompletedStep = "find-search-replayed";

    const staleMutationInput = mutationInput(
      openedFind.snapshot,
      `stage6-find-stale-${round}`,
      "find-search",
      { criteria: [] },
    );
    const conflictResult = await callTool(
      workflowMutationTool,
      staleMutationInput,
    );
    const conflict = assertWorkflowBoundary(conflictResult, "find", "conflict");
    latestFindSnapshot = conflict.snapshot;
    assert(
      conflict.summary.ok === false &&
        conflict.snapshot.revision === applied.snapshot.revision &&
        conflict.snapshot.stateFingerprint === applied.snapshot.stateFingerprint,
      `Round ${round} stale Find fork did not return the canonical winner.`,
    );
    roundEvidence.lastCompletedStep = "find-stale-mutation-conflict";

    // Retain the canonical aggregate before the candidate/funnel assertions:
    // otherwise an empty result discards all discovery evidence for this round.
    roundEvidence.findDiscoveryDiagnostics = captureFindDiscoveryDiagnostics(
      readCanonicalWorkflowState(conflict.snapshot, "find"),
      conflict.summary,
    );

    const completedFindSearch = await driveFindSearchToTerminal({
      current: conflict,
      readState: (current) =>
        readCanonicalWorkflowState(current.snapshot, "find"),
      continueSearch: async (current, { continuationIndex }) => {
        const continuationResult = await callTool(
          workflowMutationTool,
          mutationInput(
            current.snapshot,
            `stage6-find-search-continue-${round}-${continuationIndex}-${liveVerifierRunId}`,
            "find-search-continue",
            {},
          ),
        );
        const continuation = assertWorkflowBoundary(
          continuationResult,
          "find",
          "applied",
        );
        latestFindSnapshot = continuation.snapshot;
        roundEvidence.findDiscoveryDiagnostics =
          captureFindDiscoveryDiagnostics(
            readCanonicalWorkflowState(continuation.snapshot, "find"),
            continuation.summary,
          );
        roundEvidence.lastCompletedStep =
          `find-search-continue-${continuationIndex}`;
        return continuation;
      },
      label: `Round ${round} Find search`,
    });
    const terminalFind = completedFindSearch.current;
    latestFindSnapshot = terminalFind.snapshot;
    roundEvidence.findDiscoveryDiagnostics = captureFindDiscoveryDiagnostics(
      readCanonicalWorkflowState(terminalFind.snapshot, "find"),
      terminalFind.summary,
    );
    roundEvidence.lastCompletedStep = "find-search-terminal";

    const findDiscovery = assertDeterministicFindDiscovery(
      terminalFind.snapshot,
      terminalFind.summary,
      round,
    );
    roundEvidence.lastCompletedStep = "find-fixed-qualification";
    const genericHostLifecycle = await verifyOptionalGenericHostLifecycle(
      terminalFind.snapshot,
      round,
      hostReasoning,
    );
    roundEvidence.lastCompletedStep = "find-host-lifecycle-contract";

    const selectedFindCandidateId = findDiscovery.candidateSnapshotId;
    const openedFindCandidateResult = await callTool(
      workflowMutationTool,
      mutationInput(
        terminalFind.snapshot,
        `stage6-find-open-candidate-${round}-${liveVerifierRunId}`,
        "find-open",
        { candidateSnapshotId: selectedFindCandidateId },
      ),
    );
    const openedFindCandidate = assertWorkflowBoundary(
      openedFindCandidateResult,
      "find",
      "applied",
    );
    latestFindSnapshot = openedFindCandidate.snapshot;
    const selectedFindResult = await callTool(
      workflowMutationTool,
      mutationInput(
        openedFindCandidate.snapshot,
        `stage6-find-select-${round}-${liveVerifierRunId}`,
        "find-select",
        { candidateSnapshotId: selectedFindCandidateId },
      ),
    );
    const selectedFind = assertWorkflowBoundary(
      selectedFindResult,
      "find",
      "applied",
    );
    latestFindSnapshot = selectedFind.snapshot;
    const continuedFindResult = await callTool(
      workflowMutationTool,
      mutationInput(
        selectedFind.snapshot,
        `stage6-find-continue-${round}-${liveVerifierRunId}`,
        "find-continue",
      ),
    );
    const continuedFind = assertWorkflowBoundary(
      continuedFindResult,
      "find",
      "applied",
    );
    latestFindSnapshot = continuedFind.snapshot;
    assert(
      continuedFind.summary.continuationReady === true &&
        continuedFind.snapshot.handoff?.mode === "find" &&
        continuedFind.snapshot.handoff?.destinationScreen === "screen-03",
      `Round ${round} Find did not produce its exact Screen 3 handoff.`,
    );
    assertScreen02HandoffMatchesCanonicalState(
      readCanonicalWorkflowState(continuedFind.snapshot, "find"),
      continuedFind.snapshot.handoff,
      `Round ${round} Find handoff`,
    );
    roundEvidence.lastCompletedStep = "find-screen3-handoff";
    const findScreen03 = await verifyScreen03Workflow(
      continuedFind.snapshot,
      "find",
      round,
    );
    roundEvidence.lastCompletedStep = "find-screen3-verified";

    const staleRetireResult = await callTool(
      "retire_screen02_workflow_v021",
      retirementInput(openedFind.snapshot),
    );
    assertRetireResult(staleRetireResult, "conflict", openedFind.snapshot.runId);

    const retiredFindResult = await callTool(
      "retire_screen02_workflow_v021",
      retirementInput(continuedFind.snapshot),
    );
    assertRetireResult(
      retiredFindResult,
      "retired",
      continuedFind.snapshot.runId,
    );
    findRetired = true;

    const afterRetire = await callTool(
      workflowMutationTool,
      mutationInput(
        continuedFind.snapshot,
        `stage6-find-after-retire-${round}`,
        "refresh",
      ),
    );
    assertToolError(
      afterRetire,
      /unavailable or expired/i,
      `Round ${round} post-retire mutation`,
    );

    const postRetireScreen03Proposal =
      screen03Proposals(findScreen03.state)[0];
    assert(
      postRetireScreen03Proposal,
      `Round ${round} Find Screen 3 cleanup probe has no proposal.`,
    );
    const afterScreen03Retire = await callTool(
      screen03MutationTool,
      screen03MutationInput(
        continuedFind.snapshot,
        findScreen03.state,
        `stage6-screen03-find-after-retire-${round}-${liveVerifierRunId}`,
        {
          type: "review-field",
          proposalId: postRetireScreen03Proposal.id,
          decision: "unresolved",
          reason: "The retired parent must make its Screen 3 child inaccessible.",
        },
      ),
    );
    assertToolError(
      afterScreen03Retire,
      /unavailable or expired/i,
      `Round ${round} post-retire Find Screen 3 mutation`,
    );

    const absentFindResult = await callTool(
      "retire_screen02_workflow_v021",
      retirementInput(continuedFind.snapshot),
    );
    assertRetireResult(
      absentFindResult,
      "already-absent",
      continuedFind.snapshot.runId,
    );

    roundEvidence.find = {
      screen1: findScreen01.hostEvidence,
      open: "created",
      openReplay: "replayed-same-run",
      cachedSchemaCompatibility: "frozen-output-passed",
      possessionAuth: "rejected-wrong-token",
      mutation: "applied",
      replay: "replayed",
      staleMutation: "conflict",
      staleRetire: "conflict",
      retire: "retired",
      postRetire: "rejected",
      repeatedRetire: "already-absent",
      screen3: findScreen03.evidence,
      screen3Cleanup: "parent-retire-cascaded",
      discoveryPath: findDiscovery.evidence,
      clientContinuation: {
        continuationCalls: completedFindSearch.continuationCalls,
        completedToolCallCount:
          completedFindSearch.completedToolCallCount,
        terminalStatus: completedFindSearch.terminalStatus,
      },
      genericHostLifecycle,
      assessmentPath: "retired-not-invoked",
      completedCandidateCount: findDiscovery.evidence.displayedCandidateCount,
      completedRequestCount: 0,
      modelSubmissionCount: 0,
    };
    roundEvidence.lastCompletedStep = "find-retirement-and-cleanup";

    const auditScreen01 = await confirmedScreen01Context(
      "audit",
      round,
      hostReasoning,
    );
    const auditContext = auditScreen01.context;
    roundEvidence.lastCompletedStep = "audit-screen1-confirmed";
    const auditOpenOperationId =
      `screen02-v021-open-live-audit-${round}-${liveVerifierRunId}`;
    const openedAuditResult = await callTool(workflowCreateTool, {
      schemaVersion: workflowCreateSchemaVersion,
      operationId: auditOpenOperationId,
      ...responseKeyFields(auditOpenOperationId),
      initialState: "standard",
      studyContext: auditContext,
    });
    const openedAudit = assertWorkflowBoundary(openedAuditResult, "audit", "created");
    latestAuditSnapshot = openedAudit.snapshot;
    assert(
      openedAudit.summary.ok === true &&
        openedAudit.snapshot.runId !== auditOpenOperationId &&
        openedAuditResult._meta[workflowCorrelationMetaKey].operationId ===
          auditOpenOperationId &&
        openedAudit.snapshot.assessmentAvailable === false &&
        openedAudit.snapshot.assessmentBatch === null &&
        openedAudit.summary.preparedRequestCount === 0,
      `Round ${round} Audit open did not preserve the match-selection boundary.`,
    );
    roundEvidence.lastCompletedStep = "audit-workflow-created";

    const auditMatchSnapshotId = firstActiveAuditMatchSnapshotId(
      openedAudit.snapshot,
    );
    const openedDossierResult = await callTool(
      workflowMutationTool,
      mutationInput(
        openedAudit.snapshot,
        `stage6-audit-open-${round}`,
        "audit-open",
        { matchSnapshotId: auditMatchSnapshotId },
      ),
    );
    latestAuditSnapshot = privateSnapshot(openedDossierResult);
    const openedDossier = assertWorkflowBoundary(
      openedDossierResult,
      "audit",
      "applied",
    );
    latestAuditSnapshot = openedDossier.snapshot;
    assert(
      openedDossier.summary.ok === true &&
        openedDossier.snapshot.revision > openedAudit.snapshot.revision &&
        openedDossier.snapshot.assessmentAvailable === false &&
        openedDossier.snapshot.assessmentBatch === null &&
        openedDossier.summary.preparedRequestCount === 0,
      `Round ${round} Audit match open reopened a retired host-dossier boundary.`,
    );
    const auditDossier = assertDeterministicAuditDossier(
      openedDossier.snapshot,
      openedDossier.summary,
      auditMatchSnapshotId,
      round,
    );
    roundEvidence.lastCompletedStep = "audit-dossier-verified";

    const confirmedAuditResult = await callTool(
      workflowMutationTool,
      mutationInput(
        openedDossier.snapshot,
        `stage6-audit-confirm-${round}`,
        "audit-confirm",
        {
          matchSnapshotId: auditMatchSnapshotId,
          reason:
            "The source-backed title, issuer, jurisdiction, and date identify the intended event for this live verification.",
        },
      ),
    );
    latestAuditSnapshot = privateSnapshot(confirmedAuditResult);
    const confirmedAudit = assertWorkflowBoundary(
      confirmedAuditResult,
      "audit",
      "applied",
    );
    latestAuditSnapshot = confirmedAudit.snapshot;
    assert(
      confirmedAudit.summary.ok === true &&
        confirmedAudit.snapshot.revision > openedDossier.snapshot.revision &&
        confirmedAudit.snapshot.assessmentAvailable === false &&
        confirmedAudit.snapshot.assessmentBatch === null &&
        confirmedAudit.summary.preparedRequestCount === 0,
      `Round ${round} Audit confirmation reopened a retired host-assessment boundary.`,
    );
    const auditAssessment = assertDeterministicAuditAssessment(
      confirmedAudit.snapshot,
      confirmedAudit.summary,
      round,
    );
    roundEvidence.lastCompletedStep = "audit-assessment-verified";

    const continuedAuditResult = await callTool(
      workflowMutationTool,
      mutationInput(
        confirmedAudit.snapshot,
        `stage6-audit-continue-${round}-${liveVerifierRunId}`,
        "audit-continue",
      ),
    );
    const continuedAudit = assertWorkflowBoundary(
      continuedAuditResult,
      "audit",
      "applied",
    );
    latestAuditSnapshot = continuedAudit.snapshot;
    assert(
      continuedAudit.summary.continuationReady === true &&
        continuedAudit.snapshot.handoff?.mode === "audit" &&
        continuedAudit.snapshot.handoff?.destinationScreen === "screen-03",
      `Round ${round} Audit did not produce its exact Screen 3 handoff.`,
    );
    assertScreen02HandoffMatchesCanonicalState(
      readCanonicalWorkflowState(continuedAudit.snapshot, "audit"),
      continuedAudit.snapshot.handoff,
      `Round ${round} Audit handoff`,
    );
    roundEvidence.lastCompletedStep = "audit-screen3-handoff";
    const auditScreen03 = await verifyScreen03Workflow(
      continuedAudit.snapshot,
      "audit",
      round,
    );
    roundEvidence.lastCompletedStep = "audit-screen3-verified";

    const retiredAuditResult = await callTool(
      "retire_screen02_workflow_v021",
      retirementInput(continuedAudit.snapshot),
    );
    assertRetireResult(
      retiredAuditResult,
      "retired",
      continuedAudit.snapshot.runId,
    );
    auditRetired = true;

    const postRetireAuditScreen03Proposal =
      screen03Proposals(auditScreen03.state)[0];
    assert(
      postRetireAuditScreen03Proposal,
      `Round ${round} Audit Screen 3 cleanup probe has no proposal.`,
    );
    const afterAuditScreen03Retire = await callTool(
      screen03MutationTool,
      screen03MutationInput(
        continuedAudit.snapshot,
        auditScreen03.state,
        `stage6-screen03-audit-after-retire-${round}-${liveVerifierRunId}`,
        {
          type: "review-field",
          proposalId: postRetireAuditScreen03Proposal.id,
          decision: "unresolved",
          reason: "The retired parent must make its Screen 3 child inaccessible.",
        },
      ),
    );
    assertToolError(
      afterAuditScreen03Retire,
      /unavailable or expired/i,
      `Round ${round} post-retire Audit Screen 3 mutation`,
    );

    const blankAuditOpenOperationId =
      `screen02-v021-open-live-audit-reset-${round}-${liveVerifierRunId}`;
    const blankAuditOpenArguments = {
      schemaVersion: workflowCreateSchemaVersion,
      operationId: blankAuditOpenOperationId,
      ...responseKeyFields(blankAuditOpenOperationId),
      initialState: "blank",
      studyContext: auditContext,
    };
    const blankAuditResult = await callTool(
      workflowCreateTool,
      blankAuditOpenArguments,
    );
    const blankAudit = assertWorkflowBoundary(
      blankAuditResult,
      "audit",
      "created",
      "open",
    );
    latestAuditSnapshot = blankAudit.snapshot;
    auditRetired = false;
    const blankAuditState = readCanonicalWorkflowState(
      blankAudit.snapshot,
      "audit",
    );
    assert(
      blankAudit.snapshot.revision === 0 &&
        blankAudit.snapshot.assessmentBatch === null &&
        blankAudit.summary.preparedRequestCount === 0 &&
        sameCanonicalJsonValue(
          blankAuditState.screen01Baseline,
          auditContext,
        ) &&
        blankAuditState.anchor?.originalWording === auditContext.knownShock &&
        blankAuditState.activeMatchSetSnapshotId === null &&
        [
          "sources",
          "matchSets",
          "possibleMatches",
          "dossiers",
          "identityDecisions",
          "assessments",
          "assessmentRequests",
          "continuationHistory",
        ].every(
          (key) =>
            Array.isArray(blankAuditState[key]) &&
            blankAuditState[key].length === 0,
        ) &&
        blankAuditState.confirmedIdentity === null,
      `Round ${round} Audit reset did not create an exact blank replacement.`,
    );
    const replayedBlankAuditResult = await callTool(
      workflowCreateTool,
      blankAuditOpenArguments,
    );
    const replayedBlankAudit = assertWorkflowBoundary(
      replayedBlankAuditResult,
      "audit",
      "replayed",
      "open",
    );
    assert(
      replayedBlankAudit.snapshot.runId === blankAudit.snapshot.runId &&
        replayedBlankAudit.snapshot.accessToken ===
          blankAudit.snapshot.accessToken &&
        replayedBlankAudit.snapshot.stateFingerprint ===
          blankAudit.snapshot.stateFingerprint,
      `Round ${round} Audit blank reset replay changed canonical coordinates.`,
    );
    const changedBlankIntent = await callTool(workflowCreateTool, {
      ...blankAuditOpenArguments,
      initialState: "standard",
    });
    assertToolError(
      changedBlankIntent,
      /different initialization profile/i,
      `Round ${round} Audit reset initialization binding`,
    );
    const retiredBlankAuditResult = await callTool(
      "retire_screen02_workflow_v021",
      retirementInput(blankAudit.snapshot),
    );
    assertRetireResult(
      retiredBlankAuditResult,
      "retired",
      blankAudit.snapshot.runId,
    );
    auditRetired = true;
    roundEvidence.audit = {
      screen1: auditScreen01.hostEvidence,
      open: "created",
      dossier: "applied",
      identityConfirmation: "applied",
      assessment: "applied",
      retire: "retired",
      screen3: auditScreen03.evidence,
      screen3Cleanup: "parent-retire-cascaded",
      reset: "blank-created-replayed-intent-bound-retired",
      assessmentPath: "fixed-core-no-legacy-host",
      dossierContract: auditDossier.evidence,
      assessmentContract: auditAssessment.evidence,
      completedDossierCount: auditDossier.completedDossierCount,
      completedAssessmentCount: auditAssessment.completedAssessmentCount,
      completedRequestCount: auditAssessment.completedRequestCount,
      modelSubmissionCount: 0,
    };
    roundEvidence.status = "passed";
    roundEvidence.lastCompletedStep = "round-completed";
  } catch (error) {
    roundEvidence.failureDiagnostic = liveVerifierFailureDiagnostic(error);
    throw error;
  } finally {
    if (!findRetired) await bestEffortRetire(latestFindSnapshot);
    if (!auditRetired) await bestEffortRetire(latestAuditSnapshot);
  }
}

function markdownCell(value) {
  return sanitizeText(value ?? "—").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function evidenceMarkdown(evidence) {
  const lines = [
    "# ShockAudit Stage 6 live MCP evidence",
    "",
    `- Status: **${evidence.status.toUpperCase()}**`,
    `- Version: \`${evidence.expectedVersion}\``,
    `- Target origin: \`${evidence.targetOrigin}\``,
    `- Started: ${evidence.startedAt}`,
    `- Finished: ${evidence.finishedAt}`,
    `- Rounds required: ${evidence.roundsRequired}`,
    `- Synthetic host protocol evidence: ${evidence.simulatedEvidence ? "yes" : "no"}`,
    `- Signed-in ChatGPT authorship evidence: ${evidence.signedInChatGptEvidence ? "yes" : "no"}`,
    "",
    "This gate verifies the signed Screen 1 compatibility flow when that mode exposes it, otherwise the deterministic Screen 1 flow. Screen 2 discovery, qualification, Audit dossiers, and Audit review stay deterministic and never invoke retired model-submission tools. Full host-reasoning mode additionally exercises the generic task lifecycle as unavailable without submitting model output. Current Screen 3 uses its saved orientation without a host or model request. These checks prove protocol, validation, state, and security contracts; they do not prove that a signed-in ChatGPT model authored any result.",
    "Credentials, response-encryption keys, possession tokens, signed capabilities, state envelopes, raw workflow run identifiers, and raw MCP payloads are intentionally omitted.",
    "",
    "## Static surface",
    "",
    `- Health readiness: ${markdownCell(evidence.staticChecks?.health?.readiness)}`,
    `- Retention: ${markdownCell(evidence.staticChecks?.health?.retention)}`,
    `- UI resources: ${markdownCell(evidence.staticChecks?.resources?.resourceCount)}`,
    `- Current skills surface: ${markdownCell(evidence.staticChecks?.skills?.status)}; extension ${markdownCell(evidence.staticChecks?.skills?.extension)}; methods ${markdownCell(evidence.staticChecks?.skills?.methods)}`,
    `- Versioned assets: ${markdownCell(evidence.staticChecks?.resources?.assetPaths?.join(", "))}`,
    `- Legacy asset boundary: ${markdownCell(evidence.staticChecks?.resources?.legacyAssetBoundary)}`,
    `- Origin policy: ${markdownCell(evidence.staticChecks?.origin?.result)}`,
    `- Host reasoning mode: ${markdownCell(evidence.staticChecks?.hostReasoning?.mode)}`,
    `- Host reasoning path: ${markdownCell(evidence.staticChecks?.hostReasoning?.path)}`,
    `- Deterministic Screen 2 rounds: Find discovery ${markdownCell(evidence.staticChecks?.hostReasoning?.deterministicFindRounds)}, Audit dossier ${markdownCell(evidence.staticChecks?.hostReasoning?.deterministicAuditDossierRounds)}, Audit confirmed-event review ${markdownCell(evidence.staticChecks?.hostReasoning?.deterministicAuditAssessmentRounds)}`,
    `- Generic host lifecycle: exercised without model ${markdownCell(evidence.staticChecks?.hostReasoning?.genericLifecycleRounds)}; not invoked by mode ${markdownCell(evidence.staticChecks?.hostReasoning?.genericLifecycleNotInvokedRounds)}; model submissions ${markdownCell(evidence.staticChecks?.hostReasoning?.modelSubmissionCount)}`,
    `- Immediate Screen 3 orientation without current host/model requests: Find ${markdownCell(evidence.staticChecks?.screen03Orientation?.findImmediateOrientations)}, Audit ${markdownCell(evidence.staticChecks?.screen03Orientation?.auditImmediateOrientations)}; original glances preserved ${markdownCell(evidence.staticChecks?.screen03Orientation?.originalGlancesPreserved)}`,
    `- Locked Screen 3 Event Cards: Find ${markdownCell(evidence.staticChecks?.hostReasoning?.findLockedEventCards)}, Audit ${markdownCell(evidence.staticChecks?.hostReasoning?.auditLockedEventCards)}`,
    `- Oversized MCP body: HTTP ${markdownCell(evidence.staticChecks?.bodyLimit?.oversizedStatus)}`,
    "",
    "## Repeated workflow rounds",
    "",
    "| Round | Status | Find auth / CAS / replay | Find Screen 3 | Find retire | Audit fixed dossier / confirmation / review | Audit Screen 3 | Audit retire |",
    "| ---: | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const round of evidence.rounds) {
    lines.push(
      `| ${round.round} | ${markdownCell(round.status)} | ${markdownCell(
        round.find
          ? `${round.find.possessionAuth}; ${round.find.mutation}; ${round.find.replay}; ${round.find.staleMutation}`
          : "—",
      )} | ${markdownCell(
        round.find?.screen3
          ? `${round.find.screen3.open}; supported-${round.find.screen3.supportedReview}; unsupported-${round.find.screen3.unsupportedAcceptance}; ${round.find.screen3.staleReview}; refresh-${round.find.screen3.refresh}; card-${round.find.screen3.eventCard}; cleanup-${round.find.screen3Cleanup}`
          : "—",
      )} | ${markdownCell(
        round.find
          ? `${round.find.staleRetire}; ${round.find.retire}; ${round.find.repeatedRetire}`
          : "—",
      )} | ${markdownCell(
        round.audit
          ? `${round.audit.dossier}; ${round.audit.identityConfirmation}; ${round.audit.assessment}`
          : "—",
      )} | ${markdownCell(
        round.audit?.screen3
          ? `${round.audit.screen3.open}; supported-${round.audit.screen3.supportedReview}; unsupported-${round.audit.screen3.unsupportedAcceptance}; ${round.audit.screen3.staleReview}; refresh-${round.audit.screen3.refresh}; card-${round.audit.screen3.eventCard}; cleanup-${round.audit.screen3Cleanup}`
          : "—",
      )} | ${markdownCell(
        round.audit?.retire ?? "—",
      )} |`,
    );
  }
  if (evidence.failure) {
    lines.push("", "## Failure", "", markdownCell(evidence.failure));
    for (const round of evidence.rounds.filter((item) => item.status === "failed")) {
      lines.push(
        "",
        `- Round ${round.round} last completed step: ${markdownCell(round.lastCompletedStep)}`,
        `- Failure code: ${markdownCell(round.failureDiagnostic?.code)}`,
        `- Public diagnostic: ${markdownCell(round.failureDiagnostic?.publicMessage)}`,
      );
      if (round.findDiscoveryDiagnostics) {
        const diagnostic = round.findDiscoveryDiagnostics;
        lines.push(
          `- Find active set: ${markdownCell(diagnostic.activeSetStatus)}; active candidates: ${diagnostic.counts.activeCandidates}; fixed-qualified active candidates: ${diagnostic.counts.fixedQualifiedActiveCandidates}; exclusions: ${diagnostic.counts.exclusions}`,
          "- Sanitized canonical funnel, route statuses, exclusions, and gate booleans are retained in the JSON evidence.",
        );
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function writeEvidence(evidence, evidenceDir) {
  const safeEvidence = sanitizeEvidence(evidence);
  const jsonPath = resolve(evidenceDir, "verify-live-mcp.json");
  const markdownPath = resolve(evidenceDir, "verify-live-mcp.md");
  await mkdir(evidenceDir, { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(safeEvidence, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, evidenceMarkdown(safeEvidence), "utf8"),
  ]);
  return { jsonPath, markdownPath };
}

async function runGate(options) {
  const evidence = {
    schemaVersion: "shockaudit-stage6-live-evidence-v1",
    status: "running",
    simulatedEvidence: true,
    signedInChatGptEvidence: false,
    expectedVersion,
    expectedCommit: "unconfigured",
    targetOrigin: "unavailable",
    startedAt: new Date().toISOString(),
    finishedAt: "",
    roundsRequired,
    lastCompletedStep: "gate-started",
    staticChecks: {},
    rounds: [],
  };
  let failure = null;
  try {
    assert(
      releasedResourceUris.includes(expectedResourceUri),
      `Add ${expectedResourceUri} to the independent live release ledger.`,
    );
    configureTarget();
    evidence.expectedCommit = expectedCommitFull;
    evidence.targetOrigin = publicOrigin;
    evidence.lastCompletedStep = "target-configured";
    const healthValue = await waitForReadyHealth(options.waitSeconds);
    const runtimeCapabilities = verifyHealthContract(healthValue);
    evidence.staticChecks.health = {
      httpStatus: 200,
      readiness: "integrated/durable-object/chatgpt-host/signing-ready",
      retention: "24h idle / 7d absolute / 1h continued / immediate retirement / alarm cleanup",
      resourceCount: healthValue.supportedUiResourceUris.length,
      runtimeCapabilities,
    };
    evidence.lastCompletedStep = "health-contract";
    evidence.staticChecks.credentialedSources =
      await verifyCredentialedSourceCapabilities();
    evidence.lastCompletedStep = "credentialed-source-capabilities";
    evidence.staticChecks.origin = {
      ...(await verifyOriginBehavior()),
      result: "trusted accepted; deceptive and null rejected; preflight accepted",
    };
    evidence.lastCompletedStep = "origin-contract";
    evidence.staticChecks.resources = await verifyResourcesAndAssets(healthValue);
    evidence.lastCompletedStep = "resources-and-assets";
    const hostReasoning = evidence.staticChecks.resources.hostReasoning;
    evidence.staticChecks.sixScreenWorkflow =
      await verifySixScreenReplacementWorkflow();
    evidence.lastCompletedStep = "six-screen-workflow-contract";
    evidence.staticChecks.skills = await verifyNoCurrentSkillsSurface();
    evidence.lastCompletedStep = "retired-skills-contract";

    for (let round = 1; round <= roundsRequired; round += 1) {
      const roundEvidence = { round, status: "running" };
      evidence.rounds.push(roundEvidence);
      console.log(`Stage 6 live MCP round ${round}/${roundsRequired} started.`);
      try {
        await verifyRound(round, roundEvidence, hostReasoning);
        evidence.lastCompletedStep = `round-${round}-completed`;
        console.log(`Stage 6 live MCP round ${round}/${roundsRequired} passed.`);
      } catch (error) {
        roundEvidence.status = "failed";
        evidence.lastCompletedStep = roundEvidence.lastCompletedStep;
        throw error;
      }
    }
    const deterministicFindRounds = evidence.rounds.filter(
      (round) =>
        round.find?.discoveryPath?.path === "fixed-deterministic-discovery" &&
        round.find?.assessmentPath === "retired-not-invoked" &&
        round.find?.completedRequestCount === 0,
    ).length;
    const deterministicAuditDossierRounds = evidence.rounds.filter(
      (round) =>
        round.audit?.dossierContract?.path ===
          "source-derived-fixed-fallback" &&
        round.audit?.dossierContract?.hostSubmission === "not-invoked",
    ).length;
    const deterministicAuditAssessmentRounds = evidence.rounds.filter(
      (round) =>
        round.audit?.assessmentContract?.path ===
          "conservative-fixed-fallback" &&
        round.audit?.assessmentContract?.hostSubmission === "not-invoked" &&
        round.audit?.completedRequestCount === 2,
    ).length;
    const genericLifecycleRounds = evidence.rounds.filter(
      (round) =>
        round.find?.genericHostLifecycle?.path ===
          "generic-lifecycle-no-model" &&
        round.find?.genericHostLifecycle?.modelSubmission === "not-invoked",
    ).length;
    const genericLifecycleNotInvokedRounds = evidence.rounds.filter(
      (round) =>
        round.find?.genericHostLifecycle?.path === "not-invoked" &&
        round.find?.genericHostLifecycle?.reason === hostReasoning.mode,
    ).length;
    const signedScreen01Rounds = evidence.rounds.filter(
      (round) =>
        round.find?.screen1?.receipt === "signed" &&
        round.audit?.screen1?.receipt === "signed",
    ).length;
    const deterministicScreen01Rounds = evidence.rounds.filter(
      (round) =>
        round.find?.screen1?.applied === "fixed-draft" &&
        round.audit?.screen1?.applied === "fixed-draft",
    ).length;
    const modelSubmissionCount = evidence.rounds.reduce(
      (total, round) =>
        total +
        (round.find?.modelSubmissionCount ?? 0) +
        (round.audit?.modelSubmissionCount ?? 0),
      0,
    );
    const findImmediateOrientations = evidence.rounds.filter(
      (round) =>
        round.find?.screen3?.currentHostPath === "not-invoked" &&
        round.find?.screen3?.currentModelRequest === "none" &&
        round.find?.screen3?.originalGlance === "preserved",
    ).length;
    const auditImmediateOrientations = evidence.rounds.filter(
      (round) =>
        round.audit?.screen3?.currentHostPath === "not-invoked" &&
        round.audit?.screen3?.currentModelRequest === "none" &&
        round.audit?.screen3?.originalGlance === "preserved",
    ).length;
    const findLockedEventCards = evidence.rounds.filter(
      (round) => round.find?.screen3?.eventCard === "locked",
    ).length;
    const auditLockedEventCards = evidence.rounds.filter(
      (round) => round.audit?.screen3?.eventCard === "locked",
    ).length;
    assert(
      findLockedEventCards === 2 && auditLockedEventCards === 2,
      "The live gate must lock exactly two Find and two Audit Event Cards before production acceptance.",
    );
    const fullHostMode = hostReasoning.mode === "full";
    const deterministicScreen01Mode =
      SIX_SCREEN_REPLACEMENT_BUILD || fullHostMode;
    const screen02HostMode =
      fullHostMode || hostReasoning.mode === "screen02-only";
    evidence.staticChecks.hostReasoning = {
      mode: hostReasoning.mode,
      enabled: hostReasoning.enabled,
      path: deterministicScreen01Mode
        ? screen02HostMode
          ? "deterministic Screen 1 and Screen 2; generic host lifecycle rejected as unavailable without a signed-in host; no model submission; current Screen 3 host path not invoked"
          : "deterministic Screen 1 and Screen 2; generic host lifecycle and model submissions not invoked; current Screen 3 host path not invoked"
        : screen02HostMode
          ? "signed Screen 1 compatibility flow; deterministic Screen 2; generic Screen 2 host lifecycle rejected as unavailable without a signed-in host; no model submission; current Screen 3 host path not invoked"
          : "signed Screen 1 compatibility flow; deterministic Screen 2; generic host lifecycle and model submissions not invoked; current Screen 3 host path not invoked",
      signedScreen01Rounds,
      deterministicScreen01Rounds,
      deterministicFindRounds,
      deterministicAuditDossierRounds,
      deterministicAuditAssessmentRounds,
      genericLifecycleRounds,
      genericLifecycleNotInvokedRounds,
      modelSubmissionCount,
      findLockedEventCards,
      auditLockedEventCards,
      rawDraftsRecorded: false,
      signedTokensRecorded: false,
    };
    evidence.staticChecks.screen03Orientation = {
      findImmediateOrientations,
      auditImmediateOrientations,
      roundsObserved: roundsRequired,
      currentHostRequests: 0,
      currentModelRequests: 0,
      originalGlancesPreserved: true,
    };
    assert(
      deterministicFindRounds === roundsRequired &&
        deterministicAuditDossierRounds === roundsRequired &&
        deterministicAuditAssessmentRounds === roundsRequired &&
        modelSubmissionCount === 0,
      "Five live rounds did not validate deterministic Screen 2 discovery, Audit fallback work, and the absence of retired model submissions.",
    );
    assert(
      (deterministicScreen01Mode
        ? deterministicScreen01Rounds === roundsRequired &&
            signedScreen01Rounds === 0
        : signedScreen01Rounds === roundsRequired &&
            deterministicScreen01Rounds === 0) &&
        (screen02HostMode
          ? genericLifecycleRounds === roundsRequired &&
            genericLifecycleNotInvokedRounds === 0
          : genericLifecycleRounds === 0 &&
            genericLifecycleNotInvokedRounds === roundsRequired),
      "The live rounds did not follow the exact Screen 1 and generic host-task paths advertised by the active host-reasoning mode.",
    );
    assert(
      findImmediateOrientations === roundsRequired &&
        auditImmediateOrientations === roundsRequired,
      "Five live rounds did not validate immediate Screen 3 orientation with zero current host/model requests for every Find and Audit workflow.",
    );
    evidence.staticChecks.bodyLimit = await verifyBodyLimit();
    evidence.lastCompletedStep = "body-limit-contract";
    evidence.status = "passed";
  } catch (error) {
    failure = error;
    evidence.status = "failed";
    evidence.failure = safeErrorMessage(error);
    evidence.failureDiagnostic = liveVerifierFailureDiagnostic(error);
  } finally {
    evidence.finishedAt = new Date().toISOString();
  }

  let paths;
  try {
    paths = await writeEvidence(evidence, options.evidenceDir);
  } catch (error) {
    const evidenceError = safeErrorMessage(error);
    console.error(`Stage 6 live MCP gate could not write sanitized evidence: ${evidenceError}`);
    if (!failure) failure = error;
  }

  if (failure) {
    console.error(`Stage 6 live MCP gate failed: ${safeErrorMessage(failure)}`);
    if (paths) {
      console.error(`Sanitized evidence: ${paths.jsonPath} and ${paths.markdownPath}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Stage 6 live MCP gate passed ${roundsRequired} rounds for ShockAudit v${expectedVersion} at commit ${expectedCommitFull}.`,
  );
  if (paths) console.log(`Sanitized evidence: ${paths.jsonPath} and ${paths.markdownPath}`);
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(`${safeErrorMessage(error)}\n\n${usage()}`);
  process.exitCode = 2;
}

if (options?.help) {
  console.log(usage());
} else if (options) {
  await runGate(options);
}
