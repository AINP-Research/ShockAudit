import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import * as fullZod from "zod";

import runtimeZod, * as runtimeSurface from "../../src/ui/zod-v4-runtime";

const expectedRuntimeKeys = [
  "any",
  "array",
  "boolean",
  "config",
  "custom",
  "describe",
  "discriminatedUnion",
  "enum",
  "intersection",
  "iso",
  "literal",
  "looseObject",
  "never",
  "null",
  "number",
  "object",
  "optional",
  "preprocess",
  "record",
  "safeParse",
  "string",
  "toJSONSchema",
  "undefined",
  "union",
  "unknown",
] as const;

describe("pinned MCP Zod browser runtime surface", () => {
  it("maps every exposed constructor to the installed Zod 4 runtime", () => {
    expect(Object.keys(runtimeZod).sort()).toEqual(
      [...expectedRuntimeKeys].sort(),
    );
    expect(Object.isFrozen(runtimeZod)).toBe(true);
    for (const key of expectedRuntimeKeys) {
      expect(runtimeZod[key]).toBe(fullZod[key]);
      expect(runtimeSurface[key]).toBe(fullZod[key]);
    }
  });

  it("parses the MCP tool-result contract and emits JSON Schema", () => {
    expect(
      CallToolResultSchema.safeParse({
        content: [{ type: "text", text: "source-grounded result" }],
        structuredContent: { accepted: true },
      }).success,
    ).toBe(true);

    const schema = runtimeZod.toJSONSchema(
      runtimeZod.object({ value: runtimeZod.string() }),
      { io: "input" },
    );
    expect(schema).toMatchObject({
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
    });
    expect(runtimeZod.iso.datetime().safeParse("2026-09-09T00:00:00Z").success)
      .toBe(true);
  });
});
