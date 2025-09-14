import type { Metafile } from "@/lib/types";
import { readFileSync } from "fs";

export const getStatsMetafile = () => {
  const metafile: Metafile = JSON.parse(
    readFileSync("./tests/stats.json", "utf-8")
  );

  return metafile;
};
