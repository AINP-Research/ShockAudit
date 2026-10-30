export const SCREEN5_OPENAI_RESPONSES_URL =
  "https://api.openai.com/v1/responses" as const;
export const SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES = 256 * 1024;
export const SCREEN5_OPENAI_REQUEST_HEADER_MAX_BYTES = 16 * 1024;
// The provider wraps and JSON-escapes a private receipt of up to 512 KiB.
export const SCREEN5_OPENAI_RESPONSE_BODY_MAX_BYTES = 4 * 1024 * 1024;
export const SCREEN5_OPENAI_RESPONSE_HEADER_MAX_BYTES = 64 * 1024;
/** One deadline covers dispatch, response headers, and the bounded body read. */
export const SCREEN5_OPENAI_REQUEST_DEADLINE_MS = 300_000;

export type Screen5OpenAIFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type Screen5OpenAIFailureStage =
  | "local_configuration"
  | "admission"
  | "network"
  | "response_headers"
  | "response_body"
  | "model_output"
  | "persistence"
  | "projection";

export type Screen5OpenAINetworkInvocation =
  | "not_started"
  | "invoked"
  | "unknown";
export type Screen5OpenAIProviderResponseObservation =
  | "not_observed"
  | "observed";

export type Screen5OpenAITransportDiagnostic = {
  failureStage: Screen5OpenAIFailureStage;
  networkInvocation: Screen5OpenAINetworkInvocation;
  providerResponse: Screen5OpenAIProviderResponseObservation;
  httpStatus: number | null;
  safeCause: string;
};

export class Screen5OpenAITransportError extends Error {
  constructor(
    message: string,
    readonly detail: Screen5OpenAITransportDiagnostic,
  ) {
    super(message);
    this.name = "Screen5OpenAITransportError";
  }
}

function transportError(
  message: string,
  detail: Screen5OpenAITransportDiagnostic,
) {
  return new Screen5OpenAITransportError(message, detail);
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function validateRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    throw transportError("The OpenAI transport requires an explicit fixed URL.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "request_object_rejected",
    });
  }
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.href) : new URL(input);
  } catch {
    throw transportError("The OpenAI inference URL is invalid.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "invalid_url",
    });
  }
  if (
    url.href !== SCREEN5_OPENAI_RESPONSES_URL ||
    url.protocol !== "https:" || url.hostname !== "api.openai.com" ||
    (url.port && url.port !== "443") || url.username || url.password ||
    url.search || url.hash
  ) {
    throw transportError("The OpenAI inference destination is not allowed.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "destination_rejected",
    });
  }
  if ((init?.method ?? "GET").toUpperCase() !== "POST") {
    throw transportError("The OpenAI inference method must be POST.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "wrong_method",
    });
  }
  if (typeof init?.body !== "string") {
    throw transportError("The OpenAI inference body must be JSON text.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "body_rejected",
    });
  }
  const bodyBytes = byteLength(init.body);
  if (bodyBytes > SCREEN5_OPENAI_REQUEST_BODY_MAX_BYTES) {
    throw transportError("The OpenAI inference body is too large.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "request_body_too_large",
    });
  }
  try {
    JSON.parse(init.body);
  } catch {
    throw transportError("The OpenAI inference body is not valid JSON.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "invalid_json_body",
    });
  }
  let headers: Headers;
  try {
    headers = new Headers(init.headers);
  } catch {
    throw transportError("The OpenAI inference headers are invalid.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "headers_rejected",
    });
  }
  const contentType = headers.get("content-type")?.toLowerCase();
  const authorization = headers.get("authorization");
  const headerNames = [...headers.keys()];
  if (contentType !== "application/json" ||
      !authorization || !/^Bearer [^\s=]{16,4096}$/u.test(authorization) ||
      headerNames.some((name) =>
        name !== "authorization" && name !== "content-type"
      ) ||
      screen5OpenAIHeaderBytes(headers) >
        SCREEN5_OPENAI_REQUEST_HEADER_MAX_BYTES) {
    throw transportError("The OpenAI inference headers are invalid.", {
      failureStage: "admission",
      networkInvocation: "not_started",
      providerResponse: "not_observed",
      httpStatus: null,
      safeCause: "headers_rejected",
    });
  }
  return { body: init.body, headers };
}

export function screen5OpenAIHeaderBytes(headers: Headers) {
  let total = 0;
  headers.forEach((value, name) => {
    total += byteLength(name) + byteLength(value) + 4;
  });
  return total;
}

async function boundedResponseBody(
  response: Response,
  maximumBytes: number,
  signal: AbortSignal,
) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let rejectAbort: ((reason: Error) => void) | null = null;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort?.(new Error("OpenAI body read aborted."));
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    while (true) {
      const read = await Promise.race([reader.read(), aborted]);
      if (read.done) break;
      total += read.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw transportError("The OpenAI response body is too large.", {
          failureStage: "response_body",
          networkInvocation: "invoked",
          providerResponse: "observed",
          httpStatus: response.status,
          safeCause: "response_body_too_large",
        });
      }
      chunks.push(read.value);
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function createScreen5OpenAITransport(
  platformFetch: Screen5OpenAIFetch = (input, init) =>
    globalThis.fetch(input, init),
  options: {
    deadlineMs?: number;
    responseBodyMaxBytes?: number;
    responseHeaderMaxBytes?: number;
  } = {},
): Screen5OpenAIFetch {
  const deadlineMs = options.deadlineMs ??
    SCREEN5_OPENAI_REQUEST_DEADLINE_MS;
  const maximumResponseBytes = options.responseBodyMaxBytes ??
    SCREEN5_OPENAI_RESPONSE_BODY_MAX_BYTES;
  const maximumHeaderBytes = options.responseHeaderMaxBytes ??
    SCREEN5_OPENAI_RESPONSE_HEADER_MAX_BYTES;
  return async (input, init) => {
    const validated = validateRequest(input, init);
    const incomingSignal = init?.signal;
    if (incomingSignal?.aborted) {
      throw transportError("The OpenAI request was already aborted.", {
        failureStage: "admission",
        networkInvocation: "not_started",
        providerResponse: "not_observed",
        httpStatus: null,
        safeCause: "request_aborted",
      });
    }
    const controller = new AbortController();
    let timedOut = false;
    let response: Response | null = null;
    let rejectBoundary: ((reason: Error) => void) | null = null;
    const boundary = new Promise<never>((_resolve, reject) => {
      rejectBoundary = reject;
    });
    const onAbort = () => {
      controller.abort();
      rejectBoundary?.(new Error("OpenAI request aborted."));
    };
    incomingSignal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      rejectBoundary?.(new Error("OpenAI request timed out."));
    }, deadlineMs);
    try {
      response = await Promise.race([
        platformFetch(SCREEN5_OPENAI_RESPONSES_URL, {
          method: "POST",
          headers: validated.headers,
          body: validated.body,
          redirect: "manual",
          signal: controller.signal,
        }),
        boundary,
      ]);
      if (screen5OpenAIHeaderBytes(response.headers) > maximumHeaderBytes) {
        await response.body?.cancel().catch(() => undefined);
        throw transportError("The OpenAI response headers are too large.", {
          failureStage: "response_headers",
          networkInvocation: "invoked",
          providerResponse: "observed",
          httpStatus: response.status,
          safeCause: "response_headers_too_large",
        });
      }
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        throw transportError("The OpenAI endpoint returned a redirect.", {
          failureStage: "response_headers",
          networkInvocation: "invoked",
          providerResponse: "observed",
          httpStatus: response.status,
          safeCause: "redirect_rejected",
        });
      }
      const body = await boundedResponseBody(
        response,
        maximumResponseBytes,
        controller.signal,
      );
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (caught) {
      if (caught instanceof Screen5OpenAITransportError) throw caught;
      if (response) {
        throw transportError(
          timedOut
            ? "The OpenAI response body exceeded its deadline."
            : "The OpenAI response body could not be read.",
          {
            failureStage: "response_body",
            networkInvocation: "invoked",
            providerResponse: "observed",
            httpStatus: response.status,
            safeCause: timedOut ? "request_timeout" : "response_body_failed",
          },
        );
      }
      throw transportError(
        timedOut
          ? "The OpenAI request exceeded its deadline."
          : "The OpenAI request failed before response headers.",
        {
          failureStage: "network",
          networkInvocation: "invoked",
          providerResponse: "not_observed",
          httpStatus: null,
          safeCause: timedOut
            ? "request_timeout"
            : incomingSignal?.aborted
              ? "request_aborted"
              : "network_failure",
        },
      );
    } finally {
      clearTimeout(timer);
      incomingSignal?.removeEventListener("abort", onAbort);
    }
  };
}
