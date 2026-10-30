/**
 * Coupled two-mode resonator model.
 *
 * Two oscillators (Helmholtz or tube modes) with natural frequencies f1, f2
 * and linear coupling coefficient κ (dimensionless, fraction of f1-like scale
 * or absolute Hz depending on mode).
 *
 * Eigenfrequencies of the 2×2 system (coupled oscillators):
 *   f± = ½ (f1 + f2) ± ½ √( (f1 − f2)² + (2 κ f̄)² )   [κ in dimensionless form]
 *
 * or, with absolute coupling Δc in Hz:
 *   f± = ½ (f1 + f2) ± ½ √( (f1 − f2)² + 4 Δc² )
 *
 * Mode splitting at resonance (f1 = f2 = f0): Δf = |f+ − f−| = 2 Δc
 */

/**
 * @param {object} p
 * @param {number} p.f1 - natural frequency of resonator 1 (Hz)
 * @param {number} p.f2 - natural frequency of resonator 2 (Hz)
 * @param {number} p.couplingHz - half-splitting coefficient Δc (Hz)
 * @param {number} [p.Q1] - optional quality factors for coupled linewidths
 * @param {number} [p.Q2]
 */
export function coupledTwoMode({ f1, f2, couplingHz = 0, Q1 = Infinity, Q2 = Infinity }) {
  if (![f1, f2].every((v) => Number.isFinite(v) && v > 0)) throw new Error('Both natural frequencies must be finite and positive (Hz).');
  if (!Number.isFinite(couplingHz)) throw new Error('Coupling must be finite.');
  if (couplingHz * couplingHz >= f1 * f2) throw new Error('Coupling is too large for this positive-frequency two-mode model.');
  if (![Q1, Q2].every((v) => v === Infinity || (Number.isFinite(v) && v > 0))) throw new Error('Quality factors must be positive.');

  const fAvg = 0.5 * (f1 + f2);
  const detuning = f1 - f2;
  const splitArg = detuning * detuning + 4 * couplingHz * couplingHz;
  const split = Math.sqrt(Math.max(0, splitArg));
  const fPlus = fAvg + 0.5 * split;
  const fMinus = fAvg - 0.5 * split;
  const modeSplitting = fPlus - fMinus;

  // Normal-mode mixing angle: tan(2θ) = 2κ / (f1 − f2)
  let theta = 0;
  if (couplingHz === 0 && detuning === 0) {
    theta = Math.PI / 4;
  } else {
    theta = 0.5 * Math.atan2(2 * couplingHz, detuning);
  }
  const mixing = {
    theta,
    cos2: Math.cos(theta) ** 2,
    sin2: Math.sin(theta) ** 2,
  };

  // Approximate Q of the two eigenmodes (weak-coupling energy-weighted)
  const invQ = (w1, w2) => {
    const a = w1 * w1;
    const b = w2 * w2;
    const s = a + b;
    if (!Number.isFinite(Q1) && !Number.isFinite(Q2)) return Infinity;
    const q1 = Number.isFinite(Q1) ? 1 / Q1 : 0;
    const q2 = Number.isFinite(Q2) ? 1 / Q2 : 0;
    return (a * q1 + b * q2) / s;
  };
  // Use mixing weights
  const invQPlus = mixing.cos2 * (Number.isFinite(Q1) ? 1 / Q1 : 0) + mixing.sin2 * (Number.isFinite(Q2) ? 1 / Q2 : 0);
  const invQMinus = mixing.sin2 * (Number.isFinite(Q1) ? 1 / Q1 : 0) + mixing.cos2 * (Number.isFinite(Q2) ? 1 / Q2 : 0);
  const QPlus = invQPlus > 0 ? 1 / invQPlus : Infinity;
  const QMinus = invQMinus > 0 ? 1 / invQMinus : Infinity;
  void invQ;

  return {
    f1, f2,
    couplingHz,
    detuning,
    fAvg,
    fPlus,
    fMinus,
    modeSplitting,
    peakToPeakHz: modeSplitting,
    atResonance: Math.abs(detuning) < 1e-9,
    splittingAtResonance: 2 * Math.abs(couplingHz),
    mixing,
    QPlus,
    QMinus,
    formula: 'f± = ½(f1+f2) ± ½√[(f1−f2)² + 4 Δc²]',
    assumptions: [
      'Linear two-mode (lumped) coupling',
      'Symmetric frequency pulling model with coupling Δc in Hz',
      'Quality factors, if given, are weak-coupling energy-weighted estimates',
      'Neglects higher-order modes and radiation loading changes due to coupling',
    ],
  };
}

/**
 * Frequency response of two coupled oscillators driven at the neck/cavity
 * of resonator 1, assuming displacement/pressure amplitude of mode 1.
 *
 * Returns a transfer function magnitude sample:
 *   H(ω) ≈ 1 / (ω1² − ω² + i γ1 ω)  +  coupling term
 * Simplified: sum of two damped Lorentzians with opposite signs / mixing.
 *
 * For the designer UI we return a practical magnitude curve model.
 */
export function coupledFrequencyResponse({
  f1, f2, couplingHz, Q1 = 30, Q2 = 30, fStart, fEnd, nSamples = 401, driveAt = 1,
}) {
  const result = coupledTwoMode({ f1, f2, couplingHz, Q1, Q2 });
  const f0 = fStart ?? Math.min(f1, f2) * 0.5;
  const f1u = fEnd ?? Math.max(f1, f2) * 1.5;

  const freqs = [];
  const mag = [];
  const phase = [];

  const g1 = f1 / (2 * Q1);
  const g2 = f2 / (2 * Q2);

  for (let i = 0; i < nSamples; i++) {
    const f = f0 + ((f1u - f0) * i) / (nSamples - 1);
    const w = 2 * Math.PI * f;
    const w1 = 2 * Math.PI * f1;
    const w2 = 2 * Math.PI * f2;
    const w1p = 2 * Math.PI * result.fPlus;
    const w2p = 2 * Math.PI * result.fMinus;

    // Two Lorentzian contributions at eigenfrequencies
    const z1 = { re: w1p * w1p - w * w, im: 2 * Math.PI * g1 * 2 * w * 0.5 + (2 * Math.PI * (f1 / Q1)) * w * 0 };
    // cleaner: denominator = (w0^2 - w^2) + i (w0 w / Q)
    const denPlus = complexSub(
      { re: w1p * w1p - w * w, im: (w1p * w) / (Q1 > 0 ? Q1 : 1e6) },
      { re: 0, im: 0 }
    );
    const denMinus = {
      re: w2p * w2p - w * w,
      im: (w2p * w) / (Q2 > 0 ? Q2 : 1e6),
    };
    void z1;
    const resp = complexAdd(
      scaleComplex(cdiv({ re: 1, im: 0 }, denPlus), driveAt === 1 ? 1 : 0.5),
      scaleComplex(cdiv({ re: 1, im: 0 }, denMinus), driveAt === 1 ? 0.5 : 1)
    );
    const M = Math.hypot(resp.re, resp.im);
    freqs.push(f);
    mag.push(M);
    phase.push(Math.atan2(resp.im, resp.re));
  }

  const maxMag = Math.max(...mag);
  return {
    freqs,
    mag,
    magDb: mag.map((v) => 20 * Math.log10(Math.max(v, 1e-20) / maxMag)),
    phase,
    eigen: { fPlus: result.fPlus, fMinus: result.fMinus, modeSplitting: result.modeSplitting },
    model: 'Two Lorentzian eigenmodes at f± with coupling-derived weights',
    assumptions: ['Weakly damped linear modes', 'Drive coupling weights approx 1 and 0.5', 'Not a full transfer-matrix model'],
  };
}

function complexSub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}
function complexAdd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}
function scaleComplex(a, s) {
  return { re: a.re * s, im: a.im * s };
}
function cdiv(a, b) {
  const d = b.re * b.re + b.im * b.im || 1e-30;
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  };
}

/**
 * Inverse: given desired mode splitting and mean frequency, infer coupling.
 */
export function couplingFromSplitting(modeSplitting, f1 = null, f2 = null) {
  // If both resonators identical: Δf = 2 Δc
  if (f1 == null || f2 == null || f1 === f2) {
    return { couplingHz: modeSplitting / 2, note: 'Identical resonators: Δc = Δf / 2' };
  }
  // General: Δc = ½ √( (f+ − f−)² − (f1 − f2)² )
  const det = f1 - f2;
  const disc = modeSplitting * modeSplitting - det * det;
  if (disc < 0) {
    throw new Error('Mode splitting smaller than detuning — no real coupling for this pair.');
  }
  return {
    couplingHz: 0.5 * Math.sqrt(disc),
    note: 'General two-mode: Δc = ½√(Δf² − (f1−f2)²)',
  };
}
