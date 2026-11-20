export const toNumber = (value) => parseFloat(String(value).replace(',', '.'));

export const COMPARE_ROWS = [
  { label: 'Возраст', get: (a) => a.age, better: null },
  { label: 'Рост, см', get: (a) => a.height, better: null },
  { label: 'Вес, кг', get: (a) => a.weight, better: null },
  { label: 'ИМТ', get: (a, m) => m.bmi, better: null },
  {
    label: 'Жировая масса, %',
    get: (a, m) => m.fatPct,
    better: 'low',
    demo: true,
  },
  {
    label: 'Мышечная масса, кг',
    get: (a, m) => m.muscleMass,
    better: 'high',
    demo: true,
  },
  {
    label: 'Скорость (100 м), с',
    get: (a, m) => toNumber(m.indicators[0].value),
    better: 'low',
    demo: true,
  },
  {
    label: 'Выносливость (YO-YO)',
    get: (a, m) => toNumber(m.indicators[1].value),
    better: 'high',
    demo: true,
  },
  {
    label: 'Сила (присед), кг',
    get: (a, m) => toNumber(m.indicators[2].value),
    better: 'high',
    demo: true,
  },
  {
    label: 'VO2 max',
    get: (a, m) => toNumber(m.indicators[4].value),
    better: 'high',
    demo: true,
  },
];