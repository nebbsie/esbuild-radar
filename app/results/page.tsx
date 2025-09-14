"use client";

import { ChunksPanel } from "@/components/chunks-panel";
import { DetailsPanel } from "@/components/details-panel";
import { FilesPanel } from "@/components/files-panel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { inferEntryForOutput, pickInitialOutput } from "@/lib/analyser";
import { createChunkSummaries, filterChunks } from "@/lib/chunk-utils";
import { processUploadedFile as processUploadedFileUtil } from "@/lib/file-utils";
import { estimateBrotliSize, estimateGzipSize } from "@/lib/format";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { summarizeInitial } from "@/lib/initial-summary";
import { parseMetafile } from "@/lib/metafile";
import { determineModuleSelectionForChunkChange } from "@/lib/module-utils";
import {
  getInitialChunkEntryPoint,
  ModuleNavigationHistory,
  selectModule,
} from "@/lib/navigation-utils";
import { metafileStorage } from "@/lib/storage";
import type {
  InclusionPathResult,
  InitialChunkSummary,
  Metafile,
  ProcessedMetafileData,
} from "@/lib/types";
import { Loader2 } from "lucide-react";
// Icons are now imported in individual components
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
  const [, setInclusion] = React.useState<InclusionPathResult | null>(null);
  const [metafileName, setMetafileName] = React.useState<string>("");
  const [initialChunk, setInitialChunk] =
    React.useState<InitialChunkSummary | null>(null);

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
  const moduleHistory = React.useMemo(() => new ModuleNavigationHistory(), []);

  // no-op: using setChunkTypeFilters directly with functional updates below

  // Navigation functions

  const navigateToModule = React.useCallback(
    (
      modulePath: string,
      chunk?: InitialChunkSummary,
      historyMode: "push" | "reset" | "none" = "none"
    ) => {
      // Handle history based on the mode
      if (historyMode === "reset") {
        // Manual chunk click: start fresh
        moduleHistory.clear();
      } else if (historyMode === "push") {
        // We want: previous → new
        if (selectedModule && selectedModule !== modulePath) {
          moduleHistory.push(selectedModule); // remember where we came from
        }
      }
      // 'none' mode keeps history untouched

      // Use the utility function to handle module selection logic
      const result = selectModule(
        modulePath,
        chunks,
        metafile,
        initialChunk,
        chunk || selectedChunk
      );

      setSelectedModule(result.selectedModule);
      setSelectedChunk(result.selectedChunk);
      setInclusion(result.inclusion);

      // After navigation completes, if we are in push mode add the new module
      if (historyMode === "push") {
        moduleHistory.push(modulePath);
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
    [
      selectedModule,
      chunks,
      metafile,
      initialChunk,
      selectedChunk,
      moduleHistory,
    ]
  );

  const goBackToPreviousModule = React.useCallback(() => {
    // If we have history, get the previous module
    if (moduleHistory.hasPrevious()) {
      const previousModule = moduleHistory.getPrevious();
      if (previousModule) {
        // Find the chunk containing the previous module
        const chunkContainingFile = chunks.find((chunk) =>
          chunk.includedInputs.includes(previousModule)
        );

        if (chunkContainingFile) {
          // Navigate back without adding to history to prevent loops
          navigateToModule(previousModule, chunkContainingFile, "none");
        } else {
          // Fallback: just set the module without chunk info
          setSelectedModule(previousModule);
          setSelectedChunk(null);
          setInclusion(null);
        }
      }
    } else {
      // If no history, clear the current selection to go back to initial state
      setSelectedModule(null);
      setSelectedChunk(null);
      setInclusion(null);
    }
  }, [
    moduleHistory,
    chunks,
    navigateToModule,
    setSelectedModule,
    setSelectedChunk,
    setInclusion,
  ]);

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

  // Separate initial and lazy chunks for the new UI sections
  const initialChunks = React.useMemo(() => {
    if (!initialSummary || !metafile) return [];
    return createChunkSummaries(initialSummary.initial.outputs, metafile);
  }, [initialSummary, metafile]);

  const lazyChunks = React.useMemo(() => {
    if (!initialSummary || !metafile) return [];
    return createChunkSummaries(initialSummary.lazy.outputs, metafile);
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
          const unsortedChunks: InitialChunkSummary[] = [
            ...summary.initial.outputs,
            ...summary.lazy.outputs,
          ]
            .map((outputFile) => {
              const out = mf.outputs[outputFile];
              if (!out) return null;
              return {
                outputFile,
                bytes: out.bytes || 0,
                gzipBytes: estimateGzipSize(out.bytes || 0),
                brotliBytes: estimateBrotliSize(out.bytes || 0),
                entryPoint:
                  out.entryPoint || inferEntryForOutput(mf, outputFile) || "",
                isEntry: Boolean(out.entryPoint),
                includedInputs: Object.keys(out.inputs || {}),
              };
            })
            .filter((chunk): chunk is InitialChunkSummary => Boolean(chunk));

          // Find the main entry chunk for sorting
          const mainEntryPoint = getInitialChunkEntryPoint(mf, summary);
          const mainEntryChunk = mainEntryPoint
            ? unsortedChunks.find((c) => c.entryPoint === mainEntryPoint)
            : null;

          // Sort chunks: main entry chunk first, then by size
          const allChunks = unsortedChunks.sort((a, b) => {
            // If a is the main entry chunk, it comes first
            if (mainEntryChunk && a.outputFile === mainEntryChunk.outputFile)
              return -1;
            // If b is the main entry chunk, a comes after
            if (mainEntryChunk && b.outputFile === mainEntryChunk.outputFile)
              return 1;

            // Otherwise sort by size (largest first)
            return b.bytes - a.bytes;
          });

          // Select the first chunk from the classified list, or the initial chunk if empty
          let initialSelected = allChunks[0] || null;
          if (!initialSelected && pickedInitial) {
            const out = mf.outputs[pickedInitial];
            initialSelected = {
              outputFile: pickedInitial,
              bytes: out.bytes || 0,
              gzipBytes: estimateGzipSize(out.bytes || 0),
              brotliBytes: estimateBrotliSize(out.bytes || 0),
              entryPoint:
                out.entryPoint || inferEntryForOutput(mf, pickedInitial) || "",
              isEntry: Boolean(out.entryPoint),
              includedInputs: Object.keys(out.inputs || {}),
            };
          }

          setMetafile(mf);
          setChunks(allChunks);
          setSelectedChunk(initialSelected);

          // Set the initial chunk
          const initialChunkEntry = getInitialChunkEntryPoint(mf, summary);
          if (initialChunkEntry) {
            const chunk = allChunks.find(
              (c) => c.entryPoint === initialChunkEntry
            );
            setInitialChunk(chunk || null);
          } else {
            setInitialChunk(null);
          }

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
    navigateToModule(mod);
  }

  // Filter chunks based on search term and chunk type
  const filteredChunks = React.useMemo(
    () => filterChunks(chunks, chunkSearch, chunkTypeFilters, initialSummary),
    [chunks, chunkSearch, chunkTypeFilters, initialSummary]
  );

  // Components are now extracted to separate files

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
  // But don't override manual navigation to modules in filtered chunks
  React.useEffect(() => {
    // Don't auto-select if the current selectedChunk is not in filteredChunks
    // This prevents overriding manual navigation to filtered chunks
    const currentChunkIsFiltered =
      selectedChunk && filteredChunks.includes(selectedChunk);

    if (!currentChunkIsFiltered && selectedChunk) {
      // Current selection is in a filtered chunk, don't auto-change it
      return;
    }

    const { selectedModule: newModule, selectedChunk: newChunk } =
      determineModuleSelectionForChunkChange(
        filteredChunks,
        selectedModule,
        selectedChunk
      );

    if (newChunk !== selectedChunk) {
      setSelectedChunk(newChunk);
      setSelectedModule(newModule);
      setInclusion(null);

      // Scroll the entry point file into view if it was selected
      if (newModule) {
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
  }, [filteredChunks, selectedModule, selectedChunk]);

  // Reset search result index when search changes
  React.useEffect(() => {
    setSearchResultIndex(-1);
  }, [chunkSearch]);

  if (!metafile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin  text-primary" />
        </div>
      </div>
    );
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

  async function processUploadedFile(file: File) {
    try {
      // Process the file using the utility function
      const processedData: ProcessedMetafileData =
        await processUploadedFileUtil(file);

      // Store the new metafile
      await metafileStorage.storeMetafile(
        JSON.stringify(processedData.metafile)
      );

      // Update state with processed data
      setMetafile(processedData.metafile);
      setInitialSummary(processedData.initialSummary);
      setChunks(processedData.chunks);
      setSelectedChunk(processedData.selectedChunk);
      setSelectedModule(processedData.selectedModule);
      setInclusion(null);
      setChunkSearch("");
      setSearchResultIndex(-1);

      // Scroll the entry point file into view if it was selected
      if (processedData.selectedModule) {
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
      alert(err instanceof Error ? err.message : "Unknown error");
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
      <div className="mx-auto w-full space-y-2 overflow-x-hidden h-[calc(100vh-2rem)]">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <ChunksPanel
              metafile={metafile}
              initialChunks={initialChunks}
              lazyChunks={lazyChunks}
              chunkSearch={chunkSearch}
              setChunkSearch={setChunkSearch}
              handleSearchKeyDown={handleSearchKeyDown}
              chunkTypeFilters={chunkTypeFilters}
              setChunkTypeFilters={setChunkTypeFilters}
              showFilterMenu={showFilterMenu}
              setShowFilterMenu={setShowFilterMenu}
              filteredChunks={filteredChunks}
              chunks={chunks}
              selectedChunk={selectedChunk}
              navigateToModule={navigateToModule}
              initialChunk={initialChunk}
              setSelectedModule={setSelectedModule}
              setSelectedChunk={setSelectedChunk}
              setInclusion={setInclusion}
            />
          </ResizablePanel>

          <ResizableHandle className="mx-2 opacity-0 hover:opacity-50" />

          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <FilesPanel
              metafile={metafile}
              selectedChunk={selectedChunk}
              showNodeModules={showNodeModules}
              setShowNodeModules={setShowNodeModules}
              showFullPaths={showFullPaths}
              setShowFullPaths={setShowFullPaths}
              allCollapsed={allCollapsed}
              setAllCollapsed={setAllCollapsed}
              onSelectModule={onSelectModule}
              selectedModule={selectedModule}
              chunkSearch={chunkSearch}
            />
          </ResizablePanel>

          <ResizableHandle className="mx-2 opacity-0 hover:opacity-50" />

          <ResizablePanel defaultSize={40} minSize={25} maxSize={40}>
            <DetailsPanel
              metafile={metafile}
              selectedModule={selectedModule}
              selectedChunk={selectedChunk}
              initialChunk={initialChunk}
              chunks={chunks}
              initialSummary={initialSummary}
              moduleHistory={moduleHistory}
              goBackToPreviousModule={goBackToPreviousModule}
              navigateToModule={navigateToModule}
            />
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
