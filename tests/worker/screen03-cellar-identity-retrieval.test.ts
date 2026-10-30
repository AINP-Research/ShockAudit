import { describe, expect, it } from "vitest";

import { buildScreen02WorkflowHandoff } from "../../src/core/screen02-workflow-handoff";
import { requireScreen03ResearchPacket } from "../../src/core/screen03-workflow";
import type { Screen02ConnectorFetch } from "../../src/worker/screen02-connectors";
import {
  researchScreen03Evidence,
  SCREEN_03_RESEARCH_MAX_CALLS,
  SCREEN_03_RESEARCH_MAX_RESULTS_PER_CALL,
  SCREEN_03_DOCUMENT_MAX_OFFICIAL_TRANSPORT_BYTES,
  SCREEN_03_DOCUMENT_MAX_TOTAL_BYTES,
  type Screen03ResearchTelemetry,
} from "../../src/worker/screen03-evidence-service";
import { buildReadyFindState } from "../core/screen02-workflow-fixtures";

type OfficialRecord = { celex: string; title: string; date: string };

// Synthetic repository contents model official response fields. They are not
// observations of the live CELLAR service or evidence about a real legal record.
const selectedRecord: OfficialRecord = {
  celex: "32016R0679",
  title:
    "Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC (General Data Protection Regulation)",
  date: "2016-04-27",
};
const recentUnrelatedRecords: OfficialRecord[] = Array.from(
  { length: 8 },
  (_, index) => ({
    celex: `32023R${String(1000 + index).padStart(4, "0")}`,
    title: `Commission Regulation on unrelated agricultural category ${index + 1}`,
    date: `2023-01-${String(index + 1).padStart(2, "0")}`,
  }),
);

function queryAwareRepository(records: OfficialRecord[]) {
  const calls: Array<{ query: string; returnedIds: string[] }> = [];
  const fetch: Screen02ConnectorFetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname !== "publications.europa.eu") {
      // Deliberately unavailable document text prevents this test from proving
      // identity with invented HTML or promoting a derived citation to a field.
      return new Response("Document text unavailable in this fixture.", {
        status: 404,
      });
    }
    const query = url.searchParams.get("query") ?? "";
    const dates = [...query.matchAll(/"(\d{4}-\d{2}-\d{2})"\^\^xsd:date/gu)]
      .map((match) => match[1]!);
    const titleLiterals = [...query.matchAll(
      /CONTAINS\(LCASE\(STR\(\?title\)\), LCASE\(("(?:[^"\\]|\\.)*")\)\)/gu,
    )].map((match) => String(JSON.parse(match[1]!)).toLowerCase());
    const exactCelex = query.match(/FILTER\(STR\(\?celex\) = "(3\d{4}[RLD]\d{4})"\)/u)?.[1];
    const limit = Number(query.match(/\bLIMIT\s+(\d+)/u)?.[1]);
    expect(dates).toHaveLength(2);
    expect(titleLiterals.length > 0 || Boolean(exactCelex)).toBe(true);
    expect(query).toContain("ORDER BY DESC(?date)");
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(SCREEN_03_RESEARCH_MAX_RESULTS_PER_CALL);
    // Evaluate the actual producer's boolean title predicate, date filter,
    // ordering, and LIMIT. Never return the named event just because this is
    // an identity test: newer unrelated matches must consume their real slots.
    const disjunction = query.includes(" || ");
    const returned = records.filter((record) => {
      const matches = titleLiterals.map((term) =>
        record.title.toLowerCase().includes(term)
      );
      return record.date >= dates[0]! && record.date <= dates[1]! &&
        (exactCelex ? record.celex === exactCelex :
          disjunction ? matches.some(Boolean) : matches.every(Boolean));
    }).sort((left, right) => right.date.localeCompare(left.date)).slice(0, limit);
    calls.push({ query, returnedIds: returned.map((record) => record.celex) });
    return new Response(JSON.stringify({
      head: { vars: ["work", "celex", "title", "date", "type"] },
      results: {
        bindings: returned.map((record) => ({
          work: {
            type: "uri",
            value: `http://publications.europa.eu/resource/cellar/fixture-${record.celex}`,
          },
          celex: { type: "literal", value: record.celex },
          title: { type: "literal", "xml:lang": "en", value: record.title },
          date: {
            type: "literal",
            datatype: "http://www.w3.org/2001/XMLSchema#date",
            value: record.date,
          },
          type: {
            type: "uri",
            value: "http://publications.europa.eu/resource/authority/resource-type/REG",
          },
        })),
      },
    }), { headers: { "content-type": "application/sparql-results+json" } });
  };
  return { fetch, calls };
}

async function research(records: OfficialRecord[]) {
  const repository = queryAwareRepository(records);
  const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
    handoff: buildScreen02WorkflowHandoff(
      buildReadyFindState(),
      "0.4.04",
      "2026-08-12T15:59:00.000Z",
    ),
    fetch: repository.fetch,
    retrievedAt: "2026-08-12T16:00:00.000Z",
  }));
  expect(repository.calls.length).toBeGreaterThan(0);
  expect(repository.calls.length).toBeLessThanOrEqual(SCREEN_03_RESEARCH_MAX_CALLS);
  return { packet, repository };
}

describe("Screen 3 CELLAR selected instrument retrieval", () => {
  it("retains an exact identity passage when a long legal text has many stage-rich sections", async () => {
    const heading = "<h1>General Data Protection Regulation</h1>" +
      "<p>Regulation (EU) 2016/679 protects natural persons with regard to processing personal data.</p>";
    const sections = [
      "The authority announced consultation and proposal publication before adoption and enactment of the final rule.",
      "Application and commencement take effect on 2018-05-25, when the operative implementation and compliance deadline begins.",
      "Enforcement, inspection, sanction, and penalty provisions include exemption and threshold rules for covered businesses.",
      "Amendment, delay, extension, repeal, and postponement provisions require separate review of subsequent measures.",
    ].map((text) => "<p>" + ("Further official provisions establish detailed procedural requirements. ".repeat(30)) + text.repeat(5) + "</p>").join("");
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: buildScreen02WorkflowHandoff(buildReadyFindState(), "0.4.04", "2026-08-12T15:59:00.000Z"),
      fetch: async (input) => new URL(String(input)).hostname === "publications.europa.eu"
        ? new Response(JSON.stringify({ results: { bindings: [] } }), { headers: { "content-type": "application/json" } })
        : new Response(`<main>${heading}${sections}</main>`, { headers: { "content-type": "text/html" } }),
      retrievedAt: "2026-08-12T16:00:00.000Z",
    }));
    expect(packet.proposals.identity.find((proposal) => proposal.label === "Formal identifier")?.support).toBe("direct");
    expect(packet.evidence.flatMap((item) => item.passages).filter((passage) => passage.basis === "official-document-passage").length).toBeLessThanOrEqual(4);
  });

  it("reads a large official HTML representation without expanding retained passage bounds", async () => {
    const substantive = "<main><h1>General Data Protection Regulation</h1>" +
      "<p>Regulation (EU) 2016/679 protects natural persons with regard to processing personal data.</p></main>";
    const body = "<!--" + "x".repeat(1_069_265 - substantive.length - 7) + "-->" + substantive;
    expect(new TextEncoder().encode(body).byteLength).toBe(1_069_265);
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: buildScreen02WorkflowHandoff(buildReadyFindState(), "0.4.04", "2026-08-12T15:59:00.000Z"),
      fetch: async (input) => new URL(String(input)).hostname === "publications.europa.eu"
        ? new Response(JSON.stringify({ results: { bindings: [] } }), { headers: { "content-type": "application/json" } })
        : new Response(body, { headers: { "content-type": "text/html", "content-length": String(body.length) } }),
      retrievedAt: "2026-08-12T16:00:00.000Z",
    }));
    expect(packet.proposals.identity.find((proposal) => proposal.label === "Formal identifier")?.support).toBe("direct");
    expect(packet.evidence.flatMap((item) => item.passages).length).toBeLessThanOrEqual(60);
    expect(JSON.stringify(packet).length).toBeLessThan(100_000);
  });

  it("retains the exact raw identifier when the official query returns it", async () => {
    const { packet } = await research([selectedRecord]);
    expect(packet.evidence.flatMap((item) => item.passages)).toContainEqual(
      expect.objectContaining({
        text: selectedRecord.celex,
        basis: "official-record-field",
        officialField: "formal-identifier",
      }),
    );
  });

  it("keeps bounded stage discovery available when the exact lookup fails", async () => {
    const repository = queryAwareRepository([selectedRecord]);
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: buildScreen02WorkflowHandoff(buildReadyFindState(), "0.4.04", "2026-08-12T15:59:00.000Z"),
      fetch: async (input, init) => {
        const query = new URL(String(input)).searchParams.get("query") ?? "";
        return query.includes('FILTER(STR(?celex) = "32016R0679")')
          ? new Response("Exact lookup unavailable.", { status: 503 })
          : repository.fetch(input, init);
      },
      retrievedAt: "2026-08-12T16:00:00.000Z",
    }));
    expect(repository.calls).toHaveLength(SCREEN_03_RESEARCH_MAX_CALLS - 1);
    expect(packet.coverage.channels.some((channel) => channel.status === "failed")).toBe(true);
    expect(packet.evidence.flatMap((item) => item.passages)).toContainEqual(expect.objectContaining({
      text: selectedRecord.celex,
      basis: "official-record-field",
      officialField: "formal-identifier",
    }));
  });

  it("enforces the cumulative body budget across concurrent official representations", async () => {
    const repository = queryAwareRepository([selectedRecord]);
    const substantive = "<main><h1>General Data Protection Regulation</h1>" +
      "<p>Regulation (EU) 2016/679 protects natural persons with regard to processing personal data.</p></main>";
    const body = "<!--" + "x".repeat(700_000 - substantive.length - 7) + "-->" + substantive;
    const telemetry: Screen03ResearchTelemetry[] = [];
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: buildScreen02WorkflowHandoff(buildReadyFindState(), "0.4.04", "2026-08-12T15:59:00.000Z"),
      fetch: async (input, init) => new URL(String(input)).hostname === "publications.europa.eu"
        ? repository.fetch(input, init)
        : new Response(body, { headers: { "content-type": "text/html" } }),
      retrievedAt: "2026-08-12T16:00:00.000Z",
      onTelemetry: (value) => { telemetry.push(value); },
    }));
    expect(telemetry[0]?.documentAttempts).toBeGreaterThan(1);
    expect(telemetry[0]?.documentBytesRead).toBe(700_000);
    expect(telemetry[0]!.documentBytesRead).toBeLessThanOrEqual(SCREEN_03_DOCUMENT_MAX_TOTAL_BYTES);
    expect(packet.coverage.gaps.join(" ")).toContain("fixed cumulative document-byte limit");
    expect(packet.proposals.identity.find((proposal) => proposal.label === "Formal identifier")?.support).toBe("direct");
  });

  it("rejects an official representation declared above its transport ceiling", async () => {
    const packet = requireScreen03ResearchPacket(await researchScreen03Evidence({
      handoff: buildScreen02WorkflowHandoff(buildReadyFindState(), "0.4.04", "2026-08-12T15:59:00.000Z"),
      fetch: async (input) => new URL(String(input)).hostname === "publications.europa.eu"
        ? new Response(JSON.stringify({ results: { bindings: [] } }), { headers: { "content-type": "application/json" } })
        : new Response("No accepted document body.", {
          headers: { "content-type": "text/html", "content-length": String(SCREEN_03_DOCUMENT_MAX_OFFICIAL_TRANSPORT_BYTES + 1) },
        }),
      retrievedAt: "2026-08-12T16:00:00.000Z",
    }));
    expect(packet.coverage.gaps.join(" ")).toContain("fixed response-size limit");
    expect(packet.proposals.identity.every((proposal) => proposal.support !== "direct")).toBe(true);
  });

  it("retrieves the selected older instrument despite newer partial-title matches", async () => {
    const { packet, repository } = await research([
      selectedRecord,
      ...recentUnrelatedRecords,
    ]);
    expect(
      packet.evidence.flatMap((item) => item.passages),
      `Actual bounded connector queries and returned identifiers: ${JSON.stringify(repository.calls)}`,
    ).toContainEqual(expect.objectContaining({
      text: selectedRecord.celex,
      basis: "official-record-field",
      officialField: "formal-identifier",
    }));
  });
});
