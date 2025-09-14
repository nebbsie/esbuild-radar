"use client";

import { FileTree } from "@/components/file-tree";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle>Files In Selected Chunk</CardTitle>
            <CardDescription>
              {selectedChunk
                ? `Files included in ${selectedChunk.outputFile}`
                : "Select a chunk to see its files."}
            </CardDescription>
          </div>
          <div className="flex gap-1">
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
      <CardContent className="flex flex-col h-full overflow-hidden px-3 py-2">
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="space-y-2 px-1" data-chunk-contents>
              {(() => {
                let files: Array<{ path: string; size: number }>;

                if (selectedChunk) {
                  // Show files from the selected chunk
                  const output = metafile.outputs[selectedChunk.outputFile];
                  const inputsMap = output?.inputs || {};
                  files = (selectedChunk.includedInputs || [])
                    .filter((p) => showNodeModules || !/node_modules/.test(p))
                    .map((p) => ({
                      path: p,
                      size:
                        (inputsMap[p]?.bytesInOutput as number | undefined) ||
                        (inputsMap[p]?.bytes as number | undefined) ||
                        0,
                    }));
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
