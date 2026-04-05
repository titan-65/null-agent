import type { ToolResult } from "./types.ts";
import type { ToolDefinition } from "./types.ts";
import { getCredential } from "../auth/index.ts";

const TAVILY_API_URL = "https://api.tavily.com/search";
const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB
const FETCH_TIMEOUT = 30_000; // 30s

async function getTavilyApiKey(): Promise<string | null> {
  if (process.env.TAVILY_API_KEY) return process.env.TAVILY_API_KEY;
  return getCredential("tavily");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateContent(content: string, maxBytes: number): string {
  if (new TextEncoder().encode(content).length <= maxBytes) return content;
  const bytes = new TextEncoder().encode(content);
  return new TextDecoder().decode(bytes.slice(0, maxBytes)) + "\n\n[Content truncated at 1MB]";
}

export const webSearchTool: ToolDefinition = {
  name: "web_search",
  description:
    "Search the web and return extracted content snippets. Use this to find current information, documentation, or answers to questions.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query.",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return. Default: 5. Max: 10.",
        minimum: 1,
        maximum: 10,
      },
    },
    required: ["query"],
  },
  async execute(params): Promise<ToolResult> {
    const query = params["query"] as string | undefined;
    if (!query) {
      return { content: "Error: 'query' parameter is required.", isError: true };
    }

    const apiKey = await getTavilyApiKey();
    if (!apiKey) {
      return {
        content:
          "Error: TAVILY_API_KEY not configured. Set the environment variable or run `null-agent auth tavily`.",
        isError: true,
      };
    }

    const maxResults = Math.min(Math.max(1, (params["maxResults"] as number) ?? 5), 10);

    try {
      const response = await fetch(TAVILY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          include_answer: true,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });

      if (!response.ok) {
        const error = await response.text();
        return { content: `Search failed: HTTP ${response.status} - ${error}`, isError: true };
      }

      const data = (await response.json()) as {
        answer?: string;
        results: Array<{
          title: string;
          url: string;
          content: string;
        }>;
      };

      if (!data.results || data.results.length === 0) {
        return { content: `No results found for '${query}'.`, isError: false };
      }

      const lines: string[] = [];
      if (data.answer) {
        lines.push("**Answer:**", data.answer, "");
      }

      for (const result of data.results) {
        lines.push(`## [${result.title}](${result.url})`, result.content, "");
      }

      return { content: lines.join("\n") };
    } catch (error) {
      return {
        content: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};

export const webFetchTool: ToolDefinition = {
  name: "web_fetch",
  description:
    "Fetch the content of a URL and return it as readable text. Use this to read web pages, documentation, or API responses.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch.",
      },
    },
    required: ["url"],
  },
  async execute(params): Promise<ToolResult> {
    const url = params["url"] as string | undefined;
    if (!url) {
      return { content: "Error: 'url' parameter is required.", isError: true };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { content: `Error: Invalid URL '${url}'.`, isError: true };
    }

    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });

      if (!response.ok) {
        return {
          content: `Error: HTTP ${response.status} for '${url}'.`,
          isError: true,
        };
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      const truncated = truncateContent(text, MAX_RESPONSE_SIZE);

      if (contentType.includes("html")) {
        return { content: stripHtml(truncated) };
      }

      return { content: truncated };
    } catch (error) {
      return {
        content: `Error: Failed to fetch '${url}': ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  },
};
