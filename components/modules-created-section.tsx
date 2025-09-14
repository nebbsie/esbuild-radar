"use client";

import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getChunksCreatedByFile } from "@/lib/analyser";
import { formatBytes } from "@/lib/format";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { HelpCircle } from "lucide-react";

interface ModulesCreatedSectionProps {
  metafile: Metafile;
  selectedModule: string | null;
  chunks: InitialChunkSummary[];
}

export function ModulesCreatedSection({
  metafile,
  selectedModule,
  chunks,
}: ModulesCreatedSectionProps) {
  const createdChunks = selectedModule
    ? getChunksCreatedByFile(metafile, selectedModule, chunks)
    : [];

  if (createdChunks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
        <span>Modules Created ({createdChunks.length})</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={12}
                className="text-muted-foreground hover:text-foreground cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Lazy-loaded chunks created by dynamic imports in this file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h4>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {createdChunks.map((created, idx) => {
          return (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                <ChunkTypeIcon type="lazy" size={10} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-medium truncate"
                    title={created.chunk.outputFile}
                  >
                    {created.chunk.outputFile}
                  </span>
                  <span className="text-xs text-purple-600 font-medium">
                    lazy
                  </span>
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-muted-foreground">from</span>
                  <code
                    className="text-xs bg-muted px-1 py-0.5 rounded font-mono truncate flex-1"
                    title={created.dynamicImportPath}
                  >
                    {created.dynamicImportPath}
                  </code>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(created.chunk.bytes)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
