/**
 * Test Types for Esbuild Analyser
 *
 * This file contains TypeScript types specifically used for testing purposes.
 * These types help ensure type safety in test files and provide better
 * IntelliSense and error checking during development.
 */

/**
 * Mock chunk object used in tests to simulate InitialChunkSummary without all required fields
 *
 * This is used in test scenarios where we need to create chunk-like objects
 * but don't want to provide all the required fields of InitialChunkSummary.
 */
export interface MockChunk {
  /** The output file path for this chunk */
  outputFile?: string;
  /** Size of the chunk in bytes */
  bytes?: number;
  /** Entry point file path (if this chunk has one) */
  entryPoint?: string;
  /** Whether this chunk represents an entry point */
  isEntry?: boolean;
  /** Array of input files included in this chunk */
  includedInputs?: string[];
}

/**
 * Mock metafile structure for testing purposes
 *
 * Simplified version of the esbuild metafile format used in tests.
 * Contains the essential structure needed for testing metafile processing logic.
 */
export interface MockMetafile {
  /** Input files and their metadata */
  inputs: Record<
    string,
    {
      /** Size of the input file in bytes */
      bytes?: number;
      /** Import dependencies of this input */
      imports?: Array<{
        /** Path to the imported module */
        path: string;
        /** Type of import (import-statement, dynamic-import, etc.) */
        kind: string;
        /** Whether this is an external import */
        external?: boolean;
        /** Original import path before bundling */
        original?: string;
      }>;
    }
  >;
  /** Output files and their metadata */
  outputs: Record<
    string,
    {
      /** Size of the output file in bytes */
      bytes?: number;
      /** Entry point that generated this output */
      entryPoint?: string;
      /** Files imported by this output */
      imports?: Array<{
        /** Path to the imported module */
        path: string;
        /** Type of import */
        kind: string;
        /** Whether this is an external import */
        external?: boolean;
      }>;
      /** Input files bundled into this output */
      inputs?: Record<
        string,
        {
          /** Bytes from this input in the output */
          bytesInOutput?: number;
        }
      >;
      /** Exported symbols from this output */
      exports?: string[];
    }
  >;
}

/**
 * Test helper for creating mock files in tests
 *
 * Utility type for functions that create File objects for testing
 * file upload and processing functionality.
 */
export interface MockFileCreator {
  /** Content of the file as a string */
  content: string;
  /** Optional filename for the mock file */
  filename?: string;
}

/**
 * Test chunk collection for comparing initial vs lazy chunks
 *
 * Used in tests that verify chunk type determination logic,
 * particularly the comparison between initial chunks and all chunks.
 */
export interface ChunkComparisonTestData {
  /** Chunks that should be classified as initial */
  initialChunks: MockChunk[];
  /** All chunks (initial + lazy) */
  allChunks: MockChunk[];
  /** Expected classification results */
  expectedResults: Array<{
    /** Output file path */
    outputFile: string;
    /** Expected load type (initial or lazy) */
    loadType: "initial" | "lazy";
  }>;
}

/**
 * Result of chunk type classification for testing
 *
 * Used in chunk comparison tests to verify that chunks are correctly
 * classified as initial or lazy based on their outputFile.
 */
export interface ChunkTypeResult {
  /** The output file path that was classified */
  outputFile: string;
  /** The determined load type (initial or lazy) */
  loadType: "initial" | "lazy";
}
