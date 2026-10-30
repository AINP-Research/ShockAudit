import { mkdir, writeFile } from "node:fs/promises";
import { SixScreenWorkflowRuntime } from "../src/worker/six-screen-workflow-runtime";
import { SixScreenWorkflowStore, InMemorySixScreenWorkflowStorage } from "../src/worker/six-screen-workflow-store";
import { SixScreenEvidenceStore } from "../src/worker/six-screen-evidence-store";
import { SixScreenResearchTaskStore } from "../src/worker/six-screen-research-task-store";
import { validateSixScreenWorkflowProjection } from "../src/worker/six-screen-tools";
import { stressStudies } from "../tests/fixtures/stress/studies";

/** Manual public-source probe. Uses isolated memory stores and never configures a model provider.
 * Run from the repository root; generated snapshots are temporary test credentials/data.
 */
if (process.env.STRESS_LIVE_NETWORK !== "1") {
  throw new Error("Set STRESS_LIVE_NETWORK=1 to allow this manual public-source stress test.");
}
const root = process.env.STRESS_LIVE_DIR ?? "tmp/stress/live";
await mkdir(root, { recursive: true });
async function run(test: typeof stressStudies[number]) {
  const requests: Array<{url:string;status?:number;error?:string}> = [];
  const summary: Record<string, any> = { id: test.id, shock: test.shock, modelCalls: 0, stages: [] };
  const storage = new InMemorySixScreenWorkflowStorage();
  const runtime = new SixScreenWorkflowRuntime({ store: new SixScreenWorkflowStore(storage),
    evidenceStore: new SixScreenEvidenceStore(storage), taskStore: new SixScreenResearchTaskStore(storage),
    signingKey: "stress-test-only-isolated-storage-not-a-deployment-key", now: () => new Date().toISOString(),
    monotonicNow: () => performance.now(),
    fetch: async (input, init) => {
      const url = String(input); const row = {url} as typeof requests[number]; requests.push(row);
      try { const response = await fetch(input, {...init, signal: AbortSignal.any([AbortSignal.timeout(20000), ...(init?.signal ? [init.signal] : [])])});
        row.status = response.status; return response;
      } catch(error) { row.error=String(error); throw error; }
    },
  });
  let saved: any; let auth: any;
  async function retain(stage: string, response: any) {
    saved = response;
    validateSixScreenWorkflowProjection(response.projection);
    summary.stages.push({ stage, screen: saved.privateSnapshot.state.activeScreen, revision: saved.privateSnapshot.revision, valid: true });
    await writeFile(`${root}/${test.id}-${stage}.json`, JSON.stringify(response, null, 2));
    console.log(JSON.stringify({id:test.id,stage,screen:saved.privateSnapshot.state.activeScreen}));
  }
  try {
    await retain("create", await runtime.create({ operationId:`stress-${test.id}-${Date.now()}`, shockInput:test.shock,
      requestedJurisdiction:test.jurisdiction, approximateYear:String(test.year), study:test.study,
      ...((process.env.STRESS_OFFICIAL_URL || test.locator) ? {officialSourceLocators:[process.env.STRESS_OFFICIAL_URL || test.locator!]} : {}) }));
    auth = {runId:saved.privateSnapshot.runId,accessToken:saved.privateSnapshot.accessToken};
    const resolution=await runtime.resolveShock(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-resolve`});
    await retain("identity",resolution);
    summary.identity={status:resolution.resolution.status,candidates:resolution.resolution.candidates.map(c=>({title:c.officialTitle, mismatches:c.materialMismatches, sources:c.identitySources.map(s=>s.locator)})),limitation:resolution.resolution.limitation};
    const state=saved.privateSnapshot.state, candidate=state.candidates[0];
    if(!candidate || candidate.materialMismatches.length) { summary.stopped="No unambiguous supported candidate"; return; }
    await retain("confirm",await runtime.confirmShock(auth,{expectedRevision:state.revision,operationId:`${test.id}-confirm`,candidateId:candidate.id,
      displayedIdentityFingerprint:candidate.identityFingerprint,sourceSnapshotId:candidate.sourceSnapshotId,sourceSnapshotFingerprint:candidate.sourceSnapshotFingerprint,
      originalRequestFingerprint:state.originalRequestFingerprint,currentRequestFingerprint:state.currentRequestFingerprint,identityRevision:state.identityRevision}));
    await retain("screen2",await runtime.openScreen2(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-screen2`}));
    await retain("policy",await runtime.researchPolicy(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-policy`}));
    for(let step=0;step<2 && saved.privateSnapshot.state.policyReview?.plan.nextStepId;step++) {
      await retain(`policy-continue-${step+1}`,await runtime.continuePolicyResearch(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-policy-${step+1}`}));
    }
    const review=saved.privateSnapshot.state.policyReview;
    summary.policy={status:review?.status,claims:review?.claims.length,sourceCount:review?.sourceCount,passages:review?.passageCount,unresolved:review?.unresolved};
    await retain("screen3",await runtime.openScreen3(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-screen3`,study:test.study,proposedTiming:test.timing}));
    try { await retain("screen4",await runtime.openScreen4(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-screen4`})); }
    catch(error) { summary.screen4Limitation=String(error); await retain("screen4-status",await runtime.status(auth)); }
    await retain("screen5",await runtime.openScreen5(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-screen5`}));
    await retain("mechanism-setup",await runtime.compareStudyFirstMechanisms(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-mechanism`,theoreticalPerspective:null,proposedMechanism:test.study.initialExplanation!}));
    summary.mechanism=saved.projection.studyFirstMechanismWorkspace.executionReadiness;
    await retain("screen6",await runtime.openScreen6(auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-screen6`}));
    for(const screen of [2,3,5,6]) {
      const method=`openScreen${screen}` as "openScreen2";
      await retain(`revisit-${screen}`,await runtime[method](auth,{expectedRevision:saved.privateSnapshot.revision,operationId:`${test.id}-revisit-${screen}`,
        ...(screen===3 ? {study:test.study,proposedTiming:test.timing} : {})}));
    }
    summary.completed=true;
  } catch(error) {summary.error=error instanceof Error?error.stack:String(error);}
  finally {
    summary.requests=requests;
    await writeFile(`${root}/${test.id}-summary.json`,JSON.stringify(summary,null,2));
    console.log(JSON.stringify({id:test.id,result:summary.completed?'completed':summary.stopped??summary.error,requests:requests.length,policy:summary.policy}));
  }
}
// Keep official-source load bounded: two isolated studies at a time.
const selected=stressStudies.filter(test=>!process.env.STRESS_IDS || process.env.STRESS_IDS.split(",").includes(test.id));
for(let i=0;i<selected.length;i+=2) await Promise.allSettled(selected.slice(i,i+2).map(run));
