/**
 * @vitest-environment node
 */
import {
  estimateBrotliSize,
  estimateGzipSize,
  formatBytes,
} from "@/lib/format";
import { describe, expect, it } from "vitest";

describe("formatBytes", () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes < 1000 without decimals", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes without decimals (base-1000)", () => {
    expect(formatBytes(10 * 1000)).toBe("10 KB");
  });

  it("formats megabytes with 2 decimals (base-1000)", () => {
    expect(formatBytes(10 * 1000 * 1000)).toBe("10.00 MB");
  });

  it("formats gigabytes with 3 decimals (base-1000)", () => {
    expect(formatBytes(3.5 * 1000 * 1000 * 1000)).toBe("3.500 GB");
  });
});

describe("estimateGzipSize", () => {
  it("returns 0 for 0 bytes", () => {
    expect(estimateGzipSize(0)).toBe(0);
  });

  it("estimates gzip size using 30% compression ratio", () => {
    expect(estimateGzipSize(100)).toBe(30);
    expect(estimateGzipSize(1000)).toBe(300);
    expect(estimateGzipSize(1024)).toBe(307);
  });

  it("rounds to nearest integer", () => {
    expect(estimateGzipSize(10)).toBe(3); // 10 * 0.3 = 3
    expect(estimateGzipSize(20)).toBe(6); // 20 * 0.3 = 6
  });
});

describe("estimateBrotliSize", () => {
  it("returns 0 for 0 bytes", () => {
    expect(estimateBrotliSize(0)).toBe(0);
  });

  it("estimates brotli size using 22% compression ratio", () => {
    expect(estimateBrotliSize(100)).toBe(22);
    expect(estimateBrotliSize(1000)).toBe(220);
    expect(estimateBrotliSize(1024)).toBe(225);
  });

  it("rounds to nearest integer", () => {
    expect(estimateBrotliSize(10)).toBe(2); // 10 * 0.22 = 2.2 -> 2
    expect(estimateBrotliSize(20)).toBe(4); // 20 * 0.22 = 4.4 -> 4
  });
});
