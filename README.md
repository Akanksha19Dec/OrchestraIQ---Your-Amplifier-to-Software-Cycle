# OrchestraIQ - Test Orchestration Agent

OrchestraIQ is an enterprise-grade AI-powered web application designed to intelligently orchestrate the software testing lifecycle. Using the B.L.A.S.T (Business Layer, Application, Services, Test) framework, it bridges the gap between raw project requirements (from Jira, Confluence, or raw documents) and fully formatted QA deliverables.

## Features

- **Integration Hub Setup**: Seamless configuration interface for Jira Cloud, Confluence, and Azure DevOps integration.
- **LLM Bridging**: Direct integration with local and cloud Large Language Models (Ollama, GROQ) built seamlessly into the browser interface without needing an explicit external backend.
- **Requirement Fetching & Context Synthesis**:
  - Deep-link Jira sequence fetching or Manual JSON proxy abstraction.
  - Multi-source contextual attachment uploading (PRD Documents, Error Logs, and visual observation references).
  - Log text extraction explicitly feeds raw failure logs directly into the LLM intelligence engine.
  - Built-in conditional gating: System actively prevents defect generation if requisite logs and screenshot references are excluded.
- **Artifact Synthesis (Generation Engine)**:
  - Generates deterministic, traceable User Stories with technical subtasks.
  - High-level Test Plans and Test Strategies tailored to specific testing approaches.
  - Zephyr-compliant, Gherkin-ready Test Cases incorporating positive and negative permutations.
  - Dynamic Automation Code Scaffolds (Playwright/TypeScript and Selenium/Java page object models).
  - Formatted Bug Reports strictly matching specific structural enterprise templates.
- **Template Override System**: Adheres to underlying corporate structure defaults, but dynamically adjusts output when overridden by custom uploaded template structures within the Fetch tab.
- **Refinement Validation**: Allows immediate "patch" style prompt reiterations inside the Confirm module before final export.
- **Deliverables Engine**: Robust cross-browser export of finalized QA artifacts into pixel-perfect PDF and explicitly tabulated Excel formats utilizing `pdfmake` and `xlsx` modules.

## Technology Stack

- **Frontend Core**: React 18 + TypeScript + Vite.
- **Styling Architecture**: Pure, high-performance Vanilla CSS with comprehensive CSS variable theming (Dark/Light mode). Built without reliant frameworks like Tailwind for stringent enterprise controls.
- **Architecture Details**:
  - Contextual layer state architecture mapped linearly across 5 primary domains: `/setup`, `/fetch`, `/generate`, `/confirm`, and `/deliverables`.
  - Driven by strict A.N.T (Application, Navigation, Tools) 3-layer compartmentalization structure.
  - Completely persistent intra-session navigation via React Context coupled seamlessly with `sessionStorage`.

## How to Run

### Prerequisites
- **Node.js**: v18 or higher
- **Local LLM**: [Ollama](https://ollama.com/) (Optional - if you intend to execute models completely locally rather than leveraging GROQ/Grok API keys).

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Development Server**
   ```bash
   npm run dev
   ```
   *The application uses Vite and typically launches rapidly at `http://localhost:5173`.*

3. **Production Build**
   ```bash
   npm run build
   ```
   *Compiles the TypeScript application into the `/dist` folder for static deployment.*
