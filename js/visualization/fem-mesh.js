/** Draw the actual triangular meridional mesh; no values outside the resonator. */
export function helmholtzMeshSVG(result, modeIndex = 0, showMesh = false) {
  const { nodes, triangles, geometry: g } = result.mesh;
  const mode = result.modes?.[modeIndex];
  const width = 760, height = 560;
  const scale = Math.min(540 / g.radius, 390 / (g.height + g.neckLength));
  const offset = (width - g.radius * scale) / 2 - 20;
  const point = ([r, z]) => [offset + r * scale, height - 75 - z * scale];
  const color = (v) => {
    const t = Math.min(1, Math.abs(v));
    const target = v >= 0 ? [221, 67, 76] : [54, 126, 230];
    return `rgb(${target.map((x) => Math.round(236 + (x - 236) * t)).join(',')})`;
  };
  const faces = triangles.map((tri) => {
    const value = mode ? tri.reduce((s, i) => s + mode.values[i], 0) / 3 : 0;
    const points = tri.map((i) => point(nodes[i]).join(',')).join(' ');
    return `<polygon points="${points}" fill="${mode ? color(value) : '#18334d'}" ${showMesh ? 'stroke="#8396aa" stroke-opacity="0.65" stroke-width="0.4"' : 'stroke="none"'}/>`;
  }).join('');
  const path = (coords) => coords.map((p, i) => `${i ? 'L' : 'M'}${point(p).join(' ')}`).join(' ');
  const top = g.height + g.neckLength;
  const rigid = path([[0, 0], [g.radius, 0], [g.radius, g.height], [g.neckRadius, g.height], [g.neckRadius, top]]);
  const mouth = path([[0, top], [g.neckRadius, top]]);
  const axis = path([[0, 0], [0, top]]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="fem-domain-svg" role="img" aria-label="Actual Helmholtz resonator mesh and axisymmetric pressure field">
    <text x="24" y="28" fill="currentColor" font-size="15" font-weight="600">${mode ? `${mode.label} · ${mode.f.toFixed(2)} Hz` : 'Cavity and neck · conforming triangular mesh'}</text>
    <text x="24" y="52" fill="currentColor" font-size="11">Radius–height section, revolved about r = 0 · true geometric proportions</text>
    ${faces}
    <path d="${rigid}" fill="none" stroke="#93a5b9" stroke-width="2.5"/>
    <path d="${mouth}" fill="none" stroke="#4cdbb2" stroke-width="5"/>
    <path d="${axis}" fill="none" stroke="#bb98f1" stroke-width="2" stroke-dasharray="5 4"/>
    <text x="${point([g.neckRadius, top])[0] + 10}" y="${point([0, top])[1] - 7}" fill="#4cdbb2" font-size="12">Open mouth</text>
    <text x="${offset + g.radius * scale / 2}" y="${height - 48}" fill="currentColor" font-size="12" text-anchor="middle">r: 0 … ${g.radius.toFixed(4)} m</text>
    <text x="${offset - 30}" y="${height / 2}" fill="currentColor" font-size="12" transform="rotate(-90 ${offset - 30} ${height / 2})">z (m) · axis of revolution</text>
    <text x="24" y="${height - 12}" fill="currentColor" font-size="11">${mode ? 'Element-average pressure: blue −1 · white 0 · red +1. ' : ''}Green: mouth · grey: rigid walls · dashed: symmetry axis</text>
  </svg>`;
}
