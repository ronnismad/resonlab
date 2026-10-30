/**
 * Plotly visualizations — journal-grade scientific charts.
 * Physics is computed upstream; this module only formats and plots.
 *
 * Style: tight scientific axes, italic quantity labels with SI units,
 * colorblind-safe series, unified hover, peak/range annotations.
 */

let PlotlyRef = null;
const pendingPlots = new WeakMap();
const retiredPlots = new WeakSet();

export function setPlotly(P) {
  PlotlyRef = P;
}

/** Shared comparison/engineering curves; units belong to the selected task. */
export function plotStudyCurves(el, {curves, title, yLabel, theme='dark', yRange}) {
  const P=requirePlotly(),colors=seriesColors(theme),base=themeLayout(theme);
  drawPlot(P,el,curves.map((curve,i)=>({x:curve.x,y:curve.y,name:curve.name,type:'scatter',mode:curve.markers?'lines+markers':'lines',
    line:{color:colors[i%colors.length],width:2,dash:curve.dash?'dot':'solid'},marker:{size:4},
    hovertemplate:'%{x:.4g} Hz<br>%{y:.5g}<extra>%{fullData.name}</extra>'})),{
      ...base,title:{...base.title,text:title},xaxis:{...base.xaxis,title:'Frequency (Hz)'},
      yaxis:{...base.yaxis,title:yLabel,...(yRange?{range:yRange}:{})},
  });
}

export function getPlotly() {
  if (PlotlyRef) return PlotlyRef;
  if (typeof window !== 'undefined' && window.Plotly) {
    PlotlyRef = window.Plotly;
    return PlotlyRef;
  }
  return null;
}

function requirePlotly() {
  const P = getPlotly();
  if (!P) {
    throw new Error('Plotly.js is not loaded. Expected vendor/plotly-2.35.2.min.js from index.html.');
  }
  return P;
}

/** Draw and force a post-layout resize so axis titles stay inside the card. */
function drawPlot(P, el, traces, layout) {
  retiredPlots.delete(el);
  pendingPlots.set(el, Promise.resolve(P.newPlot(el, traces, layout, PLOT_CONFIG)));
  const fit = () => {
    if (retiredPlots.has(el) || !el.isConnected || !el.getClientRects().length) return;
    try {
      const resized = Promise.resolve(P.Plots.resize(el)).catch(() => {});
      pendingPlots.set(el, resized);
    } catch { /* plot removed during layout */ }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(fit));
  } else {
    setTimeout(fit, 0);
  }
}

/* ── Scientific palette (Okabe–Ito inspired, theme-aware) ───────── */
const C = {
  blue: '#0072B2',
  orange: '#E69F00',
  green: '#009E73',
  red: '#D55E00',
  purple: '#CC79A7',
  sky: '#56B4E9',
  yellow: '#F0E442',
  black: '#222222',
};

function seriesColors(theme) {
  // Slightly lighter on dark for contrast.
  return theme === 'light'
    ? [C.blue, C.red, C.green, C.purple, C.orange, C.sky, C.black]
    : ['#4ea8ff', '#ff8a5c', '#3ddea8', '#e78fd4', '#f0c14a', '#7ec8ff', '#c5ccd9'];
}

function themeLayout(theme) {
  const light = theme === 'light';
  const grid = light ? 'rgba(20,30,50,0.08)' : 'rgba(200,215,235,0.08)';
  const zero = light ? 'rgba(20,30,50,0.22)' : 'rgba(200,215,235,0.22)';
  const tick = light ? '#3a4558' : '#a8b2c2';
  const titleInk = light ? '#12161f' : '#eef2f8';
  const body = light ? '#2c3544' : '#c5ccd9';

  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: light ? '#ffffff' : '#0f141d',
    font: {
      color: body,
      size: 12.5,
      family: "'Segoe UI', Inter, system-ui, sans-serif",
    },
    // Title stays in the header band; legend sits INSIDE the plot (no collision).
    title: {
      font: {
        size: 13.5,
        color: titleInk,
        family: "Cambria, 'Times New Roman', Georgia, serif",
      },
      x: 0.012,
      xanchor: 'left',
      y: 0.99,
      yanchor: 'top',
      pad: { t: 4, l: 4 },
    },
    xaxis: {
      gridcolor: grid,
      zerolinecolor: zero,
      zerolinewidth: 1,
      color: tick,
      linewidth: 1.1,
      ticks: 'outside',
      ticklen: 5,
      tickwidth: 1,
      tickcolor: tick,
      showgrid: true,
      showline: true,
      mirror: false,
      automargin: true,
      title: { font: { size: 12, color: body }, standoff: 8 },
    },
    yaxis: {
      gridcolor: grid,
      zerolinecolor: zero,
      zerolinewidth: 1,
      color: tick,
      linewidth: 1.1,
      ticks: 'outside',
      ticklen: 5,
      tickwidth: 1,
      tickcolor: tick,
      showgrid: true,
      showline: true,
      automargin: true,
      title: { font: { size: 12, color: body }, standoff: 6 },
    },
    legend: {
      bgcolor: light ? 'rgba(255,255,255,0.82)' : 'rgba(15,20,29,0.78)',
      bordercolor: light ? '#d7dee9' : '#2a3344',
      borderwidth: 1,
      borderpad: 5,
      font: { color: body, size: 11 },
      orientation: 'v',
      x: 1,
      xanchor: 'right',
      y: 0.98,
      yanchor: 'top',
      itemsizing: 'constant',
      tracegroupgap: 4,
    },
    // Keep titles, axis labels, and legend fully inside the card (no bleed).
    margin: { l: 72, r: 48, t: 56, b: 68 },
    hoverlabel: {
      bgcolor: light ? '#ffffff' : '#1b2230',
      bordercolor: light ? '#c0cad8' : '#3a4558',
      font: { color: titleInk, size: 12 },
    },
    hovermode: 'closest',
    showlegend: true,
    modebar: {
      bgcolor: 'transparent',
      color: light ? '#5c677a' : '#8b95a8',
      activecolor: light ? '#1a6fed' : '#3d8bfd',
      orientation: 'v',
    },
  };
}

const PLOT_CONFIG = {
  responsive: true,
  displaylogo: false,
  displayModeBar: 'hover',
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  toImageButtonOptions: { format: 'png', scale: 2 },
};

/** Axis title with italic symbol + unit: f (Hz) */
function ax(symbol, unit) {
  return unit ? `${symbol}  (${unit})` : symbol;
}

function sciAxis(extra = {}) {
  return {
    tickformat: '.3~g',
    exponentformat: 'power',
    showexponent: 'all',
    ...extra,
  };
}

function peakMarks(xs, ys, label = 'f') {
  // Local maxima annotations (scientific peak callouts).
  const peaks = [];
  for (let i = 1; i < ys.length - 1; i++) {
    if (ys[i] > ys[i - 1] && ys[i] >= ys[i + 1] && ys[i] > 0) {
      const left = ys[i] - ys[i - 1];
      const right = ys[i] - ys[i + 1];
      if (Math.min(left, right) > 0.02 * Math.max(...ys, 1e-12)) {
        peaks.push({ x: xs[i], y: ys[i], i });
      }
    }
  }
  peaks.sort((a, b) => b.y - a.y);
  return peaks.slice(0, 4);
}

/**
 * Frequency-response plot (magnitude / dB / phase).
 */
export function plotFrequencyResponse(el, {
  freqs, mag, magDb, phase, quantity = 'pressure',
  fMarks = [], theme = 'dark', scale = 'log', title = 'Frequency response',
  showPhase = false, yUnit = null,
}) {
  const P = requirePlotly();
  const traces = [];
  const useDb = quantity === 'spl' || quantity === 'db';
  const y = useDb ? magDb : mag;
  const colors = seriesColors(theme);
  const yLabel = useDb
    ? ax('Level', 'dB')
    : yUnit || ax(quantity === 'flow' ? 'U' : '|p|', yUnit ? null : 'a.u.');

  traces.push({
    x: freqs,
    y,
    type: 'scatter',
    mode: 'lines',
    name: useDb ? 'Magnitude (dB)' : 'Magnitude',
    line: { color: colors[0], width: 2.2 },
    fill: 'tozeroy',
    fillcolor: theme === 'light' ? 'rgba(0,114,178,0.10)' : 'rgba(78,168,255,0.12)',
    hovertemplate: useDb
      ? 'f = %{x:.4g} Hz<br>L = %{y:.3f} dB<extra></extra>'
      : 'f = %{x:.4g} Hz<br>|H| = %{y:.4g}<extra></extra>',
  });

  if (showPhase && phase) {
    traces.push({
      x: freqs,
      y: phase.map((p) => (p * 180) / Math.PI),
      type: 'scatter',
      mode: 'lines',
      name: 'Phase',
      yaxis: 'y2',
      line: { color: colors[1], width: 1.4, dash: 'dot' },
      hovertemplate: 'f = %{x:.4g} Hz<br>φ = %{y:.2f}°<extra></extra>',
    });
  }

  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: ax('f', 'Hz'),
      type: scale === 'log' ? 'log' : 'linear',
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis(),
      title: yLabel,
    },
  };

  if (showPhase && phase) {
    layout.yaxis2 = {
      title: ax('φ', 'deg'),
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      zeroline: true,
      zerolinecolor: themeLayout(theme).yaxis.zerolinecolor,
      color: colors[1],
      ticks: 'outside',
      ticklen: 4,
      linewidth: 1,
    };
    layout.legend = { ...layout.legend, y: 1, yanchor: 'top', x: 1, xanchor: 'right' };
  }

  if (fMarks.length) {
    layout.shapes = fMarks.map((f) => ({
      type: 'line',
      x0: f,
      x1: f,
      yref: 'paper',
      y0: 0,
      y1: 1,
      line: { color: colors[1], width: 1, dash: 'dash' },
    }));
    // Marks as vertical guides only (no paper-top labels → no title collision).
    layout.annotations = fMarks.map((f, i) => ({
      x: f,
      y: 0.04 + (i % 3) * 0.06,
      yref: 'paper',
      text: `${f.toPrecision(4)} Hz`,
      showarrow: false,
      font: { size: 9.5, color: colors[1] },
      bgcolor: theme === 'light' ? 'rgba(255,255,255,0.75)' : 'rgba(15,20,29,0.75)',
      borderpad: 2,
    }));
    layout.margin.b = Math.max(layout.margin.b, 64);
  }

  const peaks = peakMarks(freqs, y);
  if (peaks.length && !layout.annotations) layout.annotations = [];
  for (const pk of peaks.slice(0, 2)) {
    layout.annotations.push({
      x: pk.x,
      y: pk.y,
      xref: 'x',
      yref: 'y',
      text: `${pk.x.toPrecision(4)} Hz`,
      showarrow: true,
      arrowhead: 2,
      arrowsize: 0.75,
      arrowwidth: 1,
      ax: 18,
      ay: -36,
      standoff: 4,
      font: { size: 10, color: theme === 'light' ? '#12161f' : '#e8ecf4' },
      bgcolor: theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(15,20,29,0.9)',
      bordercolor: theme === 'light' ? '#c0cad8' : '#3a4558',
      borderwidth: 1,
      borderpad: 3,
    });
  }

  drawPlot(P, el, traces, layout);
}

/**
 * Modal frequency spectrum (scientific stem / lollipop).
 */
export function plotModeSpectrum(el, { modes, theme = 'dark', title = 'Mode spectrum', logY = false }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const freqs = modes.map((m) => m.f);
  const labels = modes.map((m) => m.label || m.n || '');
  const stemY = modes.map(() => 1);

  const traces = [
    {
      x: freqs,
      y: stemY,
      type: 'bar',
      marker: {
        color: colors[0],
        line: { color: colors[0], width: 0 },
        opacity: 0.35,
      },
      width: 0.02,
      hoverinfo: 'skip',
      showlegend: false,
    },
    {
      x: freqs,
      y: stemY,
      type: 'scatter',
      mode: 'markers+text',
      text: labels,
      textposition: 'top center',
      marker: {
        size: 11,
        color: colors[0],
        symbol: 'diamond',
        line: { width: 1, color: theme === 'light' ? '#ffffff' : '#121822' },
      },
      name: 'Eigenfrequencies',
      hovertemplate: '%{text}<br>f = %{x:.4g} Hz<extra></extra>',
    },
  ];

  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: ax('f', 'Hz'),
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      title: 'Mode index',
      showticklabels: false,
      type: logY ? 'log' : 'linear',
      range: [0, 1.35],
      zeroline: false,
      gridcolor: theme === 'light' ? 'rgba(20,30,50,0.06)' : 'rgba(200,215,235,0.06)',
    },
    showlegend: false,
    bargap: 0.15,
    margin: { ...themeLayout(theme).margin, t: 56, b: 68 },
  };

  drawPlot(P, el, traces, layout);
}

/**
 * Longitudinal pressure mode-shape plot.
 */
export function plotTubeModeShape(el, { x, p, nodes, antinodes, theme = 'dark', title = 'Pressure mode shape', n, boundary }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const antiY = antinodes.map((xa) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < x.length; i++) {
      const d = Math.abs(x[i] - xa);
      if (d < bestD) {
        bestD = d;
        best = p[i];
      }
    }
    return best;
  });

  const traces = [
    {
      x,
      y: p,
      type: 'scatter',
      mode: 'lines',
      name: 'p(x) / p_max',
      line: { color: colors[0], width: 2.2 },
      fill: 'tozeroy',
      fillcolor: theme === 'light' ? 'rgba(0,114,178,0.10)' : 'rgba(78,168,255,0.12)',
      hovertemplate: 'x = %{x:.4g} m<br>p/p_max = %{y:.3f}<extra></extra>',
    },
    {
      x: nodes,
      y: nodes.map(() => 0),
      type: 'scatter',
      mode: 'markers',
      name: 'Node',
      marker: { color: colors[1], size: 9, symbol: 'x', line: { width: 1.5 } },
      hovertemplate: 'Node<br>x = %{x:.4g} m<extra></extra>',
    },
    {
      x: antinodes,
      y: antiY,
      type: 'scatter',
      mode: 'markers',
      name: 'Antinode',
      marker: {
        color: colors[2],
        size: 10,
        symbol: 'diamond',
        line: { width: 1, color: theme === 'light' ? '#fff' : '#121822' },
      },
      hovertemplate: 'Antinode<br>x = %{x:.4g} m<extra></extra>',
    },
    {
      x: [x[0], x[x.length - 1]],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      name: 'Equilibrium',
      line: { color: theme === 'light' ? '#9aa3b2' : '#5a6578', width: 1, dash: 'dot' },
      hoverinfo: 'skip',
      showlegend: false,
    },
  ];

  const layout = {
    ...themeLayout(theme),
    title: {
      ...themeLayout(theme).title,
      text: `${title}${n != null ? ` — n = ${n}` : ''}${boundary ? `  (${boundary})` : ''}`,
    },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: ax('x', 'm'),
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis(),
      title: ax('p / p_max', null),
      range: [-1.18, 1.18],
    },
  };

  drawPlot(P, el, traces, layout);
}

/**
 * Coupled-resonator eigenfrequency vs detuning (avoided crossing).
 */
export function plotAvoidedCrossing(el, { detunes, fPlus, fMinus, f1Curve, f2Curve, theme = 'dark', title = 'Avoided crossing' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const traces = [
    {
      x: detunes,
      y: fPlus,
      type: 'scatter',
      mode: 'lines',
      name: 'f₊ coupled',
      line: { color: colors[0], width: 2.4 },
      hovertemplate: 'Δ = %{x:.3g} Hz<br>f₊ = %{y:.4g} Hz<extra></extra>',
    },
    {
      x: detunes,
      y: fMinus,
      type: 'scatter',
      mode: 'lines',
      name: 'f₋ coupled',
      line: { color: colors[1], width: 2.4 },
      hovertemplate: 'Δ = %{x:.3g} Hz<br>f₋ = %{y:.4g} Hz<extra></extra>',
    },
    {
      x: detunes,
      y: f1Curve,
      type: 'scatter',
      mode: 'lines',
      name: 'f₁ uncoupled',
      line: { color: colors[3], width: 1.2, dash: 'dash' },
      hovertemplate: 'f₁ = %{y:.4g} Hz<extra></extra>',
    },
    {
      x: detunes,
      y: f2Curve,
      type: 'scatter',
      mode: 'lines',
      name: 'f₂ uncoupled',
      line: { color: colors[2], width: 1.2, dash: 'dash' },
      hovertemplate: 'f₂ = %{y:.4g} Hz<extra></extra>',
    },
  ];

  // Minimum gap annotation (2κ).
  let gap = Infinity;
  let gapX = 0;
  let gapY = 0;
  for (let i = 0; i < detunes.length; i++) {
    const d = Math.abs(fPlus[i] - fMinus[i]);
    if (d < gap) {
      gap = d;
      gapX = detunes[i];
      gapY = 0.5 * (fPlus[i] + fMinus[i]);
    }
  }

  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: ax('Δf', 'Hz'),
      zeroline: true,
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis(),
      title: ax('f', 'Hz'),
    },
  };

  if (Number.isFinite(gap) && gap > 0) {
    layout.annotations = [{
      x: gapX,
      y: gapY,
      text: `min gap ≈ ${gap.toPrecision(3)} Hz`,
      showarrow: true,
      arrowhead: 2,
      ax: 36,
      ay: -22,
      font: { size: 10, color: theme === 'light' ? '#12161f' : '#e8ecf4' },
      bgcolor: theme === 'light' ? 'rgba(255,255,255,0.88)' : 'rgba(18,24,34,0.88)',
      borderwidth: 1,
      bordercolor: theme === 'light' ? '#c0cad8' : '#3a4558',
    }];
  }

  drawPlot(P, el, traces, layout);
}

/**
 * Mode splitting vs coupling strength.
 */
export function plotSplittingVsCoupling(el, { couplings, splittings, theme = 'dark', title = 'Mode splitting vs coupling' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const traces = [
    {
      x: couplings,
      y: splittings,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Δf = f₊ − f₋',
      line: { color: colors[0], width: 2 },
      marker: { size: 6, symbol: 'circle', line: { width: 1, color: theme === 'light' ? '#fff' : '#121822' } },
      hovertemplate: 'κ = %{x:.3g} Hz<br>Δf = %{y:.3g} Hz<extra></extra>',
    },
    {
      x: couplings,
      y: couplings.map((c) => 2 * c),
      type: 'scatter',
      mode: 'lines',
      name: '2κ theory',
      line: { color: colors[1], width: 1.3, dash: 'dot' },
      hovertemplate: '2κ = %{y:.3g} Hz<extra></extra>',
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: ax('κ', 'Hz'),
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis(),
      title: ax('Δf', 'Hz'),
    },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Damping / Q breakdown bar chart (1/Q ledger).
 */
export function plotQBreakdown(el, { mechanisms, Q, theme = 'dark', title = 'Q factor breakdown' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const inv = mechanisms.map((m) => (Number.isFinite(m.Q) && m.Q > 0 ? 1 / m.Q : 0));
  const traces = [
    {
      x: mechanisms.map((m) => m.name),
      y: inv,
      type: 'bar',
      marker: {
        color: mechanisms.map((_, i) => colors[i % colors.length]),
        line: { width: 0 },
        opacity: 0.9,
      },
      name: '1/Q_k',
      hovertemplate: '%{x}<br>Q_k = %{customdata:.1f}<br>1/Q_k = %{y:.4g}<extra></extra>',
      customdata: mechanisms.map((m) => m.Q),
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: {
      ...themeLayout(theme).title,
      text: `${title} — Q_load = ${Number.isFinite(Q) ? Q.toFixed(1) : '∞'}`,
    },
    xaxis: {
      ...themeLayout(theme).xaxis,
      title: 'Loss mechanism',
      tickangle: -18,
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis({ exponentformat: 'e' }),
      title: ax('1 / Q_k', null),
    },
    bargap: 0.28,
    showlegend: false,
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Complex pole / s-plane plot (real vs imag) with damping rays.
 */
export function plotPoles(el, { poles, theme = 'dark', title = 'Complex poles (s-plane)' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const re = poles.map((p) => p.pole.re);
  const im = poles.map((p) => p.pole.im);
  const yMax = Math.max(1, ...im.map(Math.abs)) * 1.15;
  // Keep the view tight around the poles (high-Q poles hug the jω axis).
  const reMin = Math.min(0, ...re);
  const reMax = Math.max(0, ...re);
  const reSpan = Math.max(Math.abs(reMin), Math.abs(reMax), 1);
  const xMin = reMin - reSpan * 0.18;
  const xMax = reMax + reSpan * 0.08;

  // Stagger labels so near-collinear poles don't stack (n=1…n=8 pile-up).
  const textPos = poles.map((_, i) => {
    const k = i % 4;
    return k === 0 ? 'middle right'
      : k === 1 ? 'top right'
      : k === 2 ? 'bottom right'
      : 'middle left';
  });
  const labelText = poles.map((p, i) => (i < 4 || i === poles.length - 1 ? p.label : ''));

  const traces = [
    {
      x: [0, 0],
      y: [-yMax, yMax],
      mode: 'lines',
      line: { color: theme === 'light' ? '#9aa3b2' : '#5a6578', width: 1, dash: 'dash' },
      name: 'jω axis',
      hoverinfo: 'skip',
    },
    {
      x: [xMin, xMax],
      y: [0, 0],
      mode: 'lines',
      line: { color: theme === 'light' ? '#9aa3b2' : '#5a6578', width: 1, dash: 'dash' },
      name: 'σ axis',
      hoverinfo: 'skip',
      showlegend: false,
    },
    {
      x: re,
      y: im,
      type: 'scatter',
      mode: 'markers+text',
      text: labelText,
      textposition: textPos,
      textfont: { size: 10 },
      cliponaxis: false,
      marker: {
        size: 11,
        color: colors[0],
        symbol: 'diamond',
        line: { width: 1.2, color: theme === 'light' ? '#fff' : '#121822' },
      },
      name: 'Poles',
      customdata: poles.map((p) => p.label),
      hovertemplate:
        '%{customdata}<br>Re(s) = %{x:.3g} s⁻¹<br>Im(s) = %{y:.3g} rad/s<extra></extra>',
    },
  ];

  // Constant-ζ rays for first pole (scientific damping guide).
  if (poles.length && im[0]) {
    const zeta = Math.abs(re[0]) / Math.hypot(re[0], im[0]);
    const slope = Math.tan(Math.acos(Math.min(1, zeta)));
    traces.push({
      x: [0, xMin],
      y: [0, xMin * slope],
      mode: 'lines',
      line: { color: colors[1], width: 1, dash: 'dot' },
      name: `ζ ≈ ${zeta.toFixed(3)}`,
      hoverinfo: 'skip',
    });
    traces.push({
      x: [0, xMin],
      y: [0, -xMin * slope],
      mode: 'lines',
      line: { color: colors[1], width: 1, dash: 'dot' },
      showlegend: false,
      hoverinfo: 'skip',
    });
  }

  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: ax('Re(s) = −σ', 's⁻¹'),
      range: [xMin, xMax],
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis(),
      title: ax('Im(s) = ω_d', 'rad/s'),
      range: [-yMax, yMax],
      scaleanchor: undefined,
    },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Acoustic impedance vs frequency (Re / Im / |Z|).
 */
export function plotImpedance(el, { freqs, Zre, Zim, Zmag, theme = 'dark', title = 'Acoustic impedance', zUnit = 'Pa·s/m³' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const traces = [
    {
      x: freqs,
      y: Zmag,
      name: '|Z|',
      mode: 'lines',
      line: { color: colors[0], width: 2 },
      hovertemplate: 'f = %{x:.4g} Hz<br>|Z| = %{y:.4g}<extra></extra>',
    },
    {
      x: freqs,
      y: Zre,
      name: 'Re Z',
      mode: 'lines',
      line: { color: colors[2], width: 1.5 },
      hovertemplate: 'f = %{x:.4g} Hz<br>Re Z = %{y:.4g}<extra></extra>',
    },
    {
      x: freqs,
      y: Zim,
      name: 'Im Z',
      mode: 'lines',
      line: { color: colors[1], width: 1.5, dash: 'dot' },
      yaxis: 'y2',
      hovertemplate: 'f = %{x:.4g} Hz<br>Im Z = %{y:.4g}<extra></extra>',
    },
    {
      x: [freqs[0], freqs[freqs.length - 1]],
      y: [0, 0],
      mode: 'lines',
      line: { color: theme === 'light' ? '#c0cad8' : '#3a4558', width: 1, dash: 'dot' },
      hoverinfo: 'skip',
      showlegend: false,
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: ax('f', 'Hz'),
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis({ exponentformat: 'e' }),
      title: ax('|Z|, Re Z', zUnit),
    },
    yaxis2: {
      title: ax('Im Z', zUnit),
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      zeroline: true,
      color: colors[1],
      ticks: 'outside',
      ticklen: 4,
      linewidth: 1,
    },
    legend: { ...themeLayout(theme).legend, y: 1, yanchor: 'top', x: 1, xanchor: 'right' },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Parameter sweep line plot with optional reference marker.
 */
export function plotSweep(el, { xs, ys, xLabel = 'x', yLabel = 'y', theme = 'dark', title = 'Parameter sweep', mark = null }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const traces = [
    {
      x: xs,
      y: ys,
      type: 'scatter',
      mode: 'lines+markers',
      name: yLabel,
      line: { color: colors[0], width: 2 },
      marker: {
        size: 4,
        color: colors[0],
        line: { width: 0.5, color: theme === 'light' ? '#fff' : '#121822' },
      },
      hovertemplate: `${xLabel} = %{x:.4g}<br>${yLabel} = %{y:.4g}<extra></extra>`,
    },
  ];
  if (mark && Number.isFinite(mark.x)) {
    traces.push({
      x: [mark.x],
      y: [mark.y],
      type: 'scatter',
      mode: 'markers',
      name: mark.label || 'extremum',
      marker: {
        size: 13,
        color: colors[1],
        symbol: 'star',
        line: { width: 1, color: theme === 'light' ? '#fff' : '#121822' },
      },
      hovertemplate: '%{x:.4g}, %{y:.4g}<extra></extra>',
    });
  }
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: xLabel,
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis(),
      title: yLabel,
    },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * 2D sweep heatmap with scientific colorbar.
 */
export function plotSweepHeatmap(el, { xs, ys, z, xLabel = 'x', yLabel = 'y', theme = 'dark', title = 'Parameter map', zLabel = 'value' }) {
  const P = requirePlotly();
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: xLabel,
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis(),
      title: yLabel,
    },
    margin: { l: 72, r: 88, t: 56, b: 68 },
  };

  const traces = [{
    z,
    x: xs,
    y: ys,
    type: 'heatmap',
    colorscale: theme === 'light'
      ? [
          [0, '#0d0887'], [0.125, '#41049d'], [0.25, '#6a00a8'],
          [0.375, '#9c179e'], [0.5, '#bd3786'], [0.625, '#d8576b'],
          [0.75, '#ed7953'], [0.875, '#fb9f3a'], [1, '#f0f921'],
        ]
      : [
          [0, '#0d0887'], [0.125, '#41049d'], [0.25, '#6a00a8'],
          [0.375, '#9c179e'], [0.5, '#bd3786'], [0.625, '#d8576b'],
          [0.75, '#ed7953'], [0.875, '#fb9f3a'], [1, '#f0f921'],
        ],
    colorbar: {
      title: { text: zLabel, side: 'right', font: { size: 11 } },
      ticks: 'outside',
      ticklen: 4,
      thickness: 14,
      len: 0.9,
    },
    hovertemplate: `${xLabel} = %{x:.4g}<br>${yLabel} = %{y:.4g}<br>${zLabel} = %{z:.4g}<extra></extra>`,
  }];

  drawPlot(P, el, traces, layout);
}

/**
 * Histogram (Monte Carlo) with mean ± σ bands.
 */
export function plotHistogram(el, { histogram, mean, std, theme = 'dark', title = 'Uncertainty distribution', xLabel = 'output' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const mids = histogram.map((b) => 0.5 * (b.x0 + b.x1));
  const counts = histogram.map((b) => b.count);
  const yMax = Math.max(...counts, 1) * 1.12;

  const traces = [
    {
      x: mids,
      y: counts,
      type: 'bar',
      name: 'samples',
      marker: {
        color: colors[0],
        opacity: 0.75,
        line: { width: 0.6, color: theme === 'light' ? '#005a8f' : '#7ec8ff' },
      },
      width: histogram.map((b) => b.x1 - b.x0),
      hovertemplate: 'bin center = %{x:.4g}<br>count = %{y}<extra></extra>',
    },
    {
      x: [mean, mean],
      y: [0, yMax],
      mode: 'lines',
      name: `μ = ${mean.toFixed(4)}`,
      line: { color: colors[1], width: 2 },
      hoverinfo: 'skip',
    },
    {
      x: [mean - std, mean - std, mean + std, mean + std],
      y: [0, yMax, yMax, 0],
      mode: 'lines',
      fill: 'toself',
      fillcolor: theme === 'light' ? 'rgba(230,159,0,0.12)' : 'rgba(240,193,74,0.12)',
      line: { width: 0 },
      name: `±1σ = ${std.toFixed(4)}`,
      hoverinfo: 'skip',
    },
  ];

  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: `${title}  ·  μ = ${mean.toPrecision(4)}` },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: xLabel,
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      ...sciAxis(),
      title: 'Count',
    },
    bargap: 0.04,
    barmode: 'overlay',
    legend: { ...themeLayout(theme).legend, y: 1, yanchor: 'top', x: 1, xanchor: 'right' },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Tornado sensitivity chart (elasticity).
 */
export function plotTornado(el, { items, theme = 'dark', title = 'Sensitivity (elasticity)' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const sorted = [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const traces = [{
    y: sorted.map((s) => s.key),
    x: sorted.map((s) => s.value),
    type: 'bar',
    orientation: 'h',
    marker: {
      color: sorted.map((s) => (s.value >= 0 ? colors[0] : colors[1])),
      opacity: 0.9,
    },
    name: 'elasticity',
    hovertemplate: '%{y}<br>E = %{x:.4g}<extra></extra>',
  }];
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: {
      ...themeLayout(theme).xaxis,
      ...sciAxis(),
      title: ax('E = (∂y/y)/(∂p/p)', null),
      zeroline: true,
      zerolinewidth: 1.5,
    },
    yaxis: {
      ...themeLayout(theme).yaxis,
      title: '',
      autorange: 'reversed',
    },
    showlegend: false,
    margin: { l: 96, r: 48, t: 56, b: 68 },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Group delay τ_g = −dφ/dω (research / dispersion diagnostic).
 */
export function plotGroupDelay(el, { freqs, phase, theme = 'dark', title = 'Group delay', f0 = null }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const tau = [];
  for (let i = 0; i < freqs.length; i++) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(freqs.length - 1, i + 1);
    const dw = 2 * Math.PI * (freqs[i1] - freqs[i0]) || 1e-30;
    let dphi = phase[i1] - phase[i0];
    // unwrap
    while (dphi > Math.PI) dphi -= 2 * Math.PI;
    while (dphi < -Math.PI) dphi += 2 * Math.PI;
    tau.push(-dphi / dw);
  }
  const traces = [
    {
      x: freqs,
      y: tau,
      type: 'scatter',
      mode: 'lines',
      name: 'τ_g',
      line: { color: colors[2], width: 2 },
      hovertemplate: 'f = %{x:.4g} Hz<br>τ_g = %{y:.4g} s<extra></extra>',
    },
    {
      x: [freqs[0], freqs[freqs.length - 1]],
      y: [0, 0],
      mode: 'lines',
      line: { color: theme === 'light' ? '#9aa3b2' : '#5a6578', width: 1, dash: 'dot' },
      showlegend: false,
      hoverinfo: 'skip',
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: { ...themeLayout(theme).xaxis, ...sciAxis(), title: ax('f', 'Hz') },
    yaxis: { ...themeLayout(theme).yaxis, ...sciAxis({ exponentformat: 'e' }), title: ax('τ_g', 's') },
  };
  if (f0 != null) {
    layout.shapes = [{
      type: 'line', x0: f0, x1: f0, yref: 'paper', y0: 0, y1: 1,
      line: { color: colors[1], width: 1, dash: 'dash' },
    }];
  }
  drawPlot(P, el, traces, layout);
}

/**
 * Nyquist plot of complex Z (Re vs Im) — research impedance locus.
 */
export function plotNyquist(el, { Zre, Zim, theme = 'dark', title = 'Nyquist locus of Z' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const traces = [
    {
      x: Zre,
      y: Zim,
      type: 'scatter',
      mode: 'lines',
      name: 'Z(f)',
      line: { color: colors[0], width: 2 },
      hovertemplate: 'Re Z = %{x:.4g}<br>Im Z = %{y:.4g}<extra></extra>',
    },
    {
      x: [Zre[0]],
      y: [Zim[0]],
      type: 'scatter',
      mode: 'markers',
      name: 'start',
      marker: { size: 10, color: colors[2], symbol: 'circle' },
      hoverinfo: 'skip',
    },
    {
      x: [Zre[Zre.length - 1]],
      y: [Zim[Zim.length - 1]],
      type: 'scatter',
      mode: 'markers',
      name: 'end',
      marker: { size: 11, color: colors[1], symbol: 'diamond' },
      hoverinfo: 'skip',
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: { ...themeLayout(theme).xaxis, ...sciAxis({ exponentformat: 'e' }), title: ax('Re Z', 'Pa·s/m³') },
    yaxis: { ...themeLayout(theme).yaxis, ...sciAxis({ exponentformat: 'e' }), title: ax('Im Z', 'Pa·s/m³') },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Energy decay envelope E(t)/E0 = exp(−ω0 t / Q) with T20/T60 markers.
 */
export function plotEnergyDecay(el, { f0, Q, theme = 'dark', title = 'Energy decay envelope' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const w0 = 2 * Math.PI * f0;
  const t60 = Number.isFinite(Q) && Q > 0 ? (6.91 * Q) / w0 : 1;
  const tMax = Math.max(t60 * 1.25, 0.05);
  const n = 200;
  const ts = [];
  const es = [];
  const db = [];
  for (let i = 0; i < n; i++) {
    const t = (tMax * i) / (n - 1);
    ts.push(t);
    const e = Math.exp((-w0 * t) / Math.max(Q, 1e-6));
    es.push(e);
    db.push(10 * Math.log10(Math.max(e, 1e-12)));
  }
  const t20 = t60 / 3;
  const traces = [
    {
      x: ts, y: es, type: 'scatter', mode: 'lines',
      name: 'E(t)/E₀', line: { color: colors[0], width: 2 },
      hovertemplate: 't = %{y:.4g}<br>E/E0 = %{y:.4g}<extra></extra>',
    },
    {
      x: ts, y: db, type: 'scatter', mode: 'lines',
      name: 'level (dB)', yaxis: 'y2',
      line: { color: colors[1], width: 1.4, dash: 'dot' },
      hovertemplate: 't = %{x:.4g} s<br>L = %{y:.2f} dB<extra></extra>',
    },
    {
      x: [t60, t60], y: [0, 1], type: 'scatter', mode: 'lines',
      name: 'T60', line: { color: colors[3], width: 1.5, dash: 'dash' },
      hovertemplate: 'T60 = %{x:.4g} s<extra></extra>',
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: {
      ...themeLayout(theme).title,
      text: `${title} — f₀ = ${f0.toPrecision(4)} Hz, Q = ${Number.isFinite(Q) ? Q.toFixed(1) : '∞'}, T60 ≈ ${t60.toPrecision(3)} s`,
    },
    xaxis: { ...themeLayout(theme).xaxis, ...sciAxis(), title: ax('t', 's') },
    yaxis: { ...themeLayout(theme).yaxis, title: ax('E / E₀', null), range: [0, 1.05] },
    yaxis2: {
      title: ax('Level', 'dB'),
      overlaying: 'y',
      side: 'right',
      showgrid: false,
      color: colors[1],
      range: [-60, 5],
      ticks: 'outside',
      ticklen: 4,
    },
    legend: { ...themeLayout(theme).legend, y: 1, yanchor: 'top', x: 1, xanchor: 'right' },
  };
  void t20;
  drawPlot(P, el, traces, layout);
}

/**
 * Absorption / reflection magnitude from normal-incidence impedance.
 * α = 1 − |R|², R = (Z − Z0)/(Z + Z0)
 */
export function plotAbsorption(el, { freqs, Zre, Zim, Z0, theme = 'dark', title = 'Absorption & reflection' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const alpha = [];
  const rmag = [];
  for (let i = 0; i < freqs.length; i++) {
    const zr = Zre[i] - Z0;
    const zi = Zim[i];
    const den = (Zre[i] + Z0) ** 2 + Zim[i] ** 2 || 1e-30;
    const rRe = (zr * (Zre[i] + Z0) + zi * Zim[i]) / den;
    const rIm = (zi * (Zre[i] + Z0) - zr * Zim[i]) / den;
    const R2 = rRe * rRe + rIm * rIm;
    rmag.push(Math.sqrt(Math.min(1, R2)));
    alpha.push(Math.max(0, Math.min(1, 1 - R2)));
  }
  const traces = [
    {
      x: freqs, y: alpha, type: 'scatter', mode: 'lines',
      name: 'α = 1 − |R|²', line: { color: colors[2], width: 2.2 },
      fill: 'tozeroy',
      fillcolor: theme === 'light' ? 'rgba(0,158,115,0.12)' : 'rgba(61,222,168,0.12)',
      hovertemplate: 'f = %{x:.4g} Hz<br>α = %{y:.3f}<extra></extra>',
    },
    {
      x: freqs, y: rmag, type: 'scatter', mode: 'lines',
      name: '|R|', line: { color: colors[1], width: 1.6 },
      hovertemplate: 'f = %{x:.4g} Hz<br>|R| = %{y:.3f}<extra></extra>',
    },
    {
      x: [freqs[0], freqs[freqs.length - 1]],
      y: [1, 1], mode: 'lines',
      line: { color: theme === 'light' ? '#c0cad8' : '#3a4558', width: 1, dash: 'dot' },
      showlegend: false, hoverinfo: 'skip',
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: {
      ...themeLayout(theme).title,
      text: `${title}  ·  Z₀ = ${Z0.toPrecision(4)} Pa·s/m³`,
    },
    xaxis: { ...themeLayout(theme).xaxis, ...sciAxis(), title: ax('f', 'Hz') },
    yaxis: {
      ...themeLayout(theme).yaxis,
      title: ax('α , |R|', null),
      range: [0, 1.08],
      tickformat: '.2f',
    },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Cumulative mode count N(f) vs Weyl asymptote.
 */
export function plotModeDensity(el, { modes, volume, c, theme = 'dark', title = 'Modal density (Weyl)' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const sorted = [...modes].map((m) => m.f).filter((f) => Number.isFinite(f) && f > 0).sort((a, b) => a - b);
  const fMax = sorted[sorted.length - 1] || 200;
  const n = 120;
  const fs = [];
  const nEmp = [];
  const nWeyl = [];
  for (let i = 1; i <= n; i++) {
    const f = (fMax * i) / n;
    fs.push(f);
    nEmp.push(sorted.filter((x) => x <= f).length);
    const w = 2 * Math.PI * f;
    nWeyl.push((volume * w * w * w) / (6 * Math.PI * Math.PI * c * c * c));
  }
  const traces = [
    {
      x: fs, y: nEmp, type: 'scatter', mode: 'lines+markers',
      name: 'N counted', line: { color: colors[0], width: 2 },
      marker: { size: 3 },
      hovertemplate: 'f = %{x:.4g} Hz<br>N = %{y:.1f}<extra></extra>',
    },
    {
      x: fs, y: nWeyl, type: 'scatter', mode: 'lines',
      name: 'N Weyl', line: { color: colors[1], width: 1.5, dash: 'dash' },
      hovertemplate: 'N_Weyl = %{y:.2f}<extra></extra>',
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: {
      ...themeLayout(theme).title,
      text: `${title}  ·  V = ${volume.toPrecision(3)} m³`,
    },
    xaxis: { ...themeLayout(theme).xaxis, ...sciAxis(), title: ax('f', 'Hz') },
    yaxis: { ...themeLayout(theme).yaxis, ...sciAxis(), title: ax('N(f)', 'count') },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Transmission-loss spectrum (dB vs Hz).
 */
export function plotTransmissionLoss(el, { freqs, TLdB, theme = 'dark', title = 'Transmission loss', mark = null }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const traces = [
    {
      x: freqs,
      y: TLdB,
      type: 'scatter',
      mode: 'lines',
      name: 'TL',
      line: { color: colors[3], width: 2.2 },
      hovertemplate: 'f = %{x:.4g} Hz<br>TL = %{y:.2f} dB<extra></extra>',
    },
  ];
  if (mark && Number.isFinite(mark.x)) {
    traces.push({
      x: [mark.x],
      y: [mark.y],
      type: 'scatter',
      mode: 'markers',
      name: mark.label || 'mark',
      marker: { size: 12, color: colors[1], symbol: 'star' },
    });
  }
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    xaxis: { ...themeLayout(theme).xaxis, ...sciAxis(), title: ax('f', 'Hz') },
    yaxis: { ...themeLayout(theme).yaxis, ...sciAxis(), title: ax('TL', 'dB') },
  };
  drawPlot(P, el, traces, layout);
}

/**
 * Histogram with bootstrap CI band (research uncertainty).
 */
export function plotHistogramCI(el, { histogram, mean, std, ciLo, ciHi, theme = 'dark', title = 'Uncertainty with bootstrap CI', xLabel = 'output' }) {
  const P = requirePlotly();
  const colors = seriesColors(theme);
  const mids = histogram.map((b) => 0.5 * (b.x0 + b.x1));
  const counts = histogram.map((b) => b.count);
  const yMax = Math.max(...counts, 1) * 1.15;
  const traces = [
    {
      x: mids,
      y: counts,
      type: 'bar',
      name: 'samples',
      marker: { color: colors[0], opacity: 0.7, line: { width: 0.6, color: colors[0] } },
      width: histogram.map((b) => b.x1 - b.x0),
      hovertemplate: 'bin = %{x:.4g}<br>count = %{y}<extra></extra>',
    },
    {
      x: [mean, mean],
      y: [0, yMax],
      mode: 'lines',
      name: `μ = ${mean.toFixed(4)}`,
      line: { color: colors[1], width: 2 },
    },
    {
      x: [ciLo, ciLo, ciHi, ciHi],
      y: [0, yMax, yMax, 0],
      mode: 'lines',
      fill: 'toself',
      fillcolor: theme === 'light' ? 'rgba(0,114,178,0.12)' : 'rgba(78,168,255,0.14)',
      line: { width: 1, color: colors[0], dash: 'dash' },
      name: `CI [${ciLo.toFixed(3)}, ${ciHi.toFixed(3)}]`,
      hoverinfo: 'skip',
    },
  ];
  const layout = {
    ...themeLayout(theme),
    title: {
      ...themeLayout(theme).title,
      text: `${title}  ·  σ = ${std.toPrecision(3)}`,
    },
    xaxis: { ...themeLayout(theme).xaxis, ...sciAxis(), title: ax('f₁', 'Hz') },
    yaxis: { ...themeLayout(theme).yaxis, title: 'Count' },
    bargap: 0.04,
    barmode: 'overlay',
  };
  drawPlot(P, el, traces, layout);
}

/**
 * 3-D surface of a 2-D field (FEM mode shape) — research visualization.
 */
export function plotFieldSurface(el, { xs, ys, z, theme = 'dark', title = 'Field surface', zLabel = 'p' }) {
  const P = requirePlotly();
  const light = theme === 'light';
  const traces = [{
    type: 'surface',
    x: xs,
    y: ys,
    z,
    colorscale: [
      [0, '#0d0887'], [0.25, '#6a00a8'], [0.5, '#bd3786'],
      [0.75, '#ed7953'], [1, '#f0f921'],
    ],
    contours: {
      z: { show: true, usecolormap: true, highlightcolor: '#fff', project: { z: true } },
    },
    lighting: { ambient: 0.55, diffuse: 0.6, specular: 0.25, roughness: 0.45 },
    opacity: 0.98,
    colorbar: {
      title: { text: zLabel, side: 'right', font: { size: 11 } },
      thickness: 14,
      len: 0.85,
      ticks: 'outside',
    },
    hovertemplate: 'x = %{x:.3f} m<br>y = %{y:.3f} m<br>p = %{z:.3f}<extra></extra>',
  }];
  const layout = {
    ...themeLayout(theme),
    title: { ...themeLayout(theme).title, text: title },
    margin: { l: 10, r: 70, t: 58, b: 10 },
    scene: {
      xaxis: { title: 'x (m)', gridcolor: light ? '#d7dee9' : '#2a3344', backgroundcolor: light ? '#f7f8fb' : '#0f141d' },
      yaxis: { title: 'y (m)', gridcolor: light ? '#d7dee9' : '#2a3344', backgroundcolor: light ? '#f7f8fb' : '#0f141d' },
      zaxis: { title: zLabel, gridcolor: light ? '#d7dee9' : '#2a3344', backgroundcolor: light ? '#f7f8fb' : '#0f141d' },
      bgcolor: light ? '#eef1f6' : '#0b0f16',
      camera: { eye: { x: 1.55, y: -1.55, z: 1.15 } },
    },
    showlegend: false,
  };
  drawPlot(P, el, traces, layout);
}

export function downloadPlotPNG(el, filename = 'plot.png') {
  const P = requirePlotly();
  return P.downloadImage(el, { format: 'png', width: 1400, height: 800, scale: 2, filename });
}

export function downloadPlotSVG(el, filename = 'plot.svg') {
  const P = requirePlotly();
  return P.downloadImage(el, { format: 'svg', filename });
}

export function disposePlot(el) {
  const P = getPlotly();
  if (P && el) {
    retiredPlots.add(el);
    // Plotly resize is asynchronous. Purging during its auto-margin pass
    // deletes _fullLayout while that pass still needs it.
    Promise.resolve(pendingPlots.get(el)).catch(() => {}).then(() => {
      try { P.purge(el); } catch { /* already disposed */ }
      pendingPlots.delete(el);
    });
  }
}
