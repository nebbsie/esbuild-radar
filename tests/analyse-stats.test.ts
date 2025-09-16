import { analyseStats } from "@/lib/stats-analyser";
import { getStatsMetafile } from "@/tests/test-helpers";

const meta = getStatsMetafile();

describe("analyseStats", () => {
  it("classifies initial and lazy chunks without overlap", () => {
    const a = analyseStats(meta);
    const initialSet = new Set(a.initialSummary.initial.outputs);
    const lazySet = new Set(a.initialSummary.lazy.outputs);
    for (const o of initialSet) expect(lazySet.has(o)).toBe(false);
  });

  it("returns a main entry chunk present in chunks list", () => {
    const a = analyseStats(meta);
    if (a.initialChunk) {
      const found = a.chunks.find(
        (c) => c.outputFile === a.initialChunk!.outputFile
      );
      expect(found).toBeDefined();
    }
  });

  it("includes gzip/brotli estimates on every chunk", () => {
    const a = analyseStats(meta);
    for (const c of a.chunks) {
      expect(c.gzipBytes).toBeGreaterThan(0);
      expect(c.brotliBytes).toBeGreaterThan(0);
    }
  });
});
