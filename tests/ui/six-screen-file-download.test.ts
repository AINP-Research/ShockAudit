import { App } from "@modelcontextprotocol/ext-apps";
import { afterEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { SixScreenBridge } from "../../src/ui/six-screen/bridge";
import { downloadBrowserFile } from "../../src/ui/six-screen/file-download";
import { completeReportFixture } from "../fixtures/complete-report";
import { createScreen6CurrentPlan } from "../../src/core/six-screen/screen6-current-plan";
import { createScreen6DesignMapProjection } from "../../src/core/six-screen/screen6-design-map";
import { downloadCompleteReport } from "../../src/ui/six-screen/complete-report";
import { createCompleteReport } from "../../src/ui/six-screen/complete-report-data";
import { generateCompleteReportDocx } from "../../src/ui/six-screen/complete-report-docx";
import { SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY } from "../../src/core/six-screen/metadata-keys";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const file = { fileName: "ShockAudit-Complete-Report.pdf", mimeType: "application/pdf",
  bytes: new TextEncoder().encode("%PDF-1.7\ncontrolled export") };

function bridgeWithHost(downloadFile: (input: unknown) => Promise<unknown>) {
  vi.stubGlobal("window", { parent: {}, openai: {} });
  const bridge = new SixScreenBridge();
  (bridge as unknown as { app: unknown }).app = {
    getHostCapabilities: () => ({ downloadFile: {} }), downloadFile,
  };
  return bridge;
}

describe("sandboxed complete-report delivery", () => {
  it("delivers an editable Word package through the same host file channel", async () => {
    const download = vi.fn(async (_input: unknown) => ({}));
    const bridge = bridgeWithHost(download);
    const state = completeReportFixture(), plan = createScreen6CurrentPlan(state);
    const report = createCompleteReport({ state, plan, designMap: createScreen6DesignMapProjection(plan) });
    const bytes = generateCompleteReportDocx(report);
    await expect(bridge.downloadFile({ bytes, fileName: "ShockAudit-Complete-Report.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }))
      .resolves.toEqual({ status: "requested" });
    const resource = (download.mock.calls[0]![0] as { contents: Array<{ resource: { blob: string; mimeType: string; uri: string } }> }).contents[0]!.resource;
    expect(resource.uri).toBe("file:///ShockAudit-Complete-Report.docx");
    expect(resource.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(atob(resource.blob).slice(0, 2)).toBe("PK");
  });
  it("sends the real report bytes to the host instead of clicking a sandboxed anchor", async () => {
    const download = vi.fn(async (_input: unknown) => ({}));
    const bridge = bridgeWithHost(download);
    const createUrl = vi.spyOn(URL, "createObjectURL");
    const fetch = vi.spyOn(globalThis, "fetch");
    const state = completeReportFixture(10), original = JSON.stringify(state);
    const plan = createScreen6CurrentPlan(state);
    await expect(downloadCompleteReport({ state, plan, designMap: createScreen6DesignMapProjection(plan) },
      (input) => bridge.downloadFile(input))).resolves.toEqual({ status: "requested" });
    const request = download.mock.calls[0]![0] as unknown as {
      contents: Array<{ resource: { blob: string; uri: string; mimeType: string } }>;
    };
    expect(download).toHaveBeenCalledTimes(1);
    const resource = request.contents[0]!.resource;
    expect(resource.mimeType).toBe("application/pdf");
    expect(resource.uri).toMatch(/^file:\/\/\/ShockAudit-Complete-Report-.*\.pdf$/u);
    expect(atob(resource.blob)).toMatch(/^%PDF-1\.7/u);
    expect(createUrl).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(original);
  });

  it("creates Word without browser image or canvas preparation", async () => {
    const download = vi.fn(async (_input: unknown) => ({
      status: "requested" as const,
    }));
    vi.stubGlobal("Image", class {
      constructor() { throw new Error("Browser image preparation must not run."); }
    });
    vi.stubGlobal("document", {
      createElement: () => { throw new Error("Canvas preparation must not run."); },
    });
    const state = completeReportFixture(10), plan = createScreen6CurrentPlan(state);
    await expect(downloadCompleteReport({ state, plan,
      designMap: createScreen6DesignMapProjection(plan) }, download, "docx"))
      .resolves.toEqual({ status: "requested" });
    const request = download.mock.calls[0]![0] as {
      bytes: Uint8Array;
      fileName: string;
      mimeType: string;
    };
    expect(request.fileName).toMatch(/\.docx$/u);
    expect(request.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const archive = unzipSync(request.bytes);
    expect(strFromU8(archive["word/media/design-map.svg"]!)).toContain("<svg");
    expect(strFromU8(archive["word/_rels/document.xml.rels"]!))
      .toContain('Target="media/design-map.svg"');
  });

  it("surfaces a declined host download and does not retry through another channel", async () => {
    const download = vi.fn(async () => ({ isError: true }));
    const bridge = bridgeWithHost(download);
    const upload = vi.fn(); window.openai!.uploadFile = upload;
    await expect(bridge.downloadFile(file)).rejects.toThrow(/cancelled or declined/u);
    expect(download).toHaveBeenCalledTimes(1); expect(upload).not.toHaveBeenCalled();
  });

  it("keeps a secure ChatGPT download link available if automatic opening fails", async () => {
    const uploadFile = vi.fn(async (_file: File) => ({ fileId: "report-file" }));
    const getFileDownloadUrl = vi.fn(async () => ({ downloadUrl: "https://files.example.test/report.pdf" }));
    const openExternal = vi.fn(async () => { throw new Error("Navigation declined"); });
    vi.stubGlobal("window", { parent: {}, openai: { uploadFile, getFileDownloadUrl, openExternal } });
    const result = await new SixScreenBridge().downloadFile(file);
    expect(result).toEqual({ status: "ready", fileName: file.fileName, url: "https://files.example.test/report.pdf" });
    expect(uploadFile.mock.calls[0]![0]).toBeInstanceOf(File);
    expect(getFileDownloadUrl).toHaveBeenCalledWith({ fileId: "report-file" });
  });

  it("rejects an unsafe file URL and an embedded host without download support", async () => {
    vi.stubGlobal("window", { parent: {}, openai: {
      uploadFile: vi.fn(async () => ({ fileId: "report-file" })),
      getFileDownloadUrl: vi.fn(async () => ({ downloadUrl: "javascript:alert(1)" })),
      openExternal: vi.fn(),
    } });
    await expect(new SixScreenBridge().downloadFile(file)).rejects.toThrow(/secure report download/u);
    expect(window.openai!.openExternal).not.toHaveBeenCalled();
    vi.stubGlobal("window", { parent: {}, openai: {} });
    await expect(new SixScreenBridge().downloadFile(file)).rejects.toThrow(/does not support file downloads/u);
    await expect(downloadBrowserFile(file)).rejects.toThrow(/requires the host/u);
  });
});

it("leaves operation-bound mutation notifications to the direct response while retaining launch notifications", async () => {
  vi.stubGlobal("window", { parent: {}, openai: {} });
  const listeners = new Map<string, (params: unknown) => void>();
  vi.spyOn(App.prototype, "addEventListener").mockImplementation((name, listener) => {
    listeners.set(String(name), listener as (params: unknown) => void);
  });
  vi.spyOn(App.prototype, "removeEventListener").mockImplementation(() => {});
  vi.spyOn(App.prototype, "connect").mockResolvedValue(undefined);
  vi.spyOn(App.prototype, "getHostContext").mockReturnValue(undefined);
  vi.spyOn(App.prototype, "close").mockResolvedValue(undefined);
  const bridge = new SixScreenBridge(), observed = vi.fn();
  await bridge.connect({ onHostView: vi.fn(), onToolResult: observed });
  const result = { structuredContent: { runId: "controlled-run", revision: 10 }, _meta: {
    [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: { toolName: "mutate_six_screen_workflow_v1",
      operationBinding: { operationKind: "open_screen_4", operationId: "first-screen4-open" },
      encodedPublicProjectionPayload: "damaged duplicate payload" },
  } };
  listeners.get("toolresult")!(result);
  expect(observed).not.toHaveBeenCalled();
  listeners.get("toolresult")!({ ...result, _meta: { [SIX_SCREEN_WORKFLOW_RESPONSE_META_KEY]: {
    toolName: "get_six_screen_workflow_v1", encodedPublicProjectionPayload: "launch payload",
  } } });
  expect(observed).toHaveBeenCalledTimes(1);
  bridge.disconnect();
});
