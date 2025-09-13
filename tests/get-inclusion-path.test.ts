import { getInclusionPath } from "@/lib/analyser";
import type { InitialChunkSummary } from "@/lib/metafile";
import { parseMetafile } from "@/lib/metafile";
// @ts-ignore - Node.js types available at runtime
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const statsPath = new URL("../stats.json", import.meta.url);
const meta = parseMetafile(JSON.parse(readFileSync(statsPath, "utf-8")));

// Create mock chunks for testing
const mockChunks: InitialChunkSummary[] = Object.keys(meta.outputs).map(
  (outputFile) => {
    const out = meta.outputs[outputFile];
    return {
      outputFile,
      bytes: out.bytes || 0,
      entryPoint: out.entryPoint || "",
      isEntry: Boolean(out.entryPoint),
      includedInputs: Object.keys(out.inputs || {}),
    };
  }
);

describe("getInclusionPath", () => {
  it("should return empty array for non-existent file", () => {
    const result = getInclusionPath(meta, "non-existent-file.js", []);
    expect(result).toEqual([]);
  });

  it("should return inclusion path for a valid file", () => {
    // Test with a known file from the stats
    const result = getInclusionPath(meta, "src/bits/app.module.ts", mockChunks);
    expect(Array.isArray(result)).toBe(true);
    // The result should contain objects with file, importStatement, isDynamicImport, and importerChunkType
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("file");
      expect(result[0]).toHaveProperty("importStatement");
      expect(result[0]).toHaveProperty("isDynamicImport");
      expect(result[0]).toHaveProperty("importerChunkType");
      expect(typeof result[0].isDynamicImport).toBe("boolean");
      expect(["initial", "lazy"]).toContain(result[0].importerChunkType);
    }
  });

  it("should return correct inclusion path for textCorpus.ts", () => {
    const result = getInclusionPath(
      meta,
      "src/@freelancer/datastore/testing/helpers/textCorpus.ts",
      mockChunks
    );

    // Expected path based on the provided example - showing actual import statements
    const expected = [
      {
        file: "src/bits/main.ts",
        importStatement: "./app.module",
        isDynamicImport: false,
        importerChunkType: "initial",
      },
      {
        file: "src/bits/app.module.ts",
        importStatement: "@freelancer/datastore/collections-testing",
        isDynamicImport: false,
        importerChunkType: "initial",
      },
      {
        file: "src/@freelancer/datastore/collections-testing/index.ts",
        importStatement: "./document-creators",
        isDynamicImport: false,
        importerChunkType: "lazy",
      },
      {
        file: "src/@freelancer/datastore/collections-testing/document-creators.ts",
        importStatement: "@freelancer/datastore/testing/helpers",
        isDynamicImport: false,
        importerChunkType: "lazy",
      },
      {
        file: "src/@freelancer/datastore/testing/helpers/index.ts",
        importStatement: "./textCorpus",
        isDynamicImport: false,
        importerChunkType: "lazy",
      },
    ];

    expect(result).toEqual(expected);
  });

  it("should return correct inclusion path for io-docs.component.ts", () => {
    const result = getInclusionPath(
      meta,
      "src/bits/base/components/io-docs.component.ts",
      mockChunks
    );

    // Expected path based on the provided example - showing actual import statements
    const expected = [
      {
        file: "src/bits/main.ts",
        importStatement: "./app.module",
        isDynamicImport: false,
        importerChunkType: "initial",
      },
      {
        file: "src/bits/app.module.ts",
        importStatement: "./app-routing.module",
        isDynamicImport: false,
        importerChunkType: "initial",
      },
      {
        file: "src/bits/app-routing.module.ts",
        importStatement: "./generated/patterns.routes",
        isDynamicImport: false,
        importerChunkType: "initial",
      },
      {
        file: "src/bits/generated/patterns.routes.ts",
        importStatement: "./ai-modal/ai-modal-stories.module",
        isDynamicImport: true,
        importerChunkType: "initial",
      },
      {
        file: "src/bits/generated/ai-modal/ai-modal-stories.module.ts",
        importStatement: "../../base/generated-required.module",
        isDynamicImport: false,
        importerChunkType: "lazy",
      },
      {
        file: "src/bits/base/generated-required.module.ts",
        importStatement: "./components/io-docs.component",
        isDynamicImport: false,
        importerChunkType: "lazy",
      },
    ];

    expect(result).toEqual(expected);
  });

  it("should return correct inclusion path for table-stories.routing.ts", () => {
    const result = getInclusionPath(
      meta,
      "src/bits/generated/table/table-stories.routing.ts",
      mockChunks
    );

    // Expected path based on the provided example - showing actual import statements
    // This includes a dynamic import which should be handled correctly
    const expected = [
      {
        file: "src/bits/main.ts",
        importStatement: "./app.module",
        isDynamicImport: false,
        importerChunkType: "initial",
      },
      {
        file: "src/bits/app.module.ts",
        importStatement: "./app-routing.module",
        isDynamicImport: false,
        importerChunkType: "initial",
      },
      {
        file: "src/bits/app-routing.module.ts",
        importStatement: "./generated/component.routes",
        isDynamicImport: false,
        importerChunkType: "initial",
      },
      {
        file: "src/bits/generated/component.routes.ts",
        importStatement: "./table/table-stories.routing",
        isDynamicImport: true, // This is the dynamic import!
        importerChunkType: "initial",
      },
    ];

    expect(result).toEqual(expected);
  });

  it("should correctly handle complex dynamic import chains", () => {
    // Test the io-docs.component.ts case that involves:
    // 1. Static imports in initial bundle
    // 2. Dynamic import that creates a lazy chunk
    // 3. Subsequent imports within the lazy chunk
    const result = getInclusionPath(
      meta,
      "src/bits/base/components/io-docs.component.ts",
      mockChunks
    );

    // Verify the structure of each step
    expect(result).toHaveLength(6);

    // Step 1: main.ts (entry point, static import)
    expect(result[0]).toEqual({
      file: "src/bits/main.ts",
      importStatement: "./app.module",
      isDynamicImport: false,
      importerChunkType: "initial",
    });

    // Step 2: app.module.ts (static import in initial bundle)
    expect(result[1]).toEqual({
      file: "src/bits/app.module.ts",
      importStatement: "./app-routing.module",
      isDynamicImport: false,
      importerChunkType: "initial",
    });

    // Step 3: app-routing.module.ts (static import in initial bundle)
    expect(result[2]).toEqual({
      file: "src/bits/app-routing.module.ts",
      importStatement: "./generated/patterns.routes",
      isDynamicImport: false,
      importerChunkType: "initial",
    });

    // Step 4: patterns.routes.ts (DYNAMIC import, but importer is in initial bundle)
    expect(result[3]).toEqual({
      file: "src/bits/generated/patterns.routes.ts",
      importStatement: "./ai-modal/ai-modal-stories.module",
      isDynamicImport: true, // This is the key: dynamic import syntax
      importerChunkType: "initial", // But importer file is in initial chunk
    });

    // Step 5: ai-modal-stories.module.ts (static import in lazy chunk)
    expect(result[4]).toEqual({
      file: "src/bits/generated/ai-modal/ai-modal-stories.module.ts",
      importStatement: "../../base/generated-required.module",
      isDynamicImport: false,
      importerChunkType: "lazy", // Now in lazy chunk
    });

    // Step 6: generated-required.module.ts (static import in lazy chunk)
    expect(result[5]).toEqual({
      file: "src/bits/base/generated-required.module.ts",
      importStatement: "./components/io-docs.component",
      isDynamicImport: false,
      importerChunkType: "lazy", // Still in lazy chunk
    });

    // Verify that dynamic import detection works
    const dynamicImports = result.filter((step) => step.isDynamicImport);
    expect(dynamicImports).toHaveLength(1);
    expect(dynamicImports[0].file).toBe(
      "src/bits/generated/patterns.routes.ts"
    );

    // Verify chunk type distribution
    const initialImporters = result.filter(
      (step) => step.importerChunkType === "initial"
    );
    const lazyImporters = result.filter(
      (step) => step.importerChunkType === "lazy"
    );

    expect(initialImporters).toHaveLength(4); // First 4 steps
    expect(lazyImporters).toHaveLength(2); // Last 2 steps
  });
});
