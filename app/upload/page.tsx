"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseMetafile } from "@/lib/metafile";
import { metafileStorage } from "@/lib/storage";
import { useRouter } from "next/navigation";
import * as React from "react";

export default function UploadPage() {
  const router = useRouter();
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [metafileName, setMetafileName] = React.useState("");

  // Do not clear existing bundles on mount; allow multiple tabs
  React.useEffect(() => {}, []);

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
