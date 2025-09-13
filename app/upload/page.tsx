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

  React.useEffect(() => {
    // Clear any existing data when component mounts
    metafileStorage.clearMetafile();
  }, []);

  function onChooseFile() {
    fileInputRef.current?.click();
  }

  async function processFile(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Validate that it's a proper esbuild metafile
      parseMetafile(json);
      // Store in IndexedDB using the storage service
      await metafileStorage.storeMetafile(JSON.stringify(json));
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
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
              <Button onClick={onChooseFile}>Select File</Button>
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
