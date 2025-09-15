"use client";

import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getImportSources, getInclusionPath } from "@/lib/analyser";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { CornerDownRight, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface ImportedBySectionProps {
  metafile: Metafile;
  selectedModule: string | null;
  chunks: InitialChunkSummary[];
  initialOutputs: string[];
}

export function ImportedBySection({
  metafile,
  selectedModule,
  chunks,
  initialOutputs,
}: ImportedBySectionProps) {
  // Cross-highlight state driven by both sections' hover events
  const [inclusionHoverPath, setInclusionHoverPath] = useState<string | null>(
    null,
  );
  const [importedByHoverPath, setImportedByHoverPath] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const inclusionHandler = (e: Event) => {
      const ce = e as CustomEvent<{ path: string | null }>;
      setInclusionHoverPath(ce.detail?.path || null);
    };

    const importedByHandler = (e: Event) => {
      const ce = e as CustomEvent<{ path: string | null }>;
      setImportedByHoverPath(ce.detail?.path || null);
    };

    window.addEventListener(
      "inclusion-path-hover",
      inclusionHandler as EventListener,
    );
    window.addEventListener(
      "imported-by-hover",
      importedByHandler as EventListener,
    );

    return () => {
      window.removeEventListener(
        "inclusion-path-hover",
        inclusionHandler as EventListener,
      );
      window.removeEventListener(
        "imported-by-hover",
        importedByHandler as EventListener,
      );
    };
  }, []);
  const importSources = selectedModule
    ? getImportSources(metafile, selectedModule, chunks, initialOutputs)
    : [];

  // Get inclusion path to check if corresponding steps exist
  const inclusionPath = selectedModule
    ? getInclusionPath(metafile, selectedModule, chunks)
    : [];

  // Create a set of inclusion path file paths for quick lookup
  const inclusionPaths = new Set(inclusionPath.map((step) => step.file));

  if (importSources.length === 0) {
    return null;
  }

  // Group importers by their containing chunk output file
  const groups = importSources.reduce(
    (
      acc,
      source: {
        importer: string;
        importStatement: string;
        chunkType: "initial" | "lazy";
        chunkOutputFile?: string;
        chunkSize?: number;
        isDynamicImport: boolean;
      },
    ) => {
      const moduleNorm = source.importer.replace(/^\.\/+/, "");
      const chunkContainingFile = chunks.find((chunk) =>
        chunk.includedInputs.some(
          (p) => p === source.importer || p.includes(moduleNorm),
        ),
      );
      const chunkOutputFile =
        chunkContainingFile?.outputFile ||
        source.chunkOutputFile ||
        "Unknown output";
      const existing = acc.find((g) => g.module === chunkOutputFile);
      const item = { source, chunkContainingFile } as const;
      if (existing) existing.items.push(item);
      else acc.push({ module: chunkOutputFile, items: [item] });
      return acc;
    },
    [] as Array<{
      module: string;
      items: Array<{
        source: (typeof importSources)[number];
        chunkContainingFile?: InitialChunkSummary;
      }>;
    }>,
  );

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-4">
        <span>Imported by ({importSources.length})</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={12}
                className="text-muted-foreground hover:text-foreground cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Files that directly import this file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h4>

      <ol className="space-y-3 max-h-64 pr-1">
        {groups.map((group, gi) => {
          const loadType = initialOutputs.includes(group.module)
            ? ("initial" as const)
            : ("lazy" as const);
          return (
            <li key={gi} className="space-y-2">
              <div className="relative">
                <div className="absolute -top-[12px] left-2 z-10">
                  <div className="inline-flex items-center gap-1 px-[4px] border-muted rounded-md border bg-background">
                    {group.module !== "Unknown output" && (
                      <ChunkTypeIcon
                        variant="swatch"
                        type={loadType}
                        size={10}
                      />
                    )}
                    {group.module === "Unknown output" ? (
                      <TooltipProvider>
                        <Tooltip delayDuration={600}>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] font-medium text-muted-foreground underline decoration-dotted cursor-help">
                              {group.module}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs">
                              <div className="font-medium mb-1">
                                Why no output?
                              </div>
                              <ul className="list-disc pl-4 space-y-1">
                                <li>
                                  Barrel/re-export indirection (e.g. index.ts)
                                </li>
                                <li>Type-only import (erased by TypeScript)</li>
                                <li>Tree-shaken or inlined by bundler</li>
                                <li>Non-browser/server-only output ignored</li>
                                <li>
                                  Path normalization mismatch (./ vs absolute)
                                </li>
                              </ul>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {group.module}
                      </span>
                    )}
                  </div>
                </div>
                <div className="pt-4 pb-2 px-3 border rounded-md border-muted bg-muted/10 overflow-visible">
                  <div className="space-y-2">
                    {group.items.map(({ source, chunkContainingFile }, idx) => {
                      const fileExistsInMetafile = Boolean(
                        metafile?.inputs[source.importer],
                      );
                      const canOpen = fileExistsInMetafile;

                      const isHighlightedByInclusion =
                        inclusionHoverPath === source.importer &&
                        inclusionPaths.has(source.importer);
                      const isHighlightedByImported =
                        importedByHoverPath === source.importer &&
                        inclusionPaths.has(source.importer);
                      const isHighlighted =
                        isHighlightedByInclusion || isHighlightedByImported;

                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                            isHighlighted
                              ? "bg-yellow-50 border-yellow-300"
                              : "bg-muted/40 border-transparent hover:bg-accent/70"
                          }`}
                          onMouseEnter={() => {
                            const evt = new CustomEvent("imported-by-hover", {
                              detail: { path: source.importer },
                            });
                            window.dispatchEvent(evt);
                          }}
                          onMouseLeave={() => {
                            const evt = new CustomEvent("imported-by-hover", {
                              detail: { path: null },
                            });
                            window.dispatchEvent(evt);
                          }}
                          onClick={() => {
                            if (!canOpen) return;
                            const evt = new CustomEvent("navigate-to-module", {
                              detail: {
                                module: source.importer,
                                chunk: chunkContainingFile,
                              },
                            });
                            window.dispatchEvent(evt);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[11px] text-muted-foreground truncate mb-1"
                              title={source.importer}
                            >
                              {source.importer}
                            </div>
                            <div className="flex items-center gap-1">
                              <CornerDownRight size={12} />
                              {source.isDynamicImport ? (
                                <span className="text-xs mr-1 text-nowrap text-muted-foreground">
                                  lazily imports
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  imports
                                </span>
                              )}
                              <code
                                className="text-xs bg-muted px-1 py-0.5 rounded font-mono truncate"
                                title={source.importStatement}
                              >
                                {source.importStatement}
                              </code>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
