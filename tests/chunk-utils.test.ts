import {
  filterChunks,
  findBestChunkForFile,
  getChunkLoadType,
  getChunkTypeIcon,
} from "@/lib/chunk-utils";
import type { InitialChunkSummary, Metafile } from "@/lib/metafile";
import { describe, expect, it } from "vitest";
import { getStatsMetafile } from "./test-helpers";

const metafile = getStatsMetafile();

// Create chunks from real metafile data for more comprehensive testing
const realChunks: InitialChunkSummary[] = Object.keys(metafile.outputs).map(
  (outputFile) => {
    const out = metafile.outputs[outputFile];
    return {
      outputFile,
      bytes: out.bytes || 0,
      entryPoint: out.entryPoint || "",
      isEntry: Boolean(out.entryPoint),
      includedInputs: Object.keys(out.inputs || {}),
    };
  }
);

const mockChunks: InitialChunkSummary[] = [
  {
    outputFile: "chunk-ABC123.js",
    bytes: 1024000,
    entryPoint: "src/main.ts",
    isEntry: true,
    includedInputs: [
      "src/main.ts",
      "src/app.module.ts",
      "src/@freelancer/ui/emoji-picker/emoji-picker.component.ts",
    ],
  },
  {
    outputFile: "chunk-DEF456.js",
    bytes: 512000,
    entryPoint: "src/lazy-page.ts",
    isEntry: true,
    includedInputs: ["src/lazy-page.ts", "src/lazy-component.ts"],
  },
];

const mockInitialSummary = {
  initial: {
    outputs: ["chunk-ABC123.js"],
    totalBytes: 1024000,
  },
  lazy: {
    outputs: ["chunk-DEF456.js"],
    totalBytes: 512000,
  },
};

describe("findBestChunkForFile", () => {
  it("returns chunk that directly contains the file", () => {
    const result = findBestChunkForFile(
      "src/main.ts",
      mockChunks,
      metafile,
      null
    );
    expect(result).toEqual(mockChunks[0]);
  });

  it("returns chunk containing files imported by the target file", () => {
    // Mock metafile with imports
    const mockMetafile: Metafile = {
      inputs: {
        "src/barrel.ts": {
          imports: [
            { path: "src/lazy-component.ts", kind: "import-statement" },
          ],
        },
      },
      outputs: {},
    };

    const result = findBestChunkForFile(
      "src/barrel.ts",
      mockChunks,
      mockMetafile,
      null
    );
    expect(result).toEqual(mockChunks[1]);
  });

  it("returns fallback chunk when file is not found", () => {
    const fallbackChunk = mockChunks[0];
    const result = findBestChunkForFile(
      "src/nonexistent.ts",
      mockChunks,
      metafile,
      fallbackChunk
    );
    expect(result).toEqual(fallbackChunk);
  });

  it("returns undefined when no chunk found and no fallback", () => {
    const result = findBestChunkForFile(
      "src/nonexistent.ts",
      mockChunks,
      metafile,
      null
    );
    expect(result).toBeUndefined();
  });
});

describe("getChunkLoadType", () => {
  it("returns 'initial' for chunks in initial outputs", () => {
    const result = getChunkLoadType(mockChunks[0], mockInitialSummary);
    expect(result).toBe("initial");
  });

  it("returns 'lazy' for chunks not in initial outputs", () => {
    const result = getChunkLoadType(mockChunks[1], mockInitialSummary);
    expect(result).toBe("lazy");
  });

  it("returns 'initial' when initialSummary is null", () => {
    const result = getChunkLoadType(mockChunks[0], null);
    expect(result).toBe("initial");
  });
});

describe("getChunkTypeIcon", () => {
  it("returns correct icon and color for initial chunks", () => {
    const result = getChunkTypeIcon("initial");
    expect(result.icon).toBe("Zap");
    expect(result.color).toBe("bg-red-500");
  });

  it("returns correct icon and color for lazy chunks", () => {
    const result = getChunkTypeIcon("lazy");
    expect(result.icon).toBe("Clock");
    expect(result.color).toBe("bg-purple-500");
  });
});

describe("filterChunks", () => {
  it("filters by search term", () => {
    const result = filterChunks(
      mockChunks,
      "main",
      { initial: true, lazy: true },
      mockInitialSummary
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockChunks[0]);
  });

  it("filters by chunk type", () => {
    const result = filterChunks(
      mockChunks,
      "",
      { initial: true, lazy: false },
      mockInitialSummary
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockChunks[0]);
  });

  it("combines search and type filters", () => {
    const result = filterChunks(
      mockChunks,
      "main",
      { initial: false, lazy: true },
      mockInitialSummary
    );
    expect(result).toHaveLength(0);
  });

  it("returns all chunks when no filters applied", () => {
    const result = filterChunks(
      mockChunks,
      "",
      { initial: true, lazy: true },
      mockInitialSummary
    );
    expect(result).toHaveLength(2);
  });

  it("works with real metafile chunks - filters by real search term", () => {
    // Use real chunks from metafile and create a realistic initial summary
    const realInitialOutputs = realChunks
      .filter((chunk) => chunk.isEntry)
      .map((chunk) => chunk.outputFile)
      .slice(0, 5); // Take first 5 entry chunks as "initial"

    const realInitialSummary = {
      initial: {
        outputs: realInitialOutputs,
        totalBytes: realChunks
          .filter((chunk) => realInitialOutputs.includes(chunk.outputFile))
          .reduce((sum, chunk) => sum + chunk.bytes, 0),
      },
      lazy: {
        outputs: realChunks
          .filter((chunk) => !realInitialOutputs.includes(chunk.outputFile))
          .map((chunk) => chunk.outputFile),
        totalBytes: realChunks
          .filter((chunk) => !realInitialOutputs.includes(chunk.outputFile))
          .reduce((sum, chunk) => sum + chunk.bytes, 0),
      },
    };

    // Test filtering by a common term that should exist in real data
    const result = filterChunks(
      realChunks,
      "src", // Should match many files in the real data
      { initial: true, lazy: true },
      realInitialSummary
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verify that all returned chunks contain files with "src" in the name
    result.forEach((chunk) => {
      const hasMatchingFile = chunk.includedInputs.some((input) =>
        input.toLowerCase().includes("src")
      );
      expect(hasMatchingFile).toBe(true);
    });
  });

  it("works with real metafile chunks - filters by chunk type", () => {
    const realInitialOutputs = realChunks
      .filter((chunk) => chunk.isEntry)
      .map((chunk) => chunk.outputFile)
      .slice(0, 3);

    const realInitialSummary = {
      initial: {
        outputs: realInitialOutputs,
        totalBytes: 1000000,
      },
      lazy: {
        outputs: realChunks
          .filter((chunk) => !realInitialOutputs.includes(chunk.outputFile))
          .map((chunk) => chunk.outputFile),
        totalBytes: 2000000,
      },
    };

    // Test filtering to show only initial chunks
    const initialOnlyResult = filterChunks(
      realChunks,
      "",
      { initial: true, lazy: false },
      realInitialSummary
    );

    // Test filtering to show only lazy chunks
    const lazyOnlyResult = filterChunks(
      realChunks,
      "",
      { initial: false, lazy: true },
      realInitialSummary
    );

    // Verify chunk type classification
    initialOnlyResult.forEach((chunk) => {
      const chunkType = getChunkLoadType(chunk, realInitialSummary);
      expect(chunkType).toBe("initial");
    });

    lazyOnlyResult.forEach((chunk) => {
      const chunkType = getChunkLoadType(chunk, realInitialSummary);
      expect(chunkType).toBe("lazy");
    });

    // Verify no overlap
    const initialOutputFiles = new Set(
      initialOnlyResult.map((c) => c.outputFile)
    );
    const lazyOutputFiles = new Set(lazyOnlyResult.map((c) => c.outputFile));
    const overlap = [...initialOutputFiles].filter((file) =>
      lazyOutputFiles.has(file)
    );
    expect(overlap.length).toBe(0);
  });
});
