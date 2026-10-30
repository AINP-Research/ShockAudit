import { createCompleteReport } from "./complete-report-data";
import { generateCompleteReportPdf } from "./complete-report-pdf";
import { generateCompleteReportDocx } from "./complete-report-docx";
import { downloadBrowserFile, type SixScreenFileDownloader } from "./file-download";

export { createCompleteReport, generateCompleteReportPdf, generateCompleteReportDocx };

export async function downloadCompleteReport(
  input: Parameters<typeof createCompleteReport>[0],
  download: SixScreenFileDownloader = downloadBrowserFile,
  format: "pdf" | "docx" = "pdf",
) {
  const report = createCompleteReport(input);
  const bytes = format === "docx"
    ? generateCompleteReportDocx(report)
    : generateCompleteReportPdf(report);
  const title = report.title.normalize("NFKD").replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "").slice(0, 80) || "Research";
  return download({ bytes, fileName: `ShockAudit-Complete-Report-${title}.${format}`,
    mimeType: format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf" });
}
