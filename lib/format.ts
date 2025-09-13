/**
 * Converts a raw byte count into a human-readable string using binary (base-1024) units.
 *
 * The algorithm progressively divides the input value by 1024 until it finds the
 * most appropriate unit ( B , KB , MB or GB ).  Decimal precision is kept low to
 * ensure stable display in UI components:
 *
 * • Bytes ( B ) and Kilobytes ( KB ) are rounded to the nearest whole number
 * • Megabytes ( MB ) and Gigabytes ( GB ) keep three decimal places for extra accuracy
 *
 * The function is intentionally small and synchronous so it can be used freely in
 * hot paths such as table renderers without introducing any measurable overhead.
 *
 * @example
 * ```ts
 * formatBytes(0);          // "0 B"
 * formatBytes(1023);       // "1023 B"
 * formatBytes(10_240);     // "10 KB"
 * formatBytes(10_485_760); // "10.000 MB"
 * ```
 *
 * @param bytes – Raw byte count, must be non-negative.  Values outside the safe
 *        integer range are clamped by JavaScript’s numeric limits.
 * @returns Human-friendly string representation such as "1.234 MB".
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

  // Use no decimals for the two smallest units to avoid noisy UIs.
  const decimals = unitIndex < 2 ? 0 : 3;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}
