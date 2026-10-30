/**
 * Bilingual UI strings — English / Russian.
 * Physics modules stay pure; only UI layers call t().
 */

export const DICT = {
  en: {
    'app.name': 'ResonLab',
    'app.subtitle': 'Acoustic Resonator Studio',
    'app.author': 'Developed by S.Chatterjee',
    'boot.failed': 'Failed to start',
    'lang.label': 'Language',
    'lang.en': 'EN',
    'lang.ru': 'RU',

    'btn.reset': 'Reset',
    'btn.reset.title': 'Reset to defaults',
    'btn.import': 'Import',
    'btn.import.title': 'Load project JSON',
    'btn.save': 'Save',
    'btn.save.title': 'Download a project file; use Import to reopen it',
    'btn.modesCsv': 'Modes CSV',
    'btn.modesCsv.title': 'Modal frequency table',
    'btn.respCsv': 'Response CSV',
    'btn.respCsv.title': 'Frequency response CSV',
    'btn.png': 'PNG',
    'btn.png.title': 'Download current plot as PNG',
    'btn.report': 'Report',
    'btn.report.title': 'Calculation report',
    'btn.copy': 'Copy',
    'btn.copy.title': 'Copy key results',
    'btn.tests': 'Run tests',
    'btn.tests.title': 'Run physics validation',
    'btn.help': 'Help',
    'btn.help.title': 'Open the complete manual',
    'btn.theme.dark': 'Dark',
    'btn.theme.light': 'Light',
    'btn.pause': 'Pause',
    'btn.play': 'Play',
    'btn.export': 'Export',
    'btn.close': 'Close',
    'btn.more': 'More…',

    'tab.geometry': 'Design',
    'tab.modes': 'Modes',
    'tab.response': 'Frequency Response',
    'tab.damping': 'Damping',
    'tab.coupling': 'Coupling',
    'tab.science': 'Science',
    'tab.sweeps': 'Sweeps',
    'tab.impedance': 'Impedance',
    'tab.fem': 'FEM 2D',
    'tab.audio': 'Audio Tube',

    'panel.setup': 'Setup',
    'panel.params': 'Parameters',
    'panel.results': 'Results',
    'panel.computed': 'Computed',

    'sec.units': 'Display units',
    'sec.units.note': 'SI is stored internally. Inputs convert on entry.',
    'sec.type': 'Resonator type',
    'sec.type.note': 'Selects the physics model and geometry fields.',
    'sec.env': 'Environment',
    'sec.env.note': 'Ideal-gas / labeled approximations. c updates when T, p, RH, or gas change.',
    'sec.geo': 'Geometry',
    'sec.geo.note': 'SI internally. Shown in your display units.',
    'sec.freq': 'Frequency sweep',
    'sec.freq.note': 'For response curves. Debounced updates.',
    'sec.damp': 'Damping & Q',
    'sec.damp.note': 'Prefer measured Q when available. 1/Q_L = Σ 1/Q_k.',
    'sec.inv': 'Inverse design',
    'sec.inv.note': 'Solve for one parameter given target f₀. Verified by forward substitution.',
    'sec.coup': 'Coupling sweep',
    'sec.coup.note': 'Two-mode model. Reduced-order — not full-wave.',
    'sec.sci': 'Scientific analysis',
    'sec.sci.note': 'Impedance, sensitivity, dimensionless groups.',
    'sec.sweep': 'Parameter sweeps',
    'sec.sweep.note': '1D map of primary output vs one parameter.',
    'sec.collapse': 'Collapse',
    'sec.expand': 'Expand',

    'label.lenUnit': 'Length unit',
    'label.freqUnit': 'Frequency unit',
    'label.temp': 'Temperature',
    'label.pressure': 'Ambient pressure',
    'label.rh': 'Relative humidity',
    'label.gas': 'Gas',
    'label.startF': 'Start frequency',
    'label.stopF': 'Stop frequency',
    'label.samples': 'Samples',
    'label.freqAxis': 'Frequency axis',
    'label.log': 'Logarithmic',
    'label.linear': 'Linear',
    'label.qIntrinsic': 'Intrinsic Q',
    'label.qExternal': 'External Q',
    'label.enableInv': 'Enable inverse design',
    'label.targetF': 'Target frequency',
    'label.solveFor': 'Solve for',
    'label.showCoupling': 'Show avoided-crossing sweep',
    'label.coupMin': 'Coupling min',
    'label.coupMax': 'Coupling max',
    'label.analysisF': 'Analysis frequency',
    'label.geomUnc': 'Geometry uncertainty',
    'label.mcSamples': 'Monte Carlo samples',
    'label.sweepParam': 'Sweep parameter',
    'label.sweepMin': 'Sweep min',
    'label.sweepMax': 'Sweep max',
    'label.sweepSamples': 'Sweep samples',
    'label.L': 'Length L',
    'label.D': 'Internal diameter D',
    'label.bc': 'Boundary condition',
    'label.applyEc': 'Apply end correction',
    'label.flanged': 'Flanged opening',
    'label.project': 'Project name',
    'label.phase': 'Phase',
    'label.preset': 'Load an example…',

    'type.tube': 'Tube (open/closed)',
    'type.helmholtz': 'Helmholtz resonator',
    'type.rect': 'Rectangular cavity',
    'type.cyl': 'Cylindrical cavity',
    'type.sphere': 'Spherical cavity',
    'type.annular': 'Annular cavity',
    'type.sideBranch': 'Side-branch / quarter-wave',
    'type.mpp': 'Micro-perforated panel (MPP)',
    'type.horn': 'Horn (cone / exponential)',
    'type.duct': 'Duct chain (transfer matrix)',
    'type.coupled': 'Coupled resonators',

    'bc.openOpen': 'Open–open',
    'bc.openClosed': 'Open–closed',
    'bc.closedClosed': 'Closed–closed',

    'kpi.primaryF': 'Primary f',
    'kpi.loadedQ': 'Loaded Q',
    'kpi.bandwidth': 'Bandwidth Δf',
    'kpi.wavelength': 'Wavelength λ',
    'kpi.halfPower': 'half-power',
    'kpi.atRes': 'at primary resonance',
    'kpi.qRule': '1/Q = Σ 1/Qₖ',

    'res.assumptions': 'Assumptions & validity',
    'res.modeTable': 'Modal frequencies',
    'res.geometry': 'Derived geometry',
    'res.noSci': 'No scientific metrics for this model.',
    'res.enableInv': 'Enable inverse design to solve for one parameter.',
    'res.forwardCheck': 'Forward-equation check',
    'res.pass': 'pass',
    'res.review': 'review',
    'res.noDamp': 'No damping data — fix geometry errors first.',
    'res.plotErr': 'Plot unavailable',
    'res.physicsOk': 'Physics results in the right panel remain valid.',
    'res.onlyOneParam': 'Only one numeric parameter available for a secondary sweep.',
    'res.copied': 'Results copied to clipboard',
    'res.resetOk': 'Parameters reset',
    'res.presetLoaded': 'Loaded preset',
    'res.jsonSaved': 'Project JSON downloaded',
    'res.mode1': 'mode 1',

    'help.title': 'ResonLab V1.3 — Manual',
    'help.sub': 'Acoustic Resonator Studio · S. Chatterjee',
    'help.close': 'Close',

    'theme.dark': 'Dark',
    'theme.light': 'Light',
    'label.primaryAnalysis': 'Primary / analysis frequency',
  },

  ru: {
    'app.name': 'ResonLab',
    'app.subtitle': 'Проектировщик акустических резонаторов',
    'app.author': 'Разработано S.Chatterjee',
    'boot.failed': 'Ошибка запуска',
    'lang.label': 'Язык',
    'lang.en': 'EN',
    'lang.ru': 'RU',

    'btn.reset': 'Сброс',
    'btn.reset.title': 'Сбросить к значениям по умолчанию',
    'btn.import': 'Импорт',
    'btn.import.title': 'Загрузить JSON проекта',
    'btn.save': 'Сохранить',
    'btn.save.title': 'Сохранить конфигурацию проекта',
    'btn.modesCsv': 'Моды CSV',
    'btn.modesCsv.title': 'Таблица модальных частот',
    'btn.respCsv': 'Отклик CSV',
    'btn.respCsv.title': 'Частотный отклик в CSV',
    'btn.png': 'PNG',
    'btn.png.title': 'Скачать текущий график в PNG',
    'btn.report': 'Отчёт',
    'btn.report.title': 'Расчётный отчёт',
    'btn.copy': 'Копия',
    'btn.copy.title': 'Скопировать ключевые результаты',
    'btn.tests': 'Тесты',
    'btn.tests.title': 'Запустить проверку физики',
    'btn.help': 'Справка',
    'btn.help.title': 'Открыть полное руководство',
    'btn.theme.dark': 'Тёмная',
    'btn.theme.light': 'Светлая',
    'btn.pause': 'Пауза',
    'btn.play': 'Пуск',
    'btn.export': 'Экспорт',
    'btn.close': 'Закрыть',
    'btn.more': 'Ещё…',

    'tab.geometry': 'Геометрия',
    'tab.modes': 'Моды',
    'tab.response': 'Частотный отклик',
    'tab.damping': 'Демпфирование',
    'tab.coupling': 'Связь',
    'tab.science': 'Научный анализ',
    'tab.sweeps': 'Варьирование',
    'tab.impedance': 'Импеданс',
    'tab.fem': 'ФЕМ 2D',
    'tab.audio': 'Аудио-труба',

    'panel.setup': 'Настройка',
    'panel.params': 'Параметры',
    'panel.results': 'Результаты',
    'panel.computed': 'Расчёт',

    'sec.units': 'Единицы отображения',
    'sec.units.note': 'Внутри всегда СИ. Ввод пересчитывается при вводе.',
    'sec.type': 'Тип резонатора',
    'sec.type.note': 'Выбирает физическую модель и поля геометрии.',
    'sec.env': 'Окружающая среда',
    'sec.env.note': 'Идеальный газ / помеченные приближения. c пересчитывается при T, p, RH или газе.',
    'sec.geo': 'Геометрия',
    'sec.geo.note': 'Внутри СИ. Показано в выбранных единицах.',
    'sec.freq': 'Частотная развёртка',
    'sec.freq.note': 'Для кривых отклика. Обновление с задержкой.',
    'sec.damp': 'Демпфирование и Q',
    'sec.damp.note': 'Предпочитайте измеренный Q. 1/Q_L = Σ 1/Q_k.',
    'sec.inv': 'Обратная задача',
    'sec.inv.note': 'Найти один параметр по целевому f₀. Проверка прямой подстановкой.',
    'sec.coup': 'Варьирование связи',
    'sec.coup.note': 'Двухмодовая модель. Неполная волна.',
    'sec.sci': 'Научный анализ',
    'sec.sci.note': 'Импеданс, чувствительность, безразмерные группы.',
    'sec.sweep': 'Параметрические развёртки',
    'sec.sweep.note': '1D-карта выхода по одному параметру.',
    'sec.collapse': 'Свернуть',
    'sec.expand': 'Развернуть',

    'label.lenUnit': 'Единица длины',
    'label.freqUnit': 'Единица частоты',
    'label.temp': 'Температура',
    'label.pressure': 'Давление',
    'label.rh': 'Отн. влажность',
    'label.gas': 'Газ',
    'label.startF': 'Начальная частота',
    'label.stopF': 'Конечная частота',
    'label.samples': 'Отсчёты',
    'label.freqAxis': 'Ось частоты',
    'label.log': 'Логарифм.',
    'label.linear': 'Линейная',
    'label.qIntrinsic': 'Собственный Q',
    'label.qExternal': 'Внешний Q',
    'label.enableInv': 'Включить обратную задачу',
    'label.targetF': 'Целевая частота',
    'label.solveFor': 'Искать',
    'label.showCoupling': 'Показать развёртку избегаемого скрещивания',
    'label.coupMin': 'Связь мин',
    'label.coupMax': 'Связь макс',
    'label.analysisF': 'Частота анализа',
    'label.geomUnc': 'Неопределённость геометрии',
    'label.mcSamples': 'Выборок Монте-Карло',
    'label.sweepParam': 'Параметр развёртки',
    'label.sweepMin': 'Мин',
    'label.sweepMax': 'Макс',
    'label.sweepSamples': 'Отсчёты развёртки',
    'label.L': 'Длина L',
    'label.D': 'Внутр. диаметр D',
    'label.bc': 'Граничные условия',
    'label.applyEc': 'Учитывать концевую поправку',
    'label.flanged': 'Фланцевое окно',
    'label.project': 'Имя проекта',
    'label.phase': 'Фаза',
    'label.preset': 'Загрузить пресет…',

    'type.tube': 'Труба (откр./закр.)',
    'type.helmholtz': 'Резонатор Гельмгольца',
    'type.rect': 'Прямоугольная полость',
    'type.cyl': 'Цилиндрическая полость',
    'type.sphere': 'Сферическая полость',
    'type.annular': 'Кольцевая полость',
    'type.sideBranch': 'Боковой отвод / четвертьволна',
    'type.mpp': 'Микроперфорированная панель',
    'type.horn': 'Рупор (конический / экспоненц.)',
    'type.duct': 'Цепь каналов (матрица передачи)',
    'type.coupled': 'Связанные резонаторы',

    'bc.openOpen': 'Открыт–открыт',
    'bc.openClosed': 'Открыт–закрыт',
    'bc.closedClosed': 'Закрыт–закрыт',

    'kpi.primaryF': 'Основная f',
    'kpi.loadedQ': 'Нагруженный Q',
    'kpi.bandwidth': 'Полоса Δf',
    'kpi.wavelength': 'Длина волны λ',
    'kpi.halfPower': 'полувысота',
    'kpi.atRes': 'на основном резонансе',
    'kpi.qRule': '1/Q = Σ 1/Qₖ',

    'res.assumptions': 'Допущения и применимость',
    'res.modeTable': 'Модальные частоты',
    'res.geometry': 'Производная геометрия',
    'res.noSci': 'Для этой модели нет научных метрик.',
    'res.enableInv': 'Включите обратную задачу, чтобы найти параметр.',
    'res.forwardCheck': 'Проверка прямым уравнением',
    'res.pass': 'ок',
    'res.review': 'проверить',
    'res.noDamp': 'Нет данных по демпфированию — сначала исправьте геометрию.',
    'res.plotErr': 'График недоступен',
    'res.physicsOk': 'Физические результаты в правой панели остаются корректными.',
    'res.onlyOneParam': 'Для второй развёртки доступен только один числовой параметр.',
    'res.copied': 'Результаты скопированы',
    'res.resetOk': 'Параметры сброшены',
    'res.presetLoaded': 'Загружен пресет',
    'res.jsonSaved': 'JSON проекта сохранён',
    'res.mode1': 'мода 1',

    'help.title': 'ResonLab V1.3 — Руководство',
    'help.sub': 'Проектировщик акустических резонаторов · S. Chatterjee',
    'help.close': 'Закрыть',

    'theme.dark': 'Тёмная',
    'theme.light': 'Светлая',
    'label.primaryAnalysis': 'Основная / частота анализа',
  },
};

let current = 'en';

function detectLang() {
  try {
    const saved = localStorage.getItem('acoustudio.lang');
    if (saved === 'en' || saved === 'ru') return saved;
  } catch { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  return nav.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  current = lang === 'ru' ? 'ru' : 'en';
  try {
    localStorage.setItem('acoustudio.lang', current);
  } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current === 'ru' ? 'ru' : 'en';
  }
  return current;
}

export function initLang() {
  return setLang(detectLang());
}

/** Translate key with optional {vars}. Falls back to en, then the key. */
export function t(key, vars) {
  const table = DICT[current] || DICT.en;
  let s = table[key] ?? DICT.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

/** Toggle EN ↔ RU */
export function toggleLang() {
  return setLang(current === 'en' ? 'ru' : 'en');
}
