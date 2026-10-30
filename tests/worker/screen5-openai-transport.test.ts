import { describe, expect, it, vi } from "vitest";

import {
  SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES,
  SCREEN5_OPENAI_RESPONSE_BODY_MAX_BYTES,
  SCREEN5_OPENAI_RESPONSE_HEADER_MAX_BYTES,
  SCREEN5_OPENAI_RESPONSES_URL,
  Screen5OpenAITransportError,
  createScreen5OpenAITransport,
  screen5OpenAIHeaderBytes,
} from "../../src/worker/screen5-openai-transport";

const headers = {
  authorization: "Bearer test-only-secret",
  "content-type": "application/json",
};

describe("dedicated Screen 5 OpenAI transport", () => {
  it("admits only the fixed POST endpoint and makes one bounded platform request", async () => {
    const platformFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("manual");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer test-only-secret",
      );
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const transport = createScreen5OpenAITransport(platformFetch);

    const response = await transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    });

    expect(await response.json()).toEqual({ ok: true });
    expect(platformFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["https://api.openai.com/v1/responses?redirect=1", "destination_rejected"],
    ["https://example.com/v1/responses", "destination_rejected"],
  ])("rejects %s before network invocation", async (url, safeCause) => {
    const platformFetch = vi.fn();
    const transport = createScreen5OpenAITransport(platformFetch);

    await expect(transport(url, {
      method: "POST",
      headers,
      body: "{}",
    })).rejects.toMatchObject({
      detail: {
        failureStage: "admission",
        networkInvocation: "not_started",
        providerResponse: "not_observed",
        safeCause,
      },
    });
    expect(platformFetch).not.toHaveBeenCalled();
  });

  it.each([
    [
      "undersized bearer credential",
      { authorization: "Bearer short", "content-type": "application/json" },
    ],
    [
      "unapproved request header",
      { ...headers, "x-unapproved": "value" },
    ],
  ])("rejects an %s before dispatch", async (_label, requestHeaders) => {
    const platformFetch = vi.fn();
    const transport = createScreen5OpenAITransport(platformFetch);
    await expect(transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: requestHeaders,
      body: "{}",
    })).rejects.toMatchObject({
      detail: {
        failureStage: "admission",
        networkInvocation: "not_started",
        safeCause: "headers_rejected",
      },
    });
    expect(platformFetch).not.toHaveBeenCalled();
  });

  it("accepts the exact request-body boundary and rejects one byte more", async () => {
    const platformFetch = vi.fn(async () => new Response("{}"));
    const transport = createScreen5OpenAITransport(platformFetch);
    const exact = JSON.stringify(
      "x".repeat(SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES - 2),
    );

    await expect(transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: exact,
    })).resolves.toBeInstanceOf(Response);
    await expect(transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(
        "x".repeat(SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES - 1),
      ),
    })).rejects.toMatchObject({
      detail: {
        networkInvocation: "not_started",
        safeCause: "request_body_too_large",
      },
    });
    expect(platformFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects redirects without following the bearer credential", async () => {
    const platformFetch = vi.fn(async () => new Response(null, {
      status: 307,
      headers: { location: "https://example.com/collect" },
    }));
    const transport = createScreen5OpenAITransport(platformFetch);

    await expect(transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    })).rejects.toMatchObject({
      detail: {
        failureStage: "response_headers",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: 307,
        safeCause: "redirect_rejected",
      },
    });
    expect(platformFetch).toHaveBeenCalledTimes(1);
  });

  it("accepts the exact response-body boundary and rejects one byte more", async () => {
    let responseBytes = SCREEN5_OPENAI_RESPONSE_BODY_MAX_BYTES;
    const platformFetch = vi.fn(async () =>
      new Response(new Uint8Array(responseBytes)));
    const transport = createScreen5OpenAITransport(platformFetch);
    const exact = await transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    });
    expect((await exact.arrayBuffer()).byteLength).toBe(
      SCREEN5_OPENAI_RESPONSE_BODY_MAX_BYTES,
    );

    responseBytes += 1;
    await expect(transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    })).rejects.toBeInstanceOf(Screen5OpenAITransportError);
    await expect(transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    })).rejects.toMatchObject({
      detail: {
        networkInvocation: "invoked",
        providerResponse: "observed",
        safeCause: "response_body_too_large",
      },
    });
  });

  it("accepts the exact response-header boundary and rejects one byte more", async () => {
    let headerBytes = SCREEN5_OPENAI_RESPONSE_HEADER_MAX_BYTES;
    const platformFetch = vi.fn(async () => {
      const base = new Headers({ "x-padding": "" });
      const padding = headerBytes - screen5OpenAIHeaderBytes(base);
      return new Response(null, {
        headers: { "x-padding": "x".repeat(padding) },
      });
    });
    const transport = createScreen5OpenAITransport(platformFetch);
    await expect(transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    })).resolves.toBeInstanceOf(Response);

    headerBytes += 1;
    await expect(transport(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    })).rejects.toMatchObject({
      detail: {
        failureStage: "response_headers",
        providerResponse: "observed",
        safeCause: "response_headers_too_large",
      },
    });
  });

  it("distinguishes a whole-request deadline before and after response headers", async () => {
    const beforeHeaders = createScreen5OpenAITransport(
      async () => new Promise<Response>(() => undefined),
      { deadlineMs: 5 },
    );
    await expect(beforeHeaders(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    })).rejects.toMatchObject({
      detail: {
        failureStage: "network",
        networkInvocation: "invoked",
        providerResponse: "not_observed",
        safeCause: "request_timeout",
      },
    });

    const afterHeaders = createScreen5OpenAITransport(
      async () => new Response(new ReadableStream<Uint8Array>({
        pull() {
          // Deliberately hold the body open past the whole-request deadline.
          return new Promise<void>(() => undefined);
        },
      }), { status: 200 }),
      { deadlineMs: 5 },
    );
    await expect(afterHeaders(SCREEN5_OPENAI_RESPONSES_URL, {
      method: "POST",
      headers,
      body: "{}",
    })).rejects.toMatchObject({
      detail: {
        failureStage: "response_body",
        networkInvocation: "invoked",
        providerResponse: "observed",
        httpStatus: 200,
        safeCause: "request_timeout",
      },
    });
  });
});
