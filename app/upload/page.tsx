"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { parseMetafile } from "@/lib/metafile";
import { metafileStorage } from "@/lib/storage";
import type { MetafileData } from "@/lib/types";
import { useRouter } from "next/navigation";
import * as React from "react";

export default function UploadPage() {
  const router = useRouter();
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [metafileName, setMetafileName] = React.useState("");
  const [savedBundles, setSavedBundles] = React.useState<MetafileData[]>([]);
  const [currentBundleId, setCurrentBundleId] = React.useState<string | null>(
    null
  );
  const [loadingSaved, setLoadingSaved] = React.useState(true);

  // Do not clear existing bundles on mount; allow multiple tabs
  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // Load saved bundles and the last opened one
        const [bundles, currentId] = await Promise.all([
          metafileStorage.getAllBundles(),
          metafileStorage.getCurrentBundleId(),
        ]);
        if (!isMounted) return;
        // Show newest first
        const sorted = [...bundles].sort((a, b) => b.createdAt - a.createdAt);
        setSavedBundles(sorted);
        setCurrentBundleId(currentId);
      } catch (err) {
        console.error("Failed to read saved bundles:", err);
      } finally {
        if (isMounted) setLoadingSaved(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  function onChooseFile() {
    fileInputRef.current?.click();
  }

  async function loadDemo() {
    try {
      const response = await fetch("/demo-stats.json");
      const json = await response.json();

      // Validate that it's a proper esbuild metafile
      parseMetafile(json);

      // Store in IndexedDB using the storage service
      await metafileStorage.storeMetafile(
        JSON.stringify(json),
        metafileName || "demo-stats.json"
      );
      router.push("/results");
    } catch (err) {
      console.error("Failed to load demo metafile:", err);
      alert(
        "Failed to load demo metafile: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  async function processFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Validate that it's a proper esbuild metafile
      parseMetafile(json);
      // Store in IndexedDB using the storage service
      // Use the actual filename if no custom name was provided
      const bundleName = metafileName || file.name;
      await metafileStorage.storeMetafile(JSON.stringify(json), bundleName);
      router.push("/results");
    } catch (err) {
      console.error("Failed to process metafile:", err);
      alert(
        "Failed to process metafile: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  async function openBundle(bundleId: string) {
    try {
      await metafileStorage.setCurrentBundle(bundleId);
      router.push("/results");
    } catch (err) {
      console.error("Failed to open saved bundle:", err);
      alert(
        "Failed to open saved bundle: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Upload esbuild metafile</CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Upload your stats.json file or try our demo
          </p>
          <div className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-950/50 rounded-md p-2 border border-amber-200 dark:border-amber-800">
            <strong>⚠️ Development Notice:</strong> This tool is in active
            development and has only been tested with bundles from Angular
            builds so far. Results with other frameworks may vary.
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loadingSaved && savedBundles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Saved bundles</span>
                {currentBundleId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openBundle(currentBundleId)}
                  >
                    Reopen last opened
                  </Button>
                )}
              </div>
              <ScrollArea className="h-36 rounded-md border border-border">
                <div className="p-2">
                  {savedBundles.map((b, idx) => (
                    <div key={b.id} className="py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {b.name || "stats.json"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(b.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Button size="sm" onClick={() => openBundle(b.id)}>
                          Open
                        </Button>
                      </div>
                      {idx < savedBundles.length - 1 && (
                        <Separator className="my-2" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="metafile-name" className="text-sm font-medium">
              Metafile Name (optional)
            </label>
            <input
              id="metafile-name"
              type="text"
              placeholder="Enter a name for this metafile..."
              value={metafileName}
              onChange={(e) => setMetafileName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div
            className={`border-2 border-dashed rounded-md p-8 text-center transition-colors ${
              isDragOver
                ? "border-primary bg-primary/10"
                : "border-muted-foreground/25"
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <div className="space-y-4">
              <div className="text-muted-foreground">
                Drag and drop your stats.json file here, or click to select.
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={onChooseFile}>Select File</Button>
                <Button variant="outline" onClick={loadDemo}>
                  Try Demo
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            Made by{" "}
            <a
              href="https://x.com/nebbsie"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              @nebbsie
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
