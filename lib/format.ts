/**
 * Compression size estimates are approximate and based on typical JavaScript bundle
 * compression ratios. Actual compression results may vary depending on content,
 * compression level, and other factors.
 */

/**
 * Converts a raw byte count into a human-readable string using binary (base-1024) units.
 *
 * The algorithm progressively divides the input value by 1024 until it finds the
 * most appropriate unit ( B , KB , MB or GB ). This uses binary units which are
 * standard in computing and developer tools.
 *
 * • Bytes ( B ) are rounded to the nearest whole number
 * • Kilobytes ( KB ) and Megabytes ( MB ) keep one decimal place for readability
 * • Gigabytes ( GB ) keep two decimal places for extra accuracy
 *
 * The function is intentionally small and synchronous so it can be used freely in
 * hot paths such as table renderers without introducing any measurable overhead.
 *
 * @example
 * ```ts
 * formatBytes(0);           // "0 B"
 * formatBytes(1023);        // "1023 B"
 * formatBytes(10 * 1024);   // "10.0 KB"
 * formatBytes(10 * 1024 * 1024);  // "10.0 MB"
 * ```
 *
 * @param bytes – Raw byte count, must be non-negative. Values outside the safe
 *        integer range are clamped by JavaScript’s numeric limits.
 * @returns Human-friendly string representation such as "1.2 MB".
 */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"] as const;
  let unitIndex = 0;
  let value = bytes;

  // Climb the unit ladder while we still have a bigger unit available
  // and the current value is large enough to justify the switch.
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  // Use no decimals for bytes, 2 decimals for KB, MB, and GB
  const decimals = unitIndex === 0 ? 0 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

/**
 * Estimates the gzipped size of JavaScript code based on typical compression ratios.
 *
 * JavaScript code typically compresses to about 25-35% of its original size with gzip.
 * This function uses a conservative estimate of 30% compression ratio, which is
 * commonly observed for modern JavaScript bundles.
 *
 * @param uncompressedBytes – The uncompressed byte count
 * @returns Estimated gzipped byte count
 */
export function estimateGzipSize(uncompressedBytes: number): number {
  if (!uncompressedBytes) return 0;

  // JavaScript typically compresses to ~25-35% of original size with gzip
  // We use 30% as a conservative estimate for modern JS bundles
  const compressionRatio = 0.3;

  return Math.round(uncompressedBytes * compressionRatio);
}

/**
 * Estimates the Brotli-compressed size of JavaScript code based on typical compression ratios.
 *
 * Brotli typically provides better compression than gzip for JavaScript bundles,
 * usually achieving 20-25% of the original size. This function uses a conservative
 * estimate of 22% compression ratio for modern JavaScript bundles.
 *
 * @param uncompressedBytes – The uncompressed byte count
 * @returns Estimated Brotli-compressed byte count
 */
export function estimateBrotliSize(uncompressedBytes: number): number {
  if (!uncompressedBytes) return 0;

  // JavaScript typically compresses to ~20-25% of original size with Brotli
  // We use 22% as a conservative estimate for modern JS bundles
  const compressionRatio = 0.22;

  return Math.round(uncompressedBytes * compressionRatio);
}
