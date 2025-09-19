// New high-level bundle analysis helper. Generates all data needed by the UI in
// one synchronous pass so that components can render without re-computing heavy
// logic on the client.

import { pickInitialOutput } from "@/lib/analyser";
import {
  createChunkSummaries,
  createInitialChunkSummary,
} from "@/lib/chunk-utils";
import { summarizeInitial } from "@/lib/initial-summary";
import type {
  InitialChunkSummary,
  Metafile,
  ProcessedMetafileData,
} from "@/lib/types";

export interface AnalysedStats {
  metafile: Metafile;
  /** Overall summary of what is loaded initially vs on-demand. */
  initialSummary: ProcessedMetafileData["initialSummary"];
  /** All browser-visible chunks sorted by size (largest first). */
  chunks: InitialChunkSummary[];
  /** Convenience subsets. */
  initialChunks: InitialChunkSummary[];
  lazyChunks: InitialChunkSummary[];
  /** The chunk that contains (or is) the application entry-point. */
  initialChunk: InitialChunkSummary | null;
}

/**
 * Pre-computes all information required by the UI from an esbuild metafile.
 *
 * Expensive graph traversals are executed once here so that React components
 * can consume plain JSON data and remain purely presentational.
 *
 * This keeps the browser fast and responsive — loading the bundle incurs a
 * one-off cost, after which interaction is instantaneous.
 */
export function analyseStats(meta: Metafile): AnalysedStats {
  // 1. Decide which output represents the main entry bundle.
  const pickedInitial = pickInitialOutput(meta);
  if (!pickedInitial) {
    throw new Error("Could not determine an initial output bundle");
  }

  // 2. Classify every output as either initial or lazy (tested algorithm).
  const initialSummary = summarizeInitial(meta, pickedInitial);

  // 3. Convert the summary output file lists to typed chunk objects.
  const initialChunks = createChunkSummaries(
    initialSummary.initial.outputs,
    meta,
  );
  const lazyChunks = createChunkSummaries(initialSummary.lazy.outputs, meta);

  const chunks = [...initialChunks, ...lazyChunks].sort(
    (a, b) => b.bytes - a.bytes,
  );

  // 4. Work out the InitialChunkSummary for the bundle that bootstraps the app.
  const initialChunk: InitialChunkSummary | null =
    (() => {
      const entryPoint = initialSummary.initial.outputs.find(
        (o) => meta.outputs[o]?.entryPoint,
      );
      if (!entryPoint) return null;
      const summary = chunks.find((c) => c.outputFile === entryPoint);
      if (summary) return summary;
      // Fallback — create on the fly (should not normally happen).
      return createInitialChunkSummary(
        entryPoint,
        meta.outputs[entryPoint],
        meta,
      );
    })() || null;

  return {
    metafile: meta,
    initialSummary,
    chunks,
    initialChunks,
    lazyChunks,
    initialChunk,
  };
}





