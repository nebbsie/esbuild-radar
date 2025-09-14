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
import { CornerDownRight, HelpCircle } from "lucide-react";
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
  const inclusionPath = selectedModule
    ? getInclusionPath(metafile, selectedModule, chunks)
    : [];

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

      <ol className="space-y-2">
        {inclusionPath.map((step, idx) => {
          // No hidden steps; always render the full path

          const chunkContainingFile = chunks.find((chunk) =>
            chunk.includedInputs.includes(step.file)
          );
          // Try to resolve the imported module path for this step (to compute size delta)
          const importerInput = metafile.inputs[step.file];
          const matchedEdge = importerInput?.imports?.find(
            (imp) => (imp.original || imp.path) === step.importStatement
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
            const out = metafile.outputs[chunkForImported.outputFile];
            const info =
              out?.inputs?.[lookupPath] ||
              (normalizedImported
                ? Object.entries(out?.inputs || {}).find(
                    ([p]) => p === lookupPath || p.includes(normalizedImported)
                  )?.[1]
                : undefined);
            return (
              (info?.bytesInOutput as number | undefined) ||
              (info?.bytes as number | undefined) ||
              0
            );
          })();
          const firstLazyIndex = inclusionPath.findIndex(
            (s) => s.importerChunkType === "lazy"
          );
          const isFirstLazyBoundary =
            idx === firstLazyIndex && firstLazyIndex !== -1;

          // Determine created chunk for dynamic imports to show inline icon + tooltip
          const createdChunk = step.isDynamicImport
            ? (() => {
                const dynamicImportPath = step.importStatement.replace(
                  /^["']|["']$/g,
                  ""
                );
                return (
                  chunks.find((chunk) =>
                    chunk.entryPoint.includes(
                      dynamicImportPath.replace("./", "")
                    )
                  ) ||
                  chunks.find((chunk) =>
                    chunk.includedInputs.some((input) =>
                      input.includes(dynamicImportPath.replace("./", ""))
                    )
                  ) ||
                  null
                );
              })()
            : null;

          const isHighlightedByImported =
            importedByHoverPath === step.file && importerPaths.has(step.file);
          const isHighlightedByInclusion =
            inclusionHoverPath === step.file && importerPaths.has(step.file);
          const isHighlighted =
            isHighlightedByImported || isHighlightedByInclusion;
          return (
            <li
              key={idx}
              className={`py-1 px-2 rounded-md border cursor-pointer transition-colors ${
                isHighlighted
                  ? "bg-yellow-50 border-yellow-300"
                  : "bg-muted/20 border-transparent hover:bg-muted/30"
              }`}
              onMouseEnter={() => {
                const evt = new CustomEvent("inclusion-path-hover", {
                  detail: { path: step.file },
                });
                window.dispatchEvent(evt);
              }}
              onMouseLeave={() => {
                const evt = new CustomEvent("inclusion-path-hover", {
                  detail: { path: null },
                });
                window.dispatchEvent(evt);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-xs font-medium flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="shrink-0">
                        <ChunkTypeIcon
                          type={
                            step.importerChunkType === "lazy"
                              ? "lazy"
                              : "initial"
                          }
                          variant="swatch"
                        />
                      </div>
                      <span className="truncate min-w-0 overflow-hidden">
                        {step.file}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {step.isDynamicImport ? (
                      <span className="text-xs text-muted-foreground whitespace-nowrap inline-flex items-center gap-1">
                        <CornerDownRight size={12} />
                        imports
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

                    {createdChunk && (
                      <TooltipProvider>
                        <Tooltip delayDuration={600}>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center">
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
                            <p className="text-xs">
                              This dynamic import created a lazy-loaded chunk
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {" "}
                              {createdChunk && (
                                <span>
                                  {` (${createdChunk.outputFile} - ${formatBytes(createdChunk.bytes)})`}
                                </span>
                              )}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {importedInputPath && (
                      <TooltipProvider>
                        <Tooltip delayDuration={600}>
                          <TooltipTrigger asChild>
                            <span className="ml-1 text-[10px] text-muted-foreground whitespace-nowrap cursor-help">
                              +{formatBytes(importedInputSize)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs text-muted-foreground">
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

                  {/* Inline created module icon is rendered next to the label above */}
                </div>
                {isFirstLazyBoundary && (
                  <TooltipProvider>
                    <Tooltip delayDuration={600}>
                      <TooltipTrigger asChild>
                        <span className="ml-2 shrink-0 text-[10px] leading-none px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                          First lazy boundary
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="text-xs">
                          <p className="mb-1">
                            This step is inside a lazy-loaded chunk.
                          </p>
                          <p className="text-muted-foreground mb-1">
                            A file may appear in an initial chunk elsewhere, yet
                            this branch loads only when its dynamic path runs.
                          </p>
                          <div className="text-muted-foreground">
                            <div className="font-medium text-foreground mb-1">
                              Examples
                            </div>
                            <ul className="list-disc pl-4 space-y-1">
                              <li>
                                Route-level split: page code loads on
                                navigation.
                              </li>
                              <li>
                                Modal/editor opens and loads its code on demand.
                              </li>
                              <li>Feature flag: module loads when enabled.</li>
                              <li>
                                Vendor tool used only on a specific screen.
                              </li>
                              <li>
                                Shared file: eager in one path, lazy here via
                                import().
                              </li>
                            </ul>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
