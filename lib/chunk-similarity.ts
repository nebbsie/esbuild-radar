/**
 * Chunk Similarity and Matching Utilities
 *
 * This module provides algorithms to compare and match chunks between different builds
 * based on their content, size, and structure rather than just their names.
 */

import type { InitialChunkSummary } from "./types";

export interface ChunkMatch {
  leftChunk: InitialChunkSummary;
  rightChunk: InitialChunkSummary;
  similarityScore: number;
  matchType: "good" | "weak";
}

export interface ChunkComparison {
  matchedChunks: ChunkMatch[];
  unmatchedLeft: InitialChunkSummary[];
  unmatchedRight: InitialChunkSummary[];
  totalSimilarityScore: number;
}

/**
 * Calculate similarity between two chunks based on multiple factors
 * New weights: Size 25, Entry 20, Classification 20, Content 25, Filename 10
 */
export function calculateChunkSimilarity(
  chunk1: InitialChunkSummary,
  chunk2: InitialChunkSummary
): number {
  // Factor 1: Size similarity (0-25 points)
  const sizeSimilarity = calculateSizeSimilarity(chunk1.bytes, chunk2.bytes);

  // Factor 2: Entry point similarity (0-20 points)
  const entryPointSimilarity = calculateEntryPointSimilarity(
    chunk1.entryPoint,
    chunk2.entryPoint
  );

  // Factor 3: Classification similarity (0-20 points)
  const classificationSimilarity = calculateClassificationSimilarity(
    chunk1,
    chunk2
  );

  // Factor 4: Content overlap (0-25 points)
  const contentSimilarity = calculateContentSimilarity(
    chunk1.includedInputs,
    chunk2.includedInputs
  );

  // Factor 5: Filename similarity (0-10 points)
  const filenameSimilarity = calculateFilenameSimilarity(
    chunk1.outputFile,
    chunk2.outputFile
  );

  return (
    sizeSimilarity +
    entryPointSimilarity +
    classificationSimilarity +
    contentSimilarity +
    filenameSimilarity
  );
}

/**
 * Calculate size similarity score (0-25 points)
 */
function calculateSizeSimilarity(size1: number, size2: number): number {
  if (size1 === 0 && size2 === 0) return 25;
  if (size1 === 0 || size2 === 0) return 0;

  const ratio = Math.min(size1, size2) / Math.max(size1, size2);
  return Math.round(ratio * 25);
}

/**
 * Calculate content similarity based on file overlap (0-25 points)
 */
function calculateContentSimilarity(
  files1: string[],
  files2: string[]
): number {
  if (files1.length === 0 && files2.length === 0) return 25;
  if (files1.length === 0 || files2.length === 0) return 0;

  const set1 = new Set(files1);
  const set2 = new Set(files2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  const jaccardSimilarity = intersection.size / union.size;
  return Math.round(jaccardSimilarity * 25);
}

/**
 * Calculate entry point similarity (0-20 points)
 */
function calculateEntryPointSimilarity(entry1: string, entry2: string): number {
  if (!entry1 && !entry2) return 20;
  if (!entry1 || !entry2) return 0;

  if (entry1 === entry2) return 20;

  // Check if they're similar paths (same file, different location)
  const path1Parts = entry1.split("/");
  const path2Parts = entry2.split("/");
  const fileName1 = path1Parts[path1Parts.length - 1];
  const fileName2 = path2Parts[path2Parts.length - 1];

  if (fileName1 === fileName2) return 15;

  // Check for partial similarity
  const commonParts = path1Parts.filter((part) => path2Parts.includes(part));
  if (commonParts.length > 0) return 10;

  return 0;
}

/**
 * Calculate classification similarity (0-20 points)
 * Matches initial vs lazy classification
 */
function calculateClassificationSimilarity(
  chunk1: InitialChunkSummary,
  chunk2: InitialChunkSummary
): number {
  // Both are entry chunks (initial) or both are not (lazy)
  if (chunk1.isEntry === chunk2.isEntry) return 20;
  return 0;
}

/**
 * Calculate filename similarity (0-10 points)
 * Handles hashed filenames and common patterns
 */
function calculateFilenameSimilarity(
  filename1: string,
  filename2: string
): number {
  if (filename1 === filename2) return 10;

  // Strip hash suffixes (e.g., "chunk-abc123.js" -> "chunk.js")
  const clean1 = stripHash(filename1);
  const clean2 = stripHash(filename2);

  if (clean1 === clean2) return 8;

  // Check for same prefix before "-" or "."
  const prefix1 = clean1.split(/[-.]/)[0];
  const prefix2 = clean2.split(/[-.]/)[0];

  if (prefix1 === prefix2 && prefix1.length > 2) return 5;

  return 0;
}

/**
 * Strip hash from filename (e.g., "chunk-abc123.js" -> "chunk.js")
 */
function stripHash(filename: string): string {
  // Remove hash patterns like -abc123, -abc123def, etc.
  return filename.replace(/-[a-f0-9]{6,}\./, ".");
}

/**
 * Match chunks between two builds using global greedy pairing
 * Ensures 1-to-1 matches with improved similarity scoring
 */
export function matchChunksBetweenBuilds(
  leftChunks: InitialChunkSummary[],
  rightChunks: InitialChunkSummary[]
): ChunkComparison {
  const matchedChunks: ChunkMatch[] = [];
  const unmatchedLeft: InitialChunkSummary[] = [];
  const unmatchedRight: InitialChunkSummary[] = [];

  // Create score matrix for all possible pairs
  const scoreMatrix: Array<{
    leftIndex: number;
    rightIndex: number;
    score: number;
  }> = [];

  for (let i = 0; i < leftChunks.length; i++) {
    for (let j = 0; j < rightChunks.length; j++) {
      const score = calculateChunkSimilarity(leftChunks[i], rightChunks[j]);
      scoreMatrix.push({ leftIndex: i, rightIndex: j, score });
    }
  }

  // Sort by score (highest first) for greedy pairing
  scoreMatrix.sort((a, b) => b.score - a.score);

  // Track which chunks have been matched
  const matchedLeft = new Set<number>();
  const matchedRight = new Set<number>();

  // Greedy pairing: pick highest score, lock both chunks, repeat
  for (const pair of scoreMatrix) {
    if (
      !matchedLeft.has(pair.leftIndex) &&
      !matchedRight.has(pair.rightIndex)
    ) {
      if (pair.score >= 40) {
        // Minimum threshold for any match
        const matchType: "good" | "weak" = pair.score >= 65 ? "good" : "weak";

        matchedChunks.push({
          leftChunk: leftChunks[pair.leftIndex],
          rightChunk: rightChunks[pair.rightIndex],
          similarityScore: pair.score,
          matchType,
        });

        matchedLeft.add(pair.leftIndex);
        matchedRight.add(pair.rightIndex);
      }
    }
  }

  // Collect unmatched chunks
  for (let i = 0; i < leftChunks.length; i++) {
    if (!matchedLeft.has(i)) {
      unmatchedLeft.push(leftChunks[i]);
    }
  }

  for (let i = 0; i < rightChunks.length; i++) {
    if (!matchedRight.has(i)) {
      unmatchedRight.push(rightChunks[i]);
    }
  }

  // Calculate total similarity score
  const totalSimilarityScore =
    matchedChunks.length > 0
      ? matchedChunks.reduce((sum, match) => sum + match.similarityScore, 0) /
        matchedChunks.length
      : 0;

  return {
    matchedChunks,
    unmatchedLeft,
    unmatchedRight,
    totalSimilarityScore,
  };
}

/**
 * Get a human-readable description of the match type
 */
export function getMatchTypeDescription(matchType: "good" | "weak"): string {
  switch (matchType) {
    case "good":
      return "Good match";
    case "weak":
      return "Weak match";
    default:
      return "Unknown";
  }
}

/**
 * Get a color class for the match type
 */
export function getMatchTypeColor(matchType: "good" | "weak"): string {
  switch (matchType) {
    case "good":
      return "text-green-600";
    case "weak":
      return "text-orange-600";
    default:
      return "text-gray-600";
  }
}
