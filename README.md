# GLB Shrink

**Compress any GLB 3D model** — drop a file, see it side-by-side in Three.js, and download a lighter asset ready for games, apps, AR/VR, or the web.

Real-world result from the tool:

![GLB Shrink compressing a 58 MB market table model down to 869 KB](docs/screenshot.png)

**58.3 MB → 869 KB · −99% smaller**  
1.91M triangles → 170.5k triangles · Draco geometry + WebP textures

---

## Why GLB Shrink?

AI-generated and scanned 3D models often ship at **5–60+ MB** with hundreds of thousands to millions of triangles. That is fine for offline tools, but too heavy for real-time projects — games, interactive apps, AR experiences, and the web.

GLB Shrink turns bloated GLBs into **lighter, production-ready assets** in seconds — with a live before/after preview so you can actually see what you are getting.

No Blender. No command line. No guesswork.

---

## Features

### Drop, preview, download
- Drag & drop any `.glb` file (up to 200 MB)
- Instant **before / after** 3D preview with orbit controls
- One-click download of the compressed `-draco.glb` output

### Demo-ready size display
The hero strip at the top shows file sizes in **large, high-contrast type** — built for screen recordings, demos, and social posts. The savings percentage updates live after compression.

### Simple quality controls
No triangle ratios. No geometric error sliders. Just:

| Option | When to use |
|--------|-------------|
| **Smallest file** | Background props, far from the camera |
| **Balanced** | Most projects — games, apps, scenes *(default)* |
| **Sharpest** | Close-up or hero objects |

Fine-tune between presets with a single **Smaller file ↔ Sharper look** slider. A plain-English hint updates as you adjust.

### Production-grade compression
Built on the same pipeline used in real-time 3D projects:

1. Strip existing meshopt / Draco / quantization extensions
2. Weld duplicate vertices
3. Simplify geometry with [MeshoptSimplifier](https://github.com/zeux/meshoptimizer)
4. Re-bake smooth vertex normals (prevents faceted shading)
5. Compress textures to **WebP** and downscale to target resolution
6. **Draco-encode** geometry for minimal transfer size
7. Write binary GLB

Output includes:
- `KHR_draco_mesh_compression` — geometry
- `EXT_texture_webp` — textures

Both are supported by Three.js, Unity, Unreal Engine, Godot, and most modern glTF runtimes.

---

## Quick start

### Prerequisites
- **Node.js 18+**
- macOS, Linux, or Windows

### Development

```bash
git clone https://github.com/boona13/glb-shrink.git
cd glb-shrink
npm install
npm run dev
```

Open **http://localhost:5173** (or the next available port if 5173 is taken).

The Vite dev server serves the UI and proxies API requests to the compression backend on port **3847**.

### Production

```bash
npm run build
npm start
```

Serves the built UI and API from a single server on port **3847**. Override with the `PORT` environment variable.

---

## How to use

1. **Drop your GLB** into the upload zone (or click to browse)
2. The original model loads in the **Before** viewer with file size and triangle count
3. Pick a quality preset — **Balanced** works for most models
4. Click **Compress model**
5. Compare the **After** viewer side-by-side
6. **Download compressed GLB** when you are happy with the result

### Choosing a quality preset

| Preset | Best for | Typical output |
|--------|----------|----------------|
| Smallest file | Distant props, instanced decor | ~3–5k tris, 40–80 KB |
| Balanced | General use — games, apps, scenes | ~5–8k tris, 60–150 KB |
| Sharpest | Close-up viewing, hero assets | ~15–40k tris, 150–400 KB |

Use the fine-tune slider to nudge between presets without touching technical parameters.

---

## Project structure

```
glb-shrink/
├── docs/
│   └── screenshot.png      # README demo screenshot
├── public/
│   └── draco/              # Draco WASM decoders for Three.js preview
├── server/
│   ├── index.mjs           # Express API (inspect + compress)
│   ├── compress.mjs        # Compression pipeline
│   ├── inspect.mjs         # Model stats inspector
│   └── presets.mjs         # Quality preset → compression params
├── src/
│   ├── main.ts             # Three.js UI
│   └── style.css
├── index.html
├── package.json
└── vite.config.ts
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/presets` | List quality presets |
| `POST` | `/api/inspect` | Upload GLB → stats (tris, bbox, textures) |
| `POST` | `/api/compress` | Upload GLB + `quality` (0–100) → compressed GLB |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | Vite, TypeScript, CSS |
| 3D preview | Three.js, OrbitControls, GLTFLoader, DRACOLoader |
| Compression | `@gltf-transform`, meshoptimizer, draco3dgltf, sharp |
| Server | Express, multer |

---

## Using compressed models

Draco-compressed GLBs work across most real-time 3D pipelines. Example with **Three.js**:

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

const gltf = await loader.loadAsync('/models/my-model-draco.glb');
scene.add(gltf.scene);
```

Copy the `public/draco/` folder into your project's static assets so the decoder can load.

---

## Troubleshooting

**Compressed model looks faceted / flat-shaded**  
Normals are re-baked automatically. If this appears, try the **Sharpest** preset — the model may need a higher triangle budget.

**Colors look wrong or model is black**  
The texture may have been stripped during an overly aggressive pass. Try **Balanced** or **Sharpest**, or check that the source GLB has embedded textures.

**File is still too large**  
Move the slider toward **Smallest file**, or pick the Smallest preset. Texture size and triangle count both drop at lower quality settings.

**Browser fails to load compressed GLB (Draco error)**  
Ensure `DRACOLoader` is configured with `setDecoderPath('/draco/')` pointing at the Draco decoder files.

---

## License

[MIT](LICENSE) — free to use, modify, and ship.

---

## Credits

Compression pipeline adapted from the 3D asset workflow built for **ThreeShaders** — an in-development Three.js game by [@boona13](https://github.com/boona13).

Built with [Three.js](https://threejs.org), [@gltf-transform](https://gltf-transform.dev), and [meshoptimizer](https://github.com/zeux/meshoptimizer).
