/**
 * Rigid-wall cavity modes for rectangular and cylindrical geometries.
 *
 * Rectangular: f_{lmn} = (c/2) sqrt( (l/Lx)^2 + (m/Ly)^2 + (n/Lz)^2 )
 * Cylindrical: f_{mnp} = (c/2π) sqrt( (χ'_mp / a)^2 + (pπ / L)^2 )
 *   χ'_mp = m-th positive root of J'_m(x) = 0  (derivative of Bessel J_m)
 *
 * Cylindrical roots are computed numerically (no fake/disabled modes).
 */

/**
 * Bessel function of the first kind J_n(x) via series + recurrence is unstable
 * for large n; we use a hybrid: power series for moderate x, asymptotic not needed
 * for the first ~10 roots of J'_m which lie in x ∈ (0, 40].
 *
 * J_n(x) = sum_{k=0}^∞  (-1)^k / (k! Γ(n+k+1)) (x/2)^{n+2k}
 */
export function besselJ(n, x, maxTerms = 80) {
  if (n < 0) {
    // J_{-n} = (-1)^n J_n
    const sign = (n % 2 === 0) ? 1 : -1;
    return sign * besselJ(-n, x, maxTerms);
  }
  const half = x / 2;
  // Use logarithms carefully via iterative term
  let term = 1;
  // term_k for k=0: 1/Γ(n+1) * (x/2)^n  — start from k=0
  // We'll compute J via:
  // y = 0; term = (x/2)^n / n!  then term_{k} = term_{k-1} * (-(x/2)^2) / (k (n+k))
  if (n === 0) {
    term = 1;
  } else {
    term = 1;
    for (let i = 1; i <= n; i++) term *= half / i;
  }
  let sum = term;
  for (let k = 1; k < maxTerms; k++) {
    term *= (-half * half) / (k * (n + k));
    sum += term;
    if (Math.abs(term) < 1e-18 * Math.abs(sum) && k > n) break;
  }
  return sum;
}

/**
 * Derivative J'_n(x) = (J_{n-1}(x) - J_{n+1}(x)) / 2
 */
export function besselJPrime(n, x) {
  return 0.5 * (besselJ(n - 1, x) - besselJ(n + 1, x));
}

/**
 * Find the p-th positive root of J'_m(x) = 0 (p = 1, 2, 3, ...).
 * Uses bracketing + bisection on successive intervals.
 *
 * Known first roots for reference (approx):
 *   J'_0: 3.8317, 7.0156, 10.1735
 *   J'_1: 1.8412, 5.3314, 8.5363
 *   J'_2: 3.0542, 6.7061, 9.9695
 */
export function besselJPrimeRoots(m, nRoots = 6) {
  const roots = [];
  // Search x in (0, 60] with adaptive bracketing
  const xMax = 40 + 5 * m + 5 * nRoots;
  const h = 0.01;
  let prevX = Math.max(1e-6, m === 0 ? 0.1 : 0.1);
  let prevY = besselJPrime(m, prevX);
  // Skip x=0 which is a root of J'_m for m=1? J'_1(0)=0 actually — for m=1, 0 is a root but we want positive interior roots.
  // For m=0, J'_0(0)=0 too. Start scanning from a small positive value and skip near-zero roots.
  for (let x = prevX + h; x <= xMax && roots.length < nRoots; x += h) {
    const y = besselJPrime(m, x);
    if (prevY === 0) {
      prevX = x; prevY = y; continue;
    }
    if (Math.sign(y) !== Math.sign(prevY)) {
      // bisect [prevX, x]
      let a = prevX, b = x;
      for (let i = 0; i < 60; i++) {
        const mid = 0.5 * (a + b);
        const ym = besselJPrime(m, mid);
        if (Math.sign(ym) === Math.sign(besselJPrime(m, a))) a = mid;
        else b = mid;
      }
      const root = 0.5 * (a + b);
      // skip spurious root at ~0
      if (root > 0.5) {
        // avoid duplicates
        if (!roots.some((r) => Math.abs(r - root) < 1e-4)) {
          roots.push(root);
        }
      }
    }
    prevX = x;
    prevY = y;
  }
  return roots;
}

// Cache of Bessel-prime roots
const rootCache = new Map();
export function chiPrime(m, p) {
  const key = `${m}:${p}`;
  if (rootCache.has(key)) return rootCache.get(key);
  const roots = besselJPrimeRoots(m, Math.max(p, 4));
  const r = roots[p - 1];
  if (r === undefined) {
    throw new Error(`Failed to compute J'_{${m}} root #${p}`);
  }
  rootCache.set(key, r);
  return r;
}

/**
 * Rectangular rigid-wall cavity modes.
 * @param {object} p
 * @param {number} p.Lx, p.Ly, p.Lz  — dimensions (m)
 * @param {number} p.c               — sound speed
 * @param {number} p.maxModes        — number of modes to return (sorted by f)
 * @param {number} p.lMax, p.mMax, p.nMax — index cutoffs
 */
export function rectangularModes({ Lx, Ly, Lz, c, maxModes = 12, lMax = 6, mMax = 6, nMax = 6 }) {
  if (!(Lx > 0 && Ly > 0 && Lz > 0)) throw new Error('All cavity dimensions must be positive (m).');
  if (!(c > 0)) throw new Error('Sound speed must be positive.');

  const modes = [];
  for (let l = 0; l <= lMax; l++) {
    for (let m = 0; m <= mMax; m++) {
      for (let n = 0; n <= nMax; n++) {
        if (l === 0 && m === 0 && n === 0) continue; // uniform, f=0
        const f = (c / 2) * Math.sqrt(
          (l / Lx) ** 2 + (m / Ly) ** 2 + (n / Lz) ** 2
        );
        modes.push({
          l, m, n,
          f,
          omega: 2 * Math.PI * f,
          label: `(${l},${m},${n})`,
          type: 'rectangular',
        });
      }
    }
  }
  modes.sort((a, b) => a.f - b.f);
  return {
    geometry: 'rectangular',
    Lx, Ly, Lz, c,
    modes: modes.slice(0, maxModes),
    formula: 'f_lmn = (c/2)√[(l/Lx)² + (m/Ly)² + (n/Lz)²]',
    assumptions: ['Rigid walls (zero normal velocity)', 'Ideal gas, uniform temperature', 'Index cutoffs lMax,mMax,nMax applied'],
  };
}

/**
 * Cylindrical rigid-wall cavity modes (radius a, length L).
 * Axial index p = 0,1,2,...  (pπ/L)
 * Azimuthal m = 0,1,2,...  (cos mφ / sin mφ — degenerate pair for m≥1)
 * Radial: χ'_mp
 *
 * f_mnp = (c/2π) sqrt( (χ'_mp / a)² + (p π / L)² )
 *
 * For m ≥ 1 each (m,p) pair is doubly degenerate in azimuth.
 */
export function cylindricalModes({ radius, length, c, maxModes = 12, mMax = 4, pMax = 4, radialRoots = 4 }) {
  if (!(radius > 0 && length > 0)) throw new Error('Cylinder radius and length must be positive (m).');
  if (!(c > 0)) throw new Error('Sound speed must be positive.');

  const modes = [];
  for (let m = 0; m <= mMax; m++) {
    for (let p = 0; p <= pMax; p++) {
      for (let q = 1; q <= radialRoots; q++) {
        // q indexes the radial root of J'_m
        let chi;
        try {
          chi = chiPrime(m, q);
        } catch {
          continue;
        }
        const f = (c / (2 * Math.PI)) * Math.sqrt(
          (chi / radius) ** 2 + ((p * Math.PI) / length) ** 2
        );
        const degeneracy = m === 0 ? 1 : 2;
        modes.push({
          m, p, q,
          chiPrime: chi,
          f,
          omega: 2 * Math.PI * f,
          label: `(${m},${p},${q})`,
          degeneracy,
          type: 'cylindrical',
        });
      }
    }
  }
  modes.sort((a, b) => a.f - b.f);
  return {
    geometry: 'cylindrical',
    radius, length, c,
    modes: modes.slice(0, maxModes),
    formula: "f_mnp = (c/2π)√[(χ'_mp/a)² + (pπ/L)²]",
    assumptions: [
      'Rigid cylindrical wall (zero normal velocity)',
      "χ'_mp from numerical roots of J'_m(x)=0",
      'm ≥ 1 modes are doubly degenerate in azimuth',
      'Ideal gas, uniform temperature',
    ],
  };
}

/**
 * Analytic pressure mode for rectangular cavity (normalized to max 1).
 * p(x,y,z) ∝ cos(lπx/Lx) cos(mπy/Ly) cos(nπz/Lz)
 */
export function rectangularModeShape({ x, y, z, Lx, Ly, Lz, l, m, n }) {
  return (
    Math.cos((l * Math.PI * x) / Lx) *
    Math.cos((m * Math.PI * y) / Ly) *
    Math.cos((n * Math.PI * z) / Lz)
  );
}

/**
 * Analytic pressure mode for cylindrical cavity.
 * p(r,φ,z) ∝ J_m(χ'_mp r / a) · cos(mφ) · cos(p π z / L)
 * (cos mφ branch; sin mφ is the degenerate partner)
 */
export function cylindricalModeShape({ r, phi, z, a, L, m, p, q }) {
  const chi = chiPrime(m, q);
  return (
    besselJ(m, (chi * r) / a) *
    Math.cos(m * phi) *
    Math.cos((p * Math.PI * z) / L)
  );
}
