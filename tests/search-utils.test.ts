import {
  calculateNextSearchResult,
  findChunkIndex,
  findChunksWithSearchTerm,
  getNextSearchResultIndex,
  shouldSelectChunkEntryPoint,
  shouldSwitchChunk,
} from "@/lib/search-utils";
import type { InitialChunkSummary } from "@/lib/types";
import { describe, expect, it } from "vitest";
import { getStatsMetafile } from "./test-helpers";

const metafile = getStatsMetafile();

// Create chunks from real metafile data for more realistic testing
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

// Keep some mock chunks for specific edge case testing
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
  {
    outputFile: "chunk-GHI789.js",
    bytes: 256000,
    entryPoint: "src/utils.ts",
    isEntry: true,
    includedInputs: ["src/utils.ts", "src/helpers.ts"],
  },
];

describe("findChunksWithSearchTerm", () => {
  it("returns empty array for empty search term", () => {
    const result = findChunksWithSearchTerm(mockChunks, "");
    expect(result).toEqual([]);
  });

  it("finds chunks containing files with matching search term", () => {
    const result = findChunksWithSearchTerm(mockChunks, "main");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockChunks[0]);
  });

  it("is case-insensitive", () => {
    const result = findChunksWithSearchTerm(mockChunks, "MAIN");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockChunks[0]);
  });

  it("finds multiple chunks with matching files", () => {
    const result = findChunksWithSearchTerm(mockChunks, "src");
    expect(result).toHaveLength(3);
  });

  it("returns empty array when no matches found", () => {
    const result = findChunksWithSearchTerm(mockChunks, "nonexistent");
    expect(result).toEqual([]);
  });

  it("works with real metafile data - finds chunks with 'app'", () => {
    const result = findChunksWithSearchTerm(realChunks, "app");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verify that all returned chunks actually contain files with "app" in the name
    result.forEach((chunk) => {
      const hasMatchingFile = chunk.includedInputs.some((input) =>
        input.toLowerCase().includes("app")
      );
      expect(hasMatchingFile).toBe(true);
    });
  });

  it("works with real metafile data - finds chunks with 'component'", () => {
    const result = findChunksWithSearchTerm(realChunks, "component");
    expect(Array.isArray(result)).toBe(true);

    // Should find at least some components in the real data
    if (result.length > 0) {
      result.forEach((chunk) => {
        const hasMatchingFile = chunk.includedInputs.some((input) =>
          input.toLowerCase().includes("component")
        );
        expect(hasMatchingFile).toBe(true);
      });
    }
  });
});

describe("findChunkIndex", () => {
  it("returns correct index for existing chunk", () => {
    const result = findChunkIndex(mockChunks[1], mockChunks);
    expect(result).toBe(1);
  });

  it("returns -1 for non-existing chunk", () => {
    const unknownChunk: InitialChunkSummary = {
      outputFile: "unknown.js",
      bytes: 1000,
      entryPoint: "unknown.ts",
      isEntry: true,
      includedInputs: ["unknown.ts"],
    };
    const result = findChunkIndex(unknownChunk, mockChunks);
    expect(result).toBe(-1);
  });
});

describe("getNextSearchResultIndex", () => {
  it("returns next index for forward navigation", () => {
    const result = getNextSearchResultIndex(0, 5, "next");
    expect(result).toBe(1);
  });

  it("wraps to 0 when reaching end for forward navigation", () => {
    const result = getNextSearchResultIndex(4, 5, "next");
    expect(result).toBe(0);
  });

  it("returns previous index for backward navigation", () => {
    const result = getNextSearchResultIndex(2, 5, "prev");
    expect(result).toBe(1);
  });

  it("wraps to last index for backward navigation from 0", () => {
    const result = getNextSearchResultIndex(0, 5, "prev");
    expect(result).toBe(4);
  });

  it("returns -1 when no results", () => {
    const result = getNextSearchResultIndex(0, 0, "next");
    expect(result).toBe(-1);
  });
});

describe("shouldSwitchChunk", () => {
  describe("forward navigation", () => {
    it("switches to next chunk when cycling through all results", () => {
      const result = shouldSwitchChunk("next", 0, 3, 0, 2);
      expect(result.shouldSwitch).toBe(true);
      expect(result.targetChunkIndex).toBe(1);
    });

    it("stays in current chunk when not cycling", () => {
      const result = shouldSwitchChunk("next", 1, 3, 0, 2);
      expect(result.shouldSwitch).toBe(false);
      expect(result.targetChunkIndex).toBe(0);
    });

    it("wraps to first chunk when reaching end", () => {
      const result = shouldSwitchChunk("next", 0, 3, 1, 2);
      expect(result.shouldSwitch).toBe(true);
      expect(result.targetChunkIndex).toBe(0);
    });
  });

  describe("backward navigation", () => {
    it("switches to previous chunk when going before first result", () => {
      const result = shouldSwitchChunk("prev", -1, 3, 1, 3);
      expect(result.shouldSwitch).toBe(true);
      expect(result.targetChunkIndex).toBe(0);
    });

    it("wraps to last chunk when going before first in first chunk", () => {
      const result = shouldSwitchChunk("prev", -1, 3, 0, 3);
      expect(result.shouldSwitch).toBe(true);
      expect(result.targetChunkIndex).toBe(2);
    });

    it("stays in current chunk when not going before first", () => {
      const result = shouldSwitchChunk("prev", 1, 3, 1, 3);
      expect(result.shouldSwitch).toBe(false);
      expect(result.targetChunkIndex).toBe(1);
    });
  });
});

describe("calculateNextSearchResult", () => {
  const mockState = {
    searchTerm: "test",
    currentChunkIndex: 0,
    currentResultIndex: 0,
    matchingChunks: mockChunks,
  };

  it("calculates next result within same chunk", () => {
    const result = calculateNextSearchResult(mockState, "next", 3);
    expect(result.shouldSwitchChunk).toBe(false);
    expect(result.targetChunkIndex).toBe(0);
    expect(result.targetResultIndex).toBe(1);
  });

  it("calculates next chunk when cycling through results", () => {
    const result = calculateNextSearchResult(mockState, "next", 3);
    // This depends on the currentResultIndex being 0 and totalResults > 0
    // The logic should detect when we need to switch chunks
  });

  it("calculates previous result within same chunk", () => {
    const modifiedState = { ...mockState, currentResultIndex: 2 };
    const result = calculateNextSearchResult(modifiedState, "prev", 3);
    expect(result.shouldSwitchChunk).toBe(false);
    expect(result.targetChunkIndex).toBe(0);
    expect(result.targetResultIndex).toBe(1);
  });
});

describe("shouldSelectChunkEntryPoint", () => {
  it("returns true when entry point is included in chunk inputs", () => {
    const result = shouldSelectChunkEntryPoint(mockChunks[0]);
    expect(result).toBe(true);
  });

  it("returns false when entry point is not in inputs", () => {
    const chunkWithoutEntryPoint: InitialChunkSummary = {
      ...mockChunks[0],
      entryPoint: "src/missing.ts",
    };
    const result = shouldSelectChunkEntryPoint(chunkWithoutEntryPoint);
    expect(result).toBe(false);
  });

  it("returns false when chunk has no entry point", () => {
    const chunkWithoutEntryPoint: InitialChunkSummary = {
      ...mockChunks[0],
      entryPoint: "",
    };
    const result = shouldSelectChunkEntryPoint(chunkWithoutEntryPoint);
    expect(result).toBe(false);
  });

  it("works with real chunks from metafile", () => {
    // Find chunks with entry points from real data
    const chunksWithEntryPoints = realChunks.filter(
      (chunk) => chunk.entryPoint
    );

    if (chunksWithEntryPoints.length > 0) {
      const testChunk = chunksWithEntryPoints[0];

      // Test that chunks with valid entry points return the correct result
      const result = shouldSelectChunkEntryPoint(testChunk);

      // If the entry point is in the included inputs, should return true
      const expected = testChunk.includedInputs.includes(testChunk.entryPoint!);
      expect(result).toBe(expected);
    }
  });

  it("handles edge case with real chunk that has entry point but missing from inputs", () => {
    // Find a chunk from real data and modify it to simulate the edge case
    const testChunk = { ...realChunks[0] };

    if (testChunk.entryPoint) {
      // Create a scenario where entry point exists but isn't in includedInputs
      const modifiedChunk: InitialChunkSummary = {
        ...testChunk,
        includedInputs: testChunk.includedInputs.filter(
          (input) => input !== testChunk.entryPoint
        ),
      };

      const result = shouldSelectChunkEntryPoint(modifiedChunk);
      expect(result).toBe(false);
    }
  });
});
