/**
 * Spherical and annular cavity modes (rigid walls).
 *
 * Spherical (radius R):
 *   f_nlm = (c / 2πR) · χ_nl
 *   χ_nl = n-th positive root of  d/dr[r j_l(kr)]  at r=R  →  j_l'(χ)=0
 *   l = 0,1,2,...  m = -l..l  (degeneracy 2l+1)
 *
 * Annular cylinder (inner a, outer b, length L):
 *   Radial roots of  J'_m(ka) Y'_m(kb) − J'_m(kb) Y'_m(ka) = 0
 *   f = (c/2π) sqrt(k² + (pπ/L)²)
 */

import { besselJ, besselJPrime } from './cavity-modes.js?v=20251023';

/** Bessel Y_n via series (x>0) — adequate for root finding on moderate x. */
export function besselY(n, x) {
  if (n < 0) {
    const sign = (Math.abs(n) % 2 === 0) ? 1 : -1;
    return sign * besselY(-n, x);
  }
  // Use recurrence from Y0, Y1
  const Y0 = (2 / Math.PI) * (Math.log(x / 2) + 0.5772156649015329) * besselJ(0, x)
    - (2 / Math.PI) * seriesY0Part(x);
  const Y1 = (2 / Math.PI) * (Math.log(x / 2) + 0.5772156649015329) * besselJ(1, x)
    - (2 / Math.PI) * (1 / x + seriesY1Part(x));
  if (n === 0) return Y0;
  if (n === 1) return Y1;
  let ynm1 = Y0;
  let yn = Y1;
  for (let k = 1; k < n; k++) {
    const ynp1 = ((2 * k) / x) * yn - ynm1;
    ynm1 = yn;
    yn = ynp1;
  }
  return yn;
}

function seriesY0Part(x) {
  // sum_{k=1}^∞ (-1)^{k+1} H_k (x/2)^{2k} / (k!)^2
  const half = x / 2;
  let sum = 0;
  let term = 1;
  let H = 0;
  for (let k = 1; k < 40; k++) {
    term *= (-half * half) / (k * k);
    H += 1 / k;
    const t = -term * H;
    sum += t;
    if (Math.abs(t) < 1e-18 * (1 + Math.abs(sum))) break;
  }
  return sum * 2; // scale handled by caller formula
}

function seriesY1Part(x) {
  const half = x / 2;
  let sum = 0;
  let term = half;
  let H = 1;
  for (let k = 1; k < 40; k++) {
    term *= (-half * half) / (k * (k + 1));
    H += 1 / k + 1 / (k + 1);
    const t = -term * H * 0.5;
    sum += t;
    if (Math.abs(t) < 1e-18 * (1 + Math.abs(sum))) break;
  }
  return sum;
}

export function besselYPrime(n, x) {
  return 0.5 * (besselY(n - 1, x) - besselY(n + 1, x));
}

/** n-th positive root of j_l'(x) = 0 (spherical Bessel derivative). */
export function sphericalBesselPrimeRoots(l, nRoots = 4) {
  // j_l'(x) = 0  ↔  related to zeros of (x j_l)'  — use series for spherical j_l
  const roots = [];
  const xMax = 20 + 6 * l + 6 * nRoots;
  const h = 0.02;
  let prevX = 0.05;
  let prevY = sphericalJPrime(l, prevX);
  for (let x = prevX + h; x <= xMax && roots.length < nRoots; x += h) {
    const y = sphericalJPrime(l, x);
    if (prevY !== 0 && Math.sign(y) !== Math.sign(prevY)) {
      let a = prevX, b = x;
      for (let i = 0; i < 50; i++) {
        const mid = 0.5 * (a + b);
        if (Math.sign(sphericalJPrime(l, mid)) === Math.sign(sphericalJPrime(l, a))) a = mid;
        else b = mid;
      }
      const root = 0.5 * (a + b);
      if (root > 0.3 && !roots.some((r) => Math.abs(r - root) < 1e-4)) roots.push(root);
    }
    prevX = x;
    prevY = y;
  }
  return roots;
}

/** Spherical Bessel j_l(x) via series. */
export function sphericalBesselJ(l, x) {
  if (x === 0) return l === 0 ? 1 : 0;
  // j_l(x) = sqrt(π/(2x)) J_{l+1/2}(x) — use direct series:
  // j_l(x) = x^l / (2l+1)!! * Σ_k (-x²/2)^k / (k! (2l+3)(2l+5)...)
  let term = 1;
  for (let i = 1; i <= l; i++) term *= x / (2 * i + 1);
  // Actually standard: j_l(x) = Σ_k (-1)^k x^{2k+l} / (2^k k! (2l+2k+1)!!)
  let sum = 0;
  let t = Math.pow(x, l) / doubleFact(2 * l + 1);
  sum = t;
  for (let k = 1; k < 60; k++) {
    t *= (-x * x) / (2 * k * (2 * l + 2 * k + 1));
    sum += t;
    if (Math.abs(t) < 1e-18 * (1 + Math.abs(sum))) break;
  }
  return sum;
}

function doubleFact(n) {
  // (2l+1)!! = 1·3·5···(2l+1)
  let r = 1;
  for (let i = n; i > 1; i -= 2) r *= i;
  return r;
}

export function sphericalBesselJPrime(l, x) {
  // j_l'(x) = j_{l-1}(x) − ((l+1)/x) j_l(x)
  if (x === 0) return l === 1 ? 1 / 3 : 0; // j_1'(0)=1/3
  const jm = l === 0 ? -sphericalBesselJ(1, x) : sphericalBesselJ(l - 1, x);
  // j_0' = -j_1
  if (l === 0) return -sphericalBesselJ(1, x);
  return sphericalBesselJ(l - 1, x) - ((l + 1) / x) * sphericalBesselJ(l, x);
}

function sphericalJPrime(l, x) {
  return sphericalBesselJPrime(l, x);
}

const sphRootCache = new Map();
export function chiSpherical(l, n) {
  const key = `s${l}:${n}`;
  if (sphRootCache.has(key)) return sphRootCache.get(key);
  const roots = sphericalBesselPrimeRoots(l, Math.max(n, 3));
  const r = roots[n - 1];
  if (r === undefined) throw new Error(`Failed spherical j'_${l} root #${n}`);
  sphRootCache.set(key, r);
  return r;
}

/**
 * Rigid-wall spherical cavity modes.
 * @param {object} p
 * @param {number} p.radius - R (m)
 * @param {number} p.c
 * @param {number} p.maxModes
 * @param {number} p.lMax - max angular order
 * @param {number} p.nMax - max radial index
 */
export function sphericalModes({ radius, c, maxModes = 16, lMax = 3, nMax = 3 }) {
  if (!(radius > 0)) throw new Error('Sphere radius must be positive (m).');
  if (!(c > 0)) throw new Error('Sound speed must be positive.');

  const modes = [];
  for (let l = 0; l <= lMax; l++) {
    for (let n = 1; n <= nMax; n++) {
      let chi;
      try {
        chi = chiSpherical(l, n);
      } catch {
        continue;
      }
      const f = (c / (2 * Math.PI * radius)) * chi;
      const degeneracy = 2 * l + 1;
      for (let m = -l; m <= l; m++) {
        // list unique frequencies first; keep degeneracy info
        if (m === -l) {
          modes.push({
            l, m, n,
            chi,
            f,
            omega: 2 * Math.PI * f,
            degeneracy,
            label: `(${n},${l},${m})`,
            type: 'spherical',
          });
        }
      }
    }
  }
  modes.sort((a, b) => a.f - b.f);
  return {
    geometry: 'spherical',
    radius, c,
    modes: modes.slice(0, maxModes),
    formula: 'f_nlm = (c/2πR)·χ_nl,  j_l′(χ)=0',
    assumptions: [
      'Rigid spherical wall (zero normal velocity)',
      'χ_nl from numerical roots of spherical j_l′(x)=0',
      'Angular degeneracy 2l+1 for each (n,l)',
      'Ideal gas, uniform temperature',
    ],
  };
}

/** Pressure mode shape inside sphere (simplified radial part). */
export function sphericalModeShape({ r, theta, R, l, n }) {
  const chi = chiSpherical(l, n);
  const kr = (chi * r) / R;
  // angular part via cos(lθ) for axisymmetric illustration
  return sphericalBesselJ(l, kr) * Math.cos(l * theta);
}

/**
 * Annular cylindrical cavity modes (rigid walls, inner radius a, outer b, length L).
 * Uses numerical roots of Wronskian condition for J'_m, Y'_m.
 */
export function annularCavityModes({ innerRadius, outerRadius, length, c, maxModes = 12, mMax = 3, pMax = 3, nRoots = 3 }) {
  const a = innerRadius;
  const b = outerRadius;
  if (!(a > 0 && b > a && length > 0)) {
    throw new Error('Require 0 < innerRadius < outerRadius and length > 0.');
  }
  if (!(c > 0)) throw new Error('Sound speed must be positive.');

  const modes = [];
  for (let m = 0; m <= mMax; m++) {
    for (let p = 0; p <= pMax; p++) {
      for (let q = 1; q <= nRoots; q++) {
        const k = annularRadialRoot(m, q, a, b);
        if (k == null) continue;
        const f = (c / (2 * Math.PI)) * Math.sqrt(k * k + ((p * Math.PI) / length) ** 2);
        modes.push({
          m, p, q,
          kRadial: k,
          f,
          omega: 2 * Math.PI * f,
          degeneracy: m === 0 ? 1 : 2,
          label: `(${m},${p},${q})`,
          type: 'annular',
        });
      }
    }
  }
  modes.sort((x, y) => x.f - y.f);
  return {
    geometry: 'annular',
    innerRadius: a,
    outerRadius: b,
    length,
    c,
    modes: modes.slice(0, maxModes),
    formula: "f = (c/2π)√[k² + (pπ/L)²],  J'_m(ka)Y'_m(kb) − J'_m(kb)Y'_m(ka) = 0",
    assumptions: [
      'Rigid annular walls',
      'Numerical roots of Bessel Wronskian condition',
      'm ≥ 1 azimuthally degenerate',
      'Ideal gas, uniform temperature',
    ],
  };
}

function annularWronskian(m, k, a, b) {
  return besselJPrime(m, k * a) * besselYPrime(m, k * b)
    - besselJPrime(m, k * b) * besselYPrime(m, k * a);
}

const annCache = new Map();
export function annularRadialRoot(m, q, a, b) {
  const key = `${m}:${q}:${a}:${b}`;
  if (annCache.has(key)) return annCache.get(key);
  // k must be > 0; first roots roughly between max(χ'/b) and large
  const kMin = 0.2 / b;
  const kMax = (12 + 4 * m + 4 * q) / (b - a) + 20 / a;
  const h = 0.02 / b;
  let prevK = kMin;
  let prevV = annularWronskian(m, prevK, a, b);
  let found = 0;
  let lastRoot = null;
  for (let k = prevK + h; k <= kMax; k += h) {
    const v = annularWronskian(m, k, a, b);
    if (Number.isFinite(prevV) && Number.isFinite(v) && prevV !== 0 && Math.sign(v) !== Math.sign(prevV)) {
      let lo = prevK, hi = k;
      for (let i = 0; i < 40; i++) {
        const mid = 0.5 * (lo + hi);
        if (Math.sign(annularWronskian(m, mid, a, b)) === Math.sign(annularWronskian(m, lo, a, b))) lo = mid;
        else hi = mid;
      }
      const root = 0.5 * (lo + hi);
      if (lastRoot == null || Math.abs(root - lastRoot) > 1e-3 * b) {
        found++;
        lastRoot = root;
        if (found === q) {
          annCache.set(key, root);
          return root;
        }
      }
    }
    prevK = k;
    prevV = v;
  }
  return null;
}
