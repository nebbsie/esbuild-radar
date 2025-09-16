"use client";

import { FileTree } from "@/components/file-tree";
import { Sunburst } from "@/components/sunburst";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/format";
import { buildPathTree } from "@/lib/path-tree";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { Eye, EyeOff, List, Minimize2, PieChart, X } from "lucide-react";
import * as React from "react";

interface FilesPanelProps {
  metafile: Metafile;
  selectedChunk: InitialChunkSummary | null;
  showNodeModules: boolean;
  setShowNodeModules: (value: boolean) => void;
  allCollapsed: boolean;
  setAllCollapsed: (value: boolean) => void;
  onSelectModule: (mod: string) => void;
  selectedModule: string | null;
  chunkSearch: string;
  filteredChunks: InitialChunkSummary[];
  onCloseChunk?: () => void;
}

export function FilesPanel({
  metafile,
  selectedChunk,
  showNodeModules,
  setShowNodeModules,
  allCollapsed,
  setAllCollapsed,
  onSelectModule,
  selectedModule,
  chunkSearch,
  filteredChunks,
  onCloseChunk,
}: FilesPanelProps) {
  const [viewMode, setViewMode] = React.useState<"tree" | "sunburst">("tree");
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-0">
        <div className="flex flex-col">
          <div className="flex-1">
            <div className="h-[28px] flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              {selectedChunk ? (
                <>
                  <span className="flex-1 inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 min-w-0">
                    <span className="truncate" title={selectedChunk.outputFile}>
                      {selectedChunk.outputFile}
                    </span>
                  </span>

                  <span className="flex-none inline-flex items-center whitespace-nowrap rounded-md border border-border bg-secondary px-2 py-0.5 text-secondary-foreground">
                    {formatBytes(
                      Math.max(0, (selectedChunk.bytes as number) || 0)
                    )}
                  </span>

                  {onCloseChunk && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-[28px] w-[28px] p-0 hover:bg-accent flex-shrink-0"
                      onClick={onCloseChunk}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground/60">All files</span>
              )}
            </div>
          </div>

          <div className="flex gap-1 justify-end pt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setViewMode(viewMode === "tree" ? "sunburst" : "tree")
                    }
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    {viewMode === "tree" ? (
                      <PieChart className="h-4 w-4" />
                    ) : (
                      <List className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {viewMode === "tree"
                      ? "Show sunburst view"
                      : "Show tree view"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNodeModules(!showNodeModules)}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    {showNodeModules ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {showNodeModules
                      ? "Hide third-party libraries"
                      : "Show third-party libraries"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAllCollapsed(!allCollapsed)}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {allCollapsed
                      ? "Show all folder contents"
                      : "Hide folder contents"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col h-full overflow-hidden px-3">
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-2" data-chunk-contents>
              {(() => {
                let files: Array<{ path: string; size: number }> = [];

                if (selectedChunk) {
                  // Show files from the selected chunk
                  const output = metafile.outputs[selectedChunk.outputFile];
                  const inputsMap = output?.inputs || {};

                  files = (selectedChunk.includedInputs || [])
                    .filter((p) => showNodeModules || !/node_modules/.test(p))
                    .map((p) => {
                      const bytesInOutput = inputsMap[p]?.bytesInOutput;
                      const size =
                        typeof bytesInOutput === "number" && bytesInOutput > 0
                          ? bytesInOutput
                          : 0;
                      return { path: p, size };
                    })
                    .filter((f) => f.size > 0);
                } else {
                  const fileBundledSizes: Record<string, number> = {};
                  if (metafile && filteredChunks.length > 0) {
                    filteredChunks.forEach((chunk) => {
                      const output = metafile.outputs[chunk.outputFile];
                      if (output?.inputs) {
                        Object.entries(output.inputs).forEach(
                          ([filePath, inputMeta]) => {
                            const bundledSize = inputMeta.bytesInOutput || 0;
                            if (bundledSize > 0) {
                              fileBundledSizes[filePath] =
                                (fileBundledSizes[filePath] || 0) + bundledSize;
                            }
                          }
                        );
                      }
                    });
                  }

                  files = metafile
                    ? Object.keys(fileBundledSizes)
                        .filter(
                          (path) =>
                            showNodeModules || !/node_modules/.test(path)
                        )
                        .map((path) => ({
                          path,
                          size: fileBundledSizes[path] || 0,
                        }))
                    : [];
                }

                const tree = buildPathTree(files, true);

                // Error / empty handling outside memo
                if (tree.children?.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <div className="text-sm text-muted-foreground">
                        {showNodeModules
                          ? selectedChunk
                            ? "No files found in this chunk."
                            : "No files found in the metafile."
                          : "Third-party libraries are hidden. Click the eye icon above to show them."}
                      </div>
                    </div>
                  );
                }

                return viewMode === "sunburst" ? (
                  <div className="px-1 h-full">
                    <Sunburst
                      tree={tree}
                      onSelectFile={onSelectModule}
                      selectedPath={selectedModule}
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="space-y-1 overflow-hidden px-1">
                    <div className="space-y-2">
                      {tree.children?.map((child) => (
                        <FileTree
                          key={child.path || child.name}
                          tree={child}
                          onSelectFile={onSelectModule}
                          selectedPath={selectedModule}
                          highlightText={chunkSearch}
                          allCollapsed={allCollapsed}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
