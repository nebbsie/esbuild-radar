"use client";

import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getInclusionPath } from "@/lib/analyser";
import { getChunkLoadType } from "@/lib/chunk-utils";
import { formatBytes } from "@/lib/format";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { HelpCircle } from "lucide-react";

interface InclusionPathSectionProps {
  metafile: Metafile;
  selectedModule: string | null;
  chunks: InitialChunkSummary[];
  initialChunk: InitialChunkSummary | null;
  selectedChunk: InitialChunkSummary | null;
  initialSummary: {
    initial: { outputs: string[]; totalBytes: number };
    lazy: { outputs: string[]; totalBytes: number };
  } | null;
}

export function InclusionPathSection({
  metafile,
  selectedModule,
  chunks,
  initialChunk,
  selectedChunk,
  initialSummary,
}: InclusionPathSectionProps) {
  // Use the new getInclusionPath function to get import statements
  const inclusionPath = selectedModule
    ? getInclusionPath(metafile, selectedModule, chunks)
    : [];

  // Check if this module is the entry point of the MAIN APPLICATION bundle
  const isMainEntryPoint = selectedModule === initialChunk?.entryPoint;

  // Check if this module is the entry point of its own chunk (but not the main app entry)
  const isChunkEntryPoint = selectedModule === selectedChunk?.entryPoint;

  // Show special messages for entry points that have no inclusion path
  if (isMainEntryPoint && inclusionPath.length === 0) {
    // This is the actual main application entry point
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <ChunkTypeIcon type="main-entry" size={14} />
              </TooltipTrigger>
              <TooltipContent>
                <p>This is the entry point - where your application starts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-sm font-medium">Application Entry Point</span>
        </div>
        <p className="text-sm text-muted-foreground">
          This file is the starting point of your bundle and has no dependencies
          above it.
        </p>
      </div>
    );
  }

  if (isChunkEntryPoint && inclusionPath.length === 0 && !isMainEntryPoint) {
    // This is the entry point of a chunk (could be lazy or initial)
    const chunkType = getChunkLoadType(selectedChunk!, initialSummary);
    // Use main-entry icon if this is the main entry chunk
    const iconType =
      selectedChunk?.outputFile === initialChunk?.outputFile
        ? "main-entry"
        : chunkType;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <ChunkTypeIcon type={iconType} size={14} />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {chunkType === "lazy" ? "Lazy Chunk" : "Eager Chunk"} Entry
                  Point
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-sm font-medium">
            {chunkType === "lazy" ? "Lazy Chunk" : "Eager Chunk"} Entry Point
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          This file is the starting point of its{" "}
          {chunkType === "lazy" ? "lazy" : "initial"} chunk and has no
          dependencies above it within this chunk.
        </p>
      </div>
    );
  }

  if (inclusionPath.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
        <span>Inclusion Path</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={12}
                className="text-muted-foreground hover:text-foreground cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>How this file became part of the bundle</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h4>
      <div className="space-y-2">
        {inclusionPath.map((step, idx) => {
          // Find which chunk this file belongs to
          const chunkContainingFile = chunks.find((chunk) =>
            chunk.includedInputs.includes(step.file)
          );

          return (
            <div
              key={idx}
              className="flex items-start gap-2 p-1.5 rounded-md bg-muted/20"
            >
              <div className="flex-1 min-w-0">
                <div>
                  <span className="text-xs font-medium truncate block">
                    {step.file}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {step.importerChunkType === "lazy" && (
                      <span className="text-xs text-purple-600 font-medium whitespace-nowrap">
                        lazy
                      </span>
                    )}
                    {step.isDynamicImport ? (
                      <span className="text-xs text-purple-600 whitespace-nowrap">
                        lazily imports
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        imports
                      </span>
                    )}
                    <TooltipProvider>
                      <Tooltip delayDuration={700}>
                        <TooltipTrigger asChild>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono truncate hover:bg-muted/80">
                            {step.importStatement}
                          </code>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-xs">
                            <div className="font-medium">
                              {step.importStatement}
                            </div>
                            {chunkContainingFile ? (
                              <div className="text-muted-foreground mt-1">
                                {chunkContainingFile.outputFile} (
                                {formatBytes(chunkContainingFile.bytes)})
                              </div>
                            ) : (
                              <div className="text-muted-foreground mt-1">
                                No chunk information available
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {step.isDynamicImport &&
                    (() => {
                      // Find the chunk created by this dynamic import
                      const dynamicImportPath = step.importStatement.replace(
                        /^["']|["']$/g,
                        ""
                      );

                      // Look for chunks that have this path as their entry point or contain files from this path
                      const createdChunk = chunks.find((chunk) => {
                        // Check if this chunk's entry point matches the dynamic import
                        if (
                          chunk.entryPoint.includes(
                            dynamicImportPath.replace("./", "")
                          )
                        ) {
                          return true;
                        }
                        // Or check if any included input matches the dynamic import path
                        return chunk.includedInputs.some((input) =>
                          input.includes(dynamicImportPath.replace("./", ""))
                        );
                      });

                      return (
                        <div className="text-xs text-purple-600 mt-0.5">
                          ⚡ Creates lazy-loaded module
                          {createdChunk && (
                            <span className="ml-1">
                              ({createdChunk.outputFile} -{" "}
                              {formatBytes(createdChunk.bytes)})
                            </span>
                          )}
                        </div>
                      );
                    })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
