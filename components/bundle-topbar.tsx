"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { metafileStorage } from "@/lib/storage";
import type { MetafileData } from "@/lib/types";
import { GitCompare, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

interface BundleTopBarProps {
  currentBundleId?: string;
  onBundleChange: (bundleId: string) => void;
  onBundleDeleted?: () => void;
  isSwitchingBundle?: boolean;
}

export function BundleTopBar({
  currentBundleId,
  onBundleChange,
  onBundleDeleted,
  isSwitchingBundle = false,
}: BundleTopBarProps) {
  const router = useRouter();
  const [bundles, setBundles] = React.useState<MetafileData[]>([]);
  const [pendingBundleId, setPendingBundleId] = React.useState<string | null>(
    null
  );

  // Load all bundles on mount
  React.useEffect(() => {
    const loadBundles = async () => {
      try {
        const allBundles = await metafileStorage.getAllBundles();
        setBundles(allBundles);
      } catch (err) {
        console.error("Failed to load bundles:", err);
      }
    };

    loadBundles();
  }, []);

  // Reload bundles when currentBundleId changes (after deletion)
  React.useEffect(() => {
    if (currentBundleId) {
      const loadBundles = async () => {
        try {
          const allBundles = await metafileStorage.getAllBundles();
          setBundles(allBundles);
        } catch (err) {
          console.error("Failed to reload bundles:", err);
        }
      };
      loadBundles();
    }
  }, [currentBundleId]);

  // Clear pending state when switch completes or current changes
  React.useEffect(() => {
    if (!isSwitchingBundle) {
      setPendingBundleId(null);
    }
  }, [isSwitchingBundle]);
  React.useEffect(() => {
    setPendingBundleId(null);
  }, [currentBundleId]);

  const handleBundleClick = async (bundleId: string) => {
    if (isSwitchingBundle || bundleId === currentBundleId) return;
    setPendingBundleId(bundleId);

    try {
      await metafileStorage.setCurrentBundle(bundleId);
      onBundleChange(bundleId);
    } catch (err) {
      console.error("Failed to switch bundle:", err);
    }
  };

  const handleDeleteBundle = async (
    bundleId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // Prevent triggering bundle selection

    try {
      await metafileStorage.deleteBundle(bundleId);
      const remainingBundles = await metafileStorage.getAllBundles();
      setBundles(remainingBundles);

      // If we deleted the current bundle, notify parent
      if (bundleId === currentBundleId) {
        onBundleDeleted?.();
      }
    } catch (err) {
      console.error("Failed to delete bundle:", err);
    }
  };

  const handleAddBundle = () => {
    router.push("/upload");
  };

  const handleCompareBundles = () => {
    router.push("/compare");
  };

  const formatBundleName = (name?: string) => {
    if (!name) return "stats.json";
    // Truncate long names
    return name.length > 20 ? `${name.slice(0, 20)}...` : name;
  };

  // Keyboard navigation: Alt+ArrowLeft / Alt+ArrowRight to switch tabs
  const switchBundle = React.useCallback(
    (direction: "left" | "right") => {
      if (!bundles.length || !currentBundleId || isSwitchingBundle) return;
      const index = bundles.findIndex((b) => b.id === currentBundleId);
      if (index === -1) return;
      const nextIndex =
        direction === "left"
          ? (index - 1 + bundles.length) % bundles.length
          : (index + 1) % bundles.length;
      const nextId = bundles[nextIndex]?.id;
      if (!nextId) return;
      setPendingBundleId(nextId);
      void metafileStorage.setCurrentBundle(nextId).then(() => {
        onBundleChange(nextId);
      });
    },
    [bundles, currentBundleId, onBundleChange, isSwitchingBundle]
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (isTyping) return;

      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          switchBundle("left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          switchBundle("right");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [switchBundle]);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2">
        <ScrollArea className="max-w-[calc(100vw-200px)]">
          <div className="flex items-center gap-2">
            {bundles.map((bundle) => (
              <div key={bundle.id} className="group">
                <div
                  onClick={() => handleBundleClick(bundle.id)}
                  className={`relative flex items-center gap-2 px-3 py-1 pr-6 text-sm rounded-md border transition-colors ${
                    isSwitchingBundle || bundle.id === currentBundleId
                      ? "cursor-default"
                      : "cursor-pointer"
                  } ${
                    currentBundleId === bundle.id
                      ? "bg-primary/10 text-primary border-primary/50"
                      : isSwitchingBundle
                        ? "bg-muted/50 text-muted-foreground border-border"
                        : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span className="truncate mr-2 max-w-32">
                    {formatBundleName(bundle.name)}
                  </span>
                  {pendingBundleId === bundle.id && (
                    <span
                      className="inline-block w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin"
                      aria-label="Switching"
                    />
                  )}
                  <button
                    onClick={(e) => handleDeleteBundle(bundle.id, e)}
                    className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Plus button after the last bundle */}
            <button
              onClick={handleAddBundle}
              className="flex cursor-pointer items-center justify-center w-8 h-8 text-sm rounded-md border bg-background text-foreground border-border hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>

            {bundles.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No bundles uploaded
              </span>
            )}
          </div>
        </ScrollArea>

        {/* Compare button */}
        {bundles.length >= 2 && (
          <button
            onClick={handleCompareBundles}
            className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm rounded-md border bg-background text-foreground border-border hover:bg-muted transition-colors"
            title="Compare bundles"
          >
            <GitCompare className="h-4 w-4" />
            <span>Compare</span>
          </button>
        )}
      </div>
    </div>
  );
}
