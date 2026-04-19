import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Cloud, Link as LinkIcon, FileText, CheckCircle2, Loader2, AlertCircle, UploadCloud, File, Image, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchRequirement } from '../tools/jiraService';

export const FetchReq: React.FC = () => {
  const { state, updateFetchReq, setFetchedRequirement } = useAppContext();
  const navigate = useNavigate();
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchSuccess, setFetchSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateFetchReq({ [e.target.name]: e.target.value });
    setFetchError('');
    setFetchSuccess('');
  };

  const handleContinue = async () => {
    const hasContent = state.fetchReq.jiraOrConfluenceLink.trim() || state.fetchReq.additionalContext.trim() || (state.fetchReq.uploadedFiles?.length || 0) > 0;
    if (!hasContent) {
      setFetchError('Please provide at least one content source (JIRA link, document, or context text).');
      return;
    }

    setIsFetching(true);
    setFetchError('');
    setFetchSuccess('');

    try {
      let result;
      if (state.fetchReq.jiraOrConfluenceLink.trim()) {
        if (!state.connections.integrationHub.instanceUrl) {
          setFetchError('Integration Hub not configured. Go to Setup first.');
          setIsFetching(false);
          return;
        }
        result = await fetchRequirement(state.connections, state.fetchReq.jiraOrConfluenceLink);
      } else {
        // Fallback or "manual" requirement if only attachments/context provided
        result = {
          key: 'CTX-' + Math.floor(Math.random() * 1000),
          title: 'Custom Context Document',
          description: state.fetchReq.additionalContext || 'Generated from attachments.',
          type: 'Story',
          status: 'Open',
          subtasks: []
        };
      }
      setFetchedRequirement(result);
      setFetchSuccess(`Fetched: ${result.key} — ${result.title}`);
      // Auto-navigate after short delay so user sees confirmation
      setTimeout(() => navigate('/generate'), 1200);
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to fetch requirement.');
      setFetchedRequirement(null);
    } finally {
      setIsFetching(false);
    }
  };

  const platformLabel = () => {
    switch (state.connections.integrationHub.platform) {
      case 'jira_cloud': return 'Atlassian Cloud (Jira)';
      case 'confluence': return 'Atlassian Cloud (Confluence)';
      case 'azure_devops': return 'Azure DevOps';
      default: return 'Not Configured';
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: '2rem' }}>
      <div style={{ flex: 1 }}>
        <h1 className="page-title">Fetch Requirement</h1>
        <p className="page-subtitle">Identify the core requirements and specifications from your enterprise toolset.</p>

        <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ background: 'var(--card-bg)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <Cloud color="var(--primary-blue)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{platformLabel()}</h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Instance: {state.connections.integrationHub.instanceUrl || 'Not Configured'}</p>
            </div>
          </div>
          <button onClick={() => navigate('/setup')} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontWeight: 600, cursor: 'pointer' }}>Change ↔</button>
        </div>

        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="form-group">
            <label className="form-label">JIRA ID or Confluence Link</label>
            <div style={{ position: 'relative' }}>
              <LinkIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                name="jiraOrConfluenceLink" 
                value={state.fetchReq.jiraOrConfluenceLink} 
                onChange={handleChange} 
                className="form-input" 
                style={{ paddingLeft: '2.5rem' }}
                placeholder="e.g. QA-4502 or https://confluence.corp.com/..." 
              />
            </div>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={12} color="var(--primary-blue)"/> Paste any deep link or valid issue key from the connected instance.</p>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Additional Context</label>
            <textarea 
              name="additionalContext" 
              value={state.fetchReq.additionalContext} 
              onChange={handleChange} 
              className="form-input" 
              rows={4}
              placeholder="Specify any specific testing focus, edge cases, or platform-specific requirements..."
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Attachments (PRDs, Logs, Screenshots)</label>
            <div style={{ border: '2px dashed var(--border-color)', borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--card-bg)' }}>
               <input type="file" id="file-upload" multiple style={{ display: 'none' }} onChange={async (e) => {
                  if (e.target.files) {
                    const newFiles = await Promise.all(Array.from(e.target.files).map(async f => {
                      let type: 'document' | 'log' | 'image' | 'template' = 'document';
                      if (f.name.endsWith('.log') || f.name.endsWith('.txt')) type = 'log';
                      else if (f.type.startsWith('image/')) type = 'image';
                      
                      let content = undefined;
                      if (type === 'log') {
                        try {
                          content = await f.text();
                        } catch(err) {
                          console.error('Could not read log file', err);
                        }
                      }
                      return { name: f.name, type, content };
                    }));
                    const current = state.fetchReq.uploadedFiles || [];
                    updateFetchReq({ uploadedFiles: [...current, ...newFiles] as any });
                  }
               }} />
               <label htmlFor="file-upload" style={{ cursor: 'pointer', color: 'var(--primary-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                 <UploadCloud size={20} /> Browse Files
               </label>
               <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Upload PRDs (pdf, docx), Logs (.log, .txt) or Screenshots (.png, .jpg)</p>
            </div>
            {(state.fetchReq.uploadedFiles || []).filter(f => f.type !== 'template').length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(state.fetchReq.uploadedFiles || []).filter(f => f.type !== 'template').map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: 'var(--bg-color)', borderRadius: '0.25rem', border: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {f.type === 'image' ? <Image size={16} /> : f.type === 'log' ? <FileText size={16} /> : <File size={16} />}
                      {f.name}
                    </div>
                    <button onClick={() => {
                      const files = state.fetchReq.uploadedFiles || [];
                      updateFetchReq({ uploadedFiles: files.filter((_, idx) => idx !== files.indexOf(f)) as any });
                    }} style={{ background: 'none', border: 'none', color: 'var(--error-red)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Templates & References</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <FileText size={20} color="var(--primary-blue)" />
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Default Templates</h4>
            </div>
            <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--text-secondary)' }}>Using repository defaults for User Story, Test Plan, Test Strategy, and Bug formatting unless overridden below.</p>
            
            <div style={{ marginTop: '1rem', border: '1px dashed var(--border-color)', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center', backgroundColor: 'var(--card-bg)' }}>
               <input type="file" id="template-upload" style={{ display: 'none' }} onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    const current = state.fetchReq.uploadedFiles || [];
                    updateFetchReq({ uploadedFiles: [...current, { name: f.name, type: 'template' }] as any });
                  }
               }} />
               <label htmlFor="template-upload" style={{ cursor: 'pointer', color: 'var(--primary-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                 <UploadCloud size={16} /> Upload Custom Template
               </label>
            </div>
            {(state.fetchReq.uploadedFiles || []).filter(f => f.type === 'template').length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(state.fetchReq.uploadedFiles || []).filter(f => f.type === 'template').map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: '0.25rem', border: '1px solid var(--success-green)', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-green)' }}>
                      <CheckCircle2 size={16} /> {f.name}
                    </div>
                    <button onClick={() => {
                      const files = state.fetchReq.uploadedFiles || [];
                      updateFetchReq({ uploadedFiles: files.filter((_, idx) => idx !== files.indexOf(f)) as any });
                    }} style={{ background: 'none', border: 'none', color: 'var(--error-red)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {fetchError && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> {fetchError}
          </div>
        )}
        {fetchSuccess && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--success-green)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} /> {fetchSuccess}
          </div>
        )}

        <button 
          className="btn-primary" 
          style={{ padding: '0.875rem 2rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} 
          onClick={handleContinue}
          disabled={isFetching}
        >
          {isFetching ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Fetching from {platformLabel()}...</> : 'Continue to Intelligence Agent'}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      </div>
      
      {/* Sidebar Info Panel */}
      <div style={{ width: '300px' }}>
        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-color)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--warning-orange)' }}>💡</span> Smart Tips
          </h3>
          <ul style={{ paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li>Using direct JIRA IDs allows the orchestrator to fetch associated sub-tasks and comments.</li>
            <li>Additional context helps the AI prioritize "Must-Have" features over "Nice-to-Have" logic.</li>
          </ul>
        </div>
        
        {/* Show fetched data preview if available */}
        {state.fetchedRequirement && (
          <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-color)' }}>
            <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>Fetched Data Preview</h3>
            <div style={{ fontSize: '0.8125rem' }}>
              <p><strong>{state.fetchedRequirement.key}</strong>: {state.fetchedRequirement.title}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Type: {state.fetchedRequirement.type} • Status: {state.fetchedRequirement.status}</p>
              {state.fetchedRequirement.subtasks.length > 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>{state.fetchedRequirement.subtasks.length} subtask(s) found</p>
              )}
            </div>
          </div>
        )}

        {!state.fetchedRequirement && (
          <div style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Activity</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No recent fetches in this session.</p>
          </div>
        )}
      </div>
    </div>
  );
};
