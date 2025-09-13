/**
 * @vitest-environment node
 */
import { formatBytes } from "@/lib/format";
import { describe, expect, it } from "vitest";

describe("formatBytes", () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes < 1024 without decimals", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes without decimals", () => {
    expect(formatBytes(10 * 1024)).toBe("10 KB");
  });

  it("formats megabytes with 3 decimals", () => {
    expect(formatBytes(10 * 1024 * 1024)).toBe("10.000 MB");
  });

  it("formats gigabytes with 3 decimals", () => {
    expect(formatBytes(3.5 * 1024 * 1024 * 1024)).toBe("3.500 GB");
  });
});
