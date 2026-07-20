/**
 * Label Cropper & Sorting Engine - Hardened & Secure Local HTTP Server
 */

const express = require('express');
const path = require('path');
const os = require('os');
const { runAllTests } = require('./test/test_suite');

const app = express();
let PORT = parseInt(process.env.PORT || '3000', 10);

// Disable Express fingerprinting header
app.disable('x-powered-by');

// ── SECURITY MIDDLEWARE 1: Security Headers ──────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self';"
  );
  next();
});

// ── SECURITY MIDDLEWARE 2: Block Sensitive Files & Path Traversal ─────
const FORBIDDEN_PATTERNS = [
  /\.env.*/i,
  /\.git.*/i,
  /package(-lock)?\.json/i,
  /server\.js/i,
  /tsconfig\.json/i,
  /next\.config.*/i,
  /node_modules/i,
  /\.pnp.*/i,
  /^\/\.well-known/i,
  /\.\./ // Path traversal attempt
];

app.use((req, res, next) => {
  const reqPath = decodeURIComponent(req.path);

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(reqPath)) {
      console.warn(`[SECURITY ALERT] Blocked illegal access attempt to: ${req.path} from IP ${req.ip}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access to system configuration files and hidden directories is strictly prohibited.'
      });
    }
  }

  next();
});

// ── SECURITY MIDDLEWARE 3: Rate Limiting (DoS Protection) ─────────────
const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests/min per IP

app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();

  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  } else {
    const record = requestCounts.get(clientIP);
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + RATE_LIMIT_WINDOW_MS;
    } else {
      record.count += 1;
      if (record.count > MAX_REQUESTS_PER_WINDOW) {
        console.warn(`[SECURITY ALERT] Rate limit exceeded for IP: ${clientIP}`);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please wait a minute before making more requests.'
        });
      }
    }
  }
  next();
});

// ── SECURITY MIDDLEWARE 4: Payload Size Limit ──────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Static Assets (Mounted AFTER security middleware!)
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'ignore', // Never serve dotfiles like .env or .gitignore
  index: 'index.html'
}));

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Label Cropper Pro (Secured)',
    port: PORT,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// System Stats API
app.get('/api/stats', (req, res) => {
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    memoryUsageMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    cpus: os.cpus().length
  });
});

// Run Automated Tests API
app.get('/api/run-tests', async (req, res) => {
  try {
    const testResults = await runAllTests();
    res.json(testResults);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server with Auto-Port Selection on EADDRINUSE
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    PORT = portToTry;
    console.log(`\n=================================================`);
    console.log(`🔒 SECURED Label Cropper Server active at: http://localhost:${PORT}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🧪 Test Suite Endpoint: http://localhost:${PORT}/api/run-tests`);
    console.log(`=================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${portToTry} is in use, trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
