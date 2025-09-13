import { summarizeInitial } from "@/lib/initial-summary";
import { parseMetafile } from "@/lib/metafile";
// @ts-ignore - Node.js types available at runtime
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const statsPath = new URL("../stats.json", import.meta.url);

const meta = parseMetafile(JSON.parse(readFileSync(statsPath, "utf-8")));

describe("summarizeInitial", () => {
  it("computes total bytes for initial bundle", () => {
    const result = summarizeInitial(meta);
    // Convert to KB with 2 decimal places like CLI output
    const kb = result.initial.totalBytes / 1024;
    expect(Number(kb.toFixed(2))).toBeCloseTo(3871.67, 2);
  });

  it("finds expected number of initial chunks", () => {
    const result = summarizeInitial(meta);
    expect(result.initial.outputs.length).toBe(67);
  });

  it("computes total bytes for lazy chunks", () => {
    const result = summarizeInitial(meta);
    // Lazy chunks should be 7.8 MB (after filtering out server code and non-browser outputs)
    const mb = result.lazy.totalBytes / (1024 * 1024);
    expect(Number(mb.toFixed(1))).toBe(7.8);
  });

  it("finds lazy chunks", () => {
    const result = summarizeInitial(meta);
    // Should have some lazy chunks (after filtering out server code and non-browser outputs)
    expect(result.lazy.outputs.length).toBe(363);
  });

  it("ensures no overlap between initial and lazy chunks", () => {
    const result = summarizeInitial(meta);
    const initialSet = new Set(result.initial.outputs);
    const lazySet = new Set(result.lazy.outputs);

    // Check that no chunk is both initial and lazy
    for (const chunk of result.initial.outputs) {
      expect(lazySet.has(chunk)).toBe(false);
    }

    for (const chunk of result.lazy.outputs) {
      expect(initialSet.has(chunk)).toBe(false);
    }
  });

  it("total bytes equals sum of initial and lazy bytes", () => {
    const result = summarizeInitial(meta);
    const totalBytes = result.initial.totalBytes + result.lazy.totalBytes;

    // Calculate total from all outputs to verify
    const allOutputs = new Set([
      ...result.initial.outputs,
      ...result.lazy.outputs,
    ]);
    let calculatedTotal = 0;
    for (const output of allOutputs) {
      calculatedTotal += meta.outputs[output]?.bytes ?? 0;
    }

    expect(totalBytes).toBe(calculatedTotal);
  });
});
