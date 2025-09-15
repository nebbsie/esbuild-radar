"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { metafileStorage } from "@/lib/storage";
import type { MetafileData } from "@/lib/types";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

interface BundleTopBarProps {
  currentBundleId?: string;
  onBundleChange: (bundleId: string) => void;
  onBundleDeleted?: () => void;
}

export function BundleTopBar({
  currentBundleId,
  onBundleChange,
  onBundleDeleted,
}: BundleTopBarProps) {
  const router = useRouter();
  const [bundles, setBundles] = React.useState<MetafileData[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load all bundles on mount
  React.useEffect(() => {
    const loadBundles = async () => {
      try {
        const allBundles = await metafileStorage.getAllBundles();
        setBundles(allBundles);
      } catch (err) {
        console.error("Failed to load bundles:", err);
      } finally {
        setIsLoading(false);
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

  const handleBundleClick = async (bundleId: string) => {
    try {
      await metafileStorage.setCurrentBundle(bundleId);
      onBundleChange(bundleId);
    } catch (err) {
      console.error("Failed to switch bundle:", err);
    }
  };

  const handleDeleteBundle = async (
    bundleId: string,
    event: React.MouseEvent,
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

  const formatBundleName = (name?: string) => {
    if (!name) return "stats.json";
    // Truncate long names
    return name.length > 20 ? `${name.slice(0, 20)}...` : name;
  };

  // Keyboard navigation: Alt+ArrowLeft / Alt+ArrowRight to switch tabs
  const switchBundle = React.useCallback(
    (direction: "left" | "right") => {
      if (!bundles.length || !currentBundleId) return;
      const index = bundles.findIndex((b) => b.id === currentBundleId);
      if (index === -1) return;
      const nextIndex =
        direction === "left"
          ? (index - 1 + bundles.length) % bundles.length
          : (index + 1) % bundles.length;
      const nextId = bundles[nextIndex]?.id;
      if (!nextId) return;
      void metafileStorage.setCurrentBundle(nextId).then(() => {
        onBundleChange(nextId);
      });
    },
    [bundles, currentBundleId, onBundleChange],
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

  if (isLoading) {
    return null;
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <ScrollArea className="max-w-[calc(100vw-200px)]">
          <div className="flex items-center gap-2">
            {bundles.map((bundle) => (
              <div key={bundle.id} className="group">
                <div
                  onClick={() => handleBundleClick(bundle.id)}
                  className={`relative flex items-center gap-2 px-3 py-1 pr-6 text-sm rounded-md border transition-colors cursor-pointer ${
                    currentBundleId === bundle.id
                      ? "bg-primary/10 text-primary border-primary/50"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span className="truncate mr-2 max-w-32">
                    {formatBundleName(bundle.name)}
                  </span>
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
      </div>
    </div>
  );
}
