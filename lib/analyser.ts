// Bundle analysis helpers used by the UI. Keep UI rendering out of this file.

import { estimateBrotliSize, estimateGzipSize } from "@/lib/format";
import type {
  ClassifiedChunks,
  ImportKind,
  InclusionPathResult,
  InclusionStep,
  InitialChunkSummary,
  Metafile,
  OutputLoadClassification,
} from "@/lib/types";

// Local type definitions for analyser-specific interfaces
export interface InclusionPathStep {
  file: string;
  importStatement: string;
  isDynamicImport: boolean;
  importerChunkType: "initial" | "lazy";
}

/**
 * Determines whether a given output filename represents a browser-runnable
 * JavaScript bundle produced by esbuild.
 *
 * The analyser intentionally ignores `.mjs` outputs because those are usually
 * consumed by Node / SSR, whereas we only care about artefacts that a browser
 * actually downloads ( `.js` and `.cjs` ).
 *
 * @param file – Output filename as it appears in the metafile (relative path).
 * @returns `true` if the file ends with `.js` or `.cjs` (case-insensitive) and
 *          therefore should be included in browser bundle calculations.
 */
export function isJsOutput(file: string): boolean {
  return /\.(?:js|cjs)(\?.*)?$/i.test(file);
}

/**
 * Best-effort check for server-only JavaScript bundles.
 *
 * Server artefacts are filtered out so that the UI does not confuse SSR chunks
 * with code that ships to the browser.  The heuristics follow common
 * conventions used by both React and Next.js ( e.g. `*.server.js` or `server/`
 * directories ).
 *
 * @param file – Output filename or path.
 * @returns `true` if the filename suggests the bundle is meant for the server.
 */
export function isLikelyServerOutput(file: string): boolean {
  const lower = file.toLowerCase();
  if (/(^|\/)server(\/?|$)/.test(lower)) return true;
  if (/\.server\./.test(lower)) return true;
  if (/server\.(mjs|js)(\?.*)?$/i.test(lower)) return true;
  return false;
}

/**
 * Walks reverse static-import edges from the specified output to find the
 * nearest ancestor output that has an entryPoint, and returns that entry input.
 */
export function inferEntryForOutput(
  meta: Metafile,
  targetOutput: string
): string | undefined {
  const parents: Record<string, string[]> = {};
  for (const [of, out] of Object.entries(meta.outputs)) {
    for (const imp of out.imports || []) {
      if (imp.external || imp.kind === "dynamic-import") continue;
      if (!meta.outputs[imp.path]) continue;
      (parents[imp.path] ||= []).push(of);
    }
  }
  const queue: string[] = [targetOutput];
  const seen = new Set(queue);
  while (queue.length) {
    const cur = queue.shift() as string;
    const out = meta.outputs[cur];
    if (out?.entryPoint) return out.entryPoint;
    for (const p of parents[cur] || [])
      if (!seen.has(p)) {
        seen.add(p);
        queue.push(p);
      }
  }
  return undefined;
}

/**
 * Returns all JS browser outputs as summary objects (initial + lazy, unsorted).
 */
export function computeAllOutputSummaries(
  meta: Metafile
): InitialChunkSummary[] {
  const all: InitialChunkSummary[] = [];
  for (const [file, out] of Object.entries(meta.outputs)) {
    if (!isJsOutput(file) || isLikelyServerOutput(file)) continue;
    const includedInputs = Object.keys(out.inputs || {});
    all.push({
      outputFile: file,
      bytes: out.bytes || 0,
      gzipBytes: estimateGzipSize(out.bytes || 0),
      brotliBytes: estimateBrotliSize(out.bytes || 0),
      entryPoint: out.entryPoint || inferEntryForOutput(meta, file) || "",
      isEntry: Boolean(out.entryPoint),
      includedInputs,
    });
  }
  return all;
}

/**
 * Computes the set of outputs that are statically reachable from entry outputs
 * by traversing only non-dynamic (static) import edges across outputs.
 */
export function computeInitialOutputsSet(meta: Metafile): Set<string> {
  const entryOutputs = Object.entries(meta.outputs)
    .filter(
      ([f, o]) => o.entryPoint && isJsOutput(f) && !isLikelyServerOutput(f)
    )
    .map(([f]) => f);
  const visited = new Set<string>(entryOutputs);
  const queue = [...entryOutputs];
  while (queue.length) {
    const cur = queue.shift() as string;
    const out = meta.outputs[cur];
    if (!out) continue;
    for (const imp of out.imports || []) {
      if (imp.external || imp.kind === "dynamic-import") continue;
      const next = imp.path;
      if (!meta.outputs[next]) continue;
      if (!isJsOutput(next) || isLikelyServerOutput(next)) continue;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/** Lists output files that dynamically import the target output. */
export function listDynamicImportingOutputs(
  meta: Metafile,
  targetOutput: string
): string[] {
  const importers: string[] = [];
  for (const [of, out] of Object.entries(meta.outputs)) {
    for (const imp of out.imports || []) {
      if (imp.kind === "dynamic-import" && imp.path === targetOutput)
        importers.push(of);
    }
  }
  return importers;
}

/**
 * Classifies an output as initial or lazy using computeInitialOutputsSet. Lazy if
 * not statically reachable from entries. Returns dynamic importers for context.
 */
export function classifyOutputLoadType(
  meta: Metafile,
  outputFile: string
): OutputLoadClassification {
  const initial = computeInitialOutputsSet(meta);
  if (!initial.has(outputFile)) {
    return {
      kind: "lazy",
      importers: listDynamicImportingOutputs(meta, outputFile),
    };
  }
  return { kind: "initial" };
}

/** Picks the most likely initial (entry) output using heuristics from test.ts */
export function pickInitialOutput(
  meta: Metafile,
  preferredEntry?: string
): string | undefined {
  const toPosix = (p: string) => p.replace(/\\/g, "/");
  const base = (p: string) => {
    const parts = toPosix(p).split("/");
    return parts[parts.length - 1] || p;
  };

  // Candidate entry outputs (browser JS only)
  const entries = Object.entries(meta.outputs)
    .filter(
      ([k, v]) => isJsOutput(k) && v.entryPoint && !isLikelyServerOutput(k)
    )
    .map(([k]) => k);
  if (entries.length === 0) return undefined;

  // Respect explicit preferred entry input if provided
  if (preferredEntry) {
    const exact = entries.find(
      (k) => meta.outputs[k].entryPoint === preferredEntry
    );
    if (exact) return exact;
  }

  // Build directed graph among candidate entry outputs via static imports
  const candidateSet = new Set(entries);
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const k of entries) {
    const imps = meta.outputs[k].imports || [];
    const edges = imps
      .filter(
        (i) =>
          !i.external && i.kind !== "dynamic-import" && candidateSet.has(i.path)
      )
      .map((i) => i.path);
    graph.set(k, edges);
    // Track incoming edges among candidate entries
    if (!inDegree.has(k)) inDegree.set(k, 0);
    for (const m of edges) {
      inDegree.set(m, (inDegree.get(m) ?? 0) + 1);
    }
  }

  // Prefer entries that are NOT imported by any other candidate entry (in-degree = 0)
  const rootEntries = entries.filter((k) => (inDegree.get(k) ?? 0) === 0);
  const rankingPool = rootEntries.length > 0 ? rootEntries : entries;

  const reachableCount = (start: string) => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length) {
      const n = stack.pop() as string;
      for (const m of graph.get(n) || []) {
        if (!seen.has(m)) {
          seen.add(m);
          stack.push(m);
        }
      }
    }
    return seen.size;
  };

  // Score candidates
  const scored = rankingPool.map((k) => {
    const ep = toPosix(meta.outputs[k].entryPoint!);
    const b = base(ep);
    let s = 0;
    if (/^main(\.|$)/.test(b)) s += 100;
    if (/polyfills/i.test(b)) s -= 80;
    if (/styles?/i.test(b)) s -= 80;
    if (/(spec|test)\./i.test(b)) s -= 50;
    s += reachableCount(k);
    return { k, s };
  });

  scored.sort((a, b) => b.s - a.s || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return scored[0]?.k;
}

/**
 * Traverses from the initial output to classify all reachable chunks as initial or lazy
 * based on how they are imported (entry-point = initial, import-statement = initial, dynamic-import = lazy).
 * Includes the initial chunk in the results.
 */
export function classifyChunksFromInitial(
  meta: Metafile,
  initialOutput: string
): ClassifiedChunks {
  const initialChunks: InitialChunkSummary[] = [];
  const lazy: InitialChunkSummary[] = [];
  const visited = new Set<string>();
  const queue: Array<{ output: string; importKind: string }> = [];

  // Create the initial chunk summary
  const initialOut = meta.outputs[initialOutput];
  if (!initialOut)
    return {
      initial: undefined as InitialChunkSummary | undefined,
      initialChunks,
      lazy,
    };

  // Mark initial as visited so it can never be enqueued again and avoids duplicates
  visited.add(initialOutput);

  const initialChunk: InitialChunkSummary = {
    outputFile: initialOutput,
    bytes: initialOut.bytes || 0,
    gzipBytes: estimateGzipSize(initialOut.bytes || 0),
    brotliBytes: estimateBrotliSize(initialOut.bytes || 0),
    entryPoint:
      initialOut.entryPoint || inferEntryForOutput(meta, initialOutput) || "",
    isEntry: Boolean(initialOut.entryPoint),
    includedInputs: Object.keys(initialOut.inputs || {}),
  };

  // Add direct imports to queue
  for (const imp of initialOut.imports || []) {
    if (imp.external) continue;
    if (!meta.outputs[imp.path]) continue;
    if (!isJsOutput(imp.path) || isLikelyServerOutput(imp.path)) continue;
    queue.push({ output: imp.path, importKind: imp.kind });
  }

  while (queue.length > 0) {
    const { output, importKind } = queue.shift()!;
    if (visited.has(output)) continue;
    visited.add(output);

    const out = meta.outputs[output];
    if (!out) continue;

    // Create chunk summary
    const chunk: InitialChunkSummary = {
      outputFile: output,
      bytes: out.bytes || 0,
      gzipBytes: estimateGzipSize(out.bytes || 0),
      brotliBytes: estimateBrotliSize(out.bytes || 0),
      entryPoint: out.entryPoint || inferEntryForOutput(meta, output) || "",
      isEntry: Boolean(out.entryPoint),
      includedInputs: Object.keys(out.inputs || {}),
    };

    // Skip if this output is the same as the initial chunk (extra guard)
    if (output !== initialOutput) {
      // Classify based on import kind
      if (importKind === "dynamic-import") {
        lazy.push(chunk);
      } else {
        initialChunks.push(chunk);
      }
    }

    // Add this chunk's imports to queue (preserve the import kind that reached it)
    for (const imp of out.imports || []) {
      if (imp.external) continue;
      if (!meta.outputs[imp.path]) continue;
      if (!isJsOutput(imp.path) || isLikelyServerOutput(imp.path)) continue;
      if (!visited.has(imp.path)) {
        // Use the actual kind of this import edge, **not** the parent edge kind
        queue.push({ output: imp.path, importKind: imp.kind });
      }
    }
  }

  // Sort by size (largest first)
  initialChunks.sort((a, b) => b.bytes - a.bytes);
  lazy.sort((a, b) => b.bytes - a.bytes);

  return { initial: initialChunk, initialChunks, lazy };
}

// Compute an inclusion path from entry input to target input using the inputs graph.
// Includes both static and dynamic imports.
function findInclusionPathIncludingDynamic(
  meta: Metafile,
  entryInput: string,
  targetInput: string
): InclusionPathResult {
  if (entryInput === targetInput) return { found: true, path: [] };

  const queue: string[] = [entryInput];
  const visited = new Set<string>([entryInput]);
  const parent: Record<string, { prev: string; kind: ImportKind } | undefined> =
    {};

  while (queue.length) {
    const current = queue.shift() as string;
    const node = meta.inputs[current];
    if (!node) continue;
    const edges = node.imports || [];
    for (const edge of edges) {
      // Include both static and dynamic imports
      const next = edge.path;
      if (!visited.has(next)) {
        visited.add(next);
        parent[next] = { prev: current, kind: edge.kind };
        if (next === targetInput) {
          // reconstruct
          const steps: InclusionStep[] = [];
          let cur = next;
          while (cur !== entryInput) {
            const p = parent[cur]!;
            steps.push({ from: p.prev, to: cur, kind: p.kind, file: cur });
            cur = p.prev;
          }
          steps.reverse();
          return { found: true, path: steps };
        }
        queue.push(next);
      }
    }
  }

  return { found: false, path: [] };
}

/**
 * Returns the inclusion path for a file from the appropriate entry point,
 * showing the actual import statements used in each step.
 * This follows both static and dynamic imports.
 * This is a convenience function that automatically determines the entry point.
 */
export interface InclusionPathStep {
  file: string;
  importStatement: string;
  isDynamicImport: boolean;
  importerChunkType: "initial" | "lazy";
}

export function getInclusionPath(
  meta: Metafile,
  targetFile: string,
  chunks: InitialChunkSummary[]
): InclusionPathStep[] {
  // Find the initial entry point
  const initialOutput = pickInitialOutput(meta);
  if (!initialOutput) {
    return [];
  }

  // Get the entry point for the initial output
  const initialOut = meta.outputs[initialOutput];
  const entryPoint =
    initialOut?.entryPoint || inferEntryForOutput(meta, initialOutput);

  if (!entryPoint) {
    return [];
  }

  // Determine which outputs are initial (contain the main entry point)
  const initialOutputs = chunks
    .filter((chunk) => chunk.isEntry && chunk.entryPoint === entryPoint)
    .map((chunk) => chunk.outputFile);

  // Find the inclusion path (following both static and dynamic imports)
  const result = findInclusionPathIncludingDynamic(
    meta,
    entryPoint,
    targetFile
  );
  if (!result.found) return [];

  // Convert the path to show actual import statements with import type info
  const inclusionSteps: InclusionPathStep[] = [];

  for (const step of result.path) {
    const input = meta.inputs[step.from];
    if (!input) continue;

    // Find the import that leads to the 'to' file
    const importEdge = input.imports?.find((imp) => imp.path === step.to);
    if (importEdge) {
      // Determine which chunk contains the importer
      const chunkContainingImporter = chunks.find((chunk) =>
        chunk.includedInputs.includes(step.from)
      );

      // Determine chunk type
      const importerChunkType =
        chunkContainingImporter &&
        initialOutputs.includes(chunkContainingImporter.outputFile)
          ? ("initial" as const)
          : ("lazy" as const);

      inclusionSteps.push({
        file: step.from,
        importStatement: importEdge.original || importEdge.path,
        isDynamicImport: importEdge.kind === "dynamic-import",
        importerChunkType,
      });
    }
  }

  return inclusionSteps;
}

/**
 * Returns information about where a file is imported from and the loading type of each importer.
 * This is useful for understanding the impact of a file on the bundle.
 */
export interface FileImportSource {
  importer: string; // The file that imports the target
  importStatement: string; // The import statement used (original or resolved path)
  chunkType: "initial" | "lazy"; // Whether the importer is initial or lazy loaded
  chunkOutputFile?: string; // Which chunk file contains the importer
  chunkSize?: number; // Size of the chunk containing the importer
  isDynamicImport: boolean; // Whether this is a dynamic import
}

export function getImportSources(
  meta: Metafile,
  targetFile: string,
  chunks: InitialChunkSummary[],
  initialOutputs: string[]
): FileImportSource[] {
  const sources: FileImportSource[] = [];

  // Build reverse dependencies by scanning all inputs
  for (const [inputPath, input] of Object.entries(meta.inputs)) {
    if (input.imports) {
      for (const imp of input.imports) {
        if (imp.path === targetFile) {
          // Find which chunk contains this importer
          const chunkContainingImporter = chunks.find((chunk) =>
            chunk.includedInputs.includes(inputPath)
          );

          // Determine chunk type by checking if chunk output is in initial outputs
          const chunkType =
            chunkContainingImporter &&
            initialOutputs.includes(chunkContainingImporter.outputFile)
              ? "initial"
              : "lazy";

          sources.push({
            importer: inputPath,
            importStatement: imp.original || imp.path,
            chunkType,
            chunkOutputFile: chunkContainingImporter?.outputFile,
            chunkSize: chunkContainingImporter?.bytes,
            isDynamicImport: imp.kind === "dynamic-import",
          });
        }
      }
    }
  }

  // Sort: initial imports first, then lazy imports
  return sources.sort((a, b) => {
    if (a.chunkType === "initial" && b.chunkType === "lazy") return -1;
    if (a.chunkType === "lazy" && b.chunkType === "initial") return 1;
    return 0; // same type, maintain original order
  });
}

/**
 * Returns chunks that were created by dynamic imports from the given file.
 * This helps understand what lazy modules a file generates.
 */
export interface DynamicCreatedChunk {
  chunk: InitialChunkSummary;
  dynamicImportPath: string;
  importStatement: string;
}

export function getChunksCreatedByFile(
  meta: Metafile,
  filePath: string,
  chunks: InitialChunkSummary[]
): DynamicCreatedChunk[] {
  const createdChunks: DynamicCreatedChunk[] = [];

  // Get the file's imports from the metafile
  const fileInputs = meta.inputs[filePath];
  if (!fileInputs?.imports) {
    return createdChunks;
  }

  // Find dynamic imports from this file
  const dynamicImports = fileInputs.imports.filter(
    (imp) => imp.kind === "dynamic-import"
  );

  for (const dynamicImport of dynamicImports) {
    // Clean up the import path
    const importPath = dynamicImport.path.replace(/^["']|["']$/g, "");
    // Get the original import statement (with import() wrapper if it's dynamic)
    const importStatement = dynamicImport.original || dynamicImport.path;

    // Find chunks that this dynamic import likely created
    const matchingChunks = chunks.filter((chunk) => {
      // Check if chunk entry point matches the import
      if (chunk.entryPoint.includes(importPath.replace("./", ""))) {
        return true;
      }

      // Check if chunk contains files from this import path
      return chunk.includedInputs.some((input) =>
        input.includes(importPath.replace("./", ""))
      );
    });

    // Add found chunks to results
    for (const chunk of matchingChunks) {
      createdChunks.push({
        chunk,
        dynamicImportPath: importPath,
        importStatement,
      });
    }
  }

  return createdChunks;
}
