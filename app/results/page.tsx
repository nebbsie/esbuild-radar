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
  classifyChunksFromInitial,
  inferEntryForOutput,
  pickInitialOutput,
  type ClassifiedChunks,
} from "@/lib/analyser";
import { formatBytes } from "@/lib/format";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import type {
  EagerChunkSummary,
  InclusionPathResult,
  InclusionPathStep,
  Metafile,
  ReverseDependency,
} from "@/lib/metafile";
import {
  findInclusionPath,
  findReverseDependencies,
  getModuleDetails,
  getModuleImports,
  parseMetafile,
} from "@/lib/metafile";
import { buildPathTree } from "@/lib/path-tree";
import { metafileStorage } from "@/lib/storage";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  File,
  FileText,
  Filter,
  HelpCircle,
  Hourglass,
  Minimize2,
  Search,
  Star,
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
  eager: true,
  lazy: false,
};

export default function ResultsPage() {
  const router = useRouter();
  const [metafile, setMetafile] = React.useState<Metafile | null>(null);
  const [chunks, setChunks] = React.useState<EagerChunkSummary[]>([]);
  const [classifiedChunks, setClassifiedChunks] =
    React.useState<ClassifiedChunks | null>(null);
  const [selectedChunk, setSelectedChunk] =
    React.useState<EagerChunkSummary | null>(null);
  const [selectedModule, setSelectedModule] = React.useState<string | null>(
    null
  );
  const [inclusion, setInclusion] = React.useState<InclusionPathResult | null>(
    null
  );

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
  const navigateToModule = React.useCallback(
    (modulePath: string, chunk?: EagerChunkSummary, skipHistory = false) => {
      if (!skipHistory && selectedModule && selectedModule !== modulePath) {
        // Add current module to history before navigating (unless skipping)
        setModuleHistory((prev) => [...prev, selectedModule]);
      }

      setSelectedModule(modulePath);
      if (chunk) {
        setSelectedChunk(chunk);
        if (metafile) {
          const res = findInclusionPath(metafile, chunk.entryPoint, modulePath);
          setInclusion(res);
        }
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
    [selectedModule, metafile]
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
    return classifiedChunks?.initial || null;
  }, [classifiedChunks]);

  // Get only the chunks that are loaded initially (eager + initial)
  const initialBundleChunks = React.useMemo(() => {
    if (!classifiedChunks) return [];
    return [classifiedChunks.initial, ...classifiedChunks.eager].filter(
      Boolean
    );
  }, [classifiedChunks]);

  React.useEffect(() => {
    metafileStorage.loadMetafile().then((storedData) => {
      if (storedData) {
        try {
          const json = JSON.parse(storedData);
          const mf = parseMetafile(json);

          // Pick the initial chunk
          const pickedInitial = pickInitialOutput(mf);
          if (!pickedInitial) {
            console.warn("No initial chunk found");
            return;
          }

          // Classify chunks from the initial chunk's imports
          const classified = classifyChunksFromInitial(mf, pickedInitial);

          // Combine all chunks (initial, eager, and lazy) for the main chunks list
          const allChunks = [
            classified.initial,
            ...classified.eager,
            ...classified.lazy,
          ].filter((chunk): chunk is EagerChunkSummary => Boolean(chunk));

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
          setClassifiedChunks(classified);
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

      // Only select the entry point if it's actually included in this chunk
      const entryPointInChunk =
        chunkContainingModule.entryPoint &&
        chunkContainingModule.includedInputs.includes(
          chunkContainingModule.entryPoint
        );
      setSelectedModule(
        entryPointInChunk ? chunkContainingModule.entryPoint : null
      );

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

    if (metafile && chunkContainingModule) {
      const res = findInclusionPath(
        metafile,
        chunkContainingModule.entryPoint,
        mod
      );
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
    (chunk: EagerChunkSummary): "initial" | "eager" | "lazy" => {
      if (!classifiedChunks) return "eager";
      if (classifiedChunks.initial?.outputFile === chunk.outputFile)
        return "initial";
      return classifiedChunks.eager.some(
        (c) => c.outputFile === chunk.outputFile
      )
        ? "eager"
        : "lazy";
    },
    [classifiedChunks]
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
  const getChunkTypeIcon = React.useCallback(
    (loadType: "initial" | "eager" | "lazy") => {
      switch (loadType) {
        case "initial":
          return {
            icon: Star,
            tooltip: "Initial chunk - your main entry point that loads first",
            color: "bg-yellow-500",
          };
        case "eager":
          return {
            icon: Zap,
            tooltip: "Eager chunk - loaded immediately with the initial bundle",
            color: "bg-red-500",
          };
        case "lazy":
          return {
            icon: Clock,
            tooltip: "Lazy chunk - loaded on-demand when needed",
            color: "bg-purple-500",
          };
      }
    },
    []
  );

  // Components for better organization and performance
  const ChunkItem = React.memo<{
    chunk: EagerChunkSummary;
    loadType: "initial" | "eager" | "lazy";
    getChunkTypeIcon: (loadType: "initial" | "eager" | "lazy") => {
      icon: React.ComponentType<{ size?: number }>;
      tooltip: string;
      color: string;
    };
    onClick: () => void;
    isSelected: boolean;
  }>(({ chunk, loadType, getChunkTypeIcon, onClick, isSelected }) => {
    const { icon: IconComponent, tooltip, color } = getChunkTypeIcon(loadType);

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
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-1 rounded ${color} flex-shrink-0`}>
                  <div className="w-2.5 h-2.5 text-white flex items-center justify-center">
                    <IconComponent size={10} />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </button>
    );
  });
  ChunkItem.displayName = "ChunkItem";

  const ImportItem = React.memo<{
    dep: ReverseDependency;
    canOpen: boolean;
    onClick?: () => void;
  }>(({ dep, canOpen, onClick }) => {
    return (
      <div className="w-full text-left text-xs break-all bg-muted/50 hover:bg-muted px-2 py-1 rounded transition-colors group">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate" title={dep.importer}>
              {dep.importer}
            </div>
            {dep.external && (
              <span className="text-muted-foreground">(external)</span>
            )}
          </div>
          {canOpen && (
            <button
              onClick={onClick}
              className="flex-shrink-0 p-1 rounded hover:bg-muted-foreground/20 transition-colors cursor-pointer"
              title="Open this file"
            >
              <ArrowRight size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    );
  });
  ImportItem.displayName = "ImportItem";

  const InclusionPathItem = React.memo<{
    step: InclusionPathStep;
  }>(({ step }) => {
    return (
      <li className="break-all">
        <span>↳ {step.to}</span>
      </li>
    );
  });
  InclusionPathItem.displayName = "InclusionPathItem";

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

      // Classify chunks from the initial chunk's imports
      const classified = classifyChunksFromInitial(meta, pickedInitial);

      // Combine all chunks (initial, eager, and lazy) for the main chunks list
      const allChunks = [
        classified.initial,
        ...classified.eager,
        ...classified.lazy,
      ].filter((chunk): chunk is EagerChunkSummary => Boolean(chunk));

      // Select the first chunk from the classified list, or the initial chunk if empty
      let initialSelected: EagerChunkSummary | null = null;
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
      setClassifiedChunks(classified);
      setChunks(
        allChunks.filter((chunk): chunk is EagerChunkSummary => Boolean(chunk))
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
                <div
                  className="w-full mb-3 p-3 bg-primary/10 border border-primary/20 rounded-md hover:bg-primary/20 transition-colors cursor-pointer"
                  onClick={() => {
                    // Select the picked initial chunk (fallbacks handled)
                    if (initialChunk) {
                      setSelectedChunk(initialChunk);

                      // Only select the entry point if it's actually included in this chunk
                      const entryPointInChunk =
                        initialChunk.entryPoint &&
                        initialChunk.includedInputs.includes(
                          initialChunk.entryPoint
                        );
                      setSelectedModule(
                        entryPointInChunk ? initialChunk.entryPoint : null
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
                  }}
                >
                  <TooltipProvider>
                    <div className="text-xs text-primary mb-2">
                      Initial Bundle
                    </div>
                    <div className="text-sm font-medium mb-3 flex items-center gap-2">
                      <span className="truncate">
                        {initialChunk?.outputFile || "No entry found"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        (
                        {initialChunk ? formatBytes(initialChunk.bytes) : "0 B"}
                        )
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          <span>Total size:</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Combined size of chunks loaded immediately
                                (eager chunks + initial chunk).
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="font-medium text-primary">
                          {formatBytes(
                            initialBundleChunks.reduce(
                              (total, chunk) => total + (chunk?.bytes || 0),
                              0
                            )
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          <span>Chunks:</span>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Output files loaded immediately on initial page
                                load (eager chunks + initial chunk).
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span>{initialBundleChunks.length}</span>
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
                                The biggest chunk loaded on initial page load
                                that could impact loading performance.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span>
                          {initialBundleChunks.length > 0
                            ? formatBytes(
                                Math.max(
                                  ...initialBundleChunks.map(
                                    (c) => c?.bytes || 0
                                  )
                                )
                              )
                            : "0 B"}
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
                                Source files/modules bundled into chunks loaded
                                immediately (eager chunks + initial chunk).
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span>
                          {initialBundleChunks.reduce(
                            (total, chunk) =>
                              total + (chunk?.includedInputs?.length || 0),
                            0
                          )}
                        </span>
                      </div>
                    </div>
                  </TooltipProvider>
                </div>

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
                              <Star size={14} className="text-yellow-500" />
                              <span className="text-xs">Initial</span>
                            </label>

                            <label className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                              <input
                                type="checkbox"
                                checked={chunkTypeFilters.eager}
                                onChange={() =>
                                  setChunkTypeFilters((prev) => ({
                                    ...prev,
                                    eager: !prev.eager,
                                  }))
                                }
                                className="rounded border-border"
                              />
                              <Zap size={14} className="text-red-500" />
                              <span className="text-xs">Eager</span>
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
                              <Hourglass
                                size={14}
                                className="text-purple-500"
                              />
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
                            setInclusion(null);
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
                {!selectedChunk ? (
                  <p className="text-sm text-muted-foreground">
                    Click on a chunk on the left to see its files.
                  </p>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-2 px-1" data-chunk-contents>
                        {(() => {
                          const output =
                            metafile.outputs[selectedChunk.outputFile];
                          const inputsMap = output?.inputs || {};
                          const files = (selectedChunk.includedInputs || [])
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
                          const tree = buildPathTree(files, showFullPaths);

                          // Check if no files are visible due to node_modules filtering
                          if (files.length === 0 && !showNodeModules) {
                            return (
                              <div className="text-center py-8">
                                <div className="text-sm text-muted-foreground">
                                  Third-party libraries are hidden. Click the
                                  eye icon above to show them.
                                </div>
                              </div>
                            );
                          }

                          // Check if no files are visible due to search filtering
                          if (files.length === 0 && chunkSearch) {
                            return (
                              <div className="text-center py-8">
                                <div className="text-sm text-muted-foreground">
                                  No files match your search. Try a different
                                  search term or clear the search.
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
                )}
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
              <CardContent className="flex flex-col gap-6 h-full overflow-hidden px-3 py-2">
                {!selectedModule ? (
                  <p className="text-sm text-muted-foreground">
                    Click on a file in the middle panel to see how it&apos;s
                    included in your app.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const moduleDetails = getModuleDetails(
                        metafile,
                        selectedModule
                      );

                      return (
                        <>
                          <div className="text-xs text-muted-foreground">
                            Chunk: {selectedChunk?.outputFile || "Unknown"}
                          </div>
                          {moduleDetails && (
                            <>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <span>
                                  Type:{" "}
                                  {moduleDetails.format?.toUpperCase() ||
                                    "Unknown"}
                                </span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle
                                        size={10}
                                        className="text-muted-foreground hover:text-foreground cursor-help"
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        The module format (ESM, CommonJS, etc.)
                                        used by this file
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              {moduleDetails.bytes && (
                                <div className="text-xs text-muted-foreground">
                                  Size: {formatBytes(moduleDetails.bytes)}
                                </div>
                              )}
                              {moduleDetails.importsCount !== undefined && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span>
                                    Imports: {moduleDetails.importsCount}{" "}
                                    modules
                                  </span>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle
                                          size={10}
                                          className="text-muted-foreground hover:text-foreground cursor-help"
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          Number of modules this file imports
                                          directly
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Imported by Section */}
                {(() => {
                  const reverseDeps = selectedModule
                    ? findReverseDependencies(metafile, selectedModule)
                    : [];

                  if (reverseDeps.length > 0) {
                    return (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <span>Imported by ({reverseDeps.length})</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle
                                  size={12}
                                  className="text-muted-foreground hover:text-foreground cursor-help"
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Files that directly import this module</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {reverseDeps.map((dep, idx) => {
                            const chunkContainingFile = chunks.find((chunk) =>
                              chunk.includedInputs.includes(dep.importer)
                            );
                            const canOpen = Boolean(chunkContainingFile);
                            return (
                              <ImportItem
                                key={idx}
                                dep={dep}
                                canOpen={canOpen}
                                onClick={
                                  canOpen && chunkContainingFile
                                    ? () =>
                                        navigateToModule(
                                          dep.importer,
                                          chunkContainingFile
                                        )
                                    : undefined
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {(() => {
                  const res = inclusion;
                  if (!res) return null;
                  if (!res.found) {
                    return (
                      <p className="text-sm space-y-2 text-muted-foreground">
                        No inclusion path found (may be inlined or tree-shaken
                        path not represented).
                      </p>
                    );
                  }

                  return null;
                })()}

                {/* Imports Section */}
                {(() => {
                  const imports = selectedModule
                    ? getModuleImports(metafile, selectedModule)
                    : null;
                  if (imports && imports.length > 0) {
                    return (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <span>Imports ({imports.length})</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle
                                  size={12}
                                  className="text-muted-foreground hover:text-foreground cursor-help"
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Modules that this file imports directly</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {imports.map((importedModule, idx) => {
                            const chunkContainingFile = chunks.find((chunk) =>
                              chunk.includedInputs.includes(importedModule)
                            );
                            const canOpen = Boolean(chunkContainingFile);
                            return (
                              <div
                                key={idx}
                                className="w-full text-left text-xs break-all bg-muted/50 hover:bg-muted px-2 py-1 rounded transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="font-medium truncate"
                                      title={importedModule}
                                    >
                                      {importedModule}
                                    </div>
                                  </div>
                                  {canOpen && (
                                    <button
                                      onClick={() =>
                                        navigateToModule(
                                          importedModule,
                                          chunkContainingFile!
                                        )
                                      }
                                      className="flex-shrink-0 p-1 rounded hover:bg-muted-foreground/20 transition-colors cursor-pointer"
                                      title="Open this module"
                                    >
                                      <ArrowRight
                                        size={12}
                                        className="text-muted-foreground"
                                      />
                                    </button>
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

                {/* Inclusion Path Section */}
                {(() => {
                  const res = inclusion;
                  if (!res) return null;
                  if (!res.found) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        No inclusion path found (may be inlined or tree-shaken
                        path not represented).
                      </p>
                    );
                  }
                  // Check if this module is the entry point of the MAIN APPLICATION bundle
                  const isMainEntryPoint =
                    selectedModule === initialChunk?.entryPoint;

                  if (isMainEntryPoint && res.path.length === 0) {
                    // This is the actual main application entry point
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="p-1 rounded bg-yellow-500">
                                  <div className="w-4 h-4 text-white flex items-center justify-center">
                                    <Star size={14} />
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

                  // Check if this module is the entry point of its own chunk (but not the main app entry)
                  const isChunkEntryPoint =
                    selectedModule === selectedChunk?.entryPoint;

                  if (
                    isChunkEntryPoint &&
                    res.path.length === 0 &&
                    !isMainEntryPoint
                  ) {
                    // This is the entry point of a chunk (could be lazy or eager)
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
                          {chunkType === "lazy" ? "lazy" : "eager"} chunk and
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
                      <ol className="text-sm space-y-3">
                        <li className="break-all">
                          {selectedChunk?.entryPoint || "Unknown"}
                        </li>
                        {res.path.map((s, idx) => (
                          <InclusionPathItem key={idx} step={s} />
                        ))}
                      </ol>
                    </div>
                  );
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
