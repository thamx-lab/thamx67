import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

export interface CropSettings {
  x0: number;
  y0: number;
  w: number;
  h: number;
  scale: number;
}

export interface ProcessingJob {
  file: File;
  platform: 'meesho' | 'flipkart' | 'amazon' | 'halfa4' | 'custom';
  skuPattern?: string;
  settings: CropSettings;
}

export interface ProcessingResult {
  name: string;
  url: string;
  pages: number;
  skus: string[];
  badge: string;
  label: string;
}

// Automatic Label Platform & Dimension Detector
export function autoDetectLabelSettings(fileName: string, textContent?: string): { platform: 'meesho' | 'flipkart' | 'amazon' | 'halfa4' | 'custom'; settings: CropSettings } {
  const lowerName = fileName.toLowerCase();
  const lowerText = (textContent || '').toLowerCase();

  // Flipkart / Shopsy / Ekart Detection (Standard Flipkart A4: 595pt x 350pt)
  if (
    lowerName.includes('flipkart') ||
    lowerName.includes('shopsy') ||
    lowerName.includes('ekart') ||
    lowerText.includes('flipkart') ||
    lowerText.includes('ekart') ||
    lowerText.includes('sku id')
  ) {
    return {
      platform: 'flipkart',
      settings: { x0: 0, y0: 0, w: 595, h: 350, scale: 2 }
    };
  }

  // Amazon / ATS Detection (Standard Amazon: 595pt x 300pt)
  if (
    lowerName.includes('amazon') ||
    lowerName.includes('ats') ||
    lowerText.includes('amazon') ||
    lowerText.includes('shipment value')
  ) {
    return {
      platform: 'amazon',
      settings: { x0: 0, y0: 0, w: 595, h: 300, scale: 2 }
    };
  }

  // Half A4 Detection (595pt x 420pt)
  if (lowerName.includes('half') || lowerName.includes('420')) {
    return {
      platform: 'halfa4',
      settings: { x0: 0, y0: 0, w: 595, h: 420, scale: 2 }
    };
  }

  // Common Meesho A4 Label (Standard Meesho: 595pt x 350pt)
  return {
    platform: 'meesho',
    settings: { x0: 0, y0: 0, w: 595, h: 350, scale: 2 }
  };
}

function extractProductDetails(textItems: any[]) {
  const words = textItems
    .filter((item: any) => item.str && item.str.trim())
    .map((item: any) => ({
      text: item.str.trim(),
      x: item.transform ? item.transform[4] : 0,
      y: item.transform ? Math.round(item.transform[5]) : 0
    }));

  let skuHeaderY: number | null = null;
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

async function renderCroppedPage(
  pdfPage: pdfjsLib.PDFPageProxy,
  scale: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): Promise<HTMLCanvasElement> {
  const viewport = pdfPage.getViewport({ scale });
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = Math.round(viewport.width);
  fullCanvas.height = Math.round(viewport.height);
  const ctx = fullCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  await pdfPage.render({ canvasContext: ctx, viewport, canvas: fullCanvas } as any).promise;

  const sx = Math.max(0, Math.round(cropX * scale));
  const sy = Math.max(0, Math.round(cropY * scale));
  const sw = Math.min(Math.round(cropW * scale), fullCanvas.width - sx);
  const sh = Math.min(Math.round(cropH * scale), fullCanvas.height - sy);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = sw;
  croppedCanvas.height = sh;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) throw new Error('Could not get cropped canvas context');
  croppedCtx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  fullCanvas.width = 0;
  fullCanvas.height = 0;

  return croppedCanvas;
}

async function processFile(
  job: ProcessingJob,
  onLog: (msg: string, type: 'info' | 'ok' | 'err') => void
) {
  onLog(`Reading ${job.file.name}...`, 'info');
  const ab = await job.file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const totalPages = pdf.numPages;

  const rawPages: any[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const { sku, size } = extractProductDetails(tc.items);
    rawPages.push({ page, sku, size, pageNum: i });
  }

  const groups = new Map<string, any[]>();
  const noSKUPages: any[] = [];

  for (const pageObj of rawPages) {
    if (pageObj.sku) {
      if (!groups.has(pageObj.sku)) groups.set(pageObj.sku, []);
      groups.get(pageObj.sku)!.push(pageObj);
    } else {
      noSKUPages.push(pageObj);
    }
  }

  const sortedSKUKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  for (const key of sortedSKUKeys) {
    groups.get(key)!.sort((a, b) => (a.size || '').localeCompare(b.size || ''));
  }

  const sortedPages: any[] = [];
  for (const key of sortedSKUKeys) {
    sortedPages.push(...groups.get(key)!);
  }
  sortedPages.push(...noSKUPages);

  onLog(`  ✓ ${job.file.name}: ${totalPages} pages grouped into ${sortedSKUKeys.length} SKU(s) & sorted A–Z`, 'ok');
  return { pages: sortedPages, sortedSKUKeys, groups };
}

async function buildPDF(pages: any[], settings: CropSettings) {
  const { jsPDF } = await import('jspdf');
  const { x0, y0, w, h, scale } = settings;

  let doc: InstanceType<typeof jsPDF> | null = null;
  const wPt = w;
  const hPt = h;
  const orientation = wPt > hPt ? 'l' : 'p';

  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderCroppedPage(pages[i].page, scale, x0, y0, w, h);
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
  }

  return doc;
}

export async function runProcessor(
  jobs: ProcessingJob[],
  onProgress: (pct: number) => void,
  onLog: (msg: string, type: 'info' | 'ok' | 'err') => void
): Promise<ProcessingResult[]> {
  const total = jobs.length;
  let done = 0;
  const outputs: ProcessingResult[] = [];
  onProgress(0);

  for (const job of jobs) {
    try {
      // Auto-resolve dimensions if not specified or matching preset
      const detected = autoDetectLabelSettings(job.file.name);
      const effectiveSettings = job.settings.w > 0 && job.settings.h > 0 ? job.settings : detected.settings;

      const { pages, sortedSKUKeys } = await processFile(job, onLog);
      const doc = await buildPDF(pages, effectiveSettings);

      if (!doc) throw new Error('PDF generation failed');

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);

      outputs.push({
        name: job.file.name.replace(/\.pdf$/i, '') + '_processed_sorted.pdf',
        url,
        pages: pages.length,
        skus: sortedSKUKeys,
        badge: detected.platform === 'meesho' ? 'badge-m' : 'badge-f',
        label: detected.platform.toUpperCase()
      });

      done++;
      onProgress(Math.round((done / total) * 100));
    } catch (e: any) {
      onLog(`Error processing ${job.file.name}: ${e.message}`, 'err');
    }
  }

  return outputs;
}
