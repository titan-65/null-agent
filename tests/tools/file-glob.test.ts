import { describe, it, expect, beforeAll } from "vite-plus/test";
import { fileGlobTool } from "../../src/tools/file-glob.ts";
import { exec as execSync } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execSync);

describe("fileGlobTool", () => {
  beforeAll(async () => {
    await exec(
      "mkdir -p /tmp/fileglob-test/src/components /tmp/fileglob-test/src/utils /tmp/fileglob-test/node_modules",
      {
        cwd: "/tmp",
      },
    );
    await exec(
      "touch /tmp/fileglob-test/src/components/Button.tsx /tmp/fileglob-test/src/components/Modal.tsx /tmp/fileglob-test/src/utils/helpers.ts /tmp/fileglob-test/src/utils/data.json /tmp/fileglob-test/src/index.ts /tmp/fileglob-test/README.md /tmp/fileglob-test/node_modules/lib.js",
      {
        cwd: "/tmp",
      },
    );
  });

  describe("pattern matching", () => {
    it("should find files matching pattern", async () => {
      const result = await fileGlobTool.execute({
        pattern: "**/*.ts",
        rootBoundary: "/tmp/fileglob-test",
      });
      const files = JSON.parse(result.content as string);
      expect(files).toContain("/tmp/fileglob-test/src/utils/helpers.ts");
      expect(files).toContain("/tmp/fileglob-test/src/index.ts");
    });

    it("should match multiple file types", async () => {
      const result = await fileGlobTool.execute({
        pattern: "**/*.tsx",
        rootBoundary: "/tmp/fileglob-test",
      });
      const files = JSON.parse(result.content as string);
      expect(files).toContain("/tmp/fileglob-test/src/components/Button.tsx");
      expect(files).toContain("/tmp/fileglob-test/src/components/Modal.tsx");
    });

    it("should return all matches with **.json pattern", async () => {
      const result = await fileGlobTool.execute({
        pattern: "**/*.json",
        rootBoundary: "/tmp/fileglob-test",
      });
      const files = JSON.parse(result.content as string);
      expect(files.some((f: string) => f.endsWith(".json"))).toBe(true);
    });
  });

  describe("ignore patterns", () => {
    it("should ignore node_modules by default", async () => {
      const result = await fileGlobTool.execute({
        pattern: "**/*.js",
        rootBoundary: "/tmp/fileglob-test",
      });
      const files = JSON.parse(result.content as string);
      expect(files.some((f: string) => f.includes("node_modules"))).toBe(false);
    });

    it("should ignore .git by default", async () => {
      const result = await fileGlobTool.execute({
        pattern: "**/*",
        rootBoundary: "/tmp/fileglob-test",
      });
      const files = JSON.parse(result.content as string);
      expect(files.some((f: string) => f.includes(".git"))).toBe(false);
    });

    it("should support custom ignore patterns", async () => {
      const result = await fileGlobTool.execute({
        pattern: "**/*",
        rootBoundary: "/tmp/fileglob-test",
        options: { ignore: ["**/utils/**"] },
      });
      const files = JSON.parse(result.content as string);
      expect(files.some((f: string) => f.includes("/utils/"))).toBe(false);
    });
  });

  describe("limit option", () => {
    it("should respect limit option", async () => {
      const result = await fileGlobTool.execute({
        pattern: "**/*",
        rootBoundary: "/tmp/fileglob-test",
        options: { limit: 2 },
      });
      const files = JSON.parse(result.content as string);
      expect(files.length).toBeLessThanOrEqual(2);
    });

    it("should return all when limit exceeds matches", async () => {
      const result = await fileGlobTool.execute({
        pattern: "**/*.ts",
        rootBoundary: "/tmp/fileglob-test",
        options: { limit: 100 },
      });
      const files = JSON.parse(result.content as string);
      expect(files.length).toBeGreaterThan(0);
      expect(files.length).toBeLessThanOrEqual(100);
    });
  });

  describe("error handling", () => {
    it("should return error when pattern is missing", async () => {
      const result = await fileGlobTool.execute({} as Record<string, unknown>);
      expect(result.isError).toBe(true);
      expect(result.content).toContain("required");
    });
  });
});
