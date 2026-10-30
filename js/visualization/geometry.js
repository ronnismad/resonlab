/**
 * Geometry schematics and derived geometric quantities.
 * SVG strings for the central workspace.
 */
import { helmholtzFemGeometry } from '../physics/helmholtz-fem.js?v=20261027';

/**
 * Build an SVG schematic for the current resonator type.
 * @returns {string} SVG markup
 */
export function geometrySVG(state, env) {
  const type = state.resonatorType;
  const g = state.geometry;
  const c = env?.c ?? 343;

  switch (type) {
    case 'tube':
      return tubeSVG(g, c);
    case 'helmholtz':
      return helmholtzSVG(g, c);
    case 'rectangular-cavity':
      return rectCavitySVG(g, c);
    case 'cylindrical-cavity':
      return cylCavitySVG(g, c);
    case 'spherical-cavity':
      return sphereSVG(g, c);
    case 'annular-cavity':
      return annularSVG(g, c);
    case 'side-branch':
      return sideBranchSVG(g, c);
    case 'mpp':
      return mppSVG(g, c);
    case 'horn':
      return hornSVG(g, c);
    case 'duct-chain':
      return ductChainSVG(g, c);
    case 'coupled':
      return coupledSVG(g);
    default:
      return tubeSVG(g, c);
  }
}

function header(label, sub = '') {
  return `
    <text x="36" y="28" class="svg-title">${label}</text>
    ${sub ? `<text x="36" y="46" class="svg-caption">${sub}</text>` : ''}
  `;
}

/** Technical-drawing defs: arrowheads, hatch, centerline. */
function svgDefs() {
  return `
    <defs>
      <marker id="arrS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" class="svg-arrow"/>
      </marker>
      <marker id="arrE" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0,1 L9,5 L0,9 z" class="svg-arrow"/>
      </marker>
      <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" class="svg-hatch"/>
      </pattern>
    </defs>
  `;
}

/**
 * Dimension line with end ticks and arrows (ISO-style).
 * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
 * @param {string} label
 * @param {'below'|'above'|'left'|'right'} pos
 */
function dimLine(x1, y1, x2, y2, label, pos = 'below') {
  let tx = (x1 + x2) / 2;
  let ty = (y1 + y2) / 2;
  let anchor = 'middle';
  let dy = 0;
  if (pos === 'below') { ty = Math.max(y1, y2) + 16; }
  if (pos === 'above') { ty = Math.min(y1, y2) - 8; }
  if (pos === 'right') { tx = Math.max(x1, x2) + 8; anchor = 'start'; }
  if (pos === 'left') { tx = Math.min(x1, x2) - 8; anchor = 'end'; }
  return `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="svg-dim" marker-start="url(#arrS)" marker-end="url(#arrE)"/>
    <text x="${tx}" y="${ty}" class="svg-label" text-anchor="${anchor}">${label}</text>
  `;
}

/** Centerline (dash-dot) through a body. */
function centerLine(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="svg-center"/>`;
}

/** Extension / witness lines from body edge to dimension line. */
function witness(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="svg-witness"/>`;
}

function wrapSvg(inner, w = 720, h = 300) {
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="geo-svg" role="img">
    ${svgDefs()}
    ${inner}
  </svg>`;
}

/** Formula strip at bottom of schematic. */
function formulaStrip(lines, y = 288) {
  return lines.map((t, i) =>
    `<text x="36" y="${y + i * 18}" class="svg-caption svg-formula">${t}</text>`
  ).join('');
}

function tubeSVG(g, c) {
  const L = g.length ?? 1;
  const D = g.diameter ?? 0.05;
  const boundary = g.boundary ?? 'open-open';
  const a = D / 2;
  const delta = g.applyEndCorrection === false ? 0 : (g.flanged ? 0.8216 : 0.6133) * a;
  const Le = g.applyEndCorrection === false
    ? L
    : boundary === 'open-open' ? L + 2 * delta
      : boundary === 'open-closed' ? L + delta
        : L;
  const f1 = boundary === 'open-closed' ? c / (4 * Le) : c / (2 * Le);
  const openL = boundary.startsWith('open');
  const openR = boundary.endsWith('open');

  return wrapSvg(`
    ${header('Tube resonator — longitudinal section', 'Axisymmetric · plane-wave (1-D) · SI units')}
    ${centerLine(50, 139, 670, 139)}
    <rect x="80" y="100" width="540" height="78" rx="2" class="svg-tube"/>
    ${!openR ? `<rect x="620" y="86" width="14" height="106" class="svg-wall"/>` : ''}
    ${!openL ? `<rect x="66" y="86" width="14" height="106" class="svg-wall"/>` : ''}
    ${openL ? `<path d="M80 100 L68 92 M80 178 L68 186" class="svg-open-mark"/>` : ''}
    ${openR ? `<path d="M620 100 L632 92 M620 178 L632 186" class="svg-open-mark"/>` : ''}
    <text x="88" y="198" class="svg-label">${openL ? 'open  p ≈ 0' : 'closed  u = 0'}</text>
    <text x="612" y="198" class="svg-label" text-anchor="end">${openR ? 'open  p ≈ 0' : 'closed  u = 0'}</text>
    ${witness(80, 178, 80, 230)}
    ${witness(620, 178, 620, 230)}
    ${dimLine(80, 220, 620, 220, `L = ${fmt(L)} m`, 'below')}
    ${witness(620, 139, 655, 139)}
    ${dimLine(620, 60, 668, 60, `D = ${fmt(D, 4)} m`, 'above')}
    ${delta > 0 && g.applyEndCorrection !== false
      ? `<text x="350" y="248" class="svg-label" text-anchor="middle">L_eff = ${fmt(Le)} m  ·  Δ = ${fmt(delta, 4)} m (${g.flanged ? '0.8216 a' : '0.6133 a'})</text>`
      : ''}
    ${formulaStrip([
      boundary === 'open-closed'
        ? `f_n = (2n−1) c / (4 L_eff)   →   f₁ ≈ ${fmt(f1, 1)} Hz`
        : `f_n = n c / (2 L_eff)   →   f₁ ≈ ${fmt(f1, 1)} Hz`,
      `c = ${fmt(c, 1)} m/s · schematic section, not a full-wave field solution`,
    ], 278)}
  `, 720, 320);
}

function helmholtzSVG(g, c) {
  const V = g.volume ?? 0.002;
  const r = g.neckRadius ?? 0.02;
  const Ln = g.neckLength ?? 0.05;
  const A = Math.PI * r * r * (g.nNecks || 1);
  const delta = g.endCorrectionModel === 'none' ? 0 : (g.endCorrectionModel === 'unflanged' ? 0.6133 : 0.8216) * r;
  const Le = Ln + delta;
  const f0 = (c / (2 * Math.PI)) * Math.sqrt(A / (V * Le));

  let shape;
  try { shape = helmholtzFemGeometry(g); } catch { /* Analytical models also allow geometries not supported by FEM. */ }
  if (shape) {
    const { radius: R, height: H } = shape;
    const scale = Math.min(490 / (H + Ln), 155 / (2 * R));
    const x0 = 90, x1 = x0 + H * scale, x2 = x1 + Ln * scale, y = 150;
    const outline = `M${x0} ${y - R * scale}H${x1}V${y - r * scale}H${x2}V${y + r * scale}H${x1}V${y + R * scale}H${x0}Z`;
    return wrapSvg(`
      ${header('Current cylindrical Helmholtz geometry', 'Same cavity and coaxial neck used by FEM · geometric proportions preserved')}
      <path d="${outline}" class="svg-cavity"/>
      ${centerLine(65, y, x2 + 25, y)}
      <line x1="${x2}" y1="${y - r * scale}" x2="${x2}" y2="${y + r * scale}" stroke="#4cdbb2" stroke-width="4"/>
      <text x="${(x0 + x1) / 2}" y="145" class="svg-label" text-anchor="middle">V = ${fmt(V * 1000)} L</text>
      <text x="${x2 + 12}" y="${y - r * scale - 8}" class="svg-label">open mouth</text>
      ${dimLine(x0, 257, x1, 257, `Cavity H = ${fmt(H * 1000, 2)} mm`, 'below')}
      <text x="36" y="302" class="svg-caption">Cavity radius ${fmt(R * 1000, 2)} mm · neck radius ${fmt(r * 1000, 2)} mm · neck length ${fmt(Ln * 1000, 2)} mm</text>
      <text x="36" y="325" class="svg-caption">Lumped f₀ ≈ ${fmt(f0, 2)} Hz · open FEM 2D for the mesh-resolved pressure modes</text>
    `, 720, 350);
  }

  return wrapSvg(`
    ${header('Helmholtz resonator — lumped mass–compliance', 'Valid for λ ≫ cavity dimensions · SI units')}
    ${centerLine(70, 150, 620, 150)}
    <rect x="80" y="80" width="300" height="150" rx="6" class="svg-cavity"/>
    <rect x="380" y="132" width="170" height="36" class="svg-neck"/>
    <path d="M550 118 L562 110 M550 182 L562 190" class="svg-open-mark"/>
    <text x="230" y="148" class="svg-label" text-anchor="middle">V = ${fmt(V * 1e3, 3)} L</text>
    <text x="230" y="166" class="svg-caption" text-anchor="middle">compliance  C_a = V/(ρc²)</text>
    ${witness(380, 132, 380, 248)}
    ${witness(550, 132, 550, 248)}
    ${dimLine(380, 238, 550, 238, `L_n = ${fmt(Ln * 100, 2)} cm`, 'below')}
    ${dimLine(560, 132, 560, 168, `2r = ${fmt(2 * r * 100, 2)} cm`, 'right')}
    <text x="465" y="124" class="svg-label" text-anchor="middle">neck  (mass  M_a)</text>
    ${formulaStrip([
      `f₀ = (c/2π) √(A / (V L_eff)) ≈ ${fmt(f0, 1)} Hz`,
      `A = ${fmt(A * 1e4, 2)} cm² · L_eff = ${fmt(Le * 100, 2)} cm · Δ = ${fmt(delta * 100, 2)} cm (${g.endCorrectionModel || 'flanged'})`,
    ], 278)}
  `, 720, 320);
}

function rectCavitySVG(g, c) {
  const Lx = g.Lx ?? 1;
  const Ly = g.Ly ?? 0.8;
  const Lz = g.Lz ?? 0.6;
  const f100 = (c / 2) / Lx;

  return wrapSvg(`
    ${header('Rectangular rigid-wall cavity', 'Rigid BC: ∂p/∂n = 0 · cartesian modes')}
    <rect x="150" y="80" width="320" height="150" class="svg-cavity" rx="2"/>
    <rect x="150" y="80" width="320" height="150" fill="url(#hatch)" opacity="0.15"/>
    ${centerLine(310, 55, 310, 255)}
    ${centerLine(120, 155, 540, 155)}
    ${witness(150, 230, 150, 250)}
    ${witness(470, 230, 470, 250)}
    ${dimLine(150, 242, 470, 242, `L_x = ${fmt(Lx)} m`, 'below')}
    ${witness(150, 80, 100, 80)}
    ${witness(150, 230, 100, 230)}
    ${dimLine(90, 80, 90, 230, `L_y = ${fmt(Ly)} m`, 'left')}
    <path d="M470 80 L520 50 M470 230 L520 200" class="svg-dim" marker-end="url(#arrE)"/>
    <text x="530" y="130" class="svg-label">L_z = ${fmt(Lz)} m</text>
    ${formulaStrip([
      `f_lmn = (c/2) √[(l/Lx)² + (m/Ly)² + (n/Lz)²]`,
      `f₁₀₀ ≈ ${fmt(f100, 1)} Hz · rigid walls, no thermoviscous loss in eigenfrequencies`,
    ], 278)}
  `, 720, 320);
}

function cylCavitySVG(g, c) {
  const a = g.radius ?? 0.25;
  const L = g.length ?? 0.8;
  return wrapSvg(`
    ${header('Cylindrical rigid-wall cavity')}
    <ellipse cx="190" cy="155" rx="42" ry="72" class="svg-cavity"/>
    <rect x="190" y="83" width="330" height="144" class="svg-cavity"/>
    <ellipse cx="520" cy="155" rx="42" ry="72" class="svg-cavity"/>
    <text x="355" y="258" class="svg-label" text-anchor="middle">L = ${fmt(L)} m</text>
    <text x="190" y="55" class="svg-label" text-anchor="middle">a = ${fmt(a)} m</text>
    <text x="36" y="288" class="svg-caption">Modes use J′_m roots χ′_mp — not rectangular formulas</text>
    <text x="36" y="308" class="svg-caption">f = (c/2π)√[(χ′_mp/a)² + (pπ/L)²]</text>
  `, 720, 320);
}

function sphereSVG(g, c) {
  const R = g.radius ?? 0.3;
  return wrapSvg(`
    ${header('Spherical rigid-wall cavity')}
    <circle cx="360" cy="155" r="100" class="svg-cavity"/>
    <circle cx="360" cy="155" r="70" class="svg-dim" fill="none"/>
    <circle cx="360" cy="155" r="40" class="svg-dim" fill="none"/>
    <line x1="360" y1="155" x2="460" y2="155" class="svg-dim"/>
    <text x="410" y="148" class="svg-label">R = ${fmt(R)} m</text>
    <text x="36" y="288" class="svg-caption">f_nlm = (c/2πR)·χ_nl · j_l′(χ)=0 · degeneracy 2l+1</text>
    <text x="36" y="308" class="svg-caption">Rigid sphere · spherical Bessel roots</text>
  `, 720, 320);
}

function annularSVG(g, c) {
  const a = g.innerRadius ?? 0.08;
  const b = g.outerRadius ?? 0.25;
  const L = g.length ?? 0.6;
  return wrapSvg(`
    ${header('Annular cylindrical cavity')}
    <ellipse cx="180" cy="155" rx="50" ry="80" class="svg-cavity"/>
    <rect x="180" y="75" width="340" height="160" class="svg-cavity"/>
    <ellipse cx="520" cy="155" rx="50" ry="80" class="svg-cavity"/>
    <ellipse cx="180" cy="155" rx="22" ry="34" class="svg-open-end"/>
    <ellipse cx="520" cy="155" rx="22" ry="34" class="svg-open-end"/>
    <text x="350" y="258" class="svg-label" text-anchor="middle">L = ${fmt(L)} m</text>
    <text x="180" y="50" class="svg-label" text-anchor="middle">a=${fmt(a)} m · b=${fmt(b)} m</text>
    <text x="36" y="288" class="svg-caption">Rigid annulus · J′_m(ka)Y′_m(kb) − J′_m(kb)Y′_m(ka) = 0</text>
    <text x="36" y="308" class="svg-caption">Gap b−a = ${fmt(b - a, 3)} m</text>
  `, 720, 320);
}

function sideBranchSVG(g, c) {
  const Lb = g.branchLength ?? 0.4;
  return wrapSvg(`
    ${header('Side-branch / quarter-wave stub')}
    <rect x="60" y="170" width="600" height="36" rx="8" class="svg-tube"/>
    <rect x="300" y="50" width="36" height="120" rx="8" class="svg-neck"/>
    <rect x="292" y="40" width="52" height="12" rx="2" class="svg-wall"/>
    <text x="360" y="40" class="svg-label" text-anchor="middle">closed stub</text>
    <text x="318" y="120" class="svg-label" text-anchor="middle">L = ${fmt(Lb, 2)} m</text>
    <text x="360" y="230" class="svg-label" text-anchor="middle">main duct</text>
    <text x="36" y="288" class="svg-caption">${g.boundary === 'half-wave' ? 'Half-wave stub: f_n = n c/(2L)' : 'Quarter-wave stub: f_n = (2n−1)c/(4L)'}</text>
    <text x="36" y="308" class="svg-caption">Side branch acts as reactive load on main duct</text>
  `, 720, 320);
}

function mppSVG(g, c) {
  const d = (g.holeDiameter ?? 0.0005) * 1000;
  const t = (g.panelThickness ?? 0.001) * 1000;
  const sig = (g.porosity ?? 0.05) * 100;
  return wrapSvg(`
    ${header('Micro-perforated panel (MPP)')}
    <rect x="180" y="70" width="18" height="160" class="svg-cavity"/>
    <rect x="198" y="70" width="220" height="160" class="svg-tube"/>
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="189" cy="${95 + i * 30}" r="4" class="svg-open-end"/>`).join('')}
    <text x="310" y="155" class="svg-label" text-anchor="middle">backed cavity</text>
    <text x="120" y="55" class="svg-label">panel</text>
    <text x="36" y="288" class="svg-caption">d ≈ ${d.toFixed(2)} mm · t ≈ ${t.toFixed(2)} mm · σ ≈ ${sig.toFixed(1)}%</text>
    <text x="36" y="308" class="svg-caption">Maa-type transfer impedance · viscous + inertial end corrections</text>
  `, 720, 320);
}

function hornSVG(g, c) {
  const type = g.hornType || 'exponential';
  return wrapSvg(`
    ${header(`Horn — ${type} profile`)}
    <path d="M120 120 L120 180 L520 230 L520 70 Z" class="svg-tube"/>
    <text x="140" y="158" class="svg-label">throat a₀</text>
    <text x="480" y="158" class="svg-label">mouth</text>
    <text x="320" y="250" class="svg-label" text-anchor="middle">L = ${fmt(g.length ?? 0.5, 2)} m</text>
    <text x="36" y="288" class="svg-caption">a₀ = ${fmt((g.throatRadius ?? 0.02) * 1000, 1)} mm · a_L = ${fmt((g.mouthRadius ?? 0.12) * 100, 1)} cm</text>
    <text x="36" y="308" class="svg-caption">${type === 'exponential' ? 'f_c = (c/2π)·m, m = ln(aL/a0)/L' : 'Webster conical horn · plane-wave approx.'}</text>
  `, 720, 320);
}

function ductChainSVG(g, c) {
  return wrapSvg(`
    ${header('Duct chain — transfer matrix')}
    <rect x="50" y="120" width="180" height="50" class="svg-tube"/>
    <rect x="230" y="105" width="220" height="80" class="svg-neck"/>
    <rect x="450" y="120" width="180" height="50" class="svg-tube"/>
    <text x="140" y="150" class="svg-label" text-anchor="middle">seg 1</text>
    <text x="340" y="150" class="svg-label" text-anchor="middle">seg 2</text>
    <text x="540" y="150" class="svg-label" text-anchor="middle">seg 3</text>
    <text x="140" y="210" class="svg-caption" text-anchor="middle">A₁=${fmt(g.seg1Area * 1e4, 1)} cm²</text>
    <text x="340" y="210" class="svg-caption" text-anchor="middle">A₂=${fmt(g.seg2Area * 1e4, 1)} cm²</text>
    <text x="540" y="210" class="svg-caption" text-anchor="middle">A₃=${fmt(g.seg3Area * 1e4, 1)} cm²</text>
    <text x="36" y="288" class="svg-caption">[p1;U1] = T1 T2 T3 [p2;U2] · T = [[cos kL, jZ₀ sin kL],[j sin kL/Z₀, cos kL]]</text>
    <text x="36" y="308" class="svg-caption">Loss ≈ ${fmt(g.lossNp_per_m ?? 0, 3)} Np/m (per segment)</text>
  `, 720, 320);
}

function coupledSVG(g) {
  const f1 = g.f1 ?? 200;
  const f2 = g.f2 ?? 220;
  const k = g.couplingHz ?? 4;
  return wrapSvg(`
    ${header('Coupled two-mode resonator')}
    <rect x="80" y="90" width="170" height="110" rx="14" class="svg-cavity"/>
    <rect x="450" y="90" width="170" height="110" rx="14" class="svg-cavity"/>
    <line x1="250" y1="145" x2="450" y2="145" class="svg-coupling"/>
    <text x="165" y="150" class="svg-label" text-anchor="middle">Resonator A</text>
    <text x="535" y="150" class="svg-label" text-anchor="middle">Resonator B</text>
    <text x="350" y="128" class="svg-label" text-anchor="middle">κ →</text>
    <text x="165" y="230" class="svg-label" text-anchor="middle">f₁ = ${fmt(f1, 1)} Hz</text>
    <text x="535" y="230" class="svg-label" text-anchor="middle">f₂ = ${fmt(f2, 1)} Hz</text>
    <text x="350" y="255" class="svg-label" text-anchor="middle">Δc = ${fmt(k, 2)} Hz</text>
    <text x="36" y="288" class="svg-caption">Two-mode κ model · not a full-wave simulation</text>
  `, 720, 310);
}

function fmt(v, digits = 3) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toFixed(1);
  if (Math.abs(v) >= 10) return v.toFixed(Math.min(2, digits));
  return v.toFixed(digits);
}

/**
 * Derived geometric quantities for the results panel.
 */
export function geometrySummary(state, env) {
  const g = state.geometry;
  const c = env.c;
  const type = state.resonatorType;
  const rows = [];

  if (type === 'tube') {
    const L = g.length;
    const D = g.diameter;
    rows.push({ k: 'Length L', v: `${L} m`, note: 'geometric' });
    rows.push({ k: 'Diameter D', v: `${D} m`, note: `radius a = ${D / 2} m` });
    rows.push({ k: 'Boundary', v: g.boundary, note: 'idealized' });
    if (g.applyEndCorrection) {
      const d = (g.flanged ? 0.8216 : 0.6133) * (D / 2);
      const Le = g.boundary === 'open-open' ? L + 2 * d : g.boundary === 'open-closed' ? L + d : L;
      rows.push({ k: 'End correction Δ', v: `${(d * 1000).toFixed(2)} mm`, note: g.flanged ? 'flanged 0.8216a' : 'unflanged 0.6133a' });
      rows.push({ k: 'Effective length L_eff', v: `${Le} m`, note: 'used in f_n' });
    } else {
      rows.push({ k: 'End correction', v: 'off', note: 'L_eff = L' });
    }
    rows.push({ k: 'Cross-section', v: `${(Math.PI * (D / 2) ** 2 * 1e4).toFixed(2)} cm²`, note: 'circular' });
  } else if (type === 'helmholtz') {
    const A = g.neckShape === 'rectangular'
      ? g.neckWidth * g.neckHeight * (g.nNecks || 1)
      : Math.PI * g.neckRadius ** 2 * (g.nNecks || 1);
    const r = g.neckRadius;
    const delta = g.endCorrectionModel === 'none' ? 0
      : g.endCorrectionModel === 'unflanged' ? 0.6133 * r : 0.8216 * r;
    const Le = g.neckLength + delta;
    rows.push({ k: 'Volume V', v: `${(g.volume * 1e3).toFixed(3)} L`, note: `${g.volume} m³` });
    rows.push({ k: 'Neck area A', v: `${(A * 1e4).toFixed(2)} cm²`, note: `${A} m²` });
    rows.push({ k: 'Neck length L_n', v: `${(g.neckLength * 100).toFixed(2)} cm`, note: 'geometric' });
    rows.push({ k: 'End correction Δ', v: `${(delta * 100).toFixed(2)} cm`, note: g.endCorrectionModel });
    rows.push({ k: 'Effective length L_eff', v: `${(Le * 100).toFixed(2)} cm`, note: 'L_n + Δ' });
  } else if (type === 'rectangular-cavity') {
    rows.push({ k: 'Lx', v: `${g.Lx} m`, note: '' });
    rows.push({ k: 'Ly', v: `${g.Ly} m`, note: '' });
    rows.push({ k: 'Lz', v: `${g.Lz} m`, note: '' });
    rows.push({ k: 'Volume', v: `${(g.Lx * g.Ly * g.Lz).toFixed(4)} m³`, note: 'rigid walls' });
  } else if (type === 'cylindrical-cavity') {
    rows.push({ k: 'Radius a', v: `${g.radius} m`, note: '' });
    rows.push({ k: 'Length L', v: `${g.length} m`, note: '' });
    rows.push({ k: 'Volume', v: `${(Math.PI * g.radius ** 2 * g.length).toFixed(4)} m³`, note: 'π a² L' });
  } else if (type === 'spherical-cavity') {
    rows.push({ k: 'Radius R', v: `${g.radius} m`, note: '' });
    rows.push({ k: 'Volume', v: `${((4 / 3) * Math.PI * g.radius ** 3).toFixed(4)} m³`, note: '4/3 π R³' });
    rows.push({ k: 'Surface', v: `${(4 * Math.PI * g.radius ** 2).toFixed(4)} m²`, note: '4π R²' });
  } else if (type === 'annular-cavity') {
    rows.push({ k: 'Inner radius a', v: `${g.innerRadius} m`, note: '' });
    rows.push({ k: 'Outer radius b', v: `${g.outerRadius} m`, note: '' });
    rows.push({ k: 'Gap b−a', v: `${(g.outerRadius - g.innerRadius).toFixed(4)} m`, note: '' });
    rows.push({ k: 'Volume', v: `${(Math.PI * (g.outerRadius ** 2 - g.innerRadius ** 2) * g.length).toFixed(4)} m³`, note: 'π(b²−a²)L' });
  } else if (type === 'side-branch') {
    rows.push({ k: 'Branch length', v: `${g.branchLength} m`, note: g.boundary });
    rows.push({ k: 'Diameter', v: `${g.diameter} m`, note: 'stub' });
  } else if (type === 'mpp') {
    rows.push({ k: 'Hole diameter', v: `${(g.holeDiameter * 1000).toFixed(2)} mm`, note: '' });
    rows.push({ k: 'Thickness', v: `${(g.panelThickness * 1000).toFixed(2)} mm`, note: '' });
    rows.push({ k: 'Porosity σ', v: `${(g.porosity * 100).toFixed(1)}%`, note: 'open area' });
    rows.push({ k: 'Cavity depth', v: `${(g.backedDepth * 100).toFixed(1)} cm`, note: 'backing' });
  } else if (type === 'horn') {
    rows.push({ k: 'Profile', v: g.hornType, note: '' });
    rows.push({ k: 'Throat a₀', v: `${g.throatRadius} m`, note: '' });
    rows.push({ k: 'Mouth a_L', v: `${g.mouthRadius} m`, note: '' });
    rows.push({ k: 'Length', v: `${g.length} m`, note: '' });
  } else if (type === 'duct-chain') {
    rows.push({ k: 'Segment 1', v: `${g.seg1Length} m · ${g.seg1Area} m²`, note: '' });
    rows.push({ k: 'Segment 2', v: `${g.seg2Length} m · ${g.seg2Area} m²`, note: '' });
    rows.push({ k: 'Segment 3', v: `${g.seg3Length} m · ${g.seg3Area} m²`, note: '' });
    rows.push({ k: 'Loss', v: `${g.lossNp_per_m} Np/m`, note: 'per segment' });
  } else if (type === 'coupled') {
    rows.push({ k: 'f1', v: `${g.f1} Hz`, note: 'uncoupled' });
    rows.push({ k: 'f2', v: `${g.f2} Hz`, note: 'uncoupled' });
    rows.push({ k: 'Coupling Δc', v: `${g.couplingHz} Hz`, note: 'two-mode κ' });
  }

  rows.push({ k: 'Sound speed c', v: `${c.toFixed(2)} m/s`, note: env.cModel });
  rows.push({ k: 'Density ρ', v: `${env.rho.toFixed(4)} kg/m³`, note: env.rhoModel.split(',')[0] });
  return rows;
}
