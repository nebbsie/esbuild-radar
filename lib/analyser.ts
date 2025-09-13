// Bundle analysis helpers used by the UI. Keep UI rendering out of this file.

import type { EagerChunkSummary, Metafile } from "@/lib/metafile";

/** Returns true for JavaScript outputs we care about for initial/lazy download. */
export function isJsOutput(file: string): boolean {
  return /\.(mjs|cjs|js)(\?.*)?$/i.test(file);
}

/** Heuristic to exclude server-only artifacts from the browser analysis. */
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
 * Returns all JS browser outputs as summary objects (eager + lazy, unsorted).
 */
export function computeAllOutputSummaries(meta: Metafile): EagerChunkSummary[] {
  const all: EagerChunkSummary[] = [];
  for (const [file, out] of Object.entries(meta.outputs)) {
    if (!isJsOutput(file) || isLikelyServerOutput(file)) continue;
    const includedInputs = Object.keys(out.inputs || {});
    all.push({
      outputFile: file,
      bytes: out.bytes || 0,
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
export function computeEagerOutputsSet(meta: Metafile): Set<string> {
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

export type LoadClassification = {
  kind: "eager" | "lazy";
  importers?: string[];
};

/**
 * Classifies an output as eager or lazy using computeEagerOutputsSet. Lazy if
 * not statically reachable from entries. Returns dynamic importers for context.
 */
export function classifyOutputLoadType(
  meta: Metafile,
  outputFile: string
): LoadClassification {
  const eager = computeEagerOutputsSet(meta);
  if (!eager.has(outputFile)) {
    return {
      kind: "lazy",
      importers: listDynamicImportingOutputs(meta, outputFile),
    };
  }
  return { kind: "eager" };
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
  for (const k of entries) {
    const imps = meta.outputs[k].imports || [];
    const edges = imps
      .filter(
        (i) =>
          !i.external && i.kind !== "dynamic-import" && candidateSet.has(i.path)
      )
      .map((i) => i.path);
    graph.set(k, edges);
  }

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
  const scored = entries.map((k) => {
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

export interface ClassifiedChunks {
  initial: EagerChunkSummary | undefined;
  eager: EagerChunkSummary[];
  lazy: EagerChunkSummary[];
}

/**
 * Traverses from the initial output to classify all reachable chunks as initial, eager, or lazy
 * based on how they are imported (entry-point = initial, import-statement = eager, dynamic-import = lazy).
 * Includes the initial chunk in the results.
 */
export function classifyChunksFromInitial(
  meta: Metafile,
  initialOutput: string
): ClassifiedChunks {
  const eager: EagerChunkSummary[] = [];
  const lazy: EagerChunkSummary[] = [];
  const visited = new Set<string>();
  const queue: Array<{ output: string; importKind: string }> = [];

  // Create the initial chunk summary
  const initialOut = meta.outputs[initialOutput];
  if (!initialOut)
    return { initial: undefined as EagerChunkSummary | undefined, eager, lazy };

  const initialChunk: EagerChunkSummary = {
    outputFile: initialOutput,
    bytes: initialOut.bytes || 0,
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
    const chunk: EagerChunkSummary = {
      outputFile: output,
      bytes: out.bytes || 0,
      entryPoint: out.entryPoint || inferEntryForOutput(meta, output) || "",
      isEntry: Boolean(out.entryPoint),
      includedInputs: Object.keys(out.inputs || {}),
    };

    // Classify based on import kind
    if (importKind === "dynamic-import") {
      lazy.push(chunk);
    } else {
      eager.push(chunk);
    }

    // Add this chunk's imports to queue (preserve the import kind that reached it)
    for (const imp of out.imports || []) {
      if (imp.external) continue;
      if (!meta.outputs[imp.path]) continue;
      if (!isJsOutput(imp.path) || isLikelyServerOutput(imp.path)) continue;
      if (!visited.has(imp.path)) {
        // Use the same import kind that reached this chunk
        queue.push({ output: imp.path, importKind });
      }
    }
  }

  // Sort by size (largest first)
  eager.sort((a, b) => b.bytes - a.bytes);
  lazy.sort((a, b) => b.bytes - a.bytes);

  return { initial: initialChunk, eager, lazy };
}
