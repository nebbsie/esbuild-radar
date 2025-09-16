"use client";

import { formatBytes } from "@/lib/format";
import type { InitialChunkSummary, PathTreeNode } from "@/lib/types";
import * as React from "react";
import type { SunburstMethods } from "react-sunburst-chart";
const ReactSunburst = React.lazy(() => import("react-sunburst-chart"));

// Simple ordinal scale replacement
function createOrdinalScale<T>(range: T[]): (key: string) => T {
  const map = new Map<string, T>();
  let index = 0;
  return (key: string) => {
    if (!map.has(key)) {
      map.set(key, range[index % range.length]);
      index++;
    }
    return map.get(key)!;
  };
}

// Minimal color helpers (no d3)
function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const r1 = r / 255,
    g1 = g / 255,
    b1 = b / 255;
  const max = Math.max(r1, g1, b1),
    min = Math.min(r1, g1, b1);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r1:
        h = 60 * (((g1 - b1) / d) % 6);
        break;
      case g1:
        h = 60 * ((b1 - r1) / d + 2);
        break;
      default:
        h = 60 * ((r1 - g1) / d + 4);
    }
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (h >= 0 && h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return { r, g, b };
}

function rotateHue(hexColor: string, degrees: number): string {
  const { r, g, b } = hexToRgb(hexColor);
  const base = rgbToHsl(r, g, b);
  let h = base.h + degrees;
  if (h < 0) h += 360;
  if (h >= 360) h -= 360;
  const rgb2 = hslToRgb(h, base.s, base.l);
  return rgbToHex(rgb2.r, rgb2.g, rgb2.b);
}

function hashInt(input: string): number {
  let h = 2166136261 >>> 0; // FNV-1a basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isNodeModulesPath(path: string, name: string): boolean {
  return (
    /(^|\/)node_modules(\/)?.*/i.test(path) || /node_modules/i.test(name || "")
  );
}

function hueDeltaForKey(
  key: string,
  depth: number,
  siblingIndex: number
): number {
  // Stable hue delta per directory key with small sibling variation
  const baseDelta = 35; // clamp to ±35° overall
  const h = hashInt(key);
  const centered = (h % (baseDelta * 2)) - baseDelta; // [-baseDelta, +baseDelta]
  const siblingNudge = ((siblingIndex % 5) - 2) * 2; // -4, -2, 0, 2, 4
  // Increase shift slightly with depth so deeper dirs vary more, but clamp to ±baseDelta
  const depthBoost = 1 + Math.min(1.2, Math.log2((depth || 1) + 1) * 0.35);
  const raw = (centered + siblingNudge) * depthBoost;
  return Math.max(-baseDelta, Math.min(baseDelta, raw));
}

function shadeFrom(
  baseColor: string,
  level: number,
  siblingIndex: number,
  isNodeModules = false
): string {
  // For node_modules: keep red hue but lighten progressively and gradually
  if (isNodeModules) {
    const { r, g, b } = hexToRgb(baseColor);
    const base = rgbToHsl(r, g, b);

    // Keep red hue (0° or 360° in HSL)
    const h = 0; // Red hue

    // Logarithmic depth factor for gradual changes - much more gradual than source code
    const frac = Math.min(1, Math.log2((level || 1) + 1) / 12); // Slower progression

    // Slight desaturation with depth for de-emphasis
    const s = clamp01(base.s * (1 - 0.08 * frac));

    // Very gradual lighten with depth - logarithmic approach for many levels
    const delta = 0.015 + 0.025 * frac; // Much smaller increments
    let l = base.l + delta;

    // Clamp to safe visible range - allow more range since we're being gradual
    l = clamp01(Math.max(0.25, Math.min(0.9, l)));

    const rgb2 = hslToRgb(h, s, l);
    return rgbToHex(rgb2.r, rgb2.g, rgb2.b);
  }

  // For regular source code: use the original gentle shading
  const { r, g, b } = hexToRgb(baseColor);
  const base = rgbToHsl(r, g, b);

  // Logarithmic depth factor so many levels remain distinguishable
  const frac = Math.min(1, Math.log2((level || 1) + 1) / 6);

  // Keep exact branch hue (no jitter) to preserve identity
  const h = base.h;

  // Slight desaturation with depth for de-emphasis
  const s = clamp01(base.s * (1 - 0.14 * frac));

  // Monotonic lighten with depth
  const delta = 0.02 + 0.06 * frac; // ~0.02..0.08
  let l = base.l + delta;
  // Minimal sibling nudge to avoid identical tones
  l += ((siblingIndex % 3) - 1) * 0.005; // -0.005, 0, +0.005
  // Clamp to safe visible range
  l = clamp01(Math.max(0.24, Math.min(0.86, l)));

  const rgb2 = hslToRgb(h, s, l);
  return rgbToHex(rgb2.r, rgb2.g, rgb2.b);
}

type SunburstProps = {
  tree: PathTreeNode;
  onSelectFile: (path: string) => void;
  selectedPath: string | null;
  className?: string;
};

/**
 * Sunburst visualization for a PathTreeNode.
 * - Click a directory to drill down
 * - Click center "Up" control to go up a level
 * - Click a file to select it
 */
export function Sunburst({
  tree,
  onSelectFile,
  selectedPath,
  className,
}: SunburstProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<SunburstMethods | undefined>(undefined);
  const [dimensions, setDimensions] = React.useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });
  const [isClient, setIsClient] = React.useState(false);

  // Mark as client-side
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Resize observer for responsive sizing
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setDimensions({
        width: Math.max(0, rect.width),
        height: Math.max(0, rect.height),
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const width = dimensions.width || 400;
  const height = dimensions.height || 400;

  // Vibrant base palette for distinct parents (green, blue, pink, etc.)
  const basePalette = React.useMemo(
    () => [
      "#16a34a", // green
      "#2563eb", // blue
      "#d946ef", // fuchsia
      "#f59e0b", // amber
      "#ef4444", // red
      "#06b6d4", // cyan
      "#8b5cf6", // violet
      "#84cc16", // lime
      "#ec4899", // pink
      "#10b981", // emerald
    ],
    []
  );

  const baseScale = React.useMemo(
    () => createOrdinalScale(basePalette),
    [basePalette]
  );

  // shadeFrom is defined above without d3

  type SunburstData = {
    name: string;
    value: number;
    originalSize: number; // Store original size for tooltips
    path: string;
    type: "dir" | "file";
    color?: string;
    isSelected?: boolean;
    children?: SunburstData[];
  };

  // Apply logarithmic scaling to make small values more visible in sunburst
  const scaleValueForSunburst = React.useCallback((size: number): number => {
    if (!size || size <= 0 || !isFinite(size)) return 0;

    try {
      // Use log scaling: log(size + 1) compresses the range while preserving relative proportions
      // Add 1 to avoid log(0) and ensure small values > 0
      // Multiply by a factor to maintain reasonable visual proportions
      const scaled = Math.log(size + 1) * 100;

      // Ensure we never return NaN, Infinity, or negative values
      if (!isFinite(scaled) || scaled < 0) return 0;

      return scaled;
    } catch (error) {
      // Fallback to 0 if any calculation fails
      console.warn("Error scaling sunburst value:", size, error);
      return 0;
    }
  }, []);

  // Find the parent directory of a file in the sunburst data tree
  const findParentDirectory = React.useCallback(
    (
      data: SunburstData,
      filePath: string,
      currentPath: string[] = []
    ): SunburstData | null => {
      // Normalize the search path
      const normalizedFilePath = filePath.replace(/^\.\//, "");

      // Check if this node has the file as a direct child
      if (data.children) {
        for (const child of data.children) {
          if (child.type === "file") {
            // Try multiple path matching strategies
            const childPath = child.path || "";
            const normalizedChildPath = childPath.replace(/^\.\//, "");

            // Exact match
            if (
              childPath === filePath ||
              normalizedChildPath === normalizedFilePath
            ) {
              return data;
            }

            // Check if the file path ends with the child path (handles relative paths)
            if (
              normalizedFilePath.endsWith(normalizedChildPath) ||
              filePath.endsWith(childPath)
            ) {
              return data;
            }

            // Check if the child path ends with the file path
            if (
              normalizedChildPath.endsWith(normalizedFilePath) ||
              childPath.endsWith(filePath)
            ) {
              return data;
            }
          }
          // Recursively search in child directories
          if (child.type === "dir") {
            const found = findParentDirectory(child, filePath, [
              ...currentPath,
              child.name,
            ]);
            if (found) return found;
          }
        }
      }
      return null;
    },
    []
  );

  const convertToChartData = React.useCallback(
    (
      node: PathTreeNode,
      depth = 0,
      parentBase?: string,
      currentSelectedPath?: string | null
    ): SunburstData => {
      let ownColor = parentBase;
      if (depth === 1) {
        const key = node.path || node.name || "root";
        // Force node_modules to start red for immediate recognition
        const isNodeModules = isNodeModulesPath(node.path, node.name || "");
        const baseHex = isNodeModules ? "#ef4444" : baseScale(key);
        // Lighten base slightly so starting color is less dark
        const { r, g, b } = hexToRgb(baseHex);
        const hsl = rgbToHsl(r, g, b);
        const l = clamp01(Math.max(0.24, Math.min(0.84, hsl.l + 0.06)));
        const rgb = hslToRgb(hsl.h, hsl.s, l);
        ownColor = rgbToHex(rgb.r, rgb.g, rgb.b);
      } else if (depth > 1 && parentBase) {
        const isNodeModules = isNodeModulesPath(node.path, node.name || "");
        ownColor = shadeFrom(parentBase, depth - 1, 0, isNodeModules);
      } else if (depth === 0) {
        // Root color: neutral light so it isn't black/grey
        ownColor = "#e5e7eb"; // tailwind slate-200
      }

      // Check if this node is currently selected (coerce to strict boolean)
      const isSelected = Boolean(
        currentSelectedPath && node.path === currentSelectedPath
      );

      // If selected, use a bright highlight color
      if (isSelected) {
        ownColor = "#fbbf24"; // bright amber/yellow for selection highlight
      }

      const children = node.children?.map((child, idx): SunburstData => {
        const baseForChild =
          depth >= 1
            ? ownColor!
            : baseScale(child.path || child.name || String(idx));
        const childKey = child.path || child.name || String(idx);
        // Stronger, stable hue shift per sub-folder for clearer distinction
        const childBase =
          child.type === "dir"
            ? rotateHue(baseForChild, hueDeltaForKey(childKey, depth, idx))
            : baseForChild;
        const childData = convertToChartData(
          child,
          depth + 1,
          childBase,
          currentSelectedPath
        );
        if (
          childData &&
          childData.color &&
          depth >= 1 &&
          !childData.isSelected
        ) {
          const isNodeModules = isNodeModulesPath(child.path, child.name || "");
          childData.color = shadeFrom(childBase, depth, idx, isNodeModules);
        }
        return childData;
      });

      return {
        name: node.name,
        value: scaleValueForSunburst(node.size), // Apply logarithmic scaling for better visibility
        originalSize: node.size, // Store original size for tooltips
        path: node.path,
        type: node.type,
        color: ownColor,
        isSelected,
        children,
      };
    },
    [baseScale, scaleValueForSunburst]
  );

  // Validate sunburst data before rendering
  const sunburstData = React.useMemo(() => {
    try {
      return convertToChartData(tree, 0, undefined, selectedPath);
    } catch (error) {
      console.error("Error generating sunburst data:", error);
      // Return a minimal valid data structure
      return {
        name: "root",
        value: 1,
        originalSize: 0,
        path: "",
        type: "dir" as const,
        color: "#e5e7eb",
        isSelected: false,
        children: [],
      };
    }
  }, [convertToChartData, tree, selectedPath]);

  // Listen for module navigation events to automatically zoom to parent directory
  React.useEffect(() => {
    const handleModuleNavigation = (e: Event) => {
      const ce = e as CustomEvent<{
        module: string;
        chunk?: InitialChunkSummary;
      }>;
      const { module: selectedModule } = ce.detail;

      // Find and focus on the parent directory using the existing sunburst data
      // This avoids regenerating the data structure which can cause d3.js layout errors
      const parentDir = findParentDirectory(sunburstData, selectedModule);

      if (parentDir && parentDir.type === "dir") {
        try {
          chartRef.current?.focusOnNode?.(parentDir as never);
        } catch (error) {
          console.warn("Failed to focus on parent directory:", error);
        }
      } else {
        // If navigation fails, try to find the file directly and focus on its immediate parent
        const findFileAndParent = (
          data: SunburstData,
          targetPath: string
        ): SunburstData | null => {
          if (data.children) {
            for (const child of data.children) {
              if (child.type === "file") {
                const childPath = child.path || "";
                const normalizedChildPath = childPath.replace(/^\.\//, "");
                const normalizedTargetPath = targetPath.replace(/^\.\//, "");

                if (
                  childPath === targetPath ||
                  normalizedChildPath === normalizedTargetPath ||
                  normalizedTargetPath.endsWith(normalizedChildPath) ||
                  targetPath.endsWith(childPath)
                ) {
                  return data; // Return the parent
                }
              }
              if (child.type === "dir") {
                const found = findFileAndParent(child, targetPath);
                if (found) return found;
              }
            }
          }
          return null;
        };

        const directParent = findFileAndParent(sunburstData, selectedModule);
        if (directParent) {
          try {
            chartRef.current?.focusOnNode?.(directParent as never);
            return;
          } catch (error) {
            console.warn("Failed to focus on direct parent:", error);
          }
        }
      }
    };

    window.addEventListener(
      "navigate-to-module",
      handleModuleNavigation as EventListener
    );

    return () => {
      window.removeEventListener(
        "navigate-to-module",
        handleModuleNavigation as EventListener
      );
    };
  }, [sunburstData, findParentDirectory]);

  // No imperative lifecycle needed when using react-sunburst-chart

  if (!isClient) {
    // Server-side rendering fallback: render an empty container (no loading UI)
    return (
      <div
        className={className}
        style={{ position: "relative", width: "100%", height: "420px" }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden", // Prevent chart from expanding beyond container bounds
      }}
    >
      <React.Suspense fallback={null}>
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ReactSunburst
            ref={chartRef}
            data={sunburstData}
            width={width}
            height={height}
            excludeRoot={true}
            centerRadius={0.1}
            showLabels={true}
            maxLevels={3}
            strokeColor="var(--background)"
            transitionDuration={50}
            color="color"
            tooltipTitle={() => ""}
            tooltipContent={(d: unknown) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const node: any = d;
              const name = node?.data?.name ?? node?.name ?? "";
              const fullPath = node?.data?.path ?? node?.path ?? "";
              const size = formatBytes(
                (node?.data?.originalSize as number | undefined) ??
                  (node?.originalSize as number | undefined) ??
                  0
              );
              return `<div class=\"sunburst-tooltip\"><div><strong>${name}</strong></div><div>${fullPath}</div><div>${size}</div></div>`;
            }}
            onClick={(node: unknown) => {
              const n = node as SunburstData | null;
              if (!n) return;

              if (n.type === "file") {
                // Select the file
                onSelectFile(n.path as string);

                // Find and focus on the parent directory to make the file more visible
                const parentDir = findParentDirectory(
                  sunburstData,
                  n.path as string
                );

                if (parentDir && parentDir.type === "dir") {
                  try {
                    chartRef.current?.focusOnNode?.(parentDir as never);
                  } catch {}
                }
                return;
              }
              // Focus directories
              try {
                chartRef.current?.focusOnNode?.(n as never);
              } catch {}
            }}
          />
        </div>
      </React.Suspense>
    </div>
  );
}
