# Frontend SOP

## Goals
Establish styling conventions and dynamic behaviors.
- Styling: Vanilla CSS + Variables for themes. No Tailwind CSS.
- Layered logic mapping to B.L.A.S.T. Layer 2.

## Context API Mapping
The source of truth relies on `sessionStorage` alongside React Context to persist across tabs without strict backend presence in 'Setup'.

## Flow Outline
1. /setup – Connect JIRA, LLMs
2. /fetch – Link JIRA, acquire JSON metadata, parse explicit text from uploaded logs, and validate attachment combinations.
3. /generate – Map target artifacts, block execution on missing parameters intuitively, and output to session states
4. /confirm – Markdown editable field layout with patch updates
5. /deliverables – Present dashboard containing past validations
