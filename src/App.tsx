import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';

// Pages
import { Setup } from './pages/Setup';
import { FetchReq } from './pages/FetchReq';
import { Generate } from './pages/Generate';
import { Confirm } from './pages/Confirm';
import { Deliverables } from './pages/Deliverables';

export const App: React.FC = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <div className="content-area">
          <Routes>
            <Route path="/" element={<Navigate to="/setup" replace />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/fetch" element={<FetchReq />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/confirm" element={<Confirm />} />
            <Route path="/deliverables" element={<Deliverables />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
