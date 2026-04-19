# Project Constitution

Data schemas, behavioral rules, and architectural invariants.

## Data Schemas

**1. Connection Settings (Setup Phase):**
```json
{
  "llmConnection": {
    "provider": "ollama | groq | grok",
    "endpointUrl": "string",
    "modelName": "string",
    "apiKey": "string"
  },
  "integrationHub": {
    "platform": "jira_cloud | confluence | azure_devops",
    "instanceUrl": "string",
    "userEmail": "string",
    "apiToken": "string"
  }
}
```

**2. Fetch Requirements:**
```json
{
  "jiraOrConfluenceLink": "string",
  "additionalContext": "string",
  "existingTemplate": "boolean | string",
  "existingJira": "boolean | string"
}
```

**3. Generation Context:**
```json
{
  "targetArtifacts": ["user_story", "test_plan", "test_strategy", "test_cases", "automation_code"],
  "generatedResults": {
    "artifactId": "string (content)"
  }
}
```

## Behavioral Rules
- Temperature Low
- Tone limit stringency: Corporate, enterprise level
- Do not make assumptions on functionality. Report missing information if ambiguous.
- Keep dark and light mode toggle button.

## Architectural Invariants
- A.N.T 3-Layer Build (`architecture/`, Navigation, `tools/`)
- Stack: TypeScript, React + Vite
- Source of Truth: Browser session storage (`sessionStorage` / React Context)
- Backend: Frontend talks directly to external APIs and Local models like Ollama.
