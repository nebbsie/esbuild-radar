import { ChunkTypeIcon } from "@/components/chunk-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  estimateBrotliSize,
  estimateGzipSize,
  formatBytes,
} from "@/lib/format";
import type { InitialChunkSummary } from "@/lib/types";
// Removed unused HelpCircle icon

interface BundleStatsSectionProps {
  title: string;
  chunks: InitialChunkSummary[];
  onClick?: () => void;
  bgColor: string;
  hoverColor: string;
  borderColor: string;
  textColor: string;
  iconType: "initial" | "lazy";
  description?: string;
}

export const BundleStatsSection = ({
  title,
  chunks,
  onClick,
  bgColor,
  hoverColor,
  borderColor,
  textColor,
  iconType,
  description,
}: BundleStatsSectionProps) => {
  const totalSize = chunks.reduce(
    (total, chunk) => total + (chunk?.bytes || 0),
    0,
  );
  const totalGzipSize = chunks.reduce(
    (total, chunk) =>
      total + (chunk?.gzipBytes || estimateGzipSize(chunk?.bytes || 0)),
    0,
  );
  const totalBrotliSize = chunks.reduce(
    (total, chunk) =>
      total + (chunk?.brotliBytes || estimateBrotliSize(chunk?.bytes || 0)),
    0,
  );
  const largestChunk =
    chunks.length > 0 ? Math.max(...chunks.map((c) => c?.bytes || 0)) : 0;
  const totalModules = chunks.reduce(
    (total, chunk) => total + (chunk?.includedInputs?.length || 0),
    0,
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`w-full mb-3 p-3 ${bgColor} ${borderColor} rounded-md ${hoverColor} transition-colors ${
              onClick ? "cursor-pointer" : ""
            }`}
            onClick={onClick}
          >
            <div className="flex items-center justify-between">
              <div className={`text-sm font-medium flex items-center gap-2`}>
                <ChunkTypeIcon
                  type={iconType}
                  size={10}
                  className="flex-shrink-0"
                  compact
                />
                {title}
              </div>
              <div className={`text-sm font-semibold ${textColor}`}>
                {formatBytes(totalSize)}
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="text-xs space-y-2">
            {description && (
              <p className="italic text-muted-foreground">{description}</p>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span>Chunks</span>
                <span>{chunks.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Largest chunk</span>
                <span>
                  {chunks.length > 0 ? formatBytes(largestChunk) : "0 B"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Total modules</span>
                <span>{totalModules}</span>
              </div>
            </div>
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between gap-4">
                <span>Gzipped</span>
                <span>{formatBytes(totalGzipSize)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Brotli</span>
                <span>{formatBytes(totalBrotliSize)}</span>
              </div>
              <div className="text-muted-foreground mt-1 text-[10px]">
                * Estimates - actual compression may vary
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
