"use client";

import { Hourglass, Package, Star, Zap } from "lucide-react";

type ChunkType = "initial" | "lazy" | "main-entry" | "created";

interface ChunkTypeIconProps {
  type: ChunkType;
  size?: number;
  className?: string;
  variant?: "icon" | "swatch";
  compact?: boolean;
}

export function ChunkTypeIcon({
  type,
  size = 14,
  className = "",
  variant = "icon",
  compact = false,
}: ChunkTypeIconProps) {
  const getIconConfig = () => {
    switch (type) {
      case "initial":
        return {
          Icon: Zap,
          color: "bg-red-500",
        };
      case "lazy":
        return {
          Icon: Hourglass,
          color: "bg-purple-500",
        };
      case "main-entry":
        return {
          Icon: Star,
          color: "bg-yellow-500",
        };
      case "created":
        return {
          Icon: Package,
          color: "bg-orange-500",
        };
    }
  };

  const { Icon, color } = getIconConfig();

  if (variant === "swatch") {
    return (
      <div
        className={`${color} ${className} rounded-xs`}
        style={{ width: 8, height: 8 }}
        aria-hidden
      />
    );
  }

  const wrapperPadding = compact ? "p-0.5" : "p-1";
  const innerSize = compact ? "w-3 h-3" : "w-4 h-4";

  return (
    <div className={`${wrapperPadding} rounded ${color} ${className}`}>
      <div
        className={`${innerSize} text-white flex items-center justify-center`}
      >
        {type === "main-entry" ? (
          <Icon size={size} className="text-white fill-white" />
        ) : (
          <Icon size={size} />
        )}
      </div>
    </div>
  );
}
