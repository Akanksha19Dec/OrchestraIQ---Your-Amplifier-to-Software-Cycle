import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { FileText, Copy, Download, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { refineArtifact } from '../tools/llmService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const Confirm: React.FC = () => {
  const { state, updateGeneration, updateGenerationMeta } = useAppContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(state.generation.targetArtifacts[0] || null);
  const [refinement, setRefinement] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState('');
  const [refineSuccess, setRefineSuccess] = useState('');

  const handleApplyRefinements = async () => {
    if (!activeTab || !refinement.trim()) return;

    setIsRefining(true);
    setRefineError('');
    setRefineSuccess('');

    try {
      const currentContent = state.generation.generatedResults[activeTab] || '';
      const refined = await refineArtifact(state.connections, currentContent, refinement);

      updateGeneration({
        generatedResults: {
          ...state.generation.generatedResults,
          [activeTab]: refined
        }
      });
      updateGenerationMeta({
        revision: (state.generationMeta?.revision || 0) + 1
      });

      setRefinement('');
      setRefineSuccess('Refinements applied successfully.');
    } catch (err: any) {
      setRefineError(err?.message || 'Refinement failed.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleCopyToClipboard = () => {
    const content = activeTab ? state.generation.generatedResults[activeTab] : '';
    if (content) navigator.clipboard.writeText(content);
  };

  const handleDownload = () => {
    const content = activeTab ? state.generation.generatedResults[activeTab] : '';
    if (!content || !activeTab) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentContent = activeTab ? state.generation.generatedResults[activeTab] : '';
  const revision = state.generationMeta?.revision || 1;
  const generatedAt = state.generationMeta?.generatedAt;
  const totalTokens = state.generationMeta?.totalTokens || 0;

  if (!state.generation.targetArtifacts.length || Object.keys(state.generation.generatedResults).length === 0) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2>No Artifacts Generated</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Return to the Generate tab to create artifacts first.</p>
        <button className="btn-primary" onClick={() => navigate('/generate')} style={{ marginTop: '1rem' }}>Go to Generate</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: '2rem' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 className="page-title">Final Validation</h1>
            <p className="page-subtitle">Review the orchestrated output. Ensure all edge cases and security protocols are accurately captured before proceeding.</p>
          </div>
          <div style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            REVISION {String(revision).padStart(2, '0')} <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>
              {generatedAt ? `Last updated ${new Date(generatedAt).toLocaleTimeString()}` : 'Just now'}
            </span>
          </div>
        </div>

        {/* Tab selector for multiple artifacts */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
          {Object.keys(state.generation.generatedResults).map(art => (
            <button 
              key={art} 
              onClick={() => { setActiveTab(art); setRefineError(''); setRefineSuccess(''); }}
              style={{
                padding: '0.5rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === art ? '2px solid var(--primary-blue)' : 'none',
                color: activeTab === art ? 'var(--primary-blue)' : 'var(--text-secondary)',
                fontWeight: activeTab === art ? 600 : 400,
                textTransform: 'capitalize', whiteSpace: 'nowrap'
              }}
            >
              {art.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--sidebar-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--accent-light-blue)', borderRadius: '0.25rem', color: 'var(--primary-blue)' }}>
                <FileText size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', textTransform: 'capitalize' }}>{activeTab?.replace(/_/g, ' ')}</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Generated via {state.connections.llmConnection.provider.toUpperCase()} — {state.connections.llmConnection.modelName}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleCopyToClipboard} title="Copy to clipboard" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><Copy size={18} /></button>
              <button onClick={handleDownload} title="Download as .md" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><Download size={18} /></button>
            </div>
          </div>
          
          <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.7, maxHeight: '60vh', overflowY: 'auto' }}>
            {currentContent ? (
              <div className="markdown-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentContent}
                </ReactMarkdown>
              </div>
            ) : 'No content generated for this artifact.'}
          </div>
        </div>
      </div>
      
      {/* Refinement Panel */}
      <div style={{ width: '350px' }}>
        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-color)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <RefreshCw size={18} color="var(--primary-blue)" /> Update Instructions
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Provide feedback or specific constraints to adjust the generated content.
          </p>
          <textarea 
            className="form-input" 
            rows={5} 
            placeholder="E.g., 'Add a section for load testing the Redis cache' or 'Change the priority of TC-003 to P1'..."
            value={refinement}
            onChange={(e) => { setRefinement(e.target.value); setRefineError(''); setRefineSuccess(''); }}
            style={{ marginBottom: '1rem', resize: 'vertical' }}
            disabled={isRefining}
          />

          {refineError && (
            <div style={{ padding: '0.5rem', borderRadius: '0.25rem', marginBottom: '0.75rem', fontSize: '0.8125rem', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={14} /> {refineError}
            </div>
          )}
          {refineSuccess && (
            <div style={{ padding: '0.5rem', borderRadius: '0.25rem', marginBottom: '0.75rem', fontSize: '0.8125rem', backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--success-green)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={14} /> {refineSuccess}
            </div>
          )}

          <button 
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} 
            onClick={handleApplyRefinements} 
            disabled={!refinement.trim() || isRefining}
          >
            {isRefining 
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Refining...</>
              : <><RefreshCw size={16} /> Apply Refinements</>}
          </button>
        </div>

        <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-color)' }}>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>GENERATION INSIGHTS</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Model</span>
            <span style={{ fontWeight: 600 }}>{state.connections.llmConnection.modelName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Provider</span>
            <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{state.connections.llmConnection.provider}</span>
          </div>
          <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '0.75rem 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Est. Tokens</span>
            <span style={{ fontWeight: 600 }}>{totalTokens.toLocaleString()}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-color)', borderRadius: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Enterprise Standard</span>
            <span style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-color)', borderRadius: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Security First</span>
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
          <button 
            className="btn-secondary" 
            style={{ border: 'none', color: 'var(--primary-blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', cursor: 'pointer' }} 
            onClick={() => navigate('/deliverables')}
          >
            Confirm & Next →
          </button>
        </div>
      </div>
    </div>
  );
};
