/**
 * Bundle Change Scoring Utilities
 *
 * Provides a scoring system to evaluate whether bundle changes are positive or negative
 * based on total size, initial size, and chunk count changes.
 */

export interface ComparisonMetrics {
  totalLeft: number;
  totalRight: number;
  eagerLeft: number;
  eagerRight: number;
  chunksLeft: number;
  chunksRight: number;
}

export interface ScoreResult {
  score: number; // 0-1
  verdict: "positive" | "mixed" | "negative";
  detail: {
    total: number;
    eager: number;
    chunks: number;
  };
}

const WEIGHTS = { total: 40, eager: 40, chunks: 20 };

/**
 * Calculate points for a single metric change
 * @param delta The change (right - left)
 * @param weight The maximum points for this metric
 * @returns Points awarded (0 to weight)
 */
function sectionScore(delta: number, weight: number): number {
  if (delta < 0) return weight; // Got smaller/fewer - full points
  if (delta === 0) return weight / 2; // Unchanged - half points
  return 0; // Regression - no points
}

/**
 * Score a bundle change based on multiple metrics
 * @param metrics The comparison metrics
 * @returns Score result with verdict and breakdown
 */
export function scoreChange(m: ComparisonMetrics): ScoreResult {
  const totalPts = sectionScore(m.totalRight - m.totalLeft, WEIGHTS.total);
  const eagerPts = sectionScore(m.eagerRight - m.eagerLeft, WEIGHTS.eager);
  const chunkPts = sectionScore(m.chunksRight - m.chunksLeft, WEIGHTS.chunks);

  const sum = totalPts + eagerPts + chunkPts;
  const score = sum / 100;

  let verdict: ScoreResult["verdict"] = "mixed";
  if (score >= 0.7) verdict = "positive";
  else if (score < 0.4) verdict = "negative";

  return {
    score,
    verdict,
    detail: { total: totalPts, eager: eagerPts, chunks: chunkPts },
  };
}

/**
 * Get a human-readable description of the score
 */
export function getScoreDescription(result: ScoreResult): string {
  const { score, verdict, detail } = result;
  const percentage = Math.round(score * 100);

  const improvements: string[] = [];
  if (detail.total > 0) improvements.push("smaller total size");
  if (detail.eager > 0) improvements.push("less initial code");
  if (detail.chunks > 0) improvements.push("fewer chunks");

  if (improvements.length === 0) {
    return `${percentage}% - No improvements detected`;
  }

  const improvementText = improvements.join(" & ");

  switch (verdict) {
    case "positive":
      return `${percentage}% (${improvementText})`;
    case "mixed":
      return `${percentage}% (${improvementText})`;
    case "negative":
      return `${percentage}% (${improvementText})`;
  }
}

/**
 * Get color classes for the score verdict
 */
export function getScoreColor(verdict: ScoreResult["verdict"]): string {
  switch (verdict) {
    case "positive":
      return "text-green-600 bg-green-50 border-green-200";
    case "mixed":
      return "text-orange-600 bg-orange-50 border-orange-200";
    case "negative":
      return "text-red-600 bg-red-50 border-red-200";
  }
}
