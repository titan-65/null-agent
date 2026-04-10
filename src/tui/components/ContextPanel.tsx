import { createElement as h, memo, useState, useEffect } from "react";
import { Box, Text } from "ink";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { exec as execSync } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execSync);

interface ContextPanelProps {
  cwd: string;
  gitBranch?: string;
  hasChanges?: boolean;
}

interface FileNode {
  name: string;
  type: "file" | "dir";
  children?: FileNode[];
}

const FILE_COLORS: Record<string, string> = {
  ts: "cyan",
  tsx: "cyan",
  js: "yellow",
  jsx: "yellow",
  json: "yellow",
  md: "green",
  css: "magenta",
  html: "magenta",
};

function getFileColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return FILE_COLORS[ext] || "gray";
}

async function getFileTree(dir: string, depth: number = 2): Promise<FileNode[]> {
  if (depth <= 0) return [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries.slice(0, 10)) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;

      const node: FileNode = {
        name: entry.name,
        type: entry.isDirectory() ? "dir" : "file",
      };

      if (entry.isDirectory() && depth > 1) {
        node.children = await getFileTree(join(dir, entry.name), depth - 1);
      }

      nodes.push(node);
    }

    return nodes;
  } catch {
    return [];
  }
}

async function getRecentFiles(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await exec("git -C . log --oneline --name-only -10", { cwd });
    const files = stdout
      .split("\n")
      .slice(1)
      .filter((line) => line.trim() && !line.includes("/"))
      .slice(0, 5);
    return [...new Set(files)];
  } catch {
    return [];
  }
}

async function getGitStatus(cwd: string): Promise<{ modified: number; staged: number }> {
  try {
    const { stdout } = await exec("git status --porcelain", { cwd });
    const lines = stdout.split("\n").filter((l) => l.trim());
    const modified = lines.filter((l) => l.startsWith(" M") || l.startsWith("??")).length;
    const staged = lines.filter((l) => l.startsWith("M ") || l.startsWith("A ")).length;
    return { modified, staged };
  } catch {
    return { modified: 0, staged: 0 };
  }
}

function renderFileTree(nodes: FileNode[], indent: number = 0): string {
  return nodes
    .map((node) => {
      const prefix = "  ".repeat(indent) + (node.type === "dir" ? "📁 " : "📄 ");
      const children = node.children ? "\n" + renderFileTree(node.children, indent + 1) : "";
      return prefix + node.name + children;
    })
    .join("\n");
}

export const ContextPanel = memo(function ContextPanel({
  cwd,
  gitBranch,
  hasChanges,
}: ContextPanelProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [gitStatus, setGitStatus] = useState<{ modified: number; staged: number }>({
    modified: 0,
    staged: 0,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [tree, recent, status] = await Promise.all([
        getFileTree(cwd, 2),
        getRecentFiles(cwd),
        getGitStatus(cwd),
      ]);

      if (mounted) {
        setFileTree(tree);
        setRecentFiles(recent);
        setGitStatus(status);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [cwd]);

  return h(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "gray",
      paddingX: 1,
      paddingY: 1,
      width: 30,
    },
    h(Text, { bold: true, color: "blue" }, "Context"),
    h(Text, { dimColor: true }, ""),
    h(Text, { bold: true, color: "cyan" }, "Files"),
    fileTree.length > 0
      ? h(Text, { color: "gray" }, renderFileTree(fileTree))
      : h(Text, { color: "gray" }, "  ..."),
    h(Text, { dimColor: true }, ""),
    h(Text, { bold: true, color: "cyan" }, "Recent"),
    recentFiles.length > 0
      ? recentFiles.map((f) => h(Text, { key: f, color: getFileColor(f) }, `  ${f}`))
      : h(Text, { color: "gray" }, "  ..."),
    h(Text, { dimColor: true }, ""),
    h(Text, { bold: true, color: "cyan" }, "Git"),
    gitBranch
      ? h(
          Box,
          { gap: 1 },
          h(Text, { color: "yellow" }, `  ${gitBranch}`),
          hasChanges
            ? h(Text, { color: "red" }, `● ${gitStatus.modified}`)
            : h(Text, { color: "green" }, `✓ ${gitStatus.staged}`),
        )
      : h(Text, { color: "gray" }, "  not a repo"),
  );
});
