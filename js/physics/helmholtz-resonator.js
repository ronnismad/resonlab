/**
 * Helmholtz resonator: neck + cavity, including end corrections
 * and inverse design (solve for V, L_n, or A given a target frequency).
 *
 * Standard model:
 *   f0 = (c / 2π) * sqrt( A / (V * L_eff) )
 *   L_eff = L_n + Δ
 *   Δ = end correction of the neck (open to free field or flush)
 *
 * Valid when wavelength >> cavity dimensions and neck length is not huge.
 */

import { endCorrection } from './tube-resonators.js?v=20251023';

/**
 * End correction for a Helmholtz neck.
 * Single open end (flush with large baffle): Δ ≈ 0.8216 a  (flanged)
 * Free unflanged: Δ ≈ 0.6133 a
 * Neck in a cavity wall: typically one external end correction.
 */
export function neckEndCorrection(radius, model = 'flanged') {
  return endCorrection(radius, model === 'flanged', model === 'none' ? 'none' : (model === 'unflanged' ? 'rayleigh' : 'flanged'));
}

/**
 * @param {object} p
 * @param {number} p.neckRadius - a (m)
 * @param {number} p.neckLength - L_n geometric (m)
 * @param {number} p.volume    - V (m³)
 * @param {number} p.c         - sound speed (m/s)
 * @param {number} p.rho       - density (kg/m³) — for impedance/quality estimates
 * @param {'flanged'|'unflanged'|'none'} p.endCorrectionModel
 * @param {number} p.nNecks    - number of identical necks (optional, default 1)
 */
export function helmholtzResonance({
  neckRadius,
  neckLength,
  volume,
  c,
  rho = 1.2,
  endCorrectionModel = 'flanged',
  nNecks = 1,
}) {
  if (!(neckRadius > 0)) throw new Error('Neck radius must be positive (m).');
  if (!(neckLength >= 0)) throw new Error('Neck length must be ≥ 0 (m).');
  if (!(volume > 0)) throw new Error('Cavity volume must be positive (m³).');
  if (!(c > 0)) throw new Error('Sound speed must be positive (m/s).');
  if (!(nNecks >= 1)) throw new Error('Number of necks must be ≥ 1.');

  const a = neckRadius;
  const A = nNecks * Math.PI * a * a;
  const delta = endCorrectionModel === 'none'
    ? 0
    : (endCorrectionModel === 'flanged'
      ? endCorrection(a, true)
      : endCorrection(a, false));
  const L_eff = neckLength + delta;
  if (!(L_eff > 0)) throw new Error('Effective neck length must be positive.');

  const f0 = (c / (2 * Math.PI)) * Math.sqrt(A / (volume * L_eff));
  const omega0 = 2 * Math.PI * f0;

  // Acoustic mass and compliance (lumped)
  const Ma = (rho * L_eff) / A;          // kg/m^4
  const Ca = volume / (rho * c * c);     // m^3/Pa  (adiabatic)
  const f0_check = 1 / (2 * Math.PI * Math.sqrt(Ma * Ca));

  return {
    f0,
    omega0,
    A,
    neckArea: A,
    neckRadius: a,
    nNecks,
    neckLength,
    volume,
    endCorrection: delta,
    L_eff,
    Ma,
    Ca,
    f0_check,
    c,
    rho,
    formula: 'f0 = (c/2π)·√(A/(V·L_eff)), L_eff = L_n + Δ',
    endCorrectionModel,
    assumptions: [
      'Lumped Helmholtz model (wavelength ≫ cavity, neck not acoustically long)',
      'Rigid walls; linear acoustics',
      `End correction model: ${endCorrectionModel} (Δ = ${delta.toFixed(5)} m)`,
      'Adiabatic cavity compliance Ca = V/(ρ c²)',
      'Neglects neck radiation reactance beyond Δ and visco-thermal losses (see damping)',
    ],
    validity: {
      wavelength: c / f0,
      lambdaOverCavity: (c / f0) / Math.cbrt(volume),
      note: 'Prefer λ ≳ 10·max(neck length, ∛V) for lumped validity.',
    },
  };
}

/**
 * Inverse design: given a target f0 and two free parameters, solve for the third.
 * @param {'volume'|'neckLength'|'neckRadius'} solveFor
 */
export function helmholtzInverseDesign({
  targetF,
  solveFor,
  c,
  rho = 1.2,
  neckRadius = 0.01,
  neckLength = 0.02,
  volume = 0.001,
  endCorrectionModel = 'flanged',
  nNecks = 1,
}) {
  if (!(targetF > 0)) throw new Error('Target frequency must be positive (Hz).');
  if (!(c > 0)) throw new Error('Sound speed must be positive (m/s).');

  // f0 = (c/2π) sqrt(A/(V L_eff))  →  A/(V L_eff) = (2π f0 / c)^2 = K
  const K = Math.pow((2 * Math.PI * targetF) / c, 2);

  if (solveFor === 'volume') {
    const a = neckRadius;
    const A = nNecks * Math.PI * a * a;
    const delta = endCorrectionModel === 'none' ? 0
      : endCorrectionModel === 'flanged' ? endCorrection(a, true) : endCorrection(a, false);
    const L_eff = neckLength + delta;
    if (!(L_eff > 0)) throw new Error('L_eff must be positive to solve for volume.');
    const V = A / (K * L_eff);
    return {
      solveFor,
      targetF,
      result: { volume: V },
      volume: V,
      used: { neckRadius: a, neckLength, nNecks, endCorrectionModel, delta, L_eff },
      formula: 'V = A / (K · L_eff), K = (2π f0 / c)²',
    };
  }

  if (solveFor === 'neckLength') {
    const a = neckRadius;
    const A = nNecks * Math.PI * a * a;
    const delta = endCorrectionModel === 'none' ? 0
      : endCorrectionModel === 'flanged' ? endCorrection(a, true) : endCorrection(a, false);
    // L_eff = A / (K V)  → L_n = L_eff − Δ
    const L_eff = A / (K * volume);
    const L_n = L_eff - delta;
    return {
      solveFor,
      targetF,
      result: { neckLength: L_n, L_eff, endCorrection: delta },
      neckLength: L_n,
      used: { neckRadius: a, volume, nNecks, endCorrectionModel },
      formula: 'L_eff = A/(K V), L_n = L_eff − Δ',
      valid: L_n >= 0,
      warning: L_n < 0 ? 'Required geometric neck length is negative — target too high for this volume/area; reduce volume or increase neck area.' : null,
    };
  }

  if (solveFor === 'neckRadius') {
    // A = K V L_eff; with L_eff = L_n + Δ(a), Δ = ξ a
    // A = n π a², so n π a² = K V (L_n + ξ a)
    // n π a² − K V ξ a − K V L_n = 0  → quadratic in a
    const xi = endCorrectionModel === 'none' ? 0
      : endCorrectionModel === 'flanged' ? 0.8216 : 0.6133;
    const b = K * volume * xi;
    const ac = nNecks * Math.PI;
    const cc = -K * volume * neckLength;
    // a = [b + sqrt(b² − 4 ac cc)] / (2 ac)   (positive root)
    const disc = b * b - 4 * ac * cc;
    if (disc < 0) throw new Error('No real neck radius solution for this target.');
    const a = (b + Math.sqrt(disc)) / (2 * ac);
    return {
      solveFor,
      targetF,
      result: { neckRadius: a, neckArea: nNecks * Math.PI * a * a },
      neckRadius: a,
      used: { neckLength, volume, nNecks, endCorrectionModel, xi },
      formula: 'Quadratic from A = K V (L_n + ξ a)',
    };
  }

  throw new Error(`Unknown solveFor: ${solveFor}`);
}

/**
 * Simple radiation/viscous quality-factor estimate for a Helmholtz resonator.
 * Not a substitute for detailed boundary-layer damping — labeled approximate.
 */
export function helmholtzQEstimate({ f0, rho, c, volume, neckRadius, neckLength, L_eff, delta_v = null }) {
  // Radiation resistance of a flanged piston (approx): R_rad ≈ (ρ ω²)/(2π c)
  const omega = 2 * Math.PI * f0;
  const A = Math.PI * neckRadius * neckRadius;
  const R_rad = (rho * omega * omega) / (2 * Math.PI * c); // acoustic ohm /area-ish — simplified
  // Viscous neck loss approx R_v ≈ (ρ / A) * sqrt(2 μ ω / ρ) * (P_neck L_n / A) style
  // Use a compact engineering estimate:
  const mu = 1.8e-5;
  const delta = delta_v ?? Math.sqrt((2 * mu) / (rho * omega));
  const perimeter = 2 * Math.PI * neckRadius;
  const R_visc = (perimeter * neckLength * mu) / (A * A) * (1 + 2 * (delta / neckRadius)); // rough
  const Ma = (rho * L_eff) / A;
  const Q_rad = (omega * Ma) / (R_rad + 1e-30);
  const Q_visc = (omega * Ma) / (R_visc + 1e-30);
  const Q = 1 / (1 / Q_rad + 1 / Q_visc);
  return {
    Q,
    Q_rad,
    Q_visc,
    model: 'Approximate lumped radiation + neck viscous loss; order-of-magnitude only',
    assumptions: ['Flanged neck radiation resistance approximation', 'Simplified neck viscous resistance', 'See damping.js for multi-mechanism Q combination'],
  };
}
