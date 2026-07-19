import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface CropSettings {
  x0: number;
  y0: number;
  w: number;
  h: number;
  scale: number;
}

export interface ProcessingJob {
  file: File;
  platform: 'meesho' | 'flipkart';
  skuPattern: string;
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

async function extractTextFromPage(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const tc = await page.getTextContent();
  return tc.items.map((i: any) => i.str).join(' ');
}

function extractSKU(text: string, pattern: string): string | null {
  try {
    const rx = new RegExp(pattern, 'i');
    const m = rx.exec(text);
    if (!m) return null;
    return (m[1] || m[2] || m[0]).trim();
  } catch {
    return null;
  }
}

async function renderCroppedPage(
  pdfPage: pdfjsLib.PDFPageProxy,
  scale: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const vp = pdfPage.getViewport({ scale });

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = Math.round(vp.width);
  fullCanvas.height = Math.round(vp.height);
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) throw new Error('Could not get 2d context');

  await pdfPage.render({ canvasContext: fullCtx, viewport: vp, canvas: fullCanvas }).promise;

  const sx = Math.round(cropX * scale);
  const sy = Math.round(cropY * scale);
  const sw = Math.round(cropW * scale);
  const sh = Math.round(cropH * scale);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = sw;
  outCanvas.height = sh;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Could not get 2d context for output');

  outCtx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  return { canvas: outCanvas, width: sw, height: sh };
}

async function processFile(job: ProcessingJob, onLog: (msg: string, type: 'info' | 'ok' | 'err') => void) {
  onLog(`Loading ${job.file.name}...`, 'info');
  const ab = await job.file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const pages = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await extractTextFromPage(page);
    const sku = extractSKU(text, job.skuPattern);
    pages.push({ page, text, sku, pageNum: i });
  }

  pages.sort((a, b) => {
    if (a.sku && b.sku) return a.sku.localeCompare(b.sku, undefined, { numeric: true });
    if (a.sku) return -1;
    if (b.sku) return 1;
    return a.pageNum - b.pageNum;
  });

  onLog(`  ${job.file.name}: ${pdf.numPages} pages, sorted by SKU`, 'ok');
  return pages;
}

async function buildPDF(pages: any[], settings: CropSettings) {
  let doc: jsPDF | null = null;
  const { x0, y0, w, h, scale } = settings;

  for (let i = 0; i < pages.length; i++) {
    const { canvas, width, height } = await renderCroppedPage(
      pages[i].page, scale, x0, y0, w, h
    );
    const imgData = canvas.toDataURL('image/jpeg', 0.93);
    const wPt = w;
    const hPt = h;

    if (!doc) {
      doc = new jsPDF({ orientation: wPt > hPt ? 'l' : 'p', unit: 'pt', format: [wPt, hPt] });
    } else {
      doc.addPage([wPt, hPt], wPt > hPt ? 'l' : 'p');
    }

    doc.addImage(imgData, 'JPEG', 0, 0, wPt, hPt);
    const sku = pages[i].sku || 'NO_SKU';
    doc.setFontSize(5);
    doc.setTextColor(140);
    doc.text(`P${i + 1} | ${sku}`, 3, hPt - 3);
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
      const pages = await processFile(job, onLog);
      const doc = await buildPDF(pages, job.settings);
      
      if (!doc) throw new Error("Document generation failed");

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const badge = job.platform === 'meesho' ? 'badge-m' : 'badge-f';
      const label = job.platform === 'meesho' ? 'Meesho' : 'Flipkart';
      const skus = [...new Set(pages.map(p => p.sku).filter(Boolean))] as string[];

      outputs.push({
        name: job.file.name.replace(/\.pdf$/i, '') + '_labels.pdf',
        url,
        pages: pages.length,
        skus,
        badge,
        label
      });
      onLog(`  ✓ ${job.file.name} → ${pages.length} pages, ${skus.length} SKUs`, 'ok');
    } catch (e: any) {
      onLog(`  ✗ ${job.file.name}: ${e.message}`, 'err');
    }
    done++;
    onProgress(Math.round((done / total) * 100));
  }

  return outputs;
}
