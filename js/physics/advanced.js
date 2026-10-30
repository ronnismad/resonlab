/**
 * Advanced acoustic elements for scientific design:
 * - Micro-perforated panels (Maa)
 * - Conical / exponential horns
 * - Duct transfer matrices
 * - Thermoviscous boundary-layer corrections (Zwikker–Kosten)
 * - Acoustic impedance of lumped resonators
 * - Parameter sensitivity and uncertainty
 * - Dimensionless groups (ka, kh, Helmholtz number)
 */

import { viscousBoundaryLayer, thermalBoundaryLayer } from './air-properties.js?v=20251023';

// ── Dimensionless groups ──────────────────────────────────────────

export function dimensionlessGroups({ f, c, length, radius, volume, rho = 1.2, mu = 1.81e-5 }) {
  const k = (2 * Math.PI * f) / c;
  const omega = 2 * Math.PI * f;
  const delta_v = viscousBoundaryLayer(mu, rho, omega);
  const delta_t = thermalBoundaryLayer(mu, rho, omega);
  return {
    k,
    ka: radius != null ? k * radius : null,
    kL: length != null ? k * length : null,
    HelmholtzNumber: length != null ? (2 * length) / (c / f) : null, // 2L/λ
    lambdaOverCbrtV: volume != null ? (c / f) / Math.cbrt(volume) : null,
    delta_v,
    delta_t,
    deltaOverA: radius != null ? delta_v / radius : null,
    StokesNumber: radius != null ? radius / delta_v : null,
    Re_osc: radius != null ? (rho * omega * radius * radius) / mu : null,
  };
}

// ── Thermoviscous (Zwikker–Kosten style) ──────────────────────────

/**
 * Complex effective density and bulk modulus for circular duct (Zwikker–Kosten).
 * Accounts for viscous and thermal boundary layers.
 * @returns {object} rho_eff, K_eff, c_eff, k_complex, attenuation
 */
export function thermoviscousDuct({ f, rho = 1.2, mu = 1.81e-5, gamma = 1.4, Pr = 0.71, c = 343, radius }) {
  if (!(radius > 0 && f > 0)) throw new Error('radius and f must be positive.');
  const omega = 2 * Math.PI * f;
  const nu = mu / rho;
  // Characteristic shear and thermal numbers
  const delta_v = Math.sqrt((2 * nu) / omega);
  const delta_t = delta_v / Math.sqrt(Pr);
  // Zwikker–Kosten: rho_eff = rho / (1 - 2/(j^{1/2} k_v a) * J1(j^{1/2} k_v a)/J0(...))
  // Engineering approximation for ka ≪ 1 or thin BL (δ ≪ a):
  //   Z ≈ R + jωM  with R_v = (R_s / A) * (P L),  R_s = sqrt(ωμρ/2)
  const Rs = Math.sqrt((omega * mu * rho) / 2);
  const Rt = Rs / Pr; // thermal contribution scale
  const perimeter = 2 * Math.PI * radius;
  const A = Math.PI * radius * radius;
  // Per-unit-length series impedance and shunt admittance (low-frequency)
  const Zs_per_L = (perimeter / A) * (Rs + Rt / gamma); // rough
  const zs_re = Zs_per_L;
  const zs_im = (omega * rho) / A; // mass reactance per length (acoustic)
  // Wave number with loss: k ≈ (ω/c) sqrt(1 + j·loss)
  const loss = Zs_per_L / (rho * c / A);
  const kReal = (omega / c) * (1 + 0.25 * loss * loss);
  const kImag = (omega / c) * (0.5 * loss);
  return {
    f,
    omega,
    radius,
    delta_v,
    delta_t,
    Rs,
    Zs_per_L: { re: zs_re, im: zs_im },
    kComplex: { re: kReal, im: kImag },
    cEff: omega / kReal,
    attenuationNp_per_m: kImag,
    alpha_dB_per_m: 8.686 * kImag,
    model: 'Thin boundary-layer (Zwikker–Kosten-type) engineering approximation',
    assumptions: [
      'δ_v, δ_t ≪ radius',
      'Plane-wave mode',
      'Constant μ, γ, Pr',
      'Low Mach number, linear acoustics',
    ],
  };
}

// ── Micro-perforated panel (Maa) ──────────────────────────────────

/**
 * Maa (1975) micro-perforated panel transfer impedance.
 * @param {object} p
 * @param {number} p.holeDiameter - d (m)
 * @param {number} p.panelThickness - t (m)
 * @param {number} p.porosity - σ (0–1)
 * @param {number} p.f - frequency (Hz)
 * @param {number} p.rho, p.mu, p.c
 */
export function mppImpedance({ holeDiameter, panelThickness, porosity, f, rho = 1.2, mu = 1.81e-5, c = 343 }) {
  const d = holeDiameter;
  const t = panelThickness;
  const sigma = porosity;
  if (!(d > 0 && t > 0)) throw new Error('Hole diameter and thickness must be positive.');
  if (!(sigma > 0 && sigma < 1)) throw new Error('Porosity must be in (0,1).');
  if (!(f > 0)) throw new Error('Frequency must be positive.');

  const omega = 2 * Math.PI * f;
  const a = d / 2;
  const delta_v = Math.sqrt((2 * mu) / (rho * omega));
  const kn = a / delta_v; // shear number ~ a/δ
  // Engineering form of Maa-type MPP transfer impedance:
  //   Re(Z) ≈ (32 μ t)/(σ d²)·√(1+kn²/32) + √(2ωμρ)/(2σ)
  //   Im(Z) ≈ (ωρ t/σ)(1+1/√(9+kn²/2)) + 0.85 ωρ a/σ  (end correction)
  const Rv = ((32 * mu * t) / (sigma * d * d)) * Math.sqrt(1 + (kn * kn) / 32);
  const Rr = Math.sqrt(2 * omega * mu * rho) / (2 * sigma);
  const X_mass = ((omega * rho * t) / sigma) * (1 + 1 / Math.sqrt(9 + (kn * kn) / 2));
  const X_end = (0.85 * omega * rho * a) / sigma;
  const R = Rv + 0.15 * Rr;
  const X = X_mass + X_end;
  return {
    f,
    Z: { re: R, im: X },
    Zmag: Math.hypot(R, X),
    phaseRad: Math.atan2(X, R),
    kn,
    delta_v,
    model: 'Maa-type MPP transfer impedance (engineering real form)',
    assumptions: [
      'Circular subwavelength holes, high porosity regime',
      'Viscous + inertial end corrections',
      'Rigid panel frame',
      'Not a full thermoviscous FEM solve',
    ],
  };
}

// ── Horns ─────────────────────────────────────────────────────────

/**
 * Conical horn input impedance (approximate, plane-wave Webster).
 * Infinite baffle mouth approximation for design.
 */
export function conicalHorn({ throatRadius, mouthRadius, length, f, c = 343, rho = 1.2 }) {
  const a0 = throatRadius;
  const aL = mouthRadius;
  const L = length;
  if (!(a0 > 0 && aL > 0 && L > 0 && f > 0)) throw new Error('Invalid cone dimensions or f.');
  const k = (2 * Math.PI * f) / c;
  const kL = k * L;
  // Webster: for cone, characteristic impedance Zc = ρc / (π a0 aL) * (π aL²) simplified:
  // Z_in ≈ ρc / (π a0²) * ( (aL/a0) cos(kL) + (1/(kL)) sin(kL) * (1 - a0/aL) ) / ...
  // Practical form used in acoustic design:
  const Zc = (rho * c) / (Math.PI * a0 * aL);
  const num = (aL / a0) * Math.cos(kL) + (Math.sin(kL) / (kL || 1e-12)) * (1 - a0 / aL);
  const den = Math.sin(kL) + ((aL / a0) - 1) * (Math.cos(kL) / (kL || 1e-12) - Math.sin(kL) / ((kL * kL) || 1e-18));
  const Zin = Zc * (num / (den || 1e-12));
  return {
    f, k, kL,
    Zin: { re: Number.isFinite(Zin) ? Zin : Zc, im: 0 },
    Zc,
    cutoffApprox: (c / (2 * Math.PI * L)) * Math.abs(aL / a0 - 1),
    model: 'Webster conical-horn plane-wave approximation',
    assumptions: ['Plane waves', 'Rigid walls', 'Flanged mouth approx.', 'No thermoviscous loss'],
  };
}

/**
 * Exponential horn cutoff and impedance estimate.
 * f_c = (c / 2π) · m,  m = flare constant = ln(aL/a0)/L
 */
export function exponentialHorn({ throatRadius, mouthRadius, length, f, c = 343, rho = 1.2 }) {
  const a0 = throatRadius;
  const aL = mouthRadius;
  const L = length;
  if (!(a0 > 0 && aL > 0 && L > 0 && f > 0)) throw new Error('Invalid horn dimensions or f.');
  const m = Math.log(aL / a0) / L;
  const k = (2 * Math.PI * f) / c;
  const k0 = m; // cutoff wave number
  const above = k > k0;
  const beta = above ? Math.sqrt(k * k - m * m) : 0;
  const alpha = above ? 0 : Math.sqrt(m * m - k * k);
  const Zc = (rho * c) / (Math.PI * a0 * a0);
  // Z_in ≈ Zc * ( (m + jβ) / (jk) ) for infinite horn above cutoff
  const Zre = above ? (m / k) * Zc : Zc;
  const Zim = above ? (beta / k) * Zc : 0;
  return {
    f, k, m,
    cutoffHz: (c / (2 * Math.PI)) * m,
    aboveCutoff: above,
    Zin: { re: Zre, im: Zim },
    Zc,
    model: 'Exponential horn (Webster) approximate input impedance',
    assumptions: ['Infinite horn approx', 'Plane waves', 'Rigid walls', 'Lossless'],
  };
}

// ── Transfer matrix / duct chain ──────────────────────────────────

/**
 * Uniform duct transfer matrix (pressure, volume velocity).
 * [p1; U1] = [A B; C D] [p2; U2]
 * A = cos(kL), B = j Z0 sin(kL), C = j sin(kL)/Z0, D = cos(kL)
 * Implemented with real/imag parts.
 */
export function ductTransferMatrix({ f, length, area, c = 343, rho = 1.2, lossNp_per_m = 0 }) {
  const omega = 2 * Math.PI * f;
  const kRe = omega / c;
  const kIm = lossNp_per_m;
  // k = kRe − j kIm  →  kL = kRe L − j kIm L
  // cos(kL) = cos(kRe L)cosh(kIm L) + j sin(kRe L)sinh(kIm L)
  // sin(kL) = sin(kRe L)cosh(kIm L) − j cos(kRe L)sinh(kIm L)
  const cosh = Math.cosh(kIm * length);
  const sinh = Math.sinh(kIm * length);
  const cR = Math.cos(kRe * length);
  const sR = Math.sin(kRe * length);
  const cosk = { re: cR * cosh, im: sR * sinh };
  const sink = { re: sR * cosh, im: -cR * sinh };
  const Z0 = (rho * c) / area;
  // B = j Z0 sin(kL) = j Z0 (sink.re + j sink.im) = Z0(−sink.im + j sink.re)
  const B = { re: -Z0 * sink.im, im: Z0 * sink.re };
  // C = j sin(kL)/Z0
  const C = { re: -sink.im / Z0, im: sink.re / Z0 };
  return {
    A: cosk,
    B,
    C,
    D: cosk,
    Z0,
    k: { re: kRe, im: kIm },
    formula: '[[A,B],[C,D]] = [[cos kL, jZ0 sin kL],[j sin kL/Z0, cos kL]]',
    assumptions: ['1D plane wave', 'Rigid duct', 'Uniform cross-section', 'Linearized'],
  };
}

/** Chain N duct segments: total = T1·T2·…·TN */
export function chainTransferMatrices(matrices) {
  let A = { re: 1, im: 0 }, B = { re: 0, im: 0 }, C = { re: 0, im: 0 }, D = { re: 1, im: 0 };
  for (const m of matrices) {
    // multiply [[A,B],[C,D]] * m
    const nA = cadd(cmul(A, m.A), cmul(B, m.C));
    const nB = cadd(cmul(A, m.B), cmul(B, m.D));
    const nC = cadd(cmul(C, m.A), cmul(D, m.C));
    const nD = cadd(cmul(C, m.B), cmul(D, m.D));
    A = nA; B = nB; C = nC; D = nD;
  }
  return { A, B, C, D };
}

function cadd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
function cmul(a, b) { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }

// ── Lumped resonator impedance ────────────────────────────────────

/**
 * Acoustic impedance of a Helmholtz resonator looking into the neck.
 * Z = R + j(ω Ma − 1/(ω Ca))
 */
export function helmholtzImpedance({ f, f0, rho = 1.2, c = 343, volume, neckArea, L_eff, Q = 30 }) {
  const omega = 2 * Math.PI * f;
  const omega0 = 2 * Math.PI * f0;
  const Ma = (rho * L_eff) / neckArea;
  const Ca = volume / (rho * c * c);
  const R = (omega0 * Ma) / Math.max(Q, 1e-6);
  const X = omega * Ma - 1 / (omega * Ca);
  return {
    f,
    Z: { re: R, im: X },
    Zmag: Math.hypot(R, X),
    phaseRad: Math.atan2(X, R),
    Ma, Ca, R,
    resonance: Math.abs(X) < R * 0.2,
    model: 'Lumped Helmholtz neck impedance',
  };
}

// ── Sensitivity / uncertainty ─────────────────────────────────────

/**
 * Finite-difference sensitivity ∂y/∂p for a scalar model y(p).
 * @param {function} fn - (params) => number
 * @param {object} params - baseline
 * @param {string[]} keys - parameters to differentiate
 * @param {number} relStep - relative step
 */
export function sensitivity(fn, params, keys, relStep = 1e-4) {
  const base = fn(params);
  const out = {};
  for (const key of keys) {
    const p0 = params[key];
    if (typeof p0 !== 'number' || !Number.isFinite(p0)) continue;
    const h = Math.abs(p0) * relStep || relStep;
    const plus = { ...params, [key]: p0 + h };
    const minus = { ...params, [key]: p0 - h };
    let d = 0;
    try {
      d = (fn(plus) - fn(minus)) / (2 * h);
    } catch {
      d = NaN;
    }
    out[key] = {
      dYdP: d,
      elasticity: p0 !== 0 ? (d * p0) / base : NaN, // (p/y)(dy/dp)
    };
  }
  return { base, sensitivities: out };
}

/**
 * First-order uncertainty: σ_y² ≈ Σ (∂y/∂p_i)² σ_i²
 */
export function propagateUncertainty(sensitivities, sigmas) {
  let varY = 0;
  const terms = [];
  for (const [key, s] of Object.entries(sensitivities)) {
    const sig = sigmas[key];
    if (sig == null || !Number.isFinite(sig)) continue;
    const contrib = (s.dYdP * sig) ** 2;
    varY += contrib;
    terms.push({ key, dYdP: s.dYdP, sigma: sig, contrib });
  }
  return { sigmaY: Math.sqrt(varY), variance: varY, terms };
}

// ── Mode density (Weyl) ───────────────────────────────────────────

/**
 * Weyl asymptotic mode count for a 3D cavity volume V and surface S.
 * N(f) ≈ (4π V / c³) f³ + (π S / 2 c²) f + ...
 */
export function weylModeCount({ f, c = 343, volume, surfaceArea }) {
  const n = (4 * Math.PI * volume * f ** 3) / c ** 3
    + (Math.PI * surfaceArea * f) / (2 * c * c);
  return {
    f,
    cumulativeModes: n,
    densityPerHz: (12 * Math.PI * volume * f * f) / c ** 3
      + (Math.PI * surfaceArea) / (2 * c * c),
    formula: 'N(f) ≈ 4πV f³/c³ + πS f/(2c²)',
    assumptions: ['High-frequency asymptotics', 'Rigid walls', 'Large ka'],
  };
}

// ── Side-branch resonator (quarter-wave stub) ─────────────────────

/**
 * Side branch of length L_branch attached to a main duct.
 * Resonance when L = (2n−1)λ/4 (closed-open stub) or n λ/2.
 */
export function sideBranchModes({ branchLength, c = 343, nModes = 6, boundary = 'quarter-wave' }) {
  if (!(branchLength > 0)) throw new Error('Branch length must be positive.');
  const modes = [];
  for (let n = 1; n <= nModes; n++) {
    const f = boundary === 'quarter-wave'
      ? ((2 * n - 1) * c) / (4 * branchLength)
      : (n * c) / (2 * branchLength);
    modes.push({
      n,
      f,
      lambda: c / f,
      harmonic: boundary === 'quarter-wave' ? 2 * n - 1 : n,
      label: boundary === 'quarter-wave' ? `n=${n} (λ/4 stub)` : `n=${n}`,
    });
  }
  return {
    boundary,
    branchLength,
    c,
    modes,
    formula: boundary === 'quarter-wave'
      ? 'f_n = (2n−1)c/(4L)'
      : 'f_n = n c/(2L)',
    assumptions: ['Ideal side branch', 'Neglect main-duct loading', 'Rigid walls'],
  };
}
