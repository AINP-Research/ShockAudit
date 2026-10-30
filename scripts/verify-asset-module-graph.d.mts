export function localJavaScriptModuleSpecifiers(source: string): string[];

export type AssetModuleGraph = {
  entryPath: string;
  modulePaths: string[];
  edges: Array<{ from: string; to: string }>;
};

export function verifyAssetModuleGraph(options: {
  entryUrl: string;
  publicOrigin: string;
  expectedCommitShort: string;
  expectedReleaseLabel: string;
  requiredEntrySpecifiers?: string[];
  fetchModule: (moduleUrl: string) => Promise<string>;
}): Promise<AssetModuleGraph>;
