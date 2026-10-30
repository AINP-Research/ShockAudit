import type { Screen02DateLeadStage } from "../core/screen02-workflow-types";
import { fingerprintScreen02WorkflowValue } from "../core/screen02-workflow-state";
import {
  requireScreen03ResearchPacket,
  screen03EvidenceItemProvidesAuthoritativeDirectSupport,
  screen03EvidenceItemProvidesDirectSupportForProposal,
  screen03PassageBasisProvidesDirectSupport,
  screen03PassageProvidesDirectSupport,
  type Screen03AnyProposal,
  type Screen03Contradiction,
  type Screen03ResearchPacket,
  type Screen03TimelineProposal,
} from "../core/screen03-workflow";
import {
  screen03EvidenceSourceRole,
  screen03EvidenceTextHasUnsafeInstruction,
} from "./screen03-evidence-synthesis";
import { fuseScreen03ProposalSources } from "./screen03-source-fusion";

const MAX_PER_STAGE = 4;
const MAX_TOTAL = 12;
const MONTHS = [
  ["january", "jan"],
  ["february", "feb"],
  ["march", "mar"],
  ["april", "apr"],
  ["may"],
  ["june", "jun"],
  ["july", "jul"],
  ["august", "aug"],
  ["september", "sep", "sept"],
  ["october", "oct"],
  ["november", "nov"],
  ["december", "dec"],
] as const;

type ExtractedStage = Extract<
  Screen02DateLeadStage,
  | "announcement"
  | "enactment"
  | "effective"
  | "enforcement"
  | "amendment"
  | "occurrence"
>;

type ExtractedClock = {
  stage: ExtractedStage;
  label: string;
  date: string;
  scope: string | null;
  sourceIds: string[];
  passageIds: string[];
  precursor: boolean;
};

const DATE_TOKEN = String.raw`(?:\d{4}-\d{2}-\d{2}|(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,)?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\.?(?:\s*,)?\s+\d{4})`;
const DATE = String.raw`(?<![\p{L}\p{N}_-])${DATE_TOKEN}(?![\p{L}\p{N}_-])`;

const STAGE_MARKERS: Readonly<Record<ExtractedStage, string>> = {
  announcement:
    String.raw`\b(?:announc(?:e|ed|ement|ing)|entered\s+circulation|cleared\s+(?:for|to\s+begin)\s+(?:circulation|collecting))\b`,
  enactment: String.raw`\b(?:signed\s+into\s+law|enacted|adopted)\b`,
  effective: String.raw`\b(?:(?:went|goes?)\s+into\s+effect|(?:took|takes?)\s+effect|effective(?:\s+date)?)\b`,
  enforcement: String.raw`\b(?:enforc(?:e|ed|ement|ing)|enforceable)\b`,
  amendment:
    String.raw`\b(?:amended|amending|renew(?:ed|al|ing)?|delay(?:ed|s|ing)?|extend(?:ed|s|ing)?|extension|deadline|postpon(?:ed|ement|ing)?|repeal(?:ed|ing)?|supersed(?:ed|ing)?)\b`,
  occurrence:
    String.raw`\b(?:made\s+(?:a\s+)?(?:first|second|final)?\s*landfall|landfall(?:ed)?|occurred|incident\s+(?:began|started)|event\s+(?:began|started)|hazard\s+(?:began|started)|onset)\b`,
};

const RULES: readonly {
  stage: ExtractedStage;
  label: string;
  patterns: readonly string[];
}[] = [
  {
    stage: "announcement",
    label: "Announcement or public-discussion date",
    patterns: [
      String.raw`\b(?:announc(?:e|ed|ement|ing)|entered\s+circulation|cleared\s+(?:for|to\s+begin)\s+(?:circulation|collecting(?:\s+petition\s+signatures)?))\b[^.!?;]{0,90}?\b(${DATE})`,
      String.raw`(${DATE})[^.!?;]{0,90}?\b(?:announc(?:e|ed|ement|ing)|entered\s+circulation|cleared\s+(?:for|to\s+begin)\s+(?:circulation|collecting(?:\s+petition\s+signatures)?))\b`,
    ],
  },
  {
    stage: "enactment",
    label: "Enactment or signing date",
    patterns: [
      String.raw`\b(?:signed\s+into\s+law|enacted|adopted)\b[^.!?;]{0,60}?\b(${DATE})`,
      String.raw`(${DATE})[^.!?;]{0,60}?\b(?:was\s+signed\s+into\s+law|was\s+enacted|was\s+adopted)\b`,
    ],
  },
  {
    stage: "effective",
    label: "Effective date or application",
    patterns: [
      String.raw`\b(?:(?:went|goes?)\s+into\s+effect|(?:took|takes?)\s+effect|effective(?:\s+date)?(?:\s+is)?)\b[^.!?;]{0,60}?\b(${DATE})`,
      String.raw`(${DATE})[^.!?;]{0,60}?\b(?:(?:went|goes?)\s+into\s+effect|(?:took|takes?)\s+effect|effective)\b`,
    ],
  },
  {
    stage: "enforcement",
    label: "Enforcement start date",
    patterns: [
      String.raw`\b(?:enforc(?:e|ed|ement|ing)|enforceable)\b[^.!?;]{0,60}?\b(?:begin(?:ning)?|start(?:ing|ed|s)?|from|on)?\s*(${DATE})`,
      String.raw`(${DATE})[^.!?;]{0,60}?\b(?:enforcement\s+(?:began|begins|started|starts)|(?:was|is|became|becomes)\s+enforceable)\b`,
    ],
  },
  {
    stage: "amendment",
    label: "Amendment, delay, or deadline-extension date",
    patterns: [
      String.raw`\b(?:amend(?:ed|ment|ing)?|renew(?:ed|al|ing)?|delay(?:ed|s|ing)?|extend(?:ed|s|ing)?|extension|deadline|postpon(?:ed|ement|ing)?|repeal(?:ed|ing)?|supersed(?:ed|ing)?)\b[^.!?;]{0,120}?\b(${DATE})`,
      String.raw`(${DATE})[^.!?;]{0,120}?\b(?:amend(?:ed|ment|ing)?|renew(?:ed|al|ing)?|delay(?:ed|s|ing)?|extend(?:ed|s|ing)?|extension|deadline|postpon(?:ed|ement|ing)?|repeal(?:ed|ing)?|supersed(?:ed|ing)?)\b`,
    ],
  },
  {
    stage: "occurrence",
    label: "Occurrence or landfall date",
    patterns: [
      String.raw`\b(?:made\s+(?:a\s+)?(?:first|second|final)?\s*landfall|landfall(?:ed)?|occurred|incident\s+(?:began|started)|event\s+(?:began|started)|hazard\s+(?:began|started)|onset)\b[\s\S]{0,180}?\b(${DATE})`,
      String.raw`(${DATE})[\s\S]{0,180}?\b(?:made\s+(?:a\s+)?(?:first|second|final)?\s*landfall|landfall(?:ed)?|occurred|incident\s+(?:began|started)|event\s+(?:began|started)|hazard\s+(?:began|started)|onset)\b`,
    ],
  },
] as const;

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function calendarDate(value: string) {
  const clean = value.normalize("NFKC").trim();
  if (clean.length === 10) {
    const iso = validDate(clean);
    if (iso) return iso;
  }
  const monthIndex = new Map<string, number>(
    MONTHS.flatMap((aliases, index) =>
      aliases.map((alias) => [alias, index + 1] as const)
    ),
  );
  const plain = clean.toLocaleLowerCase("en-US").replace(/\./g, "")
    .replace(/,/g, " ").replace(/(\d)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/\s+/g, " ").trim();
  const monthFirst = /^(\p{L}+)\s+(\d{1,2})\s+(\d{4})$/u.exec(plain);
  const dayFirst = /^(\d{1,2})\s+(\p{L}+)\s+(\d{4})$/u.exec(plain);
  const monthName = monthFirst?.[1] ?? dayFirst?.[2];
  const day = Number(monthFirst?.[2] ?? dayFirst?.[1]);
  const year = monthFirst?.[3] ?? dayFirst?.[3];
  const month = monthName ? monthIndex.get(monthName) : undefined;
  return year && month && Number.isSafeInteger(day)
    ? validDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
    : null;
}

function abbreviatedMonthPeriod(text: string, index: number) {
  return text[index] === "." && /^\s+\d/u.test(text.slice(index + 1)) &&
    /(?:^|[^\p{L}])(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/iu
      .test(text.slice(Math.max(0, index - 5), index));
}

function statements(text: string) {
  const result: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (!".!?;".includes(character) ||
      (character === "." && abbreviatedMonthPeriod(text, index))) continue;
    let end = index + 1;
    while (end < text.length && ".!?;".includes(text[end]!)) end += 1;
    if (end < text.length && !/\s/u.test(text[end]!)) continue;
    result.push(text.slice(start, end));
    start = end;
    index = end - 1;
  }
  if (start < text.length) result.push(text.slice(start));
  return (result.length > 0 ? result : [text])
    .map((value) => value.replace(/\s+/g, " ").trim().slice(0, 1_600))
    .filter((value) => normalized(value).length >= 20)
    .slice(0, 24);
}

function timelineClauses(statement: string) {
  const stageStart = String.raw`(?:announc|entered\s+circulation|cleared\s+|signed\s+into\s+law|enacted|adopted|went\s+into\s+effect|goes?\s+into\s+effect|took\s+effect|takes?\s+effect|effective|enforc|amend|renew|delay|extend|extension|deadline|postpon|repeal|supersed)`;
  return statement
    .split(new RegExp(
      String.raw`\s+(?:and|but)\s+(?=(?:the\s+\p{L}+|it|this|that|will|was|is|became|becomes)?\s*${stageStart})`,
      "iu",
    ))
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function ambiguousPair(
  value: string,
  stage: ExtractedStage,
  relatedRecord: boolean,
) {
  const dates = value.match(new RegExp(DATE, "giu")) ?? [];
  return dates.length !== 1 || Object.entries(STAGE_MARKERS).some(
    ([candidate, marker]) =>
      candidate !== stage &&
      !(relatedRecord && stage === "amendment" && candidate === "announcement") &&
      !(
        stage === "amendment" &&
        candidate === "enactment" &&
        /\badopted\b[\s\S]{0,80}\bamendment\b/iu.test(value)
      ) &&
      new RegExp(marker, "iu").test(value),
  );
}

function extractedScopeDescriptor(value: string) {
  const matches = value.match(
    /\b(?:(?:phase|group|class)\s+(?:\d+|one|two|three|four|five|first|second|third|fourth|fifth)|(?:\d+|first|second|third|fourth|fifth)\s+(?:phase|group|class)|(?:small|large)\s+(?:business(?:es)?|entit(?:y|ies)|firms?)|threshold\s+(?:of\s+)?[$€£]?\d[\d,.%]*)\b/giu,
  ) ?? [];
  const distinct = [...new Set(matches.map((match) => match.trim()))];
  return distinct.length > 0 ? distinct.join("; ").slice(0, 160) : null;
}

function extractedMilestoneKind(stage: ExtractedStage, label: string) {
  const text = normalized(label);
  if (stage === "amendment") {
    if (/\brenew\w*\b/u.test(text)) return "renewal";
    if (/\b(?:deadline|delay\w*|extend\w*|extension|postpon\w*)\b/u.test(text)) {
      return "deadline-delay";
    }
    if (/\brepeal\w*\b/u.test(text)) return "repeal";
    if (/\bsupersed\w*\b/u.test(text)) return "supersession";
  }
  if (stage === "announcement" && /\bcirculat\w*\b/u.test(text)) {
    return "precursor-circulation";
  }
  return stage;
}

function extractedAmendmentLabel(clause: string) {
  if (/\bcharter\b[\s\S]{0,100}\brenew\w*\b/iu.test(clause)) {
    return "Charter renewal date";
  }
  if (/\brenew\w*\b/iu.test(clause)) return "Renewal date";
  if (/\b(?:deadline|extend\w*|delay\w*|postpon\w*)\b/iu.test(clause)) {
    return "Deadline extension or delay date";
  }
  if (/\bsupersed\w*\b/iu.test(clause)) return "Supersession date";
  if (/\brepeal\w*\b/iu.test(clause)) return "Repeal date";
  return "Amendment date";
}

function scopeKey(value: string) {
  const tokens = normalized(value).split(" ").filter(Boolean);
  const anchor = /^(?:small|large|business|businesses|entity|entities|firm|firms|phase|group|class|threshold)$/u;
  const qualifier = /^(?:\d+|one|two|three|four|five|first|second|third|fourth|fifth)$/u;
  return tokens.filter((token, index) =>
    anchor.test(token) ||
    (qualifier.test(token) &&
      (anchor.test(tokens[index - 1] ?? "") ||
        anchor.test(tokens[index + 1] ?? "")))
  ).join(" ");
}

function clockMatchesProposal(
  proposal: Screen03TimelineProposal,
  clock: ExtractedClock,
) {
  if (proposal.stage !== clock.stage || proposal.date !== clock.date) {
    return false;
  }
  if (
    extractedMilestoneKind(clock.stage, proposal.label) !==
      extractedMilestoneKind(clock.stage, clock.label)
  ) {
    return false;
  }
  return scopeKey(`${proposal.label} ${proposal.uncertainty ?? ""}`) ===
    scopeKey(clock.scope ?? "");
}

function federalRegisterDocumentNumber(value: string) {
  return [
    ...value.matchAll(
      /(?<![\p{L}\p{N}])(\d{4}-\d{4,8})(?![\p{L}\p{N}])/gu,
    ),
  ].at(-1)?.[1] ?? null;
}

function identityValues(
  packet: Screen03ResearchPacket,
  aliases: readonly string[],
) {
  const valueFor = (label: RegExp) =>
    packet.proposals.identity.find((proposal) => label.test(proposal.label))
      ?.value ?? null;
  return {
    canonicalTitle: valueFor(/^Canonical event title$/iu),
    formalIdentifier: valueFor(/^Formal identifier$/iu),
    aliases: [
      ...aliases,
      ...packet.proposals.identity
        .filter((proposal) => /common name/iu.test(proposal.label))
        .map((proposal) => proposal.value),
    ],
    selectedEvidenceIds: new Set(
      packet.proposals.identity
        .filter((proposal) =>
          /^(?:Canonical event title|Formal identifier)$/iu.test(proposal.label)
        )
        .flatMap((proposal) => proposal.sourceIds),
    ),
  };
}

function evidenceIdentityScope(
  packet: Screen03ResearchPacket,
  item: Screen03ResearchPacket["evidence"][number],
  aliases: readonly string[],
) {
  const role = screen03EvidenceSourceRole(item);
  if (role === "related-official-record") return "related" as const;
  const identity = identityValues(packet, aliases);
  const expectedDocumentNumber = federalRegisterDocumentNumber(
    identity.formalIdentifier ?? "",
  );
  const observedDocumentNumbers = new Set([
    federalRegisterDocumentNumber(item.locator),
    ...item.passages
      .filter((passage) => passage.basis === "official-record-field")
      .map((passage) => federalRegisterDocumentNumber(passage.text)),
  ].filter((value): value is string => Boolean(value)));
  if (
    expectedDocumentNumber &&
    observedDocumentNumbers.size > 0 &&
    !observedDocumentNumbers.has(expectedDocumentNumber)
  ) {
    return "ungrounded" as const;
  }
  if (
    expectedDocumentNumber &&
    observedDocumentNumbers.has(expectedDocumentNumber)
  ) {
    return "selected" as const;
  }
  if (identity.selectedEvidenceIds.has(item.id)) return "selected" as const;
  const anchors = [identity.canonicalTitle, ...identity.aliases]
    .filter((value): value is string => Boolean(value))
    .map(normalized)
    .filter((value) => value.length >= 4);
  const groundedText = normalized([
    item.title,
    ...item.passages
      .filter((passage) => passage.basis !== "source-metadata")
      .map((passage) => passage.text),
  ].join(" "));
  return anchors.some((anchor) =>
      ` ${groundedText} `.includes(` ${anchor} `)
    )
    ? "selected" as const
    : "ungrounded" as const;
}

function extract(
  packet: Screen03ResearchPacket,
  identityAliases: readonly string[],
) {
  const clocks: ExtractedClock[] = [];
  const byKey = new Map<string, ExtractedClock>();
  const counts = new Map<ExtractedStage, number>();
  for (const item of packet.evidence.slice(0, 5)) {
    const authoritative =
      screen03EvidenceItemProvidesAuthoritativeDirectSupport(item);
    const precursorAnnouncement =
      screen03EvidenceItemProvidesDirectSupportForProposal(item, {
        group: "timeline",
        label: "announcement",
        stage: "announcement",
      });
    if (!authoritative && !precursorAnnouncement) continue;
    const identityScope = evidenceIdentityScope(
      packet,
      item,
      identityAliases,
    );
    if (identityScope === "ungrounded") continue;
    const relatedRecord = identityScope === "related";
    const precursor =
      screen03EvidenceSourceRole(item) === "precursor-official-record";
    for (const passage of item.passages.slice(0, 5)) {
      if (
        passage.locator === null ||
        !screen03PassageBasisProvidesDirectSupport(passage.basis, "timeline") ||
        screen03EvidenceTextHasUnsafeInstruction(passage.text)) continue;
      if (
        ["scientific-hazard-record", "institutional-hazard-record"].includes(
          screen03EvidenceSourceRole(item),
        )
      ) {
        const occurrenceRule = RULES.find((rule) =>
          rule.stage === "occurrence"
        )!;
        for (const pattern of occurrenceRule.patterns) {
          for (const match of passage.text.matchAll(new RegExp(pattern, "giu"))) {
            const date = calendarDate(match[1] ?? "");
            if (!date || ambiguousPair(match[0], "occurrence", relatedRecord)) {
              continue;
            }
            const key = `occurrence:${date}:occurrence:`;
            const prior = byKey.get(key);
            if (prior) {
              if (!prior.sourceIds.includes(item.id)) prior.sourceIds.push(item.id);
              if (!prior.passageIds.includes(passage.id)) {
                prior.passageIds.push(passage.id);
              }
              continue;
            }
            if (
              clocks.length >= MAX_TOTAL ||
              (counts.get("occurrence") ?? 0) >= MAX_PER_STAGE
            ) continue;
            const clock = {
              stage: "occurrence" as const,
              label: occurrenceRule.label,
              date,
              scope: null,
              sourceIds: [item.id],
              passageIds: [passage.id],
              precursor: false,
            };
            clocks.push(clock);
            byKey.set(key, clock);
            counts.set("occurrence", (counts.get("occurrence") ?? 0) + 1);
          }
        }
      }
      for (const statement of statements(passage.text)) {
        for (const clause of timelineClauses(statement)) {
          for (const rule of RULES) {
            if (rule.stage === "occurrence") continue;
            if (relatedRecord && rule.stage !== "amendment") continue;
            if (precursor && rule.stage !== "announcement") continue;
            if (!authoritative && rule.stage !== "announcement") continue;
            if (
              rule.stage === "enactment" &&
              /\badopted\b[\s\S]{0,80}\bamendment\b/iu.test(clause)
            ) {
              continue;
            }
            for (const pattern of rule.patterns) {
              for (const match of clause.matchAll(new RegExp(pattern, "giu"))) {
              const date = calendarDate(match[1] ?? "");
                if (!date || ambiguousPair(match[0], rule.stage, relatedRecord)) {
                  continue;
                }
              const label =
                rule.stage === "announcement" && precursor
                  ? "Precursor privacy initiative cleared for circulation"
                  : rule.stage === "amendment"
                    ? extractedAmendmentLabel(clause)
                    : rule.label;
              const extractedScope = extractedScopeDescriptor(clause);
              const key = [
                rule.stage,
                date,
                extractedMilestoneKind(rule.stage, label),
                scopeKey(extractedScope ?? ""),
              ].join(":");
              const prior = byKey.get(key);
              if (prior) {
                if (!prior.sourceIds.includes(item.id)) prior.sourceIds.push(item.id);
                if (!prior.passageIds.includes(passage.id)) prior.passageIds.push(passage.id);
                // A clock corroborated by a non-precursor official record is
                // no longer described solely as a precursor milestone.
                prior.precursor = prior.precursor && precursor;
                continue;
              }
              if (clocks.length >= MAX_TOTAL ||
                (counts.get(rule.stage) ?? 0) >= MAX_PER_STAGE) continue;
              const clock = {
                stage: rule.stage,
                label,
                date,
                scope: extractedScope,
                sourceIds: [item.id],
                passageIds: [passage.id],
                precursor,
              };
              clocks.push(clock);
              byKey.set(key, clock);
              counts.set(rule.stage, (counts.get(rule.stage) ?? 0) + 1);
              }
            }
          }
        }
      }
    }
  }
  return clocks;
}

function stableId(prefix: string, value: string) {
  const slug = normalized(value).replace(/\s+/g, "-").slice(0, 66) || "item";
  return `${prefix}-${slug}-${fingerprintScreen02WorkflowValue(value).slice(-8)}`
    .slice(0, 100);
}

function scope(proposal: Screen03AnyProposal) {
  const value = normalized(proposal.uncertainty ?? "");
  return /\b(?:appl\w*|cover\w*|entit\w*|firms?|business\w*|small|large|phase|group|class|threshold|before|after)\b/u
      .test(value)
    ? value
    : "";
}

function sourceConflicts(timeline: readonly Screen03TimelineProposal[]) {
  const groups = new Map<string, Screen03TimelineProposal[]>();
  for (const proposal of timeline) {
    if (proposal.support === "unsupported" || proposal.sourceIds.length === 0 ||
      proposal.passageIds.length === 0) continue;
    const key = [proposal.stage, normalized(proposal.label), scope(proposal)].join(":");
    const group = groups.get(key) ?? [];
    group.push(proposal);
    groups.set(key, group);
  }
  const result: Screen03Contradiction[] = [];
  for (const candidates of groups.values()) {
    const dates = [...new Set(candidates.map((item) => item.date))];
    if (dates.length < 2) continue;
    const first = candidates[0]!;
    result.push({
      id: stableId("screen03-contradiction", `${first.stage}:${normalized(first.label)}:${dates.join(":")}`),
      kind: "source-conflict",
      proposalIds: candidates.map((item) => item.id),
      summary: `Sources assign incompatible dates to the same “${first.label}” milestone (${dates.join(", ")}). Distinct phase-in or compliance milestones remain separate and are not treated as contradictions.`,
      status: "unresolved",
      resolution: null,
    });
  }
  return result;
}

function exactAliasProposals(
  input: Screen03ResearchPacket,
  aliases: readonly string[],
) {
  const proposals = [...input.proposals.identity];
  for (const alias of [...new Set(aliases)].sort((a, b) => b.length - a.length).slice(0, 8)) {
    const aliasToken = normalized(alias);
    if (aliasToken.length < 4 || proposals.some(
      (proposal) => normalized(proposal.value) === aliasToken,
    )) continue;
    const owners = input.evidence
      .filter(screen03EvidenceItemProvidesAuthoritativeDirectSupport)
      .map(
      (item) => ({
        item,
        passages: item.passages.filter((passage) =>
          passage.locator !== null &&
          screen03PassageProvidesDirectSupport(passage, {
            group: "identity",
            label: "Verified common name",
          }) &&
          !screen03EvidenceTextHasUnsafeInstruction(passage.text) &&
          ` ${normalized(passage.text)} `.includes(` ${aliasToken} `)
        ),
      }),
    ).filter((owner) => owner.passages.length > 0);
    if (owners.length === 0) continue;
    proposals.push({
      id: stableId("screen03-proposal", `identity:verified-common-name:${alias}`),
      group: "identity",
      label: "Verified common name",
      value: alias,
      critical: true,
      reviewStatus: "proposed",
      editedValue: null,
      support: "direct",
      sourceIds: owners.map((owner) => owner.item.id),
      passageIds: owners.flatMap((owner) => owner.passages.map((passage) => passage.id)),
      uncertainty: "The exact common name appears in an active source excerpt; the researcher must confirm that it identifies the selected event.",
    });
  }
  return proposals;
}

export function compileScreen03ExactExcerpts(
  input: Screen03ResearchPacket,
  identityAliases: readonly string[] = [],
): Screen03ResearchPacket {
  const timeline = input.proposals.timeline.map((proposal) => ({ ...proposal }));
  for (const clock of extract(input, identityAliases)) {
    const existing = timeline.find((proposal) =>
      clockMatchesProposal(proposal, clock)
    );
    if (existing) {
      const wasDirect = existing.support === "direct";
      existing.support = "direct";
      existing.sourceIds = wasDirect
        ? [...new Set([...existing.sourceIds, ...clock.sourceIds])]
        : clock.sourceIds;
      existing.passageIds = wasDirect
        ? [...new Set([...existing.passageIds, ...clock.passageIds])]
        : clock.passageIds;
      continue;
    }
    timeline.push({
      id: stableId(
        "screen03-proposal",
        `excerpt-timeline:${clock.stage}:${clock.date}:${clock.label}:${clock.scope ?? ""}`,
      ),
      group: "timeline",
      label: clock.label,
      value: clock.date,
      critical: true,
      reviewStatus: "proposed",
      editedValue: null,
      support: "direct",
      sourceIds: clock.sourceIds,
      passageIds: clock.passageIds,
      uncertainty: [
        clock.precursor
          ? "This official date concerns a precursor ballot initiative, not the selected law's introduction or enactment; the researcher must decide whether it belongs in the empirical design."
          : "Fixed extraction from an exact source excerpt; the researcher must decide whether this is the focal event clock.",
        clock.scope ? `Source scope: ${clock.scope}.` : "",
      ].filter(Boolean).join(" "),
      stage: clock.stage,
      date: clock.date,
    });
  }
  const hasEnforcement = timeline.some((proposal) => proposal.stage === "enforcement");
  const amendment = hasEnforcement
    ? input.proposals.amendment.filter((proposal) =>
        !(proposal.label === "Enforcement timing" && proposal.support === "unsupported")
      )
    : input.proposals.amendment;
  const sourceFusion = fuseScreen03ProposalSources({
    ...input.proposals,
    identity: exactAliasProposals(input, identityAliases),
    timeline,
    amendment,
  }, input.evidence);
  const retainedProposalIds = new Set(
    Object.values(sourceFusion.proposals)
      .flat()
      .map((proposal) => proposal.id),
  );
  const retainedContradictions = input.contradictions
    .map((contradiction) => ({
      ...contradiction,
      proposalIds: contradiction.proposalIds.filter((proposalId) =>
        retainedProposalIds.has(proposalId)
      ),
    }))
    .filter((contradiction) => contradiction.proposalIds.length > 0);
  const addedContradictions = sourceFusion.conflicts.map((conflict) => ({
    id: stableId(
      "screen03-contradiction",
      `source-fusion:${conflict.representativeProposalId}:${conflict.summary}`,
    ),
    kind: "source-conflict" as const,
    proposalIds: [conflict.representativeProposalId],
    summary: conflict.summary,
    status: "unresolved" as const,
    resolution: null,
  }));
  // Prefer the freshly recomputed conflict when both passes describe the same
  // surviving proposal. A retained conflict remains the fallback when this
  // pass has only the previously fused representative and cannot rediscover
  // the discarded alternative.
  const contradictions = [...addedContradictions, ...retainedContradictions]
    .filter((contradiction, index, values) =>
      values.findIndex((candidate) =>
        candidate.kind === contradiction.kind &&
        candidate.proposalIds.join(":") === contradiction.proposalIds.join(":")
      ) === index
    );
  return requireScreen03ResearchPacket({
    ...input,
    proposals: sourceFusion.proposals,
    contradictions,
  });
}
