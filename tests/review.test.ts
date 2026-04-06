import { expect, test } from "vite-plus/test";
import { analyzeSecurity } from "../src/review/security.ts";
import { analyzePerformance } from "../src/review/performance.ts";
import { analyzeQuality } from "../src/review/quality.ts";
import { calculateOverallScore } from "../src/review/types.ts";
import type { ReviewComment, CategoryScore } from "../src/review/types.ts";

// Security analyzer tests
test("detects hardcoded secrets", () => {
  const code = `const apiKey = "sk-1234567890abcdef";`;
  const comments = analyzeSecurity(code, "test.ts");
  expect(comments.length).toBeGreaterThan(0);
  expect(comments[0]?.severity).toBe("critical");
});

test("detects eval usage", () => {
  const code = `eval(userInput);`;
  const comments = analyzeSecurity(code, "test.ts");
  expect(comments.length).toBeGreaterThan(0);
  expect(comments[0]?.message).toContain("eval()");
});

test("detects innerHTML", () => {
  const code = `element.innerHTML = userInput;`;
  const comments = analyzeSecurity(code, "test.ts");
  expect(comments.length).toBeGreaterThan(0);
  expect(comments[0]?.message).toContain("XSS");
});

test("detects console.log with sensitive data", () => {
  const code = `console.log(password);`;
  const comments = analyzeSecurity(code, "test.ts");
  expect(comments.length).toBeGreaterThan(0);
});

test("no issues on clean code", () => {
  const code = `function add(a: number, b: number) { return a + b; }`;
  const comments = analyzeSecurity(code, "test.ts");
  expect(comments).toHaveLength(0);
});

// Performance analyzer tests
test("detects N+1 query pattern", () => {
  const code = `for (const id of ids) { await db.find(id); }`;
  const comments = analyzePerformance(code, "test.ts");
  expect(comments.length).toBeGreaterThan(0);
  expect(comments[0]?.message).toContain("N+1");
});

test("detects sync file operations", () => {
  const code = `readFileSync("data.txt");`;
  const comments = analyzePerformance(code, "test.ts");
  expect(comments.length).toBeGreaterThan(0);
  expect(comments[0]?.message).toContain("Synchronous");
});

test("detects chained array methods", () => {
  const code = `data.map(x => x).filter(y => y).reduce((a, b) => a + b, 0);`;
  const comments = analyzePerformance(code, "test.ts");
  expect(comments.length).toBeGreaterThan(0);
});

// Quality analyzer tests
test("detects long functions", () => {
  const code = "function test() { " + "a = 1;\n".repeat(100) + "}";
  const comments = analyzeQuality(code, "test.ts");
  expect(comments.length).toBeGreaterThan(0);
  expect(comments.some((c) => c.message.includes("too long"))).toBe(true);
});

test("detects any type", () => {
  const code = `function test(x: any) { return x; }`;
  const comments = analyzeQuality(code, "test.ts");
  expect(comments.some((c) => c.message.includes("any"))).toBe(true);
});

test("detects empty catch block", () => {
  const code = `try { doSomething(); } catch (e) {}`;
  const comments = analyzeQuality(code, "test.ts");
  expect(comments.some((c) => c.severity === "critical")).toBe(true);
});

test("detects var usage", () => {
  const code = `var x = 1;`;
  const comments = analyzeQuality(code, "test.ts");
  expect(comments.some((c) => c.message.includes("var"))).toBe(true);
});

test("no issues on clean code", () => {
  const code = `const add = (a: number, b: number): number => a + b;`;
  const comments = analyzeQuality(code, "test.ts");
  expect(comments).toHaveLength(0);
});

// Scoring tests
test("calculateOverallScore returns 100 for no issues", () => {
  const categories: CategoryScore[] = [
    { category: "security", score: 100, maxScore: 100, comments: [] },
    { category: "performance", score: 100, maxScore: 100, comments: [] },
  ];
  const score = calculateOverallScore(categories);
  expect(score).toBe(100);
});

test("calculateOverallScore reduces for issues", () => {
  const categories: CategoryScore[] = [
    { category: "security", score: 80, maxScore: 100, comments: [] },
    { category: "performance", score: 90, maxScore: 100, comments: [] },
  ];
  const score = calculateOverallScore(categories);
  expect(score).toBeLessThan(100);
});

test("calculateOverallScore handles empty categories", () => {
  const score = calculateOverallScore([]);
  expect(score).toBe(0);
});
