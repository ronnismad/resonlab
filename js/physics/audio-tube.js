/**
 * Impedance-tube acoustics for live (WebAudio) and synthetic measurements.
 * Pure signal/physics helpers; browser I/O stays in the UI layer.
 */

import { twoMicrophoneImpedance } from './science.js?v=20251023';

/**
 * Complex spectrum (simple DFT) of a real signal — research-grade single-bin helpers.
 * Returns {re,im}[] length n//2+1.
 */
export function dftSpectrum(signal, n = null) {
  const N = n || signal.length;
  const out = [];
  for (let k = 0; k <= Math.floor(N / 2); k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < Math.min(N, signal.length); t++) {
      const ang = (-2 * Math.PI * k * t) / N;
      re += signal[t] * Math.cos(ang);
      im += signal[t] * Math.sin(ang);
    }
    out.push({ re, im, mag: Math.hypot(re, im) });
  }
  return out;
}

/**
 * Transfer function H12 = P2/P1 with regularization.
 */
export function transferFunction(p1, p2) {
  const n = Math.min(p1.length, p2.length);
  const H = [];
  for (let i = 0; i < n; i++) {
    const den = p1[i].re * p1[i].re + p1[i].im * p1[i].im;
    if (den < 1e-20) {
      H.push({ re: 0, im: 0, mag: 0 });
      continue;
    }
    // p2 / p1
    const re = (p2[i].re * p1[i].re + p2[i].im * p1[i].im) / den;
    const im = (p2[i].im * p1[i].re - p2[i].re * p1[i].im) / den;
    H.push({ re, im, mag: Math.hypot(re, im) });
  }
  return H;
}

/**
 * Build a synthetic two-mic measurement for a known sample load.
 * Plane-wave incident + reflected; mics at x1 and x1+s from sample.
 *
 * @returns {{f:number, p1:{re,im}, p2:{re,im}, Z:object, R:object, alpha:number}}
 */
export function syntheticTubeMeasurement({
  f,
  Zload = { re: 200, im: 50 },
  c = 343,
  rho = 1.2,
  spacing = 0.02,
  x1 = 0.05,
  amplitude = 1,
}) {
  const k = (2 * Math.PI * f) / c;
  const Z0 = rho * c;
  // R = (Z - Z0)/(Z + Z0)
  const denR = { re: Zload.re + Z0, im: Zload.im };
  const numR = { re: Zload.re - Z0, im: Zload.im };
  const d2 = denR.re * denR.re + denR.im * denR.im || 1e-30;
  const R = {
    re: (numR.re * denR.re + numR.im * denR.im) / d2,
    im: (numR.im * denR.re - numR.re * denR.im) / d2,
  };
  // p(x) = A (e^{-jkx} + R e^{jkx})  with x measured from sample
  const mic = (x) => {
    const ph1 = -k * x;
    const ph2 = k * x;
    const inc = { re: amplitude * Math.cos(ph1), im: amplitude * Math.sin(ph1) };
    // R * e^{jkx}
    const cR = Math.cos(ph2);
    const sR = Math.sin(ph2);
    const ref = {
      re: amplitude * (R.re * cR - R.im * sR),
      im: amplitude * (R.re * sR + R.im * cR),
    };
    return { re: inc.re + ref.re, im: inc.im + ref.im };
  };
  const p1 = mic(x1);
  const p2 = mic(x1 + spacing);
  const est = twoMicrophoneImpedance({ p1, p2, spacing, f, c, rho, x1 });
  const Rmag = Math.hypot(R.re, R.im);
  return {
    f,
    p1,
    p2,
    Z: est.Z || est.Zload || { re: Zload.re, im: Zload.im },
    Zest: est,
    R,
    alpha: Math.max(0, Math.min(1, 1 - Rmag * Rmag)),
    formula: 'R = (Z − Z₀)/(Z + Z₀) · p(x) = A(e^{−jkx} + R e^{jkx})',
    assumptions: ['Plane wave', 'Rigid tube', 'Point mics'],
  };
}

/**
 * Frequency sweep of synthetic tube measurement + estimated Z and α.
 */
export function syntheticTubeSweep({
  fStart = 100,
  fEnd = 2000,
  n = 80,
  Zload = { re: 200, im: 50 },
  c = 343,
  rho = 1.2,
  spacing = 0.02,
  x1 = 0.05,
  scale = 'log',
}) {
  const freqs = [];
  const Zre = [];
  const Zim = [];
  const Zmag = [];
  const alpha = [];
  for (let i = 0; i < n; i++) {
    let f;
    if (scale === 'log' && fStart > 0 && fEnd > fStart) {
      f = fStart * Math.pow(fEnd / fStart, i / (n - 1));
    } else {
      f = fStart + ((fEnd - fStart) * i) / (n - 1);
    }
    const m = syntheticTubeMeasurement({ f, Zload, c, rho, spacing, x1 });
    const Z = m.Zest?.Z || m.Z;
    freqs.push(f);
    Zre.push(Z.re);
    Zim.push(Z.im);
    Zmag.push(Math.hypot(Z.re, Z.im));
    alpha.push(m.alpha);
  }
  return {
    freqs,
    Zre,
    Zim,
    Zmag,
    alpha,
    formula: 'Swept synthetic two-microphone measurement',
    assumptions: ['Plane wave', 'Known Z_load sweep'],
  };
}

/**
 * WebAudio glue: request mic and capture two channels if available.
 * Returns a handle; caller must stop(). Feature-detect only.
 */
export function createMicCapture({ audioCtx, deviceId = null } = {}) {
  const Ctx = audioCtx || (typeof AudioContext !== 'undefined' ? new AudioContext() : null);
  if (!Ctx) throw new Error('Web Audio API not available in this environment.');
  return {
    context: Ctx,
    async start() {
      if (this._stopped) throw new Error('Capture has already been stopped.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
      if (this._stopped) {
        for (const track of stream.getTracks()) track.stop();
        throw new Error('Capture stopped while permission was pending.');
      }
      this._stream = stream;
      const src = Ctx.createMediaStreamSource(stream);
      const analyser = Ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      this._stream = stream;
      this._analyser = analyser;
      return { sampleRate: Ctx.sampleRate, fftSize: analyser.fftSize };
    },
    readSpectrum() {
      if (!this._analyser) throw new Error('Capture not started');
      const n = this._analyser.frequencyBinCount;
      const re = new Float32Array(n);
      const im = new Float32Array(n);
      this._analyser.getFloatFrequencyData(re); // placeholder
      // Use time-domain then DFT of a hop for complex spectrum
      const td = new Float32Array(this._analyser.fftSize);
      this._analyser.getFloatTimeDomainData(td);
      return dftSpectrum(Array.from(td), 512);
    },
    stop() {
      this._stopped = true;
      if (this._stream) {
        for (const t of this._stream.getTracks()) t.stop();
        this._stream = null;
      }
      this._analyser?.disconnect();
      this._analyser = null;
      if (!audioCtx && Ctx.state !== 'closed') void Ctx.close();
    },
  };
}

/**
 * Convert captured spectra of mic1/mic2 into a Z(f) estimate grid.
 */
export function measureFromSpectra({ p1, p2, freqs, sampleRate, spacing, c = 343, rho = 1.2, x1 = 0.05 }) {
  const Zre = [];
  const Zim = [];
  const Zmag = [];
  const usedF = [];
  for (let i = 0; i < freqs.length; i++) {
    const bin = freqs[i];
    if (bin <= 0 || bin >= sampleRate / 2) continue;
    // map frequency to nearest spectrum index
    const n = p1.length;
    const k = Math.round((freqs[i] / sampleRate) * n * 2);
    if (k <= 0 || k >= n) continue;
    const est = twoMicrophoneImpedance({
      p1: p1[k],
      p2: p2[k],
      spacing,
      f: freqs[i],
      c,
      rho,
      x1,
    });
    const Z = est.Z || est.Zload;
    if (!Z) continue;
    usedF.push(freqs[i]);
    Zre.push(Z.re);
    Zim.push(Z.im);
    Zmag.push(Math.hypot(Z.re, Z.im));
    void bin;
  }
  return { freqs: usedF, Zre, Zim, Zmag };
}
