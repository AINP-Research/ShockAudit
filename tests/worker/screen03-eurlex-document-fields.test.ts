import { describe, expect, it } from "vitest";

import {
  buildScreen02WorkflowHandoff,
  serializeScreen02WorkflowHandoff,
  type Screen02WorkflowHandoff,
} from "../../src/core/screen02-workflow-handoff";
import { fingerprintScreen02WorkflowValue } from "../../src/core/screen02-workflow-state";
import {
  applyScreen03Action,
  buildScreen03StateFromResearch,
  requireScreen03ResearchPacket,
  screen03ProposalConfirmability,
} from "../../src/core/screen03-workflow";
import {
  researchScreen03Evidence,
  SCREEN_03_DOCUMENT_MAX_EXCERPTS,
  SCREEN_03_DOCUMENT_MAX_TOTAL_BYTES,
  SCREEN_03_RESEARCH_MAX_PASSAGES,
} from "../../src/worker/screen03-evidence-service";
import {
  euOfficialDocumentRepresentationLocators,
  euPublicationsLocatorRecordId,
  readEuPublicationsDocumentIdentity,
} from "../../src/worker/official-document-html";
import { buildReadyFindState } from "../core/screen02-workflow-fixtures";

// Whitespace-normalized metadata/title excerpts from the EUR-Lex response
// captured on 2026-09-06, SHA-256
// 1f3d70cfc94ff30cd1821aa2e40ed6359861c20aa143ada4767ebfd1e96c1d6d.
// This bounded excerpt is not represented as the complete legal document.
const locator = "https://eur-lex.europa.eu/eli/reg/2016/679/oj";
const metadataTitle = "Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation) (Text with EEA relevance)";
const metadata = `<meta name="WT.z_docID" content="32016R0679"/><meta about="http://data.europa.eu/eli/reg/2016/679/oj/eng" property="eli:title" content="${metadataTitle}" lang="en"/>`;
const ownTitle = `<div class="eli-main-title"><p>REGULATION (EU) 2016/679 OF THE EUROPEAN PARLIAMENT AND OF THE COUNCIL</p><p>of 27 April 2016</p><p>on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation)</p><p>(Text with EEA relevance)</p></div>`;
const body = () => `<!doctype html><html lang="en"><head><title>Regulation - 2016/679 - EN - EUR-Lex</title>${metadata}</head><body><div class="eli-container">${ownTitle}<p>It shall apply from 25 May 2018.</p></div></body></html>`;
const at = "2026-09-06T16:00:00.000Z";

function handoff() {
  const selected = structuredClone(buildScreen02WorkflowHandoff(
    buildReadyFindState(), "0.4.06", "2026-09-06T15:59:00.000Z",
  ));
  selected.sources = selected.sources.map((source) => {
    const { sourceFingerprint: _old, ...sourceInput } = source;
    const changed = { ...sourceInput, locator };
    return { ...changed, sourceFingerprint: fingerprintScreen02WorkflowValue(changed) };
  });
  return reseal(selected);
}

function reseal(selected: Screen02WorkflowHandoff) {
  selected.integrity.eventFingerprint = fingerprintScreen02WorkflowValue(selected.event);
  const { handoffFingerprint: _previous, ...integrity } = selected.integrity;
  selected.integrity.handoffFingerprint = fingerprintScreen02WorkflowValue({ ...selected, integrity });
  return JSON.parse(serializeScreen02WorkflowHandoff(selected)) as Screen02WorkflowHandoff;
}

async function research(html = body(), selected = handoff(), redirectTo?: string) {
  const calls: string[] = [];
  const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
    handoff: selected,
    retrievedAt: at,
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      if (new URL(url).hostname === "publications.europa.eu") {
        return new Response("Official connector unavailable in this replay.", { status: 503 });
      }
      if (redirectTo && url === locator) {
        return new Response(null, { status: 302, headers: { location: redirectTo } });
      }
      return new Response(html, { headers: { "content-type": "text/html; charset=UTF-8" } });
    },
  }));
  return { packet, selected, calls };
}

describe("Screen 3 source-native ELI title fields", () => {
  it("rejects a 200 access challenge and retains the exact CELEX fallback locator alongside the original source", async () => {
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    const challenge =
      '<html><head><title>Just a moment</title></head><body><div id="cf-chl-widget">Enable JavaScript and cookies to continue while we verify that you are human.</div></body></html>';
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: handoff(),
      retrievedAt: at,
      fetch: async (input, init) => {
        const url = new URL(String(input));
        calls.push({ url, init });
        if (url.hostname === "publications.europa.eu") {
          return new Response("Official connector unavailable in this replay.", { status: 503 });
        }
        if (url.toString() === locator) {
          return new Response(challenge, {
            headers: { "content-type": "text/html; charset=UTF-8" },
          });
        }
        if (url.pathname === "/legal-content/EN/TXT/HTML/" &&
          url.searchParams.get("uri") === "CELEX:32016R0679") {
          return new Response(body(), {
            headers: { "content-type": "text/html; charset=UTF-8" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    }));

    const fallbackLocator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32016R0679";
    const evidence = packet.evidence.find((item) =>
      item.channel.includes("exact alternate representation")
    )!;
    expect(evidence.locator).toBe(fallbackLocator);
    expect(evidence.passages).toContainEqual(expect.objectContaining({
      basis: "official-document-passage",
      locator: fallbackLocator,
    }));
    expect(evidence.passages).toContainEqual(expect.objectContaining({
      basis: "source-metadata",
      locator,
      text: expect.stringContaining(fallbackLocator),
    }));
    const fallback = calls.find(({ url }) =>
      url.pathname === "/legal-content/EN/TXT/HTML/" &&
      url.searchParams.get("uri") === "CELEX:32016R0679"
    );
    expect(fallback).toBeDefined();
    expect(new Headers(fallback?.init?.headers).get("user-agent")).toMatch(
      /^ShockAudit research-design tool/u,
    );
    expect(packet.coverage.gaps.join(" ")).toMatch(/access-control challenge/i);
  });

  it("rejects a wrong-ID original body before using the exact-record fallback", async () => {
    const calls: URL[] = [];
    const wrongBody = body()
      .replaceAll("32016R0679", "32022R1925")
      .replaceAll("2016/679", "2022/1925")
      .replace(
        "It shall apply from 25 May 2018.",
        "Wrong-record-only passage must never be admitted.",
      );
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: handoff(),
      retrievedAt: at,
      fetch: async (input) => {
        const url = new URL(String(input));
        calls.push(url);
        if (url.hostname === "publications.europa.eu") {
          return new Response("Official connector unavailable in this replay.", {
            status: 503,
          });
        }
        if (url.toString() === locator) {
          return new Response(wrongBody, {
            headers: { "content-type": "text/html; charset=UTF-8" },
          });
        }
        if (
          url.pathname === "/legal-content/EN/TXT/HTML/" &&
          url.searchParams.get("uri") === "CELEX:32016R0679"
        ) {
          return new Response(body(), {
            headers: { "content-type": "text/html; charset=UTF-8" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    }));

    const fallbackLocator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32016R0679";
    const evidence = packet.evidence.find((item) =>
      item.locator === fallbackLocator
    )!;
    expect(evidence.passages).toContainEqual(expect.objectContaining({
      basis: "official-document-passage",
      locator: fallbackLocator,
      text: expect.stringContaining("It shall apply from 25 May 2018"),
    }));
    expect(packet.evidence.flatMap((item) => item.passages)
      .map((passage) => passage.text).join(" "))
      .not.toContain("Wrong-record-only passage");
    expect(calls.some((url) =>
      url.pathname === "/legal-content/EN/TXT/HTML/" &&
      url.searchParams.get("uri") === "CELEX:32016R0679"
    )).toBe(true);
    expect(packet.coverage.gaps.join(" ")).toMatch(/exact CELEX identity/i);
  });

  it("rejects wrong-record converted PDF text before using the exact HTML fallback", async () => {
    const pdfLocator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016R0679";
    const selected = structuredClone(handoff());
    selected.sources = selected.sources.map((source) => {
      const { sourceFingerprint: _old, ...sourceInput } = source;
      const changed = { ...sourceInput, locator: pdfLocator };
      return {
        ...changed,
        sourceFingerprint: fingerprintScreen02WorkflowValue(changed),
      };
    });
    const calls: URL[] = [];
    let converterCalls = 0;
    const fakePdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj<</Type /Page>>endobj\n%%EOF",
    );
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: reseal(selected),
      retrievedAt: at,
      fetch: async (input) => {
        const url = new URL(String(input));
        calls.push(url);
        if (url.pathname === "/webapi/rdf/sparql") {
          return new Response("Official connector unavailable in this replay.", {
            status: 503,
          });
        }
        if (url.toString() === pdfLocator) {
          return new Response(fakePdf, {
            headers: { "content-type": "application/pdf" },
          });
        }
        if (
          url.pathname === "/legal-content/EN/TXT/HTML/" &&
          url.searchParams.get("uri") === "CELEX:32016R0679"
        ) {
          return new Response(body(), {
            headers: { "content-type": "text/html; charset=UTF-8" },
          });
        }
        return new Response("not found", { status: 404 });
      },
      convertDocument: async () => {
        converterCalls += 1;
        return {
          text:
            "Regulation (EU) 2022/1925. General Data Protection Regulation. Wrong-record PDF passage must never be admitted. It shall apply from 25 May 2018.",
        };
      },
    }));

    const fallbackLocator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32016R0679";
    expect(converterCalls).toBe(1);
    expect(calls.some((url) => url.toString() === pdfLocator)).toBe(true);
    expect(calls.some((url) => url.toString() === fallbackLocator)).toBe(true);
    expect(packet.evidence.flatMap((item) => item.passages)
      .map((passage) => passage.text).join(" "))
      .not.toContain("Wrong-record PDF passage");
    expect(packet.evidence.find((item) => item.locator === fallbackLocator)
      ?.passages).toContainEqual(expect.objectContaining({
        basis: "official-document-passage",
        locator: fallbackLocator,
        text: expect.stringContaining("It shall apply from 25 May 2018"),
      }));
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /converted EU official PDF.+exact CELEX identity/i,
    );
  });

  it("uses the exact HTML fallback when CELEX PDF conversion is unavailable", async () => {
    const pdfLocator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016R0679";
    const selected = structuredClone(handoff());
    selected.sources = selected.sources.map((source) => {
      const { sourceFingerprint: _old, ...sourceInput } = source;
      const changed = { ...sourceInput, locator: pdfLocator };
      return {
        ...changed,
        sourceFingerprint: fingerprintScreen02WorkflowValue(changed),
      };
    });
    const calls: URL[] = [];
    const fakePdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj<</Type /Page>>endobj\n%%EOF",
    );
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: reseal(selected),
      retrievedAt: at,
      fetch: async (input) => {
        const url = new URL(String(input));
        calls.push(url);
        if (url.pathname === "/webapi/rdf/sparql") {
          return new Response("Official connector unavailable in this replay.", {
            status: 503,
          });
        }
        if (url.toString() === pdfLocator) {
          return new Response(fakePdf, {
            headers: { "content-type": "application/pdf" },
          });
        }
        if (
          url.pathname === "/legal-content/EN/TXT/HTML/" &&
          url.searchParams.get("uri") === "CELEX:32016R0679"
        ) {
          return new Response(body(), {
            headers: { "content-type": "text/html; charset=UTF-8" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    }));

    const fallbackLocator =
      "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32016R0679";
    expect(calls.some((url) => url.toString() === pdfLocator)).toBe(true);
    expect(calls.some((url) => url.toString() === fallbackLocator)).toBe(true);
    expect(packet.evidence.find((item) => item.locator === fallbackLocator)
      ?.passages).toContainEqual(expect.objectContaining({
        basis: "official-document-passage",
        locator: fallbackLocator,
        text: expect.stringContaining("It shall apply from 25 May 2018"),
      }));
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /PDF.+conversion was unavailable/i,
    );
  });

  it("accepts every supported Publications language suffix, including a non-English fallback", () => {
    for (const language of [
      "BUL", "HRV", "CES", "DAN", "NLD", "ENG", "EST", "FIN", "FRA",
      "DEU", "ELL", "HUN", "GLE", "ITA", "LAV", "LIT", "MLT", "POL",
      "POR", "RON", "SLK", "SLV", "SPA", "SWE",
    ]) {
      expect(euPublicationsLocatorRecordId(
        `https://publications.europa.eu/resource/celex/32016R0679.${language}`,
      )).toBe("32016R0679");
    }
    expect(euPublicationsLocatorRecordId(
      "https://publications.europa.eu/resource/celex/32016R0679.ZZZ",
    )).toBeNull();
    expect(euOfficialDocumentRepresentationLocators(
      "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679",
    )).toContain(
      "https://publications.europa.eu/resource/celex/32016R0679.FRA",
    );
    const frenchTitle =
      "RÈGLEMENT (UE) 2016/679 DU PARLEMENT EUROPÉEN ET DU CONSEIL";
    const frenchBody = `<!doctype html><html lang="fr"><head>
      <meta name="WT.z_docID" content="32016R0679"/>
      <meta about="http://data.europa.eu/eli/reg/2016/679/oj/fra" property="eli:title" content="${frenchTitle}" lang="fr"/>
      </head><body><div class="eli-container"><div class="eli-main-title">${frenchTitle}</div></div></body></html>`;
    expect(readEuPublicationsDocumentIdentity(
      frenchBody,
      "https://publications.europa.eu/resource/celex/32016R0679.FRA",
    )).toMatchObject({ recordId: "32016R0679", title: frenchTitle });
  });

  it("securely upgrades the documented same-host CELLAR redirect and preserves its locator alongside the original source", async () => {
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    const challenge =
      '<html><head><title>Access denied</title></head><body><div class="challenge-platform">Enable JavaScript and cookies to continue while we verify that you are human.</div></body></html>';
    const cellarPath =
      "/resource/cellar/3e485e15-11bd-11e6-ba9a-01aa75ed71a1.0006.03/DOC_1";
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: handoff(),
      retrievedAt: at,
      fetch: async (input, init) => {
        const url = new URL(String(input));
        calls.push({ url, init });
        if (url.pathname === "/webapi/rdf/sparql") {
          return new Response("Official connector unavailable in this replay.", { status: 503 });
        }
        if (url.toString() === locator) {
          return new Response(challenge, {
            headers: { "content-type": "text/html; charset=UTF-8" },
          });
        }
        if (url.hostname === "eur-lex.europa.eu") {
          return new Response("upstream unavailable", { status: 503 });
        }
        if (url.pathname === "/resource/celex/32016R0679.ENG") {
          return new Response(null, {
            status: 303,
            headers: {
              location: `http://publications.europa.eu${cellarPath}`,
              "content-type": "application/xhtml+xml",
            },
          });
        }
        if (url.pathname === cellarPath) {
          return new Response(body(), {
            headers: { "content-type": "application/xhtml+xml; charset=UTF-8" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    }));

    const resolvedLocator = `https://publications.europa.eu${cellarPath}`;
    const evidence = packet.evidence.find((item) =>
      item.locator === resolvedLocator
    )!;
    expect(evidence.passages).toContainEqual(expect.objectContaining({
      basis: "official-document-passage",
      locator: resolvedLocator,
    }));
    expect(evidence.passages).toContainEqual(expect.objectContaining({
      basis: "source-metadata",
      locator,
      text: expect.stringContaining(resolvedLocator),
    }));
    const publicationsCalls = calls.filter(({ url }) =>
      url.pathname === "/resource/celex/32016R0679.ENG" ||
      url.pathname === cellarPath
    );
    expect(publicationsCalls.map(({ url }) => url.toString())).toEqual([
      "https://publications.europa.eu/resource/celex/32016R0679.ENG",
      resolvedLocator,
    ]);
    for (const { init } of publicationsCalls) {
      const headers = new Headers(init?.headers);
      expect(headers.get("accept")).toBe("application/xhtml+xml");
      expect(headers.get("accept-language")).toBe("eng");
      expect(headers.get("accept-max-cs-size")).toBe("2097152");
      expect(init?.redirect).toBe("manual");
    }
  });

  it("rejects a Publications fallback redirect to another reviewed host before fetching it", async () => {
    const calls: URL[] = [];
    const escapedLocator =
      "https://www.reuters.com/world/europe/not-the-selected-eu-record/";
    const challenge =
      '<html><head><title>Just a moment</title></head><body><div id="cf-chl-widget">Enable JavaScript and cookies to continue while we verify that you are human.</div></body></html>';
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: handoff(),
      retrievedAt: at,
      fetch: async (input) => {
        const url = new URL(String(input));
        calls.push(url);
        if (url.pathname === "/webapi/rdf/sparql") {
          return new Response("Official connector unavailable in this replay.", {
            status: 503,
          });
        }
        if (url.toString() === locator) {
          return new Response(challenge, {
            headers: { "content-type": "text/html; charset=UTF-8" },
          });
        }
        if (url.hostname === "eur-lex.europa.eu") {
          return new Response("upstream unavailable", { status: 503 });
        }
        if (url.pathname === "/resource/celex/32016R0679.ENG") {
          return new Response(null, {
            status: 303,
            headers: { location: escapedLocator },
          });
        }
        if (url.toString() === escapedLocator) {
          return new Response(body(), {
            headers: { "content-type": "application/xhtml+xml" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    }));

    expect(calls.some((url) =>
      url.pathname === "/resource/celex/32016R0679.ENG"
    )).toBe(true);
    expect(calls.some((url) => url.toString() === escapedLocator)).toBe(false);
    expect(packet.evidence.some((item) => item.locator === escapedLocator))
      .toBe(false);
    expect(packet.coverage.gaps.join(" ")).toMatch(
      /redirected outside its reviewed HTTPS source policy/i,
    );
  });

  it("retains the exact returned title field and direct passages when CELLAR is unavailable", async () => {
    const { packet, selected, calls } = await research();
    const evidence = packet.evidence.find((item) => item.locator === locator)!;
    const field = evidence.passages.find((passage) => passage.basis === "official-record-field")!;
    expect(field).toMatchObject({ text: metadataTitle, officialField: "canonical-title", locator });
    expect(evidence.passages.filter((passage) => passage.basis === "official-record-field")).toHaveLength(1);
    const title = packet.proposals.identity.find((proposal) => proposal.label === "Canonical event title")!;
    expect(title).toMatchObject({ value: "General Data Protection Regulation", support: "direct" });
    expect(title.passageIds).toContain(field.id);
    expect(screen03ProposalConfirmability(title, packet.evidence)).toEqual({ confirmable: true, reason: "confirmable" });

    const formal = packet.proposals.identity.find((proposal) => proposal.label === "Formal identifier")!;
    expect(formal).toMatchObject({ value: "Regulation (EU) 2016/679", support: "direct" });
    expect(formal.passageIds).not.toContain(field.id);
    expect(screen03ProposalConfirmability({ ...formal, passageIds: [field.id] }, packet.evidence).confirmable).toBe(false);
    expect(evidence.passages.some((passage) => passage.basis === "official-document-passage")).toBe(true);
    expect(evidence.passages.filter((passage) => passage.basis === "official-document-passage").length).toBeLessThanOrEqual(SCREEN_03_DOCUMENT_MAX_EXCERPTS);
    expect(packet.evidence.flatMap((item) => item.passages).length).toBeLessThanOrEqual(SCREEN_03_RESEARCH_MAX_PASSAGES);
    expect(new TextEncoder().encode(body()).byteLength).toBeLessThan(SCREEN_03_DOCUMENT_MAX_TOTAL_BYTES);
    expect(calls.filter((url) => new URL(url).hostname === "publications.europa.eu")).toHaveLength(6);

    const state = buildScreen03StateFromResearch(selected, packet, "2026-09-06T16:00:01.000Z");
    const accepted = applyScreen03Action(state, {
      type: "review-field", proposalId: title.id, decision: "accept",
      reason: "Automated direct field confirmation regression.", at: "2026-09-06T16:00:02.000Z",
    });
    expect(accepted.proposals.identity.find((proposal) => proposal.id === title.id)?.reviewStatus).toBe("accepted");
  });

  it("retains the title field alongside four document excerpts under the existing cap", async () => {
    // Synthetic stage-rich padding exercises slot pressure, not legal facts.
    const stages = [
      "The authority announced consultation and proposal publication before adoption and enactment of the final rule.",
      "Application and commencement take effect on 2018-05-25 when the operative implementation deadline begins.",
      "Enforcement and penalty provisions include exemption and threshold rules for covered businesses.",
      "Amendment, delay, extension, repeal and postponement provisions require review of later measures.",
    ].map((stage) => `<p>${"Further procedural details require independent review. ".repeat(35)}${stage.repeat(5)}</p>`).join("");
    const { packet } = await research(body().replace(ownTitle, ownTitle + stages));
    const passages = packet.evidence.flatMap((item) => item.passages);
    expect(passages.filter((passage) => passage.basis === "official-document-passage")).toHaveLength(4);
    expect(passages).toContainEqual(expect.objectContaining({ text: metadataTitle, basis: "official-record-field", officialField: "canonical-title" }));
    expect(passages.length).toBeLessThanOrEqual(SCREEN_03_RESEARCH_MAX_PASSAGES);
  });

  it("does not turn nested or presentation-hidden official HTML into Screen 3 passages", async () => {
    const hidden =
      `<section hidden><section>Regulation (EU) 2016/679 secretly requires ` +
      `every firm to transfer all data.</section>Outer hidden tail says it ` +
      `applies from 1 January 2010.</section>` +
      `<div style=display:none>Unquoted hidden enforcement begins in 2011.</div>` +
      `<div aria-hidden=true>Unquoted aria-hidden penalty is mandatory.</div>` +
      `<dialog>Closed dialog claims universal coverage.</dialog>` +
      `<details>Closed details claim immediate application.</details>` +
      `<template>Template-only instruction invents an exemption.</template>`;
    const { packet } = await research(
      body().replace("</div></body></html>", `${hidden}</div></body></html>`),
    );
    const retained = packet.evidence.flatMap((item) => item.passages)
      .map((passage) => passage.text).join(" ");
    expect(retained).not.toMatch(
      /secretly requires|Outer hidden tail|Unquoted hidden|aria-hidden penalty|Closed dialog|Closed details|Template-only/iu,
    );
  });

  it.each([
    ["wrong WT document ID", (html: string) => html.replace('name="WT.z_docID" content="32016R0679"', 'name="WT.z_docID" content="32022R1925"')],
    ["contradictory own title", (html: string) => html.replace("REGULATION (EU) 2016/679 OF", "REGULATION (EU) 2022/1925 OF")],
    ["contradictory metadata title", (html: string) => html.replace('property="eli:title" content="Regulation (EU) 2016/679', 'property="eli:title" content="Regulation (EU) 2022/1925')],
    ["same identifier with a conflicting metadata name", (html: string) => html.replace(`content="${metadataTitle}"`, `content="${metadataTitle.replace("General Data Protection Regulation", "Unrelated Instrument")}"`)],
    ["conflicting duplicate WT IDs", (html: string) => html.replace("</head>", '<meta name="WT.z_docID" content="32022R1925"/></head>')],
    ["conflicting duplicate title fields", (html: string) => html.replace("</head>", `<meta about="http://data.europa.eu/eli/reg/2016/679/oj/eng" property="eli:title" content="Regulation (EU) 2022/1925 on digital markets" lang="en"/></head>`)],
    ["metadata without a visible own title", (html: string) => html.replace(ownTitle, "<p>The source index mentions General Data Protection Regulation.</p>")],
    ["visible title without native metadata", (html: string) => html.replace(metadata, "")],
    ["native fields only inside a comment", (html: string) => html.replace(metadata, `<!--${metadata}-->`)],
  ])("does not upgrade %s into an official field", async (_label, mutate) => {
    const { packet } = await research(mutate(body()));
    expect(packet.evidence.flatMap((item) => item.passages).some((passage) => passage.basis === "official-record-field")).toBe(false);
  });

  it("binds the field to both requested and resolved native identities", async () => {
    const correct = await research(body(), handoff(), "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679");
    expect(correct.packet.evidence.flatMap((item) => item.passages)).toContainEqual(expect.objectContaining({ text: metadataTitle, officialField: "canonical-title" }));
    const wrong = await research(body(), handoff(), "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R1925");
    expect(wrong.packet.evidence.flatMap((item) => item.passages)).toContainEqual(
      expect.objectContaining({ text: metadataTitle, officialField: "canonical-title" }),
    );
    expect(wrong.calls.some((value) =>
      new URL(value).pathname === "/legal-content/EN/TXT/HTML/" &&
      new URL(value).searchParams.get("uri") === "CELEX:32016R0679"
    )).toBe(true);
    expect(wrong.packet.coverage.gaps.join(" ")).toMatch(/exact CELEX identity/i);
  });

  it("does not truncate a long scalar title into purported exact official evidence", async () => {
    const longTitle = metadataTitle + " Additional source-native title detail".repeat(50);
    const html = body().replace(`content="${metadataTitle}"`, `content="${longTitle}"`)
      .replace(ownTitle, `<div class="eli-main-title">${longTitle}</div>`);
    const { packet } = await research(html);
    expect(packet.evidence.flatMap((item) => item.passages).some((passage) => passage.basis === "official-record-field")).toBe(false);
  });

  it("retains the researcher origin while admitting an independently fetched identity-bound official record", async () => {
    const selected = structuredClone(handoff());
    selected.sources = selected.sources.map((source) => {
      const { sourceFingerprint: _old, ...sourceInput } = source;
      const changed = { ...sourceInput, authorityTier: 6 as const, userProvided: true, channel: "researcher-provided-url" };
      return { ...changed, sourceFingerprint: fingerprintScreen02WorkflowValue(changed) };
    });
    const { packet } = await research(body(), reseal(selected));
    const evidence = packet.evidence.find(
      (item) => item.sourceId === selected.sources[0]!.id,
    );
    expect(selected.sources[0]).toMatchObject({
      authorityTier: 6,
      userProvided: true,
      channel: "researcher-provided-url",
    });
    expect(evidence).toMatchObject({
      authorityTier: 1,
      sourceRole: "controlling-legal-record",
      sourcePlatform: "eur-lex",
      publisher: "eur-lex.europa.eu",
      status: "retrieved",
    });
    expect(evidence?.channel).toMatch(/guarded official-document retrieval/i);
    expect(evidence?.passages).toEqual(expect.arrayContaining([
      expect.objectContaining({ basis: "official-document-passage" }),
      expect.objectContaining({
        basis: "source-metadata",
        text: expect.stringMatching(/researcher supplied this locator/i),
      }),
    ]));
    expect(packet.proposals.identity.some(
      (proposal) => proposal.support === "direct",
    )).toBe(true);
  });

  it("does not promote a different exact CELEX record that mentions the selected instrument", async () => {
    const selected = structuredClone(handoff());
    selected.sources = selected.sources.map((source) => {
      const { sourceFingerprint: _old, ...sourceInput } = source;
      const changed = {
        ...sourceInput,
        authorityTier: 6 as const,
        userProvided: true,
        channel: "researcher-provided-url",
      };
      return {
        ...changed,
        sourceFingerprint: fingerprintScreen02WorkflowValue(changed),
      };
    });
    selected.event.identity = {
      canonicalTitle: "Digital Markets Act",
      commonNames: ["DMA"],
      formalIdentifier: "Regulation (EU) 2022/1925",
      issuer: "European Parliament and Council",
      issuingJurisdiction: "European Union",
      eventType: "Regulation",
      status: "In force",
    };
    selected.event.description = {
      ...selected.event.description,
      text: "The Digital Markets Act is the selected instrument.",
    };
    const html = body().replace(
      "</div></body></html>",
      "<p>This record cross-references Regulation (EU) 2022/1925, the Digital Markets Act.</p></div></body></html>",
    );
    const { packet } = await research(html, reseal(selected));
    const evidence = packet.evidence.find(
      (item) => item.sourceId === selected.sources[0]!.id,
    );

    expect(evidence).toMatchObject({
      authorityTier: 6,
      sourceRole: "researcher-supplied-record",
      sourcePlatform: "researcher-supplied",
    });
    expect(evidence?.passages.every((passage) =>
      passage.basis !== "official-document-passage" &&
      passage.basis !== "official-record-field"
    )).toBe(true);
  });
});
