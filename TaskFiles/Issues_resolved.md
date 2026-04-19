# Issues Resolved — TestOrchestra

A running log of all bugs, blockers, and issues resolved during development.

---

## ISS-001 · JIRA Cloud CORS — "Connection refused. Check the Instance URL or CORS configuration."

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🔴 Blocker |
| **Component**    | Setup → Integration Hub → Test Connection |
| **Status**       | ✅ Resolved |

### Symptom
Clicking **Test Connection** on the Integration Hub card (Jira Cloud) always failed with:
> *"Connection refused. Check the Instance URL or CORS configuration."*

Despite valid credentials (email + API token) and a correct Instance URL (`https://akanksha6984.atlassian.net`).

### Root Cause
The browser was making **direct `fetch()` calls** from `localhost:5173` to `https://*.atlassian.net`. Jira Cloud (and all Atlassian APIs) **do not include CORS headers** (`Access-Control-Allow-Origin`) for browser-originated requests, so the browser blocked the request at the preflight/network level — before it even reached Jira.

This affected **all external API calls**: Jira Cloud, Confluence, Azure DevOps, GROQ, and Grok.

### Fix
Added a **custom Vite dev-server CORS proxy middleware** that intercepts requests to `/cors-proxy/<base64url-encoded-target-url>`, decodes the real URL, forwards the request **server-side** (where CORS does not apply), and pipes the response back to the browser.

#### Files Changed

| File | Change |
|------|--------|
| `vite.config.ts` | Added `corsProxyPlugin()` — custom Vite middleware that decodes and forwards proxied requests |
| `src/tools/proxyUtil.ts` | **New file** — `proxiedUrl()` utility that base64url-encodes any external URL |
| `src/tools/jiraService.ts` | All Jira/Confluence/Azure DevOps `fetch()` calls wrapped with `proxiedUrl()` |
| `src/tools/llmService.ts` | GROQ and Grok `fetch()` calls wrapped with `proxiedUrl()` (Ollama stays direct — localhost) |
| `src/pages/Setup.tsx` | All Test Connection `fetch()` calls wrapped with `proxiedUrl()` |

### Sub-issue: Content Decoding Error
After initial proxy implementation, responses from Jira caused `ERR_CONTENT_DECODING_FAILED`. Root cause: the browser's `Accept-Encoding: gzip, br` header was forwarded to the upstream API, which responded with compressed data. Node's `fetch()` auto-decompresses, but the `Content-Encoding` header was still forwarded to the browser — causing a mismatch.

**Fix:** Stripped `accept-encoding` from forwarded request headers and `content-encoding` / `content-length` from relayed response headers.

### Verification
✅ `SYNC STATUS: Connected` — `Connected as akanksha6984.`

---

## ISS-002 · LLM Model Name Not Validated — Any name shows "Connected"

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🟡 Major |
| **Component**    | Setup → LLM Connection → Test Connection |
| **Status**       | ✅ Resolved |

### Symptom
Clicking **Test Connection** on the LLM card (GROQ/Grok/Ollama) showed "Connected" regardless of what model name was entered. A completely invalid model name like `asdfghjkl` would still pass.

### Root Cause
The test connection logic only verified API key validity by hitting the models endpoint — it never checked whether the entered model name existed in the returned list.

### Fix
Updated `testLlmConnection()` in `Setup.tsx` to:
1. Require a non-empty Model Name before testing
2. Fetch the available models list from the provider
3. Check if the entered model name exists in the response (`data.data[].id` for GROQ/Grok, `data.models[].name` for Ollama)
4. On mismatch: show error with up to 5 available model names as suggestions
5. On match: confirm `"Model <name> confirmed available."`

#### Files Changed

| File | Change |
|------|--------|
| `src/pages/Setup.tsx` | `testLlmConnection()` — added model existence validation for all 3 providers |

---

## ISS-003 · GROQ/Grok Endpoint URL Required Manual Entry

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🟢 Minor (UX) |
| **Component**    | Setup → LLM Connection → Provider Tabs |
| **Status**       | ✅ Resolved |

### Symptom
Users had to manually type the Endpoint URL for GROQ (`https://api.groq.com`) and Grok (`https://api.x.ai`), even though these are fixed, well-known cloud endpoints.

### Fix
- **Auto-fill** the Endpoint URL when switching provider tabs (GROQ → `https://api.groq.com`, Grok → `https://api.x.ai`, Ollama → `http://localhost:11434`)
- **Read-only** field with `(auto-configured)` label for cloud providers
- Ollama endpoint remains editable for custom host/port

#### Files Changed

| File | Change |
|------|--------|
| `src/pages/Setup.tsx` | Provider tab `onClick` now sets `endpointUrl` from `defaultEndpoints` map; input field is `readOnly` for non-Ollama |

## ISS-004 · Feature Removal: Grok

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🔵 Task |
| **Component**    | Global |
| **Status**       | ✅ Resolved |

### Objective
Remove the 'Grok' LLM integration feature completely from the application.

### Fix
Removed all references, types, UI components, and API integration methods related to Grok across the application layers.

#### Files Changed

| File | Change |
|------|--------|
| `src/context/AppContext.tsx` | Removed `'grok'` from the `provider` union type settings block. |
| `src/pages/Setup.tsx` | Removed the Grok provider selection button, default endpoint auto-fill logic, and the Grok specific test connection block (`callGrok` invocation loop). |
| `src/tools/llmService.ts` | Deleted `callGrok` method entirely and its associated `case 'grok'` block inside `callLLM`. |

## ISS-005 · Deliverables UX & Formats

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🔵 Task |
| **Component**    | Confirm Tab / Deliverables Tab |
| **Status**       | ✅ Resolved |

### Objective
1. Display generated content in a stylized Markdown preview in the Confirm tab instead of raw text.
2. Fix the non-working download button in the Deliverables tab and explicitly support exporting as TXT, PDF, and EXCEL.

### Fix
- Replaced the plaintext renderer in `Confirm.tsx` with `react-markdown` and `remark-gfm` to visualize markdown output correctly.
- Added specific `.markdown-preview` CSS in `index.css` for rendering headers, lists, tables, and code blocks elegantly.
- Implemented lazy loading for `jspdf` and `xlsx` libraries in `Deliverables.tsx`.
- Changed the download UI in `Deliverables.tsx` to a dropdown menu offering TXT, PDF, and EXCEL options, and updated the visual format indicator.

#### Files Changed

| File | Change |
|------|--------|
| `src/pages/Confirm.tsx` | Replaced the raw text `div` with `<ReactMarkdown>` wrapping the content. |
| `src/index.css` | Added global `.markdown-preview` styles ensuring uniform, enterprise-grade typography for the artifacts. |
| `src/pages/Deliverables.tsx` | Adjusted `ARTIFACT_META` format labels, transformed the download button into a toggle-able dropdown, and implemented dynamic exports utilizing `jspdf` and `xlsx`. |

## ISS-006 · Blob URLs Opening Inline Instead of Downloading

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🟡 Major |
| **Component**    | Deliverables Tab |
| **Status**       | ✅ Resolved |

### Symptom
When clicking the updated download buttons for PDF, TXT, or Excel, the browser would open the content in the same/new window as a `blob:http://localhost:5173/uuid` URL rather than actually saving it to the user's Downloads folder.

### Root Cause
1. Some browsers confidently attempt to render `application/pdf` and `text/plain` blobs using built-in viewers.
2. The object URL was being revoked after just 100ms, which abruptly halted the file streaming process for slightly slower system file writes.

### Fix
- Modified the `forceDownload()` utility in `Deliverables.tsx` to automatically rewrap generated Blobs into an `application/octet-stream` MIME type. This tricks the browser into seeing it as an unrecognizable binary file, explicitly forcing the native "Save As..." download mechanism.
- Increased the URL revocation timeout to `5000ms` ensuring zero interruptions during payload delivery.

#### Files Changed

| File | Change |
|------|--------|
| `src/pages/Deliverables.tsx` | Updated `forceDownload()` with `type: 'application/octet-stream'` and bumped teardown timeout. |

## ISS-007 · Native Formatting Logic for Final Deliverables

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🔵 Task |
| **Component**    | Deliverables Tab |
| **Status**       | ✅ Resolved |

### Symptom
While PDF and EXCEL formats were successfully downloading, they looked unpolished because they were just indiscriminately dumping raw Markdown tokens line-by-line as plaintext buffers.

### Fix
- Rebuilt the internal logic for building EXCEL workbooks from Markdown. It now intelligently extracts markdown tables `| column a | column b |`, maps them perfectly into `xlsx` worksheet geometry arrays, silently removes border tokens, and automatically expands column widths based on cell content density.
- Rebuilt the `jsPDF` render module. It now dynamically reads header indicators (`###`), adjusts PDF typesetting to use proportional fonts, sizes, and bolding, calculates automated page breaks dynamically on vertical height margins, and wraps text bounds natively. 

#### Files Changed

| File | Change |
|------|--------|
| `src/pages/Deliverables.tsx` | Massively upgraded `jsPDF` generation loop with pagination and typography control logic. Wrote targeted markdown-table boundary extract heuristics for `XLSX`. |

## ISS-008 · GROQ API Rate Limit (413 Payload Too Large)

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🔴 Blocker |
| **Component**    | Generate Tab / LLM Service |
| **Status**       | ✅ Resolved |

### Symptom
Generating artifacts using the `llama-3.1-8b-instant` model on Groq's free tier sporadically resulted in a `413 Payload Too Large` error, specifically halting with `Limit 6000, Requested 8632` tokens. 

### Root Cause
Groq limits free-tier rate limits via Tokens Per Minute (TPM). Crucially, Groq automatically allocates the `max_tokens` configuration directly against the strict TPM payload *upfront*. Because the application natively requested `max_tokens: 8192` as a buffer, plus the physical text prompt, it mathematically exceeded the maximum allowance immediately on the first query.

### Fix
- Modified the GROQ API `fetch` request parameter, reducing `max_tokens` entirely down to `2500` to secure generation bandwidth.
- Formulated an algorithmic bypass interceptor that calculates total string length of the user context (like massive Jira ticket payloads). If it breaches 10,000 characters, the script forcibly truncates the tail to guarantee successful packet delivery.

#### Files Changed
| File | Change |
|------|--------|
| `src/tools/llmService.ts` | Scaled back maximum token limits and introduced literal prompt cutoff barriers inside `callGroq`. |

## ISS-009 · Removal of "Existing JIRA" UI Component

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🔵 Task |
| **Component**    | Fetch Requirements Tab |
| **Status**       | ✅ Resolved |

### Objective
Deprecate the "Existing JIRA" card selector located inside the Fetch Requirements reference engine, as it violates targeted retrieval architecture.

### Fix
- Re-architected the `FetchReq.tsx` CSS layout grid mapping, explicitly tearing out the UI component and dynamically spreading the remaining "Existing Template" wrapper cleanly across standard single columns.

#### Files Changed
| File | Change |
|------|--------|
| `src/pages/FetchReq.tsx` | Erased internal component mapping and forced `1fr` CSS grid alignment. |

## ISS-010 · Phantom Dates and Excel Styling Constraints

| Field            | Detail |
|------------------|--------|
| **Date**         | 2026-04-18 |
| **Severity**     | 🟡 Major |
| **Component**    | Deliverables Generation Layer |
| **Status**       | ✅ Resolved |

### Symptom
1. Dates across all formats arbitrarily locked into hallucinated LLM variables (e.g. `2023-10-05`).
2. Data paragraphs and bullets in Excel were densely packed against cell boundaries.
3. Excel Headers lacked distinguishing visual design constraints.

### Fix
- **Dates**: Inserted an explicit regular expression intercept in the download engine to manually detect formatted ghost dates inside the text buffers and override them explicitly with the local browser OS actual date.
- **Indentation**: Rebuilt Excel and PDF formatting loops. Added spatial margin buffers `   ` against explicit standard paragraphs, and heavily indented specific markdown bullets `      • `  across boundaries. 
- **Header Formatting**: Added an internal worksheet tracker to isolate specific spreadsheet rows mapped as tables, injecting raw `XLSX` OpenXML syntax (`fgColor: { rgb: "ADD8E6" }`) to construct Light Blue enterprise headers dynamically. 

#### Files Changed
| File | Change |
|------|--------|
| `src/pages/Deliverables.tsx` | Appended Regex timeline replacer logic, upgraded data spacing, and configured OpenXML row style trackers for `ws[addr].s`. |

---

*Add new issues below this line.*
