"use client";

import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import { Badge } from "@/components/ui/badge";
import { ChunkComparison } from "@/lib/chunk-similarity";
import { formatBytes } from "@/lib/format";
import type { InitialChunkSummary, Metafile } from "@/lib/types";

interface ChunkMatchesProps {
  comparison: ChunkComparison;
  isLazyChunks?: boolean;
  leftMetafile?: Metafile;
  rightMetafile?: Metafile;
  sortMode?: "increase" | "decrease";
}

export function ChunkMatches({
  comparison,
  isLazyChunks = false,
  leftMetafile,
  rightMetafile,
  sortMode = "increase",
}: ChunkMatchesProps) {
  const { matchedChunks, unmatchedLeft, unmatchedRight } = comparison;

  const getFileBundledSize = (
    filePath: string,
    chunk: InitialChunkSummary,
    metafile?: Metafile
  ): number => {
    if (!metafile?.inputs?.[filePath]) return 0;

    const rawFileSize = metafile.inputs[filePath].bytes || 0;
    const totalRawSize = chunk.includedInputs.reduce((sum, input) => {
      return sum + (metafile.inputs[input]?.bytes || 0);
    }, 0);

    // Calculate proportional bundled size
    if (totalRawSize === 0) return 0;
    const proportion = rawFileSize / totalRawSize;
    return Math.round(chunk.bytes * proportion);
  };

  const getSizeChangeColor = (leftSize: number, rightSize: number) => {
    const diff = rightSize - leftSize;
    const percentage = leftSize > 0 ? (diff / leftSize) * 100 : 0;

    if (Math.abs(percentage) < 1) return "text-muted-foreground";

    if (isLazyChunks) {
      // For lazy chunks: increases are good (green), decreases are bad (red)
      return diff > 0 ? "text-green-600" : "text-red-600";
    } else {
      // For initial chunks: increases are bad (red), decreases are good (green)
      return diff > 0 ? "text-red-600" : "text-green-600";
    }
  };

  const getSizeChangeBadgeVariant = (leftSize: number, rightSize: number) => {
    const diff = rightSize - leftSize;
    const percentage = leftSize > 0 ? (diff / leftSize) * 100 : 0;

    if (Math.abs(percentage) < 1) return "secondary" as const;

    if (isLazyChunks) {
      // For lazy chunks: increases are good (default), decreases are bad (destructive)
      return diff > 0 ? ("default" as const) : ("destructive" as const);
    } else {
      // For initial chunks: increases are bad (destructive), decreases are good (default)
      return diff > 0 ? ("destructive" as const) : ("default" as const);
    }
  };

  const getRowClass = (
    leftSize: number,
    rightSize: number,
    isWeak: boolean
  ) => {
    const diff = rightSize - leftSize;
    const percentage = leftSize > 0 ? (diff / leftSize) * 100 : 0;

    let baseClass = "bg-background border-border";

    if (isWeak) {
      baseClass = "bg-orange-50/30 border-orange-200";
    } else if (Math.abs(percentage) >= 1) {
      if (isLazyChunks) {
        // For lazy chunks: increases are good (green), decreases are bad (red)
        baseClass =
          diff > 0
            ? "bg-green-50/30 border-green-200"
            : "bg-red-50/30 border-red-200";
      } else {
        // For initial chunks: increases are bad (red), decreases are good (green)
        baseClass =
          diff > 0
            ? "bg-red-50/30 border-red-200"
            : "bg-green-50/30 border-green-200";
      }
    }

    return baseClass;
  };

  // Create a unified list of all chunks, sortable by increase/decrease
  const allChunks = [
    ...matchedChunks.map((match, index) => {
      const sizeChange = match.rightChunk.bytes - match.leftChunk.bytes;
      const percentageChange =
        match.leftChunk.bytes > 0
          ? (sizeChange / match.leftChunk.bytes) * 100
          : 0;
      return {
        type: "matched" as const,
        match,
        index,
        percentageChange,
      };
    }),
    ...unmatchedRight.map((chunk, index) => ({
      type: "added" as const,
      chunk,
      index,
      percentageChange: Number.POSITIVE_INFINITY,
    })),
    ...unmatchedLeft.map((chunk, index) => ({
      type: "removed" as const,
      chunk,
      index,
      percentageChange: Number.NEGATIVE_INFINITY,
    })),
  ].sort((a, b) => {
    if (sortMode === "increase") {
      // Most increased first
      return (b.percentageChange ?? 0) - (a.percentageChange ?? 0);
    } else {
      // Most decreased first
      return (a.percentageChange ?? 0) - (b.percentageChange ?? 0);
    }
  });

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-muted-foreground">
        {isLazyChunks ? "Lazy" : "Initial"} Chunks ({allChunks.length})
      </h4>

      <div className="space-y-2">
        {allChunks.map((item) => {
          if (item.type === "matched") {
            const { match } = item;
            const sizeChange = match.rightChunk.bytes - match.leftChunk.bytes;
            const sizeChangePercentage =
              match.leftChunk.bytes > 0
                ? (sizeChange / match.leftChunk.bytes) * 100
                : 0;

            return (
              <div
                key={`matched-${item.index}`}
                data-chunk-id={match.rightChunk.outputFile}
                className={`p-2 border rounded-lg hover:opacity-80 transition-colors ${getRowClass(match.leftChunk.bytes, match.rightChunk.bytes, match.matchType === "weak")}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ChunkTypeIcon
                      type={isLazyChunks ? "lazy" : "initial"}
                      size={10}
                      variant="swatch"
                    />
                    <span className="text-xs text-muted-foreground">
                      {match.leftChunk.outputFile ===
                      match.rightChunk.outputFile
                        ? `${match.leftChunk.outputFile} was unchanged`
                        : `${match.leftChunk.outputFile} renamed to ${match.rightChunk.outputFile}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {match.matchType === "weak" && (
                      <Badge
                        variant="outline"
                        className="text-xs text-orange-600 border-orange-200"
                      >
                        weak match
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded border border-border/50">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs ${getSizeChangeColor(match.leftChunk.bytes, match.rightChunk.bytes)}`}
                    >
                      {formatBytes(match.leftChunk.bytes)} →{" "}
                      {formatBytes(match.rightChunk.bytes)}
                    </span>
                    <Badge
                      variant={getSizeChangeBadgeVariant(
                        match.leftChunk.bytes,
                        match.rightChunk.bytes
                      )}
                      className="text-xs"
                    >
                      {sizeChange > 0 ? "+" : sizeChange < 0 ? "-" : ""}
                      {formatBytes(Math.abs(sizeChange))}
                      {Math.abs(sizeChangePercentage) >= 1 && (
                        <span className="ml-1">
                          (
                          {sizeChangePercentage > 0
                            ? "+"
                            : sizeChangePercentage < 0
                              ? "-"
                              : ""}
                          {Math.abs(sizeChangePercentage).toFixed(1)}%)
                        </span>
                      )}
                    </Badge>
                  </div>
                </div>

                {/* File Changes - Only show if there are changes */}
                {(() => {
                  const leftFiles = new Set(match.leftChunk.includedInputs);
                  const rightFiles = new Set(match.rightChunk.includedInputs);
                  const addedFiles = [...rightFiles].filter(
                    (file) => !leftFiles.has(file)
                  );
                  const removedFiles = [...leftFiles].filter(
                    (file) => !rightFiles.has(file)
                  );

                  if (addedFiles.length === 0 && removedFiles.length === 0) {
                    return null;
                  }

                  return (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        File changes ({addedFiles.length + removedFiles.length})
                      </summary>
                      <div className="mt-2 space-y-2 pl-2">
                        {addedFiles.length > 0 && (
                          <div>
                            <div className="text-green-600 font-medium mb-1">
                              +{addedFiles.length} added:
                            </div>
                            <div className="space-y-0.5">
                              {addedFiles.map((file, idx) => {
                                const fileSize = getFileBundledSize(
                                  file,
                                  match.rightChunk,
                                  rightMetafile
                                );
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between font-mono text-xs text-muted-foreground"
                                    title={file}
                                  >
                                    <span>{file.split("/").pop()}</span>
                                    {fileSize > 0 && (
                                      <span className="text-green-600">
                                        +{formatBytes(fileSize)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {removedFiles.length > 0 && (
                          <div>
                            <div className="text-red-600 font-medium mb-1">
                              -{removedFiles.length} removed:
                            </div>
                            <div className="space-y-0.5">
                              {removedFiles.map((file, idx) => {
                                const fileSize = getFileBundledSize(
                                  file,
                                  match.leftChunk,
                                  leftMetafile
                                );
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between font-mono text-xs text-muted-foreground"
                                    title={file}
                                  >
                                    <span>{file.split("/").pop()}</span>
                                    {fileSize > 0 && (
                                      <span className="text-red-600">
                                        -{formatBytes(fileSize)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })()}
              </div>
            );
          } else if (item.type === "added") {
            const { chunk } = item;
            return (
              <div
                key={`added-${item.index}`}
                data-chunk-id={chunk.outputFile}
                className="p-2 border border-green-200 bg-green-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <ChunkTypeIcon
                    type={isLazyChunks ? "lazy" : "initial"}
                    size={10}
                    variant="swatch"
                  />
                  <span className="text-xs text-muted-foreground">
                    {chunk.outputFile} was added
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    {chunk.outputFile}
                  </span>
                  <span className="text-xs text-green-600">
                    +{formatBytes(chunk.bytes)}
                  </span>
                </div>
              </div>
            );
          } else if (item.type === "removed") {
            const { chunk } = item;
            return (
              <div
                key={`removed-${item.index}`}
                data-chunk-id={chunk.outputFile}
                className="p-2 border border-red-200 bg-red-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <ChunkTypeIcon
                    type={isLazyChunks ? "lazy" : "initial"}
                    size={10}
                    variant="swatch"
                  />
                  <span className="text-xs text-muted-foreground">
                    {chunk.outputFile} was removed
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    {chunk.outputFile}
                  </span>
                  <span className="text-xs text-red-600">
                    -{formatBytes(chunk.bytes)}
                  </span>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
