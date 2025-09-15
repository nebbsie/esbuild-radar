"use client";

import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getImportSources, getInclusionPath } from "@/lib/analyser";
import { getChunkLoadType } from "@/lib/chunk-utils";
import { formatBytes } from "@/lib/format";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { CornerDownRight, Flag, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";

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
  let inclusionPath = selectedModule
    ? getInclusionPath(metafile, selectedModule, chunks)
    : [];

  // Ensure the current file appears as the final step so users know where they are
  if (
    selectedModule &&
    (inclusionPath.length === 0 ||
      inclusionPath[inclusionPath.length - 1].file !== selectedModule)
  ) {
    const currentChunk = chunks.find((c) =>
      c.includedInputs.includes(selectedModule)
    );

    inclusionPath = [
      ...inclusionPath,
      {
        file: selectedModule,
        importStatement: "", // leaf node – no import statement
        importerChunkType: currentChunk
          ? getChunkLoadType(currentChunk, initialSummary)
          : "initial",
        isDynamicImport: false,
      },
    ];
  }

  // Get import sources to check if corresponding importers exist
  const importSources = selectedModule
    ? getImportSources(
        metafile,
        selectedModule,
        chunks,
        initialSummary?.initial.outputs || []
      )
    : [];

  // Create a set of importer paths for quick lookup
  const importerPaths = new Set(importSources.map((source) => source.importer));

  // Listen for hover coming from ImportedBySection to highlight matching row
  const [importedByHoverPath, setImportedByHoverPath] = useState<string | null>(
    null
  );
  const [inclusionHoverPath, setInclusionHoverPath] = useState<string | null>(
    null
  );

  useEffect(() => {
    const importedByHandler = (e: Event) => {
      const ce = e as CustomEvent<{ path: string | null }>;
      setImportedByHoverPath(ce.detail?.path || null);
    };

    const inclusionHandler = (e: Event) => {
      const ce = e as CustomEvent<{ path: string | null }>;
      setInclusionHoverPath(ce.detail?.path || null);
    };

    window.addEventListener(
      "imported-by-hover",
      importedByHandler as EventListener
    );
    window.addEventListener(
      "inclusion-path-hover",
      inclusionHandler as EventListener
    );

    return () => {
      window.removeEventListener(
        "imported-by-hover",
        importedByHandler as EventListener
      );
      window.removeEventListener(
        "inclusion-path-hover",
        inclusionHandler as EventListener
      );
    };
  }, []);

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
          <TooltipProvider delayDuration={600}>
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
          <TooltipProvider delayDuration={600}>
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

  // Group consecutive steps by their chunk (outputFile)
  const groupedSteps = inclusionPath.reduce(
    (groups, step, idx) => {
      const normalize = (p: string) => p.replace(/^\.\/+/, "");
      const stepFile = step.file;
      const stepFileNorm = normalize(stepFile);

      // Try to find chunk via provided chunks list
      const chunkContainingFile =
        chunks.find((chunk) => chunk.includedInputs.includes(stepFile)) ||
        chunks.find((chunk) =>
          chunk.includedInputs.some(
            (input) =>
              input === stepFile || normalize(input).includes(stepFileNorm)
          )
        );

      // Fallback: scan metafile outputs when not found in chunks
      let fallbackOutput: string | null = null;
      if (!chunkContainingFile) {
        for (const [outFile, out] of Object.entries(metafile.outputs || {})) {
          const inputs = Object.keys(out.inputs || {});
          if (
            inputs.includes(stepFile) ||
            inputs.some((inp) => normalize(inp).includes(stepFileNorm))
          ) {
            fallbackOutput = outFile;
            break;
          }
        }
      }

      const lastGroup = groups[groups.length - 1];
      const chunkName =
        chunkContainingFile?.outputFile ||
        fallbackOutput ||
        lastGroup?.module ||
        "Unknown Chunk";

      if (lastGroup && lastGroup.module === chunkName) {
        lastGroup.steps.push({ step, originalIndex: idx });
      } else {
        groups.push({
          module: chunkName,
          steps: [{ step, originalIndex: idx }],
        });
      }

      return groups;
    },
    [] as Array<{
      module: string;
      steps: Array<{ step: (typeof inclusionPath)[0]; originalIndex: number }>;
    }>
  );

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-4">
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

      <ol className="space-y-3">
        {groupedSteps.map((group, groupIdx) => {
          const groupChunkForHeader = chunks.find(
            (c) => c.outputFile === group.module
          );
          const groupLoadType = groupChunkForHeader
            ? getChunkLoadType(groupChunkForHeader, initialSummary)
            : initialSummary?.initial.outputs.includes(group.module)
              ? "initial"
              : initialSummary?.lazy.outputs.includes(group.module)
                ? "lazy"
                : "initial";
          return (
            <li key={groupIdx} className="space-y-2">
              {/* Bordered section with title overlay */}
              <div className="relative">
                {/* Title positioned above/over the border */}
                <div className="absolute -top-3.5 left-2 z-10">
                  <div className="inline-flex items-center gap-2 px-1 py-1 rounded-md bg-background">
                    <ChunkTypeIcon
                      variant="swatch"
                      type={groupLoadType}
                      size={10}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {group.module}
                    </span>
                  </div>
                </div>

                {/* Bordered content area */}
                <div className="pt-4 pb-2 px-3 border rounded-md border-muted bg-muted/10">
                  {/* Steps in this chunk */}
                  <ol className="space-y-1">
                    {group.steps.map(({ step, originalIndex }, localIdx) => {
                      // No hidden steps; always render the full path

                      // We already found the chunk during grouping, but we need it again for the tooltip
                      const chunkContainingFile = chunks.find((chunk) =>
                        chunk.includedInputs.includes(step.file)
                      );
                      // Try to resolve the imported module path for this step (to compute size delta)
                      const importerInput = metafile.inputs[step.file];
                      const matchedEdge = importerInput?.imports?.find(
                        (imp) =>
                          (imp.original || imp.path) === step.importStatement
                      );
                      const importedInputPath = matchedEdge?.path;
                      const rawImportText = step.importStatement.replace(
                        /^(["'])|(["'])$/g,
                        ""
                      );
                      const lookupPath = importedInputPath || rawImportText;
                      const normalizedImported = lookupPath
                        ? lookupPath.replace(/^\.\/+/, "")
                        : undefined;
                      const chunkForImported = lookupPath
                        ? chunks.find((chunk) =>
                            chunk.includedInputs.some(
                              (p) =>
                                p === lookupPath ||
                                (normalizedImported
                                  ? p.includes(normalizedImported)
                                  : false)
                            )
                          )
                        : null;
                      // Reuse indicator removed per UX: we'll highlight in ImportedBySection on hover instead
                      const importedInputSize = (() => {
                        if (!lookupPath || !chunkForImported) return 0;
                        const out =
                          metafile.outputs[chunkForImported.outputFile];
                        const info =
                          out?.inputs?.[lookupPath] ||
                          (normalizedImported
                            ? Object.entries(out?.inputs || {}).find(
                                ([p]) =>
                                  p === lookupPath ||
                                  p.includes(normalizedImported)
                              )?.[1]
                            : undefined);
                        return (
                          (info?.bytesInOutput as number | undefined) ||
                          (info?.bytes as number | undefined) ||
                          0
                        );
                      })();

                      // Determine created chunk for dynamic imports to show inline icon + tooltip
                      const createdChunk = step.isDynamicImport
                        ? (() => {
                            const dynamicImportPath =
                              step.importStatement.replace(/^["']|["']$/g, "");
                            return (
                              chunks.find((chunk) =>
                                chunk.entryPoint.includes(
                                  dynamicImportPath.replace("./", "")
                                )
                              ) ||
                              chunks.find((chunk) =>
                                chunk.includedInputs.some((input) =>
                                  input.includes(
                                    dynamicImportPath.replace("./", "")
                                  )
                                )
                              ) ||
                              null
                            );
                          })()
                        : null;

                      const isHighlightedByImported =
                        importedByHoverPath === step.file &&
                        importerPaths.has(step.file);
                      const isHighlightedByInclusion =
                        inclusionHoverPath === step.file &&
                        importerPaths.has(step.file);
                      const isHighlighted =
                        isHighlightedByImported || isHighlightedByInclusion;
                      const isLastStep =
                        groupIdx === groupedSteps.length - 1 &&
                        localIdx === group.steps.length - 1;
                      return (
                        <li
                          key={originalIndex}
                          className={`py-1 px-2 rounded-md border cursor-pointer transition-colors ${
                            isHighlighted
                              ? "bg-yellow-50 border-yellow-300"
                              : "bg-muted/20 border-transparent hover:bg-muted/30"
                          }`}
                          onMouseEnter={() => {
                            const evt = new CustomEvent(
                              "inclusion-path-hover",
                              {
                                detail: { path: step.file },
                              }
                            );
                            window.dispatchEvent(evt);
                          }}
                          onMouseLeave={() => {
                            const evt = new CustomEvent(
                              "inclusion-path-hover",
                              {
                                detail: { path: null },
                              }
                            );
                            window.dispatchEvent(evt);
                          }}
                          onClick={() => {
                            const evt = new CustomEvent("navigate-to-module", {
                              detail: {
                                module: step.file,
                                chunk: chunkContainingFile,
                              },
                            });
                            window.dispatchEvent(evt);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="text-xs font-medium flex items-center gap-2 min-w-0">
                                  {!isLastStep && (
                                    <span className="text-muted-foreground shrink-0">
                                      {originalIndex + 1}.
                                    </span>
                                  )}
                                  <span className="truncate min-w-0 overflow-hidden">
                                    {step.file}
                                  </span>
                                  {isLastStep && (
                                    <TooltipProvider>
                                      <Tooltip delayDuration={600}>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center bg-green-600 text-white rounded-xs p-0.5 ml-1">
                                            <Flag size={10} />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs">
                                            You are here
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </div>
                              {!isLastStep && (
                                <div className="mt-1 flex items-center gap-1">
                                  {step.isDynamicImport ? (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap inline-flex items-center gap-1">
                                      <CornerDownRight size={12} /> imports
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap inline-flex items-center gap-1">
                                      <CornerDownRight size={12} /> imports
                                    </span>
                                  )}
                                  <TooltipProvider>
                                    <Tooltip delayDuration={600}>
                                      <TooltipTrigger asChild>
                                        <code
                                          className="text-xs bg-muted px-1 py-0.5 rounded font-mono truncate hover:bg-muted/80 imported-path-item"
                                          data-path={step.file}
                                          onMouseEnter={() => {
                                            const evt = new CustomEvent(
                                              "inclusion-path-hover",
                                              {
                                                detail: { path: step.file },
                                              }
                                            );
                                            window.dispatchEvent(evt);
                                          }}
                                          onMouseLeave={() => {
                                            const evt = new CustomEvent(
                                              "inclusion-path-hover",
                                              {
                                                detail: { path: null },
                                              }
                                            );
                                            window.dispatchEvent(evt);
                                          }}
                                        >
                                          {step.importStatement}
                                        </code>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs"
                                      >
                                        <div className="text-xs">
                                          <div className="font-medium">
                                            {step.importStatement}
                                          </div>
                                          {chunkContainingFile ? (
                                            <div className="text-muted-foreground mt-1">
                                              {chunkContainingFile.outputFile} (
                                              {formatBytes(
                                                chunkContainingFile.bytes
                                              )}
                                              )
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
                                  {createdChunk && (
                                    <>
                                      <TooltipProvider>
                                        <Tooltip delayDuration={600}>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center text-blue-600 ml-1">
                                              <ChunkTypeIcon
                                                type="created"
                                                compact
                                                variant="icon"
                                                size={10}
                                                className="rounded-xs"
                                              />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="text-xs">
                                              Created lazy chunk:{" "}
                                              {createdChunk.outputFile}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </>
                                  )}
                                </div>
                              )}
                              {/* End conditional import info */}
                            </div>

                            {importedInputPath && (
                              <TooltipProvider>
                                <Tooltip delayDuration={600}>
                                  <TooltipTrigger asChild>
                                    <span className="ml-1 text-[10px] text-muted-foreground whitespace-nowrap cursor-help">
                                      +{formatBytes(importedInputSize)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs">
                                      {step.importerChunkType === "initial"
                                        ? `adds ~${formatBytes(importedInputSize)} to initial`
                                        : `defers ~${formatBytes(importedInputSize)} to lazy`}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {/* Reuse badge removed; hover will cross-highlight in ImportedBySection */}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
