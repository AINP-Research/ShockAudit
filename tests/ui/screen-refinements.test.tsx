import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { unzipSync, strFromU8 } from "fflate";
import { uniquePolicyBriefingSections } from "../../src/core/six-screen/policy-presentation";
import type { PolicyBriefingSection } from "../../src/core/six-screen/contracts";
import { completeReportFixture } from "../fixtures/complete-report";
import { createScreen6CurrentPlan } from "../../src/core/six-screen/screen6-current-plan";
import { createScreen6DesignMapProjection } from "../../src/core/six-screen/screen6-design-map";
import { createCompleteReport } from "../../src/ui/six-screen/complete-report-data";
import { generateCompleteReportDocx } from "../../src/ui/six-screen/complete-report-docx";
import { Screen6CurrentPlanPanel } from "../../src/ui/six-screen/Screen6CurrentPlanPanel";

describe("screen refinements and paired reports", () => {
  it("shows a repeated policy passage once while retaining every source and distinct qualification", () => {
    const section = (text: string, claimId: string) => ({ title: claimId, status: "supported", paragraphs: [], claimIds: [claimId],
      findings: [{ label: "Coverage", text, claimIds: [claimId] }] }) as PolicyBriefingSection;
    const source = [section('(a) “Business” means a sole proprietorship.', "claim-1"),
      section('"Business" means a sole proprietorship.', "claim-2"),
      section('"Business" means a sole proprietorship, except exempt entities.', "claim-3")];
    const original = JSON.stringify(source);
    const result = uniquePolicyBriefingSections(source);
    expect(result.flatMap((item) => item.findings)).toHaveLength(2);
    expect(result[0]!.findings[0]!.claimIds).toEqual(["claim-1", "claim-2"]);
    expect(result[2]!.findings[0]!.text).toContain("except exempt entities");
    expect(JSON.stringify(source)).toBe(original);
  });

  it("writes the same full report content to editable Word with source links, embedded fonts and two export controls", () => {
    const state = completeReportFixture(10), original = JSON.stringify(state);
    const plan = createScreen6CurrentPlan(state);
    const report = createCompleteReport({ state, plan, designMap: createScreen6DesignMapProjection(plan) });
    const bytes = generateCompleteReportDocx(report);
    const archive = unzipSync(bytes);
    const document = strFromU8(archive["word/document.xml"]!);
    const text = document.replace(/<[^>]*>/gu, "").replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"');
    for (const section of report.sections) for (const block of section.blocks) {
      for (const value of [block.text, ...(block.fields ?? []).flatMap((item) => [item.label, item.value]),
        ...(block.bullets ?? []), ...(block.chain ?? []), ...(block.numbered ?? []),
        ...(block.table?.rows.flat() ?? [])].filter((value): value is string => Boolean(value))) expect(text).toContain(value);
    }
    expect(document).toContain('w:orient="landscape"');
    expect(strFromU8(archive["word/footer.xml"]!)).toContain('w:instr="PAGE"');
    expect(strFromU8(archive["word/_rels/document.xml.rels"]!)).toContain('TargetMode="External"');
    expect(strFromU8(archive["word/_rels/document.xml.rels"]!))
      .toContain('Target="media/design-map.svg"');
    expect(strFromU8(archive["word/media/design-map.svg"]!)).toContain("<svg");
    expect(archive["word/media/design-map.png"]).toBeUndefined();
    expect(archive["word/fonts/regular.odttf"]!.length).toBeGreaterThan(100_000);
    const markup = renderToStaticMarkup(<Screen6CurrentPlanPanel plan={plan} workflowState={state} />);
    const actions = markup.split('six-actions six-design-map-actions')[1]!.split('</div>')[0]!;
    expect([...actions.matchAll(/<button /gu)]).toHaveLength(2);
    expect(actions).toContain("Create PDF");
    expect(actions).toContain("Create Word");
    expect(JSON.stringify(state)).toBe(original);
  });
});
