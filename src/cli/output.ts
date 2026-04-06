import { VERSION } from "../version.ts";

const GRAY = "\x1b[90m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

export function printAssistant(text: string): void {
  process.stdout.write(`\n${text}\n\n`);
}

export function printToolCall(name: string, args: Record<string, unknown>): void {
  const argsStr = JSON.stringify(args);
  const truncated = argsStr.length > 80 ? argsStr.slice(0, 77) + "..." : argsStr;
  console.log(`${GRAY}  ${YELLOW}⚙ ${name}${RESET}${GRAY} ${truncated}${RESET}`);
}

export function printToolResult(name: string, result: string, isError: boolean): void {
  const prefix = isError ? `${RED}✗` : `${GREEN}✓`;
  const truncated = result.length > 120 ? result.slice(0, 117) + "..." : result;
  console.log(`${GRAY}  ${prefix} ${name}${RESET}${GRAY} → ${truncated}${RESET}`);
}

export function printWelcome(provider: string, model: string): void {
  console.log(`
${BOLD}null-agent${RESET} ${GRAY}v${VERSION}${RESET}
${GRAY}Provider: ${provider} | Model: ${model}${RESET}
${GRAY}Type your message or /exit to quit, /clear to clear history.${RESET}
`);
}

export function printError(message: string): void {
  console.error(`${RED}Error: ${message}${RESET}`);
}
