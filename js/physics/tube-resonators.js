/**
 * Tube resonator physics: open–open, open–closed, closed–closed,
 * with optional end corrections and analytic mode shapes.
 *
 * All lengths in m, frequencies in Hz, c in m/s.
 */

/**
 * End correction (m) for an unflanged open end (Rayleigh):
 *   Δ ≈ 0.6133 * a   (one end)
 * Flanged: Δ ≈ 0.8216 * a
 */
export function endCorrection(radius, flanged = false, model = 'rayleigh') {
  const a = Math.abs(radius);
  if (model === 'none') return 0;
  if (model === 'flanged' || flanged) return 0.8216 * a;
  // default: unflanged Rayleigh
  return 0.6133 * a;
}

/**
 * Effective acoustic length for a tube of geometric length L with open ends.
 * @param {number} L geometric length (m)
 * @param {number} radius tube radius (m)
 * @param {'open-open'|'open-closed'|'closed-closed'} boundary
 * @param {boolean} applyEndCorrection
 * @param {boolean} flanged
 */
export function effectiveLength(L, radius, boundary, applyEndCorrection = true, flanged = false) {
  if (!applyEndCorrection) return L;
  const d = endCorrection(radius, flanged);
  if (boundary === 'open-open') return L + 2 * d;
  if (boundary === 'open-closed') return L + d;
  return L; // both ends closed: no end correction in ideal model
}

/**
 * Resonance frequencies of a uniform tube.
 *
 * open–open  (pressure nodes at both ends):  f_n = n c / (2 L_eff),  n = 1,2,3,...
 * open–closed (node at open, antinode at closed): f_n = (2n−1) c / (4 L_eff),  n = 1,2,3,...
 * closed–closed (antinodes at both ends): same spectrum as open–open: f_n = n c / (2 L_eff)
 *
 * @returns {Array<{n:number, f:Hz, harmonic: number, label: string}>}
 */
export function tubeFrequencies({ L, c, radius = 0.01, boundary = 'open-open',
  nModes = 8, applyEndCorrection = true, flanged = false }) {
  if (!(L > 0)) throw new Error('Tube length L must be positive (m).');
  if (!(c > 0)) throw new Error('Sound speed c must be positive (m/s).');
  const Le = effectiveLength(L, radius, boundary, applyEndCorrection, flanged);
  const modes = [];

  if (boundary === 'open-closed') {
    for (let n = 1; n <= nModes; n++) {
      const harmonic = 2 * n - 1;
      const f = (harmonic * c) / (4 * Le);
      modes.push({
        n,
        harmonic,
        f,
        omega: 2 * Math.PI * f,
        lambda: c / f,
        label: `n=${n} (harmonic ${harmonic})`,
        branch: 'odd',
      });
    }
  } else {
    // open-open and closed-closed share the harmonic series n·c/(2L)
    // but differ in boundary pressure conditions / mode-shape phase.
    for (let n = 1; n <= nModes; n++) {
      const f = (n * c) / (2 * Le);
      modes.push({
        n,
        harmonic: n,
        f,
        omega: 2 * Math.PI * f,
        lambda: c / f,
        label: `n=${n}`,
        branch: 'all',
      });
    }
  }

  return {
    boundary,
    L,
    L_eff: Le,
    endCorrectionEachEnd: applyEndCorrection ? endCorrection(radius, flanged) : 0,
    applyEndCorrection,
    flanged,
    c,
    radius,
    modes,
    formula: boundary === 'open-closed'
      ? 'f_n = (2n−1) c / (4 L_eff)'
      : 'f_n = n c / (2 L_eff)',
    assumptions: [
      'Uniform rigid tube, plane waves',
      'Idealized boundary conditions (perfect node or antinode)',
      applyEndCorrection
        ? `Rayleigh end correction Δ ≈ ${flanged ? '0.8216' : '0.6133'}·a per open end`
        : 'No end correction applied',
      'Neglects visco-thermal losses in frequency (see damping module for Q)',
    ],
  };
}

/**
 * Longitudinal pressure mode shape p(x) for a tube mode.
 * x in [0, L], returns normalized pressure in [−1, 1].
 *
 * open–open:  p(x) = cos(n π x / L),  n = 1,2,...  (nodes at both ends)
 * open–closed: p(x) = sin((2n−1) π x / (2 L)) with node at x=0 (open), antinode at L
 *   Actually: open at x=0 (p=0), closed at x=L (dp/dx=0):
 *   p(x) = sin((2n−1) π x / (2 L))
 * closed–closed: p(x) = cos(n π x / L) with antinodes at both ends
 *   p(x) = cos(n π x / L) works for antinode at 0; at x=L cos(nπ)=±1 antinode. Good.
 */
export function tubePressureMode({ x, L, boundary, n }) {
  const xi = x / L;
  if (boundary === 'open-closed') {
    // open at x=0, closed at x=L
    return Math.sin(((2 * n - 1) * Math.PI * xi) / 2);
  }
  // open-open and closed-closed: cos(n π x / L)
  // For open-open the ends are nodes — wait: cos(0)=1 is antinode.
  // Correct open-open (nodes at ends): p ∝ sin(n π x / L)
  // closed-closed (antinodes at ends): p ∝ cos(n π x / L)
  if (boundary === 'closed-closed') {
    return Math.cos(n * Math.PI * xi);
  }
  return Math.sin(n * Math.PI * xi);
}

/**
 * Sample a mode shape along the tube.
 * @returns {{x: number[], p: number[], nodes: number[], antinodes: number[]}}
 */
export function sampleTubeMode({ L, boundary, n, nSamples = 100 }) {
  const x = [];
  const p = [];
  for (let i = 0; i < nSamples; i++) {
    const xi = (i / (nSamples - 1)) * L;
    x.push(xi);
    p.push(tubePressureMode({ x: xi, L, boundary, n }));
  }

  // Analytic node / antinode locations (pressure, not particle velocity)
  const nodes = [];
  const antinodes = [];
  if (boundary === 'open-closed') {
    // p = sin((2n−1)π x / (2L))
    // nodes: (2n−1)π x/(2L) = kπ  →  x = 2kL/(2n−1), k = 0..n−1
    // antinodes: (2n−1)π x/(2L) = π/2 + kπ  →  x = (2k+1)L/(2n−1), k = 0..n−1
    for (let k = 0; k < n; k++) {
      nodes.push((2 * k * L) / (2 * n - 1));
    }
    for (let k = 0; k < n; k++) {
      antinodes.push(((2 * k + 1) * L) / (2 * n - 1));
    }
  } else if (boundary === 'closed-closed') {
    // p = cos(n π x / L)
    // antinodes at x = kL/n, k = 0..n
    // nodes at x = (2k+1)L/(2n), k = 0..n−1
    for (let k = 0; k <= n; k++) {
      antinodes.push((k * L) / n);
    }
    for (let k = 0; k < n; k++) {
      nodes.push(((2 * k + 1) * L) / (2 * n));
    }
  } else {
    // open-open: p = sin(n π x / L)
    // nodes at x = kL/n, k = 0..n
    // antinodes at x = (2k+1)L/(2n), k = 0..n−1
    for (let k = 0; k <= n; k++) {
      nodes.push((k * L) / n);
    }
    for (let k = 0; k < n; k++) {
      antinodes.push(((2 * k + 1) * L) / (2 * n));
    }
  }

  return { x, p, nodes, antinodes, n, boundary, L };
}

/**
 * Draw a schematic description of the tube for visualization modules.
 */
export function tubeSchematic({ L, radius, boundary }) {
  return {
    type: 'tube',
    L,
    radius,
    boundary,
    openEnd: boundary === 'open-open' ? 'both' : boundary === 'open-closed' ? 'left' : 'none',
    closedEnd: boundary === 'closed-closed' ? 'both' : boundary === 'open-closed' ? 'right' : 'none',
  };
}
