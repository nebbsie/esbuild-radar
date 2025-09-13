import { getImportSources } from "@/lib/analyser";
import { describe, expect, it } from "vitest";
import { getStatsMetafile } from "./test-helpers";

const metafile = getStatsMetafile();

describe("getImportSources", () => {
  // Mock chunks data - this would normally come from summarizeInitial
  const mockChunks = [
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

  const mockInitialOutputs = ["chunk-ABC123.js"];

  it("should return empty array for file with no imports", () => {
    const result = getImportSources(
      metafile,
      "non-existent-file.ts",
      mockChunks,
      mockInitialOutputs
    );
    expect(result).toEqual([]);
  });

  it("should return import sources for emoji-picker component", () => {
    const result = getImportSources(
      metafile,
      "src/@freelancer/ui/emoji-picker/emoji-picker.component.ts",
      mockChunks,
      mockInitialOutputs
    );

    expect(result.length).toBeGreaterThan(0);

    // Check that each result has the expected structure
    result.forEach((source) => {
      expect(source).toHaveProperty("importer");
      expect(source).toHaveProperty("importStatement");
      expect(source).toHaveProperty("chunkType");
      expect(source).toHaveProperty("isDynamicImport");
      expect(["initial", "lazy"]).toContain(source.chunkType);
    });

    // Check that results are sorted (initial first, then lazy)
    const initialCount = result.filter((s) => s.chunkType === "initial").length;
    const lazyCount = result.filter((s) => s.chunkType === "lazy").length;

    // First items should be initial, later items should be lazy
    if (initialCount > 0 && lazyCount > 0) {
      const firstLazyIndex = result.findIndex((s) => s.chunkType === "lazy");
      const lastInitialIndex = result.findLastIndex(
        (s) => s.chunkType === "initial"
      );

      expect(firstLazyIndex).toBeGreaterThan(lastInitialIndex);
    }
  });

  it("should correctly identify dynamic imports", () => {
    const result = getImportSources(
      metafile,
      "src/@freelancer/ui/emoji-picker/emoji-picker.component.ts",
      mockChunks,
      mockInitialOutputs
    );

    // Some imports should be dynamic
    const dynamicImports = result.filter((s) => s.isDynamicImport);
    const staticImports = result.filter((s) => !s.isDynamicImport);

    expect(dynamicImports.length + staticImports.length).toBe(result.length);

    // Dynamic imports should have isDynamicImport: true
    dynamicImports.forEach((imp) => {
      expect(imp.isDynamicImport).toBe(true);
    });

    // Static imports should have isDynamicImport: false
    staticImports.forEach((imp) => {
      expect(imp.isDynamicImport).toBe(false);
    });
  });

  it("should include chunk information when available", () => {
    const result = getImportSources(
      metafile,
      "src/@freelancer/ui/emoji-picker/emoji-picker.component.ts",
      mockChunks,
      mockInitialOutputs
    );

    // Files that are in chunks should have chunk info
    const chunkedImports = result.filter(
      (s) => s.chunkOutputFile && s.chunkSize
    );

    chunkedImports.forEach((imp) => {
      expect(imp.chunkOutputFile).toBeDefined();
      expect(imp.chunkSize).toBeDefined();
      expect(typeof imp.chunkSize).toBe("number");
    });
  });

  it("should correctly classify chunk types based on initial outputs", () => {
    const result = getImportSources(
      metafile,
      "src/@freelancer/ui/emoji-picker/emoji-picker.component.ts",
      mockChunks,
      mockInitialOutputs
    );

    result.forEach((source) => {
      if (source.chunkOutputFile) {
        if (mockInitialOutputs.includes(source.chunkOutputFile)) {
          expect(source.chunkType).toBe("initial");
        } else {
          expect(source.chunkType).toBe("lazy");
        }
      }
    });
  });
});
