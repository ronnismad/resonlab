/**
 * Mode-shape sampling and canvas/SVG rendering helpers.
 * Schematic animations are labeled illustrative — not full-wave field sims.
 */

import { sampleTubeMode, tubePressureMode } from '../physics/tube-resonators.js?v=20251023';
import { cylindricalModeShape, rectangularModeShape, chiPrime, besselJ } from '../physics/cavity-modes.js?v=20251023';

/**
 * Render tube longitudinal mode to a canvas with nodes/antinodes.
 */
export function drawTubeMode(canvas, { L, boundary, n, phase = 0, theme = 'dark', animate = true }) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 48;
  const mid = h / 2 + 8;

  ctx.clearRect(0, 0, w, h);

  const bg = theme === 'light' ? '#f7f8fb' : '#12161f';
  const ink = theme === 'light' ? '#151a22' : '#e8ecf4';
  const muted = theme === 'light' ? '#5c677a' : '#8b95a8';
  const line = theme === 'light' ? '#1a6fed' : '#3d8bfd';
  const nodeC = theme === 'light' ? '#d13a58' : '#f0657a';
  const antiC = theme === 'light' ? '#0f9a62' : '#2fc486';
  const tubeFill = theme === 'light' ? 'rgba(26,111,237,0.08)' : 'rgba(61,139,253,0.12)';
  const gridC = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // subtle grid
  ctx.strokeStyle = gridC;
  ctx.lineWidth = 1;
  for (let x = pad; x <= w - pad; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 48);
    ctx.lineTo(x, h - 48);
    ctx.stroke();
  }

  // Tube body
  const tubeTop = mid - 42;
  const tubeH = 84;
  ctx.fillStyle = tubeFill;
  ctx.strokeStyle = theme === 'light' ? '#a8b2c2' : '#3a4558';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(pad, tubeTop, w - 2 * pad, tubeH, 10);
  else ctx.rect(pad, tubeTop, w - 2 * pad, tubeH);
  ctx.fill();
  ctx.stroke();

  // End caps
  const capW = 7;
  if (boundary === 'closed-closed' || boundary === 'open-closed') {
    ctx.fillStyle = theme === 'light' ? '#8b95a8' : '#6b7588';
    ctx.fillRect(w - pad - capW, tubeTop - 5, capW, tubeH + 10);
  }
  if (boundary === 'closed-closed') {
    ctx.fillRect(pad, tubeTop - 5, capW, tubeH + 10);
  }

  // Pressure curve + fill
  const s = sampleTubeMode({ L, boundary, n, nSamples: 180 });
  const osc = animate ? Math.cos(phase) : 1;
  const amp = 32;

  ctx.beginPath();
  for (let i = 0; i < s.x.length; i++) {
    const px = pad + (s.x[i] / L) * (w - 2 * pad);
    const py = mid - s.p[i] * amp * osc;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.75;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.lineTo(pad + (w - 2 * pad), mid);
  ctx.lineTo(pad, mid);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, mid - amp, 0, mid + amp);
  grad.addColorStop(0, theme === 'light' ? 'rgba(26,111,237,0.22)' : 'rgba(61,139,253,0.28)');
  grad.addColorStop(1, theme === 'light' ? 'rgba(26,111,237,0.04)' : 'rgba(61,139,253,0.05)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Zero line
  ctx.beginPath();
  ctx.moveTo(pad, mid);
  ctx.lineTo(w - pad, mid);
  ctx.strokeStyle = theme === 'light' ? '#c5cad3' : '#2a3344';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Nodes
  for (const xn of s.nodes) {
    const px = pad + (xn / L) * (w - 2 * pad);
    ctx.beginPath();
    ctx.arc(px, mid, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = nodeC;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, mid, 8.5, 0, Math.PI * 2);
    ctx.strokeStyle = nodeC;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Antinodes
  for (const xa of s.antinodes) {
    const px = pad + (xa / L) * (w - 2 * pad);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < s.x.length; i++) {
      const d = Math.abs(s.x[i] - xa);
      if (d < bestD) {
        bestD = d;
        best = s.p[i];
      }
    }
    const py = mid - best * amp * osc;
    ctx.beginPath();
    ctx.moveTo(px, py - 6);
    ctx.lineTo(px + 5.5, py);
    ctx.lineTo(px, py + 6);
    ctx.lineTo(px - 5.5, py);
    ctx.closePath();
    ctx.fillStyle = antiC;
    ctx.fill();
  }

  // Scientific axes
  const axisY = h - 42;
  ctx.strokeStyle = theme === 'light' ? '#9aa3b2' : '#5a6578';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, axisY);
  ctx.lineTo(w - pad, axisY);
  ctx.stroke();
  // ticks every 10% of L
  ctx.fillStyle = muted;
  ctx.font = '10px "Segoe UI", Inter, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 10; i++) {
    const px = pad + (i / 10) * (w - 2 * pad);
    ctx.beginPath();
    ctx.moveTo(px, axisY);
    ctx.lineTo(px, axisY + 4);
    ctx.stroke();
    if (i % 2 === 0) {
      ctx.fillText(((i / 10) * L).toFixed(2), px, axisY + 16);
    }
  }
  ctx.textAlign = 'left';
  ctx.fillText('x  (m)', w - pad - 36, axisY + 30);

  // Labels
  ctx.fillStyle = ink;
  ctx.font = '600 13px "Segoe UI", Inter, sans-serif';
  ctx.fillText(`Pressure mode  ·  ${boundary}  ·  n = ${n}`, pad, 28);
  ctx.fillStyle = muted;
  ctx.font = '11px "Segoe UI", Inter, sans-serif';
  ctx.fillText(`p(x)/p_max`, 12, mid - 36);
  const note = 'Illustrative harmonic animation — not a full-wave simulation';
  ctx.textAlign = 'right';
  ctx.fillText(note, w - pad, 28);
  ctx.textAlign = 'left';

  // Legend
  const lx = w - pad - 150;
  const ly = 28;
  ctx.beginPath();
  ctx.arc(lx, ly - 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = nodeC;
  ctx.fill();
  ctx.fillStyle = muted;
  ctx.font = '10px "Segoe UI", Inter, sans-serif';
  ctx.fillText('pressure node', lx + 10, ly - 1);
  ctx.beginPath();
  ctx.moveTo(lx + 4, ly + 14);
  ctx.lineTo(lx + 8.5, ly + 18);
  ctx.lineTo(lx + 4, ly + 22);
  ctx.lineTo(lx - 0.5, ly + 18);
  ctx.closePath();
  ctx.fillStyle = antiC;
  ctx.fill();
  ctx.fillStyle = muted;
  ctx.fillText('antinode', lx + 14, ly + 21);
}

/**
 * Simple 2D Helmholtz schematic on canvas.
 */
export function drawHelmholtzSchematic(canvas, { volume, neckRadius, neckLength, endCorrection, theme = 'dark', f0 = null, phase = 0 }) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 40;
  ctx.clearRect(0, 0, w, h);
  const bg = theme === 'light' ? '#f7f8fb' : '#12161f';
  const ink = theme === 'light' ? '#151a22' : '#e8ecf4';
  const muted = theme === 'light' ? '#5c677a' : '#8b95a8';
  const fill = theme === 'light' ? 'rgba(124,108,240,0.12)' : 'rgba(124,108,240,0.16)';
  const cavStroke = theme === 'light' ? '#5b4ad4' : '#7c6cf0';
  const neckC = theme === 'light' ? '#1a6fed' : '#3d8bfd';
  const flowC = theme === 'light' ? '#0f9a62' : '#2fc486';
  const warnC = theme === 'light' ? '#b87400' : '#e8a317';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Cavity
  const cavW = w * 0.52;
  const cavH = h * 0.52;
  const cavX = pad + 12;
  const cavY = (h - cavH) / 2 + 16;

  ctx.fillStyle = fill;
  ctx.strokeStyle = cavStroke;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cavX, cavY, cavW, cavH, 16);
  else ctx.rect(cavX, cavY, cavW, cavH);
  ctx.fill();
  ctx.stroke();

  // Neck
  const neckH = Math.max(14, Math.min(48, neckRadius * 360));
  const neckW = Math.max(48, Math.min(180, neckLength * 280));
  const neckX = cavX + cavW - 4;
  const neckY = cavY + cavH / 2 - neckH / 2;

  ctx.fillStyle = theme === 'light' ? 'rgba(26,111,237,0.22)' : 'rgba(61,139,253,0.28)';
  ctx.strokeStyle = neckC;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(neckX, neckY, neckW, neckH, 5);
  else ctx.rect(neckX, neckY, neckW, neckH);
  ctx.fill();
  ctx.stroke();

  // End correction ghost
  if (endCorrection > 0) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = warnC;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(neckX + neckW, neckY, Math.max(10, endCorrection * 280), neckH);
    ctx.setLineDash([]);
    ctx.fillStyle = warnC;
    ctx.font = '600 10px "Segoe UI", sans-serif';
    ctx.fillText('ΔL', neckX + neckW + 6, neckY - 5);
  }

  // Labels
  ctx.fillStyle = ink;
  ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillText('Cavity volume V', cavX + 18, cavY + cavH / 2 + 4);
  ctx.fillStyle = muted;
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.fillText(`V ≈ ${(volume * 1e3).toFixed(2)} L`, cavX + 18, cavY + cavH / 2 + 22);
  ctx.fillStyle = ink;
  ctx.font = '600 11px "Segoe UI", sans-serif';
  ctx.fillText('Neck', neckX + 10, neckY - 8);

  if (f0 != null) {
    ctx.font = '600 14px "Segoe UI", sans-serif';
    ctx.fillStyle = neckC;
    ctx.fillText(`f₀ ≈ ${f0.toFixed(1)} Hz`, pad, 30);
    ctx.fillStyle = muted;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(`a = ${(neckRadius * 1000).toFixed(1)} mm · Lₙ = ${(neckLength * 100).toFixed(1)} cm`, pad, 48);
  }

  // Oscillating mass arrow
  const arrowY = neckY + neckH / 2;
  const amp = 12 * Math.cos(phase);
  ctx.beginPath();
  ctx.moveTo(neckX + 12, arrowY);
  ctx.lineTo(neckX + neckW - 12 + amp, arrowY);
  ctx.strokeStyle = flowC;
  ctx.lineWidth = 2.25;
  ctx.lineCap = 'round';
  ctx.stroke();
  const hx = neckX + neckW - 12 + amp;
  ctx.beginPath();
  ctx.moveTo(hx + 2, arrowY);
  ctx.lineTo(hx - 6, arrowY - 5);
  ctx.lineTo(hx - 6, arrowY + 5);
  ctx.closePath();
  ctx.fillStyle = flowC;
  ctx.fill();

  ctx.fillStyle = muted;
  ctx.font = '10.5px "Segoe UI", sans-serif';
  const note = 'Lumped mass–compliance illustration — not a FEM/CFD field solve';
  ctx.fillText(note, pad, h - 14);
}

/**
 * Cross-section pressure field for rectangular cavity (z = const).
 */
export function rectangularFieldSlice({ Lx, Ly, l, m, n, z, Lz, nx = 60, ny = 40 }) {
  const data = [];
  for (let j = 0; j < ny; j++) {
    const row = [];
    const y = (j / (ny - 1)) * Ly;
    for (let i = 0; i < nx; i++) {
      const x = (i / (nx - 1)) * Lx;
      row.push(rectangularModeShape({ x, y, z, Lx, Ly, Lz, l, m, n }));
    }
    data.push(row);
  }
  return data;
}

/**
 * Cross-section pressure field for cylinder (r, φ) at fixed z.
 */
export function cylindricalFieldSlice({ a, m, p, q, z, L, nr = 40, nphi = 48 }) {
  const data = [];
  for (let j = 0; j < nphi; j++) {
    const row = [];
    const phi = (j / (nphi - 1)) * 2 * Math.PI;
    for (let i = 0; i < nr; i++) {
      const r = (i / (nr - 1)) * a;
      row.push(cylindricalModeShape({ r, phi, z, a, L, m, p, q }));
    }
    data.push(row);
  }
  return data;
}

/**
 * Draw a heatmap of a 2D field onto canvas.
 */
export function drawHeatmap(canvas, field, { theme = 'dark', xLabel = 'x', yLabel = 'y', title = '', zLabel = 'p / p_max' } = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const ny = field.length;
  const nx = field[0].length;
  let maxAbs = 0;
  for (const row of field) for (const v of row) maxAbs = Math.max(maxAbs, Math.abs(v));
  if (maxAbs === 0) maxAbs = 1;

  const img = ctx.createImageData(nx, ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = field[j][i] / maxAbs;
      // diverging blue–white–red (scientific)
      let r, g, b;
      if (v >= 0) {
        r = Math.round(255 * (0.25 + 0.75 * v));
        g = Math.round(255 * (0.55 - 0.12 * v));
        b = Math.round(255 * (0.95 - 0.55 * v));
      } else {
        const a = -v;
        r = Math.round(255 * (0.18 - 0.08 * a));
        g = Math.round(255 * (0.42 + 0.18 * a));
        b = Math.round(255 * (0.78 + 0.18 * a));
      }
      const idx = (j * nx + i) * 4;
      img.data[idx] = r;
      img.data[idx + 1] = g;
      img.data[idx + 2] = b;
      img.data[idx + 3] = 255;
    }
  }

  // scale via offscreen
  const off = document.createElement('canvas');
  off.width = nx;
  off.height = ny;
  off.getContext('2d').putImageData(img, 0, 0);

  const bg = theme === 'light' ? '#f7f8fa' : '#14161c';
  const ink = theme === 'light' ? '#1a1d23' : '#e8eaed';
  const muted = theme === 'light' ? '#5a6070' : '#9aa0b0';
  const padL = 52;
  const padB = 36;
  const padT = 30;
  const padR = 56;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  ctx.drawImage(off, padL, padT, plotW, plotH);

  // frame
  ctx.strokeStyle = theme === 'light' ? '#c0cad8' : '#3a4558';
  ctx.lineWidth = 1;
  ctx.strokeRect(padL, padT, plotW, plotH);

  // colorbar
  const cbX = w - 36;
  const cbY = padT;
  const cbH = plotH;
  const cbW = 12;
  for (let i = 0; i < cbH; i++) {
    const v = 1 - (2 * i) / cbH; // +1 → −1
    let r, g, b;
    if (v >= 0) {
      r = Math.round(255 * (0.25 + 0.75 * v));
      g = Math.round(255 * (0.55 - 0.12 * v));
      b = Math.round(255 * (0.95 - 0.55 * v));
    } else {
      const a = -v;
      r = Math.round(255 * (0.18 - 0.08 * a));
      g = Math.round(255 * (0.42 + 0.18 * a));
      b = Math.round(255 * (0.78 + 0.18 * a));
    }
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(cbX, cbY + i, cbW, 1);
  }
  ctx.strokeStyle = theme === 'light' ? '#c0cad8' : '#3a4558';
  ctx.strokeRect(cbX, cbY, cbW, cbH);
  ctx.fillStyle = muted;
  ctx.font = '10px "Segoe UI", Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('+1', cbX + cbW + 4, cbY + 10);
  ctx.fillText('0', cbX + cbW + 4, cbY + cbH / 2 + 3);
  ctx.fillText('−1', cbX + cbW + 4, cbY + cbH - 2);
  ctx.save();
  ctx.translate(cbX - 6, cbY + cbH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(zLabel, 0, 0);
  ctx.restore();

  ctx.fillStyle = ink;
  ctx.font = '600 12px Cambria, Georgia, serif';
  ctx.fillText(title || 'Pressure field (normalized)', padL, 18);
  ctx.fillStyle = muted;
  ctx.font = '11px "Segoe UI", Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(xLabel, padL + plotW / 2, h - 12);
  ctx.save();
  ctx.translate(16, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
  ctx.textAlign = 'left';
}

export { tubePressureMode, chiPrime, besselJ };
