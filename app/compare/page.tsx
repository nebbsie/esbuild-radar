"use client";

import { ChunksPanel } from "@/components/chunks-panel";
import { ComparisonSummary } from "@/components/comparison-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createChunkSummaries } from "@/lib/chunk-utils";
import { parseMetafile } from "@/lib/metafile";
import { analyseStats } from "@/lib/stats-analyser";
import { metafileStorage } from "@/lib/storage";
import type { InitialChunkSummary, Metafile, MetafileData } from "@/lib/types";
import { ArrowLeft, GitCompare } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

interface BundleSelection {
  bundle: MetafileData | null;
  metafile: Metafile | null;
  initialChunks: InitialChunkSummary[];
  lazyChunks: InitialChunkSummary[];
  chunks: InitialChunkSummary[];
  initialSummary: {
    initial: { outputs: string[]; totalBytes: number };
    lazy: { outputs: string[]; totalBytes: number };
  } | null;
  initialChunk: InitialChunkSummary | null;
}

export default function ComparePage() {
  const router = useRouter();
  const [bundles, setBundles] = React.useState<MetafileData[]>([]);
  const [leftSide, setLeftSide] = React.useState<BundleSelection>({
    bundle: null,
    metafile: null,
    initialChunks: [],
    lazyChunks: [],
    chunks: [],
    initialSummary: null,
    initialChunk: null,
  });
  const [rightSide, setRightSide] = React.useState<BundleSelection>({
    bundle: null,
    metafile: null,
    initialChunks: [],
    lazyChunks: [],
    chunks: [],
    initialSummary: null,
    initialChunk: null,
  });
  const [isLoading, setIsLoading] = React.useState(true);

  // Load all bundles on mount
  React.useEffect(() => {
    const loadBundles = async () => {
      try {
        const allBundles = await metafileStorage.getAllBundles();
        setBundles(allBundles);
      } catch (err) {
        console.error("Failed to load bundles:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadBundles();
  }, []);

  const loadBundleData = React.useCallback(async (bundleData: MetafileData) => {
    try {
      const json = JSON.parse(bundleData.data);
      const mf = parseMetafile(json);
      const analysis = analyseStats(mf);

      return {
        bundle: bundleData,
        metafile: analysis.metafile,
        initialChunks: createChunkSummaries(
          analysis.initialSummary.initial.outputs,
          analysis.metafile
        ),
        lazyChunks: createChunkSummaries(
          analysis.initialSummary.lazy.outputs,
          analysis.metafile
        ),
        chunks: analysis.chunks,
        initialSummary: analysis.initialSummary,
        initialChunk: analysis.initialChunk,
      };
    } catch (err) {
      console.error("Failed to parse metafile:", err);
      return null;
    }
  }, []);

  const handleLeftSideSelection = React.useCallback(
    async (bundleId: string) => {
      const bundleData = bundles.find((b) => b.id === bundleId);
      if (bundleData) {
        const data = await loadBundleData(bundleData);
        if (data) {
          setLeftSide(data);
        }
      }
    },
    [bundles, loadBundleData]
  );

  const handleRightSideSelection = React.useCallback(
    async (bundleId: string) => {
      const bundleData = bundles.find((b) => b.id === bundleId);
      if (bundleData) {
        const data = await loadBundleData(bundleData);
        if (data) {
          setRightSide(data);
        }
      }
    },
    [bundles, loadBundleData]
  );

  const formatBundleName = (name?: string) => {
    if (!name) return "stats.json";
    return name.length > 30 ? `${name.slice(0, 30)}...` : name;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin"
            aria-label="Loading"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/results")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Results
          </Button>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <GitCompare className="h-5 w-5" />
            Bundle Comparison
          </div>
        </div>
      </div>

      <div className="mx-auto w-full h-[calc(100vh-2rem-68px)]">
        <div className="flex gap-4 h-full">
          {/* Left Side - 31% width */}
          <div className="w-[31%]">
            <Card className="h-full gap-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Left Side</CardTitle>
                <div className="space-y-2">
                  <select
                    value={leftSide.bundle?.id || ""}
                    onChange={(e) => handleLeftSideSelection(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select a bundle...</option>
                    {bundles.map((bundle) => (
                      <option key={bundle.id} value={bundle.id}>
                        {formatBundleName(bundle.name)}
                      </option>
                    ))}
                  </select>
                  {leftSide.bundle && (
                    <div className="text-xs text-muted-foreground">
                      {leftSide.bundle.name || "stats.json"}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {leftSide.metafile ? (
                  <ChunksPanel
                    metafile={leftSide.metafile}
                    initialChunks={leftSide.initialChunks}
                    lazyChunks={leftSide.lazyChunks}
                    chunkSearch=""
                    setChunkSearch={() => {}}
                    handleSearchKeyDown={() => {}}
                    chunkTypeFilters={{ initial: true, lazy: true }}
                    setChunkTypeFilters={() => {}}
                    showFilterMenu={false}
                    setShowFilterMenu={() => {}}
                    filteredChunks={leftSide.chunks}
                    chunks={leftSide.chunks}
                    selectedChunk={null}
                    navigateToModule={() => {}}
                    initialChunk={leftSide.initialChunk}
                    setSelectedModule={() => {}}
                    setSelectedChunk={() => {}}
                    setInclusion={() => {}}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <GitCompare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Select a bundle to compare</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Comparison Panel - 38% width */}
          <div className="w-[38%]">
            <Card className="h-full gap-0">
              <CardHeader className="pb-0 mb-0">
                <CardTitle className="text-base">Comparison</CardTitle>
              </CardHeader>
              <CardContent className="h-full overflow-y-auto">
                {leftSide.metafile && rightSide.metafile ? (
                  <ComparisonSummary
                    leftChunks={leftSide.chunks}
                    rightChunks={rightSide.chunks}
                    leftInitialChunks={leftSide.initialChunks}
                    rightInitialChunks={rightSide.initialChunks}
                    leftLazyChunks={leftSide.lazyChunks}
                    rightLazyChunks={rightSide.lazyChunks}
                    leftMetafile={leftSide.metafile}
                    rightMetafile={rightSide.metafile}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <GitCompare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        {!leftSide.metafile && !rightSide.metafile
                          ? "Select bundles on both sides to compare"
                          : !leftSide.metafile
                            ? "Select a bundle on the left"
                            : "Select a bundle on the right"}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Side - 31% width */}
          <div className="w-[31%]">
            <Card className="h-full gap-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Right Side</CardTitle>
                <div className="space-y-2">
                  <select
                    value={rightSide.bundle?.id || ""}
                    onChange={(e) => handleRightSideSelection(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select a bundle...</option>
                    {bundles.map((bundle) => (
                      <option key={bundle.id} value={bundle.id}>
                        {formatBundleName(bundle.name)}
                      </option>
                    ))}
                  </select>
                  {rightSide.bundle && (
                    <div className="text-xs text-muted-foreground">
                      {rightSide.bundle.name || "stats.json"}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {rightSide.metafile ? (
                  <ChunksPanel
                    metafile={rightSide.metafile}
                    initialChunks={rightSide.initialChunks}
                    lazyChunks={rightSide.lazyChunks}
                    chunkSearch=""
                    setChunkSearch={() => {}}
                    handleSearchKeyDown={() => {}}
                    chunkTypeFilters={{ initial: true, lazy: true }}
                    setChunkTypeFilters={() => {}}
                    showFilterMenu={false}
                    setShowFilterMenu={() => {}}
                    filteredChunks={rightSide.chunks}
                    chunks={rightSide.chunks}
                    selectedChunk={null}
                    navigateToModule={() => {}}
                    initialChunk={rightSide.initialChunk}
                    setSelectedModule={() => {}}
                    setSelectedChunk={() => {}}
                    setInclusion={() => {}}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <GitCompare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Select a bundle to compare</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          *still in development
        </p>

        <p className="font-mono text-xs text-muted-foreground">
          esbuildradar.com
        </p>
      </div>
    </div>
  );
}
