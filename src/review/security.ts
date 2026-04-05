import type { ReviewComment, ReviewSeverity } from "./types.ts";

interface SecurityPattern {
  pattern: RegExp;
  severity: ReviewSeverity;
  message: string;
  suggestion?: string;
  category: "security";
}

const SECURITY_PATTERNS: SecurityPattern[] = [
  // Hardcoded secrets
  {
    pattern: /(password|secret|api_key|apikey|token|access_key)\s*=\s*["'][^"']{8,}["']/gi,
    severity: "critical",
    message: "Hardcoded secret detected. Use environment variables or a secrets manager.",
    suggestion: "Move to environment variable or use a secrets manager like AWS Secrets Manager.",
    category: "security",
  },
  // SQL injection
  {
    pattern: /(query|execute|raw)\s*\(\s*["'`].*\$\{.*\}.*["'`]/gi,
    severity: "critical",
    message: "Potential SQL injection. Use parameterized queries.",
    suggestion: "Use parameterized queries or an ORM with built-in sanitization.",
    category: "security",
  },
  // eval()
  {
    pattern: /\beval\s*\(/g,
    severity: "critical",
    message: "eval() is a security risk. Avoid dynamic code execution.",
    suggestion: "Use JSON.parse() for JSON, or Function() with strict validation.",
    category: "security",
  },
  // innerHTML
  {
    pattern: /\.innerHTML\s*=/g,
    severity: "warning",
    message: "innerHTML can lead to XSS. Use textContent or sanitized HTML.",
    suggestion: "Use textContent for plain text, or DOMPurify for HTML.",
    category: "security",
  },
  // console.log with sensitive data
  {
    pattern: /console\.(log|debug|info)\s*\(.*(?:password|secret|token|key|auth)/gi,
    severity: "warning",
    message: "Sensitive data may be logged. Review console output in production.",
    suggestion: "Remove or guard console.log calls that output sensitive data.",
    category: "security",
  },
  // Weak crypto
  {
    pattern: /(md5|sha1|des|rc4|md4)\s*\(/gi,
    severity: "warning",
    message: "Weak cryptographic algorithm. Use SHA-256 or stronger.",
    suggestion: "Use crypto.createHash('sha256') or bcrypt for passwords.",
    category: "security",
  },
  // HTTP not HTTPS
  {
    pattern: /https?:\/\/(?!localhost)[\w.-]+/gi,
    severity: "info",
    message: "Hardcoded URL. Ensure it uses HTTPS in production.",
    suggestion: "Use environment variables for URLs and enforce HTTPS.",
    category: "security",
  },
  // No CSRF protection
  {
    pattern: /csrf|xsrf/i,
    severity: "info",
    message: "CSRF protection mentioned. Ensure it's properly implemented.",
    suggestion: "Use established CSRF libraries like csurf or built-in framework protection.",
    category: "security",
  },
  // TODO/FIXME with security implications
  {
    pattern: /(TODO|FIXME|HACK).*(?:auth|security|password|secret|token)/gi,
    severity: "warning",
    message: "Security-related TODO found. Address before production.",
    suggestion: "Complete this security implementation before deploying.",
    category: "security",
  },
  // No input validation
  {
    pattern: /req\.(body|query|params)\[.*\](?!\s*[.=])/g,
    severity: "info",
    message: "Request parameter used without validation.",
    suggestion: "Validate and sanitize all user input with a library like zod or joi.",
    category: "security",
  },
];

export function analyzeSecurity(code: string, file: string): ReviewComment[] {
  const comments: ReviewComment[] = [];

  const lines = code.split("\n");

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]!;

    for (const pattern of SECURITY_PATTERNS) {
      const match = pattern.pattern.exec(line);
      if (match) {
        comments.push({
          id: `sec-${lineNum}-${pattern.severity}`,
          category: "security",
          severity: pattern.severity,
          file,
          line: lineNum + 1,
          code: line.trim(),
          message: pattern.message,
          suggestion: pattern.suggestion,
        });
      }
    }
  }

  // Check for missing security headers
  if (file.match(/\.ts$/) || file.match(/\.js$/)) {
    if (
      !code.includes("helmet") &&
      !code.includes("x-frame-options") &&
      !code.includes("content-security-policy")
    ) {
      if (code.includes("express") || code.includes("fastify") || code.includes("koa")) {
        comments.push({
          id: "sec-headers",
          category: "security",
          severity: "warning",
          file,
          message: "Web framework detected without security headers.",
          suggestion: "Add helmet middleware for Express or equivalent for your framework.",
        });
      }
    }
  }

  // Check for missing auth middleware
  if (
    file.match(/route|controller|handler/i) &&
    !code.includes("auth") &&
    !code.includes("middleware")
  ) {
    if (code.includes("express") || code.includes("router") || code.includes("handler")) {
      comments.push({
        id: "sec-auth",
        category: "security",
        severity: "info",
        file,
        message: "Route/controller file without visible auth middleware.",
        suggestion: "Ensure authentication middleware is applied to protected routes.",
      });
    }
  }

  return comments;
}
