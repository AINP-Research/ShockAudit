const providerSpecificUiTerms = [
  [
    /\bSource-derived\s+fixed\s+fallback\b/gu,
    "Source-derived alternative",
  ],
  [
    /\bsource-derived\s+fixed\s+fallback\b/giu,
    "source-derived alternative",
  ],
  [
    /\bnot\s+a\s+ChatGPT\s+interpretation\b/giu,
    "not an assisted interpretation",
  ],
  [
    /\bChatGPT\s+host\s+model\s+MCP\s+provider\s+fallback\s+reasoning\s+tool\b/giu,
    "assisted review alternate path",
  ],
  [/\bChatGPT\s+host\s+model\b/giu, "assisted review"],
  [/\bChatGPT\s+model\b/giu, "assisted review"],
  [/\bhost\s+model\s+inference\b/giu, "assisted interpretation"],
  [/\bChatGPT[- ]assisted\b/giu, "assisted"],
  [/\bChatGPT[- ]generated\b/giu, "assisted"],
  [/\bWorkers\s+AI\b/giu, "assisted review"],
  [/\bMCP\s+Apps\b/giu, "the workspace"],
  [/\bMCP\s+host\b/giu, "the workspace"],
  [/\bMCP\s+provider\s+fallback\b/giu, "alternate workspace path"],
  [/\bhost[- ]assisted\b/giu, "supplemental"],
  [/\bhost[- ]global\b/giu, "supplemental"],
  [/\bhost[- ]proposed\b/giu, "supplemental"],
  [/\bhost\s+(?:reasoning|model|metadata|task|discovery)\b/giu, "assisted review"],
  [/\b(?:this|the|current)\s+host\b/giu, "this view"],
  [/\bfixed\s+fallback\b/giu, "source-derived alternative"],
  [/\bprovider\s+fallback\s+tool\b/giu, "alternate path"],
  [/\b(?:provider|global|conservative)\s+fallback\b/giu, "alternate path"],
  [/\bthis\s+fallback\b/giu, "this alternate path"],
  [/\bthe\s+fallback\b/giu, "the alternate path"],
  [/\b(?:reasoning\s+tool|tool\s+result)\b/giu, "review result"],
  [/\bmodel[- ]tool\b/giu, "review result"],
  [/\bmodel[- ]generated\b/giu, "assisted"],
  [/\bmodel\s+(?:response|result|output|review)\b/giu, "review result"],
  [/\blanguage\s+model\b/giu, "assisted review"],
  [/\bAI\s+inference\b/giu, "preliminary interpretation"],
  [/\bAI[- ]assisted\b/giu, "assisted"],
  [/\bChatGPT\b/giu, "assisted review"],
  [/\bMCP\b/giu, "workspace"],
] as const;

/**
 * Projects implementation-facing Screen 2 provenance into task-oriented copy.
 * The canonical workflow value is never rewritten; this is a display boundary.
 */
export function screen02ProviderNeutralCopy(value: string) {
  return providerSpecificUiTerms.reduce(
    (copy, [pattern, replacement]) => copy.replace(pattern, replacement),
    value,
  );
}
