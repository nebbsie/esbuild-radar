import type { PathTreeNode } from "./types";

export type { PathTreeNode };

export function findOptimalRoot(
  files: { path: string; size: number }[]
): string {
  if (files.length === 0) return "";

  const skipPrefixes = [
    "node_modules",
    "src",
    "app",
    "dist",
    "build",
    "public",
  ];

  const allParts: string[][] = files.map((f) =>
    f.path.split("/").filter(Boolean)
  );

  const commonPrefix: string[] = [];
  if (allParts.length > 0) {
    const firstPath = allParts[0];
    for (let i = 0; i < firstPath.length; i++) {
      const part = firstPath[i];
      if (allParts.every((path) => path[i] === part)) {
        commonPrefix.push(part);
      } else {
        break;
      }
    }
  }

  let optimalPrefix = [...commonPrefix];
  for (let i = 0; i < commonPrefix.length; i++) {
    const part = commonPrefix[i];
    if (skipPrefixes.includes(part.toLowerCase())) {
      continue;
    } else {
      optimalPrefix = commonPrefix.slice(i);
      break;
    }
  }

  while (
    optimalPrefix.length > 0 &&
    skipPrefixes.includes(optimalPrefix[0].toLowerCase())
  ) {
    optimalPrefix = optimalPrefix.slice(1);
  }

  if (optimalPrefix.length <= 1) {
    optimalPrefix = commonPrefix;
  }

  return optimalPrefix.join("/");
}

export function buildPathTree(
  files: { path: string; size: number }[],
  useFullPaths = false
): PathTreeNode {
  const optimalRoot = useFullPaths ? "" : findOptimalRoot(files);

  const root: PathTreeNode = {
    name: optimalRoot || "root",
    path: optimalRoot,
    size: 0,
    type: "dir",
    children: [],
  };
  const dirMap = new Map<string, PathTreeNode>();
  dirMap.set(optimalRoot || "", root);

  for (const { path, size } of files) {
    const relativePath =
      optimalRoot && !useFullPaths
        ? path.replace(new RegExp(`^${optimalRoot}/?`), "")
        : path;
    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let currentPath = optimalRoot ? optimalRoot : "";
    let parent = root;
    parent.size += size;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const nextPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        const fileNode: PathTreeNode = { name: part, path, size, type: "file" };
        parent.children!.push(fileNode);
      } else {
        const key = nextPath;
        let dir = dirMap.get(key);
        if (!dir) {
          dir = { name: part, path: key, size: 0, type: "dir", children: [] };
          dirMap.set(key, dir);
          parent.children!.push(dir);
        }
        dir.size += size;
        parent = dir;
      }
      currentPath = nextPath;
    }
  }

  function sortTree(node: PathTreeNode) {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return b.size - a.size;
    });
    for (const child of node.children) sortTree(child);
  }

  sortTree(root);
  return root;
}
