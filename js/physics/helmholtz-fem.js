/** Axisymmetric P1 FEM for a cylindrical cavity with one coaxial circular neck.
 * Kij = integral 2*pi*r grad(Ni).grad(Nj) dA + mouth Robin term.
 * Mij = integral 2*pi*r Ni Nj dA (exact cubic integration).
 * No fitted frequencies: the lowest generalized eigenpairs are solved directly.
 */
import { symmetricEigenJacobi } from './science.js?v=20251023';
import { helmholtzResonance } from './helmholtz-resonator.js?v=20251023';

export const HELMHOLTZ_MESH_LEVELS = {
  coarse: { radialNeck: 3, radialBody: 8, axialBody: 12, axialNeck: 5 },
  medium: { radialNeck: 5, radialBody: 14, axialBody: 22, axialNeck: 9 },
  fine: { radialNeck: 8, radialBody: 24, axialBody: 38, axialNeck: 16 },
};

export function helmholtzFemGeometry(g = {}) {
  const { volume, neckRadius, neckLength, cavityAspectRatio = 1, nNecks = 1,
    cavityShape = 'cylinder', neckShape = 'circular', endCorrectionModel = 'flanged' } = g;
  if (![volume, neckRadius, cavityAspectRatio].every((v) => Number.isFinite(v) && v > 0)
      || !Number.isFinite(neckLength) || neckLength < 0) throw new Error('Volume, neck radius and cavity aspect ratio must be positive; neck length must be nonnegative.');
  if (nNecks !== 1 || cavityShape !== 'cylinder' || neckShape !== 'circular') {
    throw new Error('Helmholtz FEM currently supports one circular coaxial neck on a cylindrical cavity.');
  }
  if (!['none', 'flanged', 'unflanged'].includes(endCorrectionModel)) throw new Error('Unknown mouth end-correction model.');
  const radius = Math.cbrt(volume / (2 * Math.PI * cavityAspectRatio));
  const height = 2 * radius * cavityAspectRatio;
  if (!(neckRadius < radius)) throw new Error('The neck radius must be smaller than the cavity radius. Increase cavity volume or reduce the neck radius.');
  if (Math.max(radius, height, neckLength) > 100 || Math.min(radius, height, neckRadius) < 1e-6) throw new Error('Geometry is outside the supported FEM length range (1 µm to 100 m).');
  const mouthDelta = (endCorrectionModel === 'flanged' ? 0.8216 : endCorrectionModel === 'unflanged' ? 0.6133 : 0) * neckRadius;
  return { kind: 'helmholtz-axisymmetric', volume, radius, height, neckRadius, neckLength,
    cavityAspectRatio, endCorrectionModel, mouthDelta,
    boundary: mouthDelta > 0 ? 'Rigid walls; mouth ∂p/∂n + p/δ = 0 (exterior end correction)' : 'Rigid walls; mouth p = 0 (pressure release)' };
}

/** Conforming mesh: the neck shares the cavity's top nodes, never a disconnected patch. */
export function meshHelmholtz(g, level = 'medium') {
  const geometry = helmholtzFemGeometry(g);
  const spec = HELMHOLTZ_MESH_LEVELS[level];
  if (!spec) throw new Error('Choose coarse, medium, or fine mesh.');
  const { radius: R, height: H, neckRadius: a, neckLength: L } = geometry;
  const { radialNeck: nr, radialBody: nb, axialBody: nz, axialNeck: nn } = spec;
  const radii = Array.from({ length: nr + 1 }, (_, i) => a * i / nr);
  for (let i = 1; i <= nb; i++) radii.push(a + (R - a) * Math.pow(i / nb, 1.4));
  const nodes = [], triangles = [], rows = [];
  const addRow = (z, rs) => { const row = rs.map((r) => { nodes.push([r, z]); return nodes.length - 1; }); rows.push(row); return row; };
  const join = (bottom, top) => {
    for (let i = 0; i < top.length - 1; i++) {
      const [a0, b, c, d] = [bottom[i], bottom[i + 1], top[i + 1], top[i]];
      if (i % 2) triangles.push([a0, b, d], [b, c, d]);
      else triangles.push([a0, b, c], [a0, c, d]);
    }
  };
  for (let j = 0; j <= nz; j++) {
    const row = addRow(H * (1 - Math.pow(1 - j / nz, 1.5)), radii);
    if (j) join(rows[j - 1], row);
  }
  let neckRow = rows[nz].slice(0, nr + 1);
  if (L > 0) for (let j = 1; j <= nn; j++) {
    const row = addRow(H + L * j / nn, radii.slice(0, nr + 1));
    join(neckRow, row); neckRow = row;
  }
  const mouthEdges = [];
  for (let i = 0; i < neckRow.length - 1; i++) mouthEdges.push([neckRow[i], neckRow[i + 1]]);
  const edgeKey = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
  const edges = new Map(), mouths = new Set(mouthEdges.map(([a, b]) => edgeKey(a, b)));
  for (const tri of triangles) for (let i = 0; i < 3; i++) {
    const a = tri[i], b = tri[(i + 1) % 3], key = edgeKey(a, b);
    const edge = edges.get(key);
    if (edge) edge.count++; else edges.set(key, { nodes: [a, b], count: 1 });
  }
  const boundaries = { mouth: mouthEdges, axis: [], rigid: [] };
  for (const [key, edge] of edges) if (edge.count === 1 && !mouths.has(key)) {
    const target = edge.nodes.every((i) => nodes[i][0] === 0) ? boundaries.axis : boundaries.rigid;
    target.push(edge.nodes);
  }
  return { nodes, triangles, mouthNodes: neckRow, mouthEdges, boundaries, geometry, level };
}

// Symmetric lower-band storage: A[i,j] at i*(bandwidth+1)+(i-j), i>=j.
function bandMatrix(n, bandwidth) { return { n, bandwidth, data: new Float64Array(n * (bandwidth + 1)) }; }
function add(A, i, j, value) {
  if (i < j) [i, j] = [j, i];
  A.data[i * (A.bandwidth + 1) + i - j] += value;
}
export function bandMultiply(A, x) {
  const { n, bandwidth: b, data } = A, y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    y[i] += data[i * (b + 1)] * x[i];
    for (let j = Math.max(0, i - b); j < i; j++) {
      const v = data[i * (b + 1) + i - j]; y[i] += v * x[j]; y[j] += v * x[i];
    }
  }
  return y;
}

export function assembleHelmholtz(mesh) {
  const { nodes, triangles, mouthEdges, geometry } = mesh;
  const fixed = new Set(geometry.mouthDelta === 0 ? mesh.mouthNodes : []);
  const dof = nodes.map((_, i) => fixed.has(i) ? -1 : 0);
  let n = 0;
  for (let i = 0; i < dof.length; i++) if (dof[i] !== -1) dof[i] = n++;
  let bandwidth = 0;
  for (const tri of triangles) for (const i of tri) for (const j of tri) {
    if (dof[i] >= 0 && dof[j] >= 0) bandwidth = Math.max(bandwidth, Math.abs(dof[i] - dof[j]));
  }
  const K = bandMatrix(n, bandwidth), M = bandMatrix(n, bandwidth);
  let integratedVolume = 0;
  for (const tri of triangles) {
    const pts = tri.map((i) => nodes[i]);
    const [p, q, s] = pts;
    const determinant = (q[0] - p[0]) * (s[1] - p[1]) - (s[0] - p[0]) * (q[1] - p[1]);
    const area = Math.abs(determinant) / 2;
    if (!(area > 0)) throw new Error('Degenerate triangle in FEM mesh.');
    const gradients = [[q[1] - s[1], s[0] - q[0]], [s[1] - p[1], p[0] - s[0]], [p[1] - q[1], q[0] - p[0]]].map((v) => v.map((x) => x / determinant));
    const r = pts.map((v) => v[0]), sumR = r[0] + r[1] + r[2];
    const volume = 2 * Math.PI * area * sumR / 3;
    integratedVolume += volume;
    for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) {
      const a = dof[tri[i]], b = dof[tri[j]];
      if (a < 0 || b < 0) continue;
      add(K, a, b, volume * (gradients[i][0] * gradients[j][0] + gradients[i][1] * gradients[j][1]));
      const mass = i === j ? area * (sumR + 2 * r[i]) / 30 : area * (sumR + r[i] + r[j]) / 60;
      add(M, a, b, 2 * Math.PI * mass);
    }
  }
  if (geometry.mouthDelta > 0) for (const [i, j] of mouthEdges) {
    const r0 = nodes[i][0], r1 = nodes[j][0];
    const factor = 2 * Math.PI * (r1 - r0) / geometry.mouthDelta;
    add(K, dof[i], dof[i], factor * (3 * r0 + r1) / 12);
    add(K, dof[j], dof[j], factor * (r0 + 3 * r1) / 12);
    add(K, dof[i], dof[j], factor * (r0 + r1) / 12);
  }
  return { K, M, dof, integratedVolume };
}

function factorCholesky(A) {
  const { n, bandwidth: b } = A, data = A.data.slice(), stride = b + 1;
  for (let i = 0; i < n; i++) for (let j = Math.max(0, i - b); j <= i; j++) {
    let sum = data[i * stride + i - j];
    for (let k = Math.max(0, i - b, j - b); k < j; k++) sum -= data[i * stride + i - k] * data[j * stride + j - k];
    if (i === j) {
      if (!(sum > 0) || !Number.isFinite(sum)) throw new Error('FEM stiffness is not positive definite. Check the mouth boundary and mesh.');
      data[i * stride] = Math.sqrt(sum);
    } else data[i * stride + i - j] = sum / data[j * stride];
  }
  return { n, bandwidth: b, data };
}
function solveCholesky(L, rhs) {
  const { n, bandwidth: b, data } = L, x = Float64Array.from(rhs), stride = b + 1;
  for (let i = 0; i < n; i++) {
    for (let j = Math.max(0, i - b); j < i; j++) x[i] -= data[i * stride + i - j] * x[j];
    x[i] /= data[i * stride];
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j <= Math.min(n - 1, i + b); j++) x[i] -= data[j * stride + j - i] * x[j];
    x[i] /= data[i * stride];
  }
  return x;
}
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function massOrthonormalize(vectors, M) {
  const basis = [], masses = [];
  for (const vector of vectors) {
    const v = Float64Array.from(vector), mv = bandMultiply(M, v);
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j < basis.length; j++) {
      const coefficient = dot(basis[j], mv);
      for (let k = 0; k < v.length; k++) { v[k] -= coefficient * basis[j][k]; mv[k] -= coefficient * masses[j][k]; }
    }
    const norm = Math.sqrt(dot(v, mv));
    if (!(norm > 1e-20)) throw new Error('FEM eigensolver lost an independent search direction.');
    for (let k = 0; k < v.length; k++) { v[k] /= norm; mv[k] /= norm; }
    basis.push(v); masses.push(mv);
  }
  return basis;
}

/** Block inverse iteration and Rayleigh–Ritz; banded factorization, no dense 2D matrix. */
export function solveLowestModes(K, M, { nModes = 6, tolerance = 1e-7, maxIterations = 160, onProgress } = {}) {
  if (!Number.isInteger(nModes) || nModes < 1 || nModes > Math.min(12, K.n - 2)) throw new Error('Invalid FEM mode count.');
  const p = Math.min(nModes + 6, K.n), L = factorCholesky(K);
  let seed = 8231;
  let Q = massOrthonormalize(Array.from({ length: p }, (_, j) => Float64Array.from({ length: K.n }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return j === 0 ? 1 : seed / 4294967296 - 0.5;
  })), M);
  let values, residuals;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    Q = massOrthonormalize(Q.map((v) => solveCholesky(L, bandMultiply(M, v))), M);
    const KQ = Q.map((v) => bandMultiply(K, v));
    const T = Q.map((v) => KQ.map((kv) => dot(v, kv)));
    // Exact symmetry and scale-independent small eigensolve.
    for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) T[i][j] = T[j][i] = (T[i][j] + T[j][i]) / 2;
    const scale = Math.max(...T.map((r, i) => Math.abs(r[i])));
    const eig = symmetricEigenJacobi(T.map((r) => r.map((v) => v / scale)), 80);
    const order = eig.values.map((v, i) => ({ value: v * scale, i })).sort((a, b) => a.value - b.value);
    Q = order.map(({ i }) => Float64Array.from({ length: K.n }, (_, k) => Q.reduce((s, v, j) => s + v[k] * eig.vectors[j][i], 0)));
    values = order.map((v) => v.value);
    residuals = Q.slice(0, nModes).map((v, i) => {
      const kv = bandMultiply(K, v), mv = bandMultiply(M, v);
      let norm = 0, denominator = 0;
      for (let k = 0; k < v.length; k++) { norm += (kv[k] - values[i] * mv[k]) ** 2; denominator += kv[k] ** 2; }
      return Math.sqrt(norm / Math.max(denominator, 1e-300));
    });
    onProgress?.({ iteration: iteration + 1, residual: Math.max(...residuals) });
    if (residuals.every((v) => v < tolerance)) {
      return { values: values.slice(0, nModes), vectors: Q.slice(0, nModes), residuals, iterations: iteration + 1 };
    }
  }
  throw new Error(`FEM eigenmodes did not converge (relative residual ${Math.max(...residuals).toExponential(2)}). Try a different mesh.`);
}

export function helmholtzModesFEM({ geometry, c = 343, level = 'medium', nModes = 6, onProgress } = {}) {
  if (!Number.isFinite(c) || c <= 0) throw new Error('Sound speed must be finite and positive.');
  const mesh = meshHelmholtz(geometry, level), system = assembleHelmholtz(mesh);
  const solution = solveLowestModes(system.K, system.M, { nModes, onProgress });
  const modes = solution.values.map((k2, i) => {
    if (!(k2 > 0)) throw new Error('An open Helmholtz resonator must have positive eigenvalues.');
    const vector = system.dof.map((d) => d < 0 ? 0 : solution.vectors[i][d]);
    const max = Math.max(...vector.map(Math.abs));
    const values = vector.map((v) => v / max);
    // Fix arbitrary eigenvector sign for stable displays.
    if (values[0] < 0) for (let j = 0; j < values.length; j++) values[j] *= -1;
    const k = Math.sqrt(k2), f = c * k / (2 * Math.PI);
    return { f, k, k2, values, label: `Axisymmetric mode ${i + 1}`, lambda: c / f, residual: solution.residuals[i] };
  });
  let lumped = null;
  try { lumped = helmholtzResonance({ ...geometry, c }); } catch { /* A zero-length uncorrected aperture has no finite lumped estimate. */ }
  return { kind: 'helmholtz-axisymmetric', modes, mesh, geometry: mesh.geometry, c,
    diagnostics: { iterations: solution.iterations, residuals: solution.residuals, integratedVolume: system.integratedVolume, dofs: system.K.n },
    comparison: { lumpedHz: lumped?.f0 ?? null, femHz: modes[0].f, difference: lumped ? (modes[0].f - lumped.f0) / lumped.f0 : null },
    formula: 'Axisymmetric P1 FEM: K p = k² M p, volume weight 2πr; consistent mass',
    assumptions: ['Cylindrical cavity; one circular coaxial neck', 'Axisymmetric pressure modes only (azimuthal order m = 0)',
      'Rigid walls; lossless fluid', mesh.geometry.boundary, 'No radiation damping, exterior mesh, or thermoviscous losses',
      'Neck–cavity junction inertia is resolved by the mesh; only the exterior mouth correction is approximated'],
  };
}
