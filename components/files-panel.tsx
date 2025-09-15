"use client";

import { FileTree } from "@/components/file-tree";
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
import { Eye, EyeOff, File, FileText, Minimize2 } from "lucide-react";

interface FilesPanelProps {
  metafile: Metafile;
  selectedChunk: InitialChunkSummary | null;
  showNodeModules: boolean;
  setShowNodeModules: (value: boolean) => void;
  showFullPaths: boolean;
  setShowFullPaths: (value: boolean) => void;
  allCollapsed: boolean;
  setAllCollapsed: (value: boolean) => void;
  onSelectModule: (mod: string) => void;
  selectedModule: string | null;
  chunkSearch: string;
}

export function FilesPanel({
  metafile,
  selectedChunk,
  showNodeModules,
  setShowNodeModules,
  showFullPaths,
  setShowFullPaths,
  allCollapsed,
  setAllCollapsed,
  onSelectModule,
  selectedModule,
  chunkSearch,
}: FilesPanelProps) {
  return (
    <Card className="h-full gap-0">
      <CardHeader className="pb-0">
        <div className="flex flex-col">
          <div className="flex-1">
            {selectedChunk && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                <span className="flex-1 h-[28px] inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 min-w-0">
                  <span className="truncate" title={selectedChunk.outputFile}>
                    {selectedChunk.outputFile}
                  </span>
                </span>

                <span className="flex-none h-[28px] inline-flex items-center whitespace-nowrap rounded-md border border-border bg-secondary px-2 py-0.5 text-secondary-foreground">
                  {formatBytes(
                    Math.max(0, (selectedChunk.bytes as number) || 0)
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-1 justify-end pt-2">
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
                    onClick={() => setShowFullPaths(!showFullPaths)}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    {showFullPaths ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <File className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {showFullPaths
                      ? "Show simplified folder names"
                      : "Show complete file paths"}
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
                let files: Array<{ path: string; size: number }>;

                if (selectedChunk) {
                  // Show files from the selected chunk
                  const output = metafile.outputs[selectedChunk.outputFile];
                  const inputsMap = output?.inputs || {};

                  files = (selectedChunk.includedInputs || [])
                    .filter((p) => showNodeModules || !/node_modules/.test(p))
                    .map((p) => {
                      const size =
                        (inputsMap[p]?.bytesInOutput as number | undefined) ||
                        (inputsMap[p]?.bytes as number | undefined) ||
                        0;
                      return {
                        path: p,
                        size,
                      };
                    });
                } else {
                  // Show all files from the metafile when no chunk is selected
                  files = metafile
                    ? Object.entries(metafile.inputs)
                        .filter(
                          ([path]) =>
                            showNodeModules || !/node_modules/.test(path)
                        )
                        .map(([path, input]) => ({
                          path,
                          size: input.bytes || 0,
                        }))
                    : [];
                }
                const tree = buildPathTree(files, showFullPaths);

                // Check if no files are visible due to node_modules filtering
                if (files.length === 0 && !showNodeModules && selectedChunk) {
                  return (
                    <div className="text-center py-8">
                      <div className="text-sm text-muted-foreground">
                        Third-party libraries are hidden. Click the eye icon
                        above to show them.
                      </div>
                    </div>
                  );
                }

                // Show message when no files are available
                if (files.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <div className="text-sm text-muted-foreground">
                        {selectedChunk
                          ? "No files found in this chunk."
                          : "No files found in the metafile."}
                      </div>
                    </div>
                  );
                }

                return (
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
