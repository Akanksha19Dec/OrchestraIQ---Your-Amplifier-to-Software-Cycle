/**
 * CORS Proxy Utility
 * B.L.A.S.T Layer 3 — Tools
 *
 * Encodes target URLs for the Vite dev-server CORS proxy middleware.
 * All external API calls (Jira, Confluence, Azure DevOps) route through
 * /cors-proxy/<base64url-encoded-target-url> to bypass browser CORS.
 */

/**
 * Wraps a target URL through the local CORS proxy.
 *
 * @param targetUrl The full external URL to proxy (e.g. https://acme.atlassian.net/rest/api/3/myself)
 * @returns A localhost-relative URL that the Vite middleware will forward
 */
export function proxiedUrl(targetUrl: string): string {
  // Base64url encode: replace + → -, / → _, strip trailing =
  const encoded = btoa(targetUrl)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `/cors-proxy/${encoded}`;
}
