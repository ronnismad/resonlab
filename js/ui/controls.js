/**
 * UI control helpers: slider/number sync, unit-aware inputs, validation messages.
 * Never silently clamps values — rejects invalid input with clear messages.
 */

const listeners = new WeakMap();

export function on(el, type, fn) {
  el.addEventListener(type, fn);
  return () => el.removeEventListener(type, fn);
}

export function debounce(fn, ms = 120) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function throttle(fn, ms = 50) {
  let last = 0;
  let queued = null;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    } else if (!queued) {
      queued = setTimeout(() => {
        queued = null;
        last = Date.now();
        fn(...args);
      }, ms - (now - last));
    }
  };
}

/**
 * Parse a finite number; returns {ok, value, error}.
 */
export function parseNumber(text, { min = -Infinity, max = Infinity, name = 'value' } = {}) {
  if (text == null) return { ok: false, error: `${name} is required` };
  const s = String(text).trim().replace(',', '.');
  if (s === '') return { ok: false, error: `${name} is required` };
  const v = Number(s);
  if (!Number.isFinite(v)) {
    return { ok: false, error: `${name} must be a finite number` };
  }
  if (v < min) {
    return { ok: false, error: `${name} must be ≥ ${min}` };
  }
  if (v > max) {
    return { ok: false, error: `${name} must be ≤ ${max}` };
  }
  return { ok: true, value: v };
}

/**
 * Bind a number input to a getter/setter with validation.
 * Does NOT clamp: invalid input is marked and the state is not updated.
 */
export function bindNumberInput(input, errorEl, { min, max, name, onCommit, parse = parseNumber }) {
  const handler = () => {
    const raw = input.value;
    const res = parse(raw, { min, max, name });
    if (!res.ok) {
      input.classList.add('invalid');
      if (errorEl) {
        errorEl.textContent = res.error;
        errorEl.hidden = false;
      }
      return;
    }
    input.classList.remove('invalid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
    onCommit(res.value);
  };
  input.addEventListener('change', handler);
  input.addEventListener('blur', handler);
  return handler;
}

/**
 * Paint modern range fill (webkit track gradient via --fill).
 */
export function paintRangeFill(slider) {
  if (!slider) return;
  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const val = Number(slider.value || 0);
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  slider.style.setProperty('--fill', `${Math.max(0, Math.min(100, pct))}%`);
}

/**
 * Bind range slider + number pair. Slider can clamp (native); number cannot.
 */
export function bindSliderNumber({ slider, number, errorEl, min, max, step, name, onCommit, format }) {
  if (slider) {
    slider.min = String(min);
    slider.max = String(max);
    if (step != null) slider.step = String(step);
    paintRangeFill(slider);
    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      paintRangeFill(slider);
      if (number) {
        number.value = format ? format(v) : String(v);
        number.classList.remove('invalid');
      }
      if (errorEl) {
        errorEl.hidden = true;
      }
      onCommit(v);
    });
  }
  if (number) {
    const handler = () => {
      const res = parseNumber(number.value, { min, max, name });
      if (!res.ok) {
        number.classList.add('invalid');
        if (errorEl) {
          errorEl.textContent = res.error;
          errorEl.hidden = false;
        }
        return;
      }
      number.classList.remove('invalid');
      if (errorEl) errorEl.hidden = true;
      if (slider) {
        slider.value = String(res.value);
        paintRangeFill(slider);
      }
      onCommit(res.value);
    };
    number.addEventListener('change', handler);
    number.addEventListener('blur', handler);
    return handler;
  }
  return null;
}

/**
 * Create a parameter row DOM fragment.
 */
export function paramRow({ id, label, unit, tooltip, value, min, max, step, onCommit, extraClass = '' }) {
  const wrap = document.createElement('div');
  wrap.className = `param-row ${extraClass}`;
  wrap.dataset.param = id;

  const lab = document.createElement('label');
  lab.htmlFor = `in-${id}`;
  lab.textContent = label;
  if (tooltip) {
    lab.title = tooltip;
    const info = document.createElement('span');
    info.className = 'tooltip-icon';
    info.textContent = '?';
    info.title = tooltip;
    lab.appendChild(info);
  }

  const controls = document.createElement('div');
  controls.className = 'param-controls';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = `sl-${id}`;
  slider.min = String(min);
  slider.max = String(max);
  if (step != null) slider.step = String(step);
  slider.value = String(value);
  paintRangeFill(slider);

  const number = document.createElement('input');
  number.type = 'number';
  number.id = `in-${id}`;
  number.min = String(min);
  number.max = String(max);
  if (step != null) number.step = String(step);
  number.value = String(value);

  const unitEl = document.createElement('span');
  unitEl.className = 'unit';
  unitEl.textContent = unit || '';

  const err = document.createElement('div');
  err.className = 'field-error';
  err.hidden = true;

  controls.appendChild(slider);
  controls.appendChild(number);
  controls.appendChild(unitEl);

  wrap.appendChild(lab);
  wrap.appendChild(controls);
  wrap.appendChild(err);

  const debounced = debounce((v) => onCommit(v), 80);
  bindSliderNumber({
    slider,
    number,
    errorEl: err,
    min,
    max,
    step,
    name: label,
    onCommit: (v) => {
      // slider moves are debounced; commit is immediate for number blur
      debounced(v);
      // keep slider/number in sync immediately
      slider.value = String(v);
    },
  });

  return {
    el: wrap,
    slider,
    number,
    errorEl: err,
    set(v) {
      slider.value = String(v);
      number.value = String(v);
    },
    setError(msg) {
      if (msg) {
        number.classList.add('invalid');
        err.textContent = msg;
        err.hidden = false;
      } else {
        number.classList.remove('invalid');
        err.hidden = true;
      }
    },
  };
}

export function selectRow({ id, label, tooltip, options, value, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'param-row';
  const lab = document.createElement('label');
  lab.htmlFor = `sel-${id}`;
  lab.textContent = label;
  if (tooltip) {
    lab.title = tooltip;
    const info = document.createElement('span');
    info.className = 'tooltip-icon';
    info.textContent = '?';
    info.title = tooltip;
    lab.appendChild(info);
  }
  const sel = document.createElement('select');
  sel.id = `sel-${id}`;
  for (const opt of options) {
    const o = document.createElement('option');
    if (typeof opt === 'string') {
      o.value = opt;
      o.textContent = opt;
    } else {
      o.value = opt.value;
      o.textContent = opt.label;
    }
    sel.appendChild(o);
  }
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value));
  wrap.appendChild(lab);
  wrap.appendChild(sel);
  return { el: wrap, select: sel };
}

export function checkboxRow({ id, label, tooltip, checked, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'param-row checkbox-row';
  const lab = document.createElement('label');
  lab.htmlFor = `chk-${id}`;
  lab.textContent = label;
  if (tooltip) lab.title = tooltip;
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.id = `chk-${id}`;
  chk.checked = !!checked;
  chk.addEventListener('change', () => onChange(chk.checked));
  wrap.appendChild(chk);
  wrap.appendChild(lab);
  return { el: wrap, checkbox: chk };
}

export function button({ label, onClick, className = 'btn', title = '' }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

export function setBusy(el, busy) {
  if (!el) return;
  el.classList.toggle('busy', !!busy);
  el.setAttribute('aria-busy', busy ? 'true' : 'false');
}

export function flashMessage(el, text, ms = 3200) {
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  el.classList.add('flash');
  setTimeout(() => {
    el.classList.remove('flash');
    el.hidden = true;
    el.textContent = '';
  }, ms);
}

export { listeners };
