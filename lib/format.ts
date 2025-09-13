export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  // Use no decimals for B and KB, 3 decimals for MB and GB
  const decimals = unitIndex < 2 ? 0 : 3;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}
