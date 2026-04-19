import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const TopBar: React.FC = () => {
  const { state, toggleTheme } = useAppContext();

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
        <button onClick={toggleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {state.theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
        </button>
      </div>
    </header>
  );
};
