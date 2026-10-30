/**
 * Advanced research toolkit — pure functions (no Plotly/DOM).
 * Transmission loss, bootstrap CIs, Prony pole extraction, case metrics.
 */

import { ductTransferMatrix, chainTransferMatrices } from './advanced.js?v=20251023';
import { complexPole } from './science.js?v=20251023';

// ── Transmission loss (muffler / duct chain) ─────────────────────

/**
 * Two-port transmission loss from a transfer matrix.
 * TL = 20 log10 | (A + B/Z0 + C Z0 + D) / 2 |  (dB)
 * Assumes equal inlet/outlet duct characteristic impedance Z0.
 */
export function transmissionLossFromMatrix({ A, B, C, D, Z0 }) {
  if (!Z0 || !(Z0 > 0)) throw new Error('Z0 must be positive.');
  const c = (v) => (v && typeof v === 'object' ? v : { re: v, im: 0 });
  const a = c(A), b = c(B), cc = c(C), d = c(D);
  // (A + B/Z0 + C*Z0 + D)
  const re = a.re + b.re / Z0 + cc.re * Z0 + d.re;
  const im = a.im + b.im / Z0 + cc.im * Z0 + d.im;
  const mag = Math.hypot(re, im);
  const tl = 20 * Math.log10(Math.max(mag / 2, 1e-12));
  return {
    TLdB: tl,
    matrix: { A: a, B: b, C: cc, D: d },
    Z0,
    formula: 'TL = 20 log₁₀ | (A + B/Z₀ + C Z₀ + D) / 2 |',
    assumptions: ['Plane wave', 'Same Z₀ at ports', 'Linear two-port'],
  };
}

/**
 * Classic expansion-chamber TL (area ratio m = S2/S1, length L).
 * TL = 10 log10 [ 1 + ¼ (m − 1/m)² sin²(k L) ]
 */
export function expansionChamberTL({ f, length, areaRatio, c = 343 }) {
  if (!(areaRatio > 0)) throw new Error('areaRatio must be positive.');
  if (!(length > 0)) throw new Error('length must be positive.');
  const k = (2 * Math.PI * f) / c;
  const m = areaRatio;
  const s = Math.sin(k * length);
  const tl = 10 * Math.log10(1 + 0.25 * (m - 1 / m) ** 2 * s * s);
  return {
    TLdB: tl,
    kL: k * length,
    areaRatio: m,
    formula: 'TL = 10 log₁₀[1 + ¼(m − 1/m)² sin²(kL)]',
    assumptions: ['Ideal expansion chamber', 'Plane wave', 'No wall loss'],
  };
}

/**
 * Frequency sweep of expansion-chamber TL.
 */
export function expansionChamberTLSweep({ fStart, fEnd, length, areaRatio, c = 343, n = 120, scale = 'log' }) {
  const freqs = [];
  const tl = [];
  for (let i = 0; i < n; i++) {
    let f;
    if (scale === 'log' && fStart > 0 && fEnd > fStart) {
      f = fStart * Math.pow(fEnd / fStart, i / (n - 1));
    } else {
      f = fStart + ((fEnd - fStart) * i) / (n - 1);
    }
    freqs.push(f);
    tl.push(expansionChamberTL({ f, length, areaRatio, c }).TLdB);
  }
  return { freqs, TLdB: tl, formula: expansionChamberTL({ f: fStart, length, areaRatio, c }).formula };
}

/**
 * Chain of duct segments → TL(f) via transfer matrices.
 * @param {Array<{length:number, area:number, lossNp_per_m?:number}>} segments
 */
export function ductChainTLSweep({ segments, fStart, fEnd, c = 343, rho = 1.2, n = 100, scale = 'log' }) {
  if (!segments?.length) throw new Error('segments required');
  const S1 = segments[0].area;
  const Z0 = (rho * c) / S1;
  const freqs = [];
  const tl = [];
  for (let i = 0; i < n; i++) {
    let f;
    if (scale === 'log' && fStart > 0 && fEnd > fStart) {
      f = fStart * Math.pow(fEnd / fStart, i / (n - 1));
    } else {
      f = fStart + ((fEnd - fStart) * i) / (n - 1);
    }
    const mats = segments.map((s) =>
      ductTransferMatrix({
        f,
        length: s.length,
        area: s.area,
        c,
        rho,
        lossNp_per_m: s.lossNp_per_m ?? 0,
      })
    );
    const chain = chainTransferMatrices(mats);
    const r = transmissionLossFromMatrix({ A: chain.A, B: chain.B, C: chain.C, D: chain.D, Z0 });
    freqs.push(f);
    tl.push(r.TLdB);
  }
  return {
    freqs,
    TLdB: tl,
    Z0,
    formula: 'TL from chained transfer matrices',
    assumptions: ['Plane wave', 'Linear two-port chain'],
  };
}

// ── Bootstrap confidence intervals ───────────────────────────────

/**
 * Bootstrap CI for a scalar statistic of samples.
 * @returns {{mean:number, std:number, ciLo:number, ciHi:number, level:number}}
 */
export function bootstrapCI(samples, { nBoot = 500, level = 0.95, seed = 42, statistic = 'mean' } = {}) {
  const x = samples.filter((v) => Number.isFinite(v));
  if (x.length < 2) throw new Error('Need ≥2 finite samples');
  const stat = (arr) => {
    if (statistic === 'median') {
      const s = [...arr].sort((a, b) => a - b);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
    }
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };
  const point = stat(x);
  // xorshift RNG for reproducibility
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const boots = [];
  for (let b = 0; b < nBoot; b++) {
    const draw = [];
    for (let i = 0; i < x.length; i++) {
      draw.push(x[Math.floor(rnd() * x.length)]);
    }
    boots.push(stat(draw));
  }
  boots.sort((a, b) => a - b);
  const alpha = (1 - level) / 2;
  const q = (p) => {
    const idx = Math.min(boots.length - 1, Math.max(0, Math.floor(p * (boots.length - 1))));
    return boots[idx];
  };
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const std = Math.sqrt(x.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, x.length - 1));
  return {
    mean,
    std,
    point,
    ciLo: q(alpha),
    ciHi: q(1 - alpha),
    level,
    n: x.length,
    nBoot,
    statistic,
    formula: `percentile bootstrap ${statistic} CI (${(level * 100).toFixed(0)}%)`,
    assumptions: ['i.i.d. samples', 'Percentile bootstrap'],
  };
}

// ── Prony / matrix-pencil style pole extraction ──────────────────

/**
 * Prony extraction of damped sinusoids from a uniform complex/time series.
 * Signal model: y[n] = Σ A_k exp(s_k n Δt), s_k = σ_k + jω_k
 * @param {number[]} yReal @param {number[]} yImag (optional)
 * @param {number} dt sample step
 * @param {number} nModes number of poles to extract
 */
export function pronyPoles({ yReal, yImag = null, dt, nModes = 2 }) {
  const N = yReal.length;
  if (!(dt > 0)) throw new Error('dt must be positive');
  const n = Math.min(nModes, Math.floor(N / 2) - 1);
  if (n < 1) throw new Error('Not enough samples for Prony');
  // Build complex series
  const y = yReal.map((re, i) => ({
    re,
    im: yImag ? yImag[i] : 0,
  }));
  // Complex linear prediction: y[k] + Σ a_j y[k-j] = 0, a_j complex.
  // Unknowns: [Re a1, Im a1, ..., Re an, Im an] (2n real unknowns)
  const rows = [];
  const rhs = [];
  for (let k = n; k < N; k++) {
    // real equation
    const rowR = [];
    for (let j = 1; j <= n; j++) {
      const yj = y[k - j];
      rowR.push(yj.re);   // * Re(a_j)
      rowR.push(-yj.im);  // * Im(a_j)
    }
    rows.push(rowR);
    rhs.push(-y[k].re);
    // imag equation
    const rowI = [];
    for (let j = 1; j <= n; j++) {
      const yj = y[k - j];
      rowI.push(yj.im);   // * Re(a_j)
      rowI.push(yj.re);   // * Im(a_j)
    }
    rows.push(rowI);
    rhs.push(-y[k].im);
  }
  const x = solveLeastSquares(rows, rhs);
  const a = [];
  for (let j = 0; j < n; j++) {
    a.push({ re: x[2 * j], im: x[2 * j + 1] });
  }
  // Companion polynomial: z^n + a1 z^{n-1} + ... + an = 0 (complex coeffs)
  const coeffs = [{ re: 1, im: 0 }, ...a];
  const roots = polyRootsDK(coeffs);
  const poles = roots.map((z) => {
    const mod = Math.hypot(z.re, z.im) || 1e-30;
    const arg = Math.atan2(z.im, z.re);
    const sigma = Math.log(mod) / dt;
    const omega = arg / dt;
    return {
      pole: { re: sigma, im: omega },
      fHz: Math.abs(omega) / (2 * Math.PI),
      sigma,
      Q: omega !== 0 ? Math.abs(omega / (2 * Math.max(sigma, 1e-12))) : Infinity,
      z: { re: z.re, im: z.im },
    };
  }).sort((p, q) => p.fHz - q.fHz);

  return {
    poles,
    dt,
    nModes: n,
    residuals: pronyResidual(y, a, n),
    formula: 'y[n] ≈ Σ A_k e^{s_k n Δt} via linear prediction + companion roots',
    assumptions: ['Uniform sampling', 'Damped sinusoid model', 'Number of modes specified'],
  };
}

function pronyResidual(y, a, n) {
  let err = 0;
  for (let k = n; k < y.length; k++) {
    let pr = y[k].re;
    let pi = y[k].im;
    for (let j = 1; j <= n; j++) {
      const aj = a[j - 1];
      const yj = y[k - j];
      // a_j * y_{k-j}
      pr += aj.re * yj.re - aj.im * yj.im;
      pi += aj.re * yj.im + aj.im * yj.re;
    }
    err += pr * pr + pi * pi;
  }
  return Math.sqrt(err / Math.max(1, y.length - n));
}

/** Minimal real least squares via normal equations + Gaussian elimination. */
function solveLeastSquares(rows, rhs) {
  const m = rows.length;
  const n = rows[0].length;
  const ATA = Array.from({ length: n }, () => new Array(n).fill(0));
  const ATb = new Array(n).fill(0);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      ATb[j] += rows[i][j] * rhs[i];
      for (let k = 0; k < n; k++) {
        ATA[j][k] += rows[i][j] * rows[i][k];
      }
    }
  }
  // Regularize slightly for rank issues
  for (let i = 0; i < n; i++) ATA[i][i] += 1e-12;
  return gauss(ATA, ATb);
}

function gauss(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    }
    [M[i], M[piv]] = [M[piv], M[i]];
    const d = M[i][i] || 1e-30;
    for (let c = i; c <= n; c++) M[i][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r][i];
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
    }
  }
  return M.map((row) => row[n]);
}

/** Durand–Kerner roots of monic polynomial with complex coeffs (coeffs[0]=1+0j). */
function polyRootsDK(coeffs) {
  const deg = coeffs.length - 1;
  if (deg < 1) return [];
  const c = coeffs.map((v) => (v && typeof v === 'object' ? v : { re: v, im: 0 }));
  const evalP = (z) => {
    let re = c[0].re;
    let im = c[0].im;
    for (let i = 1; i < c.length; i++) {
      const nre = re * z.re - im * z.im + c[i].re;
      const nim = re * z.im + im * z.re + c[i].im;
      re = nre; im = nim;
    }
    return { re, im };
  };
  let roots = [];
  for (let i = 0; i < deg; i++) {
    const ang = (2 * Math.PI * i) / deg + 0.4;
    roots.push({ re: 0.4 * Math.cos(ang), im: 0.4 * Math.sin(ang) });
  }
  for (let iter = 0; iter < 120; iter++) {
    for (let i = 0; i < deg; i++) {
      const num = evalP(roots[i]);
      let den = { re: 1, im: 0 };
      for (let j = 0; j < deg; j++) {
        if (j === i) continue;
        const dre = roots[i].re - roots[j].re;
        const dim = roots[i].im - roots[j].im;
        const nre = den.re * dre - den.im * dim;
        const nim = den.re * dim + den.im * dre;
        den = { re: nre, im: nim };
      }
      const d2 = den.re * den.re + den.im * den.im || 1e-30;
      const inv = { re: den.re / d2, im: -den.im / d2 };
      const step = {
        re: num.re * inv.re - num.im * inv.im,
        im: num.re * inv.im + num.im * inv.re,
      };
      roots[i] = { re: roots[i].re - step.re, im: roots[i].im - step.im };
    }
  }
  return roots;
}

// ── Case snapshots for research comparison ───────────────────────

/**
 * Normalize a results object into a comparable research case card.
 */
export function makeCaseSnapshot({ name, type, env, results, params = {} }) {
  const f0 = results?.modes?.[0]?.f ?? null;
  const Q = results?.damping?.Q ?? null;
  return {
    name: name || 'Case',
    type: type || '',
    f0,
    Q,
    bandwidth: results?.damping?.bandwidth ?? null,
    c: env?.c ?? null,
    rho: env?.rho ?? null,
    nModes: results?.modes?.length ?? 0,
    params,
    ts: Date.now(),
  };
}

/**
 * Compare two cases: relative deltas on f0, Q.
 */
export function compareCases(a, b) {
  const rel = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || y === 0) return null;
    return (x - y) / y;
  };
  return {
    df0: a.f0 != null && b.f0 != null ? a.f0 - b.f0 : null,
    df0rel: rel(a.f0, b.f0),
    dQ: a.Q != null && b.Q != null ? a.Q - b.Q : null,
    dQrel: rel(a.Q, b.Q),
    formula: 'Δrel = (A − B) / B',
    assumptions: ['Comparable models', 'Same units (SI)'],
  };
}

// ── Research data package ────────────────────────────────────────

/**
 * Assemble a machine-readable research package.
 */
export function buildResearchPackage({ state, env, results, extra = {} }) {
  return {
    schema: 'acoustudio.research/1',
    generated: new Date().toISOString(),
    author: 'S. Chatterjee',
    software: 'ResonLab V1.3 — Acoustic Resonator Studio',
    state,
    environment: {
      temperatureC: env?.temperatureC,
      pressurePa: env?.pressurePa,
      humidity: env?.humidity,
      gasId: env?.gasId,
      c: env?.c,
      rho: env?.rho,
      cModel: env?.cModel,
    },
    primary: {
      f0: results?.modes?.[0]?.f ?? null,
      Q: results?.damping?.Q ?? null,
      bandwidth: results?.damping?.bandwidth ?? null,
      lambda: results?.modes?.[0]?.lambda ?? null,
    },
    modes: (results?.modes || []).map((m) => ({
      f: m.f,
      label: m.label,
      lambda: m.lambda,
      n: m.n,
    })),
    damping: results?.damping
      ? {
          Q: results.damping.Q,
          bandwidth: results.damping.bandwidth,
          tauAmplitude: results.damping.tauAmplitude,
          tauEnergy: results.damping.tauEnergy,
          mechanisms: results.damping.mechanisms,
        }
      : null,
    assumptions: results?.assumptions || [],
    warnings: results?.warnings || [],
    ...extra,
  };
}

export { complexPole };
