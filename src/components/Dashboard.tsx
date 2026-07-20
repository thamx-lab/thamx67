'use client';

import { useState, useRef, useEffect } from 'react';
import { runProcessor, ProcessingJob, ProcessingResult } from '@/lib/pdfProcessor';
import AuthButton from './AuthButton';

export default function Dashboard() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'ok' | 'err' }[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);

  // Presets State
  const [preset, setPreset] = useState<'meesho' | 'flipkart' | 'amazon' | 'halfa4' | 'custom'>('meesho');
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(595);
  const [cropH, setCropH] = useState(350);
  const [scale, setScale] = useState(2);

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const applyPreset = (p: 'meesho' | 'flipkart' | 'amazon' | 'halfa4' | 'custom') => {
    setPreset(p);
    if (p === 'meesho') { setCropX(0); setCropY(0); setCropW(595); setCropH(350); setScale(2); }
    else if (p === 'flipkart') { setCropX(0); setCropY(0); setCropW(595); setCropH(350); setScale(2); }
    else if (p === 'amazon') { setCropX(0); setCropY(0); setCropW(595); setCropH(300); setScale(2); }
    else if (p === 'halfa4') { setCropX(0); setCropY(0); setCropW(595); setCropH(420); setScale(2); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    addFiles(dropped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => {
      const list = [...prev];
      newFiles.forEach(f => {
        if (!list.find(x => x.name === f.name && x.size === f.size)) list.push(f);
      });
      return list;
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRun = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setLogs([]);
    setResults([]);
    setProgress(0);

    const jobs: ProcessingJob[] = files.map(f => ({
      file: f,
      platform: preset,
      settings: { x0: cropX, y0: cropY, w: cropW, h: cropH, scale }
    }));

    const handleLog = (msg: string, type: 'info' | 'ok' | 'err') => {
      setLogs(prev => [...prev, { msg: `${new Date().toLocaleTimeString()} ${msg}`, type }]);
    };

    try {
      const outs = await runProcessor(jobs, setProgress, handleLog);
      setResults(outs);

      // Call Analytics API
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filesProcessed: jobs.length,
          pagesProcessed: outs.reduce((acc, out) => acc + out.pages, 0)
        })
      }).catch(err => console.error('Analytics error', err));
    } catch (e: any) {
      handleLog(`Error: ${e.message}`, 'err');
    }

    setIsProcessing(false);
    handleLog('✅ All files processed successfully. Download your PDFs below.', 'ok');
  };

  const handleClear = () => {
    setFiles([]);
    setLogs([]);
    setResults([]);
    setProgress(0);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✂️ Label Cropper Pro
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            Automated Shipping Label Cropper &amp; SKU Sorting Engine
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AuthButton />
        </div>
      </div>

      {/* Visual Workflow Pipeline */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>
          ⚡ Automated Processing Pipeline
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', overflowX: 'auto' }}>
          <div style={{ textAlign: 'center', minWidth: '80px' }}><div style={{ fontSize: '20px' }}>📤</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>Upload PDFs</div></div>
          <div style={{ color: '#475569' }}>➔</div>
          <div style={{ textAlign: 'center', minWidth: '80px' }}><div style={{ fontSize: '20px' }}>✂️</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>Crop Invoice</div></div>
          <div style={{ color: '#475569' }}>➔</div>
          <div style={{ textAlign: 'center', minWidth: '80px' }}><div style={{ fontSize: '20px' }}>🏷️</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>Read SKU</div></div>
          <div style={{ color: '#475569' }}>➔</div>
          <div style={{ textAlign: 'center', minWidth: '80px' }}><div style={{ fontSize: '20px' }}>📦</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>Group SKUs</div></div>
          <div style={{ color: '#475569' }}>➔</div>
          <div style={{ textAlign: 'center', minWidth: '80px' }}><div style={{ fontSize: '20px' }}>🔤</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>Sort A–Z</div></div>
          <div style={{ color: '#475569' }}>➔</div>
          <div style={{ textAlign: 'center', minWidth: '80px' }}><div style={{ fontSize: '20px' }}>📥</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>Download PDF</div></div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Dropzone Card */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>🛍️ Upload Shipping Labels</h2>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              border: '2px dashed #334155',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#0f172a',
              position: 'relative'
            }}
          >
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />
            <div style={{ fontSize: '32px' }}>📁</div>
            <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '8px' }}>Drop PDF shipping labels here</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>or click to browse from computer</div>
          </div>

          {files.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>📄 {f.name}</span>
                  <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Crop Settings Card */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>✂️ Crop &amp; Quality Settings</h2>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['meesho', 'flipkart', 'amazon', 'halfa4', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: preset === p ? '#6366f1' : '#0f172a',
                  color: preset === p ? '#fff' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>X Offset (pt)</label>
              <input type="number" value={cropX} onChange={e => setCropX(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Y Offset (pt)</label>
              <input type="number" value={cropY} onChange={e => setCropY(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Width (pt)</label>
              <input type="number" value={cropW} onChange={e => setCropW(parseFloat(e.target.value) || 595)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Height (pt)</label>
              <input type="number" value={cropH} onChange={e => setCropH(parseFloat(e.target.value) || 350)} style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={handleRun}
          disabled={files.length === 0 || isProcessing}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff',
            fontWeight: 700,
            border: 'none',
            cursor: files.length === 0 || isProcessing ? 'not-allowed' : 'pointer',
            opacity: files.length === 0 || isProcessing ? 0.5 : 1
          }}
        >
          {isProcessing ? `Processing (${progress}%)...` : '⚙️ Process &amp; Sort Labels'}
        </button>
        <button
          onClick={handleClear}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: '#1e293b',
            color: '#fff',
            fontWeight: 600,
            border: '1px solid #334155',
            cursor: 'pointer'
          }}
        >
          ✕ Clear Queue
        </button>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
            <span>Processing PDFs...</span>
            <span>{progress}%</span>
          </div>
          <div style={{ background: '#0f172a', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ background: '#6366f1', height: '100%', width: `${progress}%`, transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {/* Logs Console */}
      {logs.length > 0 && (
        <div ref={logRef} style={{ background: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '160px', overflowY: 'auto', marginBottom: '24px' }}>
          {logs.map((l, i) => (
            <div key={i} style={{ color: l.type === 'ok' ? '#34d399' : l.type === 'err' ? '#f87171' : '#94a3b8' }}>
              {l.msg}
            </div>
          ))}
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {results.map((r, i) => (
            <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>📄 {r.name}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>{r.pages} Pages · {r.skus.length} SKU Groups</div>
              <a
                href={r.url}
                download={r.name}
                style={{ display: 'block', textAlign: 'center', padding: '10px', background: '#10b981', color: '#fff', borderRadius: '6px', fontWeight: 700, textDecoration: 'none' }}
              >
                ⬇ Download Sorted PDF
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
