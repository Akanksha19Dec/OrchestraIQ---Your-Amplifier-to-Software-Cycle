import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Custom CORS-proxy middleware for the Vite dev server.
 *
 * The browser cannot call Jira / Confluence / Azure DevOps directly due to
 * CORS restrictions. This middleware intercepts requests to:
 *
 *   /cors-proxy/<base64url-encoded-target-url>
 *
 * …decodes the real URL, forwards the request server-side (where CORS does
 * not apply), and pipes the response back to the browser.
 *
 * This keeps the A.N.T architectural invariant: no separate backend —
 * the Vite dev-server is the only server process.
 */
function corsProxyPlugin() {
  return {
    name: 'cors-proxy',
    configureServer(server: any) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const prefix = '/cors-proxy/';
        if (!req.url || !req.url.startsWith(prefix)) {
          return next();
        }

        // ── Decode the target URL ─────────────────────────────────
        const encoded = req.url.slice(prefix.length);
        let targetUrl: string;
        try {
          // Use base64url decoding (replace URL-safe chars first)
          const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
          targetUrl = Buffer.from(base64, 'base64').toString('utf-8');
          // Validate it's a real URL
          new URL(targetUrl);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid encoded URL in proxy path.' }));
          return;
        }

        // ── Handle CORS preflight ─────────────────────────────────
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
            'Access-Control-Max-Age': '86400',
          });
          res.end();
          return;
        }

        // ── Forward the request ───────────────────────────────────
        try {
          // Collect request body (if any)
          const bodyChunks: Buffer[] = [];
          for await (const chunk of req) {
            bodyChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined;

          // Build forwarded headers — drop host/origin (they'd leak localhost)
          // Also drop accept-encoding to prevent compression mismatch
          // (Node fetch auto-decompresses, so we must not forward content-encoding)
          const forwardHeaders: Record<string, string> = {};
          for (const [key, val] of Object.entries(req.headers)) {
            const lower = key.toLowerCase();
            if (['host', 'origin', 'referer', 'connection', 'transfer-encoding', 'accept-encoding'].includes(lower)) continue;
            if (val) forwardHeaders[key] = Array.isArray(val) ? val.join(', ') : val;
          }

          const upstream = await fetch(targetUrl, {
            method: req.method || 'GET',
            headers: forwardHeaders,
            body: body && body.length > 0 ? body : undefined,
            // @ts-ignore — duplex required for Node 18+ fetch with body
            duplex: body && body.length > 0 ? 'half' : undefined,
          });

          // ── Relay the response ──────────────────────────────────
          const responseHeaders: Record<string, string> = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': '*',
          };
          upstream.headers.forEach((value, key) => {
            const lower = key.toLowerCase();
            // Skip hop-by-hop, CORS, and encoding headers (Node fetch already decompressed)
            if (['transfer-encoding', 'connection', 'access-control-allow-origin', 'content-encoding', 'content-length'].includes(lower)) return;
            responseHeaders[key] = value;
          });

          res.writeHead(upstream.status, responseHeaders);

          if (upstream.body) {
            // Stream the response body
            const reader = upstream.body.getReader();
            const pump = async () => {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
              res.end();
            };
            await pump();
          } else {
            res.end();
          }
        } catch (err: any) {
          const status = err?.cause?.code === 'ECONNREFUSED' ? 502 : 500;
          res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({
            error: `Proxy error: ${err?.message || 'Unknown failure'}`,
            code: err?.cause?.code || 'UNKNOWN',
          }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), corsProxyPlugin()],
})
