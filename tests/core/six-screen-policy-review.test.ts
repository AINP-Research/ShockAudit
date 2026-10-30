import { describe, expect, it } from "vitest";

import {
  createPolicyBriefing,
  mergePolicyEvidenceCollections,
  parseFederalRegisterPolicyEvidence,
  parseOfficialDocumentPolicyEvidence,
} from "../../src/core/six-screen/policy-review";

function parse(text: string, overrides: Record<string, unknown> = {}) {
  return parseOfficialDocumentPolicyEvidence({
    eventId: "event-general-policy",
    sourceId: "source-general-policy",
    provider: "Official legislature",
    nativeId: "Public Law 120-7",
    canonicalUrl: "https://www.govinfo.gov/content/pkg/PLAW-120publ7/html/PLAW-120publ7.htm",
    title: "General Policy Act",
    publisher: "U.S. Government Publishing Office",
    issuer: "United States Congress",
    jurisdiction: "United States",
    publicationDate: "2026-01-10",
    retrievedAt: "2026-09-17T10:00:00.000Z",
    contentHash: "sha256:1234567890abcdef",
    retainedText: text,
    representation: "html",
    acquisitionProvenance: "direct",
    inspectedText: "full",
    ...overrides,
  });
}

function requirement(
  result: ReturnType<typeof parse>,
  kind: string,
) {
  return result.collection.requirements.find((value) => value.kind === kind)!;
}

describe("content-first official policy reconstruction", () => {
  it("uses an official purpose clause for orientation and rejects page disclaimers and false baseline phrases", () => {
    const result = parse(
      "Document Citations Citations are generated automatically from bibliographic data as a convenience and may not be complete or accurate.\n" +
        "An Act\n" +
        "To promote the financial stability of the United States by improving accountability and transparency, protect taxpayers, and protect consumers from abusive financial services practices.\n" +
        "A covered financial company shall submit an annual risk report to the Council.\n" +
        "The company may issue a replacement certificate in lieu of a lost certificate.\n" +
        "This Act becomes effective on July 21, 2010.",
      { title: "Financial Reform Act" },
    );
    const explanation = result.projections.find(({ predicate }) =>
      predicate === "policy_explanation");
    expect(explanation?.statement).toContain(
      "Financial Reform Act was enacted to promote the financial stability",
    );
    expect(result.projections.some(({ predicate }) =>
      predicate === "previous_baseline")).toBe(false);
    expect(result.projections.every((claim) =>
      !claim.statement.includes("Document Citations") &&
      !claim.citation.exactText.includes("Document Citations"))).toBe(true);
  });

  it("does not turn a title or enactment sentence into an operative rule", () => {
    const result = parse(
      "The General Policy Act was enacted on June 1, 2026. " +
        "This Act may be cited as the General Policy Act.",
    );

    expect(result.projections.filter(({ predicate }) =>
      predicate === "operative_change")).toEqual([]);
    expect(result.projections.filter(({ predicate }) =>
      predicate === "coverage_condition")).toEqual([]);
    expect(requirement(result, "operative_change").status)
      .toBe("searched_not_found");
    expect(requirement(result, "temporal_stage").status)
      .toBe("searched_not_found");
    expect(result.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "policy_date",
        typedValue: expect.objectContaining({
          date: expect.objectContaining({ kind: "adoption", start: "2026-06-01" }),
        }),
      }),
      ]));
  });

  it("does not turn a short-title clause containing shall into a substantive duty", () => {
    const result = parse(
      "Section 1. This Act shall be cited as the General Policy Act. " +
        "Section 2. The short title shall be General Policy Act.",
    );

    expect(result.projections.filter(({ predicate }) =>
      predicate === "operative_change")).toEqual([]);
    expect(requirement(result, "operative_change").status)
      .toBe("searched_not_found");
  });

  it("keeps legal citations intact and removes headings, fragments, and administrative definitions", () => {
    const result = parse(
      "SEC. 101. DEFINITIONS.\n" +
        "As used in this title, the following definitions shall apply:.\n" +
        "Emerging growth company.—The term emerging growth company means an issuer " +
        "with total annual gross revenues of less than $1,000,000,000.\n" +
        "The term Commission means the Securities and Exchange Commission.\n" +
        "The term initial public offering date means the date of the first sale of common equity securities.\n" +
        "Exemption.\n" +
        "Modification of exemption.\n" +
        "Compliance after termination of emerging growth company treatment.\n" +
        "An emerging growth company shall comply with section 2(a) of the " +
        "Sarbanes-Oxley Act of 2002 (15 U.S.C. 7201 et seq.) before filing its annual report.\n" +
        "An emerging growth company shall be exempt from the audit requirement for that report.\n" +
        "The issuer need not present financial data for any period prior to the earliest audited period.",
      {
        title: "Jumpstart Our Business Startups Act",
        nativeId: "Public Law 112-106",
      },
    );

    const coverage = result.projections.filter(({ predicate }) =>
      predicate === "coverage_condition");
    expect(coverage).toHaveLength(1);
    expect(coverage[0]!.statement).toContain("emerging growth company");
    expect(coverage[0]!.statement).not.toContain("Commission means");
    expect(coverage[0]!.statement).not.toContain("offering date means");
    expect(result.projections.filter(({ predicate }) =>
      predicate === "previous_baseline")).toEqual([]);
    expect(result.projections.filter(({ predicate }) =>
      predicate === "implementation_schedule").map(({ statement }) => statement))
      .not.toEqual(expect.arrayContaining([
        expect.stringMatching(/^Compliance after termination/iu),
      ]));
    expect(result.projections.filter(({ predicate }) =>
      predicate === "exemption_rule").map(({ statement }) => statement))
      .toEqual([
        "An emerging growth company shall be exempt from the audit requirement for that report.",
      ]);
    expect(result.projections.some(({ statement }) =>
      statement.includes("15 U.S.C. 7201 et seq.) before filing"))).toBe(true);

    const briefing = createPolicyBriefing({
      title: "Jumpstart Our Business Startups Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-10-24T12:00:00.000Z",
    });
    const visible = [
      briefing.overview,
      ...[briefing.whatChanged, briefing.coverage, briefing.enforcement]
        .flatMap(({ findings }) => findings?.map(({ text }) => text) ?? []),
    ].join(" ");
    expect(visible).not.toMatch(/apply:\.|\bExemption\.|Modification of exemption/iu);
    expect(visible).not.toContain("The available remedy and its trigger remain unresolved.");
    expect(visible).not.toContain("No provision-specific sanction");
    expect(briefing.coverage.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Who or what is covered" }),
      expect.objectContaining({ label: "Who or what is not covered" }),
    ]));
  });

  it("does not treat consumer-facing guidance as formal regulated-entity coverage", () => {
    const result = parse(
      "This guidance applies to consumers who should follow up with their health plan " +
        "when a cost estimate is unavailable.",
      { sourceRole: "consumer-facing official FAQ" },
    );

    expect(result.projections.filter(({ predicate }) =>
      predicate === "coverage_condition")).toEqual([]);
    expect(requirement(result, "coverage").status)
      .toBe("searched_not_found");
  });

  it("does not turn a numeric ownership definition into an entry threshold", () => {
    const result = parse(
      "A controlled subsidiary means an entity in which the parent controls 50 percent " +
        "of voting ownership.",
    );

    expect(result.projections.filter(({ predicate }) =>
      predicate === "threshold_condition")).toEqual([]);
  });

  it("preserves multiple legal stages stated in the same sentence", () => {
    const result = parse(
      "The Act was enacted on June 28, 2018, became operative on January 1, 2020, " +
        "and compliance begins July 1, 2020.",
    );
    const dates = result.projections.flatMap(({ typedValue }) => {
      if (!typedValue || typeof typedValue !== "object" ||
          !("date" in typedValue) || !typedValue.date ||
          typeof typedValue.date !== "object") return [];
      const date = typedValue.date as { kind?: string; start?: string };
      return date.kind && date.start ? [`${date.kind}:${date.start}`] : [];
    });

    expect(dates).toEqual(expect.arrayContaining([
      "adoption:2018-06-28",
      "legal_effect:2020-01-01",
      "compliance:2020-07-01",
    ]));
    expect(requirement(result, "temporal_stage").status).toBe("supported");
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });
    expect(briefing.timeline.map(({ date }) => `${date.kind}:${date.start}`))
      .toEqual(expect.arrayContaining([
        "adoption:2018-06-28",
        "legal_effect:2020-01-01",
        "compliance:2020-07-01",
    ]));
  });

  it("binds a relative enactment applicability rule to the matching official approval date", () => {
    const text =
      "SEC. 2. FEDERAL JURISDICTION FOR THEFT OF TRADE SECRETS. " +
      "(e) Effective Date.--The amendments made by this section shall apply " +
      "with respect to any misappropriation as [[Page 130 STAT. 382]] amended " +
      "by this section for which any act occurs on or after the date of the " +
      "enactment of this Act. " +
      "Approved May 11, 2016.";
    const result = parse(text, { publicationDate: "2016-05-11" });
    const legalEffect = result.collection.claims.find(({ predicate }) =>
      predicate === "legal_effect_date")!;
    const supportingPassages = legalEffect.supportingPassageIds.map((id) =>
      result.collection.passages.find((passage) => passage.id === id)!);
    const normalized = text.replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/\s+/gu, " ").trim();

    expect(legalEffect.typedValue).toMatchObject({
      date: {
        start: "2016-05-11",
        precision: "day",
        kind: "legal_effect",
        passageIds: legalEffect.supportingPassageIds,
      },
      relativeAnchor: "date_of_enactment",
    });
    expect(supportingPassages.map(({ exactText }) => exactText)).toEqual([
      expect.stringContaining("on or after the date of the enactment"),
      "Approved May 11, 2016.",
    ]);
    for (const passage of supportingPassages) {
      expect(passage.startOffset).not.toBeNull();
      expect(passage.endOffset).not.toBeNull();
      expect(normalized.slice(passage.startOffset!, passage.endOffset!))
        .toBe(passage.exactText);
    }
    expect(requirement(result, "temporal_stage").status).toBe("supported");
  });

  it("does not equate publication with legal effect without a matching approval date", () => {
    const result = parse(
      "Effective Date.--This section shall apply on or after the date of " +
        "enactment of this Act. Approved May 10, 2016.",
      { publicationDate: "2016-05-11" },
    );

    expect(result.projections.some(({ predicate }) =>
      predicate === "legal_effect_date")).toBe(false);
    expect(requirement(result, "temporal_stage").status)
      .toBe("searched_not_found");
  });

  it("deduplicates equivalent timeline milestones, preserves distinct same-day stages, and caps the axis", () => {
    const result = parse(
      "The Act was adopted on January 1, 2020. " +
        "The Act was adopted on January 1, 2020. " +
        "The Act was published on January 1, 2020. " +
        "The Act becomes effective February 1, 2020. " +
        "Compliance begins March 1, 2020. " +
        "Enforcement begins April 1, 2020. " +
        "A second compliance phase begins May 1, 2020. " +
        "A final transition ends June 1, 2020.",
    );
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });

    expect(briefing.timeline.length).toBeLessThanOrEqual(5);
    expect(briefing.timeline.filter(({ date }) =>
      date.kind === "adoption" && date.start === "2020-01-01"))
      .toHaveLength(1);
    expect(briefing.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        date: expect.objectContaining({ kind: "adoption", start: "2020-01-01" }),
      }),
      expect.objectContaining({
        date: expect.objectContaining({ kind: "publication", start: "2020-01-01" }),
      }),
    ]));
  });

  it("discloses post-study legal changes separately from the main timeline", () => {
    const result = parse(
      "The Act was enacted on June 28, 2018 and became operative on January 1, 2020. " +
        "The Act was amended on January 1, 2023.",
    );
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
      studyPeriod: { start: "2010", end: "2022" },
    });

    expect(briefing.timeline.map(({ date }) => date.start))
      .not.toContain("2023-01-01");
    expect(briefing.laterTimeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Amended",
        date: expect.objectContaining({ start: "2023-01-01" }),
      }),
    ]));
  });

  it("does not infer formal eligibility from a duty imposed on a named actor", () => {
    const result = parse(
      "A covered business shall maintain reasonable security procedures for personal information.",
    );

    expect(result.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: "operative_change" }),
    ]));
    expect(result.projections.some(({ predicate }) =>
      predicate === "coverage_condition")).toBe(false);
    expect(requirement(result, "coverage").status).toBe("searched_not_found");
  });

  it("searches beyond a retained-excerpt-sized prefix for express exclusions", () => {
    const background = "Background material describes legislative deliberation only. ".repeat(700);
    const result = parse(
      `${background} Section 91. This title does not apply to a nonprofit entity ` +
        "that processes data solely for charitable services.",
    );

    const exclusion = result.projections.find(({ predicate }) =>
      predicate === "exemption_rule");
    expect(exclusion).toMatchObject({
      citation: {
        exactText: expect.stringContaining("does not apply to a nonprofit entity"),
        locator: expect.stringMatching(/Section 91/iu),
        inspectedText: "full",
      },
    });
    expect(exclusion!.citation.exactText.length).toBeLessThan(400);
    expect(requirement(result, "exemption").status).toBe("supported");
  });

  it("structures penalty amounts, unit, trigger, and adjacent cure language", () => {
    const result = parse(
      "The Attorney General may bring a civil action to enforce this title. " +
        "A covered business is liable for a civil penalty of not more than $2,500 per violation " +
        "and $7,500 per intentional violation. " +
        "Before filing, the Attorney General shall provide notice and 30 days to cure the violation.",
    );
    const penalty = result.projections.find(({ predicate }) =>
      predicate === "penalty")!;

    expect(penalty.typedValue).toMatchObject({
      amount: 2500,
      amounts: [2500, 7500],
      minimumAmount: 2500,
      maximumAmount: 7500,
      currency: "USD",
      unit: "violation",
      trigger: "violation",
      qualificationOrCure: expect.stringContaining("30 days to cure"),
    });
    expect(penalty.citation.exactText).toContain("provide notice");
    expect(requirement(result, "penalty").status).toBe("supported");
  });

  it("keeps source-owned punctuation and exact offsets in repeated penalty passages", () => {
    const text =
      "A person is liable for a civil penalty not to exceed $1,000 per violation. " +
      "A person who intentionally violates a requirement is liable for a civil " +
      "penalty not to exceed $2,000 or, in <<NOTE: Notice.>> the case of a " +
      "continuing violation after written notice, $3,000 per day.";
    const result = parse(text);
    const penalties = result.collection.passages.filter(({ id }) =>
      id.includes("-penalty-"));
    const normalized = text.replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/\s+/gu, " ").trim();

    expect(penalties).toHaveLength(2);
    expect(penalties[1]!.exactText).toContain("<<NOTE: Notice.>>");
    expect(penalties[1]!.exactText).not.toContain("Notice. >>");
    for (const passage of penalties) {
      expect(passage.startOffset).not.toBeNull();
      expect(passage.endOffset).not.toBeNull();
      expect(normalized.slice(passage.startOffset!, passage.endOffset!))
        .toBe(passage.exactText);
    }
  });

  it("retains plural EU fines, pound thresholds, and day-first legal dates without reclassifying sanctions as duties", () => {
    const result = parse(
      "Article 30. The obligations shall not apply to an organisation employing " +
        "fewer than 250 persons unless the processing is not occasional. " +
        "Article 83. Infringements of the basic principles shall be subject to " +
        "administrative fines up to €20,000,000 or 4 percent of worldwide annual " +
        "turnover, whichever is higher. Regulation 2. The eligibility threshold is " +
        "not less than £36,000,000. Article 99. This Regulation shall apply from " +
        "25 May 2018.",
    );

    expect(result.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: "penalty",
        typedValue: expect.objectContaining({
          currency: "EUR",
          maximumAmount: 20_000_000,
        }),
      }),
      expect.objectContaining({
        predicate: "threshold_condition",
        citation: expect.objectContaining({
          exactText: expect.stringContaining("£36,000,000"),
        }),
      }),
      expect.objectContaining({
        predicate: "legal_effect_date",
        typedValue: expect.objectContaining({
          date: expect.objectContaining({ start: "2018-05-25" }),
        }),
      }),
    ]));
    expect(result.projections.filter(({ predicate }) =>
      predicate === "operative_change").map(({ citation }) =>
        citation.exactText)).not.toEqual(expect.arrayContaining([
          expect.stringContaining("administrative fines"),
          expect.stringContaining("shall not apply"),
        ]));
    expect(result.projections.filter(({ predicate }) =>
      predicate === "coverage_condition").map(({ citation }) =>
        citation.exactText)).not.toEqual(expect.arrayContaining([
          expect.stringContaining("shall apply from 25 May 2018"),
        ]));
  });

  it("marks missing facts source-unavailable when only a seed excerpt was inspectable", () => {
    const result = parse(
      "A controller shall provide a consumer the right to access personal data.",
      {
        inspectedText: "partial",
        acquisitionProvenance: "third_party",
        missingRequirementStatus: "source_unavailable",
      },
    );

    expect(requirement(result, "operative_change").status).toBe("supported");
    expect(requirement(result, "exemption").status).toBe("source_unavailable");
    expect(requirement(result, "penalty").status).toBe("source_unavailable");
  });

  it("retains relative commencement rules and group-specific compliance dates", () => {
    const result = parse(
      "A manufacturer shall comply within 12 months after the date of enactment. " +
        "Compliance for small manufacturers begins June 22, 2011, and " +
        "compliance for all other manufacturers begins June 22, 2010.",
    );
    const implementation = result.projections.find(({ predicate, typedValue }) =>
      predicate === "implementation_schedule" &&
      Boolean((typedValue as { relativeRule?: unknown }).relativeRule));
    expect(implementation?.typedValue).toMatchObject({
      relativeRule: {
        amount: 12,
        unit: "month",
        anchorText: "the date of enactment",
      },
      affectedProvisionOrGroup: "A manufacturer",
    });
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });
    expect(briefing.undatedTimelineClaimIds).toContain(
      implementation?.claimId,
    );
    const datedGroups = result.projections.filter(({ predicate, typedValue }) =>
      predicate === "policy_date" &&
      (typedValue as { date?: { kind?: string } }).date?.kind === "compliance")
      .map(({ typedValue }) => typedValue as {
        date: { start: string };
        affectedProvisionOrGroup: string;
      });
    expect(datedGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        date: expect.objectContaining({ start: "2011-06-22" }),
        affectedProvisionOrGroup: "small manufacturers",
      }),
      expect.objectContaining({
        date: expect.objectContaining({ start: "2010-06-22" }),
        affectedProvisionOrGroup: "all other manufacturers",
      }),
    ]));
  });

  it("keeps request-triggered deadlines out of the rollout timeline", () => {
    const result = parse(
      "A business shall disclose and deliver the required information to a consumer " +
        "free of charge within 45 days of receiving a verifiable request from the consumer.",
    );
    const requestDeadline = result.projections.find(({ predicate }) =>
      predicate === "implementation_schedule");
    expect(requestDeadline).toBeDefined();

    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });

    expect(briefing.undatedTimelineClaimIds).not.toContain(
      requestDeadline?.claimId,
    );
    expect(briefing.enforcement.claimIds).not.toContain(
      requestDeadline?.claimId,
    );
    expect(briefing.whatChanged.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Ongoing requirement",
        claimIds: [requestDeadline?.claimId],
      }),
    ]));
    expect(briefing.enforcement.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "What is not yet confirmed" }),
    ]));
  });

  it("keeps questions, advice permissions, and subclause fragments out of factual briefing findings", () => {
    const result = parse(
      "A covered business shall provide a consumer access to retained personal information. " +
        "The Attorney General may bring a civil action to enforce this title.",
    );
    const obligation = result.projections.find(({ predicate }) =>
      predicate === "operative_change")!;
    const authority = result.projections.find(({ predicate }) =>
      predicate === "enforcement_authority")!;
    const faq = {
      ...obligation,
      claimId: "faq-question",
      predicate: "implementation_schedule" as const,
      statement: "Do businesses need to comply with every consumer request?",
      typedValue: {},
    };
    const advice = {
      ...authority,
      claimId: "advice-permission",
      statement:
        "A business may seek the opinion of the Attorney General for guidance.",
    };
    const fragment = {
      ...obligation,
      claimId: "leading-subclause",
      predicate: "policy_explanation" as const,
      statement:
        "That, notwithstanding subdivision (a), a consumer may submit a request",
    };
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: [obligation, faq, advice, fragment],
      requirements: [
        { kind: "implementation", status: "supported" },
        { kind: "enforcement", status: "supported" },
      ],
      generatedAt: "2026-09-17T10:00:01.000Z",
    });

    expect(briefing.overviewClaimIds).toContain(obligation.claimId);
    expect(briefing.overviewClaimIds).not.toEqual(expect.arrayContaining([
      faq.claimId,
      advice.claimId,
      fragment.claimId,
    ]));
    expect(briefing.whatChanged.claimIds).not.toContain(faq.claimId);
    expect(briefing.enforcement.claimIds).not.toContain(advice.claimId);
    expect(briefing.enforcement.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "What is not yet confirmed",
        claimIds: [],
      }),
    ]));
  });

  it("keeps the standard briefing concise and limits needs-review questions", () => {
    const result = parse(
      "This Act applies to a covered operator providing services in the United States. " +
        "A covered operator shall publish a public report each year. " +
        "A covered operator shall retain the supporting records for five years. " +
        "This title does not apply to a public authority acting solely in an emergency. " +
        "The Commission may bring a civil action to enforce this title. " +
        "This Act becomes effective January 1, 2027.",
    );
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });
    const words = briefing.overview.trim().split(/\s+/u);

    expect(words.length).toBeGreaterThanOrEqual(90);
    expect(words.length).toBeLessThanOrEqual(150);
    expect(briefing.overview).not.toContain("…");
    expect(briefing.unresolvedQuestions.length).toBeLessThanOrEqual(3);
    expect(new Set(briefing.whatChanged.paragraphs).size)
      .toBe(briefing.whatChanged.paragraphs.length);
  });

  it("keeps timeline cards concise while retaining the full source passage", () => {
    const result = parse(
      "This Act applies to every covered operator in the United States. " +
        "A covered operator shall publish an annual report. " +
        "Following a very long list of administrative findings, cross-references, implementation details, and qualifications that remain available in the exact source passage, this Act becomes effective on January 1, 2027.",
    );
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });
    expect(briefing.timeline).toHaveLength(1);
    expect(briefing.timeline[0]!.statement.split(/\s+/u).length)
      .toBeLessThanOrEqual(20);
    const sourceClaim = result.projections.find(({ claimId }) =>
      claimId === briefing.timeline[0]!.claimId)!;
    expect(sourceClaim.citation.exactText).toContain(
      "a very long list of administrative findings",
    );
  });

  it("does not expose an internal unresolved-scope marker in timeline prose", () => {
    const result = parse(
      "The General Policy Act was amended on August 14, 2020.",
    );
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: result.projections,
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });

    expect(briefing.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Amended",
        statement: "The policy was amended.",
      }),
    ]));
    expect(briefing.timeline.map(({ statement }) => statement).join(" "))
      .not.toMatch(/instrument[\s-]+wide|unresolved/iu);
  });

  it("keeps the confirmed policy title when an oversized first fact is omitted", () => {
    const result = parse(
      "A covered operator shall publish a compliance report each year. " +
        "A covered operator shall retain that report for five years.",
    );
    const obligations = result.projections.filter(({ predicate }) =>
      predicate === "operative_change");
    expect(obligations).toHaveLength(2);
    const oversized = {
      ...obligations[0]!,
      statement:
        `SEC. 201. A covered operator shall publish a report documenting ${
          Array.from({ length: 82 }, (_, index) => `control ${index + 1}`)
            .join(", ")}.`,
    };
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: [oversized, obligations[1]!],
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });

    expect(briefing.overview).toContain("General Policy Act");
    expect(briefing.overview).toContain("retain that report for five years");
    expect(briefing.overview.trim().split(/\s+/u).length).toBeLessThanOrEqual(150);
    expect(briefing.whatChanged.paragraphs.join(" ")).not.toContain("SEC. 201.");
  });

  it("removes source-section labels and duplicate facts from the overview", () => {
    const result = parse(
      "SUMMARY: A covered operator shall publish a public report each year. " +
        "DATES: This Act becomes effective January 1, 2027.",
    );
    const obligation = result.projections.find(({ predicate }) =>
      predicate === "operative_change")!;
    const briefing = createPolicyBriefing({
      title: "General Policy Act",
      claims: [
        ...result.projections,
        {
          ...obligation,
          claimId: `${obligation.claimId}-explanation`,
          predicate: "policy_explanation",
        },
      ],
      requirements: result.collection.requirements,
      generatedAt: "2026-09-17T10:00:01.000Z",
    });

    expect(briefing.overview).not.toMatch(/\b(?:SUMMARY|DATES):/u);
    expect(briefing.overview.match(
      /a covered operator shall publish a public report each year\./giu,
    )).toHaveLength(1);
  });

  it("creates a reviewable conflict when independent sources disagree on legal effect", () => {
    const first = parse("This Act becomes effective January 1, 2027.");
    const second = parse("This Act becomes effective February 1, 2027.", {
      sourceId: "source-general-policy-amendment",
      canonicalUrl:
        "https://www.govinfo.gov/content/pkg/PLAW-120publ8/html/PLAW-120publ8.htm",
      contentHash: "sha256:fedcba0987654321",
      documentVersionLabel: "Later official representation",
    });
    const merged = mergePolicyEvidenceCollections({
      previous: first.collection,
      next: second.collection,
      searchedKinds: ["temporal_stage"],
    });

    expect(merged.conflicts).toEqual([
      expect.objectContaining({
        predicate: "legal_effect_date",
        kind: "stage_or_version",
        resolution: null,
        claimIds: expect.arrayContaining([
          expect.stringContaining("source-general-policy-"),
          expect.stringContaining("source-general-policy-amendment-"),
        ]),
      }),
    ]);
    expect(merged.requirements.find(({ kind }) =>
      kind === "temporal_stage")?.status).toBe("conflicting");
    expect(merged.claims.filter(({ predicate }) =>
      predicate === "legal_effect_date").every(({ supportStatus }) =>
      supportStatus === "conflicting")).toBe(true);
  });
});

describe("focused Federal Register evidence retention", () => {
  const common = {
    eventId: "identity-order-841",
    documentNumber: "2018-03708",
    canonicalUrl:
      "https://www.federalregister.gov/documents/full_text/html/2018/03/06/2018-03708.html",
    title:
      "Electric Storage Participation in Markets Operated by Regional Transmission Organizations and Independent System Operators",
    issuer: "Federal Energy Regulatory Commission",
    publicationDate: "2018-03-06",
    retrievedAt: "2026-09-18T10:00:00.000Z",
    representation: "html" as const,
  };

  it("backfills earlier exact-record facts when a later focused representation exposes them", () => {
    const earlierCoreWithoutFacts = parseFederalRegisterPolicyEvidence({
      ...common,
      contentHash: `sha256:${"a".repeat(64)}`,
      parsedText: "Background discussion contains no operative policy text.",
      focus: "core",
    });
    const recoveredCoverage = parseFederalRegisterPolicyEvidence({
      ...common,
      contentHash: `sha256:${"b".repeat(64)}`,
      parsedText: [
        "This final rule requires each regional transmission organization to revise its tariff and establish a participation model for electric storage resources.",
        "This final rule is effective June 4, 2018.",
        "Each RTO/ISO must file the tariff changes needed to implement the requirements of this Final Rule within 270 days of publication.",
        "We will allow each RTO/ISO a further 365 days from that date to implement the tariff provisions.",
        "This Final Rule requires each RTO/ISO to implement market rules applicable to electric storage resources that voluntarily seek to participate in the RTO/ISO markets.",
        "This Final Rule does not exempt a participating electric storage resource from applicable penalties for non-performance.",
      ].join(" "),
      focus: "coverage_exemptions",
    });
    const merged = mergePolicyEvidenceCollections({
      previous: earlierCoreWithoutFacts.collection,
      next: recoveredCoverage.collection,
      searchedKinds: ["coverage", "exemption"],
    });

    expect(merged.claims.map(({ predicate }) => predicate)).toEqual(
      expect.arrayContaining([
        "operative_change",
        "legal_effect_date",
        "implementation_schedule",
        "coverage_condition",
        "exemption_rule",
      ]),
    );
    for (const kind of [
      "operative_change",
      "temporal_stage",
      "implementation",
      "coverage",
      "exemption",
    ] as const) {
      expect(merged.requirements.find((value) => value.kind === kind)?.status)
        .toBe("supported");
    }
    expect(merged.requirements.find(({ kind }) => kind === "enforcement")?.status)
      .toBe("not_yet_searched");
    expect(merged.requirements.find(({ kind }) => kind === "penalty")?.status)
      .toBe("not_yet_searched");
  });

  it("recovers after malformed grouping and prefers operative sanctions over policy discussion", () => {
    const result = parseFederalRegisterPolicyEvidence({
      ...common,
      documentNumber: "2019-24931",
      contentHash: `sha256:${"c".repeat(64)}`,
      parsedText: [
        `Background (an incomplete source note ${"detail ".repeat(220)}.`,
        "For example, CMS has imposed $100 per day penalty amounts with respect to other compliance matters.",
        "Comments suggested that CMS impose monitoring or enforcement efforts on software developers, but that request is beyond the scope of this rule.",
        "The requirements apply to all hospitals operating within the United States.",
        "CMS may impose a civil monetary penalty on a hospital that fails to comply with a corrective action plan.",
        "The maximum daily dollar amount for a civil monetary penalty to which a hospital may be subject is $300.",
      ].join(" "),
      focus: "enforcement",
    });
    const enforcement = result.projections.find(({ predicate }) =>
      predicate === "enforcement_authority");
    const penalty = result.projections.find(({ predicate }) =>
      predicate === "penalty");

    expect(enforcement?.statement).toBe(
      "CMS may impose a civil monetary penalty on a hospital that fails to comply with a corrective action plan.",
    );
    expect(penalty?.statement).toBe(
      "The maximum daily dollar amount for a civil monetary penalty to which a hospital may be subject is $300.",
    );
    expect(result.projections.find(({ predicate }) =>
      predicate === "coverage_condition")?.statement).toContain(
        "all hospitals operating within the United States",
      );
  });
});
