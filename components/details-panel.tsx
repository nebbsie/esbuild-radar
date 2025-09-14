"use client";

import { ImportedBySection } from "@/components/imported-by-section";
import { InclusionPathSection } from "@/components/inclusion-path-section";
import { ModulesCreatedSection } from "@/components/modules-created-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModuleNavigationHistory } from "@/lib/navigation-utils";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

interface DetailsPanelProps {
  metafile: Metafile;
  selectedModule: string | null;
  selectedChunk: InitialChunkSummary | null;
  initialChunk: InitialChunkSummary | null;
  chunks: InitialChunkSummary[];
  initialSummary: {
    initial: { outputs: string[]; totalBytes: number };
    lazy: { outputs: string[]; totalBytes: number };
  } | null;
  moduleHistory: ModuleNavigationHistory;
  goBackToPreviousModule: () => void;
  navigateToModule: (
    modulePath: string,
    chunk?: InitialChunkSummary,
    historyMode?: "push" | "reset" | "none"
  ) => void;
}

export function DetailsPanel({
  metafile,
  selectedModule,
  selectedChunk,
  initialChunk,
  chunks,
  initialSummary,
  moduleHistory,
  goBackToPreviousModule,
  navigateToModule,
}: DetailsPanelProps) {
  return (
    <Card className="h-full">
      {selectedModule && (
        <CardHeader className="px-3 py-3 pb-2">
          <div className="flex items-center gap-3">
            {moduleHistory.hasPrevious() && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goBackToPreviousModule}
                      className="h-7 w-7 p-0 hover:bg-accent flex-shrink-0"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Go back to previous file</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle
                className="text-sm font-medium text-foreground truncate"
                title={selectedModule}
              >
                {selectedModule}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="flex flex-col h-full gap-6 overflow-y-auto px-3 py-2">
        {!selectedModule && (
          <p className="text-sm text-muted-foreground">
            Click on a file in the middle panel to see how it&apos;s included in
            your app.
          </p>
        )}

        <InclusionPathSection
          metafile={metafile}
          selectedModule={selectedModule}
          chunks={chunks}
          initialChunk={initialChunk}
          selectedChunk={selectedChunk}
          initialSummary={initialSummary}
        />

        <ImportedBySection
          metafile={metafile}
          selectedModule={selectedModule}
          chunks={chunks}
          initialOutputs={initialSummary?.initial.outputs || []}
          initialChunk={initialChunk}
          navigateToModule={navigateToModule}
        />

        <ModulesCreatedSection
          metafile={metafile}
          selectedModule={selectedModule}
          chunks={chunks}
        />
      </CardContent>
    </Card>
  );
}
