import { describe, expect, it } from "vitest";

import {
  canonicalScreen02FormalIdentifier,
  compareScreen02FormalIdentifiers,
  parseScreen02FormalIdentifier,
} from "../../src/core/screen02-formal-identifier";

describe("Screen 2 formal identifier identity", () => {
  it("preserves established bill and European aliases", () => {
    expect(compareScreen02FormalIdentifiers(
      "AB 375",
      "California Assembly Bill No. 0375",
    )).toBe("equivalent");
    expect(compareScreen02FormalIdentifiers(
      "Directive 2019/770/EU",
      "EU Directive 2019/770",
    )).toBe("equivalent");
    expect(compareScreen02FormalIdentifiers(
      "Commission Implementing Regulation (EU) No. 2018/1234",
      "EU 2018/1234",
    )).toBe("compatible-partial");
    expect(compareScreen02FormalIdentifiers(
      "Regulation (EC) No. 1234/2008",
      "EC 1234/2008",
    )).toBe("compatible-partial");
    expect(compareScreen02FormalIdentifiers(
      "Order No. 12",
      "Order 12 Corrigendum",
    )).toBe("equivalent");
    for (const alias of [
      "Order 12 Corr",
      "Order 12 Corrected",
      "Order 12 Correction",
      "Order 12 Technical Correction",
    ]) {
      expect(compareScreen02FormalIdentifiers("Order No. 12", alias), alias)
        .toBe("equivalent");
    }
  });

  it("retains California chapter, statutes year, and session coordinates", () => {
    const chapter = parseScreen02FormalIdentifier(
      "AB 375 (Chapter 55, Statutes of 2018)",
    );
    const session = parseScreen02FormalIdentifier(
      "AB 375 (2017–2018 Reg. Sess.)",
    );

    expect(chapter).toMatchObject({
      baseKey: "ab 375",
      exactKey: "ab 375 chapter 55 statutes 2018",
      coordinates: {
        chamber: "ab",
        number: "375",
        chapter: "55",
        statutesYear: "2018",
      },
    });
    expect(session).toMatchObject({
      baseKey: "ab 375",
      exactKey: "ab 375 session 2017 2018 regular",
      coordinates: {
        sessionStart: "2017",
        sessionEnd: "2018",
        sessionKind: "regular",
      },
    });
    expect(compareScreen02FormalIdentifiers("AB 375", chapter?.exactKey))
      .toBe("compatible-partial");
  });

  it.each([
    [
      "AB 375, Chapter 55, Statutes of 2018",
      "AB 375, Chapter 56, Statutes of 2024",
    ],
    [
      "AB 375 (2017–2018 Reg. Sess.)",
      "AB 375 (2023–2024 Regular Session)",
    ],
    [
      "AB 375 (2017–2018 Reg. Sess.)",
      "AB 375, Chapter 56, Statutes of 2024",
    ],
    ["Regulation (EU) 2016/679", "Regulation (EC) 2016/679"],
    ["Regulation (EU) 2016/679", "Regulation (UK) 2016/679"],
    ["Regulation (EU) 2016/679", "Directive (EU) 2016/679"],
    ["Order No. 84", "Order No. 84-A"],
  ])("fails closed for conflicting coordinates: %s versus %s", (left, right) => {
    expect(compareScreen02FormalIdentifiers(left, right)).toBe("conflict");
    expect(compareScreen02FormalIdentifiers(right, left)).toBe("conflict");
    expect(canonicalScreen02FormalIdentifier(left)).not.toBe(
      canonicalScreen02FormalIdentifier(right),
    );
  });

  it("rejects an over-width European serial before leading-zero canonicalization", () => {
    expect(parseScreen02FormalIdentifier("Regulation (EU) 2016/01234"))
      .toMatchObject({ family: "opaque" });
    expect(compareScreen02FormalIdentifiers(
      "Regulation (EU) 2016/01234",
      "Regulation (EU) 2016/1234",
    )).toBe("different");
  });

  it("does not reinterpret a comma-delimited prose article as a suffix", () => {
    expect(parseScreen02FormalIdentifier("Order No. 84, a")).toMatchObject({
      family: "opaque",
    });
    expect(compareScreen02FormalIdentifiers("Order No. 84", "Order No. 84, a"))
      .toBe("different");
  });

  it.each([
    "Order No. 84A",
    "Order No. 84-A",
    "Order No. 84/A",
    "Order No. 84.A",
    "Order No. 84 A",
  ])("preserves a genuine single-letter suffix: %s", (value) => {
    expect(parseScreen02FormalIdentifier(value)).toMatchObject({
      family: "numbered-instrument",
      baseKey: "order 84",
      exactKey: "order 84 a",
      coordinates: { suffix: "a" },
    });
  });
});
