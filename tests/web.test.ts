import { describe, expect, it, vi, afterEach } from "vite-plus/test";
import { webSearchTool, webFetchTool } from "../src/tools/web.ts";

describe("webSearchTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when query is missing", async () => {
    const result = await webSearchTool.execute({});
    expect(result.isError).toBe(true);
    expect(result.content).toContain("query");
  });

  it("has correct tool definition shape", () => {
    expect(webSearchTool.name).toBe("web_search");
    expect(webSearchTool.description).toBeTruthy();
    expect(webSearchTool.parameters.required).toContain("query");
    expect(webSearchTool.parameters.properties).toHaveProperty("query");
    expect(webSearchTool.parameters.properties).toHaveProperty("maxResults");
  });
});

describe("webFetchTool", () => {
  it("returns error when url is missing", async () => {
    const result = await webFetchTool.execute({});
    expect(result.isError).toBe(true);
    expect(result.content).toContain("url");
  });

  it("returns error for invalid URL", async () => {
    const result = await webFetchTool.execute({ url: "not-a-url" });
    expect(result.isError).toBe(true);
  });

  it("has correct tool definition shape", () => {
    expect(webFetchTool.name).toBe("web_fetch");
    expect(webFetchTool.description).toBeTruthy();
    expect(webFetchTool.parameters.required).toContain("url");
    expect(webFetchTool.parameters.properties).toHaveProperty("url");
  });
});

describe("Tavily API key resolution", () => {
  it("reads TAVILY_API_KEY from environment variable", async () => {
    process.env.TAVILY_API_KEY = "test-env-key";
    const result = await webSearchTool.execute({ query: "test" });
    // Should not return "not configured" error (will fail with invalid key, but that's fine)
    expect(result.content).not.toContain("TAVILY_API_KEY not configured");
    delete process.env.TAVILY_API_KEY;
  });
});
