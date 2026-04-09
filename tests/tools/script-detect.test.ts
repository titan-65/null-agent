import { describe, it, expect, beforeAll } from "vite-plus/test";
import { exec as execSync } from "node:child_process";
import { promisify } from "node:util";
import { detectScripts, type DetectedScript } from "../../src/feet/script-detector.ts";

const exec = promisify(execSync);

describe("detectScripts", () => {
  beforeAll(async () => {
    await exec("mkdir -p /tmp/script-detect-test", { cwd: "/tmp" });
  });

  describe("package.json detection", () => {
    it("should detect scripts from package.json", async () => {
      const pkg = {
        name: "test-project",
        scripts: {
          dev: "vite dev",
          build: "vite build",
          test: "vitest",
        },
      };
      await exec(
        `cat > /tmp/script-detect-test/package.json << 'EOF'
${JSON.stringify(pkg, null, 2)}
EOF`,
        { cwd: "/tmp" },
      );

      const scripts = await detectScripts("/tmp/script-detect-test");

      expect(scripts).toContainEqual({
        name: "dev",
        source: "package.json",
        command: "vite dev",
      });
      expect(scripts).toContainEqual({
        name: "build",
        source: "package.json",
        command: "vite build",
      });
      expect(scripts).toContainEqual({
        name: "test",
        source: "package.json",
        command: "vitest",
      });
    });

    it("should return empty array when no scripts in package.json", async () => {
      const pkg = {
        name: "test-project",
        dependencies: {},
      };
      await exec(
        `cat > /tmp/script-detect-test/package.json << 'EOF'
${JSON.stringify(pkg, null, 2)}
EOF`,
        { cwd: "/tmp" },
      );

      const scripts = await detectScripts("/tmp/script-detect-test");
      expect(scripts).toEqual([]);
    });
  });

  describe("Makefile detection", () => {
    it("should detect targets from Makefile", async () => {
      const makefile = `
.PHONY: dev build test

dev:
\tvite dev

build:
\tvite build

test:
\tvitest
`;
      await exec(
        `cat > /tmp/script-detect-test/Makefile << 'EOF'
${makefile}
EOF`,
        { cwd: "/tmp" },
      );

      const scripts = await detectScripts("/tmp/script-detect-test");

      const makeTargets = scripts.filter((s: DetectedScript) => s.source === "Makefile");
      expect(makeTargets).toContainEqual({
        name: "dev",
        source: "Makefile",
        command: "make dev",
      });
      expect(makeTargets).toContainEqual({
        name: "build",
        source: "Makefile",
        command: "make build",
      });
      expect(makeTargets).toContainEqual({
        name: "test",
        source: "Makefile",
        command: "make test",
      });
    });

    it("should not include PHONY, INCLUDE, export as targets", async () => {
      const makefile = `
.PHONY: dev
INCLUDE = common.mk
export BUILD_DIR = ./dist
`;
      await exec(
        `cat > /tmp/script-detect-test/Makefile << 'EOF'
${makefile}
EOF`,
        { cwd: "/tmp" },
      );

      const scripts = await detectScripts("/tmp/script-detect-test");
      const names = scripts.map((s: DetectedScript) => s.name);

      expect(names).not.toContain("PHONY");
      expect(names).not.toContain("INCLUDE");
      expect(names).not.toContain("export");
    });
  });

  describe("no scripts found", () => {
    it("should return empty array if no package.json or Makefile exists", async () => {
      await exec("rm -rf /tmp/script-detect-test/*", { cwd: "/tmp" });

      const scripts = await detectScripts("/tmp/script-detect-test");
      expect(scripts).toEqual([]);
    });
  });
});
