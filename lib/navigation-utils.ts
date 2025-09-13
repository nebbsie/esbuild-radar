import { inferEntryForOutput } from "@/lib/analyser";
import type {
  InclusionPathResult,
  InitialChunkSummary,
  Metafile,
} from "@/lib/metafile";
import { findInclusionPath } from "@/lib/metafile";

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
  // Find the chunk that contains this module
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
   * Clears all navigation history.
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}
