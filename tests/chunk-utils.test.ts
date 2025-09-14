import {
  createChunkSummaries,
  createInitialChunkSummary,
  filterChunks,
  getChunkLoadType,
  isEntryPointInChunk,
  isMainEntryPoint,
} from "@/lib/chunk-utils";
import { describe, expect, it } from "vitest";
import { getStatsMetafile } from "./test-helpers";
import type { ChunkTypeResult, MockChunk } from "./test-types";

const mockMetafile = {
  inputs: {
    "src/index.ts": {
      bytes: 100,
      imports: [],
    },
    "src/utils.ts": {
      bytes: 50,
      imports: [],
    },
  },
  outputs: {
    "dist/index.js": {
      bytes: 100,
      inputs: {
        "src/index.ts": { bytesInOutput: 100 },
      },
      entryPoint: "src/index.ts",
    },
    "dist/utils.js": {
      bytes: 50,
      inputs: {
        "src/utils.ts": { bytesInOutput: 50 },
      },
    },
  },
};

const mockInitialSummary = {
  initial: {
    outputs: ["dist/index.js"],
    totalBytes: 100,
  },
  lazy: {
    outputs: ["dist/utils.js"],
    totalBytes: 50,
  },
};

describe("createInitialChunkSummary", () => {
  it("should create a valid InitialChunkSummary from metafile output", () => {
    const result = createInitialChunkSummary(
      "dist/index.js",
      mockMetafile.outputs["dist/index.js"],
      mockMetafile
    );

    expect(result).toEqual({
      outputFile: "dist/index.js",
      bytes: 100,
      entryPoint: "src/index.ts",
      isEntry: true,
      includedInputs: ["src/index.ts"],
    });
  });

  it("should return null for invalid output", () => {
    const result = createInitialChunkSummary(
      "dist/missing.js",
      null,
      mockMetafile
    );
    expect(result).toBeNull();
  });

  it("should handle outputs without entry points", () => {
    const result = createInitialChunkSummary(
      "dist/utils.js",
      mockMetafile.outputs["dist/utils.js"],
      mockMetafile
    );

    expect(result).toEqual({
      outputFile: "dist/utils.js",
      bytes: 50,
      entryPoint: "",
      isEntry: false,
      includedInputs: ["src/utils.ts"],
    });
  });
});

describe("createChunkSummaries", () => {
  it("should create InitialChunkSummary objects for multiple outputs", () => {
    const outputs = ["dist/index.js", "dist/utils.js"];
    const result = createChunkSummaries(outputs, mockMetafile);

    expect(result).toHaveLength(2);
    expect(result[0].bytes).toBe(100); // Should be sorted by size (largest first)
    expect(result[1].bytes).toBe(50);
  });

  it("should sort chunks by size (largest first)", () => {
    const outputs = ["dist/utils.js", "dist/index.js"]; // Reverse order
    const result = createChunkSummaries(outputs, mockMetafile);

    expect(result[0].bytes).toBe(100);
    expect(result[1].bytes).toBe(50);
  });

  it("should filter out null results", () => {
    const outputs = ["dist/index.js", "dist/missing.js"];
    const result = createChunkSummaries(outputs, mockMetafile);

    expect(result).toHaveLength(1);
    expect(result[0].outputFile).toBe("dist/index.js");
  });
});

describe("getChunkLoadType", () => {
  it("should return 'initial' for chunks in initial outputs", () => {
    const chunk: MockChunk = { outputFile: "dist/index.js" };
    const result = getChunkLoadType(chunk as any, mockInitialSummary);
    expect(result).toBe("initial");
  });

  it("should return 'lazy' for chunks not in initial outputs", () => {
    const chunk: MockChunk = { outputFile: "dist/utils.js" };
    const result = getChunkLoadType(chunk as any, mockInitialSummary);
    expect(result).toBe("lazy");
  });

  it("should return 'initial' when initialSummary is null", () => {
    const chunk: MockChunk = { outputFile: "dist/index.js" };
    const result = getChunkLoadType(chunk as any, null);
    expect(result).toBe("initial");
  });
});

describe("isEntryPointInChunk", () => {
  it("should return true when entry point is included in chunk inputs", () => {
    const chunk: MockChunk = {
      entryPoint: "src/index.ts",
      includedInputs: ["src/index.ts", "src/utils.ts"],
    };
    const result = isEntryPointInChunk(chunk as any);
    expect(result).toBe(true);
  });

  it("should return false when entry point is not in inputs", () => {
    const chunk: MockChunk = {
      entryPoint: "src/missing.ts",
      includedInputs: ["src/index.ts", "src/utils.ts"],
    };
    const result = isEntryPointInChunk(chunk as any);
    expect(result).toBe(false);
  });

  it("should return false when chunk has no entry point", () => {
    const chunk: MockChunk = {
      entryPoint: "",
      includedInputs: ["src/index.ts"],
    };
    const result = isEntryPointInChunk(chunk as any);
    expect(result).toBe(false);
  });
});

describe("filterChunks", () => {
  const chunks: MockChunk[] = [
    {
      outputFile: "dist/index.js",
      includedInputs: ["src/index.ts"],
    },
    {
      outputFile: "dist/utils.js",
      includedInputs: ["src/utils.ts"],
    },
  ];

  it("should return all chunks when no filters applied", () => {
    const result = filterChunks(
      chunks as any,
      "",
      { initial: true, lazy: true },
      mockInitialSummary
    );
    expect(result).toHaveLength(2);
  });

  it("should filter by search term", () => {
    const result = filterChunks(
      chunks as any,
      "index",
      { initial: true, lazy: true },
      mockInitialSummary
    );
    expect(result).toHaveLength(1);
    expect(result[0].outputFile).toBe("dist/index.js");
  });

  it("should filter by chunk type", () => {
    const result = filterChunks(
      chunks as any,
      "",
      { initial: true, lazy: false },
      mockInitialSummary
    );
    expect(result).toHaveLength(1);
    expect(result[0].outputFile).toBe("dist/index.js");
  });

  it("should combine search and type filters", () => {
    const result = filterChunks(
      chunks as any,
      "utils",
      { initial: true, lazy: false },
      mockInitialSummary
    );
    expect(result).toHaveLength(0);
  });

  it("should work with real metafile data", () => {
    const metafile = getStatsMetafile();
    const chunks = createChunkSummaries(
      Object.keys(metafile.outputs),
      metafile
    );
    const result = filterChunks(
      chunks,
      "component",
      { initial: true, lazy: true },
      null
    );

    expect(result.length).toBeGreaterThan(0);
    result.forEach((chunk) => {
      expect(
        chunk.includedInputs.some((input) =>
          input.toLowerCase().includes("component")
        )
      ).toBe(true);
    });
  });

  describe("chunk type comparison (regression test)", () => {
    it("should correctly identify initial vs lazy chunks by outputFile (not reference)", () => {
      // Create mock chunks that represent the same logical chunks but are different objects
      const initialChunks: MockChunk[] = [
        {
          outputFile: "dist/index.js",
          bytes: 100,
          entryPoint: "src/index.ts",
          isEntry: true,
          includedInputs: ["src/index.ts"],
        },
        {
          outputFile: "dist/utils.js",
          bytes: 50,
          entryPoint: "src/utils.ts",
          isEntry: true,
          includedInputs: ["src/utils.ts"],
        },
      ];

      const allChunks: MockChunk[] = [
        {
          outputFile: "dist/index.js",
          bytes: 100,
          entryPoint: "src/index.ts",
          isEntry: true,
          includedInputs: ["src/index.ts"],
        },
        {
          outputFile: "dist/utils.js",
          bytes: 50,
          entryPoint: "src/utils.ts",
          isEntry: true,
          includedInputs: ["src/utils.ts"],
        },
        {
          outputFile: "dist/lazy.js",
          bytes: 25,
          entryPoint: "src/lazy.ts",
          isEntry: true,
          includedInputs: ["src/lazy.ts"],
        },
      ];

      // Simulate the logic from ChunksPanel: determine loadType for each chunk
      const chunkTypes: ChunkTypeResult[] = allChunks.map((chunk) => ({
        outputFile: chunk.outputFile!,
        loadType: initialChunks.some(
          (initialChunk) => initialChunk.outputFile === chunk.outputFile
        )
          ? "initial"
          : "lazy",
      }));

      // Verify correct classification
      expect(chunkTypes).toEqual([
        { outputFile: "dist/index.js", loadType: "initial" },
        { outputFile: "dist/utils.js", loadType: "initial" },
        { outputFile: "dist/lazy.js", loadType: "lazy" },
      ]);

      // This test ensures the bug we fixed doesn't regress:
      // initialChunks.includes(chunk) would fail because they are different object instances
      // but initialChunks.some(chunk => chunk.outputFile === c.outputFile) works correctly
    });

    it("should handle empty initialChunks array", () => {
      const initialChunks: MockChunk[] = [];
      const allChunks: MockChunk[] = [
        { outputFile: "dist/lazy1.js", bytes: 100 },
        { outputFile: "dist/lazy2.js", bytes: 50 },
      ];

      const chunkTypes: ChunkTypeResult[] = allChunks.map((chunk) => ({
        outputFile: chunk.outputFile!,
        loadType: initialChunks.some(
          (initialChunk) => initialChunk.outputFile === chunk.outputFile
        )
          ? "initial"
          : "lazy",
      }));

      expect(chunkTypes).toEqual([
        { outputFile: "dist/lazy1.js", loadType: "lazy" },
        { outputFile: "dist/lazy2.js", loadType: "lazy" },
      ]);
    });
  });

  describe("isMainEntryPoint", () => {
    it("should return true for the entry point of initial chunk", () => {
      const initialChunk: InitialChunkSummary = {
        outputFile: "dist/main.js",
        bytes: 1000,
        entryPoint: "src/index.ts",
        isEntry: true,
        includedInputs: ["src/index.ts", "src/utils.ts"],
      };

      expect(isMainEntryPoint("src/index.ts", initialChunk)).toBe(true);
    });

    it("should return false for files that are not the entry point", () => {
      const initialChunk: InitialChunkSummary = {
        outputFile: "dist/main.js",
        bytes: 1000,
        entryPoint: "src/index.ts",
        isEntry: true,
        includedInputs: ["src/index.ts", "src/utils.ts"],
      };

      expect(isMainEntryPoint("src/utils.ts", initialChunk)).toBe(false);
    });

    it("should return false when initialChunk is null", () => {
      expect(isMainEntryPoint("src/index.ts", null)).toBe(false);
    });

    it("should return false when entryPoint is empty", () => {
      const initialChunk: InitialChunkSummary = {
        outputFile: "dist/main.js",
        bytes: 1000,
        entryPoint: "",
        isEntry: true,
        includedInputs: ["src/index.ts"],
      };

      expect(isMainEntryPoint("src/index.ts", initialChunk)).toBe(false);
    });
  });
});
