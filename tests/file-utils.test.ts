import { processUploadedFile } from "@/lib/file-utils";
import { describe, expect, it } from "vitest";
import { getStatsMetafile } from "./test-helpers";

// Use a simplified version of the real metafile for testing
const createMockMetafile = (overrides = {}) => ({
  inputs: {
    "src/index.ts": {
      bytes: 100,
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
  },
  ...overrides,
});

// Mock file creation helper
function createMockFile(content: string, filename = "test.json"): File {
  return new File([content], filename, { type: "application/json" });
}

describe("processUploadedFile", () => {
  it("should process a valid esbuild metafile", async () => {
    // Use the real stats metafile for testing
    const metafileData = getStatsMetafile();
    const fileContent = JSON.stringify(metafileData);
    const mockFile = new File([fileContent], "metafile.json", {
      type: "application/json",
    });

    const result = await processUploadedFile(mockFile);

    expect(result.metafile).toBeDefined();
    expect(result.initialSummary).toBeDefined();
    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.selectedChunk).toBeDefined();
    expect(result.selectedModule).toBeDefined();
  });

  it("should sort chunks by size (largest first)", async () => {
    const metafileData = getStatsMetafile();
    const fileContent = JSON.stringify(metafileData);
    const mockFile = new File([fileContent], "metafile.json", {
      type: "application/json",
    });

    const result = await processUploadedFile(mockFile);

    // Check that chunks are sorted by size (largest first)
    for (let i = 0; i < result.chunks.length - 1; i++) {
      expect(result.chunks[i].bytes).toBeGreaterThanOrEqual(
        result.chunks[i + 1].bytes
      );
    }
  });

  it("should throw error for invalid JSON", async () => {
    const mockFile = new File(["invalid json content"], "metafile.json", {
      type: "application/json",
    });

    await expect(processUploadedFile(mockFile)).rejects.toThrow(
      "Failed to process metafile"
    );
  });

  it("should throw error for invalid metafile structure", async () => {
    const invalidMetafile = { invalid: "structure" };
    const fileContent = JSON.stringify(invalidMetafile);
    const mockFile = new File([fileContent], "metafile.json", {
      type: "application/json",
    });

    await expect(processUploadedFile(mockFile)).rejects.toThrow(
      "Failed to process metafile"
    );
  });

  it("should return valid processed data structure", async () => {
    const metafileData = getStatsMetafile();
    const fileContent = JSON.stringify(metafileData);
    const mockFile = new File([fileContent], "metafile.json", {
      type: "application/json",
    });

    const result = await processUploadedFile(mockFile);

    // Verify the structure of the returned data
    expect(result).toHaveProperty("metafile");
    expect(result).toHaveProperty("initialSummary");
    expect(result).toHaveProperty("chunks");
    expect(result).toHaveProperty("selectedChunk");
    expect(result).toHaveProperty("selectedModule");

    // selectedModule can be null or a string
    expect(
      result.selectedModule === null ||
        typeof result.selectedModule === "string"
    ).toBe(true);
  });

  it("should handle metafile with no chunks gracefully", async () => {
    // Create a metafile with inputs but no outputs (shouldn't happen in practice, but tests edge case)
    const emptyMetafile = createMockMetafile({
      outputs: {}, // Empty outputs
    });
    const fileContent = JSON.stringify(emptyMetafile);
    const mockFile = createMockFile(fileContent);

    // This should throw an error since summarizeInitial can't determine initial output
    await expect(processUploadedFile(mockFile)).rejects.toThrow(
      "Failed to process metafile: Could not determine initial output"
    );
  });

  it("should handle metafile with chunks but no valid entry points", async () => {
    // Create a metafile where chunks exist but entry points are not included in inputs
    const metafileWithInvalidEntryPoints = {
      inputs: {
        "src/index.ts": { bytes: 100, imports: [] },
      },
      outputs: {
        "dist/index.js": {
          bytes: 100,
          inputs: { "src/index.ts": { bytesInOutput: 100 } },
          entryPoint: "src/missing.ts", // Entry point not in inputs
        },
      },
    };
    const fileContent = JSON.stringify(metafileWithInvalidEntryPoints);
    const mockFile = createMockFile(fileContent);

    const result = await processUploadedFile(mockFile);

    // Should still work and select the chunk
    expect(result.chunks).toHaveLength(1);
    expect(result.selectedChunk).toBeDefined();
    expect(result.selectedModule).toBeNull(); // No valid entry point
  });
});
