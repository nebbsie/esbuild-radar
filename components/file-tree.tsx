"use client";

import { formatBytes } from "@/lib/format";
import type { PathTreeNode } from "@/lib/path-tree";
import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import * as React from "react";

function highlight(text: string, needle: string): React.ReactNode {
  if (!needle || !text.toLowerCase().includes(needle.toLowerCase()))
    return text;
  const regex = new RegExp(
    `(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
        {part}
      </span>
    ) : (
      part
    )
  );
}

const FileTreeItem = React.memo<{
  node: PathTreeNode;
  onSelectFile: (p: string) => void;
  selectedPath: string | null;
  highlightText?: string;
  level?: number;
  allCollapsed?: boolean;
}>(
  ({
    node,
    onSelectFile,
    selectedPath,
    highlightText: needle,
    level = 0,
    allCollapsed = false,
  }) => {
    const isFile = node.type === "file";
    const isSelected = selectedPath === node.path;
    const paddingLeft = level * 8 + (isFile ? 16 : 0);

    if (isFile) {
      return (
        <button
          onClick={() => onSelectFile(node.path)}
          className={`w-full text-left text-sm py-1 px-2 rounded-md hover:bg-accent transition-colors cursor-pointer overflow-hidden flex items-center justify-between group border ${
            isSelected
              ? "bg-accent/80 text-accent-foreground border-primary ring-1 ring-primary/20 shadow-sm"
              : "border-transparent hover:bg-muted/50"
          }`}
          title={node.path}
          style={{ paddingLeft: `${paddingLeft}px` }}
          data-selected-module={isSelected ? "true" : undefined}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <File className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
            <span className={`truncate ${isSelected ? "font-medium" : ""}`}>
              {highlight(node.name, needle || "")}
            </span>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatBytes(node.size)}
          </span>
        </button>
      );
    }

    return (
      <details open={!allCollapsed} className="group">
        <summary
          className="w-full text-left text-sm py-1 px-2 rounded-md hover:bg-accent transition-colors cursor-pointer overflow-hidden flex items-center justify-between list-none"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex-shrink-0 w-3 h-3 relative">
              <ChevronRight className="w-3 h-3 text-muted-foreground transition-opacity group-open:opacity-0" />
              <ChevronDown className="w-3 h-3 text-muted-foreground transition-opacity absolute inset-0 opacity-0 group-open:opacity-100" />
            </div>
            <Folder className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
            <span className="truncate">
              {highlight(node.name || "/", needle || "")}
            </span>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatBytes(node.size)}
          </span>
        </summary>
        <div className="ml-4 space-y-0.5">
          {node.children?.map((child) => (
            <FileTreeItem
              key={child.path || child.name}
              node={child}
              onSelectFile={onSelectFile}
              selectedPath={selectedPath}
              highlightText={needle}
              level={level + 1}
              allCollapsed={allCollapsed}
            />
          ))}
        </div>
      </details>
    );
  }
);

export function FileTree({
  tree,
  onSelectFile,
  selectedPath,
  highlightText,
  allCollapsed,
}: {
  tree: PathTreeNode;
  onSelectFile: (p: string) => void;
  selectedPath: string | null;
  highlightText?: string;
  allCollapsed?: boolean;
}) {
  return (
    <FileTreeItem
      node={tree}
      onSelectFile={onSelectFile}
      selectedPath={selectedPath}
      highlightText={highlightText}
      level={0}
      allCollapsed={allCollapsed}
    />
  );
}
