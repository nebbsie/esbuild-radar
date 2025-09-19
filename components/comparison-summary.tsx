"use client";

import { ChunkMatches } from "@/components/chunk-matches";
import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import { Badge } from "@/components/ui/badge";
import { matchChunksBetweenBuilds } from "@/lib/chunk-similarity";
import { formatBytes } from "@/lib/format";
import {
  getScoreColor,
  getScoreDescription,
  scoreChange,
} from "@/lib/score-utils";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import React from "react";

interface ComparisonSummaryProps {
  leftChunks: InitialChunkSummary[];
  rightChunks: InitialChunkSummary[];
  leftInitialChunks: InitialChunkSummary[];
  rightInitialChunks: InitialChunkSummary[];
  leftLazyChunks: InitialChunkSummary[];
  rightLazyChunks: InitialChunkSummary[];
  leftMetafile?: Metafile;
  rightMetafile?: Metafile;
  onRegisterScroller?: (fn: (outputFile: string) => void) => void;
}

interface SizeComparison {
  left: number;
  right: number;
  difference: number;
  percentage: number;
}

function calculateSizeComparison(
  leftChunks: InitialChunkSummary[],
  rightChunks: InitialChunkSummary[]
): SizeComparison {
  const leftTotal = leftChunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  const rightTotal = rightChunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  const difference = rightTotal - leftTotal;
  const percentage = leftTotal > 0 ? (difference / leftTotal) * 100 : 0;

  return {
    left: leftTotal,
    right: rightTotal,
    difference,
    percentage,
  };
}

function getComparisonBadgeVariant(
  percentage: number,
  isLazyChunks: boolean = false
) {
  if (Math.abs(percentage) < 0.1) return "secondary" as const;

  if (isLazyChunks) {
    // For lazy chunks: increases are good (default), decreases are bad (destructive)
    return percentage > 0 ? ("default" as const) : ("destructive" as const);
  } else {
    // For initial chunks: increases are bad (destructive), decreases are good (default)
    return percentage > 0 ? ("destructive" as const) : ("default" as const);
  }
}

function getComparisonBackground(
  percentage: number,
  isLazyChunks: boolean = false
) {
  if (Math.abs(percentage) < 0.1) return "bg-muted/30 border-border";

  if (isLazyChunks) {
    // For lazy chunks: increases are good (green), decreases are bad (red)
    return percentage > 0
      ? "bg-green-50 border-green-200"
      : "bg-red-50 border-red-200";
  } else {
    // For initial chunks: increases are bad (red), decreases are good (green)
    return percentage > 0
      ? "bg-red-50 border-red-200"
      : "bg-green-50 border-green-200";
  }
}

export function ComparisonSummary({
  leftChunks,
  rightChunks,
  leftInitialChunks,
  rightInitialChunks,
  leftLazyChunks,
  rightLazyChunks,
  leftMetafile,
  rightMetafile,
  onRegisterScroller,
}: ComparisonSummaryProps) {
  const initialComparison = calculateSizeComparison(
    leftInitialChunks,
    rightInitialChunks
  );
  const lazyComparison = calculateSizeComparison(
    leftLazyChunks,
    rightLazyChunks
  );

  // Calculate overall score
  const scoreResult = scoreChange({
    totalLeft: initialComparison.left + lazyComparison.left,
    totalRight: initialComparison.right + lazyComparison.right,
    eagerLeft: initialComparison.left,
    eagerRight: initialComparison.right,
    chunksLeft: leftChunks.length,
    chunksRight: rightChunks.length,
  });

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [sortMode, setSortMode] = React.useState<"increase" | "decrease">(
    "decrease"
  );

  React.useEffect(() => {
    if (!onRegisterScroller) return;
    const scrollToChunk = (outputFile: string) => {
      if (!containerRef.current) return;
      const target = containerRef.current.querySelector(
        `[data-chunk-id="${CSS.escape(outputFile)}"]`
      ) as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: "auto", block: "center" });
        // Flash highlight
        target.classList.add("flash-highlight");
        window.setTimeout(() => {
          target.classList.remove("flash-highlight");
        }, 600);
      }
    };
    onRegisterScroller(scrollToChunk);
  }, [onRegisterScroller]);

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Sticky Top Section */}
      <div className="sticky top-0 bg-background z-10 space-y-2 pb-3 border-b">
        {/* Compact Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Initial Chunks */}
          <div
            className={`p-2 rounded-lg border ${getComparisonBackground(initialComparison.percentage, false)}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <ChunkTypeIcon type="initial" size={10} />
                <span className="text-xs text-muted-foreground">
                  Initial Chunks
                </span>
              </div>
              <span className="text-xs font-medium">
                {leftInitialChunks.length} → {rightInitialChunks.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatBytes(initialComparison.left)} →{" "}
                {formatBytes(initialComparison.right)}
              </span>
              <Badge
                variant={getComparisonBadgeVariant(
                  initialComparison.percentage,
                  false
                )}
                className="text-xs px-1 py-0"
              >
                {initialComparison.difference > 0
                  ? "+"
                  : initialComparison.difference < 0
                    ? "-"
                    : ""}
                {formatBytes(Math.abs(initialComparison.difference))}
              </Badge>
            </div>
          </div>

          {/* Lazy Chunks */}
          <div
            className={`p-2 rounded-lg border ${getComparisonBackground(lazyComparison.percentage, true)}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <ChunkTypeIcon type="lazy" size={10} />
                <span className="text-xs text-muted-foreground">
                  Lazy Chunks
                </span>
              </div>
              <span className="text-xs font-medium">
                {leftLazyChunks.length} → {rightLazyChunks.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatBytes(lazyComparison.left)} →{" "}
                {formatBytes(lazyComparison.right)}
              </span>
              <Badge
                variant={getComparisonBadgeVariant(
                  lazyComparison.percentage,
                  true
                )}
                className="text-xs px-1 py-0"
              >
                {lazyComparison.difference > 0
                  ? "+"
                  : lazyComparison.difference < 0
                    ? "-"
                    : ""}
                {formatBytes(Math.abs(lazyComparison.difference))}
              </Badge>
            </div>
          </div>
        </div>

        {/* Total Code Size + Score Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Total Code Size */}
          <div
            className={`p-2 rounded-lg border ${getComparisonBackground(
              calculateSizeComparison(leftChunks, rightChunks).percentage,
              false
            )}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Total Code Size
              </span>
              <span className="text-xs font-medium">
                {leftChunks.length} → {rightChunks.length} chunks
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatBytes(leftChunks.reduce((s, c) => s + c.bytes, 0))} →{" "}
                {formatBytes(rightChunks.reduce((s, c) => s + c.bytes, 0))}
              </span>
              <Badge
                variant={getComparisonBadgeVariant(
                  calculateSizeComparison(leftChunks, rightChunks).percentage,
                  false
                )}
                className="text-xs px-1 py-0"
              >
                {calculateSizeComparison(leftChunks, rightChunks).difference > 0
                  ? "+"
                  : calculateSizeComparison(leftChunks, rightChunks)
                        .difference < 0
                    ? "-"
                    : ""}
                {formatBytes(
                  Math.abs(
                    calculateSizeComparison(leftChunks, rightChunks).difference
                  )
                )}
              </Badge>
            </div>
          </div>

          {/* Score pill */}
          <div className="p-2 rounded-lg border bg-muted/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {scoreResult.verdict === "positive" && (
                  <span className="text-green-600">✅</span>
                )}
                {scoreResult.verdict === "mixed" && (
                  <span className="text-orange-600">⚠️</span>
                )}
                {scoreResult.verdict === "negative" && (
                  <span className="text-red-600">❌</span>
                )}
                <span className="text-xs font-medium">Overall change</span>
              </div>
              <Badge
                className={`text-xs px-1 py-0 ${getScoreColor(scoreResult.verdict)}`}
              >
                {scoreResult.verdict}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {getScoreDescription(scoreResult)}
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-end gap-2">
          <label className="text-xs text-muted-foreground">Order by:</label>
          <select
            value={sortMode}
            onChange={(e) =>
              setSortMode(e.target.value as "increase" | "decrease")
            }
            className="px-2 py-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="increase">Most increased</option>
            <option value="decrease">Most decreased</option>
          </select>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-4 pt-4">
        {/* Initial Chunk Matches */}
        <div className="space-y-2">
          <ChunkMatches
            comparison={matchChunksBetweenBuilds(
              leftInitialChunks,
              rightInitialChunks
            )}
            isLazyChunks={false}
            leftMetafile={leftMetafile}
            rightMetafile={rightMetafile}
            sortMode={sortMode}
          />
        </div>

        {/* Lazy Chunk Matches */}
        <div className="space-y-2">
          <ChunkMatches
            comparison={matchChunksBetweenBuilds(
              leftLazyChunks,
              rightLazyChunks
            )}
            isLazyChunks={true}
            leftMetafile={leftMetafile}
            rightMetafile={rightMetafile}
            sortMode={sortMode}
          />
        </div>
      </div>
    </div>
  );
}
