import { describe, expect, it, vi } from "vitest";

import {
  requestScreen2PolicySourceDiscovery,
} from "../../src/worker/screen2-openai-policy-source-discovery";

function responsePayload() {
  return {
    id: "resp_policy_source_discovery",
    model: "gpt-6-luna",
    service_tier: "default",
    status: "completed",
    usage: {
      input_tokens: 120,
      output_tokens: 80,
      total_tokens: 200,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 20 },
    },
    output: [
      {
        type: "web_search_call",
        id: "search_1",
        status: "completed",
        action: {
          type: "search",
          query: "California Silenced No More Act SB 331 coverage",
          sources: [
            {
              type: "url",
              url: "https://policy.example.org/silenced-no-more?utm_source=test",
            },
            {
              type: "url",
              url: "http://insecure.example.org/ignored",
            },
            {
              type: "url",
              url: "https://documents.example.org/fact-sheet.pdf",
            },
          ],
        },
      },
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{
          type: "output_text",
          text:
            "A model-only URL such as https://uncited.example.org/must-not-pass is ignored.",
          annotations: [{
            type: "url_citation",
            url: "https://analysis.example.edu/california-sb-331",
            title: "California SB 331 analysis",
            start_index: 0,
            end_index: 12,
          }],
        }],
      },
    ],
  };
}

describe("Screen 2 OpenAI policy source discovery", () => {
  it("uses required web search and retains only tool-provided cited URLs", async () => {
    const onDispatch = vi.fn(async () => undefined);
    const onReceipt = vi.fn(async () => undefined);
    const fetch = vi.fn(async (_request: RequestInfo | URL,
      init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "gpt-6-luna",
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        tools: [{ type: "web_search", search_context_size: "medium" }],
        store: false,
        stream: false,
      });
      return new Response(JSON.stringify(responsePayload()), {
        headers: { "content-type": "application/json" },
      });
    });

    const result = await requestScreen2PolicySourceDiscovery({
      apiKey: "test-key-never-sent-outside-this-mock",
      fetch,
      request: {
        officialTitle: "California Silenced No More Act",
        aliases: ["Silenced No More Act"],
        formalIdentifiers: ["SB 331", "Chapter 638, Statutes of 2021"],
        issuer: "California Legislature",
        jurisdiction: "California, United States",
        instrumentType: "state legislation",
        dateHints: ["2021-10-07", "2022-01-01"],
        missingSections: ["what_changed", "coverage"],
      },
      onDispatch,
      onReceipt,
    });

    expect(result.urls).toEqual([
      "https://policy.example.org/silenced-no-more",
      "https://analysis.example.edu/california-sb-331",
    ]);
    expect(result.urls.join(" ")).not.toContain("uncited.example.org");
    expect(result.usage.totalTokens).toBe(200);
    expect(result.responseBytes).toBeGreaterThan(0);
    expect(onDispatch).toHaveBeenCalledOnce();
    expect(onReceipt).toHaveBeenCalledWith(result.contentFingerprint);
  });
});
