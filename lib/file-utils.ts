import { inferEntryForOutput } from "@/lib/analyser";
import { summarizeInitial } from "@/lib/initial-summary";
import { parseMetafile } from "@/lib/metafile";
import type { InitialChunkSummary, ProcessedMetafileData } from "@/lib/types";

/**
 * Processes an uploaded esbuild metafile and returns the processed data.
 * This function handles the pure logic of parsing and transforming the metafile data.
 *
 * @param file - The uploaded file containing the esbuild metafile JSON
 * @returns Promise that resolves to the processed metafile data
 * @throws Error if the file cannot be processed or is not a valid esbuild metafile
 */
export async function processUploadedFile(
  file: File
): Promise<ProcessedMetafileData> {
  try {
    // Read file content as text
    const text = await file.text();

    // Parse JSON
    const json = JSON.parse(text);

    // Validate that it's a proper esbuild metafile
    const metafile = parseMetafile(json);

    // Get initial/lazy summary using the tested logic
    const initialSummary = summarizeInitial(metafile);

    // Convert output filenames to InitialChunkSummary objects
    const allChunks: InitialChunkSummary[] = [
      ...initialSummary.initial.outputs,
      ...initialSummary.lazy.outputs,
    ]
      .map((outputFile) => {
        const out = metafile.outputs[outputFile];
        if (!out) return null;
        return {
          outputFile,
          bytes: out.bytes || 0,
          entryPoint:
            out.entryPoint || inferEntryForOutput(metafile, outputFile) || "",
          isEntry: Boolean(out.entryPoint),
          includedInputs: Object.keys(out.inputs || {}),
        };
      })
      .filter((chunk): chunk is InitialChunkSummary => Boolean(chunk))
      .sort((a, b) => b.bytes - a.bytes); // Sort by size (largest first)

    // Don't select any chunk initially - let the user choose
    const selectedChunk = null;

    // Don't auto-select any module
    const selectedModule = null;

    return {
      metafile,
      initialSummary,
      chunks: allChunks,
      selectedChunk,
      selectedModule,
    };
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Failed to process metafile: ${err.message}`);
    }
    throw new Error("Failed to process metafile: Unknown error");
  }
}
