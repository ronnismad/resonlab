/**
 * In-app Help manual — comprehensive reference for ResonLab V1.3.
 * Pure DOM builders; no physics imports. Bilingual (EN/RU chrome + content).
 */
import { t, getLang } from './i18n.js?v=20251023';

const SECTIONS = [
  { id: 'overview', group: 'Start', label: 'Overview & quick start' },
  { id: 'interface', group: 'Start', label: 'Interface tour' },
  { id: 'units', group: 'Start', label: 'Units & environment' },
  { id: 'types', group: 'Models', label: 'Resonator types' },
  { id: 'tubes', group: 'Models', label: 'Tubes & end correction' },
  { id: 'helmholtz', group: 'Models', label: 'Helmholtz theory' },
  { id: 'cavities', group: 'Models', label: 'Cavities & modes' },
  { id: 'advanced', group: 'Models', label: 'Advanced models' },
  { id: 'tabs', group: 'Analysis', label: 'Analysis tabs' },
  { id: 'fem', group: 'Analysis', label: 'FEM 2D: first study' },
  { id: 'science', group: 'Analysis', label: 'Science stack' },
  { id: 'damping', group: 'Analysis', label: 'Damping & Q' },
  { id: 'coupling', group: 'Analysis', label: 'Coupling theory' },
  { id: 'impedance', group: 'Analysis', label: 'Impedance & measurement' },
  { id: 'export', group: 'Workflow', label: 'Export & reporting' },
  { id: 'validation', group: 'Workflow', label: 'Validation suite' },
  { id: 'assumptions', group: 'Workflow', label: 'Assumptions & limits' },
  { id: 'glossary', group: 'Workflow', label: 'Glossary' },
];

function sectionOverview() {
  return `
    <h3>Overview &amp; quick start</h3>
    <p>
      <strong>ResonLab V1.3</strong> (Acoustic Resonator Studio) — developed by
      <strong>S.Chatterjee</strong> — is a browser-based engineering studio for
      one-dimensional ducts, Helmholtz resonators, rigid-wall cavities, coupled modes,
      damping / Q budgets, complex poles, parameter sweeps, and uncertainty analysis.
      Physics modules are pure JavaScript (no backend, no API keys). Plotly is bundled locally.
    </p>
    <h4>Quick start (2 minutes)</h4>
    <ol>
      <li>In <strong>Design</strong>, choose <strong>Try a tube</strong> or <strong>Try a Helmholtz resonator</strong>. You can also choose a Resonator type in Setup.</li>
      <li>Set <strong>Environment</strong> (temperature, pressure, humidity, gas). Sound speed <em>c</em> updates automatically.</li>
      <li>Enter geometry in SI-derived display units. Invalid values are rejected with a message — never silently clamped.</li>
      <li>Read <strong>Results</strong> on the right: primary eigenfrequency, loaded Q, modal table, assumptions.</li>
      <li>Follow <strong>Next</strong> in the study guide, or open <strong>All tools</strong> to search by a task, such as “mesh”, “loss”, or “uncertainty”. Each view has its own instructions.</li>
      <li>Export CSV / JSON / report / plot PNG from the toolbar.</li>
    </ol>
    <h4>What this tool is</h4>
    <ul>
      <li>Fast parametric design &amp; teaching aid with <em>labelled</em> analytical models.</li>
      <li>Scientific analysis stack: poles, sensitivity, Monte Carlo, dimensionless groups, transfer matrices.</li>
      <li>Offline: all computation runs in your browser.</li>
    </ul>
    <h4>What this tool is not</h4>
    <ul>
      <li>FEM 2D meshes a cylindrical Helmholtz cavity and its single coaxial neck using axisymmetric triangular elements. The main resonator models remain analytical; schematic animations are <strong>illustrative</strong>.</li>
      <li>Not a substitute for certified impedance-tube measurements or standards labs.</li>
      <li>Thermoviscous losses are engineering approximations, not full linearized Navier–Stokes.</li>
    </ul>
    <div class="note"><strong>Honesty rule:</strong> every model lists its assumptions. If a result is approximate, the UI says so.</div>
  `;
}

function sectionInterface() {
  return `
    <h3>Interface tour</h3>
    <table>
      <tr><th>Region</th><th>Purpose</th></tr>
      <tr><td>Toolbar</td><td>Project name, presets, Reset / Import / Save / CSV / PNG / Report / Copy / Tests / Help / Theme</td></tr>
      <tr><td>Tab bar</td><td>Common views plus All tools: a searchable directory of every analysis tool</td></tr>
      <tr><td>Study guide</td><td>Purpose, three steps, what to look for, model limits, and the next useful view</td></tr>
      <tr><td>Setup</td><td>Settings for the current view. Show all settings reveals the complete set. On a small screen, use Edit study settings, then Done.</td></tr>
      <tr><td>Center workspace</td><td>Geometry schematic (SVG technical drawing), field/mode canvas, Plotly analysis charts</td></tr>
      <tr><td>Right panel</td><td>Primary results, KPI cards, modal frequencies, derived geometry, assumptions/formula notes</td></tr>
      <tr><td>Footer</td><td>Unit policy note, README link, physics test page</td></tr>
    </table>
    <h4>Keyboard</h4>
    <ul>
      <li><code>1</code>–<code>8</code> — switch analysis tabs</li>
      <li>Phase slider &amp; Pause — scrub / freeze the illustrative harmonic animation</li>
      <li><code>Esc</code> — close this manual</li>
    </ul>
    <h4>Theme</h4>
    <p>Dark / light toggle re-renders plots, schematics, and the canvas. Series colors use an Okabe–Ito–inspired colorblind-safe palette.</p>
  `;
}

function sectionUnits() {
  return `
    <h3>Units &amp; environment</h3>
    <h4>Unit policy</h4>
    <ul>
      <li>Internal storage is always SI: metres, hertz, pascals, kg/m³, Pa·s/m³.</li>
      <li>Display units convert on entry (mm/cm/m, Hz/kHz). Changing display units does not change physics.</li>
      <li>Exports contain SI values plus a unit column where helpful.</li>
    </ul>
    <h4>Environment</h4>
    <table>
      <tr><th>Input</th><th>Symbol</th><th>Role</th></tr>
      <tr><td>Temperature</td><td>T (°C)</td><td>Primary driver of sound speed and viscosity</td></tr>
      <tr><td>Static pressure</td><td>p (kPa)</td><td>Density via ideal gas</td></tr>
      <tr><td>Relative humidity</td><td>RH (%)</td><td>Water vapour contribution to density / c</td></tr>
      <tr><td>Gas</td><td>—</td><td>Air (default), or library gases with γ, R, μ models</td></tr>
    </table>
    <h4>Sound speed</h4>
    <div class="formula">c = √(γ R T<sub>abs</sub>)  ·  fallback labelled: c ≈ 331.3 + 0.606 T<sub>°C</sub>  (m/s)</div>
    <p>
      c is never frozen: editing T, p, RH, or gas recomputes ρ, c, μ, and every dependent frequency.
      The results panel always shows the active <em>c model</em> string.
    </p>
    <h4>Ideal-gas density</h4>
    <div class="formula">ρ = p / (R<sub>mix</sub> T<sub>abs</sub>)  (with water-vapour correction when RH &gt; 0)</div>
  `;
}

function sectionTypes() {
  return `
    <h3>Resonator types</h3>
    <p>Eleven models cover ducts, cavities, liners, horns, and coupled systems.</p>
    <table>
      <tr><th>Type</th><th>Primary output</th><th>Model class</th></tr>
      <tr><td>Tube (open/closed)</td><td>Longitudinal f<sub>n</sub>, mode shapes</td><td>1-D plane wave + end correction</td></tr>
      <tr><td>Helmholtz resonator</td><td>f<sub>0</sub>, Q, inverse design</td><td>Lumped mass–compliance</td></tr>
      <tr><td>Rectangular cavity</td><td>f<sub>lmn</sub></td><td>Rigid-wall cartesian modes</td></tr>
      <tr><td>Cylindrical cavity</td><td>f<sub>mpq</sub></td><td>Bessel J′ roots</td></tr>
      <tr><td>Spherical cavity</td><td>f<sub>nlm</sub></td><td>Spherical Bessel roots</td></tr>
      <tr><td>Annular cavity</td><td>Radial/axial modes</td><td>J′/Y′ characteristic equation</td></tr>
      <tr><td>Side-branch / quarter-wave</td><td>Stub resonances</td><td>Reactive side branch</td></tr>
      <tr><td>Micro-perforated panel</td><td>Surface impedance</td><td>Maa-type transfer impedance</td></tr>
      <tr><td>Horn (cone / exponential)</td><td>Cutoff, throat/mouth Z</td><td>Webster horn equation</td></tr>
      <tr><td>Duct chain</td><td>Cascaded input impedance</td><td>Transfer matrices</td></tr>
      <tr><td>Coupled resonators</td><td>Split modes f<sub>±</sub></td><td>Two-mode κ model</td></tr>
    </table>
    <div class="note"><strong>Selection drives the left-panel fields</strong> and the central schematic. Physics, plots, and exports all follow the active type.</div>
  `;
}

function sectionTubes() {
  return `
    <h3>Tubes &amp; end correction</h3>
    <h4>Boundary conditions</h4>
    <table>
      <tr><th>Boundary</th><th>Series</th><th>Pressure structure</th></tr>
      <tr><td>Open–open</td><td>f<sub>n</sub> = n c / (2 L<sub>eff</sub>)</td><td>Nodes at both openings</td></tr>
      <tr><td>Open–closed</td><td>f<sub>n</sub> = (2n−1) c / (4 L<sub>eff</sub>)</td><td>Node at open, antinode at wall</td></tr>
      <tr><td>Closed–closed</td><td>f<sub>n</sub> = n c / (2 L)</td><td>Antinodes at both walls</td></tr>
    </table>
    <h4>End correction</h4>
    <div class="formula">Δ = 0.8216 a  (flanged)   ·   Δ = 0.6133 a  (unflanged)   ·   a = D/2</div>
    <div class="formula">L<sub>eff</sub> = L + 2Δ  (open–open)   ·   L + Δ  (open–closed)   ·   L  (closed–closed)</div>
    <p>
      End correction accounts for the oscillating mass of air just outside an opening.
      It can be disabled in the UI (<code>applyEndCorrection</code>). The schematic shows both L and L<sub>eff</sub>.
    </p>
    <h4>Validity</h4>
    <ul>
      <li>Plane-wave (1-D) assumption: D ≪ λ, i.e. frequencies below the first cross-mode.</li>
      <li>Rigid walls for eigenfrequencies; loss enters via the Q models, not via f<sub>n</sub>.</li>
    </ul>
  `;
}

function sectionHelmholtz() {
  return `
    <h3>Helmholtz theory</h3>
    <div class="formula">f<sub>0</sub> = (c / 2π) √( A / (V L<sub>eff</sub>) )</div>
    <div class="formula">L<sub>eff</sub> = L<sub>n</sub> + Δ ,  Δ ∈ {0, 0.6133 r, 0.8216 r}</div>
    <h4>Physical picture</h4>
    <ul>
      <li>Neck air slug ≈ acoustic mass M<sub>a</sub> = ρ L<sub>eff</sub> / A</li>
      <li>Cavity volume ≈ compliance C<sub>a</sub> = V / (ρ c²)</li>
      <li>f<sub>0</sub> = 1 / (2π √(M<sub>a</sub> C<sub>a</sub>))</li>
    </ul>
    <h4>Inverse design</h4>
    <p>
      Given a target f<sub>0</sub>, the tool solves for volume, neck length, or radius by forward substitution
      (the returned geometry is re-evaluated in the forward model to verify the target).
    </p>
    <h4>Q estimate</h4>
    <p>
      Radiative, viscous neck, and thermal cavity contributions combine as
      1/Q = Σ 1/Q<sub>k</sub>. Labels mark which terms are engineering approximations.
    </p>
    <h4>Validity</h4>
    <ul>
      <li>λ ≫ cavity and neck dimensions (lumped-element regime).</li>
      <li>Linear, low-Mach oscillations.</li>
      <li>Single-neck; multi-neck uses total open area A.</li>
    </ul>
  `;
}

function sectionCavities() {
  return `
    <h3>Cavities &amp; modes</h3>
    <h4>Rectangular (rigid walls)</h4>
    <div class="formula">f<sub>lmn</sub> = (c/2) √[ (l/L<sub>x</sub>)² + (m/L<sub>y</sub>)² + (n/L<sub>z</sub>)² ]</div>
    <div class="formula">p ∝ cos(lπx/L<sub>x</sub>) cos(mπy/L<sub>y</sub>) cos(nπz/L<sub>z</sub>)</div>
    <h4>Cylindrical</h4>
    <div class="formula">f<sub>mpq</sub> = (c/2π) √[ (χ′<sub>mp</sub>/a)² + (qπ/L)² ]</div>
    <p>χ′<sub>mp</sub> are roots of J′<sub>m</sub>(χ) = 0. Degeneracy is handled explicitly in the mode table.</p>
    <h4>Spherical</h4>
    <div class="formula">f<sub>nlm</sub> = (c / 2πR) · χ<sub>nl</sub> ,  j′<sub>l</sub>(χ<sub>nl</sub>) = 0 ,  degeneracy 2l+1</div>
    <h4>Annular</h4>
    <p>
      Characteristic equation uses J′<sub>m</sub> and Y′<sub>m</sub> at inner/outer radii.
      The tool solves for the lowest roots numerically and lists them with mode indices.
    </p>
    <h4>Mode shapes</h4>
    <p>
      Field slices (rectangular / cylindrical) are sampled on a grid and drawn as normalized
      p/p<sub>max</sub> heatmaps with a diverging colorbar. These are analytic eigenfunctions, not FEM fields.
    </p>
  `;
}

function sectionAdvanced() {
  return `
    <h3>Advanced models</h3>
    <h4>Thermoviscous duct</h4>
    <p>
      Kirchhoff-style boundary-layer attenuation and complex wavenumber for circular ducts.
      Use for Q and transfer matrices; eigenfrequencies remain lossless unless noted.
    </p>
    <h4>Transfer matrices</h4>
    <div class="formula">T = [[cos kL, j Z<sub>0</sub> sin kL], [ (j/Z<sub>0</sub>) sin kL, cos kL ]]</div>
    <p>
      Complex trig uses the correct hyperbolic identities when k is complex (lossy).
      Chained segments multiply T-matrices left-to-right in flow direction.
    </p>
    <h4>Micro-perforated panel (MPP)</h4>
    <p>Maa-type transfer impedance with viscous and inertial end corrections; porosity σ, hole diameter d, thickness t.</p>
    <h4>Horns</h4>
    <p>
      Webster equation for conical and exponential profiles.
      Exponential cutoff: f<sub>c</sub> = (c/2π) m, with m = ln(a<sub>L</sub>/a<sub>0</sub>)/L.
    </p>
    <h4>Weyl mode count</h4>
    <div class="formula">N(ω) ≈ V ω³ / (6π² c³) + O(ω²)</div>
    <p>High-frequency modal density estimate for cavities (statistical acoustics).</p>
    <h4>Dimensionless groups</h4>
    <p>
      Helmholtz number ka, Strouhal-like ratios, aspect ratios, and end-correction ratios —
      useful to check whether a model regime is appropriate.
    </p>
  `;
}

function sectionTabs() {
  return `
    <h3>Analysis tabs</h3>
    <table>
      <tr><th>Tab</th><th>Key</th><th>Shows</th></tr>
      <tr><td>Geometry</td><td>1</td><td>Technical schematic, dimensions, derived lengths, summary table</td></tr>
      <tr><td>Modes</td><td>2</td><td>Modal spectrum (stem), longitudinal mode shape, nodes/antinodes</td></tr>
      <tr><td>Frequency Response</td><td>3</td><td>|H|(f), optional phase, resonance marks, peak callouts</td></tr>
      <tr><td>Damping</td><td>4</td><td>Q breakdown (1/Q ledger), half-power bandwidth, decay times</td></tr>
      <tr><td>Coupling</td><td>5</td><td>Avoided crossing, splitting vs κ, two-mode eigen</td></tr>
      <tr><td>Science</td><td>6</td><td>Complex poles, sensitivity tornado, Monte Carlo histogram, dimensionless groups</td></tr>
      <tr><td>Sweeps</td><td>7</td><td>1-D / 2-D parameter maps, extrema, slopes</td></tr>
      <tr><td>Impedance</td><td>8</td><td>Z(f), radiation / tube impedance, two-microphone estimate</td></tr>
    </table>
    <h4>Reading the charts</h4>
    <ul>
      <li>Axis titles use italic quantity symbols with SI units in parentheses.</li>
      <li>Hover shows full-precision values in scientific format.</li>
      <li>Peak callouts mark local maxima on response curves.</li>
      <li>Heatmaps include a diverging colorbar labeled with the plotted quantity.</li>
      <li>Use the Plotly modebar to zoom, pan, or download a 2× PNG.</li>
    </ul>
  `;
}

function sectionScience() {
  return `
    <h3>Science stack</h3>
    <h4>Complex poles (s-plane)</h4>
    <div class="formula">s = −σ ± j ω<sub>d</sub> ,  σ = ω<sub>0</sub>/(2Q) ,  ω<sub>d</sub> = ω<sub>0</sub>√(1−ζ²)</div>
    <p>
      The pole plot shows Re(s) vs Im(s) with the jω axis and a constant-ζ damping ray for the first mode.
      Poles in the left half-plane are stable/damped.
    </p>
    <h4>Sensitivity / elasticity</h4>
    <div class="formula">E<sub>p</sub> = (∂y/y) / (∂p/p)</div>
    <p>Tornado chart ranks parameters by |E|. Positive E means y grows with p.</p>
    <h4>Monte Carlo uncertainty</h4>
    <p>
      Input tolerances are sampled (Gaussian or uniform), propagated through the forward model,
      and summarized as μ, σ, and a histogram with mean line and ±1σ band.
      Analytic first-order propagation is also available for cross-check.
    </p>
    <h4>Two-microphone impedance</h4>
    <p>
      ISO 10534-2 style transfer-function estimate of load reflection and impedance from two microphone positions.
      Magnitude of R is constrained ≤ 1 physically; non-physical samples are flagged.
    </p>
    <h4>Modal Gram matrix</h4>
    <p>Orthogonality check for sampled mode fields: G<sub>ij</sub> = ⟨φ<sub>i</sub>, φ<sub>j</sub>⟩. Diagonal dominance indicates a well-conditioned mode set.</p>
  `;
}

function sectionDamping() {
  return `
    <h3>Damping &amp; Q</h3>
    <h4>Combination rule</h4>
    <div class="formula">1/Q<sub>load</sub> = Σ<sub>k</sub> 1/Q<sub>k</sub></div>
    <p>Independent loss mechanisms add as inverse Q (parallel damping channels).</p>
    <h4>Mechanisms</h4>
    <ul>
      <li><strong>Viscous boundary layer</strong> in ducts (thermoviscous model)</li>
      <li><strong>Thermal boundary layer</strong> in cavities</li>
      <li><strong>Radiation</strong> from openings (circular piston radiation impedance)</li>
      <li><strong>Wall / material</strong> loss (engineering estimate)</li>
      <li><strong>Custom</strong> user Q</li>
    </ul>
    <h4>Derived quantities</h4>
    <div class="formula">Δf<sub>−3dB</sub> = f<sub>0</sub> / Q ,  τ<sub>60</sub> ≈ 6.91 Q / (2π f<sub>0</sub>) ,  δ = 2π / Q</div>
    <p>
      Half-power bandwidth and decay times (T60) are computed from loaded Q.
      The Q breakdown bar chart plots 1/Q<sub>k</sub> so dominant losses are visually obvious.
    </p>
    <div class="note"><strong>Label:</strong> radiation Q at low ka can be strongly model-dependent. The UI keeps R ≥ 0 and mass-like X for circular pistons.</div>
  `;
}

function sectionCoupling() {
  return `
    <h3>Coupling theory</h3>
    <h4>Two-mode κ model</h4>
    <div class="formula">f<sub>±</sub> = (f<sub>1</sub>+f<sub>2</sub>)/2 ± √[ ((f<sub>1</sub>−f<sub>2</sub>)/2)² + κ² ]</div>
    <p>
      At zero detuning the splitting is Δf = 2κ (avoided crossing).
      The Coupling tab plots f<sub>±</sub> vs detuning and Δf vs κ with a 2κ reference line.
    </p>
    <h4>Multi-mode eigen</h4>
    <p>
      An N×N coupling matrix is diagonalized with a Jacobi eigenvalue solver.
      Recovered eigenfrequencies are validated against known analytic cases in the test suite.
    </p>
    <h4>Practical use</h4>
    <ul>
      <li>Tune coupling to set mode splitting for sensors / filters.</li>
      <li>Identify strong-coupling regimes (κ comparable to |f1−f2|).</li>
      <li>Inverse: estimate κ from measured splitting via <code>couplingFromSplitting</code>.</li>
    </ul>
  `;
}

function sectionImpedance() {
  return `
    <h3>Impedance &amp; measurement</h3>
    <h4>Acoustic impedance</h4>
    <div class="formula">Z = p / U  (Pa·s/m³)  ·  Z<sub>0</sub> = ρ c / A</div>
    <p>Plots show |Z|, Re Z on the left axis and Im Z on the right axis versus frequency.</p>
    <h4>Helmholtz input impedance</h4>
    <div class="formula">Z ≈ jω M<sub>a</sub> + 1/(jω C<sub>a</sub>) + R<sub>loss</sub></div>
    <h4>Two-microphone method</h4>
    <p>
      From complex pressures at two microphones, the reflection coefficient R and load impedance
      are estimated over a frequency grid. The method is plane-wave; spacing must satisfy
      spatial sampling rules (documented in the tab assumptions).
    </p>
    <h4>Circular piston radiation</h4>
    <p>
      Radiation impedance uses ka expansions with resistive and mass-like reactance,
      kept physical (R ≥ 0) even at low ka where naive series can go negative.
    </p>
    <h4>Impedance tube</h4>
    <p>
      The tool can simulate a tube measurement workflow (source, microphones, sample termination)
      for didactic use. It is not a calibrated laboratory instrument.
    </p>
  `;
}

function sectionExport() {
  return `
    <h3>Export &amp; reporting</h3>
    <table>
      <tr><th>Action</th><th>Output</th></tr>
      <tr><td>Save JSON</td><td>Full project state (schema-versioned) for reload via Import</td></tr>
      <tr><td>Modes CSV</td><td>Modal frequencies, indices, wavelengths, assumptions</td></tr>
      <tr><td>Response CSV</td><td>Frequency grid with magnitude / phase</td></tr>
      <tr><td>PNG</td><td>Current Plotly chart at 2× scale</td></tr>
      <tr><td>Report</td><td>Markdown/text calculation report: inputs, outputs, formulas, assumptions</td></tr>
      <tr><td>Copy</td><td>Key results to clipboard</td></tr>
    </table>
    <h4>Project JSON</h4>
    <ul>
      <li>Includes schema version, units, environment, geometry, damping/coupling, display prefs.</li>
      <li>Import validates schema version and rejects corrupt files with a clear message.</li>
    </ul>
    <h4>Report contents</h4>
    <p>
      The report always includes: resonator type, environment (with c model string), geometry,
      primary frequencies, Q if computed, formula lines, and assumption bullets.
    </p>
  `;
}

function sectionValidation() {
  return `
    <h3>Validation suite</h3>
    <p>
      Toolbar → <strong>Export → Run tests</strong> runs the in-browser physics validation (same core as
      <code>tests/run-validation.mjs</code>). Node CLI:
    </p>
    <div class="formula">node tests/run-validation.mjs</div>
    <h4>What is checked</h4>
    <ul>
      <li>Tube series against analytic f<sub>n</sub></li>
      <li>Helmholtz f<sub>0</sub> and inverse design round-trip</li>
      <li>Rectangular / cylindrical / spherical / annular eigenvalues</li>
      <li>Bessel identities (j<sub>0</sub>, J′ roots)</li>
      <li>Transfer-matrix complex trig and chaining</li>
      <li>Sensitivity sign, uncertainty propagation, Weyl count</li>
      <li>Pole damping rate ω<sub>0</sub>/(2Q)</li>
      <li>Two-mode splitting 2κ and Jacobi eigen</li>
      <li>Two-microphone |R| ≤ 1</li>
      <li>Monte Carlo mean vs analytic for linear models</li>
      <li>Sweep extremum finder</li>
    </ul>
    <p>Goal: <strong>all tests pass</strong> before relying on a physics change. UI validation never replaces this suite.</p>
  `;
}

function sectionAssumptions() {
  return `
    <h3>Assumptions &amp; limits</h3>
    <h4>Global</h4>
    <ul>
      <li>Linear acoustics (small perturbations).</li>
      <li>Ideal-gas thermodynamics for the working fluid.</li>
      <li>Rigid walls for eigenfrequencies unless a loss model is applied to Q.</li>
      <li>1-D plane wave for tubes, stubs, duct chains, and two-microphone work.</li>
    </ul>
    <h4>Geometry</h4>
    <ul>
      <li>Schematics are dimensioned technical drawings, not meshed CAD.</li>
      <li>Mode animations are harmonic illustrations of analytic eigenfunctions.</li>
    </ul>
    <h4>Losses</h4>
    <ul>
      <li>Boundary-layer models are engineering approximations.</li>
      <li>End corrections are classical circular-opening values.</li>
      <li>No turbulence, no non-linear orifice flow, no MPP high-amplitude effects.</li>
    </ul>
    <h4>Numerical</h4>
    <ul>
      <li>Root finders use tight tolerances; results still show full-precision hovers.</li>
      <li>Monte Carlo sample count trades accuracy vs speed (default is interactive-friendly).</li>
    </ul>
    <div class="note"><strong>When in doubt:</strong> read the assumptions block in the Results panel — it is generated from the active model, not hard-coded marketing copy.</div>
  `;
}

function sectionGlossary() {
  return `
    <h3>Glossary</h3>
    <table>
      <tr><th>Symbol</th><th>Meaning</th></tr>
      <tr><td>c</td><td>Speed of sound (m/s)</td></tr>
      <tr><td>ρ</td><td>Mean density (kg/m³)</td></tr>
      <tr><td>ω, f</td><td>Angular frequency (rad/s), ordinary frequency (Hz)</td></tr>
      <tr><td>k</td><td>Wavenumber ω/c (rad/m)</td></tr>
      <tr><td>λ</td><td>Wavelength c/f (m)</td></tr>
      <tr><td>Q</td><td>Quality factor (dimensionless)</td></tr>
      <tr><td>Z</td><td>Acoustic impedance p/U</td></tr>
      <tr><td>κ</td><td>Coupling coefficient in frequency units (Hz)</td></tr>
      <tr><td>ζ</td><td>Damping ratio, ζ = 1/(2Q)</td></tr>
      <tr><td>Δ</td><td>End correction length</td></tr>
      <tr><td>χ′<sub>mp</sub></td><td>Root of J′<sub>m</sub> for cylindrical modes</td></tr>
      <tr><td>ka</td><td>Helmholtz / dimensionless frequency</td></tr>
      <tr><td>Maa MPP</td><td>Micro-perforated panel (Maa model)</td></tr>
      <tr><td>Weyl</td><td>High-frequency modal count asymptotic</td></tr>
    </table>
    <h4>Abbreviations</h4>
    <ul>
      <li><strong>MPP</strong> — micro-perforated panel</li>
      <li><strong>BC</strong> — boundary condition</li>
      <li><strong>TMM</strong> — transfer matrix method</li>
      <li><strong>MC</strong> — Monte Carlo</li>
      <li><strong>a.u.</strong> — arbitrary units (normalized quantities)</li>
    </ul>
    <p style="margin-top:18px;color:var(--muted);font-size:12px">
      Manual version: 1.3 · ResonLab V1.3 (Acoustic Resonator Studio) · developed by S.Chatterjee
    </p>
  `;
}

const RENDERERS = {
  fem: () => `<h3>FEM 2D: your first study</h3>
    <p>Use this tool to solve the actual cylindrical Helmholtz cavity and one circular coaxial neck. A radius–height mesh is revolved about r = 0; the weighted weak form preserves the physical volume and circular neck area.</p>
    <ol><li>In Design, load a Helmholtz example, then open <strong>FEM 2D</strong>. Keep <strong>Current resonator geometry</strong> selected.</li>
    <li>Open study settings and enter volume, cavity height/diameter, neck radius, and neck length. Volume alone does not define a cavity shape; height/diameter completes it.</li>
    <li>Choose a mesh and click <strong>Solve FEM</strong>. Geometry changes also rebuild and solve the mesh. Mode 1 is the nonzero Helmholtz resonance.</li>
    <li>Use <strong>Check mesh convergence</strong> to solve coarse, medium, and fine meshes. Inspect the frequency change, then select a mode and toggle the triangle mesh.</li></ol>
    <h4>Choose the application</h4><p><strong>Tune a resonance</strong> shows isolated pressure gain and Q. <strong>Absorb sound</strong> calculates normal-incidence absorption for one resonator in each square cell of a rigid-backed panel; cell width must fit the cavity. <strong>Reduce duct noise</strong> calculates transmission loss for a compact side branch on equal anechoic circular ducts without flow. Enter the target and mounting dimensions, then Solve FEM. A new uniform-pressure FEM mouth port recovers input impedance; mounted models include the chosen end mass, while omitting the free-air radiation resistance to avoid counting external coupling twice.</p><p>Mounted results are approximations. Panel mutual coupling, finite-edge effects, junction-resolved duct scattering and mean flow are excluded. Transmission loss includes reflection and is not absorption. Pressure gain alone does not establish noise reduction.</p><h4>Automatic FEM inverse design</h4><p><strong>Frequency and Q together</strong> adjusts cavity volume, neck length, neck radius and cavity height/diameter jointly. Enter target frequency and isolated bandwidth Q, select at least two adjustable dimensions, and set maximum overall diameter and height. Unchecked dimensions stay fixed. Overall diameter includes twice the packaging allowance; height includes cavity height, neck length and twice the allowance. This allowance reserves space, without simulating wall structure. All four dimension bounds apply together. Current losses remain fixed.</p><p>Every joint trial uses driven FEM; coarse exploration is followed by selected-mesh refinement and fresh verification of both targets. Default tolerances are 0.1% frequency and 2% Q. Q means isolated cavity-pressure half-power bandwidth Q, including the selected losses. In panel/duct tasks it remains a separate isolated reference, not mounted absorption/TL bandwidth Q. The proposal shows both target errors, dimensions and envelope versus limits. Search effort is bounded and a local search cannot guarantee a global optimum. Failed matches cannot be applied.</p><p>For <strong>Frequency only · one dimension</strong>, enter Target frequency and click <strong>Find dimensions with FEM</strong>. Automatic mode tries volume, neck length, then neck radius within bounded ranges and mounting constraints. A selected parameter or uniform size scale is also available. The recommended frequency definition is the current application peak; Lossless fundamental targets the conservative eigenmode instead.</p><p>Eigenmode FEM trials locate a candidate, then full response solves verify and refine its actual peak. The proposal shows before/after dimensions, frequency error, mesh, losses and search history. Geometry changes only when you click <strong>Apply proposed dimensions</strong>; Export proposed project saves an importable proposal. Cancellation or a failed/unreachable target leaves geometry unchanged. A failed match cannot be applied. Search limits and tolerance are under Dimension bounds &amp; accuracy. Check mesh convergence after applying: the frequency tolerance is not a model accuracy guarantee, and matching these targets does not optimize absorption or establish manufacturing tolerances.</p><h4>Boundary conditions</h4><p>Cavity and neck walls are rigid. With no end correction, the mouth has p = 0. A flanged or unflanged correction uses ∂p/∂n + p/δ = 0 at the actual mouth, representing exterior inertance approximately. The cavity–neck junction is already resolved by the mesh; an extra internal correction is not added.</p>
    <h4>What to compare</h4><p>The difference from the lumped Helmholtz formula is a model difference, not mesh error. Medium-to-fine change measures numerical convergence. Eigenpair residuals check the algebraic solve; they do not measure discretization error. Only axisymmetric (m = 0) modes are solved.</p>
    <h4>Radiation, damping and response</h4><p>Under Isolated pressure response &amp; loss budget, the driven FEM response gives cavity-average pressure gain and phase for a 1 Pa equivalent mouth source. Radiation, viscous wall layers and thermal wall layers can be enabled separately. Additional bulk loss factor is optional and defaults to zero. Choose sweep limits as multiples of the lossless fundamental, then click Solve FEM.</p><p>The damped peak and Q are separate from the lossless modes. Q = peak frequency / half-power bandwidth, with both crossings refined by direct FEM solves. This is a transfer-function bandwidth Q, not a complex-pole Q. An unresolved peak or missing crossing gives no Q; an all-losses-off resonance is singular. Power contributions refer to the passive mouth admittance and the wall/bulk terms at the peak.</p><h4>Limits</h4><p>Radiation uses a local low-ka pipe impedance, retaining the chosen end correction once. Wall losses use first-order thin viscous and isothermal thermal boundary layers, including reactive frequency shifts. Warnings flag ka ≥ 0.5 or boundary layers exceeding 10% of neck radius. No exterior mesh, mean flow, vortex shedding, flexible walls or full thermoviscous flow is solved. Multiple necks, rectangular necks and non-cylindrical cavities are explicitly rejected.</p>
    <h4>Save and export</h4><p>Save retains geometry, cavity aspect ratio, source, mesh level and FEM loss/sweep settings. Modes CSV and Report export the active FEM result. <strong>Export mesh &amp; modes</strong> includes nodes, triangles, lossless nodal pressure fields, response arrays, complex peak pressure fields, Q and boundary metadata. Response CSV exports magnitude and phase; Report includes Q and loss settings. <strong>Export field SVG</strong> saves the displayed field. The solver runs in a worker and can be cancelled.</p>
    <h4>Simulation verification</h4><p>Run the physics verification suite from the FEM summary. It checks exact closed-cylinder input impedance, passive absorption and duct energy balance as well as eigenfrequency and damping limits. The optional reference-curve panel imports local pressure, absorption or transmission-loss CSVs and compares overlapping traces. The bundled 150 Hz / Q 50 reference is synthetic, not a measurement or a physical validation. Save includes imported trace provenance. Application CSV exports follow the selected task; Export isolated pressure CSV retains the separate reference.</p><h4>Verification benchmark</h4><p>Choose Rectangle verification benchmark to run the earlier Q1 rigid-rectangle test. Its static zero mode is specific to that closed reference domain, not the open Helmholtz geometry.</p>`,
  overview: sectionOverview,
  interface: sectionInterface,
  units: sectionUnits,
  types: sectionTypes,
  tubes: sectionTubes,
  helmholtz: sectionHelmholtz,
  cavities: sectionCavities,
  advanced: sectionAdvanced,
  tabs: sectionTabs,
  science: sectionScience,
  damping: sectionDamping,
  coupling: sectionCoupling,
  impedance: sectionImpedance,
  export: sectionExport,
  validation: sectionValidation,
  assumptions: sectionAssumptions,
  glossary: sectionGlossary,
};

export function buildHelpToc(lang = 'en') {
  let html = '';
  let group = '';
  const groupNames = {
    en: { Start: 'Start', Models: 'Models', Analysis: 'Analysis', Workflow: 'Workflow' },
    ru: { Start: 'Старт', Models: 'Модели', Analysis: 'Анализ', Workflow: 'Работа' },
  };
  for (const s of SECTIONS) {
    if (s.group !== group) {
      group = s.group;
      html += `<div class="toc-group">${(groupNames[lang] || groupNames.en)[group] || group}</div>`;
    }
    html += `<button type="button" data-help="${s.id}" id="help-toc-${s.id}">${helpSectionTitle(s.id, lang)}</button>`;
  }
  return html;
}

/** Compact Russian bodies for the manual (formulas stay SI/Math). */
const RENDERERS_RU = {
  overview: () => `
    <h3>Обзор и быстрый старт</h3>
    <p><strong>ResonLab V1.3</strong> (проектировщик акустических резонаторов) — разработка <strong>S.Chatterjee</strong>. Браузерный инженерный стенд для труб, резонаторов Гельмгольца, полостей, связанных мод, демпфирования/Q, комплексных полюсов, развёрток и неопределённостей.</p>
    <h4>Быстрый старт</h4>
    <ol>
      <li>Откройте <code>http://127.0.0.1:8877/</code> (сервер <code>serve.py</code>).</li>
      <li>Выберите <strong>тип резонатора</strong> слева.</li>
      <li>Задайте <strong>среду</strong> (T, p, RH, газ) — c пересчитывается автоматически.</li>
      <li>Введите геометрию. Некорректные значения отклоняются с сообщением.</li>
      <li>Смотрите <strong>результаты</strong> справа: f, Q, таблица мод, допущения.</li>
      <li>Вкладки анализа — клавиши <code>1</code>–<code>8</code>.</li>
      <li>Экспорт: CSV / JSON / отчёт / PNG.</li>
    </ol>
    <div class="note"><strong>Правило честности:</strong> у каждой модели перечислены допущения. Приближения подписаны.</div>
  `,
  interface: () => `
    <h3>Интерфейс</h3>
    <table>
      <tr><th>Зона</th><th>Назначение</th></tr>
      <tr><td>Панель инструментов</td><td>Проект, пресеты, Reset/Import/Save, экспорт, тесты, язык, справка, тема</td></tr>
      <tr><td>Вкладки</td><td>Геометрия, Моды, Отклик, Демпфирование, Связь, Наука, Развёртки, Импеданс</td></tr>
      <tr><td>Слева</td><td>Единицы, тип, среда, геометрия, Q, обратная задача, связь</td></tr>
      <tr><td>Центр</td><td>Схема, поле/моды, графики</td></tr>
      <tr><td>Справа</td><td>KPI, моды, геометрия, допущения</td></tr>
    </table>
    <h4>Клавиши</h4>
    <ul>
      <li><code>1</code>–<code>8</code> — вкладки анализа</li>
      <li>Ползунок фазы / Пауза — иллюстративная анимация</li>
      <li><code>Esc</code> — закрыть руководство</li>
      <li>Кнопка <b>EN/RU</b> — переключение языка</li>
    </ul>
  `,
  units: () => `
    <h3>Единицы и среда</h3>
    <ul>
      <li>Внутри всегда СИ: м, Гц, Па, кг/м³.</li>
      <li>Отображение: мм/см/м, Гц/кГц. Физика не меняется.</li>
    </ul>
    <h4>Окружающая среда</h4>
    <p>Температура, давление, влажность, газ. Скорость звука:</p>
    <div class="formula">c = √(γ R T<sub>абс</sub>)  ·  c ≈ 331.3 + 0.606 T<sub>°C</sub></div>
    <p>c никогда не «заморожена»: изменение T/p/RH/газа пересчитывает ρ, c, μ и все частоты.</p>
    <div class="formula">ρ = p / (R<sub>см</sub> T<sub>абс</sub>)</div>
  `,
  types: () => `
    <h3>Типы резонаторов</h3>
    <table>
      <tr><th>Тип</th><th>Выход</th><th>Класс модели</th></tr>
      <tr><td>Труба</td><td>f<sub>n</sub>, формы мод</td><td>1-D плоская волна</td></tr>
      <tr><td>Гельмгольц</td><td>f<sub>0</sub>, Q, обратная задача</td><td>Сосредоточенные M–C</td></tr>
      <tr><td>Прямоугольная полость</td><td>f<sub>lmn</sub></td><td>Жёсткие стенки</td></tr>
      <tr><td>Цилиндрическая</td><td>f<sub>mpq</sub></td><td>Корни J′</td></tr>
      <tr><td>Сферическая</td><td>f<sub>nlm</sub></td><td>Сферические Бесселя</td></tr>
      <tr><td>Кольцевая</td><td>радиальные/осевые моды</td><td>J′/Y′</td></tr>
      <tr><td>Боковой отвод</td><td>резонансы стаба</td><td>реактивный отвод</td></tr>
      <tr><td>МПП</td><td>поверхностный Z</td><td>модель Маа</td></tr>
      <tr><td>Рупор</td><td>срез, Z</td><td>уравнение Уэбстера</td></tr>
      <tr><td>Цепь каналов</td><td>входной Z</td><td>матрицы передачи</td></tr>
      <tr><td>Связанные</td><td>f<sub>±</sub></td><td>двухмодовая κ</td></tr>
    </table>
  `,
  tubes: () => `
    <h3>Трубы и концевая поправка</h3>
    <table>
      <tr><th>ГУ</th><th>Ряд</th></tr>
      <tr><td>Открыт–открыт</td><td>f<sub>n</sub> = n c / (2 L<sub>эф</sub>)</td></tr>
      <tr><td>Открыт–закрыт</td><td>f<sub>n</sub> = (2n−1) c / (4 L<sub>эф</sub>)</td></tr>
      <tr><td>Закрыт–закрыт</td><td>f<sub>n</sub> = n c / (2 L)</td></tr>
    </table>
    <div class="formula">Δ = 0.8216 a (фланец) · 0.6133 a (без фланца)</div>
    <div class="formula">L<sub>эф</sub> = L + 2Δ / L + Δ / L</div>
    <p>Ограничение: плоская волна, D ≪ λ.</p>
  `,
  helmholtz: () => `
    <h3>Теория Гельмгольца</h3>
    <div class="formula">f<sub>0</sub> = (c / 2π) √( A / (V L<sub>эф</sub>) )</div>
    <div class="formula">L<sub>эф</sub> = L<sub>n</sub> + Δ</div>
    <ul>
      <li>Горловина ≈ масса M<sub>a</sub> = ρ L<sub>эф</sub> / A</li>
      <li>Объём ≈ податливость C<sub>a</sub> = V / (ρ c²)</li>
    </ul>
    <p>Обратная задача проверяется прямой подстановкой. Справедливо при λ ≫ размеров полости.</p>
  `,
  cavities: () => `
    <h3>Полости и моды</h3>
    <div class="formula">f<sub>lmn</sub> = (c/2) √[ (l/L<sub>x</sub>)² + (m/L<sub>y</sub>)² + (n/L<sub>z</sub>)² ]</div>
    <div class="formula">f<sub>mpq</sub> = (c/2π) √[ (χ′<sub>mp</sub>/a)² + (qπ/L)² ]</div>
    <div class="formula">f<sub>nlm</sub> = (c / 2πR) · χ<sub>nl</sub></div>
    <p>Кольцевая полость: характеристическое уравнение с J′ и Y′. Формы мод — аналитические собственные функции, не FEM.</p>
  `,
  advanced: () => `
    <h3>Продвинутые модели</h3>
    <ul>
      <li>Термовязкий канал — комплексный волновой номер и затухание.</li>
      <li>Матрицы передачи: <span class="formula">T = [[cos kL, j Z₀ sin kL], [j sin kL/Z₀, cos kL]]</span></li>
      <li>МПП (Маа), рупоры Уэбстера, число мод Вейля, безразмерные группы.</li>
    </ul>
  `,
  tabs: () => `
    <h3>Вкладки анализа</h3>
    <table>
      <tr><th>Вкладка</th><th>Клавиша</th></tr>
      <tr><td>Геометрия</td><td>1</td></tr>
      <tr><td>Моды</td><td>2</td></tr>
      <tr><td>Частотный отклик</td><td>3</td></tr>
      <tr><td>Демпфирование</td><td>4</td></tr>
      <tr><td>Связь</td><td>5</td></tr>
      <tr><td>Наука</td><td>6</td></tr>
      <tr><td>Развёртки</td><td>7</td></tr>
      <tr><td>Импеданс</td><td>8</td></tr>
    </table>
    <p>Оси: символ величины + СИ. Heatmap — цветовая шкала с подписью.</p>
  `,
  science: () => `
    <h3>Научный стек</h3>
    <div class="formula">s = −σ ± j ω<sub>d</sub> , σ = ω<sub>0</sub>/(2Q)</div>
    <ul>
      <li>Полюса в s-плоскости с лучом постоянного ζ.</li>
      <li>Чувствительность E = (∂y/y)/(∂p/p), tornado.</li>
      <li>Монте-Карло: μ, σ, гистограмма, ±1σ.</li>
      <li>Двухмикрофонный импеданс (стиль ISO 10534-2).</li>
    </ul>
  `,
  damping: () => `
    <h3>Демпфирование и Q</h3>
    <div class="formula">1/Q<sub>нагр</sub> = Σ 1/Q<sub>k</sub></div>
    <div class="formula">Δf<sub>−3dB</sub> = f<sub>0</sub>/Q , τ<sub>60</sub> ≈ 6.91 Q /(2π f<sub>0</sub>)</div>
    <p>Механизмы: вязкий/тепловой слой, излучение, стенки, пользовательский Q.</p>
  `,
  coupling: () => `
    <h3>Теория связи</h3>
    <div class="formula">f<sub>±</sub> = (f<sub>1</sub>+f<sub>2</sub>)/2 ± √[ ((f<sub>1</sub>−f<sub>2</sub>)/2)² + κ² ]</div>
    <p>При нулевой расстройке Δf = 2κ. N-модовая матрица — собственные значения Якоби.</p>
  `,
  impedance: () => `
    <h3>Импеданс и измерения</h3>
    <div class="formula">Z = p / U  (Па·с/м³)</div>
    <ul>
      <li>|Z|, Re Z, Im Z vs f.</li>
      <li>Входной импеданс Гельмгольца.</li>
      <li>Двухмикрофонный метод, излучение кругового поршня.</li>
    </ul>
  `,
  export: () => `
    <h3>Экспорт и отчёты</h3>
    <table>
      <tr><th>Действие</th><th>Результат</th></tr>
      <tr><td>Save</td><td>JSON проекта (schema version)</td></tr>
      <tr><td>Modes CSV</td><td>модальные частоты</td></tr>
      <tr><td>Response CSV</td><td>сетка частот, |H|, фаза</td></tr>
      <tr><td>PNG</td><td>график 2×</td></tr>
      <tr><td>Report</td><td>входы, выходы, формулы, допущения</td></tr>
    </table>
  `,
  validation: () => `
    <h3>Набор проверок</h3>
    <p>Кнопка <strong>Tests</strong> или <code>node tests/run-validation.mjs</code>.</p>
    <ul>
      <li>Трубные ряды, Гельмгольц, полости, Бессель.</li>
      <li>Комплексная тригонометрия матриц передачи.</li>
      <li>Полюса, 2κ, Якоби, |R|≤1, Монте-Карло, экстремумы.</li>
    </ul>
  `,
  assumptions: () => `
    <h3>Допущения и ограничения</h3>
    <ul>
      <li>Линейная акустика, идеальный газ.</li>
      <li>Жёсткие стенки для собственных частот (потери — в Q).</li>
      <li>1-D для труб, отводов, цепей, двухмикрофонного метода.</li>
      <li>Схемы и анимации — иллюстрации, не FEM/FDTD.</li>
      <li>Приграничные слои и концевые поправки — инженерные модели.</li>
    </ul>
    <div class="note"><strong>Сомневаетесь?</strong> читайте блок «допущения» в результатах — он генерируется активной моделью.</div>
  `,
  glossary: () => `
    <h3>Словарь</h3>
    <table>
      <tr><th>Символ</th><th>Смысл</th></tr>
      <tr><td>c</td><td>скорость звука (м/с)</td></tr>
      <tr><td>ρ</td><td>плотность (кг/м³)</td></tr>
      <tr><td>ω, f</td><td>циклическая / обычная частота</td></tr>
      <tr><td>k</td><td>волновое число ω/c</td></tr>
      <tr><td>Q</td><td>добротность</td></tr>
      <tr><td>Z</td><td>акустический импеданс</td></tr>
      <tr><td>κ</td><td>коэффициент связи (Гц)</td></tr>
      <tr><td>ζ</td><td>коэффициент демпфирования 1/(2Q)</td></tr>
      <tr><td>Δ</td><td>концевая поправка</td></tr>
      <tr><td>ka</td><td>безразмерная частота Гельмгольца</td></tr>
    </table>
    <p style="margin-top:18px;color:var(--muted);font-size:12px">
      Руководство v1.3 · ResonLab V1.3 · разработка S.Chatterjee
    </p>
  `,
};

export function renderHelpSection(id, lang) {
  const useLang = lang || getLang();
  const table = useLang === 'ru' ? RENDERERS_RU : RENDERERS;
  const fn = table[id] || RENDERERS[id] || RENDERERS.overview;
  return fn();
}

/** Section titles in EN/RU for the TOC. */
const TITLES_RU = {
  fem: 'FEM 2D: первое исследование',
  overview: 'Обзор и быстрый старт',
  interface: 'Интерфейс',
  units: 'Единицы и среда',
  types: 'Типы резонаторов',
  tubes: 'Трубы и концевая поправка',
  helmholtz: 'Теория Гельмгольца',
  cavities: 'Полости и моды',
  advanced: 'Продвинутые модели',
  tabs: 'Вкладки анализа',
  science: 'Научный стек',
  damping: 'Демпфирование и Q',
  coupling: 'Теория связи',
  impedance: 'Импеданс и измерения',
  export: 'Экспорт и отчёты',
  validation: 'Набор проверок',
  assumptions: 'Допущения и ограничения',
  glossary: 'Словарь',
};

const TITLES_EN = {
  fem: 'FEM 2D: first study',
  overview: 'Overview & quick start',
  interface: 'Interface tour',
  units: 'Units & environment',
  types: 'Resonator types',
  tubes: 'Tubes & end correction',
  helmholtz: 'Helmholtz theory',
  cavities: 'Cavities & modes',
  advanced: 'Advanced models',
  tabs: 'Analysis tabs',
  science: 'Science stack',
  damping: 'Damping & Q',
  coupling: 'Coupling theory',
  impedance: 'Impedance & measurement',
  export: 'Export & reporting',
  validation: 'Validation suite',
  assumptions: 'Assumptions & limits',
  glossary: 'Glossary',
};

export function helpSectionTitle(id, lang = 'en') {
  return (lang === 'ru' ? TITLES_RU : TITLES_EN)[id] || id;
}

export function mountHelp(root = document.body) {
  if (document.getElementById('help-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.className = 'help-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'User manual');

  modal.innerHTML = `
    <div class="help-panel">
      <div class="help-head">
        <h2>${t('help.title')}</h2>
        <span class="sub">${t('help.sub')}</span>
        <div class="spacer"></div>
        <button type="button" class="btn btn-secondary" id="help-close">${t('help.close')}</button>
      </div>
      <div class="help-body">
        <nav class="help-toc" id="help-toc" aria-label="Manual sections">${buildHelpToc(getLang())}</nav>
        <article class="help-content" id="help-content"></article>
      </div>
    </div>
  `;
  root.appendChild(modal);

  const content = modal.querySelector('#help-content');
  const toc = modal.querySelector('#help-toc');

  function show(id) {
    content.innerHTML = renderHelpSection(id);
    content.scrollTop = 0;
    toc.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.help === id);
    });
  }

  toc.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-help]');
    if (btn) show(btn.dataset.help);
  });

  // Refresh TOC labels when language changes.
  window.addEventListener('acoustudio:lang', () => {
    toc.innerHTML = buildHelpToc(getLang());
    const active = toc.querySelector('button.active') || toc.querySelector('button[data-help]');
    if (active) show(active.dataset.help);
    modal.querySelector('h2').textContent = t('help.title');
    modal.querySelector('.sub').textContent = t('help.sub');
    modal.querySelector('#help-close').textContent = t('help.close');
  });

  modal.querySelector('#help-close').addEventListener('click', () => closeHelp());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeHelp();
  });

  show('overview');

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) {
      e.preventDefault();
      closeHelp();
    }
  });
}

export function openHelp(sectionId = 'overview') {
  const modal = document.getElementById('help-modal');
  if (!modal) return;
  // Support #help/<section> deep links.
  if (!sectionId || sectionId === 'overview') {
    const m = /^#help\/([\w-]+)/.exec(location.hash || '');
    if (m && RENDERERS[m[1]]) sectionId = m[1];
  }
  modal.hidden = false;
  const btn = modal.querySelector(`[data-help="${sectionId}"]`);
  if (btn) btn.click();
  else modal.querySelector('#help-content').innerHTML = renderHelpSection(sectionId);
  const close = modal.querySelector('#help-close');
  if (close) close.focus();
}

export function closeHelp() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.hidden = true;
}
