"use client";

import { metafileStorage } from "@/lib/storage";
import { useRouter } from "next/navigation";
import * as React from "react";

export default function HomePage() {
  const router = useRouter();

  React.useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const bundles = await metafileStorage.getAllBundles();
        if (!isActive) return;
        if (bundles.length > 0) {
          router.push("/results");
        } else {
          router.push("/upload");
        }
      } catch {
        router.push("/upload");
      }
    })();
    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin"
          aria-label="Loading"
        />
      </div>
    </div>
  );
}
