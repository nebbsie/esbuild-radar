import { inferEntryForOutput } from "@/lib/analyser";
import { findInclusionPath } from "@/lib/metafile";
import type {
  InclusionPathResult,
  InitialChunkSummary,
  Metafile,
} from "@/lib/types";

/**
 * Calculates the initial chunk entry point from the summary data.
 *
 * This function extracts the logic for determining the root entry point
 * used for inclusion path calculations.
 */
export function getInitialChunkEntryPoint(
  metafile: Metafile,
  initialSummary: {
    initial: { outputs: string[]; totalBytes: number };
    lazy: { outputs: string[]; totalBytes: number };
  } | null
): string | null {
  if (!initialSummary || !metafile) return null;

  const firstInitialOutput = initialSummary.initial.outputs[0];
  if (!firstInitialOutput) return null;

  const out = metafile.outputs[firstInitialOutput];
  return (
    out?.entryPoint || inferEntryForOutput(metafile, firstInitialOutput) || ""
  );
}

/**
 * Calculates the inclusion path for a module given its entry point.
 *
 * This function encapsulates the logic for determining how a module
 * is included in the bundle, starting from a given entry point.
 */
export function calculateInclusionPath(
  metafile: Metafile,
  modulePath: string,
  entryPoint: string
): InclusionPathResult {
  if (!metafile || !entryPoint) {
    return { found: false, path: [] };
  }

  return findInclusionPath(metafile, entryPoint, modulePath);
}

/**
 * Handles module selection logic, determining the appropriate chunk
 * and calculating the inclusion path.
 */
export function selectModule(
  modulePath: string,
  chunks: InitialChunkSummary[],
  metafile: Metafile | null,
  initialChunk: InitialChunkSummary | null,
  selectedChunk: InitialChunkSummary | null
): {
  selectedModule: string;
  selectedChunk: InitialChunkSummary | null;
  inclusion: InclusionPathResult | null;
} {
  // If a specific chunk was provided and it contains this module, use it
  if (selectedChunk && selectedChunk.includedInputs.includes(modulePath)) {
    // Use the provided chunk if it contains the module
    const newSelectedChunk = selectedChunk;

    // Calculate inclusion path
    const rootEntry = initialChunk?.entryPoint || newSelectedChunk?.entryPoint;

    const inclusion =
      metafile && rootEntry
        ? calculateInclusionPath(metafile, modulePath, rootEntry)
        : null;

    return {
      selectedModule: modulePath,
      selectedChunk: newSelectedChunk,
      inclusion,
    };
  }

  // Otherwise, find the chunk that contains this module
  const chunkContainingModule = chunks.find((chunk) =>
    chunk.includedInputs.includes(modulePath)
  );

  const chunkChanged =
    chunkContainingModule && chunkContainingModule !== selectedChunk;

  const newSelectedChunk = chunkChanged ? chunkContainingModule : selectedChunk;

  // Calculate inclusion path
  const rootEntry = initialChunk?.entryPoint || newSelectedChunk?.entryPoint;

  const inclusion =
    metafile && rootEntry
      ? calculateInclusionPath(metafile, modulePath, rootEntry)
      : null;

  return {
    selectedModule: modulePath,
    selectedChunk: newSelectedChunk || null,
    inclusion,
  };
}

/**
 * Determines what module should be selected when a chunk is opened/clicked.
 *
 * When opening a chunk in the UI, this function decides:
 * 1. Whether to select the chunk's entry point (if it exists and is included)
 * 2. Whether to select no module (null) but still calculate inclusion path
 * 3. Which module to use for calculating the inclusion path when no entry point
 *
 * @param chunk - The chunk being opened
 * @param metafile - The metafile containing file relationships
 * @param initialChunk - The initial chunk for fallback entry point calculation
 * @returns Object containing the selected module and inclusion path result
 */
export function determineModuleForChunkOpening(
  chunk: InitialChunkSummary,
  metafile: Metafile | null,
  initialChunk: InitialChunkSummary | null
): {
  selectedModule: string | null;
  inclusionPath: InclusionPathResult | null;
} {
  // Check if the chunk has an entry point that's actually included in its inputs
  const entryPointInChunk =
    chunk.entryPoint && chunk.includedInputs.includes(chunk.entryPoint);

  if (entryPointInChunk) {
    // Entry point is valid - select it and calculate its inclusion path
    const rootEntry = initialChunk?.entryPoint || chunk.entryPoint;
    const inclusion =
      metafile && rootEntry
        ? findInclusionPath(metafile, rootEntry, chunk.entryPoint)
        : null;

    return {
      selectedModule: chunk.entryPoint,
      inclusionPath: inclusion,
    };
  } else {
    // No valid entry point - select null but calculate inclusion path for first module
    const rootEntry = initialChunk?.entryPoint || chunk.entryPoint;
    let inclusion: InclusionPathResult | null = null;

    if (metafile && rootEntry && chunk.includedInputs.length > 0) {
      // Use the first module in the chunk for inclusion path calculation
      const firstModule = chunk.includedInputs[0];
      inclusion = findInclusionPath(metafile, rootEntry, firstModule);
    }

    return {
      selectedModule: null,
      inclusionPath: inclusion,
    };
  }
}

/**
 * Manages navigation history for module transitions.
 *
 * This utility tracks the history of module selections to enable
 * back/forward navigation.
 */
export class ModuleNavigationHistory {
  private history: string[] = [];
  private currentIndex = -1;

  /**
   * Adds a module to the navigation history.
   */
  push(modulePath: string): void {
    // Remove any forward history when adding a new entry
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Bail if the last entry is the same as the one we want to push
    if (this.history[this.history.length - 1] === modulePath) {
      this.currentIndex = this.history.length - 1;
      return;
    }

    this.history.push(modulePath);
    this.currentIndex = this.history.length - 1;
  }

  /**
   * Gets the previous module in history.
   */
  getPrevious(): string | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  /**
   * Gets the next module in history.
   */
  getNext(): string | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }

  /**
   * Checks if there's a previous entry in history.
   */
  hasPrevious(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Checks if there's a next entry in history.
   */
  hasNext(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Gets the current module.
   */
  getCurrent(): string | null {
    return this.currentIndex >= 0 ? this.history[this.currentIndex] : null;
  }

  /**
   * Gets the length of the navigation history.
   */
  getLength(): number {
    return this.history.length;
  }

  /**
   * Clears all navigation history.
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}
