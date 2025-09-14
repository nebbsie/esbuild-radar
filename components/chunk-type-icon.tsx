"use client";

import { Clock, Star, Zap } from "lucide-react";

interface ChunkTypeIconProps {
  type: "initial" | "lazy" | "main-entry";
  size?: number;
  className?: string;
}

export function ChunkTypeIcon({
  type,
  size = 14,
  className = "",
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
          Icon: Clock,
          color: "bg-purple-500",
        };
      case "main-entry":
        return {
          Icon: Star,
          color: "bg-yellow-500",
        };
    }
  };

  const { Icon, color } = getIconConfig();

  return (
    <div className={`p-1 rounded ${color} ${className}`}>
      <div className="w-4 h-4 text-white flex items-center justify-center">
        {type === "main-entry" ? (
          <Icon size={size} className="text-white fill-white" />
        ) : (
          <Icon size={size} />
        )}
      </div>
    </div>
  );
}
