export type SixScreenDownloadFile = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

export type SixScreenDownloadResult =
  | { status: "requested" }
  | { status: "ready"; url: string; fileName: string };

export type SixScreenFileDownloader =
  (file: SixScreenDownloadFile) => Promise<SixScreenDownloadResult>;

/** Browser downloads are available only outside the host's sandbox. */
export async function downloadBrowserFile(file: SixScreenDownloadFile) {
  if (typeof window !== "undefined" && window.parent !== window) {
    throw new Error("This embedded workspace requires the host file download service.");
  }
  const blob = new Blob([file.bytes.slice().buffer], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { status: "requested" } as const;
}
