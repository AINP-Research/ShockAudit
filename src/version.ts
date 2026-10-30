import packageMetadata from "../package.json" with { type: "json" };
import {
  SHOCKAUDIT_VERSION as SHOCKAUDIT_VERSION_LITERAL,
} from "./core/shockaudit-version.ts";

// Preserve the existing public `string` type while the dependency-light core
// module intentionally exposes the exact release literal.
export const SHOCKAUDIT_VERSION: string = SHOCKAUDIT_VERSION_LITERAL;

if (packageMetadata.version !== SHOCKAUDIT_VERSION_LITERAL) {
  throw new Error(
    `package.json version ${packageMetadata.version} does not match ShockAudit version ${SHOCKAUDIT_VERSION_LITERAL}.`,
  );
}
/**
 * Product releases keep two patch digits at a minor-series boundary. npm
 * metadata stays valid SemVer (`0.6.2`), while the explicit product/resource
 * label preserves the requested `v0.6.2` convention.
 */
export const SHOCKAUDIT_RELEASE_LABEL = "0.6.2" as const;
/**
 * Production resource identity for the local-to-main migration.
 * The product version remains v0.6.2; this immutable resource suffix prevents
 * a cached pre-repair UI from being paired with the repaired local Worker.
 */
export const SHOCKAUDIT_UI_BUILD_LABEL =
  "0.6.2-production-v109-r1" as const;
export const SHOCKAUDIT_PUBLIC_ORIGIN =
  "https://shockaudit.ainp-research.workers.dev";
export const SHOCKAUDIT_UI_RESOURCE_URI =
  `ui://shockaudit/workspace-v${SHOCKAUDIT_UI_BUILD_LABEL}.html`;
/**
 * Peer identity for the response-v6 structured-chunk protocol. This repair
 * binds automatic local usage accounting to its matching Worker while
 * keeping saved scientific state and earlier resources readable.
 */
export const SHOCKAUDIT_WORKFLOW_RESPONSE_UI_RESOURCE_URI =
  SHOCKAUDIT_UI_RESOURCE_URI;
export const SCREEN_01_UI_RESOURCE_URI = SHOCKAUDIT_UI_RESOURCE_URI;
export const STAGE1_PROOF_UI_RESOURCE_URI =
  "ui://widget/shockaudit-stage1-proof-v1.html";

/**
 * ChatGPT conversations can retain an earlier tool-to-resource link. Keep
 * every previously deployed URI readable so a compatible release never turns
 * an existing conversation into “Link not found” while the connection is
 * being refreshed.
 */
export const RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS = [
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
] as const;

export const LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS =
  RELEASED_SHOCKAUDIT_UI_RESOURCE_URIS;

export const SUPPORTED_SHOCKAUDIT_UI_RESOURCE_URIS = [
  SHOCKAUDIT_UI_RESOURCE_URI,
  ...LEGACY_SHOCKAUDIT_UI_RESOURCE_URIS,
] as const;
