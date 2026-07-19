'use client';

import { useState, useRef, useEffect } from 'react';
import { runProcessor, ProcessingJob, ProcessingResult } from '@/lib/pdfProcessor';

export default function Dashboard() {
  const [meeshoFiles, setMeeshoFiles] = useState<File[]>([]);
  const [flipkartFiles, setFlipkartFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{msg: string, type: string}[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);

  // Presets state
  const [mCrop, setMCrop] = useState({ x0: 0, y0: 0, w: 595, h: 361, scale: 2 });
  const [fCrop, setFCrop] = useState({ x0: 165, y0: 22, w: 265, h: 360, scale: 2 });
  const [mSku, setMSku] = useState('SKU[:\\s#-]*([A-Z0-9\\-_]+)');
  const [fSku, setFSku] = useState('SKU\\s+ID[^a-z]*?([A-Z0-9][A-Z0-9\\-_]+)');

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleDrop = (e: React.DragEvent, platform: 'meesho' | 'flipkart') => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag');
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf'));
    addFiles(platform, dropped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, platform: 'meesho' | 'flipkart') => {
    if (e.target.files) {
      addFiles(platform, Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const addFiles = (platform: 'meesho' | 'flipkart', files: File[]) => {
    const setter = platform === 'meesho' ? setMeeshoFiles : setFlipkartFiles;
    setter(prev => {
      const newFiles = [...prev];
      files.forEach(f => {
        if (!newFiles.find(x => x.name === f.name && x.size === f.size)) newFiles.push(f);
      });
      return newFiles;
    });
  };

  const removeFile = (platform: 'meesho' | 'flipkart', index: number) => {
    const setter = platform === 'meesho' ? setMeeshoFiles : setFlipkartFiles;
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const handleRun = async () => {
    setIsProcessing(true);
    setLogs([]);
    setResults([]);
    setProgress(0);

    const jobs: ProcessingJob[] = [
      ...meeshoFiles.map(f => ({ file: f, platform: 'meesho' as const, skuPattern: mSku, settings: mCrop })),
      ...flipkartFiles.map(f => ({ file: f, platform: 'flipkart' as const, skuPattern: fSku, settings: fCrop }))
    ];

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
          pagesProcessed: outs.reduce((acc, out) => acc + out.pages, 0),
          platforms: { meesho: meeshoFiles.length, flipkart: flipkartFiles.length }
        })
      }).catch(err => console.error("Analytics error", err));

    } catch (e: any) {
      handleLog(`Error: ${e.message}`, 'err');
    }

    setIsProcessing(false);
    handleLog('Done — download your cropped, sorted PDFs below.', 'ok');
  };

  const handleClear = () => {
    setMeeshoFiles([]);
    setFlipkartFiles([]);
    setLogs([]);
    setResults([]);
    setProgress(0);
  };

  const isReady = meeshoFiles.length > 0 || flipkartFiles.length > 0;

  return (
    <div className="container">
      <h2 className="main-title">Label Crop & Sort Tool</h2>
      <p className="sub">Extracts the shipping label (top portion), removes the tax invoice, sorts by SKU, outputs one PDF per file.</p>
      
      <div className="info-box">
        <strong>Crop method:</strong> Uses exact CropBox values measured from your reference PDFs.<br/>
        • <strong>Meesho:</strong> Top 42.8% of page width full, label only (≈360 pt tall out of 842 pt A4).<br/>
        • <strong>Flipkart:</strong> Centre column, top 42.8% (x: 165–430 pt, y top: 22–382 pt of 842 pt page).
      </div>

      <div className="zones">
        <div 
          className="zone" 
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
          onDragLeave={e => e.currentTarget.classList.remove('drag')}
          onDrop={e => handleDrop(e, 'meesho')}
        >
          <input type="file" accept=".pdf" multiple onChange={e => handleChange(e, 'meesho')} />
          <div className="zone-icon">🛍️</div>
          <div className="zone-title">Meesho labels <span className="badge badge-m">Flipkart-style</span></div>
          <div className="zone-sub">Drop PDFs or click to browse</div>
          {meeshoFiles.length > 0 && (
            <div className="file-list">
              {meeshoFiles.map((f, i) => (
                <div className="file-chip" key={i}>
                  <span title={f.name}>{f.name}</span>
                  <button className="rm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile('meesho', i); }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div 
          className="zone" 
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
          onDragLeave={e => e.currentTarget.classList.remove('drag')}
          onDrop={e => handleDrop(e, 'flipkart')}
        >
          <input type="file" accept=".pdf" multiple onChange={e => handleChange(e, 'flipkart')} />
          <div className="zone-icon">🟡</div>
          <div className="zone-title">Flipkart / Shopsy <span className="badge badge-f">E-Kart format</span></div>
          <div className="zone-sub">Drop PDFs or click to browse</div>
          {flipkartFiles.length > 0 && (
            <div className="file-list">
              {flipkartFiles.map((f, i) => (
                <div className="file-chip" key={i}>
                  <span title={f.name}>{f.name}</span>
                  <button className="rm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile('flipkart', i); }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="presets">
        <div className="preset-card">
          <div className="preset-header">
            <span className="preset-icon">🛍️</span>
            <span className="preset-label">Meesho preset</span>
            <span className="badge badge-m">TOP of page</span>
          </div>
          <div className="crop-vis">
            <div className="crop-label">✂ Shipping label — TOP ~43%</div>
            <div className="crop-invoice">🧾 Tax invoice (removed)</div>
          </div>
          <div className="field-row"><label>Crop x0 (pt)</label><input type="number" value={mCrop.x0} onChange={e => setMCrop({...mCrop, x0: +e.target.value})} /><span className="unit">pt</span></div>
          <div className="field-row"><label>Crop y0 (pt)</label><input type="number" value={mCrop.y0} onChange={e => setMCrop({...mCrop, y0: +e.target.value})} /><span className="unit">pt</span></div>
          <div className="field-row"><label>Crop width (pt)</label><input type="number" value={mCrop.w} onChange={e => setMCrop({...mCrop, w: +e.target.value})} /><span className="unit">pt</span></div>
          <div className="field-row"><label>Crop height (pt)</label><input type="number" value={mCrop.h} onChange={e => setMCrop({...mCrop, h: +e.target.value})} /><span className="unit">pt</span></div>
        </div>

        <div className="preset-card">
          <div className="preset-header">
            <span className="preset-icon">🟡</span>
            <span className="preset-label">Flipkart preset</span>
            <span className="badge badge-f">TOP centre</span>
          </div>
          <div className="crop-vis">
            <div className="crop-label crop-label-f">✂ Shipping label — TOP centre</div>
            <div className="crop-invoice">🧾 Tax invoice (removed)</div>
          </div>
          <div className="field-row"><label>Crop x0 (pt)</label><input type="number" value={fCrop.x0} onChange={e => setFCrop({...fCrop, x0: +e.target.value})} /><span className="unit">pt</span></div>
          <div className="field-row"><label>Crop y0 (pt)</label><input type="number" value={fCrop.y0} onChange={e => setFCrop({...fCrop, y0: +e.target.value})} /><span className="unit">pt</span></div>
          <div className="field-row"><label>Crop width (pt)</label><input type="number" value={fCrop.w} onChange={e => setFCrop({...fCrop, w: +e.target.value})} /><span className="unit">pt</span></div>
          <div className="field-row"><label>Crop height (pt)</label><input type="number" value={fCrop.h} onChange={e => setFCrop({...fCrop, h: +e.target.value})} /><span className="unit">pt</span></div>
        </div>
      </div>

      <div className="section">
        <h3>SKU detection patterns</h3>
        <div className="row">
          <label>Meesho SKU regex</label>
          <input type="text" value={mSku} onChange={e => setMSku(e.target.value)} />
        </div>
        <div className="row">
          <label>Flipkart SKU regex</label>
          <input type="text" value={fSku} onChange={e => setFSku(e.target.value)} />
        </div>
        <p className="tip">Pages without a detected SKU are placed at the end of each file.</p>
      </div>

      <div className="actions">
        <button className="btn primary" disabled={!isReady || isProcessing} onClick={handleRun}>
          {isProcessing ? 'Processing...' : 'Process labels'}
        </button>
        <button className="btn" disabled={isProcessing} onClick={handleClear}>Clear all</button>
      </div>

      {(progress > 0 || isProcessing) && (
        <div className="prog-wrap" style={{ display: 'block' }}>
          <div className="prog-bar" style={{ width: `${progress}%` }}></div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="log" ref={logRef}>
          {logs.map((l, i) => (
            <div key={i} className={`log-line log-${l.type}`}>{l.msg}</div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="results">
          {results.map((res, i) => (
            <div className="res-card" key={i}>
              <div className="res-name">
                <span className="name-text" title={res.name}>{res.name}</span>
                <span className={`badge ${res.badge}`}>{res.label}</span>
              </div>
              <div className="res-meta">{res.pages} pages · {res.skus.length} unique SKUs</div>
              {res.skus.length > 0 && (
                <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'12px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  SKUs: {res.skus.slice(0,6).join(', ')}{res.skus.length > 6 ? ' …' : ''}
                </div>
              )}
              <button className="dl-btn" onClick={() => {
                const a = document.createElement('a');
                a.href = res.url;
                a.download = res.name;
                a.click();
              }}>⬇ Download PDF</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
