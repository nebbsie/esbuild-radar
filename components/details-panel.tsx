"use client";

import { ImportedBySection } from "@/components/imported-by-section";
import { InclusionPathSection } from "@/components/inclusion-path-section";
import { ModulesCreatedSection } from "@/components/modules-created-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Removed unused tooltip imports
import { ModuleNavigationHistory } from "@/lib/navigation-utils";
import type { InitialChunkSummary, Metafile } from "@/lib/types";
import { ArrowLeft, X } from "lucide-react";
import React from "react";
// Removed unused Separator import
// Removed unused formatBytes import

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
  onClose: () => void;
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
  onClose,
}: DetailsPanelProps) {
  // Handle navigation event from child sections (e.g., created chunks)
  React.useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        module: string;
        chunk?: InitialChunkSummary;
      }>;
      const nextModule = ce.detail?.module;
      const nextChunk = ce.detail?.chunk;
      if (nextModule) {
        // Add to history when navigating from any details sub-section
        navigateToModule(nextModule, nextChunk, "push");
      }
    };
    window.addEventListener("navigate-to-module", handler as EventListener);
    return () =>
      window.removeEventListener(
        "navigate-to-module",
        handler as EventListener
      );
  }, [navigateToModule]);
  return (
    <Card className="h-full gap-0">
      {selectedModule && (
        <CardHeader className="pb-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2 min-w-0">
                {moduleHistory.hasPrevious() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goBackToPreviousModule}
                    className="h-[28px] w-[28px] p-0 hover:bg-accent flex-shrink-0"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                )}

                <span
                  className="flex-1 min-w-0 text-xs text-muted-foreground border border-border bg-muted/50 rounded-md px-2 py-0.5 h-[28px] flex items-center"
                  title={selectedModule}
                >
                  <span className="truncate">{selectedModule}</span>
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-[28px] w-[28px] p-0 hover:bg-accent flex-shrink-0"
                  onClick={onClose}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
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
