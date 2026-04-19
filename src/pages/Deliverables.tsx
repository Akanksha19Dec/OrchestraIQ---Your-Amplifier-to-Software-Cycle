import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { FileText, Code, Eye, Shield, Download, RefreshCw, ChevronRight, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { marked } from 'marked';
import html2canvas from 'html2canvas';

// Mount globally for jsPDF internal reference in modular bundlers
(window as any).html2canvas = html2canvas;

const ARTIFACT_META: Record<string, { icon: React.ReactNode; description: string; formats: string }> = {
  user_story: {
    icon: <FileText size={20} />,
    description: 'Feature-driven user stories with acceptance criteria and subtasks.',
    formats: 'TXT, PDF, EXCEL'
  },
  test_plan: {
    icon: <BarChart3 size={20} />,
    description: 'Comprehensive mapping of functional requirements to technical test vectors.',
    formats: 'TXT, PDF, EXCEL'
  },
  test_strategy: {
    icon: <Shield size={20} />,
    description: 'High-level technical approach covering all test levels and automation.',
    formats: 'TXT, PDF, EXCEL'
  },
  test_cases: {
    icon: <FileText size={20} />,
    description: 'Gherkin-ready step definitions in Zephyr-compatible format.',
    formats: 'TXT, PDF, EXCEL'
  },
  automation_code: {
    icon: <Code size={20} />,
    description: 'Playwright and Selenium-ready executable scripts for CI/CD injection.',
    formats: 'TXT, PDF, EXCEL'
  }
};

export const Deliverables: React.FC = () => {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<string | null>(null);

  const generatedKeys = Object.keys(state.generation.generatedResults);
  const generatedCount = generatedKeys.length;
  const totalTokens = state.generationMeta?.totalTokens || 0;
  const totalDuration = state.generationMeta?.totalDurationMs || 0;
  const revision = state.generationMeta?.revision || 0;
  const generatedAt = state.generationMeta?.generatedAt;

  // Compute a health score based on how many artifacts are generated vs selected
  const selectedCount = state.generation.targetArtifacts.length;
  const healthScore = selectedCount > 0 ? Math.round((generatedCount / selectedCount) * 100) : 0;

  const forceDownload = async (blob: Blob, filename: string) => {
    // Determine strict mime type
    const mimeType = 'application/octet-stream';
    const downloadBlob = new Blob([blob], { type: mimeType });

    // 1. Try Native File System API (Works beautifully in Chrome/Edge on Windows)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
        });
        const writable = await handle.createWritable();
        await writable.write(downloadBlob);
        await writable.close();
        return; // Success!
      } catch (err: any) {
        // If the user just cancelled the dialog, stop here
        if (err.name === 'AbortError') return;
        console.warn('Native Save File API failed, falling back to anchor download:', err);
      }
    }
    
    // 2. Fallback: Convert to Data URI to bypass basic strict isolation
    const reader = new FileReader();
    reader.onload = function() {
      const dataUrl = reader.result as string;
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      
      // Dispatch standard click
      a.click();
      
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
      }, 1000);
    };
    reader.readAsDataURL(downloadBlob);
  };

  const handleDownload = (key: string, format: 'txt' | 'pdf' | 'excel') => {
    let content = state.generation.generatedResults[key];
    if (!content) return;

    // Automatically correct LLM hallucinated dates to today's actual runtime date
    const today = new Date().toISOString().split('T')[0];
    content = content.replace(/202[0-9]-[0-9]{2}-[0-9]{2}/g, today);

    if (format === 'txt') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      forceDownload(blob, `${key}.txt`);
    } else if (format === 'pdf') {
      try {
        const htmlContent = marked.parse(content);
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '555px'; // Exact unscaled width mapped to A4 printable area
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '0';
        tempDiv.style.top = '0';
        tempDiv.style.zIndex = '-9999';
        tempDiv.style.backgroundColor = '#ffffff';
        tempDiv.style.fontFamily = 'Helvetica, Arial, sans-serif';
        tempDiv.style.fontSize = '11px';
        tempDiv.style.color = '#0f172a';
        tempDiv.style.lineHeight = '1.5';
        
        tempDiv.innerHTML = `
          <style>
            * { box-sizing: border-box; }
            h1, h2, h3, h4 { margin-top: 16px; margin-bottom: 8px; color: #0f172a; font-family: Helvetica, sans-serif; page-break-after: avoid; }
            p { margin-bottom: 10px; margin-left: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 16px; page-break-inside: auto; table-layout: fixed; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 10px; word-wrap: break-word; vertical-align: top; }
            th { background-color: #f8fafc; font-weight: bold; width: 25%; color: #0f172a; }
            td { width: 75%; }
            ul, ol { margin-bottom: 10px; padding-left: 24px; }
            li { margin-bottom: 4px; }
            hr { border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0; }
          </style>
          <div>${htmlContent}</div>
        `;
        document.body.appendChild(tempDiv);

        // Explicitly wait for browser reflow/fonts to settle before capturing the canvas
        setTimeout(() => {
          const doc = new jsPDF('p', 'pt', 'a4');
          doc.html(tempDiv, {
            callback: function (pdf) {
              const pdfBlob = pdf.output('blob');
              forceDownload(pdfBlob, `${key}.pdf`);
              document.body.removeChild(tempDiv);
            },
            x: 20,
            y: 20,
            width: 555,
            windowWidth: 555,
            margin: [20, 20, 20, 20],
            autoPaging: 'text',
            html2canvas: { scale: 1.0, useCORS: true, logging: false }
          }).catch(err => {
            document.body.removeChild(tempDiv);
            console.error("PDF Export rendering error:", err);
            alert("Failed to render PDF format natively. See console for details.");
          });
        }, 150);
      } catch (e) {
        console.error("PDF Export error:", e);
        alert("Failed to generate PDF. See console for details.");
      }
    } else if (format === 'excel') {
      try {
        const rows: any[][] = [];
        const lines = content.split('\n');
        let inTable = false;
        const headerRows: number[] = [];
        
        for (let line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
             if (trimmed.includes('---|---') || trimmed.match(/^\|[-\s:]+\|/)) continue;
             if (!inTable) { 
               rows.push([]); 
               inTable = true; 
               headerRows.push(rows.length); // The next row to be pushed is a table header
             }
             const cells = trimmed.split('|').slice(1, -1).map(c => c.trim().replace(/(\*\*|__)/g, ''));
             rows.push(cells);
          } else {
             if (inTable) { inTable = false; rows.push([]); } // Spacing after table
             
             if (trimmed !== '') {
               let cleanLine = trimmed;
               cleanLine = cleanLine.replace(/(\*\*|__)/g, '').replace(/(\*|_)/g, '');
               
               if (cleanLine.match(/^#{1,6}\s/)) {
                  cleanLine = cleanLine.replace(/^#{1,6}\s/, '').toUpperCase();
                  if (rows.length > 0 && rows[rows.length - 1].length > 0) rows.push([]); // Gap before header
                  rows.push([cleanLine]);
               } else if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
                  cleanLine = '      • ' + cleanLine.substring(2); // Indent list items
                  rows.push([cleanLine]);
               } else {
                  rows.push(['   ' + cleanLine]); // Indent standard text
               }
             } else {
               if (rows.length > 0 && rows[rows.length - 1].length > 0) {
                 rows.push([]);
               }
             }
          }
        }
        
        const ws = XLSX.utils.aoa_to_sheet(rows);
        
        // Attempt to apply light blue styling to header rows natively if sheetJS version supports it
        headerRows.forEach(r => {
          for(let c = 0; c < 20; c++) {
            const addr = XLSX.utils.encode_cell({c, r});
            if(ws[addr]) {
              ws[addr].s = {
                fill: { fgColor: { rgb: "ADD8E6" }, patternType: "solid" },
                font: { bold: true }
              };
            }
          }
        });
        
        const colWidths = [];
        for(let r of rows) {
          for(let i=0; i<r.length; i++) {
             let len = r[i] ? r[i].toString().length : 10;
             if(!colWidths[i]) colWidths[i] = {wch: 15};
             if(len > colWidths[i].wch) colWidths[i].wch = Math.min(len + 2, 80);
          }
        }
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Deliverables");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        forceDownload(blob, `${key}.xlsx`);
      } catch (e) {
        console.error("Excel Export error:", e);
        alert("Failed to generate Excel. See console for details.");
      }
    }
    setDownloadMenuOpen(null);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', gap: '2rem' }}>
        
        {/* Main Dashboard Area */}
        <div style={{ flex: 1 }}>
          
          {/* Health Metric Banner */}
          <div className="card" style={{ padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, var(--accent-light-blue) 0%, var(--bg-color) 100%)', border: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem 0' }}>HEALTH METRIC</h3>
                <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                  Orchestration Health <span style={{ color: 'var(--primary-blue)', fontWeight: 700 }}>{healthScore}%</span>
                </h1>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Validation Coverage</span>
                <span style={{ fontWeight: 600 }}>Target: 100%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(37, 99, 235, 0.2)', borderRadius: '4px', marginBottom: '1rem' }}>
                <div style={{ width: `${healthScore}%`, height: '100%', backgroundColor: 'var(--primary-blue)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)' }}/> {generatedCount} Artifacts Generated</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)' }}/> {selectedCount} Selected</span>
              </div>
            </div>
          </div>

          {/* Header + View Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Validated Outputs</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>Generated orchestration assets available for distribution.</p>
            </div>
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-color)', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setViewMode('grid')}
                style={{ padding: '0.375rem 0.75rem', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: viewMode === 'grid' ? 600 : 400, backgroundColor: viewMode === 'grid' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >Grid View</button>
              <button 
                onClick={() => setViewMode('timeline')}
                style={{ padding: '0.375rem 0.75rem', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: viewMode === 'timeline' ? 600 : 400, backgroundColor: viewMode === 'timeline' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'timeline' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >Timeline</button>
            </div>
          </div>

          {generatedCount === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
              <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <h3 style={{ color: 'var(--text-primary)' }}>No Deliverables Generated Yet</h3>
              <p>Start by fetching requirements and generating artifacts.</p>
              <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/fetch')}>Start Flow</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: '1.5rem' }}>
              {generatedKeys.map(key => {
                const meta = ARTIFACT_META[key] || { icon: <FileText size={20} />, description: 'Generated artifact.', formats: 'MD' };
                const contentLength = (state.generation.generatedResults[key] || '').length;
                return (
                  <div key={key} className="card" style={{ padding: '1.5rem', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ padding: '0.5rem', backgroundColor: 'var(--accent-light-blue)', borderRadius: '0.5rem', color: 'var(--primary-blue)' }}>
                        {meta.icon}
                      </div>
                      <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-green)', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>READY</span>
                    </div>
                    <h3 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem 0', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>{meta.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>FORMAT</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{meta.formats}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => navigate('/confirm')} title="View" style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', padding: '4px' }}><Eye size={16} /></button>
                        <div style={{ position: 'relative' }}>
                          <button onClick={(e) => { e.stopPropagation(); setDownloadMenuOpen(downloadMenuOpen === key ? null : key); }} title="Download" style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', padding: '4px' }}><Download size={16} /></button>
                          {downloadMenuOpen === key && (
                            <div style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: '0.5rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden', minWidth: '120px' }}>
                              <button onClick={(e) => { e.stopPropagation(); handleDownload(key, 'txt'); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--text-primary)' }}>TXT</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDownload(key, 'pdf'); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--text-primary)' }}>PDF</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDownload(key, 'excel'); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', background: 'none', border: 'none', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--text-primary)' }}>EXCEL</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                      ~{Math.round(contentLength / 4)} chars
                    </div>
                  </div>
                );
              })}
              
              {/* Add More Placeholder */}
              <div 
                className="card" 
                style={{ padding: '1.5rem', border: '1px dashed var(--border-color)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', cursor: 'pointer' }}
                onClick={() => navigate('/generate')}
              >
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>+</span>
                  <span style={{ fontSize: '0.875rem' }}>Generate More</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Info Panels */}
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '0.5rem', color: 'var(--warning-orange)' }}>
              <RefreshCw size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem 0', textTransform: 'uppercase' }}>LAST SYNC</h3>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {generatedAt ? new Date(generatedAt).toLocaleString() : 'Never'}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Revision {revision}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--accent-light-blue)', borderRadius: '0.5rem', color: 'var(--primary-blue)' }}>
              <BarChart3 size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem 0', textTransform: 'uppercase' }}>GENERATION STATS</h3>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{generatedCount} Asset{generatedCount !== 1 ? 's' : ''} Validated</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>~{totalTokens.toLocaleString()} tokens • {(totalDuration / 1000).toFixed(1)}s</span>
            </div>
          </div>

          {state.fetchedRequirement && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0', textTransform: 'uppercase' }}>SOURCE REQUIREMENT</h3>
              <p style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{state.fetchedRequirement.key}</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>{state.fetchedRequirement.title}</p>
              <button 
                onClick={() => navigate('/fetch')}
                style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                View Details <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
