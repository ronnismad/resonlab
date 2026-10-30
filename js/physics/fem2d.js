/**
 * 2D acoustic modes using bilinear quadrilateral (Q1) finite elements
 * with consistent mass and rigid-wall (Neumann) boundaries.
 *
 * Solves K p = k² M p. On a uniform rectangle the tensor-product
 * matrices separate into two small 1D generalized eigenproblems.
 * Pure physics — no DOM/Plotly.
 */

import { symmetricEigenJacobi } from './science.js?v=20251023';

function validateGrid({ Nx, Ny, Lx, Ly }) {
  if (![Nx, Ny].every((v) => Number.isInteger(v) && v >= 3 && v <= 64)) {
    throw new Error('Nx and Ny must be integers between 3 and 64.');
  }
  if (![Lx, Ly].every((v) => Number.isFinite(v) && v >= 1e-6 && v <= 1e6)) {
    throw new Error('Lx and Ly must be finite lengths between 1e-6 and 1e6 m.');
  }
}

/** Linear 1D elements: Ke = [1,-1;-1,1]/h, Me = h[2,1;1,2]/6. */
function axisMatrices(N, length) {
  const h = length / (N - 1);
  const K = Array.from({ length: N }, () => Array(N).fill(0));
  const M = Array.from({ length: N }, () => Array(N).fill(0));
  for (let e = 0; e < N - 1; e++) {
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      K[e + a][e + b] += (a === b ? 1 : -1) / h;
      M[e + a][e + b] += h * (a === b ? 2 : 1) / 6;
    }
  }
  return { K, M, h };
}

/** Q1 rectangle assembly; node index = j*Nx+i. Primarily for verification. */
export function finiteElementMatrices2D({ Nx = 16, Ny = 12, Lx = 1, Ly = 0.8 } = {}) {
  validateGrid({ Nx, Ny, Lx, Ly });
  if (Nx * Ny > 1024) throw new Error('Dense matrix inspection is limited to 1024 nodes.');
  const x = axisMatrices(Nx, Lx);
  const y = axisMatrices(Ny, Ly);
  const n = Nx * Ny;
  const K = Array.from({ length: n }, () => Array(n).fill(0));
  const M = Array.from({ length: n }, () => Array(n).fill(0));
  for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) {
    for (let l = Math.max(0, j - 1); l <= Math.min(Ny - 1, j + 1); l++) {
      for (let k = Math.max(0, i - 1); k <= Math.min(Nx - 1, i + 1); k++) {
        K[j * Nx + i][l * Nx + k] = y.M[j][l] * x.K[i][k] + y.K[j][l] * x.M[i][k];
        M[j * Nx + i][l * Nx + k] = y.M[j][l] * x.M[i][k];
      }
    }
  }
  return { K, M, Nx, Ny, Lx, Ly, hx: x.h, hy: y.h, n };
}

function axisModes(N, length) {
  // Work on the unit interval to keep the eigenproblem scale independent.
  const { K, M } = axisMatrices(N, 1);
  const L = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) {
    let s = M[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j];
  }
  const inv = Array.from({ length: N }, () => Array(N).fill(0));
  for (let col = 0; col < N; col++) for (let i = 0; i < N; i++) {
    let s = i === col ? 1 : 0;
    for (let j = 0; j < i; j++) s -= L[i][j] * inv[j][col];
    inv[i][col] = s / L[i][i];
  }
  const B = inv.map((row) => K[0].map((_, j) => row.reduce((s, v, k) => s + v * K[k][j], 0)));
  const A = B.map((row) => inv.map((r) => row.reduce((s, v, k) => s + v * r[k], 0)));
  const scale = Math.max(...A.map((row, i) => Math.abs(row[i])));
  const { values, vectors } = symmetricEigenJacobi(A.map((r) => r.map((v) => v / scale)), 80);
  const modes = values.map((value, col) => ({
    k2: value * scale / (length * length),
    vec: inv[0].map((_, i) => inv.reduce((s, row, k) => s + row[i] * vectors[k][col], 0)),
  })).sort((a, b) => a.k2 - b.k2);
  // The connected Neumann domain has exactly one constant null mode.
  modes[0] = { k2: 0, vec: Array(N).fill(1) };
  return modes;
}

/**
 * Legacy cell-centered Neumann FD Laplacian (not used by the FEM solver).
 * Symmetric form (1-D Neumann Laplacian Kronecker-summed):
 *   L1 = (1/h²)·tridiag(1,−2,1) with corners (−1) instead of (−2)
 *   A  = Iy ⊗ Lx + Ly ⊗ Ix
 * Returns A with  A u ≈ −k² u  (eigenvalues λ = −k²).
 */
export function neumannLaplacian2D({ Nx = 16, Ny = 12, Lx = 1, Ly = 0.8 }) {
  validateGrid({ Nx, Ny, Lx, Ly });
  const hx = Lx / Nx;
  const hy = Ly / Ny;
  const n = Nx * Ny;
  const idx = (i, j) => j * Nx + i;

  const L1 = (N, h) => {
    const M = Array.from({ length: N }, () => new Array(N).fill(0));
    const c = 1 / (h * h);
    for (let i = 0; i < N; i++) {
      M[i][i] = -2 * c;
      if (i + 1 < N) {
        M[i][i + 1] = c;
        M[i + 1][i] = c;
      }
    }
    M[0][0] = -c;
    M[N - 1][N - 1] = -c;
    return M;
  };

  const Mx = L1(Nx, hx);
  const My = L1(Ny, hy);

  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < Ny; j++) {
    for (let i = 0; i < Nx; i++) {
      const p = idx(i, j);
      for (let i2 = 0; i2 < Nx; i2++) {
        if (Mx[i][i2] !== 0) A[p][idx(i2, j)] += Mx[i][i2];
      }
      for (let j2 = 0; j2 < Ny; j2++) {
        if (My[j][j2] !== 0) A[p][idx(i, j2)] += My[j][j2];
      }
    }
  }

  // Enforce exact symmetry (numerical hygiene)
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const m = 0.5 * (A[a][b] + A[b][a]);
      A[a][b] = m;
      A[b][a] = m;
    }
  }
  return { A, Nx, Ny, hx, hy, Lx, Ly, n };
}

/**
 * Solve lowest 2D Neumann modes (k, f, field).
 * @param {object} opts
 * @param {number} opts.Nx grid nodes in x
 * @param {number} opts.Ny grid nodes in y
 * @param {number} opts.Lx domain length (m)
 * @param {number} opts.Ly domain height (m)
 * @param {number} opts.c sound speed
 * @param {number} opts.nModes how many modes to return
 * @param {boolean} opts.includeZero keep the uniform mode (k=0)
 */
export function femModes2D({ Nx = 16, Ny = 12, Lx = 1, Ly = 0.8, c = 343, nModes = 8, includeZero = true } = {}) {
  validateGrid({ Nx, Ny, Lx, Ly });
  if (!Number.isFinite(c) || c <= 0) throw new Error('Sound speed must be finite and positive.');
  const available = Nx * Ny - (includeZero ? 0 : 1);
  if (!Number.isInteger(nModes) || nModes < 1 || nModes > available) {
    throw new Error(`nModes must be an integer between 1 and ${available}.`);
  }
  const hx = Lx / (Nx - 1);
  const hy = Ly / (Ny - 1);
  const xModes = axisModes(Nx, Lx);
  const yModes = axisModes(Ny, Ly);
  const pairs = [];
  for (let m = 0; m < Ny; m++) for (let l = 0; l < Nx; l++) {
    if (!includeZero && l === 0 && m === 0) continue;
    pairs.push({ k2: xModes[l].k2 + yModes[m].k2, l, m });
  }
  pairs.sort((a, b) => a.k2 - b.k2);

  const modes = [];
  for (const p of pairs) {
    const k = Math.sqrt(p.k2);
    const f = (k * c) / (2 * Math.PI);
    // reshape field
    const field = Array.from({ length: Ny }, (_, j) =>
      Array.from({ length: Nx }, (_, i) => xModes[p.l].vec[i] * yModes[p.m].vec[j])
    );
    // normalize max abs to 1
    let maxAbs = 0;
    for (const row of field) for (const v of row) maxAbs = Math.max(maxAbs, Math.abs(v));
    const scale = maxAbs > 0 ? 1 / maxAbs : 1;
    for (const row of field) for (let i = 0; i < row.length; i++) row[i] *= scale;

    modes.push({
      f,
      k,
      k2: p.k2,
      l: p.l,
      m: p.m,
      field,
      hx,
      hy,
      Nx,
      Ny,
      Lx,
      Ly,
      label: `FEM (${p.l},${p.m})`,
      lambda: f > 0 ? c / f : Infinity,
    });
    if (modes.length >= nModes) break;
  }

  return {
    modes,
    grid: { Nx, Ny, hx, hy, Lx, Ly },
    formula: 'Q1 finite elements with consistent mass: K p = k² M p',
    assumptions: [
      '2-D rectangular domain',
      'Rigid walls (∂p/∂n = 0)',
      'Lossless eigenfrequencies',
      'Bilinear quadrilateral elements on a uniform structured mesh',
      'Homogeneous fluid; rectangular reference domain only',
    ],
  };
}

/**
 * Analytical Neumann rectangle modes for verification.
 * f_lmn (2D: m,n) = (c/2) √[(l/Lx)² + (m/Ly)²]
 */
export function analyticalRectModes2D({ Lx, Ly, c = 343, maxL, maxM, nModes = 8, includeZero = true }) {
  if (![Lx, Ly, c].every((v) => Number.isFinite(v) && v > 0)) throw new Error('Lengths and sound speed must be finite and positive.');
  if (!Number.isInteger(nModes) || nModes < 1) throw new Error('nModes must be a positive integer.');
  // Each axis needs at most nModes indices for the lowest nModes of any aspect ratio.
  maxL ??= nModes;
  maxM ??= nModes;
  const out = [];
  for (let l = 0; l <= maxL; l++) {
    for (let m = 0; m <= maxM; m++) {
      if (l === 0 && m === 0) {
        if (includeZero) out.push({ l, m, f: 0, k: 0 });
        continue;
      }
      const k = Math.PI * Math.sqrt((l / Lx) ** 2 + (m / Ly) ** 2);
      out.push({ l, m, f: (k * c) / (2 * Math.PI), k });
    }
  }
  out.sort((a, b) => a.f - b.f);
  return out.slice(0, nModes);
}

/**
 * Compare FEM frequencies to analytic (relative error).
 */
export function compareFemAnalytic(femResult, analytic, tol = 0.02) {
  const femF = femResult.modes.map((m) => m.f);
  const rows = [];
  for (let i = 0; i < Math.min(femF.length, analytic.length); i++) {
    const a = analytic[i].f;
    const f = femF[i];
    const rel = a > 0 ? Math.abs(f - a) / a : (f === 0 ? 0 : 1);
    rows.push({
      index: i,
      fem: f,
      analytic: a,
      relErr: rel,
      ok: rel <= tol || (a === 0 && f < 1e-6),
      label: analytic[i].l != null ? `(${analytic[i].l},${analytic[i].m})` : String(i),
    });
  }
  return rows;
}
