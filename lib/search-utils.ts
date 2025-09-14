import type {
  InitialChunkSummary,
  SearchResultNavigationState,
} from "@/lib/types";

/**
 * Finds chunks that contain files matching the search term.
 *
 * This function filters chunks based on whether any of their included
 * files contain the search term (case-insensitive).
 */
export function findChunksWithSearchTerm(
  chunks: InitialChunkSummary[],
  searchTerm: string
): InitialChunkSummary[] {
  if (!searchTerm) return [];

  return chunks.filter((chunk) =>
    chunk.includedInputs.some((input) =>
      input.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
}

/**
 * Finds the index of a specific chunk within an array of matching chunks.
 */
export function findChunkIndex(
  chunk: InitialChunkSummary,
  matchingChunks: InitialChunkSummary[]
): number {
  return matchingChunks.findIndex((c) => c === chunk);
}

/**
 * Calculates the next search result index within a chunk.
 *
 * When navigating search results within a chunk, this function determines
 * the next highlighted element to focus on.
 */
export function getNextSearchResultIndex(
  currentIndex: number,
  totalResults: number,
  direction: "next" | "prev"
): number {
  if (totalResults === 0) return -1;

  if (direction === "next") {
    return (currentIndex + 1) % totalResults;
  } else {
    const newIndex = currentIndex - 1;
    return newIndex < 0 ? totalResults - 1 : newIndex;
  }
}

/**
 * Determines if navigation should move to the next/previous chunk.
 *
 * This function implements the logic for when to switch chunks during
 * search result navigation:
 * - For "next": move to next chunk when we've cycled through all results
 * - For "prev": move to previous chunk when going before first result
 */
export function shouldSwitchChunk(
  direction: "next" | "prev",
  currentResultIndex: number,
  totalResults: number,
  currentChunkIndex: number,
  totalChunks: number
): { shouldSwitch: boolean; targetChunkIndex: number } {
  if (direction === "next") {
    // Move to next chunk if we've cycled through all results in current chunk
    const shouldSwitch = currentResultIndex === 0 && totalResults > 0;
    const targetChunkIndex = shouldSwitch
      ? (currentChunkIndex + 1) % totalChunks
      : currentChunkIndex;

    return { shouldSwitch, targetChunkIndex };
  } else {
    // Move to previous chunk if going before first result
    const shouldSwitch = currentResultIndex < 0;
    let targetChunkIndex = currentChunkIndex;

    if (shouldSwitch) {
      targetChunkIndex = currentChunkIndex - 1;
      if (targetChunkIndex < 0) {
        targetChunkIndex = totalChunks - 1;
      }
    }

    return { shouldSwitch, targetChunkIndex };
  }
}

/**
 * Navigation state for search results.
 */

/**
 * Calculates the navigation state for moving to the next search result.
 */
export function calculateNextSearchResult(
  currentState: SearchResultNavigationState,
  direction: "next" | "prev",
  totalResultsInCurrentChunk: number
): {
  targetChunkIndex: number;
  targetResultIndex: number;
  shouldSwitchChunk: boolean;
} {
  const { currentChunkIndex, currentResultIndex, matchingChunks } =
    currentState;

  const nextResultIndex = getNextSearchResultIndex(
    currentResultIndex,
    totalResultsInCurrentChunk,
    direction
  );

  const { shouldSwitch, targetChunkIndex } = shouldSwitchChunk(
    direction,
    nextResultIndex,
    totalResultsInCurrentChunk,
    currentChunkIndex,
    matchingChunks.length
  );

  return {
    targetChunkIndex,
    targetResultIndex: shouldSwitch ? 0 : nextResultIndex,
    shouldSwitchChunk: shouldSwitch,
  };
}

/**
 * Determines if a chunk's entry point should be selected when navigating to it.
 *
 * This function checks whether the chunk's entry point is actually included
 * in the chunk's inputs, which is a requirement for safe navigation.
 */
export function shouldSelectChunkEntryPoint(
  chunk: InitialChunkSummary
): boolean {
  return Boolean(
    chunk.entryPoint && chunk.includedInputs.includes(chunk.entryPoint)
  );
}
