import {
  determineModuleSelectionForChunkChange,
  getModuleForChunkActivation,
  isEntryPointValidForChunk,
} from "@/lib/module-utils";
import type { InitialChunkSummary } from "@/lib/types";
import { describe, expect, it } from "vitest";

describe("getModuleForChunkActivation", () => {
  it("should return entry point when it's valid", () => {
    const chunk = {
      entryPoint: "src/index.ts",
      includedInputs: ["src/index.ts", "src/utils.ts"],
    } as InitialChunkSummary;

    const result = getModuleForChunkActivation(chunk);
    expect(result).toBe("src/index.ts");
  });

  it("should return null when entry point is not valid", () => {
    const chunk = {
      entryPoint: "src/missing.ts",
      includedInputs: ["src/index.ts", "src/utils.ts"],
    } as InitialChunkSummary;

    const result = getModuleForChunkActivation(chunk);
    expect(result).toBeNull();
  });

  it("should return null when chunk has no entry point", () => {
    const chunk = {
      entryPoint: "",
      includedInputs: ["src/index.ts"],
    } as InitialChunkSummary;

    const result = getModuleForChunkActivation(chunk);
    expect(result).toBeNull();
  });
});

describe("isEntryPointValidForChunk", () => {
  it("should return true when entry point is included in inputs", () => {
    const chunk = {
      entryPoint: "src/index.ts",
      includedInputs: ["src/index.ts", "src/utils.ts"],
    } as InitialChunkSummary;

    const result = isEntryPointValidForChunk(chunk);
    expect(result).toBe(true);
  });

  it("should return false when entry point is not in inputs", () => {
    const chunk = {
      entryPoint: "src/missing.ts",
      includedInputs: ["src/index.ts", "src/utils.ts"],
    } as InitialChunkSummary;

    const result = isEntryPointValidForChunk(chunk);
    expect(result).toBe(false);
  });

  it("should return false when entry point is empty", () => {
    const chunk = {
      entryPoint: "",
      includedInputs: ["src/index.ts"],
    } as InitialChunkSummary;

    const result = isEntryPointValidForChunk(chunk);
    expect(result).toBe(false);
  });
});

describe("determineModuleSelectionForChunkChange", () => {
  const mockChunks = [
    {
      outputFile: "dist/index.js",
      entryPoint: "src/index.ts",
      includedInputs: ["src/index.ts"],
    },
    {
      outputFile: "dist/utils.js",
      entryPoint: "src/utils.ts",
      includedInputs: ["src/utils.ts"],
    },
  ] as InitialChunkSummary[];

  it("should auto-select when only one chunk remains", () => {
    const singleChunk = [mockChunks[0]];
    const result = determineModuleSelectionForChunkChange(
      singleChunk,
      null,
      null
    );

    expect(result.selectedChunk).toBe(singleChunk[0]);
    expect(result.selectedModule).toBe("src/index.ts");
  });

  it("should maintain current selection when multiple chunks exist", () => {
    const result = determineModuleSelectionForChunkChange(
      mockChunks,
      "src/index.ts",
      mockChunks[0]
    );

    expect(result.selectedChunk).toBe(mockChunks[0]);
    expect(result.selectedModule).toBe("src/index.ts");
  });

  it("should not change selection when chunk change doesn't require it", () => {
    const result = determineModuleSelectionForChunkChange(
      mockChunks,
      "src/index.ts",
      mockChunks[0]
    );

    expect(result.selectedChunk).toBe(mockChunks[0]);
    expect(result.selectedModule).toBe("src/index.ts");
  });

  it("should handle null current selections", () => {
    const singleChunk = [mockChunks[0]];
    const result = determineModuleSelectionForChunkChange(
      singleChunk,
      null,
      null
    );

    expect(result.selectedChunk).toBe(singleChunk[0]);
    expect(result.selectedModule).toBe("src/index.ts");
  });
});
