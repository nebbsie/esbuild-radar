import { readFileSync } from "fs";
import { getInclusionPath } from "./lib/analyser";
import { parseMetafile } from "./lib/metafile";

const statsPath = new URL("./stats.json", import.meta.url);
const meta = parseMetafile(JSON.parse(readFileSync(statsPath, "utf-8")));

// Test some files that might show "No inclusion path found"
const testFiles = [
  "src/bits/main.ts", // This should be the entry point
  "src/bits/app.module.ts", // This should have a path
  "src/@freelancer/datastore/testing/helpers/textCorpus.ts", // This has a path
  "node_modules/@angular/core/fesm2022/core.mjs", // External dependency
  "src/bits/generated/ribbon/colors/colors.component.ts", // Generated component
];

console.log("Testing inclusion paths:");
testFiles.forEach((file) => {
  const path = getInclusionPath(meta, file);
  console.log(`${file}: ${path.length} steps`);
  if (path.length === 0) {
    console.log(`  -> No path found for ${file}`);
  }
});
