import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface CIConfig {
  platform: "github" | "gitlab" | "circleci" | "jenkins";
  reviewOnPR?: boolean;
  reviewOnPush?: boolean;
  failOnCritical?: boolean;
  minScore?: number;
  categories?: string[];
}

export async function generateGitHubAction(config: CIConfig = {}): Promise<string> {
  const failOnCritical = config.failOnCritical ?? true;
  const minScore = config.minScore ?? 70;
  const categories = config.categories?.join(", ") ?? "security, performance, quality, testing, best_practices";

  const action = `name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main, master]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install null-agent
        run: npm install -g null-agent

      - name: Run AI Code Review
        run: |
          null-agent "Review the changes in this PR using the code_review tool with scope='staged' and categories=[${categories}]"
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
${failOnCritical ? `
      - name: Check Review Score
        run: |
          SCORE=\$(cat review-score.json | jq -r '.overallScore')
          if [ "\$SCORE" -lt ${minScore} ]; then
            echo "Review score \$SCORE is below minimum ${minScore}"
            exit 1
          fi
` : ""}
      - name: Upload Review Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: code-review-report
          path: review-report.md
`;

  return action;
}

export async function generateGitLabCI(config: CIConfig = {}): Promise<string> {
  const failOnCritical = config.failOnCritical ?? true;
  const minScore = config.minScore ?? 70;

  const ci = `stages:
  - review

ai-code-review:
  stage: review
  image: node:20
  script:
    - npm install -g null-agent
    - null-agent "Review the changes in this MR using the code_review tool"
  variables:
    OPENAI_API_KEY: \$OPENAI_API_KEY
  rules:
    - if: \$CI_PIPELINE_SOURCE == "merge_request_event"
    - if: \$CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH
${failOnCritical ? `
  allow_failure: false
` : ""}
  artifacts:
    when: always
    paths:
      - review-report.md
    reports:
      codequality: review-score.json
`;

  return ci;
}

export async function generatePreCommitHook(content?: string): Promise<string> {
  return content ?? `#!/bin/sh
# null-agent pre-commit hook
# Run AI code review before committing

echo "Running AI code review..."

# Check if null-agent is installed
if ! command -v null-agent &> /dev/null; then
  echo "null-agent not found. Install with: npm install -g null-agent"
  exit 0  # Don't block commits if not installed
fi

# Run review on staged changes
RESULT=\$(null-agent "Review the staged changes using the code_review tool with scope='staged'" 2>&1)

# Check for critical issues
if echo "\$RESULT" | grep -q "critical"; then
  echo "❌ Critical issues found. Please fix before committing."
  echo "\$RESULT"
  exit 1
fi

echo "✅ Code review passed."
exit 0
`;
}

export async function setupCI(config: CIConfig, projectDir: string = process.cwd()): Promise<string[]> {
  const files: string[] = [];

  // Generate CI config based on platform
  switch (config.platform) {
    case "github": {
      const action = await generateGitHubAction(config);
      const githubDir = join(projectDir, ".github", "workflows");
      await mkdir(githubDir, { recursive: true });
      await writeFile(join(githubDir, "review.yml"), action);
      files.push(".github/workflows/review.yml");
      break;
    }
    case "gitlab": {
      const ci = await generateGitLabCI(config);
      await writeFile(join(projectDir, ".gitlab-ci.yml"), ci);
      files.push(".gitlab-ci.yml");
      break;
    }
  }

  // Setup pre-commit hook
  const hook = await generatePreCommitHook();
  const hooksDir = join(projectDir, ".husky");
  await mkdir(hooksDir, { recursive: true });
  await writeFile(join(hooksDir, "pre-commit"), hook);
  files.push(".husky/pre-commit");

  return files;
}
