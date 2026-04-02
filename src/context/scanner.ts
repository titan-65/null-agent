import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import type { ProjectKnowledge, ProjectConventions } from "./types.ts";

export async function scanProject(rootDir: string): Promise<ProjectKnowledge> {
  const projectName = basename(rootDir);

  const [packageJson, dirEntries, tsconfigExists] = await Promise.all([
    readPackageJson(rootDir),
    readdir(rootDir).catch(() => []),
    fileExists(join(rootDir, "tsconfig.json")),
  ]);

  const isMonorepo = detectMonorepo(dirEntries, packageJson);
  const workspacePackages = isMonorepo ? await detectWorkspacePackages(rootDir, dirEntries) : [];

  const language = detectLanguage(packageJson, tsconfigExists);
  const framework = detectFramework(packageJson);
  const packageManager = detectPackageManager(dirEntries, packageJson);
  const conventions = detectConventions(rootDir, packageJson, dirEntries);

  const testCommand = detectCommand(packageJson, "test");
  const buildCommand = detectCommand(packageJson, "build");
  const lintCommand = detectCommand(packageJson, "lint");

  const keyFiles = detectKeyFiles(dirEntries);

  return {
    rootDir,
    projectName,
    language,
    framework,
    packageManager,
    isMonorepo,
    workspacePackages,
    testCommand,
    lintCommand,
    buildCommand,
    keyFiles,
    conventions,
  };
}

async function readPackageJson(dir: string): Promise<Record<string, unknown> | null> {
  try {
    const data = await readFile(join(dir, "package.json"), "utf-8");
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const { access } = await import("node:fs/promises");
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function detectMonorepo(entries: string[], pkg: Record<string, unknown> | null): boolean {
  if (entries.includes("pnpm-workspace.yaml")) return true;
  if (entries.includes("lerna.json")) return true;
  if (entries.includes("nx.json")) return true;
  if (entries.includes("turbo.json")) return true;
  if (pkg && Array.isArray((pkg as { workspaces?: unknown }).workspaces)) return true;
  if (entries.includes("packages") || entries.includes("apps")) return true;
  return false;
}

async function detectWorkspacePackages(rootDir: string, entries: string[]): Promise<string[]> {
  const packages: string[] = [];

  for (const dir of ["packages", "apps", "libs"]) {
    if (entries.includes(dir)) {
      try {
        const subdirs = await readdir(join(rootDir, dir));
        for (const subdir of subdirs) {
          const hasPackageJson = await fileExists(join(rootDir, dir, subdir, "package.json"));
          if (hasPackageJson) {
            packages.push(`${dir}/${subdir}`);
          }
        }
      } catch {
        // skip
      }
    }
  }

  return packages;
}

function detectLanguage(pkg: Record<string, unknown> | null, hasTsconfig: boolean): string {
  if (hasTsconfig) return "TypeScript";
  const deps = getDeps(pkg);
  if (deps.has("typescript")) return "TypeScript";
  return "JavaScript";
}

function detectFramework(pkg: Record<string, unknown> | null): string | undefined {
  const deps = getDeps(pkg);

  if (deps.has("next")) return "Next.js";
  if (deps.has("nuxt")) return "Nuxt";
  if (deps.has("@remix-run/react")) return "Remix";
  if (deps.has("astro")) return "Astro";
  if (deps.has("svelte")) return "Svelte";
  if (deps.has("vue")) return "Vue";
  if (deps.has("react")) return "React";
  if (deps.has("@angular/core")) return "Angular";
  if (deps.has("express")) return "Express";
  if (deps.has("fastify")) return "Fastify";
  if (deps.has("hono")) return "Hono";
  if (deps.has("nestjs")) return "NestJS";

  return undefined;
}

function detectPackageManager(
  entries: string[],
  pkg: Record<string, unknown> | null,
): string | undefined {
  if (pkg && typeof pkg["packageManager"] === "string") {
    return pkg["packageManager"] as string;
  }
  if (entries.includes("pnpm-lock.yaml")) return "pnpm";
  if (entries.includes("yarn.lock")) return "yarn";
  if (entries.includes("bun.lockb")) return "bun";
  if (entries.includes("package-lock.json")) return "npm";
  return undefined;
}

async function detectConventions(
  rootDir: string,
  pkg: Record<string, unknown> | null,
  entries: string[],
): Promise<ProjectConventions> {
  const deps = getDeps(pkg);
  const allDeps = new Set(deps);

  let testFramework: string | undefined;
  if (allDeps.has("vitest") || allDeps.has("vite-plus")) testFramework = "vitest";
  else if (allDeps.has("jest")) testFramework = "jest";
  else if (allDeps.has("mocha")) testFramework = "mocha";
  else if (allDeps.has("ava")) testFramework = "ava";

  let formatter: string | undefined;
  if (allDeps.has("prettier")) formatter = "prettier";
  else if (allDeps.has("biome")) formatter = "biome";
  else if (allDeps.has("dprint")) formatter = "dprint";

  let linter: string | undefined;
  if (allDeps.has("eslint")) linter = "eslint";
  else if (allDeps.has("biome")) linter = "biome";
  else if (allDeps.has("oxlint")) linter = "oxlint";

  const fileType = pkg && (pkg as { type?: string }).type === "module" ? "module" : "commonjs";

  return {
    fileType,
    testFramework,
    formatter,
    linter,
    typescript: allDeps.has("typescript") || entries.includes("tsconfig.json"),
  };
}

function detectCommand(pkg: Record<string, unknown> | null, name: string): string | undefined {
  if (!pkg) return undefined;
  const scripts = pkg["scripts"] as Record<string, string> | undefined;
  if (!scripts) return undefined;
  return scripts[name];
}

function detectKeyFiles(entries: string[]): string[] {
  const important = [
    "README.md",
    "package.json",
    "tsconfig.json",
    ".gitignore",
    "Dockerfile",
    "docker-compose.yml",
    "Makefile",
    ".env.example",
  ];
  return entries.filter((e) => important.includes(e));
}

function getDeps(pkg: Record<string, unknown> | null): Set<string> {
  if (!pkg) return new Set();
  const deps = new Set<string>();
  const sections = ["dependencies", "devDependencies", "peerDependencies"];
  for (const section of sections) {
    const sectionDeps = pkg[section] as Record<string, string> | undefined;
    if (sectionDeps) {
      for (const name of Object.keys(sectionDeps)) {
        deps.add(name);
      }
    }
  }
  return deps;
}
