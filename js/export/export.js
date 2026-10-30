/**
 * Export / import: CSV modes, CSV response, JSON project, report text, clipboard.
 * Pure data formatting — download helpers use Blob + object URLs.
 */

import { SCHEMA_VERSION } from '../state.js?v=20251023';
import { envelopeFits, resonatorEnvelope } from '../physics/fem-multi-design.js?v=20261101';

export function downloadBlob(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function modesToCSV(modes, meta = {}) {
  const header = [
    'mode_index',
    'label',
    'frequency_Hz',
    'wavelength_m',
    'harmonic',
    'nodes_m',
    'antinodes_m',
    'notes',
  ];
  const lines = [header.join(',')];
  modes.forEach((m, i) => {
    const nodes = (m.nodes || []).map((x) => Number(x).toFixed(5)).join('|');
    const anti = (m.antinodes || []).map((x) => Number(x).toFixed(5)).join('|');
    lines.push([
      i + 1,
      csvEscape(m.label || ''),
      Number(m.f).toFixed(6),
      m.lambda != null ? Number(m.lambda).toFixed(6) : '',
      m.harmonic != null ? m.harmonic : '',
      csvEscape(nodes),
      csvEscape(anti),
      csvEscape(m.branch || ''),
    ].join(','));
  });
  // metadata comment lines
  const metaLines = Object.entries(meta).map(([k, v]) => `# ${k}: ${v}`);
  return [...metaLines, lines.join('\n')].join('\n') + '\n';
}

export function responseToCSV({ freqs, mag, magDb, phase, meta = {} }) {
  meta={provenance:'simulation',source:'ResonLab simulated response',...meta};
  const header = ['frequency_Hz', 'magnitude', 'magnitude_dB', 'phase_rad', 'phase_deg'];
  const lines = [header.join(',')];
  for (let i = 0; i < freqs.length; i++) {
    lines.push([
      Number(freqs[i]).toFixed(6),
      Number(mag[i]).toFixed(8),
      magDb ? Number(magDb[i]).toFixed(4) : '',
      phase ? Number(phase[i]).toFixed(6) : '',
      phase ? Number((phase[i] * 180) / Math.PI).toFixed(4) : '',
    ].join(','));
  }
  const metaLines = Object.entries(meta).map(([k, v]) => `# ${k}: ${v}`);
  return [...metaLines, lines.join('\n')].join('\n') + '\n';
}

export function applicationPerformanceToCSV(p) {
  const app=p.application;
  const columns=['frequency_Hz','interior_resistance_Pa_s_m3','interior_reactance_Pa_s_m3','mounted_reactance_Pa_s_m3',
    ...(app==='absorber'?['absorption']:app==='duct'?['transmission_loss_dB','transmitted_power_fraction','reflected_power_fraction','dissipated_power_fraction']:[])];
  const rows=p.rows.map(v=>[v.f,v.resistance,v.reactance,v.mountedReactance,
    ...(app==='absorber'?[v.alpha]:app==='duct'?[v.TLdB,v.transmission,v.reflection,v.dissipation]:[])].join(','));
  return `# provenance: simulation\n# source: ResonLab V1.3 uniform-pressure FEM mouth port and ${app} loading\n# application: ${app}\n# face_width_m: ${p.faceWidth}\n# duct_diameter_m: ${p.ductDiameter}\n# target_frequency_Hz: ${p.targetFrequency}\n# medium: ${JSON.stringify(p.medium)}\n# geometry: ${JSON.stringify(p.geometry)}\n# assumptions: ${p.assumptions}\n# loading: ${p.loading}\n`+columns.join(',')+'\n'+rows.join('\n')+'\n';
}

/** Importable, unapplied proposal. Copy the verified target/settings explicitly;
 * form blur timing must never substitute an older target or loss selection. */
export function femDesignProject(state,design){
  const actualFrequency=design?.metric==='lossless'?design.result?.modes?.[0]?.f:design?.application==='tune'?design.result?.response?.peak?.f:design?.result?.performance?.peak?.f;
  if(design?.status!=='converged'||!design.result||!Number.isFinite(actualFrequency)||!Number.isFinite(design.targetFrequency)||design.targetFrequency<=0
    ||!Number.isFinite(design.tolerance)||design.tolerance<=0||Math.abs(actualFrequency-design.targetFrequency)/design.targetFrequency>design.tolerance)throw new Error('Only a verified design within tolerance can be applied or exported.');
  const joint=design.mode==='frequency-q';
  if(joint&&(!Number.isFinite(design.result.response?.Q)||!Number.isFinite(design.targetQ)||design.targetQ<=0||!Number.isFinite(design.qTolerance)||design.qTolerance<=0
    ||Math.abs(design.result.response.Q-design.targetQ)/design.targetQ>design.qTolerance||!envelopeFits(design.geometry,design.sizeLimits)))throw new Error('Both frequency and Q must pass verification inside the size envelope before Apply or export.');
  const {result,...audit}=design,losses=result.response?.losses||design.losses;
  const record={...audit,...(joint?{envelope:resonatorEnvelope(design.geometry,design.sizeLimits)}:{}),losses:{...losses},verifiedQ:result.response?.Q??null,
    verifiedAbsorption:result.performance?.peak?.alpha??null,verifiedTransmissionLoss:result.performance?.peak?.TLdB??null};
  return {...state,resonatorType:'helmholtz',geometry:{...design.geometry},display:{...state.display,tab:'fem'},
    fem:{...state.fem,source:'resonator',application:design.application,targetFrequency:design.targetFrequency,
      faceWidth:design.faceWidth,ductDiameter:design.ductDiameter,inverseMetric:design.metric,
      inverseBounds:{...state.fem?.inverseBounds,...design.bounds},inverseTolerancePct:design.tolerance*100,
      inverseParameter:joint?(state.fem?.inverseParameter||'auto'):design.parameter,
      inverseMode:joint?'frequency-q':'frequency',
      ...(joint?{inverseTargetQ:design.targetQ,inverseQTolerancePct:design.qTolerance*100,inverseDimensions:[...design.dimensions],
        inverseSizeLimits:{...design.sizeLimits},inverseMaxEvaluations:design.maxEvaluations}:{}),
      ...Object.fromEntries(['radiation','viscous','thermal','extraLoss'].map(key=>[key,losses[key]])),
      meshLevel:design.level,responseStart:design.verificationSweep?.startRatio??.5,responseEnd:design.verificationSweep?.endRatio??1.5,responseSamples:101,inverseDesignRecord:record}};
}

export function downloadApplicationPerformanceCSV(p) {
  downloadBlob('resonlab-'+p.application+'-performance.csv',applicationPerformanceToCSV(p),'text/csv');
}

export function projectToJSON(storeOrState) {
  const state = typeof storeOrState.toProjectJSON === 'function'
    ? storeOrState.toProjectJSON()
    : storeOrState;
  return JSON.stringify(state, (_key, value) => {
    if (value === Infinity) return 'Infinity';
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Project contains an invalid number.');
    return value;
  }, 2);
}

export function parseProjectJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Project JSON must be an object.');
  }
  if (data.schemaVersion == null) {
    throw new Error('Missing schemaVersion field.');
  }
  const v = Number(data.schemaVersion);
  if (!Number.isInteger(v) || v < 1) {
    throw new Error('Invalid schemaVersion.');
  }
  if (v > SCHEMA_VERSION) {
    throw new Error(`Project schemaVersion ${v} is newer than supported ${SCHEMA_VERSION}.`);
  }
  return data;
}

/**
 * Concise calculation report (plain text).
 */
export function buildReport({ state, env, results }) {
  const L = [];
  const push = (s = '') => L.push(s);
  push('ResonLab V1.3 (Acoustic Resonator Studio) — Calculation Report');
  push('Developed by S.Chatterjee');
  push('='.repeat(52));
  push(`Generated: ${new Date().toISOString()}`);
  push(`Project:   ${state.projectName || 'Untitled'}`);
  push(`Type:      ${state.resonatorType}`);
  push();
  push('1. Environment');
  push(`   Temperature:     ${env.temperatureC} °C`);
  push(`   Pressure:        ${env.pressurePa} Pa`);
  push(`   Humidity:        ${env.humidityPercent} %`);
  push(`   Gas:             ${env.gasName}`);
  push(`   Density ρ:       ${env.rho.toFixed(4)} kg/m³  [${env.rhoModel}]`);
  push(`   Sound speed c:   ${env.c.toFixed(3)} m/s  [${env.cModel}]`);
  push(`   c linear label:  ${env.cLinearValue.toFixed(3)} m/s  [${env.cLinearModel}]`);
  push(`   Viscosity μ:     ${env.mu.toExponential(4)} Pa·s  [${env.muModel}]`);
  push(`   γ:               ${env.gamma}`);
  push();
  push('2. Geometry (SI)');
  for (const [k, v] of Object.entries(state.geometry || {})) {
    push(`   ${k}: ${v}`);
  }
  push();
  push('3. Results');
  if (results?.summary) {
    for (const row of results.summary) {
      push(`   ${row.k}: ${row.v}${row.note ? `  (${row.note})` : ''}`);
    }
  }
  if (results?.modes?.length) {
    push();
    push('4. Modal frequencies (first entries)');
    push('   #  label        f (Hz)      λ (m)');
    results.modes.slice(0, 12).forEach((m, i) => {
      push(`   ${String(i + 1).padStart(2)}  ${String(m.label || m.n || '').padEnd(12)} ${Number(m.f).toFixed(3).padStart(10)}  ${m.lambda != null ? Number(m.lambda).toFixed(4) : '—'}`);
    });
  }
  if (results?.damping) {
    push();
    push('5. Damping / Q');
    push(`   Q_loaded:   ${results.damping.Q}`);
    push(`   Bandwidth:  ${results.damping.bandwidth} Hz`);
    push(`   τ_amplitude:${results.damping.tauAmplitude} s`);
    push(`   τ_energy:   ${results.damping.tauEnergy} s`);
  }
  push();
  push('6. Model assumptions');
  for (const a of results?.assumptions || []) {
    push(`   - ${a}`);
  }
  push();
  push('7. Validity');
  push('   Analytical / lumped models; not full-wave FEM/FDTD.');
  push('   Schematic animations are illustrative.');
  push('   See README.md equations and limitations.');
  return L.join('\n');
}

/** A FEM export must identify its independent domain and boundary conditions. */
export function buildFemReport({ projectName, env, result, comparison, convergence = [] }) {
  if (result.kind === 'helmholtz-axisymmetric') {
    const g = result.geometry;
    return [
      'ResonLab V1.3 — Helmholtz geometry FEM study', 'Developed by S.Chatterjee', `Project: ${projectName}`, `Generated: ${new Date().toISOString()}`,
      `Geometry: cylindrical cavity, volume=${g.volume} m³, radius=${g.radius} m, height=${g.height} m`,
      `Coaxial neck: radius=${g.neckRadius} m, length=${g.neckLength} m`,
      `Cavity height/diameter: ${g.cavityAspectRatio}`, `Mouth end correction: ${g.endCorrectionModel}, delta=${g.mouthDelta} m`,
      `Sound speed: ${result.c} m/s`, `Mesh: ${result.mesh.level}, ${result.mesh.nodes.length} nodes, ${result.mesh.triangles.length} triangles`,
      result.formula, `Boundary: ${g.boundary}`, '', '#  FEM frequency (Hz)  Relative eigenpair residual',
      ...result.modes.map((mode, i) => `${i + 1}  ${mode.f.toFixed(6)}  ${mode.residual.toExponential(6)}`),
        ...(result.response ? ['', 'Driven FEM response:', result.response.note,
          `Loss settings: ${JSON.stringify(result.response.losses)}`,
          `Damped pressure peak: ${result.response.peak?.f ?? 'unresolved'} Hz`,
          `Half-power Q: ${result.response.Q ?? 'unresolved'}`,
          `Half-power frequencies: ${result.response.fLower ?? 'unresolved'}, ${result.response.fUpper ?? 'unresolved'} Hz`,
          `Bandwidth: ${result.response.bandwidth ?? 'unresolved'} Hz`,
          `Peak pressure gain: ${result.response.peak?.mag ?? 'unresolved'} Pa/Pa`,
          `Peak loss powers (W for 1 Pa drive): ${JSON.stringify(result.response.peak?.power ?? {})}`,
          `Maximum linear solve residual: ${result.response.maxResidual}`,
          ...result.response.warnings] : [`Driven response: ${result.responseError || 'not solved'}`]),
        ...(result.inverseDesignRecord ? ['', 'Applied FEM inverse design:',
          `Target frequency: ${result.inverseDesignRecord.targetFrequency} Hz`,
          `Matched frequency definition: ${result.inverseDesignRecord.metric}; application: ${result.inverseDesignRecord.application}`,
          `Verified proposal frequency: ${result.inverseDesignRecord.frequency} Hz`,
          `Proposal relative frequency error: ${100*result.inverseDesignRecord.relativeError}%`,
          ...(result.inverseDesignRecord.mode==='frequency-q'?[
            `Target isolated bandwidth Q: ${result.inverseDesignRecord.targetQ}`,
            `Verified isolated bandwidth Q: ${result.inverseDesignRecord.qualityFactor}`,
            `Relative Q error: ${100*result.inverseDesignRecord.qRelativeError}%; tolerance: ${100*result.inverseDesignRecord.qTolerance}%`,
            `Q definition: ${result.inverseDesignRecord.qDefinition}`,
            `Adjusted dimensions: ${result.inverseDesignRecord.dimensions.join(', ')}`,
            `Overall size limits (m): ${JSON.stringify(result.inverseDesignRecord.sizeLimits)}`,
            `Verified envelope (m, m^3): ${JSON.stringify(result.inverseDesignRecord.envelope)}`,
            `FEM trial budget / used: ${result.inverseDesignRecord.maxEvaluations} / ${result.inverseDesignRecord.evaluations}`,
          ]:[]),
          `Adjusted parameter: ${result.inverseDesignRecord.parameter}; bounds: ${JSON.stringify(result.inverseDesignRecord.bounds)}`,
          `Search mesh: ${result.inverseDesignRecord.level}; requested tolerance: ${100*result.inverseDesignRecord.tolerance}%`,
          `Original geometry: ${JSON.stringify(result.inverseDesignRecord.originalGeometry)}`,
          `Proposed geometry: ${JSON.stringify(result.inverseDesignRecord.geometry)}`,
          result.inverseDesignRecord.note] : []),
        ...(result.performance ? ['', 'Application performance:',
          `Application: ${result.performance.application}`,
          `Target: ${result.performance.targetFrequency} Hz`,
          `Panel cell width: ${result.performance.faceWidth} m; duct diameter: ${result.performance.ductDiameter} m`,
          result.performance.port,result.performance.loading,result.performance.assumptions,
          `Mounted peak: ${result.performance.peak?.f ?? 'unresolved'} Hz`,
          `Peak absorption: ${result.performance.peak?.alpha ?? 'not applicable / unresolved'}`,
          `Peak duct transmission loss: ${result.performance.peak?.TLdB ?? 'not applicable / unresolved'} dB`,
          `Mounted target point: ${JSON.stringify(result.performance.target)}`,
          `Maximum port residual: ${result.performance.maxResidual}`,
          ...result.performance.warnings] : [`Application performance: ${result.performanceError || 'not solved'}`]),
        ...(result.measurementComparison ? ['', 'Imported reference comparison:',
          `Dataset: ${result.measurementComparison.measurement.name}`,
          `Provenance: ${result.measurementComparison.measurement.kind}; ${result.measurementComparison.measurement.source}`,
          result.measurementComparison.note,
          `Quantity: ${result.measurementComparison.quantity}; peak-normalized: ${result.measurementComparison.shape}`,
          `Imported peak: ${result.measurementComparison.measuredFeatures.peak?.f ?? 'unresolved'} Hz; imported bandwidth Q: ${result.measurementComparison.measuredFeatures.Q ?? 'unresolved / not applicable'}`,
          `Curve RMSE: ${result.measurementComparison.rmse}`,
          ...result.measurementComparison.measuredFeatures.warnings] : []),
        '', `Lumped analytical estimate: ${result.comparison.lumpedHz === null ? 'undefined for this aperture' : result.comparison.lumpedHz.toFixed(6) + ' Hz'}`,
      `Fundamental model difference: ${result.comparison.difference === null ? 'unavailable' : (100 * result.comparison.difference).toFixed(4) + '%'} (not a numerical error estimate)`,
        ...(convergence.length ? ['', 'Mesh convergence (same geometry and boundary):', ...convergence.map((row) => `${row.level}: ${row.triangles} triangles, lossless f1=${row.f.toFixed(6)} Hz, driven peak=${row.peak ?? 'unresolved'} Hz, Q=${row.Q ?? 'unresolved'}`)] : []),
        '', 'Lossless mode assumptions (driven approximations are listed separately above):', ...result.assumptions.map((s) => `- ${s}`),
      '- Mouth correction is a low-frequency approximation; high-ka modes need a radiation-domain model.',
      '- Geometry is the current resonator, not an independent rectangle. Fields are normalized.',
    ].join('\n');
  }
  const { Nx, Ny, Lx, Ly } = result.grid;
  return [
    'ResonLab V1.3 — FEM 2D study', 'Developed by S.Chatterjee', `Project: ${projectName}`, `Generated: ${new Date().toISOString()}`,
    `Domain: rigid rectangle ${Lx} x ${Ly} m`, `Mesh nodes: ${Nx} x ${Ny}`,
    `Sound speed: ${env.c} m/s`, result.formula,
    'Boundary conditions: rigid Neumann walls on all four sides',
    '', '#  Mode  FEM frequency (Hz)  Analytical (Hz)  Relative error (%)',
    ...comparison.map((row, i) => `${i + 1}  ${row.label}  ${row.fem.toFixed(6)}  ${row.analytic.toFixed(6)}  ${(row.relErr * 100).toFixed(4)}`),
    '', 'Mode 1 is a static uniform field at 0 Hz. Pressure fields are normalized.',
    'Lossless reference study: no Q, driven response, or absolute sound level is solved.',
    'This rectangle is independent of the primary analytical resonator geometry.',
  ].join('\n');
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  // fallback
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  return true;
}

function csvEscape(s) {
  const t = String(s);
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function downloadModesCSV(modes, meta, filename = 'modes.csv') {
  downloadBlob(filename, modesToCSV(modes, meta), 'text/csv;charset=utf-8');
}

export function downloadResponseCSV(resp, meta, filename = 'frequency-response.csv') {
  downloadBlob(filename, responseToCSV({ ...resp, meta }), 'text/csv;charset=utf-8');
}

export function downloadProjectJSON(state, filename = 'resonlab-project.json') {
  downloadBlob(filename, projectToJSON(state), 'application/json');
}

export function downloadReport(text, filename = 'resonlab-report.txt') {
  downloadBlob(filename, text, 'text/plain;charset=utf-8');
}
