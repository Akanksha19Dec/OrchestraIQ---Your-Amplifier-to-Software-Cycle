import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Settings, Server, Eye, EyeOff, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { proxiedUrl } from '../tools/proxyUtil';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export const Setup: React.FC = () => {
  const { state, updateConnections } = useAppContext();
  const navigate = useNavigate();

  const [llmTestStatus, setLlmTestStatus] = useState<TestStatus>('idle');
  const [llmTestMessage, setLlmTestMessage] = useState('');
  const [hubTestStatus, setHubTestStatus] = useState<TestStatus>('idle');
  const [hubTestMessage, setHubTestMessage] = useState('');

  const [showLlmKey, setShowLlmKey] = useState(false);
  const [showHubToken, setShowHubToken] = useState(false);

  const handleLlmChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateConnections({
      llmConnection: { ...state.connections.llmConnection, [e.target.name]: e.target.value }
    });
    // Reset status when user edits fields
    if (llmTestStatus !== 'idle') {
      setLlmTestStatus('idle');
      setLlmTestMessage('');
    }
  };

  const handleHubChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    updateConnections({
      integrationHub: { ...state.connections.integrationHub, [e.target.name]: e.target.value }
    });
    // Reset status when user edits fields
    if (hubTestStatus !== 'idle') {
      setHubTestStatus('idle');
      setHubTestMessage('');
    }
  };

  // ─── LLM Test Connection ──────────────────────────────────────────
  const testLlmConnection = async () => {
    const { endpointUrl, provider, apiKey, modelName } = state.connections.llmConnection;

    if (!endpointUrl) {
      setLlmTestStatus('error');
      setLlmTestMessage('Endpoint URL is required.');
      return;
    }
    if (!modelName.trim()) {
      setLlmTestStatus('error');
      setLlmTestMessage('Model Name is required.');
      return;
    }

    setLlmTestStatus('testing');
    setLlmTestMessage('');

    try {
      if (provider === 'ollama') {
        // Ollama: GET /api/tags to list available models
        const res = await fetch(`${endpointUrl.replace(/\/$/, '')}/api/tags`, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          const models: string[] = (data?.models || []).map((m: any) => m.name || m.model || '');
          const modelCount = models.length;

          if (modelCount === 0) {
            setLlmTestStatus('error');
            setLlmTestMessage('Connected, but no models found. Pull a model first (e.g., ollama pull llama3).');
          } else if (!models.some(m => m === modelName.trim() || m.startsWith(modelName.trim()))) {
            setLlmTestStatus('error');
            setLlmTestMessage(`Model "${modelName}" not found. Available: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '…' : ''}`);
          } else {
            setLlmTestStatus('success');
            setLlmTestMessage(`Connected. Model "${modelName}" verified. ${modelCount} model(s) available.`);
          }
        } else {
          setLlmTestStatus('error');
          setLlmTestMessage(`Endpoint returned ${res.status} ${res.statusText}.`);
        }
      } else if (provider === 'groq') {
        // GROQ: GET /openai/v1/models with Bearer token
        if (!apiKey) { setLlmTestStatus('error'); setLlmTestMessage('API Key is required for GROQ.'); return; }
        const res = await fetch(proxiedUrl(`${endpointUrl.replace(/\/$/, '')}/openai/v1/models`), {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          const models: string[] = (data?.data || []).map((m: any) => m.id || '');

          if (!models.includes(modelName.trim())) {
            setLlmTestStatus('error');
            const suggestions = models.filter(m => m.toLowerCase().includes('llama') || m.toLowerCase().includes('mixtral') || m.toLowerCase().includes('gemma')).slice(0, 5);
            setLlmTestMessage(`API key valid, but model "${modelName}" not found. Available: ${(suggestions.length > 0 ? suggestions : models.slice(0, 5)).join(', ')}${models.length > 5 ? '…' : ''}`);
          } else {
            setLlmTestStatus('success');
            setLlmTestMessage(`GROQ verified. Model "${modelName}" confirmed available.`);
          }
        } else if (res.status === 401) {
          setLlmTestStatus('error');
          setLlmTestMessage('Authentication failed. Check API key.');
        } else {
          setLlmTestStatus('error');
          setLlmTestMessage(`GROQ returned ${res.status}. Check API key.`);
        }
      }
    } catch (err: any) {
      setLlmTestStatus('error');
      setLlmTestMessage(err?.message === 'Failed to fetch'
        ? 'Connection refused. Ensure the service is running.'
        : `Error: ${err?.message ?? 'Unknown failure'}`);
    }
  };


  // ─── Integration Hub Test Connection ──────────────────────────────
  const testHubConnection = async () => {
    const { platform, instanceUrl, userEmail, apiToken } = state.connections.integrationHub;

    // Validation
    if (!instanceUrl) { setHubTestStatus('error'); setHubTestMessage('Instance URL is required.'); return; }
    if (!userEmail)   { setHubTestStatus('error'); setHubTestMessage('User Email is required.'); return; }
    if (!apiToken)    { setHubTestStatus('error'); setHubTestMessage('API Token is required.'); return; }

    setHubTestStatus('testing');
    setHubTestMessage('');

    try {
      const baseUrl = instanceUrl.replace(/\/$/, '');

      if (platform === 'jira_cloud') {
        // Jira Cloud: GET /rest/api/3/myself
        const res = await fetch(proxiedUrl(`${baseUrl}/rest/api/3/myself`), {
          headers: {
            'Authorization': `Basic ${btoa(`${userEmail}:${apiToken}`)}`,
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          setHubTestStatus('success');
          setHubTestMessage(`Connected as ${data.displayName || data.emailAddress || userEmail}.`);
        } else if (res.status === 401) {
          setHubTestStatus('error');
          setHubTestMessage('Authentication failed. Verify email and API token.');
        } else if (res.status === 403) {
          setHubTestStatus('error');
          setHubTestMessage('Forbidden. Token may lack required permissions.');
        } else {
          setHubTestStatus('error');
          setHubTestMessage(`Jira returned ${res.status} ${res.statusText}.`);
        }
      } else if (platform === 'confluence') {
        // Confluence Cloud: GET /wiki/rest/api/user/current
        const res = await fetch(proxiedUrl(`${baseUrl}/wiki/rest/api/user/current`), {
          headers: {
            'Authorization': `Basic ${btoa(`${userEmail}:${apiToken}`)}`,
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          setHubTestStatus('success');
          setHubTestMessage(`Connected as ${data.displayName || userEmail}.`);
        } else if (res.status === 401) {
          setHubTestStatus('error');
          setHubTestMessage('Authentication failed. Verify email and API token.');
        } else {
          setHubTestStatus('error');
          setHubTestMessage(`Confluence returned ${res.status} ${res.statusText}.`);
        }
      } else if (platform === 'azure_devops') {
        // Azure DevOps: GET /_apis/projects?api-version=7.0
        const res = await fetch(proxiedUrl(`${baseUrl}/_apis/projects?api-version=7.0`), {
          headers: {
            'Authorization': `Basic ${btoa(`:${apiToken}`)}`,
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          const data = await res.json();
          setHubTestStatus('success');
          setHubTestMessage(`Connected. ${data.count ?? 0} project(s) found.`);
        } else if (res.status === 401 || res.status === 203) {
          setHubTestStatus('error');
          setHubTestMessage('Authentication failed. Verify PAT token.');
        } else {
          setHubTestStatus('error');
          setHubTestMessage(`Azure DevOps returned ${res.status} ${res.statusText}.`);
        }
      }
    } catch (err: any) {
      setHubTestStatus('error');
      setHubTestMessage(
        err?.message === 'Failed to fetch'
          ? 'Connection refused. Verify the Instance URL is correct and the service is reachable.'
          : `Error: ${err?.message ?? 'Unknown failure'}`
      );
    }
  };

  const saveAndProceed = () => {
    navigate('/fetch');
  };

  // ─── Status helpers ───────────────────────────────────────────────
  const statusColor = (status: TestStatus) => {
    switch (status) {
      case 'success': return 'var(--success-green)';
      case 'error':   return 'var(--error-red)';
      case 'testing': return 'var(--warning-orange)';
      default:        return 'var(--text-secondary)';
    }
  };

  const hubSyncLabel = () => {
    switch (hubTestStatus) {
      case 'success': return 'Connected';
      case 'error':   return 'Failed';
      case 'testing': return 'Verifying...';
      default:        return 'Not Connected';
    }
  };

  const renderButtonContent = (status: TestStatus, label: string = 'Test Connection') => {
    switch (status) {
      case 'testing': return <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Verifying...</>;
      case 'success': return <><CheckCircle2 size={16} /> Connected</>;
      case 'error':   return <><XCircle size={16} /> Retry Connection</>;
      default:        return label;
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Inline keyframes for the spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <h1 className="page-title">System Configuration</h1>
      <p className="page-subtitle">Define the core intelligence layers and integration hooks for your automated testing environment.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* ═══ LLM Connection Card ═══ */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--accent-light-blue)', borderRadius: '0.5rem', color: 'var(--primary-blue)' }}>
              <Settings size={24} />
            </div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>LLM Connection</h2>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-color)', padding: '0.25rem', borderRadius: '0.5rem' }}>
            {['ollama', 'groq'].map(provider => {
              const defaultEndpoints: Record<string, string> = {
                ollama: 'http://localhost:11434',
                groq: 'https://api.groq.com'
              };
              return (
              <button
                key={provider}
                onClick={() => { updateConnections({ llmConnection: { ...state.connections.llmConnection, provider: provider as any, endpointUrl: defaultEndpoints[provider] || '' } }); setLlmTestStatus('idle'); setLlmTestMessage(''); }}
                style={{
                  flex: 1, padding: '0.5rem', border: 'none', borderRadius: '0.25rem', cursor: 'pointer',
                  backgroundColor: state.connections.llmConnection.provider === provider ? 'var(--card-bg)' : 'transparent',
                  color: state.connections.llmConnection.provider === provider ? 'var(--primary-blue)' : 'var(--text-secondary)',
                  fontWeight: state.connections.llmConnection.provider === provider ? 600 : 400,
                  boxShadow: state.connections.llmConnection.provider === provider ? 'var(--shadow-sm)' : 'none',
                  textTransform: 'capitalize'
                }}
              >
                {provider === 'groq' ? 'GROQ' : provider.charAt(0).toUpperCase() + provider.slice(1)}
              </button>
            );
            })}
          </div>

          <div className="form-group">
            <label className="form-label">Endpoint URL {state.connections.llmConnection.provider !== 'ollama' && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(auto-configured)</span>}</label>
            <input name="endpointUrl" value={state.connections.llmConnection.endpointUrl} onChange={handleLlmChange} className="form-input" placeholder="http://localhost:11434" readOnly={state.connections.llmConnection.provider !== 'ollama'} style={state.connections.llmConnection.provider !== 'ollama' ? { opacity: 0.7, cursor: 'default' } : {}} />
          </div>

          <div className="form-group">
            <label className="form-label">Model Name</label>
            <input name="modelName" value={state.connections.llmConnection.modelName} onChange={handleLlmChange} className="form-input" placeholder="llama3:latest" />
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <div style={{ position: 'relative' }}>
              <input type={showLlmKey ? 'text' : 'password'} name="apiKey" value={state.connections.llmConnection.apiKey} onChange={handleLlmChange} className="form-input" placeholder="•••••••••••••••••••••" />
              <button onClick={() => setShowLlmKey(!showLlmKey)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
                {showLlmKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <Server size={20} color="var(--warning-orange)" />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>Local Inference detected</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Local models may require higher VRAM for complex orchestration tasks.</p>
            </div>
          </div>

          {/* LLM status message */}
          {llmTestMessage && (
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem', backgroundColor: llmTestStatus === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: statusColor(llmTestStatus), display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              {llmTestStatus === 'success' ? <CheckCircle2 size={14} style={{ marginTop: '2px', flexShrink: 0 }} /> : <XCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />}
              {llmTestMessage}
            </div>
          )}

          <button
            className="btn-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: statusColor(llmTestStatus), borderColor: statusColor(llmTestStatus) }}
            onClick={testLlmConnection}
            disabled={llmTestStatus === 'testing'}
          >
            {renderButtonContent(llmTestStatus)}
          </button>
        </div>

        {/* ═══ Integration Hub Card ═══ */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-color)', borderRadius: '0.5rem', color: 'var(--text-secondary)' }}>
              <Server size={24} />
            </div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Integration Hub</h2>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-color)', padding: '0.25rem', borderRadius: '0.5rem' }}>
            {[{id: 'jira_cloud', label: 'Jira Cloud'}, {id: 'confluence', label: 'Confluence'}, {id: 'azure_devops', label: 'Azure DevOps'}].map(platform => (
              <button
                key={platform.id}
                onClick={() => { updateConnections({ integrationHub: { ...state.connections.integrationHub, platform: platform.id as any } }); setHubTestStatus('idle'); setHubTestMessage(''); }}
                style={{
                  flex: 1, padding: '0.5rem', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.875rem',
                  backgroundColor: state.connections.integrationHub.platform === platform.id ? 'var(--card-bg)' : 'transparent',
                  color: state.connections.integrationHub.platform === platform.id ? 'var(--primary-blue)' : 'var(--text-secondary)',
                  fontWeight: state.connections.integrationHub.platform === platform.id ? 600 : 400,
                  boxShadow: state.connections.integrationHub.platform === platform.id ? 'var(--shadow-sm)' : 'none'
                }}
              >
                {platform.label}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Instance URL</label>
            <input name="instanceUrl" value={state.connections.integrationHub.instanceUrl} onChange={handleHubChange} className="form-input" placeholder="https://your-domain.atlassian.net" />
          </div>

          <div className="form-group">
            <label className="form-label">User Email</label>
            <input name="userEmail" value={state.connections.integrationHub.userEmail} onChange={handleHubChange} className="form-input" placeholder="admin@company.com" />
          </div>

          <div className="form-group">
            <label className="form-label">API Token</label>
            <div style={{ position: 'relative' }}>
              <input type={showHubToken ? 'text' : 'password'} name="apiToken" value={state.connections.integrationHub.apiToken} onChange={handleHubChange} className="form-input" placeholder="•••••••••••••••••••••" />
              <button onClick={() => setShowHubToken(!showHubToken)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
                {showHubToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Dynamic Sync Status Banner */}
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', gap: '0.75rem', marginBottom: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {hubTestStatus === 'testing'
                ? <Loader2 size={18} color="var(--warning-orange)" style={{ animation: 'spin 1s linear infinite' }} />
                : hubTestStatus === 'success'
                  ? <CheckCircle2 size={18} color="var(--success-green)" />
                  : hubTestStatus === 'error'
                    ? <XCircle size={18} color="var(--error-red)" />
                    : <RefreshCw size={18} color="var(--warning-orange)" />}
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>SYNC STATUS</span>
            </div>
            <span style={{ fontSize: '0.875rem', color: statusColor(hubTestStatus), fontWeight: 500 }}>{hubSyncLabel()}</span>
          </div>

          {/* Hub status message */}
          {hubTestMessage && (
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem', backgroundColor: hubTestStatus === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: statusColor(hubTestStatus), display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              {hubTestStatus === 'success' ? <CheckCircle2 size={14} style={{ marginTop: '2px', flexShrink: 0 }} /> : <XCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />}
              {hubTestMessage}
            </div>
          )}

          <button
            className="btn-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: statusColor(hubTestStatus), borderColor: statusColor(hubTestStatus) }}
            onClick={testHubConnection}
            disabled={hubTestStatus === 'testing'}
          >
            {renderButtonContent(hubTestStatus)}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button className="btn-primary" style={{ padding: '0.75rem 3rem', fontSize: '1rem' }} onClick={saveAndProceed}>
          Save Changes
        </button>
      </div>

    </div>
  );
};
