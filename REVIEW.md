# Resonator Study Studio: review and repairs

Follow-up: the first geometry-linked Helmholtz FEM stage is now implemented in ResonLab V1.3. It meshes the cylindrical cavity and single coaxial neck, uses axisymmetric P1 elements and an approximate open-mouth boundary, and includes worker execution, convergence checks and mesh/field exports. A subsequent stage adds full complex driven FEM response with low-ka mouth radiation, thin viscous/thermal wall layers, peak/bandwidth Q, independent loss controls, response exports and frequency/Q convergence. The application workbench now adds tuning, normal-incidence panel absorption and compact duct-branch transmission loss using a separate uniform-pressure FEM mouth port, with numerical verification and optional reference-curve comparison. No measured benchmark is bundled. Automatic bounded FEM inverse design now supports joint frequency and isolated bandwidth-Q targets, varying multiple dimensions inside overall diameter/height limits, with locked dimensions, packaging allowance, selected-mesh verification and design audit records. The earlier single-dimension frequency search remains available. See README for current capabilities; the assessment below records the earlier review state.

Reviewed 27 October 2026. This was a source review, numerical regression pass and browser smoke test, not an exhaustive scientific certification.

## Assessment

The application is a useful analytical resonator workbench with a newly corrected, genuine 2D FEM reference study. It is not yet a general geometry-driven FEM studio. The reference study uses bilinear quadrilateral elements, consistent mass and the generalized Helmholtz eigenproblem Kp = k²Mp on a homogeneous rigid rectangle.

The weak-form basis is consistent with the [FEniCSx Helmholtz tutorial](https://jsdokken.com/dolfinx-tutorial/chapter2/helmholtz.html). The implementation is independent JavaScript and does not depend on FEniCS.

## Verified issues repaired

| Issue | Consequence before repair | Repair |
|---|---|---|
| FEM was finite differences, with inconsistent boundary/grid interpretation | Misleading method name and biased frequencies; the original square test accepted 20% error | Actual Q1 finite elements with consistent mass; separate small generalized axis eigenproblems |
| Dense 2D Jacobi solve on the UI thread | Work grew quickly with Nx×Ny | Tensor separation for the structured rectangle; 24×24 solved in about 26 ms in one local Node measurement (not a browser performance guarantee) |
| Fractional meshes and silent clamping | Unexpected matrix sizes and changes to entered settings | Reject invalid inputs; integer and finite limits checked before allocation |
| Numerical zero-mode threshold and truncated analytical reference | DC handling and comparisons could be misleading, especially for thin rectangles | Exactly one static null mode; optional exclusion by identity; sufficient analytical axial indices |
| FEM controls recreated with hardcoded settings | Mesh changes disappeared on tab changes; domain inferred from unrelated tube dimensions | Independent explicit Lx/Ly controls, persisted mesh/mode settings and selectable fields |
| Microphone inversion phase mismatch | Synthetic known load was recovered incorrectly | Consistent pressure convention and inverse phase correction |
| Reflected pressure omitted source amplitude | Estimated impedance depended on excitation amplitude | Scale both incident and reflected waves |
| Impedance conventions disagreed | Forward and inverse tube routines used different units | Both use specific impedance, Pa·s/m; correct the audio plot label |
| Singular microphone spacing accepted | Ill-conditioned or meaningless inverse results | Reject sin(ks) near zero and undefined transfer functions |
| Project JSON lost Infinity | Infinite Q became null and controls/state no longer round-tripped faithfully | Explicit Infinity encoding; restore legacy null Q values |
| Imported non-tube geometry inherited tube defaults | Partial projects could miss required fields | Merge defaults for the imported resonator type; reject unknown types |
| Imported/reset theme and project name could disagree with state | Visible UI did not reflect loaded settings | Synchronize theme and project title on state replacement |
| Leak appeared in the Q breakdown without entering the inverse-Q sum | Displayed channels and loaded Q disagreed | Include leakage in the calculation and expose Leak Q input |
| Radiation switch had no calculation behind it | Toggling it did nothing | Wire the existing Helmholtz neck estimate; disable unsupported radiation/wall controls |
| Coupled branches used swapped Q participation weights | At zero coupling, upper/lower modes could inherit the other oscillator's Q | Correct participation weights; reject coupling that gives non-positive frequencies |
| Coupling chart container never attached | Coupled study plot invisible; non-coupled models produced an error | Attach chart container and show a model-selection hint when appropriate |
| Removed plots still had asynchronous work | Rapid tab changes caused resize/auto-margin errors and retained plot resources | Dispose old plots after pending rendering/resizing finishes; skip retired elements |
| Microphone controls could disappear while capture continued | No accessible Stop button after tab changes | Release capture on re-render; close owned audio contexts; cancel pending permission requests safely |
| Windows server startup printed an unsupported Unicode arrow | Default Windows console encoding could prevent startup | ASCII startup message; align npm start and README with included server |
| Documentation still claimed CDN-only charts and no FEM | Capabilities and offline requirements were unclear | Update README and introductory help |

## Verification

- 74/74 automated checks pass, increased from 61. New checks cover FEM matrix symmetry, integrated mass/area, constant nullspace, generalized eigenpair residuals, mass orthogonality, second-order mesh convergence, thin-domain analytical references, invalid input rejection, exact complex impedance recovery, amplitude/position invariance, coupled Q limits, and project round trips.
- For c = 343 m/s and a 1×0.8 m rectangle on 24×24 nodes, the first eight FEM frequencies including DC differ from analytical values by at most 0.312%. On 33×33 nodes, all seven tested nonzero modes differ by less than 0.2%.
- Browser checks: all 16 built-in presets load; all analysis tabs inspected; fractional mesh rejection, selectable FEM fields and retained settings verified. Leak Q=10 reduces the default tube's loaded Q from about 46.4 to 8.2.
- Synthetic load 250 − j40 Pa·s/m is recovered as 250 − j40 in the interface. Repeated rapid tab switching after the plot cleanup repair produced no new console errors.
- Local Windows server starts successfully. Microphone hardware and actual permission-granted capture were not exercised.

Run the automated suite with `npm test`. Start the application with `npm start` and open http://127.0.0.1:8877/.

## Remaining gaps and recommended next stage

1. **Geometry-driven FEM:** add a real 2D geometry model and mesh generation for cavity-and-neck, ducts, bends and coupled cavities. The current FEM rectangle remains independent of the primary analytical model.
2. **Boundary conditions:** add per-boundary rigid, pressure-release, impedance and radiation conditions. Open resonators require radiation modeling before their numerical modes can be interpreted physically.
3. **Driven response and losses:** solve a complex forced Helmholtz system for source/receiver response and damping. Current primary frequency responses are engineering modal approximations, not driven FEM results.
4. **Result provenance and export:** primary result cards, CSV and calculation reports refer to the analytical model. Only FEM study settings are saved in project JSON; provide dedicated FEM result/mesh exports before making a unified study report.
5. **Numerical scalability:** tensor separation is restricted to a uniform homogeneous rectangle. Arbitrary meshes need sparse assembly, a suitable generalized eigensolver and worker execution with progress/cancellation.
6. **Scientific calibration:** benchmark gas-dependent viscosity/conductivity, humid-air sound-speed corrections, low-Q poles and approximate radiation/loss models against trusted data. Passing the current tests does not validate these approximations across all parameter ranges.
7. **Result semantics for advanced models:** the duct-chain primary panel uses the chosen analysis frequency as a mode-like entry; horn/MPP entries also require a clearer distinction between analysis frequencies, characteristic frequencies and solved resonances.
8. **Measurements:** live mic currently captures audio only. It does not implement calibrated, synchronized two-channel impedance measurements or display a live recovered load. The UI now says so explicitly.
9. **Online studio workflow:** static hosting is possible, but collaboration, durable cloud projects, shared studies and a solver service are not implemented. No online deployment was performed during this review.
10. **Narrow-screen layout:** the 742 px browser view compresses setup, workspace and results into small nested scrolling regions. A 1440 px desktop view was also checked. The mobile layout needs a dedicated pass so the active study can use the available screen height.

The next development milestone should be a meshed 2D cavity-and-neck benchmark with explicit boundaries, analytical/mesh-convergence comparisons, and a saved study containing the exact geometry, mesh, medium, solver settings and results.
