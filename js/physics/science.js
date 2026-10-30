/**
 * Complex eigenfrequencies (poles), radiation impedance,
 * N-mode coupling matrices, impedance-tube two-microphone method,
 * Monte-Carlo uncertainty, and modal orthogonality checks.
 */

import { coupledTwoMode } from './coupled-resonators.js?v=20251023';

// ── Complex poles ─────────────────────────────────────────────────

/**
 * Complex eigenfrequency of a lightly damped resonance.
 * s = -σ + jω_d,  σ = ω0/(2Q),  ω_d = ω0 sqrt(1 - 1/(4Q²))
 * Also returns f_d (damped) and f_n (natural).
 */
export function complexPole({ f0, Q }) {
  if (!(f0 > 0)) throw new Error('f0 must be positive.');
  if (!(Q > 0)) throw new Error('Q must be positive.');
  const omega0 = 2 * Math.PI * f0;
  const sigma = omega0 / (2 * Q);
  const underdamped = Q > 0.5;
  const omegaD = underdamped ? omega0 * Math.sqrt(1 - 1 / (4 * Q * Q)) : 0;
  return {
    f0,
    Q,
    omega0,
    sigma,
    alphaNp_per_s: sigma,
    fDamped: omegaD / (2 * Math.PI),
    fNatural: f0,
    underdamped,
    pole: { re: -sigma, im: omegaD },
    sPlane: { sigma, omegaD },
    formula: 's = −ω0/(2Q) + j ω0 √(1 − 1/(4Q²))',
    assumptions: ['Linear single-mode', 'Constant Q', 'Small damping when Q ≫ 1'],
  };
}

/**
 * Build a set of complex poles from mode list + Q.
 */
export function poleSet(modes, Q = 30) {
  return modes
    .filter((m) => m.f > 0 && Number.isFinite(m.f))
    .map((m, i) => {
      const p = complexPole({ f0: m.f, Q: m.Q ?? Q });
      return {
        ...p,
        label: m.label || `mode ${i + 1}`,
        index: i,
      };
    });
}

/**
 * Nyquist / s-plane samples for a single pole (unit residue).
 */
export function poleFrequencySweep({ f0, Q, fStart, fEnd, nSamples = 401, scale = 'log' }) {
  const freqs = [];
  const mag = [];
  const phase = [];
  const p = complexPole({ f0, Q });
  const w0 = 2 * Math.PI * f0;
  const sigma = p.sigma;
  for (let i = 0; i < nSamples; i++) {
    let f;
    if (scale === 'log' && fStart > 0 && fEnd > fStart) {
      const t = i / (nSamples - 1);
      f = fStart * Math.pow(fEnd / fStart, t);
    } else {
      f = fStart + ((fEnd - fStart) * i) / (nSamples - 1);
    }
    const w = 2 * Math.PI * f;
    // H = 1 / (sigma + j(w - w0)) + 1/(sigma + j(w + w0))  — use single-sided
    const denRe = sigma;
    const denIm = w - w0;
    const d2 = denRe * denRe + denIm * denIm || 1e-30;
    const re = denRe / d2;
    const im = -denIm / d2;
    freqs.push(f);
    mag.push(Math.hypot(re, im));
    phase.push(Math.atan2(im, re));
  }
  return { freqs, mag, phase, pole: p };
}

// ── Radiation impedance ───────────────────────────────────────────

/**
 * Radiation impedance of a circular piston (flanged / unflanged).
 * Z_rad = R + jX  (Rayleigh integral low-ka + high-ka blend).
 */
export function circularPistonRadiation({ radius, f, rho = 1.2, c = 343, flanged = true }) {
  const a = radius;
  const ka = (2 * Math.PI * f * a) / c;
  const Z0 = rho * c;
  // Low-ka (Rayleigh) expansion — always positive R
  const Rlow = flanged
    ? Z0 * (ka * ka) / 2
    : Z0 * (ka * ka) / 2 * 0.75;
  const Xlow = flanged
    ? Z0 * (8 * ka) / (3 * Math.PI)
    : Z0 * (8 * ka) / (3 * Math.PI) * 0.85;
  // High-ka: R → Z0, X → 0.6/ka * Z0
  const Rhigh = Z0 * (1 - 1 / (2.5 * ka + 1));
  const Xhigh = Z0 * (0.6 / (ka + 0.15));
  // Smooth blend, force R ≥ 0
  const w = 1 / (1 + Math.exp(-(ka - 1.0) * 2.2));
  const R = Math.max(0, (1 - w) * Rlow + w * Rhigh);
  const X = Math.max(0, (1 - w) * Xlow + w * Xhigh);
  return {
    f, ka, flanged,
    Z: { re: R, im: X },
    Zmag: Math.hypot(R, X),
    phaseRad: Math.atan2(X, R),
    radiationQ: X > 0 ? X / Math.max(R, 1e-12) : Infinity,
    model: 'Flanged/unflanged circular piston (low/high ka blend)',
    assumptions: ['Rigid baffle (if flanged)', 'Linear plane-wave source', 'No near-field cavity loading'],
  };
}

// ── N-mode coupling matrix ────────────────────────────────────────

/**
 * Eigen-decomposition of an N×N real symmetric frequency-squared coupling matrix.
 * M_ij = f_i² δ_ij + κ_ij  (κ in Hz²)  →  eigenvalues are (f±)²
 * For the phenomenological Hz coupling used elsewhere we work with
 * the 2×2 style generalized form and extend to N with pairwise κ.
 *
 * @param {number[]} freqs - uncoupled natural frequencies (Hz)
 * @param {number[][]} couplingHz - symmetric matrix of pairwise Δc (Hz)
 */
export function multiModeEigen({ freqs, couplingHz, Q = [] }) {
  const n = freqs.length;
  if (n < 1) throw new Error('Need at least one mode.');
  // Build dynamical matrix in frequency (Hz) form:
  // f± from eigenvalues of  F = diag(f_i) + K, where K_ij = couplingHz[i][j] for i≠j
  // More standard: eigenvalues of ω² matrix. Use:
  // A_ij = f_i² δ_ij + (2 f̄ κ_ij) for i≠j with κ in Hz — keep simple symmetric model:
  const A = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return freqs[i] * freqs[i];
      const k = couplingHz?.[i]?.[j] ?? 0;
      // coupling contributes ~ 2 f_i f_j * (k / f_avg) style; use 2*k*(f_i+f_j)/2
      return 2 * k * (freqs[i] + freqs[j]) * 0.5;
    }),
  );
  const { values, vectors } = symmetricEigenJacobi(A);
  const modes = values.map((v, idx) => {
    const f = Math.sqrt(Math.max(0, v));
    const participation = vectors.map((row) => row[idx] * row[idx]);
    return {
      f,
      fSquared: v,
      label: `eigen ${idx + 1}`,
      participation,
      Q: Q.length === n
        ? 1 / participation.reduce((s, w, i) => s + (w / (Q[i] || Infinity)), 0)
        : null,
    };
  }).sort((a, b) => a.f - b.f);

  return {
    uncoupled: freqs,
    eigenmodes: modes,
    n,
    formula: 'eigen( diag(f_i²) + pairwise coupling )',
    assumptions: [
      'Linear N-mode coupling',
      'Pairwise phenomenological κ in Hz',
      'Not a full-wave eigenproblem',
    ],
  };
}

/** Jacobi eigenvalue algorithm for real symmetric matrices. */
export function symmetricEigenJacobi(Ain, maxIter = 60) {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  let V = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  for (let sweep = 0; sweep < maxIter; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    }
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const cth = 1 / Math.sqrt(t * t + 1);
        const sth = t * cth;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = cth * akp - sth * akq;
          A[k][q] = sth * akp + cth * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = cth * apk - sth * aqk;
          A[q][k] = sth * apk + cth * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = cth * vkp - sth * vkq;
          V[k][q] = sth * vkp + cth * vkq;
        }
      }
    }
  }
  const values = A.map((row, i) => row[i]);
  return { values, vectors: V };
}

// ── Impedance tube (two-microphone) ───────────────────────────────

/**
 * Two-microphone transfer-function method (ISO 10534-2 style).
 * Given complex pressures p1, p2 and spacing s, compute Z at the sample.
 *
 * @param {object} p
 * @param {{re:number,im:number}} p.p1 - complex pressure at mic 1
 * @param {{re:number,im:number}} p.p2 - complex pressure at mic 2
 * @param {number} p.spacing - mic spacing s (m)
 * @param {number} p.f
 * @param {number} p.c
 * @param {number} p.rho
 * @param {number} p.x1 - distance from sample to mic 1 (m)
 */
export function twoMicrophoneImpedance({ p1, p2, spacing, f, c = 343, rho = 1.2, x1 = 0.05 }) {
  if (![spacing, f, c, rho].every((v) => Number.isFinite(v) && v > 0)
      || !Number.isFinite(x1) || x1 < 0) throw new Error('Invalid microphone positions or medium properties.');
  if (![p1?.re, p1?.im, p2?.re, p2?.im].every(Number.isFinite)) throw new Error('Microphone pressures must be finite.');
  const k = (2 * Math.PI * f) / c;
  if (Math.abs(Math.sin(k * spacing)) < 1e-8) throw new Error('Microphone spacing is singular at this frequency (sin(k s) ≈ 0).');
  // H12 = p2/p1
  const den = p1.re * p1.re + p1.im * p1.im;
  if (den === 0) throw new Error('Mic 1 pressure is zero; transfer function is undefined.');
  const H = {
    re: (p2.re * p1.re + p2.im * p1.im) / den,
    im: (p2.im * p1.re - p2.re * p1.im) / den,
  };
  // For p(x)=A(e^{-jkx}+r e^{jkx}), remove the phase at mic 1:
  // r = (H12 − e^{-jks})/(e^{jks} − H12) · e^{-2jkx1}.
  const es = { re: Math.cos(k * spacing), im: -Math.sin(k * spacing) };
  const eps = { re: Math.cos(k * spacing), im: Math.sin(k * spacing) };
  const num = { re: H.re - es.re, im: H.im - es.im };
  const dnm = { re: eps.re - H.re, im: eps.im - H.im };
  let r = cdiv(num, dnm);
  const ph = { re: Math.cos(2 * k * x1), im: -Math.sin(2 * k * x1) };
  r = cmul(r, ph);
  // Z/Z0 = (1+r)/(1-r)
  const onePlus = { re: 1 + r.re, im: r.im };
  const oneMinus = { re: 1 - r.re, im: -r.im };
  const z = cdiv(onePlus, oneMinus);
  const Z0 = rho * c;
  return {
    f,
    k,
    H12: H,
    reflection: r,
    absorption: 1 - (r.re * r.re + r.im * r.im),
    Z: { re: z.re * Z0, im: z.im * Z0 },
    Z0,
    model: 'Two-microphone transfer-function impedance (ISO 10534-2 style)',
    assumptions: ['Plane waves between mics', 'Known mic spacing', 'Linear system', 'Rigid tube walls'],
  };
}

/**
 * Simulate a uniform tube sample of length L and termination Z_L
 * in an impedance tube and return measured-like complex pressures.
 */
export function impedanceTubeMeasurement({ f, sampleLength, Zload, tubeArea = 0.002, c = 343, rho = 1.2, spacing = 0.02, x1 = 0.05, amplitude = 1 }) {
  const k = (2 * Math.PI * f) / c;
  // Zload and recovered Z use specific impedance (Pa·s/m), as in the inverse.
  const Z0 = rho * c;
  const ZL = Zload?.re != null ? Zload : { re: Z0, im: 0 };
  // Reflection at load
  const num = { re: ZL.re - Z0, im: ZL.im };
  const den = { re: ZL.re + Z0, im: ZL.im };
  const rl = cdiv(num, den);
  // Positions of mics relative to sample front (x=0 at sample)
  const xa = x1;
  const xb = x1 + spacing;
  // Incident + reflected
  const pAt = (x) => {
    const eInc = { re: Math.cos(k * x), im: -Math.sin(k * x) };
    const eRef = { re: Math.cos(k * x), im: Math.sin(k * x) };
    return cadd(cscale(eInc, amplitude), cmul(rl, cscale(eRef, amplitude)));
  };
  return {
    f,
    p1: pAt(xa),
    p2: pAt(xb),
    spacing,
    x1,
    rl,
    ZL,
    Z0,
  };
}

// ── Monte Carlo uncertainty ───────────────────────────────────────

/**
 * Monte-Carlo propagation of geometry uncertainty through a model.
 * @param {function} fn - (params) => number
 * @param {object} params - baseline
 * @param {object} sigmas - absolute 1σ per key (or relative if relative=true)
 * @param {object} opts - { n = 400, seed = 1, relative = true }
 */
export function monteCarloUncertainty(fn, params, sigmas, opts = {}) {
  const n = opts.n ?? 400;
  const relative = opts.relative ?? true;
  let seed = opts.seed ?? 1;
  const rand = () => {
    // xorshift-ish deterministic
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const samples = [];
  const keys = Object.keys(sigmas);
  for (let i = 0; i < n; i++) {
    const p = { ...params };
    for (const key of keys) {
      const s = sigmas[key];
      if (!Number.isFinite(s) || s === 0) continue;
      const abs = relative ? Math.abs(params[key] || 0) * s : s;
      p[key] = params[key] + abs * gauss();
    }
    try {
      const y = fn(p);
      if (Number.isFinite(y)) samples.push(y);
    } catch {
      /* skip invalid draws */
    }
  }
  if (!samples.length) throw new Error('Monte Carlo produced no valid samples.');
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (samples.length - 1 || 1);
  const sorted = [...samples].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    n: samples.length,
    mean,
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p05: q(0.05),
    p50: q(0.5),
    p95: q(0.95),
    samples,
    histogram: histogram(samples, 16),
  };
}

function histogram(values, bins = 16) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const counts = Array(bins).fill(0);
  for (const v of values) {
    const i = Math.min(bins - 1, Math.floor((v - min) / width));
    counts[i]++;
  }
  return counts.map((count, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count,
  }));
}

// ── Modal orthogonality / sanity ──────────────────────────────────

/**
 * Check pressure-mode orthogonality for a sampled 2D/3D field set.
 * modes: array of same-shaped arrays. Returns Gram matrix.
 */
export function modalGramMatrix(modeFields) {
  const n = modeFields.length;
  const G = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      const A = modeFields[i];
      const B = modeFields[j];
      for (let r = 0; r < A.length; r++) {
        for (let c = 0; c < A[r].length; c++) s += A[r][c] * B[r][c];
      }
      G[i][j] = s / (A.length * (A[0]?.length || 1));
    }
  }
  return G;
}

// ── Helpers ───────────────────────────────────────────────────────

function cdiv(a, b) {
  const d = b.re * b.re + b.im * b.im || 1e-30;
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  };
}
function cmul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cadd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}
function cscale(a, s) {
  return { re: a.re * s, im: a.im * s };
}

export { coupledTwoMode };
