"use client";

import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getImportSources, getInclusionPath } from "@/lib/analyser";
import { isMainEntryPoint } from "@/lib/chunk-utils";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { CornerDownRight, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface ImportedBySectionProps {
  metafile: Metafile;
  selectedModule: string | null;
  chunks: InitialChunkSummary[];
  initialOutputs: string[];
  initialChunk: InitialChunkSummary | null;
  navigateToModule: (
    modulePath: string,
    chunk?: InitialChunkSummary,
    historyMode?: "push" | "reset" | "none"
  ) => void;
}

export function ImportedBySection({
  metafile,
  selectedModule,
  chunks,
  initialOutputs,
  initialChunk,
  navigateToModule,
}: ImportedBySectionProps) {
  // Cross-highlight state driven by both sections' hover events
  const [inclusionHoverPath, setInclusionHoverPath] = useState<string | null>(
    null
  );
  const [importedByHoverPath, setImportedByHoverPath] = useState<string | null>(
    null
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
      inclusionHandler as EventListener
    );
    window.addEventListener(
      "imported-by-hover",
      importedByHandler as EventListener
    );

    return () => {
      window.removeEventListener(
        "inclusion-path-hover",
        inclusionHandler as EventListener
      );
      window.removeEventListener(
        "imported-by-hover",
        importedByHandler as EventListener
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

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
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
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {importSources.map((source, idx) => {
          const moduleNorm = source.importer.replace(/^\.\/+/, "");
          const chunkContainingFile = chunks.find((chunk) =>
            chunk.includedInputs.some(
              (p) => p === source.importer || p.includes(moduleNorm)
            )
          );
          const fileExistsInMetafile = Boolean(
            metafile?.inputs[source.importer]
          );
          // Always allow navigation if file exists in metafile, regardless of chunk visibility
          const canOpen = fileExistsInMetafile;

          // Determine the icon type: use "main-entry" only for the actual entry point of the initial chunk
          const iconType = isMainEntryPoint(source.importer, initialChunk)
            ? "main-entry"
            : source.chunkType;

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
                  : "bg-card border-transparent hover:bg-accent/50"
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
              onClick={
                canOpen
                  ? () =>
                      navigateToModule(
                        source.importer,
                        chunkContainingFile || undefined,
                        "push"
                      )
                  : undefined
              }
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ChunkTypeIcon variant="swatch" type={iconType} size={10} />
                  <span
                    className="text-xs font-medium truncate"
                    title={source.importer}
                  >
                    {source.importer}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CornerDownRight size={12} />

                  {source.isDynamicImport ? (
                    <span className="text-xs mr-1 text-muted-foreground">
                      lazily imports
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      imports
                    </span>
                  )}
                  <code
                    className="text-xs bg-muted px-1 py-0.5 rounded font-mono truncate flex-1"
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
  );
}
