"use client";

import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import { Badge } from "@/components/ui/badge";
import { BundleStatsSection } from "@/components/ui/bundle-stats-section";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/format";
import { determineModuleForChunkOpening } from "@/lib/navigation-utils";
import type {
  InclusionPathResult,
  InitialChunkSummary,
  Metafile,
} from "@/lib/types";
import { Clock, Filter, Search, Upload, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

interface ChunksPanelProps {
  metafile: Metafile;
  initialChunks: InitialChunkSummary[];
  lazyChunks: InitialChunkSummary[];
  chunkSearch: string;
  setChunkSearch: (value: string) => void;
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  chunkTypeFilters: { initial: boolean; lazy: boolean };
  setChunkTypeFilters: React.Dispatch<
    React.SetStateAction<{ initial: boolean; lazy: boolean }>
  >;
  showFilterMenu: boolean;
  setShowFilterMenu: (value: boolean) => void;
  filteredChunks: InitialChunkSummary[];
  chunks: InitialChunkSummary[];
  selectedChunk: InitialChunkSummary | null;
  navigateToModule: (
    modulePath: string,
    chunk?: InitialChunkSummary,
    historyMode?: "push" | "reset" | "none"
  ) => void;
  initialChunk: InitialChunkSummary | null;
  setSelectedModule: (module: string | null) => void;
  setSelectedChunk: (chunk: InitialChunkSummary | null) => void;
  setInclusion: (inclusion: InclusionPathResult | null) => void;
}

export function ChunksPanel({
  metafile,
  initialChunks,
  lazyChunks,
  chunkSearch,
  setChunkSearch,
  handleSearchKeyDown,
  chunkTypeFilters,
  setChunkTypeFilters,
  showFilterMenu,
  setShowFilterMenu,
  filteredChunks,
  chunks,
  selectedChunk,
  navigateToModule,
  initialChunk,
  setSelectedModule,
  setSelectedChunk,
  setInclusion,
}: ChunksPanelProps) {
  const router = useRouter();
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle>Chunks</CardTitle>
            <CardDescription>All chunks in your app.</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/upload")}
                  className="p-2 cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload new metafile</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col h-full px-3 py-2 overflow-hidden">
        {/* Initial Code Section */}
        <BundleStatsSection
          title="Initial"
          chunks={initialChunks}
          bgColor="bg-red-50"
          hoverColor=""
          borderColor="border-red-200"
          textColor="text-red-700"
          iconType="initial"
          description="Code loaded immediately on page load"
        />

        {/* Lazy Code Section */}
        <BundleStatsSection
          title="Lazy"
          chunks={lazyChunks}
          bgColor="bg-blue-50"
          hoverColor=""
          borderColor="border-blue-200"
          textColor="text-blue-700"
          iconType="lazy"
          description="Code loaded on-demand when needed"
        />

        {/* Search input with filter button */}
        <div className="flex-shrink-0 mb-3">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search files in chunks..."
                value={chunkSearch}
                onChange={(e) => setChunkSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-8 pr-8 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
              {chunkSearch && (
                <button
                  onClick={() => setChunkSearch("")}
                  className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Menu Button */}
            <div className="relative filter-menu-container">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilterMenu(!showFilterMenu)}
                      className="h-8 w-8 p-0 cursor-pointer"
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Filter chunks by type</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Filter Dropdown Menu */}
              {showFilterMenu && (
                <div className="absolute top-full mt-1 right-0 z-50 w-40 bg-background border border-border rounded-md shadow-lg py-1">
                  <div className="p-1 space-y-1">
                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={chunkTypeFilters.initial}
                        onChange={() =>
                          setChunkTypeFilters((prev) => ({
                            ...prev,
                            initial: !prev.initial,
                          }))
                        }
                        className="rounded border-border"
                      />
                      <Zap size={14} className="text-red-500" />
                      <span className="text-xs">Initial</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={chunkTypeFilters.lazy}
                        onChange={() =>
                          setChunkTypeFilters((prev) => ({
                            ...prev,
                            lazy: !prev.lazy,
                          }))
                        }
                        className="rounded border-border"
                      />
                      <Clock size={14} className="text-blue-500" />
                      <span className="text-xs">Lazy</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {chunkSearch && (
            <div className="text-xs text-muted-foreground mt-1">
              Showing {filteredChunks.length} of {chunks.length} chunks
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="space-y-2 px-1">
            {filteredChunks.length === 0 && chunks.length > 0 && (
              <p className="text-sm text-muted-foreground">
                No chunks match your search.
              </p>
            )}
            {filteredChunks.length === 0 && chunks.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            {filteredChunks.map((c) => {
              const loadType = initialChunks.some(
                (chunk) => chunk.outputFile === c.outputFile
              )
                ? "initial"
                : "lazy";
              // Check if this chunk is the main entry chunk
              const isMainEntryChunk =
                initialChunk?.outputFile === c.outputFile;
              const iconType = isMainEntryChunk ? "main-entry" : loadType;

              return (
                <button
                  key={c.outputFile}
                  onClick={() => {
                    // Use the extracted function to determine what module to select
                    const { selectedModule, inclusionPath } =
                      determineModuleForChunkOpening(c, metafile, initialChunk);

                    if (selectedModule) {
                      navigateToModule(selectedModule, c, "reset");
                    } else {
                      // Still select the chunk even if no module is found
                      setSelectedModule(null);
                      setSelectedChunk(c);
                      setInclusion(inclusionPath);
                    }
                  }}
                  className={`w-full text-left rounded-md border p-1.5 transition-colors hover:bg-accent ${
                    selectedChunk?.outputFile === c.outputFile
                      ? "bg-accent border-primary ring-1 ring-primary/20 shadow-sm"
                      : "bg-background border-border hover:border-accent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ChunkTypeIcon
                      type={iconType}
                      size={10}
                      className="flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-sm ${
                          selectedChunk?.outputFile === c.outputFile
                            ? "text-primary"
                            : ""
                        }`}
                        title={c.outputFile}
                      >
                        {c.outputFile}
                      </div>
                    </div>
                    <Badge
                      variant={
                        selectedChunk?.outputFile === c.outputFile
                          ? "default"
                          : "secondary"
                      }
                      className="flex-shrink-0 text-xs"
                    >
                      {formatBytes(c.bytes)}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
