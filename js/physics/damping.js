/**
 * Damping, quality factor, linewidth, and decay-time analysis.
 *
 * Combines independent loss mechanisms:
 *   1/Q_L = 1/Q_i + 1/Q_e + Σ 1/Q_k
 *
 * Provides:
 * - Q from loss tangent / conductance models
 * - Half-power bandwidth: Δf = f0 / Q
 * - Ring-down time: τ = Q / (π f0)  (amplitude 1/e time for displacement/pressure)
 * - Logarithmic decrement
 * - Visco-thermal boundary-layer Q estimates for tubes and cavities
 */

/**
 * Combine quality factors in parallel (inverse sum).
 * @param {number[]} Qs - individual quality factors (Infinity allowed)
 */
export function combineQ(Qs) {
  let inv = 0;
  for (const Q of Qs) {
    if (Q == null) continue;
    if (Q === Infinity) continue;
    if (Q < 0) throw new Error('Q must be positive.');
    if (Q === 0) return 0;
    inv += 1 / Q;
  }
  return inv === 0 ? Infinity : 1 / inv;
}

/**
 * Split total Q into internal and external components.
 */
export function loadedQ({ Qi, Qe }) {
  const QL = combineQ([Qi, Qe]);
  return { QL, Qi, Qe, formula: '1/Q_L = 1/Q_i + 1/Q_e' };
}

/**
 * Half-power bandwidth (Hz) for a resonance.
 * Δf = f0 / Q
 */
export function halfPowerBandwidth(f0, Q) {
  if (!(f0 > 0)) throw new Error('f0 must be positive.');
  if (!(Q > 0)) throw new Error('Q must be positive.');
  return f0 / Q;
}

/**
 * Quality factor from half-power bandwidth.
 */
export function qFromBandwidth(f0, df) {
  if (!(df > 0)) throw new Error('Bandwidth must be positive.');
  return f0 / df;
}

/**
 * Amplitude ring-down time τ (s): A(t) = A0 e^{−t/τ}, τ = Q / (π f0)
 * Also returns energy decay time τ_E = 2τ = Q / (2π f0) * 2 wait:
 * Energy ~ A^2 → τ_E = τ/2? No: E ~ A^2, A ~ e^{-t/τ_A}, E ~ e^{-2t/τ_A}, τ_E = τ_A/2.
 * Standard acoustic: τ_A = Q/(π f0), τ_E = Q/(2π f0).
 */
export function decayTimes(f0, Q) {
  const tauAmplitude = Q / (Math.PI * f0);
  const tauEnergy = Q / (2 * Math.PI * f0);
  return {
    tauAmplitude,
    tauEnergy,
    t60: tauAmplitude * Math.log(1000), // time to -60 dB in amplitude
    formula: 'τ_A = Q/(π f0), τ_E = Q/(2π f0), T60 = τ_A ln(1000)',
  };
}

/**
 * Logarithmic decrement δ = π / Q  (for small damping)
 */
export function logarithmicDecrement(Q) {
  return Math.PI / Q;
}

/**
 * Visco-thermal Q estimate for a rigid tube of radius a and length L
 * at frequency f. Uses classic Kirchhoff boundary-layer approximations.
 *
 * Attenuation per radian:
 *   α ≈ (1/(c a)) * sqrt(μ ω / (2 ρ)) * (1 + (γ−1)/sqrt(Pr))
 * then Q ≈ ω / (2 α c) roughly  — several equivalent forms exist in the literature.
 *
 * This implementation follows the engineering form used in acoustic duct design:
 *   δ_v = sqrt(2μ/(ρω)), δ_t = δ_v/sqrt(Pr)
 *   Q_thermal ≈ (γ a) / ((γ−1) δ_t)   (circular tube, plane wave)
 *   Q_viscous ≈ a / δ_v
 *   1/Q = 1/Q_v + 1/Q_t
 *
 * Labeled approximate — order-of-magnitude for design, not precision metrology.
 */
export function tubeViscousQ({ a, f, rho = 1.2, mu = 1.81e-5, gamma = 1.4, Pr = 0.71, c = 343 }) {
  if (!(a > 0 && f > 0)) throw new Error('Radius and frequency must be positive.');
  const omega = 2 * Math.PI * f;
  const delta_v = Math.sqrt((2 * mu) / (rho * omega));
  const delta_t = delta_v / Math.sqrt(Pr);
  const Q_v = a / delta_v;
  const Q_t = (gamma * a) / ((gamma - 1) * delta_t);
  const Q = combineQ([Q_v, Q_t]);
  return {
    Q,
    Q_viscous: Q_v,
    Q_thermal: Q_t,
    delta_v,
    delta_t,
    model: 'Boundary-layer visco-thermal Q for circular tube (Kirchhoff-type approx)',
    assumptions: [
      'Plane-wave mode',
      'Circular cross-section, radius a',
      'Boundary layers thin compared to a (δ ≪ a)',
      'Constant μ, γ, Pr',
    ],
    c,
  };
}

/**
 * Wall-loss Q for a rectangular cavity using boundary-layer dissipation on six faces.
 * Very approximate — used for damping panel guidance.
 */
export function cavityWallQ({ Lx, Ly, Lz, f, rho = 1.2, mu = 1.81e-5, gamma = 1.4, Pr = 0.71, c = 343 }) {
  const omega = 2 * Math.PI * f;
  const delta_v = Math.sqrt((2 * mu) / (rho * omega));
  const delta_t = delta_v / Math.sqrt(Pr);
  // Surface-to-volume weighted viscous/thermal loss (engineering estimate)
  const V = Lx * Ly * Lz;
  const S = 2 * (Lx * Ly + Lx * Lz + Ly * Lz);
  const Q_v = (2 * V) / (S * delta_v);
  const Q_t = (2 * V * gamma) / (S * (gamma - 1) * delta_t);
  const Q = combineQ([Q_v, Q_t]);
  return {
    Q,
    Q_viscous: Q_v,
    Q_thermal: Q_t,
    delta_v,
    delta_t,
    surfaceToVolume: S / V,
    model: 'Boundary-layer wall-loss Q estimate for rectangular cavity',
    assumptions: ['δ ≪ wall dimensions', 'Uniform mode energy estimate', 'Not exact for high-order modes'],
  };
}

/**
 * Radiation Q of a Helmholtz neck (flanged piston approximation).
 * Q_rad ≈ (ρ ω V) / (c A) * 1/(1 + something) — use:
 *   R_rad ≈ ρ ω² / (2π c)  (specific acoustic-ish), Q = ω M / R
 */
export function radiationQ({ f, rho = 1.2, c = 343, volume, neckRadius, L_eff }) {
  const omega = 2 * Math.PI * f;
  const A = Math.PI * neckRadius * neckRadius;
  const Ma = (rho * L_eff) / A;
  const R_rad = (rho * omega * omega) / (2 * Math.PI * c);
  const Q_rad = (omega * Ma) / R_rad;
  return {
    Q_rad,
    model: 'Flanged-piston radiation resistance approximation',
    assumptions: ['Neck radiates as flanged circular piston', 'Open to free field on one side'],
  };
}

/**
 * Build a full damping report for a resonance.
 */
export function dampingReport({
  f0,
  QInternal,
  QExternal = Infinity,
  QExtra = [],
  label = 'resonance',
}) {
  const mechanisms = [];
  if (QInternal != null && Number.isFinite(QInternal)) {
    mechanisms.push({ name: 'internal', Q: QInternal });
  }
  if (QExternal != null && QExternal !== Infinity) {
    mechanisms.push({ name: 'external/radiation', Q: QExternal });
  }
  for (const q of QExtra) {
    mechanisms.push(q);
  }
  const Q = combineQ(mechanisms.map((m) => m.Q));
  const df = Q > 0 && Number.isFinite(Q) ? halfPowerBandwidth(f0, Q) : 0;
  const dec = Q > 0 && Number.isFinite(Q) ? decayTimes(f0, Q) : { tauAmplitude: Infinity, tauEnergy: Infinity, t60: Infinity };
  return {
    label,
    f0,
    Q,
    bandwidth: df,
    ...dec,
    mechanisms,
    formula: '1/Q_L = Σ 1/Q_k',
    assumptions: ['Independent loss channels', 'Linear damping', 'Q ≫ 1 for bandwidth/decay formulas to hold'],
  };
}
