function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required to construct the bounded live fixture.`);
  }
  return value.trim();
}

function firstString(values, label) {
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be a bounded string array.`);
  }
  return requiredString(values.find((value) => typeof value === "string"), label);
}

function requestedParts(request) {
  const parts = request?.draftContract?.requestedPartIds;
  if (
    !Array.isArray(parts) ||
    parts.length === 0 ||
    parts.some((part) => typeof part !== "string")
  ) {
    throw new Error("The signed host request omitted its requested part IDs.");
  }
  return parts;
}

function pickRequested(parts, values) {
  return Object.fromEntries(
    parts.map((part) => {
      if (!Object.prototype.hasOwnProperty.call(values, part)) {
        throw new Error(`No deterministic live fixture exists for requested part ${part}.`);
      }
      return [part, values[part]];
    }),
  );
}

function sourceIdsFor(request) {
  const values = request?.draftContract?.allowedEvidenceSourceIds;
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error("The signed host request omitted its evidence-source allowlist.");
  }
  return values;
}

function evidenceFor(category, sourceIds) {
  return category === "unclear" ? [] : [firstString(sourceIds, "evidence source")];
}

function allowedCategory(request, key, preferred) {
  const allowed = request?.draftContract?.allowedCategories?.[key];
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new Error(`The signed host request omitted allowed ${key} categories.`);
  }
  return allowed.includes(preferred) ? preferred : requiredString(allowed[0], key);
}

function boundedQueryPhrase(value) {
  return requiredString(value, "planning phrase")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} .,&'’()+\/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
}

function findDiscoveryPlanDraft(modelContext) {
  const study = modelContext?.study;
  if (!isRecord(study)) {
    throw new Error("The Find planning request omitted its confirmed study block.");
  }
  const eventFamily = boundedQueryPhrase(study.eventFamily);
  const industry = boundedQueryPhrase(study.industry);
  return {
    queryTerms: [
      boundedQueryPhrase(`${eventFamily} official announcement`),
      boundedQueryPhrase(`${industry} public notice`),
    ],
    rationale:
      "These bounded synonyms widen official-record recall around the confirmed event family and industry without asserting event facts.",
  };
}

function findCandidateDraft(modelContext, request) {
  const title = requiredString(request?.candidate?.title, "candidate title");
  const study = modelContext?.study;
  if (!isRecord(study)) {
    throw new Error("The Find host request omitted its confirmed study block.");
  }
  const population = requiredString(study.population, "study population");
  const industry = requiredString(study.industry, "study industry");
  const geography = requiredString(study.geography, "study geography");
  const studyPeriod = requiredString(study.studyPeriod, "study period");
  const outcomeFamily = requiredString(study.outcomeFamily, "outcome family");
  const sourceIds = sourceIdsFor(request);
  const studyFit = allowedCategory(request, "studyFit", "strong");
  const outcomePathway = allowedCategory(
    request,
    "outcomePathway",
    "plausible",
  );
  const measurementPotential = allowedCategory(
    request,
    "measurementPotential",
    "possible",
  );
  return pickRequested(requestedParts(request), {
    studyFit: {
      category: studyFit,
      explanation:
        `${title} is a provisional candidate for ${population} in the ${industry} industry in ${geography} during ${studyPeriod}; its cited timing and scope still require comparison with firm records.`,
      evidenceSourceIds: evidenceFor(studyFit, sourceIds),
    },
    outcomePathway: {
      category: outcomePathway,
      explanation:
        `${title} may create compliance, resource-allocation, or disclosure constraints that could matter for the confirmed ${outcomeFamily} outcome family.`,
      evidenceSourceIds: evidenceFor(outcomePathway, sourceIds),
    },
    measurementPotential: {
      category: measurementPotential,
      explanation:
        `${title} may be measured with dated public records and organization-level exposure indicators, while missing firm-level classification remains explicit.`,
      evidenceSourceIds: evidenceFor(measurementPotential, sourceIds),
    },
    mainConcern:
      `${title} may not map uniformly to the confirmed study population, so organization-level exposure should remain provisional.`,
    nextChecks: [
      `Compare ${title} timing and coverage with observable organization-level records for the confirmed study period.`,
    ],
  });
}

function findCriterionDraft(request) {
  const title = requiredString(request?.candidate?.title, "candidate title");
  const allowedResults = request?.draftContract?.allowedResults;
  if (!Array.isArray(allowedResults) || allowedResults.length === 0) {
    throw new Error("The signed criterion request omitted its allowed results.");
  }
  const result = allowedResults.includes("unclear")
    ? "unclear"
    : requiredString(allowedResults[0], "criterion result");
  return {
    result,
    reason:
      `${title} cannot be classified conclusively against this criterion from the bounded source packet alone, so the finding remains provisional.`,
    evidenceSourceIds:
      result === "unclear" ? [] : [firstString(sourceIdsFor(request), "evidence source")],
  };
}

function auditIdentity(request) {
  return requiredString(
    request?.sourcePacket?.match?.identity?.canonicalTitle,
    "Audit event title",
  );
}

function auditDossierDraft(request) {
  const title = auditIdentity(request);
  const sourceIds = sourceIdsFor(request);
  const evidenceSourceIds = [firstString(sourceIds, "evidence source")];
  const claim = (text) => ({
    text,
    evidenceSourceIds,
    uncertainty:
      "Later evidence review must retain source limits and distinguish each event stage.",
  });
  const dateLead = request?.sourcePacket?.match?.dateLeads?.find(
    (item) =>
      isRecord(item) &&
      typeof item.date === "string" &&
      /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(item.date) &&
      typeof item.stage === "string" &&
      request.draftContract.allowedDateLeadStages?.includes(item.stage),
  );
  const timeline = dateLead
    ? [
        {
          date: dateLead.date,
          label: `${title} source-backed event milestone`,
          stage: dateLead.stage,
          evidenceSourceIds,
          uncertainty:
            "This milestone is one event stage and is not automatically the study date.",
        },
      ]
    : [];
  const gaps = [
    "Evidence gap — relatedVersions: the bounded packet does not establish a separate related version.",
  ];
  if (timeline.length === 0) {
    gaps.push(
      "Evidence gap — timeline: the bounded packet does not supply a canonical dated milestone.",
    );
  }
  return pickRequested(requestedParts(request), {
    atAGlance: [
      claim(
        `${title} is the possible match represented by the bounded official-source packet.`,
      ),
    ],
    whatHappened: claim(
      `${title} is presented as a distinct institutional event with source-backed identity information.`,
    ),
    whatChanged: [
      claim(
        `${title} introduced documented duties or rights that may distinguish it from related events.`,
      ),
    ],
    timeline,
    broadCoverage: [
      claim(
        `${title} has a bounded coverage description, while organization-level eligibility remains a later classification task.`,
      ),
    ],
    keyComponents: [
      claim(
        `${title} includes documented operating components that users can inspect against the cited record.`,
      ),
    ],
    relatedVersions: [],
    unresolvedFacts: gaps,
  });
}

function auditAssessmentDraft(request) {
  const title = auditIdentity(request);
  const study = request?.sourcePacket?.study;
  if (!isRecord(study)) {
    throw new Error("The confirmed-event host request omitted its study block.");
  }
  const population = requiredString(study.population, "study population");
  const industry = requiredString(study.industry, "study industry");
  const geography = requiredString(study.geography, "study geography");
  const studyPeriod = requiredString(study.studyPeriod, "study period");
  const outcomeFamily = requiredString(study.outcomeFamily, "outcome family");
  const sourceIds = sourceIdsFor(request);
  const studyFit = allowedCategory(request, "studyFit", "strong");
  const outcomePathway = allowedCategory(
    request,
    "outcomePathway",
    "plausible",
  );
  const coverageRelation = allowedCategory(
    request,
    "coverageRelation",
    "mixed",
  );
  const measurementPotential = allowedCategory(
    request,
    "measurementPotential",
    "possible",
  );
  return pickRequested(requestedParts(request), {
    studyFit: {
      category: studyFit,
      explanation:
        `${title} is a provisional fit for ${population} in the ${industry} industry in ${geography} during ${studyPeriod}, subject to organization-level coverage checks.`,
      evidenceSourceIds: evidenceFor(studyFit, sourceIds),
    },
    outcomePathway: {
      category: outcomePathway,
      explanation:
        `${title} may create compliance or resource constraints that could matter for the confirmed ${outcomeFamily} outcome family.`,
      evidenceSourceIds: evidenceFor(outcomePathway, sourceIds),
    },
    coverageRelation: {
      category: coverageRelation,
      explanation:
        `${title} has source-backed coverage language, but mapping it to ${population} requires organization-level historical classification.`,
      evidenceSourceIds: evidenceFor(coverageRelation, sourceIds),
    },
    measurementPotential: {
      category: measurementPotential,
      explanation:
        `${title} may be represented with dated public records and organization-level indicators, while missing exposure data remain explicit.`,
      evidenceSourceIds: evidenceFor(measurementPotential, sourceIds),
    },
    mainConcern:
      `${title} has several possible event stages and coverage boundaries that should remain separate in later design work.`,
    nextChecks: [
      `Compare ${title} coverage with historical organization-level records for the confirmed population.`,
      `Keep each ${title} milestone separate when evaluating the study design.`,
    ],
  });
}

export function buildScreen02HostDraft(modelContext, request) {
  const mode = request?.draftContract?.mode ?? request?.mode;
  if (mode === "find-discovery-plan") {
    return findDiscoveryPlanDraft(modelContext);
  }
  if (mode === "find-candidate") return findCandidateDraft(modelContext, request);
  if (mode === "find-criterion") return findCriterionDraft(request);
  if (mode === "audit-dossier") return auditDossierDraft(request);
  if (mode === "audit-confirmed-event") return auditAssessmentDraft(request);
  throw new Error("The signed host request advertised an unsupported assessment mode.");
}

export function buildScreen03HostDraft(batch) {
  const request = batch?.sourcePacket?.request;
  if (!isRecord(request) || !Array.isArray(request.proposals) || request.proposals.length === 0) {
    throw new Error("The Screen 3 host batch omitted its bounded proposals.");
  }
  const proposals = request.proposals;
  const firstProposal = proposals[0];
  const firstProposalId = requiredString(firstProposal?.proposalId, "proposal ID");
  const population = requiredString(
    request.studyContext?.population,
    "study population",
  );
  const outcomeFamily = requiredString(
    request.studyContext?.outcomeFamily,
    "outcome family",
  );
  const grounded = (proposal, prefix, maximum) => {
    const label = requiredString(proposal?.label, "proposal label");
    const value = requiredString(proposal?.value, "proposal value");
    const stopWords = new Set([
      "a", "an", "and", "are", "as", "at", "be", "been", "being", "but",
      "by", "for", "from", "has", "have", "in", "is", "it", "its", "of",
      "on", "or", "that", "the", "their", "this", "to", "was", "were",
      "which", "with",
    ]);
    const summaryTerms = (value
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((word) => word.length >= 3 || /^\d+$/u.test(word))
      .filter((word) => !stopWords.has(word.toLocaleLowerCase("en-US")))
      .filter((word, index, words) =>
        words.findIndex((candidate) =>
          candidate.toLocaleLowerCase("en-US") ===
            word.toLocaleLowerCase("en-US")
        ) === index
      )
      .slice(0, 12);
    const reorderedTerms = [
      ...summaryTerms.filter((_, index) => index % 2 === 0),
      ...summaryTerms.filter((_, index) => index % 2 === 1),
    ];
    const shortLabel = label.split(/\s+/u).slice(0, 4).join(" ");
    const paraphrasedValue = reorderedTerms.length > 0
      ? reorderedTerms.join(", ")
      : value;
    return `${prefix} ${shortLabel}: ${paraphrasedValue}.`
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum);
  };
  const nonIdentityGroups = new Set(
    proposals
      .map((proposal) => proposal.group)
      .filter((group) => group !== "identity"),
  );
  const requiredKeyPointCount = proposals.length >= 3 &&
      nonIdentityGroups.size >= 2
    ? 3
    : 1;
  const keyPointProposals = requiredKeyPointCount === 1
    ? [firstProposal]
    : [
        ...proposals.filter((proposal, index, values) =>
          proposal.group !== "identity" &&
          values.findIndex((candidate) =>
              candidate.group === proposal.group &&
              candidate.group !== "identity"
            ) === index
        ),
        ...proposals,
      ].filter((proposal, index, values) =>
        values.findIndex((candidate) =>
          candidate.proposalId === proposal.proposalId
        ) === index
      ).slice(0, requiredKeyPointCount);
  return {
    snapshot: {
      intro: {
        text: grounded(
          firstProposal,
          "In plain language, the official source describes",
          340,
        ),
        proposalIds: [firstProposalId],
      },
      keyPoints: keyPointProposals.map((proposal) => ({
          text: grounded(
            proposal,
            "A key source-backed point is",
            340,
          ),
          proposalIds: [requiredString(proposal.proposalId, "proposal ID")],
        })),
    },
    studyRelevance: {
      sampleConnection: {
        text: grounded(
          firstProposal,
          `${population} may differ under`,
          340,
        ),
        proposalIds: [firstProposalId],
      },
      outcomeConnection: {
        text: grounded(
          firstProposal,
          `${outcomeFamily} may relate to`,
          340,
        ),
        proposalIds: [firstProposalId],
      },
    },
    claimExplanations: proposals.map((proposal) => ({
      proposalId: requiredString(proposal.proposalId, "proposal ID"),
      text: grounded(
        proposal,
        "In plain language, this source-backed claim states",
        260,
      ),
    })),
  };
}
