import React, { createContext, useContext, useState, useEffect } from 'react';
import type { FetchedRequirement } from '../tools/jiraService';

// Data Schemas from gemini.md
export interface ConnectionSettings {
  llmConnection: {
    provider: 'ollama' | 'groq' | '';
    endpointUrl: string;
    modelName: string;
    apiKey: string;
  };
  integrationHub: {
    platform: 'jira_cloud' | 'confluence' | 'azure_devops' | '';
    instanceUrl: string;
    userEmail: string;
    apiToken: string;
  };
}

export interface FetchRequirementState {
  jiraOrConfluenceLink: string;
  additionalContext: string;
  existingTemplate: string;
  existingJira: string;
  uploadedFiles: Array<{ name: string; type: 'document' | 'log' | 'image' | 'template'; content?: string }>;
}

export interface GenerationContext {
  targetArtifacts: string[];
  generatedResults: Record<string, string>;
}

export interface GenerationMeta {
  totalTokens: number;
  totalDurationMs: number;
  generatedAt: string;
  revision: number;
}

interface AppState {
  connections: ConnectionSettings;
  fetchReq: FetchRequirementState;
  fetchedRequirement: FetchedRequirement | null;
  generation: GenerationContext;
  generationMeta: GenerationMeta;
  theme: 'light' | 'dark';
}

interface AppContextProps {
  state: AppState;
  updateConnections: (conns: Partial<ConnectionSettings>) => void;
  updateFetchReq: (req: Partial<FetchRequirementState>) => void;
  setFetchedRequirement: (req: FetchedRequirement | null) => void;
  updateGeneration: (gen: Partial<GenerationContext>) => void;
  updateGenerationMeta: (meta: Partial<GenerationMeta>) => void;
  toggleTheme: () => void;
}

const defaultState: AppState = {
  connections: {
    llmConnection: { provider: 'ollama', endpointUrl: 'http://localhost:11434', modelName: 'llama3:latest', apiKey: '' },
    integrationHub: { platform: 'jira_cloud', instanceUrl: '', userEmail: '', apiToken: '' }
  },
  fetchReq: { jiraOrConfluenceLink: '', additionalContext: '', existingTemplate: '', existingJira: '', uploadedFiles: [] },
  fetchedRequirement: null,
  generation: { targetArtifacts: [], generatedResults: {} },
  generationMeta: { totalTokens: 0, totalDurationMs: 0, generatedAt: '', revision: 0 },
  theme: 'light'
};

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    const saved = sessionStorage.getItem('orchestraiq_state');
    return saved ? JSON.parse(saved) : defaultState;
  });

  useEffect(() => {
    sessionStorage.setItem('orchestraiq_state', JSON.stringify(state));
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state]);

  const updateConnections = (conns: Partial<ConnectionSettings>) => {
    setState(prev => ({ ...prev, connections: { ...prev.connections, ...conns } }));
  };

  const updateFetchReq = (req: Partial<FetchRequirementState>) => {
    setState(prev => ({ ...prev, fetchReq: { ...prev.fetchReq, ...req } }));
  };

  const setFetchedRequirement = (req: FetchedRequirement | null) => {
    setState(prev => ({ ...prev, fetchedRequirement: req }));
  };

  const updateGeneration = (gen: Partial<GenerationContext>) => {
    setState(prev => ({ ...prev, generation: { ...prev.generation, ...gen } }));
  };

  const updateGenerationMeta = (meta: Partial<GenerationMeta>) => {
    setState(prev => ({ ...prev, generationMeta: { ...prev.generationMeta, ...meta } }));
  };

  const toggleTheme = () => {
    setState(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  };

  return (
    <AppContext.Provider value={{ state, updateConnections, updateFetchReq, setFetchedRequirement, updateGeneration, updateGenerationMeta, toggleTheme }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
