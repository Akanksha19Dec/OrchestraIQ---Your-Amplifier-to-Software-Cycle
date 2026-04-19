/**
 * LLM Service Layer
 * B.L.A.S.T Layer 3 — Tools
 *
 * Sends generation prompts to the configured LLM (Ollama / GROQ / Grok).
 * All calls run directly from the browser.
 */

import type { ConnectionSettings } from '../context/AppContext';
import type { FetchedRequirement } from './jiraService';
import { proxiedUrl } from './proxyUtil';

// ─── Prompt Templates ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an enterprise-grade QA architect. You generate deterministic, traceable artifacts from requirements. Your output must be precise, structured, corporate-level, and free of assumptions. If information is missing, note it explicitly. Use markdown formatting.`;

function getContextBlock(ctx: string) {
  if (!ctx || ctx.trim() === '') return '';
  return `\n## ⚠️ CRITICAL GENERATION OVERRIDE\nYou MUST generate the artifacts specifically for the new feature or instruction requested in the 'Additional Context' below. \nThe 'Source Requirement' above is ONLY provided for syntax, formatting, and environmental baseline reference. Do NOT simply clone or summarize the Source Requirement.\n\n## Additional Context (PRIMARY GENERATION TARGET)\n${ctx}\n`;
}

function buildUserStoryPrompt(req: FetchedRequirement, additionalContext: string): string {
  return `Based on the following requirement, generate an enterprise-level User Story with subtasks in JIRA-compatible format.

## Source Requirement
- **Key**: ${req.key}
- **Title**: ${req.title}
- **Type**: ${req.type}
- **Status**: ${req.status}
- **Description**: ${req.description}

${req.subtasks.length > 0 ? `## Existing Subtasks\n${req.subtasks.map(s => `- ${s.key}: ${s.summary} (${s.status})`).join('\n')}` : ''}

${getContextBlock(additionalContext)}

## Output Requirements
1. Provide EXACTLY ONE (1) User Story. Focus only on the single most critical feature to implement.
2. The Main Heading MUST be strictly the title of the NEW story itself. Do NOT include the Source Requirement's JIRA ID or reference key in the main heading.
3. Use the story format: **As a [role], I want [goal], so that [benefit]**
4. For Acceptance Criteria, you MUST use the exact structure:
   **Acceptance Criteria X: [Name]**
   **Scenario:** [Scenario Description]
   **Given** [precondition]
   **When** [action]
   **Then** [expected result]
5. Include subtasks for the story with estimated story points.
6. Tag the story with priority (P1/P2/P3).`;
}

function buildTestPlanPrompt(req: FetchedRequirement, additionalContext: string): string {
  return `Based on the following requirement, generate a comprehensive enterprise-level Test Plan.

## Source Requirement
- **Key**: ${req.key}
- **Title**: ${req.title}
- **Description**: ${req.description}

${getContextBlock(additionalContext)}

## Required Sections
1. Objective & Scope (Inclusions / Exclusions)
2. Test Strategy (Functional, Regression, Integration, Performance)
3. Entry & Exit Criteria
4. Test Environment & Tools
5. Risk Assessment & Mitigation
6. Test Schedule & Milestones
7. Defect Management Process
8. Test Deliverables`;
}

function buildTestStrategyPrompt(req: FetchedRequirement, additionalContext: string): string {
  return `Based on the following requirement, generate a high-level enterprise Test Strategy document.

## Source Requirement
- **Key**: ${req.key}
- **Title**: ${req.title}
- **Description**: ${req.description}

${getContextBlock(additionalContext)}

## Required Sections
1. Testing Approach & Philosophy
2. Testing Levels (Unit, Integration, System, UAT)
3. Testing Types (Functional, Non-Functional, Security, Performance)
4. Automation Strategy & Tool Selection
5. CI/CD Integration Points
6. Defect Triage Process
7. Metrics & Reporting
8. Roles & Responsibilities`;
}

function buildTestCasesPrompt(req: FetchedRequirement, additionalContext: string): string {
  return `Based on the following requirement, generate detailed test cases in Zephyr-compatible format with Gherkin-ready step definitions.

## Source Requirement
- **Key**: ${req.key}
- **Title**: ${req.title}
- **Description**: ${req.description}

${req.subtasks.length > 0 ? `## Subtasks\n${req.subtasks.map(s => `- ${s.key}: ${s.summary}`).join('\n')}` : ''}

${getContextBlock(additionalContext)}

## Output Format (for EACH test case)
| Field | Value |
|---|---|
| TC ID | TC-XXX |
| Summary | ... |
| Priority | P1/P2/P3 |
| Preconditions | ... |
| Steps (Given/When/Then) | ... |
| Expected Result | ... |
| Test Data | ... |

Include both positive and negative test scenarios. Cover edge cases and boundary conditions.`;
}

function buildAutomationCodePrompt(req: FetchedRequirement, additionalContext: string): string {
  return `Based on the following requirement, generate automation test code scaffolds for both Playwright (TypeScript) and Selenium (Java) using Page Object Model.

## Source Requirement
- **Key**: ${req.key}
- **Title**: ${req.title}
- **Description**: ${req.description}

${getContextBlock(additionalContext)}

## Output Requirements
1. **Playwright (TypeScript)**: Page Object class + test spec file
2. **Selenium (Java + TestNG)**: Page Object class + test class
3. Use best practices:
   - Page Object Model with PageFactory (Selenium)
   - Locator strategies: prefer data-testid, then CSS, then XPath
   - No Thread.sleep() — use explicit waits
   - Proper assertions and error handling
   - TestNG annotations (Selenium) / test blocks (Playwright)`;
}

function buildBugReportPrompt(req: FetchedRequirement, additionalContext: string): string {
  return `Based on the following requirement, logs, screenshots, and context, generate a structured Bug Report following the exact template provided below.

## Source Context
- **Key**: ${req.key}
- **Title**: ${req.title}
- **Description**: ${req.description}

${getContextBlock(additionalContext)}

## Formatting Template Constraints
You must strictly follow this exact format for the defect:

JIRA Heading --> [Clear defect title]

Description

Given: [Precondition leading to the bug]

When: [Action performed]

Expected Outcome: [What should have happened]

Actual Outcome: [What actually happened in the failure]

Logs (error screenshot): [Synthesized error context from logs/screenshots in the additional context]

Root Cause: [Inferred or stated root cause]

Possible Fix: [Suggested technical remediation]`;
}

const PROMPT_BUILDERS: Record<string, (req: FetchedRequirement, ctx: string) => string> = {
  user_story: buildUserStoryPrompt,
  test_plan: buildTestPlanPrompt,
  test_strategy: buildTestStrategyPrompt,
  test_cases: buildTestCasesPrompt,
  automation_code: buildAutomationCodePrompt,
  bug: buildBugReportPrompt,
};

// ─── LLM Callers ────────────────────────────────────────────────────

async function callOllama(
  endpointUrl: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `${endpointUrl.replace(/\/$/, '')}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      options: { temperature: 0.2 }
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.message?.content || '';
}

async function callGroq(
  endpointUrl: string,
  modelName: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // Automatically truncate extremely massive prompts to stay under free-tier 6k TPM limits
  const safePrompt = userPrompt.length > 10000 
    ? userPrompt.substring(0, 10000) + '\n\n[TRUNCATED DUE TO TPM LIMIT ALGORITHM]' 
    : userPrompt;

  const url = `${endpointUrl.replace(/\/$/, '')}/openai/v1/chat/completions`;
  const res = await fetch(proxiedUrl(url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: safePrompt }
      ],
      temperature: 0.2,
      // Groq explicitly charges max_tokens directly against the TPM limit at initialization
      max_tokens: 2500
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GROQ ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}



async function callLLM(
  connections: ConnectionSettings,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const { provider, endpointUrl, modelName, apiKey } = connections.llmConnection;

  if (!endpointUrl) throw new Error('LLM endpoint URL not configured. Complete Setup first.');
  if (!modelName) throw new Error('LLM model name not configured. Complete Setup first.');

  switch (provider) {
    case 'ollama':
      return callOllama(endpointUrl, modelName, systemPrompt, userPrompt);
    case 'groq':
      if (!apiKey) throw new Error('API Key required for GROQ.');
      return callGroq(endpointUrl, modelName, apiKey, systemPrompt, userPrompt);

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export interface GenerationResult {
  artifactId: string;
  content: string;
  tokenCount: number;
  durationMs: number;
}

/**
 * Generate a single artifact using the configured LLM.
 */
export async function generateArtifact(
  connections: ConnectionSettings,
  artifactId: string,
  requirement: FetchedRequirement,
  additionalContext: string
): Promise<GenerationResult> {
  const promptBuilder = PROMPT_BUILDERS[artifactId];
  if (!promptBuilder) {
    throw new Error(`Unknown artifact type: ${artifactId}`);
  }

  const userPrompt = promptBuilder(requirement, additionalContext);
  const start = performance.now();
  const content = await callLLM(connections, SYSTEM_PROMPT, userPrompt);
  const durationMs = Math.round(performance.now() - start);

  // Rough token estimate (1 token ≈ 4 chars)
  const tokenCount = Math.round((SYSTEM_PROMPT.length + userPrompt.length + content.length) / 4);

  return { artifactId, content, tokenCount, durationMs };
}

/**
 * Refine an existing artifact based on user instructions.
 */
export async function refineArtifact(
  connections: ConnectionSettings,
  currentContent: string,
  refinementInstructions: string
): Promise<string> {
  const userPrompt = `Here is the current generated artifact content:

---
${currentContent}
---

Apply the following refinement instructions and return the COMPLETE updated artifact:

${refinementInstructions}

Return the full updated artifact in markdown format. Do not summarize or truncate.`;

  return callLLM(connections, SYSTEM_PROMPT, userPrompt);
}
