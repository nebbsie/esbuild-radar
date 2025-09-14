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
import { CornerDownRight, HelpCircle } from "lucide-react";

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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ChunkTypeIcon variant="swatch" type="lazy" size={10} />
                  <span
                    className="text-xs font-medium truncate"
                    title={created.chunk.outputFile}
                  >
                    {created.chunk.outputFile}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatBytes(created.chunk.bytes)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CornerDownRight size={12} className="shrink-0" />

                  <p className="text-xs text-muted-foreground gap-x-1">by</p>

                  <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono flex min-w-0">
                    <span className="whitespace-nowrap">import(&#34;</span>
                    <span
                      className="truncate min-w-0"
                      title={created.importStatement}
                    >
                      {created.importStatement}
                    </span>
                    <span className="whitespace-nowrap">&#34;);</span>
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
