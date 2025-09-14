/**
 * Application Types for Esbuild Analyser
 *
 * This file contains all TypeScript type definitions used throughout the application.
 * These types provide type safety and better IntelliSense across the codebase.
 */

// =====================================
// Esbuild Metafile Types
// =====================================

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
  original?: string;
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

export interface InitialChunkSummary {
  outputFile: string;
  bytes: number;
  gzipBytes: number;
  brotliBytes: number;
  entryPoint: string;
  isEntry: boolean;
  includedInputs: string[];
}

export interface InclusionPathStep {
  from: string;
  to: string;
  kind: ImportKind;
}

export interface InclusionPathResult {
  found: boolean;
  path: InclusionStep[]; // entry -> ... -> target
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

export interface ReverseDependency {
  importer: string;
  kind: ImportKind;
  external?: boolean;
  original?: string;
}

// =====================================
// Analysis Types
// =====================================

export type LoadClassification = {
  initial: { outputs: string[]; totalBytes: number };
  lazy: { outputs: string[]; totalBytes: number };
};

export type OutputLoadClassification = {
  kind: "initial" | "lazy";
  importers?: string[];
};

export interface ClassifiedChunks {
  initial: InitialChunkSummary | undefined;
  initialChunks: InitialChunkSummary[];
  lazy: InitialChunkSummary[];
}

export interface InclusionStep {
  from: string;
  to: string;
  kind: ImportKind;
  file: string;
}

export interface InclusionPathStep {
  file: string;
  importStatement: string;
  isDynamicImport: boolean;
  importerChunkType: "initial" | "lazy";
}

export interface ImportSource {
  importer: string;
  kind: ImportKind;
  external?: boolean;
  original?: string;
  chunks: InitialChunkSummary[];
}

export interface FileImportSource {
  importer: string; // The file that imports the target
  importStatement: string; // The import statement used (original or resolved path)
  chunkType: "initial" | "lazy"; // Whether the importer is initial or lazy loaded
  chunkOutputFile?: string; // Which chunk file contains the importer
  chunkSize?: number; // Size of the chunk containing the importer
  isDynamicImport: boolean; // Whether this is a dynamic import
}

export interface CreatedChunk {
  outputFile: string;
  entryPoint: string;
  bytes: number;
  gzipBytes: number;
  brotliBytes: number;
  includedInputs: string[];
}

export interface DynamicCreatedChunk {
  chunk: InitialChunkSummary;
  dynamicImportPath: string;
  importStatement: string;
}

// =====================================
// Utility Types
// =====================================

export interface SearchNavigationState {
  searchTerm: string;
  results: InitialChunkSummary[];
  currentIndex: number;
}

export interface SearchResultNavigationState {
  searchTerm: string;
  currentChunkIndex: number;
  currentResultIndex: number;
  matchingChunks: InitialChunkSummary[];
}

export type PathTreeNode = {
  name: string;
  path: string;
  size: number;
  type: "dir" | "file";
  children?: PathTreeNode[];
};

/**
 * Processed metafile data returned by file processing utilities
 *
 * Contains all the processed information from an uploaded esbuild metafile,
 * including parsed chunks, summaries, and selection state.
 */
export interface ProcessedMetafileData {
  /** The parsed metafile object */
  metafile: Metafile;
  /** Summary of initial and lazy chunks */
  initialSummary: {
    initial: { outputs: string[]; totalBytes: number };
    lazy: { outputs: string[]; totalBytes: number };
  };
  /** Array of all chunk summaries, sorted by size */
  chunks: InitialChunkSummary[];
  /** The currently selected chunk */
  selectedChunk: InitialChunkSummary | null;
  /** The currently selected module path */
  selectedModule: string | null;
}

/**
 * Storage data structure for persisted metafiles
 *
 * Used by the storage utility to save and load metafile data
 * with associated metadata.
 */
export interface MetafileData {
  /** The metafile data as a JSON string */
  data: string;
  /** Optional filename associated with the data */
  name?: string;
}
