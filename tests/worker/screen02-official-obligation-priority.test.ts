import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { fetchScreen02OverviewDocument, screen02RedirectedOverviewMatchesProposal } from "../../src/worker/server";
import { REVIEWED_SCREEN02_EVENT_REGISTRY } from "../../src/core/screen02-registry";

const body = gunzipSync(readFileSync(new URL("../fixtures/screen02-audit-source-recovery/gdpr-eurlex.html.gz", import.meta.url))).toString("utf8");
const url = "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679";
const gdpr = REVIEWED_SCREEN02_EVENT_REGISTRY.find((entry) => entry.id === "registry-eu-gdpr-2018")!;
const read = (html: string) => fetchScreen02OverviewDocument(async () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }), url);

describe("source-bound official obligation priority", () => {
  it("retains actual controller obligations before establishment definitions in the unchanged captured legal body", async () => {
    const document = await read(body);
    expect(document.nativeIdentity?.recordId).toBe("32016R0679");
    expect(document.evidenceText).toContain("The controller shall be responsible for, and be able to demonstrate compliance");
    expect(document.overview).toMatch(/^2\. The controller shall be responsible/);
    expect(document.overview).not.toMatch(/^1\. This Regulation applies/);
    expect(document.evidenceText).toContain("It shall apply from 25 May 2018.");
    expect(document.evidenceText.length).toBeLessThanOrEqual(12_000);
    expect(document.overview.length).toBeLessThanOrEqual(2_400);
    expect(screen02RedirectedOverviewMatchesProposal(gdpr, url, document)).toBe(true);
  });

  it("does not import a synthetic recital obligation into the native enacting-text priority", async () => {
    const fake = "Every controller shall disclose unrelated private records under a fictional obligation.";
    const altered = body.replace(/<div\b[^>]*id="enc_1"[^>]*>/u, (opening) => `<p>${fake}</p>${opening}`);
    expect(altered).not.toBe(body);
    const document = await read(altered);
    expect(document.evidenceText).not.toContain(fake);
    expect(document.overview).not.toContain(fake);
    expect(document.overview).toContain("The controller shall be responsible");
  });

  it("does not prioritize an absence of duty over real modal obligations", async () => {
    const document = await read(body);
    expect(document.overview).not.toContain("the controller shall not be obliged to maintain");
    expect(document.overview).not.toContain("without prejudice to the application");
    expect(document.overview).not.toContain("Reference is made");
  });

  it("keeps an unrelated document unbound even when its body contains recognizable duties", async () => {
    const document = await read(body.replace('name="WT.z_docID" content="32016R0679"', 'name="WT.z_docID" content="32022R1925"'));
    expect(document.nativeIdentity).toBeUndefined();
    expect(document.nativeIdentityConflict).toBe(true);
    expect(screen02RedirectedOverviewMatchesProposal(gdpr, url, document)).toBe(false);
  });
});
