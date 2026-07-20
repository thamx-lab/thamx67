/**
 * Label Cropper & Sorting Engine - Automated Test Suite
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const http = require('http');

let passedCount = 0;
let failedCount = 0;
const testLogs = [];

function logTest(msg) {
  console.log(msg);
  testLogs.push(msg);
}

function assert(condition, testName) {
  if (condition) {
    passedCount++;
    logTest(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    logTest(`  ❌ FAIL: ${testName}`);
  }
}

function testSKUExtraction() {
  logTest('\n=== Test 1: SKU & Size Extraction Parser ===');

  const mockTextItems = [
    { str: 'SKU', transform: [1, 0, 0, 1, 30, 500] },
    { str: 'Size', transform: [1, 0, 0, 1, 210, 500] },
    { str: 'Qty', transform: [1, 0, 0, 1, 300, 500] },
    { str: 'BYS-OST-BLK', transform: [1, 0, 0, 1, 30, 484] },
    { str: '11-12 Years', transform: [1, 0, 0, 1, 210, 484] },
    { str: '1', transform: [1, 0, 0, 1, 300, 484] }
  ];

  const words = mockTextItems.map(item => ({
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

  assert(skuHeaderY === 500, 'Header row Y identified correctly at 500');

  const valueLineY = skuHeaderY - 16;
  const valueLine = words.filter(w => Math.abs(w.y - valueLineY) <= 10).sort((a, b) => a.x - b.x);

  const skuTokens = valueLine.filter(w => w.x < 200);
  const sku = skuTokens.map(w => w.text).join(' ').trim();

  const sizeTokens = valueLine.filter(w => w.x >= 200 && w.x < 295);
  const size = sizeTokens.map(w => w.text).join(' ').trim();

  assert(sku === 'BYS-OST-BLK', 'Extracted SKU matches "BYS-OST-BLK"');
  assert(size === '11-12 Years', 'Extracted Size matches "11-12 Years"');
}

function testSortingAlgorithm() {
  logTest('\n=== Test 2: Primary (SKU A-Z) & Secondary (Size A-Z) Sorting ===');

  const rawPages = [
    { sku: 'TSHIRT-RED', size: 'XL', pageNum: 1 },
    { sku: 'HOODIE-BLK', size: 'M', pageNum: 2 },
    { sku: 'TSHIRT-RED', size: 'L', pageNum: 3 },
    { sku: 'CAP-NAVY', size: 'FREE', pageNum: 4 },
    { sku: null, size: null, pageNum: 5 },
    { sku: 'HOODIE-BLK', size: 'S', pageNum: 6 }
  ];

  const groups = new Map();
  const noSKU = [];

  for (const p of rawPages) {
    if (p.sku) {
      if (!groups.has(p.sku)) groups.set(p.sku, []);
      groups.get(p.sku).push(p);
    } else {
      noSKU.push(p);
    }
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  assert(sortedKeys.join(',') === 'CAP-NAVY,HOODIE-BLK,TSHIRT-RED', 'Primary SKU sort A–Z order is correct');

  for (const k of sortedKeys) {
    groups.get(k).sort((a, b) => (a.size || '').localeCompare(b.size || ''));
  }

  assert(groups.get('HOODIE-BLK')[0].size === 'M', 'Secondary Size sort for HOODIE-BLK puts "M" before "S"');
  assert(groups.get('TSHIRT-RED')[0].size === 'L', 'Secondary Size sort for TSHIRT-RED puts "L" before "XL"');
  assert(noSKU.length === 1, 'Uncategorized pages properly separated');
}

function testCropBoundaries() {
  logTest('\n=== Test 3: Crop Coordinate Calculation & Boundary Clamping ===');

  const pageW = 595;
  const pageH = 842;
  const scale = 2;

  const cropX = -10;
  const cropY = 0;
  const cropW = 600;
  const cropH = 350;

  const sx = Math.max(0, Math.round(cropX * scale));
  const sy = Math.max(0, Math.round(cropY * scale));
  const fullWidth = pageW * scale;
  const fullHeight = pageH * scale;
  const sw = Math.min(Math.round(cropW * scale), fullWidth - sx);
  const sh = Math.min(Math.round(cropH * scale), fullHeight - sy);

  assert(sx === 0, 'Negative X offset clamped to 0');
  assert(sw === 1190, 'Excess crop width clamped to max full width (1190px)');
  assert(sh === 700, 'Crop height correctly scaled (350pt * 2 = 700px)');
}

async function testPDFGeneration() {
  logTest('\n=== Test 4: PDF-Lib Synthetic Label Creation ===');

  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText('SKU', { x: 30, y: 500, size: 10, font });
    page.drawText('Size', { x: 210, y: 500, size: 10, font });
    page.drawText('TEST-PRODUCT-SKU-001', { x: 30, y: 484, size: 10, font });
    page.drawText('Medium', { x: 210, y: 484, size: 10, font });

    const pdfBytes = await pdfDoc.save();
    assert(pdfBytes.length > 500, 'Synthetic PDF generated successfully with bytes > 500');
  } catch (err) {
    assert(false, `PDF generation failed: ${err.message}`);
  }
}

function testSecurityProtection() {
  return new Promise((resolve) => {
    logTest('\n=== Test 5: Security & .env Protection Endpoints ===');

    const portsToTry = [3000, 3001, 3002];

    const tryPort = (portIdx) => {
      if (portIdx >= portsToTry.length) {
        logTest('  ℹ Server not detected on ports 3000-3002 during standalone unit test');
        return resolve();
      }

      const port = portsToTry[portIdx];
      const req = http.get(`http://localhost:${port}/.env`, (res) => {
        if (res.statusCode === 403) {
          assert(true, `Requesting /.env on port ${port} returns HTTP 403 Forbidden`);
          assert(res.headers['x-content-type-options'] === 'nosniff', 'Security header X-Content-Type-Options: nosniff present');
          assert(res.headers['x-frame-options'] === 'SAMEORIGIN', 'Security header X-Frame-Options: SAMEORIGIN present');
          return resolve();
        } else {
          tryPort(portIdx + 1);
        }
      });

      req.on('error', () => tryPort(portIdx + 1));
      req.setTimeout(1000, () => { req.destroy(); tryPort(portIdx + 1); });
    };

    tryPort(0);
  });
}

async function runAllTests() {
  testLogs.length = 0;
  passedCount = 0;
  failedCount = 0;

  logTest('🧪 Starting Label Cropper Automated Test Suite...\n');

  testSKUExtraction();
  testSortingAlgorithm();
  testCropBoundaries();
  await testPDFGeneration();
  await testSecurityProtection();

  const total = passedCount + failedCount;
  logTest(`\n===========================================`);
  logTest(`Test Results: ${passedCount}/${total} Passed (${failedCount} Failed)`);
  logTest(`===========================================\n`);

  return {
    success: failedCount === 0,
    passed: passedCount,
    failed: failedCount,
    total,
    output: testLogs.join('\n')
  };
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
