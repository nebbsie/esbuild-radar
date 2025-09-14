"use client";

import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getImportSources } from "@/lib/analyser";
import { isMainEntryPoint } from "@/lib/chunk-utils";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { HelpCircle } from "lucide-react";

interface ImportedBySectionProps {
  metafile: Metafile;
  selectedModule: string | null;
  chunks: InitialChunkSummary[];
  initialOutputs: string[];
  initialChunk: InitialChunkSummary | null;
  navigateToModule: (
    modulePath: string,
    chunk?: InitialChunkSummary,
    historyMode?: "push" | "reset" | "none",
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
  const importSources = selectedModule
    ? getImportSources(metafile, selectedModule, chunks, initialOutputs)
    : [];

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
              <p>
                Files that directly import this module and their loading type
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h4>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {importSources.map((source, idx) => {
          const chunkContainingFile = chunks.find((chunk) =>
            chunk.includedInputs.includes(source.importer),
          );
          const fileExistsInMetafile = Boolean(
            metafile?.inputs[source.importer],
          );
          // Allow navigation if file exists in metafile, even if not in a chunk (e.g., barrel files)
          const canOpen = Boolean(chunkContainingFile) || fileExistsInMetafile;

          // Determine the icon type: use "main-entry" only for the actual entry point of the initial chunk
          const iconType = isMainEntryPoint(source.importer, initialChunk)
            ? "main-entry"
            : source.chunkType;

          return (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={
                canOpen
                  ? () =>
                      navigateToModule(
                        source.importer,
                        chunkContainingFile || undefined,
                        "push",
                      )
                  : undefined
              }
            >
              <div className="flex-shrink-0 mt-0.5">
                <ChunkTypeIcon type={iconType} size={10} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-medium truncate"
                    title={source.importer}
                  >
                    {source.importer}
                  </span>
                  {source.chunkType === "lazy" && (
                    <span className="text-xs text-purple-600 font-medium">
                      lazy
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mb-1">
                  {source.isDynamicImport ? (
                    <span className="text-xs text-purple-600 mr-1">
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
