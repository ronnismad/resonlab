/**
 * Acoustic Resonator Studio — application entry.
 * Wires state, physics, UI, visualization, and export.
 * Physics modules do not depend on Plotly/Three.
 */

import { store, environmentFromState, toMeters, fromMeters, lengthUnitScale, freqUnitScale, DEFAULT_PRESETS, GAS_LIBRARY, createInitialState, LENGTH_UNITS, FREQ_UNITS } from './state.js?v=20251023';
import { computeAirProperties } from './physics/air-properties.js?v=20251023';
import { tubeFrequencies, sampleTubeMode, effectiveLength, endCorrection } from './physics/tube-resonators.js?v=20251023';
import { helmholtzResonance, helmholtzInverseDesign, helmholtzQEstimate } from './physics/helmholtz-resonator.js?v=20251023';
import { rectangularModes, cylindricalModes, rectangularModeShape, cylindricalModeShape, chiPrime, besselJ } from './physics/cavity-modes.js?v=20251023';
import { sphericalModes, annularCavityModes, sphericalBesselJ, chiSpherical } from './physics/spherical-annular.js?v=20251023';
import {
  dimensionlessGroups, thermoviscousDuct, mppImpedance, conicalHorn, exponentialHorn,
  ductTransferMatrix, chainTransferMatrices, helmholtzImpedance,
  sensitivity, propagateUncertainty, weylModeCount, sideBranchModes,
} from './physics/advanced.js?v=20251023';
import {
  complexPole, poleSet, poleFrequencySweep, circularPistonRadiation,
  multiModeEigen, twoMicrophoneImpedance, impedanceTubeMeasurement,
  monteCarloUncertainty, modalGramMatrix,
} from './physics/science.js?v=20251023';
import {
  expansionChamberTLSweep, bootstrapCI, pronyPoles, makeCaseSnapshot,
  compareCases, buildResearchPackage,
} from './physics/research.js?v=20251023';
import {
  femModes2D, analyticalRectModes2D, compareFemAnalytic,
} from './physics/fem2d.js?v=20251023';
import { helmholtzFemGeometry, meshHelmholtz } from './physics/helmholtz-fem.js?v=20261027';
import { helmholtzMeshSVG } from './visualization/fem-mesh.js?v=20261027';
import { mountFemWorkbench } from './ui/fem-workbench.js?v=20261031';
import { mountFemInverseDesign } from './ui/fem-inverse-design.js?v=20261031';
import {
  syntheticTubeSweep, syntheticTubeMeasurement, createMicCapture,
} from './physics/audio-tube.js?v=20251023';
import { sweep1D, sweep2D, sweepExtremum, sweepSlope } from './physics/sweep.js?v=20251023';
import { coupledTwoMode, coupledFrequencyResponse, couplingFromSplitting } from './physics/coupled-resonators.js?v=20251023';
import { dampingReport, combineQ, tubeViscousQ, cavityWallQ, radiationQ, halfPowerBandwidth, decayTimes } from './physics/damping.js?v=20251023';
import { runPhysicsValidation, formatValidationReport } from './physics/validation.js?v=20251023';
import { paramRow, selectRow, checkboxRow, button, bindNumberInput, debounce, flashMessage, parseNumber, paintRangeFill } from './ui/controls.js?v=20251023';
import { applyPreset, getPreset, presetLabel, presetExperiment } from './ui/presets.js?v=20251023';
import { mountHelp, openHelp } from './ui/help.js?v=20251023';
import { TOOL_GUIDES, MODEL_GUIDES, SWEEP_PARAMETERS, sweepSetup, guideFor, renderStudyGuide, mountToolLibrary, openToolLibrary } from './ui/study-guide.js?v=20261027';
import { t, setLang, getLang, toggleLang, initLang } from './ui/i18n.js?v=20251023';
import {
  plotFrequencyResponse, plotModeSpectrum, plotTubeModeShape, plotAvoidedCrossing, plotQBreakdown,
  plotPoles, plotImpedance, plotSweep, plotSweepHeatmap, plotHistogram, plotTornado,
  plotGroupDelay, plotNyquist, plotEnergyDecay, plotAbsorption, plotModeDensity,
  plotTransmissionLoss, plotHistogramCI, plotFieldSurface,
  setPlotly, getPlotly, downloadPlotPNG, disposePlot,
} from './visualization/plots.js?v=20251023';
import { drawTubeMode, drawHelmholtzSchematic, drawHeatmap, rectangularFieldSlice, cylindricalFieldSlice } from './visualization/mode-shapes.js?v=20251023';
import { geometrySVG, geometrySummary } from './visualization/geometry.js?v=20251023';
import { downloadBlob, downloadModesCSV, downloadResponseCSV, downloadApplicationPerformanceCSV, downloadProjectJSON, femDesignProject, downloadReport, buildReport, buildFemReport, parseProjectJSON, copyText } from './export/export.js?v=20251023';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let animFrame = null;
let animPhase = 0;
let animating = true;
let lastResults = null;
let activeMicCapture = null;
let lastFemStudy = null;
let femJob = null;

function cancelFemJob() {
  if (!femJob) return;
  const job = femJob; femJob = null;
  job.worker.terminate(); job.reject(new Error('FEM solve cancelled.'));
}

function runHelmholtzWorker(request, progress) {
  cancelFemJob();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./physics/fem-worker.js?v=20261027', import.meta.url), { type: 'module' });
    femJob = { worker, reject };
    const finish = () => { if (femJob?.worker === worker) femJob = null; worker.terminate(); };
    worker.onmessage = ({ data }) => {
      if (femJob?.worker !== worker) return;
      if (data.type === 'progress') { progress?.(data); return; }
      finish();
      if (data.type === 'error') reject(new Error(data.message)); else resolve(data.result);
    };
    worker.onerror = (event) => { finish(); reject(new Error(event.message || 'FEM worker failed to load. Serve the app through localhost or HTTPS.')); };
    worker.postMessage(request);
  });
}

function navigateStudy(id) {
  if (!TOOL_GUIDES.some((tool) => tool.id === id)) id = 'geometry';
  document.body.classList.remove('settings-open');
  store.setDisplay({ tab: id }, 'tab');
  $('.workspace')?.scrollTo({ top: 0 });
}

function editStudySettings() {
  document.body.classList.add('settings-open');
  $('#left-panel-body')?.scrollTo({ top: 0 });
  const target = $('#left-panel-body input:not([type="range"]):not([disabled]), #left-panel-body select');
  target?.focus({ preventScroll: true });
}

function startStudyExample(type) {
  if (type === 'fem') {
    if (store.get().resonatorType !== 'helmholtz') startStudyExample('helmholtz');
    store.setState({ fem: { ...store.get().fem, source: 'resonator', selectedMode: 1 } }, 'fem-settings');
    navigateStudy('fem'); return;
  }
  const preset = DEFAULT_PRESETS.find((p) => p.resonatorType === type);
  if (!preset) return;
  // Keep the current project environment and unrelated study settings.
  store.setState({ resonatorType: type, geometry: { ...preset.geometry },
    display: { ...store.get().display, tab: type === 'coupled' ? 'coupling' : 'geometry' },
    presetExperiment: preset.experiment, presetId: preset.id }, 'preset');
  $('.workspace')?.scrollTo({ top: 0 });
  flashMessage($('#status'), 'Example loaded. Change a dimension to explore your design.');
}

function startInverseDesign() {
  if (store.get().resonatorType !== 'helmholtz') startStudyExample('helmholtz');
  store.setInverseDesign({ enabled: true });
  navigateStudy('geometry');
  editStudySettings();
  $('#in-inv-f')?.focus();
}

function startApplication(application) {
  store.setState({fem:{...store.get().fem,application,source:'resonator'}},'fem-settings');
  startStudyExample('fem');
}

function init() {
  try {
    initLang();
    const qs = new URLSearchParams(location.search);
    const qLang = qs.get('lang');
    if (qLang === 'ru' || qLang === 'en') setLang(qLang);
    const qTab = qs.get('tab');
    if (TOOL_GUIDES.some((tool) => tool.id === qTab)) {
      store.setDisplay({ tab: qTab }, 'url');
    }
    setPlotly(window.Plotly);
    buildToolbar();
    buildPanels();
    mountHelp();
    mountToolLibrary({ navigate: navigateStudy, help: openHelp, inverse: startInverseDesign });
    $('#settings-close').addEventListener('click', () => {
      document.body.classList.remove('settings-open');
      $('#study-guide button')?.focus({ preventScroll: true });
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('settings-open')) $('#settings-close').click();
    });
    if (location.hash === '#help' || location.hash === '#manual' || location.hash.startsWith('#help/')) openHelp();
    bindStore();
    bindAnimControls();
    applyTheme(store.get().display.theme);
    recompute(true);
  } catch (err) {
    const box = document.getElementById('boot-error');
    if (box) {
      box.hidden = false;
      box.textContent = t('boot.failed') + ': ' + (err && err.message ? err.message : String(err));
    }
    console.error(err);
    return;
  }

  // canvas animation loop (illustrative)
  const tick = () => {
    if (animating) {
      animPhase += 0.04;
      paintGeometryCanvas();
      const sl = $('#phase-slider');
      if (sl) {
        sl.value = String(animPhase % (2 * Math.PI));
        paintRangeFill(sl);
      }
      updatePhaseReadout();
    }
    animFrame = requestAnimationFrame(tick);
  };
  tick();
}

function bindAnimControls() {
  window.addEventListener('set-phase', (e) => {
    animPhase = Number(e.detail) || 0;
    paintGeometryCanvas();
    updatePhaseReadout();
  });
  window.addEventListener('toggle-anim', () => {
    animating = !animating;
    const btn = $('#anim-toggle');
    if (btn) btn.textContent = animating ? t('btn.pause') : t('btn.play');
    if (!animating) paintGeometryCanvas();
    updatePhaseReadout();
  });

  // Keyboard shortcuts: 1–9,0 switch analysis tabs
  const tabOrder = ['geometry', 'modes', 'response', 'damping', 'coupling', 'science', 'sweeps', 'impedance', 'fem', 'audio'];
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const keys = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9 };
    if (e.key in keys) {
      const id = tabOrder[keys[e.key]];
      if (!id) return;
      if ($('#tool-library')?.open || !$('#help-modal')?.hidden) return;
      navigateStudy(id);
    }
  });
}

function updatePhaseReadout() {
  const el = $('#phase-readout');
  if (el) el.textContent = `${(animPhase % (2 * Math.PI)).toFixed(2)} rad`;
}

function bindStore() {
  store.subscribe((_s, reason) => {
    if (reason === 'fem-settings') return; // FEM controls render their own result.
    if (reason === 'load' || reason === 'reset' || reason === 'type' || reason === 'preset' || reason === 'tab' || reason === 'settings') {
      applyTheme(store.get().display.theme);
      $('#project-name').value = store.get().projectName;
      rebuildLeftPanel();
    }
    recompute(false);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $('#theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? t('btn.theme.light') : t('btn.theme.dark');
}

function buildToolbar() {
  const tb = $('#toolbar');
  tb.innerHTML = '';

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = `
    <img class="brand-mark" src="assets/brand/resonlab-mark.svg" alt="" width="36" height="36" />
    <div class="brand-text">
      <strong>${t('app.name')} <small class="brand-version">V1.3</small></strong>
      <span class="author">${t('app.author')}</span>
    </div>
  `;

  const projectName = document.createElement('input');
  projectName.id = 'project-name';
  projectName.type = 'text';
  projectName.className = 'project-name';
  projectName.value = store.get().projectName;
  projectName.setAttribute('aria-label', 'Project name');
  projectName.title = 'Project name';
  projectName.addEventListener('change', () => {
    store.setState({ projectName: projectName.value || 'Untitled resonator' }, 'meta');
  });

  const presetSel = document.createElement('select');
  presetSel.id = 'preset-select';
  presetSel.setAttribute('aria-label', 'Load an example');
  presetSel.title = 'Load a guided example; replaces the current model and dimensions';
  presetSel.style.maxWidth = '210px';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = t('label.preset');
  presetSel.appendChild(ph);
  for (const p of DEFAULT_PRESETS) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = presetLabel(p, getLang());
    presetSel.appendChild(o);
  }
  presetSel.addEventListener('change', () => {
    const p = getPreset(presetSel.value);
    if (!p) return;
    store.setState(applyPreset(createInitialState, p), 'preset');
    flashMessage($('#status'), `${t('res.presetLoaded')}: ${presetLabel(p, getLang())}`);
    const exp = $('#experiment-hint');
    if (exp) exp.textContent = presetExperiment(p, getLang()) || '';
    rebuildLeftPanel();
    presetSel.value = '';
  });

  const actions = document.createElement('div');
  actions.className = 'toolbar-actions';

  // File / project
  const fileGroup = document.createElement('div');
  fileGroup.className = 'toolbar-group';
  fileGroup.append(
    button({ label: t('btn.reset'), className: 'btn btn-ghost', onClick: () => {
      store.reset();
      projectName.value = store.get().projectName;
      flashMessage($('#status'), t('res.resetOk'));
      rebuildLeftPanel();
    }, title: t('btn.reset.title') }),
    button({ label: t('btn.import'), className: 'btn', onClick: importProject, title: t('btn.import.title') }),
    button({ label: t('btn.save'), className: 'btn', onClick: () => {
      downloadProjectJSON(store.toProjectJSON());
      flashMessage($('#status'), t('res.jsonSaved'));
    }, title: t('btn.save.title') }),
  );

  // Export menu (compact)
  const exportWrap = document.createElement('div');
  exportWrap.className = 'menu-wrap';
  const exportBtn = button({
    label: t('btn.export') + ' ▾',
    className: 'btn',
    title: 'Export modes / response / plot / report',
    onClick: () => {
      exportWrap.classList.toggle('open');
    },
  });
  exportBtn.setAttribute('aria-haspopup', 'true');
  const exportMenu = document.createElement('div');
  exportMenu.className = 'menu-pop';
  exportMenu.setAttribute('role', 'menu');
  const menuItems = [
    [t('btn.modesCsv'), exportModes, t('btn.modesCsv.title')],
    [t('btn.respCsv'), exportResponse, t('btn.respCsv.title')],
    [t('btn.png'), exportPlotPNG, t('btn.png.title')],
    [t('btn.report'), exportReport, t('btn.report.title')],
    [t('btn.copy'), copyResults, t('btn.copy.title')],
    [t('btn.tests'), runTestsInline, t('btn.tests.title')],
  ];
  for (const [label, fn, title] of menuItems) {
    const item = button({
      label,
      className: 'btn menu-item',
      title,
      onClick: () => {
        exportWrap.classList.remove('open');
        fn();
      },
    });
    item.setAttribute('role', 'menuitem');
    exportMenu.appendChild(item);
  }
  exportWrap.append(exportBtn, exportMenu);
  document.addEventListener('click', (e) => {
    if (!exportWrap.contains(e.target)) exportWrap.classList.remove('open');
  });

  actions.append(fileGroup, exportWrap,
    button({ label: t('btn.help'), className: 'btn btn-primary', onClick: () => openHelp(), title: t('btn.help.title') }),
  );

  const themeBtn = button({ label: t('btn.theme.dark'), className: 'btn btn-secondary', onClick: () => {
    const next = store.get().display.theme === 'dark' ? 'light' : 'dark';
    store.setDisplay({ theme: next }, 'theme');
    applyTheme(next);
    recompute(true);
  } });
  themeBtn.id = 'theme-toggle';
  themeBtn.title = t('btn.theme.dark') + ' / ' + t('btn.theme.light');
  actions.append(themeBtn);

  const langBtn = button({
    label: getLang() === 'ru' ? 'RU' : 'EN',
    className: 'btn btn-lang',
    onClick: () => {
      toggleLang();
      rebuildLeftPanel();
      buildToolbar();
      renderResults(store.get(), environmentFromState(store.get()), lastResults || recompute(true));
      recompute(true);
      window.dispatchEvent(new CustomEvent('acoustudio:lang', { detail: { lang: getLang() } }));
    },
    title: 'EN / RU',
  });
  langBtn.id = 'lang-toggle';
  langBtn.setAttribute('aria-label', t('lang.label'));
  actions.append(langBtn);

  const tabs = document.createElement('nav');
  tabs.className = 'tabs';
  tabs.id = 'main-tabs';
  const tabDefs = [
    ['geometry', t('tab.geometry')],
    ['modes', t('tab.modes')],
    ['response', t('tab.response')],
    ['damping', t('tab.damping')],
    ['fem', t('tab.fem')],
  ];
  for (const [id, label] of tabDefs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.dataset.tab = id;
    b.textContent = label;
    b.title = guideFor(id).question;
    b.addEventListener('click', () => navigateStudy(id));
    if (id === store.get().display.tab) b.classList.add('active');
    tabs.appendChild(b);
  }
  const toolsButton = button({ label: 'All tools', onClick: openToolLibrary, className: 'tab tools-tab', title: 'Find every tool and learn when to use it' });
  toolsButton.id = 'all-tools';
  toolsButton.setAttribute('aria-haspopup', 'dialog');
  tabs.appendChild(toolsButton);
  const advancedTab = button({ label: '', onClick: () => {}, className: 'tab active' });
  advancedTab.id = 'current-tool'; advancedTab.hidden = true;
  tabs.appendChild(advancedTab);

  tb.append(brand, projectName, presetSel, actions);
  const tb2 = $('#toolbar-tabs');
  tb2.innerHTML = '';
  tb2.appendChild(tabs);
}

function buildPanels() {
  rebuildLeftPanel();
  const leftHead = document.querySelector('#left-panel .panel-header h2');
  const leftSub = document.querySelector('#left-panel .panel-header .sub');
  const rightHead = document.querySelector('#right-panel .panel-header h2');
  const rightSub = document.querySelector('#right-panel .panel-header .sub');
  if (leftHead) leftHead.textContent = t('panel.setup');
  if (leftSub) leftSub.textContent = t('panel.params');
  if (rightHead) rightHead.textContent = t('panel.results');
  if (rightSub) rightSub.textContent = t('panel.computed');
  const status = $('#status');
  if (status) status.hidden = true;
}

function rebuildLeftPanel() {
  const panel = $('#left-panel-body') || $('#left-panel');
  panel.innerHTML = '';
  const state = store.get();

  // Display units
  const unitSec = section(t('sec.units'), t('sec.units.note'));
  unitSec.appendChild(selectRow({
    id: 'len-unit',
    label: t('label.lenUnit'),
    value: state.display.lengthUnit || 'm',
    options: Object.keys(LENGTH_UNITS).map((u) => ({ value: u, label: u })),
    onChange: (v) => {
      store.setDisplay({ lengthUnit: v }, 'units');
      rebuildLeftPanel();
    },
  }).el);
  unitSec.appendChild(selectRow({
    id: 'freq-unit',
    label: t('label.freqUnit'),
    value: state.display.freqUnit || 'Hz',
    options: Object.keys(FREQ_UNITS).map((u) => ({ value: u, label: u })),
    onChange: (v) => {
      store.setDisplay({ freqUnit: v }, 'units');
      rebuildLeftPanel();
    },
  }).el);
  panel.appendChild(unitSec);

  const typeBlock = document.createElement('div');
  typeBlock.className = 'panel-section';
  typeBlock.appendChild(selectRow({
    id: 'type',
    label: t('sec.type'),
    tooltip: t('sec.type.note'),
    value: state.resonatorType,
    options: [
      { value: 'tube', label: t('type.tube') },
      { value: 'helmholtz', label: t('type.helmholtz') },
      { value: 'rectangular-cavity', label: t('type.rect') },
      { value: 'cylindrical-cavity', label: t('type.cyl') },
      { value: 'spherical-cavity', label: t('type.sphere') },
      { value: 'annular-cavity', label: t('type.annular') },
      { value: 'side-branch', label: t('type.sideBranch') },
      { value: 'mpp', label: t('type.mpp') },
      { value: 'horn', label: t('type.horn') },
      { value: 'duct-chain', label: t('type.duct') },
      { value: 'coupled', label: t('type.coupled') },
    ],
    onChange: (v) => {
      store.setResonatorType(v);
      rebuildLeftPanel();
    },
  }).el);
  panel.appendChild(typeBlock);

  // Environment
  const envSec = section(t('sec.env'), t('sec.env.note'));
  const env = state.environment;

  envSec.appendChild(paramRow({
    id: 'temp',
    label: t('label.temp'),
    unit: '°C',
    tooltip: 'Default 20°C. c ≈ 331.3 + 0.606 T (labelled) and √(γ R T).',
    value: env.temperatureC,
    min: -20,
    max: 80,
    step: 0.1,
    onCommit: (v) => store.setEnvironment({ temperatureC: v }),
  }).el);

  envSec.appendChild(paramRow({
    id: 'pres',
    label: t('label.pressure'),
    unit: 'Pa',
    tooltip: 'Default 101325 Pa. Affects density via ideal gas law.',
    value: env.pressurePa,
    min: 20000,
    max: 200000,
    step: 1,
    onCommit: (v) => store.setEnvironment({ pressurePa: v }),
  }).el);

  envSec.appendChild(paramRow({
    id: 'rh',
    label: t('label.rh'),
    unit: '%',
    tooltip: '0–100%. Moist-air density and small c correction.',
    value: env.humidity,
    min: 0,
    max: 100,
    step: 1,
    onCommit: (v) => store.setEnvironment({ humidity: v }),
  }).el);

  envSec.appendChild(selectRow({
    id: 'gas',
    label: t('label.gas'),
    tooltip: 'Extensible gas library. Properties computed from ideal-gas models.',
    value: env.gasId,
    options: Object.values(GAS_LIBRARY).map((g) => ({ value: g.id, label: g.name })),
    onChange: (v) => store.setEnvironment({ gasId: v }),
  }).el);

  const envOut = document.createElement('div');
  envOut.id = 'env-out';
  envOut.className = 'env-out';
  envSec.appendChild(envOut);
  panel.appendChild(envSec);

  // Geometry
  const geoSec = section(t('sec.geo'), t('sec.geo.note'));
  buildGeometryControls(geoSec, state);
  panel.appendChild(geoSec);

  // Frequency response controls
  const fr = state.frequencyResponse;
  const freqU = state.display.freqUnit || 'Hz';
  const frSec = section(t('sec.freq'), t('sec.freq.note'));
  frSec.appendChild(paramRow({
    id: 'fstart',
    label: t('label.startF'),
    unit: freqU,
    value: freqIn(fr.fStart, freqU),
    min: freqIn(1, freqU),
    max: freqIn(100000, freqU),
    step: freqIn(1, freqU),
    onCommit: (v) => store.setFrequencyResponse({ fStart: freqOut(v, freqU) }),
  }).el);
  frSec.appendChild(paramRow({
    id: 'fend',
    label: t('label.stopF'),
    unit: freqU,
    value: freqIn(fr.fEnd, freqU),
    min: freqIn(2, freqU),
    max: freqIn(200000, freqU),
    step: freqIn(1, freqU),
    onCommit: (v) => store.setFrequencyResponse({ fEnd: freqOut(v, freqU) }),
  }).el);
  frSec.appendChild(paramRow({
    id: 'nsamp',
    label: t('label.samples'),
    unit: 'pts',
    value: fr.nSamples,
    min: 50,
    max: 2000,
    step: 10,
    onCommit: (v) => store.setFrequencyResponse({ nSamples: Math.round(v) }),
  }).el);
  frSec.appendChild(selectRow({
    id: 'frscale',
    label: t('label.freqAxis'),
    value: fr.scale,
    options: [{ value: 'log', label: t('label.log') }, { value: 'linear', label: t('label.linear') }],
    onChange: (v) => store.setFrequencyResponse({ scale: v }),
  }).el);
  panel.appendChild(frSec);

  // Damping
  const d = state.damping;
  const dSec = section(t('sec.damp'), t('sec.damp.note'));
  dSec.appendChild(paramRow({
    id: 'qi',
    label: t('label.qIntrinsic'),
    unit: '',
    tooltip: 'Internal losses. Enter measured Q if known.',
    value: d.Qi,
    min: 1,
    max: 1e6,
    step: 1,
    onCommit: (v) => store.setDamping({ Qi: v }),
  }).el);
  dSec.appendChild(paramRow({
    id: 'qe',
    label: t('label.qExternal'),
    unit: '',
    tooltip: 'Radiation / external loading. Use large value if unloaded.',
    value: Number.isFinite(d.Qe) ? d.Qe : 1e6,
    min: 1,
    max: 1e6,
    step: 1,
    onCommit: (v) => store.setDamping({ Qe: v }),
  }).el);
  for (const key of ['includeViscous', 'includeThermal', 'includeRadiation', 'includeLeak', 'includeWall', 'includeExternal']) {
    const row = checkboxRow({
      id: key,
      label: key.replace('include', ''),
      checked: d[key],
      onChange: (v) => store.setDamping({ [key]: v }),
    });
    const unsupported = (key === 'includeRadiation' && state.resonatorType !== 'helmholtz')
      || (key === 'includeWall' && state.resonatorType !== 'rectangular-cavity');
    if (unsupported) {
      row.el.querySelector('input').disabled = true;
      row.el.title = key === 'includeRadiation'
        ? 'Radiation loss estimate is available for Helmholtz necks only.'
        : 'Wall loss estimate is available for rectangular cavities only.';
    }
    dSec.appendChild(row.el);
  }
  dSec.appendChild(paramRow({
    id: 'leak-q', label: 'Leak Q', unit: '',
    tooltip: 'Applied when Leak is checked. A large Q means negligible leakage.',
    value: Number.isFinite(d.leakQ) ? d.leakQ : 1e6, min: 1, max: 1e6, step: 1,
    onCommit: (v) => store.setDamping({ leakQ: v }),
  }).el);
  panel.appendChild(dSec);

  // Inverse design (Helmholtz)
  if (state.resonatorType === 'helmholtz') {
    const inv = state.inverseDesign;
    const invSec = section(t('sec.inv'), t('sec.inv.note'), { collapsed: !state.inverseDesign.enabled });
    invSec.appendChild(checkboxRow({
      id: 'inv-en',
      label: t('label.enableInv'),
      checked: inv.enabled,
      onChange: (v) => store.setInverseDesign({ enabled: v }),
    }).el);
    invSec.appendChild(paramRow({
      id: 'inv-f',
      label: t('label.targetF'),
      unit: freqU,
      value: freqIn(inv.targetF, freqU),
      min: freqIn(1, freqU),
      max: freqIn(20000, freqU),
      step: freqIn(0.1, freqU),
      onCommit: (v) => store.setInverseDesign({ targetF: freqOut(v, freqU) }),
    }).el);
    invSec.appendChild(selectRow({
      id: 'inv-solve',
      label: t('label.solveFor'),
      value: inv.solveFor,
      options: [
        { value: 'volume', label: 'Cavity volume V' },
        { value: 'neckLength', label: 'Neck length L_n' },
        { value: 'neckRadius', label: 'Neck radius a' },
      ],
      onChange: (v) => store.setInverseDesign({ solveFor: v }),
    }).el);
    const invOut = document.createElement('div');
    invOut.id = 'inv-out';
    invOut.className = 'env-out';
    invSec.appendChild(invOut);
    panel.appendChild(invSec);
  }

  // Coupling sweep
  if (state.resonatorType === 'coupled') {
    const cs = state.couplingSweep;
    const cSec = section(t('sec.coup'), t('sec.coup.note'));
    cSec.appendChild(checkboxRow({
      id: 'cs-en',
      label: t('label.showCoupling'),
      checked: cs.enabled,
      onChange: (v) => {
        store.setState({
          couplingSweep: { ...store.get().couplingSweep, enabled: v },
        }, 'coupling');
      },
    }).el);
    cSec.appendChild(paramRow({
      id: 'cmin',
      label: t('label.coupMin'),
      unit: freqU,
      value: freqIn(cs.couplingMin, freqU),
      min: 0,
      max: freqIn(100, freqU),
      step: freqIn(0.1, freqU),
      onCommit: (v) => store.setState({
        couplingSweep: { ...store.get().couplingSweep, couplingMin: freqOut(v, freqU) },
      }, 'coupling'),
    }).el);
    cSec.appendChild(paramRow({
      id: 'cmax',
      label: t('label.coupMax'),
      unit: freqU,
      value: freqIn(cs.couplingMax, freqU),
      min: 0,
      max: freqIn(200, freqU),
      step: freqIn(0.1, freqU),
      onCommit: (v) => store.setState({
        couplingSweep: { ...store.get().couplingSweep, couplingMax: freqOut(v, freqU) },
      }, 'coupling'),
    }).el);
    panel.appendChild(cSec);
  }

  // Scientist analysis controls
  const sci = state.science || {};
  const sciSec = section(t('sec.sci'), t('sec.sci.note'));
  sciSec.appendChild(paramRow({
    id: 'sci-f',
    label: t('label.analysisF'),
    unit: freqU,
    value: freqIn(sci.analysisFreq || 200, freqU),
    min: freqIn(1, freqU),
    max: freqIn(20000, freqU),
    step: freqIn(1, freqU),
    onCommit: (v) => store.setState({
      science: { ...store.get().science, analysisFreq: freqOut(v, freqU) },
    }, 'science'),
  }).el);
  sciSec.appendChild(paramRow({
    id: 'sci-unc',
    label: t('label.geomUnc'),
    unit: '%',
    value: sci.uncertaintyPct ?? 2,
    min: 0.1, max: 20, step: 0.1,
    onCommit: (v) => store.setState({
      science: { ...store.get().science, uncertaintyPct: v },
    }, 'science'),
  }).el);
  sciSec.appendChild(paramRow({
    id: 'sci-mc',
    label: t('label.mcSamples'),
    unit: '',
    value: sci.mcSamples ?? 400,
    min: 50, max: 2000, step: 50,
    onCommit: (v) => store.setState({
      science: { ...store.get().science, mcSamples: Math.round(v) },
    }, 'science'),
  }).el);
  panel.appendChild(sciSec);

  // Sweep controls
  const sweep = sweepSetup(state);
  const sweepKeys = sweep.keys;
  const swSec = section(t('sec.sweep'), t('sec.sweep.note'));
  if (sweepKeys.length) {
    swSec.appendChild(selectRow({
      id: 'sw-param',
      label: t('label.sweepParam'),
      value: sweep.key,
      options: sweepKeys.map((k) => ({ value: k, label: `${SWEEP_PARAMETERS[k][0]} (${SWEEP_PARAMETERS[k][1]})` })),
      onChange: (v) => store.setState({
        science: { ...store.get().science, sweepParam: v, sweepMin: state.geometry[v] * 0.5,
          sweepMax: state.geometry[v] > 0 ? state.geometry[v] * 1.5 : 1 },
      }, 'settings'),
    }).el);
  }
  swSec.appendChild(paramRow({
    id: 'sw-min',
    label: t('label.sweepMin'),
    unit: SWEEP_PARAMETERS[sweep.key]?.[1] || '',
    value: sweep.min ?? 0.3,
    min: -1e6, max: 1e6, step: 0.01,
    onCommit: (v) => store.setState({
      science: { ...store.get().science, sweepParam: sweep.key, sweepMin: v, sweepMax: sweep.max },
    }, 'science'),
  }).el);
  swSec.appendChild(paramRow({
    id: 'sw-max',
    label: t('label.sweepMax'),
    unit: SWEEP_PARAMETERS[sweep.key]?.[1] || '',
    value: sweep.max ?? 2.0,
    min: -1e6, max: 1e6, step: 0.01,
    onCommit: (v) => store.setState({
      science: { ...store.get().science, sweepParam: sweep.key, sweepMin: sweep.min, sweepMax: v },
    }, 'science'),
  }).el);
  swSec.appendChild(paramRow({
    id: 'sw-n',
    label: t('label.sweepSamples'),
    unit: '',
    value: sci.sweepN ?? 48,
    min: 10, max: 200, step: 1,
    onCommit: (v) => store.setState({
      science: { ...store.get().science, sweepN: Math.round(v) },
    }, 'science'),
  }).el);
  panel.appendChild(swSec);

  // Present settings for the active task; keep the complete set one click away.
  const tab = state.display.tab;
  typeBlock.dataset.scope = 'primary'; geoSec.dataset.scope = 'primary';
  unitSec.dataset.scope = 'shared'; envSec.dataset.scope = 'shared';
  frSec.dataset.scope = 'response'; dSec.dataset.scope = 'damping';
  sciSec.dataset.scope = 'science impedance'; swSec.dataset.scope = 'sweeps';
  panel.prepend(typeBlock, geoSec);
  for (const id of ['nmodes', 'selmode']) {
    const row = geoSec.querySelector(`[data-param="${id}"]`);
    if (row) row.hidden = tab !== 'modes' && !state.display.allSettings;
  }
  const context = document.createElement('p');
  context.className = 'setup-context';
  const linkedFem = tab === 'fem' && state.fem.source !== 'rectangle';
  context.textContent = tab === 'fem'
    ? linkedFem ? 'FEM uses the Helmholtz dimensions below. Cavity height/diameter fixes its shape at the specified volume. Changing a dimension rebuilds the mesh.' : 'Rectangle verification is a separate benchmark. Select “Current resonator” to solve your Helmholtz geometry.'
    : tab === 'audio' ? 'The audio tube is a synthetic example. These environment settings set the medium.'
    : MODEL_GUIDES[state.resonatorType] || '';
  panel.prepend(context);
  const all = !!state.display.allSettings;
  for (const sec of [unitSec, envSec]) {
    const collapse = sec === envSec ? tab !== 'fem' : true;
    sec.classList.toggle('collapsed', collapse);
    sec.querySelector('.section-toggle').setAttribute('aria-expanded', String(!collapse));
  }
  for (const sec of panel.querySelectorAll('[data-scope]')) {
    const scope = sec.dataset.scope;
    sec.hidden = (tab === 'fem' || tab === 'audio')
      ? !(scope === 'shared' || (linkedFem && scope === 'primary'))
      : !(scope === 'primary' || scope === 'shared' || scope.split(' ').includes(tab) || all);
  }
  // Inverse/coupling controls only exist for the corresponding model.
  for (const sec of panel.querySelectorAll('.panel-section:not([data-scope])')) {
    sec.hidden = tab === 'fem' || tab === 'audio';
  }
  if (tab === 'fem' && !linkedFem) unitSec.hidden = true;
  const more = button({ label: all ? 'Show settings for this view' : 'Show all settings',
    className: 'btn setup-more', onClick: () => store.setDisplay({ allSettings: !all }, 'settings') });
  more.setAttribute('aria-pressed', String(all));
  more.hidden = tab === 'fem' || tab === 'audio';
  panel.appendChild(more);

  const hint = document.createElement('div');
  hint.id = 'experiment-hint';
  hint.className = 'experiment-hint';
  hint.textContent = store.get().presetExperiment || '';
  panel.appendChild(hint);
}

function section(title, note, opts = {}) {
  const s = document.createElement('section');
  s.className = 'panel-section' + (opts.collapsed ? ' collapsed' : '');
  const h = document.createElement('h3');
  h.className = 'section-head';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'section-toggle';
  toggle.setAttribute('aria-expanded', opts.collapsed ? 'false' : 'true');
  toggle.innerHTML = `<span class="chev" aria-hidden="true"></span><span>${title}</span>`;
  const body = document.createElement('div');
  body.className = 'section-body';
  toggle.addEventListener('click', () => {
    const col = s.classList.toggle('collapsed');
    toggle.setAttribute('aria-expanded', col ? 'false' : 'true');
  });
  h.appendChild(toggle);
  s.appendChild(h);
  if (note) {
    const n = document.createElement('p');
    n.className = 'section-note';
    n.textContent = note;
    body.appendChild(n);
  }
  s.appendChild(body);
  // Route child appends into the body for collapsible UX.
  const nativeAppend = s.appendChild.bind(s);
  s.appendChild = (node) => {
    if (node === h || node === body) return nativeAppend(node);
    return body.appendChild(node);
  };
  return s;
}

/** Convert SI → display length value using current unit. */
function lenIn(meters, unit) {
  return meters / lengthUnitScale(unit);
}

/** Convert display length → SI. */
function lenOut(value, unit) {
  return value * lengthUnitScale(unit);
}

/** Convert SI Hz → display frequency value. */
function freqIn(hz, unit) {
  return hz / freqUnitScale(unit);
}

/** Convert display frequency → SI Hz. */
function freqOut(value, unit) {
  return value * freqUnitScale(unit);
}

function buildGeometryControls(sec, state) {
  const g = state.geometry;
  const type = state.resonatorType;
  const geom = (patch) => store.setGeometry(patch);
  const lenU = state.display.lengthUnit || 'm';
  const freqU = state.display.freqUnit || 'Hz';

  if (type === 'tube' || type === 'custom') {
    sec.appendChild(paramRow({
      id: 'L', label: t('label.L'), unit: lenU,
      tooltip: 'Physical tube length. Resonance uses L_eff when end correction is on.',
      value: lenIn(g.length, lenU), min: lenIn(0.01, lenU), max: lenIn(20, lenU), step: lenIn(0.001, lenU),
      onCommit: (v) => geom({ length: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'D', label: t('label.D'), unit: lenU,
      value: lenIn(g.diameter, lenU), min: lenIn(0.001, lenU), max: lenIn(2, lenU), step: lenIn(0.001, lenU),
      onCommit: (v) => geom({ diameter: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(selectRow({
      id: 'bc', label: t('label.bc'),
      tooltip: 'open-open: nodes at both ends. open-closed: node at open, antinode at closed. closed-closed: antinodes at both ends.',
      value: g.boundary,
      options: [
        { value: 'open-open', label: t('bc.openOpen') },
        { value: 'open-closed', label: t('bc.openClosed') },
        { value: 'closed-closed', label: t('bc.closedClosed') },
      ],
      onChange: (v) => geom({ boundary: v }),
    }).el);
    sec.appendChild(checkboxRow({
      id: 'ec', label: t('label.applyEc'),
      tooltip: 'Rayleigh Δ ≈ 0.6133 a (unflanged) or 0.8216 a (flanged).',
      checked: g.applyEndCorrection,
      onChange: (v) => geom({ applyEndCorrection: v }),
    }).el);
    sec.appendChild(checkboxRow({
      id: 'fl', label: 'Flanged open end',
      checked: g.flanged,
      onChange: (v) => geom({ flanged: v }),
    }).el);
    sec.appendChild(paramRow({
      id: 'nmodes', label: 'Modes to show', unit: '',
      value: g.nModes, min: 1, max: 32, step: 1,
      onCommit: (v) => geom({ nModes: Math.round(v) }),
    }).el);
  } else if (type === 'helmholtz') {
    sec.appendChild(paramRow({
      id: 'V', label: 'Cavity volume V', unit: 'L',
      tooltip: 'Enter volume in litres. 1 L = 0.001 m³.',
      value: g.volume * 1000, min: 0.01, max: 1000, step: 0.01,
      onCommit: (v) => geom({ volume: v / 1000 }),
    }).el);
    sec.appendChild(paramRow({
      id: 'cavity-aspect', label: 'Cavity height / diameter', unit: '',
      tooltip: 'Defines a cylindrical cavity at the specified volume. 1 means height equals diameter. Used by FEM; the lumped formula depends on volume only.',
      value: g.cavityAspectRatio ?? 1, min: 0.1, max: 5, step: 0.05,
      onCommit: (v) => geom({ cavityAspectRatio: v }),
    }).el);
    sec.appendChild(paramRow({
      id: 'nr', label: 'Neck radius a', unit: lenU,
      value: lenIn(g.neckRadius, lenU), min: lenIn(0.001, lenU), max: lenIn(0.5, lenU), step: lenIn(0.001, lenU),
      onCommit: (v) => geom({ neckRadius: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'ln', label: 'Neck length L_n', unit: lenU,
      value: lenIn(g.neckLength, lenU), min: 0, max: lenIn(1, lenU), step: lenIn(0.001, lenU),
      onCommit: (v) => geom({ neckLength: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(selectRow({
      id: 'ecm', label: 'End correction',
      value: g.endCorrectionModel,
      options: [
        { value: 'flanged', label: 'Flanged (0.8216 a)' },
        { value: 'unflanged', label: 'Unflanged (0.6133 a)' },
        { value: 'none', label: 'None' },
      ],
      onChange: (v) => geom({ endCorrectionModel: v }),
    }).el);
    sec.appendChild(paramRow({
      id: 'nn', label: 'Number of necks', unit: '',
      value: g.nNecks, min: 1, max: 8, step: 1,
      onCommit: (v) => geom({ nNecks: Math.round(v) }),
    }).el);
  } else if (type === 'rectangular-cavity') {
    for (const [key, label] of [['Lx', 'Lx'], ['Ly', 'Ly'], ['Lz', 'Lz']]) {
      sec.appendChild(paramRow({
        id: key, label: `${label}`, unit: lenU,
        tooltip: 'Rigid walls: zero normal velocity.',
        value: lenIn(g[key], lenU), min: lenIn(0.05, lenU), max: lenIn(20, lenU), step: lenIn(0.01, lenU),
        onCommit: (v) => geom({ [key]: lenOut(v, lenU) }),
      }).el);
    }
    sec.appendChild(paramRow({
      id: 'mmodes', label: 'Modes to list', unit: '',
      value: g.maxModes, min: 1, max: 40, step: 1,
      onCommit: (v) => geom({ maxModes: Math.round(v) }),
    }).el);
  } else if (type === 'cylindrical-cavity') {
    sec.appendChild(paramRow({
      id: 'ra', label: 'Radius a', unit: lenU,
      value: lenIn(g.radius, lenU), min: lenIn(0.01, lenU), max: lenIn(5, lenU), step: lenIn(0.005, lenU),
      onCommit: (v) => geom({ radius: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'Lc', label: 'Length L', unit: lenU,
      value: lenIn(g.length, lenU), min: lenIn(0.05, lenU), max: lenIn(10, lenU), step: lenIn(0.01, lenU),
      onCommit: (v) => geom({ length: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'mmodes', label: 'Modes to list', unit: '',
      value: g.maxModes, min: 1, max: 40, step: 1,
      onCommit: (v) => geom({ maxModes: Math.round(v) }),
    }).el);
  } else if (type === 'spherical-cavity') {
    sec.appendChild(paramRow({
      id: 'sph-r', label: 'Radius R', unit: lenU,
      tooltip: 'Rigid sphere. f = (c/2πR)·χ_nl with j_l′(χ)=0.',
      value: lenIn(g.radius, lenU), min: lenIn(0.05, lenU), max: lenIn(3, lenU), step: lenIn(0.01, lenU),
      onCommit: (v) => geom({ radius: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'sph-n', label: 'Modes to list', unit: '',
      value: g.maxModes, min: 1, max: 40, step: 1,
      onCommit: (v) => geom({ maxModes: Math.round(v) }),
    }).el);
  } else if (type === 'annular-cavity') {
    sec.appendChild(paramRow({
      id: 'ann-a', label: 'Inner radius a', unit: lenU,
      value: lenIn(g.innerRadius, lenU), min: lenIn(0.01, lenU), max: lenIn(1, lenU), step: lenIn(0.005, lenU),
      onCommit: (v) => geom({ innerRadius: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'ann-b', label: 'Outer radius b', unit: lenU,
      tooltip: 'Must be greater than inner radius a.',
      value: lenIn(g.outerRadius, lenU), min: lenIn(0.02, lenU), max: lenIn(2, lenU), step: lenIn(0.005, lenU),
      onCommit: (v) => geom({ outerRadius: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'ann-L', label: 'Length L', unit: lenU,
      value: lenIn(g.length, lenU), min: lenIn(0.05, lenU), max: lenIn(5, lenU), step: lenIn(0.01, lenU),
      onCommit: (v) => geom({ length: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'ann-n', label: 'Modes to list', unit: '',
      value: g.maxModes, min: 1, max: 40, step: 1,
      onCommit: (v) => geom({ maxModes: Math.round(v) }),
    }).el);
  } else if (type === 'side-branch') {
    sec.appendChild(paramRow({
      id: 'sb-L', label: 'Branch length', unit: lenU,
      value: lenIn(g.branchLength, lenU), min: lenIn(0.02, lenU), max: lenIn(3, lenU), step: lenIn(0.01, lenU),
      onCommit: (v) => geom({ branchLength: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'sb-D', label: 'Branch diameter', unit: lenU,
      value: lenIn(g.diameter, lenU), min: lenIn(0.005, lenU), max: lenIn(0.5, lenU), step: lenIn(0.001, lenU),
      onCommit: (v) => geom({ diameter: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(selectRow({
      id: 'sb-bc', label: 'Stub termination',
      value: g.boundary,
      options: [
        { value: 'quarter-wave', label: 'Quarter-wave (closed–open)' },
        { value: 'half-wave', label: 'Half-wave (open–open)' },
      ],
      onChange: (v) => geom({ boundary: v }),
    }).el);
    sec.appendChild(paramRow({
      id: 'sb-n', label: 'Modes', unit: '',
      value: g.nModes, min: 1, max: 16, step: 1,
      onCommit: (v) => geom({ nModes: Math.round(v) }),
    }).el);
  } else if (type === 'mpp') {
    sec.appendChild(paramRow({
      id: 'mpp-d', label: 'Hole diameter d', unit: lenU,
      tooltip: 'Typical MPP: 0.1–1 mm holes.',
      value: lenIn(g.holeDiameter, lenU), min: lenIn(0.0001, lenU), max: lenIn(0.01, lenU), step: lenIn(0.0001, lenU),
      onCommit: (v) => geom({ holeDiameter: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'mpp-t', label: 'Panel thickness t', unit: lenU,
      value: lenIn(g.panelThickness, lenU), min: lenIn(0.0001, lenU), max: lenIn(0.02, lenU), step: lenIn(0.0001, lenU),
      onCommit: (v) => geom({ panelThickness: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'mpp-s', label: 'Porosity σ', unit: '',
      tooltip: 'Open-area fraction 0–1.',
      value: g.porosity, min: 0.001, max: 0.5, step: 0.001,
      onCommit: (v) => geom({ porosity: v }),
    }).el);
    sec.appendChild(paramRow({
      id: 'mpp-z', label: 'Cavity depth', unit: lenU,
      value: lenIn(g.backedDepth, lenU), min: 0, max: lenIn(0.5, lenU), step: lenIn(0.005, lenU),
      onCommit: (v) => geom({ backedDepth: lenOut(v, lenU) }),
    }).el);
  } else if (type === 'horn') {
    sec.appendChild(selectRow({
      id: 'horn-type', label: 'Horn profile',
      value: g.hornType,
      options: [
        { value: 'exponential', label: 'Exponential' },
        { value: 'conical', label: 'Conical' },
      ],
      onChange: (v) => geom({ hornType: v }),
    }).el);
    sec.appendChild(paramRow({
      id: 'horn-a0', label: 'Throat radius a₀', unit: lenU,
      value: lenIn(g.throatRadius, lenU), min: lenIn(0.005, lenU), max: lenIn(0.5, lenU), step: lenIn(0.001, lenU),
      onCommit: (v) => geom({ throatRadius: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'horn-aL', label: 'Mouth radius a_L', unit: lenU,
      value: lenIn(g.mouthRadius, lenU), min: lenIn(0.01, lenU), max: lenIn(1, lenU), step: lenIn(0.005, lenU),
      onCommit: (v) => geom({ mouthRadius: lenOut(v, lenU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'horn-L', label: 'Length L', unit: lenU,
      value: lenIn(g.length, lenU), min: lenIn(0.05, lenU), max: lenIn(3, lenU), step: lenIn(0.01, lenU),
      onCommit: (v) => geom({ length: lenOut(v, lenU) }),
    }).el);
  } else if (type === 'duct-chain') {
    for (const [i, key] of [[1, 'seg1'], [2, 'seg2'], [3, 'seg3']]) {
      sec.appendChild(paramRow({
        id: `${key}-L`, label: `Segment ${i} length`, unit: lenU,
        value: lenIn(g[`${key}Length`], lenU), min: 0, max: lenIn(2, lenU), step: lenIn(0.01, lenU),
        onCommit: (v) => geom({ [`${key}Length`]: lenOut(v, lenU) }),
      }).el);
      sec.appendChild(paramRow({
        id: `${key}-A`, label: `Segment ${i} area`, unit: 'm²',
        value: g[`${key}Area`], min: 1e-5, max: 0.1, step: 1e-5,
        onCommit: (v) => geom({ [`${key}Area`]: v }),
      }).el);
    }
    sec.appendChild(paramRow({
      id: 'dc-loss', label: 'Loss (Np/m)', unit: '',
      tooltip: 'Amplitude attenuation per metre (engineering).',
      value: g.lossNp_per_m, min: 0, max: 2, step: 0.01,
      onCommit: (v) => geom({ lossNp_per_m: v }),
    }).el);
  } else if (type === 'coupled') {
    sec.appendChild(paramRow({
      id: 'f1', label: 'Uncoupled f₁', unit: freqU,
      value: freqIn(g.f1, freqU), min: freqIn(1, freqU), max: freqIn(20000, freqU), step: freqIn(0.1, freqU),
      onCommit: (v) => geom({ f1: freqOut(v, freqU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'f2', label: 'Uncoupled f₂', unit: freqU,
      value: freqIn(g.f2, freqU), min: freqIn(1, freqU), max: freqIn(20000, freqU), step: freqIn(0.1, freqU),
      onCommit: (v) => geom({ f2: freqOut(v, freqU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'k', label: 'Coupling Δc', unit: freqU,
      tooltip: 'Half the splitting at degeneracy: Δf = 2 Δc. Phenomenological κ — not automatically a geometric dimension.',
      value: freqIn(g.couplingHz, freqU), min: 0, max: freqIn(500, freqU), step: freqIn(0.05, freqU),
      onCommit: (v) => geom({ couplingHz: freqOut(v, freqU) }),
    }).el);
    sec.appendChild(paramRow({
      id: 'q1', label: 'Q₁', unit: '',
      value: g.Q1, min: 1, max: 1e5, step: 1,
      onCommit: (v) => geom({ Q1: v }),
    }).el);
    sec.appendChild(paramRow({
      id: 'q2', label: 'Q₂', unit: '',
      value: g.Q2, min: 1, max: 1e5, step: 1,
      onCommit: (v) => geom({ Q2: v }),
    }).el);
  }

  // Mode selection for visualization (tubes and cavities)
  if (['tube', 'custom', 'rectangular-cavity', 'cylindrical-cavity'].includes(type)) {
    const nAvail = type === 'tube' || type === 'custom'
      ? (g.nModes || 8)
      : (g.maxModes || 12);
    const sel = Math.min(Math.max(1, state.display.selectedMode || 1), nAvail);
    sec.appendChild(paramRow({
      id: 'selmode', label: 'Visualize mode #', unit: '',
      tooltip: '1-based index of the mode drawn in the canvas / mode-shape plot.',
      value: sel, min: 1, max: nAvail, step: 1,
      onCommit: (v) => store.setDisplay({ selectedMode: Math.round(v) }, 'mode'),
    }).el);
  }
}

function recompute(force) {
  const state = store.get();
  let env;
  try {
    env = environmentFromState(state);
  } catch (err) {
    showError(err.message);
    return { summary: [], modes: [], primary: null, assumptions: [], warnings: [err.message], env: null, state };
  }

  // env panel
  const envOut = $('#env-out');
  if (envOut) {
    envOut.innerHTML = `
      <div class="kv"><span>ρ</span><b>${env.rho.toFixed(4)} kg/m³</b></div>
      <div class="kv"><span>c</span><b>${env.c.toFixed(3)} m/s</b></div>
      <div class="kv"><span>c linear</span><b>${env.cLinearValue.toFixed(3)} m/s</b><em>${env.cLinearModel}</em></div>
      <div class="kv"><span>μ</span><b>${env.mu.toExponential(3)} Pa·s</b></div>
      <div class="kv"><span>γ</span><b>${env.gamma}</b></div>
      <div class="kv"><span>Z₀</span><b>${env.Z0.toFixed(2)} Pa·s/m</b></div>
    `;
  }

  // A valid geometry FEM aperture can have no valid lumped neck length.
  // Solve the linked geometry independently of the primary analytical model.
  const geometryFem = state.display.tab === 'fem' && state.fem.source !== 'rectangle';
  let results = geometryFem
    ? { summary: [], modes: [], primary: null, assumptions: [], warnings: [], damping: null, env, state }
    : computeResults(state, env);
  lastResults = results;

  updateInverseDesign(state, env);
  renderWorkspace(state, env, results);
  renderResults(state, env, results);
  if (state.display.tab !== 'fem') renderScience(state, env, results);
  renderStudyGuide($('#study-guide'), state, { navigate: navigateStudy, editSettings: editStudySettings,
    help: openHelp, startExample: startStudyExample, startApplication, library: openToolLibrary });
  const current = $('#guide-current');
  if (current) {
    if (state.display.tab === 'fem') {
      const mode = lastFemStudy?.result?.modes[lastFemStudy.selectedMode - 1];
      current.textContent = mode && !lastFemStudy.error ? `Current FEM field: Mode ${lastFemStudy.selectedMode} · ${mode.f.toFixed(2)} Hz` : '';
    } else if (state.display.tab !== 'audio' && Number.isFinite(results.modes[0]?.f)) {
      const label = ['horn', 'mpp', 'duct-chain'].includes(state.resonatorType) ? 'Analysis / characteristic frequency' : 'Your first resonance';
      current.textContent = `${label}: ${(results.modes[0].f / freqUnitScale(state.display.freqUnit)).toFixed(2)} ${state.display.freqUnit}`;
    } else current.textContent = '';
  }
  $$('.tab[data-tab]').forEach((button) => {
    const active = button.dataset.tab === state.display.tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const other = $('#current-tool');
  if (other) {
    other.hidden = ['geometry', 'modes', 'response', 'damping', 'fem'].includes(state.display.tab);
    other.textContent = guideFor(state.display.tab).title;
    other.onclick = openToolLibrary;
    other.title = 'Current tool. Open the tool library to change it.';
  }
  return results;
}

function renderScience(state, env, results) {
  const box = $('#science-area');
  if (!box) return;
  const g = state.geometry;
  const sci = state.science || {};
  const f = sci.analysisFreq || results.modes[0]?.f || 200;
  const c = env.c;
  const parts = [];

  try {
    // Dimensionless groups
    const radius = g.diameter ? g.diameter / 2 : g.neckRadius || g.radius || g.outerRadius || 0.05;
    const length = g.length || g.branchLength || g.panelThickness || 0.5;
    const volume = g.volume || (g.Lx ? g.Lx * g.Ly * g.Lz : null)
      || (g.radius && g.length ? Math.PI * g.radius ** 2 * g.length : null)
      || (g.radius ? (4 / 3) * Math.PI * g.radius ** 3 : null);
    const grp = dimensionlessGroups({ f, c, length, radius, volume, rho: env.rho, mu: env.mu });

    parts.push('<div class="result-section-title">Dimensionless groups @ analysis frequency</div>');
    parts.push('<table class="result-table"><tbody>');
    parts.push(`<tr><th>f analysis</th><td class="mono">${f.toFixed(2)} Hz</td></tr>`);
    parts.push(`<tr><th>k a</th><td class="mono">${grp.ka != null ? grp.ka.toFixed(4) : '—'}</td></tr>`);
    parts.push(`<tr><th>k L</th><td class="mono">${grp.kL != null ? grp.kL.toFixed(4) : '—'}</td></tr>`);
    parts.push(`<tr><th>λ / ∛V</th><td class="mono">${grp.lambdaOverCbrtV != null ? grp.lambdaOverCbrtV.toFixed(2) : '—'}</td></tr>`);
    parts.push(`<tr><th>δ_v / a</th><td class="mono">${grp.deltaOverA != null ? grp.deltaOverA.toFixed(5) : '—'}</td></tr>`);
    parts.push(`<tr><th>Stokes a/δ_v</th><td class="mono">${grp.StokesNumber != null ? grp.StokesNumber.toFixed(2) : '—'}</td></tr>`);
    parts.push(`<tr><th>δ_v</th><td class="mono">${(grp.delta_v * 1e6).toFixed(1)} µm</td></tr>`);
    parts.push(`<tr><th>δ_t</th><td class="mono">${(grp.delta_t * 1e6).toFixed(1)} µm</td></tr>`);
    parts.push('</tbody></table>');

    // Thermoviscous duct correction
    try {
      const tv = thermoviscousDuct({ f, rho: env.rho, mu: env.mu, gamma: env.gamma, Pr: env.Pr, c, radius });
      parts.push('<div class="result-section-title">Thermoviscous duct (Zwikker–Kosten-type)</div>');
      parts.push('<table class="result-table"><tbody>');
      parts.push(`<tr><th>c_eff</th><td class="mono">${tv.cEff.toFixed(3)} m/s</td></tr>`);
      parts.push(`<tr><th>α</th><td class="mono">${tv.alpha_dB_per_m.toFixed(4)} dB/m</td></tr>`);
      parts.push(`<tr><th>k complex</th><td class="mono">${tv.kComplex.re.toFixed(4)} + j${tv.kComplex.im.toFixed(5)}</td></tr>`);
      parts.push(`<tr><th>R_s</th><td class="mono">${tv.Rs.toExponential(3)}</td></tr>`);
      parts.push('</tbody></table>');
    } catch { /* optional */ }

    // Impedance
    if (results.modes[0]?.f) {
      const f0 = results.modes[0].f;
      const Q = results.damping?.Q || 30;
      if (state.resonatorType === 'helmholtz' && g.volume && g.neckRadius) {
        const A = Math.PI * g.neckRadius ** 2 * (g.nNecks || 1);
        const Le = g.neckLength + (g.endCorrectionModel === 'none' ? 0 : (g.endCorrectionModel === 'unflanged' ? 0.6133 : 0.8216) * g.neckRadius);
        const Z = helmholtzImpedance({ f, f0, rho: env.rho, c, volume: g.volume, neckArea: A, L_eff: Le, Q });
        parts.push('<div class="result-section-title">Neck impedance (lumped)</div>');
        parts.push('<table class="result-table"><tbody>');
        parts.push(`<tr><th>|Z|</th><td class="mono">${Z.Zmag.toFixed(3)} Pa·s/m³</td></tr>`);
        parts.push(`<tr><th>Re Z</th><td class="mono">${Z.Z.re.toFixed(4)}</td></tr>`);
        parts.push(`<tr><th>Im Z</th><td class="mono">${Z.Z.im.toFixed(4)}</td></tr>`);
        parts.push(`<tr><th>φ</th><td class="mono">${(Z.phaseRad * 180 / Math.PI).toFixed(2)}°</td></tr>`);
        parts.push('</tbody></table>');
      }

      // Sensitivity of primary f to key geometric parameters
      const keys = [];
      if (g.length != null) keys.push('length');
      if (g.diameter != null) keys.push('diameter');
      if (g.volume != null) keys.push('volume');
      if (g.neckRadius != null) keys.push('neckRadius');
      if (g.neckLength != null) keys.push('neckLength');
      if (g.radius != null) keys.push('radius');
      if (g.Lx != null) keys.push('Lx');
      if (g.f1 != null) keys.push('f1');
      if (g.couplingHz != null) keys.push('couplingHz');

      if (keys.length) {
        const modelFn = (p) => {
          const st = {
            ...state,
            geometry: { ...g, ...p },
          };
          const r = computeResults(st, env);
          return r.modes[0]?.f ?? NaN;
        };
        const sens = sensitivity(modelFn, g, keys, 1e-3);
        const sigmas = {};
        const pct = (sci.uncertaintyPct ?? 2) / 100;
        for (const k of keys) sigmas[k] = Math.abs(g[k] || 0) * pct;
        const unc = propagateUncertainty(sens.sensitivities, sigmas);

        parts.push('<div class="result-section-title">Sensitivity ∂f/∂p (first-order)</div>');
        parts.push('<div class="table-scroll"><table class="result-table modes"><thead><tr><th>Parameter</th><th>∂f/∂p</th><th>Elasticity</th></tr></thead><tbody>');
        for (const k of keys) {
          const s = sens.sensitivities[k];
          if (!s) continue;
          parts.push(`<tr><td>${escapeHtml(k)}</td><td class="mono">${s.dYdP.toExponential(3)}</td><td class="mono">${Number.isFinite(s.elasticity) ? s.elasticity.toFixed(3) : '—'}</td></tr>`);
        }
        parts.push('</tbody></table></div>');
        parts.push(`<div class="kv" style="margin-top:8px"><span>σ_f from ${sci.uncertaintyPct ?? 2}% geometry uncertainty</span><b class="mono">${unc.sigmaY.toFixed(3)} Hz</b></div>`);
      }

      // Weyl mode count for cavities
      if (volume && (state.resonatorType.includes('cavity'))) {
        let S = 0;
        if (g.Lx) S = 2 * (g.Lx * g.Ly + g.Lx * g.Lz + g.Ly * g.Lz);
        else if (g.radius && g.length) S = 2 * Math.PI * g.radius * g.length + 2 * Math.PI * g.radius ** 2;
        else if (g.radius) S = 4 * Math.PI * g.radius ** 2;
        if (S > 0) {
          const weyl = weylModeCount({ f, c, volume, surfaceArea: S });
          parts.push('<div class="result-section-title">Weyl asymptotic mode density</div>');
          parts.push('<table class="result-table"><tbody>');
          parts.push(`<tr><th>N(f) cumulative</th><td class="mono">${weyl.cumulativeModes.toFixed(1)}</td></tr>`);
          parts.push(`<tr><th>dN/df</th><td class="mono">${weyl.densityPerHz.toFixed(4)} /Hz</td></tr>`);
          parts.push('</tbody></table>');
        }
      }
    }
  } catch (err) {
    parts.push(`<div class="warn-box">${escapeHtml(err.message)}</div>`);
  }

  // Complex poles summary
  try {
    if (results.modes?.length) {
      const Q = Number.isFinite(results.damping?.Q) ? results.damping.Q : 40;
      const poles = poleSet(results.modes.slice(0, 5), Q);
      parts.push('<div class="result-section-title">Complex poles (first modes)</div>');
      parts.push('<table class="result-table"><tbody>');
      for (const p of poles.slice(0, 5)) {
        parts.push(`<tr><th>${escapeHtml(p.label)}</th><td class="mono">f_d = ${p.fDamped.toFixed(2)} Hz · σ = ${p.sigma.toFixed(3)} s⁻¹</td></tr>`);
      }
      parts.push('</tbody></table>');
      parts.push(`<p class="note">s = −σ + jω_d with σ = ω₀/(2Q), Q ≈ ${Q.toFixed(1)}</p>`);
    }
  } catch { /* optional */ }

  // Equations
  parts.push('<div class="result-section-title">Active model equations</div><ul class="assump">');
  if (state.resonatorType === 'tube') {
    parts.push('<li>f_n = n c / (2 L_eff)  or  (2n−1) c / (4 L_eff)</li>');
    parts.push('<li>L_eff = L + Σ Δ,  Δ ≈ 0.6133 a (unflanged) / 0.8216 a (flanged)</li>');
  } else if (state.resonatorType === 'helmholtz') {
    parts.push('<li>f₀ = (c/2π) √(A / (V L_eff)),  L_eff = L_n + Δ</li>');
    parts.push('<li>Z = R + j(ω M_a − 1/(ω C_a)),  M_a = ρ L_eff/A,  C_a = V/(ρ c²)</li>');
  } else if (state.resonatorType.includes('cavity')) {
    parts.push('<li>Rigid-wall eigenfrequencies from separation of variables</li>');
    parts.push('<li>Cylindrical / annular / spherical use numerical Bessel roots</li>');
  } else if (state.resonatorType === 'duct-chain') {
    parts.push('<li>[p₁;U₁] = T₁ T₂ T₃ [p₂;U₂]</li>');
    parts.push('<li>T = [[cos kL, jZ₀ sin kL],[j sin kL / Z₀, cos kL]]</li>');
  } else if (state.resonatorType === 'mpp') {
    parts.push('<li>Z_MPP ≈ R_v + j(ωρ t/σ · (1+1/√(9+kn²/2)) + 0.85 ωρ a/σ)</li>');
  } else if (state.resonatorType === 'horn') {
    parts.push('<li>Exponential: f_c = (c/2π)·m, m = ln(a_L/a₀)/L</li>');
  } else if (state.resonatorType === 'coupled') {
    parts.push('<li>f± = ½(f₁+f₂) ± ½√[(f₁−f₂)² + 4 Δc²]</li>');
  }
  parts.push('<li>1/Q_L = Σ 1/Q_k,  Δf = f₀/Q,  τ_A = Q/(π f₀)</li>');
  parts.push('</ul>');

  box.innerHTML = parts.join('') || '<p class="note">No scientific metrics for this model.</p>';
}

function updateInverseDesign(state, env) {
  const box = $('#inv-out');
  if (!box) return;
  const inv = state.inverseDesign;
  if (!inv?.enabled) {
    box.innerHTML = '<div class="note">Enable inverse design to solve for one parameter.</div>';
    return;
  }
  try {
    const g = state.geometry;
    const res = helmholtzInverseDesign({
      targetF: inv.targetF,
      solveFor: inv.solveFor,
      c: env.c,
      rho: env.rho,
      neckRadius: g.neckRadius,
      neckLength: g.neckLength,
      volume: g.volume,
      endCorrectionModel: g.endCorrectionModel,
      nNecks: g.nNecks,
    });
    // Validate by substituting back into the forward equation
    const check = helmholtzResonance({
      neckRadius: res.result.neckRadius ?? g.neckRadius,
      neckLength: res.result.neckLength ?? g.neckLength,
      volume: res.result.volume ?? g.volume,
      c: env.c,
      rho: env.rho,
      endCorrectionModel: g.endCorrectionModel,
      nNecks: g.nNecks,
    });
    const errHz = Math.abs(check.f0 - inv.targetF);
    const lenU = state.display.lengthUnit || 'm';
    const lines = [];
    lines.push(`<div class="kv"><span>Target</span><b>${inv.targetF.toFixed(3)} Hz</b></div>`);
    if (res.volume != null) {
      lines.push(`<div class="kv"><span>Solved V</span><b>${(res.volume * 1e3).toFixed(4)} L</b><em>${res.volume.toExponential(4)} m³</em></div>`);
    }
    if (res.neckLength != null) {
      const cm = res.neckLength * 100;
      lines.push(`<div class="kv"><span>Solved L_n</span><b>${cm.toFixed(3)} cm</b><em>${res.neckLength.toFixed(5)} m</em></div>`);
      if (res.warning) lines.push(`<div class="warn-box">${escapeHtml(res.warning)}</div>`);
    }
    if (res.neckRadius != null) {
      const mm = res.neckRadius * 1000;
      lines.push(`<div class="kv"><span>Solved a</span><b>${mm.toFixed(3)} mm</b><em>${res.neckRadius.toFixed(5)} m</em></div>`);
    }
    lines.push(`<div class="kv"><span>Check f₀</span><b>${check.f0.toFixed(4)} Hz</b><em>Δ = ${errHz.toExponential(2)} Hz</em></div>`);
    lines.push(`<div class="note">Forward-equation check: ${errHz < 1e-6 * inv.targetF + 1e-6 ? 'pass' : 'review'} · ${escapeHtml(res.formula)}</div>`);
    const applyKey = inv.solveFor;
    const applyVal = res.result[applyKey];
    if (applyVal != null && Number.isFinite(applyVal)) {
      lines.push(`<button type="button" class="btn btn-secondary" id="inv-apply">Apply to geometry</button>`);
    }
    box.innerHTML = lines.join('');
    const applyBtn = $('#inv-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const patch = {};
        if (applyKey === 'volume') patch.volume = applyVal;
        if (applyKey === 'neckLength') patch.neckLength = applyVal;
        if (applyKey === 'neckRadius') patch.neckRadius = applyVal;
        store.setGeometry(patch);
        flashMessage($('#status'), `Applied inverse ${applyKey} = ${applyVal}`);
      });
    }
  } catch (err) {
    box.innerHTML = `<div class="warn-box">${escapeHtml(err.message)}</div>`;
  }
}

function computeResults(state, env) {
  const g = state.geometry;
  const c = env.c;
  const assumptions = [];
  const summary = geometrySummary(state, env);
  let modes = [];
  let primary = null;
  let warnings = [];

  try {
    if (state.resonatorType === 'tube' || state.resonatorType === 'custom') {
      const r = tubeFrequencies({
        L: g.length,
        c,
        radius: g.diameter / 2,
        boundary: g.boundary,
        nModes: g.nModes,
        applyEndCorrection: g.applyEndCorrection,
        flanged: g.flanged,
      });
      assumptions.push(...r.assumptions);
      modes = r.modes.map((m, i) => {
        const shape = sampleTubeMode({ L: g.length, boundary: g.boundary, n: m.n, nSamples: 81 });
        return { ...m, nodes: shape.nodes, antinodes: shape.antinodes, index: i };
      });
      primary = r;
      summary.push({ k: 'f₁', v: `${r.modes[0].f.toFixed(3)} Hz`, note: r.formula });
    } else if (state.resonatorType === 'helmholtz') {
      const r = helmholtzResonance({
        neckRadius: g.neckRadius,
        neckLength: g.neckLength,
        volume: g.volume,
        c,
        rho: env.rho,
        endCorrectionModel: g.endCorrectionModel,
        nNecks: g.nNecks,
      });
      assumptions.push(...r.assumptions);
      primary = r;
      const q = helmholtzQEstimate({
        f0: r.f0, rho: env.rho, c, volume: g.volume,
        neckRadius: g.neckRadius, neckLength: g.neckLength, L_eff: r.L_eff,
      });
      r.QEstimate = q;
      summary.push({ k: 'f₀', v: `${r.f0.toFixed(3)} Hz`, note: r.formula });
      summary.push({ k: 'λ₀', v: `${(c / r.f0).toFixed(4)} m`, note: 'wavelength at resonance' });
      summary.push({ k: 'Q_est', v: q.Q.toFixed(1), note: q.model });
      try {
        const shape = helmholtzFemGeometry(g);
        summary.push({ k: 'Cavity radius', v: `${(shape.radius * 1000).toFixed(2)} mm`, note: 'Cylindrical shape used by FEM' });
        summary.push({ k: 'Cavity height', v: `${(shape.height * 1000).toFixed(2)} mm`, note: `Height/diameter = ${shape.cavityAspectRatio}` });
      } catch { /* Unsupported FEM shapes still have analytical results. */ }
      if (r.validity.lambdaOverCavity < 10) {
        warnings.push(`Lumped validity caution: λ/cbrt(V) ≈ ${r.validity.lambdaOverCavity.toFixed(1)} (prefer ≳ 10).`);
      }
      modes = [{ n: 1, f: r.f0, lambda: c / r.f0, label: 'Helmholtz f₀', harmonic: 1 }];
    } else if (state.resonatorType === 'rectangular-cavity') {
      const r = rectangularModes({
        Lx: g.Lx, Ly: g.Ly, Lz: g.Lz, c,
        maxModes: g.maxModes, lMax: g.lMax, mMax: g.mMax, nMax: g.nMax,
      });
      assumptions.push(...r.assumptions);
      primary = r;
      modes = r.modes.map((m, i) => ({ ...m, index: i, lambda: m.f > 0 ? c / m.f : Infinity }));
      summary.push({ k: 'Lowest mode', v: `${modes[0]?.f.toFixed(3)} Hz`, note: modes[0]?.label });
    } else if (state.resonatorType === 'cylindrical-cavity') {
      const r = cylindricalModes({
        radius: g.radius, length: g.length, c,
        maxModes: g.maxModes, mMax: g.mMax, pMax: g.pMax, radialRoots: g.radialRoots,
      });
      assumptions.push(...r.assumptions);
      primary = r;
      modes = r.modes.map((m, i) => ({ ...m, index: i, lambda: m.f > 0 ? c / m.f : Infinity }));
      summary.push({ k: 'Lowest mode', v: `${modes[0]?.f.toFixed(3)} Hz`, note: modes[0]?.label });
      summary.push({ k: 'χ′₀₁', v: chiPrime(0, 1).toFixed(6), note: "J′₀ first root" });
    } else if (state.resonatorType === 'spherical-cavity') {
      const r = sphericalModes({
        radius: g.radius, c, maxModes: g.maxModes, lMax: g.lMax, nMax: g.nMax,
      });
      assumptions.push(...r.assumptions);
      primary = r;
      modes = r.modes.map((m, i) => ({ ...m, index: i, lambda: m.f > 0 ? c / m.f : Infinity }));
      summary.push({ k: 'Lowest mode', v: `${modes[0]?.f.toFixed(3)} Hz`, note: modes[0]?.label });
      summary.push({ k: 'Degeneracy', v: `${modes[0]?.degeneracy ?? 1}`, note: '2l+1 for each (n,l)' });
    } else if (state.resonatorType === 'annular-cavity') {
      const r = annularCavityModes({
        innerRadius: g.innerRadius, outerRadius: g.outerRadius, length: g.length, c,
        maxModes: g.maxModes, mMax: g.mMax, pMax: g.pMax, nRoots: g.nRoots,
      });
      assumptions.push(...r.assumptions);
      primary = r;
      modes = r.modes.map((m, i) => ({ ...m, index: i, lambda: m.f > 0 ? c / m.f : Infinity }));
      summary.push({ k: 'Lowest mode', v: `${modes[0]?.f.toFixed(3)} Hz`, note: modes[0]?.label });
      summary.push({ k: 'Gap b−a', v: `${(g.outerRadius - g.innerRadius).toFixed(4)} m`, note: 'annulus width' });
    } else if (state.resonatorType === 'side-branch') {
      const r = sideBranchModes({
        branchLength: g.branchLength, c, nModes: g.nModes, boundary: g.boundary,
      });
      assumptions.push(...r.assumptions);
      primary = r;
      modes = r.modes.map((m, i) => ({ ...m, index: i }));
      summary.push({ k: 'First stub mode', v: `${modes[0]?.f.toFixed(3)} Hz`, note: r.formula });
    } else if (state.resonatorType === 'mpp') {
      const fSci = state.science?.analysisFreq || 200;
      const z = mppImpedance({
        holeDiameter: g.holeDiameter, panelThickness: g.panelThickness,
        porosity: g.porosity, f: fSci, rho: env.rho, mu: env.mu, c,
      });
      assumptions.push(...z.assumptions);
      primary = z;
      modes = [{ n: 1, f: fSci, lambda: c / fSci, label: `MPP @ ${fSci} Hz`, harmonic: 1 }];
      summary.push({ k: '|Z|', v: `${z.Zmag.toFixed(2)} Pa·s/m³`, note: z.model });
      summary.push({ k: 'Re Z', v: `${z.Z.re.toFixed(3)}`, note: 'resistive' });
      summary.push({ k: 'Im Z', v: `${z.Z.im.toFixed(3)}`, note: 'reactive' });
      summary.push({ k: 'kn = a/δ_v', v: `${z.kn.toFixed(2)}`, note: 'shear number' });
    } else if (state.resonatorType === 'horn') {
      const fSci = state.science?.analysisFreq || 200;
      const r = g.hornType === 'conical'
        ? conicalHorn({ throatRadius: g.throatRadius, mouthRadius: g.mouthRadius, length: g.length, f: fSci, c, rho: env.rho })
        : exponentialHorn({ throatRadius: g.throatRadius, mouthRadius: g.mouthRadius, length: g.length, f: fSci, c, rho: env.rho });
      assumptions.push(...r.assumptions);
      primary = r;
      const fc = r.cutoffHz ?? r.cutoffApprox ?? null;
      modes = [{ n: 1, f: fc ?? fSci, lambda: c / (fc ?? fSci), label: g.hornType === 'conical' ? 'cone estimate' : 'exponential cutoff', harmonic: 1 }];
      if (fc != null) summary.push({ k: 'Cutoff f_c', v: `${fc.toFixed(2)} Hz`, note: r.model });
      summary.push({ k: 'Z_in', v: `${r.Zin.re.toFixed(1)}`, note: `Zc = ${r.Zc.toFixed(1)} Pa·s/m³` });
      summary.push({ k: 'kL', v: `${r.kL.toFixed(3)}`, note: 'electrical length' });
    } else if (state.resonatorType === 'duct-chain') {
      const fSci = state.science?.analysisFreq || 200;
      const mats = [
        ductTransferMatrix({ f: fSci, length: g.seg1Length, area: g.seg1Area, c, rho: env.rho, lossNp_per_m: g.lossNp_per_m }),
        ductTransferMatrix({ f: fSci, length: g.seg2Length, area: g.seg2Area, c, rho: env.rho, lossNp_per_m: g.lossNp_per_m }),
        ductTransferMatrix({ f: fSci, length: g.seg3Length, area: g.seg3Area, c, rho: env.rho, lossNp_per_m: g.lossNp_per_m }),
      ];
      const T = chainTransferMatrices(mats);
      assumptions.push(...mats[0].assumptions);
      primary = { T, f: fSci, mats };
      const mag = Math.hypot(T.A.re, T.A.im);
      modes = [{ n: 1, f: fSci, lambda: c / fSci, label: `chain @ ${fSci} Hz`, harmonic: 1 }];
      summary.push({ k: '|A|', v: mag.toFixed(4), note: 'transfer matrix element' });
      summary.push({ k: 'Z₀ seg2', v: `${mats[1].Z0.toFixed(1)}`, note: 'characteristic impedance' });
      summary.push({ k: 'Total L', v: `${(g.seg1Length + g.seg2Length + g.seg3Length).toFixed(3)} m`, note: 'axial length' });
    } else if (state.resonatorType === 'coupled') {
      const r = coupledTwoMode({
        f1: g.f1, f2: g.f2, couplingHz: g.couplingHz, Q1: g.Q1, Q2: g.Q2,
      });
      assumptions.push(...r.assumptions);
      primary = r;
      modes = [
        { n: 1, f: r.fMinus, label: 'f− (coupled)', lambda: c / r.fMinus },
        { n: 2, f: r.fPlus, label: 'f+ (coupled)', lambda: c / r.fPlus },
      ];
      summary.push({ k: 'f−', v: `${r.fMinus.toFixed(3)} Hz`, note: 'lower eigenmode' });
      summary.push({ k: 'f+', v: `${r.fPlus.toFixed(3)} Hz`, note: 'upper eigenmode' });
      summary.push({ k: 'Mode splitting', v: `${r.modeSplitting.toFixed(3)} Hz`, note: 'f+ − f−' });
    }
  } catch (err) {
    showError(err.message);
    return { summary, modes: [], primary: null, assumptions, warnings: [err.message], damping: null, env, state };
  }

  // Damping
  const d = state.damping;
  const f0 = modes[0]?.f ?? 100;
  const extra = [];
  if (d.includeViscous || d.includeThermal) {
    try {
      const radius = state.resonatorType === 'tube' ? g.diameter / 2 : (g.neckRadius || g.radius || 0.02);
      const tv = tubeViscousQ({ a: radius, f: f0, rho: env.rho, mu: env.mu, gamma: env.gamma, c });
      if (d.includeViscous) extra.push({ name: 'viscous (est.)', Q: tv.Q_viscous });
      if (d.includeThermal) extra.push({ name: 'thermal (est.)', Q: tv.Q_thermal });
    } catch { /* ignore estimate failure */ }
  }
  if (d.includeWall && state.resonatorType === 'rectangular-cavity') {
    const cq = cavityWallQ({ Lx: g.Lx, Ly: g.Ly, Lz: g.Lz, f: f0, rho: env.rho, mu: env.mu, c });
    extra.push({ name: 'wall (est.)', Q: cq.Q });
  }
  if (d.includeRadiation && state.resonatorType === 'helmholtz' && primary?.L_eff) {
    const rad = radiationQ({ f: f0, rho: env.rho, c, neckRadius: g.neckRadius, L_eff: primary.L_eff });
    extra.push({ name: 'radiation (est., independent necks)', Q: rad.Q_rad });
  }
  if (d.includeLeak && Number.isFinite(d.leakQ)) extra.push({ name: 'leak', Q: d.leakQ });
  const mech = [];
  if (Number.isFinite(d.Qi)) mech.push({ name: 'intrinsic Q_i', Q: d.Qi });
  if (d.includeExternal && Number.isFinite(d.Qe)) mech.push({ name: 'external Q_e', Q: d.Qe });
  mech.push(...extra);
  const damp = dampingReport({
    f0,
    QInternal: d.Qi,
    QExternal: d.includeExternal ? d.Qe : Infinity,
    QExtra: extra,
  });
  damp.mechanisms = mech.length ? mech : damp.mechanisms;

  return {
    summary,
    modes,
    primary,
    assumptions,
    warnings,
    damping: damp,
    env,
    state,
  };
}

function renderWorkspace(state, env, results) {
  cancelFemJob();
  // Re-rendering removes Audio Tube's Stop control, so release capture first.
  if (activeMicCapture) {
    activeMicCapture.stop();
    activeMicCapture = null;
  }
  const tab = state.display.tab;
  const context = $('#model-context');
  document.body.dataset.studyTab=tab;
  if (context) {
    const fem=tab==='fem',rectangle=fem&&state.fem.source==='rectangle';
    context.textContent=rectangle?'ACTIVE MODEL · Rigid rectangle FEM verification · independent of your resonator'
      :fem?'ACTIVE MODEL · Geometry-linked axisymmetric FEM · isolated response and explicitly mounted application results'
      :'ACTIVE MODEL · Analytical / lumped study · separate from the geometry-linked FEM solver';
  }
  const geoBox = $('#geo-svg');
  const geoCard = $('#geo-card');
  const canvas = $('#main-canvas');
  const canvasCard = $('#canvas-card');
  const plotEl = $('#plot-area');
  if (plotEl) $$('.js-plotly-plot', plotEl).forEach(disposePlot);
  const plotCard = $('#plot-card');
  const phaseWrap = $('#phase-wrap');
  const plotBadge = $('#plot-badge');
  const geoBadge = $('#geo-badge');

  const showGeo = tab === 'geometry' || tab === 'modes';
  const showCanvas = tab === 'modes' && ['tube', 'custom', 'helmholtz', 'rectangular-cavity', 'cylindrical-cavity'].includes(state.resonatorType);
  const showPlot = tab !== 'geometry';
  const showPhase = tab === 'geometry' || tab === 'modes';
  const showScience = tab === 'science' || tab === 'sweeps' || tab === 'impedance' || tab === 'geometry';

  if (geoCard) geoCard.hidden = !showGeo;
  if (canvasCard) canvasCard.hidden = !showCanvas;
  if (plotCard) plotCard.hidden = !showPlot;
  const scienceCard = $('#science-card');
  if (scienceCard) scienceCard.hidden = !(tab === 'science' || tab === 'impedance');

  if (geoBadge) {
    geoBadge.textContent = state.resonatorType.replace(/-/g, ' ');
  }
  if (plotBadge) {
    const labels = {
      modes: 'spectrum + mode shape',
      response: 'frequency response',
      damping: 'loss mechanisms',
      coupling: 'eigenmodes / sweep',
      science: 'poles · sensitivity · uncertainty',
      sweeps: 'parameter sweep',
      impedance: 'impedance · tube simulation',
      geometry: 'plots',
    };
    plotBadge.textContent = labels[tab] || 'plots';
  }
  void showScience;

  if (geoBox) {
    geoBox.innerHTML = geometrySVG(state, env);
  }

  if (phaseWrap) phaseWrap.hidden = !showPhase;

  if (plotEl && showPlot) {
    plotEl.innerHTML = '';
    const div = document.createElement('div');
    div.id = 'plotly-host';
    div.style.width = '100%';
    // Multi-plot stacks size themselves; a fixed height clips them and they
    // bleed over the Science tables below.
    const multiPlotTabs = new Set(['coupling', 'science', 'sweeps', 'impedance', 'fem', 'audio']);
    if (multiPlotTabs.has(tab)) {
      div.style.height = 'auto';
      div.style.minHeight = '0';
    } else {
      div.style.height = '420px';
    }
    plotEl.appendChild(div);

    try {
      if (tab === 'modes') {
        plotModeSpectrum(div, {
          modes: results.modes,
          theme: state.display.theme,
          title: 'Resonance / mode frequencies',
        });
        // Static mode-shape plot for tubes (pressure vs x)
        if ((state.resonatorType === 'tube' || state.resonatorType === 'custom') && results.modes.length) {
          const modeN = Math.max(1, Math.round(state.display.selectedMode || 1));
          const m = results.modes[Math.min(modeN, results.modes.length) - 1];
          const shapeHost = document.createElement('div');
          shapeHost.id = 'plotly-mode-shape';
          shapeHost.style.width = '100%';
          shapeHost.style.height = '280px';
          plotEl.appendChild(shapeHost);
          const shape = sampleTubeMode({
            L: state.geometry.length,
            boundary: state.geometry.boundary,
            n: m.n,
            nSamples: 121,
          });
          plotTubeModeShape(shapeHost, {
            x: shape.x,
            p: shape.p,
            nodes: shape.nodes,
            antinodes: shape.antinodes,
            theme: state.display.theme,
            n: m.n,
            boundary: state.geometry.boundary,
            title: 'Pressure mode shape',
          });
        }
      } else if (tab === 'response') {
        const resp = computeResponse(state, env, results);
        results._resp = resp;
        plotFrequencyResponse(div, {
          freqs: resp.freqs,
          mag: resp.mag,
          magDb: resp.magDb,
          phase: resp.phase,
          theme: state.display.theme,
          scale: state.frequencyResponse.scale,
          title: `Frequency response — f₀ ≈ ${resp.f0.toFixed(1)} Hz, Q ≈ ${Number.isFinite(resp.Q) ? resp.Q.toFixed(1) : '∞'}, Δf ≈ ${resp.bandwidth.toFixed(2)} Hz`,
          fMarks: results.modes.slice(0, 5).map((m) => m.f),
          showPhase: true,
        });
        // Research diagnostic: group delay
        const gd = document.createElement('div');
        gd.id = 'plotly-group-delay';
        gd.style.width = '100%';
        gd.style.height = '240px';
        plotEl.appendChild(gd);
        try {
          plotGroupDelay(gd, {
            freqs: resp.freqs,
            phase: resp.phase,
            theme: state.display.theme,
            title: 'Group delay τ_g = −dφ/dω',
            f0: resp.f0,
          });
        } catch (e) {
          gd.innerHTML = `<div class="warn-box">${escapeHtml(e.message)}</div>`;
        }
      } else if (tab === 'damping') {
        if (results.damping) {
          plotQBreakdown(div, {
            mechanisms: results.damping.mechanisms,
            Q: results.damping.Q,
            theme: state.display.theme,
            title: 'Loss mechanisms',
          });
          const dec = document.createElement('div');
          dec.id = 'plotly-energy-decay';
          dec.style.width = '100%';
          dec.style.height = '260px';
          plotEl.appendChild(dec);
          try {
            plotEnergyDecay(dec, {
              f0: results.modes[0]?.f ?? 100,
              Q: results.damping.Q,
              theme: state.display.theme,
              title: 'Energy decay envelope',
            });
          } catch (e) {
            dec.innerHTML = `<div class="warn-box">${escapeHtml(e.message)}</div>`;
          }
        } else {
          div.innerHTML = '<div class="warn-box">No damping data — fix geometry errors first.</div>';
        }
      } else if (tab === 'coupling') {
        renderCouplingPlots(div, state, env, results);
      } else if (tab === 'science') {
        renderSciencePlots(div, state, env, results);
      } else if (tab === 'sweeps') {
        renderSweepPlots(div, state, env, results);
      } else if (tab === 'impedance') {
        renderImpedancePlots(div, state, env, results);
      } else if (tab === 'fem') {
        renderFemPlots(div, state, env, results);
      } else if (tab === 'audio') {
        renderAudioTube(div, state, env, results);
      }
    } catch (err) {
      div.innerHTML = `<div class="error-box">Plot unavailable: ${escapeHtml(err.message)}. Physics results in the right panel remain valid.</div>`;
    }
  }

  paintGeometryCanvas();
}

function computeResponse(state, env, results) {
  const fr = state.frequencyResponse;
  const f0 = results.modes[0]?.f ?? 100;
  const Q = Number.isFinite(results.damping.Q) ? results.damping.Q : 30;
  const fStart = Math.min(fr.fStart, f0 * 0.5);
  const fEnd = Math.max(fr.fEnd, f0 * 2);
  const n = fr.nSamples;

  const freqs = [];
  const mag = [];
  const phase = [];
  const bw = f0 / Math.max(Q, 1);

  for (let i = 0; i < n; i++) {
    let f;
    if (fr.scale === 'log') {
      const t = i / (n - 1);
      f = fStart * Math.pow(fEnd / fStart, t);
    } else {
      f = fStart + ((fEnd - fStart) * i) / (n - 1);
    }
    // Sum of Lorentzians at each mode (simple, labeled)
    let re = 0;
    let im = 0;
    for (const m of results.modes.slice(0, 8)) {
      const w0 = 2 * Math.PI * m.f;
      const w = 2 * Math.PI * f;
      const gamma = w0 / Math.max(Q, 1);
      const denRe = w0 * w0 - w * w;
      const denIm = gamma * w;
      const d2 = denRe * denRe + denIm * denIm || 1e-30;
      re += denRe / d2;
      im += -denIm / d2;
    }
    freqs.push(f);
    mag.push(Math.hypot(re, im));
    phase.push(Math.atan2(im, re));
  }
  const maxMag = Math.max(...mag) || 1;
  const magNorm = mag.map((v) => v / maxMag);
  const magDb = magNorm.map((v) => 20 * Math.log10(Math.max(v, 1e-12)));
  return {
    freqs,
    mag: magNorm,
    magDb,
    phase,
    f0,
    Q,
    bandwidth: bw,
    note: 'Sum of Lorentzian modes — engineering response, not full transfer-matrix.',
  };
}

function renderCouplingPlots(host, state, env, results) {
  if (state.resonatorType !== 'coupled') {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'Select Coupled resonators to study avoided crossings and mode splitting.';
    host.appendChild(note);
    return;
  }
  const g = state.geometry;
  const rows = document.createElement('div');
  rows.className = 'coupling-plots';
  host.appendChild(rows);
  const p1 = document.createElement('div');
  p1.style.height = '320px';
  rows.append(p1);

  // Avoided crossing vs detuning
  const detunes = [];
  const fPlus = [];
  const fMinus = [];
  const f1c = [];
  const f2c = [];
  const center = 0.5 * (g.f1 + g.f2);
  const span = Math.min(40, center);
  for (let i = 0; i <= 40; i++) {
    const d = -span + 2 * span * i / 40;
    const f1 = center + d / 2;
    const f2 = center - d / 2;
    const r = coupledTwoMode({ f1, f2, couplingHz: g.couplingHz, Q1: g.Q1, Q2: g.Q2 });
    detunes.push(f1 - f2);
    fPlus.push(r.fPlus);
    fMinus.push(r.fMinus);
    f1c.push(f1);
    f2c.push(f2);
  }
  plotAvoidedCrossing(p1, {
    detunes, fPlus, fMinus, f1Curve: f1c, f2Curve: f2c,
    theme: state.display.theme,
    title: `Avoided crossing — Δc = ${g.couplingHz} Hz`,
  });

  // Splitting vs coupling (optional sweep)
  const cs = state.couplingSweep;
  if (!cs?.enabled) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'Enable “Show avoided-crossing sweep” in the left panel to plot mode splitting vs coupling.';
    rows.appendChild(note);
    return;
  }

  const p2 = document.createElement('div');
  p2.style.height = '280px';
  rows.appendChild(p2);

  const couplings = [];
  const splittings = [];
  const step = (cs.couplingMax - cs.couplingMin) / 20 || 1;
  for (let k = cs.couplingMin; k <= cs.couplingMax + 1e-9; k += step) {
    const r = coupledTwoMode({ f1: g.f1, f2: g.f2, couplingHz: k, Q1: g.Q1, Q2: g.Q2 });
    couplings.push(k);
    splittings.push(r.modeSplitting);
  }
  if (getPlotly()) {
    const P = getPlotly();
    P.newPlot(p2, [
      { x: couplings, y: splittings, mode: 'lines+markers', name: 'Δf', line: { color: '#4f8cff' } },
      { x: couplings, y: couplings.map((x) => 2 * x), mode: 'lines', name: '2Δc (identical)', line: { dash: 'dot', color: '#f0a202' } },
    ], {
      title: 'Mode splitting vs coupling',
      xaxis: { title: 'Δc (Hz)' },
      yaxis: { title: 'Mode splitting (Hz)' },
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { color: state.display.theme === 'light' ? '#1a1d23' : '#e8eaed' },
    }, { responsive: true });
  }
}

function renderSciencePlots(host, state, env, results) {
  const wrap = document.createElement('div');
  wrap.className = 'coupling-plots';
  host.appendChild(wrap);

  // Poles
  const p1 = document.createElement('div');
  p1.style.height = '380px';
  wrap.appendChild(p1);
  const Q = Number.isFinite(results.damping?.Q) ? results.damping.Q : 40;
  try {
    const poles = poleSet(results.modes.slice(0, 8), Q);
    plotPoles(p1, {
      poles,
      theme: state.display.theme,
      title: `Complex poles — Q ≈ ${Q.toFixed(1)}`,
    });
  } catch (err) {
    p1.innerHTML = `<div class="warn-box">${escapeHtml(err.message)}</div>`;
  }

  // Tornado sensitivity
  const p2 = document.createElement('div');
  p2.style.height = '340px';
  wrap.appendChild(p2);
  try {
    const g = state.geometry;
    const keys = Object.keys(g).filter((k) => typeof g[k] === 'number' && Number.isFinite(g[k]) && Math.abs(g[k]) > 0);
    const modelFn = (p) => {
      const r = computeResults({ ...state, geometry: { ...g, ...p } }, env);
      return r.modes[0]?.f ?? NaN;
    };
    const sens = sensitivity(modelFn, g, keys.slice(0, 10), 1e-3);
    const items = Object.entries(sens.sensitivities)
      .map(([key, s]) => ({ key, value: s.elasticity }))
      .filter((s) => Number.isFinite(s.value));
    plotTornado(p2, {
      items,
      theme: state.display.theme,
      title: 'Primary-frequency elasticities',
    });
  } catch (err) {
    p2.innerHTML = `<div class="warn-box">${escapeHtml(err.message)}</div>`;
  }

  // Monte Carlo histogram
  const p3 = document.createElement('div');
  p3.style.height = '340px';
  wrap.appendChild(p3);
  try {
    const g = state.geometry;
    const keys = Object.keys(g).filter((k) => typeof g[k] === 'number' && Number.isFinite(g[k]) && Math.abs(g[k]) > 0).slice(0, 6);
    const sigmas = {};
    const pct = (state.science?.uncertaintyPct ?? 2) / 100;
    for (const k of keys) sigmas[k] = pct;
    const modelFn = (p) => {
      const r = computeResults({ ...state, geometry: { ...g, ...p } }, env);
      return r.modes[0]?.f ?? NaN;
    };
    const mc = monteCarloUncertainty(modelFn, g, sigmas, {
      n: state.science?.mcSamples ?? 400,
      relative: true,
      seed: 42,
    });
    let ci = null;
    try {
      const samples = mc.samples || [];
      if (samples.length >= 2) {
        ci = bootstrapCI(samples, { nBoot: 300, level: 0.95, seed: 42 });
      }
    } catch { /* fall back to plain histogram */ }
    if (ci) {
      plotHistogramCI(p3, {
        histogram: mc.histogram,
        mean: mc.mean,
        std: mc.std,
        ciLo: ci.ciLo,
        ciHi: ci.ciHi,
        theme: state.display.theme,
        title: `Monte Carlo f₁ · bootstrap ${(ci.level * 100).toFixed(0)}% CI · n=${mc.n}`,
      });
    } else {
      plotHistogram(p3, {
        histogram: mc.histogram,
        mean: mc.mean,
        std: mc.std,
        theme: state.display.theme,
        title: `Monte Carlo f₁ · n=${mc.n}`,
      });
    }
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = `MC mean = ${mc.mean.toFixed(3)} Hz · σ = ${mc.std.toFixed(3)} Hz · 5–95% = [${mc.p05.toFixed(2)}, ${mc.p95.toFixed(2)}]`;
    wrap.appendChild(note);
  } catch (err) {
    p3.innerHTML = `<div class="warn-box">${escapeHtml(err.message)}</div>`;
  }

  // Modal density vs Weyl asymptote
  const p4 = document.createElement('div');
  p4.style.height = '340px';
  wrap.appendChild(p4);
  try {
    const g = state.geometry;
    let V = 0.1;
    const type = state.resonatorType;
    if (type === 'rectangular-cavity') V = g.Lx * g.Ly * g.Lz;
    else if (type === 'cylindrical-cavity') V = Math.PI * g.radius ** 2 * g.length;
    else if (type === 'spherical-cavity') V = (4 / 3) * Math.PI * g.radius ** 3;
    else if (type === 'annular-cavity') V = Math.PI * (g.outerRadius ** 2 - g.innerRadius ** 2) * g.length;
    else if (type === 'helmholtz') V = g.volume;
    else if (type === 'tube') V = Math.PI * (g.diameter / 2) ** 2 * g.length;
    plotModeDensity(p4, {
      modes: results.modes,
      volume: V,
      c: env.c,
      theme: state.display.theme,
      title: 'Cumulative mode count',
    });
  } catch (err) {
    p4.innerHTML = `<div class="warn-box">${escapeHtml(err.message)}</div>`;
  }

  // Transmission loss (muffler research)
  const p5 = document.createElement('div');
  p5.style.height = '340px';
  wrap.appendChild(p5);
  try {
    const g = state.geometry;
    const Lch = g.length || g.seg1Length || 0.5;
    const ratio = 4;
    const f1 = results.modes[0]?.f || 100;
    const tl = expansionChamberTLSweep({
      fStart: f1 * 0.2,
      fEnd: f1 * 6,
      length: Lch,
      areaRatio: ratio,
      c: env.c,
      n: 120,
    });
    const maxT = Math.max(...tl.TLdB);
    const maxI = tl.TLdB.indexOf(maxT);
    plotTransmissionLoss(p5, {
      freqs: tl.freqs,
      TLdB: tl.TLdB,
      theme: state.display.theme,
      title: `Expansion-chamber TL · L = ${Lch.toPrecision(3)} m, m = ${ratio}`,
      mark: { x: tl.freqs[maxI], y: maxT, label: 'peak TL' },
    });
  } catch (err) {
    p5.innerHTML = `<div class="warn-box">${escapeHtml(err.message)}</div>`;
  }

  // Research tools: save case / compare / export package
  const tools = document.createElement('div');
  tools.className = 'research-tools';
  tools.innerHTML = `
    <div class="result-section-title">Research tools</div>
    <div class="research-actions"></div>
    <div class="research-cases"></div>
    <div class="research-prony"></div>
  `;
  wrap.appendChild(tools);
  const actions = tools.querySelector('.research-actions');
  const caseBox = tools.querySelector('.research-cases');
  const pronyBox = tools.querySelector('.research-prony');

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn';
  saveBtn.textContent = t('btn.save') + ' case';
  saveBtn.title = 'Store current primary f/Q as a research case';
  saveBtn.addEventListener('click', () => {
    researchCases.push(makeCaseSnapshot({
      name: `Case ${researchCases.length + 1}`,
      type: state.resonatorType,
      env,
      results,
      params: { ...state.geometry },
    }));
    renderResearchCases(caseBox, state);
    flashMessage($('#status'), 'Case saved for comparison');
  });

  const expBtn = document.createElement('button');
  expBtn.type = 'button';
  expBtn.className = 'btn';
  expBtn.textContent = t('btn.report');
  expBtn.title = 'Download research package JSON';
  expBtn.addEventListener('click', () => {
    const pkg = buildResearchPackage({ state, env, results, extra: { cases: researchCases } });
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resonlab-research.json';
    a.click();
    URL.revokeObjectURL(url);
    flashMessage($('#status'), 'Research package JSON downloaded');
  });

  actions.append(saveBtn, expBtn);
  renderResearchCases(caseBox, state);

  // Prony extraction from synthetic impulse response of primary mode
  try {
    const f0 = results.modes[0]?.f || 100;
    const Q = Number.isFinite(results.damping?.Q) ? results.damping.Q : 30;
    const dt = 1 / (20 * f0);
    const n = 256;
    const sigma = (2 * Math.PI * f0) / (2 * Q);
    const w = 2 * Math.PI * f0 * Math.sqrt(Math.max(0, 1 - 1 / (4 * Q * Q)));
    const yReal = [];
    const yImag = [];
    for (let k = 0; k < n; k++) {
      const t = k * dt;
      const envA = Math.exp(-sigma * t);
      yReal.push(envA * Math.cos(w * t));
      yImag.push(envA * Math.sin(w * t));
    }
    const pr = pronyPoles({ yReal, yImag, dt, nModes: 1 });
    const p = pr.poles[0];
    pronyBox.innerHTML = `
      <div class="result-section-title">Prony pole extraction (synthetic IR)</div>
      <table class="result-table"><tbody>
        <tr><th>f</th><td class="mono">${p.fHz.toFixed(3)} Hz</td></tr>
        <tr><th>σ</th><td class="mono">${p.sigma.toFixed(4)} s⁻¹</td></tr>
        <tr><th>Q (from pole)</th><td class="mono">${Number.isFinite(p.Q) ? p.Q.toFixed(2) : '∞'}</td></tr>
        <tr><th>Residual</th><td class="mono">${pr.residuals.toExponential(2)}</td></tr>
      </tbody></table>
      <p class="note">${pr.formula}</p>
    `;
  } catch (err) {
    pronyBox.innerHTML = `<div class="warn-box">${escapeHtml(err.message)}</div>`;
  }
}

const researchCases = [];

function renderResearchCases(box, state) {
  if (!box) return;
  if (!researchCases.length) {
    box.innerHTML = '<p class="note">No saved cases yet. Use “Save case” to build a comparison set.</p>';
    return;
  }
  const last = researchCases[researchCases.length - 1];
  let rows = researchCases.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(c.name)}</td>
      <td class="mono">${c.f0 != null ? c.f0.toFixed(2) : '—'}</td>
      <td class="mono">${c.Q != null ? c.Q.toFixed(1) : '—'}</td>
    </tr>`).join('');
  let cmp = '';
  if (researchCases.length >= 2) {
    const a = researchCases[researchCases.length - 2];
    const b = last;
    const d = compareCases(b, a);
    cmp = `
      <tr>
        <th>Δ f₀ (last vs prev)</th>
        <td class="mono">${d.df0 != null ? d.df0.toFixed(3) : '—'} Hz
          ${d.df0rel != null ? `(${(d.df0rel * 100).toFixed(2)}%)` : ''}</td>
      </tr>
      <tr>
        <th>Δ Q</th>
        <td class="mono">${d.dQ != null ? d.dQ.toFixed(2) : '—'}
          ${d.dQrel != null ? `(${(d.dQrel * 100).toFixed(2)}%)` : ''}</td>
      </tr>`;
  }
  box.innerHTML = `
    <div class="result-section-title">Saved research cases (${researchCases.length})</div>
    <table class="result-table"><thead><tr><th>#</th><th>Name</th><th>f₀</th><th>Q</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <table class="result-table"><tbody>${cmp}</tbody></table>
    <p class="note">Comparison uses Δrel = (A − B)/B. Internal units are SI.</p>
  `;
  void state;
}

function renderSweepPlots(host, state, env, results) {
  const wrap = document.createElement('div');
  wrap.className = 'coupling-plots';
  host.appendChild(wrap);

  const sci = state.science || {};
  const setup = sweepSetup(state);
  const key = setup.key;
  const n = sci.sweepN ?? 48;
  const current = state.geometry[key];
  const min = setup.min;
  const max = setup.max;

  const p1 = document.createElement('div');
  p1.style.height = '340px';
  wrap.appendChild(p1);

  try {
    const g = state.geometry;
    const modelFn = (p) => {
      const r = computeResults({ ...state, geometry: { ...g, ...p } }, env);
      return r.modes[0]?.f ?? NaN;
    };
    const sweep = sweep1D(modelFn, g, key, min, max, n, 'linear');
    const ext = sweepExtremum(sweep, 'min');
    plotSweep(p1, {
      xs: sweep.xs,
      ys: sweep.ys,
      xLabel: `${SWEEP_PARAMETERS[key]?.[0] || key} (${SWEEP_PARAMETERS[key]?.[1] || 'SI'})`,
      yLabel: 'Primary f (Hz)',
      theme: state.display.theme,
      title: `First frequency vs ${SWEEP_PARAMETERS[key]?.[0] || key} (${n} samples)`,
      mark: ext ? { ...ext, label: 'min' } : null,
    });

    const p2 = document.createElement('div');
    p2.style.height = '300px';
    wrap.appendChild(p2);
    // Second sweep: couplingHz if available, else diameter/neckRadius
    const altKey = g.couplingHz != null ? 'couplingHz'
      : g.diameter != null ? 'diameter'
        : g.neckRadius != null ? 'neckRadius'
          : g.radius != null ? 'radius'
            : g.volume != null ? 'volume' : null;
    if (altKey && altKey !== key) {
      const aMin = Math.max(0, (g[altKey] || 1) * 0.2);
      const aMax = (g[altKey] || 1) * 2.5;
      const s2 = sweep1D(modelFn, g, altKey, aMin, aMax, Math.min(40, n), 'linear');
      plotSweep(p2, {
        xs: s2.xs,
        ys: s2.ys,
        xLabel: altKey,
        yLabel: 'Primary f (Hz)',
        theme: state.display.theme,
        title: `Sweep: f₁ vs ${altKey}`,
        mark: sweepExtremum(s2, 'min'),
      });
    } else {
      p2.innerHTML = '<p class="note">Only one numeric parameter available for a secondary sweep.</p>';
    }
  } catch (err) {
    p1.innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
  }
}

function renderFemPlots(host, state, env, results) {
  const controls = document.createElement('div'); controls.className = 'fem-source-controls';
  const label = document.createElement('label'); label.textContent = 'Study source';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'FEM study source');
  for (const [value, title] of [['resonator', 'Current resonator geometry'], ['rectangle', 'Rectangle verification benchmark']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = title; select.appendChild(option);
  }
  select.value = state.fem.source === 'rectangle' ? 'rectangle' : 'resonator';
  label.appendChild(select); controls.appendChild(label); host.appendChild(controls);
  const content = document.createElement('div'); host.appendChild(content);
  const render = () => {
    cancelFemJob(); $$('.js-plotly-plot', content).forEach(disposePlot); content.replaceChildren();
    const current = store.get();
    if (current.fem.source === 'rectangle') renderRectangleFemPlots(content, current, env, results);
    else renderHelmholtzFemPlots(content, current, env);
  };
  select.addEventListener('change', () => {
    lastFemStudy = null;
    store.setState({ fem: { ...store.get().fem, source: select.value, selectedMode: select.value === 'rectangle' ? 2 : 1 } }, 'fem-settings');
    renderStudyGuide($('#study-guide'), store.get(), { navigate: navigateStudy, editSettings: editStudySettings,
      help: openHelp, startExample: startStudyExample, startApplication, library: openToolLibrary });
    rebuildLeftPanel(); render();
  });
  render();
}

function renderHelmholtzFemPlots(host, state, env) {
  if (state.resonatorType !== 'helmholtz') {
    lastFemStudy = { error: 'Select a Helmholtz resonator to mesh its cavity and neck. Other resonator geometries are not supported yet.' };
    const note = document.createElement('p'); note.className = 'note'; note.textContent = lastFemStudy.error;
    host.append(note, button({ label: 'Load Helmholtz example', className: 'btn btn-primary', onClick: () => startStudyExample('fem') }));
    renderFemResults(); return;
  }
  const wrap = document.createElement('div'); wrap.className = 'helmholtz-fem-study'; host.appendChild(wrap);
  const intro = document.createElement('p'); intro.className = 'note';
  intro.textContent = 'FEM uses the cavity and neck in Setup. Choose an acoustic task and define its mounting. Isolated pressure gain and Q remain separate reference results.';
  wrap.appendChild(intro);
  const applicationHost = document.createElement('div'); wrap.append(applicationHost);
  const controls = document.createElement('div'); controls.className = 'research-actions';
  const level = document.createElement('select'); level.setAttribute('aria-label', 'Helmholtz FEM mesh');
  for (const name of ['coarse', 'medium', 'fine']) {
    const option = document.createElement('option'); option.value = name; option.textContent = `${name[0].toUpperCase() + name.slice(1)} mesh`; level.append(option);
  }
  level.value = state.fem.meshLevel || 'medium';
  const modeSelect = document.createElement('select'); modeSelect.setAttribute('aria-label', 'Helmholtz FEM mode');
  for (let i = 1; i <= 6; i++) {
    const option = document.createElement('option'); option.value = String(i); option.textContent = `Mode ${i}${i === 1 ? ' · Helmholtz resonance' : ''}`; modeSelect.append(option);
  }
  modeSelect.value = String(Math.min(6, Math.max(1, state.fem.selectedMode || 1)));
  const solve = button({ label: 'Solve FEM', className: 'btn btn-primary', onClick: () => run(false) });
  const convergence = button({ label: 'Check mesh convergence', onClick: () => run(true) });
  const cancel = button({ label: 'Cancel solve', onClick: cancelFemJob }); cancel.hidden = true;
  controls.append(level, modeSelect, solve, convergence, cancel); wrap.appendChild(controls);
  const lossControls = document.createElement('fieldset');
  lossControls.innerHTML = '<legend>Radiation, damping & response</legend><p class="note">Drive: 1 Pa equivalent pressure source at the mouth. Read cavity-average pressure gain and phase. Change these settings, then Solve FEM. The mode field below remains the lossless reference.</p>';
  const lossInputs = {};
  for (const [key, label] of [['radiation', 'Mouth radiation loss'], ['viscous', 'Viscous wall layers'], ['thermal', 'Thermal wall layers']]) {
    const row = checkboxRow({ id: `fem-${key}`, label, checked: state.fem[key] !== false, onChange: () => changedResponseSettings() });
    lossInputs[key] = row.checkbox; lossControls.append(row.el);
  }
  for (const [key, title, initial, min, max, step] of [
    ['extraLoss', 'Additional bulk loss factor (0 = none)', 0, 0, 1, .001],
    ['responseStart', 'Sweep start / lossless fundamental', .5, .01, 10, .1],
    ['responseEnd', 'Sweep end / lossless fundamental', 1.5, .02, 20, .1],
    ['responseSamples', 'Sweep samples (21–501)', 101, 21, 501, 20]]) {
    const label = document.createElement('label'); label.style.display = 'block'; label.textContent = title + ' ';
    const input = document.createElement('input'); input.type = 'number'; input.value = state.fem[key] ?? initial;
    input.min = min; input.max = max; input.step = step; input.setAttribute('aria-label', title);
    input.style.width = '100px'; lossInputs[key] = input; label.append(input); lossControls.append(label);
    input.addEventListener('change', () => changedResponseSettings());
    input.addEventListener('input', () => changedResponseSettings());
  }
  const advancedSettings=document.createElement('details');advancedSettings.className='engineering-details';
  const advancedTitle=document.createElement('summary');advancedTitle.textContent='Losses & sweep settings';
  advancedSettings.append(advancedTitle,lossControls);wrap.append(advancedSettings);
  const meshToggle = checkboxRow({ id: 'fem-show-mesh', label: 'Show triangle mesh', checked: true, onChange: () => draw() });
  wrap.appendChild(meshToggle.el);
  const status = document.createElement('p'); status.className = 'note'; status.setAttribute('role', 'status'); wrap.appendChild(status);
  const workbenchHost=document.createElement('div');wrap.append(workbenchHost);
  const pressureDetails=document.createElement('details');pressureDetails.className='engineering-details';pressureDetails.open=(state.fem.application||'tune')==='tune';
  const pressureTitle=document.createElement('summary');pressureTitle.textContent='Isolated pressure response & loss budget';pressureDetails.append(pressureTitle);wrap.append(pressureDetails);
  const responseSummary = document.createElement('div'); pressureDetails.append(responseSummary);
  const responsePlot = document.createElement('div'); responsePlot.style.height = '370px'; pressureDetails.append(responsePlot);
  const convergenceDetails=document.createElement('details');convergenceDetails.className='engineering-details';
  const convergenceTitle=document.createElement('summary');convergenceTitle.textContent='Inspect mesh convergence';convergenceDetails.append(convergenceTitle);wrap.append(convergenceDetails);
  const convergenceTable = document.createElement('div');convergenceTable.className='fem-convergence-table'; convergenceDetails.appendChild(convergenceTable);
  const fieldDetails=document.createElement('details');fieldDetails.className='engineering-details';
  const fieldTitle=document.createElement('summary');fieldTitle.textContent='Inspect pressure fields & lossless modes';fieldDetails.append(fieldTitle,meshToggle.el);wrap.append(fieldDetails);
  const table = document.createElement('div'); table.className = 'fem-mode-table'; fieldDetails.appendChild(table);
  const field = document.createElement('div'); field.className = 'fem-field'; fieldDetails.appendChild(field);
  const fieldView=document.createElement('select');fieldView.setAttribute('aria-label','Pressure field display');
  for(const [value,label] of [['mode','Lossless mode · normalized'],['driven','Driven isolated peak · normalized pressure snapshot']]){
    const option=document.createElement('option');option.value=value;option.textContent=label;fieldView.append(option);
  }
  fieldDetails.insertBefore(fieldView,table);fieldDetails.insertBefore(modeSelect,fieldView);fieldView.addEventListener('change',()=>draw());
  const viewResponse = button({ label: 'View isolated response & Q', onClick: () => {pressureDetails.open=true;responseSummary.scrollIntoView({ behavior: 'smooth', block: 'start' });} });
  viewResponse.disabled = true; controls.append(viewResponse);
  const exports = document.createElement('div'); exports.className = 'research-actions'; wrap.appendChild(exports);
  let result = null, convergenceRows = [];
  const workbench=mountFemWorkbench({settingsHost:applicationHost,resultsHost:workbenchHost,getState:()=>store.get().fem,
    setSettings:patch=>store.setState({fem:{...store.get().fem,...patch}},'fem-settings'),
    onSettingsChange:()=>changedResponseSettings(),theme:state.display.theme});
  const proposedState=d=>femDesignProject(store.toProjectJSON(),d);
  const inverse=mountFemInverseDesign({host:applicationHost,getState:()=>store.get().fem,
    setSettings:patch=>store.setState({fem:{...store.get().fem,...patch}},'fem-settings'),
    getGeometry:()=>({...store.get().geometry,cavityAspectRatio:store.get().geometry.cavityAspectRatio??1}),getStudy:()=>workbench.settings(),getLevel:()=>level.value,
    getLosses:()=>{const s=settingsValues();return {c:env.c,losses:{rho:env.rho,mu:env.mu,gamma:env.gamma,Pr:env.Pr,radiation:s.radiation,viscous:s.viscous,thermal:s.thermal,extraLoss:s.extraLoss}};},
    runSearch:(request,onProgress)=>runHelmholtzWorker({operation:'inverse',...request},onProgress),cancelSearch:cancelFemJob,
    onBusy:value=>{
      solve.disabled=convergence.disabled=level.disabled=modeSelect.disabled=value;lossControls.disabled=value;workbench.setBusy(value);
      meshExport.disabled=fieldExport.disabled=value||!result;
      responseExport.disabled=viewResponse.disabled=value||!result?.response;
    },
    onApply:d=>{
      const next=proposedState(d);store.setState({geometry:next.geometry,fem:next.fem},'settings');
      flashMessage($('#status'),`FEM design applied: ${d.frequency.toFixed(2)} Hz for ${d.targetFrequency.toFixed(2)} Hz target${d.mode==='frequency-q'?`; Q ${d.qualityFactor.toFixed(2)} for ${d.targetQ.toFixed(2)}, within size limits`:''}. Recomputing the complete study…`,6000);
    },
    onExport:d=>downloadProjectJSON(proposedState(d),'resonlab-inverse-design-project.json')});
  const settingsValues = () => Object.fromEntries(Object.entries(lossInputs).map(([key, input]) => [key, input.type === 'checkbox' ? input.checked : Number(input.value)]));
  function changedResponseSettings() {
    inverse.invalidate();
    store.setState({ fem: { ...store.get().fem, ...settingsValues(), ...workbench.settings() } }, 'fem-settings');
    // Settings must never leave an exportable response from a previous solve.
    if (result) { delete result.response; delete result.responseError;delete result.performance;delete result.performanceError; convergenceRows = []; draw(); }
    pressureDetails.open=workbench.settings().application==='tune';
    status.textContent = 'Study settings changed. Click Solve FEM to update the application result, Q and response.';
  }
  const responseExport = button({ label: 'Export isolated pressure CSV', onClick: () => {
    if (result?.response) downloadResponseCSV(result.response, { note: result.response.note, Q_half_power: result.response.Q ?? 'unresolved', losses: JSON.stringify(result.response.losses) }, 'resonlab-fem-response.csv');
  } }); responseExport.disabled = true;
  const meshExport = button({ label: 'Export mesh & modes', onClick: () => {
    if (result) downloadBlob('resonlab-helmholtz-fem.json', JSON.stringify({ schema: 'resonlab.fem/1', software: 'ResonLab V1.3', ...result, convergence: convergenceRows }, null, 2), 'application/json');
  } });
  const fieldExport = button({ label: 'Export field SVG', onClick: () => {
    const svg = $('svg', field)?.cloneNode(true);
    if (!svg) return;
    svg.setAttribute('color', state.display.theme === 'light' ? '#182333' : '#e7edf5');
    svg.setAttribute('font-family', 'Segoe UI, Arial, sans-serif');
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('width', '100%'); background.setAttribute('height', '100%');
    background.setAttribute('fill', state.display.theme === 'light' ? '#f7f9fc' : '#111c2b');
    svg.insertBefore(background, svg.firstChild);
    downloadBlob('resonlab-helmholtz-pressure.svg', new XMLSerializer().serializeToString(svg), 'image/svg+xml');
  } });
  meshExport.disabled = fieldExport.disabled = true; exports.append(meshExport, fieldExport, responseExport);
  const geometry = { ...state.geometry, cavityAspectRatio: state.geometry.cavityAspectRatio ?? 1 };
  const draw = () => {
    if (!result) return;
    const selectedMode = Number(modeSelect.value);
    const peak=result.response?.peak;
    fieldView.options[1].disabled=!peak;
    if(fieldView.value==='driven'&&peak){
      const snapshot=peak.fieldRe.map((v,i)=>v*Math.cos(peak.phase)+peak.fieldIm[i]*Math.sin(peak.phase));
      const max=Math.max(...snapshot.map(Math.abs));
      field.innerHTML=helmholtzMeshSVG({...result,modes:[{values:snapshot.map(v=>v/max),f:peak.f,label:'Driven isolated peak · normalized snapshot'}]},0,meshToggle.checkbox.checked);
    }else field.innerHTML = helmholtzMeshSVG(result, selectedMode - 1, meshToggle.checkbox.checked);
    workbench.draw(result,convergenceRows);
    table.innerHTML = `<div class="result-section-title">Solved axisymmetric modes</div>
      <table class="result-table"><thead><tr><th>Mode</th><th>FEM frequency</th><th>Relative eigenpair residual</th></tr></thead><tbody>
      ${result.modes.map((mode, i) => `<tr><td>${i + 1}${i === 0 ? ' · Helmholtz' : ''}</td><td>${mode.f.toFixed(2)} Hz</td><td>${mode.residual.toExponential(1)}</td></tr>`).join('')}
      </tbody></table><p class="note">${result.comparison.lumpedHz === null ? 'No finite lumped estimate for an uncorrected zero-length aperture.' : `Lumped estimate: ${result.comparison.lumpedHz.toFixed(2)} Hz. Fundamental difference: ${(result.comparison.difference * 100).toFixed(2)}%. This difference is not mesh error: FEM resolves the neck junction and the nonuniform pressure field.`}</p>
      <p class="note">These frequencies and this field are lossless references. The separate driven solve below includes the selected losses. Higher modes, especially when ka ≥ 0.5, need a radiation-domain model for reliable open-boundary predictions. Only axisymmetric modes are included.</p>`;
    const response = result.response;
    responseExport.disabled = viewResponse.disabled = !response;
    $$('.js-plotly-plot', responsePlot).forEach(disposePlot); responsePlot.replaceChildren();
    if (response) {
      const peak = response.peak, power = peak?.power, total = power ? Object.values(power).reduce((s,v) => s+v, 0) : 0;
      responseSummary.innerHTML = `<h3>Driven FEM frequency response</h3><table class="result-table"><tbody>
        <tr><th>Damped pressure peak</th><td>${peak ? peak.f.toFixed(3) + ' Hz' : 'Unresolved in sweep'}</td></tr>
        <tr><th>Half-power Q</th><td>${response.Q === null ? 'Unresolved' : response.Q.toFixed(2)}</td></tr>
        <tr><th>−3 dB bandwidth</th><td>${response.bandwidth === null ? 'Unresolved' : response.bandwidth.toFixed(4) + ' Hz (' + response.fLower.toFixed(3) + '–' + response.fUpper.toFixed(3) + ')'}</td></tr>
        <tr><th>Peak pressure gain</th><td>${peak ? peak.mag.toFixed(3) + ' Pa / Pa' : '—'}</td></tr>
        <tr><th>Linear solve residual</th><td>${response.maxResidual.toExponential(1)}</td></tr>
        ${power ? Object.entries(power).map(([name,value]) => `<tr><th>${name} power at peak</th><td>${value.toExponential(3)} W${total ? ' · ' + (100*value/total).toFixed(1) + '%' : ''}</td></tr>`).join('') : ''}
        </tbody></table><p class="note">${escapeHtml(response.note)}</p>${response.warnings.map(s => `<p class="note">${escapeHtml(s)}</p>`).join('')}`;
      if(pressureDetails.open){
        const chart = document.createElement('div'); chart.style.height = '370px'; responsePlot.append(chart);
        plotFrequencyResponse(chart, { ...response, showPhase: true, scale: 'linear', yUnit: 'Cavity pressure gain (Pa / Pa)', title: 'Driven FEM · cavity pressure / mouth drive', theme: state.display.theme,
          fMarks: [response.fLower, response.fUpper].filter(f => f !== null) });
      }
    } else responseSummary.innerHTML = `<p class="note">${escapeHtml(result.responseError || 'Click Solve FEM to calculate the response for these settings.')}</p>`;
    convergenceTable.innerHTML = convergenceRows.length ? `<div class="result-section-title">Mesh convergence · same geometry and boundary</div>
      <table class="result-table"><thead><tr><th>Mesh</th><th>Triangles</th><th>Lossless fundamental</th><th>Change</th><th>Isolated peak</th><th>Q</th><th>Mounted peak</th><th>Mounted value</th></tr></thead><tbody>
      ${convergenceRows.map((row, i) => `<tr><td>${row.level}</td><td>${row.triangles}</td><td>${row.f.toFixed(3)} Hz</td><td>${i ? (100 * (row.f - convergenceRows[i - 1].f) / convergenceRows[i - 1].f).toFixed(3) + '%' : '—'}</td><td>${row.peak == null ? '—' : row.peak.toFixed(3) + ' Hz'}</td><td>${row.Q == null ? '—' : row.Q.toFixed(2)}</td><td>${row.applicationPeak==null?'—':row.applicationPeak.toFixed(3)+' Hz'}</td><td>${row.applicationValue==null?'—':result.performance?.application==='absorber'?(100*row.applicationValue).toFixed(3)+'%':row.applicationValue.toFixed(3)+' dB'}</td></tr>`).join('')}</tbody></table>` : '';
    lastFemStudy = { result, selectedMode, convergence: convergenceRows, fieldKind:fieldView.value, error: null };
    renderFemResults();
  };
  pressureDetails.addEventListener('toggle',()=>{
    if(pressureDetails.open&&result)draw();
    else {$$('.js-plotly-plot',responsePlot).forEach(disposePlot);responsePlot.replaceChildren();}
  });
  modeSelect.addEventListener('change', () => {
    store.setState({ fem: { ...store.get().fem, selectedMode: Number(modeSelect.value) } }, 'fem-settings'); draw();
  });
  level.addEventListener('change', () => {inverse.invalidate();store.setState({ fem: { ...store.get().fem, meshLevel: level.value } }, 'fem-settings');});
  const run = async (checkConvergence) => {
    lastFemStudy = { pending: true, error: 'Solving the current cavity and neck mesh…' }; renderFemResults();
    solve.disabled = convergence.disabled = level.disabled = modeSelect.disabled = meshExport.disabled = fieldExport.disabled = responseExport.disabled = viewResponse.disabled = true;
    lossControls.disabled = true;inverse.setBusy(true);workbench.setBusy(true);workbench.draw(null); $$('.js-plotly-plot', responsePlot).forEach(disposePlot); responsePlot.replaceChildren(); responseSummary.replaceChildren();
    cancel.hidden = false; convergenceRows = []; result = null; table.replaceChildren(); field.replaceChildren(); convergenceTable.replaceChildren();
    try {
      const requestedLevels = checkConvergence ? ['coarse', 'medium', 'fine'] : [level.value];
      for (const meshLevel of requestedLevels) {
        const preview = { mesh: meshHelmholtz(geometry, meshLevel) };
        field.innerHTML = helmholtzMeshSVG(preview, 0, true);
        status.textContent = `Solving ${meshLevel} mesh in the background…`;
        const settings = settingsValues();
        const response = { losses: { rho: env.rho, mu: env.mu, gamma: env.gamma, Pr: env.Pr,
          radiation: settings.radiation, viscous: settings.viscous, thermal: settings.thermal, extraLoss: settings.extraLoss },
          startRatio: settings.responseStart, endRatio: settings.responseEnd, nSamples: settings.responseSamples };
        result = await runHelmholtzWorker({ geometry, c: env.c, level: meshLevel, nModes: 6, response,performance:workbench.settings() }, (progress) => {
          status.textContent = progress.stage === 'port' ? `${meshLevel} mesh · mouth impedance / application solves: ${progress.iteration}` : progress.stage === 'response' ? `${meshLevel} mesh · driven frequency solves: ${progress.iteration}` : `${meshLevel} mesh · eigensolver iteration ${progress.iteration} · relative residual ${progress.residual.toExponential(1)}`;
        });
        if (!host.isConnected) return;
        const record=store.get().fem.inverseDesignRecord;
        if(record&&record.c===env.c&&record.level===meshLevel&&record.application===workbench.settings().application&&record.targetFrequency===workbench.settings().targetFrequency
          &&record.faceWidth===workbench.settings().faceWidth&&record.ductDiameter===workbench.settings().ductDiameter
          &&['volume','neckRadius','neckLength','cavityAspectRatio','endCorrectionModel'].every(key=>record.geometry?.[key]===geometry[key])
          &&Object.entries(result.response?.losses||response.losses).every(([key,value])=>record.losses?.[key]===value))result.inverseDesignRecord=record;
        if (checkConvergence) convergenceRows.push({ level: meshLevel, triangles: result.mesh.triangles.length, f: result.modes[0].f, peak: result.response?.peak?.f ?? null, Q: result.response?.Q ?? null,
          applicationPeak:result.performance?.peak?.f??null,applicationValue:result.performance?.peak?.alpha??result.performance?.peak?.TLdB??null });
      }
      const completedLevel = result.mesh.level;
      level.value = completedLevel;
      store.setState({ fem: { ...store.get().fem, meshLevel: completedLevel, selectedMode: Number(modeSelect.value) } }, 'fem-settings');
      status.textContent = `Solved ${result.mesh.triangles.length} triangles, ${result.diagnostics.dofs} free pressure nodes. Geometry and medium are linked to your current design.`;
      meshExport.disabled = fieldExport.disabled = false;convergenceDetails.open=checkConvergence;draw();
    } catch (error) {
      if (!host.isConnected) return;
      result = null; lastFemStudy = { error: error.message }; status.textContent = error.message; renderFemResults();
    } finally {
      solve.disabled = convergence.disabled = level.disabled = modeSelect.disabled = false; lossControls.disabled = false;inverse.setBusy(false);workbench.setBusy(false); cancel.hidden = true;
    }
  };
  run(false);
}

function renderRectangleFemPlots(host, state, env, results) {
  const wrap = document.createElement('div');
  wrap.className = 'coupling-plots';
  host.appendChild(wrap);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = '2-D FEM reference study: bilinear quadrilateral elements with consistent mass and rigid walls. This rectangle is independent of the primary resonator model. Frequencies are lossless; refine the mesh to check convergence.';
  wrap.appendChild(note);

  const settings = state.fem;
  const c = env.c;

  // Grid controls
  const ctrl = document.createElement('div');
  ctrl.className = 'research-actions research-tools';
  const lengthInput = (name, value) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0.000001';
    input.max = '1000000';
    input.step = 'any';
    input.value = String(value);
    input.setAttribute('aria-label', `${name} (m)`);
    return input;
  };
  const lxIn = lengthInput('FEM Lx', settings.Lx);
  const lyIn = lengthInput('FEM Ly', settings.Ly);
  const nxIn = document.createElement('input');
  nxIn.type = 'number';
  nxIn.min = '8';
  nxIn.max = '24';
  nxIn.step = '1';
  nxIn.value = String(settings.Nx);
  nxIn.title = 'Grid nodes Nx';
  nxIn.setAttribute('aria-label', 'FEM Nx');
  const nyIn = document.createElement('input');
  nyIn.type = 'number';
  nyIn.min = '8';
  nyIn.max = '24';
  nyIn.step = '1';
  nyIn.value = String(settings.Ny);
  nyIn.title = 'Grid nodes Ny';
  nyIn.setAttribute('aria-label', 'FEM Ny');
  const modeIn = document.createElement('select');
  modeIn.setAttribute('aria-label', 'FEM mode');
  for (let i = 1; i <= 8; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Mode ${i}${i === 1 ? ' (uniform, 0 Hz)' : ''}`;
    modeIn.appendChild(option);
  }
  modeIn.value = String(settings.selectedMode);
  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'btn btn-primary';
  runBtn.textContent = 'Solve FEM';
  ctrl.append(
    Object.assign(document.createElement('span'), { textContent: 'Lx (m) ' }), lxIn,
    Object.assign(document.createElement('span'), { textContent: 'Ly (m) ' }), lyIn,
    Object.assign(document.createElement('span'), { textContent: 'Nx ' }),
    nxIn,
    Object.assign(document.createElement('span'), { textContent: 'Ny ' }),
    nyIn,
    modeIn,
    runBtn,
  );
  wrap.appendChild(ctrl);

  const out = document.createElement('div');
  wrap.appendChild(out);

  const solve = () => {
    $$('.js-plotly-plot', out).forEach(disposePlot);
    out.innerHTML = '<p class="note">Solving eigenproblem…</p>';
    try {
      const Nx = Number(nxIn.value);
      const Ny = Number(nyIn.value);
      const Lx = Number(lxIn.value);
      const Ly = Number(lyIn.value);
      if (![Nx, Ny].every((v) => Number.isInteger(v) && v >= 8 && v <= 24)) {
        throw new Error('Nx and Ny must be integers between 8 and 24.');
      }
      const fem = femModes2D({ Nx, Ny, Lx, Ly, c, nModes: 8, includeZero: true });
      const ana = analyticalRectModes2D({ Lx, Ly, c, nModes: 8 });
      const cmp = compareFemAnalytic(fem, ana);
      store.setState({ fem: { ...store.get().fem, Lx, Ly, Nx, Ny, selectedMode: Number(modeIn.value) } }, 'fem-settings');
      lastFemStudy = { result: fem, comparison: cmp, selectedMode: Number(modeIn.value), error: null };
      renderFemResults();

      out.innerHTML = '';
      const table = document.createElement('div');
      table.innerHTML = `
        <div class="result-section-title">FEM vs analytic (Neumann rectangle)</div>
        <table class="result-table"><thead>
          <tr><th>#</th><th>Mode</th><th>FEM f</th><th>Analytic f</th><th>Rel. err</th></tr>
        </thead><tbody>
          ${cmp.map((r) => `
            <tr class="${r.ok ? '' : 'fem-unresolved'}">
              <td>${r.index + 1}</td>
              <td>${r.label}</td>
              <td class="mono">${r.fem.toFixed(2)} Hz</td>
              <td class="mono">${r.analytic.toFixed(2)} Hz</td>
              <td class="mono">${(r.relErr * 100).toFixed(1)}%</td>
            </tr>`).join('')}
        </tbody></table>
        <p class="note">${fem.formula} · grid ${Nx}×${Ny} · Lx=${Lx.toPrecision(3)} m, Ly=${Ly.toPrecision(3)} m</p>
        <p class="note">${cmp.some((r) => !r.ok) ? 'Some frequencies differ by more than 2%. Refine the mesh, especially along the long axis.' : 'All displayed frequencies agree within 2% of the analytical reference.'} The uniform 0 Hz field is a static mode.</p>
      `;
      out.appendChild(table);

      const mode = fem.modes[Number(modeIn.value) - 1];
      if (mode && getPlotly()) {
        const xs = Array.from({ length: mode.Nx }, (_, i) => i * mode.hx);
        const ys = Array.from({ length: mode.Ny }, (_, j) => j * mode.hy);
        const ph = document.createElement('div');
        ph.style.height = '340px';
        out.appendChild(ph);
        plotSweepHeatmap(ph, {
          xs,
          ys,
          z: mode.field,
          xLabel: 'x (m)',
          yLabel: 'y (m)',
          zLabel: 'p (norm.)',
          theme: state.display.theme,
          title: `FEM mode shape · f = ${mode.f.toFixed(2)} Hz`,
        });
        const ps = document.createElement('div');
        ps.style.height = '380px';
        out.appendChild(ps);
        try {
          plotFieldSurface(ps, {
            xs,
            ys,
            z: mode.field,
            theme: state.display.theme,
            title: `FEM field surface · f = ${mode.f.toFixed(2)} Hz`,
            zLabel: 'p / p_max',
          });
        } catch (e) {
          ps.innerHTML = `<div class="warn-box">${escapeHtml(e.message)}</div>`;
        }
      }

      // Compare with selected analytic type if rectangular
      const f0Ana = results.modes?.[0]?.f;
      if (f0Ana) {
        const vs = document.createElement('p');
        vs.className = 'note';
        vs.textContent = `Primary analytical model f₀ = ${f0Ana.toFixed(2)} Hz. The FEM plots above solve the separate rigid rectangle; they do not simulate the selected resonator geometry or its losses.`;
        out.appendChild(vs);
      }
    } catch (err) {
      out.innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
      lastFemStudy = { error: err.message };
      renderFemResults();
    }
  };
  runBtn.addEventListener('click', solve);
  modeIn.addEventListener('change', solve);
  solve();
}

function renderAudioTube(host, state, env, results) {
  const wrap = document.createElement('div');
  wrap.className = 'coupling-plots';
  host.appendChild(wrap);

  wrap.innerHTML = `
    <p class="note">
      Impedance tube — two-microphone transfer function (ISO 10534-2 style).
      <strong>Synthetic</strong> mode works offline. Live mic is capture only;
      synchronized two-channel impedance analysis is not implemented.
      Web Audio requires localhost/HTTPS and permission. Plane-wave model.
    </p>
    <div class="research-actions">
      <button type="button" class="btn btn-primary" id="audio-synth">Run synthetic sweep</button>
      <button type="button" class="btn" id="audio-mic-start">Start live mic</button>
      <button type="button" class="btn btn-ghost" id="audio-mic-stop">Stop</button>
    </div>
    <div id="audio-status" class="note"></div>
    <div id="audio-plots"></div>
    <div id="audio-table"></div>
  `;

  const status = wrap.querySelector('#audio-status');
  const plots = wrap.querySelector('#audio-plots');
  const table = wrap.querySelector('#audio-table');
  let mic = null;

  const runSynthetic = () => {
    try {
      const g = state.geometry;
      const f0 = results.modes[0]?.f || 200;
      const sw = syntheticTubeSweep({
        fStart: Math.max(50, f0 * 0.25),
        fEnd: f0 * 4,
        n: 80,
        Zload: { re: 250, im: -40 },
        c: env.c,
        rho: env.rho,
        spacing: 0.02,
        x1: 0.05,
      });
      const single = syntheticTubeMeasurement({
        f: f0,
        Zload: { re: 250, im: -40 },
        c: env.c,
        rho: env.rho,
        spacing: 0.02,
        x1: 0.05,
      });
      plots.innerHTML = '';
      const p1 = document.createElement('div');
      p1.style.height = '280px';
      plots.appendChild(p1);
      plotImpedance(p1, {
        freqs: sw.freqs,
        Zre: sw.Zre,
        Zim: sw.Zim,
        Zmag: sw.Zmag,
        theme: state.display.theme,
        title: 'Two-microphone estimated Z(f) — synthetic',
        zUnit: 'Pa·s/m',
      });
      const p2 = document.createElement('div');
      p2.style.height = '260px';
      plots.appendChild(p2);
      plotAbsorption(p2, {
        freqs: sw.freqs,
        Zre: sw.Zre,
        Zim: sw.Zim,
        Z0: env.rho * env.c,
        theme: state.display.theme,
        title: 'Estimated absorption α(f)',
      });
      const Z = single.Zest.Z;
      table.innerHTML = `
        <table class="result-table"><tbody>
          <tr><th>f</th><td class="mono">${f0.toFixed(2)} Hz</td></tr>
          <tr><th>Z (est.)</th><td class="mono">${Z.re.toFixed(1)} + j${Z.im.toFixed(1)}</td></tr>
          <tr><th>|R|</th><td class="mono">${Math.hypot(single.Zest.reflection.re, single.Zest.reflection.im).toFixed(4)}</td></tr>
          <tr><th>α</th><td class="mono">${single.alpha.toFixed(4)}</td></tr>
        </tbody></table>
        <p class="note">${single.formula}</p>
      `;
      status.textContent = 'Synthetic measurement complete.';
    } catch (err) {
      status.textContent = err.message;
    }
  };

  wrap.querySelector('#audio-synth').addEventListener('click', runSynthetic);
  wrap.querySelector('#audio-mic-start').addEventListener('click', async () => {
    const start = wrap.querySelector('#audio-mic-start');
    start.disabled = true;
    try {
      mic = createMicCapture({});
      const info = await mic.start();
      if (!wrap.isConnected) { mic.stop(); return; }
      activeMicCapture = mic;
      status.textContent = `Live mic capture started · ${info.sampleRate} Hz. No live impedance result is computed. Use Stop to release the microphone.`;
    } catch (err) {
      mic?.stop();
      status.textContent = `Live mic unavailable: ${err.message}. Use synthetic mode.`;
      mic = null;
      start.disabled = false;
    }
  });
  wrap.querySelector('#audio-mic-stop').addEventListener('click', () => {
    if (mic) {
      mic.stop();
      mic = null;
      activeMicCapture = null;
      wrap.querySelector('#audio-mic-start').disabled = false;
      status.textContent = 'Live mic stopped.';
    }
  });

  runSynthetic();
}

function renderImpedancePlots(host, state, env, results) {
  const wrap = document.createElement('div');
  wrap.className = 'coupling-plots';
  host.appendChild(wrap);

  const p1 = document.createElement('div');
  p1.style.height = '320px';
  wrap.appendChild(p1);

  try {
    const g = state.geometry;
    const f0 = results.modes[0]?.f || state.science?.analysisFreq || 200;
    const Q = Number.isFinite(results.damping?.Q) ? results.damping.Q : 30;
    const freqs = [];
    const Zre = [];
    const Zim = [];
    const Zmag = [];
    const fStart = f0 * 0.3;
    const fEnd = f0 * 3;
    for (let i = 0; i < 200; i++) {
      const f = fStart * Math.pow(fEnd / fStart, i / 199);
      freqs.push(f);
      if (state.resonatorType === 'helmholtz' && g.volume && g.neckRadius) {
        const A = Math.PI * g.neckRadius ** 2 * (g.nNecks || 1);
        const Le = g.neckLength + (g.endCorrectionModel === 'none' ? 0 : (g.endCorrectionModel === 'unflanged' ? 0.6133 : 0.8216) * g.neckRadius);
        const Z = helmholtzImpedance({ f, f0, rho: env.rho, c: env.c, volume: g.volume, neckArea: A, L_eff: Le, Q });
        Zre.push(Z.Z.re);
        Zim.push(Z.Z.im);
        Zmag.push(Z.Zmag);
      } else {
        // Generic: radiation impedance of an equivalent piston
        const a = g.diameter ? g.diameter / 2 : g.radius || g.neckRadius || 0.02;
        const rad = circularPistonRadiation({ radius: a, f, rho: env.rho, c: env.c, flanged: true });
        Zre.push(rad.Z.re);
        Zim.push(rad.Z.im);
        Zmag.push(rad.Zmag);
      }
    }
    plotImpedance(p1, {
      freqs, Zre, Zim, Zmag,
      theme: state.display.theme,
      title: state.resonatorType === 'helmholtz' ? 'Helmholtz neck impedance Z(ω)' : 'Equivalent piston radiation impedance',
    });

    // Nyquist locus
    const pNy = document.createElement('div');
    pNy.style.height = '280px';
    wrap.appendChild(pNy);
    try {
      plotNyquist(pNy, {
        Zre, Zim,
        theme: state.display.theme,
        title: 'Nyquist locus  Im Z vs Re Z',
      });
    } catch (e) {
      pNy.innerHTML = `<div class="warn-box">${escapeHtml(e.message)}</div>`;
    }

    // Absorption / reflection (normal incidence)
    const pAb = document.createElement('div');
    pAb.style.height = '280px';
    wrap.appendChild(pAb);
    try {
      const Z0 = env.rho * env.c;
      plotAbsorption(pAb, {
        freqs, Zre, Zim, Z0,
        theme: state.display.theme,
        title: 'Normal-incidence absorption',
      });
    } catch (e) {
      pAb.innerHTML = `<div class="warn-box">${escapeHtml(e.message)}</div>`;
    }

    // Impedance tube simulation
    const p2 = document.createElement('div');
    p2.style.height = '300px';
    wrap.appendChild(p2);
    const sampleF = state.science?.analysisFreq || f0;
    const tube = impedanceTubeMeasurement({
      f: sampleF,
      sampleLength: g.length || 0.05,
      Zload: { re: 200, im: 50 },
      tubeArea: 0.002,
      c: env.c,
      rho: env.rho,
      spacing: state.science?.tubeSpacing ?? 0.02,
      x1: state.science?.tubeMic1 ?? 0.05,
    });
    const meas = twoMicrophoneImpedance({
      p1: tube.p1,
      p2: tube.p2,
      spacing: tube.spacing,
      f: sampleF,
      c: env.c,
      rho: env.rho,
      x1: tube.x1,
    });
    plotSweep(p2, {
      xs: [sampleF],
      ys: [meas.absorption],
      xLabel: 'Frequency (Hz)',
      yLabel: 'Absorption α',
      theme: state.display.theme,
      title: `Two-microphone estimate @ ${sampleF.toFixed(1)} Hz · α = ${meas.absorption.toFixed(3)}`,
    });
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = `ISO 10534-2 style · |H12| = ${Math.hypot(meas.H12.re, meas.H12.im).toFixed(4)} · Z = ${meas.Z.re.toFixed(1)} + j${meas.Z.im.toFixed(1)} Pa·s/m³`;
    wrap.appendChild(note);
  } catch (err) {
    p1.innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
  }
}

function paintGeometryCanvas() {
  const canvas = $('#main-canvas');
  if (!canvas || canvas.hidden || $('#canvas-card')?.hidden) return;
  const wrap = canvas.parentElement;
  if (wrap && wrap.classList.contains('canvas-wrap')) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(600, Math.floor(rect.width * dpr));
    const h = Math.max(280, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  const state = store.get();
  const g = state.geometry;
  const theme = state.display.theme;
  const modeN = Math.max(1, Math.round(state.display.selectedMode || 1));

  if (state.resonatorType === 'tube' || state.resonatorType === 'custom') {
    drawTubeMode(canvas, {
      L: g.length,
      boundary: g.boundary,
      n: modeN,
      phase: animPhase,
      theme,
    });
  } else if (state.resonatorType === 'helmholtz') {
    const c = lastResults?.env?.c ?? 343;
    const A = Math.PI * g.neckRadius ** 2 * g.nNecks;
    const delta = g.endCorrectionModel === 'none' ? 0
      : g.endCorrectionModel === 'unflanged' ? 0.6133 * g.neckRadius : 0.8216 * g.neckRadius;
    const Le = g.neckLength + delta;
    const f0 = (c / (2 * Math.PI)) * Math.sqrt(A / (g.volume * Le));
    drawHelmholtzSchematic(canvas, {
      volume: g.volume,
      neckRadius: g.neckRadius,
      neckLength: g.neckLength,
      endCorrection: delta,
      theme,
      f0,
      phase: animPhase,
    });
  } else if (state.resonatorType === 'rectangular-cavity') {
    const modes = lastResults?.modes || [];
    const m = modes[modeN - 1] || modes[0] || { l: 1, m: 1, n: 0 };
    const field = rectangularFieldSlice({
      Lx: g.Lx, Ly: g.Ly, Lz: g.Lz,
      l: m.l ?? 1, m: m.m ?? 1, n: m.n ?? 0,
      z: g.Lz / 2, nx: 70, ny: 46,
    });
    drawHeatmap(canvas, field, {
      theme, xLabel: 'x', yLabel: 'y',
      title: `Rectangular mode (${m.l ?? 1},${m.m ?? 1},${m.n ?? 0}) slice — illustrative`,
    });
  } else if (state.resonatorType === 'cylindrical-cavity') {
    const modes = lastResults?.modes || [];
    const m = modes[modeN - 1] || modes[0] || { m: 0, p: 0, q: 1 };
    const field = cylindricalFieldSlice({
      a: g.radius, m: m.m ?? 0, p: m.p ?? 0, q: m.q ?? 1, z: 0, L: g.length,
    });
    drawHeatmap(canvas, field, {
      theme, xLabel: 'r', yLabel: 'φ',
      title: `Cylindrical mode (${m.m ?? 0},${m.p ?? 0},${m.q ?? 1}) slice — illustrative`,
    });
  } else {
    // Generic info canvas for advanced types
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const bg = theme === 'light' ? '#f7f8fb' : '#12161f';
    const ink = theme === 'light' ? '#151a22' : '#e8ecf4';
    const muted = theme === 'light' ? '#5c677a' : '#8b95a8';
    const accent = theme === 'light' ? '#1a6fed' : '#3d8bfd';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const labels = {
      'spherical-cavity': 'Spherical cavity — rigid-wall modes (j_l′ roots)',
      'annular-cavity': 'Annular cavity — Bessel Wronskian radial roots',
      'side-branch': 'Side-branch stub — reactive duct load',
      mpp: 'Micro-perforated panel — Maa transfer impedance',
      horn: 'Horn — Webster input impedance / cutoff',
      'duct-chain': 'Duct chain — transfer-matrix cascade',
      coupled: 'Coupled modes — see Analysis tab',
    };
    const title = labels[state.resonatorType] || state.resonatorType;
    ctx.fillStyle = accent;
    ctx.font = '600 18px "Segoe UI", sans-serif';
    ctx.fillText(title, 36, 48);
    ctx.fillStyle = muted;
    ctx.font = '13px "Segoe UI", sans-serif';
    const f0 = lastResults?.modes?.[0]?.f;
    if (f0 != null) ctx.fillText(`Primary / analysis frequency: ${f0.toFixed(2)} Hz`, 36, 84);
    ctx.fillText('See Geometry schematic and Scientific analysis panels for full metrics.', 36, 112);
    ctx.fillText('Harmonic animations apply to tube / Helmholtz / cavity field views.', 36, 138);
    void ink;
    void modeN;
  }
}

function renderFemResults() {
  const box = $('#right-panel-body');
  if (!box) return;
  if (!lastFemStudy || lastFemStudy.error) {
    if ($('#guide-current')) $('#guide-current').textContent = '';
    const heading = lastFemStudy?.pending ? 'Solving your geometry' : lastFemStudy?.error?.includes('cancelled') ? 'Solve cancelled' : 'Check your setup';
    box.innerHTML = `<div class="fem-summary"><span class="guide-eyebrow">FEM STUDY</span><h3>${heading}</h3><p>${escapeHtml(lastFemStudy?.error || 'Choose a study source and valid geometry, then click Solve FEM.')}</p></div>`;
    return;
  }
  const { result, comparison, selectedMode } = lastFemStudy;
  const mode = result.modes[selectedMode - 1];
  const current = $('#guide-current');
  if (current) current.textContent = `Current FEM field: Mode ${selectedMode} · ${mode.f.toFixed(2)} Hz`;
  if (result.kind === 'helmholtz-axisymmetric') {
    const g = result.geometry, rows = lastFemStudy.convergence || [];
    const performance=result.performance,app=performance?.application||'tune',peak=performance?.peak;
    const headline=app==='absorber'?`Peak absorption: ${peak?(100*peak.alpha).toFixed(1)+'%':'unresolved'}`
      :app==='duct'?`Peak transmission loss: ${peak?peak.TLdB.toFixed(2)+' dB':'unresolved'}`
      :`Isolated peak: ${result.response?.peak?result.response.peak.f.toFixed(2)+' Hz':'unresolved'}`;
    if(current&&lastFemStudy.fieldKind==='driven'&&result.response?.peak)current.textContent=`Driven isolated peak field: ${result.response.peak.f.toFixed(2)} Hz · normalized pressure snapshot`;
    const change = rows.length > 1 ? 100 * Math.abs(rows.at(-1).f - rows.at(-2).f) / rows.at(-2).f : null;
    box.innerHTML = `<div class="fem-summary"><span class="guide-eyebrow">YOUR HELMHOLTZ RESONATOR · FEM</span>
      <h3>${headline}</h3>
      <p>${app==='tune'?'Isolated response with the selected losses.':`Mounted peak: ${peak?peak.f.toFixed(2)+' Hz':'unresolved'}. ${escapeHtml(performance.assumptions)}`}</p>
      <table class="result-table"><tbody>
        <tr><th>Cavity volume</th><td>${(g.volume * 1000).toPrecision(4)} L</td></tr>
        <tr><th>Cavity radius / height</th><td>${(g.radius * 1000).toFixed(2)} / ${(g.height * 1000).toFixed(2)} mm</td></tr>
        <tr><th>Neck radius / length</th><td>${(g.neckRadius * 1000).toFixed(2)} / ${(g.neckLength * 1000).toFixed(2)} mm</td></tr>
        <tr><th>Mesh</th><td>${result.mesh.level} · ${result.mesh.triangles.length} triangles</td></tr>
        <tr><th>Lumped estimate</th><td>${result.comparison.lumpedHz === null ? 'Undefined for this aperture' : result.comparison.lumpedHz.toFixed(2) + ' Hz'}</td></tr>
        <tr><th>FEM vs lumped</th><td>${result.comparison.difference === null ? '—' : (result.comparison.difference * 100).toFixed(2) + '% · model difference'}</td></tr>
        ${change !== null ? `<tr><th>Medium → fine change</th><td>${change.toFixed(3)}% · fundamental</td></tr>` : ''}
      </tbody></table>
      <p>${escapeHtml(g.boundary)}</p>
      <p>Isolated reference: ${result.response ? `damped peak ${result.response.peak ? result.response.peak.f.toFixed(3) + ' Hz' : 'unresolved'}; bandwidth Q ${result.response.Q === null ? 'unresolved' : result.response.Q.toFixed(2)}. Lossless mode ${selectedMode}: ${mode.f.toFixed(2)} Hz.` : escapeHtml(result.responseError || 'Solve FEM to update the driven response.')}</p>
      ${result.performanceError?`<p class="model-warning">${escapeHtml(result.performanceError)}</p>`:''}
      <p>Axisymmetric modes only. Changing the design rebuilds this mesh. Check mesh convergence before relying on a result.</p></div>`;
    return;
  }
  const error = Math.max(...comparison.map((row) => row.relErr)) * 100;
  box.innerHTML = `<div class="fem-summary"><span class="guide-eyebrow">FEM STUDY · RIGID RECTANGLE</span>
    <h3>Mode ${selectedMode}: ${mode.f.toFixed(2)} Hz</h3>
    <p>${selectedMode === 1 ? 'This is the static uniform field. Select Mode 2 or higher to see an oscillating mode.' : 'The pressure field shown in the workspace belongs to this mode.'}</p>
    <table class="result-table"><tbody>
      <tr><th>Rectangle</th><td>${result.grid.Lx} × ${result.grid.Ly} m</td></tr>
      <tr><th>Mesh nodes</th><td>${result.grid.Nx} × ${result.grid.Ny}</td></tr>
      <tr><th>Largest error</th><td>${error.toFixed(2)}%</td></tr>
      <tr><th>Boundary</th><td>All walls rigid</td></tr>
    </tbody></table>
    <p>${error > 2 ? 'Refine the mesh: one or more frequencies differ by more than 2% from the reference.' : 'The eight displayed modes agree within 2% of the analytical reference. Refine the mesh to confirm convergence.'}</p>
    <p>Pressure is normalized. No damping, Q, or absolute sound level is solved in this study.</p>
    <p>Save keeps these study settings. CSV and report exports from this view contain FEM results.</p></div>`;
}

function renderResults(state, env, results) {
  if (state.display.tab === 'fem') { renderFemResults(); return; }
  const box = $('#right-panel-body') || $('#right-panel');
  const parts = [];
  const freqU = state.display.freqUnit || 'Hz';
  const fScale = freqUnitScale(freqU);
  const fmtF = (hz) => (hz / fScale).toFixed(hz / fScale >= 100 ? 1 : 3);

  // KPI cards
  const f0 = results.modes[0]?.f;
  const Q = results.damping?.Q;
  const bw = results.damping?.bandwidth;
  const lambda = results.modes[0]?.lambda;

  parts.push('<div class="kpi-grid">');
  if (f0 != null && Number.isFinite(f0)) {
    parts.push(
      `<div class="kpi">
        <div class="kpi-label">${t('kpi.primaryF')}</div>
        <div class="kpi-value accent">${fmtF(f0)}<span class="kpi-unit">${freqU}</span></div>
        <div class="kpi-sub">${escapeHtml(results.modes[0]?.label || t('res.mode1'))}</div>
      </div>`
    );
  }
  if (Q != null) {
    const qTxt = Number.isFinite(Q) ? Q.toFixed(1) : '∞';
    const qCls = Number.isFinite(Q) ? 'ok' : '';
    parts.push(
      `<div class="kpi">
        <div class="kpi-label">${t('kpi.loadedQ')}</div>
        <div class="kpi-value ${qCls}">${qTxt}</div>
        <div class="kpi-sub">${t('kpi.qRule')}</div>
      </div>`
    );
  }
  if (bw != null && Number.isFinite(bw)) {
    parts.push(
      `<div class="kpi">
        <div class="kpi-label">${t('kpi.bandwidth')}</div>
        <div class="kpi-value">${(bw / fScale).toFixed(2)}<span class="kpi-unit">${freqU}</span></div>
        <div class="kpi-sub">${t('kpi.halfPower')}</div>
      </div>`
    );
  }
  if (lambda != null && Number.isFinite(lambda)) {
    parts.push(
      `<div class="kpi">
        <div class="kpi-label">${t('kpi.wavelength')}</div>
        <div class="kpi-value">${lambda.toFixed(3)}<span class="kpi-unit">m</span></div>
        <div class="kpi-sub">${t('kpi.atRes')}</div>
      </div>`
    );
  }
  parts.push('</div>');

  const typeLabel = state.resonatorType.replace(/-/g, ' ');
  parts.push(`<div class="result-badge"><span class="dot"></span>${escapeHtml(typeLabel)}</div>`);

  if (results.warnings?.length) {
    parts.push(results.warnings.map((w) => `<div class="warn-box">${escapeHtml(w)}</div>`).join(''));
  }

  parts.push(`<div class="result-section-title">${t('res.geometry')}</div>`);
  parts.push('<table class="result-table"><tbody>');
  for (const row of results.summary) {
    parts.push(`<tr><th>${escapeHtml(row.k)}</th><td>${escapeHtml(String(row.v))}${row.note ? `<div class="note">${escapeHtml(row.note)}</div>` : ''}</td></tr>`);
  }
  parts.push('</tbody></table>');

  if (results.modes.length) {
    parts.push(`<div class="result-section-title">${t('res.modeTable')}</div>`);
    parts.push('<div class="table-scroll"><table class="result-table modes"><thead><tr><th>#</th><th>Label</th><th>f</th><th>λ</th><th>Pressure nodes</th><th>Pressure antinodes</th></tr></thead><tbody>');
    results.modes.slice(0, 20).forEach((m, i) => {
      const nodes = (m.nodes || []).map((x) => Number(x).toFixed(3)).join(', ') || '—';
      const anti = (m.antinodes || []).map((x) => Number(x).toFixed(3)).join(', ') || '—';
      parts.push(`<tr><td>${i + 1}</td><td>${escapeHtml(m.label || String(m.n ?? ''))}</td><td class="mono">${Number(m.f).toFixed(2)}</td><td class="mono">${m.lambda != null ? Number(m.lambda).toFixed(3) : '—'}</td><td class="mono">${escapeHtml(nodes)}</td><td class="mono">${escapeHtml(anti)}</td></tr>`);
    });
    parts.push('</tbody></table></div>');
    parts.push('<p class="note" style="margin:6px 0 0">Pressure nodes/antinodes — not particle-velocity nodes. Velocity nodes sit at pressure antinodes.</p>');
  }

  if (results.damping) {
    const d = results.damping;
    parts.push(`<div class="result-section-title">${t('sec.damp')}</div>`);
    parts.push('<table class="result-table"><tbody>');
    parts.push(`<tr><th>${t('kpi.loadedQ')}</th><td class="mono">${Number.isFinite(d.Q) ? d.Q.toFixed(2) : '∞'}</td></tr>`);
    parts.push(`<tr><th>${t('kpi.bandwidth')}</th><td class="mono">${Number.isFinite(d.bandwidth) ? d.bandwidth.toFixed(3) : '—'} Hz</td></tr>`);
    parts.push(`<tr><th>τ amplitude</th><td class="mono">${Number.isFinite(d.tauAmplitude) ? d.tauAmplitude.toFixed(4) : '—'} s</td></tr>`);
    parts.push(`<tr><th>τ energy</th><td class="mono">${Number.isFinite(d.tauEnergy) ? d.tauEnergy.toFixed(4) : '—'} s</td></tr>`);
    if (d.mechanisms?.length) {
      for (const m of d.mechanisms) {
        parts.push(`<tr><th>${escapeHtml(m.name)}</th><td class="mono">${Number.isFinite(m.Q) ? m.Q.toFixed(1) : '∞'}</td></tr>`);
      }
    }
    parts.push('</tbody></table>');
  }

  parts.push(`<div class="result-section-title">${t('res.assumptions')}</div><ul class="assump">`);
  for (const a of results.assumptions || []) {
    parts.push(`<li>${escapeHtml(a)}</li>`);
  }
  parts.push('<li>Analytical / lumped models — not full-wave FEM/FDTD</li>');
  parts.push('<li>Schematic animations are illustrative</li>');
  parts.push('</ul>');

  parts.push('<div class="result-section-title">Value class</div><p class="note">Calculated from labeled models. Distinguish from measured Q when provided. Approximate estimates (viscous/thermal/radiation Q) are marked “(est.)”.</p>');

  box.innerHTML = parts.join('');
}

function ensureResults() {
  const r = lastResults || recompute(true);
  if (r && r.env) return r;
  const state = store.get();
  const env = environmentFromState(state);
  return { summary: [], modes: [], primary: null, assumptions: [], warnings: [], damping: null, env, state };
}

function exportModes() {
  if (store.get().display.tab === 'fem') {
    if (!lastFemStudy?.result || lastFemStudy.error) { showError('Solve a valid FEM study before exporting.'); return; }
    const r = lastFemStudy.result;
    downloadModesCSV(r.modes, r.kind === 'helmholtz-axisymmetric'
      ? { study: 'Helmholtz axisymmetric FEM', ...r.geometry, triangles: r.mesh.triangles.length,
        c_m_s: r.c, method: r.formula, boundaries: r.geometry.boundary }
      : { study: 'FEM 2D rigid rectangle', ...r.grid, c_m_s: environmentFromState(store.get()).c,
        method: 'Q1 consistent mass', boundaries: 'all rigid' }, 'fem-modes.csv');
    flashMessage($('#status'), 'FEM modes CSV downloaded'); return;
  }
  const r = ensureResults();
  downloadModesCSV(r.modes, {
    project: store.get().projectName,
    type: store.get().resonatorType,
    c_m_s: r.env.c,
    temperature_C: r.env.temperatureC,
  }, 'resonator-modes.csv');
  flashMessage($('#status'), 'Modes CSV downloaded');
}

function exportResponse() {
  if (store.get().display.tab === 'fem') {
    if (store.get().fem.application !== 'tune' && store.get().fem.source !== 'rectangle') {
      const p=lastFemStudy?.result?.performance;
      if(!p||lastFemStudy.error){flashMessage($('#status'),'Solve the current application before exporting.',6000);return;}
      downloadApplicationPerformanceCSV(p);return;
    }
    const response = lastFemStudy?.result?.response;
    if (!response || lastFemStudy.error) { flashMessage($('#status'), 'Solve a Helmholtz FEM response before exporting.', 6000); return; }
    downloadResponseCSV(response, { project: store.get().projectName, note: response.note, Q_half_power: response.Q ?? 'unresolved', losses: JSON.stringify(response.losses) }, 'resonlab-fem-response.csv'); return;
  }
  const r = ensureResults();
  const resp = r._resp || computeResponse(store.get(), r.env, r);
  downloadResponseCSV(resp, {
    project: store.get().projectName,
    note: resp.note,
  }, 'frequency-response.csv');
  flashMessage($('#status'), 'Response CSV downloaded');
}

function exportReport() {
  if (store.get().display.tab === 'fem') {
    if (!lastFemStudy?.result || lastFemStudy.error) { showError('Solve a valid FEM study before exporting.'); return; }
    downloadReport(buildFemReport({ projectName: store.get().projectName, env: environmentFromState(store.get()),
      result: lastFemStudy.result, comparison: lastFemStudy.comparison, convergence: lastFemStudy.convergence }), 'fem-study-report.txt');
    flashMessage($('#status'), 'FEM study report downloaded'); return;
  }
  const r = ensureResults();
  const text = buildReport({
    state: store.get(),
    env: r.env,
    results: r,
  });
  downloadReport(text);
  flashMessage($('#status'), 'Report downloaded');
}

function exportPlotPNG() {
  if (store.get().display.tab === 'fem' && lastFemStudy?.result?.kind === 'helmholtz-axisymmetric') {
    flashMessage($('#status'), 'Use “Export field SVG” below the FEM field for its vector image.', 6000); return;
  }
  const host = $('#plot-area .js-plotly-plot');
  if (!host || !getPlotly()) {
    flashMessage($('#status'), 'No plot available to export');
    return;
  }
  downloadPlotPNG(host, `${store.get().display.tab}-plot.png`);
  flashMessage($('#status'), 'Plot PNG downloaded');
}

async function copyResults() {
  if (store.get().display.tab === 'fem') {
    if (!lastFemStudy?.result || lastFemStudy.error) { showError('Solve a valid FEM study before copying.'); return; }
    await copyText(buildFemReport({ projectName: store.get().projectName, env: environmentFromState(store.get()),
      result: lastFemStudy.result, comparison: lastFemStudy.comparison, convergence: lastFemStudy.convergence }));
    flashMessage($('#status'), t('res.copied')); return;
  }
  const r = ensureResults();
  const lines = [
    `Project: ${store.get().projectName}`,
    `Type: ${store.get().resonatorType}`,
    ...r.summary.map((s) => `${s.k}: ${s.v}`),
    `Q: ${Number.isFinite(r.damping?.Q) ? r.damping.Q.toFixed(2) : (r.damping?.Q ?? '—')}`,
  ];
  await copyText(lines.join('\n'));
  flashMessage($('#status'), t('res.copied'));
}

function importProject() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = parseProjectJSON(text);
      store.loadProject(data);
      $('#project-name').value = store.get().projectName;
      rebuildLeftPanel();
      flashMessage($('#status'), `Imported: ${file.name}`);
    } catch (err) {
      showError(err.message);
    }
  });
  input.click();
}

function runTestsInline() {
  const report = runPhysicsValidation();
  const text = formatValidationReport(report);
  const box = $('#test-output');
  box.hidden = false;
  box.textContent = text;
  flashMessage($('#status'), `Tests: ${report.passed}/${report.total} passed`);
}

function showError(msg) {
  const s = $('#status');
  if (s) {
    s.textContent = msg;
    s.hidden = false;
    s.classList.add('error');
  }
  console.warn(msg);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
