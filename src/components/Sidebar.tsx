import React from 'react';
import { NavLink } from 'react-router-dom';
import { Settings, DownloadCloud, Sparkles, CheckCircle, Briefcase } from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Sparkles size={24} color="var(--primary-blue)" />
        <h1 className="sidebar-title">OrchestraIQ</h1>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <NavLink to="/setup" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={18} />
          <span>Setup</span>
        </NavLink>
        <NavLink to="/fetch" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <DownloadCloud size={18} />
          <span>Fetch Requirement</span>
        </NavLink>
        <NavLink to="/generate" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Sparkles size={18} />
          <span>Generate</span>
        </NavLink>
        <NavLink to="/confirm" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <CheckCircle size={18} />
          <span>Confirm</span>
        </NavLink>
        <NavLink to="/deliverables" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Briefcase size={18} />
          <span>Deliverables</span>
        </NavLink>
      </nav>
    </aside>
  );
};
