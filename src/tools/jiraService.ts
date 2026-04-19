/**
 * Jira / Confluence / Azure DevOps Service Layer
 * B.L.A.S.T Layer 3 — Tools
 *
 * Fetches issue or page content from the configured integration hub.
 * All calls are routed through the Vite CORS proxy to bypass browser
 * cross-origin restrictions.
 */

import type { ConnectionSettings } from '../context/AppContext';
import { proxiedUrl } from './proxyUtil';

export interface FetchedRequirement {
  key: string;
  title: string;
  description: string;
  status: string;
  type: string;
  subtasks: { key: string; summary: string; status: string }[];
  comments: { author: string; body: string; created: string }[];
  rawJson: Record<string, any>;
}

// ─── Jira Cloud ─────────────────────────────────────────────────────
async function fetchFromJiraCloud(
  baseUrl: string,
  email: string,
  token: string,
  issueKey: string
): Promise<FetchedRequirement> {
  const targetUrl = `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue/${issueKey}?expand=renderedFields`;
  const res = await fetch(proxiedUrl(targetUrl), {
    headers: {
      'Authorization': `Basic ${btoa(`${email}:${token}`)}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira returned ${res.status}: ${body}`);
  }

  const data = await res.json();
  const fields = data.fields;

  // Recursively extract text from Atlassian Document Format (ADF)
  const extractAdfText = (node: any): string => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.type === 'text') return node.text || '';
    if (Array.isArray(node.content)) return node.content.map(extractAdfText).join('\n');
    return '';
  };

  const description =
    fields.description?.type === 'doc'
      ? extractAdfText(fields.description)
      : typeof fields.description === 'string'
        ? fields.description
        : data.renderedFields?.description || 'No description available';

  const subtasks = (fields.subtasks || []).map((st: any) => ({
    key: st.key,
    summary: st.fields?.summary || '',
    status: st.fields?.status?.name || ''
  }));

  // Fetch comments
  let comments: FetchedRequirement['comments'] = [];
  try {
    const commentsUrl = `${baseUrl.replace(/\/$/, '')}/rest/api/3/issue/${issueKey}/comment`;
    const cRes = await fetch(proxiedUrl(commentsUrl), {
      headers: {
        'Authorization': `Basic ${btoa(`${email}:${token}`)}`,
        'Accept': 'application/json'
      }
    });
    if (cRes.ok) {
      const cData = await cRes.json();
      comments = (cData.comments || []).map((c: any) => ({
        author: c.author?.displayName || c.author?.emailAddress || 'Unknown',
        body: c.body?.type === 'doc' ? extractAdfText(c.body) : typeof c.body === 'string' ? c.body : '',
        created: c.created || ''
      }));
    }
  } catch {
    // Non-critical — continue without comments
  }

  return {
    key: data.key,
    title: fields.summary || '',
    description,
    status: fields.status?.name || '',
    type: fields.issuetype?.name || '',
    subtasks,
    comments,
    rawJson: data
  };
}

// ─── Confluence Cloud ───────────────────────────────────────────────
async function fetchFromConfluence(
  baseUrl: string,
  email: string,
  token: string,
  link: string
): Promise<FetchedRequirement> {
  // Extract page ID from URL or use as-is
  let pageId = link;
  const match = link.match(/pages\/(\d+)/);
  if (match) pageId = match[1];

  const targetUrl = `${baseUrl.replace(/\/$/, '')}/wiki/rest/api/content/${pageId}?expand=body.storage,version`;
  const res = await fetch(proxiedUrl(targetUrl), {
    headers: {
      'Authorization': `Basic ${btoa(`${email}:${token}`)}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Confluence returned ${res.status}: ${body}`);
  }

  const data = await res.json();

  // Strip HTML tags from body storage
  const htmlContent = data.body?.storage?.value || '';
  const plainText = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    key: `CONF-${data.id}`,
    title: data.title || '',
    description: plainText,
    status: data.status || 'current',
    type: 'Confluence Page',
    subtasks: [],
    comments: [],
    rawJson: data
  };
}

// ─── Azure DevOps ───────────────────────────────────────────────────
async function fetchFromAzureDevOps(
  baseUrl: string,
  _email: string,
  token: string,
  workItemId: string
): Promise<FetchedRequirement> {
  const id = workItemId.replace(/\D/g, '');
  // Assumes baseUrl is like https://dev.azure.com/{org}/{project}
  const targetUrl = `${baseUrl.replace(/\/$/, '')}/_apis/wit/workitems/${id}?$expand=all&api-version=7.0`;
  const res = await fetch(proxiedUrl(targetUrl), {
    headers: {
      'Authorization': `Basic ${btoa(`:${token}`)}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Azure DevOps returned ${res.status}: ${body}`);
  }

  const data = await res.json();
  const f = data.fields || {};

  return {
    key: `ADO-${data.id}`,
    title: f['System.Title'] || '',
    description: (f['System.Description'] || '').replace(/<[^>]+>/g, ' ').trim(),
    status: f['System.State'] || '',
    type: f['System.WorkItemType'] || '',
    subtasks: [],
    comments: [],
    rawJson: data
  };
}

// ─── Public API ─────────────────────────────────────────────────────
export async function fetchRequirement(
  connections: ConnectionSettings,
  issueKeyOrLink: string
): Promise<FetchedRequirement> {
  const { platform, instanceUrl, userEmail, apiToken } = connections.integrationHub;

  if (!instanceUrl || !userEmail || !apiToken) {
    throw new Error('Integration Hub is not configured. Complete Setup first.');
  }
  if (!issueKeyOrLink.trim()) {
    throw new Error('JIRA ID or Confluence Link is required.');
  }

  switch (platform) {
    case 'jira_cloud':
      return fetchFromJiraCloud(instanceUrl, userEmail, apiToken, issueKeyOrLink.trim());
    case 'confluence':
      return fetchFromConfluence(instanceUrl, userEmail, apiToken, issueKeyOrLink.trim());
    case 'azure_devops':
      return fetchFromAzureDevOps(instanceUrl, userEmail, apiToken, issueKeyOrLink.trim());
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
