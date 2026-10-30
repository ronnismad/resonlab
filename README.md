# ResonLab V1.3

**Acoustic Resonator Studio** · developed by **S. Chatterjee**

Browser-based scientific tool for designing and analyzing acoustic resonators: open/closed tubes, Helmholtz resonators, rectangular and cylindrical cavities, coupled modes, frequency response, and damping/Q.

## Start a study

1. In **Design**, choose **Try a tube**, **Try a Helmholtz resonator**, or **Try 2D FEM**.
2. Follow the three steps in the study guide. Each view explains the inputs, how to read the result, and the model limits.
3. Use **Edit study settings** to change dimensions. Settings for the current view are shown first; **Show all settings** reveals the complete set. Helmholtz cavity volume is entered in litres; internal storage remains m³.
4. Use **Next** to continue, or **All tools** to search by purpose: “pressure nodes”, “mesh”, “Q”, “target frequency”, “uncertainty”, or “export”. All existing tools remain available.
5. **Save** downloads a project file. **Import** reopens it. The active FEM view exports FEM modes and reports; analytical views export the primary analytical study.

On narrow screens, the study occupies the page. Settings open in a drawer; **Done** or Escape returns to the study.

### Identity

ResonLab V1.3 uses a cavity-and-wave mark: a blue resonator outline with a teal pressure wave and a white node. The simplified SVG remains readable at toolbar and favicon sizes. The primary assets are `assets/brand/resonlab-mark.svg` and `assets/brand/resonlab-horizontal.svg`. The project format remains schema version 1 so earlier project files can still be imported.

Physics is implemented in plain ES modules and is independent of Plotly. UI uses HTML5, CSS3, and vanilla JavaScript. Plotly.js is bundled locally for charts.

## Run locally

Use the included server (no backend, database, login, or API key):

```bash
# From the acoustic-resonator-designer directory
python serve.py
```

Open `http://127.0.0.1:8877/`. The included server disables caching during development. Any ordinary static server also works.

**Network:** calculations and charts work offline once the files are served locally.

## Project structure

```
acoustic-resonator-designer/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js
│   ├── state.js
│   ├── physics/
│   │   ├── air-properties.js
│   │   ├── tube-resonators.js
│   │   ├── helmholtz-resonator.js
│   │   ├── cavity-modes.js
│   │   ├── coupled-resonators.js
│   │   ├── damping.js
│   │   └── validation.js
│   ├── visualization/
│   │   ├── plots.js
│   │   ├── mode-shapes.js
│   │   └── geometry.js
│   ├── export/export.js
│   └── ui/
│       ├── controls.js
│       └── presets.js
├── tests/
│   ├── run-validation.mjs
│   └── index.html
└── examples/
```

## Supported models

| Type | Core result | Notes |
|------|-------------|--------|
| Open–open tube | `f_n = n c / (2 L_eff)` | Optional Rayleigh end correction |
| Open–closed tube | `f_n = (2n−1) c / (4 L_eff)` | Odd harmonics |
| Closed–closed tube | Same series as open–open | Boundary phase differs |
| Helmholtz | `f = (c/2π)√(A/(V L_eff))` | Inverse design for V, L_n, or a |
| Helmholtz FEM | `Kp = k²Mp`, `f = ck/(2π)` | Actual cylindrical cavity + coaxial neck, axisymmetric triangles, approximate open mouth |
| Rectangular cavity | `f_lmn = (c/2)√[(l/Lx)²+(m/Ly)²+(n/Lz)²]` | Rigid walls |
| Cylindrical cavity | `f_mnp = (c/2π)√[(χ'_mp/a)²+(pπ/L)²]` | Numerical J′_m roots |
| Spherical cavity | `f_nlm = (c/2πR)·χ_nl` | Spherical j_l′ roots; degeneracy 2l+1 |
| Annular cavity | `f = (c/2π)√[k²+(pπ/L)²]` | Bessel Wronskian J′,Y′ roots |
| Side-branch / QW stub | `f_n = (2n−1)c/(4L)` | Reactive duct load |
| Micro-perforated panel | Maa-type transfer impedance | Viscous + inertial end corrections |
| Horn (cone / exp.) | Webster cutoff & Z_in | Plane-wave approximation |
| Duct chain | Transfer-matrix cascade | `[[cos kL, jZ₀sin kL],[j sin kL/Z₀, cos kL]]` |
| Coupled two-mode | `f± = ½(f1+f2) ± ½√[(f1−f2)²+4Δc²]` | Reduced-order κ model |
| Damping / Q | `1/Q_L = Σ 1/Q_k`, `Δf = f0/Q`, `τ_A = Q/(π f0)` | Measured Q preferred |

### Scientist panel

- Dimensionless groups: ka, kL, λ/∛V, Stokes a/δ_v, boundary-layer thicknesses
- Thermoviscous duct correction (Zwikker–Kosten-type engineering form)
- Neck impedance Z(ω) for Helmholtz models
- Parameter sensitivity ∂f/∂p and first-order uncertainty σ_f
- Weyl asymptotic mode density for cavities

## Equations and assumptions

**Environment (labeled approximations)**

- Density: ideal-gas moist air `ρ = (p−e)/(R_d T) + e/(R_w T)`
- Sound speed: `c = √(γ R_eff T)` plus small humidity term for air  
  Linear comparison form (clearly labeled): `c ≈ 331.3 + 0.606 T` with T in °C
- Viscosity: Sutherland law  
- c is never frozen when T, p, RH, or gas change

**Tubes:** uniform rigid tube, plane waves, ideal node/antinode BCs.  
End correction: `Δ ≈ 0.6133 a` (unflanged) or `0.8216 a` (flanged).  
`L_eff = L` plus one Δ per open end.

**Helmholtz:** lumped mass–compliance. Valid when wavelength ≫ cavity and neck is not acoustically long. App warns when `λ/∛V` is small.

**Cavities:** rigid walls (zero normal velocity). Cylindrical modes use numerical roots of `J'_m(x)=0` (not rectangular formulas). m≥1 modes are azimuthally degenerate.

**Coupling:** phenomenological two-mode κ in Hz. At degeneracy, splitting = 2Δc. Not automatically a geometric coupling.

**Damping:** independent loss channels combined as inverse Q. Boundary-layer viscous/thermal estimates are labeled “(est.)”. Prefer measured Q/linewidth when available.  
Amplitude vs energy decay: `τ_A = Q/(π f0)`, `τ_E = Q/(2π f0)`.

## Units

SI internally (m, kg, s, Pa, Hz, K). UI can display mm/cm/m and Hz/kHz/MHz. Invalid input is rejected with a message; values are never silently clamped.

## Numerical methods

- Analytic series for tubes and rectangular modes
- Bessel J_n by power series; J′ roots by bracketing + bisection
- Two-mode eigenvalues in closed form
- Frequency response: sum of Lorentzians (engineering estimate, not transfer-matrix FEM)
- Helmholtz FEM: conforming P1 triangles on the actual cavity/neck radius–height section, axisymmetric weight `2πr`, exact consistent mass, banded Cholesky plus block inverse iteration/Rayleigh–Ritz for `Kp = k²Mp`. Solves in a cancellable module worker.
- Rectangle verification: Q1 bilinear quadrilateral elements with consistent mass; tensor separation and small generalized eigenproblems.

### FEM 2D: actual Helmholtz geometry

In **FEM 2D**, select **Current resonator geometry** and a Helmholtz resonator. The cavity volume, neck radius, neck length, and end correction are shared with Design. Cavity height/diameter (default 1) fixes a cylindrical shape: `R = cbrt(V/(2π aspect))`, `H = 2R aspect`. The Design schematic and FEM use the same shape. Only one circular coaxial neck on a cylindrical cavity is supported; other shapes and multiple necks are explicitly rejected.

The meridional mesh is revolved about `r=0`; integration includes `2πr`, preserving actual cylinder/neck volumes. Triangle rows share nodes at the cavity–neck interface. Rigid walls and axis symmetry are natural conditions. With end correction **none**, `p=0` at the actual mouth. Otherwise, the selected exterior correction uses the reactive Robin condition `∂p/∂n + p/δ = 0`, `δ = 0.8216a` (flanged) or `0.6133a` (unflanged). No artificial neck extension is meshed and no internal end correction is added: the junction field is solved directly.

Mode 1 is the **nonzero Helmholtz resonance**. The difference from the analytical lumped estimate is a **model difference**, not a numerical error. **Check mesh convergence** solves coarse, medium, and fine meshes at fixed geometry. For `V=0.002 m³`, `a=0.02 m`, `L=0.05 m`, aspect=1, flanged, `c=343 m/s`, the fundamental is approximately 152.736, 152.251, and 152.041 Hz, respectively; medium-to-fine change is 0.138%. The lumped model gives 167.886 Hz. Browser values scale with the current medium's sound speed.

Each displayed eigenpair has relative residual below `1e-7`; this verifies the algebraic solve, not the spatial discretization. Independent tests compare a pressure-release cylinder against analytical axial and Bessel modes, check the narrow-neck lumped limit, matrix/volume identities, mass orthogonality, scaling, boundary values, and parameter trends. Only axisymmetric (`m=0`) modes are solved. The exterior mouth approximation is suitable only at low `ka`; higher modes need a radiation-domain model. Lossless modes remain the reference; the separate driven FEM study adds radiation and wall losses.

Modes CSV, Report, and Copy export the active FEM results. **Export mesh & modes** saves physical coordinates, triangles, normalized nodal fields, geometry, medium, assumptions, residuals and boundary metadata. **Export field SVG** saves the displayed element-average field. Project Save/Import retains shared geometry, cavity aspect ratio, mesh level and study source; results are recomputed. Legacy rectangle-only projects retain their verification source on import.

### Driven Helmholtz FEM: radiation, damping and Q

Keep a flanged or unflanged mouth selected. Under **Radiation, damping & response**, enable mouth radiation and viscous/thermal wall layers (on by default). An optional **additional bulk loss factor** defaults to zero; the analytical Damping tab’s Qi/Qe are not added to this FEM calculation. Sweep limits are multiples of the lossless fundamental. Click **Solve FEM**. The application results appear first; expand **Isolated pressure response & loss budget** or **Inspect pressure fields & lossless modes** for details. **Check mesh convergence** compares lossless frequency, damped peak and Q.

The full complex nodal FEM system is solved at every frequency, without a fitted Lorentzian or modal truncation. With time convention `exp(+iωt)`:

```
Zmouth/(rho c) = R + i k delta
R = (ka)^2/2 (flanged), (ka)^2/4 (unflanged); R=0 if radiation loss is disabled
Y = i k / (R + i k delta)
D = K0 - (1-i)delta_v Sv/2
    - k² [M + (1-i)(gamma-1)delta_t St/2] + i eta k² M + Y B
D p = Y B 1 * p_drive
```

`K0` has no mouth correction; `B` is the axisymmetric mouth mass matrix. `Sv=∫wall grad_t Ni·grad_t Nj dS`, `St=∫wall Ni Nj dS` on physical rigid walls (excluding mouth and symmetry axis). `delta_v=sqrt(2mu/(rho omega))`, `delta_t=delta_v/sqrt(Pr)`. Disabled wall terms are zero. The real parts of the boundary layers shift resonance; imaginary terms dissipate energy. The exterior correction appears exactly once. The flanged model retains the existing pipe correction `0.8216a`, rather than substituting the distinct baffled-piston reactance `8a/(3pi)`.

The equivalent mouth source injects inward velocity `p_drive/Zmouth` in parallel with the passive mouth admittance `1/Zmouth`; `p_drive=1 Pa`. The receiver is the physical cavity volume-average pressure (excluding the neck). Displayed gain is Pa/Pa, not SPL. Peak powers are passive mouth-load, viscous, thermal and extra bulk dissipation for this source amplitude. Complex peak nodal fields are included in the JSON export.

A complex symmetric band LDLᵀ factorization solves each driven system; a relative residual above `1e-6` rejects the result rather than adding artificial damping. The fundamental pressure maximum is refined near the lossless first mode, and both half-power crossings are refined with fresh FEM solves. `Q_bandwidth=f_peak/(f_upper-f_lower)` is a transfer-function estimate, not an eigenpole Q. Missing peak/crossings yield an explicit unresolved Q. With all losses off, sweeping through the ideal singular resonance is rejected, while lossless eigenmodes remain available.

For the geometry above at `c=343`, `rho=1.2`, `mu=1.81e-5`, `gamma=1.4`, `Pr=0.71`, medium mesh gives damped peak **151.569 Hz**, **Q=62.90**, bandwidth **2.410 Hz** with radiation and both wall losses. Coarse/medium/fine Q values are approximately **63.38 / 62.90 / 62.44**. These are approximation results, not measured Q values. Warnings identify `ka≥0.5` and boundary-layer thickness >10% of neck radius; sharp junction corner-layer effects are not resolved.

**Export FEM response CSV** (or **Export → Response CSV**) saves frequency, gain, dB re unity and phase with loss metadata. Reports include peak, Q, bandwidth and loss powers. Save/Import retains FEM loss and sweep settings. JSON `response` contains the full curve and peak fields; `responseError` explains unavailable responses without discarding valid lossless modes.

The boundary approximations follow the [thin-layer pressure-acoustics approach](https://doc.comsol.com/6.4/doc/com.comsol.help.aco/aco_ug_pressure.05.034.html) and [waveguide end impedance models](https://doc.comsol.com/6.4/doc/com.comsol.help.aco/aco_ug_pressure.05.177.html). Tests include an independently manufactured complex band solve, bulk-loss `Q≈1/eta`, narrow-neck lumped radiation Q, half-power root verification, passive loss combination, invalid settings and unresolved ranges.

### GitHub Pages hosting

On phones, **Project & tools** contains project files, examples, exports and Help. The bottom bar opens **Setup**, returns to the **Study**, or jumps to **Results**. Setup opens as a focused sheet; tap **Done** to return. The phone navigation keeps Design, FEM 2D and All tools visible; All tools opens the full tool library. Inverse design is expandable so the normal solve and results stay easy to reach. Inputs use readable text and touch targets, and wide FEM history tables scroll within their own area.

ResonLab runs entirely in the browser, including its FEM worker. Publish the repository's `main` branch from `/ (root)` in **Settings → Pages → Deploy from a branch**. The `.nojekyll` file serves the static application directly. All assets and worker paths are relative so the app supports a repository subdirectory. `serve.py` is only needed for a local preview.

To update a published copy, run `npm test`, commit the changes, and push `main`; GitHub Pages redeploys automatically.

### Automatic FEM inverse design

In **FEM 2D**, choose an application and enter **Target frequency (Hz)**. Click **Find dimensions with FEM**. The default frequency definition matches the current application: isolated damped cavity-pressure peak for tuning, mounted absorption peak for a panel, or mounted transmission-loss peak for a duct. An explicit **Lossless fundamental mode** option is also available; its target is a different quantity from the damped response peak.

The default **Frequency and Q together** mode adjusts cavity volume, neck length, neck radius and cavity height/diameter together. Enter **Target isolated bandwidth Q**, select at least two adjustable dimensions, and enter maximum overall diameter and height. Unchecked dimensions stay exactly fixed. Q is the **isolated cavity-average pressure half-power bandwidth Q**, with current loss mechanisms and medium held fixed. When targeting a mounted panel/duct peak, this Q remains a separate isolated reference; it is not the absorption/TL bandwidth Q. A flanged or unflanged mouth and finite damping are required.

Overall diameter is cavity diameter plus twice the wall/packaging allowance. Overall height is cavity height plus neck length plus twice that allowance. Defaults are **160 mm diameter, 300 mm height, 2 mm allowance per side**. The allowance reserves physical space; it does not add a structural wall or wall-vibration model. All four dimension bounds apply together, including bounds on fixed dimensions. Panel cell fit and duct neck clearance also include the allowance. The cavity height/diameter range defaults to 0.1–5.

Joint design evaluates the driven FEM response at every trial, including actual peak and half-power crossings. It uses constrained local least-squares steps, projected geometry limits, bounded pattern steps and deterministic restarts. Coarse-mesh exploration is followed by refinement on the requested mesh. Success requires a fresh six-mode solve and driven response verification of **both targets**, within the size envelope. Joint verification sweeps 0.1–2 times the lossless fundamental with 81 base samples plus adaptive peak/crossing solves. Default Q tolerance is **2%** (adjustable 0.1–20%); search effort is 100 or 180 driven FEM trials. The local search does not guarantee a global optimum or prove that an unsuccessful target is physically impossible.

**Frequency only · one dimension** retains the earlier automatic search: volume, neck length, then neck radius, stopping at the first verified frequency match. A specific parameter or uniform scaling is also available. Joint Q and overall-envelope controls apply only in the joint mode.

**Dimension bounds & accuracy** defaults to 0.05–50 L cavity volume, 1–500 mm neck length, 1–50 mm neck radius, and a 0.25–4 uniform scale factor. In frequency-only mode each range applies to the parameter being varied, and uniform scaling uses its scale range rather than the separate volume/neck ranges. Joint mode enforces all physical dimension bounds together. Geometric validity, cavity/neck clearance, panel cell fit and duct clearance further restrict the range. Frequency tolerance defaults to **0.1%** and can be set from 0.01–2%. This is a matching tolerance on the selected mesh, not an accuracy guarantee for the physical model.

In frequency-only mode, a bounded bisection search first locates a lossless FEM candidate. Complete response and mouth-port calculations then refine the requested application peak using bounded secant corrections. Verification uses a 0.5–1.5 fundamental-frequency sweep. Neither mode substitutes a fitted/lumped Helmholtz frequency or Q for FEM verification, nor inherits a display sweep that might exclude resonance.

The proposal shows before/after dimensions, target/verified values and errors, mesh, Q/application performance, envelope versus limits, warnings and an inspectable search history. **Your geometry is unchanged until Apply proposed dimensions.** Applying reruns the complete forward study on the verified mesh and sweep range. **Export proposed project** downloads an importable project without applying it. Save/Import retains targets, dimension locks, size limits, bounds and the applied-design audit. Legacy projects with single-parameter options reopen in frequency-only mode. FEM reports/JSON include the audit when its geometry, target, medium/losses, application and mesh match the current solve.

Unreachable targets and exhausted refinements are explicit failures; a closest candidate that missed tolerance has no Apply button. Automatic mode explains failed parameter attempts. **Cancel design search** terminates the worker without changing geometry. Changes to target, mounting, loss settings, mesh or search options invalidate an unapplied proposal. Geometry/environment changes rebuild the view and cancel its worker.

After applying, run **Check mesh convergence**: matching frequency and Q on one mesh does not prove spatial convergence. Existing low-ka radiation, thin wall-layer and ideal mounting limitations still apply. Search success does not establish high absorption, a manufacturing tolerance or uniqueness of the solution.

### Application workbench and simulation verification

Design starts with three Helmholtz FEM tasks: **Tune a resonance**, **Absorb sound**, and **Reduce duct noise**. The selected task exposes only its relevant mounting dimensions, target frequency and performance. Analytical examples remain available in an expandable section. Every view identifies its active model. The FEM summary places the lumped estimate, lossless eigenfrequency, isolated damped pressure peak and isolated bandwidth Q together; mounted absorption/TL are separate quantities. The field selector distinguishes a normalized lossless mode from the normalized driven isolated-peak pressure snapshot, aligned with the cavity pressure phase.

A second FEM solve prescribes uniform pressure `p=1 Pa` at the actual mouth, with the same physical interior and wall-layer operators. The mouth admittance and static exterior stiffness are removed. Dirichlet degrees of freedom are eliminated symmetrically, and the ORIGINAL weak-form reactions recover inward volume flow:

```
U_in = sum(mouth reactions) / (i omega rho)
Z_body = 1 Pa / U_in                      [Pa s/m³]
Z_branch = Z_body + i omega rho delta/A_neck
```

This is a defined uniform-pressure port approximation. Its resistance is checked for passivity and is independent of the free-air radiation switch. Mounted calculations retain the selected exterior end MASS as an approximate junction correction, without adding free-air radiation resistance again.

For **Absorb sound**, specify a square panel cell width `d` in millimetres. One cylindrical cavity occupies each cell; `d >= 2R` prevents cavity overlap. For a rigid-backed, locally reacting panel at normal incidence:

```
Z_surface = d² Z_branch
reflection = (Z_surface - rho c)/(Z_surface + rho c)
absorption = 1 - |reflection|²
```

The app shows peak absorption, mounted peak frequency, absorption at the target and the resistance/reactance matching ratios. These relations follow the [normal-incidence impedance formulation documented by Arup](https://strutt.arup.com/help/Building_Acoustics/HelmholtzAbsorber.htm). The panel is homogenized: mutual aperture coupling, finite-panel edge effects and diffuse-field absorption are excluded. The isolated-mouth end mass is provisional for this mounting; no exterior FEM domain is implied. A quarter-wavelength pitch warning flags part of the range where local homogenization warrants review; it is a heuristic, not an accuracy guarantee.

For **Reduce duct noise**, specify main duct diameter `D`. The model is a compact side-branch shunt on equal anechoically terminated circular ducts without flow, using pressure/volume-flow continuity:

```
Zc = rho c / A_duct
transmitted pressure t = 2 Z_branch/(2 Z_branch + Zc)
reflected pressure r = -Zc/(2 Z_branch + Zc)
T = |t|², R = |r|², A = 1-T-R
TL = -10 log10(T)
```

The plane-wave shunt/transfer-matrix approach is described in [Wu et al., Sensors (2017)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5469634/). The app displays transmitted, reflected and dissipated power separately. A lossless branch can reflect sound strongly while absorbing none. The cutoff warning uses the first transverse circular-duct mode `f_cut=1.84118 c/(pi D)`; it does not imply that all lower frequencies automatically satisfy the compact-junction approximation. Mean flow, finite duct-end reflections, junction-resolved scattering and room insertion loss are excluded.

**Check mesh convergence** records lossless frequency, isolated damped peak/Q, and mounted peak/value across three meshes. The summary checks the latest frequency shift <0.5%, Q shift <2%, mounted peak shift <0.5%, and mounted value change <0.01 absorption coefficient or <0.2 dB TL. These are visible engineering screening thresholds, not certified error bounds. The numerical equation residual and physical approximation warnings remain separate from this mesh check.

**Export application performance CSV** includes mouth impedance, the selected application curve, geometry, medium, mounting and assumptions. **Export → Response CSV** follows the active application; **Export isolated pressure CSV** always exports the separate pressure-gain reference. Reports and JSON include mounting, target, results and any reference comparison. Save/Import preserves task, dimensions, target, losses and imported comparison data.

The expandable **Verify with a reference curve** panel supports local CSVs with `frequency_Hz` and `magnitude` (linear Pa/Pa), `magnitude_dB` (20 log10 Pa/Pa, not SPL), `absorption`, or `transmission_loss_dB`. One quantity is allowed per file; frequencies must be positive, finite and unique. Imports reject malformed data and retain the previous trace on failure. Comparison uses overlapping frequencies, sampled peak locations, interpolated half-power crossings for pressure only, optional per-peak normalization and interpolated-curve RMSE. It does not fit the solver or establish that boundary/source conditions match.

No experimental data is bundled. `examples/response-reference.csv` is explicitly SYNTHETIC: an independent damped oscillator with `f_n=150 Hz`, `Q_parameter=50`, sampled every 0.1 Hz from 100–200 Hz. It exercises data handling and bandwidth extraction (sampled Q about 49.97); a difference from the Helmholtz FEM curve is expected. The optional importer is available for other simulations or future measurements.

The **physics verification suite** provides reproducible checks against exact/reference limits rather than experimental calibration. Additional cases cover closed-cylinder mouth impedance `-i rho c cot(kH)/A`, matched absorption, lossless reflection, side-branch power conservation, radiation-independent interior impedance, mounting validation, reference extraction and safe project round trips. Run it from the FEM summary or with `npm test`.

The optional **Rectangle verification benchmark** retains independent Lx/Ly and Nx/Ny controls and the exact rigid-rectangle reference. Its uniform static 0 Hz field applies only to that closed benchmark.

The axisymmetric pressure formulation and boundary conventions follow [COMSOL's pressure-acoustics equations](https://doc.comsol.com/6.3/doc/com.comsol.help.aco/aco_ug_pressure.05.164.html) and [impedance boundary definitions](https://doc.comsol.com/6.4/doc/com.comsol.help.aco/aco_ug_pressure.05.023.html). The JavaScript implementation is independent and has no COMSOL dependency.

Infinite damping Q values are serialized as the string `"Infinity"` and restored on import. Legacy `null` Q values are interpreted as Infinity. Partial geometry imports use defaults for the imported resonator type.

## Limitations

- Geometry-linked FEM supports a cylindrical Helmholtz cavity and one coaxial circular neck, with low-ka radiation and thin-layer wall losses. No arbitrary shapes, exterior radiation mesh, mean flow, nonlinear jet loss, flexible walls or full thermoviscous flow.
- Schematic animations are illustrative only
- Main Helmholtz results remain lumped; FEM lists axisymmetric modes with an approximate low-frequency mouth condition
- Coupled model is two-mode only
- Q estimates for boundary layers are order-of-magnitude
- Cylindrical modes limited by search range of J′ roots
- Live microphone support captures audio only; synchronized two-channel live impedance analysis is not implemented. Capture stops when its controls are removed.
- Radiation Q estimates are available for Helmholtz necks; wall Q estimates for rectangular cavities. Other types disable these controls. Leakage uses the specified Leak Q.

## Testing

**CLI (Node):**

```bash
node tests/run-validation.mjs
```

**Browser:** open `tests/index.html` via the same static server, or choose **Export → Run tests** in the app.

Validation covers: air properties, open-open / open-closed / closed-closed series, end corrections, Helmholtz forward + inverse, Bessel/J′ roots, rectangular modes, coupling/splitting, Q combination and decay times, pressure node/antinode positions, physical sanity checks (length↑ ⇒ f↓, volume↑ ⇒ f0↓, coupling↑ ⇒ splitting↑, Q↓ ⇒ Δf↑), and invalid-input rejection.

## Advanced scientific modules

| Module | Provides |
|--------|----------|
| `js/physics/science.js` | Complex poles (s-plane), circular-piston radiation impedance, N-mode coupling matrix + Jacobi eigen, two-microphone impedance tube (ISO 10534-2 style), Monte-Carlo uncertainty, modal Gram matrix |
| `js/physics/advanced.js` | MPP (Maa-type), horns, duct transfer matrices, thermoviscous duct (Zwikker–Kosten-type), Helmholtz Z(ω), sensitivity, Weyl mode density, side-branch stubs |
| `js/physics/spherical-annular.js` | Spherical cavity (j_l′ roots), annular cavity (J′/Y′ Wronskian roots) |
| `js/physics/sweep.js` | 1D/2D parameter sweeps, extremum finding, local slopes |

### Analysis tabs

- **Geometry** — schematic + scientific metrics
- **Modes** — spectrum + pressure mode shapes
- **Frequency Response** — multi-Lorentzian response with f marks
- **Damping** — Q breakdown
- **Coupling** — avoided crossing + splitting vs κ
- **Science** — s-plane poles, tornado elasticities, Monte Carlo histogram
- **Sweeps** — f₁ vs chosen parameter + secondary sweep
- **Impedance** — Z(ω) (Helmholtz or piston) + two-microphone tube simulation
- **FEM 2D** — geometry-linked Helmholtz mesh and eigenmodes, radiation and wall damping, driven response and half-power Q, coarse/medium/fine convergence, field/response exports; optional rectangle verification
- **Audio Tube** — synthetic two-microphone load recovery using specific impedance (Pa·s/m); live audio capture only

## UI notes

- **Display units:** length (mm/cm/m) and frequency (Hz/kHz/MHz) selectors convert inputs; SI is stored internally.
- **Mode selection:** “Visualize mode #” picks which mode is drawn on the canvas and mode-shape plot.
- **Phase / Play-Pause:** the phase slider and Pause button control the illustrative harmonic animation.
- **Inverse design (Helmholtz):** solve for V, L_n, or a; results are checked against the forward equation and can be applied to geometry.
- **Pressure nodes vs velocity nodes:** the modes table lists pressure nodes/antinodes. Particle-velocity nodes sit at pressure antinodes.

## How to add a model

1. Add a pure function under `js/physics/` (no Plotly/Three imports).
2. Return frequencies with `assumptions` and `formula` fields.
3. Register geometry controls in `js/app.js` (`buildGeometryControls`).
4. Extend `computeResults` and `geometrySummary`.
5. Add cases in `js/physics/validation.js`.

## Examples

See `examples/` for sample project JSON and exported CSV (modes + frequency response).

## References

- Kinsler, Frey, Coppens, Sanders, *Fundamentals of Acoustics*, 4th ed., Wiley — tube and cavity formulas, end corrections.
- Morse & Ingard, *Theoretical Acoustics* — boundary conditions, Bessel modes.
- Fletcher & Rossing, *The Physics of Musical Instruments* — open/closed pipes, Helmholtz.
- ISO 10534-2 (impedance tube) — measurement context for resonance/Q (not implemented as a standard workflow).
- Cramer (1993) / Owen Cramer, *The variation of the specific heat ratio and the speed of sound in air with temperature, pressure, humidity, and CO₂* — humid-air c trends (approximate form used here is labeled).

Equations above are standard textbook results; no fabricated precision is claimed.
