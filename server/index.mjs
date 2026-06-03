import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectBuffer } from './inspect.mjs';
import { compressBuffer } from './compress.mjs';
import { PRESETS, resolveSettings, getPresetHint } from './presets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3847;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = file.originalname.toLowerCase().endsWith('.glb');
    cb(ok ? null : new Error('Only .glb files are supported'), ok);
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/presets', (_req, res) => {
  res.json(PRESETS.map(({ id, label, hint, quality }) => ({ id, label, hint, quality })));
});

app.post('/api/inspect', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const stats = await inspectBuffer(req.file.buffer);
    res.json({
      fileName: req.file.originalname,
      fileSize: req.file.size,
      ...stats,
    });
  } catch (err) {
    console.error('Inspect failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Inspect failed' });
  }
});

app.post('/api/compress', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const settings = resolveSettings(req.body.quality ?? 50);
    const { quality, ...profile } = settings;

    const { buffer, stats } = await compressBuffer(req.file.buffer, profile);

    res.json({
      fileName: req.file.originalname.replace(/\.glb$/i, '-draco.glb'),
      sourceSize: req.file.size,
      outputSize: buffer.byteLength,
      quality,
      hint: getPresetHint(quality),
      stats,
      data: buffer.toString('base64'),
    });
  } catch (err) {
    console.error('Compress failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Compression failed' });
  }
});

if (isProd) {
  const dist = path.join(ROOT, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`GLB Shrink API listening on http://localhost:${PORT}`);
});
