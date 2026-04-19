import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Network, Zap, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateArtifact } from '../tools/llmService';

export const Generate: React.FC = () => {
  const { state, updateGeneration, updateGenerationMeta } = useAppContext();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

  const artifacts = [
    { id: 'user_story', title: 'User Story with sub task', subtitle: 'Feature-driven breakdown' },
    { id: 'test_plan', title: 'Test Plan', subtitle: 'Strategic compliance & scope' },
    { id: 'test_strategy', title: 'Test Strategy', subtitle: 'High-level technical approach' },
    { id: 'test_cases', title: 'Test Cases (Zephyr style)', subtitle: 'Gherkin-ready step definitions' },
    { id: 'automation_code', title: 'Automation code (Playwright/Selenium)', subtitle: 'Synthesize executable script scaffolds based on UI context' },
    { id: 'bug', title: 'Bug Report', subtitle: 'Structured defect report (Requires Logs & Screenshots)' }
  ];

  const handleToggle = (id: string) => {
    const current = state.generation.targetArtifacts;
    if (current.includes(id)) {
      updateGeneration({ targetArtifacts: current.filter(t => t !== id) });
    } else {
      updateGeneration({ targetArtifacts: [...current, id] });
    }
  };

  const generateArtifacts = async () => {
    if (!state.fetchedRequirement) {
      setError('No requirement fetched. Go back to the Fetch tab first.');
      return;
    }
    if (state.generation.targetArtifacts.length === 0) {
      setError('Select at least one artifact to generate.');
      return;
    }

    if (state.generation.targetArtifacts.includes('bug')) {
      const files = state.fetchReq.uploadedFiles || [];
      const hasLogs = files.some(f => f.type === 'log');
      const hasScreenshots = files.some(f => f.type === 'image');
      const hasContext = state.fetchReq.additionalContext.trim().length > 0;
      if (!hasLogs || !hasScreenshots || !hasContext) {
        setError('Bug creation failed: Logs, screenshots, and an additional text context are mandatory in the Fetch tab.');
        return;
      }
    }

    setIsGenerating(true);
    setError('');
    const total = state.generation.targetArtifacts.length;
    setProgress({ done: 0, total });

    const newResults: Record<string, string> = {};
    let totalTokens = 0;
    let totalDuration = 0;

    try {
      for (let i = 0; i < state.generation.targetArtifacts.length; i++) {
        const artifactId = state.generation.targetArtifacts[i];
        setCurrentArtifact(artifactId);
        setProgress({ done: i, total });

        let contextWithFiles = state.fetchReq.additionalContext;
        const files = state.fetchReq.uploadedFiles || [];
        if (files.length > 0) {
          const fileMetadata = files.map(f => {
            let desc = `- Attached File: ${f.name} (Type: ${f.type})`;
            if (f.content) {
               desc += `\n   --- CONTENT OF ${f.name} ---\n${f.content.substring(0, 4000)}\n   --- END CONTENT ---`;
            }
            return desc;
          }).join('\n\n');
          contextWithFiles += `\n\n[USER HAS ATTACHED THE FOLLOWING FILES TO THIS REQUEST]\n${fileMetadata}\n[END ATTACHMENTS]`;
        }

        const result = await generateArtifact(
          state.connections,
          artifactId,
          state.fetchedRequirement,
          contextWithFiles
        );

        newResults[artifactId] = result.content;
        totalTokens += result.tokenCount;
        totalDuration += result.durationMs;
      }

      updateGeneration({ generatedResults: { ...state.generation.generatedResults, ...newResults } });
      updateGenerationMeta({
        totalTokens,
        totalDurationMs: totalDuration,
        generatedAt: new Date().toISOString(),
        revision: (state.generationMeta?.revision || 0) + 1
      });

      setProgress({ done: total, total });
      setCurrentArtifact('');
      setIsGenerating(false);

      // Navigate to confirm
      setTimeout(() => navigate('/confirm'), 800);
    } catch (err: any) {
      setError(err?.message || 'Generation failed. Check LLM connection.');
      setIsGenerating(false);
      setCurrentArtifact('');
    }
  };

  const sourceLabel = () => {
    const sources = [];
    if (state.connections.integrationHub.platform === 'jira_cloud') sources.push('Jira Cloud');
    if (state.connections.integrationHub.platform === 'confluence') sources.push('Confluence');
    if (state.connections.integrationHub.platform === 'azure_devops') sources.push('Azure DevOps');
    return sources.join(', ') || 'Not Connected';
  };

  return (
    <div className="animate-fade-in">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <h1 className="page-title">Generation Engine</h1>
      <p className="page-subtitle">Select the intelligent artifacts you wish to synthesize based on the fetched project context.</p>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.5rem', backgroundColor: 'var(--accent-light-blue)', borderRadius: '0.5rem', color: 'var(--primary-blue)' }}>
            <Network size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
              {state.fetchedRequirement
                ? `${state.fetchedRequirement.key}: ${state.fetchedRequirement.title}`
                : 'No Requirement Fetched'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Source: {sourceLabel()}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', backgroundColor: state.fetchedRequirement ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: state.fetchedRequirement ? 'var(--success-green)' : 'var(--error-red)', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: state.fetchedRequirement ? 'var(--success-green)' : 'var(--error-red)' }} />
          {state.fetchedRequirement ? 'SYNCHRONIZED' : 'NO DATA'}
        </div>
      </div>

      <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>SELECT TARGET ARTIFACTS</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {artifacts.map(art => {
          const isSelected = state.generation.targetArtifacts.includes(art.id);
          const isCurrentlyGenerating = isGenerating && currentArtifact === art.id;
          return (
            <div 
              key={art.id} 
              className="card" 
              style={{ 
                padding: '1.5rem', 
                cursor: isGenerating ? 'default' : 'pointer', 
                backgroundColor: isSelected ? 'var(--accent-light-blue)' : 'var(--card-bg)',
                borderColor: isCurrentlyGenerating ? 'var(--warning-orange)' : isSelected ? 'var(--primary-blue)' : 'var(--border-color)',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                opacity: isGenerating && !isSelected ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
              onClick={() => !isGenerating && handleToggle(art.id)}
            >
              <div style={{ 
                width: '1.25rem', height: '1.25rem', border: `2px solid ${isSelected ? 'var(--primary-blue)' : 'var(--border-color)'}`,
                borderRadius: '4px', backgroundColor: isSelected ? 'var(--primary-blue)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '1rem', color: isSelected ? 'var(--primary-blue)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {art.title}
                  {isCurrentlyGenerating && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--warning-orange)' }} />}
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{art.subtitle}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress Bar */}
      {isGenerating && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Generating {currentArtifact.replace('_', ' ')}...</span>
            <span style={{ fontWeight: 600 }}>{progress.done}/{progress.total}</span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px' }}>
            <div style={{ width: `${(progress.done / progress.total) * 100}%`, height: '100%', backgroundColor: 'var(--primary-blue)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Engine status banner */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', borderRadius: 'var(--radius-lg)', padding: '1.5rem 2rem', marginBottom: '1.5rem', color: 'white' }}>
        <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.25rem 0', opacity: 0.7, color: 'white' }}>ENGINE STATUS</p>
        <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'white' }}>
          {isGenerating ? `Synthesizing ${currentArtifact.replace('_', ' ')}...` : state.fetchedRequirement ? 'AI Ready for Synthesis' : 'Awaiting Requirement Data'}
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button 
          className="btn-primary" 
          style={{ padding: '0.875rem 3rem', fontSize: '1.125rem', minWidth: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} 
          disabled={isGenerating || state.generation.targetArtifacts.length === 0 || !state.fetchedRequirement}
          onClick={generateArtifacts}
        >
          {isGenerating 
            ? <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Synthesizing ({progress.done}/{progress.total})...</>
            : <><Zap size={20} /> Generate Artifacts</>}
        </button>
      </div>

    </div>
  );
};
