/** Task-oriented help and discovery. All existing analysis tools remain available. */
export const TOOL_GUIDES = [
  { id: 'geometry', title: 'Design a resonator', group: 'Start', question: 'What frequency will my design resonate at?',
    description: 'Start a Helmholtz FEM application, or explore the analytical models and examples.',
    steps: ['Choose a model in Setup, or load one of the examples above.', 'Enter your dimensions. Results update automatically; there is no Run button.', 'Read the first resonance in Results, then open Modes to see the pressure pattern.'],
    read: 'Primary frequency is the first predicted resonance. The schematic shows the dimensions; open Modes for a pressure-field preview where supported.',
    limit: 'The main results use analytical models. FEM 2D can solve the actual cylindrical Helmholtz cavity and its single coaxial neck.',
    help: 'types', next: 'modes', keywords: 'tube pipe bottle helmholtz cavity geometry inverse target tune dimensions neck volume' },
  { id: 'modes', title: 'Explore modes', group: 'Understand', question: 'Where are the pressure nodes?',
    description: 'See the resonance spectrum and the pressure pattern of a selected mode.',
    steps: ['Set up a resonator in Design.', 'For tubes and rectangular/cylindrical cavities, change “Visualize mode #” in Setup to select a pattern.', 'Compare the spectrum with the modal table in Results. A field preview is shown for supported shapes.'],
    read: 'A pressure node has zero pressure variation. An antinode has the largest variation. Each spectrum marker is a predicted mode.',
    limit: 'Mode shapes are normalized; colors and animation do not predict an absolute sound level.',
    help: 'cavities', next: 'response', keywords: 'mode shape eigenfrequency nodes antinodes spectrum harmonics pressure field' },
  { id: 'response', title: 'Frequency response', group: 'Understand', question: 'How does the response change with frequency?',
    description: 'Inspect resonance peaks, phase, and peak width over a frequency range.',
    steps: ['Set Start and Stop frequency in the Frequency sweep settings.', 'Choose a range that contains the resonance shown in Results.', 'Open Damping to change Q and compare how wide the peaks become.'],
    read: 'Peaks indicate a strong normalized response. Wider peaks indicate greater damping; the phase curve shows the relative phase shift.',
    limit: 'This is an engineering modal-response estimate, not a driven FEM calculation or calibrated sound-pressure level.',
    help: 'tabs', next: 'damping', keywords: 'response frequency sweep peak lorentzian phase group delay amplitude bandwidth' },
  { id: 'damping', title: 'Damping & Q', group: 'Understand', question: 'How sharp is the resonance, and how long does it ring?',
    description: 'Explore loss channels, linewidth, and decay time.',
    steps: ['Set Intrinsic Q from a known internal-loss value, or keep the default.', 'Enable the loss estimates you want to include. Enter Leak Q before enabling Leak.', 'Compare loaded Q, bandwidth, and decay time in Results.'],
    read: 'Higher Q gives a narrower peak and longer ringing. Loaded Q combines all enabled loss channels.',
    limit: 'Loss estimates are approximate. A measured loaded Q already includes losses; avoid adding the same losses again as separate estimates.',
    help: 'damping', next: 'response', keywords: 'q quality factor damping bandwidth decay ringdown viscous thermal radiation loss leak linewidth' },
  { id: 'fem', title: 'FEM 2D', group: 'Simulate', question: 'What are my FEM resonance, Q and response?',
    description: 'Solve your Helmholtz cavity and neck, or find dimensions for target frequency and Q within size limits using FEM. Compare response, Q and mounted performance.',
    steps: ['Choose Tune a resonance, Absorb sound, or Reduce duct noise. Enter the target and the mounting dimensions shown for that task.', 'Set dimensions in Setup, or enter frequency, isolated Q and overall size limits, select adjustable dimensions, and click Find dimensions with FEM. Review the verified proposal and Apply it. Open Losses & sweep settings if needed; Solve FEM evaluates your current geometry.', 'Read the application result and compare lumped, lossless and isolated damped frequencies. Check mesh convergence before relying on frequency, Q or mounted performance. Inspect fields, impedance and reference checks in the expandable sections.'],
    read: 'Pressure gain and Q describe the isolated reference. Absorption needs a defined panel cell; duct transmission loss needs a defined duct. Application exports contain the selected performance quantity.',
    limit: 'Supports a cylindrical cavity and one circular coaxial neck, with axisymmetric modes and an approximate open-mouth correction. Radiation uses a low-ka impedance; wall losses use thin boundary layers. No exterior mesh or full thermoviscous flow. Rectangle verification remains available.',
    help: 'fem', next: 'geometry', keywords: 'fem finite element mesh numerical solver helmholtz cavity neck actual geometry axisymmetric rectangle convergence neumann eigenmode simulation inverse automatic target dimensions optimization' },
  { id: 'sweeps', title: 'Compare dimensions', group: 'Investigate', question: 'Which dimension should I change?',
    description: 'Vary a geometry parameter and see how the first resonance moves.',
    steps: ['Choose the parameter under Sweep settings.', 'Set a physically valid minimum and maximum. Geometry values use SI units: metres, m³, or the named dimensionless value.', 'Read the curve to find a useful range, then enter your chosen value in Design.'],
    read: 'Each point is a separate model calculation. The curve shows the trend; it does not apply a new design automatically.',
    limit: 'Use positive dimensions and stay within the assumptions of your resonator model.',
    help: 'science', next: 'geometry', keywords: 'sweep compare dimension length radius diameter volume parameter minimum maximum optimize sensitivity' },
  { id: 'coupling', title: 'Coupled resonators', group: 'Investigate', question: 'What happens when two modes interact?',
    description: 'Explore avoided crossings and frequency splitting for a pair of resonators.',
    steps: ['Choose Coupled resonators in Setup, or use the coupled-pair example.', 'Set the two uncoupled frequencies and the coupling in Hz.', 'Compare the two coupled branches. Enable the coupling sweep for splitting versus coupling.'],
    read: 'Near equal uncoupled frequencies, the two branches separate. The minimum splitting is twice the coupling in this model.',
    limit: 'Coupling is a phenomenological value in Hz, not a neck size or a geometry-based FEM coupling.',
    help: 'coupling', next: 'response', keywords: 'coupled coupling avoided crossing splitting detuning two modes' },
  { id: 'science', title: 'Sensitivity & uncertainty', group: 'Investigate', question: 'How much should I trust a predicted frequency?',
    description: 'Inspect parameter sensitivity, uncertainty, poles, and saved-case comparisons.',
    steps: ['Start with a valid design, then set the geometry uncertainty percentage.', 'Compare the sensitivity chart with the Monte Carlo frequency distribution.', 'Use Save case in the research tools before changing a design, then save a second case to compare.'],
    read: 'Sensitivity ranks influential dimensions. The histogram shows variation from the assumed input uncertainty, not an experimental confidence guarantee.',
    limit: 'Monte Carlo does not account for missing physics or systematic errors in the model.',
    help: 'science', next: 'sweeps', keywords: 'science research poles complex monte carlo uncertainty sensitivity tornado histogram case compare bootstrap prony export package' },
  { id: 'impedance', title: 'Impedance', group: 'Investigate', question: 'How does the resonator load the sound field?',
    description: 'Inspect resistance, reactance, reflection, and a synthetic two-microphone example.',
    steps: ['Use a Helmholtz resonator for a neck-impedance study.', 'Set Analysis frequency under Scientific analysis for the two-microphone example.', 'Inspect real and imaginary impedance, then compare the reflection and absorption plots.'],
    read: 'The real part represents resistance and the imaginary part represents reactance. The two-microphone example uses a known synthetic load.',
    limit: 'Other primary models show an equivalent piston approximation. The synthetic load is a demonstration, not a measurement of your geometry.',
    help: 'impedance', next: 'audio', keywords: 'impedance resistance reactance reflection absorption nyquist radiation microphone load' },
  { id: 'audio', title: 'Audio tube demo', group: 'Investigate', question: 'How does two-microphone impedance recovery work?',
    description: 'Recover a known synthetic load from two simulated microphone signals.',
    steps: ['The synthetic example runs automatically; no microphone access is needed.', 'Compare the recovered impedance with the known load of 250 − j40 Pa·s/m.', 'Use Run synthetic sweep to repeat the example. Live mic only starts and stops capture.'],
    read: 'A successful synthetic recovery returns the known load. Absorption is the fraction of incident energy not reflected in this example.',
    limit: 'Live capture does not compute impedance. Calibrated, synchronized two-channel measurement is not implemented.',
    help: 'impedance', next: 'impedance', keywords: 'audio tube microphone mic measurement synthetic calibration live capture' },
];

export const STUDY_RECIPES = [
  { id: 'inverse', title: 'Tune to a target frequency', group: 'Design', question: 'What dimensions will give me the frequency I want?',
    description: 'Use Helmholtz inverse design to solve for cavity volume, neck length, or neck radius.',
    help: 'helmholtz', action: 'inverse', keywords: 'inverse target tune desired frequency solve volume neck dimensions' },
  { id: 'export', title: 'Save, reopen & export', group: 'Keep your work', question: 'How do I save a study or share its results?',
    description: 'Save a project for later, reopen it with Import, or download CSV, a report, and a plot.',
    help: 'export', action: 'help', keywords: 'save download export report csv json project import reopen share png copy clipboard' },
  { id: 'validation', title: 'Check the calculations', group: 'Reference', question: 'How are the physics calculations checked?',
    description: 'Learn what the validation suite covers and how to run it from Export → Run tests.',
    help: 'validation', action: 'help', keywords: 'tests testing validate validation verification benchmark check physics' },
];

export const MODEL_GUIDES = {
  tube: 'Start with Length and Internal diameter, then choose whether each end is open or closed. A longer tube usually resonates at a lower frequency.',
  custom: 'This uses the tube model. Set Length, Internal diameter, and the end conditions.',
  helmholtz: 'Set cavity volume, neck radius, and neck length. A larger cavity lowers the resonance. To aim for a frequency, open Inverse design below.',
  'rectangular-cavity': 'Set the three inside dimensions of the cavity. Walls are assumed rigid. Modes can vary along any of the three directions.',
  'cylindrical-cavity': 'Set the inside radius and axial length. The model assumes a closed cylinder with rigid walls.',
  'spherical-cavity': 'Set the inside radius of a closed sphere. Walls are rigid; some frequencies have several distinct mode shapes.',
  'annular-cavity': 'Set inner radius, outer radius, and axial length. The inner radius must be smaller than the outer radius.',
  'side-branch': 'Set branch length and diameter. Quarter-wave means one closed end; half-wave means two open ends.',
  mpp: 'Set hole diameter, panel thickness, open-area fraction (porosity), and backing depth. This is an absorber impedance model.',
  horn: 'Set the throat and mouth radii, length, and profile. This is an approximate horn model; characteristic frequencies are not a solved resonance spectrum.',
  'duct-chain': 'Set each segment’s length and cross-sectional area. Analysis frequency selects where the transfer matrix is evaluated; it is not a solved resonance.',
  coupled: 'Enter each uncoupled frequency and the coupling in Hz. Use different Q values to represent different internal losses.',
};

export function guideFor(id) { return TOOL_GUIDES.find((tool) => tool.id === id) || TOOL_GUIDES[0]; }

export const SWEEP_PARAMETERS = {
  length: ['Length', 'm'], diameter: ['Internal diameter', 'm'], volume: ['Cavity volume', 'm³'],
  neckRadius: ['Neck radius', 'm'], neckLength: ['Neck length', 'm'], radius: ['Radius', 'm'],
  Lx: ['Cavity Lx', 'm'], f1: ['Uncoupled frequency 1', 'Hz'], couplingHz: ['Coupling', 'Hz'],
  branchLength: ['Branch length', 'm'], porosity: ['Open-area fraction', 'fraction'],
  holeDiameter: ['Hole diameter', 'm'], panelThickness: ['Panel thickness', 'm'], backedDepth: ['Backing depth', 'm'],
  seg1Length: ['Segment 1 length', 'm'], seg2Length: ['Segment 2 length', 'm'], seg3Length: ['Segment 3 length', 'm'],
};

export function sweepSetup(state) {
  const keys = Object.keys(SWEEP_PARAMETERS).filter((key) => Number.isFinite(state.geometry[key]));
  const requested = state.science?.sweepParam;
  const key = keys.includes(requested) ? requested : keys[0];
  const value = state.geometry[key];
  const known = key === requested;
  return { keys, key, min: known ? state.science.sweepMin ?? value * 0.5 : value * 0.5,
    max: known ? state.science.sweepMax ?? (value > 0 ? value * 1.5 : 1) : value > 0 ? value * 1.5 : 1 };
}

export function matchingTools(query) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return [...TOOL_GUIDES, ...STUDY_RECIPES].filter((tool) => words.every((word) =>
    `${tool.title} ${tool.question} ${tool.description} ${tool.keywords}`.toLowerCase().includes(word)));
}

const el = (tag, className, text) => Object.assign(document.createElement(tag), { className, ...(text == null ? {} : { textContent: text }) });
const action = (label, fn, className = 'btn') => {
  const b = el('button', className, label); b.type = 'button'; b.addEventListener('click', fn); return b;
};

export function renderStudyGuide(host, state, { navigate, editSettings, help, startExample, startApplication, library }) {
  const key = `${state.display.tab}/${state.resonatorType}/${state.fem?.source || 'resonator'}`;
  if (host.dataset.guide === key) return;
  host.dataset.guide = key;
  host.replaceChildren();
  let guide = guideFor(state.display.tab);
  if (guide.id === 'fem' && state.fem?.source === 'rectangle') guide = { ...guide,
    question: 'How accurate is the rectangle benchmark?', description: 'Verify the numerical method against a closed rigid rectangle.',
    steps: ['Enter the independent rectangle dimensions Lx/Ly and mesh nodes Nx/Ny.', 'Click Solve FEM and compare each frequency with the analytical reference.', 'Increase the mesh resolution and check that the frequencies settle. Mode 1 is the static uniform field.'],
    read: 'This benchmark has exact reference frequencies. Its frequency differences are discretization errors, unlike a Helmholtz-versus-lumped model comparison.',
    limit: 'This optional benchmark is independent of the resonator. Choose Current resonator geometry to solve the Helmholtz cavity and neck.' };
  host.append(el('div', 'guide-eyebrow', 'YOUR STUDY · ' + guide.group.toUpperCase()), el('h1', '', guide.question), el('p', 'guide-purpose', guide.description));
  if (guide.id === 'geometry') {
    if(startApplication){
      const applications=el('div','study-starters application-start');
      for(const [key,title,text] of [['tune','Tune a resonance','Find frequency, pressure gain and Q.'],['absorber','Absorb sound','Evaluate a defined resonator panel.'],['duct','Reduce duct noise','Evaluate an ideal side-branch installation.']]){
        const b=action('',()=>startApplication(key),'study-starter');b.append(el('strong','',title),el('span','',text));applications.append(b);
      }
      host.append(el('h2','','What do you want to achieve?'),applications);
    }
    const starters = el('div', 'study-starters');
    for (const [label, description, type] of [
      ['Try a tube', 'Change its length and see the pitch move.', 'tube'],
      ['Try a Helmholtz resonator', 'Explore a cavity with a narrow neck.', 'helmholtz'],
      ['Try 2D FEM', 'Mesh a Helmholtz cavity and its neck.', 'fem'],
    ]) {
      const b = action('', () => startExample(type), 'study-starter');
      b.append(el('strong', '', label), el('span', '', description)); starters.append(b);
    }
    const examples=el('details','guide-instructions');examples.append(el('summary','','Explore analytical models & examples'),starters);host.append(examples);
  }
  const details = el('details', 'guide-instructions');
  details.open = guide.id !== 'fem';
  const summary = el('summary', '', 'How to use this view');
  const steps = el('ol', 'guide-steps');
  guide.steps.forEach((step) => steps.append(el('li', '', step)));
  details.append(summary, steps, el('p', 'guide-reading', 'What to look for: ' + guide.read));
  host.append(details, el('p', 'guide-limit', guide.limit));
  const result = el('p', 'guide-current'); result.id = 'guide-current';
  result.setAttribute('aria-live', 'polite'); host.append(result);
  const actions = el('div', 'guide-actions');
  actions.append(action(guide.id === 'audio' ? 'Edit medium settings' : 'Edit study settings', editSettings, 'btn btn-secondary'));
  if (guide.id === 'coupling' && state.resonatorType !== 'coupled') actions.append(action('Load coupled-pair example', () => startExample('coupled'), 'btn btn-primary'));
  const modelTopic = ['tube', 'custom'].includes(state.resonatorType) ? 'tubes'
    : state.resonatorType === 'helmholtz' ? 'helmholtz'
      : state.resonatorType.includes('cavity') ? 'cavities'
        : state.resonatorType === 'coupled' ? 'coupling' : 'advanced';
  actions.append(action('Read the guide', () => help(['geometry', 'modes'].includes(guide.id) ? modelTopic : guide.help)), action('All tools', library));
  actions.append(action('Next: ' + guideFor(guide.next).title, () => navigate(guide.next), 'btn btn-ghost guide-next'));
  host.append(actions);
}

export function mountToolLibrary({ navigate, help, inverse }) {
  if (document.getElementById('tool-library')) return;
  const dialog = el('dialog', 'tool-library'); dialog.id = 'tool-library';
  dialog.setAttribute('aria-labelledby', 'tool-library-title');
  const header = el('div', 'library-head');
  const heading = el('h2', '', 'What would you like to study?'); heading.id = 'tool-library-title';
  header.append(heading, action('Close', () => dialog.close()));
  const intro = el('p', '', 'Find a tool by task, topic, or a word you have seen in the app.');
  const search = el('input', 'tool-search'); search.type = 'search'; search.placeholder = 'Search: mesh, Q, pressure nodes, uncertainty…';
  search.setAttribute('aria-label', 'Find a study tool');
  const count = el('p', 'guide-small'); count.setAttribute('role', 'status');
  const grid = el('div', 'tool-grid');
  const render = () => {
    const tools = matchingTools(search.value); grid.replaceChildren();
    count.textContent = tools.length ? `${tools.length} ${tools.length === 1 ? 'tool' : 'tools'} available` : 'No matching tool. Try “frequency”, “mesh”, “loss”, or “uncertainty”.';
    tools.forEach((tool) => {
      const card = el('article', 'tool-card');
      card.append(el('span', 'guide-eyebrow', tool.group), el('h3', '', tool.title), el('p', 'tool-question', tool.question), el('p', '', tool.description));
      const actions = el('div', 'guide-actions');
      actions.append(action('Open ' + tool.title, () => {
        dialog.close();
        if (tool.action === 'inverse') inverse();
        else if (tool.action === 'help') help(tool.help);
        else navigate(tool.id);
      }, 'btn btn-secondary'), action('How to use', () => { dialog.close(); help(tool.help); }));
      card.append(actions); grid.append(card);
    });
  };
  search.addEventListener('input', render);
  const footer = el('p', 'library-footer', 'Keep your work: Save downloads a project you can reopen with Import. Export provides CSV, a calculation report, and plots.');
  dialog.append(header, intro, search, count, grid, footer);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('show-library', () => { search.value = ''; render(); search.focus(); });
  document.body.append(dialog); render();
}

export function openToolLibrary() {
  const dialog = document.getElementById('tool-library');
  if (dialog.open) return;
  dialog.showModal(); dialog.dispatchEvent(new Event('show-library'));
}
