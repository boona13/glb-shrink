import { NodeIO } from '@gltf-transform/core';
import {
  KHRDracoMeshCompression,
  KHRMeshQuantization,
  ALL_EXTENSIONS,
} from '@gltf-transform/extensions';
import {
  weld,
  simplify,
  textureCompress,
  prune,
  dedup,
  draco,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { inspectBuffer } from './inspect.mjs';

let ioPromise;

async function getIO() {
  if (!ioPromise) {
    ioPromise = (async () => {
      await MeshoptDecoder.ready;
      await MeshoptEncoder.ready;
      await MeshoptSimplifier.ready;
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

function countTris(root) {
  let tris = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (indices) tris += Math.floor(indices.getCount() / 3);
    }
  }
  return tris;
}

function rebakeSmoothNormals(doc, root) {
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      const indices = prim.getIndices();
      if (!position || !indices) continue;

      const posArr = position.getArray();
      const idxArr = indices.getArray();
      if (!posArr || !idxArr) continue;

      const vCount = position.getCount();
      const normals = new Float32Array(vCount * 3);

      for (let t = 0; t < idxArr.length; t += 3) {
        const a = idxArr[t];
        const b = idxArr[t + 1];
        const c = idxArr[t + 2];

        const ax = posArr[a * 3], ay = posArr[a * 3 + 1], az = posArr[a * 3 + 2];
        const bx = posArr[b * 3], by = posArr[b * 3 + 1], bz = posArr[b * 3 + 2];
        const cx = posArr[c * 3], cy = posArr[c * 3 + 1], cz = posArr[c * 3 + 2];

        const abx = bx - ax, aby = by - ay, abz = bz - az;
        const acx = cx - ax, acy = cy - ay, acz = cz - az;

        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;

        normals[a * 3] += nx; normals[a * 3 + 1] += ny; normals[a * 3 + 2] += nz;
        normals[b * 3] += nx; normals[b * 3 + 1] += ny; normals[b * 3 + 2] += nz;
        normals[c * 3] += nx; normals[c * 3 + 1] += ny; normals[c * 3 + 2] += nz;
      }

      for (let i = 0; i < vCount; i++) {
        const nx = normals[i * 3];
        const ny = normals[i * 3 + 1];
        const nz = normals[i * 3 + 2];
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 1e-8) {
          normals[i * 3] = nx / len;
          normals[i * 3 + 1] = ny / len;
          normals[i * 3 + 2] = nz / len;
        } else {
          normals[i * 3] = 0;
          normals[i * 3 + 1] = 1;
          normals[i * 3 + 2] = 0;
        }
      }

      const existingNormal = prim.getAttribute('NORMAL');
      if (existingNormal) {
        existingNormal.setArray(normals).setType('VEC3').setNormalized(false);
      } else {
        const accessor = doc.createAccessor().setArray(normals).setType('VEC3');
        prim.setAttribute('NORMAL', accessor);
      }
    }
  }
}

export async function compressBuffer(buffer, profile) {
  const io = await getIO();
  const doc = await io.readBinary(new Uint8Array(buffer));
  const root = doc.getRoot();

  for (const ext of root.listExtensionsUsed()) {
    if (
      ext.extensionName === KHRDracoMeshCompression.EXTENSION_NAME ||
      ext.extensionName === KHRMeshQuantization.EXTENSION_NAME ||
      ext.extensionName === 'EXT_meshopt_compression'
    ) {
      ext.dispose();
    }
  }

  const sourceTris = countTris(root);

  await doc.transform(
    weld({}),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: profile.simplifyRatio,
      error: profile.simplifyError,
      lockBorder: false,
    }),
    dedup(),
    prune({ keepAttributes: false }),
  );

  rebakeSmoothNormals(doc, root);

  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [profile.textureEdge, profile.textureEdge],
      quality: 75,
    }),
  );

  await doc.transform(
    prune(),
    dedup(),
    draco({
      method: 'edgebreaker',
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeGeneric: 12,
    }),
  );

  const output = await io.writeBinary(doc);
  const outputBuffer = Buffer.from(output);
  const stats = await inspectBuffer(outputBuffer);

  return {
    buffer: outputBuffer,
    stats: {
      ...stats,
      sourceTris,
      finalTris: stats.tris,
    },
  };
}
