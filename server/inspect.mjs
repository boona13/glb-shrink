import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

let ioPromise;

async function getIO() {
  if (!ioPromise) {
    ioPromise = (async () => {
      await MeshoptDecoder.ready;
      await MeshoptEncoder.ready;
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          'draco3d.decoder': await draco3d.createDecoderModule(),
          'draco3d.encoder': await draco3d.createEncoderModule(),
          'meshopt.decoder': MeshoptDecoder,
          'meshopt.encoder': MeshoptEncoder,
        });
    })();
  }
  return ioPromise;
}

function collectMeshStats(root) {
  let verts = 0;
  let tris = 0;
  const bbox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      const indices = prim.getIndices();
      if (position) {
        verts += position.getCount();
        const arr = position.getArray();
        if (arr) {
          for (let i = 0; i < arr.length; i += 3) {
            bbox.min[0] = Math.min(bbox.min[0], arr[i]);
            bbox.min[1] = Math.min(bbox.min[1], arr[i + 1]);
            bbox.min[2] = Math.min(bbox.min[2], arr[i + 2]);
            bbox.max[0] = Math.max(bbox.max[0], arr[i]);
            bbox.max[1] = Math.max(bbox.max[1], arr[i + 1]);
            bbox.max[2] = Math.max(bbox.max[2], arr[i + 2]);
          }
        }
      }
      if (indices) tris += Math.floor(indices.getCount() / 3);
    }
  }

  return { verts, tris, bbox };
}

export async function inspectBuffer(buffer) {
  const io = await getIO();
  const doc = await io.readBinary(new Uint8Array(buffer));
  const root = doc.getRoot();

  const { verts, tris, bbox } = collectMeshStats(root);

  const textures = root.listTextures().map((tex) => ({
    name: tex.getName() || '(unnamed)',
    mimeType: tex.getMimeType(),
    bytes: tex.getImage()?.byteLength ?? 0,
  }));

  const extensions = root.listExtensionsUsed().map((ext) => ext.extensionName);

  return {
    meshCount: root.listMeshes().length,
    verts,
    tris,
    bbox: {
      min: bbox.min.map((v) => (Number.isFinite(v) ? v : 0)),
      max: bbox.max.map((v) => (Number.isFinite(v) ? v : 0)),
      size: bbox.max.map((v, i) =>
        Number.isFinite(v) && Number.isFinite(bbox.min[i]) ? v - bbox.min[i] : 0,
      ),
    },
    textures,
    extensions,
  };
}
