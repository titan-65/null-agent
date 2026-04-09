import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface DetectedScript {
  name: string;
  source: "package.json" | "Makefile" | "cmake";
  command: string;
  description?: string;
}

export async function detectScripts(projectDir: string): Promise<DetectedScript[]> {
  const scripts: DetectedScript[] = [];

  try {
    const pkgPath = join(projectDir, "package.json");
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content);

    if (pkg.scripts && typeof pkg.scripts === "object") {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        scripts.push({
          name,
          source: "package.json",
          command: command as string,
        });
      }
    }
  } catch {}

  try {
    const makefilePath = join(projectDir, "Makefile");
    const content = await readFile(makefilePath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):?\s*$/);
      if (match) {
        const target = match[1];
        if (!["PHONY", "INCLUDE", "export"].includes(target)) {
          scripts.push({
            name: target,
            source: "Makefile",
            command: `make ${target}`,
          });
        }
      }
    }
  } catch {}

  return scripts;
}
