import { describe, expect, it } from "vitest";

import { normalizeOfficialDocumentPayload } from
  "../../src/worker/official-document-normalization";

describe("official document main-content normalization", () => {
  it("keeps legal text and removes navigation and citation disclaimers", () => {
    const normalized = normalizeOfficialDocumentPayload({
      mediaType: "text/html",
      body: `<!doctype html><html><body>
        <nav>Skip to main content Browse A to Z Developer Hub</nav>
        <main>
          <p>Document Citations Citations are generated automatically from bibliographic data as a convenience and may not be complete or accurate.</p>
          <p>The Financial Reform Act requires covered companies to submit annual risk reports.</p>
        </main>
        <footer>Privacy Policy Contact Us</footer>
      </body></html>`,
    });
    expect(normalized.quality.accepted).toBe(true);
    expect(normalized.text).toContain(
      "The Financial Reform Act requires covered companies",
    );
    expect(normalized.text).not.toMatch(
      /Document Citations|Browse A to Z|Developer Hub|Privacy Policy/iu,
    );
  });
});
