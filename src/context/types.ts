export interface ProjectKnowledge {
  rootDir: string;
  projectName: string;
  language: string;
  framework?: string;
  packageManager?: string;
  isMonorepo: boolean;
  workspacePackages: string[];
  testCommand?: string;
  lintCommand?: string;
  buildCommand?: string;
  keyFiles: string[];
  conventions: ProjectConventions;
}

export interface ProjectConventions {
  fileType: "module" | "commonjs";
  testFramework?: string;
  formatter?: string;
  linter?: string;
  typescript: boolean;
}

export function formatProjectKnowledge(knowledge: ProjectKnowledge): string {
  const lines: string[] = [];

  lines.push(`## Project: ${knowledge.projectName}`);
  lines.push(`Directory: ${knowledge.rootDir}`);
  lines.push(`Language: ${knowledge.language}`);

  if (knowledge.framework) {
    lines.push(`Framework: ${knowledge.framework}`);
  }

  if (knowledge.packageManager) {
    lines.push(`Package Manager: ${knowledge.packageManager}`);
  }

  if (knowledge.isMonorepo) {
    lines.push(`Monorepo: yes (${knowledge.workspacePackages.length} packages)`);
    if (knowledge.workspacePackages.length > 0) {
      lines.push(`Packages: ${knowledge.workspacePackages.join(", ")}`);
    }
  }

  if (knowledge.testCommand) {
    lines.push(`Test Command: ${knowledge.testCommand}`);
  }

  if (knowledge.buildCommand) {
    lines.push(`Build Command: ${knowledge.buildCommand}`);
  }

  if (knowledge.keyFiles.length > 0) {
    lines.push(`Key Files: ${knowledge.keyFiles.join(", ")}`);
  }

  const conv: string[] = [];
  if (knowledge.conventions.typescript) conv.push("TypeScript");
  if (knowledge.conventions.testFramework) conv.push(knowledge.conventions.testFramework);
  if (knowledge.conventions.formatter) conv.push(knowledge.conventions.formatter);
  if (knowledge.conventions.linter) conv.push(knowledge.conventions.linter);
  if (conv.length > 0) {
    lines.push(`Conventions: ${conv.join(", ")}`);
  }

  return lines.join("\n");
}
