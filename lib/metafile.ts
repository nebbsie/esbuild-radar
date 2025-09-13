export type ImportKind =
  | "import-statement"
  | "dynamic-import"
  | "require-call"
  | "require-resolve"
  | "entry-point"
  | "internal"
  | string;

export interface MetafileInputImportEdge {
  path: string;
  kind: ImportKind;
  external?: boolean;
}

export interface MetafileInput {
  bytes?: number;
  imports?: MetafileInputImportEdge[];
  format?: string;
  loader?: string;
}

export interface MetafileOutputImportEdge {
  path: string;
  kind: ImportKind;
  external?: boolean;
}

export interface MetafileOutput {
  bytes: number;
  entryPoint?: string;
  imports?: MetafileOutputImportEdge[];
  inputs?: Record<string, { bytes?: number; bytesInOutput?: number }>;
  exports?: string[];
  cssBundle?: string;
  type?: string;
}

export interface Metafile {
  inputs: Record<string, MetafileInput>;
  outputs: Record<string, MetafileOutput>;
}

export interface EagerChunkSummary {
  outputFile: string;
  bytes: number;
  entryPoint: string;
  isEntry: boolean;
  includedInputs: string[];
}

export function parseMetafile(json: unknown): Metafile {
  if (
    !json ||
    typeof json !== "object" ||
    !("outputs" in json) ||
    !("inputs" in json)
  ) {
    throw new Error("Invalid esbuild metafile JSON");
  }
  return json as Metafile;
}

function isJsOutput(file: string): boolean {
  return /\.(mjs|cjs|js)(\?.*)?$/i.test(file);
}

function isLikelyServerFile(file: string): boolean {
  const lower = file.toLowerCase();
  if (/(^|\/)server(\/|$)/.test(lower)) return true;
  if (/\.server\./.test(lower)) return true;
  if (/server\.(mjs|js)(\?.*)?$/i.test(lower)) return true;
  return false;
}

export function getEntryOutputs(meta: Metafile): string[] {
  const entries: string[] = [];
  for (const [outputFile, output] of Object.entries(meta.outputs)) {
    if (output.entryPoint && isJsOutput(outputFile)) {
      entries.push(outputFile);
    }
  }
  return entries;
}

export function getEntryInputs(meta: Metafile): string[] {
  const inputs = new Set<string>();
  for (const out of Object.values(meta.outputs)) {
    if (out.entryPoint) inputs.add(out.entryPoint);
  }
  return Array.from(inputs);
}

// Compute all outputs downloaded initially: the closure from entry outputs following non-dynamic imports between outputs.
export function getInitialEagerOutputs(meta: Metafile): EagerChunkSummary[] {
  const entryOutputs = getEntryOutputs(meta);
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const e of entryOutputs) {
    if (!visited.has(e)) {
      visited.add(e);
      queue.push(e);
    }
  }

  while (queue.length) {
    const cur = queue.shift() as string;
    const out = meta.outputs[cur];
    if (!out) continue;
    const deps = out.imports || [];
    for (const d of deps) {
      if (d.external) continue;
      if (d.kind === "dynamic-import") continue; // lazy; exclude
      const next = d.path;
      if (!meta.outputs[next]) continue; // might be an input path or css; skip if no output
      if (isLikelyServerFile(next)) continue; // skip server bundles for browser initial set
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  const summaries: EagerChunkSummary[] = [];
  for (const outputFile of visited) {
    // Only show JS files for "code downloaded"
    if (!isJsOutput(outputFile)) continue;
    if (isLikelyServerFile(outputFile)) continue;
    const output = meta.outputs[outputFile];
    const includedInputs = Object.keys(output.inputs || {});
    summaries.push({
      outputFile,
      bytes: output.bytes || 0,
      entryPoint:
        output.entryPoint || inferRootEntryFor(meta, outputFile) || "",
      isEntry: Boolean(output.entryPoint),
      includedInputs,
    });
  }
  summaries.sort((a, b) => b.bytes - a.bytes);
  return summaries;
}

export function getInitialEagerOutputsForEntry(
  meta: Metafile,
  entryInput: string,
  options?: { browserOnly?: boolean }
): EagerChunkSummary[] {
  const browserOnly = options?.browserOnly !== false;
  const startOutputs = Object.entries(meta.outputs)
    .filter(([file, out]) => out.entryPoint === entryInput && isJsOutput(file))
    .map(([file]) => file);
  const visited = new Set<string>(startOutputs);
  const queue = [...startOutputs];
  while (queue.length) {
    const cur = queue.shift() as string;
    const out = meta.outputs[cur];
    if (!out) continue;
    for (const imp of out.imports || []) {
      if (imp.external || imp.kind === "dynamic-import") continue;
      const next = imp.path;
      if (!meta.outputs[next]) continue;
      if (!isJsOutput(next)) continue;
      if (browserOnly && isLikelyServerFile(next)) continue;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  const summaries: EagerChunkSummary[] = [];
  for (const outputFile of visited) {
    if (!isJsOutput(outputFile)) continue;
    if (browserOnly && isLikelyServerFile(outputFile)) continue;
    const output = meta.outputs[outputFile];
    const includedInputs = Object.keys(output.inputs || {});
    summaries.push({
      outputFile,
      bytes: output.bytes || 0,
      entryPoint: entryInput,
      isEntry: Boolean(output.entryPoint),
      includedInputs,
    });
  }
  summaries.sort((a, b) => b.bytes - a.bytes);
  return summaries;
}

function inferRootEntryFor(
  meta: Metafile,
  targetOutput: string
): string | undefined {
  // Walk backwards from targetOutput to find a nearest ancestor with entryPoint.
  // Build reverse edges on demand.
  const parents: Record<string, string[]> = {};
  for (const [of, out] of Object.entries(meta.outputs)) {
    for (const imp of out.imports || []) {
      if (imp.external || imp.kind === "dynamic-import") continue;
      if (!meta.outputs[imp.path]) continue;
      if (!parents[imp.path]) parents[imp.path] = [];
      parents[imp.path].push(of);
    }
  }
  const queue = [targetOutput];
  const seen = new Set<string>(queue);
  while (queue.length) {
    const cur = queue.shift() as string;
    const out = meta.outputs[cur];
    if (out?.entryPoint) return out.entryPoint;
    for (const p of parents[cur] || []) {
      if (!seen.has(p)) {
        seen.add(p);
        queue.push(p);
      }
    }
  }
  return undefined;
}

export interface InclusionPathStep {
  from: string;
  to: string;
  kind: ImportKind;
}

export interface InclusionPathResult {
  found: boolean;
  path: InclusionPathStep[]; // entry -> ... -> target
}

// Compute an inclusion path from entry input to target input using the inputs graph.
// Excludes dynamic-import edges for eager reasoning.
export function findInclusionPath(
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
      if (edge.kind === "dynamic-import") continue; // exclude lazy edges
      const next = edge.path;
      if (!visited.has(next)) {
        visited.add(next);
        parent[next] = { prev: current, kind: edge.kind };
        if (next === targetInput) {
          // reconstruct
          const steps: InclusionPathStep[] = [];
          let cur = next;
          while (cur !== entryInput) {
            const p = parent[cur]!;
            steps.push({ from: p.prev, to: cur, kind: p.kind });
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

export interface OutputPathStep {
  from: string; // output file
  to: string; // output file
  kind: ImportKind;
}

export interface OutputInclusionPathResult {
  found: boolean;
  path: OutputPathStep[]; // entry output -> ... -> target output
}

export function findOutputInclusionPath(
  meta: Metafile,
  entryOutputFile: string,
  targetOutputFile: string
): OutputInclusionPathResult {
  if (entryOutputFile === targetOutputFile) return { found: true, path: [] };
  const queue: string[] = [entryOutputFile];
  const visited = new Set<string>([entryOutputFile]);
  const parent: Record<string, { prev: string; kind: ImportKind } | undefined> =
    {};
  while (queue.length) {
    const cur = queue.shift() as string;
    const out = meta.outputs[cur];
    if (!out) continue;
    for (const imp of out.imports || []) {
      if (imp.external || imp.kind === "dynamic-import") continue;
      const next = imp.path;
      if (!meta.outputs[next]) continue;
      if (!visited.has(next)) {
        visited.add(next);
        parent[next] = { prev: cur, kind: imp.kind };
        if (next === targetOutputFile) {
          const steps: OutputPathStep[] = [];
          let curNode = next;
          while (curNode !== entryOutputFile) {
            const p = parent[curNode]!;
            steps.push({ from: p.prev, to: curNode, kind: p.kind });
            curNode = p.prev;
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

export interface ReverseDependency {
  importer: string;
  kind: ImportKind;
  external?: boolean;
}

export function findReverseDependencies(
  meta: Metafile,
  targetInput: string
): ReverseDependency[] {
  const dependencies: ReverseDependency[] = [];

  for (const [inputPath, input] of Object.entries(meta.inputs)) {
    if (input.imports) {
      for (const imp of input.imports) {
        if (imp.path === targetInput) {
          dependencies.push({
            importer: inputPath,
            kind: imp.kind,
            external: imp.external,
          });
        }
      }
    }
  }

  return dependencies;
}

export function getModuleDetails(
  meta: Metafile,
  inputPath: string
): {
  bytes?: number;
  format?: string;
  loader?: string;
  importsCount: number;
} | null {
  const input = meta.inputs[inputPath];
  if (!input) return null;

  return {
    bytes: input.bytes,
    format: input.format,
    loader: input.loader,
    importsCount: input.imports?.length || 0,
  };
}

export function getModuleImports(
  meta: Metafile,
  inputPath: string
): string[] | null {
  const input = meta.inputs[inputPath];
  if (!input || !input.imports) return null;

  return input.imports.map((imp) => imp.path);
}
