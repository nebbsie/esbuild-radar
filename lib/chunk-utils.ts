import { inferEntryForOutput } from "@/lib/analyser";
import type {
  InitialChunkSummary,
  Metafile,
  MetafileOutput,
} from "@/lib/types";

/**
 * Finds the best chunk for a given file path.
 *
 * This function implements a multi-step heuristic to determine which chunk
 * contains or is most relevant to a specific file:
 *
 * 1. First, it looks for a chunk that directly contains the file
 * 2. If not found directly, it looks for chunks containing files imported by the target file
 * 3. As a fallback, it returns a provided current chunk
 *
 * This is useful for navigation and selection logic where we need to determine
 * the most appropriate chunk context for viewing a specific file.
 *
 * @param filePath – The file path to find a chunk for
 * @param chunks – Array of available chunks to search through
 * @param metafile – The metafile containing input relationships
 * @param currentChunk – Optional fallback chunk to return if no better match found
 * @returns The best matching chunk, or undefined if none found
 */
export function findBestChunkForFile(
  filePath: string,
  chunks: InitialChunkSummary[],
  metafile: Metafile | null,
  currentChunk?: InitialChunkSummary | null
): InitialChunkSummary | undefined {
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
  return currentChunk || undefined;
}

/**
 * Determines if a file is the main entry point of the application (entry point of the initial chunk).
 *
 * This is used to show the correct icon type in the UI - only the actual entry point
 * of the initial chunk should display the "main-entry" icon.
 *
 * @param filePath - The file path to check
 * @param initialChunk - The initial chunk summary, if available
 * @returns true if the file is the main entry point, false otherwise
 */
export function isMainEntryPoint(
  filePath: string,
  initialChunk: InitialChunkSummary | null
): boolean {
  return Boolean(initialChunk && filePath === initialChunk.entryPoint);
}

/**
 * Determines whether a chunk should be classified as "initial" or "lazy" based
 * on the initial bundle summary.
 *
 * Initial chunks are downloaded immediately when the page loads, while lazy
 * chunks are loaded on-demand (typically via dynamic imports).
 *
 * @param chunk – The chunk to classify
 * @param initialSummary – The summary containing initial and lazy chunk lists
 * @returns "initial" if the chunk is in the initial bundle, "lazy" otherwise
 */
export function getChunkLoadType(
  chunk: InitialChunkSummary,
  initialSummary: {
    initial: { outputs: string[]; totalBytes: number };
    lazy: { outputs: string[]; totalBytes: number };
  } | null
): "initial" | "lazy" {
  if (!initialSummary) return "initial";
  return initialSummary.initial.outputs.includes(chunk.outputFile)
    ? "initial"
    : "lazy";
}

/**
 * Returns the appropriate icon and color for visualizing chunk load types.
 *
 * @param loadType – The load type of the chunk ("initial" or "lazy")
 * @returns Object containing the icon component and CSS color class
 */
export function getChunkTypeIcon(loadType: "initial" | "lazy"): {
  icon: string;
  color: string;
} {
  switch (loadType) {
    case "initial":
      return {
        icon: "Zap", // We'll import these when needed
        color: "bg-red-500",
      };
    case "lazy":
      return {
        icon: "Clock",
        color: "bg-purple-500",
      };
  }
}

/**
 * Filters chunks based on search terms and chunk type preferences.
 *
 * This function applies multiple filters to a chunk list:
 * 1. Text search filter - matches search terms against file paths in chunks
 * 2. Type filter - includes/excludes initial vs lazy chunks based on preferences
 *
 * @param chunks – Array of chunks to filter
 * @param searchTerm – Search string to match against file paths (case-insensitive)
 * @param typeFilters – Object specifying which chunk types to include
 * @param initialSummary – Summary containing chunk classifications
 * @returns Filtered array of chunks
 */
export function filterChunks(
  chunks: InitialChunkSummary[],
  searchTerm: string,
  typeFilters: { initial: boolean; lazy: boolean },
  initialSummary: {
    initial: { outputs: string[]; totalBytes: number };
    lazy: { outputs: string[]; totalBytes: number };
  } | null
): InitialChunkSummary[] {
  return chunks.filter((chunk) => {
    // Check search term
    const matchesSearch =
      searchTerm === "" ||
      chunk.includedInputs.some((input) =>
        input.toLowerCase().includes(searchTerm.toLowerCase())
      );

    // Check chunk type filter
    const chunkType = getChunkLoadType(chunk, initialSummary);
    const matchesType = typeFilters[chunkType];

    return matchesSearch && matchesType;
  });
}

/**
 * Creates an InitialChunkSummary object from a metafile output entry.
 *
 * This is a pure function that converts the raw metafile output data
 * into the standardized InitialChunkSummary format used throughout the app.
 *
 * @param outputFile – The output file path (key in metafile.outputs)
 * @param output – The output object from the metafile
 * @param metafile – The complete metafile for entry point inference
 * @returns InitialChunkSummary object, or null if output is invalid
 */
export function createInitialChunkSummary(
  outputFile: string,
  output: MetafileOutput | null,
  metafile: Metafile
): InitialChunkSummary | null {
  if (!output) return null;

  return {
    outputFile,
    bytes: output.bytes || 0,
    entryPoint:
      output.entryPoint || inferEntryForOutput(metafile, outputFile) || "",
    isEntry: Boolean(output.entryPoint),
    includedInputs: Object.keys(output.inputs || {}),
  };
}

/**
 * Converts an array of output file names to InitialChunkSummary objects.
 *
 * This function takes a list of output files and creates InitialChunkSummary
 * objects for each one, sorting them by size (largest first).
 *
 * @param outputFiles – Array of output file paths
 * @param metafile – The metafile containing output data
 * @returns Array of InitialChunkSummary objects, sorted by size
 */
export function createChunkSummaries(
  outputFiles: string[],
  metafile: Metafile
): InitialChunkSummary[] {
  return outputFiles
    .map((outputFile) => {
      const output = metafile.outputs[outputFile];
      return createInitialChunkSummary(outputFile, output, metafile);
    })
    .filter((chunk): chunk is InitialChunkSummary => Boolean(chunk))
    .sort((a, b) => b.bytes - a.bytes); // Sort by size (largest first)
}

/**
 * Determines if an entry point is included in a chunk's inputs.
 *
 * This is a common check used throughout the app to determine if a chunk's
 * entry point is actually bundled within that chunk.
 *
 * @param chunk – The chunk to check
 * @returns true if the entry point is included in the chunk's inputs
 */
export function isEntryPointInChunk(chunk: InitialChunkSummary): boolean {
  return Boolean(
    chunk.entryPoint && chunk.includedInputs.includes(chunk.entryPoint)
  );
}
