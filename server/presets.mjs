const SMALLEST = {
  id: 'smallest',
  label: 'Smallest file',
  hint: 'Far away or tiny on screen',
  simplifyRatio: 0.004,
  simplifyError: 0.02,
  textureEdge: 256,
  quality: 0,
};

const BALANCED = {
  id: 'balanced',
  label: 'Balanced',
  hint: 'Recommended for most projects',
  simplifyRatio: 0.008,
  simplifyError: 0.02,
  textureEdge: 384,
  quality: 50,
};

const SHARPEST = {
  id: 'sharpest',
  label: 'Sharpest look',
  hint: 'Close-up or hero objects',
  simplifyRatio: 0.035,
  simplifyError: 0.01,
  textureEdge: 512,
  quality: 100,
};

export const PRESETS = [SMALLEST, BALANCED, SHARPEST];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPreset(from, to, t) {
  return {
    simplifyRatio: lerp(from.simplifyRatio, to.simplifyRatio, t),
    simplifyError: lerp(from.simplifyError, to.simplifyError, t),
    textureEdge: Math.round(lerp(from.textureEdge, to.textureEdge, t)),
  };
}

export function resolveSettings(qualityInput) {
  const quality = Math.max(0, Math.min(100, Number(qualityInput) || 50));
  const t = quality / 100;

  if (t <= 0.5) {
    return { quality, ...lerpPreset(SMALLEST, BALANCED, t * 2) };
  }
  return { quality, ...lerpPreset(BALANCED, SHARPEST, (t - 0.5) * 2) };
}

export function getPresetHint(quality) {
  const q = Math.max(0, Math.min(100, Number(quality) || 50));
  if (q <= 20) return 'Tiny file — best for background props you barely notice.';
  if (q <= 40) return 'Small file — good for distant scene objects.';
  if (q <= 60) return 'Balanced — the sweet spot for most projects.';
  if (q <= 80) return 'More detail — edges and textures stay sharper.';
  return 'Maximum detail — for close-up viewing, larger file size.';
}
