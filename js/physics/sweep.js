/**
 * Parameter sweep engine — 1D and 2D sampling of model outputs.
 * Pure functions; UI binds sliders to ranges and plots results.
 */

/**
 * 1D sweep of a scalar model y = f(params) as one parameter varies.
 * @param {function} fn
 * @param {object} params
 * @param {string} key
 * @param {number} min
 * @param {number} max
 * @param {number} n
 * @param {'linear'|'log'} scale
 */
export function sweep1D(fn, params, key, min, max, n = 60, scale = 'linear') {
  if (n < 2) throw new Error('n must be ≥ 2');
  if (max <= min && scale === 'linear') throw new Error('max must exceed min');
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    let x;
    if (scale === 'log') {
      if (!(min > 0 && max > 0)) throw new Error('log sweep requires positive range');
      const t = i / (n - 1);
      x = min * Math.pow(max / min, t);
    } else {
      x = min + ((max - min) * i) / (n - 1);
    }
    let y = NaN;
    try {
      y = fn({ ...params, [key]: x });
    } catch {
      y = NaN;
    }
    xs.push(x);
    ys.push(y);
  }
  return {
    key,
    xs,
    ys,
    min: Math.min(...ys.filter(Number.isFinite)),
    max: Math.max(...ys.filter(Number.isFinite)),
    scale,
  };
}

/**
 * 2D sweep → grid of z values (row-major, y varies slower).
 */
export function sweep2D(fn, params, keyX, rangeX, keyY, rangeY, nX = 24, nY = 24) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < nX; i++) {
    xs.push(rangeX.min + ((rangeX.max - rangeX.min) * i) / (nX - 1 || 1));
  }
  for (let j = 0; j < nY; j++) {
    ys.push(rangeY.min + ((rangeY.max - rangeY.min) * j) / (nY - 1 || 1));
  }
  const z = [];
  for (let j = 0; j < nY; j++) {
    const row = [];
    for (let i = 0; i < nX; i++) {
      let v = NaN;
      try {
        v = fn({ ...params, [keyX]: xs[i], [keyY]: ys[j] });
      } catch {
        v = NaN;
      }
      row.push(v);
    }
    z.push(row);
  }
  return { xs, ys, z, keyX, keyY };
}

/**
 * Find extremum of a 1D sweep (resonance peak / minimum).
 */
export function sweepExtremum(sweep, mode = 'max') {
  let best = null;
  for (let i = 0; i < sweep.xs.length; i++) {
    const y = sweep.ys[i];
    if (!Number.isFinite(y)) continue;
    if (!best || (mode === 'max' ? y > best.y : y < best.y)) {
      best = { x: sweep.xs[i], y, index: i };
    }
  }
  return best;
}

/**
 * Local finite-difference gradient along a sweep (for slope diagnostics).
 */
export function sweepSlope(sweep) {
  const slopes = [];
  for (let i = 1; i < sweep.xs.length; i++) {
    const dx = sweep.xs[i] - sweep.xs[i - 1];
    const dy = sweep.ys[i] - sweep.ys[i - 1];
    slopes.push(dx !== 0 ? dy / dx : NaN);
  }
  return slopes;
}
