/**
 * Air and gas property models for acoustic resonator calculations.
 * All SI units internally: K, Pa, kg/m^3, m/s, Pa·s, dimensionless.
 *
 * Models are labeled approximations suitable for engineering design over
 * roughly -20°C to +50°C and 50–110 kPa for dry/standard air.
 */

export const GAS_LIBRARY = {
  air: {
    id: 'air',
    name: 'Air (standard)',
    gamma: 1.400,
    R: 287.058,          // J/(kg·K) specific gas constant for dry air
    M: 0.0289647,        // kg/mol
    Cp: 1005.7,          // J/(kg·K) approx at 20°C
    note: 'Ideal-gas air; humidity corrections applied separately.',
  },
  nitrogen: {
    id: 'nitrogen',
    name: 'Nitrogen (N₂)',
    gamma: 1.400,
    R: 296.8,
    M: 0.0280134,
    Cp: 1040,
    note: 'Approximate dry N₂ properties near room temperature.',
  },
  helium: {
    id: 'helium',
    name: 'Helium (He)',
    gamma: 1.667,
    R: 2077.1,
    M: 0.0040026,
    Cp: 5193,
    note: 'Monatomic ideal gas; high sound speed.',
  },
  co2: {
    id: 'co2',
    name: 'Carbon dioxide (CO₂)',
    gamma: 1.289,
    R: 188.9,
    M: 0.04401,
    Cp: 844,
    note: 'Approximate near room temperature; real gas departs at high pressure.',
  },
};

/** Saturation vapor pressure of water (Pa) — Magnus / Buck-type approximation. */
export function saturationVaporPressure(T_C) {
  // Buck (1981) over water, accuracy ~0.1% over 0–50°C
  const a = 6.1121; // hPa
  const b = 18.678;
  const c = 257.14; // °C
  const d = 234.5;  // °C
  const eS_hPa = a * Math.exp((b - T_C / d) * (T_C / (c + T_C)));
  return eS_hPa * 100; // Pa
}

/**
 * Compute gas/acoustic properties from environment.
 *
 * @param {object} env
 * @param {number} env.temperatureC  - temperature in °C
 * @param {number} env.pressurePa    - static pressure in Pa
 * @param {number} env.humidity      - relative humidity 0–100 (%)
 * @param {string} env.gasId         - key into GAS_LIBRARY
 * @returns {object} labeled property set
 */
export function computeAirProperties(env) {
  const {
    temperatureC = 20,
    pressurePa = 101325,
    humidity = 50,
    gasId = 'air',
  } = env || {};

  const gas = GAS_LIBRARY[gasId] || GAS_LIBRARY.air;
  const T = temperatureC + 273.15;
  const p = pressurePa;
  const RH = Math.max(0, Math.min(100, humidity));

  if (T < 100) {
    throw new Error('Temperature must be above absolute zero (T_K > 0).');
  }
  if (p <= 0) {
    throw new Error('Pressure must be positive (Pa).');
  }

  // --- Humidity (affects air density & sound speed modestly) ---
  let vaporPa = 0;
  let xw = 0; // mole fraction of water vapor
  if (gasId === 'air' && RH > 0) {
    vaporPa = (RH / 100) * saturationVaporPressure(temperatureC);
    // Cap vapor to slightly below total pressure
    vaporPa = Math.min(vaporPa, p * 0.95);
    xw = vaporPa / p;
  }

  // Effective gas constant / molar mass for moist air
  const R = gas.R;
  const M_eff = gas.M * (1 - xw) + 0.01801528 * xw; // water M ≈ 0.018015 kg/mol
  const R_eff = 8.314462618 / M_eff;

  // Density of moist air (ideal gas): rho = (p - e)/(R_d T) + e/(R_w T)
  const R_w = 461.5; // J/(kg·K)
  const rho = (p - vaporPa) / (R * T) + vaporPa / (R_w * T);

  // --- Sound speed ---
  // Primary labeled model: c ≈ 331.3 + 0.606 T_C  (m/s), for dry air near 1 atm.
  const c_linear = 331.3 + 0.606 * temperatureC;
  // Ideal-gas model: c = sqrt(gamma R T); humidity slightly lowers gamma effect
  // Use effective gamma for moist air (approx): mix of air and vapor Cp
  const gamma = gas.gamma;
  const c_ideal = Math.sqrt(gamma * R_eff * T);

  // Preferred engineering value for air: ideal-gas with humidity-corrected R
  // and a small empirical humidity correction to match Cramer (1993)-type trends.
  let c = gasId === 'air' ? c_ideal : c_ideal;
  if (gasId === 'air') {
    // Mild humidity increase of c (few m/s at 50% RH, 20°C)
    const humidityBoost = 0.05 * RH * Math.max(0, (temperatureC + 10) / 40);
    c = c_ideal + humidityBoost;
  }

  // --- Dynamic viscosity (Sutherland) ---
  const mu0 = 1.716e-5; // Pa·s at T0
  const T0 = 273.15;
  const S = 110.4; // K
  const mu = mu0 * Math.pow(T / T0, 1.5) * ((T0 + S) / (T + S));

  // --- Prandtl number and thermal conductivity (approx air) ---
  const Pr = 0.71;
  const k = 0.02624 * Math.pow(T / 293.15, 0.8); // W/(m·K) approx

  // --- Kinematic viscosity ---
  const nu = mu / rho;

  // --- Ambient impedance ---
  const Z0 = rho * c;

  // --- Characteristic frequency scales ---
  // Viscous boundary layer thickness delta_v = sqrt(2 mu / (rho omega))
  // provided as a function helper below.

  return {
    gasId: gas.id,
    gasName: gas.name,
    temperatureC,
    temperatureK: T,
    pressurePa: p,
    humidityPercent: RH,
    vaporPressurePa: vaporPa,
    moleFractionWater: xw,

    rho,
    rhoModel: 'Ideal-gas two-component moist air: ρ = (p−e)/(R_d T) + e/(R_w T)',
    c,
    cLinearModel: 'c ≈ 331.3 + 0.606·T_C  (m/s)',
    cLinearValue: c_linear,
    cIdealValue: c_ideal,
    cModel: gasId === 'air'
      ? 'c = √(γ R_eff T) + humidity boost (~0.05·RH·scale)'
      : 'c = √(γ R T) ideal gas',
    gamma,
    R: R_eff,
    R_dry: R,
    M_eff,
    mu,
    muModel: 'Sutherland: μ = μ0 (T/T0)^1.5 (T0+S)/(T+S), μ0=1.716e−5, S=110.4 K',
    nu,
    Pr,
    k,
    Z0,
    speedOfSound: c,
    density: rho,
    dynamicViscosity: mu,
    kinematicViscosity: nu,
    impedance: Z0,
    gas: gas.id,
    assumptions: [
      'Ideal gas law',
      gasId === 'air' ? 'Humidity treated as mole-fraction mixture of dry air and water vapor' : 'Humidity ignored for non-air gases',
      'Sutherland viscosity law',
      'c from √(γ R T) with optional linear empirical form for comparison',
    ],
    warnings: gasId !== 'air' ? [gas.note] : [],
  };
}

/**
 * Viscous boundary-layer thickness (m) at angular frequency omega.
 * δ_v = sqrt(2 μ / (ρ ω))
 */
export function viscousBoundaryLayer(mu, rho, omega) {
  if (!(omega > 0)) return Infinity;
  return Math.sqrt((2 * mu) / (rho * omega));
}

/**
 * Thermal boundary-layer thickness (m).
 * δ_t = δ_v / sqrt(Pr)
 */
export function thermalBoundaryLayer(mu, rho, omega, Pr = 0.71) {
  return viscousBoundaryLayer(mu, rho, omega) / Math.sqrt(Pr);
}

/**
 * Frequency from wavelength and sound speed: f = c / λ
 */
export function frequencyFromWavelength(c, lambda) {
  return c / lambda;
}

/**
 * Wave number k = 2π f / c
 */
export function waveNumber(f, c) {
  return (2 * Math.PI * f) / c;
}

/**
 * Angular frequency ω = 2π f
 */
export function angularFrequency(f) {
  return 2 * Math.PI * f;
}

export const DEFAULT_ENV = {
  temperatureC: 20,
  pressurePa: 101325,
  humidity: 50,
  gasId: 'air',
};
