import type { InitialChunkSummary } from "@/lib/metafile";
import {
  calculateInclusionPath,
  getInitialChunkEntryPoint,
  ModuleNavigationHistory,
  selectModule,
} from "@/lib/navigation-utils";
import { describe, expect, it } from "vitest";
import { getStatsMetafile } from "./test-helpers";

const metafile = getStatsMetafile();

// Create chunks from real metafile data for comprehensive testing
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

describe("getInitialChunkEntryPoint", () => {
  it("returns entry point for first initial output", () => {
    const result = getInitialChunkEntryPoint(metafile, mockInitialSummary);
    expect(result).toBeDefined();
  });

  it("returns null when initialSummary is null", () => {
    const result = getInitialChunkEntryPoint(metafile, null);
    expect(result).toBeNull();
  });

  it("returns null when metafile is null", () => {
    const result = getInitialChunkEntryPoint(null as any, mockInitialSummary);
    expect(result).toBeNull();
  });
});

describe("calculateInclusionPath", () => {
  it("returns found false when metafile is null", () => {
    const result = calculateInclusionPath(
      null as any,
      "src/main.ts",
      "src/main.ts"
    );
    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
  });

  it("returns found false when entryPoint is empty", () => {
    const result = calculateInclusionPath(metafile, "src/main.ts", "");
    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
  });

  it("calculates inclusion path for valid inputs", () => {
    const result = calculateInclusionPath(
      metafile,
      "src/bits/app.module.ts",
      "src/bits/main.ts"
    );
    expect(typeof result.found).toBe("boolean");
    expect(Array.isArray(result.path)).toBe(true);
  });
});

describe("selectModule", () => {
  const mockInitialChunk = mockChunks[0];

  it("selects module and finds containing chunk", () => {
    const result = selectModule(
      "src/main.ts",
      mockChunks,
      metafile,
      mockInitialChunk,
      null
    );

    expect(result.selectedModule).toBe("src/main.ts");
    expect(result.selectedChunk).toEqual(mockChunks[0]);
    expect(result.inclusion).not.toBeNull();
  });

  it("keeps existing chunk when module is in same chunk", () => {
    const result = selectModule(
      "src/app.module.ts",
      mockChunks,
      metafile,
      mockInitialChunk,
      mockChunks[0]
    );

    expect(result.selectedModule).toBe("src/app.module.ts");
    expect(result.selectedChunk).toEqual(mockChunks[0]);
  });

  it("changes chunk when module is in different chunk", () => {
    const result = selectModule(
      "src/lazy-component.ts",
      mockChunks,
      metafile,
      mockInitialChunk,
      mockChunks[0]
    );

    expect(result.selectedModule).toBe("src/lazy-component.ts");
    expect(result.selectedChunk).toEqual(mockChunks[1]);
  });

  it("returns null inclusion when no metafile", () => {
    const result = selectModule(
      "src/main.ts",
      mockChunks,
      null,
      mockInitialChunk,
      null
    );

    expect(result.inclusion).toBeNull();
  });

  it("works with real metafile chunks - selects real module", () => {
    // Find a chunk with included inputs from real data
    const testChunk = realChunks.find(
      (chunk) => chunk.includedInputs.length > 0
    );

    if (testChunk && testChunk.includedInputs.length > 0) {
      const testModule = testChunk.includedInputs[0];

      const result = selectModule(
        testModule,
        realChunks,
        metafile,
        testChunk,
        null
      );

      expect(result.selectedModule).toBe(testModule);
      expect(result.selectedChunk).toEqual(testChunk);
      expect(result.inclusion).not.toBeNull();
    }
  });

  it("works with real metafile chunks - handles module not in any chunk", () => {
    const nonexistentModule = "src/nonexistent-file.ts";

    const result = selectModule(
      nonexistentModule,
      realChunks,
      metafile,
      null,
      null
    );

    expect(result.selectedModule).toBe(nonexistentModule);
    expect(result.selectedChunk).toBeNull();
    expect(result.inclusion).toBeNull();
  });
});

describe("ModuleNavigationHistory", () => {
  it("starts with empty history", () => {
    const history = new ModuleNavigationHistory();
    expect(history.getCurrent()).toBeNull();
    expect(history.hasPrevious()).toBe(false);
    expect(history.hasNext()).toBe(false);
  });

  it("pushes and retrieves current module", () => {
    const history = new ModuleNavigationHistory();
    history.push("module1.ts");
    expect(history.getCurrent()).toBe("module1.ts");
  });

  it("navigates backward through history", () => {
    const history = new ModuleNavigationHistory();
    history.push("module1.ts");
    history.push("module2.ts");
    history.push("module3.ts");

    expect(history.getCurrent()).toBe("module3.ts");
    expect(history.hasPrevious()).toBe(true);

    const prev = history.getPrevious();
    expect(prev).toBe("module2.ts");
    expect(history.getCurrent()).toBe("module2.ts");
  });

  it("navigates forward through history", () => {
    const history = new ModuleNavigationHistory();
    history.push("module1.ts");
    history.push("module2.ts");
    history.push("module3.ts");

    history.getPrevious(); // Go back to module2
    history.getPrevious(); // Go back to module1

    expect(history.getCurrent()).toBe("module1.ts");
    expect(history.hasNext()).toBe(true);

    const next = history.getNext();
    expect(next).toBe("module2.ts");
    expect(history.getCurrent()).toBe("module2.ts");
  });

  it("clears forward history when pushing new module", () => {
    const history = new ModuleNavigationHistory();
    history.push("module1.ts");
    history.push("module2.ts");
    history.getPrevious(); // Go back to module1
    history.push("module3.ts"); // This should clear forward history

    expect(history.getCurrent()).toBe("module3.ts");
    expect(history.hasNext()).toBe(false);
  });

  it("handles boundary conditions", () => {
    const history = new ModuleNavigationHistory();
    history.push("module1.ts");

    // Try to go back when at first item
    const backResult = history.getPrevious();
    expect(backResult).toBeNull();
    expect(history.getCurrent()).toBe("module1.ts");

    // Try to go forward when at last item
    const forwardResult = history.getNext();
    expect(forwardResult).toBeNull();
    expect(history.getCurrent()).toBe("module1.ts");
  });

  it("clears history", () => {
    const history = new ModuleNavigationHistory();
    history.push("module1.ts");
    history.push("module2.ts");
    history.clear();

    expect(history.getCurrent()).toBeNull();
    expect(history.hasPrevious()).toBe(false);
    expect(history.hasNext()).toBe(false);
  });
});
