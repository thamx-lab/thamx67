// Label Cropper & Sorting Engine Client Application

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const state = {
  files: [],
  outputs: []
};

const presets = {
  meesho: { x: 0, y: 0, w: 595, h: 350, s: 2 },
  flipkart: { x: 0, y: 0, w: 595, h: 350, s: 2 },
  amazon: { x: 0, y: 0, w: 595, h: 300, s: 2 },
  halfa4: { x: 0, y: 0, w: 595, h: 420, s: 2 },
  custom: { x: 0, y: 0, w: 595, h: 350, s: 2 }
};

const $ = id => document.getElementById(id);
const dropzone = $('dropzone');
const pdfInput = $('pdfInput');
const fileChipsContainer = $('fileChipsContainer');
const processBtn = $('processBtn');
const clearBtn = $('clearBtn');
const runTestsBtn = $('runTestsBtn');
const progressSection = $('progressSection');
const progressBarFill = $('progressBarFill');
const progressPercent = $('progressPercent');
const progressStatusText = $('progressStatusText');
const consoleLog = $('consoleLog');
const resultsGrid = $('resultsGrid');
const themeToggleBtn = $('themeToggleBtn');
const testPanel = $('testPanel');
const testOutputContainer = $('testOutputContainer');
const testStatusBadge = $('testStatusBadge');

themeToggleBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  themeToggleBtn.textContent = newTheme === 'light' ? '🌙 Dark Theme' : '☀️ Light Theme';
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const key = e.target.getAttribute('data-preset');
    if (presets[key]) {
      $('cropX').value = presets[key].x;
      $('cropY').value = presets[key].y;
      $('cropW').value = presets[key].w;
      $('cropH').value = presets[key].h;
      $('renderScale').value = presets[key].s;
    }
  });
});

pdfInput.addEventListener('change', (e) => {
  addFiles([...e.target.files]);
  e.target.value = '';
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const droppedFiles = [...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.pdf'));
  addFiles(droppedFiles);
});

function addFiles(newFiles) {
  newFiles.forEach(file => {
    if (!state.files.some(f => f.name === file.name && f.size === file.size)) {
      state.files.push(file);
    }
  });
  renderFileChips();
  checkReady();
}

function renderFileChips() {
  fileChipsContainer.innerHTML = state.files.map((file, idx) => `
    <div class="file-chip">
      <span class="file-chip-name" title="${file.name}">📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
      <button class="btn-remove" onclick="removeFile(${idx})">✕</button>
    </div>
  `).join('');
}

window.removeFile = (idx) => {
  state.files.splice(idx, 1);
  renderFileChips();
  checkReady();
};

function checkReady() {
  processBtn.disabled = state.files.length === 0;
}

function log(msg, type = 'info') {
  consoleLog.style.display = 'block';
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="log-time">[${time}]</span> <span>${msg}</span>`;
  consoleLog.appendChild(entry);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function setProgress(pct, statusText) {
  progressSection.style.display = 'block';
  progressBarFill.style.width = `${pct}%`;
  progressPercent.textContent = `${pct}%`;
  if (statusText) progressStatusText.textContent = statusText;
}

function extractProductDetails(textItems) {
  const words = textItems
    .filter(item => item.str.trim())
    .map(item => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: Math.round(item.transform[5])
    }));

  let skuHeaderY = null;
  for (const w of words) {
    if (w.text.toUpperCase() === 'SKU' && w.x < 120) {
      skuHeaderY = w.y;
      break;
    }
  }

  if (skuHeaderY !== null) {
    const valueLineY = skuHeaderY - 16;
    const tolerance = 10;
    const valueLine = words
      .filter(w => Math.abs(w.y - valueLineY) <= tolerance)
      .sort((a, b) => a.x - b.x);

    const skuTokens = valueLine.filter(w => w.x < 200);
    const sku = skuTokens.length
      ? skuTokens.map(w => w.text).join(' ').replace(/\s{2,}/g, ' ').trim().toUpperCase()
      : null;

    const sizeTokens = valueLine.filter(w => w.x >= 200 && w.x < 295);
    const size = sizeTokens.length
      ? sizeTokens.map(w => w.text).join(' ').replace(/\s{2,}/g, ' ').trim()
      : '';

    if (sku) return { sku, size };
  }

  const fullText = words.map(w => w.text).join(' ');
  const skuMatch = fullText.match(/SKU\s*:\s*([A-Z0-9_\-\/]+)/i) || 
                   fullText.match(/Product\s*SKU\s*:\s*([A-Z0-9_\-\/]+)/i);

  if (skuMatch && skuMatch[1]) {
    return { sku: skuMatch[1].toUpperCase(), size: '' };
  }

  return { sku: null, size: null };
}

async function renderCroppedPage(pdfPage, scale, cropX, cropY, cropW, cropH) {
  const viewport = pdfPage.getViewport({ scale });
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = Math.round(viewport.width);
  fullCanvas.height = Math.round(viewport.height);
  const ctx = fullCanvas.getContext('2d');

  await pdfPage.render({ canvasContext: ctx, viewport }).promise;

  const sx = Math.max(0, Math.round(cropX * scale));
  const sy = Math.max(0, Math.round(cropY * scale));
  const sw = Math.min(Math.round(cropW * scale), fullCanvas.width - sx);
  const sh = Math.min(Math.round(cropH * scale), fullCanvas.height - sy);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = sw;
  croppedCanvas.height = sh;
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  fullCanvas.width = 0;
  fullCanvas.height = 0;

  return croppedCanvas;
}

async function processFile(file, progressCallback) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  log(`Analyzing ${totalPages} pages in "${file.name}"...`, 'info');

  const rawPages = [];
  const CHUNK_SIZE = 25;

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const { sku, size } = extractProductDetails(textContent.items);

    rawPages.push({ page, sku, size, pageNum: i });

    if (i % CHUNK_SIZE === 0 || i === totalPages) {
      const pct = Math.round((i / totalPages) * 50);
      progressCallback(pct, `Reading & Extracting SKUs (Page ${i}/${totalPages})`);
      await new Promise(res => setTimeout(res, 0));
    }
  }

  const groups = new Map();
  const noSKUPages = [];

  for (const pageObj of rawPages) {
    if (pageObj.sku) {
      if (!groups.has(pageObj.sku)) groups.set(pageObj.sku, []);
      groups.get(pageObj.sku).push(pageObj);
    } else {
      noSKUPages.push(pageObj);
    }
  }

  const sortedSKUKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  for (const key of sortedSKUKeys) {
    groups.get(key).sort((a, b) => (a.size || '').localeCompare(b.size || ''));
  }

  const sortedPages = [];
  for (const key of sortedSKUKeys) {
    sortedPages.push(...groups.get(key));
  }
  sortedPages.push(...noSKUPages);

  return { pdf, sortedPages, groups, sortedSKUKeys, noSKUCount: noSKUPages.length, totalPages };
}

async function buildOutputPDF(pages, scale, cropX, cropY, cropW, cropH, progressCallback) {
  const jsPDF = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
  if (!jsPDF) {
    throw new Error('jsPDF library is not loaded. Please check connection.');
  }

  const wPt = cropW;
  const hPt = cropH;
  const orientation = wPt > hPt ? 'landscape' : 'portrait';

  let doc = null;

  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderCroppedPage(pages[i].page, scale, cropX, cropY, cropW, cropH);
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    if (!doc) {
      doc = new jsPDF({ orientation, unit: 'pt', format: [wPt, hPt] });
    } else {
      doc.addPage([wPt, hPt], orientation);
    }

    doc.addImage(imgData, 'JPEG', 0, 0, wPt, hPt);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${i + 1}`, wPt - 12, hPt - 6, { align: 'right' });

    canvas.width = 0;
    canvas.height = 0;

    if ((i + 1) % 10 === 0 || i === pages.length - 1) {
      const pct = 50 + Math.round(((i + 1) / pages.length) * 50);
      progressCallback(pct, `Rendering & Building PDF (Page ${i + 1}/${pages.length})`);
      await new Promise(res => setTimeout(res, 0));
    }
  }

  return doc;
}

processBtn.addEventListener('click', async () => {
  if (state.files.length === 0) return;

  processBtn.disabled = true;
  consoleLog.innerHTML = '';
  resultsGrid.innerHTML = '';
  state.outputs = [];

  const cropX = parseFloat($('cropX').value) || 0;
  const cropY = parseFloat($('cropY').value) || 0;
  const cropW = parseFloat($('cropW').value) || 595;
  const cropH = parseFloat($('cropH').value) || 350;
  const scale = parseFloat($('renderScale').value) || 2;

  log(`🚀 Starting processing batch of ${state.files.length} file(s)...`, 'info');

  const totalFiles = state.files.length;

  for (let idx = 0; idx < totalFiles; idx++) {
    const file = state.files[idx];
    log(`📄 Processing file [${idx + 1}/${totalFiles}]: ${file.name}`, 'info');

    try {
      const { sortedPages, groups, sortedSKUKeys, noSKUCount, totalPages } = 
        await processFile(file, (pct, statusText) => setProgress(pct, `[${file.name}] ${statusText}`));

      if (sortedSKUKeys.length > 0) {
        log(`✓ Identified ${sortedSKUKeys.length} SKU groups sorted A–Z`, 'success');
      } else {
        log(`⚠ No SKUs auto-detected. Pages kept in original order.`, 'warning');
      }

      if (noSKUCount > 0) {
        log(`ℹ ${noSKUCount} page(s) without SKU header appended to end`, 'warning');
      }

      log(`Building PDF document (${sortedPages.length} pages)...`, 'info');
      const doc = await buildOutputPDF(sortedPages, scale, cropX, cropY, cropW, cropH,
        (pct, statusText) => setProgress(pct, `[${file.name}] ${statusText}`));

      const blob = doc.output('blob');
      const downloadUrl = URL.createObjectURL(blob);

      state.outputs.push({
        name: file.name.replace(/\.pdf$/i, '') + '_processed_sorted.pdf',
        url: downloadUrl,
        totalPages: sortedPages.length,
        groups,
        sortedSKUKeys,
        noSKUCount
      });

      log(`✅ Successfully generated: ${file.name}`, 'success');

    } catch (err) {
      log(`❌ Failed to process ${file.name}: ${err.message}`, 'error');
      console.error(err);
    }
  }

  renderResults();
  processBtn.disabled = false;
  setProgress(100, '✅ All files processed successfully');
});

function renderResults() {
  resultsGrid.innerHTML = state.outputs.map((out, idx) => `
    <div class="result-card">
      <div>
        <div class="rc-header">
          <div class="rc-title">${out.name}</div>
          <span class="badge-pill badge-online">Sorted A–Z</span>
        </div>
        <div class="rc-meta">📄 ${out.totalPages} Total Pages · 🏷️ ${out.sortedSKUKeys.length} SKU Groups${out.noSKUCount ? ` · ${out.noSKUCount} no-SKU` : ''}</div>
        <div class="rc-groups">
          ${out.sortedSKUKeys.map((skuKey, sIdx) => `
            <div class="rc-group-item">
              <span>${sIdx + 1}. <span class="rc-sku">${skuKey}</span></span>
              <span>(${out.groups.get(skuKey).length} label${out.groups.get(skuKey).length > 1 ? 's' : ''})</span>
            </div>
          `).join('')}
          ${out.noSKUCount ? `<div class="rc-group-item" style="color:#94a3b8;"><span>— Uncategorized</span><span>(${out.noSKUCount})</span></div>` : ''}
        </div>
      </div>
      <button class="btn-download" onclick="downloadResult(${idx})">⬇ Download Sorted PDF</button>
    </div>
  `).join('');
}

window.downloadResult = (idx) => {
  const out = state.outputs[idx];
  if (!out) return;
  const a = document.createElement('a');
  a.href = out.url;
  a.download = out.name;
  a.click();
};

clearBtn.addEventListener('click', () => {
  state.files = [];
  state.outputs = [];
  renderFileChips();
  resultsGrid.innerHTML = '';
  consoleLog.innerHTML = '';
  consoleLog.style.display = 'none';
  progressSection.style.display = 'none';
  checkReady();
});

runTestsBtn.addEventListener('click', async () => {
  testPanel.style.display = 'block';
  testOutputContainer.textContent = '⚡ Running automated test suite on backend server...';
  testStatusBadge.textContent = 'Running...';
  testStatusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
  testStatusBadge.style.color = '#fbbf24';

  try {
    const response = await fetch('/api/run-tests');
    const data = await response.json();

    if (data.success) {
      testOutputContainer.textContent = data.output;
      testStatusBadge.textContent = `Passed (${data.passed}/${data.total})`;
      testStatusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      testStatusBadge.style.color = '#34d399';
    } else {
      testOutputContainer.textContent = data.output || data.error;
      testStatusBadge.textContent = 'Failed';
      testStatusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      testStatusBadge.style.color = '#f87171';
    }
  } catch (err) {
    testOutputContainer.textContent = `Failed to connect to test endpoint: ${err.message}`;
    testStatusBadge.textContent = 'Error';
    testStatusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
    testStatusBadge.style.color = '#f87171';
  }
});
