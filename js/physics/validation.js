/**
 * Physics validation suite — runnable in Node or the browser.
 * Uses assert-style checks with analytic reference values.
 */

import { computeAirProperties, saturationVaporPressure, DEFAULT_ENV } from './air-properties.js?v=20251023';
import { tubeFrequencies, effectiveLength, endCorrection, sampleTubeMode } from './tube-resonators.js?v=20251023';
import { helmholtzResonance, helmholtzInverseDesign } from './helmholtz-resonator.js?v=20251023';
import { rectangularModes, cylindricalModes, besselJPrimeRoots, besselJ, besselJPrime, chiPrime } from './cavity-modes.js?v=20251023';
import { sphericalModes, annularCavityModes, sphericalBesselJ, chiSpherical } from './spherical-annular.js?v=20251023';
import {
  dimensionlessGroups, thermoviscousDuct, mppImpedance, exponentialHorn,
  ductTransferMatrix, chainTransferMatrices, sensitivity, propagateUncertainty,
  weylModeCount, sideBranchModes,
} from './advanced.js?v=20251023';
import {
  complexPole, poleSet, circularPistonRadiation, multiModeEigen,
  twoMicrophoneImpedance, impedanceTubeMeasurement, monteCarloUncertainty,
  symmetricEigenJacobi,
} from './science.js?v=20251023';
import { sweep1D, sweepExtremum } from './sweep.js?v=20251023';
import { coupledTwoMode, couplingFromSplitting } from './coupled-resonators.js?v=20251023';
import { combineQ, halfPowerBandwidth, decayTimes, qFromBandwidth, logarithmicDecrement } from './damping.js?v=20251023';
import {
  expansionChamberTL, transmissionLossFromMatrix, bootstrapCI,
  pronyPoles, compareCases, makeCaseSnapshot,
} from './research.js?v=20251023';
import { femModes2D, analyticalRectModes2D, compareFemAnalytic, finiteElementMatrices2D } from './fem2d.js?v=20251023';
import { syntheticTubeMeasurement, transferFunction, dftSpectrum } from './audio-tube.js?v=20251023';
import { Store } from '../state.js?v=20251023';
import { projectToJSON, parseProjectJSON, applicationPerformanceToCSV, femDesignProject } from '../export/export.js?v=20251023';
import { helmholtzFemGeometry, meshHelmholtz, assembleHelmholtz, bandMultiply, solveLowestModes, helmholtzModesFEM } from './helmholtz-fem.js?v=20261027';
import { solveComplexBand, createHelmholtzResponseSolver, helmholtzFrequencyResponse } from './helmholtz-response.js?v=20261027';
import { normalIncidenceAbsorption, sideBranchTransmission, helmholtzPortPerformance } from './acoustic-performance.js?v=20261031';
import { parseMeasuredResponse, responseFeatures, compareMeasurement, restoreMeasurement } from './measurement-comparison.js?v=20261031';
import { inverseDesignHelmholtzFEM } from './fem-inverse-design.js?v=20261031';
import { envelopeFits, resonatorEnvelope } from './fem-multi-design.js?v=20261101';

const results = [];

function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function approx(actual, expected, relTol = 1e-3, absTol = 0, msg = '') {
  const diff = Math.abs(actual - expected);
  const tol = Math.max(Math.abs(expected) * relTol + absTol, 1e-12);
  if (!(diff <= tol)) {
    throw new Error(`${msg || 'approx'}: got ${actual}, expected ${expected}, diff ${diff}, tol ${tol}`);
  }
}

export function runPhysicsValidation() {
  results.length = 0;

  // --- Air properties ---
  check('air properties at 20°C, 101325 Pa, 50% RH', () => {
    const p = computeAirProperties(DEFAULT_ENV);
    assert(p.rho > 1.1 && p.rho < 1.3, `rho out of range: ${p.rho}`);
    assert(p.c > 330 && p.c < 355, `c out of range: ${p.c}`);
    approx(p.cLinearValue, 331.3 + 0.606 * 20, 1e-9, 0, 'linear c');
    // density of dry-ish air ~ 1.2 kg/m3
    assert(p.Z0 > 350 && p.Z0 < 450, `Z0 out of range: ${p.Z0}`);
  });

  check('sound speed increases with temperature', () => {
    const cold = computeAirProperties({ ...DEFAULT_ENV, temperatureC: 0 });
    const hot = computeAirProperties({ ...DEFAULT_ENV, temperatureC: 40 });
    assert(hot.c > cold.c, 'c should increase with T');
    approx(cold.cLinearValue, 331.3, 1e-9);
  });

  check('saturation vapor pressure at 20°C is near 2.34 kPa', () => {
    const eS = saturationVaporPressure(20);
    assert(eS > 2200 && eS < 2500, `eS(20°C)=${eS}`);
  });

  // --- Tube: open-open, L = 1.0 m, c = 343 m/s, no end correction ---
  check('open-open tube: f_n = n c / (2L)', () => {
    const r = tubeFrequencies({ L: 1.0, c: 343, radius: 0.05, boundary: 'open-open', nModes: 5, applyEndCorrection: false });
    approx(r.modes[0].f, 343 / 2, 1e-9, 0, 'f1');
    approx(r.modes[1].f, 343, 1e-9, 0, 'f2');
    approx(r.modes[2].f, 1.5 * 343, 1e-9, 0, 'f3');
    approx(r.modes[4].f, 5 * 343 / 2, 1e-9, 0, 'f5');
  });

  // --- Tube: open-closed, L = 1.0 m ---
  check('open-closed tube: f_n = (2n-1)c/(4L)', () => {
    const r = tubeFrequencies({ L: 1.0, c: 343, radius: 0.05, boundary: 'open-closed', nModes: 4, applyEndCorrection: false });
    approx(r.modes[0].f, 343 / 4, 1e-9, 0, 'f1');
    approx(r.modes[1].f, 3 * 343 / 4, 1e-9, 0, 'f2');
    approx(r.modes[2].f, 5 * 343 / 4, 1e-9, 0, 'f3');
  });

  // --- Tube: closed-closed same series as open-open ---
  check('closed-closed tube shares open-open frequency series', () => {
    const oo = tubeFrequencies({ L: 0.5, c: 340, boundary: 'open-open', applyEndCorrection: false, nModes: 5 });
    const cc = tubeFrequencies({ L: 0.5, c: 340, boundary: 'closed-closed', applyEndCorrection: false, nModes: 5 });
    for (let i = 0; i < 5; i++) approx(cc.modes[i].f, oo.modes[i].f, 1e-12);
  });

  // --- End correction ---
  check('Rayleigh end correction ≈ 0.6133 a', () => {
    approx(endCorrection(0.01, false), 0.006133, 1e-6);
    approx(endCorrection(0.01, true), 0.008216, 1e-6);
    approx(endCorrection(0.01, false), 0.6133 * 0.01, 1e-9);
    approx(endCorrection(0.01, true), 0.8216 * 0.01, 1e-9);
  });

  check('effective length open-open adds two corrections', () => {
    const L = effectiveLength(1.0, 0.01, 'open-open', true, false);
    approx(L, 1.0 + 2 * 0.006133, 1e-9);
  });

  // --- Mode shapes ---
  check('open-open mode n=1 has nodes at ends', () => {
    const s = sampleTubeMode({ L: 1, boundary: 'open-open', n: 1, nSamples: 201 });
    approx(s.p[0], 0, 1e-9, 1e-9);
    approx(s.p[s.p.length - 1], 0, 1e-9, 1e-9);
    approx(Math.max(...s.p), 1, 1e-3, 1e-3);
  });

  check('open-closed mode n=2 lists interior node and antinode', () => {
    const s = sampleTubeMode({ L: 1, boundary: 'open-closed', n: 2, nSamples: 201 });
    // nodes at 0 and 2L/3; antinodes at L/3 and L
    assert(s.nodes.length === 2, `expected 2 nodes, got ${s.nodes.length}`);
    approx(s.nodes[0], 0, 1e-9, 1e-9);
    approx(s.nodes[1], 2 / 3, 1e-9, 1e-9);
    assert(s.antinodes.length === 2, `expected 2 antinodes, got ${s.antinodes.length}`);
    approx(s.antinodes[0], 1 / 3, 1e-9, 1e-9);
    approx(s.antinodes[1], 1, 1e-9, 1e-9);
  });

  check('closed-closed mode n=2 has antinodes at both walls and interior', () => {
    const s = sampleTubeMode({ L: 1, boundary: 'closed-closed', n: 2, nSamples: 201 });
    assert(s.antinodes.length === 3, `expected 3 antinodes, got ${s.antinodes.length}`);
    approx(s.antinodes[0], 0, 1e-9, 1e-9);
    approx(s.antinodes[1], 0.5, 1e-9, 1e-9);
    approx(s.antinodes[2], 1, 1e-9, 1e-9);
    assert(s.nodes.length === 2, `expected 2 nodes, got ${s.nodes.length}`);
    approx(s.nodes[0], 0.25, 1e-9, 1e-9);
    approx(s.nodes[1], 0.75, 1e-9, 1e-9);
  });

  // --- Helmholtz ---
  check('Helmholtz f0 for textbook-like values', () => {
    // V = 0.001 m3, neck r = 0.01 m, L_n = 0.02 m, c = 343
    const r = helmholtzResonance({
      neckRadius: 0.01,
      neckLength: 0.02,
      volume: 0.001,
      c: 343,
      endCorrectionModel: 'none',
    });
    // f0 = 343/(2π) * sqrt(A/(V L)) = 54.59 * sqrt(π*1e-4 / (0.001*0.02))
    // A = π * 1e-4 ≈ 3.1416e-4
    // A/(V L) = 3.1416e-4 / 2e-5 = 15.708
    // sqrt = 3.963, f0 = 54.59*3.963 ≈ 216.3 Hz
    const A = Math.PI * 0.0001;
    const expect = (343 / (2 * Math.PI)) * Math.sqrt(A / (0.001 * 0.02));
    approx(r.f0, expect, 1e-9);
  });

  check('Helmholtz inverse design recovers volume', () => {
    const target = 120;
    const inv = helmholtzInverseDesign({
      targetF: target,
      solveFor: 'volume',
      c: 343,
      neckRadius: 0.01,
      neckLength: 0.03,
      endCorrectionModel: 'none',
    });
    const back = helmholtzResonance({
      neckRadius: 0.01,
      neckLength: 0.03,
      volume: inv.volume,
      c: 343,
      endCorrectionModel: 'none',
    });
    approx(back.f0, target, 1e-6);
  });

  // --- Bessel / cylindrical ---
  check('Bessel J0(0)=1, J1(0)=0', () => {
    approx(besselJ(0, 0), 1, 1e-12, 1e-12);
    approx(besselJ(1, 0), 0, 1e-12, 1e-12);
    approx(besselJ(0, 2.404825557695773), 0, 1e-5, 1e-6, 'J0 first zero');
  });

  check("J'_0 roots ≈ 3.8317, 7.0156", () => {
    const r = besselJPrimeRoots(0, 2);
    approx(r[0], 3.8317059702, 1e-3);
    approx(r[1], 7.015586670, 1e-3);
  });

  check("J'_1 roots ≈ 1.8412, 5.3314", () => {
    const r = besselJPrimeRoots(1, 2);
    approx(r[0], 1.8411837813, 1e-3);
    approx(r[1], 5.331442568, 1e-3);
  });

  check('chiPrime matches known roots', () => {
    approx(chiPrime(0, 1), 3.8317, 1e-3);
    approx(chiPrime(1, 1), 1.8412, 1e-3);
  });

  // --- Rectangular modes ---
  check('rectangular mode (1,0,0) in 1x1x1 m cube, c=343', () => {
    const r = rectangularModes({ Lx: 1, Ly: 1, Lz: 1, c: 343, maxModes: 20, lMax: 3, mMax: 3, nMax: 3 });
    const m100 = r.modes.find((m) => m.l === 1 && m.m === 0 && m.n === 0);
    assert(m100, 'mode (1,0,0) not found');
    approx(m100.f, 343 / 2, 1e-9);
  });

  // --- Coupled modes ---
  check('coupled identical resonators split by 2κ', () => {
    const r = coupledTwoMode({ f1: 200, f2: 200, couplingHz: 5 });
    approx(r.fPlus, 205, 1e-9);
    approx(r.fMinus, 195, 1e-9);
    approx(r.modeSplitting, 10, 1e-9);
    approx(r.splittingAtResonance, 10, 1e-9);
  });

  check('couplingFromSplitting inverse', () => {
    const s = couplingFromSplitting(10, 200, 200);
    approx(s.couplingHz, 5, 1e-9);
  });

  check('Coupled modes retain the correct Q when uncoupled and detuned', () => {
    const a = coupledTwoMode({ f1: 200, f2: 100, Q1: 20, Q2: 80 });
    approx(a.QPlus, 20, 1e-12);
    approx(a.QMinus, 80, 1e-12);
    const b = coupledTwoMode({ f1: 100, f2: 200, Q1: 20, Q2: 80 });
    approx(b.QPlus, 80, 1e-12);
    approx(b.QMinus, 20, 1e-12);
  });

  check('Two-mode model rejects coupling that produces non-positive frequencies', () => {
    let rejected = false;
    try { coupledTwoMode({ f1: 100, f2: 100, couplingHz: 101 }); } catch { rejected = true; }
    assert(rejected, 'invalid coupling rejected');
  });

  // --- Damping ---
  check('combineQ parallel sum', () => {
    approx(combineQ([100, 100]), 50, 1e-12);
    approx(combineQ([100, Infinity]), 100, 1e-12);
  });

  check('bandwidth and Q are inverses', () => {
    approx(halfPowerBandwidth(1000, 50), 20, 1e-12);
    approx(qFromBandwidth(1000, 20), 50, 1e-12);
  });

  check('decay time τ = Q/(π f0)', () => {
    const d = decayTimes(100, Math.PI * 100); // Q = π*100 → τ = 1
    approx(d.tauAmplitude, 1, 1e-9);
  });

  check('log decrement δ = π/Q', () => {
    approx(logarithmicDecrement(100), Math.PI / 100, 1e-12);
  });

  // --- cylindrical mode frequency sanity ---
  check('cylindrical (0,0,1)-ish first mode is finite and ordered', () => {
    const r = cylindricalModes({ radius: 0.1, length: 0.3, c: 343, maxModes: 8, mMax: 2, pMax: 2, radialRoots: 2 });
    assert(r.modes.length > 0, 'no modes');
    for (let i = 1; i < r.modes.length; i++) {
      assert(r.modes[i].f >= r.modes[i - 1].f - 1e-9, 'modes not sorted');
    }
    // Lowest should be finite positive
    assert(r.modes[0].f > 0 && Number.isFinite(r.modes[0].f), 'bad first frequency');
  });

  check('besselJPrime(0, 3.8317) ≈ 0', () => {
    approx(besselJPrime(0, 3.8317059702), 0, 1e-5, 1e-8);
  });

  // --- Physical sanity checks ---
  check('increasing ideal tube length reduces resonant frequencies', () => {
    const short = tubeFrequencies({ L: 0.5, c: 343, boundary: 'open-open', applyEndCorrection: false, nModes: 3 });
    const long = tubeFrequencies({ L: 1.5, c: 343, boundary: 'open-open', applyEndCorrection: false, nModes: 3 });
    for (let i = 0; i < 3; i++) {
      assert(long.modes[i].f < short.modes[i].f, `mode ${i + 1} did not drop with longer L`);
    }
  });

  check('increasing Helmholtz cavity volume lowers f0', () => {
    const small = helmholtzResonance({ neckRadius: 0.02, neckLength: 0.05, volume: 0.001, c: 343, endCorrectionModel: 'flanged' });
    const large = helmholtzResonance({ neckRadius: 0.02, neckLength: 0.05, volume: 0.004, c: 343, endCorrectionModel: 'flanged' });
    assert(large.f0 < small.f0, 'larger V should lower f0');
  });

  check('increasing effective neck length lowers Helmholtz f0', () => {
    const shortN = helmholtzResonance({ neckRadius: 0.02, neckLength: 0.02, volume: 0.002, c: 343, endCorrectionModel: 'flanged' });
    const longN = helmholtzResonance({ neckRadius: 0.02, neckLength: 0.12, volume: 0.002, c: 343, endCorrectionModel: 'flanged' });
    assert(longN.f0 < shortN.f0, 'longer neck should lower f0');
  });

  check('increasing coupling increases mode splitting near degeneracy', () => {
    const weak = coupledTwoMode({ f1: 200, f2: 200, couplingHz: 1 });
    const strong = coupledTwoMode({ f1: 200, f2: 200, couplingHz: 8 });
    assert(strong.modeSplitting > weak.modeSplitting, 'stronger coupling should split more');
    approx(strong.modeSplitting / weak.modeSplitting, 8, 1e-9);
  });

  check('increasing damping broadens an isolated resonance', () => {
    const hiQ = halfPowerBandwidth(1000, 200);
    const loQ = halfPowerBandwidth(1000, 20);
    assert(loQ > hiQ, 'lower Q must give larger bandwidth');
  });

  check('invalid tube length is rejected', () => {
    let threw = false;
    try {
      tubeFrequencies({ L: -1, c: 343, boundary: 'open-open' });
    } catch {
      threw = true;
    }
    assert(threw, 'negative L should throw');
  });

  check('invalid Helmholtz volume is rejected', () => {
    let threw = false;
    try {
      helmholtzResonance({ neckRadius: 0.01, neckLength: 0.02, volume: 0, c: 343 });
    } catch {
      threw = true;
    }
    assert(threw, 'zero volume should throw');
  });

  // --- Advanced scientific models ---
  check('spherical cavity first mode is finite and ordered', () => {
    const r = sphericalModes({ radius: 0.3, c: 343, maxModes: 8, lMax: 2, nMax: 2 });
    assert(r.modes.length > 0, 'no spherical modes');
    for (let i = 1; i < r.modes.length; i++) {
      assert(r.modes[i].f >= r.modes[i - 1].f - 1e-9, 'not sorted');
    }
    assert(r.modes[0].f > 0 && Number.isFinite(r.modes[0].f), 'bad f');
    // scaling: double radius halves frequencies
    const r2 = sphericalModes({ radius: 0.6, c: 343, maxModes: 1, lMax: 0, nMax: 1 });
    approx(r2.modes[0].f, sphericalModes({ radius: 0.3, c: 343, maxModes: 1, lMax: 0, nMax: 1 }).modes[0].f / 2, 1e-6);
  });

  check('spherical Bessel j0(x) = sin(x)/x', () => {
    approx(sphericalBesselJ(0, 1), Math.sin(1) / 1, 1e-8);
    approx(sphericalBesselJ(0, 2.5), Math.sin(2.5) / 2.5, 1e-8);
  });

  check('annular cavity modes are positive and ordered', () => {
    const r = annularCavityModes({
      innerRadius: 0.08, outerRadius: 0.25, length: 0.6, c: 343,
      maxModes: 6, mMax: 1, pMax: 1, nRoots: 2,
    });
    assert(r.modes.length > 0, 'no annular modes');
    for (let i = 1; i < r.modes.length; i++) {
      assert(r.modes[i].f >= r.modes[i - 1].f - 1e-9, 'not sorted');
    }
    assert(r.modes[0].f > 0, 'bad first frequency');
  });

  check('side-branch quarter-wave modes follow (2n-1)c/4L', () => {
    const r = sideBranchModes({ branchLength: 0.5, c: 340, nModes: 3, boundary: 'quarter-wave' });
    approx(r.modes[0].f, 340 / 2, 1e-9);
    approx(r.modes[1].f, (3 * 340) / 2, 1e-9);
  });

  check('MPP impedance is positive and reactive', () => {
    const z = mppImpedance({
      holeDiameter: 0.0005, panelThickness: 0.001, porosity: 0.05,
      f: 500, rho: 1.2, mu: 1.81e-5, c: 343,
    });
    assert(z.Z.re > 0, 'resistance must be positive');
    assert(z.Z.im > 0, 'reactance should be mass-like positive');
  });

  check('exponential horn cutoff matches flare constant', () => {
    const r = exponentialHorn({
      throatRadius: 0.02, mouthRadius: 0.12, length: 0.5, f: 200, c: 343,
    });
    const m = Math.log(0.12 / 0.02) / 0.5;
    approx(r.cutoffHz, (343 / (2 * Math.PI)) * m, 1e-6);
  });

  check('duct transfer matrix lossless has |A|=|D|=|cos kL|', () => {
    const T = ductTransferMatrix({ f: 100, length: 0.5, area: 0.002, c: 343, rho: 1.2, lossNp_per_m: 0 });
    const kL = (2 * Math.PI * 100 * 0.5) / 343;
    approx(Math.hypot(T.A.re, T.A.im), Math.abs(Math.cos(kL)), 1e-9);
    // identity when L=0
    const T0 = ductTransferMatrix({ f: 100, length: 0, area: 0.002, c: 343, rho: 1.2 });
    approx(T0.A.re, 1, 1e-12);
    approx(T0.B.re, 0, 1e-12);
    approx(T0.C.re, 0, 1e-12);
    approx(T0.D.re, 1, 1e-12);
  });

  check('chained transfer matrices multiply correctly', () => {
    const T1 = ductTransferMatrix({ f: 200, length: 0.2, area: 0.001, c: 343, rho: 1.2 });
    const T2 = ductTransferMatrix({ f: 200, length: 0.3, area: 0.001, c: 343, rho: 1.2 });
    const chained = chainTransferMatrices([T1, T2]);
    const single = ductTransferMatrix({ f: 200, length: 0.5, area: 0.001, c: 343, rho: 1.2 });
    approx(chained.A.re, single.A.re, 1e-9);
    approx(chained.A.im, single.A.im, 1e-9);
  });

  check('sensitivity of f to L is negative for a tube', () => {
    const fn = (p) => (343 / (2 * p.length));
    const s = sensitivity(fn, { length: 1.0 }, ['length']);
    assert(s.sensitivities.length.dYdP < 0, 'df/dL should be negative');
  });

  check('uncertainty propagation is first-order sum of squares', () => {
    const u = propagateUncertainty(
      { a: { dYdP: 2 }, b: { dYdP: 3 } },
      { a: 0.1, b: 0.1 },
    );
    approx(u.sigmaY, Math.sqrt(0.04 + 0.09), 1e-12);
  });

  check('Weyl mode count grows with volume and frequency', () => {
    const w1 = weylModeCount({ f: 500, c: 343, volume: 1, surfaceArea: 6 });
    const w2 = weylModeCount({ f: 1000, c: 343, volume: 1, surfaceArea: 6 });
    assert(w2.cumulativeModes > w1.cumulativeModes, 'N(f) must grow with f');
  });

  check('thermoviscous duct gives positive attenuation', () => {
    const tv = thermoviscousDuct({ f: 200, radius: 0.02, rho: 1.2, mu: 1.81e-5, c: 343 });
    assert(tv.alpha_dB_per_m > 0, 'attenuation must be positive');
    assert(tv.delta_v > 0 && tv.delta_v < 0.01, 'boundary layer scale');
  });

  check('dimensionless groups are finite', () => {
    const g = dimensionlessGroups({ f: 200, c: 343, length: 1, radius: 0.05, volume: 0.01 });
    assert(Number.isFinite(g.ka) && g.ka > 0, 'ka');
    assert(Number.isFinite(g.StokesNumber) && g.StokesNumber > 0, 'Stokes');
  });

  // --- Science: poles, radiation, multi-mode, tube, MC, sweeps ---
  check('complex pole damping rate is ω0/(2Q)', () => {
    const p = complexPole({ f0: 100, Q: 50 });
    approx(p.sigma, (2 * Math.PI * 100) / (2 * 50), 1e-12);
    approx(p.pole.re, -p.sigma, 1e-12);
    assert(p.underdamped, 'Q=50 should be underdamped');
  });

  check('circular piston radiation is resistive-positive and mass-like', () => {
    const r = circularPistonRadiation({ radius: 0.05, f: 200, rho: 1.2, c: 343, flanged: true });
    assert(r.Z.re > 0, 'R_rad must be positive');
    assert(r.Z.im > 0, 'X_rad should be mass-like positive at low ka');
  });

  check('two coupled identical modes split by 2κ in multi-mode', () => {
    const m = multiModeEigen({
      freqs: [200, 200],
      couplingHz: [[0, 4], [4, 0]],
      Q: [40, 40],
    });
    assert(m.eigenmodes.length === 2, 'need 2 eigenmodes');
    const fs = m.eigenmodes.map((e) => e.f).sort((a, b) => a - b);
    approx(fs[1] - fs[0], 8, 0.2, 0, 'splitting ≈ 2κ');
  });

  check('symmetric eigen Jacobi recovers diagonal spectrum', () => {
    const { values } = symmetricEigenJacobi([[2, 0], [0, 5]]);
    const s = values.map((v) => Math.round(v * 1e6) / 1e6).sort((a, b) => a - b);
    approx(s[0], 2, 1e-6);
    approx(s[1], 5, 1e-6);
  });

  check('impedance tube two-microphone recovers load reflection magnitude ≤ 1', () => {
    const tube = impedanceTubeMeasurement({
      f: 300,
      sampleLength: 0.05,
      Zload: { re: 500, im: 100 },
      tubeArea: 0.002,
      c: 343,
      rho: 1.2,
      spacing: 0.02,
      x1: 0.05,
    });
    const meas = twoMicrophoneImpedance({
      p1: tube.p1,
      p2: tube.p2,
      spacing: 0.02,
      f: 300,
      c: 343,
      rho: 1.2,
      x1: 0.05,
    });
    const r2 = meas.reflection.re ** 2 + meas.reflection.im ** 2;
    assert(r2 <= 1.2, `|r|² should be physical, got ${r2}`);
    assert(Number.isFinite(meas.Z.re), 'Z_re finite');
  });

  check('Monte Carlo mean matches analytic model for linear f(L)', () => {
    const fn = (p) => 343 / (2 * p.length);
    const mc = monteCarloUncertainty(fn, { length: 1.0 }, { length: 0.01 }, {
      n: 800, relative: true, seed: 7,
    });
    approx(mc.mean, 171.5, 0.05, 0.5, 'MC mean near analytic');
    assert(mc.std > 0, 'must have spread');
  });

  check('1D sweep finds the minimum of a parabola-like model', () => {
    const fn = (p) => (p.length - 1.2) ** 2 * 100 + 50;
    const sw = sweep1D(fn, { length: 1 }, 'length', 0.5, 2.0, 41, 'linear');
    const ext = sweepExtremum(sw, 'min');
    approx(ext.x, 1.2, 0.05);
  });

  check('expansion chamber TL is non-negative and peaks near kL=π/2', () => {
    const L = 0.5;
    const c = 343;
    const m = 4;
    // peak when sin(kL)=1 → kL=π/2 → f = c/(4L)
    const fPeak = c / (4 * L);
    const peak = expansionChamberTL({ f: fPeak, length: L, areaRatio: m, c }).TLdB;
    const off = expansionChamberTL({ f: fPeak / 2, length: L, areaRatio: m, c }).TLdB;
    assert(peak > off, 'TL at quarter-wave peak exceeds half-frequency');
    assert(peak > 5, 'TL peak reasonably large for m=4');
  });

  check('transfer-matrix TL is finite for uniform duct', () => {
    const r = transmissionLossFromMatrix({
      A: { re: 1, im: 0 }, B: { re: 0, im: 0 }, C: { re: 0, im: 0 }, D: { re: 1, im: 0 },
      Z0: 400,
    });
    // identity two-port → TL = 20 log10|2/2| = 0
    approx(r.TLdB, 0, 1e-9);
  });

  check('bootstrap CI brackets the sample mean', () => {
    const samples = Array.from({ length: 200 }, (_, i) => 170 + ((i * 37) % 20) - 10);
    const b = bootstrapCI(samples, { nBoot: 200, level: 0.95, seed: 3 });
    assert(b.ciLo < b.mean && b.mean < b.ciHi, 'mean inside CI');
    assert(b.ciHi > b.ciLo, 'CI ordered');
  });

  check('Prony recovers frequency of a pure tone', () => {
    const dt = 0.001;
    const f = 200;
    const w = 2 * Math.PI * f;
    const n = 256;
    const yReal = Array.from({ length: n }, (_, k) => Math.cos(w * k * dt));
    const yImag = Array.from({ length: n }, (_, k) => Math.sin(w * k * dt));
    const pr = pronyPoles({ yReal, yImag, dt, nModes: 1 });
    assert(pr.poles.length >= 1, 'got a pole');
    const fEst = pr.poles[0].fHz;
    approx(fEst, f, 0.05, 2.0, 'Prony f ≈ 200 Hz');
  });

  check('case compare reports relative f0 delta', () => {
    const a = makeCaseSnapshot({ name: 'A', type: 'tube', env: { c: 343 }, results: { modes: [{ f: 100 }], damping: { Q: 20 } } });
    const b = makeCaseSnapshot({ name: 'B', type: 'tube', env: { c: 343 }, results: { modes: [{ f: 110 }], damping: { Q: 25 } } });
    const cmp = compareCases(a, b);
    approx(cmp.df0, -10, 1e-9);
    approx(cmp.df0rel, -10 / 110, 1e-9);
  });

  check('Q1 FEM Neumann modes agree with analytic square within 2%', () => {
    const Lx = 1;
    const Ly = 1;
    const c = 343;
    const fem = femModes2D({ Nx: 14, Ny: 14, Lx, Ly, c, nModes: 6, includeZero: true });
    const ana = analyticalRectModes2D({ Lx, Ly, c, maxL: 4, maxM: 4, nModes: 6 });
    const rows = compareFemAnalytic(fem, ana, 0.02);
    assert(rows.length >= 4, 'enough mode pairs');
    assert(rows.every((r) => r.ok), 'all returned frequencies must agree within 2%');
    assert(fem.modes[0].f === 0, 'uniform mode is exactly DC');
  });

  check('FEM assembled mass integrates area and stiffness annihilates constants', () => {
    const { K, M } = finiteElementMatrices2D({ Nx: 5, Ny: 4, Lx: 1.3, Ly: 0.7 });
    approx(M.flat().reduce((s, v) => s + v, 0), 1.3 * 0.7, 1e-12);
    for (let i = 0; i < K.length; i++) {
      approx(K[i].reduce((s, v) => s + v, 0), 0, 0, 1e-12);
      for (let j = 0; j < K.length; j++) {
        approx(K[i][j], K[j][i], 1e-12);
        approx(M[i][j], M[j][i], 1e-12);
      }
    }
  });

  check('FEM fields satisfy Kp=k²Mp and mass orthogonality', () => {
    const opts = { Nx: 6, Ny: 5, Lx: 1.3, Ly: 0.7, nModes: 8 };
    const { K, M } = finiteElementMatrices2D(opts);
    const modes = femModes2D(opts).modes;
    const multiply = (A, v) => A.map((r) => r.reduce((s, a, j) => s + a * v[j], 0));
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    for (let i = 0; i < modes.length; i++) {
      const v = modes[i].field.flat();
      const Kv = multiply(K, v);
      const Mv = multiply(M, v);
      const residual = Math.hypot(...Kv.map((v, j) => v - modes[i].k2 * Mv[j]));
      assert(residual / Math.max(1, Math.hypot(...Kv)) < 1e-8, `mode ${i} residual ${residual}`);
      for (let j = 0; j < i; j++) approx(dot(modes[j].field.flat(), Mv), 0, 0, 1e-8);
    }
  });

  check('FEM mesh refinement gives second-order frequency convergence', () => {
    const errors = [9, 17, 33].map((N) => {
      const result = femModes2D({ Nx: N, Ny: N, Lx: 1, Ly: 0.8, nModes: 8 });
      return compareFemAnalytic(result, analyticalRectModes2D({ Lx: 1, Ly: 0.8 })).slice(1).map((r) => r.relErr);
    });
    for (let i = 0; i < 7; i++) {
      assert(errors[1][i] < errors[0][i] * 0.3 && errors[2][i] < errors[1][i] * 0.3, `mode ${i} must converge`);
      assert(errors[2][i] < 0.002, 'fine grid error <0.2%');
    }
  });

  check('FEM excludes only the uniform mode, including on very large domains', () => {
    const modes = femModes2D({ Lx: 1e6, Ly: 8e5, includeZero: false }).modes;
    assert(modes.length === 8 && modes.every((m) => m.f > 0), '8 nonzero modes');
    approx(modes[0].f, 343 / 2e6, 0.01);
  });

  check('Analytical FEM reference includes enough axial modes for thin rectangles', () => {
    const modes = analyticalRectModes2D({ Lx: 10, Ly: 0.01, nModes: 8 });
    modes.forEach((m, i) => approx(m.f, 343 * i / 20, 1e-12));
  });

  check('FEM rejects fractional, excessive and non-finite inputs', () => {
    for (const opts of [{ Nx: 8.5 }, { Nx: 65 }, { Ny: NaN }, { Lx: Infinity }, { Ly: 0 }, { c: NaN }, { nModes: 0 }, { nModes: 10000 }]) {
      let rejected = false;
      try { femModes2D(opts); } catch { rejected = true; }
      assert(rejected, `must reject ${JSON.stringify(opts)}`);
    }
  });

  check('Synthetic impedance recovers complex load independently of amplitude and mic position', () => {
    for (const amplitude of [0.1, 1, 3]) for (const x1 of [0, 0.05, 0.17]) {
      const m = syntheticTubeMeasurement({ f: 500, Zload: { re: 300, im: -80 }, amplitude, x1 });
      approx(m.Zest.Z.re, 300, 1e-10);
      approx(m.Zest.Z.im, -80, 1e-10);
    }
  });

  check('Both impedance tube generators use the same specific impedance convention', () => {
    const m = impedanceTubeMeasurement({ f: 300, Zload: { re: 500, im: 100 }, sampleLength: 0.05, amplitude: 0.3 });
    const est = twoMicrophoneImpedance({ ...m, c: 343, rho: 1.2 });
    approx(est.Z.re, 500, 1e-10);
    approx(est.Z.im, 100, 1e-10);
  });

  check('Two-microphone inversion rejects singular spacing', () => {
    let rejected = false;
    try { twoMicrophoneImpedance({ p1: { re: 1, im: 0 }, p2: { re: 1, im: 0 }, f: 343, spacing: 0.5 }); }
    catch { rejected = true; }
    assert(rejected, 'half wavelength spacing must be rejected');
  });

  check('Project JSON round trip preserves infinite Q and FEM study settings', () => {
    const a = new Store();
    a.setState({ fem: { ...a.get().fem, Nx: 20, selectedMode: 4, radiation: false, viscous: true, thermal: false, extraLoss: .02, responseStart: .8, responseEnd: 1.2, responseSamples: 161 } });
    const b = new Store();
    b.loadProject(parseProjectJSON(projectToJSON(a)));
    assert(b.get().damping.Qe === Infinity && b.get().damping.leakQ === Infinity, 'infinite Q preserved');
    assert(b.get().fem.Nx === 20 && b.get().fem.selectedMode === 4, 'FEM settings preserved');
    for (const key of ['radiation','viscous','thermal','extraLoss','responseStart','responseEnd','responseSamples']) assert(b.get().fem[key] === a.get().fem[key], `FEM ${key} preserved`);
  });

  check('Legacy null Q imports and partial non-tube geometry receive correct defaults', () => {
    const s = new Store();
    s.loadProject({ schemaVersion: 1, resonatorType: 'helmholtz', geometry: { volume: 0.003 }, damping: { Qe: null } });
    assert(s.get().damping.Qe === Infinity, 'legacy Infinity recovered');
    assert(s.get().geometry.neckRadius === 0.02 && s.get().geometry.volume === 0.003, 'type-specific defaults');
  });

  check('synthetic tube recovers load reflection magnitude ≤ 1', () => {
    const m = syntheticTubeMeasurement({
      f: 500,
      Zload: { re: 300, im: -80 },
      c: 343,
      rho: 1.2,
      spacing: 0.02,
      x1: 0.05,
    });
    const R = m.Zest.reflection;
    const mag = Math.hypot(R.re, R.im);
    assert(mag <= 1.05, '|R| physical');
    assert(Number.isFinite(m.Zest.Z.re), 'Z re finite');
  });

  check('transfer function of identical signals is 1', () => {
    const sig = Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.2));
    const S = dftSpectrum(sig, 64);
    const H = transferFunction(S, S);
    approx(H[5].mag, 1, 1e-6, 1e-6);
  });

  check('Helmholtz FEM mesh preserves cavity and neck volumes and has a connected junction', () => {
    const g = { volume: 0.002, neckRadius: 0.02, neckLength: 0.05 };
    const mesh = meshHelmholtz(g, 'coarse');
    const { K, M, integratedVolume } = assembleHelmholtz(mesh);
    const expected = g.volume + Math.PI * g.neckRadius ** 2 * g.neckLength;
    approx(integratedVolume, expected, 1e-12);
    const ones = new Float64Array(K.n).fill(1);
    approx(bandMultiply(M, ones).reduce((s, v) => s + v, 0), expected, 1e-12);
    approx(bandMultiply(K, ones).reduce((s, v) => s + v, 0), Math.PI * g.neckRadius ** 2 / mesh.geometry.mouthDelta, 1e-10);
    const neighbors = mesh.nodes.map(() => new Set());
    for (const tri of mesh.triangles) for (const a of tri) for (const b of tri) neighbors[a].add(b);
    const seen = new Set([0]), queue = [0];
    for (let i = 0; i < queue.length; i++) for (const j of neighbors[queue[i]]) if (!seen.has(j)) { seen.add(j); queue.push(j); }
    assert(seen.size === mesh.nodes.length, 'cavity and neck must be one connected mesh');
    assert(mesh.boundaries.axis.length > 0 && mesh.boundaries.rigid.length > 0 && mesh.boundaries.mouth.length > 0, 'boundary tags must be exported');
    assert(!mesh.boundaries.rigid.some((edge) => edge.every((i) => mesh.nodes[i][1] === mesh.geometry.height && mesh.nodes[i][0] < g.neckRadius)), 'neck junction must not become an internal rigid wall');
  });

  check('Axisymmetric FEM agrees with independent open-cylinder axial and Bessel modes', () => {
    // Rigid cylinder bottom/side, whole top pressure release; independent separable benchmark.
    const mesh = meshHelmholtz({ volume: 0.002, neckRadius: 0.02, neckLength: 0, endCorrectionModel: 'none' }, 'fine');
    const { radius: R, height: H } = mesh.geometry;
    mesh.mouthNodes = mesh.nodes.map((v, i) => v[1] === H ? i : -1).filter((i) => i >= 0);
    const { K, M } = assembleHelmholtz(mesh);
    const actual = solveLowestModes(K, M, { nModes: 6 });
    const reference = [];
    for (const chi of [0, 3.831705970207512, 7.015586669815619]) for (let p = 0; p < 8; p++) {
      reference.push(343 / (2 * Math.PI) * Math.hypot(chi / R, (2 * p + 1) * Math.PI / (2 * H)));
    }
    reference.sort((a, b) => a - b);
    actual.values.forEach((k2, i) => approx(343 * Math.sqrt(k2) / (2 * Math.PI), reference[i], 0.005));
  });

  check('Helmholtz FEM eigenpairs satisfy the assembled equations and mass orthogonality', () => {
    const result = helmholtzModesFEM({ geometry: { volume: 0.002, neckRadius: 0.02, neckLength: 0.05 }, level: 'coarse' });
    const { K, M, dof } = assembleHelmholtz(result.mesh);
    for (let i = 0; i < result.modes.length; i++) {
      const mode = result.modes[i], v = new Float64Array(K.n);
      dof.forEach((d, j) => { if (d >= 0) v[d] = mode.values[j]; });
      const kv = bandMultiply(K, v), mv = bandMultiply(M, v);
      const residual = Math.hypot(...kv.map((x, j) => x - mode.k2 * mv[j])) / Math.hypot(...kv);
      assert(residual < 1e-7, `mode ${i} residual ${residual}`);
      for (let j = 0; j < i; j++) {
        const other = new Float64Array(K.n);
        dof.forEach((d, k) => { if (d >= 0) other[d] = result.modes[j].values[k]; });
        const cross = other.reduce((s, x, k) => s + x * mv[k], 0);
        const normA = v.reduce((s, x, k) => s + x * mv[k], 0);
        const mOther = bandMultiply(M, other);
        const normB = other.reduce((s, x, k) => s + x * mOther[k], 0);
        assert(Math.abs(cross) / Math.sqrt(normA * normB) < 1e-8, 'modes must be M-orthogonal');
      }
    }
  });

  check('Helmholtz mesh refinement converges without fitting the lumped frequency', () => {
    const geometry = { volume: 0.002, neckRadius: 0.02, neckLength: 0.05 };
    const frequencies = ['coarse', 'medium', 'fine'].map((level) => helmholtzModesFEM({ geometry, level, nModes: 2 }).modes[0].f);
    assert(frequencies[0] > frequencies[1] && frequencies[1] > frequencies[2], 'frequency approaches from above');
    assert(Math.abs(frequencies[2] - frequencies[1]) / frequencies[1] < 0.003, 'medium/fine difference below 0.3%');
    assert(Math.abs(frequencies[2] - frequencies[1]) < Math.abs(frequencies[1] - frequencies[0]), 'refinement changes decrease');
  });

  check('Helmholtz FEM recovers the lumped limit for a narrow long neck', () => {
    const result = helmholtzModesFEM({ geometry: { volume: 0.002, neckRadius: 0.005, neckLength: 0.1 }, level: 'medium', nModes: 2 });
    assert(Math.abs(result.comparison.difference) < 0.025, 'lumped limit within 2.5%');
  });

  check('Helmholtz FEM scales inversely with geometry and linearly with sound speed', () => {
    const g = { volume: 0.002, neckRadius: 0.02, neckLength: 0.05 };
    const base = helmholtzModesFEM({ geometry: g, level: 'coarse', nModes: 2 });
    const bigger = helmholtzModesFEM({ geometry: { ...g, volume: g.volume * 8, neckRadius: g.neckRadius * 2, neckLength: g.neckLength * 2 }, c: 400, level: 'coarse', nModes: 2 });
    base.modes.forEach((mode, i) => approx(bigger.modes[i].f, mode.f * 400 / 343 / 2, 1e-9));
  });

  check('Helmholtz FEM frequency follows actual volume and neck dimensions', () => {
    const g = { volume: 0.002, neckRadius: 0.02, neckLength: 0.05 };
    const solve = (geometry) => helmholtzModesFEM({ geometry, level: 'coarse', nModes: 1 }).modes[0].f;
    const base = solve(g);
    assert(solve({ ...g, volume: 0.004 }) < base, 'larger cavity lowers frequency');
    assert(solve({ ...g, neckLength: 0.1 }) < base, 'longer neck lowers frequency');
    assert(solve({ ...g, neckRadius: 0.025 }) > base, 'larger neck raises frequency');
    assert(Math.abs(solve({ ...g, cavityAspectRatio: 3 }) - base) > 0.2, 'actual cavity shape affects the field solution');
  });

  check('Pressure-release Helmholtz mouth has exact zero pressure and no uniform DC mode', () => {
    const r = helmholtzModesFEM({ geometry: { volume: 0.002, neckRadius: 0.02, neckLength: 0.05, endCorrectionModel: 'none' }, level: 'coarse', nModes: 2 });
    assert(r.modes[0].f > 0, 'open mode is nonzero');
    for (const m of r.modes) for (const i of r.mesh.mouthNodes) approx(m.values[i], 0, 0, 1e-14);
  });

  check('Helmholtz geometry rejects unsupported necks/shapes and invalid dimensions', () => {
    const base = { volume: 0.002, neckRadius: 0.02, neckLength: 0.05 };
    for (const patch of [{ nNecks: 2 }, { neckShape: 'rectangular' }, { cavityShape: 'sphere' }, { volume: Infinity }, { neckRadius: 0.2 }, { neckLength: -1 }, { cavityAspectRatio: 0 }]) {
      let rejected = false;
      try { helmholtzFemGeometry({ ...base, ...patch }); } catch { rejected = true; }
      assert(rejected, `must reject unsupported geometry ${JSON.stringify(patch)}`);
    }
  });

  check('A zero-length pressure-release aperture solves even when the lumped formula is undefined', () => {
    const r = helmholtzModesFEM({ geometry: { volume: 0.002, neckRadius: 0.02, neckLength: 0, endCorrectionModel: 'none' }, level: 'coarse', nModes: 2 });
    assert(r.modes[0].f > 0 && Number.isFinite(r.modes[0].f), 'finite FEM aperture mode');
    assert(r.comparison.lumpedHz === null && r.comparison.difference === null, 'undefined comparison is explicit');
  });

  check('Complex band FEM solve recovers an independent manufactured solution', () => {
    const A={n:4,bandwidth:1,data:new Float64Array([4,0,3,-1,2,.3,5,-.7])};
    const im=Float64Array.from([.2,0,.5,.1,.8,-.2,.1,.05]);
    const xr=[1,-2,.3,4],xi=[.5,.7,-1,2];
    const rr=bandMultiply(A,xr),ii=bandMultiply({...A,data:im},xi),ri=bandMultiply(A,xi),ir=bandMultiply({...A,data:im},xr);
    const p=solveComplexBand(A,A.data,im,rr.map((v,i)=>v-ii[i]),ri.map((v,i)=>v+ir[i]));
    xr.forEach((v,i)=>{approx(p.re[i],v,1e-12);approx(p.im[i],xi[i],1e-12);});
    assert(p.residual<1e-12,'manufactured residual');
  });
  const responseReference=helmholtzModesFEM({geometry:{volume:.002,neckRadius:.02,neckLength:.05},level:'medium',nModes:2});
  const responseAll=helmholtzFrequencyResponse({result:responseReference});
  check('Driven FEM half-power roots give the actual transfer-function bandwidth', () => {
    const r=responseAll,solver=createHelmholtzResponseSolver(responseReference);
    assert(r.Q>20&&r.Q<200&&r.maxResidual<1e-7,'finite passive response and residual');
    for(const f of [r.fLower,r.fUpper])approx(solver.solve(f).mag**2,r.peak.mag**2/2,1e-7);
    approx(r.Q,r.peak.f/(r.fUpper-r.fLower),1e-12);
    assert(r.peak.f<responseReference.modes[0].f,'boundary-layer reactance lowers peak');
    approx(Object.values(r.peak.power).reduce((a,b)=>a+b,0),r.peak.injectedPower,1e-7,0,'passive power balance');
  });
  check('FEM bulk loss factor eta recovers independent single-mode Q ≈ 1/eta', () => {
    const r=helmholtzFrequencyResponse({result:responseReference,losses:{radiation:false,viscous:false,thermal:false,extraLoss:.01}});
    approx(r.Q,100,.002);
    approx(r.peak.f,responseReference.modes[0].f/Math.sqrt(1+.01**2),2e-5);
    assert(r.peak.power.radiation===0&&r.peak.power.viscous===0&&r.peak.power.thermal===0&&r.peak.power.additional>0,'disabled mechanisms contribute no power');
  });
  check('Radiation and wall FEM losses combine passively and broaden resonance', () => {
    const rad=helmholtzFrequencyResponse({result:responseReference,losses:{viscous:false,thermal:false}});
    const wall=helmholtzFrequencyResponse({result:responseReference,losses:{radiation:false}});
    approx(1/responseAll.Q,1/rad.Q+1/wall.Q,.02);
    assert(responseAll.Q<rad.Q&&responseAll.Q<wall.Q,'additional losses reduce Q');
    assert(Object.values(responseAll.peak.power).every(v=>v>=0),'nonnegative dissipated powers');
    assert(rad.peak.power.viscous===0&&rad.peak.power.thermal===0&&wall.peak.power.radiation===0,'independent loss switches');
  });
  check('Narrow-neck radiation FEM Q approaches independent lumped radiation resistance', () => {
    const r0=helmholtzModesFEM({geometry:{volume:.002,neckRadius:.005,neckLength:.1},level:'medium',nModes:1});
    const r=helmholtzFrequencyResponse({result:r0,losses:{viscous:false,thermal:false}}),k=2*Math.PI*r.peak.f/343;
    const expected=2*k*(.1+1.7*.005)/(k*.005)**2;
    approx(r.Q,expected,.025);
  });
  check('Unbracketed FEM peaks never report a fabricated Q', () => {
    const r=helmholtzFrequencyResponse({result:responseReference,fStart:20,fEnd:50,nSamples:21});
    assert(r.Q===null&&r.peak===null&&r.warnings.length>0,'unresolved peak is explicit');
  });
  check('Driven Helmholtz peak and Q converge with the physical mesh', () => {
    const fine=helmholtzModesFEM({geometry:{volume:.002,neckRadius:.02,neckLength:.05},level:'fine',nModes:2});
    const r=helmholtzFrequencyResponse({result:fine});
    approx(r.peak.f,responseAll.peak.f,.003);
    approx(r.Q,responseAll.Q,.01);
  });
  check('FEM response rejects lossless singular sweeps and invalid settings', () => {
    for(const options of [{losses:{radiation:false,viscous:false,thermal:false}}, {nSamples:2}, {fStart:0}, {fEnd:NaN}, {losses:{extraLoss:-1}}, {losses:{mu:0}}]){
      let rejected=false;try{helmholtzFrequencyResponse({result:responseReference,...options});}catch{rejected=true;}
      assert(rejected,'must reject '+JSON.stringify(options));
    }
    const solver=createHelmholtzResponseSolver(responseReference,{radiation:false,viscous:false,thermal:false});
    const p=solver.solve(.8*responseReference.modes[0].f);
    assert(Math.abs(p.im)<1e-10&&p.residual<1e-7,'off-resonance lossless limit is real without artificial damping');
  });

  check('Uniform-pressure FEM mouth port matches independent closed-cylinder input impedance', () => {
    const mesh=meshHelmholtz({volume:.002,neckRadius:.02,neckLength:0},'fine'),H=mesh.geometry.height,R=mesh.geometry.radius;
    mesh.mouthNodes=mesh.nodes.map((p,i)=>({p,i})).filter(v=>Math.abs(v.p[1]-H)<1e-10).sort((a,b)=>a.p[0]-b.p[0]).map(v=>v.i);
    mesh.mouthEdges=mesh.mouthNodes.slice(1).map((v,i)=>[mesh.mouthNodes[i],v]);
    mesh.boundaries.rigid=mesh.boundaries.rigid.filter(e=>!e.every(i=>Math.abs(mesh.nodes[i][1]-H)<1e-10));
    const solver=createHelmholtzResponseSolver({mesh,c:343},{radiation:false,viscous:false,thermal:false});
    for(const f of [100,300,500]){
      const p=solver.solve(f,{port:true}),exact=-1.2*343/(Math.PI*R*R)/Math.tan(2*Math.PI*f/343*H);
      approx(p.reactance,exact,.0005);approx(p.resistance,0,0,1e-8);assert(p.residual<1e-10,'port residual');
    }
  });
  check('FEM interior impedance is independent of the free-air radiation switch', () => {
    const a=createHelmholtzResponseSolver(responseReference,{radiation:true}).solve(150,{port:true});
    const b=createHelmholtzResponseSolver(responseReference,{radiation:false}).solve(150,{port:true});
    approx(a.resistance,b.resistance,1e-12);approx(a.reactance,b.reactance,1e-12);
    assert(a.resistance>0,'passive interior wall losses');
    approx(a.flowRe/(a.flowRe**2+a.flowIm**2),a.resistance,1e-12);
  });
  check('Normal-incidence absorption gives unity for matched surface impedance', () => {
    const rho=1.2,c=343,cellArea=.0256,resistance=rho*c/cellArea;
    const a=normalIncidenceAbsorption({rho,c,cellArea,resistance,reactance:0});
    approx(a.alpha,1,1e-12);approx(a.reflectionRe,0,0,1e-12);approx(a.reflectionIm,0,0,1e-12);
    for(const reactance of [0,1e3,-1e3,1e7]){
      const p=normalIncidenceAbsorption({rho,c,cellArea,resistance,reactance});
      approx(p.alpha+p.reflectionRe**2+p.reflectionIm**2,1,1e-12);
    }
    approx(normalIncidenceAbsorption({rho,c,cellArea,resistance:0,reactance:5000}).alpha,0,0,1e-12);
  });
  check('Ideal side-branch loading conserves power and distinguishes reflection from dissipation', () => {
    const rho=1.2,c=343,ductArea=.02,zc=rho*c/ductArea;
    const critical=sideBranchTransmission({rho,c,ductArea,resistance:zc/2,reactance:0});
    approx(critical.transmission,.25,1e-12);approx(critical.reflection,.25,1e-12);approx(critical.dissipation,.5,1e-12);
    const closed=sideBranchTransmission({rho,c,ductArea,resistance:0,reactance:0});
    assert(closed.TLdB===Infinity&&closed.reflection===1&&closed.dissipation===0,'lossless shunt blocks by reflection');
    for(const [resistance,reactance] of [[500,1000],[5e5,-1e5],[0,800]]){
      const p=sideBranchTransmission({rho,c,ductArea,resistance,reactance});
      approx(p.transmission+p.reflection+p.dissipation,1,1e-12);assert(p.TLdB>=0,'passive TL');
    }
  });
  const performanceReference={...responseReference,response:responseAll};
  check('Mounted FEM performance is passive and rejects overlapping panel cells / invalid ducts', () => {
    const panel=helmholtzPortPerformance({result:performanceReference,application:'absorber'});
    const duct=helmholtzPortPerformance({result:performanceReference,application:'duct'});
    assert(panel.peak.alpha>0&&panel.peak.alpha<=1&&duct.peak.TLdB>0,'mounted peak is finite');
    assert(panel.rows.every(p=>p.alpha>=0&&p.alpha<=1),'passive absorption sweep');
    duct.rows.forEach(p=>approx(p.transmission+p.reflection+p.dissipation,1,1e-10));
    assert(panel.target.f===150&&panel.maxResidual<1e-8,'target and verified port solves');
    const imported=parseMeasuredResponse(applicationPerformanceToCSV(panel));
    assert(imported.kind==='simulation'&&imported.quantity==='absorption','exported simulation keeps its provenance and quantity');
    for(const patch of [{application:'absorber',faceWidth:.01},{application:'duct',ductDiameter:.01},{targetFrequency:NaN},{application:'unknown'}]){
      let rejected=false;try{helmholtzPortPerformance({result:performanceReference,...patch});}catch{rejected=true;}assert(rejected,'invalid mounting rejected');
    }
  });
  check('CSV reference extraction recovers an independent 150 Hz Q 50 oscillator', () => {
    const lines=['# provenance: synthetic','# source: Independent oscillator','frequency_Hz,magnitude'];
    for(let i=0;i<=1000;i++){const f=100+i*.1;lines.push(`${f},${1/Math.hypot(1-(f/150)**2,f/(50*150))}`);}
    const data=parseMeasuredResponse(lines.join('\n')),features=responseFeatures(data.points,{pressure:true});
    assert(data.kind==='synthetic','synthetic provenance retained');approx(features.peak.f,150,.001);approx(features.Q,50,.002);
    const ideal={response:{freqs:data.points.map(p=>p.f),mag:data.points.map(p=>p.value),Q:50,peak:{f:150}}};
    const comparison=compareMeasurement(data,ideal);
    approx(comparison.rmse,0,0,1e-12);approx(comparison.peakDifference,0,0,1e-12);
    assert(comparison.note.includes('does not validate'),'no claim of experimental validation');
  });
  check('Measurement import rejects ambiguous, malformed, duplicate and non-finite samples', () => {
    const invalid=['frequency_Hz,magnitude\n100,1\n100,2\n200,3','frequency_Hz,magnitude\n0,1\n100,2\n200,3',
      'frequency_Hz,magnitude\n50,1\n100,NaN\n200,3','frequency_Hz,absorption\n50,1.1\n100,.5\n200,.2',
      'frequency_Hz,magnitude\n50,1\n100,-1\n200,3','frequency_Hz,magnitude\n50,1\n100,\n200,3'];
    for(const csv of invalid){let rejected=false;try{parseMeasuredResponse(csv);}catch{rejected=true;}assert(rejected,'reject invalid measurement');}
    const db=parseMeasuredResponse('frequency_Hz,magnitude_dB\n50,-20\n100,0\n150,20');
    approx(db.points[0].value,.1,1e-12);approx(db.points[2].value,10,1e-12);
    assert(responseFeatures([{f:50,value:1},{f:100,value:2},{f:150,value:3}],{pressure:true}).Q===null,'edge peak has no Q');
  });
  check('Application and reference-curve project settings round trip with safe provenance', () => {
    const a=new Store(),measurement=parseMeasuredResponse('frequency_Hz,magnitude\n100,1\n150,5\n200,1');
    a.setState({fem:{...a.get().fem,application:'duct',targetFrequency:170,faceWidth:.2,ductDiameter:.18,measurement,normalizeMeasurement:false}});
    const b=new Store();b.loadProject(parseProjectJSON(projectToJSON(a)));
    for(const key of ['application','targetFrequency','faceWidth','ductDiameter','normalizeMeasurement'])assert(a.get().fem[key]===b.get().fem[key],`saved ${key}`);
    assert(b.get().fem.measurement.points.length===3&&b.get().fem.measurement.kind==='imported','trace restored');
    let rejected=false;try{restoreMeasurement({...measurement,points:[{f:NaN,value:2},{f:150,value:3},{f:200,value:4}]});}catch{rejected=true;}assert(rejected,'invalid saved trace rejected');
  });

  check('FEM inverse design recovers a planted cavity volume from its eigenfrequency', () => {
    const known={volume:.004,neckRadius:.02,neckLength:.05};
    const target=helmholtzModesFEM({geometry:known,level:'coarse',nModes:1}).modes[0].f;
    const d=inverseDesignHelmholtzFEM({geometry:{...known,volume:.002},level:'coarse',targetFrequency:target,parameter:'volume',metric:'lossless'});
    assert(d.status==='converged','verified lossless inverse');approx(d.geometry.volume,known.volume,.003);
    approx(d.frequency,target,.001);assert(d.geometry.neckRadius===known.neckRadius&&d.geometry.neckLength===known.neckLength,'fixed neck dimensions retained');
  });
  check('FEM inverse design verifies the damped peak with a fresh forward solve', () => {
    const geometry={volume:.002,neckRadius:.02,neckLength:.05};
    const d=inverseDesignHelmholtzFEM({geometry,level:'coarse',targetFrequency:120});
    assert(d.status==='converged'&&d.verifications>0&&d.trace.some(p=>p.stage==='full verification'),'full driven verification recorded');
    const forward=helmholtzModesFEM({geometry:d.geometry,level:'coarse',nModes:2});
    const response=helmholtzFrequencyResponse({result:forward});
    approx(response.peak.f,120,.001);approx(d.frequency,response.peak.f,1e-6);
    assert(geometry.volume===.002&&geometry.neckLength===.05,'search never mutates the current geometry');
    const initial=new Store().get(),project=femDesignProject(initial,d);
    assert(initial.fem.targetFrequency===150&&project.fem.targetFrequency===120,'verified target overrides stale form state without mutating it');
    assert(project.resonatorType==='helmholtz'&&project.fem.meshLevel==='coarse'&&project.display.tab==='fem','proposal reopens on the verified FEM study');
    assert(project.fem.inverseDesignRecord.frequency===d.frequency&&project.geometry.volume===d.geometry.volume,'proposal preserves audit and exact dimensions');
    let rejected=false;try{femDesignProject(initial,{...d,status:'not-converged'});}catch{rejected=true;}assert(rejected,'failed designs cannot be exported as applicable projects');
  });
  check('Automatic FEM inverse design respects panel fit and changes neck length when volume cannot work', () => {
    const d=inverseDesignHelmholtzFEM({geometry:{volume:.002,neckRadius:.02,neckLength:.05},level:'coarse',targetFrequency:100,application:'absorber',faceWidth:.16});
    assert(d.status==='converged'&&d.parameter==='neckLength','automatic fallback finds a feasible dimension');
    approx(d.result.performance.peak.f,100,.001);
    assert(d.geometry.volume===.002&&helmholtzFemGeometry(d.geometry).radius*2<=.16,'cavity fits and remains unchanged');
    assert(d.attempts.some(a=>a.parameter==='volume'&&a.status!=='converged'),'unsuccessful bounded volume attempt is explained');
  });
  check('FEM inverse design supports a bounded neck-radius search and uniform scaling', () => {
    const geometry={volume:.002,neckRadius:.02,neckLength:.05};
    const radius=inverseDesignHelmholtzFEM({geometry,level:'coarse',targetFrequency:180,parameter:'neckRadius'});
    assert(radius.status==='converged'&&radius.geometry.neckRadius>.02,'neck radius changes');approx(radius.frequency,180,.001);
    const scaled=inverseDesignHelmholtzFEM({geometry,level:'coarse',targetFrequency:100,parameter:'scale',metric:'lossless'});
    assert(scaled.status==='converged','uniform scaling succeeds');
    approx(scaled.geometry.volume/geometry.volume,(scaled.geometry.neckRadius/geometry.neckRadius)**3,1e-12);
    approx(scaled.geometry.neckLength/geometry.neckLength,scaled.value,1e-12);
  });
  check('Unreachable FEM inverse targets and insufficient refinements cannot masquerade as a successful design', () => {
    const geometry={volume:.002,neckRadius:.02,neckLength:.05};
    const impossible=inverseDesignHelmholtzFEM({geometry,level:'coarse',targetFrequency:10000,metric:'lossless'});
    assert(impossible.status==='unreachable'&&!impossible.result&&impossible.attempts.length===3,'unreachable result is explicit');
    const limited=inverseDesignHelmholtzFEM({geometry,level:'coarse',targetFrequency:120,parameter:'volume',maxRefinements:1});
    assert(limited.status==='not-converged'&&Math.abs(limited.best.relativeError)>limited.tolerance&&!limited.result,'failed peak verification cannot be applied as a match');
    const duct=inverseDesignHelmholtzFEM({geometry,level:'coarse',targetFrequency:300,parameter:'neckRadius',application:'duct',ductDiameter:.045});
    assert(duct.status!=='converged'&&duct.trace.every(p=>p.value<.045/2),'duct clearance restricts radius trials');
  });
  check('FEM inverse design rejects invalid targets, limits and accuracy settings', () => {
    const base={geometry:{volume:.002,neckRadius:.02,neckLength:.05},targetFrequency:120,level:'coarse'};
    for(const patch of [{targetFrequency:0},{targetFrequency:NaN},{bounds:{volume:[1,0]}},{bounds:{neckRadius:[0,.1]}},{tolerance:0},{maxIterations:Infinity},{parameter:'unknown'},{level:'invalid'}]){
      let rejected=false;try{inverseDesignHelmholtzFEM({...base,...patch});}catch{rejected=true;}assert(rejected,'reject '+JSON.stringify(patch));
    }
  });
  check('FEM inverse design verifies strongly damped peaks outside the lossless screening range', () => {
    const geometry={volume:.002,neckRadius:.02,neckLength:.05},losses={extraLoss:.8};
    const forward=helmholtzModesFEM({geometry,level:'coarse',nModes:2});
    const target=helmholtzFrequencyResponse({result:forward,losses}).peak.f;
    const d=inverseDesignHelmholtzFEM({geometry,losses,level:'coarse',targetFrequency:target,parameter:'volume',bounds:{volume:[.0019,.0021]}});
    assert(d.status==='converged','a reachable damped peak must not be rejected by the lossless surrogate');
    approx(d.frequency,target,.001);approx(d.geometry.volume,.002,.005);
  });
  check('FEM inverse search options and applied audit records survive project save/import', () => {
    const a=new Store();a.setState({fem:{...a.get().fem,inverseParameter:'neckLength',inverseMetric:'lossless',inverseTolerancePct:.2,
      inverseBounds:{...a.get().fem.inverseBounds,neckLength:[.02,.3]},inverseDesignRecord:{targetFrequency:100,frequency:100.01,parameter:'neckLength',level:'medium'}}});
    const b=new Store();b.loadProject(parseProjectJSON(projectToJSON(a)));
    assert(b.get().fem.inverseParameter==='neckLength'&&b.get().fem.inverseTolerancePct===.2&&b.get().fem.inverseDesignRecord.targetFrequency===100,'inverse options and audit record retained');
    approx(b.get().fem.inverseBounds.neckLength[1],.3,1e-12);
    b.loadProject({schemaVersion:1,resonatorType:'helmholtz',fem:{source:'resonator',inverseBounds:{neckLength:[.01,.4]}}});
    assert(b.get().fem.inverseBounds.volume[0]===.00005&&b.get().fem.inverseBounds.neckLength[1]===.4,'partial bounds merge with defaults');
  });

  const jointBase={mode:'frequency-q',geometry:{volume:.002,neckRadius:.02,neckLength:.05,cavityAspectRatio:1},targetFrequency:150,targetQ:60,level:'medium'};
  let jointDesign;
  check('Joint inverse design verifies frequency and Q with an independent selected-mesh forward solve',()=>{
    jointDesign=inverseDesignHelmholtzFEM(jointBase);
    const d=jointDesign;assert(d.status==='converged'&&d.verifications>0,'joint full verification');
    const forward=helmholtzModesFEM({geometry:d.geometry,level:'medium',nModes:6}),f0=forward.modes[0].f;
    const response=helmholtzFrequencyResponse({result:forward,losses:d.losses,fStart:.1*f0,fEnd:2*f0,nSamples:81});
    approx(response.peak.f,150,.001);approx(response.Q,60,.02);
    approx(response.peak.f,d.frequency,1e-9);approx(response.Q,d.qualityFactor,1e-9);
    assert(d.dimensions.filter(k=>Math.abs(d.geometry[k]/jointBase.geometry[k]-1)>1e-4).length>=2,'several dimensions change');
    assert(d.trace.every(p=>envelopeFits(p.geometry,d.sizeLimits))&&envelopeFits(d.geometry,d.sizeLimits),'hard envelope respected throughout');
    assert(d.result.modes.length===6&&jointBase.geometry.volume===.002,'full modes and unchanged baseline');
  });
  check('Joint inverse design repairs an oversized start and obeys tight overall packaging limits',()=>{
    const known={volume:.0008,neckRadius:.012,neckLength:.045,cavityAspectRatio:.8};
    const fwd=helmholtzModesFEM({geometry:known,level:'coarse',nModes:2}),f0=fwd.modes[0].f;
    const r=helmholtzFrequencyResponse({result:fwd,fStart:.1*f0,fEnd:2*f0,nSamples:81});
    const sizeLimits={maxDiameter:.125,maxHeight:.18,allowance:.002};
    assert(!envelopeFits(jointBase.geometry,sizeLimits),'baseline is too large');
    const d=inverseDesignHelmholtzFEM({...jointBase,level:'coarse',targetFrequency:r.peak.f,targetQ:r.Q,sizeLimits});
    assert(d.status==='converged','feasible geometry recovered');
    for(const p of d.trace){assert(envelopeFits(p.geometry,sizeLimits),'each trial fits');for(const k of d.dimensions)assert(p.geometry[k]>=d.bounds[k][0]*(1-1e-12)&&p.geometry[k]<=d.bounds[k][1]*(1+1e-12),'each bound respected');}
    const g=helmholtzFemGeometry(d.geometry),e=resonatorEnvelope(d.geometry,sizeLimits);
    approx(e.diameter,2*g.radius+.004,1e-12);approx(e.height,g.height+g.neckLength+.004,1e-12);
  });
  check('Joint inverse design keeps locked dimensions exact and selected losses unchanged',()=>{
    const geometry={...jointBase.geometry,neckRadius:.018,neckLength:.075},losses={extraLoss:.001};
    const fwd=helmholtzModesFEM({geometry,level:'coarse',nModes:2}),f0=fwd.modes[0].f;
    const r=helmholtzFrequencyResponse({result:fwd,losses,fStart:.1*f0,fEnd:2*f0,nSamples:81});
    const d=inverseDesignHelmholtzFEM({...jointBase,level:'coarse',targetFrequency:r.peak.f,targetQ:r.Q,losses,dimensions:['neckLength','neckRadius']});
    assert(d.status==='converged','two-dimension joint match');
    assert(d.trace.every(p=>p.geometry.volume===.002&&p.geometry.cavityAspectRatio===1),'fixed dimensions exact in every trial');
    assert(d.result.response.losses.extraLoss===.001&&losses.extraLoss===.001,'loss settings fixed');
  });
  check('Mounted frequency and isolated Q are distinct, jointly verified targets',()=>{
    const d=inverseDesignHelmholtzFEM({...jointBase,level:'coarse',targetFrequency:100,application:'absorber'});
    assert(d.status==='converged','mounted joint match');approx(d.result.performance.peak.f,100,.001);approx(d.result.response.Q,60,.02);
    assert(d.qDefinition.includes('Isolated')&&d.qDefinition.includes('not mounted'),'explicit Q reference');
    assert(d.envelope.diameter<=d.faceWidth*(1+1e-9),'packaging fits panel cell');
  });
  check('Infeasible sizes and exhausted joint searches never expose an accepted result',()=>{
    const impossible=inverseDesignHelmholtzFEM({...jointBase,sizeLimits:{maxDiameter:.02,maxHeight:.03,allowance:.002}});
    assert(impossible.status==='infeasible'&&!impossible.result&&impossible.evaluations===0,'infeasible envelope rejected before FEM');
    const limited=inverseDesignHelmholtzFEM({...jointBase,level:'coarse',targetQ:100000,maxEvaluations:16});
    assert(limited.status!=='converged'&&!limited.result&&limited.evaluations<=16,'budget and both-target acceptance enforced');
    let rejected=false;try{femDesignProject(new Store().get(),limited);}catch{rejected=true;}assert(rejected,'failure cannot apply/export');
  });
  check('Joint proposal export guards Q and size, and preserves settings and audit on import',()=>{
    const d=jointDesign;assert(d?.status==='converged','verified fixture');
    const project=femDesignProject(new Store().get(),d),store=new Store();store.loadProject(parseProjectJSON(projectToJSON(project)));
    const fem=store.get().fem;
    assert(fem.inverseMode==='frequency-q'&&fem.inverseTargetQ===60&&fem.inverseQTolerancePct===2,'targets restored');
    assert(fem.inverseDimensions.length===4&&fem.inverseSizeLimits.maxHeight===.3&&fem.inverseBounds.cavityAspectRatio[0]===.1,'constraints restored');
    assert(fem.inverseDesignRecord.qualityFactor===d.qualityFactor&&fem.responseStart===.1&&fem.responseEnd===2,'audit and verified sweep restored');
    for(const patch of [{targetQ:600},{sizeLimits:{...d.sizeLimits,maxDiameter:.01}}]){let rejected=false;try{femDesignProject(project,{...d,...patch});}catch{rejected=true;}assert(rejected,'unverified Q/size cannot apply');}
    store.loadProject({schemaVersion:1,resonatorType:'helmholtz',fem:{inverseParameter:'volume',inverseSizeLimits:{maxHeight:.4}}});
    assert(store.get().fem.inverseMode==='frequency'&&store.get().fem.inverseSizeLimits.maxDiameter===.16,'legacy mode and partial limits migration');
  });
  check('Joint inverse design rejects invalid Q, losses, locks, bounds and size limits',()=>{
    for(const patch of [{targetQ:0},{targetQ:NaN},{dimensions:['volume']},{dimensions:['volume','volume']},{dimensions:['volume','unknown']},
      {qTolerance:0},{maxEvaluations:15},{maxEvaluations:Infinity},{sizeLimits:{maxHeight:0}},{sizeLimits:{allowance:.1}},
      {losses:{radiation:false,viscous:false,thermal:false}},{losses:{mu:-1}},{losses:{extraLoss:NaN}},
      {bounds:{unknown:[1,2]}},{dimensions:['neckLength','neckRadius'],bounds:{volume:[.003,.004]}}]){
      let rejected=false;try{inverseDesignHelmholtzFEM({...jointBase,...patch});}catch{rejected=true;}assert(rejected,'reject '+JSON.stringify(patch));
    }
  });

  return {
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export function formatValidationReport(report) {
  const lines = [
    'ResonLab V1.3 — Physics Validation',
    `Total: ${report.total}  Passed: ${report.passed}  Failed: ${report.failed}`,
    '',
  ];
  for (const r of report.results) {
    lines.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  — ' + r.error}`);
  }
  return lines.join('\n');
}

// Node entry
export function isNode() {
  return typeof process !== 'undefined' && !!(process.versions && process.versions.node);
}
