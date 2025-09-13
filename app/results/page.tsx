"use client";

import { FileTree } from "@/components/file-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getChunksCreatedByFile,
  getImportSources,
  getInclusionPath,
  inferEntryForOutput,
  pickInitialOutput,
} from "@/lib/analyser";
import { formatBytes } from "@/lib/format";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { summarizeInitial } from "@/lib/initial-summary";
import type {
  InclusionPathResult,
  InclusionPathStep,
  InitialChunkSummary,
  Metafile,
} from "@/lib/metafile";
import { findInclusionPath, parseMetafile } from "@/lib/metafile";
import { buildPathTree } from "@/lib/path-tree";
import { metafileStorage } from "@/lib/storage";
import {
  ArrowLeft,
  Clock,
  Eye,
  EyeOff,
  File,
  FileText,
  Filter,
  HelpCircle,
  Minimize2,
  Search,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

// LocalStorage keys
const STORAGE_KEYS = {
  NODE_MODULES: "esbuild-analyser-show-node-modules",
  FULL_PATHS: "esbuild-analyser-show-full-paths",
  ALL_COLLAPSED: "esbuild-analyser-all-collapsed",
  CHUNK_FILTERS: "esbuild-analyser-chunk-filters",
} as const;

// Default values
const DEFAULT_FILTERS = {
  initial: true,
  lazy: false,
};

export default function ResultsPage() {
  const router = useRouter();
  const [metafile, setMetafile] = React.useState<Metafile | null>(null);
  const [chunks, setChunks] = React.useState<InitialChunkSummary[]>([]);
  const [initialSummary, setInitialSummary] = React.useState<{
    initial: { outputs: string[]; totalBytes: number };
    lazy: { outputs: string[]; totalBytes: number };
  } | null>(null);
  const [selectedChunk, setSelectedChunk] =
    React.useState<InitialChunkSummary | null>(null);
  const [selectedModule, setSelectedModule] = React.useState<string | null>(
    null
  );
  const [inclusion, setInclusion] = React.useState<InclusionPathResult | null>(
    null
  );
  const [metafileName, setMetafileName] = React.useState<string>("");

  // Update page title when metafile name changes
  React.useEffect(() => {
    const baseTitle = "Esbuild Radar";
    if (metafileName) {
      document.title = `${metafileName} • ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [metafileName]);

  // Load persisted settings
  const [showNodeModules, setShowNodeModules] = usePersistentState<boolean>(
    STORAGE_KEYS.NODE_MODULES,
    false
  );
  const [showFullPaths, setShowFullPaths] = usePersistentState<boolean>(
    STORAGE_KEYS.FULL_PATHS,
    false
  );
  const [allCollapsed, setAllCollapsed] = usePersistentState<boolean>(
    STORAGE_KEYS.ALL_COLLAPSED,
    false
  );
  const [chunkTypeFilters, setChunkTypeFilters] = usePersistentState(
    STORAGE_KEYS.CHUNK_FILTERS,
    DEFAULT_FILTERS
  );

  const [chunkSearch, setChunkSearch] = React.useState("");
  const [searchResultIndex, setSearchResultIndex] = React.useState(-1);
  const [showFilterMenu, setShowFilterMenu] = React.useState(false);
  const [moduleHistory, setModuleHistory] = React.useState<string[]>([]);

  // no-op: using setChunkTypeFilters directly with functional updates below

  // Navigation history functions
  const findBestChunkForFile = React.useCallback(
    (filePath: string): InitialChunkSummary | undefined => {
      // First, try to find a chunk that directly contains this file
      const directChunk = chunks.find((chunk) =>
        chunk.includedInputs.includes(filePath)
      );
      if (directChunk) return directChunk;

      // If not found directly, try to find a chunk that contains files imported by this file
      // This helps with barrel files that might import many files
      if (metafile?.inputs[filePath]?.imports) {
        for (const imp of metafile.inputs[filePath].imports) {
          const chunkWithImportedFile = chunks.find((chunk) =>
            chunk.includedInputs.includes(imp.path)
          );
          if (chunkWithImportedFile) return chunkWithImportedFile;
        }
      }

      // As a last resort, return the currently selected chunk if it exists
      return selectedChunk || undefined;
    },
    [chunks, metafile, selectedChunk]
  );

  const navigateToModule = React.useCallback(
    (modulePath: string, chunk?: InitialChunkSummary, skipHistory = false) => {
      if (!skipHistory && selectedModule && selectedModule !== modulePath) {
        // Add current module to history before navigating (unless skipping)
        setModuleHistory((prev) => [...prev, selectedModule]);
      }

      setSelectedModule(modulePath);

      // If no chunk was provided, try to find the best chunk for this file
      const targetChunk = chunk || findBestChunkForFile(modulePath);

      if (targetChunk) {
        setSelectedChunk(targetChunk);
        if (metafile) {
          // Compute initial chunk entry point inline
          const currentInitialChunk =
            initialSummary && metafile
              ? (() => {
                  const firstInitialOutput = initialSummary.initial.outputs[0];
                  if (!firstInitialOutput) return null;
                  const out = metafile.outputs[firstInitialOutput];
                  return (
                    out?.entryPoint ||
                    inferEntryForOutput(metafile, firstInitialOutput) ||
                    ""
                  );
                })()
              : null;

          const rootEntry = currentInitialChunk || targetChunk.entryPoint;
          if (metafile && rootEntry) {
            const res = findInclusionPath(metafile, rootEntry, modulePath);
            setInclusion(res);
          } else {
            setInclusion(null);
          }
        }
      } else {
        // If we still don't have a chunk, clear the selected chunk
        // This will show all files from the metafile
        setSelectedChunk(null);
      }

      // Scroll to the module after DOM updates
      setTimeout(() => {
        const selectedElement = document.querySelector(
          '[data-selected-module="true"]'
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: "instant",
            block: "center",
          });
        }
      }, 100);
    },
    [selectedModule, metafile, findBestChunkForFile, initialSummary]
  );

  const goBackToPreviousModule = React.useCallback(() => {
    if (moduleHistory.length > 0) {
      const previousModule = moduleHistory[moduleHistory.length - 1];
      setModuleHistory((prev) => prev.slice(0, -1));

      // Find the chunk containing the previous module
      const chunkContainingFile = chunks.find((chunk) =>
        chunk.includedInputs.includes(previousModule)
      );

      if (chunkContainingFile) {
        // Navigate back without adding to history to prevent loops
        navigateToModule(previousModule, chunkContainingFile, true);
      } else {
        // Fallback: just set the module without chunk info
        setSelectedModule(previousModule);
        setSelectedChunk(null);
        setInclusion(null);
      }
    }
  }, [moduleHistory, chunks, navigateToModule]);

  // Close filter menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showFilterMenu &&
        !(event.target as Element).closest(".filter-menu-container")
      ) {
        setShowFilterMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilterMenu]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Note: initial output is determined on load; no need to memoize separately
  const initialChunk = React.useMemo(() => {
    if (!initialSummary || !metafile) return null;
    const firstInitialOutput = initialSummary.initial.outputs[0];
    if (!firstInitialOutput) return null;
    const out = metafile.outputs[firstInitialOutput];
    if (!out) return null;
    return {
      outputFile: firstInitialOutput,
      bytes: out.bytes || 0,
      entryPoint:
        out.entryPoint ||
        inferEntryForOutput(metafile, firstInitialOutput) ||
        "",
      isEntry: Boolean(out.entryPoint),
      includedInputs: Object.keys(out.inputs || {}),
    };
  }, [initialSummary, metafile]);

  // Get only the chunks that are loaded initially
  const initialBundleChunks = React.useMemo(() => {
    if (!initialSummary || !metafile) return [];
    return initialSummary.initial.outputs
      .map((outputFile) => {
        const out = metafile.outputs[outputFile];
        if (!out) return null;
        return {
          outputFile,
          bytes: out.bytes || 0,
          entryPoint:
            out.entryPoint || inferEntryForOutput(metafile, outputFile) || "",
          isEntry: Boolean(out.entryPoint),
          includedInputs: Object.keys(out.inputs || {}),
        };
      })
      .filter((chunk): chunk is InitialChunkSummary => Boolean(chunk))
      .sort((a, b) => b.bytes - a.bytes); // Sort by size (largest first)
  }, [initialSummary, metafile]);

  // Separate initial and lazy chunks for the new UI sections
  const initialChunks = React.useMemo(() => {
    if (!initialSummary || !metafile) return [];
    return initialSummary.initial.outputs
      .map((outputFile) => {
        const out = metafile.outputs[outputFile];
        if (!out) return null;
        return {
          outputFile,
          bytes: out.bytes || 0,
          entryPoint:
            out.entryPoint || inferEntryForOutput(metafile, outputFile) || "",
          isEntry: Boolean(out.entryPoint),
          includedInputs: Object.keys(out.inputs || {}),
        };
      })
      .filter((chunk): chunk is InitialChunkSummary => Boolean(chunk))
      .sort((a, b) => b.bytes - a.bytes); // Sort by size (largest first)
  }, [initialSummary, metafile]);

  const lazyChunks = React.useMemo(() => {
    if (!initialSummary || !metafile) return [];
    return initialSummary.lazy.outputs
      .map((outputFile) => {
        const out = metafile.outputs[outputFile];
        if (!out) return null;
        return {
          outputFile,
          bytes: out.bytes || 0,
          entryPoint:
            out.entryPoint || inferEntryForOutput(metafile, outputFile) || "",
          isEntry: Boolean(out.entryPoint),
          includedInputs: Object.keys(out.inputs || {}),
        };
      })
      .filter((chunk): chunk is InitialChunkSummary => Boolean(chunk))
      .sort((a, b) => b.bytes - a.bytes); // Sort by size (largest first)
  }, [initialSummary, metafile]);

  React.useEffect(() => {
    metafileStorage.loadMetafile().then((storedData) => {
      if (storedData) {
        try {
          const json = JSON.parse(storedData.data);
          setMetafileName(storedData.name || "");
          const mf = parseMetafile(json);

          // Pick the initial chunk
          const pickedInitial = pickInitialOutput(mf);
          if (!pickedInitial) {
            console.warn("No initial chunk found");
            return;
          }

          // Get initial/lazy summary using the tested logic
          const summary = summarizeInitial(mf, pickedInitial);
          setInitialSummary(summary);

          // Convert output filenames to InitialChunkSummary objects
          const allChunks: InitialChunkSummary[] = [
            ...summary.initial.outputs,
            ...summary.lazy.outputs,
          ]
            .map((outputFile) => {
              const out = mf.outputs[outputFile];
              if (!out) return null;
              return {
                outputFile,
                bytes: out.bytes || 0,
                entryPoint:
                  out.entryPoint || inferEntryForOutput(mf, outputFile) || "",
                isEntry: Boolean(out.entryPoint),
                includedInputs: Object.keys(out.inputs || {}),
              };
            })
            .filter((chunk): chunk is InitialChunkSummary => Boolean(chunk))
            .sort((a, b) => b.bytes - a.bytes); // Sort by size (largest first)

          // Select the first chunk from the classified list, or the initial chunk if empty
          let initialSelected = allChunks[0] || null;
          if (!initialSelected && pickedInitial) {
            const out = mf.outputs[pickedInitial];
            initialSelected = {
              outputFile: pickedInitial,
              bytes: out.bytes || 0,
              entryPoint:
                out.entryPoint || inferEntryForOutput(mf, pickedInitial) || "",
              isEntry: Boolean(out.entryPoint),
              includedInputs: Object.keys(out.inputs || {}),
            };
          }

          setMetafile(mf);
          setChunks(allChunks);
          setSelectedChunk(initialSelected);

          // Only select the entry point if it's actually included in this chunk
          const entryPointInChunk =
            initialSelected?.entryPoint &&
            initialSelected.includedInputs.includes(initialSelected.entryPoint);
          setSelectedModule(
            entryPointInChunk ? initialSelected.entryPoint : null
          );
          setInclusion(null);

          // Scroll the entry point file into view if it was selected
          if (entryPointInChunk) {
            setTimeout(() => {
              const selectedElement = document.querySelector(
                '[data-selected-module="true"]'
              );
              if (selectedElement) {
                selectedElement.scrollIntoView({
                  behavior: "instant",
                  block: "center",
                });
              }
            }, 100);
          }
        } catch (err) {
          console.error("Failed to parse metafile:", err);
          // Clear invalid data
          clearData();
          alert(
            "Invalid esbuild metafile JSON: " +
              (err instanceof Error ? err.message : "Unknown error")
          );
        }
      } else {
        // No stored metafile found, redirect to upload page
        router.push("/upload");
      }
    });
  }, [router]);

  function onSelectModule(mod: string) {
    setSelectedModule(mod);

    // Find the chunk that contains this module and select it
    const chunkContainingModule = chunks.find((chunk) =>
      chunk.includedInputs.includes(mod)
    );

    const chunkChanged =
      chunkContainingModule && chunkContainingModule !== selectedChunk;

    if (chunkChanged) {
      setSelectedChunk(chunkContainingModule);
    }

    // Always calculate inclusion path when a module is selected
    const rootEntry =
      initialChunk?.entryPoint ||
      (chunkContainingModule || selectedChunk)?.entryPoint;
    if (metafile && rootEntry) {
      const res = findInclusionPath(metafile, rootEntry, mod);
      setInclusion(res);
    } else {
      setInclusion(null);
    }

    // Scroll to the selected module after DOM updates
    setTimeout(
      () => {
        const selectedElement = document.querySelector(
          '[data-selected-module="true"]'
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: "instant",
            block: "center",
          });
        }
      },
      chunkChanged ? 100 : 50
    ); // Longer delay if chunk changed
  }

  // Helper to determine chunk load type
  const getChunkLoadType = React.useCallback(
    (chunk: InitialChunkSummary): "initial" | "lazy" => {
      if (!initialSummary) return "initial";
      return initialSummary.initial.outputs.includes(chunk.outputFile)
        ? "initial"
        : "lazy";
    },
    [initialSummary]
  );

  // Filter chunks based on search term and chunk type
  const filteredChunks = React.useMemo(
    () =>
      chunks.filter((chunk) => {
        // Check search term
        const matchesSearch =
          chunkSearch === "" ||
          chunk.includedInputs.some((input) =>
            input.toLowerCase().includes(chunkSearch.toLowerCase())
          );

        // Check chunk type filter
        const chunkType = getChunkLoadType(chunk);
        const matchesType = chunkTypeFilters[chunkType];

        return matchesSearch && matchesType;
      }),
    [chunks, chunkSearch, chunkTypeFilters, getChunkLoadType]
  );

  // Helper to get icon and tooltip for chunk type
  const getChunkTypeIcon = React.useCallback((loadType: "initial" | "lazy") => {
    switch (loadType) {
      case "initial":
        return {
          icon: Zap,
          color: "bg-red-500",
        };
      case "lazy":
        return {
          icon: Clock,
          color: "bg-purple-500",
        };
    }
  }, []);

  // Components for better organization and performance
  const ChunkItem = React.memo<{
    chunk: InitialChunkSummary;
    loadType: "initial" | "lazy";
    getChunkTypeIcon: (loadType: "initial" | "lazy") => {
      icon: React.ComponentType<{ size?: number }>;
      color: string;
    };
    onClick: () => void;
    isSelected: boolean;
  }>(({ chunk, loadType, getChunkTypeIcon, onClick, isSelected }) => {
    const { icon: IconComponent, color } = getChunkTypeIcon(loadType);

    return (
      <button
        onClick={onClick}
        className={`w-full text-left rounded-md border p-1.5 transition-colors hover:bg-accent ${
          isSelected
            ? "bg-accent border-primary ring-1 ring-primary/20 shadow-sm"
            : "bg-background border-border hover:border-accent"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${color} flex-shrink-0`}>
            <div className="w-2.5 h-2.5 text-white flex items-center justify-center">
              <IconComponent size={10} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={`truncate text-sm ${isSelected ? "text-primary" : ""}`}
              title={chunk.outputFile}
            >
              {chunk.outputFile}
            </div>
          </div>
          <Badge
            variant={isSelected ? "default" : "secondary"}
            className="flex-shrink-0 text-xs"
          >
            {formatBytes(chunk.bytes)}
          </Badge>
        </div>
      </button>
    );
  });
  ChunkItem.displayName = "ChunkItem";

  const InclusionPathItem = React.memo<{
    step: InclusionPathStep;
  }>(({ step }) => {
    return (
      <li className="break-all">
        <div className="flex items-center gap-2">
          <span>↳ {step.to}</span>
          <span className="text-xs text-muted-foreground capitalize">
            ({step.kind.replace("-", " ")})
          </span>
        </div>
      </li>
    );
  });
  InclusionPathItem.displayName = "InclusionPathItem";

  // Component for bundle stats (used for both initial and lazy sections)
  const BundleStatsSection = React.memo<{
    title: string;
    chunks: InitialChunkSummary[];
    onClick?: () => void;
    bgColor: string;
    hoverColor: string;
    borderColor: string;
    textColor: string;
    iconBgColor: string;
    icon: React.ReactNode;
    description?: string;
  }>(
    ({
      title,
      chunks,
      onClick,
      bgColor,
      hoverColor,
      borderColor,
      textColor,
      iconBgColor,
      icon,
      description,
    }) => {
      const totalSize = chunks.reduce(
        (total, chunk) => total + (chunk?.bytes || 0),
        0
      );
      const largestChunk =
        chunks.length > 0 ? Math.max(...chunks.map((c) => c?.bytes || 0)) : 0;
      const totalModules = chunks.reduce(
        (total, chunk) => total + (chunk?.includedInputs?.length || 0),
        0
      );

      return (
        <div
          className={`w-full mb-3 p-3 ${bgColor} ${borderColor} rounded-md ${hoverColor} transition-colors ${
            onClick ? "cursor-pointer" : ""
          }`}
          onClick={onClick}
        >
          <TooltipProvider>
            <div className="flex items-center justify-between mb-3">
              <div className={`text-sm font-medium flex items-center gap-2`}>
                <div className={`p-1 rounded ${iconBgColor}`}>
                  <div className="w-3.5 h-3.5 text-white flex items-center justify-center">
                    {icon}
                  </div>
                </div>
                {title}
              </div>
              <div className={`text-base font-semibold ${textColor}`}>
                {formatBytes(totalSize)}
              </div>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mb-3 italic">
                {description}
              </p>
            )}
            <div className="text-xs text-muted-foreground space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span>Chunks:</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Number of {title.toLowerCase()} output files.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span>{chunks.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span>Largest chunk:</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The biggest {title.toLowerCase()} chunk that could
                        impact loading performance.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span>
                  {chunks.length > 0 ? formatBytes(largestChunk) : "0 B"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span>Total modules:</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Source files/modules bundled into {title.toLowerCase()}{" "}
                        chunks.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span>{totalModules}</span>
              </div>
            </div>
          </TooltipProvider>
        </div>
      );
    }
  );
  BundleStatsSection.displayName = "BundleStatsSection";

  // Find all highlighted elements in the chunk contents
  // removed unused findHighlightedElements helper

  // Navigate to next/previous search result across all chunks
  const navigateSearchResult = React.useCallback(
    (direction: "next" | "prev") => {
      if (!chunkSearch) return;

      // Get all chunks that contain the search term (from filteredChunks)
      const matchingChunks = filteredChunks.filter((chunk) =>
        chunk.includedInputs.some((input) =>
          input.toLowerCase().includes(chunkSearch.toLowerCase())
        )
      );

      if (matchingChunks.length === 0) return;

      // Find current chunk index
      const currentChunkIndex = matchingChunks.findIndex(
        (chunk) => chunk === selectedChunk
      );
      let targetChunkIndex = currentChunkIndex;

      // Get highlighted elements in current chunk
      const currentHighlightedElements = Array.from(
        document.querySelectorAll(".bg-yellow-200, .bg-yellow-800")
      ).filter((el) => {
        return el.closest("[data-chunk-contents]");
      });

      if (currentHighlightedElements.length === 0) return;

      let newResultIndex;
      if (direction === "next") {
        newResultIndex =
          (searchResultIndex + 1) % currentHighlightedElements.length;

        // If we've cycled through all results in current chunk, move to next chunk
        if (newResultIndex === 0 && currentHighlightedElements.length > 0) {
          targetChunkIndex = (currentChunkIndex + 1) % matchingChunks.length;
        }
      } else {
        newResultIndex = searchResultIndex - 1;
        if (newResultIndex < 0) {
          // Move to previous chunk
          targetChunkIndex = currentChunkIndex - 1;
          if (targetChunkIndex < 0)
            targetChunkIndex = matchingChunks.length - 1;

          // Set result index to last element in previous chunk
          const prevChunk = matchingChunks[targetChunkIndex];
          setSelectedChunk(prevChunk);

          // Only select the entry point if it's actually included in this chunk
          const entryPointInChunk =
            prevChunk.entryPoint &&
            prevChunk.includedInputs.includes(prevChunk.entryPoint);

          if (entryPointInChunk) {
            navigateToModule(prevChunk.entryPoint, prevChunk);
          } else {
            setSelectedModule(null);
            setInclusion(null);
          }

          // Wait for DOM update, then get highlighted elements in new chunk
          setTimeout(() => {
            const prevHighlightedElements = Array.from(
              document.querySelectorAll(".bg-yellow-200, .bg-yellow-800")
            ).filter((el) => el.closest("[data-chunk-contents]"));

            if (prevHighlightedElements.length > 0) {
              const lastIndex = prevHighlightedElements.length - 1;
              setSearchResultIndex(lastIndex);
              const element = prevHighlightedElements[lastIndex];
              const button = element.closest("button");
              if (button) {
                button.click();
                element.scrollIntoView({
                  behavior: "instant",
                  block: "center",
                });
              }
            }
          }, 50);
          return;
        }
      }

      // If we need to switch chunks (forward direction)
      if (targetChunkIndex !== currentChunkIndex) {
        const targetChunk = matchingChunks[targetChunkIndex];
        setSelectedChunk(targetChunk);

        // Only select the entry point if it's actually included in this chunk
        const entryPointInChunk =
          targetChunk.entryPoint &&
          targetChunk.includedInputs.includes(targetChunk.entryPoint);

        if (entryPointInChunk) {
          navigateToModule(targetChunk.entryPoint, targetChunk);
        } else {
          setSelectedModule(null);
          setInclusion(null);
        }

        // Wait for DOM update, then navigate to first result in new chunk
        setTimeout(() => {
          const newHighlightedElements = Array.from(
            document.querySelectorAll(".bg-yellow-200, .bg-yellow-800")
          ).filter((el) => el.closest("[data-chunk-contents]"));

          if (newHighlightedElements.length > 0) {
            setSearchResultIndex(0);
            const element = newHighlightedElements[0];
            const button = element.closest("button");
            if (button) {
              button.click();
              element.scrollIntoView({ behavior: "instant", block: "center" });
            }
          }
        }, 50);
      } else {
        // Stay in current chunk
        setSearchResultIndex(newResultIndex);
        const element = currentHighlightedElements[newResultIndex];
        if (element) {
          const button = element.closest("button");
          if (button) {
            button.click();
            element.scrollIntoView({ behavior: "instant", block: "center" });
          }
        }
      }
    },
    [
      chunkSearch,
      filteredChunks,
      selectedChunk,
      searchResultIndex,
      navigateToModule,
    ]
  );

  // Handle Enter key in search input
  const handleSearchKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (chunkSearch) {
          navigateSearchResult("next");
        }
      }
    },
    [chunkSearch, navigateSearchResult]
  );

  // Auto-select chunk if search results in single match
  React.useEffect(() => {
    if (filteredChunks.length === 1 && filteredChunks[0] !== selectedChunk) {
      setSelectedChunk(filteredChunks[0]);

      // Only select the entry point if it's actually included in this chunk
      const entryPointInChunk =
        filteredChunks[0].entryPoint &&
        filteredChunks[0].includedInputs.includes(filteredChunks[0].entryPoint);
      setSelectedModule(
        entryPointInChunk ? filteredChunks[0].entryPoint : null
      );
      setInclusion(null);

      // Scroll the entry point file into view if it was selected
      if (entryPointInChunk) {
        setTimeout(() => {
          const selectedElement = document.querySelector(
            '[data-selected-module="true"]'
          );
          if (selectedElement) {
            selectedElement.scrollIntoView({
              behavior: "instant",
              block: "center",
            });
          }
        }, 50);
      }
    }
  }, [filteredChunks, selectedChunk]);

  // Reset search result index when search changes
  React.useEffect(() => {
    setSearchResultIndex(-1);
  }, [chunkSearch]);

  if (!metafile) {
    return <div>Loading...</div>;
  }

  async function clearData() {
    await metafileStorage.clearMetafile();
    setMetafile(null);
    setChunks([]);
    setSelectedChunk(null);
    setSelectedModule(null);
    setInclusion(null);
    setMetafileName("");
  }

  function handleFileUpload() {
    fileInputRef.current?.click();
  }

  async function processUploadedFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Validate that it's a proper esbuild metafile
      const meta = parseMetafile(json);

      // Store the new metafile
      await metafileStorage.storeMetafile(JSON.stringify(json));

      // Pick the initial chunk
      const pickedInitial = pickInitialOutput(meta);
      if (!pickedInitial) {
        console.warn("No initial chunk found");
        return;
      }

      // Get initial/lazy summary using the tested logic
      const summary = summarizeInitial(meta, pickedInitial);
      setInitialSummary(summary);

      // Convert output filenames to InitialChunkSummary objects
      const allChunks: InitialChunkSummary[] = [
        ...summary.initial.outputs,
        ...summary.lazy.outputs,
      ]
        .map((outputFile) => {
          const out = meta.outputs[outputFile];
          if (!out) return null;
          return {
            outputFile,
            bytes: out.bytes || 0,
            entryPoint:
              out.entryPoint || inferEntryForOutput(meta, outputFile) || "",
            isEntry: Boolean(out.entryPoint),
            includedInputs: Object.keys(out.inputs || {}),
          };
        })
        .filter((chunk): chunk is InitialChunkSummary => Boolean(chunk))
        .sort((a, b) => b.bytes - a.bytes); // Sort by size (largest first)

      // Select the first chunk from the classified list, or the initial chunk if empty
      let initialSelected: InitialChunkSummary | null = null;
      if (allChunks.length > 0 && allChunks[0]) {
        initialSelected = allChunks[0];
      } else if (pickedInitial) {
        const out = meta.outputs[pickedInitial];
        initialSelected = {
          outputFile: pickedInitial,
          bytes: out.bytes || 0,
          entryPoint:
            out.entryPoint || inferEntryForOutput(meta, pickedInitial) || "",
          isEntry: Boolean(out.entryPoint),
          includedInputs: Object.keys(out.inputs || {}),
        };
      }

      setMetafile(meta);
      setChunks(
        allChunks.filter((chunk): chunk is InitialChunkSummary =>
          Boolean(chunk)
        )
      );
      setSelectedChunk(initialSelected);

      // Only select the entry point if it's actually included in this chunk
      const entryPointInChunk =
        initialSelected?.entryPoint &&
        initialSelected.includedInputs.includes(initialSelected.entryPoint);
      setSelectedModule(
        entryPointInChunk && initialSelected ? initialSelected.entryPoint : null
      );
      setInclusion(null);
      setChunkSearch("");
      setSearchResultIndex(-1);

      // Scroll the entry point file into view if it was selected
      if (entryPointInChunk) {
        setTimeout(() => {
          const selectedElement = document.querySelector(
            '[data-selected-module="true"]'
          );
          if (selectedElement) {
            selectedElement.scrollIntoView({
              behavior: "instant",
              block: "center",
            });
          }
        }, 100);
      }
    } catch (err) {
      console.error("Failed to process uploaded metafile:", err);
      alert(
        "Failed to process metafile: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
    // Reset the input so the same file can be selected again
    e.target.value = "";
  }

  return (
    <div className="min-h-screen p-2 sm:p-4">
      <div className="mx-auto max-w-screen-2xl w-full space-y-2 overflow-x-hidden h-[calc(100vh-2rem)]">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
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
                          onClick={handleFileUpload}
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
                  iconBgColor="bg-red-500"
                  icon={<Zap size={10} />}
                  description="Code loaded immediately on page load"
                />

                {/* Lazy Code Section */}
                <BundleStatsSection
                  title="Lazy"
                  chunks={lazyChunks}
                  bgColor="bg-purple-50"
                  hoverColor=""
                  borderColor="border-purple-200"
                  textColor="text-purple-700"
                  iconBgColor="bg-purple-500"
                  icon={<Clock size={10} />}
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
                              <Clock size={14} className="text-purple-500" />
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
                      <p className="text-sm text-muted-foreground">
                        No data yet.
                      </p>
                    )}
                    {filteredChunks.map((c) => (
                      <ChunkItem
                        key={c.outputFile}
                        chunk={c}
                        loadType={getChunkLoadType(c)}
                        getChunkTypeIcon={getChunkTypeIcon}
                        onClick={() => {
                          setSelectedChunk(c);

                          // Only select the entry point if it's actually included in this chunk
                          const entryPointInChunk =
                            c.entryPoint &&
                            c.includedInputs.includes(c.entryPoint);
                          if (entryPointInChunk) {
                            navigateToModule(c.entryPoint, c);
                          } else {
                            setSelectedModule(null);
                            // Still calculate inclusion path even if no entry point
                            const rootEntry =
                              initialChunk?.entryPoint || c.entryPoint;
                            if (metafile && rootEntry) {
                              // Find a suitable module in this chunk to show inclusion path for
                              const firstModule = c.includedInputs[0];
                              if (firstModule) {
                                const res = findInclusionPath(
                                  metafile,
                                  rootEntry,
                                  firstModule
                                );
                                setInclusion(res);
                              }
                            } else {
                              setInclusion(null);
                            }
                          }
                        }}
                        isSelected={selectedChunk?.outputFile === c.outputFile}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle className="mx-2 opacity-0 hover:opacity-50" />

          <ResizablePanel defaultSize={50} minSize={25} maxSize={50}>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle>Files In Selected Chunk</CardTitle>
                    <CardDescription>
                      {selectedChunk
                        ? `Files included in ${selectedChunk.outputFile}`
                        : "Select a chunk to see its files."}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowNodeModules(!showNodeModules)}
                            className="h-8 w-8 p-0 cursor-pointer"
                          >
                            {showNodeModules ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {showNodeModules
                              ? "Hide third-party libraries"
                              : "Show third-party libraries"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowFullPaths(!showFullPaths)}
                            className="h-8 w-8 p-0 cursor-pointer"
                          >
                            {showFullPaths ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <File className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {showFullPaths
                              ? "Show simplified folder names"
                              : "Show complete file paths"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAllCollapsed(!allCollapsed)}
                            className="h-8 w-8 p-0 cursor-pointer"
                          >
                            <Minimize2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {allCollapsed
                              ? "Show all folder contents"
                              : "Hide folder contents"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col h-full overflow-hidden px-3 py-2">
                <div className="flex flex-col h-full">
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                    <div className="space-y-2 px-1" data-chunk-contents>
                      {(() => {
                        let files: Array<{ path: string; size: number }>;

                        if (selectedChunk) {
                          // Show files from the selected chunk
                          const output =
                            metafile.outputs[selectedChunk.outputFile];
                          const inputsMap = output?.inputs || {};
                          files = (selectedChunk.includedInputs || [])
                            .filter(
                              (p) => showNodeModules || !/node_modules/.test(p)
                            )
                            .map((p) => ({
                              path: p,
                              size:
                                (inputsMap[p]?.bytesInOutput as
                                  | number
                                  | undefined) ||
                                (inputsMap[p]?.bytes as number | undefined) ||
                                0,
                            }));
                        } else {
                          // Show all files from the metafile when no chunk is selected
                          files = metafile
                            ? Object.entries(metafile.inputs)
                                .filter(
                                  ([path]) =>
                                    showNodeModules ||
                                    !/node_modules/.test(path)
                                )
                                .map(([path, input]) => ({
                                  path,
                                  size: input.bytes || 0,
                                }))
                            : [];
                        }
                        const tree = buildPathTree(files, showFullPaths);

                        // Check if no files are visible due to node_modules filtering
                        if (
                          files.length === 0 &&
                          !showNodeModules &&
                          selectedChunk
                        ) {
                          return (
                            <div className="text-center py-8">
                              <div className="text-sm text-muted-foreground">
                                Third-party libraries are hidden. Click the eye
                                icon above to show them.
                              </div>
                            </div>
                          );
                        }

                        // Show message when no files are available
                        if (files.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <div className="text-sm text-muted-foreground">
                                {selectedChunk
                                  ? "No files found in this chunk."
                                  : "No files found in the metafile."}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-1 overflow-hidden px-1">
                            <div className="space-y-2">
                              {tree.children?.map((child) => (
                                <FileTree
                                  key={child.path || child.name}
                                  tree={child}
                                  onSelectFile={onSelectModule}
                                  selectedPath={selectedModule}
                                  highlightText={chunkSearch}
                                  allCollapsed={allCollapsed}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle className="mx-2 opacity-0 hover:opacity-50" />

          <ResizablePanel defaultSize={25} minSize={25} maxSize={40}>
            <Card className="h-full">
              {selectedModule && (
                <CardHeader className="px-3 py-2 pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {moduleHistory.length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={goBackToPreviousModule}
                                className="h-8 w-8 p-0 cursor-pointer"
                              >
                                <ArrowLeft className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Go back to previous file</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <CardTitle
                        className="text-sm truncate"
                        title={selectedModule}
                      >
                        {selectedModule}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
              )}
              <CardContent className="flex flex-col gap-6 h-full overflow-y-auto px-3 py-2">
                {!selectedModule ? (
                  <p className="text-sm text-muted-foreground">
                    Click on a file in the middle panel to see how it&apos;s
                    included in your app.
                  </p>
                ) : (
                  <div className="space-y-2"></div>
                )}

                {/* Inclusion Path Section */}
                {(() => {
                  // Use the new getInclusionPath function to get import statements
                  const inclusionPath = selectedModule
                    ? getInclusionPath(metafile, selectedModule, chunks)
                    : [];

                  if (inclusionPath.length === 0) {
                    return null;
                  }
                  // Check if this module is the entry point of the MAIN APPLICATION bundle
                  const isMainEntryPoint =
                    selectedModule === initialChunk?.entryPoint;

                  // Check if this module is the entry point of its own chunk (but not the main app entry)
                  const isChunkEntryPoint =
                    selectedModule === selectedChunk?.entryPoint;

                  // Show special messages for entry points that have no inclusion path
                  if (isMainEntryPoint && inclusionPath.length === 0) {
                    // This is the actual main application entry point
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="p-1 rounded bg-red-500">
                                  <div className="w-4 h-4 text-white flex items-center justify-center">
                                    <Zap size={14} />
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  This is the entry point - where your
                                  application starts
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span className="text-sm font-medium">
                            Application Entry Point
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          This file is the starting point of your bundle and has
                          no dependencies above it.
                        </p>
                      </div>
                    );
                  }

                  if (
                    isChunkEntryPoint &&
                    inclusionPath.length === 0 &&
                    !isMainEntryPoint
                  ) {
                    // This is the entry point of a chunk (could be lazy or initial)
                    const chunkType = getChunkLoadType(selectedChunk!);
                    const { icon: IconComponent, color } =
                      getChunkTypeIcon(chunkType);

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="p-1 rounded"
                                  style={{ backgroundColor: color }}
                                >
                                  <div className="w-4 h-4 text-white flex items-center justify-center">
                                    <IconComponent size={14} />
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {chunkType === "lazy"
                                    ? "Lazy Chunk"
                                    : "Eager Chunk"}{" "}
                                  Entry Point
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span className="text-sm font-medium">
                            {chunkType === "lazy"
                              ? "Lazy Chunk"
                              : "Eager Chunk"}{" "}
                            Entry Point
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          This file is the starting point of its{" "}
                          {chunkType === "lazy" ? "lazy" : "initial"} chunk and
                          has no dependencies above it within this chunk.
                        </p>
                      </div>
                    );
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
                      <div className="space-y-2">
                        {inclusionPath.map((step, idx) => {
                          // Find which chunk this file belongs to
                          const chunkContainingFile = chunks.find((chunk) =>
                            chunk.includedInputs.includes(step.file)
                          );

                          return (
                            <div
                              key={idx}
                              className="flex items-start gap-2 p-1.5 rounded-md bg-muted/20"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="break-all">
                                  <span
                                    className="text-xs font-medium truncate block"
                                    title={step.file}
                                  >
                                    {step.file}
                                  </span>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {step.importerChunkType === "lazy" && (
                                      <span className="text-xs text-purple-600 font-medium">
                                        lazy
                                      </span>
                                    )}
                                    {step.isDynamicImport ? (
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
                                      title={step.importStatement}
                                    >
                                      {step.importStatement}
                                    </code>
                                  </div>
                                  {step.isDynamicImport &&
                                    (() => {
                                      // Find the chunk created by this dynamic import
                                      const dynamicImportPath =
                                        step.importStatement.replace(
                                          /^["']|["']$/g,
                                          ""
                                        );

                                      // Look for chunks that have this path as their entry point or contain files from this path
                                      const createdChunk = chunks.find(
                                        (chunk) => {
                                          // Check if this chunk's entry point matches the dynamic import
                                          if (
                                            chunk.entryPoint.includes(
                                              dynamicImportPath.replace(
                                                "./",
                                                ""
                                              )
                                            )
                                          ) {
                                            return true;
                                          }
                                          // Or check if any included input matches the dynamic import path
                                          return chunk.includedInputs.some(
                                            (input) =>
                                              input.includes(
                                                dynamicImportPath.replace(
                                                  "./",
                                                  ""
                                                )
                                              )
                                          );
                                        }
                                      );

                                      return (
                                        <div className="text-xs text-purple-600 mt-0.5">
                                          ⚡ Creates lazy-loaded module
                                          {createdChunk && (
                                            <span className="ml-1">
                                              ({createdChunk.outputFile} -{" "}
                                              {formatBytes(createdChunk.bytes)})
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                </div>
                                {chunkContainingFile && (
                                  <div
                                    className="text-xs text-muted-foreground mt-0.5 truncate"
                                    title={`${
                                      chunkContainingFile.outputFile
                                    } (${formatBytes(
                                      chunkContainingFile.bytes
                                    )})`}
                                  >
                                    {chunkContainingFile.outputFile} (
                                    {formatBytes(chunkContainingFile.bytes)})
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Imported by Section */}
                {(() => {
                  const importSources = selectedModule
                    ? getImportSources(
                        metafile,
                        selectedModule,
                        chunks,
                        initialSummary?.initial.outputs || []
                      )
                    : [];

                  if (importSources.length > 0) {
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
                                  Files that directly import this module and
                                  their loading type
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {importSources.map((source, idx) => {
                            const chunkContainingFile = chunks.find((chunk) =>
                              chunk.includedInputs.includes(source.importer)
                            );
                            const fileExistsInMetafile = Boolean(
                              metafile?.inputs[source.importer]
                            );
                            // Allow navigation if file exists in metafile, even if not in a chunk (e.g., barrel files)
                            const canOpen =
                              Boolean(chunkContainingFile) ||
                              fileExistsInMetafile;
                            const isSourceOnly =
                              fileExistsInMetafile && !chunkContainingFile;

                            const { icon: IconComponent, color } =
                              getChunkTypeIcon(source.chunkType);

                            return (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                                onClick={
                                  canOpen
                                    ? () =>
                                        navigateToModule(
                                          source.importer,
                                          chunkContainingFile || undefined
                                        )
                                    : undefined
                                }
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  <div
                                    className={`w-3 h-3 rounded-full ${color} flex items-center justify-center`}
                                  >
                                    <IconComponent
                                      size={10}
                                      className="text-white"
                                    />
                                  </div>
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
                                  {source.chunkOutputFile &&
                                    source.chunkSize && (
                                      <div className="text-xs text-muted-foreground">
                                        {source.chunkOutputFile} (
                                        {formatBytes(source.chunkSize)})
                                      </div>
                                    )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Modules Created Section */}
                {(() => {
                  const createdChunks = selectedModule
                    ? getChunksCreatedByFile(metafile, selectedModule, chunks)
                    : [];

                  if (createdChunks.length > 0) {
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
                                <p>
                                  Lazy-loaded chunks created by dynamic imports
                                  in this file
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {createdChunks.map((created, idx) => {
                            const { icon: IconComponent, color } =
                              getChunkTypeIcon("lazy");

                            return (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  <div
                                    className={`w-3 h-3 rounded-full ${color} flex items-center justify-center`}
                                  >
                                    <IconComponent
                                      size={10}
                                      className="text-white"
                                    />
                                  </div>
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
                                    <span className="text-xs text-muted-foreground">
                                      from
                                    </span>
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
                  return null;
                })()}
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
