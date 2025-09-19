import type { AnalysedStats } from "./stats-analyser";
import type { MetafileData } from "./types";

interface CachedBundle {
  bundleData: MetafileData;
  analysis: AnalysedStats;
  timestamp: number;
}

class BundleCache {
  private cache = new Map<string, CachedBundle>();

  get(bundleId: string): AnalysedStats | null {
    const cached = this.cache.get(bundleId);
    return cached ? cached.analysis : null;
  }

  set(
    bundleId: string,
    bundleData: MetafileData,
    analysis: AnalysedStats
  ): void {
    this.cache.set(bundleId, {
      bundleData,
      analysis,
      timestamp: Date.now(),
    });
  }

  delete(bundleId: string): void {
    this.cache.delete(bundleId);
  }

  clear(): void {
    this.cache.clear();
  }

  has(bundleId: string): boolean {
    return this.cache.has(bundleId);
  }
}

export const bundleCache = new BundleCache();
