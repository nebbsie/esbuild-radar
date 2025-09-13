import {
  isJsOutput,
  isLikelyServerOutput,
  pickInitialOutput,
} from "@/lib/analyser";
import type { Metafile } from "@/lib/metafile";

// Local re-implementation of classifyInitial from CLI to ensure identical behaviour
function classifyInitial(meta: Metafile, initial: string) {
  function isRelevant(k: string) {
    // Only include CSS and browser JS outputs (exclude .mjs, server code, etc.)
    return (
      (/\.css$/i.test(k) || isJsOutput(k)) &&
      !k.endsWith(".map") &&
      !isLikelyServerOutput(k)
    );
  }
  const keys = Object.keys(meta.outputs).filter(isRelevant);
  const set = new Set(keys);
  const initialSet = new Set<string>();
  const lazy = new Set<string>();
  const visited = new Set<string>();

  const markInitial = (f: string) => set.has(f) && initialSet.add(f);
  const markLazy = (f: string) => set.has(f) && lazy.add(f);

  const walk = (file: string, mode: "initial" | "lazy") => {
    const key = `${file}:${mode}`;
    if (visited.has(key)) return;
    visited.add(key);

    const out = meta.outputs[file];
    if (!out) return;

    for (const imp of out.imports || []) {
      if (imp.external) continue;
      const t = imp.path;
      if (!set.has(t)) continue;

      if (mode === "initial") {
        if (imp.kind === "dynamic-import") {
          markLazy(t);
          walk(t, "lazy");
        } else if (
          imp.kind === "import-statement" ||
          imp.kind === "require-call"
        ) {
          markInitial(t);
          walk(t, "initial");
        }
      } else {
        // once lazy, all descendants lazy
        markLazy(t);
        walk(t, "lazy");
      }
    }
  };

  markInitial(initial);
  walk(initial, "initial");

  // remove overlapping
  for (const f of lazy) if (initialSet.has(f)) lazy.delete(f);

  return { initial: [...initialSet], lazy: [...lazy] };
}

/**
 * High-level summary utilised by the UI to split the bundle into *initial* and
 * *lazy* code paths.
 *
 * 1. Picks a representative entry-chunk using `pickInitialOutput` (optionally
 *    respecting a user-supplied hint).
 * 2. Traverses its dependency graph (static imports only) to gather every
 *    output the browser must download on first paint.
 * 3. Separately collects outputs that are referenced **solely** by
 *    dynamic-import edges.
 * 4. Calculates the raw byte size totals for each bucket.
 *
 * The result drives the headline figures in both the CLI and web UI.
 */
export function summarizeInitial(meta: Metafile, preferredInitial?: string) {
  const initialOutput = pickInitialOutput(meta, preferredInitial);
  if (!initialOutput) {
    throw new Error("Could not determine initial output");
  }
  const { initial, lazy } = classifyInitial(meta, initialOutput);

  // Calculate initial chunks (including the main entry point)
  const initialOutputs = new Set<string>([initialOutput, ...initial]);
  let initialTotalBytes = 0;
  for (const f of initialOutputs) {
    initialTotalBytes += meta.outputs[f]?.bytes ?? 0;
  }

  // Calculate lazy chunks
  let lazyTotalBytes = 0;
  for (const f of lazy) {
    lazyTotalBytes += meta.outputs[f]?.bytes ?? 0;
  }

  return {
    initial: {
      outputs: Array.from(initialOutputs),
      totalBytes: initialTotalBytes,
    },
    lazy: {
      outputs: lazy,
      totalBytes: lazyTotalBytes,
    },
  };
}
