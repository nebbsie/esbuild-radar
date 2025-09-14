import type { InitialChunkSummary } from "@/lib/types";

/**
 * Determines the module to select when a chunk is activated.
 *
 * This function encapsulates the logic for deciding which module should be
 * selected when a chunk is clicked or opened in the UI. It prioritizes
 * the chunk's entry point if it's valid, otherwise returns null.
 *
 * @param chunk - The chunk being activated
 * @returns The module path to select, or null if no suitable module found
 */
export function getModuleForChunkActivation(
  chunk: InitialChunkSummary
): string | null {
  const entryPointInChunk = isEntryPointValidForChunk(chunk);
  return entryPointInChunk ? chunk.entryPoint : null;
}

/**
 * Checks if a chunk's entry point is valid for selection.
 *
 * An entry point is considered valid if it exists and is actually
 * included in the chunk's bundled inputs.
 *
 * @param chunk - The chunk to check
 * @returns true if the entry point is valid for selection
 */
export function isEntryPointValidForChunk(chunk: InitialChunkSummary): boolean {
  return Boolean(
    chunk.entryPoint && chunk.includedInputs.includes(chunk.entryPoint)
  );
}

/**
 * Determines the appropriate module selection when chunks change.
 *
 * This function handles the logic for what module should be selected
 * when the active chunk changes, considering single-chunk selections
 * and maintaining or updating module selection appropriately.
 *
 * @param chunks - All available chunks
 * @param previousSelectedModule - The previously selected module
 * @param previousSelectedChunk - The previously selected chunk
 * @returns Object containing the new module and chunk selection
 */
export function determineModuleSelectionForChunkChange(
  chunks: InitialChunkSummary[],
  previousSelectedModule: string | null,
  previousSelectedChunk: InitialChunkSummary | null
): {
  selectedModule: string | null;
  selectedChunk: InitialChunkSummary | null;
} {
  // If only one chunk remains after filtering, auto-select it
  if (chunks.length === 1 && chunks[0] !== previousSelectedChunk) {
    const chunk = chunks[0];
    const moduleToSelect = getModuleForChunkActivation(chunk);

    return {
      selectedModule: moduleToSelect,
      selectedChunk: chunk,
    };
  }

  return {
    selectedModule: previousSelectedModule,
    selectedChunk: previousSelectedChunk,
  };
}
