import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/format";
import type { InitialChunkSummary } from "@/lib/types";
import { HelpCircle } from "lucide-react";

interface BundleStatsSectionProps {
  title: string;
  chunks: InitialChunkSummary[];
  onClick?: () => void;
  bgColor: string;
  hoverColor: string;
  borderColor: string;
  textColor: string;
  iconBgColor: string;
  icon: React.ReactNode;
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
  iconBgColor,
  icon,
  description,
}: BundleStatsSectionProps) => {
  const totalSize = chunks.reduce(
    (total, chunk) => total + (chunk?.bytes || 0),
    0
  );
  const largestChunk =
    chunks.length > 0 ? Math.max(...chunks.map((c) => c?.bytes || 0)) : 0;
  const totalModules = chunks.reduce(
    (total, chunk) => total + (chunk?.includedInputs?.length || 0),
    0
  );

  return (
    <div
      className={`w-full mb-3 p-3 ${bgColor} ${borderColor} rounded-md ${hoverColor} transition-colors ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <TooltipProvider>
        <div className="flex items-center justify-between mb-3">
          <div className={`text-sm font-medium flex items-center gap-2`}>
            <div className={`p-1 rounded ${iconBgColor}`}>
              <div className="w-3.5 h-3.5 text-white flex items-center justify-center">
                {icon}
              </div>
            </div>
            {title}
          </div>
          <div className={`text-base font-semibold ${textColor}`}>
            {formatBytes(totalSize)}
          </div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mb-3 italic">
            {description}
          </p>
        )}
        <div className="text-xs text-muted-foreground space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span>Chunks:</span>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of {title.toLowerCase()} output files.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span>{chunks.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span>Largest chunk:</span>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    The biggest {title.toLowerCase()} chunk that could impact
                    loading performance.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span>{chunks.length > 0 ? formatBytes(largestChunk) : "0 B"}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span>Total modules:</span>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Source files/modules bundled into {title.toLowerCase()}{" "}
                    chunks.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span>{totalModules}</span>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};
