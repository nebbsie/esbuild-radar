"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";

export function Analytics() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Only show analytics on production domain
    if (window.location.host === "esbuildradar.com") {
      setShouldShow(true);
    }
  }, []);

  if (!shouldShow) return null;

  return <VercelAnalytics />;
}

Analytics.displayName = "Analytics";
