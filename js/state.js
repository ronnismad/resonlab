/**
 * Central application state — SI units internally.
 * UI layers subscribe via listeners; physics is pure and stateless.
 */

import { computeAirProperties, DEFAULT_ENV, GAS_LIBRARY } from './physics/air-properties.js?v=20251023';
import { DEFAULT_PRESETS } from './ui/presets.js?v=20251023';
import { restoreMeasurement } from './physics/measurement-comparison.js?v=20261031';

export const SCHEMA_VERSION = 1;

/** Display unit conversion helpers */
export const LENGTH_UNITS = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
};

export const FREQ_UNITS = {
  Hz: 1,
  kHz: 1e3,
  MHz: 1e6,
};

export function toMeters(value, unit = 'm') {
  const k = LENGTH_UNITS[unit];
  if (!k) throw new Error(`Unknown length unit: ${unit}`);
  return value * k;
}

export function fromMeters(valueM, unit = 'm') {
  const k = LENGTH_UNITS[unit];
  if (!k) throw new Error(`Unknown length unit: ${unit}`);
  return valueM / k;
}

/** Scale factor to convert SI → display unit for lengths. */
export function lengthUnitScale(unit = 'm') {
  return LENGTH_UNITS[unit] ?? 1;
}

/** Scale factor to convert SI → display unit for frequencies. */
export function freqUnitScale(unit = 'Hz') {
  return FREQ_UNITS[unit] ?? 1;
}

export function toHz(value, unit = 'Hz') {
  const k = FREQ_UNITS[unit];
  if (!k) throw new Error(`Unknown frequency unit: ${unit}`);
  return value * k;
}

export function fromHz(valueHz, unit = 'Hz') {
  const k = FREQ_UNITS[unit];
  if (!k) throw new Error(`Unknown frequency unit: ${unit}`);
  return valueHz / k;
}

export function defaultGeometry(type) {
  switch (type) {
    case 'tube':
      return {
        length: 1.0,
        diameter: 0.05,
        boundary: 'open-open',
        applyEndCorrection: true,
        flanged: false,
        nModes: 8,
      };
    case 'helmholtz':
      return {
        volume: 0.002,
        neckRadius: 0.02,
        neckLength: 0.05,
        neckShape: 'circular',
        neckWidth: 0.04,
        neckHeight: 0.02,
        endCorrectionModel: 'flanged',
        nNecks: 1,
        cavityShape: 'cylinder',
        cavityAspectRatio: 1,
      };
    case 'rectangular-cavity':
      return {
        Lx: 1.0,
        Ly: 0.8,
        Lz: 0.6,
        maxModes: 16,
        lMax: 5,
        mMax: 5,
        nMax: 5,
      };
    case 'cylindrical-cavity':
      return {
        radius: 0.25,
        length: 0.8,
        maxModes: 16,
        mMax: 4,
        pMax: 4,
        radialRoots: 4,
      };
    case 'spherical-cavity':
      return {
        radius: 0.3,
        maxModes: 16,
        lMax: 3,
        nMax: 3,
      };
    case 'annular-cavity':
      return {
        innerRadius: 0.08,
        outerRadius: 0.25,
        length: 0.6,
        maxModes: 16,
        mMax: 3,
        pMax: 3,
        nRoots: 3,
      };
    case 'side-branch':
      return {
        branchLength: 0.4,
        mainLength: 1.0,
        diameter: 0.04,
        boundary: 'quarter-wave',
        nModes: 6,
      };
    case 'mpp':
      return {
        holeDiameter: 0.0005,
        panelThickness: 0.001,
        porosity: 0.05,
        panelArea: 0.1,
        backedDepth: 0.05,
      };
    case 'horn':
      return {
        hornType: 'exponential',
        throatRadius: 0.02,
        mouthRadius: 0.12,
        length: 0.5,
      };
    case 'duct-chain':
      return {
        seg1Length: 0.3,
        seg1Area: 0.002,
        seg2Length: 0.5,
        seg2Area: 0.001,
        seg3Length: 0.2,
        seg3Area: 0.002,
        lossNp_per_m: 0.05,
      };
    case 'coupled':
      return {
        f1: 200,
        f2: 220,
        couplingHz: 4,
        Q1: 40,
        Q2: 40,
        fStart: 100,
        fEnd: 350,
        nSamples: 401,
      };
    case 'custom':
    default:
      return {
        length: 1.0,
        diameter: 0.05,
        boundary: 'open-open',
        applyEndCorrection: true,
        flanged: false,
        nModes: 8,
      };
  }
}

export function createInitialState(type = 'tube') {
  return {
    schemaVersion: SCHEMA_VERSION,
    projectName: 'Untitled resonator',
    resonatorType: type,
    environment: { ...DEFAULT_ENV },
    geometry: defaultGeometry(type),
    display: {
      theme: 'dark',
      lengthUnit: 'm',
      freqUnit: 'Hz',
      tab: 'geometry',
      nModes: 8,
      selectedMode: 1,
    },
    damping: {
      Qi: 80,
      Qe: Infinity,
      includeViscous: true,
      includeThermal: true,
      includeRadiation: true,
      includeLeak: false,
      includeWall: true,
      includeExternal: true,
      leakQ: Infinity,
      wallQ: 200,
    },
    frequencyResponse: {
      fStart: 20,
      fEnd: 2000,
      nSamples: 400,
      scale: 'log',
      quantity: 'pressure',
      driveAmplitude: 1.0,
    },
    inverseDesign: {
      enabled: false,
      targetF: 120,
      solveFor: 'volume',
    },
    couplingSweep: {
      enabled: false,
      couplingMin: 0,
      couplingMax: 20,
      detuneMin: -40,
      detuneMax: 40,
    },
    science: {
      analysisFreq: 200,
      showImpedance: true,
      showSensitivity: true,
      showGroups: true,
      uncertaintyPct: 2,
      mcSamples: 400,
      sweepParam: 'length',
      sweepMin: 0.3,
      sweepMax: 2.0,
      sweepN: 48,
      tubeSpacing: 0.02,
      tubeMic1: 0.05,
    },
    fem: { source: 'resonator', meshLevel: 'medium', Lx: 1, Ly: 0.8, Nx: 14, Ny: 12, selectedMode: 1,
      radiation: true, viscous: true, thermal: true, extraLoss: 0, responseStart: 0.5, responseEnd: 1.5, responseSamples: 101,
      application: 'tune', targetFrequency: 150, faceWidth: .16, ductDiameter: .15, measurement: null, normalizeMeasurement: true,
      inverseParameter:'auto',inverseMetric:'application',inverseTolerancePct:.1,
      inverseBounds:{volume:[.00005,.05],neckLength:[.001,.5],neckRadius:[.001,.05],scale:[.25,4],cavityAspectRatio:[.1,5]},inverseDesignRecord:null,
      inverseMode:'frequency-q',inverseTargetQ:60,inverseQTolerancePct:2,inverseDimensions:['volume','neckLength','neckRadius','cavityAspectRatio'],
      inverseSizeLimits:{maxDiameter:.16,maxHeight:.3,allowance:.002},inverseMaxEvaluations:100 },
    validation: {
      errors: {},
      warnings: {},
    },
  };
}

/** Pure environment computation with current state */
export function environmentFromState(state) {
  return computeAirProperties(state.environment);
}

export class Store {
  constructor() {
    this.state = createInitialState();
    this._listeners = new Set();
  }

  get() {
    return this.state;
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  emit(reason = 'update') {
    for (const fn of this._listeners) {
      try {
        fn(this.state, reason);
      } catch (err) {
        console.error('Store listener error', err);
      }
    }
  }

  setState(patch, reason = 'update') {
    this.state = { ...this.state, ...patch };
    this.emit(reason);
  }

  setEnvironment(patch, reason = 'env') {
    this.state = {
      ...this.state,
      environment: { ...this.state.environment, ...patch },
    };
    this.emit(reason);
  }

  setGeometry(patch, reason = 'geometry') {
    this.state = {
      ...this.state,
      geometry: { ...this.state.geometry, ...patch },
    };
    this.emit(reason);
  }

  setDisplay(patch, reason = 'display') {
    this.state = {
      ...this.state,
      display: { ...this.state.display, ...patch },
    };
    this.emit(reason);
  }

  setDamping(patch, reason = 'damping') {
    this.state = {
      ...this.state,
      damping: { ...this.state.damping, ...patch },
    };
    this.emit(reason);
  }

  setFrequencyResponse(patch, reason = 'freq') {
    this.state = {
      ...this.state,
      frequencyResponse: { ...this.state.frequencyResponse, ...patch },
    };
    this.emit(reason);
  }

  setInverseDesign(patch, reason = 'inverse') {
    this.state = {
      ...this.state,
      inverseDesign: { ...this.state.inverseDesign, ...patch },
    };
    this.emit(reason);
  }

  setValidation(errors = {}, warnings = {}) {
    this.state = {
      ...this.state,
      validation: { errors, warnings },
    };
    this.emit('validation');
  }

  setResonatorType(type, reason = 'type') {
    this.state = {
      ...this.state,
      resonatorType: type,
      geometry: defaultGeometry(type),
    };
    this.emit(reason);
  }

  reset() {
    this.state = createInitialState();
    this.emit('reset');
  }

  loadProject(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Invalid project JSON');
    if (json.schemaVersion && json.schemaVersion > SCHEMA_VERSION) {
      throw new Error(`Project schemaVersion ${json.schemaVersion} is newer than supported ${SCHEMA_VERSION}`);
    }
    const base = createInitialState();
    const type = json.resonatorType ?? base.resonatorType;
    const types = ['tube', 'custom', 'helmholtz', 'rectangular-cavity', 'cylindrical-cavity',
      'spherical-cavity', 'annular-cavity', 'side-branch', 'mpp', 'horn', 'duct-chain', 'coupled'];
    if (!types.includes(type)) throw new Error(`Unknown resonator type: ${type}`);
    const damping = { ...base.damping, ...(json.damping || {}) };
    // Legacy exports encoded Infinity as null. New exports use the string "Infinity".
    for (const key of ['Qi', 'Qe', 'leakQ', 'wallQ']) {
      if (damping[key] === null || damping[key] === 'Infinity') damping[key] = Infinity;
      if (!(damping[key] > 0) || (damping[key] !== Infinity && !Number.isFinite(damping[key]))) {
        throw new Error(`${key} must be a positive number or Infinity.`);
      }
    }
    this.state = {
      ...base,
      ...json,
      schemaVersion: SCHEMA_VERSION,
      environment: { ...base.environment, ...(json.environment || {}) },
      resonatorType: type,
      geometry: { ...defaultGeometry(type), ...(json.geometry || {}) },
      display: { ...base.display, ...(json.display || {}) },
      damping,
      frequencyResponse: { ...base.frequencyResponse, ...(json.frequencyResponse || {}) },
      inverseDesign: { ...base.inverseDesign, ...(json.inverseDesign || {}) },
      couplingSweep: { ...base.couplingSweep, ...(json.couplingSweep || {}) },
      science: { ...base.science, ...(json.science || {}) },
      fem: { ...base.fem, ...(json.fem || {}), source: json.fem?.source ?? (json.fem ? 'rectangle' : 'resonator'), measurement: restoreMeasurement(json.fem?.measurement),
        inverseBounds:{...base.fem.inverseBounds,...json.fem?.inverseBounds},
        inverseMode:json.fem?.inverseMode??(json.fem?.inverseParameter||json.fem?.inverseDesignRecord?'frequency':base.fem.inverseMode),
        inverseSizeLimits:{...base.fem.inverseSizeLimits,...json.fem?.inverseSizeLimits} },
      validation: { errors: {}, warnings: {} },
    };
    this.emit('load');
  }

  toProjectJSON() {
    return {
      ...this.state,
      schemaVersion: SCHEMA_VERSION,
      app: 'resonlab',
      appVersion: '1.3.0',
      exportedAt: new Date().toISOString(),
    };
  }
}

export const store = new Store();
export { DEFAULT_PRESETS, GAS_LIBRARY };
